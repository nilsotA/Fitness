// Profil, Körperdaten und der Ausrichtungsregler.
//
// Reine Rechenfunktionen ohne Netzwerk oder Dateizugriff – damit testbar.

import { KRAFTMARKEN, MUSCLEUP_STUFEN, EPLEY, AUSRICHTUNG_UMFANG } from './wissen.js';

/**
 * Der Regler entscheidet, wie der Wochenplan aussieht. 0 heißt reiner
 * Schnellkraftathlet, 100 heißt Ausdauersportler. Nils sitzt bewusst nicht
 * fest auf einem Wert, deshalb ist das eine Zahl und keine Entweder-oder-Wahl:
 * Der Plan verschiebt sich stufenlos mit, ohne dass irgendwas neu aufgesetzt
 * werden muss.
 */
export const AUSRICHTUNG = {
  min: 0,
  max: 100,
  marken: [
    { wert: 0, name: 'Reiner Sprint', beschreibung: 'Alles auf Schnelligkeit und Maximalkraft. Ausdauer nur als Erholungsmittel.' },
    { wert: 25, name: 'Sprint mit Grundlage', beschreibung: 'Schwerpunkt Sprint und Kraft, dazu eine belastbare aerobe Basis.' },
    { wert: 50, name: 'Hybrid', beschreibung: 'Schnelligkeit, Kraft und Ausdauer gleichrangig. Der Kompromiss kostet an beiden Enden etwas.' },
    { wert: 75, name: 'Ausdauer mit Spritzigkeit', beschreibung: 'Schwerpunkt Ausdauer, Sprint und Kraft halten das Tempo oben.' },
    { wert: 100, name: 'Reine Ausdauer', beschreibung: 'Alles auf aerobe Leistung. Krafttraining nur noch erhaltend.' },
  ],
};

export function createProfil() {
  return {
    name: '',
    geburtsjahr: null,
    geschlecht: 'm', // beeinflusst nur den Grundumsatz nach Mifflin-St Jeor
    groesseCm: null,
    gewichtKg: null,
    koerperfettProzent: null, // optional – macht den Grundumsatz treffsicherer
    ausrichtung: 30, // Sprint-lastig mit Grundlage, siehe AUSRICHTUNG
    trainingstageProWoche: 4,
    // Alltagsbewegung ohne Training. Das Training rechnet der Planer separat
    // dazu, sonst wird es doppelt gezählt.
    alltagsaktivitaet: 'mittel', // sitzend | leicht | mittel | hoch
    ausdauerGeraet: 'rad', // rad | rudern | laufen | schwimmen | crosstrainer
    // Optional: gemessener Maximalpuls aus einem Ausbelastungstest. Ohne ihn
    // wird aus dem Alter geschätzt – das reicht für eine grobe Einordnung,
    // aber nicht für Zonengrenzen, auf die man sich verlässt.
    hfMaxGemessen: null,
    // Der Ruhepuls steht bewusst *nicht* hier, sondern je Tag im Morgen-Check:
    // Als fester Profilwert veraltet er und hat nichts, womit er sich
    // vergleichen ließe. Aussagekräftig ist allein die Abweichung von der
    // eigenen Grundlinie.
    koerpergewichtsfokus: true, // Muscle-Up und Liegestütze mit einplanen
    // Frontkniebeuge statt Nackenkniebeuge, Sechskantstange statt gerader
    // Stange: vergleichbarer Reiz bei deutlich geringerer Belastung der
    // Lendenwirbelsäule. Standard an – wer die klassischen Varianten will,
    // schaltet es ab.
    gelenkschonend: true,
    kalorienziel: 'halten', // aufbauen | halten | abnehmen
    startdatum: null, // ab wann der Plan zählt
    wiedereinstieg: true, // erste zwei Wochen mit reduziertem Umfang
    notizen: '',
  };
}

/**
 * Aktivitätsfaktoren **ohne** Sport.
 *
 * Die geläufigen PAL-Werte (1,2 sitzend bis 1,725 sehr aktiv) schließen
 * Training bereits ein. Hier rechnet der Planer das Training separat dazu –
 * also müssen diese Faktoren deutlich niedriger liegen, sonst wird der
 * Trainingsumsatz doppelt gezählt. Bei drei Stunden Training am Tag ergäbe
 * das schnell 700 kcal Fehler nach oben.
 */
const ALLTAGSFAKTOR = {
  sitzend: 1.15,
  leicht: 1.25,
  mittel: 1.35,
  hoch: 1.5,
};

export function alltagsfaktor(profil) {
  return ALLTAGSFAKTOR[profil?.alltagsaktivitaet] ?? ALLTAGSFAKTOR.mittel;
}

export function alter(profil, heute = new Date()) {
  if (!profil?.geburtsjahr) return null;
  return heute.getFullYear() - Number(profil.geburtsjahr);
}

/** Fettfreie Masse – Basis für Energieverfügbarkeit und Proteinbedarf im Defizit. */
export function fettfreieMasse(profil) {
  const kg = Number(profil?.gewichtKg);
  const kfa = Number(profil?.koerperfettProzent);
  if (!kg) return null;
  if (!kfa && kfa !== 0) return null;
  return round(kg * (1 - kfa / 100), 1);
}

/**
 * Wie sich der Regler auf die Wochenstruktur auswirkt. Die Anteile summieren
 * sich auf 1 und werden im Planer in ganze Einheiten übersetzt.
 */
export function schwerpunkte(ausrichtung) {
  const a = clamp(Number(ausrichtung) || 0, 0, 100) / 100;
  // Sprint und Kraft geben linear ab, Ausdauer nimmt zu. Kraft fällt flacher
  // als Sprint, weil auch Ausdauersportler Kraft brauchen – nur andere.
  const sprint = 0.40 * (1 - a) + 0.05;
  const kraft = 0.40 - 0.15 * a;
  const ausdauer = 0.15 + 0.50 * a;
  const summe = sprint + kraft + ausdauer;
  return {
    sprint: round(sprint / summe, 3),
    kraft: round(kraft / summe, 3),
    ausdauer: round(ausdauer / summe, 3),
  };
}

/**
 * Umfangsfaktoren aus dem Reglerstand – linear zwischen den beiden Anschlägen.
 *
 * `schwerpunkte()` sagt, *wie viele* Einheiten welcher Art; das hier sagt, wie
 * umfangreich sie sind. Beides zusammen macht aus jedem Reglerschritt eine
 * sichtbare Änderung, statt zwanzig Stellungen auf sieben Wochen zu werfen.
 */
export function umfangFaktoren(ausrichtung) {
  const a = clamp(Number(ausrichtung) || 0, 0, 100) / 100;
  const mische = ({ beiSprint, beiAusdauer }) => round(beiSprint + (beiAusdauer - beiSprint) * a, 3);
  return {
    sprint: mische(AUSRICHTUNG_UMFANG.sprintMeter),
    ausdauer: mische(AUSRICHTUNG_UMFANG.ausdauerMinuten),
  };
}

/** Klartext zum aktuellen Reglerstand. */
export function ausrichtungName(ausrichtung) {
  const wert = clamp(Number(ausrichtung) || 0, 0, 100);
  let treffer = AUSRICHTUNG.marken[0];
  for (const marke of AUSRICHTUNG.marken) {
    if (wert >= marke.wert) treffer = marke;
  }
  return treffer;
}

/**
 * Welches Ausdauergerät passt? Laufen bringt den größten Interferenzeffekt
 * mit (Wilson 2012) – bei Sprintfokus ist das Rad die bessere Wahl, bei
 * Ausdauerfokus führt am Laufen kein Weg vorbei, weil Spezifität zählt.
 */
export function ausdauerEmpfehlung(profil) {
  const a = clamp(Number(profil?.ausrichtung) || 0, 0, 100);
  if (a <= 35) {
    return {
      geraet: 'rad',
      begruendung: 'Bei Sprintfokus stört Radfahren die Kraftentwicklung am wenigsten. '
        + 'Laufen erzeugt exzentrische Muskelschäden, die dem Krafttraining im Weg stehen.',
    };
  }
  if (a >= 65) {
    return {
      geraet: 'laufen',
      begruendung: 'Bei Ausdauerfokus zählt Spezifität – die Anpassung ist an die Bewegung gebunden. '
        + 'Die Interferenz nimmst du dafür in Kauf.',
    };
  }
  return {
    geraet: 'gemischt',
    begruendung: 'Im Hybridbereich: lange Einheiten aufs Rad, kurze harte Intervalle laufend. '
      + 'So bleibt der Muskelschaden begrenzt, ohne die Laufspezifik ganz aufzugeben.',
  };
}

/* ----------------------------------------------------------- Kraftmarken */

/**
 * Geschätztes Einer-Maximum nach Epley. Über etwa zehn Wiederholungen wird
 * die Schätzung unzuverlässig, deshalb die Warnung im Rückgabewert.
 */
export function e1rm(gewicht, wiederholungen) {
  const w = Number(gewicht);
  const r = Number(wiederholungen);
  if (!w || !r || r < 1) return null;
  if (r === 1) return round(w, 1);
  return round(w * (1 + r / 30), 1);
}

export function e1rmVerlaesslich(wiederholungen) {
  return Number(wiederholungen) <= EPLEY.maxWiederholungen;
}

/** Einordnung einer Hebung relativ zur Körpermasse. */
export function kraftEinordnung(uebung, einerMax, gewichtKg) {
  const marken = KRAFTMARKEN.uebungen[uebung];
  if (!marken || !einerMax || !gewichtKg) return null;
  const faktor = round(einerMax / gewichtKg, 2);
  let stufe = 'unter Einstieg';
  if (faktor >= marken.stark) stufe = 'stark';
  else if (faktor >= marken.solide) stufe = 'solide';
  else if (faktor >= marken.einstieg) stufe = 'Einstieg';
  return {
    faktor,
    stufe,
    marken,
    naechsteMarke: faktor >= marken.stark ? null
      : round((faktor < marken.einstieg ? marken.einstieg
        : faktor < marken.solide ? marken.solide : marken.stark) * gewichtKg, 1),
  };
}

/* -------------------------------------------------------- Muscle-Up-Weg */

/**
 * Auf welcher Stufe steht der Muscle-Up gerade? Es zählt der letzte Wert, der
 * die Prüfung besteht – Stufen lassen sich nicht überspringen, weil jede auf
 * der davor aufbaut.
 */
export function bestwert(tests = [], art) {
  const passend = tests.filter((t) => t.art === art).map((t) => Number(t.wert) || 0);
  return passend.length ? Math.max(...passend) : 0;
}

export function zusatzlastAnteil(tests = [], gewichtKg) {
  if (!gewichtKg) return 0;
  const last = bestwert(tests, 'klimmzugZusatzlast');
  return last ? last / gewichtKg : 0;
}

/**
 * Der Muscle-Up-Stand aus dem gesamten Datenbestand.
 *
 * Das Argumentobjekt für `muscleupStand()` wurde an **drei** Stellen von Hand
 * zusammengesetzt – in `zustand.js`, in `aendern.js` und (nach dieser Änderung)
 * im Leistungsstand. Drei Fassungen derselben Herleitung halten genau so lange
 * zusammen, bis eine angefasst wird; dass sie hier vier Felder betrifft und
 * nicht eins, macht es wahrscheinlicher, nicht unwahrscheinlicher.
 */
export function muscleupStandAus(daten = {}) {
  return muscleupStand({
    klimmzuege: bestwert(daten.tests, 'klimmzuege'),
    muscleups: bestwert(daten.tests, 'muscleups'),
    zusatzlastAnteil: zusatzlastAnteil(daten.tests, daten.profil?.gewichtKg),
    manuell: daten.muscleup?.manuell || {},
  });
}

export function muscleupStand(bestwerte = {}) {
  const klimmzuege = Number(bestwerte.klimmzuege) || 0;
  const muscleups = Number(bestwerte.muscleups) || 0;
  const zusatzlast = Number(bestwerte.zusatzlastAnteil) || 0;
  const manuell = bestwerte.manuell || {};

  let erreicht = 0;
  for (const stufe of MUSCLEUP_STUFEN) {
    let bestanden = false;
    if (stufe.pruefung === 'klimmzuege') bestanden = klimmzuege >= stufe.ziel;
    else if (stufe.pruefung === 'muscleups') bestanden = muscleups >= stufe.ziel;
    else if (stufe.pruefung === 'zusatzlast') bestanden = zusatzlast >= stufe.ziel;
    else if (stufe.pruefung === 'manuell') bestanden = Boolean(manuell[stufe.stufe]);
    if (!bestanden) break;
    erreicht = stufe.stufe;
  }

  const naechste = MUSCLEUP_STUFEN.find((s) => s.stufe === erreicht + 1) || null;
  return {
    erreicht,
    gesamt: MUSCLEUP_STUFEN.length,
    aktuelle: MUSCLEUP_STUFEN.find((s) => s.stufe === erreicht) || null,
    naechste,
    fortschrittProzent: Math.round((erreicht / MUSCLEUP_STUFEN.length) * 100),
    /**
     * Jede Stufe mit ihrem Zustand – damit die Oberfläche ihn nicht selbst
     * herleitet (Falle 21) und vor allem: damit `vorgemerkt` überhaupt
     * sichtbar werden kann.
     *
     * Der Anlass war ein toter Knopf. Wer auf einer weit entfernten Stufe
     * „geschafft" tippte, speicherte das zwar – der Stand blieb aber stehen,
     * weil eine frühere Stufe noch offen ist, und die Oberfläche leitete ihre
     * Häkchen allein aus dem Stand ab. Ergebnis: Der Tipp war **vollkommen
     * folgenlos**, die Aufschrift blieb „geschafft", und beim nächsten Tippen
     * wurde die Bestätigung stillschweigend wieder zurückgenommen. Ein
     * Bedienelement, das nichts tut, ist schlimmer als keines – man hält die
     * App für kaputt oder sich für blind.
     */
    stufen: MUSCLEUP_STUFEN.map((s) => ({
      ...s,
      erreicht: s.stufe <= erreicht,
      aktuell: s.stufe === erreicht + 1,
      // Selbst bestätigt, aber von einer früheren Stufe noch aufgehalten.
      vorgemerkt: s.pruefung === 'manuell' && Boolean(manuell[s.stufe]) && s.stufe > erreicht,
    })),
  };
}

/* ------------------------------------------------------------- Helferlein */

export function clamp(wert, min, max) {
  return Math.min(max, Math.max(min, wert));
}

export function round(wert, stellen = 0) {
  const f = 10 ** stellen;
  return Math.round(wert * f) / f;
}

/** Wirft nicht, sondern meldet zurück – die Oberfläche zeigt die Lücken an. */
export function pruefeProfil(profil) {
  const fehlend = [];
  if (!profil?.gewichtKg) fehlend.push('Gewicht');
  if (!profil?.groesseCm) fehlend.push('Größe');
  if (!profil?.geburtsjahr) fehlend.push('Geburtsjahr');
  return { vollstaendig: fehlend.length === 0, fehlend };
}
