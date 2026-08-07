// Belastungssteuerung: wie viel war es, und verträgt der Körper das?
//
// Die Kennzahlen hier sind Werkzeuge, keine Wahrsagerei. Besonders das
// Akut-zu-chronisch-Verhältnis wird in der Praxis oft als Verletzungsvorhersage
// verkauft – das hält der Prüfung nicht stand (Impellizzeri 2020). Es taugt,
// um Belastungssprünge sichtbar zu machen. Diese Ehrlichkeit steht auch in der
// Oberfläche, statt eine Scheingenauigkeit zu behaupten.

import { BELASTUNG, WOHLBEFINDEN } from './wissen.js';
import { round, clamp } from './profil.js';

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

  const tageMitDaten = [...karte.keys()].filter((d) => {
    const diff = (new Date(bis) - new Date(d)) / 86400000;
    return diff >= 0 && diff < BELASTUNG.chronischTage;
  }).length;

  if (!chronischWoche || tageMitDaten < 10) {
    return {
      belastbar: false,
      akut,
      chronischWoche: Math.round(chronischWoche),
      hinweis: 'Noch zu wenig Verlauf. Das Verhältnis wird erst nach etwa vier Wochen '
        + 'regelmäßigem Logging aussagekräftig – vorher vergleicht es Rauschen mit Rauschen.',
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
  return {
    belastbar: true,
    wert,
    strain: Math.round(wochenlast * wert),
    hoch: wert > 2.0,
    text: wert > 2.0
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

  const letzte = checks
    .filter((c) => c?.datum)
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

  return {
    faellig: gruende.length >= 2,
    gruende,
    text: gruende.length >= 2
      ? 'Mehrere Zeichen deuten auf angestaute Ermüdung. Eine Entlastungswoche jetzt kostet '
        + 'eine Woche; sie zu übergehen kostet erfahrungsgemäß deutlich mehr.'
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
