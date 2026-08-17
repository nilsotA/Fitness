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
import { heute, zahlAusEingabe, menge } from './regeln.js';
import { uebungenPruefen } from './zustand.js';

/**
 * Zahl aus einem Formularfeld – mit Komma, und ohne stilles Nullsetzen.
 *
 * `Number(x) || 0` war überall im Einsatz und hat zwei Dinge vermengt: „nichts
 * eingetragen" und „etwas eingetragen, das ich nicht lesen kann". Das Erste
 * darf ein Vorgabewert sein, das Zweite nicht – sonst steht die Mahlzeit mit
 * 0 kcal im Tagebuch und niemand erfährt davon.
 */
function zahlFeld(wert, name, vorgabe = 0) {
  if (wert == null || wert === '') return vorgabe;
  const zahl = zahlAusEingabe(wert);
  if (zahl == null) throw new Error(`${name}: „${wert}" ist keine Zahl.`);
  return zahl;
}

/**
 * Geprüfte Felder in einen bestehenden Eintrag übernehmen – alle oder keins.
 *
 * `speicher.aendern()` ruft diese Funktionen auf dem **lebenden** Bestand auf
 * und schreibt erst danach. Wirft eine Prüfung mittendrin, ist nichts
 * gespeichert – aber die Felder davor sind im Arbeitsspeicher schon gesetzt,
 * und der nächste beliebige Schreibvorgang macht die halbe Änderung dauerhaft.
 * Bei einem Formular mit sechs Zahlenfeldern ist „eins davon unlesbar" der
 * Normalfall, nicht der Ausnahmefall.
 *
 * Deshalb: erst alles umrechnen, dann alles setzen. `null` und `undefined`
 * heissen „nicht mitgeschickt" und lassen den alten Wert stehen. Wer ein Feld
 * ausdrücklich leeren muss, tut das nach dem Aufruf – siehe die
 * Wiederholungen in `testAendern()`.
 */
function uebernehmen(eintrag, felder) {
  for (const [name, wert] of Object.entries(felder)) {
    if (wert != null) eintrag[name] = wert;
  }
  return eintrag;
}

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
    else daten.profil[feld] = zahlFeld(daten.profil[feld], feld, null);
  }
  // Gewichtsänderung wandert in den Verlauf, damit die Kurve stimmt.
  // Aus dem bereits geprüften Profil lesen, nicht noch einmal aus der rohen
  // Eingabe: Vorher stand hier `Number(eingabe.gewichtKg)`, und ein Komma
  // schrieb ein NaN in den Verlauf, während das Profil sauber auf null ging.
  if (daten.profil.gewichtKg) {
    const datum = heute();
    const vorhanden = daten.gewicht.find((g) => g.datum === datum);
    if (vorhanden) vorhanden.kg = daten.profil.gewichtKg;
    else daten.gewicht.push({ datum, kg: daten.profil.gewichtKg });
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
    minuten: zahlFeld(e.minuten, 'Dauer'),
    rpe: profilM.clamp(zahlFeld(e.rpe, 'RPE'), 0, 10),
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
  // Auch die Art lässt sich korrigieren – wer eine Ausfahrt versehentlich als
  // Intervalleinheit protokolliert, verschiebt sonst die Intensitätsverteilung
  // und kann es nur durch Löschen richtigstellen. Ohne Typ geht nichts, das
  // ist dieselbe Bedingung wie beim Anlegen.
  // Erst alles prüfen, dann alles setzen – `pruefeLaeufe`, `pruefeStrecke`
  // und `pruefePuls` werfen alle drei, und bis dahin stünden Art, Dauer und
  // RPE schon geändert im Arbeitsspeicher. Siehe `uebernehmen()`.
  uebernehmen(session, {
    typ: e.typ || null,
    titel: e.titel,
    minuten: e.minuten != null ? zahlFeld(e.minuten, 'Dauer') : null,
    rpe: e.rpe != null ? profilM.clamp(zahlFeld(e.rpe, 'RPE'), 0, 10) : null,
    notiz: e.notiz,
    uebungen: e.uebungen != null ? uebungenPruefen(e.uebungen) : null,
    laeufe: e.laeufe != null ? sprintM.pruefeLaeufe(e.laeufe) : null,
    strecke: e.strecke != null ? ausdauerM.pruefeStrecke(e.strecke) : null,
    hfSchnitt: e.hfSchnitt != null ? ausdauerM.pruefePuls(e.hfSchnitt) : null,
  });
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
    mengeG: zahlFeld(e.mengeG, 'Menge'),
    kcal: zahlFeld(e.kcal, 'Kalorien'),
    protein: zahlFeld(e.protein, 'Protein'),
    kohlenhydrate: zahlFeld(e.kohlenhydrate, 'Kohlenhydrate'),
    fett: zahlFeld(e.fett, 'Fett'),
    alkohol: zahlFeld(e.alkohol, 'Alkohol'),
  };
  daten.essen.push(eintrag);
  return eintrag;
}

/**
 * Einen Essenseintrag nachträglich korrigieren.
 *
 * Der häufigste Fall ist die Menge: 150 g statt 15 g. Ohne diesen Weg bleibt
 * nur Löschen und alle sechs Felder neu eintragen – dieselbe Lücke, die
 * Falle 81 bei der Einheit hatte, nur an der Stelle, die man mehrmals am Tag
 * bedient.
 *
 * Name und Menge dürfen nicht leergeräumt werden: Ein Eintrag ohne Menge
 * zählt mit nichts in die Summe (Falle 60), und über das Anlegen kann er gar
 * nicht erst entstehen. Was der eine Weg verbietet, darf der andere nicht
 * erlauben.
 */
export function essenAendern(daten, id_, e = {}) {
  const eintrag = daten.essen.find((x) => x.id === id_);
  if (!eintrag) return null;
  if (e.name != null && !String(e.name).trim()) throw new Error('Name fehlt.');
  if (e.mengeG === '') throw new Error('Menge fehlt.');
  // Erst alles prüfen, dann alles setzen – siehe `uebernehmen()`. Sechs
  // Zahlenfelder aus einem Formular, da ist eins davon irgendwann unlesbar.
  return uebernehmen(eintrag, {
    name: e.name,
    datum: e.datum || null,
    mahlzeit: e.mahlzeit || null,
    mengeG: e.mengeG != null ? zahlFeld(e.mengeG, 'Menge') : null,
    kcal: e.kcal != null ? zahlFeld(e.kcal, 'Kalorien') : null,
    protein: e.protein != null ? zahlFeld(e.protein, 'Protein') : null,
    kohlenhydrate: e.kohlenhydrate != null ? zahlFeld(e.kohlenhydrate, 'Kohlenhydrate') : null,
    fett: e.fett != null ? zahlFeld(e.fett, 'Fett') : null,
    alkohol: e.alkohol != null ? zahlFeld(e.alkohol, 'Alkohol') : null,
  });
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
    eintrag[frage.id] = profilM.clamp(zahlFeld(e[frage.id], frage.frage), 0, 5);
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
  const kg = zahlFeld(e.kg, 'Gewicht', null);
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
    wert: zahlFeld(e.wert, 'Wert', null),
    wiederholungen: zahlFeld(e.wiederholungen, 'Wiederholungen', null),
    notiz: e.notiz || '',
  };
  daten.tests.push(eintrag);
  return eintrag;
}

/**
 * Einen Leistungstest nachträglich korrigieren.
 *
 * Teurer als er aussieht: Aus Testart, Wert und Wiederholungen schätzt
 * `einerMaxima()` das Einer-Maximum, und daran hängt jede Lastvorgabe des
 * Wochenplans. Wer sich bei „Kniebeuge 105 kg" um eine Stelle vertippt,
 * verschiebt still jede Prozentangabe der nächsten Wochen – und konnte das
 * bisher nur durch Löschen und vollständiges Neueintragen richtigstellen.
 *
 * Die Wiederholungen werden auf `undefined` geprüft und nicht auf `null`:
 * Wer von „Kniebeuge" auf „Cooper-Test" wechselt, muss sie **löschen**
 * können, sonst bliebe eine Zahl stehen, die zur neuen Testart nicht gehört
 * und trotzdem in die Epley-Schätzung liefe.
 */
export function testAendern(daten, id_, e = {}) {
  const test = daten.tests.find((t) => t.id === id_);
  if (!test) return null;
  const wert = e.wert != null ? zahlFeld(e.wert, 'Wert', null) : null;
  if (e.wert != null && wert == null) throw new Error('Wert fehlt.');
  const geaendert = uebernehmen(test, {
    art: e.art || null,
    datum: e.datum || null,
    wert,
    notiz: e.notiz,
  });
  // Ausserhalb von `uebernehmen()`, weil hier ausdrücklich `null` gesetzt
  // werden können muss – dort bedeutet `null` „nicht mitgeschickt".
  if (e.wiederholungen !== undefined) {
    geaendert.wiederholungen = zahlFeld(e.wiederholungen, 'Wiederholungen', null);
  }
  return geaendert;
}

export function testLoeschen(daten, id_) {
  daten.tests = daten.tests.filter((t) => t.id !== id_);
  return { ok: true };
}

/* ------------------------------------------------------------ Muscle-Up */

export function muscleupSpeichern(daten, e = {}) {
  daten.muscleup = daten.muscleup || { manuell: {} };
  daten.muscleup.manuell[String(e.stufe)] = Boolean(e.erreicht);
  return profilM.muscleupStandAus(daten);
}

/* --------------------------------------------------------------- Import */

/**
 * Eingespielte Daten prüfen, bevor sie den Bestand ersetzen.
 *
 * Eine kaputte Datei darf ein jahrelang geführtes Tagebuch nicht überschreiben.
 * Deshalb muss erkennbar sein, dass es überhaupt ein Tagebuch ist.
 */
/**
 * Die Listen eines Tagebuchs und wie sie in einer Meldung heißen.
 *
 * `muscleup` und `profil` sind Objekte und stehen deshalb nicht hier – sie
 * werden einzeln geprüft.
 */
const LISTEN = {
  sessions: 'Tagebuch',
  essen: 'Ernährungstagebuch',
  checks: 'Morgen-Checks',
  tests: 'Leistungstests',
  gewicht: 'Gewichtsverlauf',
};

/**
 * Eine Sicherung prüfen, bevor sie den Bestand ersetzt.
 *
 * **Warum das hier gründlicher sein muss als anderswo:** Das Einspielen ist
 * die einzige Stelle, an der alles auf einmal überschrieben wird. Geprüft
 * wurde bisher nur die Hülle – `sessions` ist ein Array, `profil` existiert.
 * Der Inhalt ging ungeprüft durch, und zwei Fälle hatten es in sich:
 *
 * - `essen` als Objekt statt Array liess `daten.essen.filter` beim Aufbau des
 *   Zustands werfen,
 * - ein einzelner `null`-Eintrag in `sessions` ebenso.
 *
 * In beiden Fällen war der alte Bestand da schon ersetzt: Die App warf beim
 * Öffnen, ließ sich nicht mehr bedienen, und die eigenen Daten waren weg. Das
 * ist der teuerste Fehler, den dieser Tracker machen kann – teurer als jede
 * falsche Zahl.
 *
 * Geprüft wird die Form, nicht jeder Wert: Eine Sicherung mit 5000 Einträgen
 * Zeile für Zeile zu validieren wäre ein eigenes Vorhaben und würde bei einem
 * einzigen krummen Wert alles verwerfen. Was hier zählt, ist die Frage: Kann
 * die App mit dieser Datei überhaupt starten?
 *
 * Abgelehnt wird mit Angabe der Stelle. Ein „Die Datei ist beschädigt" ohne
 * Ortsangabe ließe nur raten, ob es an der Datei oder am Tracker liegt.
 */
export function pruefeImport(roh) {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) {
    throw new Error('Keine lesbaren Daten.');
  }
  if (!Array.isArray(roh.sessions) || !roh.profil) {
    throw new Error('Das sieht nicht nach einem Tracker-Export aus.');
  }
  if (typeof roh.profil !== 'object' || Array.isArray(roh.profil)) {
    throw new Error('Das Profil in dieser Sicherung ist beschädigt. Ohne Profil kann der '
      + 'Tracker nichts rechnen – bitte eine andere Sicherung nehmen.');
  }

  for (const [feld, name] of Object.entries(LISTEN)) {
    const liste = roh[feld];
    if (liste == null) continue; // fehlt ganz – vervollstaendigen() legt eine leere an
    if (!Array.isArray(liste)) {
      throw new Error(`„${name}" liegt in dieser Sicherung nicht als Liste vor. Die Datei ist `
        + 'beschädigt; eingespielt wird nichts, dein bisheriger Stand bleibt unangetastet.');
    }
    const leere = liste.filter((e) => !e || typeof e !== 'object').length;
    if (leere) {
      throw new Error(`${menge(leere, 'Eintrag', 'Einträge')} in „${name}" `
        + `${leere === 1 ? 'ist' : 'sind'} leer oder unlesbar (von ${liste.length}). Die `
        + 'Sicherung ist beschädigt; eingespielt wird nichts, dein bisheriger Stand bleibt '
        + 'unangetastet.');
    }
  }

  if (roh.muscleup != null && (typeof roh.muscleup !== 'object' || Array.isArray(roh.muscleup))) {
    throw new Error('Der Muscle-Up-Stand in dieser Sicherung ist beschädigt.');
  }

  return vervollstaendigen(roh);
}

/**
 * Eine Sicherungsdatei aus ihrem Text lesen – mit Meldungen, die weiterhelfen.
 *
 * `JSON.parse` wirft englische Parsermeldungen wie „Expected ',' or '}' after
 * property value in JSON at position 35". Die standen bisher in einer sonst
 * durchweg deutschen Oberfläche, und vor allem sagen sie nicht, was zu tun ist.
 *
 * Der wahrscheinlichste Fehlgriff ist dabei nicht die kaputte Datei, sondern
 * die falsche: Der Tracker liest an anderer Stelle GPX- und TCX-Dateien ein,
 * die liegen auf demselben Gerät im selben Ordner, und beim Zurückspielen einer
 * Sicherung greift man leicht daneben. Dieser Fall bekommt deshalb einen
 * eigenen Satz statt „Unexpected token '<'".
 *
 * Steht in `kern/`, damit die Prüfung an einer Stelle liegt und in Node
 * geprüft werden kann – nicht im Dialog, der die Datei aufmacht.
 */
export function ausSicherungsText(text) {
  const inhalt = String(text ?? '').trim();
  if (!inhalt) throw new Error('Die Datei ist leer. Vermutlich ist beim Übertragen etwas schiefgegangen.');

  if (inhalt.startsWith('<')) {
    throw new Error('Das ist eine XML-Datei, keine Sicherung – sieht nach einem GPX- oder '
      + 'TCX-Export aus. Einzelne Einheiten daraus trägst du unter „Heute" über '
      + '„Aus Lauf-App übernehmen" ein.');
  }

  let roh;
  try {
    roh = JSON.parse(inhalt);
  } catch {
    // Zwischen „kaputt" und „gar keine Sicherung" unterscheiden: Fängt der
    // Text wie ein Tagebuch an, ist er unterwegs abgeschnitten worden.
    throw new Error(inhalt.startsWith('{')
      ? 'Die Sicherung ist unvollständig – beim Übertragen abgebrochen. Bitte die '
        + 'Datei noch einmal übertragen.'
      : 'Die Datei lässt sich nicht lesen. Erwartet wird eine Sicherung des Trackers '
        + '(eine .json-Datei, die mit „trainingstagebuch-" beginnt).');
  }

  return pruefeImport(roh);
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
