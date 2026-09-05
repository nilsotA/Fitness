// Fortschritt: Leistungstests, Kraftmarken, der Weg zum Muscle-Up, Belastungsverlauf.

import {
  el, karte, kennzahl, balken, hinweis, feld, dialog, dialogSchliessen, linienDiagramm,
  saetzeStand, tabelle, menge,
  toast, zahl, datumLang, heute,
  dezimalFeld,
} from './common.js';
import * as daten from './daten.js';
import { aktualisieren, zuAnsicht } from './app.js';
import { EPLEY, UEBUNGEN, KRAFTMARKEN, SPRINT, VOLUMEN, ANTEIL, COOPER } from '../kern/wissen.js';
import { kraftEinordnung } from '../kern/profil.js';
import { zahlText } from '../kern/regeln.js';
// Beide Aufschriften wurden hier nachgebaut, obwohl es sie im Kern gibt –
// und die Kopien waren bereits abgewichen. Siehe Falle 21.
import { verlaufName } from '../kern/ausdauer.js';
import { gruppenName } from '../kern/sprint.js';

/** Was getestet wird und wie es zu lesen ist. */
const TESTS = {
  sprint30: { name: '30 m Sprint', einheit: 's', besser: 'kleiner', hilfe: 'Fliegend oder aus dem Stand – Hauptsache immer gleich messen.' },
  sprint10: { name: '10 m Sprint', einheit: 's', besser: 'kleiner', hilfe: 'Beschleunigung aus dem Stand.' },
  standweitsprung: { name: 'Standweitsprung', einheit: 'cm', besser: 'groesser', hilfe: 'Beidbeinig, aus dem Stand. Guter Ersatz für eine Kraftmessplatte.' },
  klimmzuege: { name: 'Klimmzüge max.', einheit: 'Wdh.', besser: 'groesser', hilfe: 'Ohne Schwung, voll ausgestreckt starten.' },
  liegestuetze: { name: 'Liegestütze max.', einheit: 'Wdh.', besser: 'groesser', hilfe: 'Brust bis auf Fausthöhe, Körper in einer Linie.' },
  muscleups: { name: 'Muscle-Ups max.', einheit: 'Wdh.', besser: 'groesser', hilfe: 'Am Stück, ohne Absetzen.' },
  klimmzugZusatzlast: { name: 'Klimmzug Zusatzlast', einheit: 'kg', besser: 'groesser', hilfe: 'Schwerste saubere Einzelwiederholung mit Zusatzgewicht.' },
  kniebeuge: { name: 'Kniebeuge', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen – daraus wird das Einer-Maximum geschätzt.', mitWdh: true },
  kreuzheben: { name: 'Kreuzheben', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen.', mitWdh: true },
  bankdruecken: { name: 'Bankdrücken', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen.', mitWdh: true },
  hipthrust: { name: 'Hip Thrust', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen.', mitWdh: true },
  cooper: { name: 'Cooper-Test', einheit: 'm', besser: 'groesser', hilfe: '12 Minuten so weit wie möglich. Daraus schätzt der Tracker die VO2max.' },
};

/**
 * Womit eine zählbare Muscle-Up-Stufe gemessen wird.
 *
 * `pruefung` in `wissen.js` benennt die Prüfart, `TESTS` oben die Testart –
 * für die Zusatzlast heißen die beiden verschieden. Die Zuordnung steht hier
 * und nicht als zweite Namensliste daneben.
 */
const TESTART = { klimmzuege: 'klimmzuege', muscleups: 'muscleups', zusatzlast: 'klimmzugZusatzlast' };

/** Misst diese Testart Wiederholungen statt Kilogramm? Siehe Falle 4. */
const istWdhTest = (art) => Object.values(UEBUNGEN).some((u) => u.wdhTest === art);

let testDaten = null;

export function fortschrittAnsicht(d) {
  const box = el('div', {});
  box.append(el('h1', {}, 'Fortschritt'));

  box.append(sprintKarte(d));
  box.append(ausdauerKarte(d));
  box.append(muscleupKarte(d));
  box.append(volumenKarte(d));
  box.append(schutzKarte(d));
  box.append(kraftKarte(d));
  box.append(belastungKarte(d));
  box.append(gewichtKarte(d));
  box.append(testKarte(d));

  return box;
}

/* ------------------------------------------------------------ Muscle-Up */

function muscleupKarte(d) {
  const m = d.muscleup;
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Weg zum Muscle-Up'),
      el('span', { class: 'mini' }, `Stufe ${m.erreicht} von ${m.gesamt}`)));

  box.append(el('div', { class: 'balken' },
    el('div', {
      class: 'balken-fuellung',
      style: { width: `${m.fortschrittProzent}%`, background: 'var(--sprint)' },
    })));

  if (m.naechste) {
    box.append(el('p', { class: 'klein' },
      `Als Nächstes: ${m.naechste.name} – ${m.naechste.tor}`));
  } else {
    box.append(hinweis('Alle Stufen erreicht. Jetzt geht es um Wiederholungszahl und Sauberkeit.', 'gut'));
  }

  const stufen = el('div', { style: { marginTop: '0.7rem' } });
  for (const s of m.stufen) {
    const zeile = el('div', {
      class: `stufe ${s.erreicht ? 'erreicht' : ''} ${s.aktuell ? 'aktuell' : ''}`
        + `${s.vorgemerkt ? ' vorgemerkt' : ''}`,
    },
    el('div', { class: 'stufe-nummer' }, s.erreicht ? '✓' : s.stufe),
    el('div', { class: 'stufe-text' },
      el('div', { class: 'stufe-name' }, s.name),
      el('div', { class: 'stufe-tor' }, s.tor),
      // Warum an dieser Zeile kein Knopf steht. Ohne den Satz sah die Spalte
      // aus, als fehle bei Stufe 3 und 8 einer – ein Loch mitten in einer
      // Reihe gleicher Bedienelemente liest sich als Fehler, nicht als Regel.
      s.pruefung !== 'manuell'
        ? el('div', { class: 'mini' },
          `Ergibt sich aus deinem Test „${TESTS[TESTART[s.pruefung]]?.name || s.pruefung}".`)
        : null,
      // Und was ein Tipp bewirkt hat, der den Stand noch nicht bewegt.
      s.vorgemerkt
        ? el('div', { class: 'mini' },
          'Von dir bestätigt – zählt, sobald die Stufen davor stehen.')
        : null));

    // Stufen ohne messbaren Test bestätigt man selbst – sonst bliebe der Weg
    // an Stufe 4 hängen, obwohl sie längst steht.
    if (s.pruefung === 'manuell') {
      zeile.append(el('button', {
        class: 'knopf leise',
        onclick: async () => {
          try {
            await daten.muscleupSpeichern({
              stufe: s.stufe,
              // Zurücknehmen heißt: erreicht *oder* vorgemerkt wieder lösen.
              erreicht: !(s.erreicht || s.vorgemerkt),
            });
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, s.erreicht || s.vorgemerkt ? 'zurück' : 'geschafft'));
    }
    stufen.append(zeile);
  }
  box.append(stufen);

  box.append(el('p', { class: 'mini', style: { marginTop: '0.6rem' } },
    'Die Stufen bauen aufeinander auf: Ohne Zugkraft über die Stange hinaus gibt es keinen '
    + 'Übergang, und ohne Dip-Kraft keinen Ausstoß. Überspringen führt zu Schwung statt Kraft – '
    + 'und Schwung belastet die Schulter, ohne den Muscle-Up näher zu bringen. Die Marke von '
    // Die Zahl steht als Ziel an der Stufe selbst. Gelesen wird sie aus
    // `m.stufen` und nicht aus MUSCLEUP_STUFEN: Diese Ansicht hat die Stufen
    // schon einmal selbst hergeleitet, und genau das wurde in Falle 45
    // abgeräumt.
    + `+${Math.round((m.stufen.find((st) => st.pruefung === 'zusatzlast')?.ziel || 0) * 100)} % `
    + 'Zusatzlast ist Trainerpraxis, keine Studienlage.'));

  return box;
}

/* ------------------------------------------------------------ Ausdauer */

/**
 * Die Frage, an der Ausdauertraining am häufigsten scheitert: Sind die lockeren
 * Einheiten wirklich locker? Gezählt werden Minuten, nicht Einheiten – eine
 * 90-minütige Runde und ein 20-minütiges Intervall sind nicht dasselbe
 * „eine Einheit", und genau diese Verwechslung lässt Pläne polarisiert
 * aussehen, die es nicht sind.
 */
function ausdauerKarte(d) {
  const a = d.ausdauer;
  const box = karte(el('h2', {}, 'Ausdauer'));
  if (!a) return box;

  const km = Object.entries(a.wochenstrecke || {});
  if (km.length) {
    box.append(el('div', { class: 'kennzahlen', style: { marginBottom: '0.8rem' } },
      ...km.map(([geraet, wert]) => kennzahl(
        `${zahl(wert, 1)} km`,
        a.geraete?.[geraet]?.name || geraet,
        'letzte 7 Tage'))));
  }

  const v = a.verteilung;
  box.append(el('h3', {}, `Intensitätsverteilung · ${v?.tage || 28} Tage`));

  if (!v?.bewertbar) {
    box.append(el('p', { class: 'klein' }, v?.hinweis
      || 'Noch keine Ausdauereinheiten protokolliert.'));
  } else {
    // Ein Balken über die volle Breite zeigt die Verteilung besser als drei
    // Zahlen – man sieht sofort, wie viel in der Mitte hängt.
    box.append(el('div', { class: 'zonen-balken' },
      ...['locker', 'grauzone', 'hart'].map((zone) => el('div', {
        class: `zone-teil ${zone}`,
        style: { width: `${(v.anteil[zone] || 0) * 100}%` },
        title: `${a.zonen[zone].name}: ${Math.round(v.anteil[zone] * 100)} %`,
      }, v.anteil[zone] > 0.12 ? `${Math.round(v.anteil[zone] * 100)} %` : ''))));

    box.append(el('div', { class: 'zonen-legende' },
      ...['locker', 'grauzone', 'hart'].map((zone) => el('span', {},
        el('span', { class: `zone-punkt ${zone}` }),
        `${a.zonen[zone].name} ${Math.round((v.anteil[zone] || 0) * 100)} %`))));

    box.append(hinweis(v.text,
      v.stufe === 'kritisch' ? 'gefahr' : v.stufe === 'warnung' ? 'warnung' : 'gut'));

    // Das 80/20-Ziel steht nur da, wo es auch gilt. Bei zwei bis vier
    // Ausdauereinheiten in der Woche ist es nicht erreichbar – siehe
    // minMinutenProWocheFuerVerhaeltnis. Eine Zielzahl, an der man
    // zwangsläufig scheitert, liest sich wie ein dauerhafter Mangel.
    box.append(el('p', { class: 'mini' },
      (v.verhaeltnisBewertet
        ? `Ziel: rund ${Math.round(v.ziel.locker * 100)} % locker und `
          + `${Math.round(v.ziel.hart * 100)} % hart, die Grauzone möglichst leer. `
        : 'Ziel bei diesem Umfang: die Grauzone möglichst leer. ')
      + `Über die gefühlte Anstrengung: bis RPE ${a.zonen.locker.rpeBis} locker, `
      + `${a.zonen.grauzone.rpeVon}–${a.zonen.grauzone.rpeBis} Grauzone, `
      + `ab ${a.zonen.hart.rpeVon} hart. ${a.zonen.locker.kennzeichen}`
      + (a.pulszonen
        ? ` Über den Puls: locker unter ${a.pulszonen.grauzone}, hart ab ${a.pulszonen.hart} bpm.`
        : '')));

    // Die Ampel oben sieht nach Messung aus. Der Vorbehalt kommt aus dem Kern,
    // damit er dort steht, wo die Schwellen stehen – nicht als zweite
    // Formulierung daneben.
    if (v.vorbehalt) box.append(el('p', { class: 'mini' }, v.vorbehalt));

    // Woher die Einteilung kommt, gehört unter die Verteilung – eine halb
    // gemessene und eine durchgemessene Verteilung sind nicht gleich belastbar.
    if (v.quelleText) {
      box.append(el('p', { class: 'mini' },
        v.quelleText
        + (v.quellen?.hf && a.pulszonen && !a.pulszonen.gemessen
          ? ' Der Maximalpuls ist geschätzt – die Pulszonen sind damit nicht '
            + 'zuverlässiger als dein Gefühl.'
          : '')));
    }
  }

  // Tempoverlauf je Gerät und Zone.
  const verlauf = Object.entries(a.tempo || {}).filter(([, l]) => l.length >= 2);
  for (const [schluessel, liste] of verlauf) {
    const [, zone] = schluessel.split('-');
    // Die Überschrift baut `verlaufName()` aus dem Kern. Hier stand dieselbe
    // Zeile noch einmal – und war schon auseinandergelaufen: Eine Einheit ohne
    // Puls und ohne brauchbares RPE bekommt den Schlüssel `rad-unbekannt`, und
    // weil `AUSDAUER_ZONEN` dafür keinen Eintrag hat, stand als Überschrift
    // wörtlich „Rad · unbekannt" – ein interner Schlüssel als deutsche
    // Aufschrift. Die Kernfunktion sagt „ohne Zone" und rief niemand auf.
    box.append(el('h3', { style: { marginTop: '0.9rem' } }, verlaufName(schluessel)));
    if (!a.zonen?.[zone]) {
      // Nicht kommentarlos: Wer „ohne Zone" liest, soll wissen, woran es liegt
      // und was hilft.
      box.append(el('div', { class: 'mini' },
        'Diesen Einheiten fehlt Puls und ein brauchbares RPE – ohne beides ist keine '
        + 'Intensitätszone bestimmbar. Sie zählen deshalb auch nicht in die Verteilung oben.'));
    }
    // Aufgetragen wird km/h, damit die Kurve für alle Geräte gleich zu lesen ist
    // (nach oben ist schneller). Die Beschriftung bleibt in der Einheit des Geräts.
    //
    // Gewertet wird nur, wo schneller auch besser heißt: In der harten Zone
    // ja. In der lockeren **nicht** – dort ist ein steigendes Tempo eher ein
    // Zeichen, dass die Einheit nicht mehr locker war, und genau davor warnt
    // dieselbe Ansicht ein paar Zeilen weiter oben. Über einer lockeren
    // Tempokurve stand trotzdem „besser geworden". Familie von Falle 7, und
    // ausgerechnet an der Kurve, die dort schon als Beispiel steht – gelöst
    // war bisher nur die Richtungsbestimmung, nicht die Frage, ob eine
    // Richtung überhaupt gut sein kann. Die Grauzone bleibt ebenfalls
    // ungewertet: Sie soll gar nicht erst vorkommen.
    box.append(linienDiagramm(liste.map((p) => ({ wert: p.kmh })), {
      farbe: 'var(--ausdauer)', hoehe: 60, einheit: ' km/h', wertung: zone === 'hart',
    }));
    const letzte = liste[liste.length - 1];
    box.append(el('div', { class: 'mini' },
      `Zuletzt ${zahl(letzte.meter / 1000, 1)} km in ${letzte.minuten} min = ${letzte.tempo} `
      + `(${datumLang(letzte.datum)})`));
  }

  return box;
}

/* --------------------------------------------------------- Sprintzeiten */

/**
 * Die eigentliche Schnelligkeitskurve: Sie entsteht aus jeder Sprinteinheit,
 * nicht nur aus den vier bis sechs Tests im Jahr. Dazu die Auswertung der
 * letzten Einheit – die Frage „war das noch Qualität?" interessiert direkt
 * danach, nicht erst beim nächsten Test.
 */
function sprintKarte(d) {
  const s = d.sprint;
  const box = karte(el('h2', {}, 'Sprintzeiten'));

  const verlauf = s?.verlauf || {};
  const gruppen = Object.entries(verlauf).filter(([, liste]) => liste.length);

  if (!gruppen.length) {
    box.append(el('p', { class: 'klein' },
      'Noch keine Zeiten erfasst. Im Protokoll einer Sprinteinheit trägst du sie Lauf für '
      + 'Lauf ein – der Tracker sagt dir dabei sofort, ab wann die Qualität weg ist. '
      + 'Die Zeit ist das direkteste Signal, das es im Sprinttraining gibt.'));
    return box;
  }

  for (const [schluessel, liste] of gruppen) {
    const best = d.sprint?.bestzeiten?.[schluessel];
    // Aus `gruppenName()` im Kern statt hier noch einmal zusammengesetzt –
    // dieselbe Zeile stand an drei Stellen in dieser Datei.
    box.append(el('h3', { style: { marginTop: '0.8rem' } }, gruppenName(schluessel)));

    // Die Bestzeit vor die Kurve: Sie ist die Zahl, wegen der ein Sprinter
    // überhaupt mitschreibt – und sie ordnet die letzte Einheit ein. An einem
    // müden Tag sieht die Kurve nach Rückschritt aus, obwohl der Rekord steht.
    if (best) {
      box.append(el('div', { class: 'kennzahlen' },
        kennzahl(`${zahl(best.sekunden, 2)} s`, 'Bestzeit',
          `${zahl(best.tempo, 2)} m/s · ${datumLang(best.datum)}`, 'var(--sprint)'),
        kennzahl(`${zahl(best.letzte.sekunden, 2)} s`, 'Zuletzt',
          best.istAktuell ? 'neue Bestzeit'
            : best.egalisiert ? `Bestzeit egalisiert · ${datumLang(best.letzte.datum)}`
            : `${zahl(best.abstandProzent, 1)} % darüber · ${datumLang(best.letzte.datum)}`,
          best.istAktuell || best.egalisiert ? 'var(--ausdauer)' : null)));
    }

    box.append(linienDiagramm(liste.map((p) => ({ wert: p.sekunden })), {
      farbe: 'var(--sprint)', hoehe: 60, einheit: ' s', kleinerIstBesser: true,
    }));
  }

  // Auswertung der letzten Einheit.
  const a = s?.letzte;
  if (a?.bewertbar) {
    box.append(el('h3', { style: { marginTop: '1rem' } },
      `Letzte Einheit · ${datumLang(a.datum)}`));
    box.append(el('div', { class: 'kennzahlen' },
      kennzahl(`${a.gesamt - a.ueberschuss}/${a.gesamt}`, 'Läufe in Qualität', null,
        a.ueberschuss ? 'var(--warn)' : 'var(--ausdauer)'),
      kennzahl(`${zahl(a.qualitaetsmeter)} m`, 'Qualitätsmeter', `von ${zahl(a.meter)} m gesamt`)));
    box.append(hinweis(a.text, a.ueberschuss ? 'warnung' : 'gut'));

    /*
     * Einzelne Läufe der letzten Einheit – zeigt, wo genau der Abfall einsetzte.
     *
     * Im Punkt steht die **Zeit**, nicht die laufende Nummer. Vorher trug er
     * die Nummer, und die eigentliche Zahl – die selbst gestoppte Zeit und der
     * Rückstand – existierte ausschließlich als `title`. Auf einem Touchgerät
     * gibt es kein Hover: Das Tooltip erscheint nie, und einen zweiten Weg zu
     * den Zahlen gab es nicht, weil eine protokollierte Einheit sich nicht
     * wieder öffnen lässt. Die Nummer ergibt sich aus der Position; die Zeit
     * ergibt sich aus nichts.
     */
    for (const g of a.gruppen) {
      const zeilen = g.laeufe.map((l, i) => el('span', {
        class: `lauf-punkt ${l.stufe}`,
        title: `Lauf ${i + 1}: ${zahl(l.sekunden, 2)} s (+${zahl(l.abfall, 1)} %)`,
      }, zahl(l.sekunden, 2)));
      box.append(el('div', { style: { marginTop: '0.5rem' } },
        el('div', { class: 'mini' },
          `${gruppenName(`${g.art}-${g.distanz}`)} · beste ${zahl(g.besteZeit, 2)} s`),
        el('div', { class: 'lauf-reihe' }, ...zeilen)));
    }
    box.append(el('p', { class: 'mini', style: { marginTop: '0.5rem' } },
      `Grün: im Bereich. Gelb: ab ${s.schwelle.warnungProzent} % über der Tagesbestzeit. `
      + `Rot: ab ${s.schwelle.abbruchProzent} % – dort ist Schnelligkeitstraining zu Ende. `
      // Grau muss dazu, sonst sucht man den Fehler bei sich: Der erste Lauf
      // ist oft langsamer, und das ist kein Qualitätsverlust.
      + 'Grau: langsamer, aber noch vor der Tagesbestzeit gelaufen – Anlauf, keine Ermüdung. '
      + 'Die Schwelle ist Trainerkonsens, keine Studienlage; sie folgt aber aus der '
      + `Forderung nach ≥${SPRINT.intensitaetProzent.beschleunigung} % der Maximalgeschwindigkeit.`));
  }

  return box;
}

/* ------------------------------------------------------- Wochenvolumen */

/**
 * Harte Sätze je Muskelgruppe in den letzten sieben Tagen. Die Dosis-Wirkung
 * aus der Literatur bezieht sich auf Muskelgruppen, nicht auf Übungen –
 * Kniebeuge, Hip Thrust und Kreuzheben treffen alle das Gesäß, und einzeln
 * gezählt sähe jede nach zu wenig aus.
 */
function volumenKarte(d) {
  const proMuskel = d.leistung?.saetzeProMuskel || {};
  const namen = d.leistung?.muskelgruppen || {};
  const eintraege = Object.entries(proMuskel).sort((a, b) => b[1] - a[1]);

  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Sätze je Muskelgruppe'),
      el('span', { class: 'mini' }, 'letzte 7 Tage')));

  if (!eintraege.length) {
    box.append(el('p', { class: 'klein' },
      'Noch keine Sätze protokolliert. Sobald du im Trainingsprotokoll Sätze einträgst, '
      + 'steht hier, wie viel Umfang jede Muskelgruppe tatsächlich bekommen hat – '
      + 'die Zahl, an der sich Muskelaufbau entscheidet.'));
    return box;
  }

  const bewertung = d.leistung?.volumen || {};
  const FARBE = { wenig: 'var(--warn)', gut: 'var(--ausdauer)', viel: 'var(--warn)' };

  for (const [muskel, anzahl] of eintraege) {
    const b = bewertung[muskel];
    box.append(el('div', { class: 'makro-zeile' },
      el('div', { class: 'makro-kopf' },
        el('span', { class: 'makro-name' }, namen[muskel] || muskel),
        el('span', { class: 'makro-zahl' }, `${zahl(anzahl, anzahl % 1 ? 1 : 0)}`)),
      balken((b?.anteil ?? 0) * 100, FARBE[b?.stufe] || 'var(--warn)')));
  }

  // Die Muskelgruppen im oberen Bereich einzeln benennen – ein gelber Balken
  // allein sagt nicht, ob es zu wenig oder viel ist.
  const vieleGruppen = eintraege
    .filter(([m]) => bewertung[m]?.stufe === 'viel')
    .map(([m]) => m);
  if (vieleGruppen.length) {
    box.append(hinweis(
      `${vieleGruppen.map((m) => namen[m] || m).join(', ')}: `
      + bewertung[vieleGruppen[0]].text, 'warnung'));
  }

  // Die drei Zahlen dieses Absatzes standen als Wörter da – „zehn",
  // „zwanzig", „zur Hälfte" – und waren damit von den Konstanten abgekoppelt,
  // die sie beschreiben. Wer VOLUMEN.minimum auf 12 setzt, färbt den Balken
  // ab 12 grün, und der Satz darunter behauptet weiter 10. `zahlen.mjs` kann
  // das grundsätzlich nicht sehen: Es sucht Ziffern.
  box.append(el('p', { class: 'mini' },
    `Grün ab ${VOLUMEN.minimum} Sätzen pro Woche – die Marke, ab der die Dosis-Wirkung in `
    + `Metaanalysen deutlich wird (Schoenfeld 2017). Nach oben ist die Studienlage dünner; ab `
    + `${VOLUMEN.viel} Sätzen weist der Tracker darauf hin, verbietet aber nichts. `
    + `Hauptmuskeln einer Übung zählen voll, deutlich mitarbeitende zu `
    + `${zahlText(ANTEIL.mit * 100)} %. Diese Halbierung ist gängige Praxis, keine `
    + 'Messgröße.'));

  return box;
}

/* --------------------------------------------------- Verletzungsschutz */

/**
 * Die vier Bereiche, für die es eigene, gezielt untersuchte Schutzprogramme
 * gibt. Bewusst getrennt vom Volumen: Nordic Hamstring ersetzt kein
 * Hamstring-Volumen, und Hamstring-Volumen ersetzt keinen Nordic. Die
 * Schutzwirkung hängt an der spezifischen Übung, nicht an der Muskelgruppe.
 */
function schutzKarte(d) {
  const schutz = d.leistung?.schutz || {};
  const risiko = d.leistung?.risiko;
  const eintraege = Object.entries(schutz);

  /*
   * Ohne einen einzigen protokollierten Satz ist nichts „offen" – da fehlt
   * das Training, nicht die Prophylaxe. Vier rote Ausrufezeichen beim ersten
   * Öffnen sind genau die Warnung, an die man sich gewöhnt, und die Karte
   * direkt darüber sagt zum selben Sachverhalt „Noch keine Sätze
   * protokolliert" (Falle 22, Familie Falle 70).
   *
   * Wer trainiert und die Prophylaxe weglässt, bekommt „4 offen" weiterhin –
   * dann ist es eine Aussage über das Training und keine über den
   * Leerzustand. Erkannt am selben Signal, das die Volumenkarte benutzt.
   */
  const ohneSaetze = !Object.keys(d.leistung?.saetzeProMuskel || {}).length;
  const offen = eintraege.filter(([, z]) => !z.erfuellt).length;
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Verletzungsschutz'),
      el('span', { class: 'mini' },
        ohneSaetze ? 'noch nichts protokolliert' : offen ? `${offen} offen` : 'vollständig')));

  box.append(el('p', { class: 'klein' },
    'Krafttraining allein senkt akute Sportverletzungen auf unter ein Drittel und '
    + 'Überlastungsschäden um fast die Hälfte (Lauersen 2014). Diese vier Bereiche haben '
    + 'darüber hinaus eigene Programme mit eigener Studienlage.'));

  for (const [ziel, z] of eintraege) {
    // Ohne protokollierte Sätze bleibt die Zeile neutral: kein Rot, kein
    // Ausrufezeichen. Sonst stünde über vier grauen Zeilen „noch nichts
    // protokolliert" und daneben viermal Alarm.
    const zeile = el('div', { class: `stufe ${ohneSaetze ? '' : z.erfuellt ? 'erreicht' : 'aktuell'}` },
      el('div', { class: 'stufe-nummer' }, ohneSaetze ? '·' : z.erfuellt ? '✓' : '!'),
      el('div', { class: 'stufe-text' },
        el('div', { class: 'stufe-name' },
          z.name,
          // Der Vorbehalt steht auch am Zahlenschild selbst. Wer nur überfliegt,
          // liest sonst „−51 % Risiko" und nie den Absatz darunter.
          z.reduktion ? el('span', { class: 'mini' },
            `  −${Math.round(z.reduktion * 100)} % Risiko${z.quelleVorbehalt ? ' (umstritten)' : ''}`) : null),
        el('div', { class: 'stufe-tor' },
          `${saetzeStand(z.saetze, z.minSaetzeWoche)} · ${z.uebungen.join(' oder ')}`)),
    );
    box.append(zeile);
    box.append(el('p', { class: 'mini', style: { margin: '0 0 0.6rem 2.1rem' } }, z.warum));

    // Wo eine Schutzzahl bestritten ist, steht der Einwand direkt darunter –
    // nicht nur in der Wissensansicht, die man beim Trainieren nicht aufmacht.
    // Datengetrieben statt für die Hamstrings gesondert eingebaut: Sobald eine
    // andere Zahl einen Vorbehalt bekommt, erscheint er von allein.
    if (z.quelleVorbehalt) {
      const v = daten.wissen().quellen[z.quelleVorbehalt];
      if (v) {
        box.append(el('p', {
          class: 'mini',
          style: { margin: '-0.3rem 0 0.8rem 2.1rem', borderLeft: '2px solid var(--warn)', paddingLeft: '0.5rem' },
        }, `Umstritten: ${v.kern} (${v.kurz})`));
      }
    }
  }

  if (risiko?.auffaellig?.length) {
    for (const a of risiko.auffaellig) {
      box.append(hinweis(
        `${a.name} (${menge(a.saetze, 'Satz', 'Sätze')}): ${a.notiz} `
        + `Verträglichere Variante: ${a.alternative}.`,
        'warnung'));
    }
  } else if (risiko?.gesamt) {
    // Bei genau einem Satz stand hier „Alle 1 protokollierten Sätze … entfielen"
    // – Falle 12, und die Lösung stand vier Zeilen darüber (`menge()`). Sie
    // reicht hier trotzdem nicht: Nicht nur das Substantiv beugt sich, sondern
    // auch „Alle", „entfielen" und „Übungen". Wo sich der halbe Satz ändert,
    // gehört ein zweiter Satz hin und kein Wortbaukasten.
    box.append(hinweis(
      risiko.gesamt === 1
        ? 'Der einzige protokollierte Satz der Woche entfiel auf eine Übung mit '
          + 'niedrigem oder mittlerem Risiko.'
        : `Alle ${risiko.gesamt} protokollierten Sätze der Woche entfielen auf Übungen mit `
          + 'niedrigem oder mittlerem Risiko.', 'gut'));
  }

  return box;
}

/* ---------------------------------------------------------- Kraftmarken */

function kraftKarte(d) {
  const box = karte(el('h2', {}, 'Kraft im Verhältnis zum Körpergewicht'));
  const kg = Number(d.profil.gewichtKg);

  if (!kg) {
    // Wieder eine Sackgasse: benennt, was fehlt, ohne einen Weg dorthin.
    box.append(el('p', { class: 'klein' }, 'Ohne Körpergewicht im Profil lässt sich das nicht einordnen.'));
    box.append(el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf', onclick: () => zuAnsicht('profil') }, 'Zum Profil')));
    return box;
  }

  // Quelle ist der zentrale Leistungsstand: Er kennt Krafttests *und*
  // protokollierte Sätze. Eine zweite eigene Rechnung hier würde früher oder
  // später von der im Plan abweichen.
  const maxima = d.leistung?.maxima || {};
  const nichtSchaetzbar = d.leistung?.nichtSchaetzbar || {};
  const nichtSchaetzbareSaetze = d.leistung?.nichtSchaetzbareSaetze || {};
  const zeilen = [];

  for (const [uebung, marken] of Object.entries(KRAFTMARKEN.uebungen)) {
    const stand = maxima[uebung];
    const beste = stand?.e1rm || null;
    // Ein Test über der Epley-Grenze wurde vorher stillschweigend verworfen:
    // Es stand derselbe Strich da wie bei jemandem, der nichts eingetragen
    // hat. Wer etwas eingetragen hat, sucht den Fehler dann bei sich.
    const verworfen = !beste ? nichtSchaetzbar[uebung] : null;
    // Und derselbe Grund für protokollierte Sätze – der häufigere Fall: Der
    // Aufbaublock schreibt bis 12 Wiederholungen vor, Epley trägt bis 10. Über
    // zwölf Wochen fallen so 98 von 276 Sätzen durch, alle aus diesem Block.
    // Wer brav protokolliert und sieht, dass sich nichts bewegt, sucht den
    // Fehler sonst bei sich. Gemeldet wird nur, was jünger ist als der
    // angezeigte Wert – sonst stünde der Satz dauerhaft unter jeder Übung.
    const saetzeVerworfen = nichtSchaetzbareSaetze[uebung] || null;
    // Einordnung samt nächster Marke aus dem Kern. Hier stand dieselbe
    // Schwellenprüfung noch einmal – und die Markentabelle gleich mit.
    const e = beste ? kraftEinordnung(uebung, beste, kg) : null;
    const faktor = e?.faktor ?? null;
    zeilen.push(el('tr', {},
      el('td', {},
        el('div', {}, TESTS[uebung]?.name || uebung),
        stand ? el('div', { class: 'mini' }, stand.quelle) : null),
      // Last und Vielfaches stehen übereinander statt in zwei Spalten: Bei
      // vier Spalten schob sich die Einordnung auf 390 Pixeln aus der Karte
      // heraus – man las „EINORDNUN" und die Zielwerte gar nicht mehr.
      el('td', { class: 'zahl' },
        el('div', {}, beste ? `${zahl(beste, 1)} kg` : '–'),
        faktor ? el('div', { class: 'mini' }, `${zahl(faktor, 2)} × KG`) : null),
      el('td', { class: 'mini' }, verworfen
        ? el('div', { style: { color: 'var(--warn)' } },
          `Test mit ${menge(verworfen.wiederholungen, 'Wiederholung', 'Wiederholungen')} – `
          + `über ${verworfen.grenze} nicht schätzbar. Schwerer testen.`)
        // Kein Wert, aber protokollierte Sätze: Dann steht dort sonst
        // derselbe Strich wie bei jemandem, der nie trainiert hat.
        : (!beste && saetzeVerworfen)
        ? el('div', { style: { color: 'var(--warn)' } },
          `Protokolliert, aber nur Sätze über ${saetzeVerworfen.grenze} Wiederholungen – `
          + 'daraus lässt sich kein Maximum schätzen. Ein schwerer Satz oder ein Krafttest '
          + 'schließt die Lücke.')
        : e
        ? el('div', {},
          el('div', {}, e.stufe),
          // `naechsteMarke` rechnete der Kern schon immer aus, angezeigt wurde
          // sie nie. „Noch bis 156,6 kg" ist die Zahl, nach der man sucht,
          // wenn „solide" dasteht.
          e.naechsteMarke
            ? el('div', { class: 'mini' }, `bis ${zahl(e.naechsteMarke, 1)} kg`)
            : null,
          // Der Stand ist älter als der jüngste protokollierte Satz, weil der
          // über der Epley-Grenze lag. Ohne diesen Satz sieht es aus, als
          // hätte das Training nichts bewirkt.
          saetzeVerworfen
            ? el('div', { class: 'mini', style: { color: 'var(--warn)' } },
              `Seither nur Sätze über ${saetzeVerworfen.grenze} Wiederholungen `
              + '– daraus lässt sich kein Maximum schätzen.')
            : null)
        // `zahl()` und nicht die rohe Konstante: Sonst steht im deutschen
        // Text „Ziel 1.75 ×" neben dem „1,48 ×" der Zeile darüber.
        : `Ziel ${zahl(marken.solide, 2)} ×`)));
  }

  box.append(tabelle(
    el('thead', {}, el('tr', {},
      el('th', {}, 'Übung'),
      el('th', { class: 'zahl' }, 'Geschätztes 1RM'),
      el('th', {}, 'Einordnung'))),
    el('tbody', {}, ...zeilen)));

  box.append(el('p', { class: 'mini', style: { marginTop: '0.6rem' } },
    'Relative Maximalkraft hängt eng mit Sprintleistung zusammen. Oberhalb der Marke „stark" '
    + 'flacht dieser Zusammenhang ab – dann bringt Explosivkraft mehr als noch mehr Maximalkraft '
    + '(Suchomel 2016). Das Einer-Maximum wird nach Epley geschätzt und wird über zehn '
    + 'Wiederholungen zunehmend ungenau.'));

  return box;
}

/* --------------------------------------------------------- Belastung */

function belastungKarte(d) {
  const b = d.belastung;
  const box = karte(el('h2', {}, 'Belastung'));

  const punkte = b.verlauf.map((w) => ({ wert: w.last }));
  box.append(el('h3', {}, 'Wochenlast (RPE × Minuten), letzte 12 Wochen'));
  // Belastungssummen gehören auf eine Achse ab null: Hier ist „doppelt so viel"
  // eine sinnvolle Aussage, anders als bei einer Sprintzeit.
  // Ohne Wertung: Mehr Wochenlast ist nicht „besser" – genau davor warnt der
  // Text darunter. Die Kurve zeigt den Verlauf, die Einordnung macht das ACWR.
  box.append(linienDiagramm(punkte, { farbe: 'var(--kraft)', abNull: true, wertung: false }));

  const kennzahlen = el('div', { class: 'kennzahlen', style: { marginTop: '0.7rem' } });
  /*
   * Eine Null nur zeigen, wenn sie eine Aussage ist. „Lauter Nullen sind kein
   * Verlauf" stand für die Kurve schon in dieser Datei, und `linienDiagramm`
   * sagt hier auch brav „Noch keine Daten" – die große Zahl daneben behauptete
   * trotzdem eine Messung. Zwei Elemente in einer Karte, zwei Aussagen über
   * denselben Sachverhalt (Falle 70).
   *
   * Wer schon trainiert hat und diese Woche ruht, bekommt die 0 weiterhin: Da
   * ist sie eine Auskunft. Wer noch nie etwas protokolliert hat, hat keine
   * Belastung von null, sondern keinen Eintrag.
   */
  if (b.acwr.akut > 0 || b.acwr.wochenMitDaten > 0) {
    kennzahlen.append(kennzahl(zahl(b.acwr.akut), 'Diese Woche', 'Belastungseinheiten'));
  }
  if (b.acwr.belastbar) {
    kennzahlen.append(kennzahl(zahl(b.acwr.wert, 2), 'Akut / chronisch',
      b.acwr.stufe,
      b.acwr.stufe === 'sprung' ? 'var(--gefahr)' : b.acwr.stufe === 'erhoeht' ? 'var(--warn)' : 'var(--ausdauer)'));
  }
  if (b.monotonie.belastbar) {
    // Ohne Note keine Farbe: Bei wenigen Trainingstagen kann der Wert die
    // Schwelle gar nicht reißen – „gut verteilt" in Grün wäre eine bestandene
    // Prüfung, die es nicht gab.
    kennzahlen.append(kennzahl(zahl(b.monotonie.wert, 2), 'Monotonie',
      !b.monotonie.bewertbar ? 'ohne Note' : b.monotonie.hoch ? 'zu gleichförmig' : 'gut verteilt',
      !b.monotonie.bewertbar ? null : b.monotonie.hoch ? 'var(--warn)' : 'var(--ausdauer)'));
  }
  box.append(kennzahlen);

  if (b.acwr.belastbar) {
    box.append(el('p', { class: 'klein' }, b.acwr.text));
    box.append(el('p', { class: 'mini' }, b.acwr.einschraenkung));
  } else {
    box.append(el('p', { class: 'klein' }, b.acwr.hinweis));
  }

  // Auch hier der Rückfall: Fehlt die Monotonie, stand bisher nichts da –
  // während das ACWR direkt darüber sein Fehlen begründet. Zwei Zahlen
  // nebeneinander, nur eine erklärt sich.
  box.append(el('p', { class: 'klein' },
    b.monotonie.belastbar ? b.monotonie.text : b.monotonie.hinweis));

  box.append(ruhepulsBlock(b));

  return box;
}

/**
 * Ruhepuls im Verlauf.
 *
 * Steht in der Belastungskarte und nicht bei der Herzfrequenz, weil er dort
 * hingehört, wo er etwas bedeutet: Er ist ein Erholungssignal, kein Trainingsmaß.
 */
function ruhepulsBlock(b) {
  const rp = b.ruhepuls;
  const box = el('div', {}, el('h3', { style: { marginTop: '1rem' } }, 'Ruhepuls'));
  const verlauf = b.ruhepulsVerlauf || [];

  if (verlauf.length >= 2) {
    // Ohne Wertung: Ein fallender Ruhepuls ist meist ein gutes Zeichen, bei
    // starker Ermüdung aber ebenfalls möglich. „Besser geworden" wäre eine
    // Behauptung, die die Kurve nicht hergibt.
    box.append(linienDiagramm(verlauf.map((p) => ({ wert: p.ruhepuls })), {
      farbe: 'var(--ausdauer)', hoehe: 60, einheit: ' bpm', wertung: false,
    }));
  }

  if (!rp?.belastbar) {
    box.append(el('p', { class: 'klein' }, rp?.hinweis
      || 'Trag ihn im Morgen-Check ein – morgens im Liegen, vor dem Aufstehen.'));
    return box;
  }

  const farbe = rp.stufe === 'deutlich' ? 'var(--gefahr)'
    : rp.stufe === 'erhoeht' ? 'var(--warn)' : 'var(--ausdauer)';
  box.append(el('div', { class: 'kennzahlen' },
    // Ganze Schläge wie im Text darunter – zwei verschiedene Genauigkeiten für
    // dieselbe Größe lesen sich wie zwei verschiedene Zahlen.
    kennzahl(`${rp.jetzt}`, 'Zuletzt',
      `${rp.abweichung > 0 ? '+' : ''}${Math.round(rp.abweichung)} zur Grundlinie`, farbe),
    kennzahl(`${rp.grundlinie}`, 'Grundlinie', `${rp.tage.grundlinie} Tage`)));
  box.append(el('p', { class: 'klein' }, rp.text));
  box.append(el('p', { class: 'mini' }, rp.einschraenkung));

  return box;
}

/* ------------------------------------------------------------- Gewicht */

function gewichtKarte(d) {
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Gewicht'),
      el('button', { class: 'knopf', onclick: () => gewichtDialog() }, '+ Wiegen')));

  const verlauf = d.gewichtsverlauf || [];

  // Unlesbare Punkte werden nicht gezeichnet – aber auch nicht verschwiegen.
  // Sie stammen aus Sicherungen einer Fassung, die bei Komma-Eingabe ein NaN
  // in den Verlauf schrieb; wer sie nicht erwähnt, wundert sich über eine
  // Kurve, die kürzer ist als das Tagebuch.
  if (d.gewichtVerworfen > 0) {
    box.append(el('p', { class: 'mini', style: { color: 'var(--warn)' } },
      `${menge(d.gewichtVerworfen, 'Eintrag', 'Einträge')} ohne lesbares Gewicht `
      + `${d.gewichtVerworfen === 1 ? 'wird' : 'werden'} nicht gezeichnet – vermutlich aus einer `
      + 'älteren Sicherung. Einfach neu wiegen, dann steht der Punkt wieder da.'));
  }
  // Doppelte Wiegungen sind etwas ganz anderes als unlesbare: Es geht nichts
  // verloren, gezeichnet wird die letzte je Tag. Beides zusammen zu zählen
  // schrieb über drei tadellose Zahlen „3 Einträge ohne lesbares Gewicht"
  // (Falle 85). Deshalb ein eigener Satz – und ohne Warnfarbe, weil es nichts
  // zu tun gibt.
  if (d.gewichtDoppelt > 0) {
    box.append(el('p', { class: 'mini' },
      `An ${menge(d.gewichtDoppelt, 'Tag', 'Tagen')} steht mehr als eine Wiegung – `
      + 'gezeichnet wird die letzte des Tages. Kommt aus eingespielten Sicherungen; '
      + 'eintragen lässt sich pro Tag nur eine.'));
  }

  if (verlauf.length < 2) {
    box.append(el('p', { class: 'klein' },
      'Noch zu wenig Verlauf. Am besten immer morgens nüchtern wiegen – sonst misst du '
      + 'vor allem den Mageninhalt. Einzelne Tage schwanken um ein bis zwei Kilo; '
      + 'aussagekräftig wird erst der Verlauf über zwei bis drei Wochen.'));
    return box;
  }

  // Ohne Wertung: Ob zugenommen gut oder schlecht ist, hängt am Ziel – bei
  // „abnehmen" stand über einer steigenden Kurve „besser geworden". Die
  // Richtung steht als Zahl darunter, das genügt.
  box.append(linienDiagramm(verlauf.map((g) => ({ wert: g.kg })), {
    farbe: 'var(--ausdauer)', einheit: ' kg', wertung: false,
  }));

  const erste = verlauf[0];
  const letzte = verlauf[verlauf.length - 1];
  const diff = letzte.kg - erste.kg;
  box.append(el('p', { class: 'klein' },
    `${zahl(erste.kg, 1)} kg (${datumLang(erste.datum)}) → ${zahl(letzte.kg, 1)} kg (${datumLang(letzte.datum)}) · `
    + `${diff >= 0 ? '+' : ''}${zahl(diff, 1)} kg`));

  /*
   * Die Rate kommt aus `gewichtsTrend()` im Kern – erstes gegen letztes
   * Drittel, und nur dann eine Zahl, wenn der Unterschied größer ist als das
   * tägliche Zappeln.
   *
   * Hier stand die Rechnung selbst: `diff / wochen` aus dem ersten und dem
   * letzten Punkt. Über einem Gewicht, das sich nicht bewegt hatte, erschien
   * damit „Aufbau schneller als ~0,5 % pro Woche – Kalorien etwas
   * zurücknehmen", weil zufällig der erste Tag leicht und der letzte schwer
   * war. Ein Rat, weniger zu essen, in einem Tracker, der zwei Karten weiter
   * vor zu geringer Energieverfügbarkeit warnt – und drei Absätze über der
   * eigenen Warnung, dass einzelne Tage um ein bis zwei Kilo schwanken.
   */
  const t = d.gewichtstrend;
  if (t?.beurteilbar) {
    box.append(el('p', { class: 'mini' },
      `Im Schnitt ${t.proWoche >= 0 ? '+' : ''}${zahl(t.proWoche, 2)} kg pro Woche `
      + `(${zahl(t.prozent, 2)} % Körpergewicht), gemessen über ${zahl(t.wochen, 1)} Wochen `
      + `zwischen dem ersten und dem letzten Drittel von ${menge(t.punkte, 'Wiegung', 'Wiegungen')}.`));

    const g = d.ernaehrungsgrenzen?.gewichtProWoche;
    if (t.bewertung === 'aufbauZuSchnell') {
      box.append(hinweis(`Aufbau schneller als ~${zahl(g.aufbauMax, 1)} % pro Woche – der `
        + 'Überschuss landet überwiegend als Fett. Kalorien etwas zurücknehmen.', 'warnung'));
    } else if (t.bewertung === 'abnahmeZuSchnell') {
      box.append(hinweis(`Abnahme schneller als ~${zahl(g.abnahmeMax, 1)} % pro Woche. Das `
        + 'kostet Magermasse und Sprintleistung. Defizit verkleinern und Protein oben halten.',
      'warnung'));
    }
  } else if (t?.grund) {
    // Warum keine Rate dasteht, gehört an die Stelle, an der sie fehlt –
    // sonst sieht ein Verlauf ohne Zahl aus wie einer ohne Daten (Falle 22).
    box.append(el('p', { class: 'mini' }, t.grund));
  }

  return box;
}

function gewichtDialog() {
  const kg = dezimalFeld({ placeholder: 'kg' });
  const datum = el('input', { type: 'date', value: heute() });

  dialog(el('div', {},
    el('h2', {}, 'Gewicht eintragen'),
    feld('Gewicht in kg', kg, 'Morgens nüchtern, nach dem Toilettengang.'),
    feld('Datum', datum, 'Lässt sich nachtragen, falls du das Wiegen vergessen hast.'),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          if (!kg.value) return toast('Gewicht fehlt.', 'fehler');
          try {
            await daten.gewichtSpeichern({ kg: kg.value, datum: datum.value });
            dialogSchliessen();
            toast('Gewicht gespeichert.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Speichern'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen'))));
  kg.focus();
}

/* --------------------------------------------------------------- Tests */

function testKarte(d) {
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Leistungstests'),
      el('button', { class: 'knopf', onclick: () => testDialog() }, '+ Test')));

  box.append(el('p', { class: 'klein' },
    'Alle vier bis sechs Wochen testen, am besten am Ende einer Entlastungswoche – '
    + 'dann misst du Leistung und nicht Ermüdung.'));

  if (!testDaten) {
    daten.tests().then((t) => { testDaten = t; aktualisieren(); }).catch(() => {});
    box.append(el('p', { class: 'klein' }, 'Lädt …'));
    return box;
  }

  if (!testDaten.tests.length) {
    box.append(el('p', { class: 'klein' }, 'Noch keine Tests eingetragen.'));
    return box;
  }

  const nachArt = new Map();
  for (const t of testDaten.tests) {
    if (!nachArt.has(t.art)) nachArt.set(t.art, []);
    nachArt.get(t.art).push(t);
  }

  /*
   * Jede Testart klappt für sich zu.
   *
   * Mit Daten war diese Karte 1.240 px hoch – die längste der Ansicht, und
   * die Ansicht insgesamt 7.540 px. Das ist ein Protokoll: fünf Testarten mit
   * je Überschrift, Kurve und den letzten drei Einträgen samt Löschknopf.
   * Wonach man sucht, ist aber nur „was stand zuletzt da und geht es
   * aufwärts". Genau das trägt jetzt die Zusammenfassung; die Kurve und die
   * Einträge stehen darunter, wenn man sie will. Dieselbe Lösung wie bei den
   * Quellen (Falle 33) und den Tageskarten (Falle 40) – `<details>`, ohne
   * JavaScript und ohne Abhängigkeit.
   */
  for (const [art, liste] of nachArt) {
    const info = TESTS[art] || { name: art, einheit: '' };
    const sortiert = [...liste].sort((a, b) => (a.datum < b.datum ? -1 : 1));
    const letzter = sortiert.at(-1);
    const stellen = info.einheit === 's' ? 2 : 0;
    // Die Richtung gehört in die Zusammenfassung, sonst muss man aufklappen,
    // um zu sehen, ob sich etwas bewegt hat – und dann hilft das Zuklappen
    // nichts. Bei nur einer Messung gibt es keine Richtung.
    const vorletzter = sortiert.length > 1 ? sortiert.at(-2) : null;
    const delta = vorletzter ? Number(letzter.wert) - Number(vorletzter.wert) : null;
    const besser = delta == null ? null
      : (info.besser === 'kleiner' ? delta < 0 : delta > 0);

    const gruppe = el('details', { class: 'test-gruppe klapp' });
    gruppe.append(el('summary', {},
      el('span', { class: 'test-name' }, info.name),
      el('span', { class: 'test-wert' },
        `${zahl(letzter.wert, stellen)} ${info.einheit}`),
      delta
        ? el('span', {
          class: 'mini',
          style: { color: besser ? 'var(--ausdauer)' : 'var(--muted)' },
        }, `${delta > 0 ? '+' : '−'}${zahl(Math.abs(delta), stellen)}`)
        : null));

    // Kurve, Vorbehalt und Einträge stehen im aufgeklappten Teil.
    gruppe.append(linienDiagramm(sortiert.map((t) => ({ wert: t.wert })), {
      farbe: 'var(--sprint)',
      hoehe: 60,
      einheit: ` ${info.einheit}`,
      kleinerIstBesser: info.besser === 'kleiner',
    }));
    // Ein Wiederholungstest oberhalb der Epley-Grenze ergibt kein
    // Einer-Maximum. Das ist richtig so – nur stand bisher nirgends, dass es
    // Absicht ist. Wer sich von 10 auf 11 Klimmzüge verbessert, sah seine
    // Kraftzahl verschwinden und musste raten, ob der Test angekommen ist.
    const letzterWert = Number(sortiert.at(-1)?.wert) || 0;
    if (istWdhTest(art) && letzterWert > EPLEY.maxWiederholungen) {
      gruppe.append(el('p', { class: 'mini' },
        `Über ${EPLEY.maxWiederholungen} Wiederholungen schätzt die `
        + 'Epley-Formel zu ungenau – daraus rechnet der Tracker bewusst kein '
        + 'Einer-Maximum mehr. Die Wiederholungen selbst zählen weiter, auch '
        + 'für den Weg zum Muscle-Up. Für eine Kraftzahl brauchst du einen '
        + 'Test mit Zusatzlast.'));
    }

    for (const t of sortiert.slice().reverse().slice(0, 3)) {
      gruppe.append(el('div', { class: 'zeile' },
        el('div', { class: 'zeile-text' },
          el('div', { class: 'zeile-titel' },
            `${zahl(t.wert, info.einheit === 's' ? 2 : 0)} ${info.einheit}`
            + (t.wiederholungen ? ` × ${t.wiederholungen}` : '')),
          el('div', { class: 'zeile-meta' }, datumLang(t.datum) + (t.notiz ? ` · ${t.notiz}` : ''))),
        // „Ändern" neben „×", wie bei der Einheit seit Falle 81: Aus diesem
        // Wert schätzt der Kern das Einer-Maximum, und daran hängt jede
        // Lastvorgabe des Plans. Ein Vertipper war bisher nur durch Löschen
        // und vollständiges Neueintragen zu beheben.
        el('button', {
          class: 'knopf leise',
          onclick: () => testDialog(t),
        }, 'Ändern'),
        el('button', {
          class: 'knopf leise gefahr',
          onclick: async () => {
            try {
              await daten.testLoeschen(t.id);
              testDaten = null;
              aktualisieren();
            } catch (err) { toast(err.message, 'fehler'); }
          },
        }, '×')));
    }
    if (art === 'cooper') {
      const letzter = sortiert[sortiert.length - 1];
      const vo2 = (letzter.wert - COOPER.abzug) / COOPER.teiler;
      gruppe.append(el('p', { class: 'mini' },
        `Geschätzte VO2max: ${zahl(vo2, 1)} ml/kg/min (Cooper-Formel).`));
    }
    box.append(gruppe);
  }

  return box;
}

/**
 * Test eintragen – und mit `bearbeiten` denselben Dialog zum Korrigieren.
 *
 * Das Datumsfeld gab es bisher nicht, obwohl `testAnlegen()` im Kern immer
 * ein `datum` entgegennahm: ein Weg ohne Zugang (Falle 45). Die Wiegung
 * direkt daneben sagt seit jeher „Lässt sich nachtragen, falls du das Wiegen
 * vergessen hast" – für einen Krafttest gilt dasselbe, und ohne das Feld
 * landet ein nachgetragener Test am heutigen Datum und verzerrt den Verlauf.
 */
function testDialog(bearbeiten = null) {
  const art = el('select', {},
    ...Object.entries(TESTS).map(([wert, t]) => el('option', {
      value: wert, selected: bearbeiten?.art === wert,
    }, t.name)));
  // Roh und nicht `zahlText()` – siehe den Kommentar in `app/essen.js`:
  // `dezimalFeld` germanisiert selbst, und ein Cooper-Test steht in Metern.
  // „2.800" wäre zu „2,800" und damit zu 2,8 m geworden.
  const wert = dezimalFeld({ value: bearbeiten ? bearbeiten.wert : '' });
  const wdh = el('input', {
    type: 'number', min: '1', max: '20',
    value: String(bearbeiten?.wiederholungen || 5),
  });
  const datum = el('input', { type: 'date', value: bearbeiten?.datum || heute() });
  const notiz = el('input', { type: 'text', placeholder: 'optional', value: bearbeiten?.notiz || '' });
  const hilfe = el('div', { class: 'mini' });
  const wdhFeld = feld('Wiederholungen', wdh,
    'Aus Gewicht und Wiederholungen wird das Einer-Maximum nach Epley geschätzt.');

  function anpassen() {
    const info = TESTS[art.value];
    hilfe.textContent = `${info.hilfe} Einheit: ${info.einheit}`;
    wdhFeld.hidden = !info.mitWdh;
  }
  art.addEventListener('change', anpassen);
  anpassen();

  dialog(el('div', {},
    el('h2', {}, bearbeiten ? 'Test ändern' : 'Test eintragen'),
    feld('Art', art),
    hilfe,
    feld('Wert', wert),
    wdhFeld,
    feld('Datum', datum, 'Lässt sich nachtragen – der Verlauf ordnet sich danach.'),
    feld('Notiz', notiz),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          if (!wert.value) return toast('Wert fehlt.', 'fehler');
          // Ohne Wiederholungen bei einer Testart ohne sie: ausdrücklich
          // `null`, damit `testAendern()` eine stehengebliebene Zahl aus der
          // vorigen Art wirklich löscht.
          const eintrag = {
            art: art.value,
            wert: wert.value,
            wiederholungen: TESTS[art.value].mitWdh ? Number(wdh.value) : null,
            datum: datum.value || heute(),
            notiz: notiz.value,
          };
          try {
            if (bearbeiten) await daten.testAendern(bearbeiten.id, eintrag);
            else await daten.testAnlegen(eintrag);
            dialogSchliessen();
            testDaten = null;
            toast(bearbeiten ? 'Test geändert.' : 'Test gespeichert.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Speichern'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen'))));
  wert.focus();
}
