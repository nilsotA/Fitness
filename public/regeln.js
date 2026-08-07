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
