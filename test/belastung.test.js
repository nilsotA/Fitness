import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../server/belastung.js';

const BIS = new Date('2026-08-07');

/** Baut n Tage rückwärts ab `bis` je eine Einheit mit fester Last. */
function verlauf(tage, rpe, minuten, bis = BIS) {
  return Array.from({ length: tage }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    return { datum: d.toISOString().slice(0, 10), rpe, minuten };
  });
}

test('Session-RPE ist Anstrengung mal Dauer', () => {
  assert.equal(B.sessionLast(7, 60), 420);
  assert.equal(B.sessionLast(0, 60), 0);
  assert.equal(B.sessionLast(15, 60), 600, 'RPE wird auf 10 gedeckelt');
});

test('Tageslast summiert mehrere Einheiten', () => {
  assert.equal(B.tagesLast([{ rpe: 7, minuten: 60 }, { rpe: 4, minuten: 30 }]), 540);
});

test('ACWR meldet zu wenig Daten offen zurück', () => {
  const kurz = B.acwr(verlauf(5, 7, 60), BIS);
  assert.equal(kurz.belastbar, false);
  assert.match(kurz.hinweis, /vier Wochen/);
});

test('Gleichmäßige Belastung ergibt ein Verhältnis um 1', () => {
  const gleich = B.acwr(verlauf(28, 6, 60), BIS);
  assert.equal(gleich.belastbar, true);
  assert.ok(Math.abs(gleich.wert - 1) < 0.05, `Wert ${gleich.wert}`);
  assert.equal(gleich.stufe, 'unauffällig');
});

test('Belastungssprung wird als solcher erkannt', () => {
  // Drei ruhige Wochen, dann eine sehr harte.
  const ruhig = verlauf(28, 3, 30).slice(7);
  const hart = verlauf(7, 9, 120);
  const sprung = B.acwr([...ruhig, ...hart], BIS);
  assert.equal(sprung.belastbar, true);
  assert.ok(sprung.wert > 1.5, `Wert ${sprung.wert}`);
  assert.equal(sprung.stufe, 'sprung');
});

test('ACWR benennt seine eigene Grenze', () => {
  const a = B.acwr(verlauf(28, 6, 60), BIS);
  assert.match(a.einschraenkung, /keine Verletzungsvorhersage/);
});

test('Monotonie erkennt gleichförmige Wochen', () => {
  const gleichfoermig = B.monotonie(verlauf(7, 6, 60), BIS);
  // Bei identischer Last an allen sieben Tagen ist die Streuung null.
  assert.equal(gleichfoermig.belastbar, false);

  const abwechslung = B.monotonie([
    { datum: '2026-08-07', rpe: 9, minuten: 90 },
    { datum: '2026-08-06', rpe: 3, minuten: 30 },
    { datum: '2026-08-05', rpe: 8, minuten: 75 },
    { datum: '2026-08-03', rpe: 4, minuten: 40 },
  ], BIS);
  assert.equal(abwechslung.belastbar, true);
  assert.equal(abwechslung.hoch, false);
});

test('Bereitschaft aus dem Morgen-Check', () => {
  const gut = B.bereitschaft({ schlaf: 5, muskelkater: 4, stress: 4, stimmung: 5, energie: 5 });
  assert.equal(gut.ampel, 'gruen');
  assert.ok(gut.prozent > 85);

  const schlecht = B.bereitschaft({ schlaf: 1, muskelkater: 1, stress: 2, stimmung: 2, energie: 1 });
  assert.equal(schlecht.ampel, 'rot');
  assert.match(schlecht.empfehlung, /streichen/);
});

test('Schlechter Schlaf drückt die Ampel auch bei sonst guten Werten', () => {
  const b = B.bereitschaft({ schlaf: 2, muskelkater: 5, stress: 5, stimmung: 5, energie: 4 });
  assert.equal(b.ampel, 'gelb');
  assert.match(b.empfehlung, /Schlaf/);
});

test('Unvollständiger Check wird nicht bewertet', () => {
  assert.equal(B.bereitschaft({ schlaf: 4 }).vollstaendig, false);
  assert.equal(B.bereitschaft(null), null);
});

test('Entlastung wird erst bei mehreren Anzeichen empfohlen', () => {
  const ruhig = B.entlastungFaellig(verlauf(28, 5, 50), [], BIS);
  assert.equal(ruhig.faellig, false);

  const schlechteChecks = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - i);
    return {
      datum: d.toISOString().slice(0, 10),
      schlaf: 2, muskelkater: 2, stress: 2, stimmung: 3, energie: 2,
    };
  });
  const belastet = B.entlastungFaellig(
    [...verlauf(28, 3, 30).slice(7), ...verlauf(7, 9, 120)],
    schlechteChecks, BIS);
  assert.equal(belastet.faellig, true);
  assert.ok(belastet.gruende.length >= 2);
});

test('Wochenverlauf liefert eine Reihe fester Länge', () => {
  const reihe = B.wochenverlauf(verlauf(28, 6, 60), 12, BIS);
  assert.equal(reihe.length, 12);
  assert.ok(reihe[reihe.length - 1].last > 0);
  assert.equal(reihe[0].last, 0, 'zwölf Wochen zurück liegen keine Daten');
});

/* ------------------------------------------------------------ Ruhepuls */

/** Checks mit Ruhepuls, `tageVor` Tage vor dem Stichtag. */
const check = (tageVor, ruhepuls) => {
  const d = new Date(BIS);
  d.setDate(d.getDate() - tageVor);
  return { datum: d.toISOString().slice(0, 10), ruhepuls };
};

/** Grundlinie: gleichmäßige Werte ab Tag `von` rückwärts. */
const grundlinie = (puls, von = 4, bis = 20) =>
  Array.from({ length: bis - von + 1 }, (_, i) => check(von + i, puls));

test('Ohne genug Messungen wird der Ruhepuls nicht gedeutet', () => {
  // Genau das Muster, das der Tracker sonst überall einhält: lieber ehrlich
  // „nicht berechenbar" als eine Zahl, die nach Aussage aussieht.
  const wenig = B.ruhepulsTrend([check(0, 62), check(1, 61)], BIS);
  assert.equal(wenig.belastbar, false);
  assert.equal(wenig.letzter, 62, 'der jüngste gemessene Wert wird trotzdem gemeldet');
  assert.match(wenig.hinweis, /Grundlinie/);

  assert.equal(B.ruhepulsTrend([], BIS).belastbar, false);
});

test('Ein stabiler Ruhepuls gilt als unauffällig', () => {
  const t = B.ruhepulsTrend([...grundlinie(55), check(0, 55), check(1, 56)], BIS);
  assert.equal(t.belastbar, true);
  assert.equal(t.stufe, 'unauffällig');
  assert.ok(Math.abs(t.abweichung) < 1, `abweichung ${t.abweichung}`);
});

test('Ein deutlich erhöhter Ruhepuls wird benannt – mit den häufigeren Ursachen zuerst', () => {
  const t = B.ruhepulsTrend([...grundlinie(55), check(0, 65), check(1, 64)], BIS);
  assert.equal(t.stufe, 'deutlich');
  assert.ok(t.abweichung >= 8, `abweichung ${t.abweichung}`);
  // Ein erhöhter Ruhepuls ist unspezifisch. Ihn als Trainingsermüdung zu
  // verkaufen wäre eine Behauptung, die die Datenlage nicht hergibt.
  assert.match(t.text, /Infekt/);
  assert.match(t.einschraenkung, /Alkohol|Infekt/);
});

test('Die Grundlinie enthält die aktuellen Tage nicht', () => {
  // Sonst zieht der aktuelle Wert seine eigene Vergleichsgröße mit hoch und
  // die Abweichung verschwindet zum Teil in sich selbst.
  const t = B.ruhepulsTrend([...grundlinie(50), check(0, 60), check(1, 60)], BIS);
  assert.equal(t.grundlinie, 50);
  assert.equal(t.jetzt, 60);
  assert.equal(t.abweichung, 10);
});

test('Ein gefallener Ruhepuls ist keine Entwarnung', () => {
  // Bei ausgeprägter Ermüdung kann er ebenfalls fallen (Buchheit 2014). Als
  // „alles bestens" zu lesen wäre genau die Fehldeutung.
  const t = B.ruhepulsTrend([...grundlinie(60), check(0, 52), check(1, 53)], BIS);
  assert.equal(t.stufe, 'niedriger');
  assert.match(t.text, /Ermüdung/);
});

test('Der Ruhepuls allein löst keine Entlastung aus', () => {
  // Der Tracker verbietet nichts und schließt nicht aus einem Signal auf eine
  // Maßnahme – ein Infekt erzeugt dasselbe Bild.
  const checks = [...grundlinie(55), check(0, 66), check(1, 65)];
  const nur = B.entlastungFaellig(verlauf(28, 5, 50), checks, BIS);
  assert.equal(nur.faellig, false);
  assert.ok(nur.gruende.some((g) => /Ruhepuls/.test(g)), 'genannt wird er trotzdem');
});

test('Nur Checks mit Ruhepuls landen im Verlauf', () => {
  const gemischt = [
    check(1, 58),
    { datum: '2026-08-05', schlaf: 3 },
    { datum: '2026-08-04', ruhepuls: 0 },
    check(3, 60),
  ];
  const v = B.ruhepulsVerlauf(gemischt, BIS);
  assert.equal(v.length, 2);
  assert.deepEqual(v.map((p) => p.ruhepuls), [60, 58], 'aufsteigend nach Datum');
});
