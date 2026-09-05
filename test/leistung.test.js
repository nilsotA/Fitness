import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../kern/leistung.js';
import * as P from '../kern/profil.js';
import { EPLEY } from '../kern/wissen.js';

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
  // Hier stand `assert.equal(g.gesamtlast, true)`. Das Feld hieß nach einer
  // Last und enthielt einen Wahrheitswert, hatte repo-weit keinen Leser und
  // gehörte nicht zu dem, was der Testname behauptet – die Aussage „rechnet
  // das Körpergewicht heraus" steht in den beiden Zeilen darüber. Wenn ein
  // Test bei einer Korrektur bricht, ist die erste Frage, was er eigentlich
  // prüft (Fallen 15 und 16).
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
  const letzte = { topGewicht: 100, ohneFortschritt: 1, saetze: [satz(100, 5), satz(100, 5), satz(100, 5)] };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5]);
  assert.equal(v.richtung, 'hoch');
  assert.equal(v.empfehlung, 105);
});

test('Progression hält, solange der Bereich nicht voll ist', () => {
  const letzte = { topGewicht: 100, ohneFortschritt: 1, saetze: [satz(100, 5), satz(100, 4), satz(100, 3)] };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5]);
  assert.equal(v.richtung, 'halten');
  assert.equal(v.empfehlung, 100);
});

test('Nach drei Einheiten ohne Fortschritt geht die Last zurück', () => {
  const letzte = { topGewicht: 100, ohneFortschritt: 3, saetze: [satz(100, 3), satz(100, 3)] };
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

test('Mehr Wiederholungen bei gleicher Last sind Fortschritt', () => {
  // Dieser Test hieß einmal „zaehlt wiederholte Lasten mit" und verlangte
  // hier eine 3 – er hat den Fehler festgeschrieben. Bei doppelter Progression
  // hält man die Last absichtlich und arbeitet die Wiederholungen hoch; 3 -> 4
  // Wiederholungen ist genau der gewünschte Verlauf und kein Stillstand.
  const sessions = [
    { datum: '2026-08-01', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 3)] }] },
    { datum: '2026-08-04', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 4)] }] },
    { datum: '2026-08-07', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 4)] }] },
  ];
  const stand = L.letzteLeistung(sessions);
  // Nur die letzte Einheit brachte nichts Neues.
  assert.equal(stand.kniebeuge.ohneFortschritt, 2);
  assert.equal(stand.kniebeuge.datum, '2026-08-07');
});

test('Echter Stillstand wird weiterhin gezählt', () => {
  const sessions = [1, 2, 3, 4].map((n) => ({
    datum: `2026-08-0${n}`,
    uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 4)] }],
  }));
  assert.equal(L.letzteLeistung(sessions).kniebeuge.ohneFortschritt, 4);
});

test('Die Rücknahme feuert nicht mitten im Aufbau', () => {
  // Der Fall, der das ausgelöst hat: 105 kg mit 4,4,3 dann 4,4,4 dann 4,4,4.
  // Darunter stand „3 Einheiten auf 105 kg ohne Fortschritt. Zurück auf
  // 95 kg" – obwohl zwischendurch eine Wiederholung dazugekommen war.
  const einheit = (datum, wdh) => ({
    datum, uebungen: [{ schluessel: 'kniebeuge', saetze: wdh.map((w) => satz(105, w)) }],
  });
  const sessions = [
    einheit('2026-08-01', [4, 4, 3]),
    einheit('2026-08-04', [4, 4, 4]),
    einheit('2026-08-07', [4, 4, 4]),
  ];
  const stand = L.letzteLeistung(sessions).kniebeuge;
  const rat = L.naechsteLast('kniebeuge', stand, [3, 5]);
  assert.notEqual(rat.richtung, 'runter', `Rücknahme trotz Fortschritt: ${rat.text}`);
  assert.equal(rat.richtung, 'halten');

  // Und wenn es wirklich dreimal stillsteht, greift sie.
  sessions.push(einheit('2026-08-10', [4, 4, 4]));
  const stillstand = L.letzteLeistung(sessions).kniebeuge;
  assert.equal(L.naechsteLast('kniebeuge', stillstand, [3, 5]).richtung, 'runter');
});

test('Neue Last setzt den Zähler zurück', () => {
  const sessions = [
    { datum: '2026-08-01', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(100, 5)] }] },
    { datum: '2026-08-04', uebungen: [{ schluessel: 'kniebeuge', saetze: [satz(105, 3)] }] },
  ];
  assert.equal(L.letzteLeistung(sessions).kniebeuge.ohneFortschritt, 1);
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

test('Über der Epley-Grenze entsteht kein Einer-Maximum', () => {
  // Bewusst so: Die Formel ist an schweren Sätzen kalibriert und driftet
  // darüber ab. Wichtig ist nur, dass es an der Grenze und nicht willkürlich
  // passiert – und dass die Grenze an einer Stelle steht.
  const kg = 78;
  const test = (reps) => L.einerMaxima(
    { tests: [{ datum: '2026-07-01', art: 'klimmzuege', wert: reps }], sessions: [] }, kg,
  ).klimmzuege;

  assert.ok(test(EPLEY.maxWiederholungen), 'an der Grenze muss es noch rechnen');
  assert.equal(test(EPLEY.maxWiederholungen + 1), undefined);

  // Und darunter steigt die Schätzung mit den Wiederholungen.
  assert.ok(test(10).e1rm > test(8).e1rm);
});

test('Die Epley-Grenze steht nur an einer Stelle', () => {
  // Sie stand als nackte 10 in leistung.js (dreimal), profil.js und
  // zustand.js. Fachzahlen wandern gern zurück in den Code.
  assert.equal(typeof EPLEY.maxWiederholungen, 'number');
  assert.equal(P.e1rmVerlaesslich(EPLEY.maxWiederholungen), true);
  assert.equal(P.e1rmVerlaesslich(EPLEY.maxWiederholungen + 1), false);
});

test('Ein verworfener Krafttest wird nicht verschwiegen', () => {
  // `einerMaxima` überspringt Tests über der Epley-Grenze – richtig, die
  // Schätzung wäre unbrauchbar. Angezeigt wurde danach aber derselbe Strich
  // wie bei jemandem, der gar nichts eingetragen hat. Wer etwas eingetragen
  // hat und einen Strich sieht, sucht den Fehler bei sich.
  const daten = {
    profil: { gewichtKg: 78.3 },
    tests: [{ id: 't1', datum: '2026-08-01', art: 'kniebeuge', wert: 100, wiederholungen: 15 }],
    sessions: [],
  };
  const stand = L.leistungsstand(daten);
  assert.equal(stand.maxima.kniebeuge, undefined, 'kein geschätztes Maximum – so soll es sein');
  assert.equal(stand.nichtSchaetzbar.kniebeuge.wiederholungen, 15);
  assert.equal(stand.nichtSchaetzbar.kniebeuge.grenze, EPLEY.maxWiederholungen);
});

test('Ein brauchbarer Test taucht nicht als verworfen auf', () => {
  const daten = {
    profil: { gewichtKg: 78.3 },
    tests: [{ id: 't1', datum: '2026-08-01', art: 'kniebeuge', wert: 120, wiederholungen: 3 }],
    sessions: [],
  };
  const stand = L.leistungsstand(daten);
  assert.ok(stand.maxima.kniebeuge.e1rm > 120);
  assert.deepEqual(stand.nichtSchaetzbar, {});
});

test('Der jüngste verworfene Test zählt', () => {
  // Sonst nennt die Meldung eine Wiederholungszahl von vor einem Jahr.
  const daten = {
    profil: { gewichtKg: 78.3 },
    tests: [
      { id: 't1', datum: '2026-01-01', art: 'kniebeuge', wert: 80, wiederholungen: 20 },
      { id: 't2', datum: '2026-08-01', art: 'kniebeuge', wert: 100, wiederholungen: 12 },
    ],
    sessions: [],
  };
  const stand = L.leistungsstand(daten);
  assert.equal(stand.nichtSchaetzbar.kniebeuge.wiederholungen, 12);
  assert.equal(stand.nichtSchaetzbar.kniebeuge.datum, '2026-08-01');
});

test('Ein Vorschlag widerspricht nie der Vorgabe daneben', () => {
  // In der Planansicht stehen beide in derselben Zeile: „35–75 kg" als
  // Vorgabe, darunter „Last auf 110 kg erhöhen". Doppelte Progression
  // vergleicht mit der letzten Einheit, ohne zu wissen, aus welchem Block die
  // stammte – und Maximal- wie Explosivkraft enden beide bei 5 Wiederholungen,
  // „alle Sätze oben" war über die Blockgrenze also immer erfüllt.
  const ausMaximalkraftblock = {
    datum: '2026-07-12',
    topGewicht: 105,
    gesamtWdh: 15,
    ohneFortschritt: 1,
    saetze: [{ gewicht: 105, wiederholungen: 5 }, { gewicht: 105, wiederholungen: 5 },
      { gewicht: 105, wiederholungen: 5 }],
  };

  // Realisierungsblock: 30–60 % 1RM.
  const imSchnellkraftblock = L.naechsteLast('kniebeuge', ausMaximalkraftblock, [3, 5],
    { von: 35, bis: 75 });
  assert.equal(imSchnellkraftblock.richtung, 'neuerBlock');
  assert.equal(imSchnellkraftblock.empfehlung, null, 'keine Zahl, die der Vorgabe widerspricht');
  assert.match(imSchnellkraftblock.text, /35–75 kg/, 'nennt die Vorgabe, die stattdessen gilt');

  // Gegenrichtung: zurück im schweren Block, letzte Einheit war leicht.
  const ausSchnellkraftblock = { ...ausMaximalkraftblock, topGewicht: 75 };
  const imMaximalkraftblock = L.naechsteLast('kniebeuge', ausSchnellkraftblock, [2, 5],
    { von: 100, bis: 110 });
  assert.equal(imMaximalkraftblock.richtung, 'neuerBlock');
  assert.equal(imMaximalkraftblock.empfehlung, null);
});

test('Innerhalb eines Blocks steigert der Vorschlag weiter', () => {
  // Die Gegenprobe zum Test darüber: Die Blockerkennung darf die normale
  // Progression nicht abwürgen. Ein Schritt über das obere Ende der Vorgabe
  // ist der Normalfall – erst danach zieht das Einer-Maximum nach.
  const letzte = {
    datum: '2026-07-12',
    topGewicht: 90,
    gesamtWdh: 15,
    ohneFortschritt: 1,
    saetze: [{ gewicht: 90, wiederholungen: 5 }, { gewicht: 90, wiederholungen: 5 },
      { gewicht: 90, wiederholungen: 5 }],
  };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5], { von: 85, bis: 90 });
  assert.equal(v.richtung, 'hoch');
  assert.equal(v.empfehlung, 95, 'ein Hantelschritt (5 kg) über die letzte Last');
});

test('Ohne Vorgabe verhält sich der Vorschlag wie bisher', () => {
  // Bei fehlendem Leistungsstand gibt es keine Lastvorgabe – dann kann auch
  // nichts widersprechen, und der Vorschlag bleibt der einzige Anhaltspunkt.
  const letzte = {
    datum: '2026-07-12', topGewicht: 105, gesamtWdh: 15, ohneFortschritt: 1,
    saetze: [{ gewicht: 105, wiederholungen: 5 }],
  };
  const v = L.naechsteLast('kniebeuge', letzte, [3, 5], null);
  assert.equal(v.richtung, 'hoch');
  assert.equal(v.empfehlung, 110);
});

test('Verworfene Sätze bekommen ihren Grund – aber nur, wenn er etwas erklärt', () => {
  /*
   * Falle 22 war für **Tests** gelöst: Wer „Kniebeuge 100 kg × 15" einträgt,
   * sieht seither nicht mehr denselben Strich wie jemand ohne Eintrag. Für
   * **protokollierte Sätze** stand die Lücke noch offen – und die ist die
   * größere: Der Aufbaublock schreibt 6–12 Wiederholungen vor, Epley trägt bis
   * 10. Über zwölf Wochen nach Plan fallen dadurch 98 von 276 Sätzen durch die
   * Schätzung, im Aufbaublock allein 98 von 98 – also jeder einzelne. Der
   * Kraftstand steht dann wochenlang still, während man brav protokolliert.
   */
  const daten = {
    profil: { gewichtKg: 80 },
    sessions: [
      { datum: '2026-01-05', typ: 'kraft', uebungen: [{ schluessel: 'kniebeuge',
        saetze: [{ gewicht: 100, wiederholungen: 5 }] }] },
      { datum: '2026-02-10', typ: 'kraft', uebungen: [{ schluessel: 'kniebeuge',
        saetze: [{ gewicht: 80, wiederholungen: 12 }] }] },
    ],
    tests: [],
  };

  const stand = L.leistungsstand(daten);
  const grund = stand.nichtSchaetzbareSaetze.kniebeuge;
  assert.ok(grund, 'Der jüngere 12er-Satz wird kommentarlos verworfen');
  assert.equal(grund.wiederholungen, 12);
  assert.equal(grund.datum, '2026-02-10');
  assert.equal(grund.grenze, EPLEY.maxWiederholungen);

  // Gegenrichtung: Liegt der verworfene Satz *vor* dem Stand, erklärt er
  // nichts – der Wert kommt dann aus einer jüngeren Quelle. Stünde der Satz
  // trotzdem da, hinge er dauerhaft unter jeder Übung (Falle 24).
  const umgekehrt = L.leistungsstand({
    ...daten,
    sessions: [
      { datum: '2026-01-05', typ: 'kraft', uebungen: [{ schluessel: 'kniebeuge',
        saetze: [{ gewicht: 80, wiederholungen: 12 }] }] },
      { datum: '2026-02-10', typ: 'kraft', uebungen: [{ schluessel: 'kniebeuge',
        saetze: [{ gewicht: 100, wiederholungen: 5 }] }] },
    ],
  });
  assert.equal(umgekehrt.nichtSchaetzbareSaetze.kniebeuge, undefined,
    'Ein Satz, der älter ist als der Stand, erklärt dessen Alter nicht');

  // Und ein brauchbarer Satz allein löst gar nichts aus.
  const sauber = L.leistungsstand({
    ...daten,
    sessions: [{ datum: '2026-01-05', typ: 'kraft', uebungen: [{ schluessel: 'kniebeuge',
      saetze: [{ gewicht: 100, wiederholungen: 5 }] }] }],
  });
  assert.deepEqual(sauber.nichtSchaetzbareSaetze, {});
});

test('Eine Last, die es nicht gibt, wird nicht zurückgenommen', () => {
  /*
   * Klimmzüge und Dips laufen am Körpergewicht, ohne Zusatzlast – der
   * Regelfall auf dem Muscle-Up-Weg und damit auf Nils' Hauptziel. Die
   * Progression rechnete trotzdem mit einer Zahl, und bei null ergab das in
   * allen drei Zweigen Unsinn:
   *
   *   „0 kg halten und die Wiederholungen bis 12 ausbauen"
   *   „Letztes Mal alle Sätze … Last auf 2,5 kg erhöhen"  (welche Last?)
   *   „4 Einheiten auf 0 kg ohne Fortschritt. Zurück auf 0 kg"
   *
   * Der letzte ist der schlimmste: Eine Rücknahme auf null ist keine
   * Handlung, und `empfehlung: 0` stand als Lastvorschlag in der Zeile.
   */
  const ohneLast = (wdh, ohneFortschritt) => ({
    datum: '2026-01-04',
    saetze: [{ gewicht: 0, wiederholungen: wdh }, { gewicht: 0, wiederholungen: wdh }],
    topGewicht: 0,
    gesamtWdh: 2 * wdh,
    ohneFortschritt,
  });

  const runter = L.naechsteLast('klimmzuege', ohneLast(8, 4), [6, 12], { von: 0, bis: 0 });
  assert.equal(runter.richtung, 'ohneZusatzlast');
  assert.equal(runter.empfehlung, null, 'Null Kilo ist kein Lastvorschlag');
  assert.doesNotMatch(runter.text, /0 kg/, 'Der Text nennt weiter eine Last von null');
  assert.match(runter.text, /leichtere Variante|Satz weniger/,
    'Ohne Zahl muss wenigstens der Hebel dastehen');

  const halten = L.naechsteLast('klimmzuege', ohneLast(8, 1), [6, 12], { von: 0, bis: 0 });
  assert.doesNotMatch(halten.text, /^0 kg halten/);
  assert.match(halten.text, /Körpergewicht/);

  const hoch = L.naechsteLast('klimmzuege', ohneLast(12, 1), [6, 12], { von: 0, bis: 0 });
  assert.equal(hoch.richtung, 'hoch');
  assert.match(hoch.text, /Zusatzlast/, 'Beim ersten Zusatzgewicht muss „Zusatzlast" dastehen');

  // Mit Zusatzlast bleibt alles beim Alten – die Rücknahme ist dort sinnvoll.
  const mitLast = {
    datum: '2026-01-04',
    saetze: [{ gewicht: 10, wiederholungen: 8 }],
    topGewicht: 10,
    gesamtWdh: 8,
    ohneFortschritt: 4,
  };
  assert.equal(L.naechsteLast('klimmzuege', mitLast, [6, 12], { von: 8, bis: 12 }).richtung, 'runter');
});

test('Der Kern schreibt Zahlen deutsch', () => {
  // „Zurück auf 87.5 kg" stand in einer sonst durchweg deutschen Oberfläche.
  // Die Oberfläche formatiert ihre eigenen Zahlen längst; die Sätze aus dem
  // Kern gingen unverändert durch. Gegenrichtung zu `zahlAusEingabe()`.
  const letzte = {
    datum: '2026-01-04',
    saetze: [{ gewicht: 97.5, wiederholungen: 4 }],
    topGewicht: 97.5,
    gesamtWdh: 4,
    ohneFortschritt: 3,
  };
  const text = L.naechsteLast('kniebeuge', letzte, [3, 5], { von: 95, bis: 105 }).text;
  assert.match(text, /97,5 kg/);
  assert.doesNotMatch(text, /\d\.\d/, `Dezimalpunkt im deutschen Text: ${text}`);
});

/*
 * Zwei der sechs Stellen, die `werkzeug/mutieren.mjs` in `leistung.js`
 * überleben ließ. Beide sind zeilengenau nachgemessen (Falle 64), beide
 * ändern etwas Sichtbares.
 */

test('Bei gleichem geschätzten Maximum bleibt das frühere Datum stehen', () => {
  /*
   * `wert > stand[schluessel].e1rm` – bei Gleichstand **nicht** ersetzen.
   * Mit `>=` wandert das Datum auf den späteren Test, obwohl sich nichts
   * verbessert hat. In der Kraft-Tabelle steht dieses Datum: Es beantwortet
   * „seit wann kannst du das", und die Antwort ist der Tag, an dem es zum
   * ersten Mal dastand.
   *
   * Der Rand ist nur mit einem echten Gleichstand zu treffen:
   * 120 kg × 6 und 123,4 kg × 5 ergeben beide 144,0 kg.
   */
  const daten = {
    profil: { gewichtKg: 78.3 },
    tests: [
      { art: 'kreuzheben', wert: 120, wiederholungen: 6, datum: '2026-07-02' },
      { art: 'kreuzheben', wert: 123.4, wiederholungen: 5, datum: '2026-08-03' },
    ],
    sessions: [],
  };
  const maxima = L.einerMaxima(daten, 78.3);
  assert.equal(maxima.kreuzheben.e1rm, 144, 'Beide Tests ergeben dasselbe Maximum');
  assert.equal(maxima.kreuzheben.datum, '2026-07-02',
    'Der erste Tag, an dem der Wert stand – nicht der letzte');
});

test('Ein Satz ohne Wiederholung ist kein Satz', () => {
  /*
   * `Number(s.wiederholungen) > 0` in `letzteLeistung()`. Über den Dialog
   * kann so ein Satz nicht entstehen – `uebungenPruefen()` wirft ihn beim
   * Speichern heraus. Aus einer eingespielten Sicherung kommt er durch, und
   * dann zählt er als Satz mit: Die doppelte Progression verlangt „alle Sätze
   * am oberen Ende", und ein Satz mit null Wiederholungen ist das nie. Der
   * Vorschlag bliebe stehen, obwohl die Einheit sauber gelaufen ist.
   */
  const letzte = L.letzteLeistung([
    { datum: '2026-08-09', uebungen: [{
      schluessel: 'kniebeuge',
      name: 'Kniebeuge',
      saetze: [
        { gewicht: 105, wiederholungen: 5 },
        { gewicht: 105, wiederholungen: 5 },
        { gewicht: 0, wiederholungen: 0 },
      ],
    }] },
  ]);
  assert.equal(letzte.kniebeuge.saetze.length, 2, 'Der leere Satz zählt nicht mit');
  assert.equal(letzte.kniebeuge.topGewicht, 105);
});
