// Englische Dezimalzahlen im ausgelieferten Text – über alle Ansichten.
//
//   node werkzeug/dezimal.mjs
//
// In einer deutschen App gehört ein Komma in die Zahl. Der Kern hat dafür
// `zahlText()`, die Oberfläche `zahl()` – nur greift keines von beidem, wenn
// jemand einen Wert roh in eine Zeichenkette interpoliert
// (`${h.makro.khProKg} g/kg`). Genau so stand „Kohlenhydrate liegen bei
// 6.9 g/kg" neben „im Fett, heute 1,2 g/kg" in einem Satz.
//
// Warum ein eigenes Werkzeug: `werkzeug/zahlen.mjs` sucht Zahlen **im
// Quelltext** und ist an dieser Stelle blind, weil dort gar keine Zahl steht.
// Sichtbar wird der Fehler erst im gerenderten Text.
//
// Gibt einen Exitcode zurück.
import { verbinde, js, zurAnsicht, ANSICHTEN, geraet, warte } from './cdp.mjs';

// Was ein Punkt zwischen Ziffern legitim bedeuten darf. Bewusst kurz:
// Jeder Eintrag hier ist eine Ausnahme von der Regel und braucht einen Grund.
const ANGENOMMEN = [
  // Versionsnummern und Studienangaben („Bd. 12.3") gibt es in der App nicht;
  // steht hier je etwas, gehört der Grund daneben.
];

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf, 390, 1600);

const funde = [];
let geprueft = 0;

for (const ansicht of ANSICHTEN) {
  await zurAnsicht(ruf, ansicht, { neuLaden: true });
  await warte(500);
  // `textContent` statt `innerText`: Zugeklappte <details> zählen mit, und
  // genau dort steckt seit Falle 40 der halbe Wochenplan.
  /*
   * Textknoten einzeln einsammeln statt `textContent` auf dem Container.
   * Sonst klebt der Text benachbarter Elemente aneinander („übrig" +
   * „2.299" = „übrig2.299", „2.722" + „36" = „2.72236") und die
   * Wortgrenzen der Muster unten greifen nicht mehr.
   *
   * Bewusst nicht `innerText`: Das überspringt zugeklappte <details>, und
   * dort steckt seit Falle 40 der halbe Wochenplan.
   */
  const roh = await js(ruf, `
    const wurzel = document.querySelector('#inhalt');
    if (!wurzel) return '';
    const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    const teile = [];
    while (lauf.nextNode()) teile.push(lauf.currentNode.nodeValue);
    return teile.join('\\n');`);
  geprueft += roh.length;

  /*
   * Erst die legitimen Punkte entfernen, dann suchen. Zwei Sorten:
   *
   * - **Tausenderpunkt.** „2.299 kcal" ist deutsch und richtig. Erkennbar an
   *   der Gruppierung: ein bis drei Ziffern, dann Punkt und genau drei, das
   *   beliebig oft. Ein Punkt vor einer, zwei oder mehr als drei Ziffern ist
   *   dagegen ein Dezimalpunkt („6.9", „1.05").
   * - **Deutsches Datum.** „5.9.2026" trägt zwei Punkte und keine Dezimale.
   *
   * Ohne diesen Schritt meldet das Werkzeug dreizehn Tausenderpunkte als
   * Fehler – ein Melder, der Richtiges anzeigt, wird genauso schnell
   * ignoriert wie einer, der nie meldet.
   */
  const text = roh
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ');

  for (const m of text.match(/[^\s]*\d+\.\d+[^\s]*/g) || []) {
    if (ANGENOMMEN.some((a) => m.includes(a))) continue;
    funde.push(`${ansicht}: ${m}`);
  }
}

console.log(`${geprueft} Zeichen Text über ${ANSICHTEN.length} Ansichten geprüft.`);
if (!funde.length) {
  console.log('Keine englischen Dezimalzahlen im Text.');
} else {
  console.log(`\n${funde.length} Fundstelle(n):`);
  for (const f of [...new Set(funde)]) console.log(`  ${f}`);
}
zu();
process.exit(funde.length ? 1 : 0);
