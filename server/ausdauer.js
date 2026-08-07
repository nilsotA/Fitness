// Ausdauer: Strecke, Tempo und die Frage, ob die lockeren Einheiten locker sind.
//
// Das Mitschreiben von Kilometern ist der einfache Teil. Der nützliche Teil ist
// die Intensitätsverteilung: Ausdauertraining scheitert in der Praxis fast
// immer am selben Muster – die lockeren Einheiten sind zu schnell, die harten
// zu lasch, und alles landet in der Mitte. Dort sammelt man Ermüdung ohne
// Anpassung, und die fehlt dann am Sprinttag.
//
// Reine Rechenfunktionen ohne Netzwerk oder Dateizugriff – damit testbar.

import { AUSDAUER_ZONEN, AUSDAUER_VERTEILUNG } from './wissen.js';
import { round } from './profil.js';

// Das Tempo muss auch im Browser gerechnet werden – während der Eingabe, damit
// man sieht, was aus Strecke und Dauer wird. Wie die Sprint-Abbruchregel liegt
// es deshalb in public/regeln.js statt hier ein zweites Mal.
import { GERAETE, tempo, pruefeStrecke } from '../public/regeln.js';

export { GERAETE, tempo, pruefeStrecke };

/**
 * Zone aus der gefühlten Anstrengung.
 *
 * Bewusst über RPE und nicht über Herzfrequenz: RPE liegt für jede Einheit vor,
 * braucht kein Gerät, und für eine Dreiteilung ist es genau genug.
 */
export function zoneAusRpe(rpe) {
  const r = Number(rpe) || 0;
  if (!r) return null;
  if (r <= AUSDAUER_ZONEN.locker.rpeBis) return 'locker';
  if (r <= AUSDAUER_ZONEN.grauzone.rpeBis) return 'grauzone';
  return 'hart';
}

const IST_AUSDAUER = (typ) => typeof typ === 'string' && typ.startsWith('ausdauer');

/**
 * Intensitätsverteilung über die letzten Wochen.
 *
 * Gezählt werden **Minuten**, nicht Einheiten: Eine 90-minütige lockere Runde
 * und ein 20-minütiges Intervall sind nicht dasselbe „eine Einheit". Genau
 * diese Verwechslung lässt Trainingspläne polarisiert aussehen, die es nicht
 * sind.
 */
export function verteilung(sessions = [], bis = new Date(), tage = 28) {
  const grenze = new Date(bis);
  grenze.setDate(grenze.getDate() - tage);

  const minuten = { locker: 0, grauzone: 0, hart: 0 };
  let gesamt = 0;

  for (const s of sessions) {
    if (!IST_AUSDAUER(s.typ)) continue;
    const datum = new Date(s.datum);
    if (datum < grenze || datum > bis) continue;
    const zone = zoneAusRpe(s.rpe);
    if (!zone) continue;
    const min = Number(s.minuten) || 0;
    minuten[zone] += min;
    gesamt += min;
  }

  if (gesamt < AUSDAUER_VERTEILUNG.minMinutenFuerBewertung) {
    return {
      bewertbar: false,
      minuten,
      gesamt,
      hinweis: `Erst ab ${AUSDAUER_VERTEILUNG.minMinutenFuerBewertung} min Ausdauer in `
        + `${tage} Tagen aussagekräftig – bisher ${Math.round(gesamt)} min.`,
    };
  }

  const anteil = {
    locker: round(minuten.locker / gesamt, 3),
    grauzone: round(minuten.grauzone / gesamt, 3),
    hart: round(minuten.hart / gesamt, 3),
  };

  const g = AUSDAUER_VERTEILUNG;
  let stufe = 'gut';
  let text = `${Math.round(anteil.locker * 100)} % locker, `
    + `${Math.round(anteil.hart * 100)} % hart. Das entspricht der polarisierten Verteilung, `
    + 'die bei Ausdauerathleten durchweg gefunden wird.';

  if (anteil.grauzone >= g.grauzoneKritisch) {
    stufe = 'kritisch';
    text = `${Math.round(anteil.grauzone * 100)} % deiner Ausdauerzeit liegt in der Grauzone. `
      + 'Das ist das Muster, an dem Ausdauertraining am häufigsten scheitert: zu schnell für '
      + 'Erholung, zu langsam für einen Reiz. Die lockeren Einheiten deutlich langsamer '
      + 'machen – und dafür die harten wirklich hart.';
  } else if (anteil.grauzone >= g.grauzoneWarnung) {
    stufe = 'warnung';
    text = `${Math.round(anteil.grauzone * 100)} % in der Grauzone. Noch im Rahmen, aber die `
      + 'Richtung stimmt nicht. Locker heißt: Du kannst in ganzen Sätzen sprechen.';
  } else if (anteil.hart < 0.05) {
    stufe = 'warnung';
    text = 'Fast alles locker. Die aerobe Basis wächst so, aber ohne harte Anteile fehlt der '
      + 'Reiz nach oben – rund ein Fünftel der Zeit darf wehtun.';
  }

  return {
    bewertbar: true,
    minuten,
    gesamt: Math.round(gesamt),
    anteil,
    stufe,
    text,
    ziel: { locker: AUSDAUER_ZONEN.locker.ziel, hart: AUSDAUER_ZONEN.hart.ziel },
    tage,
    grenzwerte: g,
  };
}

/**
 * Tempoverlauf je Gerät. Getrennt, weil ein Radtempo und ein Laufttempo nichts
 * miteinander zu tun haben – zusammen aufgetragen ergäbe die Kurve Unsinn.
 *
 * Verglichen werden nur Einheiten derselben Zone: Ein lockerer Lauf, der
 * schneller wird, ist ein Fortschritt. Ein lockerer Lauf, der schneller wird,
 * weil er in Wahrheit ein harter war, ist keiner – deshalb steht die Zone
 * an jedem Punkt.
 */
export function tempoVerlauf(sessions = []) {
  const verlauf = {};

  for (const s of sessions) {
    if (!IST_AUSDAUER(s.typ)) continue;
    const strecke = pruefeStrecke(s.strecke);
    if (!strecke || !s.minuten) continue;

    const zone = zoneAusRpe(s.rpe);
    const schluessel = `${strecke.geraet}-${zone || 'unbekannt'}`;
    const t = tempo(strecke.meter, s.minuten, strecke.geraet);
    if (!t) continue;

    verlauf[schluessel] = verlauf[schluessel] || [];
    verlauf[schluessel].push({
      datum: s.datum,
      meter: strecke.meter,
      minuten: s.minuten,
      kmh: t.kmh,
      tempo: t.text,
      zone,
    });
  }

  for (const liste of Object.values(verlauf)) liste.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  return verlauf;
}

/** Wochenkilometer je Gerät – die Zahl, nach der Ausdauersportler fragen. */
export function wochenstrecke(sessions = [], bis = new Date(), tage = 7) {
  const grenze = new Date(bis);
  grenze.setDate(grenze.getDate() - tage);
  const proGeraet = {};

  for (const s of sessions) {
    if (!IST_AUSDAUER(s.typ)) continue;
    const datum = new Date(s.datum);
    if (datum < grenze || datum > bis) continue;
    const strecke = pruefeStrecke(s.strecke);
    if (!strecke) continue;
    proGeraet[strecke.geraet] = (proGeraet[strecke.geraet] || 0) + strecke.meter;
  }

  return Object.fromEntries(
    Object.entries(proGeraet).map(([g, m]) => [g, round(m / 1000, 1)]),
  );
}

/** Klartext für einen Verlaufsschlüssel wie „laufen-locker". */
export function verlaufName(schluessel) {
  const [geraet, zone] = String(schluessel).split('-');
  const g = GERAETE[geraet]?.name || geraet;
  const z = AUSDAUER_ZONEN[zone]?.name || 'ohne Zone';
  return `${g} · ${z}`;
}
