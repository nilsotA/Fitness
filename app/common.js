// Gemeinsame Helfer für alle Ansichten: DOM-Bau, API-Aufrufe, Formatierung.

// Datumsrechnung liegt in regeln.js, weil der Server dieselbe braucht – sie
// stand vorher dreimal im Code und überall mit demselben Fehler.
export { heute, wochentagIndex, datumPlus } from '../kern/regeln.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Kleiner DOM-Baukasten. Bewusst kein Template-String mit innerHTML: Bei
 * Lebensmittelnamen und Notizen käme sonst irgendwann ein Zeichen vor, das
 * das Markup zerlegt.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'style' && typeof value === 'object') {
      for (const [prop, val] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, val);
        else node.style[prop] = val;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ----------------------------------------------------------- Meldungen */

export function toast(text, art = 'info') {
  const box = $('#toasts');
  if (!box) return;
  const gleich = [...box.children].find((n) => n.textContent === text);
  if (gleich) gleich.remove();
  const node = el('div', { class: `toast ${art}` }, text);
  box.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 300);
  }, 3000);
}

export function dialog(inhalt) {
  const d = $('#dialog');
  const box = $('#dialogInhalt');
  box.replaceChildren(inhalt);
  d.showModal();
  return d;
}

export function dialogSchliessen() {
  $('#dialog').close();
}

/* --------------------------------------------------------- Formatierung */

export function zahl(wert, stellen = 0) {
  if (wert == null || Number.isNaN(Number(wert))) return '–';
  return Number(wert).toLocaleString('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

export function dauer(minuten) {
  const m = Math.round(Number(minuten) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function datumLang(iso) {
  // Einzeln geparst statt `new Date(iso)`: Ein reines Datum ist dort
  // UTC-Mitternacht und bekäme westlich von Greenwich den falschen Wochentag.
  const [jahr, monat, tag] = String(iso).split('-').map(Number);
  if (!jahr || !monat || !tag) return iso;
  return new Date(jahr, monat - 1, tag)
    .toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

export const TYP_NAMEN = {
  sprint: 'Sprint',
  kraft: 'Kraft',
  plyometrie: 'Plyometrie',
  ausdauerLocker: 'Grundlage',
  ausdauerIntervalle: 'Intervalle',
  ausdauerLang: 'Lange Ausdauer',
  technik: 'Technik',
  mobilitaet: 'Mobilität',
};

export const TAGESTYP_NAMEN = {
  ruhetag: 'Ruhetag',
  leicht: 'Leichter Tag',
  mittel: 'Mittlerer Tag',
  hart: 'Harter Tag',
  langeAusdauer: 'Langer Ausdauertag',
};

// Deutsch beugt. Die Grundform oben taugt als Aufschrift, im Satz wird daraus
// „für einen leichter Tag" – kleingeschrieben obendrein, weil ein
// `toLowerCase()` das Substantiv gleich mitnahm. Deshalb eine zweite Form.
export const TAGESTYP_GEBEUGT = {
  ruhetag: 'Ruhetag',
  leicht: 'leichten Tag',
  mittel: 'mittleren Tag',
  hart: 'harten Tag',
  langeAusdauer: 'langen Ausdauertag',
};

/* ---------------------------------------------------------- Bausteine */

export function karte(...inhalt) {
  return el('div', { class: 'karte' }, ...inhalt);
}

export function kennzahl(wert, titel, zusatz, farbe) {
  return el('div', { class: 'kennzahl' },
    el('div', { class: 'kennzahl-wert', style: farbe ? { color: farbe } : {} }, wert),
    el('div', { class: 'kennzahl-titel' }, titel),
    zusatz ? el('div', { class: 'kennzahl-zusatz' }, zusatz) : null);
}

/**
 * Wie breit die beiden Abschnitte eines Balkens werden – in Prozent der
 * Balkenbreite, nicht des Ziels.
 *
 * Der Balken war vorher bei `Math.min(100, …)` gedeckelt. Damit sah ein Tag
 * mit 108 % der Fettvorgabe exakt aus wie einer mit 197 % des Proteins: beide
 * randvoll. Dieselbe Falle wie bei der Verteilung – eine Anzeige ohne „zu
 * viel" ist keine Bewertung. Über dem Ziel wächst deshalb der Maßstab mit,
 * und der Teil jenseits des Ziels bekommt eine eigene Fläche. Bei 197 % ist
 * die halbe Länge Überschuss; das ist auf einen Blick etwas anderes als die
 * sieben Prozent bei 108.
 *
 * Unter dem Ziel bleibt alles wie bisher: Maßstab 100, kein Überschuss.
 */
export function balkenBreiten(prozent) {
  const wert = Math.max(0, Number(prozent) || 0);
  if (wert <= 100) return { bis: wert, drueber: 0 };

  // Zwei Nachkommastellen reichen für acht Pixel Höhe. Der Überschuss wird
  // abgezogen statt selbst gerundet, damit die beiden Abschnitte zusammen
  // exakt die volle Breite ergeben und rechts kein Spalt aufblitzt.
  const bis = Math.round((100 / wert) * 100 * 100) / 100;
  return { bis, drueber: 100 - bis };
}

export function balken(prozent, farbe) {
  const { bis, drueber } = balkenBreiten(prozent);
  return el('div', { class: 'balken' },
    el('div', {
      class: `balken-fuellung${drueber ? ' gedeckelt' : ''}`,
      style: { width: `${bis}%`, background: farbe },
    }),
    // Schraffur statt Farbfläche: Der Überschuss ist keine erfüllte Vorgabe,
    // und er soll auch dann auffallen, wenn die Füllung selbst schon rot ist.
    drueber ? el('div', { class: 'balken-ueber', style: { width: `${drueber}%` } }) : null);
}

/**
 * „4 von 2 Sätzen" ist kein Stand, sondern ein Bruch, der nicht aufgeht.
 *
 * Die Formulierung „X von Y" setzt voraus, dass X in Y hineinpasst. Über dem
 * Ziel stimmt das nicht mehr, und der Satz liest sich wie ein Zählfehler –
 * dieselbe Sorte Widerspruch wie „-1.200 kcal übrig". Erfüllt heißt erfüllt,
 * dann gehört das Ziel in den Nebensatz.
 */
export function saetzeStand(ist, ziel) {
  if (ist < ziel) return `${ist} von ${ziel} Sätzen`;
  return `${ist} ${ist === 1 ? 'Satz' : 'Sätze'}, ${ziel} gefordert`;
}

/**
 * Tabelle in einem Rahmen, der notfalls seitlich scrollt.
 *
 * Eine Tabelle kann nicht beliebig schmal werden: Kopfzeilen wie
 * „GESCHÄTZTES 1RM" haben eine Mindestbreite, und drei solche Spalten passen
 * auf 320 Pixeln nicht mehr nebeneinander. Ohne Rahmen schob sich die letzte
 * Spalte einfach aus der Karte – zu lesen war „EINORDNUN", die Werte dahinter
 * gar nicht. Lieber in sich scrollen als stillschweigend abschneiden.
 *
 * Auf üblichen Handybreiten passt alles und der Rahmen fällt nicht auf.
 */
export function tabelle(...inhalt) {
  return el('div', { class: 'tabelle-rahmen' }, el('table', {}, ...inhalt));
}

export function hinweis(text, art = 'info') {
  return el('div', { class: `hinweis ${art}` }, text);
}

export function feld(beschriftung, eingabe, hilfe) {
  return el('div', { class: 'feld' },
    el('label', {}, beschriftung),
    eingabe,
    hilfe ? el('div', { class: 'mini', style: { marginTop: '0.25rem' } }, hilfe) : null);
}

const mittel = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Ist die Reihe wirklich gestiegen oder gefallen – oder zappelt sie nur?
 *
 * Vorher verglich das Diagramm den ersten mit dem letzten Wert. Das sind
 * ausgerechnet die beiden willkürlichsten Punkte einer Reihe: Der erste hängt
 * davon ab, wann man mit dem Eintragen angefangen hat, der letzte davon, ob
 * heute zufällig die kurze oder die lange Einheit dran war. Über einer
 * Tempokurve, die zwischen der 55-Minuten- und der 95-Minuten-Ausfahrt hin und
 * her sprang – ohne jeden Trend –, stand deshalb „schlechter geworden".
 *
 * Verglichen wird jetzt das erste mit dem letzten Drittel, und behauptet wird
 * eine Richtung nur, wenn der Unterschied größer ist als das, was die Reihe
 * ohnehin von Punkt zu Punkt schwankt.
 *
 * Als Maß für dieses Zappeln dient der mittlere Abstand aufeinanderfolgender
 * Werte, nicht die Standardabweichung: Ein echter Trend treibt die
 * Standardabweichung mit nach oben und würde sich damit selbst verdecken. Der
 * Punkt-zu-Punkt-Abstand bleibt davon fast unberührt.
 *
 * Zwei Messungen ergeben nie ein Urteil. Zwei Punkte sind eine Gerade, kein
 * Verlauf – da ist „nicht beurteilbar" die einzige ehrliche Auskunft.
 *
 * @returns {'besser'|'schlechter'|'unklar'|null}
 */
export function verlaufsUrteil(werte, { kleinerIstBesser = false } = {}) {
  if (!Array.isArray(werte) || werte.length < 3) return null;

  const drittel = Math.max(1, Math.round(werte.length / 3));
  const unterschied = mittel(werte.slice(-drittel)) - mittel(werte.slice(0, drittel));
  const zappeln = mittel(werte.slice(1).map((w, i) => Math.abs(w - werte[i])));

  if (Math.abs(unterschied) <= zappeln) return 'unklar';
  return (kleinerIstBesser ? unterschied < 0 : unterschied > 0) ? 'besser' : 'schlechter';
}

/**
 * Einfaches Liniendiagramm als SVG. Reicht für Verlaufskurven und spart eine
 * Diagrammbibliothek, die um ein Vielfaches größer wäre als der ganze Tracker.
 */
export function linienDiagramm(alle, {
  farbe = '#4d8dff', hoehe = 90, einheit = '', abNull = false, kleinerIstBesser = false,
  // Nach drei Jahren Training drängten sich über 300 Punkte in 320 Pixel – das
  // ist keine Kurve mehr, sondern eine Wand. Gezeigt wird deshalb das jüngste
  // Stück; darunter steht, wie viel abgeschnitten wurde. Die Daten selbst
  // bleiben natürlich vollständig.
  maxPunkte = 40,
  // Nicht jede Kurve hat eine gute Richtung. Ruhepuls, Wochenlast und Gewicht
  // sind Beobachtungsgrößen: „mehr" ist dort weder besser noch schlechter, und
  // eine Wertung danebenzuschreiben widerspricht dem, was die Karte darunter
  // erklärt – ein steigender Ruhepuls stand so als „besser geworden" über
  // einem Text, der vor einem beginnenden Infekt warnt.
  wertung = true,
} = {}) {
  const gesamt = alle.length;
  const punkte = gesamt > maxPunkte ? alle.slice(-maxPunkte) : alle;
  const gekuerzt = gesamt - punkte.length;

  const werte = punkte.map((p) => Number(p.wert) || 0);
  if (!werte.length) return el('p', { class: 'klein' }, 'Noch keine Daten.');

  // Ein einzelner Messpunkt ergibt keine Linie. Ohne diese Abkürzung zeichnete
  // die Fläche einen Keil quer durchs Bild und täuschte einen Verlauf vor,
  // den es nicht gibt.
  if (werte.length === 1) {
    return el('p', { class: 'klein' },
      `Erster Wert: ${zahl(werte[0], werte[0] % 1 ? 2 : 0)}${einheit}. `
      + 'Ein Verlauf entsteht ab der zweiten Messung.');
  }

  const breite = 320;
  // Die Achse beginnt bei den echten Werten, nicht bei null. Sonst verschwindet
  // genau das, worauf es ankommt: Eine Verbesserung von 4,42 s auf 4,31 s wäre
  // auf einer Skala ab null ein unsichtbarer Strich. Für Belastungssummen ist
  // null dagegen der richtige Bezugspunkt – dafür gibt es `abNull`.
  const echterMax = Math.max(...werte);
  const echterMin = Math.min(...werte);
  const polster = (echterMax - echterMin) * 0.15 || Math.abs(echterMax * 0.05) || 1;
  const max = abNull ? Math.max(echterMax, 1) : echterMax + polster;
  const min = abNull ? 0 : echterMin - polster;
  const spanne = max - min || 1;
  const schrittX = werte.length > 1 ? breite / (werte.length - 1) : 0;

  const koord = (wert, i) => {
    const x = i * schrittX;
    const y = hoehe - ((wert - min) / spanne) * (hoehe - 16) - 8;
    return [x, y];
  };

  const pfad = werte.map((w, i) => {
    const [x, y] = koord(w, i);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const flaeche = `${pfad} L${breite},${hoehe} L0,${hoehe} Z`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
  svg.setAttribute('class', 'diagramm');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.height = `${hoehe}px`;

  const ns = 'http://www.w3.org/2000/svg';
  const f = document.createElementNS(ns, 'path');
  f.setAttribute('d', flaeche);
  f.setAttribute('fill', farbe);
  f.setAttribute('opacity', '0.12');
  svg.append(f);

  const l = document.createElementNS(ns, 'path');
  l.setAttribute('d', pfad);
  l.setAttribute('fill', 'none');
  l.setAttribute('stroke', farbe);
  l.setAttribute('stroke-width', '2');
  l.setAttribute('stroke-linejoin', 'round');
  l.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(l);

  // Letzter Punkt hervorgehoben – der interessiert beim Draufschauen zuerst.
  const [lx, ly] = koord(werte[werte.length - 1], werte.length - 1);
  const punkt = document.createElementNS(ns, 'circle');
  punkt.setAttribute('cx', lx);
  punkt.setAttribute('cy', ly);
  punkt.setAttribute('r', '3');
  punkt.setAttribute('fill', farbe);
  svg.append(punkt);

  // Die x-Achse ist die Zeit, also gehören links der erste und rechts der
  // letzte Messwert hin – nicht Minimum und Maximum. Sonst widerspricht die
  // Beschriftung dem, was die Linie zeigt: Bei einer Sprintzeit, die von
  // 4,42 s auf 4,31 s fällt, stünde links die kleinere Zahl, während die
  // Linie von oben nach unten läuft.
  const erster = werte[0];
  const letzter = werte[werte.length - 1];
  const stellen = beschriftungsStellen(erster, letzter);

  const urteil = wertung ? verlaufsUrteil(werte, { kleinerIstBesser }) : null;
  // Die Richtung nur behaupten, wenn die Beschriftung sie auch hergibt. Stehen
  // links und rechts dieselbe Zahl, ist die Veränderung kleiner als das, was
  // die Anzeige auflöst – daneben „besser geworden" zu schreiben, sieht wie
  // ein Widerspruch aus.
  const aufloesbar = zahl(erster, stellen) !== zahl(letzter, stellen);
  const text = urteil === 'unklar' ? 'kein klarer Trend'
    : urteil && aufloesbar ? (urteil === 'besser' ? 'besser geworden' : 'schlechter geworden')
      : null;

  return el('div', {},
    svg,
    gekuerzt
      ? el('div', { class: 'mini' },
        `Letzte ${punkte.length} von ${gesamt} Einträgen – ältere sind gespeichert, `
        + 'nur nicht gezeichnet.')
      : null,
    el('div', { class: 'mini', style: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' } },
      el('span', {}, `${zahl(erster, stellen)}${einheit}`),
      // Kein Richtungspfeil: Bei „kleiner ist besser" läuft die Linie nach
      // unten, während es aufwärts geht – ein Pfeil würde dem widersprechen.
      text
        ? el('span', { style: { color: urteil === 'besser' ? 'var(--ausdauer)' : 'var(--muted)' } }, text)
        : null,
      el('span', {}, `${zahl(letzter, stellen)}${einheit}`)));
}

/**
 * Wie viele Nachkommastellen die Achsenbeschriftung braucht.
 *
 * Maßstab ist **die Veränderung**, nicht die Zahl an sich: Die Rundung muss
 * klein gegen den Unterschied zwischen erstem und letztem Wert bleiben. Zwei
 * Fälle sind dabei schon schiefgegangen, beide derselbe Fehler:
 *
 * - 11,7 → 12,0 stand zweimal als „12" da, daneben „besser geworden".
 * - 9,75 → 9,43 km/h stand als „10" → „9" da. Beide Zahlen verschieden, also
 *   sah die Regel keinen Handlungsbedarf – optisch wurden aus 3 % aber 10 %.
 *
 * Es genügt also nicht, dass sich zwei Zahlen unterscheiden. Sie müssen die
 * Veränderung auch **der Größe nach** richtig wiedergeben.
 */
export function beschriftungsStellen(erster, letzter, maxStellen = 2) {
  const unterschied = Math.abs(letzter - erster);
  if (!unterschied) return 0;

  for (let stellen = 0; stellen < maxStellen; stellen += 1) {
    const f = 10 ** stellen;
    const gezeigt = Math.abs(Math.round(letzter * f) - Math.round(erster * f)) / f;
    // Ein Drittel Abweichung ist die Grenze: Darüber erzählt die Beschriftung
    // eine andere Geschichte als die Linie.
    if (gezeigt > 0 && Math.abs(gezeigt - unterschied) <= unterschied / 3) return stellen;
  }
  return maxStellen;
}
