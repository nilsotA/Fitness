// Misst jede Tippfläche jeder Ansicht – und prüft, ob der Tipp ankommt.
//
// Falle 78: Die globale Formularregel zählt `input[type=text]`, `[number]`,
// `[date]`, `select` und `textarea` auf. Häkchen stehen bewusst nicht dabei –
// ein Kästchen soll nicht 44 Pixel breit werden. Damit fiel aber die
// **Tippfläche** jedes Häkchens durch die Regel: 24 px hoch in einer 44 px
// hohen Zeile, je 10 px totes Feld darüber und darunter. 21 solcher Häkchen
// stehen in einem einzigen Kraftprotokoll.
//
// Gefunden wurde das von Hand. Gesichert war es danach durch nichts: `breite`,
// `konsole` und `knoepfe` waren die ganze Zeit grün. Dieses Werkzeug schließt
// die Lücke.
//
//   node werkzeug/tippflaechen.mjs             # alle Ansichten
//   node werkzeug/tippflaechen.mjs fortschritt
//
// Gemessen wird zweierlei, und das zweite ist das wichtigere:
//
//   1. Das Rechteck – ist es 44 × 44 groß?
//   2. `elementFromPoint` auf die Mitte – kommt der Tipp dort überhaupt an?
//      Ein Element kann vollständig da, korrekt gerendert und trotzdem
//      unerreichbar sein; in Falle 77 lag die Kopfzeile über der Reiterleiste,
//      und `getBoundingClientRect` sah davon nichts.
//
// Der Bestand wird gesichert und am Ende wiederhergestellt (wie in
// `knoepfe.mjs`, Falle 59): Um an die Dialoge zu kommen, muss das Werkzeug
// Knöpfe drücken, und ein Teil davon löscht.
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte, ANSICHTEN } from './cdp.mjs';

const MASS = 44;

/*
 * Angenommene Fundstellen – jede mit Grund.
 *
 * Ohne diese Liste wäre das Werkzeug ein Melder, den niemand ernst nimmt.
 * Mit ihr ist jede Ausnahme eine Aussage, der man widersprechen kann. Der
 * Schlüssel ist ein Teilstring aus `TAGNAME.klassen`.
 *
 * Sie ist heute **leer**, und das ist die Aussage: In dieser App gibt es
 * derzeit keine Tippfläche unter 44 Pixeln, für die es einen guten Grund
 * gäbe. Im ersten Wurf stand hier ein erfundener Eintrag für eine Klasse, die
 * es gar nicht gibt – eine Ausnahme für einen Fall, der nicht vorkommt, also
 * eine Regel, die nichts prüft und irgendwann versehentlich etwas durchlässt
 * (Falle 51). Wer hier etwas einträgt, schreibt den Grund dazu.
 */
const ANGENOMMEN = [];

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');

const nur = process.argv[2];
const ansichten = nur ? ANSICHTEN.filter((a) => a === nur) : ANSICHTEN;

const SICHERUNG = 'tippflaechen-vorher';
const tagebuch = (rumpf) => js(ruf, `
  const db = await new Promise((f, r) => {
    const a = indexedDB.open('trainingstracker', 1);
    a.onsuccess = () => f(a.result);
    a.onerror = () => r(a.error);
  });
  const holen = (k) => new Promise((f, r) => {
    const t = db.transaction('tagebuch', 'readonly').objectStore('tagebuch').get(k);
    t.onsuccess = () => f(t.result); t.onerror = () => r(t.error);
  });
  const setzen = (k, w) => new Promise((f, r) => {
    const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').put(w, k);
    t.onsuccess = () => f(true); t.onerror = () => r(t.error);
  });
  const weg = (k) => new Promise((f) => {
    const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').delete(k);
    t.onsuccess = () => f(true); t.onerror = () => f(false);
  });
  ${rumpf}
`);

const bestandZurueck = () => tagebuch(`
  const s = await holen('${SICHERUNG}');
  if (!s) return false;
  if (s.da) await setzen('aktuell', s.wert); else await weg('aktuell');
  return true;
`);

/*
 * Der Messkern, der in der Seite läuft.
 *
 * Zwei Entscheidungen darin sind nicht selbstverständlich:
 *
 * *Ein Häkchen wird über sein Label gemessen.* Seit Falle 78 trägt das Label
 * die Fläche und das Kästchen bleibt klein – wer das Kästchen misst, meldet
 * genau die Korrektur als Fehler.
 *
 * *Verdeckung zählt als Fund, nicht nur als Notiz.* Getroffen wird geprüft, ob
 * `elementFromPoint` auf der Mitte das Element selbst, einen Nachfahren oder
 * ein Label darum liefert. Alles andere heißt: Der Finger landet woanders.
 */
const MESSEN = `
  const WAHL = 'button, a[href], summary, select, textarea, input, [role="button"]';
  const raus = [];
  const gesehen = new Set();
  const wurzel = arguments0 === 'dialog'
    ? document.querySelector('dialog[open]')
    : document.querySelector('#inhalt');
  if (!wurzel) return { fehlt: true, felder: [] };

  for (const roh of wurzel.querySelectorAll(WAHL)) {
    if (roh.disabled) continue;
    if (roh.type === 'hidden' || roh.type === 'file') continue;

    // Das Kästchen selbst ist absichtlich klein – gemessen wird das Label,
    // das seit Falle 78 die Fläche trägt.
    const istHaken = roh.tagName === 'INPUT' && (roh.type === 'checkbox' || roh.type === 'radio');
    const e = istHaken ? (roh.closest('label') || roh) : roh;
    if (gesehen.has(e)) continue;
    gesehen.add(e);

    const stil = getComputedStyle(e);
    if (stil.display === 'none' || stil.visibility === 'hidden' || Number(stil.opacity) === 0) continue;

    /*
     * Erst heranscrollen, dann messen. Im ersten Anlauf lagen 130 von 341
     * Flächen ausserhalb des Sichtfensters – elementFromPoint kann dort
     * nichts liefern, und das Werkzeug hätte 38 % ungeprüft durchgewinkt
     * (Falle 18, im Melder selbst).
     *
     * block: center und nicht nearest. Damit misst die Prüfung, ob es
     * **eine** Scrollstellung gibt, in der der Tipp ankommt. Eine klebende
     * Leiste, die den oberen Rand verdeckt, fällt hier deshalb nicht auf –
     * dafür gibt es den Wächter aus Falle 77. Hier geht es um die Fläche.
     */
    e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    const mx = Math.round(r.left + r.width / 2);
    const my = Math.round(r.top + r.height / 2);
    const getroffen = (mx >= 0 && my >= 0 && mx < innerWidth && my < innerHeight)
      ? document.elementFromPoint(mx, my)
      : null;
    // Wer auch nach dem Heranscrollen nicht im Sichtfenster liegt, ist nicht
    // messbar – das wird als solches gemeldet und nicht als Entwarnung gezählt.
    const erreichbar = getroffen === null
      ? null
      : (e.contains(getroffen) || getroffen.contains(e));

    raus.push({
      kennung: e.tagName + (typeof e.className === 'string' && e.className
        ? '.' + e.className.trim().split(/\\s+/).join('.') : ''),
      text: (e.textContent || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 34),
      breit: Math.round(r.width),
      hoch: Math.round(r.height),
      erreichbar,
      trifft: getroffen
        ? getroffen.tagName + (typeof getroffen.className === 'string' && getroffen.className
          ? '.' + getroffen.className.trim().split(/\\s+/)[0] : '')
        : '',
    });
  }
  return { fehlt: false, felder: raus };
`;

const messen = (wo) => js(ruf, `const arguments0 = ${JSON.stringify(wo)};\n${MESSEN}`);

/** Alle Klappkarten aufziehen – zugeklappt hat ihr Inhalt kein Rechteck. */
const klappenAuf = () => js(ruf, `
  let n = 0;
  for (const d of document.querySelectorAll('details:not([open])')) { d.open = true; n += 1; }
  return n;
`);

async function fertigGeladen(hoechstens = 4000) {
  let vorige = -1;
  for (let gewartet = 0; gewartet < hoechstens; gewartet += 200) {
    await warte(200);
    const anzahl = await js(ruf, "return document.querySelectorAll('#inhalt button').length;");
    if (anzahl === vorige && (anzahl > 0 || gewartet >= 1000)) return;
    vorige = anzahl;
  }
}

const angenommenFuer = (f) => ANGENOMMEN.find((a) => f.kennung.includes(a.muster));

let zuKlein = 0;
let verdeckt = 0;
let gemessen = 0;
const unmessbar = [];
const angenommenGezaehlt = new Map();

function auswerten(wo, felder) {
  const funde = [];
  for (const f of felder) {
    gemessen += 1;
    if (f.erreichbar === null) { unmessbar.push(`${wo}: ${f.kennung}`); continue; }
    const klein = f.breit < MASS || f.hoch < MASS;
    if (!klein && f.erreichbar) continue;

    const a = angenommenFuer(f);
    if (a && f.erreichbar) {
      angenommenGezaehlt.set(a.muster, (angenommenGezaehlt.get(a.muster) || 0) + 1);
      continue;
    }
    if (klein) zuKlein += 1;
    if (!f.erreichbar) verdeckt += 1;
    funde.push(f);
  }
  return funde;
}

function zeigen(kopf, funde, anzahl) {
  const mark = funde.length ? '>>' : 'ok';
  console.log(`${mark} ${kopf}  ${anzahl} Tippflächen`);
  for (const f of funde) {
    const teile = [`${f.breit}×${f.hoch}`];
    if (!f.erreichbar) teile.push(`Tipp trifft ${f.trifft}`);
    console.log(`      ${f.kennung}  ${teile.join(' · ')}  :: ${f.text}`);
  }
}

await zurAnsicht(ruf, 'heute');
await tagebuch(`
  const w = await holen('aktuell');
  await setzen('${SICHERUNG}', { da: w !== undefined, wert: w ?? null });
  return true;
`);

// ------------------------------------------------------------ die Ansichten
for (const breite of [320, 390]) {
  await geraet(ruf, breite);
  console.log(`\n--- ${breite} px`);
  for (const ansicht of ansichten) {
    await vorratLeeren(ruf);
    await bestandZurueck();
    await zurAnsicht(ruf, ansicht, { neuLaden: true });
    await fertigGeladen();
    await klappenAuf();
    await warte(300);
    const { felder } = await messen('seite');
    zeigen(`#${ansicht}`, auswerten(`${breite}px #${ansicht}`, felder), felder.length);
  }
}

// ------------------------------------------------------------- die Dialoge
//
// Hier saß Falle 78, und hierher kommt man nur, indem man Knöpfe drückt.
// Gemessen wird bei 320 px, der schmalsten Lage: Was dort passt, passt überall.
// Vor jedem Knopf wird der Bestand zurückgesetzt, weil ein Teil von ihnen
// löscht (Falle 59).
await geraet(ruf, 320);
console.log('\n--- 320 px, Dialoge');
let dialoge = 0;
for (const ansicht of ansichten) {
  await bestandZurueck();
  await zurAnsicht(ruf, ansicht, { neuLaden: true });
  await fertigGeladen();
  const knoepfe = await js(ruf, `
    return [...document.querySelectorAll('#inhalt button')]
      .map((b, i) => ({ i, text: b.textContent.trim().slice(0, 30) }))
      .filter((b) => b.text);
  `);

  for (const knopf of knoepfe) {
    await bestandZurueck();
    await zurAnsicht(ruf, ansicht, { neuLaden: true });
    await fertigGeladen();
    const auf = await js(ruf, `
      const b = [...document.querySelectorAll('#inhalt button')][${knopf.i}];
      if (!b || b.disabled) return false;
      const echt = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (...a) {
        if (this.type === 'file') return undefined;
        return echt.apply(this, a);
      };
      try { b.click(); } finally { HTMLInputElement.prototype.click = echt; }
      await new Promise((f) => setTimeout(f, 400));
      return Boolean(document.querySelector('dialog[open]'));
    `);
    if (!auf) continue;
    dialoge += 1;
    await klappenAuf();
    await warte(200);
    const { fehlt, felder } = await messen('dialog');
    if (fehlt) continue;
    zeigen(`#${ansicht} › „${knopf.text}"`, auswerten(`Dialog „${knopf.text}"`, felder), felder.length);
  }
}

console.log(`\n${gemessen} Tippflächen gemessen (${dialoge} Dialoge), Maß ${MASS} px.`);
console.log(`${zuKlein} zu klein · ${verdeckt} vom Tipp nicht erreicht.`);
if (angenommenGezaehlt.size) {
  console.log('\nAngenommen, mit Grund:');
  for (const a of ANGENOMMEN) {
    const n = angenommenGezaehlt.get(a.muster);
    if (n) console.log(`  ${n}× ${a.muster}\n      ${a.grund}`);
  }
}
if (unmessbar.length) {
  console.log(`\n${unmessbar.length} lagen ausserhalb des Sichtfensters und sind nicht `
    + 'gemessen worden – das ist keine Entwarnung:');
  for (const u of [...new Set(unmessbar)].slice(0, 10)) console.log(`  ${u}`);
}

await bestandZurueck();
await tagebuch(`await weg('${SICHERUNG}'); return true;`);
zu();
process.exit(zuKlein === 0 && verdeckt === 0 ? 0 : 1);
