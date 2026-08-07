import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../server/ausdauer.js';

const BIS = new Date('2026-08-07');

/** Baut eine Ausdauereinheit n Tage vor dem Stichtag. */
const einheit = (tageVor, rpe, minuten, meter, geraet = 'laufen') => {
  const d = new Date(BIS);
  d.setDate(d.getDate() - tageVor);
  return {
    datum: d.toISOString().slice(0, 10),
    typ: rpe >= 7 ? 'ausdauerIntervalle' : 'ausdauerLocker',
    rpe,
    minuten,
    strecke: meter ? { meter, geraet } : null,
  };
};

/* ------------------------------------------------------------- Tempo */

test('Laufen wird als Pace angezeigt, Rad als Geschwindigkeit', () => {
  // 10 km in 50 min = 5:00 min/km
  const laufen = A.tempo(10000, 50, 'laufen');
  assert.equal(laufen.text, '5:00 /km');
  assert.equal(laufen.kmh, 12);

  // 30 km in 60 min = 30 km/h
  const rad = A.tempo(30000, 60, 'rad');
  assert.equal(rad.text, '30 km/h');
});

test('Rudern und Schwimmen bekommen ihre eigenen Bezugsgrößen', () => {
  // 5000 m in 20 min = 2:00 /500 m
  assert.equal(A.tempo(5000, 20, 'rudern').text, '2:00 /500 m');
  // 1000 m in 20 min = 2:00 /100 m
  assert.equal(A.tempo(1000, 20, 'schwimmen').text, '2:00 /100 m');
});

test('Sekunden runden nie auf :60', () => {
  // Ein Tempo knapp unter der vollen Minute darf nicht als „4:60" erscheinen.
  for (let meter = 9800; meter <= 10200; meter += 7) {
    const t = A.tempo(meter, 50, 'laufen');
    assert.ok(!/:60/.test(t.text), `${meter} m ergab ${t.text}`);
  }
});

test('Ohne Strecke oder Dauer kein Tempo', () => {
  assert.equal(A.tempo(0, 50), null);
  assert.equal(A.tempo(10000, 0), null);
});

/* ----------------------------------------------------------- Strecke */

test('Unplausible Strecken fliegen raus', () => {
  assert.equal(A.pruefeStrecke({ meter: 0 }), null);
  assert.equal(A.pruefeStrecke({ meter: -5 }), null);
  assert.equal(A.pruefeStrecke({ meter: 500000 }), null);
  assert.equal(A.pruefeStrecke(null), null);
});

test('Unbekanntes Gerät fällt auf Laufen zurück', () => {
  assert.equal(A.pruefeStrecke({ meter: 5000, geraet: 'einhorn' }).geraet, 'laufen');
});

/* -------------------------------------------------------------- Zonen */

test('Zonen folgen der gefühlten Anstrengung', () => {
  assert.equal(A.zoneAusRpe(3), 'locker');
  assert.equal(A.zoneAusRpe(4), 'locker');
  assert.equal(A.zoneAusRpe(5), 'grauzone');
  assert.equal(A.zoneAusRpe(6), 'grauzone');
  assert.equal(A.zoneAusRpe(7), 'hart');
  assert.equal(A.zoneAusRpe(0), null);
});

/* -------------------------------------------------------- Verteilung */

test('Polarisierte Verteilung wird als gut erkannt', () => {
  const sessions = [
    einheit(1, 3, 60), einheit(3, 3, 70), einheit(5, 4, 60),
    einheit(8, 3, 80), einheit(10, 3, 60),
    einheit(6, 8, 40), einheit(13, 8, 35),
  ];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.bewertbar, true);
  assert.equal(v.stufe, 'gut');
  assert.ok(v.anteil.locker > 0.75, `locker ${v.anteil.locker}`);
});

test('Zu viel Grauzone wird deutlich benannt', () => {
  // Der häufigste Fehler im Ausdauertraining: alles im Mitteltempo.
  const sessions = [
    einheit(1, 5, 60), einheit(3, 6, 60), einheit(5, 5, 60), einheit(8, 6, 60),
    einheit(10, 3, 40),
  ];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.stufe, 'kritisch');
  assert.ok(v.anteil.grauzone >= 0.35);
  assert.match(v.text, /Grauzone/);
});

test('Minuten zählen, nicht Einheiten', () => {
  // Eine 90-min-Runde locker gegen ein 20-min-Intervall: nach Einheiten
  // gezählt wäre das 50/50, nach Minuten 82/18. Nur Letzteres stimmt.
  const sessions = [einheit(1, 3, 90), einheit(3, 8, 20)];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.gesamt, 110);
  assert.ok(Math.abs(v.anteil.locker - 0.818) < 0.01, `locker ${v.anteil.locker}`);
});

test('Zu wenig Umfang wird nicht bewertet', () => {
  const v = A.verteilung([einheit(1, 3, 40)], BIS);
  assert.equal(v.bewertbar, false);
  assert.match(v.hinweis, /aussagekräftig/);
});

test('Nur Ausdauereinheiten zählen in die Verteilung', () => {
  const sessions = [
    einheit(1, 3, 60), einheit(3, 3, 60),
    { datum: '2026-08-05', typ: 'kraft', rpe: 9, minuten: 200 },
    { datum: '2026-08-04', typ: 'sprint', rpe: 9, minuten: 120 },
  ];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.gesamt, 120, 'Kraft und Sprint dürfen nicht mitzählen');
  assert.equal(v.anteil.hart, 0);
});

test('Fast nur locker erzeugt ebenfalls einen Hinweis', () => {
  const sessions = [einheit(1, 3, 90), einheit(3, 3, 90), einheit(5, 3, 60)];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.stufe, 'warnung');
  assert.match(v.text, /wehtun/);
});

/* ----------------------------------------------------------- Verlauf */

test('Tempoverlauf trennt Geräte und Zonen', () => {
  const sessions = [
    einheit(1, 3, 50, 9000, 'laufen'),
    einheit(3, 8, 30, 7000, 'laufen'),
    einheit(5, 3, 60, 25000, 'rad'),
  ];
  const v = A.tempoVerlauf(sessions);
  assert.deepEqual(Object.keys(v).sort(), ['laufen-hart', 'laufen-locker', 'rad-locker']);
  assert.equal(v['laufen-locker'][0].tempo, '5:33 /km');
});

test('Einheiten ohne Strecke tauchen im Verlauf nicht auf', () => {
  const v = A.tempoVerlauf([einheit(1, 3, 50, 0)]);
  assert.deepEqual(v, {});
});

test('Wochenstrecke summiert je Gerät', () => {
  const sessions = [
    einheit(1, 3, 50, 9000, 'laufen'),
    einheit(3, 3, 40, 7000, 'laufen'),
    einheit(5, 3, 60, 25000, 'rad'),
    einheit(20, 3, 60, 30000, 'rad'), // außerhalb der Woche
  ];
  const w = A.wochenstrecke(sessions, BIS);
  assert.equal(w.laufen, 16);
  assert.equal(w.rad, 25);
});

test('Verlaufsname ist lesbar', () => {
  assert.equal(A.verlaufName('laufen-locker'), 'Laufen · Locker');
  assert.equal(A.verlaufName('rad-hart'), 'Rad · Hart');
});
