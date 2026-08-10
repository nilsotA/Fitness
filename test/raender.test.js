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
  UEBUNGEN, VOLUMEN, BELASTUNG, KRAFT, HERZFREQUENZ, SPRINT,
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

/* -------------------------------------- Schranken der Belastungssteuerung */

/** Einheiten mit fester Tageslast, rückwärts ab `bis`. */
function lastTage(lasten, bis = '2026-08-10') {
  return lasten.map((last, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    // Last = RPE × Minuten. RPE 5 fest, damit die Minuten die Last tragen.
    return { datum: d.toISOString().slice(0, 10), typ: 'kraft', minuten: last / 5, rpe: 5 };
  }).filter((s) => s.minuten > 0);
}

test('Das Akut-zu-chronisch-Verhältnis braucht jede der vier Wochen', () => {
  // Falle 19: Vorher wurde die Trainings*häufigkeit* gezählt („unter zehn Tage
  // in 28"), gemeint war der Verlauf. Wer nach Plan an zwei Tagen der Woche
  // trainiert, kam nie auf zehn – die Schranke war nie zu nehmen, unter einem
  // Hinweis, der Besserung durch Warten versprach.
  const bis = new Date('2026-08-10');
  const proWoche = (wochen) => {
    const sessions = [];
    for (const w of wochen) {
      if (!w) continue;
      const d = new Date(bis);
      d.setDate(d.getDate() - (w - 1) * 7 - 1);
      sessions.push({ datum: d.toISOString().slice(0, 10), typ: 'kraft', minuten: 60, rpe: 7 });
    }
    return B.acwr(sessions, bis);
  };

  assert.equal(proWoche([1, 2, 3, 4]).belastbar, true,
    'vier Wochen mit je einem Eintrag reichen nicht');
  const luecke = proWoche([1, 2, 4]);
  assert.equal(luecke.belastbar, false, 'eine leere Woche in der Mitte fällt nicht auf');
  // Und der Hinweis sagt, *welche* Woche fehlt – nicht „warte noch ein bisschen".
  assert.equal(luecke.wochenGesamt, 4);
  assert.equal(luecke.wochenMitDaten, 3);
});

test('Die Monotonie wird erst ab genug Trainingstagen benotet', () => {
  // Falle 18: Fosters Quotient läuft über sieben Tage einschließlich der
  // Ruhetage – und die liefern die Streuung. Bei vier Trainingstagen liegt das
  // Maximum bei 1,15 gegen eine Schwelle von 2,0; die Prüfung konnte niemand
  // durchfallen. Unter der Mindestzahl wird der Wert deshalb gezeigt, aber
  // nicht benotet.
  const n = BELASTUNG.monotonie.minTrainingstageFuerNote;
  const mitTagen = (tage) => B.monotonie(
    lastTage(Array.from({ length: 7 }, (_, i) => (i < tage ? 300 + i * 5 : 0))),
    new Date('2026-08-10'),
  );

  assert.equal(mitTagen(n).bewertbar, true,
    `genau ${n} Trainingstage werden noch nicht benotet`);
  assert.equal(mitTagen(n - 1).bewertbar, false,
    `${n - 1} Trainingstage werden schon benotet`);
  // Der Wert steht trotzdem da – „nicht benotet" heißt nicht „nicht gemessen".
  assert.ok(mitTagen(n - 1).wert > 0, 'unter der Schranke fehlt der Wert ganz');
  // Und die Begründung nennt das bei dieser Häufigkeit erreichbare Maximum,
  // sonst liest sich „nicht benotet" wie eine fehlende Messung.
  assert.match(mitTagen(n - 1).text, /höchstens \d+,\d+ erreichen/,
    'die Begründung nennt das erreichbare Maximum nicht');
});

test('Zwei Gründe lösen die Entlastung aus, einer nicht', () => {
  // Das Zwei-Gründe-Prinzip stammt vom Ruhepuls: Ein Infekt erzeugt dasselbe
  // Bild, also trägt er allein keine Entscheidung. Geprüft war bisher der
  // Sonderweg über drei rote Checks – nicht die Regel selbst.
  const bis = new Date('2026-08-10');

  // Grund 1: Ruhepuls deutlich über der Grundlinie.
  const pulsChecks = [];
  for (let i = 0; i < RUHEPULS.grundlinieTage + RUHEPULS.schnittTage; i += 1) {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    pulsChecks.push({
      datum: d.toISOString().slice(0, 10),
      ruhepuls: 50 + (i < RUHEPULS.schnittTage ? RUHEPULS.deutlichAb : 0),
    });
  }

  const nurPuls = B.entlastungFaellig([], pulsChecks, bis);
  assert.equal(nurPuls.stufe, 'beobachten',
    `ein einzelner Grund ergibt „${nurPuls.stufe}" statt „beobachten"`);
  assert.equal(nurPuls.faellig, false, 'der Ruhepuls allein löst eine Entlastung aus');

  // Grund 2 dazu: drei der letzten Checks unter der Schwäche-Marke – aber
  // nicht rot, sonst greift der Sonderweg und nicht die Zwei-Gründe-Regel.
  const mitZweitem = pulsChecks.map((c, i) => (i < BEREITSCHAFT.schwacheChecksFuerGrund
    ? { ...c, ...checkMit(48, c.datum), ruhepuls: c.ruhepuls }
    : c));
  const zwei = B.entlastungFaellig([], mitZweitem, bis);
  assert.equal(zwei.gruende.length >= 2, true,
    `nur ${zwei.gruende.length} Grund erkannt: ${zwei.gruende.join(' | ')}`);
  assert.equal(zwei.faellig, true, 'zwei Gründe lösen keine Entlastung aus');
});

test('Ein Check auf der Schwäche-Marke zählt noch nicht als schwach', () => {
  // Anders als bei der Ampel liegt diese Marke *auf* dem erreichbaren Raster
  // (60 % sind fünf Antworten mit zusammen 15 Punkten). Hier ist „unter" gegen
  // „bis" also sehr wohl unterscheidbar – und hinter der Zahl steht ein Grund
  // für eine vorgezogene Entlastungswoche.
  const bis = new Date('2026-08-10');
  const dreiMit = (prozent) => Array.from({ length: 5 }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    return checkMit(i < BEREITSCHAFT.schwacheChecksFuerGrund ? prozent : 92,
      d.toISOString().slice(0, 10));
  });

  assert.equal(BEREITSCHAFT.schwachUnter % 4, 0,
    'die Marke liegt nicht mehr auf dem Raster – dann gehört dieser Test nachgezogen');
  assert.equal(B.entlastungFaellig([], dreiMit(BEREITSCHAFT.schwachUnter), bis).stufe, 'keine',
    `genau ${BEREITSCHAFT.schwachUnter} % zählen schon als schwach`);
  assert.equal(B.entlastungFaellig([], dreiMit(BEREITSCHAFT.schwachUnter - 4), bis).stufe,
    'beobachten', 'knapp darunter wird nicht als Muster erkannt');
});

test('Die Ruhepuls-Grundlinie braucht ihre Mindestzahl an Messungen', () => {
  // Ohne genug Grundlinie ist die Abweichung eine Zahl ohne Bezug. Fällt die
  // Schranke aus, urteilt der Tracker über einen Vergleich, den es nicht gibt –
  // und der Ruhepuls ist ein Grund für eine Entlastungswoche.
  const bis = new Date('2026-08-10');
  const mitGrundlinie = (anzahl) => {
    const checks = [];
    for (let i = 0; i < RUHEPULS.schnittTage; i += 1) {
      const d = new Date(bis);
      d.setDate(d.getDate() - i);
      checks.push({ datum: d.toISOString().slice(0, 10), ruhepuls: 58 });
    }
    for (let i = 0; i < anzahl; i += 1) {
      const d = new Date(bis);
      d.setDate(d.getDate() - RUHEPULS.schnittTage - i);
      checks.push({ datum: d.toISOString().slice(0, 10), ruhepuls: 50 });
    }
    return B.ruhepulsTrend(checks, bis);
  };

  assert.equal(mitGrundlinie(RUHEPULS.minMessungenGrundlinie).belastbar, true,
    `genau ${RUHEPULS.minMessungenGrundlinie} Messungen reichen nicht`);
  assert.equal(mitGrundlinie(RUHEPULS.minMessungenGrundlinie - 1).belastbar, false,
    'eine Messung weniger genügt schon');
});

test('Die ACWR-Warnung als Entlastungsgrund beginnt an ihrer Marke', () => {
  // Das Verhältnis ist ausdrücklich keine Verletzungsvorhersage, sondern eine
  // Ampel für Belastungssprünge – aber es zählt als Grund. Wo die Ampel
  // umschlägt, war ungeprüft.
  const bis = new Date('2026-08-10');

  /**
   * Vier Wochen Grundlast, die letzte um `faktor` schwerer.
   *
   * Der Faktor ist nicht das Verhältnis: Die schwere Woche steckt selbst im
   * chronischen Schnitt. Bei gleicher Grundlast B gilt
   * `ACWR = 4f / (f + 3)`, also `f = 3·ziel / (4 − ziel)`. Mit „mal 1,5"
   * kommt 1,33 heraus – beim ersten Versuch genau der Fehlschlag.
   */
  const faktorFuer = (ziel) => (3 * ziel) / (4 - ziel);
  const sessions = (faktor) => Array.from({ length: 28 }, (_, tag) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - tag);
    return {
      datum: d.toISOString().slice(0, 10),
      typ: 'kraft',
      minuten: tag < 7 ? Math.round(60 * faktor) : 60,
      rpe: 5,
    };
  });

  const marke = BELASTUNG.acwr.warnung;
  const auf = B.acwr(sessions(faktorFuer(marke)), bis);
  assert.equal(auf.belastbar, true);
  assert.ok(Math.abs(auf.wert - marke) < 0.03,
    `Testaufbau: ${auf.wert} liegt nicht auf der Marke ${marke}`);

  // Genau auf der Marke ist es noch kein Grund – die Bedingung heißt „über".
  assert.equal(B.entlastungFaellig(sessions(faktorFuer(marke)), [], bis).gruende.length, 0,
    `genau ${marke} zählt schon als Belastungsgrund`);
  // Deutlich darüber schon.
  assert.equal(B.entlastungFaellig(sessions(faktorFuer(marke + 0.3)), [], bis).gruende.length, 1,
    'ein klarer Belastungssprung wird nicht als Grund erkannt');
});

/* ------------------------------------------- Tagestyp und Kohlenhydrate */

test('Eine lange Ausfahrt zählt als lange Ausdauer, egal wie die Einheit heißt', () => {
  // Der Korridor von 7–9 g Kohlenhydraten je Kilo hing an der Einheitenart
  // `ausdauerLang` – die der Planer **nie** erzeugt; er schreibt
  // `ausdauerLocker`. Der Korridor war damit unerreichbar und stand in
  // CLAUDE.md als „toter Korridor".
  //
  // Seit die Ausdauer dem Ausrichtungsregler folgt, sind es am
  // Ausdauer-Anschlag 104 Minuten – und die bekamen dieselbe Vorgabe wie ein
  // 75-Minuten-Mischtag. Eine Eigenschaft am internen Schlüssel festzumachen
  // statt an der Sache selbst: Familie von Falle 4 und 38.
  const ab = ERNAEHRUNG.langeAusdauerAbMinuten;
  const einheit = (typ, minuten) => [{ typ, minuten }];

  for (const typ of ['ausdauerLocker', 'ausdauerLang']) {
    assert.equal(E.tagestyp(einheit(typ, ab)), 'langeAusdauer',
      `${typ} mit genau ${ab} min zählt nicht als lange Ausdauer`);
    assert.notEqual(E.tagestyp(einheit(typ, ab - 1)), 'langeAusdauer',
      `${typ} mit ${ab - 1} min zählt schon als lange Ausdauer`);
  }

  // Intervalle sind hart, nicht lang – auch wenn sie lange dauern.
  assert.equal(E.tagestyp(einheit('ausdauerIntervalle', ab + 30)), 'hart');

  // Und zwei kürzere Blöcke am selben Tag ergeben keine lange Belastung:
  // „ab anderthalb Stunden" meint eine Einheit, nicht einen Tag.
  assert.notEqual(E.tagestyp([
    { typ: 'ausdauerLocker', minuten: ab - 10 },
    { typ: 'ausdauerLocker', minuten: ab - 10 },
  ]), 'langeAusdauer');
});

test('Der Korridor für lange Ausdauer liegt über dem für harte Tage', () => {
  // Sonst wäre die neue Einordnung eine Verschlechterung: Wer zwei Stunden
  // fährt, braucht mehr Kohlenhydrate als an einem harten Mischtag, nicht
  // weniger.
  const [langMin] = ERNAEHRUNG.kohlenhydrate.langeAusdauer;
  const [, hartMax] = ERNAEHRUNG.kohlenhydrate.hart;
  assert.ok(langMin >= hartMax,
    `lange Ausdauer beginnt bei ${langMin} g/kg, harte Tage reichen bis ${hartMax}`);
});

test('Eine gekürzte Einheit schrumpft, sie kollabiert nicht', () => {
  /*
   * `Math.max(5, …)` in `angepassteEinheit()` hält jeden Block bei mindestens
   * fünf Minuten. Der erste Anlauf für diesen Test prüfte genau das – und war
   * wertlos: Die Untergrenze **greift nie** (über 1.008 geprüfte Wochen kein
   * einziges Mal), und mit `Math.min` an derselben Stelle würde jeder Block
   * auf 5 Minuten gesetzt, was ein „mindestens 5" ebenfalls erfüllt. Ein
   * Melder, der nie meldet, besteht jede Prüfung (Falle 18).
   *
   * Geprüft wird deshalb die Aussage, um die es geht: Bei roter Ampel wird die
   * Einheit *kürzer*, nicht zu einer Reihe von Fünf-Minuten-Zeilen. Aufwärmen
   * und Prophylaxe bleiben dabei ausdrücklich stehen.
   */
  const profil = createProfil({
    gewichtKg: 78.3, groesseCm: 180, geburtsjahr: 1995, geschlecht: 'mann',
    trainingstage: 4, ausrichtung: 30,
  });

  let geprueft = 0;
  for (let woche = 1; woche <= 12; woche++) {
    for (const tag of PL.wochenplan(profil, woche).tage) {
      for (const einheit of tag.einheiten) {
        const bloecke = einheit.bloecke || [];
        if (!bloecke.length) continue;
        // `vollstaendig: true` ist Pflicht – ohne das Feld passt
        // `angepassteEinheit()` gar nichts an, und der Test prüfte eine
        // Einheit, die niemand angefasst hat.
        const angepasst = PL.angepassteEinheit(einheit, rot);
        const neu = angepasst.bloecke || [];
        geprueft++;

        // Ein Block ist entweder geschont – dann steht er unverändert da, auch
        // wenn er nur vier Minuten dauert wie der neuromuskuläre Teil – oder
        // er wurde gekürzt und liegt dann auf mindestens fünf Minuten.
        for (const block of neu) {
          const vorher = bloecke.find((b) => b.titel === block.titel);
          if (vorher && block.minuten === vorher.minuten) continue;
          assert.ok(block.minuten >= 5,
            `${einheit.titel} · ${block.titel}: ${block.minuten} min nach der Kürzung`);
        }
        // Und die Gegenrichtung, ohne die der Test nichts hält: Unter den
        // *gekürzten* Blöcken muss noch einer über der Untergrenze liegen.
        // Auf die geschonten zu schauen genügt nicht – die bleiben ohnehin
        // stehen, und ein „längster Block über 5 min" wäre schon durch das
        // unangetastete Aufwärmen erfüllt, während alles Gekürzte auf fünf
        // Minuten plattgedrückt daneben steht.
        const gekuerzt = neu.filter((b) => {
          const vorher = bloecke.find((x) => x.titel === b.titel);
          return vorher && b.minuten !== vorher.minuten;
        });
        if (gekuerzt.length) {
          assert.ok(Math.max(...gekuerzt.map((b) => b.minuten)) > 5,
            `${einheit.titel}: Jeder gekürzte Block liegt auf der Untergrenze – `
            + 'das ist keine Kürzung mehr, sondern ein Einebnen');
        }
      }
    }
  }
  assert.ok(geprueft > 20, `nur ${geprueft} Einheiten geprüft`);
});

test('Hip Thrust und rumänisches Kreuzheben behalten ihren Wiederholungsbereich', () => {
  /*
   * Zwei Untergrenzen, die der Plan bewusst setzt und die kein Test deckte:
   *
   * `Math.max(6, repMin)` beim Hip Thrust – im Maximalkraftblock steht repMin
   * auf 2, und zwei Wiederholungen Hüftstreckung gegen eine Langhantel sind
   * keine sinnvolle Vorgabe. Die Grenze greift in 1.728 der geprüften Fälle.
   *
   * `Math.max(10, repMax)` beim rumänischen Kreuzheben – die Übung soll die
   * Hamstrings unter Dehnung ermüden, nicht schwer werden. Mit `Math.min`
   * wären es 10 statt 12 gewesen, ohne dass etwas angeschlagen hätte.
   */
  const profil = createProfil({
    gewichtKg: 78.3, groesseCm: 180, geburtsjahr: 1995, geschlecht: 'mann',
    trainingstage: 4, ausrichtung: 30,
  });

  const gesehen = { hipthrust: 0, rumaenischesKreuzheben: 0 };
  for (let woche = 1; woche <= 12; woche++) {
    for (const tag of PL.wochenplan(profil, woche).tage) {
      for (const einheit of tag.einheiten) {
        for (const u of einheit.uebungen || []) {
          if (u.schluessel === 'hipthrust') {
            gesehen.hipthrust++;
            assert.ok(u.repBereich[0] >= 6,
              `Hip Thrust in Woche ${woche} mit ${u.repBereich[0]} Wiederholungen`);
          }
          if (u.schluessel === 'rumaenischesKreuzheben') {
            gesehen.rumaenischesKreuzheben++;
            // Mindestens 10 – und nie weniger als der Block ohnehin vorgibt.
            // Ein blosses `>= 10` wäre von `Math.min(10, repMax)` erfüllt
            // gewesen, also genau von der Verfälschung, um die es geht.
            const [, obenImBlock] = KRAFT.wiederholungen[einheit.absicht];
            assert.ok(u.repBereich[1] >= Math.max(10, obenImBlock),
              `Rumänisches Kreuzheben in Woche ${woche} nur bis ${u.repBereich[1]}, `
              + `der Block gibt ${obenImBlock} vor`);
          }
        }
      }
    }
  }
  // Beide Übungen müssen im Zyklus vorkommen, sonst prüft der Test nichts.
  assert.ok(gesehen.hipthrust > 0, 'Hip Thrust kommt im Zyklus gar nicht vor');
  assert.ok(gesehen.rumaenischesKreuzheben > 0, 'Rumänisches Kreuzheben fehlt im Zyklus');
});

test('Die Ampel des Akut-zu-chronisch-Verhältnisses hängt genau an ihren Marken', () => {
  /*
   * Drei Schwellen mit je einer Empfehlung dahinter – und alle drei blieben
   * beim Mutationstest unbemerkt: `>` gegen `>=` liess sich an keiner Stelle
   * erlegen. Die Marken sind erreichbar, weil der Wert auf zwei Stellen
   * gerundet wird.
   *
   * Der chronische Schnitt enthält die akute Woche mit, also gilt
   * `wert = 4·akut / (akut + 3·alt)`. Daraus lassen sich 1,30, 1,50 und 0,80
   * exakt treffen – ohne diese Rechnung landet man bei 1,21 statt 1,30 und
   * prüft am Rand vorbei.
   */
  const bis = new Date('2026-08-10');
  const bauen = (akutLast, altLast) => {
    const s = [];
    const tag = (zurueck, last) => {
      const d = new Date(bis);
      d.setDate(d.getDate() - zurueck);
      s.push({ datum: d.toISOString().slice(0, 10), typ: 'kraft', rpe: 1, minuten: last });
    };
    tag(0, akutLast);
    for (const z of [7, 14, 21]) tag(z, altLast);
    return s;
  };
  const stufeBei = (akutLast, altLast) => {
    const a = B.acwr(bauen(akutLast, altLast), bis);
    assert.equal(a.belastbar, true, 'Testaufbau: vier Wochen mit Einträgen');
    return { wert: a.wert, stufe: a.stufe };
  };

  // Genau auf der Obergrenze ist noch nichts erhöht.
  assert.deepEqual(stufeBei(1300, 900), { wert: BELASTUNG.acwr.obergrenze, stufe: 'unauffällig' });
  assert.equal(stufeBei(1310, 900).stufe, 'erhoeht');

  // Genau auf der Warnmarke ist es noch kein Sprung.
  assert.deepEqual(stufeBei(1800, 1000), { wert: BELASTUNG.acwr.warnung, stufe: 'erhoeht' });
  assert.equal(stufeBei(1810, 1000).stufe, 'sprung');

  // Und genau auf der Untergrenze ist es noch nicht „niedrig".
  assert.deepEqual(stufeBei(750, 1000), { wert: BELASTUNG.acwr.untergrenze, stufe: 'unauffällig' });
  assert.equal(stufeBei(740, 1000).stufe, 'niedrig');
});

test('Die Monotonie wird erst oberhalb ihrer Marke benotet', () => {
  // `wert > hochAb` blieb unbemerkt, und dahinter steht eine Note. Sechs
  // Trainingstage, damit überhaupt benotet wird (minTrainingstageFuerNote).
  const bis = new Date('2026-08-10');
  const wocheMit = (lasten) => lasten.map((last, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    return { datum: d.toISOString().slice(0, 10), typ: 'kraft', rpe: 1, minuten: last };
  }).filter((s) => s.minuten > 0);

  // Genau auf der Marke: Diese Verteilung ergibt eine Monotonie von exakt
  // 2,00. Ein `>=` statt `>` würde hier bereits „zu gleichförmig" melden.
  const aufDerMarke = B.monotonie(wocheMit([42, 42, 42, 42, 42, 15, 0]), bis);
  assert.equal(aufDerMarke.bewertbar, true, 'Testaufbau: sechs Trainingstage');
  assert.equal(aufDerMarke.wert, BELASTUNG.monotonie.hochAb);
  assert.equal(aufDerMarke.hoch, false, 'Genau auf der Marke ist noch nichts zu gleichförmig');

  // Und knapp darüber schlägt sie an.
  const darueber = B.monotonie(wocheMit([100, 100, 100, 100, 100, 100, 0]), bis);
  assert.ok(darueber.wert > BELASTUNG.monotonie.hochAb);
  assert.equal(darueber.hoch, true);
});

test('Die Ausdauerverteilung wird ab ihrer Marke bewertet – und nicht davor', () => {
  // `gesamt < minMinutenFuerBewertung` blieb unbemerkt. Dahinter steht, ob
  // die Karte überhaupt eine Aussage macht oder nur „noch zu wenig".
  const bis = new Date('2026-08-10');
  const einheit = (minuten, rpe, tagZurueck) => ({
    datum: new Date(Date.parse('2026-08-10') - tagZurueck * 86400000).toISOString().slice(0, 10),
    typ: 'ausdauerLocker',
    rpe,
    minuten,
  });
  const grenze = AUSDAUER_VERTEILUNG.minMinutenFuerBewertung;

  assert.equal(A.verteilung([einheit(grenze - 1, 3, 1)], bis).bewertbar, false);
  assert.equal(A.verteilung([einheit(grenze, 3, 1)], bis).bewertbar, true,
    'Genau auf der Marke wird bewertet');
});

test('Fünf Prozent harte Zeit sind noch ein harter Reiz', () => {
  /*
   * `anteil.hart < hartVernachlaessigbar` entscheidet zwischen „alles locker,
   * so ist es gedacht" und der Warnung „ohne harte Anteile fehlt der Reiz".
   * Die Marke ist erreichbar – 6 von 120 Minuten sind exakt 5 % – und beide
   * Zweige blieben beim Mutationstest unbemerkt.
   */
  const bis = new Date('2026-08-10');
  const einheit = (minuten, rpe, tagZurueck) => ({
    datum: new Date(Date.parse('2026-08-10') - tagZurueck * 86400000).toISOString().slice(0, 10),
    typ: 'ausdauerLocker',
    rpe,
    minuten,
  });

  const aufDerMarke = A.verteilung([einheit(114, 3, 1), einheit(6, 8, 2)], bis);
  assert.equal(aufDerMarke.anteil.hart, AUSDAUER_VERTEILUNG.hartVernachlaessigbar);
  assert.equal(aufDerMarke.stufe, 'gut');
  assert.doesNotMatch(aufDerMarke.text, /Fast alles locker/,
    'Genau auf der Marke gibt es einen harten Reiz – die Warnung gehört dort nicht hin');

  const darunter = A.verteilung([einheit(120, 3, 1), einheit(6, 8, 2)], bis);
  assert.ok(darunter.anteil.hart < AUSDAUER_VERTEILUNG.hartVernachlaessigbar);
  assert.equal(darunter.stufe, 'warnung');
  assert.match(darunter.text, /Fast alles locker/);
});

test('Ein gemessener Maximalpuls gilt auch genau an seinen Rändern', () => {
  // `gemessen >= minPuls` und `<= maxPuls` entscheiden, ob mit dem gemessenen
  // Wert oder mit der Altersschätzung gerechnet wird – und damit über jede
  // Pulszone. Beide Ränder sind über das Profilformular eingebbar (min/max
  // stehen dort als Attribute), beide blieben unbemerkt.
  const basis = { geburtsjahr: 1996, geschlecht: 'm' };
  const heute = new Date('2026-08-10');

  for (const rand of [HERZFREQUENZ.minPuls, HERZFREQUENZ.maxPuls]) {
    const m = A.hfMax({ ...basis, hfMaxGemessen: rand }, heute);
    assert.equal(m.gemessen, true, `${rand} bpm liegt im gültigen Bereich`);
    assert.equal(m.hfMax, rand);
  }
  // Einen Schlag außerhalb wird geschätzt statt übernommen.
  for (const daneben of [HERZFREQUENZ.minPuls - 1, HERZFREQUENZ.maxPuls + 1]) {
    assert.equal(A.hfMax({ ...basis, hfMaxGemessen: daneben }, heute).gemessen, false);
  }
});

test('Der Ruhepulsverlauf hält sein Fenster in beide Richtungen', () => {
  /*
   * `datum >= grenze && datum <= bis` – mit `||` statt `&&` wäre die
   * Bedingung fast immer wahr und das Fenster damit wirkungslos. Genau das
   * war Falle 18: „In der Rückschau urteilte die Zukunft über die
   * Vergangenheit, und drei Monate alte Checks galten weiter als die letzten
   * fünf." Der Filter kam daher, ein Test dafür nicht.
   */
  const bis = new Date('2026-08-10');
  const check = (datum, ruhepuls) => ({ datum, ruhepuls });
  const checks = [
    check('2026-08-09', 52), // im Fenster
    check('2026-01-01', 48), // zu alt
    check('2026-09-01', 70), // in der Zukunft
  ];

  const verlauf = B.ruhepulsVerlauf(checks, bis, 90);
  assert.deepEqual(verlauf.map((v) => v.datum), ['2026-08-09'],
    'Nur der Eintrag im Fenster zählt – weder ältere noch spätere');

  // Und der Rand selbst gehört dazu: genau 90 Tage zurück ist noch drin.
  const genauAmRand = new Date(bis);
  genauAmRand.setDate(genauAmRand.getDate() - 90);
  const mitRand = B.ruhepulsVerlauf(
    [check(genauAmRand.toISOString().slice(0, 10), 50)], bis, 90,
  );
  assert.equal(mitRand.length, 1, 'Der Randtag gehört ins Fenster');
});

test('Fünf Prozent hart zählen auch neben Sprinteinheiten als Reiz', () => {
  // Derselbe Rand wie oben, nur der andere Zweig: Liegen Sprinteinheiten
  // daneben, lautet die Aussage „so ist es gedacht" statt einer Warnung.
  // Der Zweig blieb unbemerkt, weil der erste Test keine Sprints enthielt.
  const bis = new Date('2026-08-10');
  const tag = (zurueck) => new Date(Date.parse('2026-08-10') - zurueck * 86400000)
    .toISOString().slice(0, 10);
  const sessions = [
    { datum: tag(1), typ: 'ausdauerLocker', rpe: 3, minuten: 114 },
    { datum: tag(2), typ: 'ausdauerLocker', rpe: 8, minuten: 6 },
    { datum: tag(3), typ: 'sprint', rpe: 8, minuten: 100 },
  ];

  const aufDerMarke = A.verteilung(sessions, bis);
  assert.equal(aufDerMarke.anteil.hart, AUSDAUER_VERTEILUNG.hartVernachlaessigbar);
  assert.doesNotMatch(aufDerMarke.text, /so ist es gedacht/,
    'Genau auf der Marke gibt es harte Ausdauerzeit – der Satz gehört unter die Marke');

  // Knapp darunter: Dann trägt der Sprint die harte Intensität, und der
  // Tracker sagt das auch, statt zusätzliche harte Ausdauer zu empfehlen.
  const darunter = A.verteilung(
    [{ ...sessions[0], minuten: 120 }, sessions[1], sessions[2]], bis,
  );
  assert.ok(darunter.anteil.hart < AUSDAUER_VERTEILUNG.hartVernachlaessigbar);
  assert.equal(darunter.stufe, 'gut');
  assert.match(darunter.text, /so ist es gedacht/);
});

test('Ein Puls genau an der Bereichsgrenze zählt noch', () => {
  // `pruefePuls` verwirft alles außerhalb von [minPuls, maxPuls]. Genau auf
  // den Grenzen gilt der Wert – daran hängt, ob eine Einheit über den Puls
  // oder über das RPE eingeordnet wird, und das ist der Unterschied zwischen
  // einer Messung und einer Schätzung.
  for (const rand of [HERZFREQUENZ.minPuls, HERZFREQUENZ.maxPuls]) {
    assert.equal(A.pruefePuls(rand), rand, `${rand} bpm liegt im Bereich`);
  }
  assert.equal(A.pruefePuls(HERZFREQUENZ.minPuls - 1), null);
  assert.equal(A.pruefePuls(HERZFREQUENZ.maxPuls + 1), null);
});

test('Der Satz zur Erhebungsart steht nur bei gemischter Quelle', () => {
  /*
   * „50 % der Minuten über Puls eingeordnet, der Rest über RPE" – dieser Satz
   * kam aus Falle 29 und benennt, woher die Einordnung stammt. Er gehört nur
   * dorthin, wo wirklich beide Quellen im Spiel sind; mit `||` statt `&&`
   * stünde er auch über einer Auswertung, die ausschließlich RPE kennt.
   */
  const bis = new Date('2026-08-10');
  const tag = (zurueck) => new Date(Date.parse('2026-08-10') - zurueck * 86400000)
    .toISOString().slice(0, 10);

  const nurRpe = A.verteilung([
    { datum: tag(1), typ: 'ausdauerLocker', rpe: 3, minuten: 100 },
    { datum: tag(2), typ: 'ausdauerLocker', rpe: 8, minuten: 40 },
  ], bis);
  assert.doesNotMatch(nurRpe.quelleText, /über Puls eingeordnet/,
    'Ohne einen einzigen Pulswert gibt es nichts zu mischen');

  // Mit Puls in einer der beiden Einheiten ist die Erhebung gemischt.
  const gemischt = A.verteilung([
    { datum: tag(1), typ: 'ausdauerLocker', rpe: 3, minuten: 100, hfSchnitt: 120 },
    { datum: tag(2), typ: 'ausdauerLocker', rpe: 8, minuten: 40 },
  ], bis, 28, { locker: 153, hart: 163, hfMax: 190, gemessen: false });
  assert.match(gemischt.quelleText, /über Puls eingeordnet/);
});

test('Das Fenster der Morgen-Checks endet, wo es endet', () => {
  // `new Date(c.datum) > fensterAb` – der Rand entscheidet, welche Checks als
  // „die letzten fünf" gelten. Genau das war Falle 18: Ohne Stichtag zählten
  // drei Monate alte Checks weiter mit, und daran hängt seit Falle 26 die
  // Empfehlung zur Entlastungswoche.
  const bis = new Date('2026-08-10');
  const alsTag = (zurueck) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - zurueck);
    return d.toISOString().slice(0, 10);
  };
  const rot = (datum) => ({
    datum, schlaf: 1, muskelkater: 1, stress: 1, stimmung: 1, energie: 1,
  });

  const fenster = BELASTUNG.checkFensterTage;
  // Drei rote Checks im Fenster tragen die Empfehlung allein (Falle 26).
  const drinnen = B.entlastungFaellig(
    [], [rot(alsTag(0)), rot(alsTag(1)), rot(alsTag(2))], bis,
  );
  assert.ok(drinnen.gruende.length > 0, 'Drei rote Tage im Fenster müssen zählen');

  // Dieselben drei Checks, aber älter als das Fenster: Sie zählen nicht mehr.
  const draussen = B.entlastungFaellig(
    [], [rot(alsTag(fenster + 1)), rot(alsTag(fenster + 2)), rot(alsTag(fenster + 3))], bis,
  );
  assert.deepEqual(draussen.gruende, [],
    'Checks außerhalb des Fensters dürfen keine Entlastung mehr auslösen');

  // Und genau auf der Kante: `datum > fensterAb` schließt den Tag aus, der
  // exakt `checkFensterTage` zurückliegt. Ein `>=` würde ihn hereinholen –
  // erst dieser Fall unterscheidet die beiden, Tage weiter draußen nicht.
  const aufDerKante = B.entlastungFaellig(
    [], [rot(alsTag(fenster)), rot(alsTag(fenster)), rot(alsTag(fenster))], bis,
  );
  assert.deepEqual(aufDerKante.gruende, [],
    `Der Tag genau ${fenster} Tage zurück liegt außerhalb des Fensters`);
});

test('Die Ausdauerfenster nehmen den Randtag mit und den Tag danach nicht', () => {
  /*
   * Zwei Fenster mit derselben Bedingung `datum < grenze || datum > bis`:
   * die Wochenstrecke und der Tempoverlauf. Beide blieben unbemerkt, weil
   * kein Test je einen Eintrag exakt auf die Fenstergrenze legte – Einträge
   * weiter draußen unterscheiden `<` und `<=` nicht.
   */
  const bis = new Date('2026-08-10');
  const tage = 7;
  const alsTag = (zurueck) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - zurueck);
    return d.toISOString().slice(0, 10);
  };
  const fahrt = (datum) => ({
    datum, typ: 'ausdauerLocker', rpe: 3, minuten: 60,
    strecke: { meter: 20000, geraet: 'rad' },
  });

  // Genau am Rand des Fensters – der Tag gehört noch dazu.
  const amRand = A.wochenstrecke([fahrt(alsTag(tage))], bis, tage);
  assert.equal(amRand.rad, 20, 'Der Randtag zählt zur Wochenstrecke');

  // Einen Tag weiter zurück nicht mehr, und aus der Zukunft auch nicht.
  assert.equal(A.wochenstrecke([fahrt(alsTag(tage + 1))], bis, tage).rad, undefined);
  assert.equal(A.wochenstrecke([fahrt(alsTag(-1))], bis, tage).rad, undefined);

  // Und die obere Kante: Der Stichtag selbst gehört dazu. Auch hier
  // unterscheidet erst der Tag *auf* der Grenze `>` von `>=`.
  assert.equal(A.wochenstrecke([fahrt(alsTag(0))], bis, tage).rad, 20,
    'Der Stichtag selbst zählt mit');

  // Dasselbe Fenster steckt in der Intensitätsverteilung.
  const amRandVerteilung = A.verteilung([
    { datum: alsTag(28), typ: 'ausdauerLocker', rpe: 3, minuten: 200 },
  ], bis, 28);
  assert.equal(amRandVerteilung.bewertbar, true,
    'Eine Einheit genau am Fensterrand zählt zur Verteilung');
});

test('Bei gleich vielen Puls- und RPE-Minuten steht der Vorbehalt noch nicht', () => {
  /*
   * `quellen.hf > quellen.rpe` entscheidet, ob unter der Warnung „zu viel
   * hart" zusätzlich der Satz über den *geschätzten* Maximalpuls steht – die
   * Einschränkung, ohne die jemand sein Training nach einer Formel umbaut.
   * Bei Gleichstand überwiegt der Puls eben nicht.
   */
  const bis = new Date('2026-08-10');
  const tag = (zurueck) => new Date(Date.parse('2026-08-10') - zurueck * 86400000)
    .toISOString().slice(0, 10);
  const grenzen = { locker: 153, hart: 163, hfMax: 190, gemessen: false };

  // Der Satz hängt im Zweig „zu viel hart", und der wird erst ab
  // `minMinutenProWocheFuerVerhaeltnis` erreicht – bei 28 Tagen also ab rund
  // 1.200 Minuten. Mit weniger landet man in „bewertet der Tracker nicht"
  // und prüft an der Stelle vorbei, um die es geht.
  const hart = (minuten, tagZurueck, mitPuls) => ({
    datum: tag(tagZurueck), typ: 'ausdauerLocker', rpe: 8, minuten,
    ...(mitPuls ? { hfSchnitt: 170 } : {}),
  });
  const locker = (minuten, tagZurueck, mitPuls) => ({
    datum: tag(tagZurueck), typ: 'ausdauerLocker', rpe: 3, minuten,
    ...(mitPuls ? { hfSchnitt: 140 } : {}),
  });

  const gleichstand = A.verteilung([hart(700, 1, true), locker(700, 2, false)], bis, 28, grenzen);
  assert.equal(gleichstand.quellen.hf, gleichstand.quellen.rpe, 'Testaufbau: Gleichstand');
  assert.equal(gleichstand.stufe, 'warnung', 'Testaufbau: Zweig „zu viel hart"');
  assert.doesNotMatch(gleichstand.text, /geschätzten Maximalpuls/,
    'Bei Gleichstand überwiegt der Puls nicht – der Vorbehalt gehört nicht dazu');

  // Überwiegt der Puls, steht er da.
  const pulsMehrheit = A.verteilung([hart(900, 1, true), locker(500, 2, false)], bis, 28, grenzen);
  assert.ok(pulsMehrheit.quellen.hf > pulsMehrheit.quellen.rpe);
  assert.equal(pulsMehrheit.stufe, 'warnung');
  assert.match(pulsMehrheit.text, /geschätzten Maximalpuls/);
});

test('Genau zehn Wiederholungen zählen noch für die Maximalschätzung', () => {
  // `wdh > EPLEY.maxWiederholungen` – bei exakt zehn ist der Satz noch
  // brauchbar, bei elf nicht mehr. Dahinter steht, ob der Kraftstand sich
  // überhaupt bewegt (siehe Falle 55), also eine Aussage über Fortschritt.
  const daten = (wdh) => ({
    profil: { gewichtKg: 80 },
    sessions: [{
      datum: '2026-08-01',
      typ: 'kraft',
      uebungen: [{ schluessel: 'kniebeuge', saetze: [{ gewicht: 80, wiederholungen: wdh }] }],
    }],
    tests: [],
  });

  const genau = LE.einerMaxima(daten(EPLEY.maxWiederholungen), 80);
  assert.ok(genau.kniebeuge, `${EPLEY.maxWiederholungen} Wiederholungen sind noch schätzbar`);

  const darueber = LE.einerMaxima(daten(EPLEY.maxWiederholungen + 1), 80);
  assert.equal(darueber.kniebeuge, undefined,
    'Einen darüber schätzt Epley nicht mehr');
});

test('Der Sprintabstand gilt ab dem geforderten Tag, nicht erst danach', () => {
  /*
   * `tag - letzter >= mindestAbstand` setzt die 48-Stunden-Regel um – eine
   * der Regeln, die CLAUDE.md „nicht verhandelbar" nennt. Bei `>` bräuchte es
   * drei Tage Abstand statt zwei, und der Planer verlöre je nach Muster eine
   * Sprinteinheit pro Woche.
   */
  const abstand = Math.ceil(SPRINT.minStundenZwischenEinheiten / 24);
  const p = profil({ trainingstageProWoche: 4, ausrichtung: 0 });

  const abstaende = [];
  for (let woche = 1; woche <= 12; woche += 1) {
    const sprinttage = PL.wochenplan(p, woche).tage
      .map((t, i) => (t.einheiten.some((e) => e.typ === 'sprint') ? i : null))
      .filter((i) => i !== null);

    for (let i = 1; i < sprinttage.length; i += 1) {
      const luecke = sprinttage[i] - sprinttage[i - 1];
      abstaende.push(luecke);
      assert.ok(luecke >= abstand,
        `Woche ${woche}: Sprint an Tag ${sprinttage[i - 1]} und ${sprinttage[i]}`);
    }
  }

  /*
   * Die Gegenprobe – und sie ist der eigentliche Test.
   *
   * „Alle Abstände sind mindestens so groß" gilt auch bei einer strengeren
   * Regel: Mit `>` statt `>=` bräuchte es drei Tage, und die Prüfung darüber
   * bliebe grün. Unterscheidbar wird es erst dadurch, dass der Planer den
   * Mindestabstand irgendwo tatsächlich **ausnutzt**. Ein Test, der nur die
   * Untergrenze prüft, prüft die Grenze nicht.
   */
  assert.ok(abstaende.includes(abstand),
    `Kein einziger Abstand nutzt die geforderten ${abstand} Tage aus – `
    + `gemessen: ${[...new Set(abstaende)].sort().join(', ')}`);
});

test('Der Aktivitätsimport nimmt seine Grenzwerte noch an', () => {
  /*
   * Zwei Plausibilitätsgrenzen entscheiden, ob eine Datei überhaupt
   * ankommt: mindestens eine Minute und höchstens 300 km. Genau auf den
   * Marken muss die Aktivität durchgehen – sonst verwirft der Import eine
   * gültige Datei, und zwar stumm.
   */
  const spur = (meter, sekunden) => {
    // Zwei Punkte auf einem Breitengrad: 1° Länge ≈ 111.320 m am Äquator.
    const grad = meter / 111320;
    const start = '2026-08-01T06:00:00Z';
    const ende = new Date(Date.parse(start) + sekunden * 1000).toISOString();
    return `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="0" lon="0"><time>${start}</time></trkpt>
      <trkpt lat="0" lon="${grad}"><time>${ende}</time></trkpt>
    </trkseg></trk></gpx>`;
  };

  // Genau eine Minute wird angenommen, 59 Sekunden runden auf eine Minute.
  const eineMinute = AK.ausGpx(spur(500, 60));
  assert.equal(eineMinute.length, 1, 'Eine Minute ist die Untergrenze, nicht darunter');

  // Und deutlich zu kurz fällt heraus.
  assert.equal(AK.ausGpx(spur(500, 10)).length, 0);
});

test('Das Satzfenster nimmt den Randtag mit – und ein Satz ohne Wiederholung zählt nicht', () => {
  /*
   * `saetzeProWoche` trägt das Muskelvolumen und die Schutzabdeckung. Drei
   * Ränder, alle bisher ungeprüft: die beiden Fenstergrenzen und die Frage,
   * was ein „harter Satz" ist. Ein Satz mit null Wiederholungen ist keiner –
   * über den Dialog nicht erzeugbar, über eine eingespielte Sicherung schon
   * (dieselbe Herkunft wie in Falle 29 und 38).
   */
  const bis = new Date('2026-08-10');
  const tage = 7;
  const alsTag = (zurueck) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - zurueck);
    return d.toISOString().slice(0, 10);
  };
  const einheit = (datum, wiederholungen) => ({
    datum,
    typ: 'kraft',
    uebungen: [{ schluessel: 'kniebeuge', saetze: [{ gewicht: 100, wiederholungen }] }],
  });

  assert.equal(LE.saetzeProWoche([einheit(alsTag(tage), 5)], bis, tage).kniebeuge, 1,
    'Der Randtag gehört ins Fenster');
  assert.equal(LE.saetzeProWoche([einheit(alsTag(tage + 1), 5)], bis, tage).kniebeuge, undefined);
  assert.equal(LE.saetzeProWoche([einheit(alsTag(0), 5)], bis, tage).kniebeuge, 1,
    'Der Stichtag selbst zählt mit');
  assert.equal(LE.saetzeProWoche([einheit(alsTag(-1), 5)], bis, tage).kniebeuge, undefined);

  assert.equal(LE.saetzeProWoche([einheit(alsTag(1), 0)], bis, tage).kniebeuge, undefined,
    'Ein Satz ohne Wiederholung ist kein harter Satz');
});

test('Ein verworfener Satz vom selben Tag erklärt den Stand nicht', () => {
  /*
   * `String(session.datum) <= String(stand.datum)` in
   * `nichtSchaetzbareSaetze()`: Stammt der verworfene Satz vom **selben** Tag
   * wie der angezeigte Wert, erklärt er dessen Alter nicht – der Wert ist ja
   * genauso frisch. Mit `<` statt `<=` stünde die Meldung dort trotzdem, und
   * zwar dauerhaft, weil jede schwere Einheit auch leichte Sätze enthält.
   */
  const gleicherTag = {
    profil: { gewichtKg: 80 },
    sessions: [{
      datum: '2026-08-01',
      typ: 'kraft',
      uebungen: [{
        schluessel: 'kniebeuge',
        saetze: [{ gewicht: 100, wiederholungen: 5 }, { gewicht: 60, wiederholungen: 15 }],
      }],
    }],
    tests: [],
  };
  const stand = LE.leistungsstand(gleicherTag);
  assert.ok(stand.maxima.kniebeuge, 'Testaufbau: Der schwere Satz ergibt ein Maximum');
  assert.equal(stand.nichtSchaetzbareSaetze.kniebeuge, undefined,
    'Derselbe Tag erklärt nichts – der Wert stammt ja von dort');
});

test('Der Aktivitätsimport nimmt genau 300 km noch an', () => {
  // `gerundet > 300000` – die obere Plausibilitätsgrenze. Genau auf der Marke
  // muss die Datei durchgehen, sonst verwirft der Import stumm.
  const spurGrad = (grad, sekunden) => {
    const start = '2026-08-01T06:00:00Z';
    const ende = new Date(Date.parse(start) + sekunden * 1000).toISOString();
    return `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="0" lon="0"><time>${start}</time></trkpt>
      <trkpt lat="0" lon="${grad}"><time>${ende}</time></trkpt>
    </trkseg></trk></gpx>`;
  };

  /*
   * Der Längengrad ist gesucht, nicht gerechnet: Die Strecke entsteht über
   * die Haversine-Formel, und `meter / 111320` trifft daneben – 300.000
   * angefragte Meter kommen als 299.663 an. Der erste Anlauf dieses Tests
   * prüfte damit **unterhalb** der Grenze und erlegte die Verfälschung nicht.
   * Der Wert unten ist auf exakt 300.000 m eingegrenzt.
   */
  const genauGrad = 2.69796033;
  const genau = AK.ausGpx(spurGrad(genauGrad, 72000));
  assert.equal(genau.length, 1, '300 km liegen noch im Bereich');
  assert.equal(genau[0].meter, 300000, 'Testaufbau: exakt auf der Marke');

  const darueber = AK.ausGpx(spurGrad(genauGrad * 1.001, 72000));
  assert.equal(darueber.length, 0, 'Darüber wird die Spur verworfen');
});
