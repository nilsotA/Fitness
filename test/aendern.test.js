// Alles, was den Datenbestand verändert.
//
// Diese Prüfungen liefen früher über echtes HTTP gegen den Server. Seit die
// Logik in kern/aendern.js steht und der Browser sie genauso aufruft, prüfen
// sie die Funktionen direkt: schneller, und sie decken beide Betriebsarten ab
// statt nur die Server-Variante.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../kern/aendern.js';
import { zustand } from '../kern/zustand.js';
import { heute } from '../kern/regeln.js';

const neu = () => A.leeresTagebuch();

test('Zustand kommt auch bei leerem Profil vollständig zurück', () => {
  // Ohne Körperdaten kann die Ernährung nichts rechnen – die Oberfläche muss
  // sich trotzdem zeichnen lassen, sonst sieht ein neuer Nutzer nur einen Fehler.
  const z = zustand(neu(), '2026-08-07');
  assert.equal(z.datum, '2026-08-07');
  assert.ok(z.plan?.tage?.length === 7);
  assert.ok(z.heute);
  assert.equal(z.profilStatus.vollstaendig, false);
  assert.ok(z.profilStatus.fehlend.length >= 3);
});

test('Profil speichern schaltet die Ernährungsrechnung frei', () => {
  const daten = neu();
  A.profilSpeichern(daten, { geburtsjahr: 1996, groesseCm: 183, gewichtKg: 78, geschlecht: 'm' });
  const z = zustand(daten, '2026-08-07');
  assert.equal(z.profilStatus.vollstaendig, true);
  assert.ok(z.heute.bedarf.ziel > 1500, `Bedarf ${z.heute.bedarf?.ziel}`);
});

test('Zahlen aus Formularen werden als Zahlen abgelegt', () => {
  const daten = neu();
  const p = A.profilSpeichern(daten, { gewichtKg: '81.5', groesseCm: '183', hfMaxGemessen: '' });
  assert.equal(p.gewichtKg, 81.5);
  assert.equal(typeof p.groesseCm, 'number');
  assert.equal(p.hfMaxGemessen, null, 'leeres Feld wird null, nicht 0');
});

test('Gewichtsänderung landet im Verlauf', () => {
  const daten = neu();
  A.profilSpeichern(daten, { gewichtKg: 79 });
  assert.equal(daten.gewicht.length, 1);
  assert.equal(daten.gewicht[0].kg, 79);
  assert.equal(daten.gewicht[0].datum, heute());
});

test('Gewicht lässt sich für vergangene Tage nachtragen', () => {
  const daten = neu();
  A.gewichtSpeichern(daten, { kg: 77.4, datum: '2026-07-01' });
  assert.equal(daten.gewicht[0].datum, '2026-07-01');
  // Ein nachgetragener alter Wert darf das Profilgewicht nicht überschreiben.
  assert.notEqual(daten.profil.gewichtKg, 77.4);
});

test('Zweites Wiegen am selben Tag ersetzt das erste', () => {
  const daten = neu();
  A.gewichtSpeichern(daten, { kg: 78.0, datum: '2026-07-01' });
  A.gewichtSpeichern(daten, { kg: 78.6, datum: '2026-07-01' });
  assert.equal(daten.gewicht.length, 1, 'sonst verzackt die Kurve');
  assert.equal(daten.gewicht[0].kg, 78.6);
});

test('Gewicht ohne Wert wird abgelehnt', () => {
  assert.throws(() => A.gewichtSpeichern(neu(), {}), /Gewicht fehlt/);
});

test('Einheit eintragen berechnet die Belastung mit', () => {
  const daten = neu();
  const e = A.sessionAnlegen(daten, { typ: 'kraft', minuten: 60, rpe: 7, titel: 'Kraft' });
  assert.equal(e.last, 420);
  assert.equal(daten.sessions.length, 1);
});

test('Einheit ohne Pflichtfelder wird abgelehnt', () => {
  assert.throws(() => A.sessionAnlegen(neu(), { typ: 'kraft' }), /Dauer/);
  assert.throws(() => A.sessionAnlegen(neu(), { minuten: 60 }), /Typ/);
});

test('Einheit ändern und löschen', () => {
  const daten = neu();
  const e = A.sessionAnlegen(daten, { typ: 'kraft', minuten: 60, rpe: 7 });
  const geaendert = A.sessionAendern(daten, e.id, { rpe: 9 });
  assert.equal(geaendert.rpe, 9);
  assert.equal(geaendert.last, 540, 'die Belastung wird neu gerechnet');
  A.sessionLoeschen(daten, e.id);
  assert.equal(daten.sessions.length, 0);
  assert.equal(A.sessionAendern(daten, 'gibtesnicht', {}), null);
});

test('Essen eintragen und wieder löschen', () => {
  const daten = neu();
  const e = A.essenAnlegen(daten, {
    datum: '2026-08-07', name: 'Haferflocken', mengeG: 100,
    kcal: 370, protein: 13, kohlenhydrate: 59, fett: 7,
  });
  const z = zustand(daten, '2026-08-07');
  assert.equal(z.heute.ist.kcal, 370);
  A.essenLoeschen(daten, e.id);
  assert.equal(zustand(daten, '2026-08-07').heute.ist.kcal, 0);
});

test('Essen ohne Namen oder Menge wird abgelehnt', () => {
  assert.throws(() => A.essenAnlegen(neu(), { name: 'Brot' }), /Menge/);
});

test('Morgen-Check ersetzt einen bestehenden Eintrag desselben Tages', () => {
  const daten = neu();
  A.checkSpeichern(daten, { datum: '2026-08-07', schlaf: 2, muskelkater: 2, stress: 2, stimmung: 2, energie: 2 });
  const zweite = A.checkSpeichern(daten, {
    datum: '2026-08-07', schlaf: 5, muskelkater: 5, stress: 5, stimmung: 5, energie: 5,
  });
  assert.equal(daten.checks.length, 1);
  assert.equal(zweite.bereitschaft.prozent, 100);
});

test('Tests eintragen treibt den Muscle-Up-Weg voran', () => {
  const daten = neu();
  A.testAnlegen(daten, { art: 'klimmzuege', wert: 12 });
  const z = zustand(daten, '2026-08-07');
  assert.ok(z.muscleup.erreicht >= 2, `Stufe ${z.muscleup.erreicht}`);
});

test('Test ohne Art oder Wert wird abgelehnt', () => {
  assert.throws(() => A.testAnlegen(neu(), { art: 'klimmzuege' }), /Wert/);
});

test('Manuelle Stufen lassen sich bestätigen', () => {
  const daten = neu();
  A.testAnlegen(daten, { art: 'klimmzuege', wert: 12 });
  const stand = A.muscleupSpeichern(daten, { stufe: 3, erreicht: true });
  assert.equal(daten.muscleup.manuell['3'], true);
  assert.ok(stand.erreicht >= 2);
});

test('Ein kaputter Import überschreibt nichts', () => {
  // Ein jahrelang geführtes Tagebuch darf nicht an einer falschen Datei sterben.
  assert.throws(() => A.pruefeImport({ irgendwas: true }), /Export/);
  assert.throws(() => A.pruefeImport(null), /lesbaren/);
  assert.throws(() => A.pruefeImport('text'), /lesbaren/);
});

test('Ein gültiger Import wird auf die aktuelle Form gebracht', () => {
  // Ein Tagebuch aus einer älteren Fassung kennt neue Felder nicht.
  const alt = { profil: { gewichtKg: 80 }, sessions: [] };
  const geprueft = A.pruefeImport(alt);
  assert.equal(geprueft.profil.gewichtKg, 80);
  assert.equal(geprueft.profil.ausrichtung, 30, 'fehlende Felder werden ergänzt');
  assert.ok(Array.isArray(geprueft.checks));
  assert.ok(geprueft.muscleup.manuell);
});

test('Kennungen sind eindeutig', () => {
  const gesehen = new Set();
  for (let i = 0; i < 500; i += 1) gesehen.add(A.id('s'));
  assert.equal(gesehen.size, 500);
});

test('Die Bestandsübersicht nennt den jüngsten Eintrag', () => {
  // Grundlage für die Rückfrage vor dem Einspielen: Wer zwischen zwei Geräten
  // hin- und herschiebt, erwischt irgendwann die ältere Datei.
  const daten = neu();
  A.sessionAnlegen(daten, { typ: 'kraft', minuten: 60, rpe: 7, datum: '2026-08-01' });
  A.sessionAnlegen(daten, { typ: 'sprint', minuten: 75, rpe: 8, datum: '2026-08-05' });
  A.essenAnlegen(daten, { datum: '2026-08-03', name: 'Brot', mengeG: 100, kcal: 250 });
  A.checkSpeichern(daten, { datum: '2026-08-06', schlaf: 4 });

  const u = A.bestandsUebersicht(daten);
  assert.equal(u.sessions, 2);
  assert.equal(u.essen, 1);
  assert.equal(u.checks, 1);
  assert.equal(u.letztesDatum, '2026-08-06', 'auch ein Check zählt als Eintrag');
});

test('Ein leerer Bestand hat kein Datum statt eines erfundenen', () => {
  const u = A.bestandsUebersicht(neu());
  assert.equal(u.letztesDatum, null);
  assert.equal(u.eintraege, 0);
});

test('Die Übersicht kommt auch mit unvollständigen Daten klar', () => {
  // Eine Datei aus einer älteren Fassung kennt manche Listen noch nicht.
  const u = A.bestandsUebersicht({ sessions: [{ datum: '2026-08-01' }] });
  assert.equal(u.sessions, 1);
  assert.equal(u.essen, 0);
  assert.equal(u.letztesDatum, '2026-08-01');
  assert.deepEqual(A.bestandsUebersicht(), A.bestandsUebersicht({}));
});
