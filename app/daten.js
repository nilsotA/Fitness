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

import { zustand as zustandRechnen, uebungsVerlauf } from '../kern/zustand.js';
import * as aendernM from '../kern/aendern.js';
import * as planM from '../kern/plan.js';
import * as leistungM from '../kern/leistung.js';
import * as ernaehrungM from '../kern/ernaehrung.js';
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

/**
 * Was zuletzt und häufig gegessen wurde – die eigentliche Vorauswahl beim
 * Eintragen. Kommt aus dem eigenen Verlauf, nicht aus der Nährwerttabelle.
 */
export async function haeufigeLebensmittel() {
  const daten = await speicher.laden();
  return ernaehrungM.haeufigeLebensmittel(daten.essen);
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
 * Alles als Datei sichern.
 *
 * Das ist bei dieser Bauweise kein Zusatz, sondern *die* Sicherung: Die Daten
 * liegen auf dem Gerät, und ein Gerät kann verlorengehen. Deshalb erinnert die
 * Oberfläche daran, statt es unter „Sonstiges" zu verstecken.
 */
async function sicherungsDatei() {
  // Nach einem Lesefehler steht im Arbeitsspeicher ein leeres Tagebuch. Eine
  // Sicherung daraus wäre nicht leer *und harmlos*, sondern eine Datei, die
  // beim Zurückspielen echte Daten überschreibt – mit einem Dateinamen, der
  // nach dem heutigen Stand aussieht.
  if (!speicher.ablage.gelesen) {
    throw new Error('Der bisherige Stand ließ sich nicht lesen. Eine Sicherung wäre leer und '
      + 'würde beim Zurückspielen echte Daten überschreiben. Bitte erst die App ganz '
      + 'schließen und neu öffnen.');
  }
  // Ein gescheiterter Schreibvorgang darf die Sicherung dagegen **nicht**
  // verhindern: Genau dann sagt die App „lade sofort eine Sicherung herunter,
  // solange die Daten noch geladen sind" – und dieser Aufruf hätte den Rat
  // unausführbar gemacht. Das Wegschreiben ist hier ohnehin nur ein zweites
  // Netz; geschrieben wird längst sofort bei jeder Änderung.
  try {
    await speicher.jetztSchreiben();
  } catch { /* Der Grund steht bereits in `ablage` und oben in der Warnung. */ }
  const daten = await speicher.laden();
  const text = JSON.stringify(daten, null, 2);
  return new File([text], `trainingstagebuch-${heute()}.json`,
    { type: 'application/json' });
}

/** Kann das Gerät Dateien über den Teilen-Dialog weitergeben? */
export function kannTeilen() {
  try {
    return Boolean(navigator.canShare?.({
      files: [new File(['{}'], 'probe.json', { type: 'application/json' })],
    }));
  } catch {
    return false;
  }
}

/**
 * Sicherung über den Teilen-Dialog des Geräts.
 *
 * Auf dem iPhone ist das der deutlich kürzere Weg: AirDrop steht direkt im
 * Dialog, die Datei ist mit zwei Tipps auf dem Laptop. Der Umweg über
 * Herunterladen, Dateien-App und dortiges Teilen entfällt.
 */
export async function teilen() {
  const datei = await sicherungsDatei();
  await navigator.share({
    files: [datei],
    title: 'Trainingstagebuch',
  });
  return { ok: true, groesse: datei.size };
}

export async function exportieren() {
  const datei = await sicherungsDatei();
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name;
  a.click();
  // Erst nach dem Klick freigeben, sonst ist die Adresse schon ungültig.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { ok: true, groesse: datei.size };
}

/**
 * Was würde das Einspielen dieser Datei bedeuten?
 *
 * Beide Seiten nebeneinander, bevor etwas passiert. Wer zwischen Handy und
 * Laptop hin- und herschiebt, erwischt irgendwann die ältere Datei – und ein
 * Ersetzen ohne Rückfrage kostet dann genau die Einträge, die man zuletzt
 * gemacht hat.
 */
export async function importVorschau(datei) {
  const geprueft = aendernM.ausSicherungsText(await datei.text());
  const ausDerDatei = aendernM.bestandsUebersicht(geprueft);
  const bisher = aendernM.bestandsUebersicht(await speicher.laden());

  return {
    geprueft,
    datei: ausDerDatei,
    bisher,
    // Nur dann warnen, wenn beide Seiten überhaupt etwas enthalten.
    aelter: Boolean(bisher.letztesDatum && ausDerDatei.letztesDatum
      && ausDerDatei.letztesDatum < bisher.letztesDatum),
    leert: bisher.eintraege > 0 && ausDerDatei.eintraege === 0,
  };
}

/**
 * Eine geprüfte Sicherung übernehmen. Vorher wird der bisherige Stand als
 * Datei ausgegeben – ein versehentlicher Import darf keine Jahre kosten.
 */
export async function importUebernehmen(geprueft) {
  const alt = await speicher.laden();
  if (alt.sessions.length || alt.essen.length) await exportieren();
  await speicher.ersetzen(geprueft);
  return { ok: true };
}

export const { dauerhaftBitten, istDauerhaft, beiProblem, ablage } = speicher;

/**
 * Bereits protokollierte Einheiten eines Tages.
 *
 * Gebraucht beim Übernehmen aus einer Datei: Wer eine Einheit erst von Hand
 * einträgt und später die Datei importiert, hätte sie sonst zweimal – und
 * doppelte Einheiten verfälschen jede Belastungsrechnung.
 */
export async function einheitenAmTag(datum) {
  const daten = await speicher.laden();
  return daten.sessions.filter((s) => s.datum === datum);
}
