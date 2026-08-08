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

/**
 * Was die Ablage gerade kann – und was nicht.
 *
 * Der Grund für diese Buchführung: Ein fehlgeschlagener Schreibvorgang war
 * vorher vollkommen still. Man hätte weiter Einheiten eingetragen, und nichts
 * davon wäre angekommen – gemerkt hätte man es erst Tage später an einem leeren
 * Tagebuch. Bei einer App, deren einziger Zweck das Sammeln über Jahre ist, ist
 * das der schlimmste denkbare Fehler.
 *
 * `gelesen: false` heißt: Die Datenbank ließ sich nicht öffnen. Dann ist das
 * angezeigte leere Tagebuch **nicht** die Wahrheit – und niemand darf in dem
 * Glauben eine Sicherung darüberspielen.
 */
export const ablage = { gelesen: true, geschrieben: true, meldung: null };
const zuhoerer = new Set();

/** Bei Problemen mit der Ablage benachrichtigt werden. */
export function beiProblem(fn) {
  zuhoerer.add(fn);
  return () => zuhoerer.delete(fn);
}

function melden(feld, fehler) {
  ablage[feld] = false;
  ablage.meldung = String(fehler?.message || fehler || 'Unbekannter Fehler');
  for (const fn of zuhoerer) { try { fn(ablage); } catch { /* egal */ } }
}

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
  } catch (fehler) {
    // Weiterarbeiten geht – aber nicht so tun, als sei das Tagebuch leer.
    // Ein leerer Bildschirm, der in Wahrheit ein Lesefehler ist, verleitet
    // dazu, eine alte Sicherung über die noch vorhandenen Daten zu spielen.
    cache = leeresTagebuch();
    melden('gelesen', fehler);
  }
  return cache;
}

async function schreiben() {
  if (!cache) return;
  try {
    await vorgang('readwrite', (s) => s.put(cache, SCHLUESSEL));
    if (!ablage.geschrieben) { ablage.geschrieben = true; ablage.meldung = null; }
  } catch (fehler) {
    melden('geschrieben', fehler);
    throw fehler;
  }
}

/**
 * Ändern und speichern. Das Schreiben wird kurz gebündelt: Beim Tippen im
 * Profil sonst ein Schreibvorgang je Tastendruck.
 */
export async function aendern(fn) {
  const daten = await laden();
  const ergebnis = fn(daten);
  clearTimeout(schreibTimer);
  // Der Fehler wird in `schreiben` gemeldet; hier nur verschlucken, damit ein
  // Zeitgeber keine unbehandelte Ablehnung erzeugt.
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

/**
 * Ausstehendes sofort wegschreiben, wenn die App in den Hintergrund geht.
 *
 * Auf dem Handy wird eine App im Hintergrund jederzeit beendet. Die 150 ms
 * Bündelung sind dann genug, um den letzten Eintrag zu verlieren – und zwar
 * denjenigen, den man gerade gemacht hat. `visibilitychange` ist dafür das
 * verlässlichere Ereignis als `beforeunload`, das iOS oft gar nicht auslöst.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') jetztSchreiben().catch(() => {});
  });
  window.addEventListener('pagehide', () => { jetztSchreiben().catch(() => {}); });
}
