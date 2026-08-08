// Der Gesamtzustand der Oberfläche – aus den gespeicherten Daten gerechnet.
//
// Diese Datei kennt weder Netzwerk noch Dateisystem. Sie bekommt den kompletten
// Datenbestand übergeben und gibt zurück, was die Oberfläche anzeigt. Genau
// deshalb läuft sie an beiden Enden: im Browser, wo die Daten aus der lokalen
// Datenbank kommen, und im Node-Server, wo sie aus einer JSON-Datei kommen.
//
// Der Tracker braucht damit keinen Server mehr, um zu rechnen. Er braucht einen
// nur noch, wenn die Daten woanders liegen sollen als auf dem Gerät.

import * as profilM from './profil.js';
import * as ernaehrung from './ernaehrung.js';
import * as planM from './plan.js';
import * as belastung from './belastung.js';
import * as leistungM from './leistung.js';
import * as sprintM from './sprint.js';
import * as ausdauerM from './ausdauer.js';
import {
  WOHLBEFINDEN, UEBUNGEN, MUSKELGRUPPEN, RISIKOSTUFEN,
  SPRINT_QUALITAET, AUSDAUER_ZONEN,
} from './wissen.js';
import { heute, wochentagIndex } from './regeln.js';

/** Wochentag-Index nach deutschem Muster: Montag = 0. */
function tagIndex(datum = heute()) {
  return wochentagIndex(datum);
}

/* ---------------------------------------------------------- Zusammenbau */

/**
 * Der Gesamtzustand für die Oberfläche. Alles, was das Dashboard braucht, in
 * einem Aufruf – das spart auf dem Handy spürbar Wartezeit gegenüber fünf
 * einzelnen Anfragen.
 */
export function zustand(daten, datum = heute()) {
  const profil = daten.profil;

  const woche = planM.trainingswoche(profil.startdatum, new Date(datum));
  // Der Leistungsstand geht in den Plan ein, damit dort Kilo stehen statt
  // Prozent – am Gerät ist eine Prozentangabe nutzlos.
  const stand = leistungM.leistungsstand(daten);
  const plan = planM.wochenplan(profil, Math.max(1, woche), stand);
  const index = tagIndex(datum);
  const heutePlan = plan.tage[index];

  // Die Tagesform wirkt nur auf heute. Der Wochenplan bleibt unangetastet –
  // für kommende Tage ist die Bereitschaft schlicht noch nicht bekannt, und
  // ein Plan, der sich rückwirkend selbst umschreibt, wäre nicht nachvollziehbar.
  const checkHeute = daten.checks.find((c) => c.datum === datum) || null;
  const bereit = belastung.bereitschaft(checkHeute);
  const heuteEinheiten = heutePlan.einheiten.map((e) => planM.angepassteEinheit(e, bereit));
  const heuteAngepasst = {
    ...heutePlan,
    einheiten: heuteEinheiten,
    minuten: heuteEinheiten.reduce((s, e) => s + e.minuten, 0),
    angepasst: heuteEinheiten.some((e) => e.anpassung),
  };

  // Für den Kalorienbedarf zählt, was tatsächlich ansteht – nicht der
  // ursprüngliche Plan. Eine gestrichene Sprinteinheit senkt den Bedarf.
  const einheitenHeute = heuteEinheiten.map((e) => ({ typ: e.typ, minuten: e.minuten }));
  const bedarf = ernaehrung.tagesbedarf(profil, einheitenHeute);
  const typ = ernaehrung.tagestyp(einheitenHeute);
  const makro = bedarf ? ernaehrung.makros(profil, bedarf.ziel, typ) : null;

  const essenHeute = daten.essen.filter((e) => e.datum === datum);
  const ist = ernaehrung.tagesSumme(essenHeute);
  const bilanz = makro ? ernaehrung.bilanz(makro, ist) : null;

  // Bewusst über abgeschlossene Tage, nicht über den laufenden – siehe
  // energieverfuegbarkeitSchnitt.
  const ev = ernaehrung.energieverfuegbarkeitSchnitt(
    profil, daten.essen, daten.sessions, new Date(datum));

  // Ohne Geburtsjahr und ohne gemessenen Maximalpuls bleibt das null – dann
  // läuft die Zoneneinteilung wie bisher über RPE.
  const pulszonen = ausdauerM.pulszonen(profil, new Date(datum));

  return {
    datum,
    profil,
    profilStatus: profilM.pruefeProfil(profil),
    woche,
    startetErstNoch: Boolean(profil.startdatum) && woche < 1,
    plan,
    heute: {
      ...heuteAngepasst,
      tagestyp: typ,
      bedarf,
      makro,
      ist,
      bilanz,
      energieverfuegbarkeit: ev,
      mahlzeiten: makro ? ernaehrung.mahlzeitenplan(profil, makro) : null,
      essen: essenHeute,
      check: checkHeute,
      bereitschaft: bereit,
    },
    belastung: {
      acwr: belastung.acwr(daten.sessions, new Date(datum)),
      monotonie: belastung.monotonie(daten.sessions, new Date(datum)),
      entlastung: belastung.entlastungFaellig(daten.sessions, daten.checks, new Date(datum)),
      verlauf: belastung.wochenverlauf(daten.sessions, 12, new Date(datum)),
      ruhepuls: belastung.ruhepulsTrend(daten.checks, new Date(datum)),
      ruhepulsVerlauf: belastung.ruhepulsVerlauf(daten.checks, new Date(datum)),
      // Die Fragen kommen vom Server, damit sie nicht ein zweites Mal im
      // Browser stehen und irgendwann auseinanderlaufen.
      wohlbefinden: WOHLBEFINDEN,
    },
    muscleup: profilM.muscleupStand({
      klimmzuege: bestwert(daten.tests, 'klimmzuege'),
      muscleups: bestwert(daten.tests, 'muscleups'),
      zusatzlastAnteil: zusatzlastAnteil(daten.tests, profil.gewichtKg),
      manuell: daten.muscleup?.manuell || {},
    }),
    schwerpunkte: profilM.schwerpunkte(profil.ausrichtung),
    ausrichtung: profilM.ausrichtungName(profil.ausrichtung),
    ausdauerEmpfehlung: profilM.ausdauerEmpfehlung(profil),
    letzteSessions: daten.sessions.slice(-10).reverse(),
    sprint: {
      // Auswertung der zuletzt protokollierten Sprinteinheit – die Frage
      // "war das noch Qualität?" interessiert direkt danach, nicht erst
      // beim nächsten Test.
      letzte: (() => {
        const mit = daten.sessions.filter((x) => x.laeufe?.length);
        const jueng = mit[mit.length - 1];
        return jueng ? { datum: jueng.datum, ...sprintM.auswertung(jueng.laeufe) } : null;
      })(),
      verlauf: sprintM.bestzeitVerlauf(daten.sessions),
      // Die Bestzeit gehört an die erste Stelle – für einen Sprinter ist sie
      // die Zahl, wegen der er überhaupt mitschreibt.
      bestzeiten: sprintM.bestzeiten(sprintM.bestzeitVerlauf(daten.sessions)),
      schwelle: SPRINT_QUALITAET,
    },
    ausdauer: {
      // Die Verteilung über vier Wochen: Sind die lockeren Einheiten wirklich
      // locker? Das ist die Frage, an der Ausdauertraining am häufigsten scheitert.
      verteilung: ausdauerM.verteilung(daten.sessions, new Date(datum), 28, pulszonen),
      tempo: ausdauerM.tempoVerlauf(daten.sessions, pulszonen),
      wochenstrecke: ausdauerM.wochenstrecke(daten.sessions, new Date(datum)),
      zonen: AUSDAUER_ZONEN,
      geraete: ausdauerM.GERAETE,
      pulszonen,
    },
    gewichtsverlauf: daten.gewicht.slice(-90),
    leistung: {
      maxima: stand.maxima,
      letzte: stand.letzte,
      // Wochenvolumen je Übung und je Muskelgruppe. Die Dosis-Wirkung bezieht
      // sich auf Muskelgruppen – pro Übung zu zählen führt in die Irre.
      saetzeDieseWoche: leistungM.saetzeProWoche(daten.sessions, new Date(datum)),
      saetzeProMuskel: leistungM.saetzeProMuskel(daten.sessions, new Date(datum)),
      // Einordnung nach oben und unten – die Zahlen dazu stehen in wissen.js,
      // nicht in der Oberfläche.
      volumen: leistungM.volumenBewertung(
        leistungM.saetzeProMuskel(daten.sessions, new Date(datum)),
        plan.tage.filter((t) => t.einheiten.some((e) => e.typ === 'sprint')).length),
      schutz: leistungM.schutzabdeckung(daten.sessions, new Date(datum)),
      risiko: leistungM.risikoprofil(daten.sessions, new Date(datum)),
      uebungen: UEBUNGEN,
      muskelgruppen: MUSKELGRUPPEN,
      risikostufen: RISIKOSTUFEN,
    },
  };
}

/**
 * Protokollierte Übungen säubern. Unbekannte Schlüssel fliegen raus – sonst
 * landet ein Tippfehler als eigene Übung im Tagebuch und taucht nie wieder auf.
 * Sätze ohne Wiederholungen sind nicht absolviert und werden verworfen.
 */
export function uebungenPruefen(roh) {
  if (!Array.isArray(roh)) return [];
  const sauber = [];
  for (const u of roh) {
    if (!UEBUNGEN[u?.schluessel]) continue;
    const saetze = (Array.isArray(u.saetze) ? u.saetze : [])
      .map((s) => ({
        gewicht: Number(s.gewicht) || 0,
        wiederholungen: Math.max(0, Math.round(Number(s.wiederholungen) || 0)),
        rpe: s.rpe != null ? profilM.clamp(Number(s.rpe) || 0, 0, 10) : null,
      }))
      .filter((s) => s.wiederholungen > 0);
    if (!saetze.length) continue;
    sauber.push({ schluessel: u.schluessel, name: UEBUNGEN[u.schluessel].name, saetze });
  }
  return sauber;
}

/** Verlauf je Übung: bestes geschätztes 1RM pro Trainingstag, für die Kurve. */
export function uebungsVerlauf(sessions = []) {
  const verlauf = {};
  for (const session of sessions) {
    for (const uebung of session.uebungen || []) {
      const werte = (uebung.saetze || [])
        .filter((s) => s.gewicht > 0 && s.wiederholungen > 0 && s.wiederholungen <= 10)
        .map((s) => profilM.e1rm(s.gewicht, s.wiederholungen))
        .filter(Boolean);
      if (!werte.length) continue;
      verlauf[uebung.schluessel] = verlauf[uebung.schluessel] || [];
      verlauf[uebung.schluessel].push({ datum: session.datum, e1rm: Math.max(...werte) });
    }
  }
  for (const liste of Object.values(verlauf)) liste.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  return verlauf;
}

export function bestwert(tests = [], art) {
  const passend = tests.filter((t) => t.art === art).map((t) => Number(t.wert) || 0);
  return passend.length ? Math.max(...passend) : 0;
}

export function zusatzlastAnteil(tests = [], gewichtKg) {
  if (!gewichtKg) return 0;
  const last = bestwert(tests, 'klimmzugZusatzlast');
  return last ? last / gewichtKg : 0;
}

