// Belastungssteuerung: wie viel war es, und verträgt der Körper das?
//
// Die Kennzahlen hier sind Werkzeuge, keine Wahrsagerei. Besonders das
// Akut-zu-chronisch-Verhältnis wird in der Praxis oft als Verletzungsvorhersage
// verkauft – das hält der Prüfung nicht stand (Impellizzeri 2020). Es taugt,
// um Belastungssprünge sichtbar zu machen. Diese Ehrlichkeit steht auch in der
// Oberfläche, statt eine Scheingenauigkeit zu behaupten.

import { BELASTUNG, WOHLBEFINDEN, RUHEPULS } from './wissen.js';
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

/** Tageslast aus allen Einträgen eines Tages. */
export function tagesLast(eintraege = []) {
  return eintraege.reduce((s, e) => s + sessionLast(e.rpe, e.minuten), 0);
}

/** Summiert das Trainingstagebuch zu einer Last je Datum. */
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
  const schnitt = werte.reduce((a, b) => a + b, 0) / werte.length;
  if (!schnitt) return { belastbar: false };

  const varianz = werte.reduce((s, w) => s + (w - schnitt) ** 2, 0) / werte.length;
  const streuung = Math.sqrt(varianz);
  if (!streuung) return { belastbar: false };

  const wert = round(schnitt / streuung, 2);
  const wochenlast = werte.reduce((a, b) => a + b, 0);
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
    strain: Math.round(wochenlast * wert),
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
  if (prozent < 45) {
    ampel = 'rot';
    empfehlung = 'Harte Einheit heute streichen. Locker bewegen oder ganz frei nehmen – '
      + 'ein Sprinttag in diesem Zustand bringt keine Anpassung, nur Risiko.';
  } else if (prozent < 65) {
    ampel = 'gelb';
    empfehlung = 'Umfang um etwa ein Drittel kürzen, Intensität halten. '
      + 'Lieber weniger Sätze bei voller Qualität als andersherum.';
  }

  // Einzelne Ausreißer zählen mehr als der Schnitt: zwei Nächte schlechter
  // Schlaf schlagen härter durch als leicht gedrückte Stimmung.
  const schlaf = Number(check.schlaf) || 0;
  if (schlaf <= 2 && ampel === 'gruen') {
    ampel = 'gelb';
    empfehlung = 'Schlaf war schlecht. Technikqualität leidet zuerst – Umfang etwas kürzen '
      + 'und bei Sprints besonders auf saubere Ausführung achten.';
  }

  return { vollstaendig: true, prozent, ampel, empfehlung, summe, maximum: WOHLBEFINDEN.length * 5 };
}

/* ------------------------------------------------------------ Ruhepuls */

/** Ruhepulse aus den Morgen-Checks, aufsteigend nach Datum. */
export function ruhepulsVerlauf(checks = [], bis = new Date(), tage = 90) {
  const grenze = datumMinusTage(bis, tage);
  return checks
    .filter((c) => c?.datum && Number(c.ruhepuls) > 0)
    .filter((c) => new Date(c.datum) >= grenze && new Date(c.datum) <= new Date(bis))
    .map((c) => ({ datum: c.datum, ruhepuls: Math.round(Number(c.ruhepuls)) }))
    .sort((a, b) => (a.datum < b.datum ? -1 : 1));
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
export function entlastungFaellig(sessions = [], checks = [], bis = new Date()) {
  const gruende = [];

  const verhaeltnis = acwr(sessions, bis);
  if (verhaeltnis.belastbar && verhaeltnis.wert > BELASTUNG.acwr.warnung) {
    gruende.push(`Wochenlast liegt ${Math.round((verhaeltnis.wert - 1) * 100)} % über deinem Schnitt.`);
  }

  // Nur Checks bis zum Stichtag und aus dem laufenden Fenster. Ohne das Erste
  // zählten in der Rückschau Checks aus der Zukunft mit; ohne das Zweite galten
  // drei Monate alte Checks weiter als „die letzten fünf".
  const fensterAb = datumMinusTage(bis, BELASTUNG.checkFensterTage);
  const letzte = checks
    .filter((c) => c?.datum)
    .filter((c) => new Date(c.datum) <= new Date(bis) && new Date(c.datum) > fensterAb)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
    .slice(0, 5);
  const schwach = letzte.filter((c) => {
    const b = bereitschaft(c);
    return b?.vollstaendig && b.prozent < 60;
  });
  if (schwach.length >= 3) {
    gruende.push(`${schwach.length} der letzten ${letzte.length} Morgen-Checks unter 60 %.`);
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
  const faellig = gruende.length >= 2;
  const stufe = faellig ? 'faellig' : gruende.length === 1 ? 'beobachten' : 'keine';

  return {
    faellig,
    stufe,
    gruende,
    text: faellig
      ? 'Mehrere Zeichen deuten auf angestaute Ermüdung. Eine Entlastungswoche jetzt kostet '
        + 'eine Woche; sie zu übergehen kostet erfahrungsgemäß deutlich mehr.'
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
