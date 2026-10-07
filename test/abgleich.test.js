import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  zusammenfuehren, gleicherInhalt, vergleichsform, schluesselLesen, gistAuswaehlen, GIST_DATEI,
} from '../kern/abgleich.js';
import { leeresTagebuch } from '../kern/aendern.js';
import * as aendern from '../kern/aendern.js';

const kopie = (x) => structuredClone(x);

function bestand(teile = {}) {
  return { ...leeresTagebuch(), ...kopie(teile) };
}

const einheit = (id, datum, minuten = 60) => ({ id, datum, typ: 'kraft', minuten, rpe: 7 });

test('Ohne entfernten Stand bleibt der eigene und wird gesendet', () => {
  const lokal = bestand({ sessions: [einheit('s1', '2026-09-01')] });
  const z = zusammenfuehren(null, lokal, null);
  assert.equal(z.stand, lokal);
  assert.equal(z.gesendet, true);
  assert.equal(z.geholt, false);
});

test('Erster Abgleich vereinigt – auf keiner Seite geht etwas verloren', () => {
  const lokal = bestand({ sessions: [einheit('s1', '2026-09-01')],
    checks: [{ datum: '2026-09-01', schlaf: 4 }] });
  const entfernt = bestand({ sessions: [einheit('s2', '2026-09-02')],
    gewicht: [{ datum: '2026-09-02', kg: 78 }] });
  const z = zusammenfuehren(null, lokal, entfernt);
  // Erst die Folge des Gists, dann das Neue dieses Geräts.
  assert.deepEqual(z.stand.sessions.map((s) => s.id), ['s2', 's1']);
  assert.equal(z.stand.checks.length, 1);
  assert.equal(z.stand.gewicht.length, 1);
  assert.equal(z.geholt, true);
  assert.equal(z.gesendet, true);
  assert.equal(z.konflikte, 0);
});

test('Ein frisches Gerät überstimmt mit seinen Vorgaben nicht das ausgefüllte Profil', () => {
  // Das zweite Gerät hat nie etwas eingetragen; sein Profil steht auf den
  // Voreinstellungen. Ohne die Voreinstellung als Basis gälte jedes Feld als
  // Konflikt, und Regler 30 schlüge den eingestellten Regler 55.
  const lokal = bestand();
  const entfernt = bestand({ profil: { ...leeresTagebuch().profil, gewichtKg: 78.3,
    ausrichtung: 55, startdatum: '2026-08-03' } });
  const z = zusammenfuehren(null, lokal, entfernt);
  assert.equal(z.stand.profil.gewichtKg, 78.3);
  assert.equal(z.stand.profil.ausrichtung, 55);
  assert.equal(z.stand.profil.startdatum, '2026-08-03');
  assert.equal(z.konflikte, 0);
});

test('Eine Löschung auf einem Gerät erreicht das andere', () => {
  const basis = bestand({ sessions: [einheit('s1', '2026-09-01'), einheit('s2', '2026-09-02')] });
  const lokal = kopie(basis);
  lokal.sessions = lokal.sessions.filter((s) => s.id !== 's1');
  const entfernt = kopie(basis);
  const z = zusammenfuehren(basis, lokal, entfernt);
  assert.deepEqual(z.stand.sessions.map((s) => s.id), ['s2']);
  assert.equal(z.gesendet, true);
  assert.equal(z.geholt, false);

  // Und andersherum: drüben gelöscht, hier unverändert.
  const z2 = zusammenfuehren(basis, kopie(basis), lokal);
  assert.deepEqual(z2.stand.sessions.map((s) => s.id), ['s2']);
  assert.equal(z2.geholt, true);
});

test('Gelöscht gegen geändert: die Änderung bleibt, und das wird gezählt', () => {
  const basis = bestand({ essen: [{ id: 'f1', datum: '2026-09-01', name: 'Quark', mengeG: 250 }] });
  const lokal = bestand({ essen: [] });
  const entfernt = kopie(basis);
  entfernt.essen[0].mengeG = 300;
  const z = zusammenfuehren(basis, lokal, entfernt);
  assert.equal(z.stand.essen.length, 1);
  assert.equal(z.stand.essen[0].mengeG, 300);
  assert.equal(z.konflikte, 1);
  // Gegenrichtung
  const z2 = zusammenfuehren(basis, entfernt, lokal);
  assert.equal(z2.stand.essen[0].mengeG, 300);
  assert.equal(z2.konflikte, 1);
});

test('Beide verschieden geändert: mit Basis gilt dieses Gerät, ohne Basis das Gist', () => {
  const basis = bestand({ tests: [{ id: 't1', datum: '2026-09-01', art: 'kniebeuge', wert: 100 }] });
  const lokal = kopie(basis); lokal.tests[0].wert = 105;
  const entfernt = kopie(basis); entfernt.tests[0].wert = 110;
  const mit = zusammenfuehren(basis, lokal, entfernt);
  assert.equal(mit.stand.tests[0].wert, 105);
  assert.equal(mit.konflikte, 1);
  const ohne = zusammenfuehren(null, lokal, entfernt);
  assert.equal(ohne.stand.tests[0].wert, 110);
  assert.equal(ohne.konflikte, 1);
});

test('Ein Tag, ein Check – auch über zwei Geräte', () => {
  // Morgens am Handy, später am Laptop noch einmal: Das ist derselbe Check in
  // zwei Fassungen, kein zweiter. Sonst brächte der Abgleich die Doppelten
  // zurück, die die Leser seit Falle 88 abfangen müssen.
  const basis = bestand();
  const lokal = bestand({ checks: [{ datum: '2026-09-03', schlaf: 2 }] });
  const entfernt = bestand({ checks: [{ datum: '2026-09-03', schlaf: 4 }] });
  const z = zusammenfuehren(basis, lokal, entfernt);
  assert.equal(z.stand.checks.length, 1);
  assert.equal(z.stand.checks[0].schlaf, 2);
  assert.equal(z.konflikte, 1);
});

test('Der Gewichtsverlauf bleibt nach Datum sortiert', () => {
  const lokal = bestand({ gewicht: [{ datum: '2026-09-01', kg: 78 }, { datum: '2026-09-05', kg: 78.4 }] });
  const entfernt = bestand({ gewicht: [{ datum: '2026-09-03', kg: 78.1 }] });
  const z = zusammenfuehren(null, lokal, entfernt);
  assert.deepEqual(z.stand.gewicht.map((g) => g.datum), ['2026-09-01', '2026-09-03', '2026-09-05']);
});

test('Die Reihenfolge der Felder ist kein Unterschied', () => {
  const a = { id: 's1', datum: '2026-09-01', minuten: 60 };
  const b = { minuten: 60, datum: '2026-09-01', id: 's1' };
  assert.equal(vergleichsform(a), vergleichsform(b));
  const basis = bestand({ sessions: [a] });
  const z = zusammenfuehren(basis, bestand({ sessions: [a] }), bestand({ sessions: [b] }));
  assert.equal(z.konflikte, 0);
  assert.equal(z.geholt, false);
  assert.equal(z.gesendet, false);
});

test('Muscle-Up-Bestätigungen werden je Stufe zusammengeführt', () => {
  const basis = bestand();
  const lokal = bestand({ muscleup: { manuell: { 4: true } } });
  const entfernt = bestand({ muscleup: { manuell: { 5: true } } });
  const z = zusammenfuehren(basis, lokal, entfernt);
  assert.deepEqual(z.stand.muscleup.manuell, { 4: true, 5: true });
});

test('Das Profil wird feldweise zusammengeführt', () => {
  const basis = bestand();
  const lokal = kopie(basis); lokal.profil.gewichtKg = 79;
  const entfernt = kopie(basis); entfernt.profil.ausrichtung = 40;
  const z = zusammenfuehren(basis, lokal, entfernt);
  assert.equal(z.stand.profil.gewichtKg, 79);
  assert.equal(z.stand.profil.ausrichtung, 40);
  assert.equal(z.konflikte, 0);
});

test('Was zum Gerät gehört, ist kein Inhalt', () => {
  const a = bestand();
  const b = { ...kopie(a), angelegt: '2020-01-01T00:00:00.000Z' };
  assert.equal(gleicherInhalt(a, b), true);
  const z = zusammenfuehren(kopie(a), a, b);
  assert.equal(z.gesendet, false);
  assert.equal(z.geholt, false);
});

test('Das Ergebnis besteht die Importprüfung', () => {
  const lokal = bestand({ sessions: [einheit('s1', '2026-09-01')] });
  const entfernt = bestand({ essen: [{ id: 'f1', datum: '2026-09-01', name: 'Reis', mengeG: 100 }] });
  const { stand } = zusammenfuehren(null, lokal, entfernt);
  assert.doesNotThrow(() => aendern.pruefeImport(kopie(stand)));
});

/*
 * Die Eigenschaft hinter allem: Zwei Geräte arbeiten unabhängig weiter und
 * gleichen in beliebiger Folge ab. Am Ende müssen beide denselben Stand haben,
 * und jeder Eintrag, den irgendwer angelegt und niemand gelöscht hat, muss
 * darin stehen. Gebaut wie die Geräte es tun – Basis ist, was nach dem
 * letzten Abgleich im Gist stand.
 */
test('Zwei Geräte laufen zusammen und verlieren nichts', () => {
  let zufall = 7;
  const wurf = (n) => { zufall = (zufall * 1103515245 + 12345) % 2147483648; return zufall % n; };

  for (let lauf = 0; lauf < 200; lauf += 1) {
    const geraete = [
      { daten: leeresTagebuch(), basis: null },
      { daten: leeresTagebuch(), basis: null },
    ];
    let repo = null;
    const angelegt = new Set();
    const geloescht = new Set();
    let naechste = 0;

    const abgleichen = (g) => {
      const z = zusammenfuehren(g.basis, g.daten, repo);
      g.daten = kopie(z.stand);
      repo = kopie(z.stand);
      g.basis = kopie(z.stand);
    };

    for (let schritt = 0; schritt < 30; schritt += 1) {
      const g = geraete[wurf(2)];
      const art = wurf(5);
      if (art === 0 || g.daten.sessions.length === 0) {
        const id = `s${naechste += 1}`;
        g.daten.sessions.push(einheit(id, `2026-09-${String(1 + wurf(28)).padStart(2, '0')}`));
        angelegt.add(id);
      } else if (art === 1) {
        const opfer = g.daten.sessions[wurf(g.daten.sessions.length)];
        g.daten.sessions = g.daten.sessions.filter((s) => s !== opfer);
        geloescht.add(opfer.id);
      } else if (art === 2) {
        const s = g.daten.sessions[wurf(g.daten.sessions.length)];
        s.minuten = 30 + wurf(90);
      } else {
        abgleichen(g);
      }
    }
    // Zum Schluss beide zweimal abgleichen: Danach muss Ruhe sein.
    abgleichen(geraete[0]); abgleichen(geraete[1]); abgleichen(geraete[0]);

    assert.equal(gleicherInhalt(geraete[0].daten, geraete[1].daten), true, `Lauf ${lauf}`);
    const ids = new Set(geraete[0].daten.sessions.map((s) => s.id));
    for (const id of angelegt) {
      // Gelöscht gegen geändert lässt einen gelöschten Eintrag absichtlich
      // stehen; verschwinden darf nur, was jemand gelöscht hat.
      if (!geloescht.has(id)) assert.ok(ids.has(id), `Lauf ${lauf}: ${id} verloren`);
    }
    assert.equal(ids.size, geraete[0].daten.sessions.length, `Lauf ${lauf}: doppelte Einträge`);
    // Und ein weiterer Abgleich ändert nichts mehr.
    const z = zusammenfuehren(geraete[1].basis, geraete[1].daten, repo);
    assert.equal(z.geholt || z.gesendet, false, `Lauf ${lauf}: kommt nicht zur Ruhe`);
  }
});

test('Die Gegenprobe: Ohne Basis würde eine Löschung zurückkommen', () => {
  // Damit die Eigenschaft oben nicht zufällig hält: Wer die Basis wegwirft,
  // bekommt den gelöschten Eintrag zurück – genau das, was nach dem
  // Einspielen einer Sicherung gewollt ist und sonst nicht.
  const basis = bestand({ sessions: [einheit('s1', '2026-09-01')] });
  const lokal = bestand();
  const mit = zusammenfuehren(basis, lokal, kopie(basis));
  const ohne = zusammenfuehren(null, lokal, kopie(basis));
  assert.equal(mit.stand.sessions.length, 0);
  assert.equal(ohne.stand.sessions.length, 1);
});

test('Ein Schlüssel wird beim Einfügen geprüft, nicht erst bei GitHub', () => {
  assert.equal(schluesselLesen('  ghp_abcdefghijklmnopqrstuvwxyz0123  '), 'ghp_abcdefghijklmnopqrstuvwxyz0123');
  assert.equal(schluesselLesen('github_pat_11ABCDEFG0123456789_abcdef'), 'github_pat_11ABCDEFG0123456789_abcdef');
  assert.throws(() => schluesselLesen(''), /fehlt/);
  assert.throws(() => schluesselLesen(null), /fehlt/);
  // Beim Kopieren abgeschnitten oder mit Zeilenumbruch eingefügt.
  assert.throws(() => schluesselLesen('ghp_abc'), /vollständigen/);
  assert.throws(() => schluesselLesen('ghp_abcdefghij klmnopqrstuvwxyz'), /vollständigen/);
  // Die Grenze selbst: zwanzig Zeichen gehen durch, neunzehn nicht.
  assert.equal(schluesselLesen('x'.repeat(20)), 'x'.repeat(20));
  assert.throws(() => schluesselLesen('x'.repeat(19)), /vollständigen/);
});

test('Das Gist des Trackers wird am Dateinamen erkannt, bei zweien gilt das älteste', () => {
  const g = (id, created_at, datei) => ({ id, created_at, files: { [datei]: {} } });
  const liste = [
    g('jung', '2026-10-07T10:00:00Z', GIST_DATEI),
    g('deutsch', '2026-01-01T00:00:00Z', 'deutschtrainer-lernstand.json'),
    g('alt', '2026-10-06T10:00:00Z', GIST_DATEI),
    null,
    { id: 'ohneDateien' },
  ];
  assert.equal(gistAuswaehlen(liste), 'alt');
  // Die Reihenfolge der Antwort darf die Wahl nicht ändern – sonst gleichen
  // zwei Geräte mit zwei verschiedenen Gists ab.
  assert.equal(gistAuswaehlen([...liste].reverse()), 'alt');
  assert.equal(gistAuswaehlen([liste[1]]), null);
  assert.equal(gistAuswaehlen(null), null);
  // Gleich alt: Die Kennung entscheidet, damit es keine Rolle spielt, wer fragt.
  const gleich = [g('b', '2026-10-06T10:00:00Z', GIST_DATEI), g('a', '2026-10-06T10:00:00Z', GIST_DATEI)];
  assert.equal(gistAuswaehlen(gleich), 'a');
  assert.equal(gistAuswaehlen([...gleich].reverse()), 'a');
});
