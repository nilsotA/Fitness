// Screenshot einer Ansicht – ganz oder nur die Karte zu einer Überschrift.
//
//   node werkzeug/schuss.mjs fortschritt                    # ganze Ansicht
//   node werkzeug/schuss.mjs fortschritt Intensitätsvert    # nur diese Karte
//   BREITE=320 node werkzeug/schuss.mjs plan
//
// Legt die Datei unter /tmp/tracker-<ansicht>.png ab und gibt den Text der
// Karte auf der Konsole aus – oft sieht man den Fehler schon dort.
import { writeFileSync } from 'node:fs';
import { verbinde, js, zurAnsicht, geraet, warte } from './cdp.mjs';

const ansicht = process.argv[2] || 'heute';
const suche = process.argv[3] || null;
const breite = Number(process.env.BREITE) || 390;

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf, breite, 1500);
// Nach Codeänderungen zwingend mit neuLaden – sonst prüft man den alten Stand.
await zurAnsicht(ruf, ansicht, { neuLaden: true });
await warte(600);

const ziel = suche
  ? await js(ruf, `
      const suche = ${JSON.stringify(suche)};
      const h = [...document.querySelectorAll('h2, h3')]
        .find((e) => e.textContent.includes(suche));
      if (!h) return null;
      const box = h.closest('.karte') || h.parentElement;
      box.scrollIntoView();
      await new Promise((f) => setTimeout(f, 250));
      const r = box.getBoundingClientRect();
      return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height, text: box.innerText };
    `)
  : null;

if (suche && !ziel) {
  console.error(`Keine Karte mit „${suche}" in #${ansicht} gefunden.`);
  zu();
  process.exit(1);
}

const bild = await ruf('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  ...(ziel ? { clip: { x: ziel.x, y: ziel.y, width: ziel.w, height: ziel.h, scale: 2 } } : {}),
});

const pfad = `/tmp/tracker-${ansicht}${suche ? '-karte' : ''}.png`;
writeFileSync(pfad, Buffer.from(bild.data, 'base64'));
if (ziel) console.log(`${ziel.text}\n`);
console.log(`→ ${pfad} (${breite} px)`);
zu();
