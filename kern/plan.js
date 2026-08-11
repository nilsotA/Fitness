// Der Trainingsplaner.
//
// Aus Reglerstand, verfügbaren Tagen und Trainingswoche entsteht ein konkreter
// Mikrozyklus. Die Regeln dahinter sind nicht verhandelbar, weil sie aus der
// Literatur kommen und nicht aus Geschmack:
//
//   - Sprint nur bei voller Frische, mindestens 48 h Abstand, höchstens 3×/Woche
//   - Am selben Tag zuerst Sprint, dann Kraft: Qualität braucht ein frisches
//     Nervensystem, Kraft verträgt Restmüdigkeit besser
//   - Ausdauer möglichst an anderen Tagen, sonst mit ≥6 h Abstand (Robineau 2016)
//   - Niedrigintensive Ausdauer bevorzugt auf dem Rad, solange Sprint zählt
//     (Wilson 2012: Laufen stört Kraft und Hypertrophie, Radfahren nicht)
//   - 80 % des Ausdauerumfangs locker, 20 % hart (Seiler 2010)
//   - Jede vierte Woche Entlastung

import {
  SPRINT, KRAFT, AUSDAUER, AUSDAUER_ZONEN, PHASEN, BLOCKFOLGE, UEBUNGEN, BELASTUNG, VOLUMEN,
  BEREITSCHAFT, WIEDEREINSTIEG,
} from './wissen.js';
import { schwerpunkte, umfangFaktoren, clamp, round, AUSRICHTUNG } from './profil.js';
import { arbeitsgewicht, naechsteLast, prozentBereich } from './leistung.js';
import { menge, zahlText } from './regeln.js';

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Welche Wochentage bei n Trainingstagen – bewusst mit Lücken für Erholung. */
const TAGESMUSTER = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

/**
 * In welcher Woche des Makrozyklus stehen wir? Ohne Startdatum ist es Woche 1,
 * damit der Planer auch vor dem offiziellen Start etwas Sinnvolles zeigt.
 */
export function trainingswoche(startdatum, heute = new Date()) {
  if (!startdatum) return 1;
  const start = new Date(startdatum);
  if (Number.isNaN(start.getTime())) return 1;
  const tage = Math.floor((heute - start) / 86400000);
  if (tage < 0) return 0; // Start liegt noch in der Zukunft
  return Math.floor(tage / 7) + 1;
}

/**
 * Phase aus der Wochennummer. Nach zwölf Wochen beginnt der Zyklus von vorn.
 *
 * Daneben stand `phaseDerWoche()`, die dasselbe rechnete und das Phasenobjekt
 * statt des Schlüssels zurückgab – zweite Herleitung derselben Größe, von
 * niemandem aufgerufen. Wer das Objekt braucht, nimmt `PHASEN[…]`.
 */
export function phaseSchluessel(woche) {
  if (woche < 1) return 'aufbau';
  return BLOCKFOLGE[(woche - 1) % BLOCKFOLGE.length];
}

/**
 * Mit welcher Absicht in dieser Woche Kraft trainiert wird.
 *
 * Die drei Arbeitsblöcke bringen ihre eigene mit. Die Entlastung nicht: Sie
 * soll den Umfang senken und die Lasten *halten*, und was zu halten ist, hängt
 * daran, was vorher dran war. Vorher stand in `PHASEN.entlastung` fest
 * `maximalkraft` – nach dem Aufbau hob das die Vorgabe von 75–85 kg auf
 * 90–100 kg und den Wiederholungsbereich von 6–12 auf 2–5, ausgerechnet in der
 * Erholungswoche. Der Tracker widersprach sich dabei selbst: In derselben
 * Zeile stand „das war ein anderer Block mit anderer Absicht" (Falle 23) –
 * eine Blockgrenze, die es fachlich gar nicht geben sollte.
 *
 * Gesucht wird rückwärts in `BLOCKFOLGE`, damit die Reihenfolge an genau einer
 * Stelle steht. Mehrere Entlastungswochen hintereinander gäbe es zwar heute
 * nicht, die Schleife überspringt sie aber – sonst hinge das Ergebnis daran,
 * dass die Tabelle nie geändert wird.
 */
export function kraftAbsichtDerWoche(woche) {
  const schluessel = phaseSchluessel(woche);
  if (schluessel !== 'entlastung') return PHASEN[schluessel].kraftAbsicht;

  const index = woche < 1 ? 0 : (Math.floor(woche) - 1) % BLOCKFOLGE.length;
  for (let zurueck = 1; zurueck < BLOCKFOLGE.length; zurueck++) {
    const davor = BLOCKFOLGE[(index - zurueck + BLOCKFOLGE.length) % BLOCKFOLGE.length];
    if (davor !== 'entlastung') return PHASEN[davor].kraftAbsicht;
  }
  // Nur erreichbar, wenn BLOCKFOLGE ausschließlich aus Entlastung besteht –
  // dann gibt es nichts zu halten und der Aufbau ist der ehrlichste Anfang.
  return PHASEN.aufbau.kraftAbsicht;
}

/**
 * Wie viele Einheiten welcher Art. Sprint ist nach oben gedeckelt, weil mehr
 * als drei hochwertige Sprinteinheiten pro Woche nicht mehr erholbar sind –
 * die vierte macht die anderen drei schlechter.
 */
export function einheitenVerteilung(profil) {
  const tage = clamp(Number(profil?.trainingstageProWoche) || 4, 3, 6);
  const anteil = schwerpunkte(profil?.ausrichtung);

  let sprint = Math.round(anteil.sprint * tage * 1.25);
  let kraft = Math.round(anteil.kraft * tage * 1.25);
  let ausdauer = Math.round(anteil.ausdauer * tage * 1.5);

  sprint = clamp(sprint, 0, SPRINT.maxEinheitenProWoche);
  kraft = clamp(kraft, 1, 4);
  ausdauer = clamp(ausdauer, 0, 5);

  // Bei sehr sprintlastiger Ausrichtung bleibt trotzdem eine lockere Einheit
  // stehen: Die aerobe Basis beschleunigt die Erholung zwischen den Sprints.
  if (ausdauer === 0) ausdauer = 1;

  // Und spiegelbildlich: Der Sprint verschwindet erst ganz am Anschlag.
  //
  // Vorher fiel er schon bei Regler 90 auf null – die Reglerbeschriftung
  // verspricht dort aber noch „Ausdauer mit Spritzigkeit: Sprint und Kraft
  // halten das Tempo oben", und erst bei 100 steht „Reine Ausdauer". Der Plan
  // widersprach also seiner eigenen Aufschrift. Der Umfang geht über
  // `umfangFaktoren()` ohnehin weit zurück; die eine Einheit bleibt.
  if (sprint === 0 && Number(profil?.ausrichtung) < AUSRICHTUNG.max) sprint = 1;

  return { tage, sprint, kraft, ausdauer, anteil };
}

/**
 * Sprinttage mit dem geforderten Mindestabstand belegen. Greedy von vorn – das
 * reicht, weil die Tagesmuster ohnehin gleichmäßig über die Woche verteilt sind.
 *
 * Der Abstand kam aus einer nackten `2`, während `SPRINT.minStundenZwischenEinheiten`
 * unbeachtet in `wissen.js` stand: Wer die 48 dort auf 72 gesetzt hätte, hätte
 * am Plan nichts geändert. Ein Kalender kennt nur ganze Tage, also wird
 * aufgerundet – aus 48 h werden zwei Tage Abstand, aus 72 h drei.
 */
function verteileSprint(tage, anzahl) {
  const mindestAbstand = Math.ceil(SPRINT.minStundenZwischenEinheiten / 24);
  const gewaehlt = [];
  let letzter = -99;
  for (const tag of tage) {
    if (gewaehlt.length >= anzahl) break;
    if (tag - letzter >= mindestAbstand) {
      gewaehlt.push(tag);
      letzter = tag;
    }
  }
  return gewaehlt;
}

/**
 * Der Wochenplan. Liefert für jeden Trainingstag eine Liste von Einheiten in
 * der Reihenfolge, in der sie absolviert werden sollen.
 */
export function wochenplan(profil, woche = 1, leistung = {}) {
  const verteilung = einheitenVerteilung(profil);
  const schluessel = phaseSchluessel(woche);
  // Die Entlastung erbt die Absicht des Blocks, den sie entlastet – deshalb
  // hier zusammengesetzt und nicht direkt aus PHASEN gelesen.
  const phase = { ...PHASEN[schluessel], kraftAbsicht: kraftAbsichtDerWoche(woche) };
  const tage = TAGESMUSTER[verteilung.tage] || TAGESMUSTER[4];

  // Der Wiedereinstieg drückt die ersten Wochen bewusst nach unten; die
  // Begründung und die Faktoren stehen bei WIEDEREINSTIEG in `wissen.js`.
  // Wie lange er dauert, sagt die Länge der Liste – nicht eine zweite Zahl.
  const faktoren = WIEDEREINSTIEG.volumenFaktorJeWoche;
  const einstieg = profil?.wiedereinstieg && woche >= 1 && woche <= faktoren.length;
  const einstiegFaktor = einstieg ? faktoren[woche - 1] : 1;
  const volumen = phase.volumenFaktor * einstiegFaktor;

  // Der Regler skaliert nicht nur die Zahl der Einheiten, sondern auch den
  // Umfang – sonst fallen zwanzig Reglerstellungen auf sieben Wochen zusammen.
  const umfang = umfangFaktoren(profil?.ausrichtung);

  /*
   * Die Zahl der Sprinttage folgt dem Umfang, nicht umgekehrt.
   *
   * Vorher kam sie aus dem Anteil am Regler und der Umfang aus der Zahl der
   * Tage mal der Qualitätsgrenze. Das drehte die Ursache um und erzeugte eine
   * Klippe: Bei vier Trainingstagen fiel die Sprintzahl zwischen Regler 35 und
   * 40 von zwei auf eins, und weil eine Einheit höchstens 16 Läufe trägt,
   * halbierte sich der Wochenumfang von 780 auf 480 m – ein Reglerschritt,
   * eine halbe Woche Sprint weniger.
   *
   * Jetzt steht zuerst der Wochenumfang (Phase × Wiedereinstieg × Regler), und
   * daraus ergibt sich, auf wie viele Tage er sich verteilen *muss*, damit
   * keine Einheit über die Qualitätsgrenze läuft. Die Abstufung wird damit
   * stetig, und die Begründung stimmt: Mehr hochwertige Meter brauchen mehr
   * Tage, nicht andersherum.
   */
  // Nur der Wiedereinstiegsfaktor, nicht `volumen`: Die Phasenabstufung steckt
  // schon in `wochenumfangMeter`, das je Phase geführt wird. Beides zu
  // multiplizieren hieß, dieselbe Periodisierung zweimal anzuwenden.
  const sprintZielMeter = verteilung.sprint > 0
    ? SPRINT.wochenumfangMeter[schluessel] * einstiegFaktor * umfang.sprint
    : 0;
  const meterProEinheit = SPRINT.maxLaeufeProEinheit[
    phase.sprintFokus === 'beschleunigung' ? 'beschleunigung' : 'maximalgeschwindigkeit']
    * SPRINT.distanzMeter;
  const noetigeSprinttage = sprintZielMeter > 0
    ? clamp(Math.ceil(sprintZielMeter / meterProEinheit), 1, SPRINT.maxEinheitenProWoche)
    : 0;

  const sprinttage = verteileSprint(tage, noetigeSprinttage);
  // Eine Herleitung, nicht zwei: Was der Planer belegt hat, ist die Zahl, die
  // auch in den Kennzahlen steht (Falle 13).
  verteilung.sprint = sprinttage.length;

  const sprintProEinheit = sprinttage.length
    ? Math.round(sprintZielMeter / sprinttage.length)
    : 0;

  // Kraft zuerst auf die Sprinttage – die sind ohnehin die harten Tage, so
  // bleiben die übrigen wirklich locker. Danach auf freie Tage auffüllen.
  const krafttage = [];
  for (const tag of sprinttage) {
    if (krafttage.length < verteilung.kraft) krafttage.push(tag);
  }
  for (const tag of tage) {
    if (krafttage.length >= verteilung.kraft) break;
    if (!krafttage.includes(tag)) krafttage.push(tag);
  }

  // Ausdauer auf die Tage ohne Sprint. Erst wenn die ausgehen, teilt sie sich
  // einen Tag mit dem Krafttraining – dann aber mit Abstand.
  const freieTage = tage.filter((t) => !sprinttage.includes(t));
  const ausdauertage = [];
  for (const tag of freieTage) {
    if (ausdauertage.length >= verteilung.ausdauer) break;
    ausdauertage.push(tag);
  }
  /*
   * Kein Kalendertag bekommt drei Einheiten.
   *
   * Bei drei Trainingstagen und Regler 80 standen am Montag Sprint, Kraft und
   * eine lockere Ausfahrt: **231 Minuten**, während der Mittwoch 106 und der
   * Freitag 67 hatte. Dazu kommen die sechs Stunden Abstand, die derselbe
   * Planer zwischen Kraft und Ausdauer fordert – ein Zehn-Stunden-Tag. Die
   * Wissensansicht sagt es selbst: „Ein Plan, der nicht gemacht wird, ist
   * wertlos."
   *
   * Die Zahl der lockeren Einheiten wird deshalb gedeckelt; den Umfang holen
   * die verbleibenden nach (siehe `lockerAusgleich` weiter unten). Weniger
   * Einheiten, gleiche Wochenminuten.
   */
  const belegungVor = (tag) => (sprinttage.includes(tag) ? 1 : 0)
    + (krafttage.includes(tag) ? 1 : 0);
  const gewuenschteAusdauer = verteilung.ausdauer;
  verteilung.ausdauer = Math.max(1,
    Math.min(verteilung.ausdauer, tage.filter((t) => belegungVor(t) < 2).length));

  // Muss doch geteilt werden, dann mit dem *am wenigsten belegten* Tag.
  //
  // Vorher lief die Ersatzsuche stur von vorn durch die Woche – und weil Kraft
  // ohnehin zuerst auf die Sprinttage geht, landete die dritte Ausdauereinheit
  // regelmäßig auf dem Montag, der schon Sprint und Kraft trug. Heraus kamen
  // Tage mit drei Einheiten und bis zu 3 h 51 min, während am selben
  // Wochenende eine Stunde allein stand. Der Umfang war richtig verteilt, die
  // Tage nicht.
  const nachLast = [...tage].sort((x, y) => belegungVor(x) - belegungVor(y) || x - y);
  for (const tag of nachLast) {
    if (ausdauertage.length >= verteilung.ausdauer) break;
    if (!ausdauertage.includes(tag)) ausdauertage.push(tag);
  }

  // 80/20 polarisiert: Nur die härtere Minderheit wird zu Intervallen. Bei
  // wenigen Ausdauereinheiten sind das null – die harte Intensität liefern dann
  // die Sprints, und die Ausdauer bleibt reine Erholungsarbeit.
  //
  // Achtung beim Anfassen: slice(-0) ist slice(0) und gäbe das ganze Array
  // zurück. Ohne die ausdrückliche Null-Prüfung würde ausgerechnet der Fall
  // „keine harte Einheit" jede Ausdauereinheit zu Intervallen machen.
  //
  // Der Anteil kommt aus derselben Tabelle, an der `ausdauer.js` die Verteilung
  // später *misst*. Vorher plante dieser Aufruf aus `AUSDAUER.anteilHochintensiv`
  // und die Bewertung las `AUSDAUER_ZONEN.hart.ziel` – zwei Felder mit derselben
  // Zahl und derselben Quelle. Solange beide auf 0,2 standen, fiel das nicht
  // auf; wer eines geändert hätte, hätte Planer und Bewertung gegeneinander
  // laufen lassen, ohne dass ein Test angeschlagen wäre.
  const harteAusdauer = Math.max(0, Math.round(ausdauertage.length * AUSDAUER_ZONEN.hart.ziel));
  const kandidaten = ausdauertage.filter((t) => !sprinttage.includes(t));
  const intervalltage = new Set(harteAusdauer > 0 ? kandidaten.slice(-harteAusdauer) : []);

  const geraet = ausdauerGeraetFuer(profil);

  /*
   * Der Wochenumfang der lockeren Ausdauer steht; die Tage teilen ihn auf.
   *
   * Eine lockere Einheit, die sich den Tag mit Kraft oder Sprint teilt, wird
   * kürzer angesetzt – zu Recht, sonst wird aus Erholung Umfang. Nur fiel
   * damit die *Wochensumme*, sobald die Tagesbelegung sich verschob: Bei sechs
   * Trainingstagen sank sie zwischen Regler 5 und 10 von 76 auf 71 Minuten,
   * obwohl der Regler mehr Ausdauer verlangte. Dieselbe Umkehrung von Ursache
   * und Wirkung wie beim Sprint weiter oben.
   *
   * Die fehlenden Minuten holen deshalb die *freien* Ausdauertage nach. Gibt
   * es keinen freien, bleibt die Woche kürzer – dann ist nichts da, was
   * ausgleichen könnte, und das zu behaupten wäre gelogen.
   */
  const lockerTage = ausdauertage.filter((t) => !intervalltage.has(t));
  const geteilte = lockerTage.filter((t) => sprinttage.includes(t) || krafttage.includes(t));
  const freie = lockerTage.length - geteilte.length;
  const { allein, geteilterTag } = AUSDAUER.dauer.lockerMinuten;
  // Bezugsgröße ist die *gewünschte* Zahl lockerer Einheiten, nicht die
  // tatsächliche: Sonst verlöre die Woche genau die Minuten, die der Deckel
  // oben eingespart hat – und der Regler liefe wieder rückwärts.
  const gewuenschtLocker = Math.max(lockerTage.length,
    gewuenschteAusdauer - (ausdauertage.length - lockerTage.length));
  const lockerAusgleich = freie > 0
    ? (gewuenschtLocker * allein - geteilte.length * geteilterTag) / (freie * allein)
    : 1;

  const plan = WOCHENTAGE.map((name, index) => {
    const einheiten = [];

    if (sprinttage.includes(index)) {
      einheiten.push(sprinteinheit(phase, sprintProEinheit));
    }
    if (krafttage.includes(index)) {
      einheiten.push(krafteinheit(phase, volumen * umfang.kraft, profil,
        sprinttage.includes(index), leistung));
    }
    if (ausdauertage.includes(index)) {
      const hart = intervalltage.has(index);
      einheiten.push(ausdauereinheit(hart, volumen * umfang.ausdauer, profil, geraet,
        einheiten.length > 0, lockerAusgleich));
    }

    return {
      tag: index,
      name,
      trainingstag: einheiten.length > 0,
      einheiten,
      minuten: einheiten.reduce((s, e) => s + e.minuten, 0),
    };
  });

  // Einmal gerechnet und weitergereicht: Dieselbe Summe stand ein zweites Mal
  // in `wochenHinweise`. Zwei Ausdrücke für dieselbe Zahl stimmen genau so
  // lange überein, bis einer angefasst wird.
  const wochenminuten = plan.reduce((s, t) => s + t.minuten, 0);

  return {
    woche,
    phase: { schluessel, ...phase },
    entlastungswoche: schluessel === 'entlastung',
    wiedereinstieg: einstieg,
    volumenFaktor: round(volumen, 2),
    verteilung,
    geraet,
    tage: plan,
    wochenminuten,
    // Tatsächlich geplante Meter, nicht der Zielwert: Die Qualitätsgrenze im
    // Sprintblock deckelt den Umfang, und dann soll hier auch das Gedeckelte
    // stehen.
    //
    // Daneben stand ein `sprintmeterZiel` aus `sprinttage × sprintProEinheit`
    // – dieselbe Größe, zweite Herleitung, von niemandem gelesen. Die beiden
    // dürfen laut dem Kommentar oben ausdrücklich auseinanderliegen; wer die
    // ungenutzte Zahl irgendwann anzeigt, zeigt die falsche. Familie von
    // Falle 13, deshalb entfernt statt liegengelassen.
    sprintmeter: plan.reduce((s, t) =>
      s + t.einheiten.reduce((m, e) => m + (e.meter || 0), 0), 0),
    hinweise: wochenHinweise(profil, plan, schluessel, einstieg, wochenminuten,
      woche, umfang.kraft),
  };
}

function ausdauerGeraetFuer(profil) {
  const gewuenscht = profil?.ausdauerGeraet || 'rad';
  return {
    name: gewuenscht,
    interferenz: AUSDAUER.interferenzFaktor[gewuenscht] ?? 1.0,
  };
}

/* ------------------------------------------------------------ Einheiten */

/**
 * Sprinteinheit. Der Umfang steht in Metern, weil das die Größe ist, die zählt –
 * Wiederholungen sagen nichts, solange die Distanz offen ist.
 */
/**
 * Wie sich die Läufe tatsächlich auf Sätze verteilen.
 *
 * Im Plan stand „Beschleunigung: 4 × 30 m … aufgeteilt in 1 Sätze à 5". Die
 * Überschrift zählte die Läufe, der Satz daneben rechnete Sätze mal Satzgröße
 * – zwei Zahlen für dieselbe Sache, und sobald der Umfang nicht glatt aufging,
 * widersprachen sie sich. In der Entlastungswoche ging er nie glatt auf.
 *
 * Verteilt wird gleichmäßig statt „5, 5, 2": Ein Restsatz mit zwei Läufen ist
 * keine Serie mehr, und die sechs Minuten Pause davor waren für fünf gedacht.
 */
export function satzAufteilung(laeufe, proSatz) {
  const gesamt = Math.max(0, Math.round(Number(laeufe) || 0));
  const groesse = Math.max(1, Math.round(Number(proSatz) || 1));
  if (!gesamt) return [];
  const saetze = Math.ceil(gesamt / groesse);
  const basis = Math.floor(gesamt / saetze);
  const rest = gesamt % saetze;
  return Array.from({ length: saetze }, (_, i) => basis + (i < rest ? 1 : 0));
}

/** Die Aufteilung als Satzteil – „in einem Satz", „in 3 Sätzen à 4", „(5 + 4 + 4)". */
export function aufteilungText(verteilung) {
  if (verteilung.length <= 1) return 'in einem Satz';
  const gleich = verteilung.every((n) => n === verteilung[0]);
  return gleich
    ? `aufgeteilt in ${verteilung.length} Sätze à ${verteilung[0]}`
    : `aufgeteilt in ${verteilung.length} Sätze (${verteilung.join(' + ')})`;
}

// `profil` stand hier als dritter Parameter und wurde nie gelesen – entfernt,
// damit `angepassteEinheit()` die Einheit mit demselben Aufruf neu bauen kann.
function sprinteinheit(phase, meter) {
  const beschleunigung = phase.sprintFokus === 'beschleunigung';

  // Die Streckenlänge ist nicht verhandelbar: Beschleunigungsarbeit lebt von
  // 20–30 m, Höchstgeschwindigkeit von 20–30 m fliegend. Wer die Läufe länger
  // macht, um mehr Meter unterzubringen, trainiert Tempohärte – die Geschwindigkeit
  // fällt am Ende der Strecke ab, und genau die sollte trainiert werden.
  //
  // Zusätzliches Volumen kommt deshalb über Sätze, nicht über längere Läufe.
  // Deckelt die Qualitätsgrenze den Umfang, gewinnt die Qualität: Der Wochenwert
  // aus der Literatur ist eine Obergrenze, kein Soll.
  const art = beschleunigung ? 'beschleunigung' : 'maximalgeschwindigkeit';
  const distanz = SPRINT.distanzMeter;
  const proSatz = SPRINT.laeufeProSatz[art];
  const maxLaeufe = SPRINT.maxLaeufeProEinheit[art];
  const wiederholungen = clamp(Math.round(meter / distanz), 4, maxLaeufe);
  const verteilung = satzAufteilung(wiederholungen, proSatz);
  const saetze = verteilung.length;
  const pause = Math.round(distanz / 10 * SPRINT.pauseSekundenProZehnMeter);
  const satzPause = SPRINT.satzPauseMinuten;

  const bloecke = [
    {
      titel: 'Anlauf',
      inhalt: '10 min lockeres Einlaufen, Mobilisation Hüfte und Sprunggelenk, '
        + 'Lauf-ABC (Skippings, Anfersen, Sprunglauf) je 2 × 20 m.',
      minuten: 20,
    },
    {
      titel: 'Neuromuskulär',
      schluessel: 'einbeinstand',
      inhalt: 'Je Bein 30 s Einbeinstand mit Störreiz (Augen zu oder Ball prellen), '
        + 'dann 2 × 5 beidbeinige Landungen aus geringer Höhe, weich abfangen. '
        + 'Wirkt über Ansteuerung statt über Kraft und senkt Sprunggelenksverletzungen '
        + 'um etwa ein Drittel – bei zwei Minuten Aufwand.',
      minuten: 4,
    },
    {
      titel: 'Steigerungen',
      inhalt: '3 × 50 m progressiv auf 90 % – das Nervensystem braucht die Rampe, '
        + 'sonst ist der erste harte Sprint der gefährlichste.',
      minuten: 8,
    },
    beschleunigung
      ? {
        titel: `Beschleunigung: ${wiederholungen} × ${distanz} m`,
        inhalt: `Aus dem 3-Punkt-Start, ${SPRINT.intensitaetProzent.beschleunigung} % Intensität, `
          + `${aufteilungText(verteilung)}. `
          + `${Math.round(pause / 60)} min zwischen den Läufen`
          + `${saetze > 1 ? `, ${satzPause} min zwischen den Sätzen` : ''} – `
          + 'vollständig gehend erholen, nicht traben. Bricht die Technik ein oder wird es spürbar '
          + 'langsamer, ist die Einheit vorbei: Der Rest würde nur Ermüdung ohne Reiz sammeln.',
        minuten: Math.round(wiederholungen * pause / 60) + (saetze - 1) * satzPause + 5,
      }
      : {
        titel: `Fliegende Sprints: ${wiederholungen} × ${distanz} m`,
        inhalt: `30 m Anlauf, dann ${distanz} m fliegend bei ${SPRINT.intensitaetProzent.maximalgeschwindigkeit} %, `
          + `${aufteilungText(verteilung)}. `
          + `${Math.round(pause / 60)} min zwischen den Läufen`
          + `${saetze > 1 ? `, ${satzPause} min zwischen den Sätzen` : ''}. `
          + 'Hier entsteht Höchstgeschwindigkeit – nur bei absoluter Frische sinnvoll. Länger als '
          + `${distanz} m fliegend zu laufen bringt keine höhere Geschwindigkeit, sondern nur Ermüdung.`,
        minuten: Math.round(wiederholungen * pause / 60) + (saetze - 1) * satzPause + 5,
      },
    {
      titel: 'Plyometrie',
      inhalt: beschleunigung
        ? '3 × 5 Standweitsprünge, 3 × 5 Sprünge im Wechselschritt. Zwischen den Sätzen 2 min.'
        : '3 × 5 Hürdensprünge (niedrig), 3 × 20 m Sprunglauf. Kurzer Bodenkontakt zählt, nicht die Höhe.',
      minuten: 12,
    },
    {
      titel: 'Auslaufen',
      inhalt: '8 min locker, danach Dehnen nur leicht – intensives Dehnen direkt nach Sprints bringt nichts.',
      minuten: 8,
    },
  ];

  return {
    typ: 'sprint',
    titel: 'Sprint',
    fokus: phase.sprintFokus === 'beschleunigung' ? 'Beschleunigung' : 'Maximalgeschwindigkeit',
    // Bleibt am Objekt hängen, damit die Anpassung an die Tagesform die Einheit
    // aus derselben Funktion neu bauen kann statt die Meter danebenzurechnen.
    sprintFokus: phase.sprintFokus,
    meter: wiederholungen * distanz,
    bloecke,
    minuten: bloecke.reduce((s, b) => s + b.minuten, 0),
    warum: 'Sprint steht am Anfang des Tages und der Woche, weil Höchstgeschwindigkeit '
      + 'nur bei frischem Nervensystem trainierbar ist. Müde sprinten heißt langsam sprinten – '
      + 'und langsam sprinten trainiert Langsamkeit.',
  };
}

/**
 * Woran die Sätze gerade arbeiten – die nächste Stufe auf dem Muscle-Up-Weg.
 *
 * Der Muscle-Up ist das erklärte Hauptziel dieses Trackers, `muscleupStand()`
 * rechnet den Stand samt konkretem Tor aus – und der Planer sah ihn **nie**.
 * Auf Stufe 1 („8 saubere Klimmzüge") stand dieselbe Vorgabe wie auf Stufe 7
 * („5 negative Muscle-Ups kontrolliert"): 3 × 6–12, ohne ein Wort dazu, worauf
 * das hinarbeitet. Angezeigt wurde das Ziel in der Fortschrittsansicht, geplant
 * wurde daran vorbei.
 *
 * Bewusst nur ein Satz und **keine** zusätzlichen Sätze: Die Dosis ist eine
 * Trainingsentscheidung und gehört Nils. Die Ausführung zu benennen ist keine –
 * dieselben zwölf Wiederholungen mit Blick auf das nächste Tor sind mehr wert
 * als zwölf ohne.
 */
function naechstesTor(profil, leistung, uebung) {
  if (!profil?.koerpergewichtsfokus) return '';
  const naechste = leistung?.muscleup?.naechste;
  // Nur an der Übung, die das Tor trainiert. Sonst steht derselbe Satz zweimal
  // in derselben Einheit – und bei Stufe 5 an der falschen der beiden.
  if (!naechste || naechste.uebung !== uebung) return '';
  return ` Nächste Stufe auf dem Muscle-Up-Weg: ${naechste.name} – ${naechste.tor}.`;
}

/**
 * Dauer einer Krafteinheit aus ihren Sätzen.
 *
 * Einmal gerechnet und von beiden Stellen benutzt – vom Planer und von
 * `angepassteEinheit()`. Getrennt gerechnet lief es auseinander: Die Anpassung
 * kürzte die Sätze einzeln, die Minuten aber pauschal, und behauptete für eine
 * halbierte Einheit 38 Minuten, obwohl allein die ungekürzten Teile
 * (Aufwärmen und Prophylaxe) schon 27 ergaben.
 */
function kraftMinuten(uebungen = [], prophylaxe = [], absicht = 'hypertrophie') {
  const { aufwaermenMinuten, minutenProSatz, minutenProProphylaxeSatz } = KRAFT.dauer;
  const saetze = (liste) => liste.reduce((s, u) => s + (Number(u.saetze) || 0), 0);
  return Math.round(
    aufwaermenMinuten
    + saetze(uebungen) * (minutenProSatz[absicht] ?? minutenProSatz.hypertrophie)
    + saetze(prophylaxe) * minutenProProphylaxeSatz,
  );
}

/**
 * Krafteinheit. Ganzkörper, weil das bei drei bis vier Einheiten pro Woche
 * jede Muskelgruppe zweimal trifft – besser als ein Split, der bei einer
 * verpassten Einheit ganze Bereiche ausfallen lässt.
 */
/**
 * Sätze je Übung nach Absicht und Volumenfaktor.
 *
 * Eigene Funktion, weil die Zahl an zwei Stellen gebraucht wird: einmal für
 * die Einheit selbst und einmal für die Frage, ob die Entlastungswoche im
 * Kraftraum überhaupt etwas bewirkt. Zweimal dieselbe Formel wäre Falle 13.
 */
function kraftSaetze(absicht, volumen) {
  const s = KRAFT.saetzeProUebung;
  const grund = absicht === 'maximalkraft' ? s.maximalkraft : s.standard;
  return Math.max(s.minimum, Math.round(grund * volumen));
}

function krafteinheit(phase, volumen, profil, nachSprint, leistung = {}) {
  const absicht = phase.kraftAbsicht;
  const [intMin, intMax] = KRAFT.intensitaet[absicht];
  const [repMin, repMax] = KRAFT.wiederholungen[absicht];
  const saetze = kraftSaetze(absicht, volumen);

  // Gelenkschonende Auswahl ist der Standard: Frontkniebeuge statt Nackenkniebeuge,
  // Sechskantstange statt gerader Stange. Beide bringen vergleichbaren Reiz bei
  // deutlich geringerer Belastung der Lendenwirbelsäule. Wer die klassischen
  // Varianten will, schaltet das im Profil ab.
  const schonend = profil?.gelenkschonend !== false;

  // Der Hüftzug wechselt mit der Phase: Im Aufbau das rumänische Kreuzheben,
  // weil es die Hamstrings unter Dehnung belastet und damit selbst schützend
  // wirkt. In den schweren Blöcken die Sechskantstange, weil dort hohe Lasten
  // gefragt sind und sie die verträglichste Variante dafür ist.
  const hinge = absicht === 'hypertrophie'
    ? 'rumaenischesKreuzheben'
    : (schonend ? 'trapbarKreuzheben' : 'kreuzheben');

  const roh = [
    {
      schluessel: schonend ? 'frontKniebeuge' : 'kniebeuge',
      name: schonend ? 'Frontkniebeuge' : 'Kniebeuge',
      saetze,
      repBereich: [repMin, repMax],
      prozent: [intMin, intMax],
      hinweis: absicht === 'explosivkraft'
        ? 'Bewusst zügig aus der tiefen Position – die Absicht zählt, nicht die Last.'
        : 'Letzte Wiederholung mit 1–2 Wiederholungen Reserve. Bis zum Versagen bringt kaum mehr, kostet aber Erholung.',
    },
    {
      schluessel: hinge,
      name: UEBUNGEN[hinge].name,
      saetze: Math.max(2, saetze - 1),
      repBereich: hinge === 'rumaenischesKreuzheben'
        ? [Math.max(6, repMin), Math.max(10, repMax)]
        : [repMin, repMax],
      prozent: [intMin - 5, intMax - 5],
      hinweis: hinge === 'rumaenischesKreuzheben'
        ? 'Hüftbeuge, kein Rückenrunden. Die Hamstrings sind beim Sprint der Motor – und die Baustelle. '
          + 'Unter Dehnung belastet, wirkt die Übung selbst verletzungsvorbeugend.'
        : 'Hüftstreckung mit schwerer Last, ohne dass die Wirbelsäule den langen Hebel tragen muss.',
    },
    {
      schluessel: profil?.koerpergewichtsfokus ? 'klimmzuege' : 'latzug',
      name: profil?.koerpergewichtsfokus ? 'Klimmzüge (Muscle-Up-Weg)' : 'Latzug',
      saetze,
      repBereich: absicht === 'maximalkraft' ? [3, 5] : [repMin, repMax],
      prozent: [intMin, intMax],
      koerpergewicht: Boolean(profil?.koerpergewichtsfokus),
      hinweis: 'Voll ausgestreckt starten, Brustbein zur Stange. Die Teilstrecke oben ist genau die, '
        + 'die den Muscle-Up trägt.'
        + naechstesTor(profil, leistung, 'klimmzuege'),
    },
    {
      schluessel: profil?.koerpergewichtsfokus ? 'dips' : 'bankdruecken',
      name: profil?.koerpergewichtsfokus ? 'Dips an der geraden Stange' : 'Bankdrücken',
      saetze,
      repBereich: [repMin, repMax],
      prozent: [intMin, intMax],
      koerpergewicht: Boolean(profil?.koerpergewichtsfokus),
      hinweis: 'Bei Muscle-Up-Ziel: Dips an der geraden Stange statt an Barren – das ist die Position '
        + 'nach dem Übergang.'
        + naechstesTor(profil, leistung, 'dips'),
    },
    {
      schluessel: 'hipthrust',
      name: 'Hip Thrust',
      saetze: Math.max(2, saetze - 1),
      repBereich: [Math.max(6, repMin), repMax + 2],
      prozent: [intMin, intMax],
      hinweis: 'Hüftstreckung gegen Widerstand – die Bewegung, die den Sprint antreibt.',
    },
  ];

  // Die Last folgt der Wiederholungszahl, nicht umgekehrt. Beim
  // Explosivkrafttraining bleibt es bei der festen Prozentvorgabe, weil dort
  // die Bewegungsgeschwindigkeit die Last bestimmt und nicht die Erschöpfung.
  const reserve = KRAFT.reserve[absicht];
  const uebungen = roh.map((u) => mitLast({
    ...u,
    prozent: reserve == null ? u.prozent : prozentBereich(u.repBereich, reserve),
  }, leistung));

  // Prophylaxe steht in jedem Sprintprogramm, unabhängig von der Vorgeschichte:
  // Nordic senkt Hamstring-Verletzungen um rund die Hälfte (van Dyk 2019),
  // Copenhagen ist das Gegenstück für die Adduktoren.
  const prophylaxe = [
    {
      schluessel: 'nordic',
      ohneLast: true,
      name: 'Nordic Hamstring',
      saetze: 2,
      wiederholungen: '4–6',
      intensitaet: 'nur exzentrisch, so weit kontrollierbar',
      hinweis: 'Halbiert das Hamstring-Risiko in Metaanalysen. Zwei Sätze pro Woche reichen – '
        + 'mehr macht vor allem Muskelkater.',
    },
    {
      schluessel: 'copenhagen',
      ohneLast: true,
      name: 'Copenhagen Adduction',
      saetze: 2,
      wiederholungen: '5–8 je Seite',
      intensitaet: 'Kurzhebel, bis die Technik hält',
      hinweis: 'Adduktorenkraft ist die beste Absicherung der Leiste. Mit kurzem Hebel anfangen.',
    },
    {
      schluessel: 'wadenheben',
      name: 'Wadenheben stehend',
      saetze: 2,
      wiederholungen: '8–12',
      intensitaet: 'schwer, volle Amplitude über eine Stufe',
      hinweis: 'Achillessehne und Fußgewölbe tragen beim Sprint die höchsten Spitzenkräfte. '
        + 'Sehnen passen sich langsamer an als Muskeln – sie brauchen eigene Reize.',
    },
    {
      schluessel: 'seitstuetz',
      ohneLast: true,
      name: 'Seitstütz mit Beinheben',
      saetze: 2,
      wiederholungen: '20–30 s je Seite',
      intensitaet: 'Körpergewicht',
      hinweis: 'Hält das Becken beim einbeinigen Aufsetzen stabil. Kippt es weg, landet die '
        + 'Last auf Leiste und Knie statt auf der Muskulatur.',
    },
  ];

  return {
    typ: 'kraft',
    titel: 'Kraft (Ganzkörper)',
    fokus: absicht === 'hypertrophie' ? 'Hypertrophie'
      : absicht === 'maximalkraft' ? 'Maximalkraft' : 'Explosivkraft',
    // Die Absicht bleibt am Objekt hängen, weil die Dauer davon abhängt und
    // `angepassteEinheit()` sie sonst aus der Beschriftung zurückraten müsste.
    absicht,
    uebungen,
    prophylaxe,
    minuten: kraftMinuten(uebungen, prophylaxe, absicht),
    warum: nachSprint
      ? 'Kraft nach dem Sprint am selben Tag: So bleiben die übrigen Tage wirklich frei. '
        + 'Umgekehrt wäre der Sprint durch die Vorermüdung wertlos.'
      // Hier stand: „…und liegt damit über den 10 Sätzen, ab denen die
      // Dosis-Wirkung deutlich wird." Das war schlicht falsch – die eigene
      // Volumenbewertung zählt bei Nils' Voreinstellung 8 von 11
      // Muskelgruppen darunter, bei drei Trainingstagen alle elf. Ein Plan,
      // der über sich selbst etwas behauptet, das der Tracker eine Ansicht
      // weiter widerlegt, ist genau die Falle aus Nr. 17.
      : 'Ganzkörper statt Split – bei dieser Frequenz trifft jede Muskelgruppe zweimal pro Woche. '
        + `Die ${VOLUMEN.minimum} Sätze je Muskelgruppe, ab denen die `
        + 'Dosis-Wirkung für Muskelaufbau deutlich wird, erreichen dabei nur die großen Ketten. '
        + 'Das ist Absicht: Der Schwerpunkt liegt auf Kraft und Sprint, und dort greift der '
        + 'abnehmende Grenzertrag früher als beim Muskelaufbau (Pelland 2025, 67 Studien) – '
        + 'die Last trägt mehr als der zwölfte Satz. '
        + 'Wer gezielt Masse aufbauen will, braucht mehr Sätze – '
        + 'die Volumenkarte im Fortschritt zeigt, wo.',
  };
}

/**
 * Aus Prozentvorgabe und Leistungsstand eine Last in Kilo machen.
 *
 * Ohne Datenlage bleibt es bei der Prozentangabe – eine erfundene Zahl wäre
 * schlechter als gar keine, weil sie am Gerät wie eine Vorgabe aussähe. Sobald
 * ein Test oder ein protokollierter Satz vorliegt, steht dort ein Gewicht.
 */
function mitLast(uebung, leistung) {
  const { schluessel, repBereich, prozent, saetze, name, hinweis, koerpergewicht } = uebung;
  const gewicht = arbeitsgewicht(schluessel, prozent, leistung.maxima || {}, leistung.koerpergewichtKg);
  const letzte = leistung.letzte?.[schluessel];
  // Die Vorgabe muss mit: Der Vorschlag steht in derselben Zeile und darf ihr
  // nicht widersprechen – siehe `naechsteLast`.
  const vorschlag = naechsteLast(schluessel, letzte, repBereich, gewicht);

  let intensitaet;
  if (koerpergewicht) {
    if (gewicht?.bis > 0) {
      intensitaet = gewicht.von > 0
        ? `Körpergewicht + ${zahlText(gewicht.von)}–${zahlText(gewicht.bis)} kg`
        : `Körpergewicht bis + ${zahlText(gewicht.bis)} kg`;
    } else if (gewicht) {
      // Zielintensität liegt unter dem eigenen Körpergewicht – dann geht es
      // über die Wiederholungen, nicht über Zusatzlast.
      intensitaet = 'Körpergewicht, noch keine Zusatzlast nötig';
    } else {
      intensitaet = 'Körpergewicht, ggf. mit Zusatzlast';
    }
  } else if (gewicht) {
    intensitaet = gewicht.von === gewicht.bis
      ? `${zahlText(gewicht.von)} kg`
      : `${zahlText(gewicht.von)}–${zahlText(gewicht.bis)} kg`;
  } else {
    // Ohne Datenlage bleibt die Prozentangabe. Auf ganze Prozent gerundet –
    // eine Nachkommastelle würde eine Genauigkeit vortäuschen, die eine
    // Maximalkraftschätzung ohnehin nicht hat.
    intensitaet = `${Math.round(prozent[0])}–${Math.round(prozent[1])} % 1RM`;
  }

  return {
    schluessel,
    name,
    saetze,
    // Damit die Oberfläche weiß, ob ein Gewichtsfeld überhaupt Sinn ergibt.
    ohneLast: Boolean(UEBUNGEN[schluessel]?.ohneLast),
    koerpergewicht,
    wiederholungen: `${repBereich[0]}–${repBereich[1]}`,
    repBereich,
    intensitaet,
    prozent,
    gewicht,
    // Der Vorschlag aus dem Protokoll schlägt die Prozentrechnung: Er kennt die
    // Tagesform der letzten Einheit, die Formel kennt nur eine alte Bestleistung.
    //
    // Genau deshalb muss der Blockwechsel durch: Wer hier eine Zahl liest,
    // nimmt sie *statt* der Vorgabe. Steht keine Zahl da, weil die letzte
    // Einheit aus einem anderen Block stammt, ist die Begründung dafür das
    // Wichtigste an der Zeile – vorher fiel sie mangels `empfehlung` weg und
    // der Sprung von 105 auf 35–75 kg stand kommentarlos da.
    //
    // „Noch nichts protokolliert" bleibt dagegen draußen: Das erklärt nichts,
    // was die Vorgabe darüber nicht schon sagt, und stünde in der ersten Woche
    // unter jeder einzelnen Übung.
    // Auch „ohneZusatzlast" trägt keine Zahl und muss trotzdem durch: Dort
    // steht der einzige Hebel, den es bei einer Körpergewichtsübung gibt.
    // Genau diese Bedingung hat schon einmal eine Begründung verschluckt.
    vorschlag: (vorschlag?.empfehlung != null
      || vorschlag?.richtung === 'neuerBlock'
      || vorschlag?.richtung === 'ohneZusatzlast')
      ? vorschlag : null,
    hinweis,
  };
}

/** Ausdauereinheit, polarisiert: entweder wirklich locker oder wirklich hart. */
function ausdauereinheit(hart, volumen, profil, geraet, teiltTag, ausgleich = 1) {
  const geraetName = {
    rad: 'Rad', rudern: 'Rudergerät', laufen: 'Laufen',
    schwimmen: 'Schwimmen', crosstrainer: 'Crosstrainer',
  }[geraet.name] || 'Rad';

  const { einfahrenMinuten, ausfahrenMinuten, intervall, lockerMinuten } = AUSDAUER.dauer;

  if (hart) {
    // Das Volumen bestimmt die Zahl der Intervalle, die Intervalle bestimmen
    // die Dauer. Vorher lief das getrennt: Der Inhalt stand fest bei „5 × 3 min
    // hart", nur die Minutenzahl oben folgte der Phase – und die geht in den
    // Kalorienbedarf. Ein- und Ausfahren werden dabei nicht gekürzt, aus
    // demselben Grund wie beim Sprint das Aufwärmen.
    const anzahl = Math.max(intervall.minAnzahl, Math.round(intervall.anzahl * volumen));
    return intervallEinheit(geraetName, anzahl);
  }

  // Der geteilte Tag bleibt kurz; der freie holt nach, was der Woche fehlt.
  const grundlage = teiltTag
    ? lockerMinuten.geteilterTag
    : lockerMinuten.allein * ausgleich;
  const minuten = Math.max(AUSDAUER.dauer.mindestMinuten, Math.round(grundlage * volumen));
  return lockereEinheit(geraetName, minuten, teiltTag);
}

/**
 * Intervalleinheit aus der Zahl der Intervalle.
 *
 * Eigener Baustein, damit die angepasste Fassung dieselbe Herleitung benutzt
 * statt daneben zu rechnen. Vorher multiplizierte `angepassteEinheit()` nur
 * die Blockminuten: Aus „5 × 3 min hart / 3 min locker" wurden 15 Minuten
 * Arbeit, in der Überschrift standen aber weiter fünf Intervalle. Genau der
 * Fehler, den Falle 37 beim Sprint behoben hat – die Ausdauer blieb übrig.
 * Ein- und Ausfahren werden dabei nicht gekürzt, aus demselben Grund wie das
 * Aufwärmen beim Sprint.
 */
function intervallEinheit(geraetName, anzahl) {
  const { einfahrenMinuten, ausfahrenMinuten, intervall } = AUSDAUER.dauer;
  const bloecke = [
    { titel: 'Einfahren', inhalt: `${einfahrenMinuten} min locker steigernd.`, minuten: einfahrenMinuten },
    {
      titel: `${anzahl} × ${intervall.arbeitMinuten} min hart / ${intervall.pauseMinuten} min locker`,
      inhalt: 'Hart heißt: die letzten 30 s kosten Überwindung, aber die Leistung bricht nicht ein. '
        + 'Gleichmäßig, nicht als Wettkampf gegen den ersten Block.',
      minuten: anzahl * (intervall.arbeitMinuten + intervall.pauseMinuten),
    },
    { titel: 'Ausfahren', inhalt: `${ausfahrenMinuten} min locker.`, minuten: ausfahrenMinuten },
  ];
  return {
    typ: 'ausdauerIntervalle',
    titel: `Intervalle (${geraetName})`,
    fokus: 'VO2max',
    geraetName,
    intervalle: anzahl,
    bloecke,
    minuten: bloecke.reduce((s, b) => s + b.minuten, 0),
    warum: 'Die harten 20 % des Ausdauerumfangs. Mehr davon bringt nicht mehr, '
      + 'sondern verhindert nur die Erholung für den Sprint.',
  };
}

/**
 * Lockere Einheit aus fertigen Minuten.
 *
 * Die Minutenzahl steht in der Blockaufschrift – wird sie nachträglich
 * gekürzt, driften Aufschrift und Dauer auseinander. Nach einem roten
 * Morgen-Check stand im Kopf „51 min" und darunter „101 min gleichmäßig
 * locker" (Falle 13). Deshalb baut die angepasste Fassung neu, statt zu
 * multiplizieren.
 */
function lockereEinheit(geraetName, minuten, teiltTag) {
  return {
    typ: 'ausdauerLocker',
    titel: `Grundlage (${geraetName})`,
    fokus: 'Aerobe Basis',
    geraetName,
    teiltTag: Boolean(teiltTag),
    bloecke: [
      {
        titel: `${minuten} min gleichmäßig locker`,
        inhalt: 'Test: Du kannst in ganzen Sätzen sprechen. Geht das nicht, ist es zu schnell. '
          + 'Genau hier wird am häufigsten zu hart trainiert.',
        minuten,
      },
    ],
    minuten,
    warum: teiltTag
      ? 'Teilt sich den Tag mit dem Krafttraining – dann mit mindestens 6 h Abstand, '
        + 'weil direkt aufeinander die Kraftanpassung leidet.'
      : 'Die lockere Mehrheit des Ausdauerumfangs. Sie beschleunigt die Erholung zwischen '
        + 'den harten Tagen, statt sie zu verbrauchen.',
  };
}

/* -------------------------------------------------------------- Hinweise */

function wochenHinweise(profil, plan, schluessel, einstieg, wochenminuten, woche, umfangKraft) {
  const hinweise = [];

  if (einstieg) {
    hinweise.push({
      art: 'info',
      text: 'Wiedereinstiegswoche: Umfang bewusst reduziert. Sehnen und Bänder passen sich '
        + 'langsamer an als Muskeln und Motivation – die ersten beiden Wochen sind zum Ankommen da.',
    });
  }

  /*
   * Weniger belegte Tage als eingestellt – und warum.
   *
   * Der Planer legt Kraft zuerst auf die Sprinttage, damit die übrigen Tage
   * wirklich locker bleiben. Bei vier bis sechs eingestellten Tagen bleibt
   * deshalb in gut jeder vierten Kombination aus Reglerstand und Tageszahl ein
   * Kalendertag frei. Das Trainingsvolumen geht dabei nicht verloren, es liegt
   * nur auf weniger Tagen.
   *
   * Bisher stand da nichts: Im Profil wählt man „5 Tage", im Wochenplan
   * stehen vier, und niemand sagt, ob das Absicht oder ein Fehler ist. Genau
   * die Familie aus Falle 22 – wo etwas fehlt, gehört der Grund an die Stelle,
   * an der es fehlt. Ob das Feld „verfügbare Tage" oder „geplante Tage"
   * heißen soll, bleibt eine Trainingsentscheidung; sagen kann der Plan es
   * trotzdem.
   */
  const belegt = plan.filter((t) => t.trainingstag).length;
  const eingestellt = clamp(Number(profil?.trainingstageProWoche) || 4, 3, 6);
  if (belegt < eingestellt) {
    hinweise.push({
      art: 'info',
      text: `${belegt} von ${eingestellt} eingestellten Tagen belegt – das ist Absicht und `
        + 'kein verlorenes Training: Kraft liegt auf den Sprinttagen, damit die übrigen Tage '
        + `wirklich locker bleiben. Der Umfang der Woche steht trotzdem, er verteilt sich nur `
        + `auf ${menge(belegt, 'Tag', 'Tage')}. Wer lieber mehr Kalendertage belegt, `
        + 'schiebt den Ausrichtungsregler Richtung Ausdauer – dort verteilt sich mehr.',
    });
  }

  if (schluessel === 'entlastung') {
    hinweise.push({
      art: 'info',
      // Hier stand „Umfang halbiert". Der Faktor 0,5 steht zwar in der Phase,
      // kommt aber nirgends ganz an: Die Sätze haben eine Untergrenze von zwei
      // je Übung, das Aufwärmen wird nicht gekürzt. Herausgekommen sind rund
      // ein Drittel weniger Minuten und ein knappes Viertel weniger Sätze.
      // Der Hinweis nennt deshalb keinen Bruchteil mehr – die Wochensumme steht
      // ohnehin oben in der Karte.
      text: 'Entlastungswoche: Umfang deutlich runter, Lasten bleiben. Die Anpassung entsteht '
        + 'jetzt, nicht in den drei Wochen davor. Wer sie überspringt, sammelt Ermüdung '
        + 'statt Form.',
    });

    /*
     * Und wo die Entlastung *nicht* ankommt, gehört das dazugesagt.
     *
     * Die Sätze haben eine Untergrenze von zwei je Übung. Im
     * Realisierungsblock liegt der Plan schon in den Arbeitswochen darauf –
     * die Entlastungswoche ist dort im Kraftraum Satz für Satz dieselbe
     * Einheit. Das sieht aus wie ein Fehler und ist eine Untergrenze; wer die
     * beiden nicht unterscheiden kann, hält irgendwann beides für Zufall
     * (Falle 22: Wo etwas fehlt, gehört der Grund an die Stelle).
     */
    // Der Wiedereinstieg bleibt außen vor: Er greift nur in Woche 1 und 2, und
    // die sind nie Entlastungswochen.
    const saetzeIn = (w) => kraftSaetze(kraftAbsichtDerWoche(w),
      PHASEN[phaseSchluessel(w)].volumenFaktor * umfangKraft);
    if (saetzeIn(woche) === saetzeIn(woche - 1)) {
      hinweise.push({
        art: 'info',
        text: `Im Kraftraum ändert sich dabei nichts: ${KRAFT.saetzeProUebung.minimum} Sätze `
          + 'je Übung sind die Untergrenze, und dort liegt der Plan in diesem Block schon in '
          + 'den Arbeitswochen. Die Entlastung kommt hier über Sprint und Ausdauer.',
      });
    }
  }

  const doppeltage = plan.filter((t) => t.einheiten.length > 1);
  for (const tag of doppeltage) {
    const typen = tag.einheiten.map((e) => e.typ);
    if (typen.includes('kraft') && typen.some((t) => t.startsWith('ausdauer'))) {
      hinweise.push({
        art: 'warnung',
        text: `${tag.name}: Kraft und Ausdauer am selben Tag – mindestens `
          + `${AUSDAUER.mindestabstandStunden} h dazwischen legen, sonst frisst die `
          + 'Ausdauereinheit einen Teil der Kraftanpassung. Wie stark sie stört, hängt vom '
          + 'Gerät ab: Laufen am meisten, Radfahren am wenigsten. Die Rangfolge ist belegt, '
          + 'die einzelnen Zahlen sind Erfahrungswerte – ebenso die sechs Stunden.',
      });
    }
  }

  const geraet = profil?.ausdauerGeraet;
  const ausrichtung = Number(profil?.ausrichtung) || 0;
  if (geraet === 'laufen' && ausrichtung <= 35) {
    hinweise.push({
      art: 'warnung',
      text: 'Laufen als Ausdauergerät bei starkem Sprintfokus: Das ist die Variante mit der '
        + 'größten Störung der Kraftentwicklung. Auf dem Rad bekämst du dieselbe aerobe Wirkung '
        + 'für deutlich weniger Muskelschaden.',
    });
  }

  if (wochenminuten > BELASTUNG.hinweisAbWochenminuten) {
    hinweise.push({
      art: 'warnung',
      text: `${Math.round(wochenminuten / 60)} h Training in dieser Woche. Das ist viel – `
        + 'wenn Schlaf oder Essen nicht mitziehen, wird daraus Ermüdung statt Fortschritt. '
        + 'Wo „viel" anfängt, ist Erfahrung und keine Studienlage: Die Grenze hängt an '
        + 'Vorgeschichte, Schlaf und Alltag und liegt bei jedem woanders.',
    });
  }

  return hinweise;
}

/* -------------------------------------------------- Anpassung an den Tag */

/**
 * Die Einheit an die Tagesform anpassen.
 *
 * Ohne diesen Schritt wäre der Morgen-Check Dekoration: Er sagte „Umfang um ein
 * Drittel kürzen", und daneben stand der unveränderte Plan. Wer das ein paar
 * Mal sieht, füllt den Check nicht mehr aus – zu Recht.
 *
 * Gekürzt wird immer der **Umfang**, nie die Intensität. Das ist der
 * Standardweg der Autoregulation: Die Last hält die Anpassung aufrecht, das
 * Volumen erzeugt die Ermüdung. Wer stattdessen leichter macht und alle Sätze
 * durchzieht, hat am Ende beides verloren.
 *
 * Der Plan wird dabei nie stillschweigend verändert. Was gekürzt wurde, steht
 * in `anpassung` und wird in der Oberfläche angezeigt – samt der Möglichkeit,
 * das Original zu sehen.
 */
export function angepassteEinheit(einheit, bereitschaft) {
  if (!einheit || !bereitschaft?.vollstaendig || bereitschaft.ampel === 'gruen') {
    return einheit;
  }

  const rot = bereitschaft.ampel === 'rot';
  const hart = einheit.typ === 'sprint' || einheit.typ === 'ausdauerIntervalle';

  // Rote Ampel und harte Einheit: Die Einheit entfällt. Ein Sprint bei 40 %
  // Bereitschaft ist kein langsamer Sprint, sondern ein Verletzungsrisiko ohne
  // Trainingsreiz – Höchstgeschwindigkeit entsteht nur frisch.
  if (rot && hart) {
    const ersatz = BEREITSCHAFT.ersatzbewegungMinuten;
    return {
      ...einheit,
      typ: 'mobilitaet',
      // Die Aufschrift nennt, was tatsächlich ersetzt wurde. Hier stand fest
      // „Statt Sprint" – dieser Zweig gilt aber auch für die Intervalleinheit,
      // und über einer gestrichenen Ausfahrt stand dann „Statt Sprint:
      // lockere Bewegung" an einem Tag ganz ohne Sprint (Familie von Falle 38).
      titel: `Statt ${einheit.titel}: lockere Bewegung`,
      fokus: 'Erholung',
      minuten: ersatz.bis,
      meter: 0,
      // Wie `meter`, `uebungen` und `prophylaxe`: Was die Einheit nicht mehr
      // ist, darf sie auch nicht mehr behaupten. `intervalle` blieb als
      // einziges Feld stehen – eine gestrichene Intervalleinheit trug weiter
      // „7 Intervalle" mit sich. Heute liest das niemand; ein Feld, das dem
      // Objekt widerspricht, ist aber genau die Sorte Rest, aus der später
      // eine falsche Anzeige wird (Falle 30).
      intervalle: undefined,
      bloecke: [{
        titel: `${ersatz.von}–${ersatz.bis} min sehr locker`,
        inhalt: 'Gehen, lockeres Radfahren oder Mobilität. Kein Abschnitt, bei dem die '
          + 'Atmung schwer wird. Ziel ist Durchblutung, nicht Reiz.',
        minuten: ersatz.bis,
      }],
      uebungen: undefined,
      prophylaxe: undefined,
      warum: 'Die geplante harte Einheit ist gestrichen. Bei dieser Bereitschaft bringt sie '
        + 'keine Anpassung, nur Risiko – und kostet die Qualität der nächsten Tage mit.',
      anpassung: {
        art: 'gestrichen',
        grund: `Bereitschaft ${bereitschaft.prozent} %`,
        original: { titel: einheit.titel, minuten: einheit.minuten },
      },
    };
  }

  // Rote Ampel bei Kraft, oder gelbe Ampel allgemein: Umfang kürzen.
  // Ein Drittel bei Gelb, die Hälfte bei Rot.
  const faktor = rot ? 0.5 : 0.67;

  const angepasst = {
    ...einheit,
    anpassung: {
      art: 'gekuerzt',
      faktor,
      grund: `Bereitschaft ${bereitschaft.prozent} %`,
      original: { minuten: einheit.minuten, saetze: einheit.uebungen?.map((u) => u.saetze) },
    },
  };

  if (einheit.uebungen) {
    // Mindestens ein Satz bleibt stehen – eine Übung ganz zu streichen ändert
    // den Trainingsinhalt, nicht nur die Dosis.
    angepasst.uebungen = einheit.uebungen.map((u) => ({
      ...u,
      saetze: Math.max(1, Math.round(u.saetze * faktor)),
    }));
    // Die Prophylaxe bleibt vollständig: Sie kostet vier Minuten, erzeugt kaum
    // Ermüdung, und ausgerechnet an schlechten Tagen ist das Verletzungsrisiko
    // am höchsten.
  }

  // Auf- und Auswärmen werden nicht gekürzt – sie sind der Teil, der bei
  // schlechter Tagesform am wichtigsten ist.
  const schonen = (titel) => /Anlauf|Auslaufen|Neuromuskul|Steigerung/i.test(titel);

  if (einheit.typ === 'sprint' && einheit.sprintFokus) {
    // Die Einheit wird neu gebaut statt nachträglich heruntergerechnet. Vorher
    // wurden nur `meter` und die Blockminuten mit dem Faktor multipliziert,
    // während die Überschrift ihre alte Laufzahl behielt: Im Kopf stand
    // „322 m", im Block „16 × 30 m, aufgeteilt in 4 Sätze à 4" – also 480 m.
    // Wer die Einheit liest, läuft die 16; gezählt wurden 322. Und 322 sind
    // nicht einmal durch 30 teilbar, eine Sprinteinheit hat aber ganze Läufe.
    const neu = sprinteinheit({ sprintFokus: einheit.sprintFokus },
      Math.round(einheit.meter * faktor));
    angepasst.meter = neu.meter;
    angepasst.bloecke = neu.bloecke.map((b) => (
      // Der Sprintblock selbst ist über die Läufe schon gekürzt.
      schonen(b.titel) || b.titel === neu.bloecke.find((x) => /×/.test(x.titel))?.titel
        ? b
        : { ...b, minuten: Math.max(5, Math.round(b.minuten * faktor)) }));
  } else if (einheit.typ === 'ausdauerIntervalle' && einheit.intervalle) {
    // Wie beim Sprint: neu bauen statt herunterrechnen. Gekürzt wird die Zahl
    // der Intervalle – daraus folgt die Dauer. Vorher fielen nur die Minuten,
    // und über „5 × 3 min hart" stand plötzlich eine Dauer für drei.
    // Mindestens eines bleibt stehen; null Intervalle wären keine gekürzte
    // Intervalleinheit, sondern eine gestrichene (das ist der Fall darüber).
    const neu = intervallEinheit(einheit.geraetName,
      Math.max(1, Math.round(einheit.intervalle * faktor)));
    angepasst.bloecke = neu.bloecke;
    angepasst.intervalle = neu.intervalle;
  } else if (einheit.typ === 'ausdauerLocker' && einheit.geraetName) {
    // Die Minutenzahl steht in der Blockaufschrift, also muss sie mitwandern.
    // Die Untergrenze aus der Planung gilt hier nicht: Sie sorgt dafür, dass
    // eine *geplante* Einheit sich lohnt – eine wegen schlechter Bereitschaft
    // gekürzte darf kürzer sein, sonst wäre die Kürzung wirkungslos.
    angepasst.bloecke = lockereEinheit(einheit.geraetName,
      Math.max(5, Math.round(einheit.minuten * faktor)), einheit.teiltTag).bloecke;
  } else if (einheit.bloecke) {
    angepasst.bloecke = einheit.bloecke.map((b) => (
      schonen(b.titel) ? b : { ...b, minuten: Math.max(5, Math.round(b.minuten * faktor)) }));
    angepasst.meter = einheit.meter ? Math.round(einheit.meter * faktor) : einheit.meter;
  }

  // Die Minuten folgen dem, was übrig bleibt – nicht dem Faktor. Bei Kraft
  // liegen sie deshalb über `minuten × faktor`: Aufwärmen und Prophylaxe
  // bleiben ja ausdrücklich stehen. Die Zahl geht in den Kalorienbedarf, und
  // ausgerechnet an einem schlechten Tag zu wenig zu essen ist die falsche
  // Richtung.
  if (angepasst.bloecke) {
    angepasst.minuten = angepasst.bloecke.reduce((s, b) => s + b.minuten, 0);
  } else if (angepasst.uebungen) {
    angepasst.minuten = kraftMinuten(angepasst.uebungen, angepasst.prophylaxe, einheit.absicht);
  } else {
    angepasst.minuten = Math.round(einheit.minuten * faktor);
  }

  // Was der Faktor *vorhatte*, ist nicht, was am Ende dasteht: Bei zwei
  // Sätzen je Übung liefern „ein Drittel weniger" und „die Hälfte weniger"
  // dieselbe Vorgabe, weil unter einem Satz nichts mehr geht. Solange die
  // Minuten pauschal gerechnet wurden, sah man das nicht – 51 gegen 38 Minuten
  // suggerierten zwei verschiedene Einheiten. Der Text nennt deshalb die
  // Sätze, die tatsächlich übrig bleiben, statt einen Bruchteil zu behaupten.
  const satzSumme = (liste) => (liste || []).reduce((s, u) => s + (Number(u.saetze) || 0), 0);
  const vorherSaetze = satzSumme(einheit.uebungen);
  const nachherSaetze = satzSumme(angepasst.uebungen);
  const umfangSatz = einheit.uebungen
    ? `Umfang von ${menge(vorherSaetze, 'Satz', 'Sätzen')} auf ${nachherSaetze} herunter`
    : (rot ? 'Umfang halbiert' : 'Umfang um ein Drittel gekürzt');

  angepasst.warum = `${umfangSatz}, `
    + 'Lasten bleiben. Das ist die richtige Reihenfolge: Die Last hält die Anpassung, '
    + 'das Volumen erzeugt die Ermüdung. Leichter machen und trotzdem alle Sätze ziehen '
    + 'verliert beides.';

  return angepasst;
}

/** Flache Liste aller Einheiten – für den Kalorienbedarf je Tag. */
export function einheitenAmTag(plan, tagIndex) {
  const tag = plan?.tage?.[tagIndex];
  if (!tag) return [];
  return tag.einheiten.map((e) => ({ typ: e.typ, minuten: e.minuten }));
}
