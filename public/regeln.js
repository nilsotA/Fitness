// Regeln, die auf beiden Seiten gebraucht werden.
//
// Die Abbruchregel muss im Browser laufen, weil sie ihren Nutzen nur zwischen
// zwei Läufen entfaltet – ein Netzwerkaufruf pro Tastendruck wäre unbrauchbar.
// Gleichzeitig braucht der Server sie für die Auswertung im Nachhinein.
//
// Statt sie zu doppeln (und irgendwann auseinanderlaufen zu lassen) liegt sie
// hier: bewusst **ohne jeden Import**, damit der Browser die Datei direkt laden
// kann und `server/sprint.js` sie mit `../public/regeln.js` einbindet. Die
// Schwellenwerte kommen von außen herein, damit die Evidenzbasis trotzdem
// allein in `server/wissen.js` steht.

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
  const sauber = pruefeLaeufe(laeufe);
  const aktuell = sauber[index];
  if (!aktuell || !schwelle) return null;

  const gleiche = sauber
    .slice(0, index + 1)
    .filter((l) => l.art === aktuell.art && l.distanz === aktuell.distanz);
  if (gleiche.length < 2) {
    return { stufe: 'erster', text: 'Erster Lauf dieser Art – setzt die Tagesbestzeit.' };
  }

  const beste = Math.min(...gleiche.map((l) => l.sekunden));
  const abfall = runden(((aktuell.sekunden - beste) / beste) * 100, 1);

  if (abfall >= schwelle.abbruchProzent) {
    return {
      stufe: 'abbruch',
      abfall,
      text: `${abfall} % über der Tagesbestzeit. Die Qualität ist weg – hier aufhören. `
        + 'Weitere Läufe trainieren Ermüdungsresistenz statt Schnelligkeit und '
        + 'erhöhen das Risiko, weil die Technik als Erstes leidet.',
    };
  }
  if (abfall >= schwelle.warnungProzent) {
    return {
      stufe: 'warnung',
      abfall,
      text: `${abfall} % über der Tagesbestzeit. Noch im Bereich, aber die Pausen `
        + 'jetzt eher verlängern als verkürzen.',
    };
  }
  return {
    stufe: 'gut',
    abfall,
    text: abfall <= 0
      ? 'Neue Tagesbestzeit.'
      : `${abfall} % über der Tagesbestzeit – voll im Qualitätsbereich.`,
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

/* -------------------------------------------------------- Herzfrequenz */

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
  if (!a || a < 5 || a > 120 || !formel) return null;
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
