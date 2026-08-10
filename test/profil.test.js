import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../kern/profil.js';
import { MUSCLEUP_STUFEN, KRAFTMARKEN } from '../kern/wissen.js';

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

test('Jede Muscle-Up-Stufe ist auch wirklich erreichbar', () => {
  // Der eigentliche Fehler war nicht, dass eine Stufe falsch berechnet wurde –
  // Stufe 8 („Muscle-Up mit Schwung") konnte gar kein Stand sein. Sie prüfte
  // `muscleups >= 1`, Stufe 9 („Strikter Muscle-Up") ebenso, und weil die
  // Schleife weiterläuft, solange das nächste Tor besteht, sprang der Stand
  // sofort auf 9. Über einem Muscle-Up mit Kip stand dann „Ohne Schwung aus
  // dem Hang". Geprüft wird deshalb der ganze Weg, nicht ein Punkt darauf.
  const bestwerte = { klimmzuege: 0, muscleups: 0, zusatzlastAnteil: 0, manuell: {} };
  for (const stufe of MUSCLEUP_STUFEN) {
    if (stufe.pruefung === 'klimmzuege') bestwerte.klimmzuege = stufe.ziel;
    else if (stufe.pruefung === 'muscleups') bestwerte.muscleups = stufe.ziel;
    else if (stufe.pruefung === 'zusatzlast') bestwerte.zusatzlastAnteil = stufe.ziel;
    else if (stufe.pruefung === 'manuell') bestwerte.manuell[stufe.stufe] = true;

    const stand = P.muscleupStand(bestwerte);
    assert.equal(stand.erreicht, stufe.stufe,
      `Tor von Stufe ${stufe.stufe} („${stufe.tor}") erfüllt, Stand ist aber `
      + `${stand.erreicht} – die Stufe wird übersprungen`);
  }
});

test('Keine zwei Muscle-Up-Stufen hängen am selben Tor', () => {
  // Die Eigenschaft hinter dem Fehler oben: Zwei Stufen mit gleicher Prüfung
  // und gleichem Ziel sind nicht zwei Stufen, sondern eine.
  const gesehen = new Map();
  for (const s of MUSCLEUP_STUFEN) {
    const schluessel = `${s.pruefung}:${s.ziel}`;
    if (s.pruefung === 'manuell') continue; // wird je Stufe einzeln abgehakt
    assert.ok(!gesehen.has(schluessel),
      `Stufe ${s.stufe} („${s.name}") prüft dasselbe wie Stufe `
      + `${gesehen.get(schluessel)}: ${schluessel}`);
    gesehen.set(schluessel, s.stufe);
  }
});

test('Sauberkeit wird nicht aus einem Zähler abgeleitet', () => {
  // Ein Zähler weiß, wie oft, nicht wie. Wer einen Muscle-Up mit Schwung
  // einträgt, steht auf Stufe 8 – und nicht auf einer, die „ohne Schwung"
  // im Tor stehen hat. Gleiche Familie wie Falle 4.
  const mitSchwung = P.muscleupStand({
    klimmzuege: 12,
    zusatzlastAnteil: 0.25,
    manuell: { 4: true, 5: true, 6: true, 7: true },
    muscleups: 1,
  });
  assert.equal(mitSchwung.erreicht, 8);
  assert.equal(mitSchwung.aktuelle.name, 'Muscle-Up mit Schwung');

  // Auch viele Wiederholungen ändern daran nichts – die Zahl sagt nichts über
  // den Stil.
  const vieleMitSchwung = P.muscleupStand({
    klimmzuege: 12,
    zusatzlastAnteil: 0.25,
    manuell: { 4: true, 5: true, 6: true, 7: true },
    muscleups: 20,
  });
  assert.equal(vieleMitSchwung.erreicht, 8,
    'zwanzig gezählte Muscle-Ups belegen noch keine strikte Ausführung');

  // Beim Klimmzug steht die Sauberkeit in der Testdefinition selbst („Ohne
  // Schwung, voll ausgestreckt starten"), der Zähler trägt sie also mit. Der
  // Muscle-Up-Test fragt nur „Am Stück, ohne Absetzen" – über den Stil sagt er
  // nichts. Was Sauberkeit fordert, darf deshalb nicht an ihm hängen.
  for (const s of MUSCLEUP_STUFEN.filter((x) => x.pruefung === 'muscleups')) {
    assert.doesNotMatch(`${s.name} ${s.tor}`, /ohne Schwung|strikt/i,
      `Stufe ${s.stufe} („${s.name}") verlangt Sauberkeit, hängt aber am `
      + 'Muscle-Up-Zähler – der misst nur die Anzahl');
  }
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

test('Eine bestätigte Stufe, die eine frühere aufhält, wird als vorgemerkt geführt', () => {
  // Der Knopf „geschafft" war auf jeder noch nicht erreichbaren Stufe eine
  // Sackgasse: Er speicherte die Bestätigung, der Stand konnte sich aber nicht
  // bewegen, und die Oberfläche leitete ihre Häkchen allein aus dem Stand ab.
  // Ergebnis: Tippen ohne jede sichtbare Wirkung – und beim zweiten Tippen
  // wurde die Bestätigung stillschweigend wieder zurückgenommen.
  const stand = P.muscleupStand({ klimmzuege: 0, muscleups: 0, zusatzlastAnteil: 0, manuell: { 9: true } });

  assert.equal(stand.erreicht, 0, 'eine späte Bestätigung darf den Stand nicht bewegen');
  const neun = stand.stufen.find((s) => s.stufe === 9);
  assert.equal(neun.vorgemerkt, true, 'die Bestätigung ist nirgends ablesbar');
  assert.equal(neun.erreicht, false);

  // Sobald die Stufe wirklich dran ist, heißt sie erreicht und nicht mehr
  // vorgemerkt – sonst stünden beide Kennzeichen nebeneinander.
  const voll = P.muscleupStand({
    klimmzuege: 12, muscleups: 1, zusatzlastAnteil: 0.3,
    manuell: { 4: true, 5: true, 6: true, 7: true, 9: true },
  });
  const neunVoll = voll.stufen.find((s) => s.stufe === 9);
  assert.equal(neunVoll.erreicht, true);
  assert.equal(neunVoll.vorgemerkt, false);

  // Zählbare Stufen kennen kein „vorgemerkt" – dort gibt es nichts zu tippen.
  for (const s of stand.stufen.filter((x) => x.pruefung !== 'manuell')) {
    assert.equal(s.vorgemerkt, false, `Stufe ${s.stufe} ist zählbar und trotzdem vorgemerkt`);
  }
});
