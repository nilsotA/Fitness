// Vom Protokoll zur nächsten Last.
//
// Der Plan sagt „85–92 % 1RM". Am Gerät hilft das niemandem – dort braucht es
// eine Zahl in Kilo. Dieses Modul rechnet sie aus, und zwar aus zwei Quellen:
// aus eingetragenen Krafttests und aus dem, was tatsächlich protokolliert
// wurde. Das Protokoll ist dabei die ehrlichere Quelle, weil es die Lasten
// enthält, die wirklich bewegt wurden.
//
// Reine Rechenfunktionen ohne Netzwerk oder Dateizugriff – damit testbar.

import { UEBUNGEN, PROGRESSION, SCHUTZZIELE, VOLUMEN, EPLEY } from './wissen.js';
import { e1rm, e1rmVerlaesslich, round, clamp } from './profil.js';
import { menge } from './regeln.js';

/**
 * Bestes geschätztes Einer-Maximum je Übung.
 *
 * Sätze über zehn Wiederholungen fließen nicht ein: Die Epley-Formel wird dort
 * so ungenau, dass ein Satz mit 15 lockeren Wiederholungen ein höheres 1RM
 * ausweisen kann als ein harter Dreier – und dann steigt die Empfehlung, obwohl
 * die Kraft nicht gestiegen ist.
 */
export function einerMaxima(daten = {}, koerpergewichtKg = 0) {
  const stand = {};
  const kg = Number(koerpergewichtKg) || 0;

  const merken = (schluessel, wert, datum, quelle) => {
    if (!wert || !schluessel) return;
    if (!stand[schluessel] || wert > stand[schluessel].e1rm) {
      stand[schluessel] = { e1rm: round(wert, 1), datum, quelle };
    }
  };

  // Bei Klimmzügen und Dips hebt der Körper immer mit. Gerechnet wird deshalb
  // mit der Gesamtlast aus Körpergewicht plus Zusatz – sonst wären Prozentsätze
  // sinnlos: 85 % einer Zusatzlast von 20 kg wären 17 kg, die tatsächliche
  // Belastung sänke dabei aber nur von 98 auf 95 kg, also um 3 %.
  const gesamtlast = (uebung, last) => (uebung.koerpergewicht ? kg + last : last);

  // Aus den Krafttests – aber nur aus denen, die eine Last in Kilo messen.
  for (const test of daten.tests || []) {
    const eintrag = Object.entries(UEBUNGEN).find(([, u]) => u.lastTest === test.art);
    const wdhEintrag = Object.entries(UEBUNGEN).find(([, u]) => u.wdhTest === test.art);
    const wdh = Number(test.wiederholungen) || 1;
    if (wdh > EPLEY.maxWiederholungen) continue;

    if (eintrag) {
      const [schluessel, uebung] = eintrag;
      merken(schluessel, e1rm(gesamtlast(uebung, Number(test.wert) || 0), wdh), test.datum, 'Test');
    }
    // Ein Wiederholungstest mit eigenem Körpergewicht schätzt die Gesamtlast
    // ebenfalls: Wer neun saubere Klimmzüge schafft, hat ein Einer-Maximum von
    // etwa dem 1,3-fachen Körpergewicht.
    if (wdhEintrag && kg) {
      const [schluessel] = wdhEintrag;
      const reps = Number(test.wert) || 0;
      if (reps > 0 && reps <= EPLEY.maxWiederholungen) {
        merken(schluessel, e1rm(kg, reps), test.datum, 'Test');
      }
    }
  }

  // Aus protokollierten Sätzen.
  for (const session of daten.sessions || []) {
    for (const eintrag of session.uebungen || []) {
      const uebung = UEBUNGEN[eintrag.schluessel];
      if (!uebung) continue;
      for (const satz of eintrag.saetze || []) {
        const last = Number(satz.gewicht) || 0;
        const wdh = Number(satz.wiederholungen);
        if (!wdh || wdh > EPLEY.maxWiederholungen) continue;
        // Körpergewichtsübungen zählen auch ohne Zusatzlast, reine
        // Hantelübungen brauchen dagegen ein Gewicht.
        const gesamt = gesamtlast(uebung, last);
        if (!gesamt) continue;
        merken(eintrag.schluessel, e1rm(gesamt, wdh), session.datum, 'Training');
      }
    }
  }

  // Abgeleitete Übungen auffüllen, aber nur wenn es keine eigenen Daten gibt.
  for (const [schluessel, uebung] of Object.entries(UEBUNGEN)) {
    if (stand[schluessel] || !uebung.ableitenVon) continue;
    const basis = stand[uebung.ableitenVon];
    if (!basis) continue;
    stand[schluessel] = {
      e1rm: round(basis.e1rm * uebung.faktor, 1),
      datum: basis.datum,
      quelle: `abgeleitet aus ${UEBUNGEN[uebung.ableitenVon].name}`,
      geschaetzt: true,
    };
  }

  return stand;
}

/** Die zuletzt protokollierte Leistung je Übung – Grundlage der Progression. */
export function letzteLeistung(sessions = []) {
  const stand = {};
  const sortiert = [...sessions].sort((a, b) => (a.datum < b.datum ? -1 : 1));

  for (const session of sortiert) {
    for (const uebung of session.uebungen || []) {
      const saetze = (uebung.saetze || []).filter((s) => Number(s.wiederholungen) > 0);
      if (!saetze.length) continue;
      const vorher = stand[uebung.schluessel];
      const topGewicht = Math.max(...saetze.map((s) => Number(s.gewicht) || 0));
      // Gesamte Wiederholungen der Einheit – das Maß für Fortschritt bei
      // gehaltener Last.
      const gesamtWdh = saetze.reduce((n, s) => n + (Number(s.wiederholungen) || 0), 0);

      // Wie oft hintereinander ging es nicht voran? Zählt für die Rücknahme.
      //
      // Der Zähler hieß bis zuletzt `gleicheLast` – und genau daran hing der
      // Fehler unten: Er zählte gleiche Lasten und wurde als Stillstand
      // gelesen. Die Rechnung ist seither richtig, der Name blieb aber falsch
      // und hätte denselben Irrtum jederzeit wieder eingeladen. Falle 15 sagt
      // es selbst: „sein Name stand schon daneben."
      //
      // Früher zählte diese Zahl nur, wie oft dieselbe Last dastand – und
      // genau das ist bei doppelter Progression der Normalfall: Man hält das
      // Gewicht absichtlich und arbeitet die Wiederholungen hoch. Im Bereich
      // 3 bis 5 braucht das mindestens drei Einheiten, also feuerte die
      // Rücknahme zuverlässig dann, wenn der Plan planmäßig lief. Unter
      // „105 kg × 4,4,3" und „105 kg × 4,4,4" stand „ohne Fortschritt",
      // obwohl eine Wiederholung dazugekommen war.
      //
      // Stillstand heißt jetzt: gleiche Last *und* keine zusätzliche
      // Wiederholung.
      const stagniert = vorher
        && vorher.topGewicht === topGewicht
        && gesamtWdh <= vorher.gesamtWdh;

      stand[uebung.schluessel] = {
        datum: session.datum,
        saetze,
        topGewicht,
        gesamtWdh,
        ohneFortschritt: stagniert ? vorher.ohneFortschritt + 1 : 1,
      };
    }
  }
  return stand;
}

/**
 * Welcher Prozentsatz des Einer-Maximums passt zu einer Wiederholungszahl?
 *
 * Umkehrung der Epley-Formel. Der Aufschlag `rir` (reps in reserve) sorgt
 * dafür, dass die Last zu einem Satz *mit Reserve* passt: Wer fünf
 * Wiederholungen machen soll, bekommt das Gewicht, mit dem sieben möglich
 * wären. Jeden Satz bis zum Versagen zu fahren bringt kaum mehr Anpassung,
 * kostet aber deutlich mehr Erholung.
 *
 * Ohne diese Ableitung driften Vorgabe und Last auseinander – eine Vorgabe von
 * „7 Wiederholungen bei 90 % 1RM" ist schlicht nicht ausführbar.
 */
export function prozentFuerWdh(wiederholungen, rir = 2) {
  const gesamt = Math.max(1, Number(wiederholungen) + Number(rir));
  return round(100 / (1 + gesamt / 30), 1);
}

/**
 * Prozentbereich zu einem Wiederholungsbereich. Mehr Wiederholungen bedeuten
 * weniger Last, deshalb ist die Zuordnung über Kreuz.
 */
export function prozentBereich([repMin, repMax], rir = 2) {
  return [prozentFuerWdh(repMax, rir), prozentFuerWdh(repMin, rir)];
}

/** Auf die kleinste an der Hantel darstellbare Stufe runden. */
export function aufScheibe(gewicht, schritt = 2.5) {
  // Null ist ein gültiges Ergebnis: Bei Klimmzügen heißt es „ohne Zusatzlast".
  // Deshalb wird hier auf null/undefined geprüft und nicht auf Wahrheitswert.
  if (gewicht == null || Number.isNaN(Number(gewicht)) || !schritt) return null;
  return round(Math.round(gewicht / schritt) * schritt, 1);
}

/**
 * Arbeitsgewicht für eine Übung: Prozentbereich mal Einer-Maximum, gerundet auf
 * das, was sich auflegen lässt.
 */
export function arbeitsgewicht(schluessel, intensitaetProzent, maxima = {}, koerpergewichtKg = 0) {
  const uebung = UEBUNGEN[schluessel];
  const stand = maxima[schluessel];
  if (!uebung || !stand || uebung.ohneLast) return null;

  const [von, bis] = intensitaetProzent;
  const kg = Number(koerpergewichtKg) || 0;

  // Bei Körpergewichtsübungen ist das Einer-Maximum die Gesamtlast. Aufzulegen
  // ist davon nur der Teil über dem eigenen Gewicht – und der kann negativ
  // ausfallen, wenn schon das reine Körpergewicht über der Zielintensität liegt.
  // Dann steht dort null Zusatz statt einer sinnlosen Minuszahl.
  const anteil = (prozent) => {
    const gesamt = stand.e1rm * prozent / 100;
    return uebung.koerpergewicht ? Math.max(0, gesamt - kg) : gesamt;
  };

  return {
    von: aufScheibe(anteil(von), uebung.schritt),
    bis: aufScheibe(anteil(bis), uebung.schritt),
    e1rm: stand.e1rm,
    gesamtlast: uebung.koerpergewicht,
    quelle: stand.quelle,
    geschaetzt: Boolean(stand.geschaetzt),
    datum: stand.datum,
  };
}

/**
 * Vorschlag für die nächste Einheit nach doppelter Progression.
 *
 * Es wird nur gesteigert, wenn im letzten Training jeder Satz das obere Ende
 * des Wiederholungsbereichs erreicht hat. Steht die Last dagegen zum dritten
 * Mal ohne Fortschritt, ist sie zu hoch angesetzt – dann geht sie zurück,
 * statt dass man wochenlang gegen dieselbe Wand läuft.
 *
 * **`vorgabe` ist kein Beiwerk.** Der Vorschlag steht in der Planansicht in
 * derselben Zeile wie die Lastvorgabe – zwei Zahlen für dieselbe Übung, und
 * sie dürfen einander nicht widersprechen. Genau das taten sie: Doppelte
 * Progression vergleicht mit der letzten Einheit, ohne zu wissen, aus welchem
 * Block die stammte. Im Realisierungsblock (Explosivkraft, 30–60 % 1RM) stand
 * unter der Vorgabe „35–75 kg" der Rat, auf 110 kg zu erhöhen – die 105 kg aus
 * dem Maximalkraftblock davor plus einen Schritt. Wer dem folgt, macht aus
 * Schnellkraftarbeit eine Maximalkrafteinheit und verliert den Block. In der
 * Gegenrichtung genauso: In der Woche danach lautete die Vorgabe 100–110 kg
 * und der Vorschlag 80 kg.
 *
 * Verschärft wurde das dadurch, dass Maximal- und Explosivkraft denselben
 * oberen Wiederholungswert haben – „alle Sätze am oberen Ende" war über die
 * Blockgrenze hinweg also immer erfüllt.
 *
 * Doppelte Progression ergibt nur **innerhalb** eines Blocks Sinn. Liegt die
 * letzte Last erkennbar außerhalb der aktuellen Vorgabe, wird deshalb keine
 * Zahl genannt, sondern gesagt, warum. Als Spielraum dient genau ein
 * Hantelschritt: Innerhalb eines Blocks landet die Steigerung auf dem oberen
 * Ende der Vorgabe oder einen Schritt darüber – erst danach zieht das
 * Einer-Maximum nach und hebt die Vorgabe mit.
 */
export function naechsteLast(schluessel, letzte, repBereich, vorgabe = null) {
  const uebung = UEBUNGEN[schluessel];
  if (!uebung || uebung.ohneLast) return null;
  if (!letzte?.saetze?.length) {
    return { empfehlung: null, text: 'Noch nichts protokolliert – erste Einheit als Standortbestimmung.' };
  }

  const [, repMax] = repBereich;
  const last = letzte.topGewicht;

  const spielraum = uebung.schritt || 2.5;
  const andererBlock = vorgabe?.von != null && vorgabe?.bis != null
    && (last > vorgabe.bis + spielraum || last < vorgabe.von - spielraum);
  if (andererBlock) {
    return {
      empfehlung: null,
      richtung: 'neuerBlock',
      text: `Zuletzt ${last} kg – das war ein anderer Block mit anderer Absicht. `
        + `Hier gilt die Vorgabe oben (${vorgabe.von}–${vorgabe.bis} kg); die Steigerung `
        + 'zählt wieder von dieser Einheit an.',
    };
  }
  const alleOben = letzte.saetze.every((s) => Number(s.wiederholungen) >= repMax);
  const anteilOben = letzte.saetze.filter((s) => Number(s.wiederholungen) >= repMax).length
    / letzte.saetze.length;

  if (alleOben) {
    const neu = aufScheibe(last + uebung.schritt, uebung.schritt);
    return {
      empfehlung: neu,
      richtung: 'hoch',
      text: `Letztes Mal alle Sätze mit ${repMax} Wiederholungen – Last auf ${neu} kg erhöhen `
        + `und im Bereich wieder unten anfangen.`,
    };
  }

  if (letzte.ohneFortschritt >= PROGRESSION.einheitenBisRuecknahme) {
    const neu = aufScheibe(last * PROGRESSION.ruecknahmeProzent, uebung.schritt);
    return {
      empfehlung: neu,
      richtung: 'runter',
      text: `${letzte.ohneFortschritt} Einheiten auf ${last} kg ohne Fortschritt. Zurück auf ${neu} kg `
        + 'und von dort neu aufbauen – gegen dieselbe Wand zu laufen kostet nur Zeit.',
    };
  }

  return {
    empfehlung: last,
    richtung: 'halten',
    text: `${last} kg halten und die Wiederholungen bis ${repMax} ausbauen `
      + `(zuletzt ${Math.round(anteilOben * 100)} % der Sätze am oberen Ende).`,
  };
}

/**
 * Gesamtbild für den Planer: Maxima, letzte Leistung und Vorschläge in einem
 * Objekt, das `wochenplan` durchreichen kann, ohne selbst auf Daten zuzugreifen.
 */
export function leistungsstand(daten = {}) {
  const kg = Number(daten.profil?.gewichtKg) || 0;
  return {
    maxima: einerMaxima(daten, kg),
    letzte: letzteLeistung(daten.sessions || []),
    nichtSchaetzbar: nichtSchaetzbareTests(daten),
    koerpergewichtKg: kg,
  };
}

/**
 * Krafttests, aus denen sich kein Einer-Maximum schätzen lässt, weil sie über
 * der Epley-Grenze liegen.
 *
 * `einerMaxima` überspringt diese Einträge – zu Recht, die Schätzung wäre
 * unbrauchbar. Nur sagte das niemandem etwas: Wer „Kniebeuge 100 kg × 15"
 * eintrug, sah in der Kraft-Tabelle danach einen Strich, genau wie jemand, der
 * gar nichts eingetragen hat. Ein stillschweigend verworfener Eintrag ist
 * schlimmer als eine Fehlermeldung – man sucht den Fehler bei sich.
 *
 * Zurückgegeben wird der jüngste betroffene Test je Übung, damit die
 * Oberfläche sagen kann, *warum* dort nichts steht und was zu tun ist.
 */
export function nichtSchaetzbareTests(daten = {}) {
  const treffer = {};
  for (const test of daten.tests || []) {
    const eintrag = Object.entries(UEBUNGEN).find(([, u]) => u.lastTest === test.art);
    if (!eintrag) continue;
    const wdh = Number(test.wiederholungen) || 1;
    if (e1rmVerlaesslich(wdh)) continue;
    const [schluessel] = eintrag;
    const bisher = treffer[schluessel];
    if (!bisher || String(test.datum) > String(bisher.datum)) {
      treffer[schluessel] = { wiederholungen: wdh, datum: test.datum, grenze: EPLEY.maxWiederholungen };
    }
  }
  return treffer;
}

/**
 * Wochenvolumen je Übung – die Zahl, die für Hypertrophie zählt.
 * Gezählt werden harte Sätze, also solche mit protokollierten Wiederholungen.
 */
export function saetzeProWoche(sessions = [], bis = new Date(), tage = 7) {
  const grenze = new Date(bis);
  grenze.setDate(grenze.getDate() - tage);
  const zaehler = {};

  for (const session of sessions) {
    const datum = new Date(session.datum);
    if (datum < grenze || datum > bis) continue;
    for (const uebung of session.uebungen || []) {
      const harte = (uebung.saetze || []).filter((s) => Number(s.wiederholungen) > 0).length;
      if (!harte) continue;
      zaehler[uebung.schluessel] = (zaehler[uebung.schluessel] || 0) + harte;
    }
  }
  return zaehler;
}

/**
 * Wochenvolumen je **Muskelgruppe** – die Größe, auf die sich die Dosis-Wirkung
 * bezieht (Schoenfeld 2017). Pro Übung zu zählen führt in die Irre: Kniebeuge,
 * Hip Thrust und Kreuzheben treffen alle das Gesäß, jede einzeln sähe nach zu
 * wenig aus, zusammen können es zu viele sein.
 *
 * Hauptmuskeln zählen voll, deutlich mitarbeitende zur Hälfte.
 */
export function saetzeProMuskel(sessions = [], bis = new Date(), tage = 7) {
  const proUebung = saetzeProWoche(sessions, bis, tage);
  const proMuskel = {};

  for (const [schluessel, anzahl] of Object.entries(proUebung)) {
    const muskeln = UEBUNGEN[schluessel]?.muskeln || {};
    for (const [muskel, anteil] of Object.entries(muskeln)) {
      proMuskel[muskel] = round((proMuskel[muskel] || 0) + anzahl * anteil, 1);
    }
  }
  return proMuskel;
}

/**
 * Einordnung des Wochenvolumens je Muskelgruppe – in **beide** Richtungen.
 *
 * Vorher kannte die Anzeige nur „zu wenig": Der Balken war ab zehn Sätzen grün
 * und lief bei vierzehn voll aus. Dreißig Sätze Quadrizeps sahen damit exakt so
 * aus wie vierzehn – alles bestens. Für einen Sprinter ist das die falsche
 * Rückmeldung, weil die Ermüdung in denselben Muskeln landet, die zwei Tage
 * später schnell sein sollen.
 *
 * Verboten wird weiterhin nichts. Der obere Bereich heißt „viel", nicht
 * „zu viel", und die Begründung steht dabei.
 */
export function volumenBewertung(proMuskel = {}, sprintTage = 0) {
  const bewertet = {};

  for (const [muskel, saetze] of Object.entries(proMuskel)) {
    let stufe = 'wenig';
    let text = `Unter ${VOLUMEN.minimum} Sätzen. Für Aufbau ist das die untere Kante – `
      + 'für Erhalt reicht es.';

    if (saetze >= VOLUMEN.viel) {
      stufe = 'viel';
      text = `${VOLUMEN.viel} Sätze und mehr. Zusätzlicher Umfang bringt hier kaum noch etwas.`;
      // Nur bei den Muskelgruppen, die der Sprint ohnehin voll trifft. Bei
      // Brust oder Bizeps wäre derselbe Hinweis schlicht falsch.
      if (sprintTage > 0 && VOLUMEN.sprintbelastet.includes(muskel)) {
        text += ` Dazu kommt der Sprint an ${menge(sprintTage, 'Tag', 'Tagen')}, der hier nicht mitgezählt `
          + 'wird – die Ermüdung landet aber in derselben Muskulatur.';
      }
    } else if (saetze >= VOLUMEN.minimum) {
      stufe = 'gut';
      text = `Im Bereich, ab dem die Dosis-Wirkung deutlich wird (${VOLUMEN.minimum}+ Sätze).`;
    }

    bewertet[muskel] = {
      saetze,
      stufe,
      text,
      // Anteil für den Balken, damit die Oberfläche nicht selbst rechnet.
      anteil: Math.min(1, saetze / VOLUMEN.skalaBis),
      sprintbelastet: VOLUMEN.sprintbelastet.includes(muskel),
    };
  }

  return bewertet;
}

/**
 * Deckt die Woche die Bereiche ab, für die es belegte Schutzprogramme gibt?
 *
 * Das ist bewusst eine eigene Prüfung und nicht Teil der Volumenzählung:
 * Nordic Hamstring ersetzt kein Hamstring-Volumen, und Hamstring-Volumen
 * ersetzt keinen Nordic. Die Schutzwirkung hängt an der spezifischen Übung,
 * nicht an der Muskelgruppe.
 */
export function schutzabdeckung(sessions = [], bis = new Date(), tage = 7) {
  const proUebung = saetzeProWoche(sessions, bis, tage);
  const abdeckung = {};

  for (const [ziel, angabe] of Object.entries(SCHUTZZIELE)) {
    // Mehrere Übungen können auf dasselbe Ziel einzahlen (etwa stehendes und
    // sitzendes Wadenheben auf die Achillessehne).
    const beitragende = Object.entries(UEBUNGEN)
      .filter(([, u]) => u.schutz === ziel)
      .map(([k]) => k);
    const saetze = beitragende.reduce((s, k) => s + (proUebung[k] || 0), 0);

    abdeckung[ziel] = {
      ...angabe,
      saetze,
      erfuellt: saetze >= angabe.minSaetzeWoche,
      uebungen: beitragende.map((k) => UEBUNGEN[k].name),
    };
  }
  return abdeckung;
}

/**
 * Risikoprofil der protokollierten Woche: Wie viele Sätze entfielen auf
 * Übungen welcher Risikostufe? Nicht als Verbot gedacht – erhöhtes Risiko ist
 * bei guter Technik vertretbar. Aber wer es nicht sieht, kann es auch nicht
 * abwägen.
 */
export function risikoprofil(sessions = [], bis = new Date(), tage = 7) {
  const proUebung = saetzeProWoche(sessions, bis, tage);
  const profil = { niedrig: 0, mittel: 0, erhoeht: 0 };
  const auffaellig = [];

  for (const [schluessel, anzahl] of Object.entries(proUebung)) {
    const uebung = UEBUNGEN[schluessel];
    if (!uebung?.risiko) continue;
    profil[uebung.risiko] += anzahl;
    if (uebung.risiko === 'erhoeht' && uebung.sicherer) {
      auffaellig.push({
        schluessel,
        name: uebung.name,
        saetze: anzahl,
        notiz: uebung.risikoNotiz,
        alternative: UEBUNGEN[uebung.sicherer].name,
        alternativeSchluessel: uebung.sicherer,
      });
    }
  }

  const gesamt = profil.niedrig + profil.mittel + profil.erhoeht;
  return {
    ...profil,
    gesamt,
    anteilErhoeht: gesamt ? round(profil.erhoeht / gesamt, 2) : 0,
    auffaellig,
  };
}

export { clamp };
