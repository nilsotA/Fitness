// Kalorien, Makronährstoffe und Energieverfügbarkeit.
//
// Der Bedarf wird pro Tag gerechnet, nicht pauschal über die Woche: An einem
// Sprint- plus Krafttag braucht der Körper etwas anderes als am Ruhetag. Genau
// darin liegt der Nutzen gegenüber einer festen Tageszahl.

import { ERNAEHRUNG, GRUNDUMSATZ, MET } from './wissen.js';
import { alltagsfaktor, alter, fettfreieMasse, round, clamp } from './profil.js';
// Deutsche Zahlen auch in Sätzen, die der Kern baut: „0.36 kg" stünde sonst
// mit Punkt in einer durchweg deutschen Oberfläche (Falle 56).
import { zahlText } from './regeln.js';


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
  const met = MET.werte[typ] ?? MET.werte.kraft;
  const kg = Number(gewichtKg);
  const min = Number(minuten);
  if (!kg || !min) return 0;
  // Die Formel selbst steht ebenfalls in `wissen.js`: 3,5 ml/kg/min ist die
  // Sauerstoffaufnahme in Ruhe, 200 die Umrechnung in Kilokalorien.
  return Math.round((met * MET.ruheVo2 * kg / MET.teiler) * min);
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

// Die Begründung steht bei der Konstante in `wissen.js`.
const ZIELANPASSUNG = ERNAEHRUNG.zielanpassung;

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
  /*
   * Lange Ausdauer hängt an der Länge, nicht am Schlüssel.
   *
   * Hier stand `e.typ === 'ausdauerLang'` – eine Einheitenart, die der Planer
   * **nie** erzeugt; er schreibt `ausdauerLocker`. Der Korridor von 7–9 g
   * Kohlenhydraten je Kilo war damit unerreichbar, und CLAUDE.md führte ihn
   * folgerichtig als „toten Korridor".
   *
   * Seit die Ausdauereinheiten dem Ausrichtungsregler folgen, sind es am
   * Ausdauer-Anschlag **104 Minuten** – und die bekamen dieselbe Vorgabe wie
   * ein 75-Minuten-Mischtag. Eine knapp zweistündige Ausfahrt ist aber genau
   * der Fall, für den es den Korridor gibt. Familie von Falle 4 und 38: Eine
   * Eigenschaft am internen Schlüssel festzumachen statt an der Sache selbst.
   *
   * Gezählt wird weiter je **Einheit**, nicht über die Tagessumme: Zwei
   * Stunden in zwei Blöcken mit Pause sind keine lange Belastung.
   */
  const LOCKERE_AUSDAUER = ['ausdauerLang', 'ausdauerLocker'];
  const langeAusdauer = einheiten.some((e) => LOCKERE_AUSDAUER.includes(e.typ)
    && Number(e.minuten) >= ERNAEHRUNG.langeAusdauerAbMinuten);

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
      `Kohlenhydrate liegen bei ${zahlText(khProKg, 1)} g/kg, der Korridor für diesen Tagestyp ist `
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
    // Wozu der Zielwert ins Verhältnis gesetzt gehört: Ohne den Plateaupunkt
    // sind 1,9 g/kg eine Ansage, mit ihm eine Begründung.
    proteinPlateau: ERNAEHRUNG.protein.plateau,
    proteinVertrauensbereich: ERNAEHRUNG.protein.vertrauensbereich,
    /*
     * Wie viel der Tagesenergie im Fett liegt.
     *
     * Das Fett gleicht aus, was der gedeckelte Kohlenhydratkorridor offen
     * lässt – nach oben ohne Grenze. Über zwölf Wochen Plan, gerechnet für
     * Gewichte von 55 bis 95 kg und jede Reglerstellung, verschreibt der
     * Tracker an 7,5 % der Tage mehr als 2 g/kg Fett und im Höchstfall 3,3.
     * Für Nils (78,3 kg) liegt es bei 1,0 bis 1,4, der Fall ist also keiner
     * seiner – aber er steht in derselben Rechnung.
     *
     * Bewusst **keine** Obergrenze fürs Fett: Die gäbe es in `wissen.js` nicht
     * zu belegen, und die Energie muss ohnehin irgendwohin. Stattdessen der
     * Anteil als Tatsache, damit die Oberfläche den Fall benennen kann, in dem
     * mehr Energie aus Fett als aus Kohlenhydraten kommt (3,2 % der Tage).
     */
    fettAnteilEnergie: round((fettG * 9) / kcalZiel, 3),
    khAnteilEnergie: round((kohlenhydrateG * 4) / kcalZiel, 3),
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
    // `proteinProMahlzeit` und `mahlzeiten` standen hier und wurden von
    // niemandem gelesen – `mahlzeitenplan()` leitet beide ein zweites Mal
    // her. Zwei Herleitungen derselben Größe, nur dass die eine tot war
    // (Falle 51).
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
    /*
     * „Entspricht" nur, wenn es das auch tut.
     *
     * Diese Stufe reicht von `referenz − 1` bis zur Zielmarke – bei Nils also
     * von 38,5 bis 45. Über den ganzen Bereich stand „Das entspricht deinem
     * Erhaltungsbedarf (39,5)", auch neben einer 43,5: gemessen in 91 von 151
     * Fällen mehr als ein kcal/kg darüber, und das unter der Überschrift
     * „Ziel +10 %". Ein Wort, das die Zahl daneben nicht hergibt – dieselbe
     * Familie wie „X von Y" in Falle 10.
     */
    const darueber = wert > referenz + g.protokollrauschen;
    return {
      stufe: 'erhaltung',
      text: `Das liegt ${darueber ? 'über' : 'auf'} deinem Erhaltungsbedarf `
        + `(${deutsch(referenz)} kcal/kg FFM) – du isst `
        + `also nicht zu wenig. Die Zielmarke von ${g.ziel} liegt darüber, weil sie sich auf `
        + 'Sportler mit weniger fettfreier Masse bezieht; bei deiner Körperzusammensetzung '
        + `wäre sie nur mit einem Überschuss zu erreichen. Die ${g.protokollrauschen} kcal/kg `
        + 'Spielraum fängt das Rauschen im Essensprotokoll ab – eine Erfahrungszahl, keine '
        + 'Messgenauigkeit.',
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

/**
 * Summiert geloggte Lebensmittel zu Tageswerten.
 *
 * `ohneMenge` zählt die Einträge, die mangels Menge nichts beitragen können.
 * Die App selbst kann so einen Eintrag nicht anlegen – `essenAnlegen()`
 * verlangt eine Menge –, aus einer fremden oder von Hand bearbeiteten
 * Sicherung kommt er aber durch, und die Prüfung beim Einspielen lässt ihn
 * bewusst durch (sonst sperrt eine krumme Zahl jemanden aus der eigenen
 * Sicherung aus, siehe Falle 27).
 *
 * Gezählt statt verschwiegen, weil so ein Eintrag in der Tagesliste **steht**
 * und trotzdem nicht in der Summe auftaucht: Wer nachrechnet, findet eine
 * Lücke ohne Grund (Falle 22).
 */
export function tagesSumme(eintraege = []) {
  return eintraege.reduce((summe, e) => {
    const gramm = Number(e.mengeG);
    if (!(gramm > 0)) return { ...summe, ohneMenge: summe.ohneMenge + 1 };
    const menge = gramm / 100;
    return {
      kcal: summe.kcal + (Number(e.kcal) || 0) * menge,
      protein: summe.protein + (Number(e.protein) || 0) * menge,
      kohlenhydrate: summe.kohlenhydrate + (Number(e.kohlenhydrate) || 0) * menge,
      fett: summe.fett + (Number(e.fett) || 0) * menge,
      ohneMenge: summe.ohneMenge,
    };
  }, { kcal: 0, protein: 0, kohlenhydrate: 0, fett: 0, ohneMenge: 0 });
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
 *
 * **Die Warnung darunter kann nicht auslösen, und das ist kein Versehen.**
 * Gerechnet wird gegen die *Vorgabe* des Trackers, nicht gegen das Gegessene:
 * `makro.protein` ist mindestens `protein.ziel` (1,9 g/kg), verteilt auf
 * `mahlzeitenProTag` (4). Das sind 0,475 g/kg je Mahlzeit gegen eine Schwelle
 * von 0,4 – über 17.205 durchgerechnete Kombinationen aus Körpergewicht,
 * Kalorienziel und Tagestyp **0 Unterschreitungen**.
 *
 * Der Grund ist eine Beziehung zwischen zwei Konstanten, die zusammengehören:
 * `protein.plateau / mahlzeitenProTag === proteinProMahlzeit` – 1,6 / 4 = 0,4.
 * Solange das Tagesziel über dem Plateau aus Morton 2018 liegt, geht die
 * Verteilung zwangsläufig auf. Ein Test hält beides fest.
 *
 * Der Satz sagt deshalb, *warum* es aufgeht, statt eine Prüfung vorzutäuschen,
 * die niemand bestehen muss (Falle 18 in der Form von Falle 24). Der zweite
 * Zweig bleibt trotzdem stehen: Wer `protein.ziel` unter das Plateau senkt,
 * soll den Hinweis bekommen statt eine still falsche Zusage.
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
      ? `${anzahl} Mahlzeiten à ~${proteinJe} g Protein, ab ~${mindestJe} g ist der Reiz je `
        + 'Mahlzeit voll ausgelöst. Das geht bei diesem Proteinziel immer auf – '
        + `${zahlText(ERNAEHRUNG.protein.plateau)} g/kg auf ${anzahl} Mahlzeiten sind genau die `
        + `${zahlText(ERNAEHRUNG.proteinProMahlzeit)} g/kg, und dein Ziel liegt darüber.`
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
    // `<= grenze`, damit „letzte 60 Tage" sechzig Kalendertage sind – hier
    // ohne Folgen, aber eine Konvention gilt oder sie gilt nicht.
    if (new Date(e.datum) <= grenze) continue;

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
      /*
       * Die Nährwerte gehen **unverändert** durch – sie liegen bereits je
       * 100 g vor, so speichert jeder Schreiber sie („sie gelten wie überall
       * je 100 g", `eintragDialog`), und so liest `tagesSumme()` sie auch
       * (mal `mengeG / 100`).
       *
       * Hier stand `je100(e.kcal, e.mengeG)` – eine zweite Umrechnung auf
       * einen Wert, der schon umgerechnet war, unter dem Kommentar „Zurück
       * auf je 100 g". Der Fehler war der Faktor `100 / mengeG`, und er traf
       * die Liste, aus der man am häufigsten einträgt: Olivenöl mit 10 g
       * Portion stand mit **8.840 kcal/100 g** da statt 884, Magerquark bei
       * 250 g mit 27 statt 67.
       *
       * Schlimmer als die Anzeige ist die Rückkopplung: Ein Tipp auf die
       * Zeile schreibt genau diese Zahl ins Tagebuch (`mengeDialog` reicht
       * `l.kcal` an `essenAnlegen` weiter). Jede weitere Runde multipliziert
       * den Fehler erneut – gemessen 372 → 465 → 581 kcal für dieselben
       * Haferflocken, ohne eine einzige Meldung.
       */
      kcal: e.kcal,
      protein: e.protein,
      kohlenhydrate: e.kohlenhydrate,
      fett: e.fett,
      anzahl: e.anzahl,
      zuletzt: e.zuletzt,
    }))
    /*
     * Häufigstes zuerst, bei Gleichstand das zuletzt gegessene – und wenn
     * auch das gleich ist, alphabetisch.
     *
     * Der dritte Schlüssel stand nicht da: Der Vergleich gab bei gleichem
     * Datum `-1` zurück statt `0` und drehte damit gleichrangige Einträge
     * um. Bei zwei gleich häufigen Lebensmitteln vom selben Tag entschied
     * also die Einfügereihenfolge, welches oben im Suchdialog steht. Das ist
     * kein Fehler mit Folgen, aber eine Reihenfolge ohne Begründung – und
     * damit nichts, was ein Test sinnvoll festhalten könnte.
     */
    .sort((a, b) => (b.anzahl - a.anzahl)
      || (a.zuletzt < b.zuletzt ? 1 : a.zuletzt > b.zuletzt ? -1 : 0)
      || a.name.localeCompare(b.name, 'de'))
    .slice(0, anzahl);
}

/* ------------------------------------------------------- Gewichtsverlauf */

/**
 * Wie schnell ändert sich das Körpergewicht wirklich?
 *
 * **Diese Funktion gibt es, weil die Oberfläche die Rate aus dem ersten und
 * dem letzten Punkt bildete** – ausgerechnet die beiden willkürlichsten Werte
 * einer Reihe, und genau die Methode, die Falle 7 für die Verlaufskurven
 * bereits verworfen hat. Über einem Gewicht, das sich über zwölf Wochen nicht
 * bewegt, stand damit „Aufbau schneller als ~0,5 % pro Woche – Kalorien etwas
 * zurücknehmen", nur weil zufällig der erste Tag leicht und der letzte schwer
 * war. Zwei Absätze darüber sagt dieselbe Karte: „Einzelne Tage schwanken um
 * ein bis zwei Kilo; aussagekräftig wird erst der Verlauf über zwei bis drei
 * Wochen."
 *
 * Verglichen wird deshalb das **erste mit dem letzten Drittel**, und die Zeit
 * dazwischen ist der Abstand ihrer Mittelpunkte – nicht die Gesamtspanne, die
 * wäre für zwei Mittelwerte zu lang. Behauptet wird eine Richtung nur, wenn
 * der Unterschied größer ist als das, was die Reihe von Punkt zu Punkt ohnehin
 * schwankt. Dasselbe Maß wie in `verlaufsUrteil()`: der mittlere Abstand
 * aufeinanderfolgender Werte, nicht die Standardabweichung – ein echter Trend
 * treibt die Standardabweichung mit nach oben und verdeckt sich damit selbst.
 *
 * Ein Urteil braucht außerdem Zeit: Unter `mindestWochen` steht dieselbe
 * Aussage wie bisher, nämlich keine.
 */
/**
 * Ein Tag, eine Wiegung – der jüngste Eintrag gewinnt.
 *
 * `gewichtSpeichern()` setzt das beim Schreiben ohnehin durch; die **Leser**
 * wussten davon nichts. Eine eingespielte Sicherung darf Doppelte enthalten
 * (der Import lehnt sie bewusst nicht ab), und dann zeichnet die Kurve zwei
 * Punkte auf denselben Tag – eine senkrechte Kante, die wie eine Messung
 * aussieht. Genau derselbe Fall wie beim Ruhepuls in Falle 65.
 *
 * Nebenwirkung, und die ist der eigentliche Gewinn: Mit eindeutigen Daten ist
 * die Sortierung darunter **von Bauart** eindeutig. Ohne die Entdopplung
 * unterscheiden sich `<` und `<=` im Vergleich gemessen in 2.442 von 4.000
 * Reihen – die Reihenfolge hinge dann daran, wie der Browser sortiert.
 */
export function eineWiegungProTag(punkte = []) {
  return wiegungenAufbereiten(punkte).punkte;
}

/**
 * Dasselbe, aber mit der Auskunft, **warum** Punkte fehlen.
 *
 * Zwei sehr verschiedene Dinge fallen hier heraus: unlesbare Werte (ein `null`
 * aus einer Sicherung von vor Falle 14) und Doppelungen (zwei Wiegungen am
 * selben Tag, die eine eingespielte Datei enthalten darf). Der Aufrufer konnte
 * sie nicht unterscheiden und meldete beides als „ohne lesbares Gewicht" –
 * über drei tadellosen Zahlen. Ein Zähler, der etwas anderes zählt als sein
 * Name sagt: Falle 15, hier zum zweiten Mal an derselben Zeile (Falle 31), und
 * wieder entstanden in der Korrektur zu einer Falle – diesmal zu Nr. 80, die
 * das Entdoppeln überhaupt erst einführte.
 */
export function wiegungenAufbereiten(punkte = []) {
  const jeTag = new Map();
  let unlesbar = 0;
  for (const p of punkte || []) {
    if (!p?.datum || !(Number(p.kg) > 0)) { unlesbar += 1; continue; }
    jeTag.set(p.datum, { datum: p.datum, kg: Number(p.kg) });
  }
  return {
    punkte: [...jeTag.values()].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0)),
    unlesbar,
    // Was gelesen werden konnte, aber sich einen Tag mit einem anderen Wert teilt.
    doppelt: (punkte || []).length - unlesbar - jeTag.size,
  };
}

export function gewichtsTrend(punkte = [], { mindestWochen = 2 } = {}) {
  const reihe = eineWiegungProTag(punkte);

  if (reihe.length < 3) {
    return { beurteilbar: false, grund: 'Ein Trend braucht mindestens drei Wiegungen.' };
  }

  const drittel = Math.max(1, Math.round(reihe.length / 3));
  const anfang = reihe.slice(0, drittel);
  const ende = reihe.slice(-drittel);
  const schnitt = (xs) => xs.reduce((s, x) => s + x.kg, 0) / xs.length;
  const mitte = (xs) => (new Date(xs[0].datum).getTime()
    + new Date(xs[xs.length - 1].datum).getTime()) / 2;

  const wochen = (mitte(ende) - mitte(anfang)) / (7 * 86400000);
  if (wochen < mindestWochen) {
    return {
      beurteilbar: false,
      grund: `Zwischen den beiden Hälften des Verlaufs liegen erst ${zahlText(wochen)} Wochen. `
        + `Aussagekräftig wird die Rate ab etwa ${mindestWochen} Wochen Abstand.`,
    };
  }

  const unterschied = schnitt(ende) - schnitt(anfang);
  const zappeln = reihe.slice(1)
    .reduce((s, p, i) => s + Math.abs(p.kg - reihe[i].kg), 0) / (reihe.length - 1);

  if (Math.abs(unterschied) <= zappeln) {
    return {
      beurteilbar: false,
      zappeln: round(zappeln, 2),
      unterschied: round(unterschied, 2),
      grund: `Der Unterschied zwischen erstem und letztem Drittel (${zahlText(unterschied, 2)} kg) `
        + 'bleibt unter dem, was die Reihe von Tag zu Tag ohnehin schwankt '
        + `(${zahlText(zappeln, 2)} kg). Das ist noch kein Trend.`,
    };
  }

  const proWoche = unterschied / wochen;
  const prozent = (proWoche / schnitt(ende)) * 100;
  const grenzen = ERNAEHRUNG.gewichtProWoche;

  return {
    beurteilbar: true,
    proWoche: round(proWoche, 2),
    prozent: round(prozent, 2),
    wochen: round(wochen, 1),
    punkte: reihe.length,
    zappeln: round(zappeln, 2),
    // Die Marken stehen mit Quelle in wissen.js (Garthe 2011); hier wird nur
    // eingeordnet, damit die Oberfläche keine zweite Schwelle führt.
    bewertung: prozent > grenzen.aufbauMax ? 'aufbauZuSchnell'
      : prozent < -grenzen.abnahmeMax ? 'abnahmeZuSchnell'
        : 'imRahmen',
  };
}

export { ZIELANPASSUNG, clamp };
