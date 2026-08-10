// Kalorien, Makronährstoffe und Energieverfügbarkeit.
//
// Der Bedarf wird pro Tag gerechnet, nicht pauschal über die Woche: An einem
// Sprint- plus Krafttag braucht der Körper etwas anderes als am Ruhetag. Genau
// darin liegt der Nutzen gegenüber einer festen Tageszahl.

import { ERNAEHRUNG, GRUNDUMSATZ } from './wissen.js';
import { alltagsfaktor, alter, fettfreieMasse, round, clamp } from './profil.js';

/**
 * MET-Werte je Einheitentyp. Umsatz = MET × 3,5 × kg / 200 pro Minute.
 *
 * Wichtig: Das sind **Durchschnittswerte über die ganze Einheit**, nicht die
 * Werte während der Belastung. Eine Sprinteinheit dauert zwei Stunden, besteht
 * aber zu neun Zehnteln aus Stehen und Gehen – die eigentlichen Läufe machen
 * keine Minute aus. Mit dem MET-Wert des Sprintens gerechnet käme man auf über
 * 1200 kcal, was dem Umsatz von zwei Stunden Dauerlauf entspräche.
 *
 * Zu hoch angesetzt ist hier gefährlicher als zu niedrig: Der Wert geht direkt
 * in das Kalorienziel ein, und wer täglich 500 kcal zu viel isst, nimmt zu,
 * ohne zu verstehen warum.
 */
export const MET = {
  sprint: 6.0,              // lange vollständige Pausen zwischen kurzen Läufen
  plyometrie: 6.0,
  kraft: 5.0,               // Sätze von 30–60 s, dazwischen 2–3 min Pause
  ausdauerLocker: 7.0,      // wirklich durchgehende Belastung
  ausdauerIntervalle: 9.5,  // harte Blöcke, aber mit lockeren Abschnitten dazwischen
  ausdauerLang: 8.0,
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
    const c = GRUNDUMSATZ.cunningham;
    return {
      kcal: Math.round(c.basis + c.proKgFettfrei * ffm),
      formel: c.name,
      quelle: c.quelle,
    };
  }

  const cm = Number(profil?.groesseCm);
  const jahre = alter(profil, heute);
  if (!cm || !jahre) return null;
  const m = GRUNDUMSATZ.mifflin;
  return {
    kcal: Math.round(m.proKg * kg + m.proCm * cm + m.proJahr * jahre
      + (profil.geschlecht === 'w' ? m.frau : m.mann)),
    formel: m.name,
    quelle: m.quelle,
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
  const korridor = ERNAEHRUNG.kohlenhydrate[typ] || ERNAEHRUNG.kohlenhydrate.mittel;

  /*
   * Reihenfolge: Protein, dann Kohlenhydrate, dann Fett.
   *
   * Vorher standen Protein *und* Fett fest und die Kohlenhydrate waren der
   * Rest – der dann gegen einen Korridor gehalten wurde, an den er nie
   * gebunden war. Bei drei von fünf Tagestypen lag das Ergebnis außerhalb:
   * Am Ruhetag kamen 4,6 g/kg heraus bei einem Korridor von 3–4, an harten
   * Tagen 7,8 statt 6–7. Der Tracker warnte also vor seiner eigenen Vorgabe.
   *
   * Der Hinweistext nannte den richtigen Hebel längst („entweder Fett etwas
   * senken oder die Kalorien anheben"), nur zog ihn niemand. Jetzt bindet der
   * Korridor die Kohlenhydrate, und das Fett gleicht aus – so herum steht es
   * auch im Positionspapier, auf das sich der Tracker beruft: Protein nach
   * Körpermasse, Kohlenhydrate nach Trainingslast, Fett füllt auf.
   *
   * Die Untergrenze fürs Fett bleibt hart: Darunter leiden Hormonhaushalt und
   * fettlösliche Vitamine. Reicht die Energie dann nicht mehr für den
   * Korridor, weichen die Kohlenhydrate – und *das* ist ein Hinweis wert,
   * weil es eine echte Aussage über den Tag ist und nicht über die Rechnung.
   */
  const kcalNachProtein = kcalZiel - proteinG * 4;
  const fettMinG = Math.round(kg * ERNAEHRUNG.fett.minimum);
  const fettZielG = Math.round(kg * ERNAEHRUNG.fett.ziel);

  let kohlenhydrateG = Math.max(0, Math.round((kcalNachProtein - fettZielG * 9) / 4));
  kohlenhydrateG = Math.min(Math.round(kg * korridor[1]),
    Math.max(Math.round(kg * korridor[0]), kohlenhydrateG));

  let fettG = Math.round((kcalNachProtein - kohlenhydrateG * 4) / 9);
  if (fettG < fettMinG) {
    fettG = fettMinG;
    kohlenhydrateG = Math.max(0, Math.round((kcalNachProtein - fettG * 9) / 4));
  }

  const khProKg = round(kohlenhydrateG / kg, 1);

  const hinweise = [];
  if (khProKg < korridor[0]) {
    hinweise.push(
      `Kohlenhydrate liegen bei ${khProKg} g/kg, der Korridor für diesen Tagestyp ist `
      + `${korridor[0]}–${korridor[1]} g/kg. Für harte Einheiten wird das knapp – `
      + 'entweder Fett etwas senken oder die Kalorien anheben.',
    );
  }
  /*
   * Hier stand ein zweiter Hinweis: „Kohlenhydrate stehen am oberen Ende des
   * Korridors; die übrigen Kalorien liegen im Fett." Der ist ersatzlos weg.
   *
   * Seit der Korridor die Kohlenhydrate bindet und das Fett ausgleicht (siehe
   * oben), ist Fett über dem Zielwert nicht die Ausnahme, sondern der
   * Regelfall – über zwölf Wochen Plan an **84 von 84 Tagen**, und die
   * Oberfläche malt jeden Hinweis als orange Warnung. Eine Warnung, die immer
   * dasteht, ist keine Warnung mehr; man gewöhnt sich an, sie zu übersehen,
   * und übersieht dann auch die daneben. Dazu behauptete der Text „An einem
   * ruhigen Tag ist das genau richtig" – er erschien aber gerade an den harten
   * Tagen, wo das Fett mit 2,2 g/kg am höchsten liegt.
   *
   * Die Zahl selbst ist trotzdem wissenswert, deshalb steht sie jetzt als
   * Tatsache im Rückgabewert (`fettProKg`, `fettZielProKg`) und in der
   * Oberfläche in derselben Zeile wie der Kohlenhydratkorridor – als
   * Beschreibung der Aufteilung, nicht als Mangelmeldung.
   */

  return {
    kcal: Math.round(kcalZiel),
    protein: proteinG,
    fett: fettG,
    kohlenhydrate: kohlenhydrateG,
    proteinProKg: round(proteinProKg, 2),
    // Was tatsächlich vorgegeben wird, nicht was angepeilt war. Hier stand
    // `ERNAEHRUNG.fett.ziel` – ein fester Wert von 1,0, während im selben
    // Objekt `fett: 174` stand, also 2,2 g/kg. Ein Überbleibsel aus der Zeit,
    // als das Fett vorgegeben war und die Kohlenhydrate der Rest (Falle 16):
    // Die Herleitung wurde gedreht, dieses Feld beschrieb weiter die alte.
    fettProKg: round(fettG / kg, 2),
    fettZielProKg: round(ERNAEHRUNG.fett.ziel, 2),
    khProKg,
    korridor,
    tagestyp: typ,
    hinweise,
    proteinProMahlzeit: Math.round(kg * ERNAEHRUNG.proteinProMahlzeit),
    mahlzeiten: ERNAEHRUNG.mahlzeitenProTag,
  };
}

/**
 * Energieverfügbarkeit bei genau eingehaltenem Erhaltungsbedarf.
 *
 * Die Trainingskalorien stecken sowohl in der Aufnahme als auch im Abzug und
 * kürzen sich heraus – übrig bleibt der Alltagsumsatz je Kilo fettfreier
 * Masse. Das ist der Wert, den jemand *nicht unterschreitet*, der isst, was
 * der Tracker vorgibt. Er dient als Vergleichsmaßstab neben der absoluten
 * Zielmarke, die für schwerere Sportler nicht erreichbar ist (Begründung mit
 * Herleitung in `wissen.js`).
 */
export function erhaltungsEnergieverfuegbarkeit(profil, heute = new Date()) {
  const ffm = fettfreieMasse(profil);
  const gu = grundumsatz(profil, heute);
  if (!ffm || !gu) return null;
  return round((gu.kcal * alltagsfaktor(profil)) / ffm, 1);
}

/**
 * Note für einen Energieverfügbarkeitswert.
 *
 * `kritisch` gilt absolut und ohne Ausnahme – das ist der Punkt, an dem es
 * gesundheitlich ernst wird. Darüber wird zusätzlich gegen den eigenen
 * Erhaltungsbedarf geprüft: Wer den deckt, isst nicht zu wenig, auch wenn die
 * absolute Zielmarke von 45 kcal/kg FFM bei seiner Körperzusammensetzung
 * rechnerisch außer Reichweite liegt. Vorher stand dort „auf Dauer zu wenig.
 * Mehr essen, nicht mehr trainieren" – als orange Warnung, jeden Tag, bei
 * einem Kalorienziel aus demselben Tracker.
 */
function evNote(wert, referenz) {
  const g = ERNAEHRUNG.energieverfuegbarkeit;

  if (wert < g.kritisch) {
    return {
      stufe: 'kritisch',
      text: `Unter ${g.kritisch} kcal/kg FFM. Dauerhaft bedeutet das Leistungsverlust, `
        + 'Hormonstörungen und Knochenabbau. Mehr essen, nicht mehr trainieren.',
    };
  }
  if (wert >= g.ziel) {
    return { stufe: 'gut', text: 'Solide versorgt.' };
  }
  // Komma statt Punkt: `${39.5}` gibt „39.5", und in einer durchweg deutschen
  // Oberfläche liest sich das wie ein Tippfehler – siehe Falle 14.
  const deutsch = (n) => String(n).replace('.', ',');

  if (referenz != null && wert >= referenz - g.protokollrauschen) {
    return {
      stufe: 'erhaltung',
      text: `Das entspricht deinem Erhaltungsbedarf (${deutsch(referenz)} kcal/kg FFM) – du isst `
        + `also nicht zu wenig. Die Zielmarke von ${g.ziel} liegt darüber, weil sie sich auf `
        + 'Sportler mit weniger fettfreier Masse bezieht; bei deiner Körperzusammensetzung '
        + 'wäre sie nur mit einem Überschuss zu erreichen.',
    };
  }
  if (wert < g.knapp) {
    return {
      stufe: 'knapp',
      text: `Zwischen ${g.kritisch} und ${g.knapp} kcal/kg FFM und unter deinem `
        + `Erhaltungsbedarf${referenz != null ? ` von ${deutsch(referenz)}` : ''} – für einige `
        + 'Wochen vertretbar, auf Dauer zu wenig.',
    };
  }
  return {
    stufe: 'okay',
    text: `Knapp unter der Zielmarke von ${g.ziel} kcal/kg FFM, aber unbedenklich.`,
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
  const referenz = erhaltungsEnergieverfuegbarkeit(profil);
  const { stufe, text } = evNote(wert, referenz);

  return {
    berechenbar: true,
    wert,
    stufe,
    text,
    ffm,
    erhaltung: referenz,
    grenzwerte: ERNAEHRUNG.energieverfuegbarkeit,
  };
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
  // Dieselbe Note wie beim Einzeltag – sie stand hier ein zweites Mal, Wort
  // für Wort. Zwei Fassungen derselben Bewertung driften auseinander, sobald
  // eine davon angefasst wird.
  const referenz = erhaltungsEnergieverfuegbarkeit(profil, bis);
  const { stufe, text } = evNote(wert, referenz);

  return {
    berechenbar: true,
    wert,
    stufe,
    // Ohne Zusatz: Die Zahl der Tage steht in der Oberfläche schon neben dem
    // Wert, und zweimal dasselbe im selben Absatz liest sich wie ein Versehen.
    text,
    ffm,
    erhaltung: referenz,
    tage: tage.length,
    grenzwerte: ERNAEHRUNG.energieverfuegbarkeit,
  };
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
  // Ohne Körpergewicht fehlt nur die Proteinmenge. Kohlenhydrate vorher und
  // Trinken gelten trotzdem – deshalb hier nicht alles verwerfen, sondern
  // weiter unten die eine Zeile weglassen.
  const kg = Number(profil?.gewichtKg) || 0;
  const min = Number(minuten) || 0;
  const hinweise = [];

  const u = ERNAEHRUNG.umDieEinheit;
  if (['sprint', 'kraft', 'plyometrie'].includes(typ)) {
    hinweise.push(`1–3 h vorher ${u.khVorherProKg.join('–')} g Kohlenhydrate/kg, `
      + 'gut verträglich und fettarm.');
    hinweise.push('Während der Einheit reicht Wasser – die Speicher halten das aus.');
  }
  if (min >= u.khAbMinuten) {
    const mitte = (u.khProStunde[0] + u.khProStunde[1]) / 2;
    hinweise.push(`Ab ${u.khAbMinuten} min: ${u.khProStunde.join('–')} g Kohlenhydrate pro Stunde `
      + `während der Belastung (~${Math.round((min / 60) * mitte)} g gesamt).`);
  }
  if (min >= u.trinkenAbMinuten) {
    hinweise.push(`Trinken nach Durst, bei Hitze ${u.trinkenProStundeMl.join('–')} ml/h `
      + `mit ~${u.natriumProLiterMg} mg Natrium pro Liter.`);
  }
  if (kg) {
    hinweise.push(`Danach ${Math.round(kg * u.proteinNachherProKg)} g Protein; das Timing ist `
      + 'zweitrangig, die Tagesmenge zählt.');
  }

  return hinweise;
}

/**
 * Was tatsächlich gegessen wird – nach Häufigkeit, nicht nach Alphabet.
 *
 * Der Suchdialog zeigte bei leerem Feld die ersten 25 Einträge der
 * Nährwerttabelle. Das ist die denkbar nutzloseste Vorauswahl: Niemand isst
 * alphabetisch. Vier bis fünf Einträge am Tag sind der häufigste Handgriff der
 * ganzen App, und wenn der mühsam ist, wird er nach zwei Wochen nicht mehr
 * gemacht – dann steht die Ernährungsrechnung auf Lücken.
 *
 * Gezählt wird nur das jüngste Fenster: Was man im Frühjahr täglich gegessen
 * hat und seit Monaten nicht mehr, gehört nicht nach oben. Bei gleicher Anzahl
 * gewinnt das Zuletzte.
 *
 * Mitgeliefert wird die zuletzt eingetragene Menge – das ist die, die man
 * wieder eintragen will, und spart den zweiten Handgriff.
 */
export function haeufigeLebensmittel(essen = [], { bis = new Date(), tage = 60, anzahl = 20 } = {}) {
  const grenze = new Date(bis);
  grenze.setDate(grenze.getDate() - tage);

  const proName = new Map();
  for (const e of essen) {
    if (!e?.name || !e.datum) continue;
    if (new Date(e.datum) < grenze) continue;

    const bisher = proName.get(e.name);
    if (!bisher) {
      proName.set(e.name, { ...e, anzahl: 1, zuletzt: e.datum });
      continue;
    }
    bisher.anzahl += 1;
    // Nährwerte und Menge vom jüngsten Eintrag – eine geänderte Packung soll
    // sich durchsetzen, nicht die Angabe von vor zwei Monaten.
    if (e.datum >= bisher.zuletzt) {
      Object.assign(bisher, e, { anzahl: bisher.anzahl, zuletzt: e.datum });
    }
  }

  return [...proName.values()]
    .map((e) => ({
      name: e.name,
      mengeG: e.mengeG,
      // Zurück auf „je 100 g", weil die Oberfläche damit rechnet.
      kcal: round(je100(e.kcal, e.mengeG), 0),
      protein: round(je100(e.protein, e.mengeG), 1),
      kohlenhydrate: round(je100(e.kohlenhydrate, e.mengeG), 1),
      fett: round(je100(e.fett, e.mengeG), 1),
      anzahl: e.anzahl,
      zuletzt: e.zuletzt,
    }))
    .sort((a, b) => (b.anzahl - a.anzahl) || (a.zuletzt < b.zuletzt ? 1 : -1))
    .slice(0, anzahl);
}

function je100(wert, mengeG) {
  const m = Number(mengeG) || 0;
  if (!m) return 0;
  return ((Number(wert) || 0) / m) * 100;
}

export { ZIELANPASSUNG, clamp };
