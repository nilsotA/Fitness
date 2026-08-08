// Anzeigelogik, die schon zweimal etwas anderes behauptet hat als die Kurve.
//
// `public/common.js` baut sonst nur DOM-Knoten. Die Regel für die
// Nachkommastellen ist aber reine Rechnung – und genau die Sorte Detail, die
// in Tests grün aussieht und im Screenshot falsch. Deshalb steht sie als
// eigene Funktion da und wird hier geprüft.

import test from 'node:test';
import assert from 'node:assert/strict';
import { beschriftungsStellen } from '../app/common.js';

test('Gleiche Werte brauchen keine Nachkommastellen', () => {
  assert.equal(beschriftungsStellen(12, 12), 0);
});

test('Ganze Schritte bleiben ohne Nachkommastellen', () => {
  // 10 → 11 ist als „10" und „11" vollständig beschrieben.
  assert.equal(beschriftungsStellen(10, 11), 0);
  assert.equal(beschriftungsStellen(120, 135), 0);
});

test('Eine kleine Veränderung darf nicht groß aussehen', () => {
  // Der Fall aus dem Tempoverlauf: 9,75 → 9,43 km/h. Gerundet stünde da
  // „10" → „9" – aus gut 3 % würden optisch 10 %. Beide Zahlen sind
  // verschieden, die alte Regel sah deshalb keinen Handlungsbedarf.
  const stellen = beschriftungsStellen(9.75, 9.43);
  assert.ok(stellen >= 1, `stellen = ${stellen}`);

  const gezeigt = Math.abs(
    Number(9.43.toFixed(stellen)) - Number(9.75.toFixed(stellen)));
  assert.ok(Math.abs(gezeigt - 0.32) <= 0.32 / 3,
    `gezeigte Veränderung ${gezeigt} statt 0,32`);
});

test('Eine Veränderung darf nicht verschwinden', () => {
  // 11,7 → 12,0 stand zweimal als „12" da, daneben „besser geworden".
  const stellen = beschriftungsStellen(11.7, 12.0);
  assert.ok(stellen >= 1);
  assert.notEqual((11.7).toFixed(stellen), (12.0).toFixed(stellen));
});

test('Sprintzeiten behalten ihre Hundertstel, wo sie zählen', () => {
  // 4,42 → 4,31 s: Zehntel geben die Veränderung schon gut wieder.
  assert.ok(beschriftungsStellen(4.42, 4.31) >= 1);
  // 4,42 → 4,40 s dagegen ist ohne Hundertstel nicht darstellbar.
  assert.equal(beschriftungsStellen(4.42, 4.40), 2);
});

test('Die Beschriftung gibt die Veränderung nie grob verzerrt wieder', () => {
  // Systematisch über plausible Wertepaare: Die angezeigte Differenz darf
  // höchstens um ein Drittel danebenliegen – oder gar nicht darstellbar sein,
  // dann steht daneben auch keine Richtung.
  for (let a = 3; a < 30; a += 0.37) {
    for (const delta of [0.01, 0.05, 0.11, 0.32, 0.8, 1.5, 4]) {
      const b = a + delta;
      const stellen = beschriftungsStellen(a, b);
      const f = 10 ** stellen;
      const gezeigt = Math.abs(Math.round(b * f) - Math.round(a * f)) / f;
      if (gezeigt === 0) {
        // Nicht darstellbar ist erlaubt – aber nur am Ende der Skala.
        assert.equal(stellen, 2, `${a} → ${b} unsichtbar bei ${stellen} Stellen`);
        continue;
      }
      assert.ok(Math.abs(gezeigt - delta) <= delta / 3 + 1e-9,
        `${a.toFixed(3)} → ${b.toFixed(3)}: gezeigt ${gezeigt}, echt ${delta}`);
    }
  }
});

test('Auch fallende Werte werden richtig aufgelöst', () => {
  // Die Regel darf nicht von der Richtung abhängen.
  assert.equal(beschriftungsStellen(9.75, 9.43), beschriftungsStellen(9.43, 9.75));
  assert.equal(beschriftungsStellen(4.42, 4.31), beschriftungsStellen(4.31, 4.42));
});
