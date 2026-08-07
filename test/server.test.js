// Ende-zu-Ende über echtes HTTP. Der Zustandsaufruf ist der wichtigste
// Einzelaufruf der App – wenn der stimmt, steht die ganze Oberfläche.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rm } from 'node:fs/promises';

process.env.NODE_ENV = 'test';
process.env.TRACKER_DATEI = path.join(tmpdir(), `tracker-test-${process.pid}.json`);

const { server } = await import('../server/index.js');
const store = await import('../server/store.js');

let basis;

test.before(async () => {
  await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig));
  basis = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await rm(process.env.TRACKER_DATEI, { force: true });
  await rm(`${process.env.TRACKER_DATEI}.tmp`, { force: true });
});

async function hole(pfad) {
  const antwort = await fetch(`${basis}${pfad}`);
  return { status: antwort.status, daten: await antwort.json() };
}

async function sende(pfad, daten, methode = 'POST') {
  const antwort = await fetch(`${basis}${pfad}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(daten),
  });
  return { status: antwort.status, daten: await antwort.json() };
}

test('Oberfläche wird ausgeliefert', async () => {
  const antwort = await fetch(`${basis}/`);
  assert.equal(antwort.status, 200);
  assert.match(antwort.headers.get('content-type'), /text\/html/);
  assert.match(await antwort.text(), /Trainingstracker/);
});

test('Unbekannte Pfade geben 404, kein Serverfehler', async () => {
  const antwort = await fetch(`${basis}/gibtsnicht.js`);
  assert.equal(antwort.status, 404);
});

test('Kein Ausbrechen aus dem public-Verzeichnis', async () => {
  const antwort = await fetch(`${basis}/../server/store.js`);
  assert.ok(antwort.status === 404 || antwort.status === 400,
    `Statuscode ${antwort.status} – Datei außerhalb von public darf nicht ausgeliefert werden`);
});

test('Zustand kommt auch bei leerem Profil vollständig zurück', async () => {
  const { status, daten } = await hole('/api/zustand');
  assert.equal(status, 200);
  assert.ok(daten.plan.tage.length === 7);
  assert.equal(daten.profilStatus.vollstaendig, false);
  assert.equal(daten.heute.makro, null, 'ohne Körperdaten keine Makros');
  assert.ok(daten.muscleup);
  assert.ok(daten.belastung.acwr);
});

test('Profil speichern schaltet die Ernährungsrechnung frei', async () => {
  const gespeichert = await sende('/api/profil', {
    geburtsjahr: 1997, groesseCm: 183, gewichtKg: 80,
    koerperfettProzent: 12, ausrichtung: 25, trainingstageProWoche: 4,
  }, 'PUT');
  assert.equal(gespeichert.status, 200);
  assert.equal(gespeichert.daten.gewichtKg, 80);

  const { daten } = await hole('/api/zustand');
  assert.equal(daten.profilStatus.vollstaendig, true);
  assert.ok(daten.heute.bedarf.grundumsatz > 1500);
  assert.equal(daten.heute.bedarf.grundumsatzFormel, 'Cunningham');
  assert.ok(daten.heute.makro.protein > 100);
});

test('Zahlen aus Formularen werden als Zahlen abgelegt', async () => {
  const { daten } = await sende('/api/profil', { gewichtKg: '82.5', ausrichtung: '40' }, 'PUT');
  assert.equal(typeof daten.gewichtKg, 'number');
  assert.equal(daten.gewichtKg, 82.5);
  assert.equal(daten.ausrichtung, 40);
});

test('Gewichtsänderung landet im Verlauf', async () => {
  await sende('/api/profil', { gewichtKg: 81 }, 'PUT');
  const { daten } = await hole('/api/zustand');
  assert.ok(daten.gewichtsverlauf.length >= 1);
  assert.equal(daten.gewichtsverlauf[daten.gewichtsverlauf.length - 1].kg, 81);
});

test('Gewicht lässt sich für vergangene Tage nachtragen', async () => {
  await sende('/api/gewicht', { kg: 79.5, datum: '2026-07-01' });
  await sende('/api/gewicht', { kg: 79.0, datum: '2026-07-15' });
  const { daten } = await hole('/api/zustand');
  const daten1 = daten.gewichtsverlauf.find((g) => g.datum === '2026-07-01');
  assert.equal(daten1.kg, 79.5);
  // Chronologisch sortiert, sonst zeichnet die Kurve Zickzack.
  const datumsListe = daten.gewichtsverlauf.map((g) => g.datum);
  assert.deepEqual(datumsListe, [...datumsListe].sort());
});

test('Zweites Wiegen am selben Tag ersetzt das erste', async () => {
  await sende('/api/gewicht', { kg: 80.0, datum: '2026-07-20' });
  await sende('/api/gewicht', { kg: 80.4, datum: '2026-07-20' });
  const { daten } = await hole('/api/zustand');
  const treffer = daten.gewichtsverlauf.filter((g) => g.datum === '2026-07-20');
  assert.equal(treffer.length, 1);
  assert.equal(treffer[0].kg, 80.4);
});

test('Gewicht ohne Wert wird abgelehnt', async () => {
  const { status } = await sende('/api/gewicht', { datum: '2026-07-20' });
  assert.equal(status, 400);
});

test('Einheit eintragen berechnet die Belastung mit', async () => {
  const { status, daten } = await sende('/api/session', {
    typ: 'sprint', minuten: 70, rpe: 8, notiz: 'Fliegende 30er liefen gut',
  });
  assert.equal(status, 201);
  assert.equal(daten.last, 560);
  assert.ok(daten.id);
});

test('Einheit ohne Pflichtfelder wird abgelehnt', async () => {
  const { status, daten } = await sende('/api/session', { notiz: 'nur Text' });
  assert.equal(status, 400);
  assert.ok(daten.fehler);
});

test('Essen eintragen und wieder löschen', async () => {
  const angelegt = await sende('/api/essen', {
    name: 'Magerquark', mengeG: 500, mahlzeit: 'abend',
    kcal: 67, protein: 12, kohlenhydrate: 4, fett: 0.3,
  });
  assert.equal(angelegt.status, 201);

  const mit = await hole('/api/zustand');
  assert.equal(mit.daten.heute.ist.protein, 60); // 12 g × 5

  const geloescht = await fetch(`${basis}/api/essen/${angelegt.daten.id}`, { method: 'DELETE' });
  assert.equal(geloescht.status, 200);

  const ohne = await hole('/api/zustand');
  assert.equal(ohne.daten.heute.ist.protein, 0);
});

test('Morgen-Check ersetzt einen bestehenden Eintrag desselben Tages', async () => {
  await sende('/api/check', { schlaf: 2, muskelkater: 2, stress: 2, stimmung: 2, energie: 2 });
  const zweiter = await sende('/api/check', {
    schlaf: 5, muskelkater: 5, stress: 5, stimmung: 5, energie: 5,
  });
  assert.equal(zweiter.daten.bereitschaft.ampel, 'gruen');

  const { daten } = await hole('/api/zustand');
  assert.equal(daten.heute.bereitschaft.prozent, 100);
});

test('Tests eintragen treibt den Muscle-Up-Weg voran', async () => {
  await sende('/api/test', { art: 'klimmzuege', wert: 12 });
  const { daten } = await hole('/api/zustand');
  assert.equal(daten.muscleup.erreicht, 2);
  assert.equal(daten.muscleup.naechste.name, 'Zusatzlast');
});

test('Manuelle Stufen lassen sich bestätigen', async () => {
  await sende('/api/test', { art: 'klimmzugZusatzlast', wert: 25 }); // >25 % von 81 kg? nein
  await sende('/api/test', { art: 'klimmzugZusatzlast', wert: 21 });
  const { daten } = await sende('/api/muscleup', { stufe: 4, erreicht: true });
  // Stufe 3 verlangt 25 % von 81 kg = 20,25 kg – mit 25 kg erfüllt.
  assert.ok(daten.erreicht >= 4, `Stand ${daten.erreicht}`);
});

test('Plan lässt sich für beliebige Wochen abrufen', async () => {
  const { daten } = await hole('/api/plan?woche=4');
  assert.equal(daten.woche, 4);
  assert.equal(daten.entlastungswoche, true);
});

test('Wissensbestand wird ausgeliefert', async () => {
  const { daten } = await hole('/api/wissen');
  assert.ok(Object.keys(daten.quellen).length > 10);
  assert.ok(daten.supplemente.some((s) => s.name === 'Kreatin-Monohydrat'));
  for (const quelle of Object.values(daten.quellen)) {
    assert.ok(quelle.kurz && quelle.kern && quelle.guete,
      `Quelle unvollständig: ${JSON.stringify(quelle)}`);
  }
});

test('Lebensmitteldatenbank ist lesbar und plausibel', async () => {
  const { daten } = await hole('/api/lebensmittel');
  assert.ok(daten.lebensmittel.length > 50);
  for (const l of daten.lebensmittel) {
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

test('Export liefert das ganze Tagebuch', async () => {
  const antwort = await fetch(`${basis}/api/export`);
  assert.equal(antwort.status, 200);
  const daten = await antwort.json();
  assert.ok(Array.isArray(daten.sessions));
  assert.ok(daten.profil.gewichtKg);
});

test('Import weist Fremdformate ab', async () => {
  const { status } = await sende('/api/import', { irgendwas: true });
  assert.equal(status, 400);
});

test('Unbekannte API-Aufrufe geben 404', async () => {
  const { status } = await hole('/api/gibtsnicht');
  assert.equal(status, 404);
});

test('Daten überleben einen Neustart', async () => {
  await store.sichernJetzt();
  store.cacheLeeren();
  const daten = await store.laden();
  assert.equal(daten.profil.gewichtKg, 81);
  assert.ok(daten.sessions.length >= 1);
});
