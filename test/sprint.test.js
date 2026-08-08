import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../kern/sprint.js';

const lauf = (sekunden, distanz = 30, art = 'beschleunigung') => ({ distanz, sekunden, art });

test('Geschwindigkeit aus Distanz und Zeit', () => {
  assert.equal(S.geschwindigkeit(30, 4.0), 7.5);
  assert.equal(S.geschwindigkeit(30, 0), null);
  assert.equal(S.geschwindigkeit(0, 4), null);
});

test('Unplausible Zeiten fliegen raus', () => {
  const sauber = S.pruefeLaeufe([
    lauf(4.2), lauf(0), lauf(-3), lauf(200), lauf(0.2),
    { distanz: 0, sekunden: 4.2 },
  ]);
  assert.equal(sauber.length, 1);
  assert.equal(sauber[0].sekunden, 4.2);
});

test('Unbekannte Laufart fällt auf Beschleunigung zurück', () => {
  const [l] = S.pruefeLaeufe([{ distanz: 30, sekunden: 4.2, art: 'quatsch' }]);
  assert.equal(l.art, 'beschleunigung');
});

test('Alle Läufe im Bereich ergeben keinen Überschuss', () => {
  const a = S.auswertung([lauf(4.10), lauf(4.12), lauf(4.15), lauf(4.13)]);
  assert.equal(a.bewertbar, true);
  assert.equal(a.ueberschuss, 0);
  assert.equal(a.gruppen[0].ersterAbbruch, -1);
  assert.match(a.text, /Genau so/);
});

test('Abfall über der Schwelle markiert das Ende der Qualität', () => {
  // Bestzeit 4,10 s. Die Schwelle liegt bei 3 % → ab 4,223 s ist Schluss.
  const a = S.auswertung([lauf(4.10), lauf(4.13), lauf(4.18), lauf(4.28), lauf(4.35)]);
  assert.equal(a.gruppen[0].ersterAbbruch, 3);
  assert.equal(a.gruppen[0].qualitaetslaeufe, 3);
  assert.equal(a.ueberschuss, 2);
  assert.match(a.text, /keine Schnelligkeit/);
});

test('Qualitätsmeter zählen nur die guten Läufe', () => {
  const a = S.auswertung([lauf(4.10), lauf(4.12), lauf(4.15), lauf(4.40), lauf(4.50)]);
  assert.equal(a.meter, 150);
  assert.equal(a.qualitaetsmeter, 90);
});

test('Distanzen und Arten werden getrennt bewertet', () => {
  // Eine fliegende 30 und eine 30 aus dem Stand sind völlig verschiedene
  // Zeiten – miteinander verglichen ergäbe jede Einheit einen Scheinabbruch.
  const a = S.auswertung([
    lauf(4.20, 30, 'beschleunigung'),
    lauf(4.25, 30, 'beschleunigung'),
    lauf(3.05, 30, 'fliegend'),
    lauf(3.08, 30, 'fliegend'),
  ]);
  assert.equal(a.gruppen.length, 2);
  assert.equal(a.ueberschuss, 0, 'kein Abbruch trotz 4,20 s gegen 3,05 s');

  const fliegend = a.gruppen.find((g) => g.art === 'fliegend');
  assert.equal(fliegend.besteZeit, 3.05);
});

test('Unter drei Läufen wird nicht bewertet', () => {
  const a = S.auswertung([lauf(4.10), lauf(4.60)]);
  assert.equal(a.bewertbar, false);
  assert.equal(a.ueberschuss, 0, 'kein Abbruch ohne belastbare Tagesbestzeit');
  assert.match(a.text, /Tagesbestzeit/);
});

test('Ohne Zeiten ist nichts auszuwerten', () => {
  assert.equal(S.auswertung([]).bewertbar, false);
  assert.equal(S.auswertung(null).bewertbar, false);
});

/* ------------------------------------------------- Rückmeldung im Training */

test('Der erste Lauf setzt die Tagesbestzeit', () => {
  const b = S.laufBewerten([lauf(4.2)], 0);
  assert.equal(b.stufe, 'erster');
});

test('Eine neue Bestzeit wird als solche gemeldet', () => {
  const b = S.laufBewerten([lauf(4.20), lauf(4.10)], 1);
  assert.equal(b.stufe, 'gut');
  assert.match(b.text, /Neue Tagesbestzeit/);
});

test('Warnstufe vor der Abbruchstufe', () => {
  // 4,10 → 4,20 sind 2,4 %: Warnung, noch kein Abbruch.
  const warnung = S.laufBewerten([lauf(4.10), lauf(4.20)], 1);
  assert.equal(warnung.stufe, 'warnung');

  // 4,10 → 4,30 sind 4,9 %: Abbruch.
  const abbruch = S.laufBewerten([lauf(4.10), lauf(4.30)], 1);
  assert.equal(abbruch.stufe, 'abbruch');
  assert.match(abbruch.text, /aufhören/);
});

test('Die Rückmeldung vergleicht nur mit derselben Laufart', () => {
  const b = S.laufBewerten([
    lauf(3.05, 30, 'fliegend'),
    lauf(4.20, 30, 'beschleunigung'),
  ], 1);
  assert.equal(b.stufe, 'erster', 'erste Beschleunigung, nicht mit der fliegenden vergleichen');
});

/* ------------------------------------------------------------- Verlauf */

test('Bestzeitverlauf nimmt je Einheit die schnellste Zeit', () => {
  const verlauf = S.bestzeitVerlauf([
    { datum: '2026-07-01', laeufe: [lauf(4.40), lauf(4.35), lauf(4.50)] },
    { datum: '2026-07-15', laeufe: [lauf(4.30), lauf(4.28)] },
    { datum: '2026-07-08', laeufe: [] },
  ]);
  const reihe = verlauf['beschleunigung-30'];
  assert.equal(reihe.length, 2);
  assert.deepEqual(reihe.map((p) => p.sekunden), [4.35, 4.28]);
  // Chronologisch sortiert, damit die Kurve stimmt.
  assert.ok(reihe[0].datum < reihe[1].datum);
});

test('Verlauf trennt Distanzen und Arten', () => {
  const verlauf = S.bestzeitVerlauf([{
    datum: '2026-07-01',
    laeufe: [lauf(4.20, 30), lauf(2.05, 10), lauf(3.05, 30, 'fliegend')],
  }]);
  assert.deepEqual(Object.keys(verlauf).sort(),
    ['beschleunigung-10', 'beschleunigung-30', 'fliegend-30']);
});

test('Gruppenname ist lesbar', () => {
  assert.equal(S.gruppenName('fliegend-30'), '30 m fliegend');
  assert.equal(S.gruppenName('beschleunigung-10'), '10 m aus dem Stand');
});
