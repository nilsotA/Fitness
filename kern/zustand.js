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
  SPRINT_QUALITAET, AUSDAUER_ZONEN, ERNAEHRUNG,
  EPLEY,
} from './wissen.js';
import { heute, wochentagIndex } from './regeln.js';

/** Wochentag-Index nach deutschem Muster: Montag = 0. */
function tagIndex(datum = heute()) {
  return wochentagIndex(datum);
}

/**
 * Die letzten 90 Gewichtseinträge – ohne die, mit denen sich nicht rechnen
 * lässt. Ein Punkt braucht ein Datum und eine endliche positive Zahl.
 *
 * Gibt beides zurück: die Punkte **und** die Zahl der unbrauchbaren. Vorher
 * stand hier nur die Liste, und der Aufrufer bildete
 * `alle.length - verlauf.length`. Das zählte aber auch die Einträge mit, die
 * bloß außerhalb der 90 liegen: Bei 200 sauberen Wiegungen – nach einem Jahr
 * regelmäßigen Wiegens der Normalfall – meldete die Gewichtskarte
 * „110 Einträge ohne lesbares Gewicht". Kein einziger davon war unlesbar.
 *
 * Derselbe Ausdruck stand zudem zweimal da, einmal je Rückgabefeld. Zwei
 * Herleitungen einer Größe, diesmal in einer Korrektur zu Falle 27 selbst
 * entstanden – siehe Falle 30.
 */
function gewichtsverlauf(alle = []) {
  // Aussortieren und entdoppeln macht `eineWiegungProTag()` – dieselbe Regel,
  // die auch der Trend benutzt. Zwei Herleitungen wären hier besonders
  // heikel: Kurve und Rate stünden dann in derselben Karte und könnten
  // verschiedene Punkte meinen (Falle 13).
  const auf = ernaehrung.wiegungenAufbereiten(alle);
  return {
    punkte: auf.punkte.slice(-90),
    unlesbar: auf.unlesbar,
    doppelt: auf.doppelt,
  };
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

  /*
   * Alles, was bis zum angesehenen Tag passiert ist – und nichts danach.
   *
   * `leistungsstand()` bekam als einzige der grossen Auswertungen keinen
   * Stichtag. `acwr`, `monotonie`, `ruhepuls`, `verteilung`,
   * `saetzeProMuskel`, `schutz` und `risiko` bekommen ihn alle. Wer drei Tage
   * zurückblätterte, las damit einen Kraftzettel, der aus Tests und Einheiten
   * gerechnet war, die es an dem Tag noch gar nicht gab: Ein Test vom 04.09.
   * bestimmte das Einer-Maximum, das über dem 15.08. stand, und mit ihm jede
   * Lastvorgabe darunter.
   *
   * Besonders unangenehm daran ist die Blockmeldung aus Falle 23: „Zuletzt
   * 105 kg – das war ein anderer Block mit anderer Absicht" stand über einer
   * Einheit, die zu diesem Zeitpunkt noch in der Zukunft lag.
   *
   * Familie von Falle 90 und 18: In der Rückschau darf die Zukunft nicht über
   * die Vergangenheit urteilen.
   */
  const bisHeute = {
    ...daten,
    tests: (daten.tests || []).filter((t) => String(t?.datum || '') <= datum),
    sessions: (daten.sessions || []).filter((x) => String(x?.datum || '') <= datum),
    gewicht: (daten.gewicht || []).filter((g) => String(g?.datum || '') <= datum),
  };

  // Der Leistungsstand geht in den Plan ein, damit dort Kilo stehen statt
  // Prozent – am Gerät ist eine Prozentangabe nutzlos.
  const stand = leistungM.leistungsstand(bisHeute);
  const plan = planM.wochenplan(profil, Math.max(1, woche), stand);
  // Einmal für die Volumenkarte und einmal für ihre Bewertung – vorher stand
  // derselbe Aufruf zweimal im Rückgabeobjekt.
  /*
   * Die Sprintkarte liest dreimal aus denselben Einheiten – und tat das
   * vorher aus drei verschiedenen Grundmengen.
   *
   * `bestzeiten()` nahm die nach Datum sortierte Liste, `letzte` den letzten
   * Eintrag im **Array**. Wer eine vergessene Sprinteinheit nachträgt, bekam
   * damit „Zuletzt 4,30 s · 04.09." und direkt darunter „Letzte Einheit ·
   * 01.09." – zwei Aussagen über dieselbe Sache auf einem Bildschirm
   * (Falle 70), und die Abbruch-Auswertung darunter gehörte zur falschen
   * Einheit. Keine der drei kannte den angesehenen Tag, obwohl Belastung,
   * Ruhepuls und Ausdauerverteilung in derselben Ansicht ihn längst
   * berücksichtigen (Falle 90).
   *
   * Und `bestzeitVerlauf()` stand zweimal im selben Objektliteral – dieselbe
   * Rechnung doppelt, wie `wochenminuten` in Falle 30 und `saetzeProMuskel`
   * in Falle 85.
   */
  const sprintBis = bisHeute.sessions;
  const sprintVerlauf = sprintM.bestzeitVerlauf(sprintBis);

  const proMuskel = leistungM.saetzeProMuskel(daten.sessions, new Date(datum));
  /*
   * Hat der Nutzer im Fenster ueberhaupt Sätze protokolliert?
   *
   * Klingt nach derselben Frage wie „ist `saetzeProMuskel` leer", ist es aber
   * nicht: `einbeinstand` trägt `muskeln: {}` – die Übung wirkt über
   * Ansteuerung, nicht über Kraft. Wer nur das Sprunggelenk-Programm
   * protokolliert, hat drei Sätze im Tagebuch und keine Muskelgruppe.
   *
   * Genau daran ist der Leerzustand-Fix aus Falle 89 gescheitert: Über einem
   * Schutzziel, das mit 3 von 2 Sätzen **erfüllt** war, stand „noch nichts
   * protokolliert", und die Zeile war grau mit „·" statt grün mit „✓" – die
   * Karte verschwieg eine Leistung, statt eine Warnung zurückzunehmen. Ein
   * Fehler in der Korrektur zu einer Falle, wie in Falle 31.
   */
  const saetzeImFenster = Object.values(leistungM.saetzeProWoche(daten.sessions, new Date(datum)))
    .reduce((summe, n) => summe + n, 0);
  /*
   * Sprinttage aus dem **Protokoll** und im **selben Fenster** wie die Sätze.
   *
   * Vorher kamen sie aus dem Plan der laufenden Woche
   * (`plan.tage.filter(… typ === 'sprint')`). Der Satz daneben lautet aber
   * „Dazu kommt der Sprint an N Tagen, der hier nicht mitgezählt wird" – eine
   * Aussage über tatsächliches Training, und die einzige Begründung dafür,
   * dass 20+ Sätze auf einer sprintbelasteten Muskelgruppe zu viel sein
   * könnten. Wer die Sprinteinheit ausgelassen hat, bekam eine Ermüdungs-
   * warnung für Training, das er nicht gemacht hat; wer bei Reglerstand 100
   * ohne geplanten Sprint auf eigene Faust sprintete, bekam sie nie.
   * Dazu deckten sich die Fenster nicht: rollende sieben Tage für die Sätze,
   * Montag bis Sonntag für den Plan.
   */
  const seit = new Date(datum);
  seit.setDate(seit.getDate() - 7);
  const sprintTage = new Set(daten.sessions
    .filter((s) => s.typ === 'sprint' && new Date(s.datum) > seit && new Date(s.datum) <= new Date(datum))
    .map((s) => s.datum)).size;
  const index = tagIndex(datum);
  const heutePlan = plan.tage[index];

  // Die Tagesform wirkt nur auf heute. Der Wochenplan bleibt unangetastet –
  // für kommende Tage ist die Bereitschaft schlicht noch nicht bekannt, und
  // ein Plan, der sich rückwirkend selbst umschreibt, wäre nicht nachvollziehbar.
  /*
   * Der **letzte** Eintrag des Tages, nicht der erste – dieselbe Regel, die
   * `checkSpeichern()` beim Schreiben durchsetzt („Der neue ersetzt den
   * alten"). Über den Dialog gibt es Doppelte nicht; eine eingespielte
   * Sicherung kann sie enthalten (Falle 27).
   *
   * Mit `find()` zeigte der Ring den **überschriebenen** Check: 100 % grün,
   * während `entlastungFaellig()` denselben Tag als rot zählte – zwei Karten
   * auf einem Bildschirm, zwei Aussagen über denselben Tag (Falle 70). Und
   * weil `heute.check` den „Ändern"-Dialog vorbelegt, hätte ein Speichern
   * ohne eine einzige Eingabe den neueren Eintrag stillschweigend
   * zurückgenommen.
   *
   * Bewusst eine Schleife statt `findLast()`: Das Projekt kommt ohne
   * Abhängigkeiten aus und soll auch auf älteren iOS-Fassungen laufen.
   */
  let checkHeute = null;
  for (const c of daten.checks) {
    if (c?.datum === datum) checkHeute = c;
  }
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
  // Auch die Gewichtskurve blickt nicht nach vorn – sie steht in derselben
  // Ansicht wie die Belastungskarte, die den Stichtag längst kennt.
  const gewicht = gewichtsverlauf(bisHeute.gewicht);

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
      grenzen: { kcalUeberschrittenAb: ERNAEHRUNG.kcalUeberschrittenAb },
      mahlzeiten: makro ? ernaehrung.mahlzeitenplan(profil, makro) : null,
      essen: essenHeute,
      check: checkHeute,
      bereitschaft: bereit,
    },
    belastung: {
      acwr: belastung.acwr(daten.sessions, new Date(datum)),
      monotonie: belastung.monotonie(daten.sessions, new Date(datum)),
      // Die Lage muss mit: „Mach eine Entlastungswoche" während einer
      // geplanten Entlastungswoche widerspricht der Karte darüber.
      entlastung: belastung.entlastungFaellig(daten.sessions, daten.checks, new Date(datum),
        { entlastungswoche: plan.entlastungswoche }),
      verlauf: belastung.wochenverlauf(daten.sessions, 12, new Date(datum)),
      ruhepuls: belastung.ruhepulsTrend(daten.checks, new Date(datum)),
      ruhepulsVerlauf: belastung.ruhepulsVerlauf(daten.checks, new Date(datum)),
      // Die Fragen kommen vom Server, damit sie nicht ein zweites Mal im
      // Browser stehen und irgendwann auseinanderlaufen.
      wohlbefinden: WOHLBEFINDEN,
    },
    // Aus dem Leistungsstand, nicht ein zweites Mal hergeleitet – dort holt
    // ihn auch der Planer ab.
    muscleup: stand.muscleup,
    schwerpunkte: profilM.schwerpunkte(profil.ausrichtung),
    ausrichtung: profilM.ausrichtungName(profil.ausrichtung),
    ausdauerEmpfehlung: profilM.ausdauerEmpfehlung(profil),
    /*
     * „Zuletzt trainiert" heißt zuletzt **vor dem angesehenen Tag**, und
     * zuletzt heißt nach Datum.
     *
     * Vorher stand hier `slice(-10).reverse()` – die zehn zuletzt
     * *angehängten* Einträge, ungefiltert. Zwei Fehler in einer Zeile:
     * Wer drei Tage zurückblätterte, sah unter „Zuletzt trainiert" Einheiten
     * von **danach** (die Zukunft urteilt über die Vergangenheit, Falle 18) –
     * und zwar in der Reihenfolge, in der sie eingetragen wurden. Wer eine
     * vergessene Einheit nachträgt (`sessionAnlegen` nimmt ein `datum`
     * entgegen), bekam sie damit ganz oben, mit altem Datum darunter.
     *
     * Bei gleichem Datum `0`, damit Sprint und Kraft desselben Tages ihre
     * Reihenfolge behalten (Falle 63).
     */
    letzteSessions: daten.sessions
      .filter((s) => String(s?.datum || '') <= datum)
      .sort((a, b) => (a.datum > b.datum ? -1 : a.datum < b.datum ? 1 : 0))
      .slice(0, 10),
    sprint: {
      // Auswertung der zuletzt protokollierten Sprinteinheit – die Frage
      // "war das noch Qualität?" interessiert direkt danach, nicht erst
      // beim nächsten Test.
      /*
       * Die jüngste Sprinteinheit **bis zum angesehenen Tag**, nach Datum.
       *
       * Vorher stand hier `mit[mit.length - 1]` – der letzte im Array, also
       * in der Reihenfolge des Eintragens und ohne Stichtag. Zwei Folgen,
       * beide in derselben Karte sichtbar:
       *
       * 1. Direkt darüber steht „Zuletzt 4,30 s · 04.09." aus `bestzeiten()`,
       *    und das liest aus der **datumssortierten** Liste. Wer eine
       *    vergessene Sprinteinheit nachträgt, bekam darunter „Letzte
       *    Einheit · 01.09." – zwei Aussagen über dieselbe Sache auf einem
       *    Bildschirm (Falle 70), und die ganze Abbruch-Auswertung darunter
       *    gehörte zur falschen Einheit.
       * 2. Ungefiltert zeigte die Karte beim Zurückblättern eine Einheit von
       *    **danach** – dieselbe Lücke wie in Falle 90, nur eine Karte
       *    weiter.
       *
       * Bei gleichem Datum `0`, damit zwei Sprinteinheiten eines Tages ihre
       * protokollierte Reihenfolge behalten (Falle 63).
       */
      letzte: (() => {
        const mit = sprintBis
          .filter((x) => x.laeufe?.length)
          .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
        const jueng = mit[mit.length - 1];
        return jueng ? { datum: jueng.datum, ...sprintM.auswertung(jueng.laeufe) } : null;
      })(),
      verlauf: sprintVerlauf,
      // Die Bestzeit gehört an die erste Stelle – für einen Sprinter ist sie
      // die Zahl, wegen der er überhaupt mitschreibt.
      bestzeiten: sprintM.bestzeiten(sprintVerlauf),
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
    // Nur brauchbare Punkte in die Kurve.
    //
    // Eine Fassung vor Falle 14 schrieb bei Komma-Eingabe ein NaN in den
    // Verlauf; über JSON wird daraus beim Sichern ein `null`. Solche Punkte
    // überleben also in alten Sicherungen, und die Gewichtskarte rechnet
    // stumpf `letzter − erster`: Aus einem null-Startpunkt wurde
    // „null kg → 78,3 kg · +78,3 kg". Wer das liest, hat 78 Kilo zugenommen.
    gewichtsverlauf: gewicht.punkte,
    // Die Rate gehört in den Kern: An ihr hängt der Rat, mehr oder weniger
    // zu essen. In der Oberfläche stand sie als `erster gegen letzten Punkt`
    // – die Methode, die Falle 7 für Kurven längst verworfen hat.
    gewichtstrend: ernaehrung.gewichtsTrend(gewicht.punkte),
    gewichtVerworfen: gewicht.unlesbar,
    gewichtDoppelt: gewicht.doppelt,
    // Grenzwerte der Gewichtsentwicklung – Anzeige in der Oberfläche, Zahlen
    // und Quelle in wissen.js.
    ernaehrungsgrenzen: { gewichtProWoche: ERNAEHRUNG.gewichtProWoche },
    leistung: {
      maxima: stand.maxima,
      letzte: stand.letzte,
      nichtSchaetzbar: stand.nichtSchaetzbar,
      nichtSchaetzbareSaetze: stand.nichtSchaetzbareSaetze,
      // Wochenvolumen je Muskelgruppe. Die Dosis-Wirkung bezieht sich auf
      // Muskelgruppen – pro Übung zu zählen führt in die Irre, und genau das
      // stand hier: `saetzeDieseWoche` wurde je Übung berechnet, an die
      // Oberfläche geschickt und dort von niemandem gelesen (Falle 51). Der
      // Kommentar sprach schon dagegen, das Feld ging trotzdem mit.
      // Einmal gerechnet und zweimal benutzt – vorher stand derselbe Aufruf
      // zweimal in diesem Objektliteral (Falle 13, wie `wochenminuten` in
      // Falle 30).
      saetzeProMuskel: proMuskel,
      // Die Grundmenge dahinter – siehe oben. Zwei Karten fragen danach, und
      // beide haben es vorher aus `saetzeProMuskel` erraten.
      saetzeImFenster,
      // Einordnung nach oben und unten – die Zahlen dazu stehen in wissen.js,
      // nicht in der Oberfläche.
      volumen: leistungM.volumenBewertung(proMuskel, sprintTage),
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

/*
 * Hier stand `uebungsVerlauf()` – bestes geschätztes 1RM je Trainingstag,
 * gedacht für eine Kurve. Die Kurve gibt es nicht: Gelesen wurde die Funktion
 * einzig von `daten.leistung()`, und **das rief niemand auf**. Der Faden aus
 * Falle 21 endete diesmal eine Ebene höher als sonst – die Funktion selbst
 * hatte einen Aufrufer, nur deren Aufrufer keinen.
 *
 * Entfernt statt angeschlossen, und zwar nicht aus Aufräumlust: Die Rechnung
 * darin war für Körpergewichtsübungen falsch. Sie filterte `gewicht > 0` und
 * rechnete `e1rm(s.gewicht, …)` auf die reine **Zusatzlast** – bei Klimmzügen
 * und Dips ohne Zusatzgewicht kam damit gar kein Punkt heraus, und mit
 * Zusatzgewicht ein Wert, der die eigentliche Last unterschlägt. Genau davor
 * warnt Falle 3, und `einerMaxima()` macht es zwei Dateien weiter richtig
 * (`gesamtlast`). Eine tote Funktion mit einem falschen Ergebnis ist eine
 * Mine: Wer die Kurve eines Tages anschließt, liefert den Fehler mit aus.
 *
 * Wer sie wieder haben will, braucht die Gesamtlast aus Körper plus Zusatz –
 * so wie `einerMaxima()` es rechnet.
 */


