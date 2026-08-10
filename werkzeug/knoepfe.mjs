// Jeden Knopf einmal drücken – und nachsehen, ob etwas passiert.
//
// Falle 45: In der Muscle-Up-Karte war „geschafft" auf jeder noch nicht
// erreichbaren Stufe folgenlos. Der Tipp wurde gespeichert, die Anzeige leitete
// sich aber allein aus dem Stand ab, und der konnte sich nicht bewegen.
// Aufgefallen ist das nur, weil Nils ein Bildschirmfoto geschickt hat.
//
// Ein Bedienelement, das nichts tut, ist schlimmer als keines: Man hält die App
// für kaputt oder sich für blind. Dieses Werkzeug drückt deshalb jeden
// sichtbaren Knopf jeder Ansicht einmal und vergleicht den Text der Seite
// davor und danach.
//
//   node werkzeug/knoepfe.mjs            # alle Ansichten
//   node werkzeug/knoepfe.mjs fortschritt
//
// **Es verändert den Datenbestand** – hinterher neu säen. Vor jedem Knopf wird
// die Ansicht frisch geladen, damit die Wirkung des einen nicht die des
// nächsten verdeckt.
//
// Was es *nicht* kann: beurteilen, ob die Veränderung die richtige ist. Es
// findet nur den Fall „gar nichts". Der ist dafür verlässlich zu finden.
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte, ANSICHTEN } from './cdp.mjs';

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf);

const nur = process.argv[2];
const ansichten = nur ? ANSICHTEN.filter((a) => a === nur) : ANSICHTEN;
let stumm = 0;
let gedrueckt = 0;

/**
 * Text der Seite – die Grundlage für „hat sich etwas verändert?".
 *
 * Der Dialog wird über `dialog[open]` erkannt, **nicht** über `.dialog`: Das
 * Element steht dauerhaft im DOM und trägt die Klasse immer. Mit `.dialog`
 * meldete diese Prüfung im ersten Anlauf acht Knöpfe als wirkungslos, die alle
 * tadellos einen Dialog öffneten – ein Befund, den die Prüfung selbst erzeugt
 * hatte (Falle 34, hier zum dritten Mal). Der Dialoginhalt zählt mit, sonst
 * bliebe ein Wechsel *zwischen* zwei Dialogen unsichtbar.
 */
const seitenText = () => js(ruf, `
  const dlg = document.querySelector('dialog[open]');
  return {
    text: document.querySelector('#inhalt')?.innerText || document.body.innerText,
    dialog: dlg ? dlg.innerText.slice(0, 400) : '',
    meldung: document.querySelector('.toast, .meldung')?.textContent || '',
  };
`);

for (const ansicht of ansichten) {
  await vorratLeeren(ruf);
  await zurAnsicht(ruf, ansicht, { neuLaden: true });
  await warte(800);

  const knoepfe = await js(ruf, `
    return [...document.querySelectorAll('#inhalt button')]
      .map((b, i) => ({ i, text: b.textContent.trim().slice(0, 40), aus: b.disabled }))
      .filter((b) => !b.aus);
  `);
  console.log(`\n${ansicht}: ${knoepfe.length} Knöpfe`);

  for (const knopf of knoepfe) {
    // Frisch laden, damit jeder Knopf denselben Ausgangszustand vorfindet –
    // und einen etwaigen offenen Dialog dabei schließen.
    await zurAnsicht(ruf, ansicht, { neuLaden: true });
    await warte(700);
    const vorher = await seitenText();

    // Knöpfe, die einen Dateiauswahl-Dialog des Systems öffnen, sind so nicht
    // zu beurteilen: Der liegt außerhalb der Seite und hinterlässt im DOM
    // keine Spur. „Aus Lauf-App übernehmen" und „Einspielen" standen deshalb
    // als wirkungslos da, obwohl sie genau das Richtige tun.
    const ergebnis = await js(ruf, `
      const b = [...document.querySelectorAll('#inhalt button')][${knopf.i}];
      if (!b || b.disabled) return { da: false };
      let datei = false;
      const echt = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (...a) {
        if (this.type === 'file') { datei = true; return undefined; }
        return echt.apply(this, a);
      };
      try { b.click(); } finally { HTMLInputElement.prototype.click = echt; }
      return { da: true, datei };
    `);
    if (!ergebnis.da) continue;
    gedrueckt += 1;
    await warte(900);

    if (ergebnis.datei) {
      process.stdout.write('D');
      continue;
    }

    const nachher = await seitenText();
    const gleich = vorher.text === nachher.text
      && vorher.dialog === nachher.dialog
      && vorher.meldung === nachher.meldung;

    if (gleich) {
      stumm += 1;
      console.log(`  >>  „${knopf.text}" bewirkt nichts Sichtbares`);
    } else {
      process.stdout.write('.');
    }
  }
}

console.log(`\n\n${gedrueckt} Knöpfe gedrückt, ${stumm} ohne sichtbare Wirkung.`
  + '\n(D = öffnet die Dateiauswahl des Systems und ist von hier aus nicht beurteilbar.)');
zu();
process.exit(stumm === 0 ? 0 : 1);
