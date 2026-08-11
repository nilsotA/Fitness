// Sprintzeiten und die Abbruchregel.
//
// Die Zeit je Lauf ist das direkteste Qualitätssignal, das es im Sprinttraining
// gibt – direkter als RPE, direkter als Herzfrequenz. Und sie beantwortet die
// einzige Frage, die während der Einheit zählt: Ist das hier noch Sprinttraining
// oder schon Ermüdungsarbeit?
//
// Reine Rechenfunktionen ohne Netzwerk oder Dateizugriff – damit testbar.

import { SPRINT_QUALITAET } from './wissen.js';
import { round } from './profil.js';
import { menge } from './regeln.js';

// Die Bewertung eines einzelnen Laufs muss auch im Browser laufen – zwischen
// zwei Läufen, ohne Netzwerkaufruf. Sie liegt deshalb in regeln.js und
// wird von dort bezogen, statt hier ein zweites Mal zu existieren.
import { geschwindigkeit, pruefeLaeufe, laufBewerten as bewerten } from './regeln.js';

export { geschwindigkeit, pruefeLaeufe };

/** Bewertung eines Laufs mit der Schwelle aus der Evidenzbasis. */
export function laufBewerten(laeufe, index, schwelle = SPRINT_QUALITAET) {
  return bewerten(laeufe, index, schwelle);
}

/**
 * Auswertung einer Sprinteinheit.
 *
 * Gemessen wird gegen die **Tagesbestzeit**, nicht gegen eine Saisonbestzeit:
 * An einem schlechten Tag ist man ohnehin langsamer, und darum geht es hier
 * nicht. Es geht um den Abfall innerhalb der Einheit – also um die Frage, ab
 * wann die Läufe nichts mehr beitragen.
 *
 * Läufe unterschiedlicher Distanz oder Art werden getrennt betrachtet. Eine
 * fliegende 30 und eine 30 aus dem Stand sind völlig verschiedene Zeiten; sie
 * miteinander zu vergleichen ergäbe Unsinn.
 */
export function auswertung(laeufe, schwelle = SPRINT_QUALITAET) {
  const sauber = pruefeLaeufe(laeufe);
  if (!sauber.length) return { bewertbar: false, hinweis: 'Keine Zeiten erfasst.' };

  // Nach Distanz und Art gruppieren.
  const gruppen = new Map();
  sauber.forEach((lauf, index) => {
    const schluessel = `${lauf.art}-${lauf.distanz}`;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push({ ...lauf, index });
  });

  const ergebnisse = [];
  for (const [schluessel, liste] of gruppen) {
    const zeiten = liste.map((l) => l.sekunden);
    const beste = Math.min(...zeiten);

    /*
     * Ein Lauf **vor** der Tagesbestzeit kann keine Ermüdung sein.
     *
     * Die Zeiten werden gegen die beste der ganzen Einheit gehalten – auch
     * die vom Anfang. Wer den ersten Lauf noch nicht ganz warm absolviert,
     * bekam damit gleich Rot: Bei 3 % Aufwärmrückstand – für den ersten
     * Sprint völlig normal, `wissen.js` sagt das im eigenen Kommentar –
     * stand `ersterAbbruch` auf 0, und die Oberfläche meldete „0/8 Läufe in
     * Qualität". Also: gar nicht erst sprinten.
     *
     * Das Argument ist einfach: Wenn ein späterer Lauf schneller war, war der
     * frühere nicht ermüdungsbedingt langsam. Erst ab der Bestzeit ist ein
     * Abfall ein Abfall; davor ist er Anlauf. Die Live-Bewertung in
     * `regeln.js` hat das Problem nicht – sie sieht die späteren Läufe noch
     * nicht und misst gegen die Bestzeit *bisher*.
     */
    const bestIndex = zeiten.indexOf(beste);

    const bewertet = liste.map((l, i) => {
      const abfall = round(((l.sekunden - beste) / beste) * 100, 1);
      let stufe = 'gut';
      if (i < bestIndex && abfall >= schwelle.warnungProzent) stufe = 'anlauf';
      else if (abfall >= schwelle.abbruchProzent) stufe = 'abbruch';
      else if (abfall >= schwelle.warnungProzent) stufe = 'warnung';
      return { ...l, abfall, stufe, tempo: geschwindigkeit(l.distanz, l.sekunden) };
    });

    // Der erste Lauf jenseits der Schwelle markiert das Ende der Qualität.
    // Was danach kam, zählt als Umfang ohne Reiz – nicht als Fehler, aber als
    // etwas, das beim nächsten Mal wegbleiben kann.
    const ersterAbbruch = liste.length >= schwelle.minLaeufeFuerBewertung
      ? bewertet.findIndex((l) => l.stufe === 'abbruch')
      : -1;

    ergebnisse.push({
      schluessel,
      art: liste[0].art,
      distanz: liste[0].distanz,
      laeufe: bewertet,
      besteZeit: round(beste, 2),
      bestesTempo: geschwindigkeit(liste[0].distanz, beste),
      anzahl: liste.length,
      ersterAbbruch,
      qualitaetslaeufe: ersterAbbruch === -1 ? liste.length : ersterAbbruch,
      ueberschuss: ersterAbbruch === -1 ? 0 : liste.length - ersterAbbruch,
    });
  }

  const gesamt = ergebnisse.reduce((s, g) => s + g.anzahl, 0);
  const ueberschuss = ergebnisse.reduce((s, g) => s + g.ueberschuss, 0);
  const bewertbar = gesamt >= schwelle.minLaeufeFuerBewertung;

  return {
    bewertbar,
    gruppen: ergebnisse,
    gesamt,
    ueberschuss,
    meter: sauber.reduce((s, l) => s + l.distanz, 0),
    qualitaetsmeter: ergebnisse.reduce((s, g) => s + g.qualitaetslaeufe * g.distanz, 0),
    schwelle,
    text: !bewertbar
      ? `Erst ab ${schwelle.minLaeufeFuerBewertung} Läufen bewertbar – vorher steht die `
        + 'Tagesbestzeit noch nicht fest.'
      : ueberschuss === 0
        ? 'Alle Läufe im Qualitätsbereich. Genau so soll eine Sprinteinheit aussehen.'
        // `ueberschuss` zählt die Läufe **ab** dem ersten Abbruch, nicht die
        // Läufe über der Schwelle – dazwischen liegen die, die danach noch
        // einmal knapp darunter kamen. Der Text behauptete das Zweite und
        // nannte die Zahl des Ersten: „5 von 8 Läufen lagen mehr als 3 % über
        // deiner Tagesbestzeit", wo genau einer drüber lag. Gleiche Familie
        // wie Falle 15 – ein Zähler muss zählen, was sein Name behauptet.
        : `${menge(ueberschuss, 'Lauf kam', 'Läufe kamen')} nach dem ersten Abfall über `
          + `${schwelle.abbruchProzent} % (von ${gesamt} insgesamt). Ab dort erzeugen sie `
          + 'Ermüdung, aber keine Schnelligkeit – beim nächsten Mal dort aufhören.',
  };
}

/**
 * Bestzeiten über die Zeit, gruppiert nach Distanz und Art. Das ist die
 * eigentliche Leistungskurve: Sie entsteht aus jedem Training, nicht nur aus
 * den vier bis sechs Tests im Jahr.
 */
export function bestzeitVerlauf(sessions = []) {
  const verlauf = {};
  for (const session of sessions) {
    const sauber = pruefeLaeufe(session.laeufe);
    if (!sauber.length) continue;

    const proGruppe = new Map();
    for (const lauf of sauber) {
      const schluessel = `${lauf.art}-${lauf.distanz}`;
      const bisher = proGruppe.get(schluessel);
      if (!bisher || lauf.sekunden < bisher) proGruppe.set(schluessel, lauf.sekunden);
    }
    for (const [schluessel, zeit] of proGruppe) {
      verlauf[schluessel] = verlauf[schluessel] || [];
      verlauf[schluessel].push({
        datum: session.datum,
        sekunden: round(zeit, 2),
        tempo: geschwindigkeit(Number(schluessel.split('-')[1]), zeit),
      });
    }
  }
  // Bei zwei Einheiten am selben Tag entscheidet die Reihenfolge, in der sie
  // protokolliert wurden – deshalb `0` und nicht `-1`. Ein Vergleich, der bei
  // Gleichstand ±1 zurückgibt, dreht gleichrangige Einträge um (Falle 63);
  // zwei Ausfahrten an einem Tag stünden dann verkehrt herum in der Kurve.
  for (const liste of Object.values(verlauf)) {
    liste.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  }
  return verlauf;
}

/**
 * Die Bestzeit je Gruppe – und wann sie gelaufen wurde.
 *
 * Für einen Sprinter ist das *die* Zahl. Sie stand bisher nirgends: Die Karte
 * zeigte nur „beste Zeit zuletzt", also den besten Lauf der letzten Einheit.
 * An einem müden Tag sieht das aus wie ein Rückschritt, obwohl die Bestzeit
 * unangetastet daneben steht.
 *
 * Mitgeliefert wird der Abstand zur Bestzeit, weil erst der die letzte Einheit
 * einordnet: 1 % über der Bestzeit ist ein guter Tag, 6 % sind ein müder.
 */
export function bestzeiten(verlauf = {}) {
  const beste = {};
  for (const [schluessel, liste] of Object.entries(verlauf)) {
    if (!liste.length) continue;
    const rekord = liste.reduce((a, b) => (b.sekunden < a.sekunden ? b : a));
    const letzte = liste[liste.length - 1];
    beste[schluessel] = {
      ...rekord,
      letzte,
      // Ist die Bestzeit die letzte Einheit, gibt es keinen Abstand zu zeigen.
      istAktuell: rekord.datum === letzte.datum && rekord.sekunden === letzte.sekunden,
      /*
       * Egalisiert: dieselbe Zeit noch einmal, aber an einem anderen Tag.
       *
       * `reduce` behält bei Gleichstand den früheren Eintrag – richtig so,
       * denn gefragt ist, *wann* die Bestzeit gelaufen wurde. Damit ist
       * `istAktuell` aber falsch, und in der Karte stand „0 % darüber" über
       * einer Zeit, die man gerade wieder erreicht hat. Der Abstand stimmt,
       * die Aufschrift passt nicht zu ihrem Fall (Familie von Falle 10).
       */
      egalisiert: !(rekord.datum === letzte.datum) && rekord.sekunden === letzte.sekunden,
      abstandProzent: rekord.sekunden
        ? round(((letzte.sekunden - rekord.sekunden) / rekord.sekunden) * 100, 1) : 0,
      einheiten: liste.length,
    };
  }
  return beste;
}

/**
 * Klartext für eine Sprintart – „fliegend" oder „aus dem Stand".
 *
 * Steht eigens hier, weil der Protokolldialog die Art beschriftet, bevor es
 * eine Distanz gibt: Dort stand dieselbe Fallunterscheidung noch einmal. Zwei
 * Aufschriften für dieselbe Sache halten genau so lange zusammen, bis eine
 * angefasst wird.
 */
export function artName(art) {
  return art === 'fliegend' ? 'fliegend' : 'aus dem Stand';
}

/** Klartext für einen Gruppenschlüssel wie „fliegend-30". */
export function gruppenName(schluessel) {
  const [art, distanz] = String(schluessel).split('-');
  return `${distanz} m ${artName(art)}`;
}
