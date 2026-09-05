// Ein vergangener Tag – der Zustand, den kein anderes Werkzeug herstellt.
//
//   node werkzeug/rueckblick.mjs        # drei Tage zurück
//   node werkzeug/rueckblick.mjs 10     # zehn Tage zurück
//
// Die Heute-Ansicht kennt einen Stichtag: Man blättert mit den Pfeilen zurück
// und trägt Vergessenes nach. Alle übrigen Werkzeuge laden „heute" – deshalb
// waren zwei Karten jahrelang nicht datumsbewusst, ohne dass irgendetwas rot
// wurde (Falle 90), und das Essen landete auf dem falschen Tag (Falle 85).
//
// Gibt den Text der Ansicht aus und legt eine Standaufnahme ab. Bewusst kein
// Exitcode: Was hier auffällt, ist eine Behauptung im Text – das kann nur
// jemand beurteilen, der sie liest.
import { writeFileSync } from 'node:fs';
import { verbinde, js, zurAnsicht, geraet, warte } from './cdp.mjs';

const zurueck = Number(process.argv[2] || 3);
const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf, 390, 1500);
await zurAnsicht(ruf, 'heute', { neuLaden: true });
await warte(600);

for (let i = 0; i < zurueck; i += 1) {
  // Der erste Knopf der Datumsleiste blättert zurück. Über den Text zu suchen
  // wäre brüchig: Dort steht ein Pfeilzeichen, das sich ändern darf.
  const gefunden = await js(ruf, `
    const knoepfe = [...document.querySelectorAll('#inhalt .datums-leiste button')];
    if (!knoepfe.length) return false;
    knoepfe[0].click();
    return true;`);
  if (!gefunden) {
    console.error('Datumsleiste nicht gefunden – Aufbau der Heute-Ansicht geändert?');
    process.exit(1);
  }
  await warte(350);
}

const text = await js(ruf, "return document.querySelector('#inhalt').innerText;");
console.log(text);

const bild = await ruf('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
writeFileSync('/tmp/tracker-rueckblick.png', Buffer.from(bild.data, 'base64'));
console.log('\n→ /tmp/tracker-rueckblick.png');
console.log('Zu lesen ist: Sagt jede Karte „an diesem Tag" statt „heute"? Zeigt '
  + 'sie nur, was bis dahin da war?');
zu();
