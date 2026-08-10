// Die mitgelieferten Daten und der Dateiserver.
//
// Die Lebensmitteltabelle ist von Hand gepflegt – genau dort passieren
// Zahlendreher, und die fallen sonst erst auf, wenn ein Tagesbedarf unsinnig
// aussieht.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
