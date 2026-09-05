// Belastungssteuerung: wie viel war es, und verträgt der Körper das?
//
// Die Kennzahlen hier sind Werkzeuge, keine Wahrsagerei. Besonders das
// Akut-zu-chronisch-Verhältnis wird in der Praxis oft als Verletzungsvorhersage
// verkauft – das hält der Prüfung nicht stand (Impellizzeri 2020). Es taugt,
// um Belastungssprünge sichtbar zu machen. Diese Ehrlichkeit steht auch in der
// Oberfläche, statt eine Scheingenauigkeit zu behaupten.

import { BELASTUNG, WOHLBEFINDEN, RUHEPULS, BEREITSCHAFT } from './wissen.js';
import { round, clamp } from './profil.js';
import { menge } from './regeln.js';

/**
 * Session-RPE nach Foster: gefühlte Anstrengung (0–10) mal Dauer in Minuten.
 * Simpel, aber gut validiert – und unabhängig von Messtechnik.
 */
export function sessionLast(rpe, minuten) {
  const r = clamp(Number(rpe) || 0, 0, 10);
  const m = Math.max(0, Number(minuten) || 0);
  return Math.round(r * m);
}

/**
 * Summiert das Trainingstagebuch zu einer Last je Datum.
 *
 * Daneben stand `tagesLast()` für die Summe *einer* Tagesliste – dieselbe
 * Rechnung im Kleinen, ohne Aufrufer. Alles im Kern geht über diese Karte.
 */
export function lastProTag(sessions = []) {
  const karte = new Map();
  for (const s of sessions) {
    if (!s?.datum) continue;
    karte.set(s.datum, (karte.get(s.datum) || 0) + sessionLast(s.rpe, s.minuten));
  }
  return karte;
}

function datumMinusTage(bis, tage) {
  const d = new Date(bis);
  d.setDate(d.getDate() - tage);
  return d;
}

export function alsDatum(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/** Summe der Last über ein Zeitfenster, das an `bis` endet (einschließlich). */
export function fensterLast(lastKarte, bis, tage) {
  let summe = 0;
  for (let i = 0; i < tage; i += 1) {
    summe += lastKarte.get(alsDatum(datumMinusTage(bis, i))) || 0;
  }
  return summe;
}

/**
 * Akut-zu-chronisch-Verhältnis: die letzten 7 Tage gegen den Wochenschnitt der
 * letzten 28. Werte zwischen 0,8 und 1,3 gelten als unauffällig, über 1,5 als
 * deutlicher Sprung.
 *
 * Wichtig: Das ist eine Ampel für Belastungssprünge, kein Verletzungsrisiko.
 * Vor etwa vier Wochen Datenbestand ist der chronische Wert ohnehin wertlos –
 * das meldet die Funktion offen zurück, statt eine Zahl zu erfinden.
 */
export function acwr(sessions = [], bis = new Date()) {
  const karte = lastProTag(sessions);
  const akut = fensterLast(karte, bis, BELASTUNG.akutTage);
  const chronischGesamt = fensterLast(karte, bis, BELASTUNG.chronischTage);
  const chronischWoche = chronischGesamt / (BELASTUNG.chronischTage / BELASTUNG.akutTage);

  // Geprüft wird, ob in **jeder** der vier Wochen etwas steht – nicht, wie viele
  // Trainingstage zusammenkommen.
  //
  // Vorher stand hier `tageMitDaten < 10`. Das war als „vier Wochen
  // regelmäßiges Logging" gemeint, maß aber die Trainingshäufigkeit mit: Wer
  // nach Plan an zwei Tagen der Woche trainiert – bei drei eingestellten Tagen
  // und Regler 15 bis 35 tut der Planer genau das –, kommt in 28 Tagen auf
  // höchstens acht. Die Zahl war damit nie erreichbar, und darunter stand
  // dauerhaft „wird erst nach etwa vier Wochen aussagekräftig". Ein Hinweis,
  // der einen Weg verspricht, den es nicht gibt.
  const wochenMitDaten = Array.from({ length: BELASTUNG.chronischTage / BELASTUNG.akutTage },
    (_, w) => fensterLast(karte, datumMinusTage(bis, w * BELASTUNG.akutTage), BELASTUNG.akutTage))
    .filter(Boolean).length;
  const wochenGesamt = BELASTUNG.chronischTage / BELASTUNG.akutTage;

  if (!chronischWoche || wochenMitDaten < wochenGesamt) {
    return {
      belastbar: false,
      akut,
      chronischWoche: Math.round(chronischWoche),
      wochenMitDaten,
      wochenGesamt,
      hinweis: `Noch zu wenig Verlauf: ${menge(wochenMitDaten, 'Woche', 'Wochen')} der letzten `
        + `${wochenGesamt} mit Einträgen. Das Verhältnis vergleicht die aktuelle Woche mit dem `
        + 'Schnitt der letzten vier – solange eine davon leer ist, vergleicht es Rauschen mit '
        + 'Rauschen.',
    };
  }

  const wert = round(akut / chronischWoche, 2);
  let stufe = 'unauffällig';
  let text = 'Die Woche liegt im Rahmen dessen, was du gewohnt bist.';

  if (wert > BELASTUNG.acwr.warnung) {
    stufe = 'sprung';
    text = `Diese Woche liegt ${Math.round((wert - 1) * 100)} % über deinem Schnitt. `
      + 'Solche Sprünge sind der häufigste vermeidbare Fehler – nicht die absolute Höhe.';
  } else if (wert > BELASTUNG.acwr.obergrenze) {
    stufe = 'erhoeht';
    text = 'Etwas über dem gewohnten Bereich. Vertretbar, wenn Schlaf und Essen mitziehen.';
  } else if (wert < BELASTUNG.acwr.untergrenze) {
    stufe = 'niedrig';
    text = 'Deutlich unter deinem Schnitt – Entlastungswoche oder eine Lücke im Training.';
  }

  return {
    belastbar: true,
    wert,
    akut,
    chronischWoche: Math.round(chronischWoche),
    stufe,
    text,
    grenzwerte: BELASTUNG.acwr,
    einschraenkung: 'Grobe Ampel für Belastungssprünge, keine Verletzungsvorhersage '
      + '(Impellizzeri 2020).',
  };
}

/**
 * Monotonie nach Foster: Wochenschnitt geteilt durch Streuung. Hohe Monotonie
 * bei hoher Last gilt als ungünstige Kombination – jeden Tag dasselbe mittlere
 * Programm ermüdet, ohne einen Reiz zu setzen.
 *
 * Benotet wird erst ab `minTrainingstageFuerNote` Trainingstagen: Darunter ist
 * Fosters Schwelle von 2,0 rechnerisch gar nicht erreichbar, weil die Ruhetage
 * selbst die Streuung liefern (Begründung samt Formel in `wissen.js`). Der Wert
 * steht trotzdem da – nur ohne Urteil, statt dauerhaft „gut verteilt" zu
 * behaupten, wo nichts zu bestehen war.
 */
export function monotonie(sessions = [], bis = new Date()) {
  const karte = lastProTag(sessions);
  const werte = [];
  for (let i = 0; i < 7; i += 1) {
    werte.push(karte.get(alsDatum(datumMinusTage(bis, i))) || 0);
  }
  /*
   * Beide Rückfälle sagen jetzt, warum nichts dasteht.
   *
   * Vorher gaben sie ein nacktes `{ belastbar: false }` zurück, und die
   * Oberfläche zeigt in dem Fall **gar nichts** – keine Kennzahl, keinen
   * Satz. Daneben in derselben Karte erklärt sich das ACWR im selben Fall
   * ausdrücklich („nach etwa vier Wochen aussagekräftig"). Zwei Zahlen
   * nebeneinander, eine begründet ihr Fehlen, die andere verschwindet
   * kommentarlos – das ist Falle 22, und es ist genau die Asymmetrie, an der
   * man sie erkennt.
   */
  const schnitt = werte.reduce((a, b) => a + b, 0) / werte.length;
  if (!schnitt) {
    return {
      belastbar: false,
      hinweis: 'In den letzten sieben Tagen ist keine Einheit protokolliert – '
        + 'ohne Belastung gibt es keine Verteilung zu bewerten.',
    };
  }

  const varianz = werte.reduce((s, w) => s + (w - schnitt) ** 2, 0) / werte.length;
  const streuung = Math.sqrt(varianz);
  if (!streuung) {
    // Rechnerisch: Fosters Quotient teilt durch die Streuung. Fachlich ist
    // der Fall die denkbar gleichförmigste Woche – die Aussage steht also
    // fest, nur die Zahl dazu gibt es nicht.
    return {
      belastbar: false,
      hinweis: 'Alle sieben Tage tragen exakt dieselbe Belastung. Die Monotonie teilt '
        + 'durch die Streuung und ist damit nicht berechenbar – gleichförmiger als das '
        + 'geht eine Woche nicht.',
    };
  }

  const wert = round(schnitt / streuung, 2);
  // `strain` (Wochenlast × Monotonie) stand hier und wurde von niemandem
  // gelesen – die dritte tote Zwillingszahl neben `sprintmeterZiel` und
  // `session.last`. Bei kleiner Streuung wächst sie zudem ins Absurde. Wer sie
  // braucht, rechnet sie aus `wert` und der Wochenlast; beides steht da.
  const trainingstage = werte.filter(Boolean).length;
  const { hochAb, minTrainingstageFuerNote } = BELASTUNG.monotonie;
  const bewertbar = trainingstage >= minTrainingstageFuerNote;
  const hoch = bewertbar && wert > hochAb;

  // Das Maximum bei dieser Trainingshäufigkeit – gehört in die Begründung,
  // sonst liest sich „nicht benotet" wie eine fehlende Messung statt wie eine
  // Eigenschaft des Maßstabs.
  const maximum = trainingstage < 7 ? round(Math.sqrt(trainingstage / (7 - trainingstage)), 2) : null;

  return {
    belastbar: true,
    wert,
    trainingstage,
    bewertbar,
    hoch,
    grenzwert: hochAb,
    // Zwei Nachkommastellen wie beim Wert selbst, und ein Komma statt eines
    // Punktes: `String(2.0)` gibt „2", das liest sich neben „0,87" wie eine
    // andere Größenordnung statt wie dieselbe Skala.
    text: !bewertbar
      ? `Bei ${menge(trainingstage, 'Trainingstag', 'Trainingstagen')} in der Woche kann dieser `
        + `Wert höchstens ${maximum.toFixed(2).replace('.', ',')} erreichen – die Schwelle von `
        + `${hochAb.toFixed(1).replace('.', ',')} liegt darüber. Die Ruhetage sorgen für die `
        + 'Abwechslung. Der Wert steht hier als Verlaufsgröße, nicht als bestandene Prüfung.'
      : hoch
        ? 'Wenig Abwechslung zwischen den Tagen. Harte Tage dürfen härter, lockere lockerer sein – '
          + 'genau dieser Unterschied macht den Reiz.'
        : 'Gute Verteilung zwischen harten und lockeren Tagen.',
  };
}

/**
 * Bereitschaft aus dem Morgen-Check. Fünf Fragen à 1–5 – kurz genug, dass man
 * es täglich macht, und das ist der einzige Weg, wie so etwas nützt.
 */
export function bereitschaft(check) {
  if (!check) return null;
  const werte = WOHLBEFINDEN.map((f) => clamp(Number(check[f.id]) || 0, 0, 5)).filter(Boolean);
  if (werte.length < WOHLBEFINDEN.length) {
    return { vollstaendig: false, hinweis: 'Morgen-Check noch nicht ausgefüllt.' };
  }

  const summe = werte.reduce((a, b) => a + b, 0);
  const prozent = Math.round((summe / (WOHLBEFINDEN.length * 5)) * 100);

  let ampel = 'gruen';
  let empfehlung = 'Plan wie vorgesehen durchziehen.';
  /*
   * Warum gekürzt wird – nicht bloß, wie hoch die Bereitschaft ist.
   *
   * `angepassteEinheit()` schrieb als Grund immer `Bereitschaft N %`. Bei der
   * Schlafregel unten stimmt das nicht: Die Ampel springt dort auf Gelb, der
   * Prozentwert bleibt aber, wo er war. Auf der Karte stand dann „Gekürzt –
   * Bereitschaft 88 %" – ein Wert 23 Punkte über der eigenen Grün-Schwelle,
   * als Begründung für eine Kürzung. Die Begründung an der Stelle des
   * Ergebnisses muss die tragende sein (Falle 22).
   */
  let grund = null;
  if (prozent < BEREITSCHAFT.rotUnter) {
    ampel = 'rot';
    grund = `Bereitschaft ${prozent} %`;
    empfehlung = 'Harte Einheit heute streichen. Locker bewegen oder ganz frei nehmen – '
      + 'ein Sprinttag in diesem Zustand bringt keine Anpassung, nur Risiko.';
  } else if (prozent < BEREITSCHAFT.gelbUnter) {
    ampel = 'gelb';
    grund = `Bereitschaft ${prozent} %`;
    empfehlung = 'Umfang um etwa ein Drittel kürzen, Intensität halten. '
      + 'Lieber weniger Sätze bei voller Qualität als andersherum.';
  }

  // Einzelne Ausreißer zählen mehr als der Schnitt: zwei Nächte schlechter
  // Schlaf schlagen härter durch als leicht gedrückte Stimmung.
  const schlaf = Number(check.schlaf) || 0;
  if (schlaf <= 2 && ampel === 'gruen') {
    ampel = 'gelb';
    grund = 'Schlaf war schlecht';
    empfehlung = 'Schlaf war schlecht. Technikqualität leidet zuerst – Umfang etwas kürzen '
      + 'und bei Sprints besonders auf saubere Ausführung achten.';
  }

  return { vollstaendig: true, prozent, ampel, grund, empfehlung, summe,
    maximum: WOHLBEFINDEN.length * 5 };
}

/* ------------------------------------------------------------ Ruhepuls */

/** Ruhepulse aus den Morgen-Checks, aufsteigend nach Datum. */
/**
 * Ein Tag, ein Check – dieselbe Regel, die `checkSpeichern()` beim Schreiben
 * durchsetzt („Der neue ersetzt den alten"). Es gewinnt der spätere Eintrag,
 * wie beim Schreiben auch.
 *
 * Über den Dialog kann es Doppelte gar nicht geben; eine eingespielte
 * Sicherung kann sie enthalten, weil die Importprüfung bewusst nicht
 * aufräumt (Falle 27). **Jeder Leser muss die Regel des Schreibers halten** –
 * sonst zählt ein Tag mehrfach. Die Funktion steht deshalb einmal hier und
 * nicht in jedem Leser noch einmal (Falle 13).
 */
function einCheckProTag(checks = []) {
  const jeTag = new Map();
  for (const c of checks) {
    if (c?.datum) jeTag.set(String(c.datum), c);
  }
  return [...jeTag.values()];
}

export function ruhepulsVerlauf(checks = [], bis = new Date(), tage = 90) {
  const grenze = datumMinusTage(bis, tage);

  /*
   * Entdoppelt wird **vor** dem Filtern auf einen brauchbaren Ruhepuls: Wenn
   * der spätere Check des Tages keinen Puls trägt, hat der Tag keinen – der
   * neue Eintrag ersetzt den alten ganz, nicht feldweise. Andersherum stünde
   * in der Kurve ein Wert, den der Nutzer überschrieben hat.
   *
   * Ohne die Entdopplung zeichnete die Kurve zwei Punkte auf denselben Tag –
   * eine senkrechte Kante, die wie eine Messung aussieht und keine ist.
   */
  const punkte = einCheckProTag(checks)
    .filter((c) => Number(c.ruhepuls) > 0)
    .filter((c) => new Date(c.datum) >= grenze && new Date(c.datum) <= new Date(bis))
    .map((c) => ({ datum: c.datum, ruhepuls: Math.round(Number(c.ruhepuls)) }));

  return punkte.sort((a, b) => (a.datum < b.datum ? -1 : 1));
}

/**
 * Weicht der Ruhepuls von der eigenen Ausgangslage ab?
 *
 * Verglichen wird ein Schnitt der letzten Tage gegen eine längere Grundlinie
 * **ohne diese Tage** – sonst zieht der aktuelle Wert seine eigene
 * Vergleichsgröße mit hoch und die Abweichung verschwindet zum Teil in sich
 * selbst.
 *
 * Ein absoluter Ruhepuls sagt nichts; ein Anstieg gegen die eigene Grundlinie
 * ist ein Hinweis – mehr aber auch nicht. Deshalb steht die Unschärfe im
 * Rückgabewert und wird in der Oberfläche mit angezeigt.
 */
export function ruhepulsTrend(checks = [], bis = new Date()) {
  const alle = ruhepulsVerlauf(checks, bis, RUHEPULS.grundlinieTage + RUHEPULS.schnittTage);
  const schnittGrenze = datumMinusTage(bis, RUHEPULS.schnittTage);

  const aktuell = alle.filter((p) => new Date(p.datum) > schnittGrenze);
  const grundlinie = alle.filter((p) => new Date(p.datum) <= schnittGrenze);

  const mittel = (liste) => (liste.length
    ? liste.reduce((s, p) => s + p.ruhepuls, 0) / liste.length : null);

  if (aktuell.length < RUHEPULS.minMessungenSchnitt
    || grundlinie.length < RUHEPULS.minMessungenGrundlinie) {
    return {
      belastbar: false,
      messungen: alle.length,
      letzter: alle.length ? alle[alle.length - 1].ruhepuls : null,
      hinweis: `Für einen Vergleich braucht es ${RUHEPULS.minMessungenGrundlinie} Messungen `
        + `als Grundlinie und ${RUHEPULS.minMessungenSchnitt} aus den letzten `
        + `${RUHEPULS.schnittTage} Tagen. Bisher: ${grundlinie.length} und ${aktuell.length}. `
        + 'Ein einzelner Ruhepuls ist ohne Vergleichswert nicht zu deuten.',
    };
  }

  const jetzt = mittel(aktuell);
  const basis = mittel(grundlinie);
  const abweichung = round(jetzt - basis, 1);
  // Im Fließtext ganze Schläge: Bei der Streuung, die ein Ruhepuls von Tag zu
  // Tag hat, ist die Nachkommastelle Scheingenauigkeit – und im Deutschen
  // stünde hier sonst ein Punkt statt eines Kommas.
  const ganz = Math.abs(Math.round(abweichung));

  let stufe = 'unauffällig';
  let text = `Ruhepuls ${Math.round(jetzt)} gegen deine Grundlinie von ${Math.round(basis)} – `
    + 'im gewohnten Bereich.';

  if (abweichung >= RUHEPULS.deutlichAb) {
    stufe = 'deutlich';
    text = `Ruhepuls liegt ${ganz} Schläge über deiner Grundlinie `
      + `(${Math.round(jetzt)} statt ${Math.round(basis)}). Das ist deutlich. Häufigste `
      + 'Ursachen in dieser Reihenfolge: beginnender Infekt, zu wenig Schlaf, Alkohol, '
      + 'Hitze – und erst dann angestaute Trainingsermüdung.';
  } else if (abweichung >= RUHEPULS.warnungAb) {
    stufe = 'erhoeht';
    text = `Ruhepuls liegt ${ganz} Schläge über deiner Grundlinie `
      + `(${Math.round(jetzt)} statt ${Math.round(basis)}). Einen Blick wert, aber allein `
      + 'kein Grund, etwas zu ändern – der Wert schwankt auch ohne Training.';
  } else if (abweichung <= -RUHEPULS.warnungAb) {
    // Nach unten ausdrücklich keine Entwarnung: Bei ausgeprägter Ermüdung kann
    // der Ruhepuls ebenfalls fallen. Als „alles bestens" zu lesen wäre genau
    // die Fehldeutung, vor der Buchheit warnt.
    stufe = 'niedriger';
    text = `Ruhepuls liegt ${ganz} Schläge unter deiner Grundlinie `
      + `(${Math.round(jetzt)} statt ${Math.round(basis)}). Meist ein Zeichen guter `
      + 'Erholung oder wachsender Ausdauer. Ein Selbstläufer ist es nicht: Bei starker '
      + 'Ermüdung kann der Ruhepuls ebenfalls fallen – entscheidend bleibt, wie du dich fühlst.';
  }

  return {
    belastbar: true,
    jetzt: Math.round(jetzt),
    grundlinie: Math.round(basis),
    abweichung,
    stufe,
    text,
    messungen: alle.length,
    tage: { schnitt: RUHEPULS.schnittTage, grundlinie: RUHEPULS.grundlinieTage },
    grenzwerte: { warnungAb: RUHEPULS.warnungAb, deutlichAb: RUHEPULS.deutlichAb },
    einschraenkung: 'Unspezifisch: Infekt, Alkohol, Hitze und Stress erzeugen dasselbe Bild. '
      + 'Zählt als ein Signal neben anderen, nie allein (Buchheit 2014).',
  };
}

/**
 * Braucht es eine Entlastungswoche? Der Plan sieht sie ohnehin alle vier Wochen
 * vor – hier geht es um die Fälle, in denen sie früher fällig ist.
 */
export function entlastungFaellig(sessions = [], checks = [], bis = new Date(), lage = {}) {
  const gruende = [];

  const verhaeltnis = acwr(sessions, bis);
  if (verhaeltnis.belastbar && verhaeltnis.wert > BELASTUNG.acwr.warnung) {
    gruende.push(`Wochenlast liegt ${Math.round((verhaeltnis.wert - 1) * 100)} % über deinem Schnitt.`);
  }

  // Nur Checks bis zum Stichtag und aus dem laufenden Fenster. Ohne das Erste
  // zählten in der Rückschau Checks aus der Zukunft mit; ohne das Zweite galten
  // drei Monate alte Checks weiter als „die letzten fünf".
  const fensterAb = datumMinusTage(bis, BELASTUNG.checkFensterTage);
  /*
   * Auch hier ein Tag, ein Check. Ohne das zählte eine eingespielte Sicherung
   * mit drei Einträgen vom selben Morgen als „3 der letzten 5 Morgen-Checks
   * im roten Bereich" – ein einziger schlechter Tag löste die
   * Entlastungsempfehlung aus, und Zähler wie Nenner meinten Einträge, wo der
   * Satz von Tagen spricht (Falle 32: Das Y muss dieselbe Grundmenge meinen
   * wie das X). Familie von Falle 65, eine Funktion weiter.
   */
  const letzte = einCheckProTag(checks)
    .filter((c) => new Date(c.datum) <= new Date(bis) && new Date(c.datum) > fensterAb)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
    .slice(0, 5);
  /*
   * Die Bereitschaft in zwei Stufen.
   *
   * Vorher steuerte sie genau einen Grund bei – egal, ob drei von fünf Checks
   * knapp unter der Marke lagen oder alle fünf auf dem Minimum. Bei zwei
   * geforderten Gründen war die Entlastung damit über das Wohlbefinden allein
   * **nie** auslösbar: In der Simulation standen 84 Tage in Folge mit allen
   * fünf Antworten auf 1, und der Tracker sagte durchgehend nur „ein Zeichen
   * im Blick behalten". Dieselbe Familie wie Falle 10 – ein gedeckelter Wert
   * kann „drüber" nicht abstufen.
   *
   * Das Zwei-Gründe-Prinzip stammt vom Ruhepuls und ist dort richtig: Ein
   * Infekt erzeugt dasselbe Bild, also trägt er allein keine Entscheidung. Auf
   * den Morgen-Check übertragen trägt es nicht. An jedem roten Tag hat der
   * Tracker ohnehin schon „harte Einheit streichen" gesagt; drei solche Tage
   * in fünf sind eine Woche, die sich nicht wie geplant durchführen lässt. Das
   * eine Entlastung zu nennen ist ehrlicher, als denselben Tagesrat ein
   * drittes Mal zu wiederholen.
   */
  const bewertet = letzte.map(bereitschaft).filter((b) => b?.vollstaendig);
  const schwach = bewertet.filter((b) => b.prozent < BEREITSCHAFT.schwachUnter);
  const rot = bewertet.filter((b) => b.ampel === 'rot');

  // Gezählt wird gegen die **bewertbaren** Checks, nicht gegen alle im Fenster.
  //
  // Der Nenner war `letzte.length` und enthielt damit auch die unvollständig
  // ausgefüllten – die gar nicht beurteilt werden konnten. „3 der letzten 5"
  // hieß dann in Wahrheit „3 von 3", also *alle*, sah aber nach 60 % aus. Bei
  // einer Zahl, die eine Entlastungswoche auslöst, ist das kein
  // Schönheitsfehler. Familie von Falle 10: Das Y muss dieselbe Grundmenge
  // meinen wie das X.
  const schwerwiegend = rot.length >= BEREITSCHAFT.roteChecksFuerEntlastung;
  if (schwerwiegend) {
    gruende.push(`${rot.length} der letzten ${bewertet.length} Morgen-Checks im roten Bereich `
      + `(unter ${BEREITSCHAFT.rotUnter} %) – an jedem davon stand schon „harte Einheit `
      + 'streichen".');
  } else if (schwach.length >= BEREITSCHAFT.schwacheChecksFuerGrund) {
    gruende.push(`${schwach.length} der letzten ${bewertet.length} Morgen-Checks unter `
      + `${BEREITSCHAFT.schwachUnter} %.`);
  }

  const m = monotonie(sessions, bis);
  if (m.belastbar && m.hoch) {
    gruende.push('Hohe Monotonie – harte und lockere Tage unterscheiden sich kaum.');
  }

  // Der Ruhepuls zählt nur als ein Grund unter mehreren – allein trägt er die
  // Entscheidung nicht, weil ein Infekt dasselbe Bild erzeugt.
  const puls = ruhepulsTrend(checks, bis);
  if (puls.belastbar && puls.abweichung >= RUHEPULS.deutlichAb) {
    gruende.push(`Ruhepuls ${Math.round(puls.abweichung)} Schläge über der Grundlinie.`);
  }

  // Ein einzelner Grund wurde vorher berechnet und weggeworfen: Der Text sagte
  // „keine Anzeichen", während ein Grund in der Liste stand, und die Oberfläche
  // zeigte die Karte gar nicht erst. Damit verschwieg der Tracker etwas, das er
  // gesehen hatte – das Gegenteil dessen, was er sonst tut. „Beobachten" nennt
  // den Grund, ohne eine Entlastung zu fordern; die Abwägung bleibt bei Nils.
  // Zwei Gründe – oder ein einzelner, der für sich schon eindeutig ist.
  const faellig = gruende.length >= 2 || schwerwiegend;
  const stufe = faellig ? 'faellig' : gruende.length === 1 ? 'beobachten' : 'keine';

  return {
    faellig,
    stufe,
    gruende,
    // In einer geplanten Entlastungswoche ist „mach eine Entlastungswoche"
    // kein Rat, sondern ein Widerspruch zur Karte darüber. Die Zeichen sind
    // deshalb nicht weniger wert – im Gegenteil, dass sie *trotz* Entlastung
    // dastehen, ist die eigentliche Nachricht.
    text: faellig
      ? (lage.entlastungswoche
        ? 'Mehrere Zeichen deuten auf angestaute Ermüdung – und das in einer ohnehin geplanten '
          + 'Entlastungswoche. Dann reicht die Erholung nicht: Umfang noch weiter zurücknehmen, '
          + 'Schlaf und Essen prüfen. Bleibt das Bild auch nächste Woche, steckt mehr dahinter '
          + 'als Training.'
        : 'Mehrere Zeichen deuten auf angestaute Ermüdung. Eine Entlastungswoche jetzt kostet '
          + 'eine Woche; sie zu übergehen kostet erfahrungsgemäß deutlich mehr.')
      : stufe === 'beobachten'
        ? 'Ein Zeichen sticht heraus, die übrigen sind unauffällig. Für eine vorgezogene '
          + 'Entlastung reicht das nicht – einzeln kann jedes dieser Zeichen auch andere '
          + 'Ursachen haben. Behalte es die nächsten Tage im Blick.'
        : 'Keine Anzeichen für vorgezogene Entlastung.',
  };
}

/** Wochenlast der letzten n Wochen – Datenreihe für die Verlaufsgrafik. */
export function wochenverlauf(sessions = [], wochen = 12, bis = new Date()) {
  const karte = lastProTag(sessions);
  const reihe = [];
  for (let w = wochen - 1; w >= 0; w -= 1) {
    const ende = datumMinusTage(bis, w * 7);
    reihe.push({
      bis: alsDatum(ende),
      last: fensterLast(karte, ende, 7),
    });
  }
  return reihe;
}
