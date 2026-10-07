// Abgleich zwischen zwei Geräten – im Browser, gegen eine nachgestellte
// Gist-Schnittstelle.
//
// Die echte Schnittstelle ist von hier aus nicht erreichbar, und selbst wenn:
// Ein Prüfwerkzeug, das in ein echtes Konto schreibt, braucht einen echten
// Schlüssel, und der gehört nicht in eine Werkzeugkiste. Nachgestellt werden
// genau die Wege, die `app/abgleich.js` benutzt – Gists auflisten (seitenweise),
// anlegen, lesen, eine frühere Fassung lesen, ändern, die Rohdatei holen –,
// samt der Eigenarten, an denen es scheitern kann: gekürzter Inhalt über einem
// Megabyte, ein fremdes Gerät, das zwischen Holen und Schreiben schreibt, ein
// Schlüssel ohne Recht „gist", ein auf github.com gelöschtes Gist.
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
import { GIST_DATEI } from '../kern/abgleich.js';

const APP_PORT = Number(process.env.APP_PORT) || 3140;
const API_PORT = Number(process.env.API_PORT) || 3199;
const API = `http://localhost:${API_PORT}`;
const SCHLUESSEL = 'ghp_pruefschluessel0123456789abcdef';

/* ------------------------------------------------- nachgestellte Schnittstelle */

/*
 * Vorab 120 fremde Gists, darunter das des Deutsch-Trainers: Das Gist des
 * Trackers landet damit auf der zweiten Seite der Liste. Wer nur die erste
 * liest, legt ein zweites an – und zwei Geräte gleichen dann mit zwei
 * verschiedenen Gists ab, ohne es zu merken.
 */
const gists = [];
let uhr = Date.parse('2026-01-01T00:00:00Z');
function neuesGist(dateien) {
  uhr += 1000;
  const g = { id: createHash('sha1').update(String(uhr)).digest('hex').slice(0, 20),
    created_at: new Date(uhr).toISOString(), fassungen: [] };
  gists.push(g);
  fassungAnhaengen(g, dateien);
  return g;
}
function fassungAnhaengen(g, dateien) {
  const version = createHash('sha1').update(g.id + g.fassungen.length + JSON.stringify(dateien))
    .digest('hex');
  g.fassungen.unshift({ version, dateien });
}
for (let i = 0; i < 119; i += 1) neuesGist({ [`notiz-${i}.md`]: `Notiz ${i}` });
const deutsch = neuesGist({ 'deutschtrainer-lernstand.json': '{"cards":{}}' });

const schalter = { gekuerzt: false, fremdSchreibtDazwischen: null, abgelehnt: false, ohneRecht: false };
const tracker = () => gists.find((g) => g.fassungen[0].dateien[GIST_DATEI] !== undefined);
const imGist = () => JSON.parse(tracker().fassungen[0].dateien[GIST_DATEI]);

function antworten(res, status, koerper, art = 'application/json') {
  res.writeHead(status, {
    'Content-Type': art,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-github-api-version',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    // Wie GitHub: eine Minute zwischenspeicherbar. Ohne `no-store` in der App
    // bekäme das zweite Gerät den Stand von vor einer Minute (Falle 111).
    'Cache-Control': 'private, max-age=60',
  });
  res.end(koerper === undefined ? '' : typeof koerper === 'string' ? koerper : JSON.stringify(koerper));
}

function darstellung(g, fassung = g.fassungen[0]) {
  const files = {};
  for (const [name, inhalt] of Object.entries(fassung.dateien)) {
    const kuerzen = schalter.gekuerzt && name === GIST_DATEI;
    files[name] = {
      filename: name,
      content: kuerzen ? inhalt.slice(0, 100) : inhalt,
      truncated: kuerzen,
      raw_url: `${API}/roh/${g.id}/${fassung.version}/${encodeURIComponent(name)}`,
    };
  }
  return { id: g.id, created_at: g.created_at, public: false, files,
    history: g.fassungen.map((f) => ({ version: f.version })) };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return antworten(res, 204);
  const url = new URL(req.url, API);
  const teile = url.pathname.split('/').filter(Boolean);

  // Die Rohdatei liegt bei GitHub auf einem anderen Rechner und braucht keinen
  // Schlüssel – die App schickt dort auch keinen mit.
  if (teile[0] === 'roh') {
    const g = gists.find((x) => x.id === teile[1]);
    const f = g?.fassungen.find((x) => x.version === teile[2]);
    if (!f) return antworten(res, 404, 'Not Found', 'text/plain');
    return antworten(res, 200, f.dateien[decodeURIComponent(teile[3])], 'text/plain');
  }

  if (req.headers.authorization !== `Bearer ${SCHLUESSEL}` || schalter.abgelehnt) {
    return antworten(res, 401, { message: 'Bad credentials' });
  }
  if (teile[0] !== 'gists') return antworten(res, 404, { message: 'Not Found' });

  if (req.method === 'GET' && teile.length === 1) {
    const seite = Number(url.searchParams.get('page') || 1);
    const je = Number(url.searchParams.get('per_page') || 30);
    return antworten(res, 200, gists.slice((seite - 1) * je, seite * je).map((g) => darstellung(g)));
  }
  let roh = '';
  req.on('data', (x) => { roh += x; });
  req.on('end', () => {
    const k = roh ? JSON.parse(roh) : {};
    if (req.method === 'POST' && teile.length === 1) {
      if (schalter.ohneRecht) return antworten(res, 404, { message: 'Not Found' });
      const dateien = Object.fromEntries(Object.entries(k.files).map(([n, f]) => [n, f.content]));
      return antworten(res, 201, darstellung(neuesGist(dateien)));
    }
    const g = gists.find((x) => x.id === teile[1]);
    if (!g) return antworten(res, 404, { message: 'Not Found' });
    if (req.method === 'GET' && teile.length === 3) {
      const f = g.fassungen.find((x) => x.version === teile[2]);
      return f ? antworten(res, 200, darstellung(g, f)) : antworten(res, 404, { message: 'Not Found' });
    }
    if (req.method === 'GET') return antworten(res, 200, darstellung(g));
    if (req.method === 'PATCH') {
      if (schalter.ohneRecht) return antworten(res, 404, { message: 'Not Found' });
      // Ein anderes Gerät schreibt genau zwischen Holen und Schreiben.
      if (schalter.fremdSchreibtDazwischen) {
        const fremd = schalter.fremdSchreibtDazwischen;
        schalter.fremdSchreibtDazwischen = null;
        fassungAnhaengen(g, { ...g.fassungen[0].dateien, [GIST_DATEI]: fremd(g.fassungen[0].dateien[GIST_DATEI]) });
      }
      const dateien = { ...g.fassungen[0].dateien };
      for (const [n, f] of Object.entries(k.files)) dateien[n] = f.content;
      fassungAnhaengen(g, dateien);
      return antworten(res, 200, darstellung(g));
    }
    return antworten(res, 404, { message: 'Not Found' });
  });
  return undefined;
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

  // Ein Schlüssel ohne Recht „gist" fällt beim Einrichten auf, nicht später.
  await geraet('localhost');
  schalter.ohneRecht = true;
  const ohneRecht = await js(ruf, `${modul}
    try { await d.abgleich.einrichten({ schluessel: '${SCHLUESSEL}', api: '${API}' }); return null; } catch (e) { return e.message; }`);
  pruefe(/„gist"/.test(ohneRecht || '') && !(await stand()).eingerichtet,
    `Ohne Recht „gist" scheitert schon das Einrichten, mit Hinweis (${ohneRecht})`);
  schalter.ohneRecht = false;

  // A richtet ein – nur mit dem Schlüssel: Das Gist wird angelegt.
  let r = await js(ruf, `${modul} return d.abgleich.einrichten({ schluessel: '${SCHLUESSEL}', api: '${API}' });`);
  pruefe(r.ok && tracker(), 'A: Einrichten mit dem Schlüssel allein legt ein geheimes Gist an');
  const imRepo = imGist();
  pruefe(imRepo.sessions.length === 1 && imRepo.essen.length === 1, 'A: Gist enthält Einheit und Mahlzeit');
  pruefe(!JSON.stringify(gists).includes(SCHLUESSEL), 'Der Schlüssel steht in keinem Gist');
  pruefe(deutsch.fassungen.length === 1, 'Das Gist des Deutsch-Trainers bleibt unberührt');
  const sicherung = await js(ruf, `
    const sp = await import('/app/speicher.js');
    return JSON.stringify(await sp.laden());`);
  pruefe(!sicherung.includes(SCHLUESSEL), 'Der Schlüssel steht nicht im Tagebuch (also in keiner Sicherung)');

  // B richtet ein und bekommt alles, samt Profil.
  await geraet('127.0.0.1');
  r = await js(ruf, `${modul} return d.abgleich.einrichten({ schluessel: '${SCHLUESSEL}', api: '${API}' });`);
  let b = await zahlen();
  pruefe(r.ok && b.sessions === 1 && b.essen === 1 && b.gewichtKg === 78.3,
    `B: findet das Gist auf Seite 2 und übernimmt Einheit, Mahlzeit und Profil (${JSON.stringify(b)})`);
  pruefe(gists.filter((g) => g.fassungen[0].dateien[GIST_DATEI] !== undefined).length === 1,
    'B legt kein zweites Gist an');

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
  const vorher = tracker().fassungen.length;
  await abgleichen();
  await geraet('localhost');
  await abgleichen();
  pruefe(tracker().fassungen.length === vorher,
    `Ohne Änderung keine neue Fassung (${tracker().fassungen.length - vorher} neue)`);

  // Großer Bestand: Der Inhalt kommt gekürzt, der Rest über die Rohdatei.
  schalter.gekuerzt = true;
  await js(ruf, `${modul} await d.sessionAnlegen({ datum: '2026-09-04', typ: 'ausdauerLocker', titel: 'Rad', minuten: 60, rpe: 4 }); return true;`);
  r = await abgleichen();
  await geraet('127.0.0.1');
  r = await abgleichen();
  b = await zahlen();
  pruefe(r.ok && b.sessions === 2, 'Gekürzter Inhalt wird über die Rohdatei vollständig gelesen');
  schalter.gekuerzt = false;

  // Ein anderes Gerät schreibt zwischen Holen und Schreiben. Ein Gist kennt
  // keine bedingte Änderung; dessen Eintrag darf trotzdem nicht verloren gehen.
  schalter.fremdSchreibtDazwischen = (text) => {
    const x = JSON.parse(text);
    x.essen.push({ id: 'f_fremd', datum: '2026-09-05', mahlzeit: 'abend', name: 'Vom anderen Gerät',
      mengeG: 100, kcal: 100, protein: 10, kohlenhydrate: 10, fett: 1, alkohol: 0 });
    return JSON.stringify(x);
  };
  await js(ruf, `${modul} await d.gewichtSpeichern({ datum: '2026-09-05', kg: '78,4' }); return true;`);
  r = await abgleichen();
  b = await zahlen();
  pruefe(r.ok && imGist().gewicht.some((g) => g.datum === '2026-09-05')
    && imGist().essen.some((e) => e.id === 'f_fremd') && b.ids.includes('f_fremd'),
    'Gleichzeitiges Schreiben eines anderen Geräts geht nicht verloren – weder im Gist noch hier');
  const wiegungen = imGist().gewicht.length;

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
  pruefe(r.ok && b.gewicht === wiegungen && imGist().gewicht.length === wiegungen,
    `Nach dem Einspielen wird vereinigt, nicht gelöscht (Gerät ${b.gewicht}, Gist ${imGist().gewicht.length})`);

  // Auf github.com gelöscht: Der nächste Abgleich legt ein neues an.
  gists.splice(gists.indexOf(tracker()), 1);
  r = await abgleichen();
  pruefe(r.ok && tracker() && imGist().sessions.length === b.sessions,
    'Ein gelöschtes Gist wird mit dem vollen Stand neu angelegt');

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

  // Die Karte im Profil.
  const karte = await js(ruf, `
    location.hash = 'profil';
    await new Promise((f) => setTimeout(f, 500));
    return document.getElementById('abgleich-karte')?.textContent || null;`);
  pruefe(Boolean(karte && karte.includes('Gist') && karte.includes('Zuletzt abgeglichen')),
    'Profil zeigt Gist und letzten Abgleich');

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
