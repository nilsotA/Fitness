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

/* ---------------------------------------------------------- Bestzeiten */

test('Die Bestzeit ist der Rekord, nicht der letzte Wert', () => {
  // Die Karte zeigte bisher nur „beste Zeit zuletzt". An einem müden Tag sah
  // das aus wie ein Rückschritt, obwohl der Rekord unangetastet daneben stand.
  const verlauf = S.bestzeitVerlauf([
    { datum: '2026-06-01', laeufe: [{ distanz: 30, sekunden: 4.30, art: 'beschleunigung' }] },
    { datum: '2026-07-01', laeufe: [{ distanz: 30, sekunden: 4.11, art: 'beschleunigung' }] },
    { datum: '2026-08-01', laeufe: [{ distanz: 30, sekunden: 4.25, art: 'beschleunigung' }] },
  ]);
  const b = S.bestzeiten(verlauf)['beschleunigung-30'];
  assert.equal(b.sekunden, 4.11);
  assert.equal(b.datum, '2026-07-01');
  assert.equal(b.letzte.sekunden, 4.25, 'die letzte Einheit steht daneben');
  assert.equal(b.istAktuell, false);
  assert.ok(Math.abs(b.abstandProzent - 3.4) < 0.2, `Abstand ${b.abstandProzent} %`);
  assert.equal(b.einheiten, 3);
});

test('Eine neue Bestzeit wird als solche erkannt', () => {
  const verlauf = S.bestzeitVerlauf([
    { datum: '2026-06-01', laeufe: [{ distanz: 30, sekunden: 4.30, art: 'beschleunigung' }] },
    { datum: '2026-08-01', laeufe: [{ distanz: 30, sekunden: 4.09, art: 'beschleunigung' }] },
  ]);
  const b = S.bestzeiten(verlauf)['beschleunigung-30'];
  assert.equal(b.istAktuell, true);
  assert.equal(b.abstandProzent, 0);
});

test('Jede Distanz und Laufart hat ihre eigene Bestzeit', () => {
  const verlauf = S.bestzeitVerlauf([
    { datum: '2026-06-01', laeufe: [
      { distanz: 30, sekunden: 4.20, art: 'beschleunigung' },
      { distanz: 30, sekunden: 3.05, art: 'fliegend' },
    ] },
  ]);
  const b = S.bestzeiten(verlauf);
  assert.equal(b['beschleunigung-30'].sekunden, 4.20);
  assert.equal(b['fliegend-30'].sekunden, 3.05);
});

test('Ohne Läufe gibt es keine Bestzeiten', () => {
  assert.deepEqual(S.bestzeiten({}), {});
  assert.deepEqual(S.bestzeiten(), {});
});

test('Ein langsamer erster Lauf verwirft nicht die ganze Einheit', () => {
  // Der erste Sprint ist erfahrungsgemäß noch nicht der schnellste – das steht
  // so im Kommentar von SPRINT_QUALITAET. Gemessen wurde trotzdem gegen die
  // beste Zeit der *ganzen* Einheit, auch gegen spätere. Bei 3 %
  // Aufwärmrückstand stand ersterAbbruch damit auf 0 und die Oberfläche
  // meldete „0/8 Läufe in Qualität": also gar nicht erst sprinten.
  //
  // Das Argument gegen diese Lesart ist einfach: Wenn ein späterer Lauf
  // schneller war, war der frühere nicht ermüdungsbedingt langsam.
  const zeiten = [4.05, 3.95, 3.92, 3.90, 3.94, 3.98, 4.05, 4.12];
  const a = S.auswertung(zeiten.map((sekunden) => ({ distanz: 30, art: 'stehend', sekunden })));
  const g = a.gruppen[0];

  assert.equal(g.laeufe[0].stufe, 'anlauf', 'vor der Bestzeit ist Abfall kein Abbruch');
  assert.equal(g.ersterAbbruch, 6, 'die Ermüdung setzt bei Lauf 7 ein');
  assert.equal(g.qualitaetslaeufe, 6);
  assert.equal(g.ueberschuss, 2);
});

test('Nach der Bestzeit greift die Abbruchregel weiterhin', () => {
  // Gegenprobe: Die Entschärfung darf die Regel nicht abschalten. Ein Melder,
  // der nie meldet, besteht jeden Test.
  const zeiten = [3.90, 3.91, 3.93, 3.95, 3.99, 4.03, 4.09, 4.15];
  const a = S.auswertung(zeiten.map((sekunden) => ({ distanz: 30, art: 'stehend', sekunden })));
  const g = a.gruppen[0];
  assert.equal(g.ersterAbbruch, 5);
  assert.equal(g.ueberschuss, 3);
  assert.ok(!g.laeufe.some((l) => l.stufe === 'anlauf'), 'ohne Anlauf keine Anlauf-Stufe');
});

test('Der Abbruchtext zählt, was er behauptet', () => {
  // `ueberschuss` sind die Läufe **ab** dem ersten Abbruch – nicht die Läufe
  // über der Schwelle. Der Text nannte die eine Zahl und behauptete die
  // andere: „5 von 8 Läufen lagen mehr als 3 % über deiner Tagesbestzeit", wo
  // genau einer drüber lag. Gleiche Familie wie Falle 15.
  const zeiten = [3.90, 3.91, 3.93, 4.05, 3.94, 3.95, 3.96, 3.97];
  const a = S.auswertung(zeiten.map((sekunden) => ({ distanz: 30, art: 'stehend', sekunden })));
  const ueberSchwelle = a.gruppen[0].laeufe
    .filter((l) => l.abfall >= a.schwelle.abbruchProzent).length;

  assert.equal(ueberSchwelle, 1);
  assert.equal(a.ueberschuss, 5, 'ab dem ersten Abbruch gerechnet');
  assert.doesNotMatch(a.text, /lagen mehr als/,
    'der Text darf die Läufe ab dem Abbruch nicht als Läufe über der Schwelle ausgeben');
  assert.match(a.text, /nach dem ersten Abfall/);
});

test('Ein einzelner Lauf nach dem Abbruch wird richtig gebeugt', () => {
  // „1 Läufe kamen" – dafür gibt es menge().
  const zeiten = [3.90, 3.91, 3.93, 3.95, 3.99, 4.03, 4.20];
  const a = S.auswertung(zeiten.map((sekunden) => ({ distanz: 30, art: 'stehend', sekunden })));
  assert.equal(a.ueberschuss, 2);

  const knapp = [3.90, 3.91, 3.93, 4.20];
  const b = S.auswertung(knapp.map((sekunden) => ({ distanz: 30, art: 'stehend', sekunden })));
  assert.equal(b.ueberschuss, 1);
  assert.match(b.text, /^1 Lauf kam /, `falsch gebeugt: „${b.text.slice(0, 30)}"`);
});
