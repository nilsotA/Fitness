// Datenablage im Browser.
//
// Früher lag der Bestand als JSON-Datei auf einem Rechner, jetzt in der
// IndexedDB des Geräts – dort als **ein** Datensatz, weil er als Ganzes gelesen
// und als Ganzes geschrieben wird. Eine Datenbank mit Tabellen und Abfragen
// wäre für ein Trainingstagebuch, das im Ganzen in den Speicher passt, nur
// zusätzliche Fehlerquelle.
//
// Warum IndexedDB und nicht localStorage: localStorage ist auf wenige Megabyte
// begrenzt, arbeitet synchron und wird von Browsern schneller weggeräumt.
// Ein Tagebuch, das über Jahre wachsen soll, gehört nicht dorthin.

import { leeresTagebuch, vervollstaendigen } from '../kern/aendern.js';

const DB_NAME = 'trainingstracker';
const SPEICHER = 'tagebuch';
const SCHLUESSEL = 'aktuell';

let db = null;
let cache = null;
let schreibTimer = null;

function oeffnen() {
  if (db) return Promise.resolve(db);
  return new Promise((erfuellen, ablehnen) => {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = () => {
      if (!anfrage.result.objectStoreNames.contains(SPEICHER)) {
        anfrage.result.createObjectStore(SPEICHER);
      }
    };
    anfrage.onsuccess = () => { db = anfrage.result; erfuellen(db); };
    anfrage.onerror = () => ablehnen(anfrage.error);
  });
}

function vorgang(modus, arbeit) {
  return oeffnen().then((datenbank) => new Promise((erfuellen, ablehnen) => {
    const t = datenbank.transaction(SPEICHER, modus);
    const anfrage = arbeit(t.objectStore(SPEICHER));
    anfrage.onsuccess = () => erfuellen(anfrage.result);
    anfrage.onerror = () => ablehnen(anfrage.error);
  }));
}

/**
 * Den Browser bitten, die Daten dauerhaft zu behalten.
 *
 * Ohne diese Bitte darf der Browser die Datenbank löschen, wenn der Speicher
 * knapp wird – bei einem Trainingstagebuch wäre das ein stiller Totalverlust.
 * Zugesagt wird es vor allem, wenn die App zum Startbildschirm hinzugefügt
 * wurde; deshalb steht der Hinweis dazu auch in der Oberfläche.
 */
export async function dauerhaftBitten() {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function istDauerhaft() {
  if (!navigator.storage?.persisted) return null;
  return navigator.storage.persisted();
}

export async function laden() {
  if (cache) return cache;
  try {
    const roh = await vorgang('readonly', (s) => s.get(SCHLUESSEL));
    cache = roh ? vervollstaendigen(roh) : leeresTagebuch();
  } catch {
    // Lieber mit einem leeren Tagebuch weiterarbeiten als gar nicht starten.
    cache = leeresTagebuch();
  }
  return cache;
}

async function schreiben() {
  if (!cache) return;
  await vorgang('readwrite', (s) => s.put(cache, SCHLUESSEL));
}

/**
 * Ändern und speichern. Das Schreiben wird kurz gebündelt: Beim Tippen im
 * Profil sonst ein Schreibvorgang je Tastendruck.
 */
export async function aendern(fn) {
  const daten = await laden();
  const ergebnis = fn(daten);
  clearTimeout(schreibTimer);
  schreibTimer = setTimeout(() => schreiben().catch(() => {}), 150);
  return ergebnis;
}

/** Sofort schreiben – vor dem Export und beim Verlassen der Seite. */
export async function jetztSchreiben() {
  clearTimeout(schreibTimer);
  await schreiben();
}

export async function ersetzen(neu) {
  cache = vervollstaendigen(neu);
  await jetztSchreiben();
  return cache;
}

/** Nur für Tests und den Import: den Zwischenspeicher verwerfen. */
export function verwerfen() {
  cache = null;
}
