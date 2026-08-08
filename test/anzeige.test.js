// Anzeigelogik, die schon zweimal etwas anderes behauptet hat als die Kurve.
//
// `app/common.js` baut sonst nur DOM-Knoten. Die Regel für die
// Nachkommastellen ist aber reine Rechnung – und genau die Sorte Detail, die
// in Tests grün aussieht und im Screenshot falsch. Deshalb steht sie als
// eigene Funktion da und wird hier geprüft.

import test from 'node:test';
import assert from 'node:assert/strict';
import { beschriftungsStellen, balkenBreiten, TAGESTYP_NAMEN, TAGESTYP_GEBEUGT } from '../app/common.js';
import { tagestyp } from '../kern/ernaehrung.js';

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

/* ---------------------------------------------------------- Balkenbreiten */

test('Unter dem Ziel bleibt der Balken der alte', () => {
  // Der häufige Fall darf sich nicht verändern: Maßstab 100, kein Überschuss.
  for (const p of [0, 12, 55, 99.4, 100]) {
    const { bis, drueber } = balkenBreiten(p);
    assert.equal(bis, p, `${p} %`);
    assert.equal(drueber, 0, `${p} %`);
  }
});

test('Über dem Ziel füllt der Balken immer ganz aus', () => {
  for (const p of [101, 138, 197, 400]) {
    const { bis, drueber } = balkenBreiten(p);
    assert.ok(Math.abs(bis + drueber - 100) < 1e-9, `${p} %: ${bis} + ${drueber}`);
  }
});

test('Verschieden große Überschreitungen sehen verschieden aus', () => {
  // Der Fehler aus dem Screenshot: 108 % Fett und 197 % Protein standen als
  // zwei identisch randvolle Balken untereinander. Ein Balken, der ab dem Ziel
  // sättigt, kann „knapp drüber" nicht von „doppelt so viel" unterscheiden.
  const knapp = balkenBreiten(108).drueber;
  const doppelt = balkenBreiten(197).drueber;

  assert.ok(knapp > 1, `108 % ergibt nur ${knapp} % Überschuss – unsichtbar`);
  assert.ok(doppelt > knapp * 3,
    `108 % → ${knapp} %, 197 % → ${doppelt} %: zu ähnlich`);

  // Und der Überschuss wächst monoton mit der Überschreitung.
  let vorher = -1;
  for (let p = 100; p <= 300; p += 5) {
    const jetzt = balkenBreiten(p).drueber;
    assert.ok(jetzt > vorher, `bei ${p} % nicht gewachsen`);
    vorher = jetzt;
  }
});

test('Unsinnige Eingaben kippen den Balken nicht', () => {
  // `prozent` kommt aus einer Division – ohne Sollwert steht da NaN.
  for (const p of [null, undefined, NaN, -20, 'abc']) {
    const { bis, drueber } = balkenBreiten(p);
    assert.equal(bis, 0, String(p));
    assert.equal(drueber, 0, String(p));
  }
});

/* ------------------------------------------------------------- Tagestypen */

test('Jeder Tagestyp hat beide Sprachformen', () => {
  // Ein neuer Tagestyp ohne Eintrag fiele sonst nur dadurch auf, dass im Satz
  // plötzlich „langeAusdauer" steht. Geprüft wird gegen das, was der Kern
  // tatsächlich liefert – nicht gegen eine abgeschriebene Liste.
  const faelle = [
    [],
    [{ typ: 'mobilitaet', minuten: 20 }],
    [{ typ: 'technik', minuten: 40 }],
    [{ typ: 'kraft', minuten: 60 }],
    [{ typ: 'sprint', minuten: 50 }, { typ: 'kraft', minuten: 60 }],
    [{ typ: 'ausdauerIntervalle', minuten: 45 }],
    [{ typ: 'ausdauerLang', minuten: 120 }],
  ];

  const gesehen = new Set(faelle.map((e) => tagestyp(e)));
  assert.ok(gesehen.size >= 5, `nur ${gesehen.size} Typen abgedeckt`);

  for (const typ of gesehen) {
    assert.ok(TAGESTYP_NAMEN[typ], `${typ} fehlt in TAGESTYP_NAMEN`);
    assert.ok(TAGESTYP_GEBEUGT[typ], `${typ} fehlt in TAGESTYP_GEBEUGT`);
  }
  assert.deepEqual(Object.keys(TAGESTYP_NAMEN), Object.keys(TAGESTYP_GEBEUGT));
});

test('Die gebeugte Form passt in den Satz', () => {
  // Der Fehler im Screenshot: „Korridor für einen leichter tag ist 4–5 g/kg".
  // Falscher Fall und kleingeschriebenes Substantiv in einem.
  for (const [typ, form] of Object.entries(TAGESTYP_GEBEUGT)) {
    const satz = `Korridor für einen ${form} ist 4–5 g/kg`;
    assert.ok(/ (Tag|Ausdauertag|Ruhetag) ist /.test(satz),
      `„${satz}" – Substantiv fehlt oder ist kleingeschrieben (${typ})`);
    assert.ok(!/^[A-ZÄÖÜ]/.test(form) || typ === 'ruhetag',
      `„${form}" beginnt groß, steht aber im Satzinneren (${typ})`);
  }
});
