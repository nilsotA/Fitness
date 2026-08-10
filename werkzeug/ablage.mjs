// Die beiden Notfälle der Datenablage – und ob die Ratschläge ausführbar sind.
//
// `app/app.js` gibt bei einer klemmenden Ablage zwei entgegengesetzte Räte:
// bei einem **Lesefehler** nichts überschreiben, bei einem **Schreibfehler**
// sofort eine Sicherung herunterladen. Beide waren nicht durchgespielt, und
// beide trugen nicht:
//
//   - Nach einem Lesefehler schrieb der nächste Eintrag das leere Tagebuch
//     über den Bestand (siehe `lesefehler.mjs`).
//   - Bei einem Schreibfehler begann ausgerechnet die empfohlene Sicherung mit
//     einem Schreibvorgang – und scheiterte damit selbst.
//
//   node werkzeug/ablage.mjs
//
// Gibt einen Exitcode zurück.
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte } from './cdp.mjs';

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf);

let fehler = 0;
const pruefe = (name, ok, was = '') => {
  console.log(`  ${ok ? 'ok  ' : '>>  '}${name}${ok ? '' : ` – ${was}`}`);
  if (!ok) fehler += 1;
};

// Eingeschleuste Skripte überleben das Skript, wenn man sie nicht abräumt –
// und legen dann den nächsten Lauf von `saeen.mjs` lahm, weil dessen
// Schreibvorgänge weiter scheitern. Deshalb die Kennungen merken.
const eingeschleust = [];

/**
 * Eine Störung vor dem Laden einbauen und die Ansicht frisch öffnen.
 *
 * Vorher wird die vorige abgeräumt: Sonst wirkt beim zweiten Abschnitt noch
 * der Schreibfehler aus dem ersten, und die Prüfung meldet einen Befund, den
 * sie selbst erzeugt hat.
 */
async function mitStoerung(quelle, ansicht) {
  await aufraeumen({ neuLaden: false });
  const a = await ruf('Page.addScriptToEvaluateOnNewDocument', { source: quelle });
  eingeschleust.push(a.identifier);
  await vorratLeeren(ruf);
  await zurAnsicht(ruf, ansicht, { neuLaden: true });
  await warte(900);
}

async function aufraeumen({ neuLaden = true } = {}) {
  while (eingeschleust.length) {
    const identifier = eingeschleust.pop();
    await ruf('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => {});
  }
  if (!neuLaden) return;
  await ruf('Page.reload', { ignoreCache: true }).catch(() => {});
  await warte(600);
}

/* ------------------------------- Schreibfehler: Sicherung muss trotzdem gehen */

console.log('\nSchreibfehler · die empfohlene Sicherung muss möglich bleiben');
await mitStoerung(`
  const echt = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...a) {
    const anfrage = echt.apply(this, a);
    if (this.name === 'tagebuch') {
      setTimeout(() => {
        Object.defineProperty(anfrage, 'error', { value: new Error('Schreibfehler (Prüfung)') });
        anfrage.onerror && anfrage.onerror({ target: anfrage });
      }, 0);
    }
    return anfrage;
  };
`, 'profil');

const sicherung = await js(ruf, `
  // Den Download abfangen, statt ihn wirklich auszulösen.
  let datei = null;
  const echt = URL.createObjectURL;
  URL.createObjectURL = (b) => { datei = b?.size ?? 0; return echt.call(URL, b); };

  const knopf = [...document.querySelectorAll('button')]
    .find((b) => /Sicherung|Herunterladen|sichern/i.test(b.textContent));
  if (!knopf) return { fehlt: 'kein Sicherungsknopf in der Profilansicht' };
  knopf.click();
  await new Promise((f) => setTimeout(f, 900));
  const t = document.querySelector('.toast, .meldung');
  return { groesse: datei, meldung: t ? t.textContent.slice(0, 120) : null };
`);
if (sicherung.fehlt) {
  pruefe('Sicherungsknopf gefunden', false, sicherung.fehlt);
} else {
  pruefe('die Sicherungsdatei entsteht trotz Schreibfehler',
    Number(sicherung.groesse) > 100,
    `Größe ${sicherung.groesse}, Meldung „${sicherung.meldung}"`);
}

/* --------------------------- Lesefehler: Zurückspielen muss möglich bleiben */

console.log('\nLesefehler · das Zurückspielen einer Sicherung muss möglich bleiben');
await mitStoerung(`
  const echt = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function (...a) {
    const anfrage = echt.apply(this, a);
    if (this.name === 'tagebuch') {
      setTimeout(() => {
        Object.defineProperty(anfrage, 'error', { value: new Error('Lesefehler (Prüfung)') });
        anfrage.onerror && anfrage.onerror({ target: anfrage });
      }, 0);
      return new Proxy(anfrage, {
        set(z, k, v) { z[k] = v; return true; },
        get(z, k) { const w = z[k]; return typeof w === 'function' ? w.bind(z) : w; },
      });
    }
    return anfrage;
  };
`, 'profil');

// Nicht über den Dateidialog – der lässt sich von außen nicht bestücken.
// Geprüft wird die Stelle dahinter, über die auch der Dialog geht.
const zurueck = await js(ruf, `
  const m = await import('./app/daten.js');
  const sicherung = {
    profil: { gewichtKg: 78, groesseCm: 183, geburtsjahr: 1995 },
    sessions: [{ id: 'p1', datum: '2026-08-01', typ: 'kraft', minuten: 60, rpe: 7 }],
    essen: [], checks: [], tests: [], gewicht: [],
  };
  try {
    await m.importUebernehmen(sicherung);
  } catch (e) {
    return { fehler: String(e.message).slice(0, 140) };
  }
  return { ok: true };
`);
pruefe('eine Sicherung lässt sich nach einem Lesefehler einspielen',
  Boolean(zurueck.ok), zurueck.fehler || 'unbekannt');

if (zurueck.ok) {
  // Erst die Störung abräumen und neu laden – sonst scheitert auch das
  // Nachsehen am eingebauten Lesefehler.
  await aufraeumen();
  const stand = await js(ruf, `
    const db = await new Promise((f,r)=>{const a=indexedDB.open('trainingstracker',1);a.onsuccess=()=>f(a.result);a.onerror=()=>r(a.error);});
    return await new Promise((f,r)=>{const t=db.transaction('tagebuch','readonly').objectStore('tagebuch').get('aktuell');t.onsuccess=()=>f(t.result?.sessions?.length ?? -1);t.onerror=()=>r(t.error);});
  `);
  pruefe('und steht danach wirklich in der Datenbank', stand === 1, `${stand} Einheiten`);
}

await aufraeumen();

console.log(fehler === 0
  ? '\nBeide Notfälle sind bedienbar.'
  : `\n${fehler} Befund(e) – siehe oben.`);
zu();
process.exit(fehler === 0 ? 0 : 1);
