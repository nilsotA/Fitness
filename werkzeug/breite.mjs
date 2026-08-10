// Prüft jede Ansicht auf waagerechten Überlauf – bei 320 und 390 Pixeln.
//
// Der Anlass: Die Kraft-Tabelle schob auf 390 Pixeln ihre letzte Spalte aus
// der Karte, zu lesen war „EINORDNUN". Im Screenshot fällt so etwas nur auf,
// wenn man genau diese Karte ansieht – deshalb systematisch.
//
// 320 ist die schmalste iPhone-Breite und deckt auf, was bei 390 gerade noch
// passt. Ausgenommen sind Elemente in `.tabelle-rahmen` (die scrollen in sich,
// siehe `tabelle()` in common.js) und die Reiterleiste (scrollt ebenfalls in
// sich – der Profil-Reiter liegt bewusst außerhalb).
//
//   node werkzeug/breite.mjs
import { verbinde, js, zurAnsicht, geraet, ANSICHTEN, warte } from './cdp.mjs';

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');

let funde = 0;
for (const breite of [320, 390]) {
  await geraet(ruf, breite);
  for (const ansicht of ANSICHTEN) {
    await zurAnsicht(ruf, ansicht);
    await warte(400);
    const messung = await js(ruf, `
      const w = document.documentElement.clientWidth;
      const raus = [];
      for (const e of document.querySelectorAll('body *')) {
        if (e.closest('.tabelle-rahmen') || e.closest('.reiter')) continue;
        const r = e.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > w + 0.5 || r.left < -0.5) {
          raus.push(\`\${e.tagName}.\${typeof e.className === 'string' ? e.className : ''} \`
            + \`\${Math.round(r.left)}..\${Math.round(r.right)} :: \`
            + (e.textContent || '').trim().slice(0, 50));
        }
      }
      return { w, scroll: document.documentElement.scrollWidth, raus: raus.slice(0, 8) };
    `);
    const schief = messung.raus.length > 0 || messung.scroll > messung.w;
    if (schief) funde += 1;
    console.log(`${schief ? '>>' : 'ok'} ${breite}px #${ansicht}`
      + `  scrollWidth ${messung.scroll} / ${messung.w}`);
    for (const r of messung.raus) console.log(`      ${r}`);
  }
}
console.log(funde ? `\n${funde} Ansicht(en) laufen über.` : '\nKeine Ansicht läuft über.');
zu();
process.exit(funde ? 1 : 0);
