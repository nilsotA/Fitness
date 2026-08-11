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
  const brauchbar = (alle || [])
    .filter((g) => g?.datum && Number.isFinite(Number(g.kg)) && Number(g.kg) > 0)
    .map((g) => ({ ...g, kg: Number(g.kg) }));
  return {
    punkte: brauchbar.slice(-90),
    unlesbar: (alle || []).length - brauchbar.length,
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
  const gewicht = gewichtsverlauf(daten.gewicht);

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
    // Nur brauchbare Punkte in die Kurve.
    //
    // Eine Fassung vor Falle 14 schrieb bei Komma-Eingabe ein NaN in den
    // Verlauf; über JSON wird daraus beim Sichern ein `null`. Solche Punkte
    // überleben also in alten Sicherungen, und die Gewichtskarte rechnet
    // stumpf `letzter − erster`: Aus einem null-Startpunkt wurde
    // „null kg → 78,3 kg · +78,3 kg". Wer das liest, hat 78 Kilo zugenommen.
    gewichtsverlauf: gewicht.punkte,
    gewichtVerworfen: gewicht.unlesbar,
    // Grenzwerte der Gewichtsentwicklung – Anzeige in der Oberfläche, Zahlen
    // und Quelle in wissen.js.
    ernaehrungsgrenzen: { gewichtProWoche: ERNAEHRUNG.gewichtProWoche },
    leistung: {
      maxima: stand.maxima,
      letzte: stand.letzte,
      nichtSchaetzbar: stand.nichtSchaetzbar,
      nichtSchaetzbareSaetze: stand.nichtSchaetzbareSaetze,
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


