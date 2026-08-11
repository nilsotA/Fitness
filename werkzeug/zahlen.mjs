// Fachliche Zahlen, die als Text in der Oberfläche stehen.
//
//   node werkzeug/zahlen.mjs
//
// Die wiederkehrende Aufräumaufgabe aus CLAUDE.md, eine Stufe schärfer. Dort
// steht
//
//     grep -n "[<>]=\? *[0-9]" app/*.js
//
// und das findet nur Zahlen mit einem Vergleichsoperator davor. „mindestens
// 48 h Abstand" mitten in einem Satz fällt durch – und genau dort altert eine
// Zahl unbemerkt, weil kein Test sie liest und kein Blick sie mit `wissen.js`
// vergleicht.
//
// Gefunden hat dieser Durchlauf beim ersten Mal 14 Stellen, darunter sieben in
// der **Wissensansicht** – ausgerechnet der Ansicht, deren einziger Zweck die
// Nachprüfbarkeit ist. Eine Zahl, die dort anders steht als im Plan, widerlegt
// genau das, wofür es die Ansicht gibt. Außerdem zwei Zahlengruppen, die gar
// nicht erst in `wissen.js` standen: die Prozentsätze für Auf- und Abbau
// (`ZIELANPASSUNG` in `ernaehrung.js`) und die Wiedereinstiegsfaktoren
// (`0.6 : 0.8` in `plan.js`).
//
// Was das Werkzeug **nicht** kann: entscheiden, ob eine Zahl fachlich ist. Das
// bleibt Lesearbeit. Es zeigt die Kandidaten und hält die Zahl klein genug,
// dass man sie durchgeht.
import { readFileSync, readdirSync } from 'node:fs';

/*
 * Angenommene Fundstellen, jeweils mit Grund – wie die als gleichwertig
 * geführten Verfälschungen in `mutieren.mjs`. Eine Liste ohne Begründung wäre
 * nur eine Art, den Melder abzuschalten.
 */
const ANGENOMMEN = [
  {
    muster: /\/ 100 g|je 100 g/,
    grund: 'Nährwerte stehen auf jeder Packung je 100 g. Das ist die Konvention '
      + 'der Angabe selbst und keine Vorgabe des Trackers.',
  },
];

const dateien = readdirSync('app').filter((f) => f.endsWith('.js'));
const treffer = [];
const angenommen = [];

for (const f of dateien) {
  const zeilen = readFileSync(`app/${f}`, 'utf8').split('\n');
  zeilen.forEach((z, i) => {
    // Kommentare erklären oft, warum eine Zahl irgendwo steht – sie sind
    // nicht das, was am Gerät ankommt.
    if (/^\s*(\/\/|\*|\/\*)/.test(z)) return;
    for (const m of z.matchAll(/'([^']{12,})'|"([^"]{12,})"/g)) {
      const text = m[1] || m[2];
      // Ohne ein Wort darin ist es ein Klassenname, ein Pfad oder ein Format.
      if (!/[a-zäöüß]{4}/i.test(text)) continue;
      for (const zahl of text.matchAll(
        /(?<![\w.])(\d{1,4}(?:[.,]\d+)?)\s*(%|kg|kcal|min|g\b|h\b|m\b|Sätze|Wdh)/g)) {
        const fund = { datei: f, zeile: i + 1, wert: zahl[1], einheit: zahl[2], text };
        const aus = ANGENOMMEN.find((a) => a.muster.test(text));
        (aus ? angenommen : treffer).push(fund);
      }
    }
  });
}

for (const t of treffer) {
  console.log(`app/${t.datei}:${t.zeile}  ${t.wert} ${t.einheit}\n    „${t.text.slice(0, 100)}"`);
}

console.log(`\n${treffer.length} zu klären, ${angenommen.length} angenommen.`);
for (const a of ANGENOMMEN) console.log(`  angenommen: ${a.grund}`);

if (treffer.length) {
  console.log('\nJede dieser Zahlen gehört entweder nach `wissen.js` und wird von dort '
    + 'gelesen –\noder sie ist keine fachliche Zahl, dann gehört sie oben in ANGENOMMEN, '
    + 'mit Grund.');
}
process.exit(treffer.length ? 1 : 0);
