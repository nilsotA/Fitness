import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../kern/leistung.js';

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

/* --------------------------------------------------- Muskelgruppen */

test('Sätze werden über Übungen hinweg pro Muskelgruppe zusammengezählt', () => {
  // Der eigentliche Punkt der Muskelgruppen-Zuordnung: Kniebeuge und Hip Thrust
  // treffen beide das Gesäß. Pro Übung gezählt sähe jede nach zu wenig aus.
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [
      { schluessel: 'kniebeuge', saetze: [satz(100, 5), satz(100, 5), satz(100, 5)] },
      { schluessel: 'hipthrust', saetze: [satz(140, 8), satz(140, 8), satz(140, 8)] },
    ],
  }];
  const proMuskel = L.saetzeProMuskel(sessions, bis);
  // Gesäß: 3 (Kniebeuge, voll) + 3 (Hip Thrust, voll) = 6
  assert.equal(proMuskel.gesaess, 6);
  // Quadrizeps: nur aus der Kniebeuge, voll = 3
  assert.equal(proMuskel.quadrizeps, 3);
  // Hamstrings: je zur Hälfte aus beiden = 1,5 + 1,5 = 3
  assert.equal(proMuskel.hamstrings, 3);
});

test('Mitarbeitende Muskeln zählen nur zur Hälfte', () => {
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [{ schluessel: 'bankdruecken', saetze: [satz(80, 8), satz(80, 8)] }],
  }];
  const proMuskel = L.saetzeProMuskel(sessions, bis);
  assert.equal(proMuskel.brust, 2);
  assert.equal(proMuskel.trizeps, 1);
  assert.equal(proMuskel.schultern, 1);
});

test('Übungen ohne Muskelzuordnung verzerren die Zählung nicht', () => {
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [{ schluessel: 'einbeinstand', saetze: [satz(0, 1), satz(0, 1)] }],
  }];
  assert.deepEqual(L.saetzeProMuskel(sessions, bis), {});
});

/* ------------------------------------------------- Verletzungsschutz */

test('Schutzabdeckung erkennt fehlende Bereiche', () => {
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [
      { schluessel: 'nordic', saetze: [satz(0, 5), satz(0, 5)] },
      { schluessel: 'kniebeuge', saetze: [satz(100, 5)] },
    ],
  }];
  const abdeckung = L.schutzabdeckung(sessions, bis);
  assert.equal(abdeckung.hamstrings.erfuellt, true);
  assert.equal(abdeckung.hamstrings.saetze, 2);
  assert.equal(abdeckung.leiste.erfuellt, false, 'Copenhagen fehlt');
  assert.equal(abdeckung.achillessehne.erfuellt, false, 'Wadenarbeit fehlt');
});

test('Mehrere Übungen zahlen auf dasselbe Schutzziel ein', () => {
  // Stehendes und sitzendes Wadenheben treffen unterschiedliche Muskeln,
  // schützen aber dieselbe Sehne.
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [
      { schluessel: 'wadenheben', saetze: [satz(60, 10)] },
      { schluessel: 'wadenhebenSitzend', saetze: [satz(40, 12)] },
    ],
  }];
  const abdeckung = L.schutzabdeckung(sessions, bis);
  assert.equal(abdeckung.achillessehne.saetze, 2);
  assert.equal(abdeckung.achillessehne.erfuellt, true);
});

test('Schutzziele tragen ihre Belegzahl mit', () => {
  const abdeckung = L.schutzabdeckung([], new Date());
  assert.equal(abdeckung.hamstrings.reduktion, 0.51);
  assert.equal(abdeckung.leiste.reduktion, 0.41);
  assert.equal(abdeckung.hamstrings.quelle, 'vandyk2019');
});

/* ---------------------------------------------------- Risikoprofil */

test('Risikoprofil weist erhöhtes Risiko mit Alternative aus', () => {
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [
      { schluessel: 'kreuzheben', saetze: [satz(140, 5), satz(140, 5)] },
      { schluessel: 'hipthrust', saetze: [satz(140, 8)] },
    ],
  }];
  const profil = L.risikoprofil(sessions, bis);
  assert.equal(profil.erhoeht, 2);
  assert.equal(profil.niedrig, 1);
  assert.equal(profil.auffaellig.length, 1);
  assert.equal(profil.auffaellig[0].alternativeSchluessel, 'trapbarKreuzheben');
});

test('Gelenkschonende Auswahl erzeugt kein erhöhtes Risiko', () => {
  const bis = new Date('2026-08-07');
  const sessions = [{
    datum: '2026-08-05',
    uebungen: [
      { schluessel: 'frontKniebeuge', saetze: [satz(80, 5)] },
      { schluessel: 'trapbarKreuzheben', saetze: [satz(150, 5)] },
      { schluessel: 'hipthrust', saetze: [satz(140, 8)] },
    ],
  }];
  const profil = L.risikoprofil(sessions, bis);
  assert.equal(profil.erhoeht, 0);
  assert.equal(profil.auffaellig.length, 0);
});

test('Leistungsstand bündelt Maxima und letzte Leistung', () => {
  const stand = L.leistungsstand({
    sessions: [{ datum: '2026-08-05', uebungen: [{ schluessel: 'hipthrust', saetze: [satz(140, 8)] }] }],
  });
  assert.ok(stand.maxima.hipthrust);
  assert.ok(stand.letzte.hipthrust);
});

/* ------------------------------------------------------ Volumenbewertung */

test('Volumen wird nach unten und nach oben eingeordnet', () => {
  // Vorher kannte die Anzeige nur „zu wenig": 30 Sätze sahen aus wie 14.
  const b = L.volumenBewertung({ brust: 6, ruecken: 14, quadrizeps: 30 });
  assert.equal(b.brust.stufe, 'wenig');
  assert.equal(b.ruecken.stufe, 'gut');
  assert.equal(b.quadrizeps.stufe, 'viel');
});

test('Der Balken läuft bei viel Volumen nicht einfach voll', () => {
  const b = L.volumenBewertung({ quadrizeps: 20, brust: 40 });
  assert.equal(b.quadrizeps.anteil, 1);
  assert.equal(b.brust.anteil, 1, 'gedeckelt, nicht über 100 %');
  assert.ok(L.volumenBewertung({ brust: 10 }).brust.anteil < 1);
});

test('Der Sprinthinweis kommt nur bei den Muskeln, die der Sprint trifft', () => {
  // Bei Brust wäre derselbe Satz schlicht falsch.
  const mitSprint = L.volumenBewertung({ hamstrings: 22, brust: 22 }, 3);
  assert.match(mitSprint.hamstrings.text, /Sprint an 3 Tagen/);
  assert.doesNotMatch(mitSprint.brust.text, /Sprint/);

  // Ohne Sprinttage im Plan entfällt er ganz.
  const ohneSprint = L.volumenBewertung({ hamstrings: 22 }, 0);
  assert.doesNotMatch(ohneSprint.hamstrings.text, /Sprint/);
});

test('Der Hinweis bei viel Volumen verbietet nichts', () => {
  // Der Tracker benennt erhöhtes Risiko, die Abwägung bleibt bei Nils.
  const b = L.volumenBewertung({ quadrizeps: 25 }, 2);
  assert.doesNotMatch(b.quadrizeps.text, /zu viel|darfst nicht|reduziere/i);
  assert.match(b.quadrizeps.text, /kaum noch/);
});
