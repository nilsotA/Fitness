// Was passiert, wenn sich der Bestand nicht lesen lässt und danach jemand
// etwas einträgt?
//
// Der gefährlichste Weg durch `app/speicher.js`: `laden()` scheitert, setzt den
// Zwischenspeicher auf ein leeres Tagebuch – und der nächste Eintrag schreibt
// genau das über den vorhandenen Bestand. Ein Datensatz, der sich nicht lesen
// lässt, lässt sich sehr wohl überschreiben. Gegen die alte Fassung gemessen:
// 72 Einheiten und 48 Morgen-Checks wurden zu null, mit der Meldung
// „Gewicht gespeichert." darüber.
//
//   node werkzeug/lesefehler.mjs
//
// Gibt einen Exitcode zurück. Verändert den Datenbestand nicht – sofern die
// Prüfung besteht. Vorher `saeen.mjs` laufen lassen, sonst ist nichts da,
// was verloren gehen könnte.
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte } from './cdp.mjs';

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf);
await vorratLeeren(ruf);

const zaehlen = () => js(ruf, `
  const db = await new Promise((f,r)=>{const a=indexedDB.open('trainingstracker',1);a.onsuccess=()=>f(a.result);a.onerror=()=>r(a.error);});
  const d = await new Promise((f,r)=>{const t=db.transaction('tagebuch','readonly').objectStore('tagebuch').get('aktuell');t.onsuccess=()=>f(t.result);t.onerror=()=>r(t.error);});
  return { sessions: d?.sessions?.length ?? -1, essen: d?.essen?.length ?? -1, checks: d?.checks?.length ?? -1 };
`);

const vorher = await zaehlen();
console.log('Bestand vorher :', JSON.stringify(vorher));

// Jedes `get` auf den Tagebuch-Datensatz scheitern lassen – aber nur das
// Lesen. Schreiben bleibt möglich, und genau das ist der gefährliche Fall.
const eingeschleust = await ruf('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    const echt = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.__echtGet = echt;
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
  `,
});

await zurAnsicht(ruf, 'fortschritt', { neuLaden: true });
await warte(900);

// Etwas eintragen – über denselben Weg, den `dialoge.mjs` benutzt.
const meldung = await js(ruf, `
  const knopf = [...document.querySelectorAll('button')].find((b) => /Wiegen/.test(b.textContent));
  if (!knopf) return 'kein Wiegen-Knopf – Ansicht kam nicht hoch';
  knopf.click();
  await new Promise((f) => setTimeout(f, 300));
  const feld = document.querySelector('.dialog input, dialog input');
  if (!feld) return 'kein Eingabefeld';
  feld.value = '99,9';
  feld.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('button')].find((b) => /Speichern/.test(b.textContent)).click();
  await new Promise((f) => setTimeout(f, 600));
  const t = document.querySelector('.toast, .meldung');
  return t ? t.textContent.slice(0, 160) : 'keine Meldung';
`);
console.log('Meldung        :', meldung);

await warte(500);
// Die Störung zurücknehmen, sonst scheitert auch das Nachzählen – und ein
// eingeschleustes Skript überlebt sonst den Lauf und legt `saeen.mjs` lahm.
await ruf('Page.removeScriptToEvaluateOnNewDocument', { identifier: eingeschleust.identifier });
await js(ruf, `
  if (IDBObjectStore.prototype.__echtGet) IDBObjectStore.prototype.get = IDBObjectStore.prototype.__echtGet;
  return 1;
`);
const nachher = await zaehlen();
console.log('Bestand nachher:', JSON.stringify(nachher));

const heil = nachher.sessions === vorher.sessions
  && nachher.essen === vorher.essen && nachher.checks === vorher.checks;
console.log(heil
  ? '\nok  Der Bestand ist unangetastet.'
  : '\n>>  Der Bestand wurde überschrieben.');
zu();
process.exit(heil ? 0 : 1);
