// Alles, was den Datenbestand verändert – als reine Funktionen.
//
// Jede bekommt den kompletten Bestand und die Eingabe, ändert den Bestand und
// gibt zurück, was der Aufrufer anzeigen will. Kein Netzwerk, kein Dateisystem,
// keine Datenbank: Wo die Daten herkommen und wohin sie danach geschrieben
// werden, entscheidet der Aufrufer.
//
// Damit steht die Prüfung der Eingaben genau einmal im Code, statt einmal im
// Browser und einmal im Server. Wer sie nur an einer Stelle hätte, hätte sie
// über kurz oder lang in zwei Fassungen.

import * as profilM from './profil.js';
import * as ausdauerM from './ausdauer.js';
import * as sprintM from './sprint.js';
import * as belastung from './belastung.js';
import { UEBUNGEN, WOHLBEFINDEN } from './wissen.js';
import { heute } from './regeln.js';
import { uebungenPruefen, bestwert, zusatzlastAnteil } from './zustand.js';

/** Leerer Datenbestand – die Form, auf die sich alles andere verlässt. */
export function leeresTagebuch() {
  return {
    version: 1,
    profil: profilM.createProfil(),
    sessions: [],
    essen: [],
    checks: [],
    tests: [],
    muscleup: { manuell: {} },
    gewicht: [],
    angelegt: new Date().toISOString(),
  };
}

/**
 * Einen geladenen Bestand auf die aktuelle Form bringen.
 *
 * Ein Tagebuch aus einer älteren Fassung kennt Felder nicht, die inzwischen
 * dazugekommen sind. Auffüllen statt abstürzen – die Daten sind das Wertvolle,
 * der Code ist ersetzbar.
 */
export function vervollstaendigen(roh = {}) {
  const bestand = { ...leeresTagebuch(), ...roh };
  bestand.profil = { ...profilM.createProfil(), ...(roh.profil || {}) };
  bestand.muscleup = { manuell: {}, ...(roh.muscleup || {}) };
  return bestand;
}

export function id(praefix = 'e') {
  return `${praefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

/* -------------------------------------------------------------- Profil */

const ZAHLENFELDER = ['groesseCm', 'gewichtKg', 'koerperfettProzent', 'geburtsjahr',
  'ausrichtung', 'trainingstageProWoche', 'hfMaxGemessen'];

export function profilSpeichern(daten, eingabe = {}) {
  daten.profil = { ...daten.profil, ...eingabe };
  // Zahlenfelder kommen aus Formularen als Text zurück.
  for (const feld of ZAHLENFELDER) {
    if (daten.profil[feld] === '' || daten.profil[feld] == null) daten.profil[feld] = null;
    else daten.profil[feld] = Number(daten.profil[feld]);
  }
  // Gewichtsänderung wandert in den Verlauf, damit die Kurve stimmt.
  if (eingabe.gewichtKg) {
    const datum = heute();
    const vorhanden = daten.gewicht.find((g) => g.datum === datum);
    if (vorhanden) vorhanden.kg = Number(eingabe.gewichtKg);
    else daten.gewicht.push({ datum, kg: Number(eingabe.gewichtKg) });
  }
  return daten.profil;
}

/* ------------------------------------------------------------ Einheiten */

export function sessionAnlegen(daten, e = {}) {
  if (!e.typ || !e.minuten) throw new Error('Typ und Dauer fehlen.');
  const eintrag = {
    id: id('s'),
    datum: e.datum || heute(),
    typ: e.typ,
    titel: e.titel || '',
    minuten: Number(e.minuten) || 0,
    rpe: profilM.clamp(Number(e.rpe) || 0, 0, 10),
    notiz: e.notiz || '',
    uebungen: uebungenPruefen(e.uebungen),
    laeufe: sprintM.pruefeLaeufe(e.laeufe),
    strecke: ausdauerM.pruefeStrecke(e.strecke),
    hfSchnitt: ausdauerM.pruefePuls(e.hfSchnitt),
  };
  eintrag.last = belastung.sessionLast(eintrag.rpe, eintrag.minuten);
  daten.sessions.push(eintrag);
  return eintrag;
}

export function sessionAendern(daten, id_, e = {}) {
  const session = daten.sessions.find((s) => s.id === id_);
  if (!session) return null;
  if (e.minuten != null) session.minuten = Number(e.minuten) || 0;
  if (e.rpe != null) session.rpe = profilM.clamp(Number(e.rpe) || 0, 0, 10);
  if (e.notiz != null) session.notiz = e.notiz;
  if (e.uebungen != null) session.uebungen = uebungenPruefen(e.uebungen);
  if (e.laeufe != null) session.laeufe = sprintM.pruefeLaeufe(e.laeufe);
  if (e.strecke != null) session.strecke = ausdauerM.pruefeStrecke(e.strecke);
  if (e.hfSchnitt != null) session.hfSchnitt = ausdauerM.pruefePuls(e.hfSchnitt);
  session.last = belastung.sessionLast(session.rpe, session.minuten);
  return session;
}

export function sessionLoeschen(daten, id_) {
  daten.sessions = daten.sessions.filter((s) => s.id !== id_);
  return { ok: true };
}

/* ---------------------------------------------------------------- Essen */

export function essenAnlegen(daten, e = {}) {
  if (!e.name || !e.mengeG) throw new Error('Name und Menge fehlen.');
  const eintrag = {
    id: id('f'),
    datum: e.datum || heute(),
    mahlzeit: e.mahlzeit || 'sonstiges',
    name: e.name,
    mengeG: Number(e.mengeG) || 0,
    kcal: Number(e.kcal) || 0,
    protein: Number(e.protein) || 0,
    kohlenhydrate: Number(e.kohlenhydrate) || 0,
    fett: Number(e.fett) || 0,
    alkohol: Number(e.alkohol) || 0,
  };
  daten.essen.push(eintrag);
  return eintrag;
}

export function essenLoeschen(daten, id_) {
  daten.essen = daten.essen.filter((e) => e.id !== id_);
  return { ok: true };
}

/* --------------------------------------------------------- Morgen-Check */

export function checkSpeichern(daten, e = {}) {
  const datum = e.datum || heute();
  const eintrag = { datum };
  for (const frage of WOHLBEFINDEN) {
    eintrag[frage.id] = profilM.clamp(Number(e[frage.id]) || 0, 0, 5);
  }
  // Freiwillig – ein Check ohne Ruhepuls bleibt ein vollständiger Check.
  eintrag.ruhepuls = ausdauerM.pruefePuls(e.ruhepuls);
  eintrag.notiz = e.notiz || '';
  // Ein Tag, ein Check: Der neue ersetzt den alten.
  daten.checks = daten.checks.filter((c) => c.datum !== datum);
  daten.checks.push(eintrag);
  return { ...eintrag, bereitschaft: belastung.bereitschaft(eintrag) };
}

/* -------------------------------------------------------------- Gewicht */

export function gewichtSpeichern(daten, e = {}) {
  const kg = Number(e.kg);
  if (!kg) throw new Error('Gewicht fehlt.');
  const datum = e.datum || heute();
  // Ein Tag, ein Wert – ein zweites Wiegen ersetzt das erste, statt die Kurve
  // mit zwei Punkten am selben Tag zu verzacken.
  daten.gewicht = daten.gewicht.filter((g) => g.datum !== datum);
  daten.gewicht.push({ datum, kg });
  daten.gewicht.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  // Das aktuellste Gewicht ist zugleich das Profilgewicht – sonst rechnet die
  // Ernährung mit einem veralteten Wert weiter.
  const neuestes = daten.gewicht[daten.gewicht.length - 1];
  if (neuestes.datum >= heute()) daten.profil.gewichtKg = neuestes.kg;
  return { ok: true, datum, kg };
}

/* ---------------------------------------------------------------- Tests */

export function testAnlegen(daten, e = {}) {
  if (!e.art || e.wert == null) throw new Error('Testart und Wert fehlen.');
  const eintrag = {
    id: id('t'),
    datum: e.datum || heute(),
    art: e.art,
    wert: Number(e.wert),
    wiederholungen: e.wiederholungen != null ? Number(e.wiederholungen) : null,
    notiz: e.notiz || '',
  };
  daten.tests.push(eintrag);
  return eintrag;
}

export function testLoeschen(daten, id_) {
  daten.tests = daten.tests.filter((t) => t.id !== id_);
  return { ok: true };
}

/* ------------------------------------------------------------ Muscle-Up */

export function muscleupSpeichern(daten, e = {}) {
  daten.muscleup = daten.muscleup || { manuell: {} };
  daten.muscleup.manuell[String(e.stufe)] = Boolean(e.erreicht);
  return profilM.muscleupStand({
    klimmzuege: bestwert(daten.tests, 'klimmzuege'),
    muscleups: bestwert(daten.tests, 'muscleups'),
    zusatzlastAnteil: zusatzlastAnteil(daten.tests, daten.profil.gewichtKg),
    manuell: daten.muscleup.manuell,
  });
}

/* --------------------------------------------------------------- Import */

/**
 * Eingespielte Daten prüfen, bevor sie den Bestand ersetzen.
 *
 * Eine kaputte Datei darf ein jahrelang geführtes Tagebuch nicht überschreiben.
 * Deshalb muss erkennbar sein, dass es überhaupt ein Tagebuch ist.
 */
export function pruefeImport(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Keine lesbaren Daten.');
  if (!Array.isArray(roh.sessions) || !roh.profil) {
    throw new Error('Das sieht nicht nach einem Tracker-Export aus.');
  }
  return vervollstaendigen(roh);
}

/**
 * Kurzfassung eines Bestands: wie viel steht drin und bis wann.
 *
 * Gebraucht, um vor dem Einspielen beide Seiten nebeneinanderzustellen. Wer
 * zwischen zwei Geräten hin- und herschiebt, erwischt irgendwann die ältere
 * Datei – und ein Ersetzen ohne Rückfrage kostet dann genau die Einträge, die
 * man zuletzt gemacht hat.
 */
export function bestandsUebersicht(daten = {}) {
  const datumsWerte = [
    ...(daten.sessions || []).map((s) => s.datum),
    ...(daten.essen || []).map((e) => e.datum),
    ...(daten.checks || []).map((c) => c.datum),
    ...(daten.tests || []).map((t) => t.datum),
    ...(daten.gewicht || []).map((g) => g.datum),
  ].filter(Boolean).sort();

  return {
    sessions: (daten.sessions || []).length,
    essen: (daten.essen || []).length,
    checks: (daten.checks || []).length,
    tests: (daten.tests || []).length,
    letztesDatum: datumsWerte.length ? datumsWerte[datumsWerte.length - 1] : null,
    eintraege: datumsWerte.length,
  };
}

// UEBUNGEN wird von uebungenPruefen gebraucht und hier nur re-exportiert, damit
// Aufrufer nicht zusätzlich wissen.js einbinden müssen.
export { UEBUNGEN };
