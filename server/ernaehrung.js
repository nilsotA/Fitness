// Kalorien, Makronährstoffe und Energieverfügbarkeit.
//
// Der Bedarf wird pro Tag gerechnet, nicht pauschal über die Woche: An einem
// Sprint- plus Krafttag braucht der Körper etwas anderes als am Ruhetag. Genau
// darin liegt der Nutzen gegenüber einer festen Tageszahl.

import { ERNAEHRUNG } from './wissen.js';
import { alltagsfaktor, alter, fettfreieMasse, round, clamp } from './profil.js';

/**
 * MET-Werte je Einheitentyp. Umsatz = MET × 3,5 × kg / 200 pro Minute.
 * Die Sprintwerte wirken niedrig für die Belastung – sie berücksichtigen die
 * langen Pausen, ohne die Sprinttraining nicht funktioniert.
 */
export const MET = {
  sprint: 8.0,
  plyometrie: 7.0,
  kraft: 6.0,
  ausdauerLocker: 7.0,
  ausdauerIntervalle: 11.0,
  ausdauerLang: 8.5,
  technik: 3.5,
  mobilitaet: 2.8,
};

/**
 * Grundumsatz. Mit bekanntem Körperfettanteil rechnet Cunningham treffsicherer,
 * weil Muskelmasse den Umsatz treibt und nicht das Gesamtgewicht. Ohne diesen
 * Wert bleibt Mifflin-St Jeor.
 */
export function grundumsatz(profil, heute = new Date()) {
  const kg = Number(profil?.gewichtKg);
  if (!kg) return null;

  const ffm = fettfreieMasse(profil);
  if (ffm) {
    return { kcal: Math.round(500 + 22 * ffm), formel: 'Cunningham', quelle: 'cunningham1980' };
  }

  const cm = Number(profil?.groesseCm);
  const jahre = alter(profil, heute);
  if (!cm || !jahre) return null;
  const s = profil.geschlecht === 'w' ? -161 : 5;
  return {
    kcal: Math.round(10 * kg + 6.25 * cm - 5 * jahre + s),
    formel: 'Mifflin-St Jeor',
    quelle: 'mifflin1990',
  };
}

/** Energieumsatz einer einzelnen Einheit. */
export function einheitKcal(typ, minuten, gewichtKg) {
  const met = MET[typ] ?? MET.kraft;
  const kg = Number(gewichtKg);
  const min = Number(minuten);
  if (!kg || !min) return 0;
  return Math.round((met * 3.5 * kg / 200) * min);
}

/**
 * Tagesbedarf. Der Alltagsfaktor deckt bewusst nur Bewegung außerhalb des
 * Trainings ab – das Training kommt aus dem Plan dazu. Sonst zählt man es
 * doppelt und landet bei Fantasiewerten.
 */
export function tagesbedarf(profil, einheiten = [], heute = new Date()) {
  const gu = grundumsatz(profil, heute);
  if (!gu) return null;

  const alltag = Math.round(gu.kcal * alltagsfaktor(profil));
  const training = einheiten.reduce(
    (summe, e) => summe + einheitKcal(e.typ, e.minuten, profil.gewichtKg), 0,
  );

  const erhaltung = alltag + training;
  const anpassung = ZIELANPASSUNG[profil?.kalorienziel] ?? 0;

  return {
    grundumsatz: gu.kcal,
    grundumsatzFormel: gu.formel,
    grundumsatzQuelle: gu.quelle,
    alltag,
    training,
    erhaltung,
    ziel: Math.round(erhaltung * (1 + anpassung)),
    anpassungProzent: Math.round(anpassung * 100),
  };
}

/**
 * Auf- und Abbau bewusst langsam: Ein Überschuss von 10 % reicht für
 * Muskelaufbau, mehr landet überwiegend als Fett. Ein Defizit von 15 % schont
 * die Magermasse und die Sprintqualität – schneller abnehmen kostet Leistung.
 */
const ZIELANPASSUNG = {
  aufbauen: 0.10,
  halten: 0,
  abnehmen: -0.15,
};

/**
 * Tagestyp aus den geplanten Einheiten. Er steuert die Kohlenhydratmenge:
 * Kohlenhydrate liegen dort, wo die Intensität liegt.
 */
export function tagestyp(einheiten = []) {
  if (!einheiten.length) return 'ruhetag';
  const minuten = einheiten.reduce((s, e) => s + (Number(e.minuten) || 0), 0);
  const hatSprint = einheiten.some((e) => e.typ === 'sprint' || e.typ === 'plyometrie');
  const hatIntervalle = einheiten.some((e) => e.typ === 'ausdauerIntervalle');
  const hatKraft = einheiten.some((e) => e.typ === 'kraft');
  const langeAusdauer = einheiten.some((e) => e.typ === 'ausdauerLang' && Number(e.minuten) >= 90);

  if (langeAusdauer) return 'langeAusdauer';
  if ((hatSprint && hatKraft) || hatIntervalle) return 'hart';
  if (hatSprint || hatKraft || minuten >= 75) return 'mittel';
  if (minuten >= 30) return 'leicht';
  return 'ruhetag';
}

/**
 * Makroverteilung. Reihenfolge ist Absicht: Erst Protein (schützt Muskeln),
 * dann Fett (Untergrenze für den Hormonhaushalt), der Rest sind Kohlenhydrate.
 * Reichen die Kalorien für den Kohlenhydratkorridor nicht, meldet die Funktion
 * das zurück, statt still eine unrealistische Zahl auszugeben.
 */
export function makros(profil, kcalZiel, typ = 'mittel') {
  const kg = Number(profil?.gewichtKg);
  if (!kg || !kcalZiel) return null;

  const imDefizit = profil?.kalorienziel === 'abnehmen';
  const proteinProKg = imDefizit ? ERNAEHRUNG.protein.imDefizit : ERNAEHRUNG.protein.ziel;
  const proteinG = Math.round(kg * proteinProKg);
  const fettG = Math.round(kg * ERNAEHRUNG.fett.ziel);

  const kcalProtein = proteinG * 4;
  const kcalFett = fettG * 9;
  const kohlenhydrateG = Math.max(0, Math.round((kcalZiel - kcalProtein - kcalFett) / 4));

  const korridor = ERNAEHRUNG.kohlenhydrate[typ] || ERNAEHRUNG.kohlenhydrate.mittel;
  const khProKg = round(kohlenhydrateG / kg, 1);

  const hinweise = [];
  if (khProKg < korridor[0]) {
    hinweise.push(
      `Kohlenhydrate liegen bei ${khProKg} g/kg, der Korridor für diesen Tagestyp ist `
      + `${korridor[0]}–${korridor[1]} g/kg. Für harte Einheiten wird das knapp – `
      + 'entweder Fett etwas senken oder die Kalorien anheben.',
    );
  }
  if (khProKg > korridor[1] * 1.3) {
    hinweise.push(
      `Kohlenhydrate liegen mit ${khProKg} g/kg deutlich über dem Korridor `
      + `(${korridor[0]}–${korridor[1]} g/kg). An einem Tag dieser Belastung ist das mehr, als du verwerten kannst.`,
    );
  }

  return {
    kcal: Math.round(kcalZiel),
    protein: proteinG,
    fett: fettG,
    kohlenhydrate: kohlenhydrateG,
    proteinProKg: round(proteinProKg, 2),
    fettProKg: round(ERNAEHRUNG.fett.ziel, 2),
    khProKg,
    korridor,
    tagestyp: typ,
    hinweise,
    proteinProMahlzeit: Math.round(kg * ERNAEHRUNG.proteinProMahlzeit),
    mahlzeiten: ERNAEHRUNG.mahlzeitenProTag,
  };
}

/**
 * Energieverfügbarkeit: was nach dem Training für alles andere übrig bleibt,
 * je Kilo fettfreier Masse. Der aussagekräftigste Einzelwert für die Frage,
 * ob jemand langfristig genug isst (Mountjoy 2023). Ohne Körperfettanteil
 * nicht berechenbar – dann gibt es einen Hinweis statt einer Schätzung.
 */
export function energieverfuegbarkeit(profil, kcalAufnahme, kcalTraining) {
  const ffm = fettfreieMasse(profil);
  if (!ffm) {
    return {
      berechenbar: false,
      hinweis: 'Für die Energieverfügbarkeit fehlt der Körperfettanteil. '
        + 'Ohne ihn lässt sich die fettfreie Masse nicht bestimmen.',
    };
  }
  const wert = round((Number(kcalAufnahme) - Number(kcalTraining)) / ffm, 1);
  const g = ERNAEHRUNG.energieverfuegbarkeit;

  let stufe = 'gut';
  let text = 'Solide versorgt.';
  if (wert < g.kritisch) {
    stufe = 'kritisch';
    text = `Unter ${g.kritisch} kcal/kg FFM. Dauerhaft bedeutet das Leistungsverlust, `
      + 'Hormonstörungen und Knochenabbau. Mehr essen, nicht mehr trainieren.';
  } else if (wert < g.knapp) {
    stufe = 'knapp';
    text = `Zwischen ${g.kritisch} und ${g.knapp} kcal/kg FFM – für einige Wochen vertretbar, `
      + 'auf Dauer zu wenig.';
  } else if (wert < g.ziel) {
    stufe = 'okay';
    text = `Knapp unter der Zielmarke von ${g.ziel} kcal/kg FFM, aber unbedenklich.`;
  }

  return { berechenbar: true, wert, stufe, text, ffm, grenzwerte: g };
}

/**
 * Energieverfügbarkeit über abgeschlossene Tage.
 *
 * Der Wert für den laufenden Tag ist wertlos und obendrein schädlich: Wer
 * morgens um zehn erst eine Mahlzeit im Protokoll hat, bekäme jeden Tag eine
 * Warnung „kritisch" zu sehen – und gewöhnt sich an, Warnungen zu übergehen.
 * Energieverfügbarkeit ist ohnehin ein chronischer Kennwert, kein Tageswert.
 * Deshalb zählt hier der Schnitt über abgeschlossene Tage, der heutige bleibt
 * bewusst außen vor.
 */
export function energieverfuegbarkeitSchnitt(profil, essen = [], sessions = [], bis = new Date()) {
  const ffm = fettfreieMasse(profil);
  if (!ffm) {
    return {
      berechenbar: false,
      hinweis: 'Für die Energieverfügbarkeit fehlt der Körperfettanteil. '
        + 'Ohne ihn lässt sich die fettfreie Masse nicht bestimmen.',
    };
  }

  const tage = [];
  for (let i = 1; i <= 7; i += 1) {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    const datum = d.toISOString().slice(0, 10);

    const gegessen = essen.filter((e) => e.datum === datum);
    if (!gegessen.length) continue; // Tage ohne Protokoll verzerren den Schnitt

    const aufnahme = tagesSumme(gegessen).kcal;
    const training = sessions
      .filter((s) => s.datum === datum)
      .reduce((summe, s) => summe + einheitKcal(s.typ, s.minuten, profil.gewichtKg), 0);
    tage.push((aufnahme - training) / ffm);
  }

  if (tage.length < 3) {
    return {
      berechenbar: false,
      hinweis: `Noch zu wenig vollständige Tage protokolliert (${tage.length} von mindestens 3). `
        + 'Die Energieverfügbarkeit ist ein Wochenwert – ein einzelner Tag sagt nichts.',
    };
  }

  const wert = round(tage.reduce((a, b) => a + b, 0) / tage.length, 1);
  const g = ERNAEHRUNG.energieverfuegbarkeit;

  let stufe = 'gut';
  let text = `Solide versorgt, Schnitt über ${tage.length} protokollierte Tage.`;
  if (wert < g.kritisch) {
    stufe = 'kritisch';
    text = `Unter ${g.kritisch} kcal/kg FFM im Schnitt über ${tage.length} Tage. Dauerhaft bedeutet `
      + 'das Leistungsverlust, Hormonstörungen und Knochenabbau. Mehr essen, nicht mehr trainieren.';
  } else if (wert < g.knapp) {
    stufe = 'knapp';
    text = `Zwischen ${g.kritisch} und ${g.knapp} kcal/kg FFM – für einige Wochen vertretbar, `
      + 'auf Dauer zu wenig.';
  } else if (wert < g.ziel) {
    stufe = 'okay';
    text = `Knapp unter der Zielmarke von ${g.ziel} kcal/kg FFM, aber unbedenklich.`;
  }

  return { berechenbar: true, wert, stufe, text, ffm, tage: tage.length, grenzwerte: g };
}

/** Summiert geloggte Lebensmittel zu Tageswerten. */
export function tagesSumme(eintraege = []) {
  return eintraege.reduce((summe, e) => {
    const menge = (Number(e.mengeG) || 0) / 100;
    return {
      kcal: summe.kcal + (Number(e.kcal) || 0) * menge,
      protein: summe.protein + (Number(e.protein) || 0) * menge,
      kohlenhydrate: summe.kohlenhydrate + (Number(e.kohlenhydrate) || 0) * menge,
      fett: summe.fett + (Number(e.fett) || 0) * menge,
    };
  }, { kcal: 0, protein: 0, kohlenhydrate: 0, fett: 0 });
}

/** Abgleich Ist gegen Soll – die Zahl, die morgens interessiert. */
export function bilanz(soll, ist) {
  if (!soll) return null;
  const feld = (name) => ({
    soll: Math.round(soll[name] || 0),
    ist: Math.round(ist[name] || 0),
    rest: Math.round((soll[name] || 0) - (ist[name] || 0)),
    prozent: soll[name] ? Math.round(((ist[name] || 0) / soll[name]) * 100) : 0,
  });
  return {
    kcal: feld('kcal'),
    protein: feld('protein'),
    kohlenhydrate: feld('kohlenhydrate'),
    fett: feld('fett'),
  };
}

/**
 * Verteilung des Proteins über den Tag. Vier bis fünf Portionen à ~0,4 g/kg
 * nutzen die Muskelproteinsynthese besser als zwei große (Schoenfeld 2018).
 */
export function mahlzeitenplan(profil, makro) {
  const kg = Number(profil?.gewichtKg);
  if (!kg || !makro) return null;
  const anzahl = ERNAEHRUNG.mahlzeitenProTag;
  const proteinJe = Math.round(makro.protein / anzahl);
  const mindestJe = Math.round(kg * ERNAEHRUNG.proteinProMahlzeit);
  return {
    anzahl,
    proteinJe,
    mindestJe,
    ausreichend: proteinJe >= mindestJe,
    kcalJe: Math.round(makro.kcal / anzahl),
    hinweis: proteinJe >= mindestJe
      ? `${anzahl} Mahlzeiten à ~${proteinJe} g Protein – damit ist der Reiz je Mahlzeit ausgereizt.`
      : `${proteinJe} g je Mahlzeit liegen unter den ~${mindestJe} g, die den vollen Reiz auslösen. `
        + 'Entweder mehr Protein am Tag oder auf drei größere Mahlzeiten verteilen.',
  };
}

/** Kohlenhydrate rund um harte Einheiten – bei langen Belastungen relevant. */
export function versorgungUmDieEinheit(profil, typ, minuten) {
  const kg = Number(profil?.gewichtKg);
  if (!kg) return null;
  const min = Number(minuten) || 0;
  const hinweise = [];

  if (['sprint', 'kraft', 'plyometrie'].includes(typ)) {
    hinweise.push('1–3 h vorher 1–2 g KH/kg, gut verträglich und fettarm.');
    hinweise.push('Während der Einheit reicht Wasser – die Speicher halten das aus.');
  }
  if (min >= 90) {
    hinweise.push(`Ab 90 min: 30–60 g Kohlenhydrate pro Stunde während der Belastung (~${Math.round(min / 60 * 45)} g gesamt).`);
  }
  if (min >= 60) {
    hinweise.push('Trinken nach Durst, bei Hitze 400–800 ml/h mit ~500 mg Natrium pro Liter.');
  }
  hinweise.push(`Danach ${Math.round(kg * 0.3)} g Protein; das Timing ist zweitrangig, die Tagesmenge zählt.`);

  return hinweise;
}

export { ZIELANPASSUNG, clamp };
