// Die Ränder, nicht die Beispiele.
//
// Falle 32 heißt „Ränder prüfen, nicht Beispiele", und die Fallenliste dieses
// Projekts gibt ihr recht: Nr. 6 (Grauzone ohne obere Grenze), 10 (gedeckelter
// Balken), 17 (unbestehbarer Maßstab), 18 (unauslösbare Monotonie), 19 (nie zu
// nehmende Schranke), 24 (unerreichbare Zielmarke), 25 (Rückstand vor der
// Bestzeit), 31 (zu kleiner Test) – acht von dreiundvierzig Fallen sitzen
// genau auf einer Schwelle.
//
// Gemessen wurde das erst mit `werkzeug/mutieren.mjs`: Von 222 verfälschten
// Vergleichen im Kern blieben **124 unbemerkt**. Fast alle davon waren
// Grenzen – die vorhandenen Tests prüfen die Mitte eines Bereichs, nicht seine
// Kante. Diese Datei schließt die Lücke dort, wo hinter der Schwelle eine
// *Empfehlung* steht: ein farbiges Urteil, eine Warnung, eine Vorgabe.
//
// Der Aufbau ist überall derselbe: genau auf der Schwelle, einen Schritt
// darunter, einen darüber. Ein Test, der nur „deutlich darunter" und „deutlich
// darüber" prüft, überlebt jede Verschiebung um eins.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../kern/ernaehrung.js';
import * as A from '../kern/ausdauer.js';
import * as S from '../kern/sprint.js';
import * as AE from '../kern/aendern.js';
import { uebungsVerlauf } from '../kern/zustand.js';
import { createProfil } from '../kern/profil.js';
import {
  ERNAEHRUNG, AUSDAUER_VERTEILUNG, SPRINT_QUALITAET, EPLEY,
} from '../kern/wissen.js';

/* ------------------------------------------- Energieverfügbarkeit (RED-S) */

// `alltagsaktivitaet: 'hoch'` ist kein Zufall: Damit liegt der eigene
// Erhaltungsbedarf über der Zielmarke, und die Stufe `erhaltung` aus Falle 24
// greift nicht in die Ränder hinein, um die es hier geht. Beim ersten Versuch
// stand ohne das „erhaltung" statt „knapp" – ein Fehler im Aufbau, nicht im
// Produkt (Falle 34).
const evProfil = {
  ...createProfil(),
  gewichtKg: 78, groesseCm: 183, geburtsjahr: 1996, koerperfettProzent: 12,
  alltagsaktivitaet: 'hoch',
};

test('Die Grenzen der Energieverfügbarkeit liegen genau dort, wo sie stehen', () => {
  const g = ERNAEHRUNG.energieverfuegbarkeit;
  // Die fettfreie Masse aus dem Profil, damit die Aufnahme exakt trifft.
  const probe = E.energieverfuegbarkeit(evProfil, 3000, 0);
  assert.equal(probe.berechenbar, true);
  const ffm = probe.ffm;

  const stufeBei = (ev) => E.energieverfuegbarkeit(evProfil, ev * ffm, 0).stufe;

  // `kritisch` ist die Marke, an der der Tracker am deutlichsten wird
  // („Mehr essen, nicht mehr trainieren"). Falle 24 besteht darauf, dass sie
  // absolut gilt – dann muss auch ihre Kante sitzen.
  assert.equal(stufeBei(g.kritisch - 0.1), 'kritisch', 'knapp darunter nicht kritisch');
  assert.notEqual(stufeBei(g.kritisch), 'kritisch',
    `genau ${g.kritisch} kcal/kg FFM gilt noch als kritisch – die Grenze ist „unter", nicht „bis"`);

  // `ziel` nach oben: genau auf der Marke ist es „gut", einen Schritt darunter
  // nicht mehr.
  assert.equal(stufeBei(g.ziel), 'gut');
  assert.notEqual(stufeBei(g.ziel - 0.1), 'gut',
    `${g.ziel - 0.1} gilt schon als „gut" – die Zielmarke ist nicht scharf`);

  // Dazwischen: unter `knapp` heißt „knapp", ab `knapp` nur noch „okay".
  assert.equal(stufeBei(g.knapp - 0.1), 'knapp');
  assert.equal(stufeBei(g.knapp), 'okay',
    `genau ${g.knapp} kcal/kg FFM wird noch als „knapp" gemeldet`);
});

test('Der Spielraum zum Erhaltungsbedarf gilt genau eine Einheit weit', () => {
  // Falle 24: Wer seinen Erhaltungsbedarf deckt, bekommt die Stufe
  // `erhaltung` statt einer Mangelmeldung. Der Spielraum dafür ist bewusst
  // klein – wenn er nicht sitzt, ist er entweder wirkungslos oder er
  // verschluckt eine echte Unterdeckung.
  const g = ERNAEHRUNG.energieverfuegbarkeit;
  // Mittlere Alltagsaktivität: Dann liegt der Erhaltungsbedarf zwischen der
  // kritischen Marke und der Zielmarke – genau der Bereich, in dem die Stufe
  // `erhaltung` überhaupt etwas entscheidet.
  const profil = { ...evProfil, alltagsaktivitaet: 'mittel' };
  const probe = E.energieverfuegbarkeit(profil, 3000, 0);
  const ffm = probe.ffm;
  const referenz = probe.erhaltung;
  assert.ok(referenz != null && referenz > g.kritisch,
    'Testaufbau: der Erhaltungsbedarf muss über der kritischen Marke liegen');

  const stufeBei = (ev) => E.energieverfuegbarkeit(profil, ev * ffm, 0).stufe;

  assert.equal(stufeBei(referenz - g.protokollrauschen), 'erhaltung',
    'genau am Rand des Spielraums greift die Erhaltungsstufe nicht');
  assert.notEqual(stufeBei(referenz - g.protokollrauschen - 0.2), 'erhaltung',
    'der Spielraum reicht weiter als die eine Einheit, die dafür vorgesehen ist');
});

/* --------------------------------------------- Intensitätsverteilung */

test('Die Grauzonen-Warnung beginnt genau an ihrer Marke', () => {
  // Falle 6: Die Verteilung braucht Grenzen in beide Richtungen. Geprüft war
  // bisher, *dass* gewarnt wird – nicht, ab wann.
  const g = AUSDAUER_VERTEILUNG;
  const bis = new Date('2026-08-01');

  /**
   * Einheiten so bauen, dass die Grauzone genau `anteil` der Minuten ausmacht.
   *
   * Der harte Block muss sein: Ohne ihn greift die Stufe davor („fast alles
   * locker, ohne harte Anteile fehlt der Reiz") und die Grauzonenschwelle kommt
   * gar nicht zum Zug. Beim ersten Versuch stand deshalb „warnung", wo „gut"
   * erwartet war – und die Ursache lag im Aufbau, nicht im Produkt.
   */
  const GESAMT = 400;
  const HART = 40; // 10 % – über der Marke, ab der „zu wenig hart" entfällt
  const mitGrauzone = (grauMinuten) => [
    { datum: '2026-07-12', typ: 'ausdauerLocker', minuten: grauMinuten, rpe: 5 },
    { datum: '2026-07-14', typ: 'ausdauerIntervalle', minuten: HART, rpe: 8 },
    { datum: '2026-07-16', typ: 'ausdauerLocker', minuten: GESAMT - HART - grauMinuten, rpe: 3 },
  ];

  const stufeBei = (anteil) => A.verteilung(mitGrauzone(Math.round(GESAMT * anteil)), bis, 28).stufe;

  assert.equal(stufeBei(g.grauzoneWarnung), 'warnung',
    `genau ${Math.round(g.grauzoneWarnung * 100)} % Grauzone lösen keine Warnung aus`);
  assert.equal(stufeBei(g.grauzoneWarnung - 0.0025), 'gut',
    'einen Schritt unter der Marke wird schon gewarnt');
  assert.equal(stufeBei(g.grauzoneKritisch), 'kritisch',
    `genau ${Math.round(g.grauzoneKritisch * 100)} % Grauzone gelten noch nicht als kritisch`);
});

/* ------------------------------------------------------- Sprintqualität */

test('Die Mindestzahl an Läufen für eine Bewertung sitzt auf der Marke', () => {
  // Falle 25 hängt an dieser Schwelle: Darunter wird nicht bewertet, weil der
  // erste Lauf erfahrungsgemäß noch nicht der schnellste ist.
  const n = SPRINT_QUALITAET.minLaeufeFuerBewertung;
  const lauf = (sekunden) => ({ art: 'beschleunigung', distanz: 30, sekunden });
  const serie = (anzahl) => Array.from({ length: anzahl }, (_, i) => lauf(4.0 + i * 0.01));

  assert.equal(S.auswertung(serie(n)).bewertbar, true,
    `genau ${n} Läufe werden noch nicht bewertet`);
  assert.equal(S.auswertung(serie(n - 1)).bewertbar, false,
    `${n - 1} Läufe werden schon bewertet`);
});

/* ------------------------------------------------- Kraftverlauf je Einheit */

test('Der Kraftverlauf nimmt den besten Satz einer Einheit, nicht den schlechtesten', () => {
  // `Math.max(...werte)` gegen `Math.min(...werte)` blieb unbemerkt – die
  // Kurve hätte systematisch den schwächsten Satz gezeigt und damit jeden
  // Fortschritt kleiner aussehen lassen, als er war.
  const sessions = [{
    datum: '2026-08-01', typ: 'kraft', minuten: 60, rpe: 8,
    uebungen: [{
      schluessel: 'kniebeuge',
      saetze: [
        { gewicht: 100, wiederholungen: 5 },
        { gewicht: 120, wiederholungen: 5 },
        { gewicht: 90, wiederholungen: 5 },
      ],
    }],
  }];
  const verlauf = uebungsVerlauf(sessions);
  const punkte = verlauf.kniebeuge;
  assert.equal(punkte.length, 1);

  const ausSchwerstem = uebungsVerlauf([{
    ...sessions[0],
    uebungen: [{ schluessel: 'kniebeuge', saetze: [{ gewicht: 120, wiederholungen: 5 }] }],
  }]).kniebeuge[0].e1rm;

  assert.equal(punkte[0].e1rm, ausSchwerstem,
    'der Punkt stammt nicht aus dem schwersten Satz der Einheit');
});

test('Die Epley-Grenze schließt ihren eigenen Randwert ein', () => {
  // Offener Punkt der Trainingslehre: Der Aufbaublock schreibt bis zu zwölf
  // Wiederholungen vor, Epley trägt bis zehn. Wo genau die Grenze liegt, darf
  // dabei nicht verrutschen – sonst fällt zusätzlich der Satz heraus, der
  // gerade noch schätzbar wäre.
  const mitWdh = (wdh) => uebungsVerlauf([{
    datum: '2026-08-01', typ: 'kraft', minuten: 60, rpe: 8,
    uebungen: [{ schluessel: 'kniebeuge', saetze: [{ gewicht: 100, wiederholungen: wdh }] }],
  }]).kniebeuge;

  assert.equal(mitWdh(EPLEY.maxWiederholungen)?.length, 1,
    `genau ${EPLEY.maxWiederholungen} Wiederholungen fallen heraus`);
  assert.equal(mitWdh(EPLEY.maxWiederholungen + 1), undefined,
    `${EPLEY.maxWiederholungen + 1} Wiederholungen werden noch geschätzt`);
});

/* ------------------------------------------------------- Gewicht und Profil */

test('Eine Wiegung von heute zieht das Profilgewicht mit, eine ältere nicht', () => {
  // Geprüft hat das bisher nur `werkzeug/dialoge.mjs` im Browser – kein
  // einziger Test im Kern. Die Regel dahinter stammt aus Falle 14: Profil und
  // Verlauf müssen denselben geprüften Wert bekommen.
  const heute = new Date().toISOString().slice(0, 10);
  const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const mitHeute = { profil: { ...createProfil(), gewichtKg: 80 }, gewicht: [], sessions: [] };
  AE.gewichtSpeichern(mitHeute, { datum: heute, kg: '77,4' });
  assert.equal(mitHeute.profil.gewichtKg, 77.4, 'die Wiegung von heute zieht nicht mit');

  const mitAelterer = { profil: { ...createProfil(), gewichtKg: 80 }, gewicht: [], sessions: [] };
  AE.gewichtSpeichern(mitAelterer, { datum: gestern, kg: '70' });
  assert.equal(mitAelterer.profil.gewichtKg, 80,
    'eine nachgetragene ältere Wiegung überschreibt das Profilgewicht');
});
