// Die mitgelieferten Daten und der Dateiserver.
//
// Die Lebensmitteltabelle ist von Hand gepflegt – genau dort passieren
// Zahlendreher, und die fallen sonst erst auf, wenn ein Tagesbedarf unsinnig
// aussieht.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('Alle Dateien, die der Service Worker vorhält, gibt es auch', async () => {
  // Ein Tippfehler in der Liste bliebe sonst unbemerkt, bis jemand offline ist.
  const sw = await (await fetch(`${basis}/sw.js`)).text();
  const dateien = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(dateien.length > 20, `nur ${dateien.length} Einträge gefunden`);
  for (const d of dateien) {
    const antwort = await fetch(`${basis}/${d}`);
    assert.equal(antwort.status, 200, `${d} fehlt`);
  }
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
