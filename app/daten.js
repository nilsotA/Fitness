// Die Schnittstelle zwischen Oberfläche und Daten.
//
// Vorher lag hier ein Netzwerkaufruf pro Aktion: Der Browser fragte den Server,
// der rechnete und schickte das Ergebnis zurück. Der Server rechnete dabei mit
// Modulen, die weder Netzwerk noch Dateisystem brauchen – die laufen im Browser
// genauso. Also rechnet der Browser jetzt selbst, und die Daten bleiben auf dem
// Gerät.
//
// Was das praktisch bedeutet: Der Tracker funktioniert ohne Empfang, ohne
// laufenden Rechner zu Hause und ohne dass irgendwo Gesundheitsdaten liegen,
// an die jemand anderes herankommt.

import { zustand as zustandRechnen } from '../kern/zustand.js';
import * as aendernM from '../kern/aendern.js';
import * as planM from '../kern/plan.js';
import * as leistungM from '../kern/leistung.js';
import * as profilM from '../kern/profil.js';
import { heute } from '../kern/regeln.js';
import {
  QUELLEN, SUPPLEMENTE, WOHLBEFINDEN, UEBUNGEN, SCHUTZZIELE, RISIKOSTUFEN,
  KRAFT, KRAFTMARKEN, MUSCLEUP_STUFEN,
} from '../kern/wissen.js';
import * as speicher from './speicher.js';

/* ------------------------------------------------------------- Lesen */

export async function zustand(datum = heute()) {
  return zustandRechnen(await speicher.laden(), datum);
}

export async function wochenplan(woche) {
  const daten = await speicher.laden();
  return planM.wochenplan(daten.profil, Math.max(1, Number(woche) || 1),
    leistungM.leistungsstand(daten));
}

export async function leistung() {
  const daten = await speicher.laden();
  return {
    ...leistungM.leistungsstand(daten),
    uebungen: UEBUNGEN,
    saetzeDieseWoche: leistungM.saetzeProWoche(daten.sessions),
    verlauf: uebungsVerlauf(daten.sessions),
  };
}

/** Verlauf je Übung: bestes geschätztes 1RM pro Trainingstag, für die Kurve. */
function uebungsVerlauf(sessions = []) {
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

export async function tests() {
  const daten = await speicher.laden();
  return { tests: daten.tests, marken: KRAFTMARKEN, stufen: MUSCLEUP_STUFEN };
}

export function wissen() {
  return {
    quellen: QUELLEN,
    supplemente: SUPPLEMENTE,
    wohlbefinden: WOHLBEFINDEN,
    uebungen: UEBUNGEN,
    schutzziele: SCHUTZZIELE,
    risikostufen: RISIKOSTUFEN,
    saetzeProMuskelWoche: KRAFT.saetzeProMuskelWoche,
  };
}

// Die Lebensmitteltabelle wird erst geholt, wenn jemand tatsächlich sucht –
// sie ist zwölf Kilobyte, die beim Start niemand braucht.
let lebensmittelCache = null;
export async function lebensmittel() {
  if (!lebensmittelCache) {
    lebensmittelCache = await (await fetch(new URL('../kern/lebensmittel.json', import.meta.url))).json();
  }
  return lebensmittelCache;
}

/* ------------------------------------------------------------ Schreiben */

const schreibt = (fn) => (...args) => speicher.aendern((daten) => fn(daten, ...args));

export const profilSpeichern = schreibt(aendernM.profilSpeichern);
export const sessionAnlegen = schreibt(aendernM.sessionAnlegen);
export const sessionAendern = schreibt(aendernM.sessionAendern);
export const sessionLoeschen = schreibt(aendernM.sessionLoeschen);
export const essenAnlegen = schreibt(aendernM.essenAnlegen);
export const essenLoeschen = schreibt(aendernM.essenLoeschen);
export const checkSpeichern = schreibt(aendernM.checkSpeichern);
export const gewichtSpeichern = schreibt(aendernM.gewichtSpeichern);
export const testAnlegen = schreibt(aendernM.testAnlegen);
export const testLoeschen = schreibt(aendernM.testLoeschen);
export const muscleupSpeichern = schreibt(aendernM.muscleupSpeichern);

/* ------------------------------------------------------- Sichern und Holen */

/**
 * Alles als Datei herunterladen.
 *
 * Das ist bei dieser Bauweise kein Zusatz, sondern die Sicherung: Die Daten
 * liegen auf dem Gerät, und ein Gerät kann verlorengehen. Deshalb erinnert die
 * Oberfläche daran, statt es unter „Sonstiges" zu verstecken.
 */
export async function exportieren() {
  await speicher.jetztSchreiben();
  const daten = await speicher.laden();
  const text = JSON.stringify(daten, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `trainingstagebuch-${heute()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, groesse: text.length };
}

/**
 * Eine Sicherung wieder einspielen. Vorher wird der aktuelle Stand als Datei
 * ausgegeben – ein versehentlicher Import darf keine Jahre kosten.
 */
export async function importieren(datei) {
  const roh = JSON.parse(await datei.text());
  const geprueft = aendernM.pruefeImport(roh);
  const alt = await speicher.laden();
  if (alt.sessions.length || alt.essen.length) await exportieren();
  await speicher.ersetzen(geprueft);
  return { ok: true };
}

export const { dauerhaftBitten, istDauerhaft } = speicher;
