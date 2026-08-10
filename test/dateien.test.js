// Die mitgelieferten Daten und der Dateiserver.
//
// Die Lebensmitteltabelle ist von Hand gepflegt – genau dort passieren
// Zahlendreher, und die fallen sonst erst auf, wenn ein Tagesbedarf unsinnig
// aussieht.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { KRAFTMARKEN, MUSCLEUP_STUFEN } from '../kern/wissen.js';

const lebensmittel = JSON.parse(
  await readFile(new URL('../kern/lebensmittel.json', import.meta.url), 'utf8'));

test('Lebensmitteldatenbank ist lesbar und plausibel', () => {
  assert.ok(lebensmittel.lebensmittel.length > 50);
  for (const l of lebensmittel.lebensmittel) {
    assert.ok(l.name && typeof l.kcal === 'number', `Fehlerhafter Eintrag: ${l.name}`);
    // Kalorien müssen ungefähr zu den Makros passen – fängt Tippfehler ab.
    // Alkohol liefert 7 kcal/g und ist kein Makro, das der Tracker steuert;
    // für die Plausibilität muss er trotzdem mitgerechnet werden.
    const gerechnet = l.protein * 4 + l.kohlenhydrate * 4 + l.fett * 9 + (l.alkohol || 0) * 7;
    if (l.kcal > 30) {
      const abweichung = Math.abs(gerechnet - l.kcal) / l.kcal;
      assert.ok(abweichung < 0.25,
        `${l.name}: ${l.kcal} kcal angegeben, ${Math.round(gerechnet)} kcal aus Makros`);
    }
  }
});

/* ------------------------------------------------------------ Dateiserver */

const { server } = await import('../server/index.js');
let basis;

test.before(async () => {
  await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig));
  basis = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('Die Oberfläche wird ausgeliefert', async () => {
  const antwort = await fetch(`${basis}/`);
  assert.equal(antwort.status, 200);
  const text = await antwort.text();
  assert.match(text, /Trainingstracker/);
  assert.match(text, /app\/app\.js/, 'der Einstiegspunkt muss stimmen');
});

/** Die Dateiliste aus sw.js, ohne den Einstieg "./". */
async function vorratsListe() {
  const sw = await (await fetch(`${basis}/sw.js`)).text();
  const block = sw.slice(sw.indexOf('const DATEIEN = ['), sw.indexOf('];'));
  return [...block.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
}

test('Alle Dateien, die der Service Worker vorhält, gibt es auch', async () => {
  // Ein Tippfehler in der Liste bliebe sonst unbemerkt, bis jemand offline ist.
  const dateien = await vorratsListe();
  assert.ok(dateien.length > 20, `nur ${dateien.length} Einträge gefunden`);
  for (const d of dateien) {
    assert.equal((await fetch(`${basis}/${d}`)).status, 200, `${d} fehlt`);
  }
});

test('Und umgekehrt: keine Datei der App fehlt in der Liste', async () => {
  // Die härtere Richtung. Wer ein neues Modul anlegt und es hier vergisst,
  // merkt davon nichts – bis jemand ohne Empfang die App öffnet und sie hängt.
  // Genau die Sorte Fehler, die dieses Projekt schon mehrfach hatte: Sie fällt
  // erst dort auf, wo man sie am wenigsten gebrauchen kann.
  const gelistet = new Set(await vorratsListe());
  const { readdir } = await import('node:fs/promises');
  const wurzel = new URL('../', import.meta.url);

  const fehlend = [];
  for (const ordner of ['app', 'kern']) {
    for (const name of await readdir(new URL(ordner, wurzel))) {
      if (!/\.(js|css|json|svg|png)$/.test(name)) continue;
      if (!gelistet.has(`${ordner}/${name}`)) fehlend.push(`${ordner}/${name}`);
    }
  }
  assert.deepEqual(fehlend, [], `nicht offline verfügbar: ${fehlend.join(', ')}`);
});

test('Das Manifest macht die App installierbar', async () => {
  const m = await (await fetch(`${basis}/manifest.webmanifest`)).json();
  assert.equal(m.display, 'standalone', 'sonst startet sie mit Browserleiste');
  assert.ok(m.name && m.short_name);
  assert.ok(m.icons.length >= 1);
  for (const symbol of m.icons) {
    assert.equal((await fetch(`${basis}/${symbol.src}`)).status, 200, `${symbol.src} fehlt`);
  }
});

test('Kein Ausbrechen aus dem Projektverzeichnis', async () => {
  for (const pfad of ['/../package.json', '/data/tagebuch.json', '/.git/config', '/CLAUDE.md']) {
    const antwort = await fetch(`${basis}${pfad}`);
    assert.equal(antwort.status, 404, `${pfad} darf nicht ausgeliefert werden`);
  }
});

/* ------------------------------------------------------------- Navigation */

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appJs = await readFile(new URL('../app/app.js', import.meta.url), 'utf8');

const quellen = new Map();
for (const n of ['heute', 'essen', 'fortschritt', 'profilAnsicht', 'protokoll']) {
  quellen.set(`app/${n}.js`, await readFile(new URL(`../app/${n}.js`, import.meta.url), 'utf8'));
}
const quellText = (name) => quellen.get(name);

test('Jeder Reiter zeigt auf eine Ansicht, die es gibt', () => {
  // Ein Reiter ohne Ansicht führt ins Leere, eine Ansicht ohne Reiter ist nur
  // über die Adresszeile erreichbar. Beides fällt beim Klicken auf, aber erst
  // nach dem Ausliefern.
  const reiter = [...indexHtml.matchAll(/data-ansicht="([a-z]+)"/g)].map((m) => m[1]);
  const ansichten = [...appJs.matchAll(/^ {2}([a-z]+): \w+Ansicht,$/gm)].map((m) => m[1]);

  assert.ok(reiter.length >= 6, `nur ${reiter.length} Reiter gefunden`);
  assert.deepEqual([...reiter].sort(), [...ansichten].sort());
});

test('Die Reitersymbole sind gezeichnet, nicht getippt', () => {
  // Vorher standen dort ◉ ▤ ◍ ◭ ◐ ◈ – Glyphen aus dem Zeichensatz, die je nach
  // Gerät unterschiedlich groß und dick ausfallen und auf iOS teils bunt
  // gerendert werden. Wer sie versehentlich wieder durch ein Zeichen ersetzt,
  // merkt es am eigenen Rechner nicht.
  const symbole = [...indexHtml.matchAll(/<span class="reiter-symbol">([\s\S]*?)<\/span>/g)]
    .map((m) => m[1]);

  assert.ok(symbole.length >= 6, `nur ${symbole.length} Symbole gefunden`);
  for (const s of symbole) {
    assert.match(s, /^<svg /, `kein SVG: „${s.slice(0, 30)}"`);
    // `currentColor` statt fester Farbe – sonst tragen die Symbole die
    // Zustände des Reiters nicht mit.
    assert.match(s, /currentColor/, 'Symbol trägt eine feste Farbe');
    assert.match(s, /aria-hidden="true"/, 'Symbol ohne aria-hidden');
  }
});

test('Kein Zahlenfeld akzeptiert Nachkommastellen', () => {
  // `type="number"` kennt als Dezimaltrenner nur den Punkt und verwirft ein
  // Komma stillschweigend: Der Wert kommt als leerer String an und wird zu 0.
  // In einer deutschen App ist das stiller Datenverlust – „162,5 kcal" stand
  // als 0 kcal im Tagebuch. Wo Nachkommastellen vorkommen können, gehört
  // `dezimalFeld()` hin; `type="number"` bleibt den ganzen Zahlen vorbehalten
  // (Wiederholungen, Minuten, Puls, Geburtsjahr).
  //
  // Erkennbar ist der Fehlgriff am `step` oder am `inputmode`: Beides deutet
  // an, dass hier etwas mit Komma erwartet wird.
  const dateien = ['app/heute.js', 'app/essen.js', 'app/fortschritt.js',
    'app/profilAnsicht.js', 'app/protokoll.js'];

  for (const name of dateien) {
    const quelle = quellText(name);
    for (const [, feld] of quelle.matchAll(/el\('input', \{([^}]*type: 'number'[^}]*)\}/g)) {
      const bruchStep = /step: '0?\.\d/.test(feld);
      const dezimal = /inputmode: 'decimal'/.test(feld);
      assert.ok(!bruchStep && !dezimal,
        `${name}: type="number" mit Nachkommastellen – ${feld.trim().slice(0, 70)}`);
    }
  }
});

test('Die Kraftmarken stehen nur in wissen.js', () => {
  // Wiederkehrende Aufräumaufgabe, diesmal als Test: In app/fortschritt.js
  // stand die komplette Markentabelle noch einmal, dazu eine zweite
  // `einordnung()` mit denselben Schwellen – direkt unter einem Kommentar, der
  // davor warnt, dass eine zweite eigene Rechnung irgendwann abweicht.
  // Verlockt hatte die Datenform: `quelle` lag zwischen den Übungen, also gab
  // `Object.entries()` eine Zeile „quelle" mit aus. Jetzt liegen die Übungen
  // unter `uebungen`, und hier steht der Wächter dagegen.
  for (const [name, quelle] of quellen) {
    for (const [uebung, marken] of Object.entries(KRAFTMARKEN.uebungen)) {
      const zahlen = Object.values(marken);
      const treffer = zahlen.filter((z) => new RegExp(`\\b${String(z).replace('.', '\\.')}\\b`)
        .test(quelle));
      assert.ok(treffer.length < zahlen.length,
        `${name} enthält alle Marken von „${uebung}" (${zahlen.join(', ')}) – `
        + 'sieht nach einer Kopie aus wissen.js aus');
    }
  }
});

test('Die Muscle-Up-Stufen stehen nur in wissen.js', () => {
  // Dieselbe Kopie gab es für die Stufenliste. Sie fiel erst auf, als die
  // Prüfung von Stufe 9 in wissen.js geändert wurde und die Oberfläche
  // weiterhin ihre eigene Fassung zeichnete.
  for (const [name, quelle] of quellen) {
    const tore = MUSCLEUP_STUFEN.filter((s) => quelle.includes(s.tor));
    assert.ok(tore.length <= 1,
      `${name} führt ${tore.length} Stufentore wörtlich – MUSCLEUP_STUFEN gehört importiert, `
      + `nicht abgeschrieben (${tore.map((s) => s.stufe).join(', ')})`);
  }
});

test('Aufschriften aus dem Kern werden nicht in der Oberfläche nachgebaut', () => {
  // Dritter Fall derselben Familie. `gruppenName()` in kern/sprint.js und
  // `verlaufName()` in kern/ausdauer.js rief **niemand** auf – gefunden über
  // die Frage aus Falle 21, wer eine Kernfunktion eigentlich benutzt. Beide
  // waren in app/fortschritt.js nachgebaut, die Sprintaufschrift sogar an drei
  // Stellen. Und die Kopie war schon abgewichen: Eine Einheit ohne Puls und
  // ohne brauchbares RPE bekommt den Schlüssel `rad-unbekannt`, worauf die
  // Oberfläche wörtlich „Rad · unbekannt" schrieb – ein interner Schlüssel als
  // deutsche Überschrift, wo die Kernfunktion „ohne Zone" sagt.
  const bausteine = [
    ["'fliegend' : 'aus dem Stand'", 'gruppenName() aus kern/sprint.js'],
    ['?.name || zone', 'verlaufName() aus kern/ausdauer.js'],
  ];
  for (const [name, quelle] of quellen) {
    for (const [muster, statt] of bausteine) {
      assert.ok(!quelle.includes(muster),
        `${name} setzt eine Aufschrift selbst zusammen („${muster}") – ${statt} gehört importiert`);
    }
  }
});

test('Jede Verlaufskurve entscheidet ausdrücklich über ihre Wertung', () => {
  // Falle 7: `linienDiagramm` schreibt standardmäßig „besser geworden", sobald
  // es aufwärts geht. Für eine Sprintzeit ist das falsch herum, für Ruhepuls
  // und Wochenlast ist es gar keine Frage von besser – und für die Tempokurve
  // hängt es an der Zone: In der harten heißt schneller besser, in der
  // lockeren eher, dass die Einheit nicht mehr locker war. Genau davor warnt
  // dieselbe Ansicht ein paar Zeilen weiter oben.
  //
  // Geprüft wird deshalb nicht der richtige Wert – den kennt nur, wer die
  // Größe kennt –, sondern dass überhaupt eine Entscheidung getroffen wurde.
  // Wer eine Kurve ergänzt und nichts angibt, bekommt hier einen Hinweis
  // statt später ein falsches Lob im Screenshot.
  const quelle = readFileSync(new URL('../app/fortschritt.js', import.meta.url), 'utf8');
  const aufrufe = [...quelle.matchAll(/linienDiagramm\(/g)];
  assert.ok(aufrufe.length >= 5, `nur ${aufrufe.length} Kurven gefunden – Muster geändert?`);

  for (const treffer of aufrufe) {
    // Der Optionsblock steht innerhalb der nächsten paar Zeilen.
    const ausschnitt = quelle.slice(treffer.index, treffer.index + 400);
    const bisEnde = ausschnitt.slice(0, ausschnitt.indexOf('}));') + 1);
    assert.match(bisEnde, /wertung:|kleinerIstBesser:/,
      `Eine Kurve ohne Angabe zur Wertung: ${bisEnde.split('\n')[0].trim()}`);
  }
});

test('Die Quellenliste bleibt zusammengeklappt', () => {
  // Ausgeschrieben waren die 28 Arbeiten 6.649 px – sieben iPhone-Bildschirme
  // reiner Fließtext in *einer* Karte, ohne Zwischenüberschrift. Die ganze
  // Ansicht kam auf 11,4 Bildschirme. Wer nachschlagen will, wo eine Zahl
  // herkommt, scrollt daran vorbei statt sie zu finden.
  //
  // `<details>` löst das ohne Abhängigkeit und ohne JavaScript. Die
  // Zusammenfassung ist dabei die Tippfläche und muss die 44 Pixel halten wie
  // alles Antippbare in dieser App.
  const ansicht = readFileSync(new URL('../app/wissenAnsicht.js', import.meta.url), 'utf8');
  assert.match(ansicht, /el\('details'/, 'die Quellen gehören zusammengeklappt');
  assert.match(ansicht, /el\('summary'/, 'mit einer Kurzangabe als Zusammenfassung');

  const css = readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');
  const regel = css.slice(css.indexOf('.quelle-karte > summary {'));
  assert.match(regel.slice(0, 300), /min-height:\s*var\(--tipp\)/,
    'die Zusammenfassung ist antippbar und braucht die Mindesthöhe');
});
