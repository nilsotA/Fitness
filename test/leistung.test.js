import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../server/leistung.js';

const satz = (gewicht, wiederholungen) => ({ gewicht, wiederholungen });

test('Einer-Maximum aus Krafttests', () => {
  const stand = L.einerMaxima({
    tests: [{ art: 'kniebeuge', wert: 100, wiederholungen: 5, datum: '2026-08-01' }],
  });
  assert.equal(stand.kniebeuge.e1rm, 116.7);
  assert.equal(stand.kniebeuge.quelle, 'Test');
});

test('Einer-Maximum aus protokollierten Sätzen', () => {
  const stand = L.einerMaxima({
    sessions: [{
      datum: '2026-08-05',
      uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 3), satz(105, 3)] }],
    }],
  });
  // 105 × (1 + 3/30) = 115,5
  assert.equal(stand.kniebeuge.e1rm, 115.5);
  assert.equal(stand.kniebeuge.quelle, 'Training');
});

test('Hohe Wiederholungszahlen fließen nicht ein', () => {
  // Ein Satz mit 20 lockeren Wiederholungen ergäbe nach Epley ein absurd hohes
  // 1RM und würde die Gewichtsempfehlung nach oben verzerren.
  const stand = L.einerMaxima({
    sessions: [{
      datum: '2026-08-05',
      uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(60, 20), satz(100, 5)] }],
    }],
  });
  assert.equal(stand.kniebeuge.e1rm, 116.7); // nur der 5er zählt
});

test('Bester Wert gewinnt über alle Quellen', () => {
  const stand = L.einerMaxima({
    tests: [{ art: 'kniebeuge', wert: 90, wiederholungen: 5, datum: '2026-07-01' }],
    sessions: [{
      datum: '2026-08-05',
      uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(110, 3)] }],
    }],
  });
  assert.equal(stand.kniebeuge.quelle, 'Training');
  assert.equal(stand.kniebeuge.e1rm, 121);
});

test('Rumänisches Kreuzheben wird aus dem Kreuzheben abgeleitet', () => {
  const stand = L.einerMaxima({
    tests: [{ art: 'kreuzheben', wert: 140, wiederholungen: 1, datum: '2026-08-01' }],
  });
  assert.equal(stand.rumaenischesKreuzheben.e1rm, 105); // 140 × 0,75
  assert.equal(stand.rumaenischesKreuzheben.geschaetzt, true);
  assert.match(stand.rumaenischesKreuzheben.quelle, /abgeleitet/);
});

test('Eigene Daten schlagen die Ableitung', () => {
  const stand = L.einerMaxima({
    tests: [{ art: 'kreuzheben', wert: 140, wiederholungen: 1, datum: '2026-08-01' }],
    sessions: [{
      datum: '2026-08-05',
      uebungen: [{ schluessel: 'rumaenischesKreuzheben', saetze: [satz(120, 5)] }],
    }],
  });
  assert.equal(stand.rumaenischesKreuzheben.geschaetzt, undefined);
  assert.equal(stand.rumaenischesKreuzheben.e1rm, 140); // 120 × (1+5/30)
});

test('Wiederholungstest wird nicht als Kilogramm gelesen', () => {
  // Regression: „Klimmzüge max. = 9" bedeutet neun Wiederholungen. Früher wurde
  // daraus ein Einer-Maximum von 9 kg – und der Plan schlug daraufhin
  // Zusatzlasten im einstelligen Bereich vor.
  const stand = L.einerMaxima({
    tests: [{ art: 'klimmzuege', wert: 9, datum: '2026-08-01' }],
  }, 78);
  // 78 kg Körpergewicht × (1 + 9/30) = 101,4 kg Gesamtlast
  assert.equal(stand.klimmzuege.e1rm, 101.4);
});

test('Zusatzlast am Klimmzug zählt zur Gesamtlast', () => {
  const stand = L.einerMaxima({
    tests: [{ art: 'klimmzugZusatzlast', wert: 20, wiederholungen: 1, datum: '2026-08-01' }],
  }, 78);
  assert.equal(stand.klimmzuege.e1rm, 98); // 78 + 20
});

test('Arbeitsgewicht am Klimmzug rechnet das Körpergewicht heraus', () => {
  // Gesamtlast-1RM 98 kg, Ziel 85–92 % → 83,3 bis 90,2 kg Gesamtlast.
  // Aufzulegen sind davon 5,3 bzw. 12,2 kg über dem Körpergewicht von 78 kg.
  const maxima = { klimmzuege: { e1rm: 98, quelle: 'Test' } };
  const g = L.arbeitsgewicht('klimmzuege', [85, 92], maxima, 78);
  assert.equal(g.von, 5);
  assert.equal(g.bis, 12.5);
  assert.equal(g.gesamtlast, true);
});

test('Liegt die Zielintensität unter dem Körpergewicht, gibt es keine Zusatzlast', () => {
  const maxima = { klimmzuege: { e1rm: 98, quelle: 'Test' } };
  const g = L.arbeitsgewicht('klimmzuege', [60, 70], maxima, 78);
  assert.equal(g.von, 0, 'keine negative Zusatzlast');
  assert.equal(g.bis, 0);
});

test('Körpergewichtssätze ohne Zusatzlast liefern trotzdem ein Maximum', () => {
  const stand = L.einerMaxima({
    sessions: [{
      datum: '2026-08-05',
      uebungen: [{ schluessel: 'klimmzuege', saetze: [satz(0, 8)] }],
    }],
  }, 78);
  assert.equal(stand.klimmzuege.e1rm, 98.8); // 78 × (1 + 8/30)
});

test('Hantelübungen ohne Gewicht zählen nicht', () => {
  const stand = L.einerMaxima({
    sessions: [{
      datum: '2026-08-05',
      uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(0, 8)] }],
    }],
  }, 78);
  assert.equal(stand.kniebeuge, undefined);
});

test('Unbekannte Übungsschlüssel werden ignoriert', () => {
  const stand = L.einerMaxima({
    sessions: [{ datum: '2026-08-05', uebungen: [{ schluessel: 'quatsch', saetze: [satz(100, 5)] }] }],
  });
  assert.equal(Object.keys(stand).length, 0);
});

test('Rundung auf auflegbare Scheiben', () => {
  assert.equal(L.aufScheibe(103.7, 5), 105);
  assert.equal(L.aufScheibe(101.2, 5), 100);
  assert.equal(L.aufScheibe(63.8, 2.5), 65);
  assert.equal(L.aufScheibe(null, 5), null);
});

test('Arbeitsgewicht aus Prozentbereich und Einer-Maximum', () => {
  const maxima = { kniebeuge: { e1rm: 120, quelle: 'Test' } };
  const g = L.arbeitsgewicht('kniebeuge', [85, 92], maxima);
  assert.equal(g.von, 100); // 102 → auf 5 kg gerundet
  assert.equal(g.bis, 110); // 110,4 → 110
  assert.equal(g.e1rm, 120);
});

test('Ohne Datenlage kein Arbeitsgewicht', () => {
  assert.equal(L.arbeitsgewicht('kniebeuge', [85, 92], {}), null);
});

test('Übungen ohne Last bekommen kein Gewicht', () => {
  const maxima = { nordic: { e1rm: 100 } };
  assert.equal(L.arbeitsgewicht('nordic', [80, 90], maxima), null);
});

test('Progression steigert, wenn alle Sätze oben ankamen', () => {
  const letzte = { topGewicht: 100, gleicheLast: 1, saetze: [satz(100, 5), satz(100, 5), satz(100, 5)] };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5]);
  assert.equal(v.richtung, 'hoch');
  assert.equal(v.empfehlung, 105);
});

test('Progression hält, solange der Bereich nicht voll ist', () => {
  const letzte = { topGewicht: 100, gleicheLast: 1, saetze: [satz(100, 5), satz(100, 4), satz(100, 3)] };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5]);
  assert.equal(v.richtung, 'halten');
  assert.equal(v.empfehlung, 100);
});

test('Nach drei Einheiten ohne Fortschritt geht die Last zurück', () => {
  const letzte = { topGewicht: 100, gleicheLast: 3, saetze: [satz(100, 3), satz(100, 3)] };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5]);
  assert.equal(v.richtung, 'runter');
  assert.equal(v.empfehlung, 90);
  assert.match(v.text, /ohne Fortschritt/);
});

test('Ohne Protokoll gibt es keine Empfehlung, aber einen Hinweis', () => {
  const v = L.naechsteLast('kniebeuge', null, [3, 5]);
  assert.equal(v.empfehlung, null);
  assert.match(v.text, /Standortbestimmung/);
});

test('Letzte Leistung zählt wiederholte Lasten mit', () => {
  const sessions = [
    { datum: '2026-08-01', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 3)] }] },
    { datum: '2026-08-04', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 4)] }] },
    { datum: '2026-08-07', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 4)] }] },
  ];
  const stand = L.letzteLeistung(sessions);
  assert.equal(stand.kniebeuge.gleicheLast, 3);
  assert.equal(stand.kniebeuge.datum, '2026-08-07');
});

test('Neue Last setzt den Zähler zurück', () => {
  const sessions = [
    { datum: '2026-08-01', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 5)] }] },
    { datum: '2026-08-04', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(105, 3)] }] },
  ];
  assert.equal(L.letzteLeistung(sessions).kniebeuge.gleicheLast, 1);
});

test('Sätze pro Woche zählen nur absolvierte Sätze im Zeitfenster', () => {
  const bis = new Date('2026-08-07');
  const sessions = [
    { datum: '2026-08-05', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 5), satz(100, 5)] }] },
    { datum: '2026-08-02', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(95, 5)] }] },
    // Außerhalb des Fensters:
    { datum: '2026-07-20', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(90, 5)] }] },
  ];
  assert.equal(L.saetzeProWoche(sessions, bis).kniebeuge, 3);
});

test('Leistungsstand bündelt Maxima und letzte Leistung', () => {
  const stand = L.leistungsstand({
    sessions: [{ datum: '2026-08-05', uebungen: [{ schluessel: 'hipthrust', saetze: [satz(140, 8)] }] }],
  });
  assert.ok(stand.maxima.hipthrust);
  assert.ok(stand.letzte.hipthrust);
});
