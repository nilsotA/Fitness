import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../kern/profil.js';

test('Schwerpunkte summieren sich immer auf 1', () => {
  for (let a = 0; a <= 100; a += 5) {
    const s = P.schwerpunkte(a);
    const summe = s.sprint + s.kraft + s.ausdauer;
    assert.ok(Math.abs(summe - 1) < 0.01, `Ausrichtung ${a}: Summe ${summe}`);
  }
});

test('Regler verschiebt den Schwerpunkt in die erwartete Richtung', () => {
  const sprintlastig = P.schwerpunkte(0);
  const hybrid = P.schwerpunkte(50);
  const ausdauerlastig = P.schwerpunkte(100);

  assert.ok(sprintlastig.sprint > hybrid.sprint);
  assert.ok(hybrid.sprint > ausdauerlastig.sprint);
  assert.ok(ausdauerlastig.ausdauer > hybrid.ausdauer);
  assert.ok(hybrid.ausdauer > sprintlastig.ausdauer);
});

test('Kraftanteil fällt flacher ab als der Sprintanteil', () => {
  // Auch Ausdauersportler brauchen Kraft – der Regler darf sie nicht wegdrehen.
  const s0 = P.schwerpunkte(0);
  const s100 = P.schwerpunkte(100);
  const sprintVerlust = (s0.sprint - s100.sprint) / s0.sprint;
  const kraftVerlust = (s0.kraft - s100.kraft) / s0.kraft;
  assert.ok(kraftVerlust < sprintVerlust);
  assert.ok(s100.kraft > 0.15, 'Kraft bleibt auch bei reiner Ausdauer relevant');
});

test('Fettfreie Masse nur mit Körperfettanteil', () => {
  assert.equal(P.fettfreieMasse({ gewichtKg: 80 }), null);
  assert.equal(P.fettfreieMasse({ gewichtKg: 80, koerperfettProzent: 15 }), 68);
});

test('Epley-Schätzung des Einer-Maximums', () => {
  assert.equal(P.e1rm(100, 1), 100);
  assert.equal(P.e1rm(100, 5), 116.7);
  assert.equal(P.e1rm(0, 5), null);
  assert.ok(P.e1rmVerlaesslich(8));
  assert.ok(!P.e1rmVerlaesslich(15));
});

test('Kraftmarken ordnen relativ zum Körpergewicht ein', () => {
  const stark = P.kraftEinordnung('kniebeuge', 160, 80);
  assert.equal(stark.faktor, 2);
  assert.equal(stark.stufe, 'stark');
  assert.equal(stark.naechsteMarke, null);

  const einstieg = P.kraftEinordnung('kniebeuge', 88, 80);
  assert.equal(einstieg.stufe, 'Einstieg');
  assert.equal(einstieg.naechsteMarke, 120); // 1,5 × 80 kg

  assert.equal(P.kraftEinordnung('gibtsnicht', 100, 80), null);
});

test('Muscle-Up-Stufen lassen sich nicht überspringen', () => {
  // Wer schon Muscle-Ups kann, aber angeblich keine acht Klimmzüge, bleibt
  // auf Stufe 0 – die Eingabe ist dann widersprüchlich, nicht die Logik.
  const widerspruch = P.muscleupStand({ klimmzuege: 3, muscleups: 5 });
  assert.equal(widerspruch.erreicht, 0);

  const stufe2 = P.muscleupStand({ klimmzuege: 12 });
  assert.equal(stufe2.erreicht, 2);
  assert.equal(stufe2.naechste.stufe, 3);
});

test('Muscle-Up-Weg berücksichtigt Zusatzlast und manuelle Stufen', () => {
  const stand = P.muscleupStand({
    klimmzuege: 12,
    zusatzlastAnteil: 0.3,
    manuell: { 4: true, 5: true },
  });
  assert.equal(stand.erreicht, 5);
  assert.equal(stand.naechste.name, 'Explosive Klimmzüge');
});

test('Ausdauerempfehlung folgt der Interferenzlage', () => {
  assert.equal(P.ausdauerEmpfehlung({ ausrichtung: 10 }).geraet, 'rad');
  assert.equal(P.ausdauerEmpfehlung({ ausrichtung: 50 }).geraet, 'gemischt');
  assert.equal(P.ausdauerEmpfehlung({ ausrichtung: 90 }).geraet, 'laufen');
});

test('Profilprüfung meldet fehlende Pflichtfelder', () => {
  const leer = P.pruefeProfil({});
  assert.equal(leer.vollstaendig, false);
  assert.deepEqual(leer.fehlend, ['Gewicht', 'Größe', 'Geburtsjahr']);

  const voll = P.pruefeProfil({ gewichtKg: 80, groesseCm: 183, geburtsjahr: 1997 });
  assert.equal(voll.vollstaendig, true);
});
