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
import * as B from '../kern/belastung.js';
import * as PL from '../kern/plan.js';
import * as LE from '../kern/leistung.js';
import * as AK from '../kern/aktivitaet.js';
import { uebungsVerlauf } from '../kern/zustand.js';
import { createProfil } from '../kern/profil.js';

const profil = (ueberschreiben = {}) => ({ ...createProfil(), wiedereinstieg: false, ...ueberschreiben });
const gelb = { vollstaendig: true, ampel: 'gelb', prozent: 55 };
const rot = { vollstaendig: true, ampel: 'rot', prozent: 35 };
const satzSumme = (liste) => (liste || []).reduce((s, u) => s + u.saetze, 0);
const einheitVom = (typ, woche = 5) => PL.wochenplan(profil({ ausrichtung: 25 }), woche)
  .tage.flatMap((t) => t.einheiten).find((e) => e.typ === typ);
import {
  ERNAEHRUNG, AUSDAUER_VERTEILUNG, SPRINT_QUALITAET, EPLEY, BEREITSCHAFT, RUHEPULS,
  UEBUNGEN, VOLUMEN,
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

/* ------------------------------------------------ Bereitschaft und Ampel */

/**
 * Ein Morgen-Check mit einer gewünschten Bereitschaft in Prozent.
 *
 * Fünf Antworten zu je 1–5 ergeben 5 bis 25 Punkte, also 20 %-Schritte von
 * 20 % bis 100 %. Die Schwellen 45, 60 und 65 liegen dazwischen – deshalb
 * werden die Antworten hier so verteilt, dass der Prozentwert genau trifft.
 */
function checkMit(prozent, datum = '2026-08-01') {
  const summe = Math.round((prozent / 100) * 25);
  const werte = [1, 1, 1, 1, 1];
  let rest = summe - 5;
  for (let i = 0; rest > 0; i = (i + 1) % 5) {
    const zuschlag = Math.min(4, rest);
    werte[i] += zuschlag;
    rest -= zuschlag;
  }
  const [schlaf, muskelkater, stress, stimmung, energie] = werte;
  return {
    datum, schlaf, muskelkater, stress, stimmung, energie, ruhepuls: 52,
  };
}

test('Die Ampel der Bereitschaft schaltet an der nächsterreichbaren Stufe', () => {
  // Hinter dieser Ampel hängt zweierlei: die gekürzte oder gestrichene Einheit
  // des Tages und – seit Falle 26 – die Entlastungsempfehlung.
  //
  // Die Schwellen selbst (45 und 65 %) sind allerdings **gar nicht
  // erreichbar**: Fünf Antworten zu je 1–5 ergeben 5 bis 25 Punkte, also nur
  // Vielfache von 4 Prozent. Zwischen 44 und 48 liegt nichts. Deshalb prüft
  // dieser Test die nächsterreichbaren Stufen und nicht die Marke selbst –
  // alles andere wäre eine Behauptung über einen Zustand, den es nicht gibt.
  //
  // Dieselbe Beobachtung erklärt, warum `mutieren.mjs` hier `<` gegen `<=`
  // überleben lässt: Auf einem Raster ohne Punkt bei 45 sind beide Fassungen
  // ununterscheidbar. Das ist eine gleichwertige Verfälschung, keine Lücke.
  const ampelBei = (p) => B.bereitschaft(checkMit(p))?.ampel;
  const g = BEREITSCHAFT;
  const raster = 4;

  assert.ok(g.rotUnter % raster !== 0 && g.gelbUnter % raster !== 0,
    'die Schwellen liegen auf dem Raster – dann gehört dieser Test geschärft');

  assert.equal(ampelBei(Math.floor(g.rotUnter / raster) * raster), 'rot');
  assert.equal(ampelBei(Math.ceil(g.rotUnter / raster) * raster), 'gelb');
  assert.equal(ampelBei(Math.floor(g.gelbUnter / raster) * raster), 'gelb');
  assert.equal(ampelBei(Math.ceil(g.gelbUnter / raster) * raster), 'gruen');
});

test('Der Ruhepuls stuft genau an seinen Marken um', () => {
  // Die „deutliche" Abweichung ist ein Grund für eine vorgezogene Entlastung.
  const basis = 50;
  const trend = (abweichung) => {
    const checks = [];
    // Grundlinie: genug Messungen, alle auf dem Basiswert.
    for (let i = 0; i < RUHEPULS.grundlinieTage; i += 1) {
      const d = new Date('2026-08-01');
      d.setDate(d.getDate() - RUHEPULS.schnittTage - i);
      checks.push({ datum: d.toISOString().slice(0, 10), ruhepuls: basis });
    }
    // Die letzten Tage auf dem abweichenden Wert.
    for (let i = 0; i < RUHEPULS.schnittTage; i += 1) {
      const d = new Date('2026-08-01');
      d.setDate(d.getDate() - i);
      checks.push({ datum: d.toISOString().slice(0, 10), ruhepuls: basis + abweichung });
    }
    return B.ruhepulsTrend(checks, new Date('2026-08-01'));
  };

  assert.equal(trend(RUHEPULS.deutlichAb).stufe, 'deutlich',
    `genau ${RUHEPULS.deutlichAb} Schläge darüber gelten noch nicht als deutlich`);
  assert.equal(trend(RUHEPULS.deutlichAb - 1).stufe, 'erhoeht');
  assert.equal(trend(RUHEPULS.warnungAb).stufe, 'erhoeht',
    `genau ${RUHEPULS.warnungAb} Schläge darüber gelten noch als normal`);
  assert.equal(trend(RUHEPULS.warnungAb - 1).stufe, 'unauffällig');
  // Nach unten ausdrücklich keine Entwarnung – auch das ist eine Kante.
  assert.equal(trend(-RUHEPULS.warnungAb).stufe, 'niedriger');
});

test('Drei rote Morgen-Checks lösen die Entlastung aus, zwei nicht', () => {
  // Falle 26: Die Bereitschaft steuerte genau *einen* Grund bei, und da zwei
  // gefordert sind, war die Entlastung über das Befinden nie auslösbar. Seither
  // trägt „drei rote von fünf" allein – diese Zahl ist also die Kante, an der
  // eine Trainingswoche umgeplant wird.
  const bis = new Date('2026-08-10');
  const checks = (roteTage) => Array.from({ length: 5 }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    return checkMit(i < roteTage ? 20 : 90, d.toISOString().slice(0, 10));
  });

  const n = BEREITSCHAFT.roteChecksFuerEntlastung;
  assert.equal(B.entlastungFaellig([], checks(n), bis).faellig, true,
    `${n} rote Morgen-Checks lösen keine Entlastung aus`);
  assert.equal(B.entlastungFaellig([], checks(n - 1), bis).faellig, false,
    `${n - 1} rote Morgen-Checks lösen schon eine Entlastung aus`);

  // Bei zwei roten Checks steht auch kein Grund in der Liste: Rot zählt für
  // sich erst ab drei, und zwei schwache reichen ebenfalls nicht. Das ist kein
  // Verschweigen – es ist schlicht kein Anzeichen.
  assert.equal(B.entlastungFaellig([], checks(n - 1), bis).stufe, 'keine');

  // „Beobachten" gibt es dagegen sehr wohl, und zwar bei genau einem Grund –
  // hier drei Checks knapp unter der Schwäche-Marke, aber nicht rot. Ohne
  // diese Gegenprobe wäre die Stufe eine, die nie vorkommt (Falle 18).
  const schwachAberNichtRot = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    return checkMit(i < BEREITSCHAFT.schwacheChecksFuerGrund ? 48 : 90,
      d.toISOString().slice(0, 10));
  });
  const einGrund = B.entlastungFaellig([], schwachAberNichtRot, bis);
  assert.equal(einGrund.stufe, 'beobachten',
    `ein einzelner Grund ergibt „${einGrund.stufe}" statt „beobachten"`);
  assert.equal(einGrund.faellig, false);
});

/* ------------------------------------------------ Untergrenzen im Plan */

test('Keine Übung im Plan bekommt weniger als zwei Sätze', () => {
  // `Math.max(2, saetze - 1)` steht an Hüftzug und Hip Thrust: Der Planer
  // nimmt dort einen Satz weg, aber nie unter zwei. Ein einzelner Satz ist
  // kein Reiz mehr, sondern eine Zeile im Protokoll – und in der
  // Entlastungswoche, wo `saetze` selbst schon auf 2 steht, wäre genau das
  // herausgekommen.
  for (const tage of [3, 4, 5, 6]) {
    for (let woche = 1; woche <= 12; woche += 1) {
      const plan = PL.wochenplan(profil({ trainingstageProWoche: tage }), woche);
      for (const einheit of plan.tage.flatMap((t) => t.einheiten)) {
        for (const u of einheit.uebungen || []) {
          assert.ok(u.saetze >= 2,
            `Woche ${woche}, ${tage} Tage: ${u.name} mit ${u.saetze} Satz`);
        }
      }
    }
  }
});

test('Die Kürzung an schlechten Tagen halbiert höchstens', () => {
  // Der Faktor ist 0,67 bzw. 0,5 – und `Math.max(1, …)` verhindert, dass eine
  // Übung ganz verschwindet. Der vorhandene Test prüfte nur „mindestens ein
  // Satz bleibt"; damit überlebte eine Fassung, die *jede* Übung auf einen Satz
  // zusammenstreicht. Das ist keine Kürzung mehr, das ist eine andere Einheit.
  for (const stand of [gelb, rot]) {
    const original = einheitVom('kraft', 3); // Spitzenwoche, drei Sätze je Übung
    const angepasst = PL.angepassteEinheit(original, stand);
    const vorher = satzSumme(original.uebungen);
    const nachher = satzSumme(angepasst.uebungen);
    assert.ok(nachher >= vorher * 0.5,
      `${stand.ampel}: von ${vorher} auf ${nachher} Sätze – mehr als halbiert`);
  }
});

test('Die Satzaufteilung im Sprint bündelt, statt Einzelläufe zu zählen', () => {
  // `Math.max(1, Math.round(proSatz))` ist die Satzgröße. Fällt sie auf 1,
  // stimmt die Summe weiterhin – die Überschrift sagt dann aber „12 Sätze à 1"
  // statt „3 Sätze à 4", und die sechs Minuten Satzpause stehen zwölfmal im
  // Plan statt dreimal. Die Summe allein ist also kein hinreichender Test.
  for (const [laeufe, proSatz] of [[12, 5], [13, 4], [8, 5], [4, 5]]) {
    const verteilung = PL.satzAufteilung(laeufe, proSatz);
    assert.equal(verteilung.reduce((a, b) => a + b, 0), laeufe, 'Summe stimmt nicht');
    assert.equal(verteilung.length, Math.ceil(laeufe / proSatz),
      `${laeufe} Läufe à ${proSatz} ergeben ${verteilung.length} Sätze`);
    for (const n of verteilung) {
      assert.ok(n <= proSatz, `ein Satz mit ${n} Läufen bei Satzgröße ${proSatz}`);
    }
  }
});

/* ------------------------------------ Umfangsschranken der Ausdauer */

/** Einheiten mit fester Minutenaufteilung auf locker / grauzone / hart. */
function verteilungAus({ locker = 0, grau = 0, hart = 0, tage = 28, bis = '2026-08-01' }) {
  const einheiten = [];
  const anlegen = (minuten, rpe, typ, versatz) => {
    if (minuten <= 0) return;
    const d = new Date(bis);
    d.setDate(d.getDate() - versatz);
    einheiten.push({ datum: d.toISOString().slice(0, 10), typ, minuten, rpe });
  };
  anlegen(locker, 3, 'ausdauerLocker', 2);
  anlegen(grau, 5, 'ausdauerLocker', 4);
  anlegen(hart, 8, 'ausdauerIntervalle', 6);
  return A.verteilung(einheiten, new Date(bis), tage);
}

test('Das Verhältnis wird erst ab dem Umfang benotet, ab dem es eine Aussage ist', () => {
  // Falle 17: Bei zwei bis vier Ausdauereinheiten entscheidet die Stückelung
  // und nicht das Training – eine Intervalleinheit ist dann zwangsläufig ein
  // Drittel der Zeit. Genau deshalb gibt es diese Schranke; ob sie sitzt,
  // prüfte nichts.
  const g = AUSDAUER_VERTEILUNG;
  const wochen = 4;
  const minutenFuer = (proWoche) => Math.round(proWoche * wochen);

  const genau = verteilungAus({
    locker: minutenFuer(g.minMinutenProWocheFuerVerhaeltnis) - 200, hart: 200,
  });
  const darunter = verteilungAus({
    locker: minutenFuer(g.minMinutenProWocheFuerVerhaeltnis - 1) - 200, hart: 200,
  });

  assert.equal(genau.verhaeltnisBewertet, true,
    `genau ${g.minMinutenProWocheFuerVerhaeltnis} min pro Woche werden noch nicht benotet`);
  assert.equal(darunter.verhaeltnisBewertet, false,
    'eine Minute darunter wird schon benotet');
});

test('„Zu viel hart" beginnt genau an seiner Marke', () => {
  // Falle 6: Die Verteilung braucht Grenzen in *beide* Richtungen. „42 %
  // locker, 58 % hart" galt einmal als vorbildlich – das Verhältnis auf dem
  // Kopf. Die untere Grenze war danach geprüft, die obere nie.
  const g = AUSDAUER_VERTEILUNG;
  const gesamt = 2000; // 500 min pro Woche – über der Benotungsschranke
  const beiHart = (anteil) => verteilungAus({
    hart: Math.round(gesamt * anteil),
    locker: gesamt - Math.round(gesamt * anteil),
  });

  assert.equal(beiHart(g.hartZuViel).stufe, 'warnung',
    `genau ${Math.round(g.hartZuViel * 100)} % hart gelten noch als in Ordnung`);
  assert.equal(beiHart(g.hartZuViel - 0.01).stufe, 'gut',
    'einen Prozentpunkt darunter wird schon gewarnt');
});

test('Eine Einheit vom Stichtag zählt noch mit, eine vom Folgetag nicht', () => {
  // `datum < grenze || datum > bis` steht an zwei Stellen. Verrutscht die
  // obere Kante, urteilt in der Rückschau die Zukunft über die Vergangenheit –
  // derselbe Fehler, der in Falle 18 die Morgen-Checks betraf.
  const bis = '2026-08-01';
  const einheit = (datum) => ({ datum, typ: 'ausdauerLocker', minuten: 120, rpe: 3 });

  const amStichtag = A.verteilung([einheit(bis)], new Date(bis), 28);
  assert.equal(amStichtag.bewertbar, true, 'die Einheit vom Stichtag fällt heraus');

  const amFolgetag = A.verteilung([einheit('2026-08-02')], new Date(bis), 28);
  assert.equal(amFolgetag.bewertbar, false, 'eine Einheit von morgen wird mitgezählt');
});

/* ------------------------------------------- Progression und Lastvorgabe */

/** Eine protokollierte Krafteinheit mit frei wählbaren Sätzen. */
function krafteinheit(datum, schluessel, saetze) {
  return {
    datum, typ: 'kraft', minuten: 60, rpe: 8,
    uebungen: [{ schluessel, saetze }],
  };
}

test('Die Progression rechnet mit dem schwersten Satz, nicht mit dem leichtesten', () => {
  // `topGewicht` ist die Zahl, aus der die nächste Lastvorgabe entsteht. Mit
  // `Math.min` stünde dort der Aufwärmsatz – und der Vorschlag führte die Last
  // Woche für Woche nach unten, ohne dass irgendetwas warnt.
  const stand = LE.letzteLeistung([krafteinheit('2026-08-01', 'kniebeuge', [
    { gewicht: 60, wiederholungen: 5 },
    { gewicht: 100, wiederholungen: 5 },
    { gewicht: 80, wiederholungen: 5 },
  ])]);
  assert.equal(stand.kniebeuge.topGewicht, 100,
    'die Progression nimmt nicht den schwersten Satz der Einheit');
});

test('Erhöht wird erst, wenn wirklich alle Sätze oben stehen', () => {
  // Doppelte Progression: Die Last steigt erst, wenn jeder Satz das obere Ende
  // des Wiederholungsbereichs erreicht. Ein Satz darunter genügt, um zu halten
  // – sonst klettert die Last an der Wiederholungsarbeit vorbei nach oben.
  const bereich = [3, 5];
  const mitWdh = (wdhListe) => LE.naechsteLast('kniebeuge',
    LE.letzteLeistung([krafteinheit('2026-08-01', 'kniebeuge',
      wdhListe.map((w) => ({ gewicht: 100, wiederholungen: w })))]).kniebeuge,
    bereich);

  assert.equal(mitWdh([5, 5, 5]).richtung, 'hoch',
    'alle Sätze am oberen Ende und die Last steigt trotzdem nicht');
  assert.equal(mitWdh([5, 5, 4]).richtung, 'halten',
    'ein Satz unter dem oberen Ende und die Last steigt schon');
  // Und über dem Bereich zählt weiterhin als „oben" – wer sechs schafft, hat
  // die fünf erst recht.
  assert.equal(mitWdh([6, 5, 5]).richtung, 'hoch');
});

test('Ein Blockwechsel wird an genau einem Hantelschritt Spielraum erkannt', () => {
  // Falle 23: Der Vorschlag aus dem Protokoll schlägt die Prozentrechnung –
  // wer ihn liest, nimmt ihn *statt* der Vorgabe. Stammt die letzte Einheit
  // aus einem anderen Block, wäre das eine Maximalkrafteinheit statt
  // Schnellkraft. Der Spielraum ist genau ein Hantelschritt: Innerhalb eines
  // Blocks landet die Steigerung auf dem oberen Ende oder einen Schritt
  // darüber, erst danach zieht das Einer-Maximum nach.
  const schritt = UEBUNGEN.kniebeuge.schritt;
  const vorgabe = { von: 50, bis: 105 };
  const beiLast = (kg) => LE.naechsteLast('kniebeuge',
    LE.letzteLeistung([krafteinheit('2026-08-01', 'kniebeuge',
      [{ gewicht: kg, wiederholungen: 4 }])]).kniebeuge,
    [3, 5], vorgabe).richtung;

  assert.notEqual(beiLast(vorgabe.bis + schritt), 'neuerBlock',
    'ein Hantelschritt über der Vorgabe gilt schon als anderer Block');
  assert.equal(beiLast(vorgabe.bis + schritt + 0.5), 'neuerBlock',
    'weiter darüber wird der Blockwechsel nicht erkannt');
  assert.notEqual(beiLast(vorgabe.von - schritt), 'neuerBlock');
  assert.equal(beiLast(vorgabe.von - schritt - 0.5), 'neuerBlock');
});

test('Die Volumenbewertung schlägt genau an der Mindestmarke um', () => {
  // Hinter der Marke steht die Aussage „im Bereich, ab dem die Dosis-Wirkung
  // deutlich wird" gegen „für Aufbau die untere Kante". Das ist der Satz, an
  // dem sich jemand entscheidet, mehr zu tun.
  const stufeBei = (saetze) => LE.volumenBewertung({ brust: saetze }).brust.stufe;
  assert.equal(stufeBei(VOLUMEN.minimum), 'gut',
    `genau ${VOLUMEN.minimum} Sätze gelten noch als zu wenig`);
  assert.equal(stufeBei(VOLUMEN.minimum - 1), 'wenig');
  assert.equal(stufeBei(VOLUMEN.viel), 'viel',
    `genau ${VOLUMEN.viel} Sätze gelten noch nicht als viel`);
  assert.equal(stufeBei(VOLUMEN.viel - 1), 'gut');
});

test('Die Epley-Grenze gilt auch beim Einer-Maximum aus Tests', () => {
  // Dieselbe Grenze steht an drei Stellen im Kern. Geprüft war bisher nur die
  // im Kraftverlauf – und ein Test über der Grenze wird nicht geschätzt,
  // sondern ausdrücklich als „nicht schätzbar" ausgewiesen (Falle 22).
  const daten = (wdh) => ({
    profil: { gewichtKg: 78 },
    tests: [{ art: 'kniebeuge', wert: 100, wiederholungen: wdh, datum: '2026-08-01' }],
    sessions: [],
  });
  assert.ok(LE.leistungsstand(daten(EPLEY.maxWiederholungen)).maxima.kniebeuge,
    `genau ${EPLEY.maxWiederholungen} Wiederholungen werden nicht mehr geschätzt`);
  assert.equal(LE.leistungsstand(daten(EPLEY.maxWiederholungen + 1)).maxima.kniebeuge, undefined,
    `${EPLEY.maxWiederholungen + 1} Wiederholungen werden noch geschätzt`);
  assert.ok(LE.leistungsstand(daten(EPLEY.maxWiederholungen + 1)).nichtSchaetzbar.kniebeuge,
    'der verworfene Test wird nicht genannt');
});

/* ---------------------------------------- Plausibilität importierter Dateien */

/**
 * Eine GPX-Spur mit vorgegebener Dauer und ungefährer Länge.
 *
 * Ein Grad Breite sind rund 111,32 km – daraus lässt sich eine gerade Strecke
 * bekannter Länge bauen, ohne die Glättung austricksen zu müssen.
 */
function gpxSpur({ meter, minuten, punkte = 60, datum = '2026-08-01' }) {
  const gradProMeter = 1 / 111320;
  const zeilen = Array.from({ length: punkte }, (_, i) => {
    const lat = 52 + (meter * (i / (punkte - 1))) * gradProMeter;
    const t = new Date(`${datum}T08:00:00Z`);
    t.setSeconds(t.getSeconds() + Math.round((minuten * 60 * i) / (punkte - 1)));
    return `<trkpt lat="${lat.toFixed(7)}" lon="13.0"><time>${t.toISOString()}</time></trkpt>`;
  });
  return `<?xml version="1.0"?><gpx><trk><name>Rad</name><trkseg>${zeilen.join('')}</trkseg></trk></gpx>`;
}

test('Unplausible Dateien werden abgelehnt statt stillschweigend übernommen', () => {
  // „Geprüft wird auf Plausibilität, nicht auf Vollständigkeit: Eine Datei
  // ohne Puls ist in Ordnung, eine mit 900 km Strecke nicht." Genau diese
  // Grenzen waren ungeprüft – und eine übernommene Unsinnsstrecke verdirbt
  // Wochenkilometer, Tempoverlauf und Kalorienbedarf auf einmal.
  // `ausGpx` liefert eine **Liste** – eine Datei kann mehrere Spuren enthalten.
  const einheiten = (o) => AK.ausGpx(gpxSpur(o));

  const gut = einheiten({ meter: 20000, minuten: 60 });
  assert.equal(gut.length, 1, 'eine gewöhnliche Ausfahrt wird abgelehnt');
  assert.ok(Math.abs(gut[0].meter - 20000) < 400,
    `Strecke ${gut[0].meter} m statt rund 20.000`);

  // Über einem Tag Dauer: keine Einheit mehr, sondern eine liegengebliebene Uhr.
  assert.equal(einheiten({ meter: 20000, minuten: 1441 }).length, 0,
    'eine Spur über 24 Stunden wird übernommen');
  assert.equal(einheiten({ meter: 20000, minuten: 1440 }).length, 1,
    'genau 24 Stunden werden abgelehnt');

  // Unter einer Minute: ein Klick, kein Training.
  assert.equal(einheiten({ meter: 500, minuten: 0 }).length, 0);

  // Über 300 km: kein Gerät und kein Mensch, sondern ein Koordinatenfehler.
  // Gemessen wird nach der Glättung, deshalb mit deutlichem Abstand geprüft.
  assert.equal(einheiten({ meter: 400000, minuten: 600 }).length, 0,
    'eine Spur über 300 km wird übernommen');
});

test('Ein Punkt mit unlesbarer Koordinate fällt heraus, nicht die halbe Spur', () => {
  // `Number.isFinite(lat) && Number.isFinite(lon)` – mit `||` überlebt ein
  // Punkt, dem eine der beiden Koordinaten fehlt. `abstand()` rechnet dann mit
  // NaN, und die Gesamtstrecke ist es auch: aus einer 20-km-Ausfahrt wird eine
  // Einheit, die gar nicht erst entsteht.
  const spur = gpxSpur({ meter: 20000, minuten: 60 });
  const kaputt = spur.replace('lon="13.0"', 'lon="keine"');

  const liste = AK.ausGpx(kaputt);
  assert.equal(liste.length, 1, 'ein einziger unlesbarer Punkt verwirft die ganze Spur');
  assert.ok(Number.isFinite(liste[0].meter) && liste[0].meter > 0,
    `Strecke ist ${liste[0].meter} – der unlesbare Punkt ist mitgerechnet worden`);
});
