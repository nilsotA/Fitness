// Regeln, die auf beiden Seiten gebraucht werden.
//
// Die Abbruchregel muss im Browser laufen, weil sie ihren Nutzen nur zwischen
// zwei Läufen entfaltet – ein Netzwerkaufruf pro Tastendruck wäre unbrauchbar.
// Gleichzeitig braucht der Server sie für die Auswertung im Nachhinein.
//
// Statt sie zu doppeln (und irgendwann auseinanderlaufen zu lassen) liegt sie
// hier: bewusst **ohne jeden Import**, damit der Browser die Datei direkt laden
// kann und die übrigen Kernmodule sie danebenliegend einbinden. Die
// Schwellenwerte kommen von außen herein, damit die Evidenzbasis trotzdem
// allein in `wissen.js` steht.

export function runden(wert, stellen = 0) {
  const f = 10 ** stellen;
  return Math.round(wert * f) / f;
}

/** Geschwindigkeit in m/s. Die Größe, um die es beim Sprint eigentlich geht. */
export function geschwindigkeit(distanz, sekunden) {
  const d = Number(distanz);
  const s = Number(sekunden);
  if (!d || !s) return null;
  return runden(d / s, 2);
}

/**
 * Läufe säubern. Ein Lauf ohne Zeit ist nicht gelaufen worden, und Zeiten
 * außerhalb jeder Plausibilität stammen aus Tippfehlern – beides fliegt raus,
 * bevor es die Tagesbestzeit verfälscht.
 */
export function pruefeLaeufe(roh) {
  if (!Array.isArray(roh)) return [];
  return roh
    .map((l) => ({
      distanz: Math.max(0, Math.round(Number(l.distanz) || 0)),
      sekunden: Number(l.sekunden) || 0,
      art: l.art === 'fliegend' ? 'fliegend' : 'beschleunigung',
    }))
    .filter((l) => l.distanz > 0 && l.sekunden > 0.5 && l.sekunden < 120);
}

/**
 * Bewertung eines einzelnen Laufs gegen die bisherige Tagesbestzeit derselben
 * Art und Distanz.
 *
 * Verglichen wird nur innerhalb der Gruppe: Eine fliegende 30 und eine 30 aus
 * dem Stand sind völlig verschiedene Zeiten. Miteinander verglichen ergäbe
 * jede gemischte Einheit einen Scheinabbruch.
 */
export function laufBewerten(laeufe, index, schwelle) {
  /*
   * `index` ist die **Zeile** im Dialog, nicht der Platz in der gesäuberten
   * Liste. Vorher stand hier `pruefeLaeufe(laeufe)[index]` – und weil
   * `pruefeLaeufe()` leere und unplausible Zeilen entfernt, verschob jede
   * ausgelassene Zeile alle Rückmeldungen danach um eins.
   *
   * Erreichbar ist das nicht am Rand, sondern mitten im Normalbetrieb: Zwei
   * Zeilen weiter fordert der Dialog ausdrücklich dazu auf („Leer lassen, was
   * du nicht gestoppt hast"), und ein Tippfehler wie „420" statt „4,20" tut
   * dasselbe. Gemessen mit [leer, 4,20, 4,24, 4,22, 4,45, 4,60] trug der
   * schnellste Lauf „1 % über der Tagesbestzeit", der 4,22er den Abfall des
   * 4,45ers, und der langsamste gar keine Rückmeldung. Das ist die Zeile, die
   * man **während** der Einheit liest und an der die Abbruchregel hängt.
   *
   * Gerechnet wird deshalb über den Präfix bis zu dieser Zeile: `pruefeLaeufe`
   * bleibt die einzige Stelle, die entscheidet, was ein Lauf ist (eine zweite
   * Fassung derselben Regel wäre Falle 13).
   */
  const roh = Array.isArray(laeufe) ? laeufe : [];
  if (!schwelle || !roh[index]) return null;
  // Eine leere oder unplausible Zeile hat keine Bewertung – und darf die der
  // folgenden nicht verschieben.
  if (pruefeLaeufe([roh[index]]).length !== 1) return null;

  const bisHier = pruefeLaeufe(roh.slice(0, index + 1));
  const aktuell = bisHier[bisHier.length - 1];

  const gleiche = bisHier
    .filter((l) => l.art === aktuell.art && l.distanz === aktuell.distanz);
  if (gleiche.length < 2) {
    return { stufe: 'erster', text: 'Erster Lauf dieser Art – setzt die Tagesbestzeit.' };
  }
  /*
   * „Vor drei Läufen ist keine Tagesbestzeit bestimmbar" – so steht es an
   * `minLaeufeFuerBewertung`, und die Auswertung hinterher hält sich daran.
   * Hier wurde schon ab dem zweiten Lauf geurteilt: Beim zweiten von zwei
   * 20-m-Läufen stand „3,9 % über der Tagesbestzeit. Die Qualität ist weg –
   * hier aufhören", und hinterher zählte dieselbe Einheit „8/8 Läufe in
   * Qualität". Zwei Fassungen derselben Regel (Falle 11, gefunden in
   * Falle 107). Wird der dritte Lauf schneller, war der zweite ohnehin
   * Anlauf und kein Abfall (Falle 25). Ein **schnellerer** zweiter Lauf ist
   * dagegen eine Auskunft und bleibt eine: „Neue Tagesbestzeit".
   */
  const beste = Math.min(...gleiche.map((l) => l.sekunden));
  const abfall = runden(((aktuell.sekunden - beste) / beste) * 100, 1);
  if (gleiche.length < schwelle.minLaeufeFuerBewertung && abfall >= schwelle.warnungProzent) {
    return {
      stufe: 'offen',
      abfall,
      text: 'Langsamer als der erste – aber vor dem dritten Lauf steht keine Tagesbestzeit '
        + 'fest, der erste ist oft nicht der schnellste.',
    };
  }

  /*
   * Der Abfall hat eine Nachkommastelle – und stand mit Punkt im Text:
   * „2.5 % über der Tagesbestzeit" in einer sonst durchweg deutschen
   * Oberfläche. Diese Sätze liest man **während** der Einheit, zwischen zwei
   * Läufen; sie sind die sichtbarste Ausgabe des ganzen Sprintmoduls.
   * Familie von Falle 56, das die Ausgabe in `leistung.js` und `plan.js`
   * gerichtet hat – `regeln.js` war dabei übersehen worden.
   */
  const abfallText = zahlText(abfall);

  if (abfall >= schwelle.abbruchProzent) {
    return {
      stufe: 'abbruch',
      abfall,
      text: `${abfallText} % über der Tagesbestzeit. Die Qualität ist weg – hier aufhören. `
        + 'Weitere Läufe trainieren Ermüdungsresistenz statt Schnelligkeit und '
        + 'erhöhen das Risiko, weil die Technik als Erstes leidet.',
    };
  }
  if (abfall >= schwelle.warnungProzent) {
    return {
      stufe: 'warnung',
      abfall,
      text: `${abfallText} % über der Tagesbestzeit. Noch im Bereich, aber die Pausen `
        + 'jetzt eher verlängern als verkürzen.',
    };
  }
  return {
    stufe: 'gut',
    abfall,
    text: abfall <= 0
      ? 'Neue Tagesbestzeit.'
      : `${abfallText} % über der Tagesbestzeit – voll im Qualitätsbereich.`,
  };
}

/* ------------------------------------------------------------- Ausdauer */

/** Geräte, für die Strecke sinnvoll ist. Beim Schwimmen zählt sie in Metern. */
export const GERAETE = {
  laufen: { name: 'Laufen', einheit: 'min/km', tempoArt: 'pace' },
  rad: { name: 'Rad', einheit: 'km/h', tempoArt: 'geschwindigkeit' },
  rudern: { name: 'Rudergerät', einheit: 'min/500 m', tempoArt: 'pace500' },
  crosstrainer: { name: 'Crosstrainer', einheit: 'km/h', tempoArt: 'geschwindigkeit' },
  schwimmen: { name: 'Schwimmen', einheit: 'min/100 m', tempoArt: 'pace100' },
};

/**
 * Strecke einer Einheit säubern. Nur was plausibel ist, wird gespeichert –
 * eine vertippte Null macht sonst jede Tempokurve unbrauchbar.
 */
export function pruefeStrecke(roh) {
  if (!roh) return null;
  const meter = Math.round(Number(roh.meter) || 0);
  if (meter <= 0 || meter > 300000) return null;
  return {
    meter,
    geraet: GERAETE[roh.geraet] ? roh.geraet : 'laufen',
  };
}

/**
 * Tempo in der Einheit, die zum Gerät passt.
 *
 * Beim Laufen denkt niemand in km/h, beim Radfahren niemand in min/km. Die
 * Zahl muss so aussehen, wie man sie im Kopf hat – sonst wird sie nicht
 * gelesen.
 */
export function tempo(meter, minuten, geraet = 'laufen') {
  const m = Number(meter);
  const min = Number(minuten);
  if (!m || !min) return null;

  const kmh = runden((m / 1000) / (min / 60), 1);
  const art = GERAETE[geraet]?.tempoArt || 'pace';

  if (art === 'geschwindigkeit') {
    return { wert: kmh, text: `${kmh.toString().replace('.', ',')} km/h`, kmh };
  }

  const proEinheit = { pace: 1000, pace500: 500, pace100: 100 }[art];
  const sekunden = (min * 60) / (m / proEinheit);
  const mm = Math.floor(sekunden / 60);
  const ss = Math.round(sekunden % 60);
  // Bei 59,6 s würde sonst „4:60" herauskommen.
  const korrigiert = ss === 60 ? { mm: mm + 1, ss: 0 } : { mm, ss };
  const label = { pace: '/km', pace500: '/500 m', pace100: '/100 m' }[art];

  return {
    wert: runden(sekunden, 1),
    text: `${korrigiert.mm}:${String(korrigiert.ss).padStart(2, '0')} ${label}`,
    kmh,
  };
}

/* -------------------------------------------------------------- Datum */

const zwei = (n) => String(n).padStart(2, '0');

/**
 * Heutiges Datum als `YYYY-MM-DD` in **Ortszeit**.
 *
 * Ausdrücklich nicht `toISOString()`: Das rechnet nach UTC um und liefert in
 * Deutschland zwischen Mitternacht und zwei Uhr morgens den **Vortag**. Wer um
 * halb eins nach einer späten Einheit protokolliert, hätte sie auf dem falschen
 * Tag – und käme über den Vorwärtsknopf nicht einmal zum richtigen, weil der
 * bei „heute" endet. Auch der Morgen-Check landete dann rückwirkend auf gestern.
 */
export function heute(jetzt = new Date()) {
  return `${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}`;
}

/**
 * Wochentag eines ISO-Datums, Montag = 0.
 *
 * Die drei Teile werden einzeln geparst, statt den String an `new Date()` zu
 * geben: Ein reines Datum gilt dort als *UTC*-Mitternacht. Westlich von
 * Greenwich liegt die noch im Vortag, `getDay()` gäbe den falschen Wochentag –
 * und der ganze Wochenplan verschöbe sich um einen Tag.
 */
export function wochentagIndex(iso) {
  const [jahr, monat, tag] = String(iso).split('-').map(Number);
  if (!jahr || !monat || !tag) return 0;
  return (new Date(jahr, monat - 1, tag).getDay() + 6) % 7;
}

/** Ein ISO-Datum um Tage verschieben, ohne Umweg über UTC. */
export function datumPlus(iso, tage) {
  const [jahr, monat, tag] = String(iso).split('-').map(Number);
  if (!jahr || !monat || !tag) return iso;
  const d = new Date(jahr, monat - 1, tag + Number(tage || 0));
  return heute(d);
}

/**
 * Der Kalendertag, den ein Stichtag meint, als `YYYY-MM-DD`.
 *
 * Die Kernfunktionen bekommen ihren Stichtag auf zwei Wegen: als
 * `new Date('2026-09-03')` aus `zustand()` – das ist **UTC**-Mitternacht
 * dieses Tages – oder als „jetzt", wenn niemand einen übergibt. Beides ist
 * ein `Date`, gemeint ist aber einmal der UTC-Tag und einmal der Tag in
 * Ortszeit. Unterschieden wird an der Uhrzeit: Genau Mitternacht UTC ist ein
 * geparstes Datum, alles andere ein Zeitpunkt in Ortszeit. Das ist in jeder
 * Zone eindeutig – ein in Ortszeit gebautes Datum (`new Date(2026, 8, 3)`)
 * liegt nur dort auf UTC-Mitternacht, wo Ortszeit und UTC ohnehin denselben
 * Tag haben.
 */
export function kalendertag(stichtag = new Date()) {
  if (typeof stichtag === 'string') return stichtag.slice(0, 10);
  const d = new Date(stichtag);
  const utcMitternacht = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
    && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return utcMitternacht ? d.toISOString().slice(0, 10) : heute(d);
}

/**
 * Prüfregel für ein rollendes Fenster: `tage` Kalendertage, die an `bis`
 * enden, `bis` eingeschlossen. Gibt eine Funktion zurück, die zu einem
 * Eintragsdatum sagt, ob es hineingehört.
 *
 * Alle Fenster des Kerns laufen hierüber, aus zwei teuer bezahlten Gründen:
 *
 * **Sieben Tage sind sieben Kalendertage** (Falle 94). Mit `>= grenze` statt
 * `> grenze` lagen der Stichtag und die sieben Tage davor im Fenster – acht.
 * Weil 7 und 28 Vielfache der Woche sind, fiel der Randtag auf denselben
 * Wochentag wie der Stichtag: Bei Wochenrhythmus zählte dieselbe Einheit
 * doppelt. Fünf Fenster, zwei Konventionen – daraus entstand der Fehler.
 *
 * **Gerechnet wird mit Kalendertagen, nie über `Date`** (Falle 100). Vorher
 * baute jedes Fenster seine Grenze aus `new Date(bis)` und `setDate()`: Das
 * erste ist UTC-Mitternacht, das zweite rechnet in Ortszeit. Über die
 * Umstellung auf Winterzeit verliert die Grenze eine Stunde, rutscht in
 * Berlin auf 23 Uhr UTC des Vortags, und der Tag auf der Grenze zählte
 * wieder mit; wer über `toISOString()` einzelne Tage abzählte, übersprang
 * den Umstellungstag ganz.
 */
export function fenster(bis, tage) {
  const ende = kalendertag(bis);
  const grenze = datumPlus(ende, -tage);
  return (datum) => {
    const tag = String(datum ?? '').slice(0, 10);
    return tag > grenze && tag <= ende;
  };
}

/** Kalendertage von `von` bis `bis`, beides ISO-Daten – ohne Sommerzeit dazwischen. */
export function tageZwischen(von, bis) {
  const tagNummer = (iso) => {
    const [jahr, monat, tag] = String(iso).slice(0, 10).split('-').map(Number);
    return Date.UTC(jahr, monat - 1, tag) / 86400000;
  };
  return tagNummer(bis) - tagNummer(von);
}

/* -------------------------------------------------------- Herzfrequenz */

/**
 * Das Alter, mit dem der Tracker überhaupt rechnet. Plausibilität, keine
 * Trainingslehre – die Pulsschätzung nimmt sie ebenso wie die Prüfung des
 * Geburtsjahrs im Profil, damit beide dasselbe für ein gültiges Alter halten.
 */
export const ALTER_GRENZEN = { min: 5, max: 120 };

/**
 * Geschätzte Maximalherzfrequenz aus dem Alter.
 *
 * Die Formel kommt von außen herein (Tanaka 2001 steht in `wissen.js`), damit
 * hier keine zweite Evidenzquelle entsteht. Zurück kommt bewusst auch die
 * Streuung: Eine Schätzung, die als exakte Zahl auftritt, wird wie eine Messung
 * behandelt – und an dieser Zahl hängen dann alle Zonengrenzen.
 */
export function hfMaxSchaetzung(alter, formel) {
  const a = Number(alter);
  if (!a || a < ALTER_GRENZEN.min || a > ALTER_GRENZEN.max || !formel) return null;
  return {
    hfMax: Math.round(formel.schaetzungBasis - formel.schaetzungFaktor * a),
    streuung: formel.schaetzungStreuung,
    gemessen: false,
  };
}

/**
 * Zonengrenzen in Schlägen pro Minute.
 *
 * Zurück kommen die **Untergrenzen** der beiden oberen Zonen: unterhalb
 * `grauzone` ist es locker, ab `hart` ist es hart.
 */
export function zonenGrenzen(hfMax, anteile) {
  const max = Number(hfMax);
  if (!max || !anteile) return null;
  return {
    grauzone: Math.round(max * anteile.grauzone),
    hart: Math.round(max * anteile.hart),
    hfMax: Math.round(max),
  };
}

/**
 * Zone aus dem Durchschnittspuls einer Einheit.
 *
 * Bewusst der Schnitt und nicht der Spitzenwert: Bei Intervallen liegt der
 * Spitzenwert immer im harten Bereich, auch wenn die Einheit zu zwei Dritteln
 * aus Trabpausen bestand. Der Schnitt ordnet die Gesamtbelastung richtiger ein
 * – und genau darum geht es bei der Verteilung.
 */
export function zoneAusHf(hf, grenzen) {
  const wert = Number(hf);
  if (!wert || !grenzen) return null;
  if (wert >= grenzen.hart) return 'hart';
  if (wert >= grenzen.grauzone) return 'grauzone';
  return 'locker';
}

/**
 * Zahl mit passender Ein- oder Mehrzahl – „1 Satz", „3 Sätze".
 *
 * Deutscher Text wird im Code gern aus Zahl plus Mehrzahlform zusammengesetzt,
 * und bei eins steht dann „1 Sätze" da. Das ist keine Kleinigkeit: Im
 * Wochenplan stand „aufgeteilt in 1 Sätze à 5" – und weil dort niemand die
 * Beugung prüfte, fiel auch nicht auf, dass die fünf gar nicht zu den vier
 * Läufen der Überschrift passten. Ein Grammatikfehler in erzeugtem Text ist
 * oft die sichtbare Spitze eines Rechenfehlers.
 *
 * Steht hier in `regeln.js`, weil beide Seiten ihn brauchen: Der Kern erzeugt
 * Empfehlungstexte, die Oberfläche Meldungen.
 */
export function menge(anzahl, einzahl, mehrzahl) {
  const n = Number(anzahl);
  return `${anzahl} ${n === 1 ? einzahl : mehrzahl}`;
}

/**
 * Eine Zahl aus einer Eingabe lesen – deutsch geschrieben.
 *
 * `Number('78,3')` ist NaN, und im Code stand überall `Number(x) || 0`. Aus
 * „162,5 kcal" wurden damit stillschweigend **0 kcal**, aus „62,5 min" null
 * Minuten und damit eine Einheit ohne Belastung. Kein Fehler, keine Meldung –
 * der Eintrag stand nur falsch im Tagebuch.
 *
 * In einer deutschen App liegt das Komma auf der Tastatur; es ist die
 * erwartete Schreibweise und keine Fehleingabe. Punkte in Dreiergruppen
 * („1.200") sind Tausendertrenner – ohne diese Ausnahme würde daraus 1,2.
 *
 * Rückgabe ist `null`, wenn nichts Lesbares dasteht. Was der Aufrufer daraus
 * macht – Vorgabewert oder Fehlermeldung –, entscheidet er selbst; stillschweigend
 * eine Null einzusetzen ist jedenfalls keine gute Antwort auf „unlesbar".
 */
/**
 * Eine Zahl für deutschen Fließtext – die Gegenrichtung zu `zahlAusEingabe()`.
 *
 * Der Kern baut Sätze, die unverändert am Gerät landen: „Zurück auf 87.5 kg"
 * stand so in einer sonst durchweg deutschen Oberfläche, und „Körpergewicht
 * bis + 7.5 kg" ebenso. Die Oberfläche hat mit `zahl()` längst einen
 * Formatierer – der Kern darf ihn nicht importieren (er kennt `app/` nicht),
 * also steht die Umkehrung dort, wo auch das Einlesen steht.
 *
 * Nachkommastellen nur, wo es welche gibt: Hantelschritte sind halbe Kilo,
 * „90,0 kg" wäre eine Genauigkeit, die niemand gemeint hat.
 */
export function zahlText(wert, maxStellen = 1) {
  const n = Number(wert);
  if (wert == null || Number.isNaN(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: maxStellen });
}

export function zahlAusEingabe(wert) {
  if (wert == null || wert === '') return null;
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null;

  let text = String(wert).trim().replace(/\s/g, '');
  if (!text) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '');
  text = text.replace(',', '.');

  const zahl = Number(text);
  return Number.isFinite(zahl) ? zahl : null;
}
