// Abgleich zwischen zwei Geräten – im Browser, gegen eine nachgestellte
// GitHub-Schnittstelle.
//
// Die echte Schnittstelle ist von hier aus nicht erreichbar, und selbst wenn:
// Ein Prüfwerkzeug, das in ein echtes Repository schreibt, braucht einen
// echten Schlüssel, und der gehört nicht in eine Werkzeugkiste. Nachgestellt
// werden genau die vier Wege, die `app/abgleich.js` benutzt – Repository
// lesen, Datei lesen, Blob lesen, Datei schreiben –, samt `sha`-Konflikt und
// der Eigenart, dass der Inhalt über einem Megabyte nicht mitkommt.
//
// Zwei Geräte sind zwei Ursprünge: `localhost` und `127.0.0.1` haben je eine
// eigene IndexedDB, wie Handy und Laptop.
//
//   node werkzeug/abgleich.mjs
//
// Gibt einen Exitcode zurück. **Leert beide Bestände** samt Abgleich-Einstellung –
// hinterher neu säen.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { verbinde, js, warte } from './cdp.mjs';

const APP_PORT = Number(process.env.APP_PORT) || 3140;
const API_PORT = Number(process.env.API_PORT) || 3199;
const API = `http://localhost:${API_PORT}`;
const REPO = 'nils/fitness-daten';
const SCHLUESSEL = 'pruef-schluessel';
const PFAD = `/repos/${REPO}/contents/trainingstagebuch.json`;

/* ------------------------------------------------- nachgestellte Schnittstelle */

const repo = { datei: null, sha: null, commits: 0 };
const schalter = { ohneInhalt: false, konfliktEinmal: false, abgelehnt: false, privat: true };

function antworten(res, status, koerper) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-github-api-version',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Cache-Control': 'private, max-age=60',
  });
  res.end(koerper === undefined ? '' : JSON.stringify(koerper));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return antworten(res, 204);
  if (req.headers.authorization !== `Bearer ${SCHLUESSEL}` || schalter.abgelehnt) {
    return antworten(res, 401, { message: 'Bad credentials' });
  }
  const url = new URL(req.url, API);
  if (req.method === 'GET' && url.pathname === `/repos/${REPO}`) {
    return antworten(res, 200, { full_name: REPO, private: schalter.privat });
  }
  if (req.method === 'GET' && url.pathname === PFAD) {
    if (!repo.datei) return antworten(res, 404, { message: 'Not Found' });
    return antworten(res, 200, {
      sha: repo.sha,
      size: repo.datei.length,
      encoding: 'base64',
      content: schalter.ohneInhalt ? '' : repo.datei.toString('base64').replace(/(.{60})/g, '$1\n'),
    });
  }
  if (req.method === 'GET' && url.pathname === `/repos/${REPO}/git/blobs/${repo.sha}`) {
    return antworten(res, 200, { sha: repo.sha, content: repo.datei.toString('base64'), encoding: 'base64' });
  }
  if (req.method === 'PUT' && url.pathname === PFAD) {
    let roh = '';
    req.on('data', (s) => { roh += s; });
    req.on('end', () => {
      const k = JSON.parse(roh);
      if (schalter.konfliktEinmal) {
        schalter.konfliktEinmal = false;
        // Ein anderes Gerät hat dazwischen geschrieben.
        return antworten(res, 409, { message: 'is at abc but expected def' });
      }
      if ((k.sha || null) !== repo.sha) return antworten(res, 409, { message: 'sha passt nicht' });
      repo.datei = Buffer.from(k.content, 'base64');
      repo.sha = createHash('sha1').update(repo.datei).digest('hex');
      repo.commits += 1;
      return antworten(res, 200, { content: { sha: repo.sha } });
    });
    return undefined;
  }
  return antworten(res, 404, { message: 'Not Found' });
});

/* ------------------------------------------------------------- Ablauf */

const fehler = [];
function pruefe(bedingung, text) {
  console.log(`${bedingung ? 'ok  ' : 'FEHL'} ${text}`);
  if (!bedingung) fehler.push(text);
}

const { ruf, zu } = await verbinde();
await ruf('Runtime.enable');

async function geraet(host) {
  await ruf('Page.navigate', { url: `http://${host}:${APP_PORT}/#heute` });
  await warte(900);
}

/** Bestand des aktuellen Geräts leeren und die App neu laden. */
async function leeren(host) {
  // Über das Protokoll und nicht mit `indexedDB.deleteDatabase()` in der
  // Seite: Die App hält ihre Verbindung offen, das Löschen bliebe „blocked"
  // stehen, und der nächste Lauf fände den alten Bestand vor.
  await ruf('Storage.clearDataForOrigin', { origin: `http://${host}:${APP_PORT}`,
    storageTypes: 'indexeddb,service_workers,cache_storage' });
  await geraet(host);
  await ruf('Page.reload', { ignoreCache: true });
  await warte(1200);
}

const modul = `const d = await import('/app/daten.js');`;
const zahlen = () => js(ruf, `${modul}
  const z = await d.zustand();
  const roh = await (await import('/app/speicher.js')).laden();
  return { sessions: roh.sessions.length, essen: roh.essen.length, checks: roh.checks.length,
    gewicht: roh.gewicht.length, gewichtKg: roh.profil.gewichtKg, ids: roh.essen.map((e) => e.id) };`);
const abgleichen = () => js(ruf, `${modul} return d.abgleich.abgleichen();`);
const stand = () => js(ruf, `${modul} return { ...d.abgleich.stand };`);

await new Promise((f) => server.listen(API_PORT, f));
try {
  // Gerät A: ein kleines Tagebuch.
  await leeren('localhost');
  await js(ruf, `${modul}
    await d.profilSpeichern({ gewichtKg: '78,3', groesseCm: '183', geburtsjahr: '1996' });
    await d.sessionAnlegen({ datum: '2026-09-01', typ: 'kraft', titel: 'Kraft', minuten: 70, rpe: 7 });
    await d.essenAnlegen({ datum: '2026-09-01', mahlzeit: 'mittag', name: 'Reis', kcal: 130, protein: 2.7, kohlenhydrate: 28, fett: 0.3, mengeG: 200 });
    return true;`);

  // Gerät B: leer.
  await leeren('127.0.0.1');

  // A richtet ein: erster Abgleich legt die Datei an.
  await geraet('localhost');
  let r = await js(ruf, `${modul} return d.abgleich.einrichten({ repository: '${REPO}', schluessel: '${SCHLUESSEL}', api: '${API}' });`);
  pruefe(r.ok && repo.datei, 'A: erster Abgleich legt die Datei im Repository an');
  const imRepo = JSON.parse(repo.datei.toString('utf8'));
  pruefe(imRepo.sessions.length === 1 && imRepo.essen.length === 1, 'A: Datei enthält Einheit und Mahlzeit');
  pruefe(!repo.datei.toString('utf8').includes(SCHLUESSEL), 'Der Schlüssel steht nicht in der Datei');
  const sicherung = await js(ruf, `
    const sp = await import('/app/speicher.js');
    return JSON.stringify(await sp.laden());`);
  pruefe(!sicherung.includes(SCHLUESSEL), 'Der Schlüssel steht nicht im Tagebuch (also in keiner Sicherung)');

  // B richtet ein und bekommt alles, samt Profil.
  await geraet('127.0.0.1');
  r = await js(ruf, `${modul} return d.abgleich.einrichten({ repository: '${REPO}', schluessel: '${SCHLUESSEL}', api: '${API}' });`);
  let b = await zahlen();
  pruefe(r.ok && b.sessions === 1 && b.essen === 1 && b.gewichtKg === 78.3,
    `B: übernimmt Einheit, Mahlzeit und Profil (${JSON.stringify(b)})`);

  // B trägt etwas ein, A holt es.
  await js(ruf, `${modul}
    await d.essenAnlegen({ datum: '2026-09-02', mahlzeit: 'abend', name: 'Quark', kcal: 67, protein: 12, kohlenhydrate: 4, fett: 0.3, mengeG: 250 });
    await d.checkSpeichern({ schlaf: 4, energie: 4, muskelkater: 3, stimmung: 4, stress: 4 });
    return true;`);
  await abgleichen();
  await geraet('localhost');
  await warte(800); // Abgleich beim Öffnen
  await abgleichen();
  let a = await zahlen();
  pruefe(a.essen === 2 && a.checks === 1, `A: holt Mahlzeit und Morgen-Check von B (${a.essen}/${a.checks})`);
  // Der Check von B ist von heute – ohne Neuzeichnen stünde die Bereitschaft
  // nicht in der Kopfzeile von A.
  await warte(300);
  const sichtbar = await js(ruf, `return document.querySelector('#kopfStatus').textContent;`);
  pruefe(sichtbar.includes('Bereitschaft'), `A: Ansicht nach dem Holen neu gezeichnet („${sichtbar}")`);

  // A löscht die Mahlzeit von B; B verliert sie auch.
  const quark = a.ids.find((x) => x !== imRepo.essen[0].id);
  await js(ruf, `${modul} await d.essenLoeschen('${quark}'); return true;`);
  await abgleichen();
  await geraet('127.0.0.1');
  await abgleichen();
  b = await zahlen();
  pruefe(b.essen === 1 && !b.ids.includes(quark), 'B: Löschung von A kommt an');

  // Gleichzeitig auf beiden: B wiegt, A trägt einen Check ein.
  await js(ruf, `${modul} await d.gewichtSpeichern({ datum: '2026-09-03', kg: '78,6' }); return true;`);
  await geraet('localhost');
  await js(ruf, `${modul} await d.checkSpeichern({ datum: '2026-09-03', schlaf: 2, energie: 3, muskelkater: 3, stimmung: 3, stress: 3 }); return true;`);
  await abgleichen();
  await geraet('127.0.0.1');
  await abgleichen();
  await geraet('localhost');
  await abgleichen();
  a = await zahlen();
  await geraet('127.0.0.1');
  b = await zahlen();
  // Eine Wiegung steht schon vom Profil da (`profilSpeichern` schreibt den Verlauf mit).
  pruefe(a.gewicht === 2 && a.checks === 2 && b.gewicht === 2 && b.checks === 2,
    `Gleichzeitige Einträge auf beiden Seiten landen überall (A ${a.gewicht}/${a.checks}, B ${b.gewicht}/${b.checks})`);

  // Ruhe: Ein weiterer Abgleich ohne Änderung schreibt keinen Commit.
  const vorher = repo.commits;
  await abgleichen();
  await geraet('localhost');
  await abgleichen();
  pruefe(repo.commits === vorher, `Ohne Änderung kein Commit (${repo.commits - vorher} neue)`);

  // Großer Bestand: Inhalt kommt nur über den Blob.
  schalter.ohneInhalt = true;
  await js(ruf, `${modul} await d.sessionAnlegen({ datum: '2026-09-04', typ: 'ausdauerLocker', titel: 'Rad', minuten: 60, rpe: 4 }); return true;`);
  r = await abgleichen();
  await geraet('127.0.0.1');
  r = await abgleichen();
  b = await zahlen();
  pruefe(r.ok && b.sessions === 2, 'Ohne mitgelieferten Inhalt liest der Abgleich über die Blob-Schnittstelle');
  schalter.ohneInhalt = false;

  // Konflikt beim Schreiben: neu holen, neu zusammenführen, nichts verloren.
  schalter.konfliktEinmal = true;
  await js(ruf, `${modul} await d.gewichtSpeichern({ datum: '2026-09-05', kg: '78,4' }); return true;`);
  r = await abgleichen();
  pruefe(r.ok && JSON.parse(repo.datei.toString('utf8')).gewicht.some((g) => g.datum === '2026-09-05'),
    'Ein sha-Konflikt wird mit neuem Holen aufgelöst');
  const wiegungen = JSON.parse(repo.datei.toString('utf8')).gewicht.length;

  // Einspielen einer älteren Sicherung löscht auf den anderen Geräten nichts.
  await js(ruf, `${modul}
    const sp = await import('/app/speicher.js');
    const alt = structuredClone(await sp.laden());
    alt.gewicht = [];
    // Den automatischen Download vor dem Ersetzen im Werkzeug unterdrücken.
    HTMLAnchorElement.prototype.click = () => {};
    await d.importUebernehmen(alt);
    return true;`);
  r = await abgleichen();
  b = await zahlen();
  pruefe(r.ok && b.gewicht === wiegungen
    && JSON.parse(repo.datei.toString('utf8')).gewicht.length === wiegungen,
    `Nach dem Einspielen wird vereinigt, nicht gelöscht (Gerät ${b.gewicht}, Repository ${JSON.parse(repo.datei.toString('utf8')).gewicht.length})`);

  // Kein Netz: kein Fehler, keine Warnung.
  await new Promise((f) => server.close(f));
  r = await abgleichen();
  let s = await stand();
  pruefe(!r.ok && s.offline && !s.fehler, 'Ohne Netz: still, keine Fehlermeldung');
  await new Promise((f) => server.listen(API_PORT, f));

  // Abgelaufener Schlüssel: Warnung in jeder Ansicht, mit Weg zum Profil.
  schalter.abgelehnt = true;
  r = await abgleichen();
  s = await stand();
  pruefe(!r.ok && /Zugangsschlüssel/.test(s.fehler || ''), 'Abgelehnter Schlüssel wird gemeldet');
  await warte(300);
  const warnung = await js(ruf, `
    location.hash = 'heute';
    await new Promise((f) => setTimeout(f, 400));
    const w = document.getElementById('abgleich-warnung');
    return w ? w.textContent : null;`);
  pruefe(Boolean(warnung && warnung.includes('Zum Abgleich')), 'Warnung steht in „Heute" samt Knopf');
  schalter.abgelehnt = false;
  r = await abgleichen();
  const weg = await js(ruf, 'return !document.getElementById("abgleich-warnung");');
  pruefe(r.ok && weg, 'Nach gelungenem Abgleich verschwindet die Warnung');

  // Öffentliches Repository wird abgelehnt.
  schalter.privat = false;
  const oeffentlich = await js(ruf, `${modul}
    try { await d.abgleich.einrichten({ repository: '${REPO}', schluessel: '${SCHLUESSEL}', api: '${API}' }); return null; }
    catch (e) { return e.message; }`);
  pruefe(/öffentlich/.test(oeffentlich || ''), 'Ein öffentliches Repository wird abgelehnt');
  schalter.privat = true;

  // Die Karte im Profil.
  const karte = await js(ruf, `
    location.hash = 'profil';
    await new Promise((f) => setTimeout(f, 500));
    return document.getElementById('abgleich-karte')?.textContent || null;`);
  pruefe(Boolean(karte && karte.includes(REPO) && karte.includes('Zuletzt abgeglichen')),
    'Profil zeigt Repository und letzten Abgleich');

  // Trennen lässt das Tagebuch stehen.
  await js(ruf, `${modul} await d.abgleich.trennen(); return true;`);
  b = await zahlen();
  s = await stand();
  pruefe(!s.eingerichtet && b.sessions === 2, 'Trennen: Tagebuch bleibt, Abgleich aus');
} finally {
  // Beide Geräte trennen: Bliebe eines mit der nachgestellten Schnittstelle
  // verbunden, versuchte die App bei jedem Öffnen dorthin abzugleichen – und
  // `konsole.mjs` meldete danach einen Verbindungsfehler, den dieses Werkzeug
  // hinterlassen hat (Falle 34).
  for (const host of ['localhost', '127.0.0.1']) {
    await ruf('Storage.clearDataForOrigin', { origin: `http://${host}:${APP_PORT}`,
      storageTypes: 'indexeddb' }).catch(() => {});
  }
  server.close();
  zu();
}

console.log(fehler.length ? `\n${fehler.length} Fehler.` : '\nAlles in Ordnung.');
process.exit(fehler.length ? 1 : 0);
