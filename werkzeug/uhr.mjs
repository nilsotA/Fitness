// Stellt „jetzt" fest – für Prüfungen, die an der Uhrzeit hängen.
//
//   UHR=2026-10-24T22:30:00Z TZ=Europe/Berlin \
//     node --import ./werkzeug/uhr.mjs --test test/*.test.js
//
// Das ist in Berlin halb eins in der Nacht zum 25. Oktober, dem Tag der
// Umstellung auf Winterzeit – UTC zeigt da noch den Vortag. Wer „heute" über
// `toISOString()` bestimmt statt über `heute()` aus `kern/regeln.js`, liegt
// genau jetzt daneben (Falle 100). `--import` gilt auch für die Prozesse, die
// `node --test` je Testdatei startet.
//
// Nur `new Date()` ohne Argument und `Date.now()` werden festgestellt; ein
// Datum aus einer Zeichenkette bleibt, was es ist.

const fest = Date.parse(process.env.UHR ?? '');
if (Number.isNaN(fest)) {
  throw new Error('UHR fehlt oder ist unlesbar, etwa UHR=2026-10-24T22:30:00Z');
}

const Echt = Date;
class FesteUhr extends Echt {
  constructor(...argumente) {
    if (argumente.length === 0) super(fest);
    else super(...argumente);
  }

  static now() {
    return fest;
  }
}
globalThis.Date = FesteUhr;
