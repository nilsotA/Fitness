// Gemeinsame Helfer für alle Ansichten: DOM-Bau, API-Aufrufe, Formatierung.

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

/* ------------------------------------------------------------------ API */

export async function hole(pfad) {
  const antwort = await fetch(`/api${pfad}`);
  const daten = await antwort.json();
  if (!antwort.ok) throw new Error(daten.fehler || 'Fehler beim Laden.');
  return daten;
}

export async function sende(pfad, daten, methode = 'POST') {
  const antwort = await fetch(`/api${pfad}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(daten),
  });
  const ergebnis = await antwort.json();
  if (!antwort.ok) throw new Error(ergebnis.fehler || 'Fehler beim Speichern.');
  return ergebnis;
}

export async function loesche(pfad) {
  const antwort = await fetch(`/api${pfad}`, { method: 'DELETE' });
  if (!antwort.ok) throw new Error('Löschen fehlgeschlagen.');
  return antwort.json();
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function heute() {
  return new Date().toISOString().slice(0, 10);
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

export function balken(prozent, farbe) {
  return el('div', { class: 'balken' },
    el('div', {
      class: 'balken-fuellung',
      style: { width: `${Math.min(100, Math.max(0, prozent))}%`, background: farbe },
    }));
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

/**
 * Einfaches Liniendiagramm als SVG. Reicht für Verlaufskurven und spart eine
 * Diagrammbibliothek, die um ein Vielfaches größer wäre als der ganze Tracker.
 */
export function linienDiagramm(punkte, {
  farbe = '#4d8dff', hoehe = 90, einheit = '', abNull = false, kleinerIstBesser = false,
} = {}) {
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

  // So viele Nachkommastellen, dass Anfangs- und Endwert unterscheidbar bleiben.
  // Ohne das stand bei 11,7 → 12,0 zweimal „12" da, und daneben „besser
  // geworden" – was wie ein Widerspruch aussieht.
  let stellen = 0;
  while (stellen < 2 && erster !== letzter
    && zahl(erster, stellen) === zahl(letzter, stellen)) stellen += 1;
  const besser = kleinerIstBesser ? letzter < erster : letzter > erster;
  const veraendert = letzter !== erster;

  return el('div', {},
    svg,
    el('div', { class: 'mini', style: { display: 'flex', justifyContent: 'space-between', gap: '0.5rem' } },
      el('span', {}, `${zahl(erster, stellen)}${einheit}`),
      // Kein Richtungspfeil: Bei „kleiner ist besser" läuft die Linie nach
      // unten, während es aufwärts geht – ein Pfeil würde dem widersprechen.
      veraendert
        ? el('span', { style: { color: besser ? 'var(--ausdauer)' : 'var(--muted)' } },
          besser ? 'besser geworden' : 'schlechter geworden')
        : null,
      el('span', {}, `${zahl(letzter, stellen)}${einheit}`)));
}
