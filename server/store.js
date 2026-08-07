// Ablage aller Daten in einer JSON-Datei.
//
// Ein Trainingstagebuch ist über Jahre wertvoll und darf nicht an einem
// abgebrochenen Schreibvorgang sterben: Deshalb wird immer in eine temporäre
// Datei geschrieben und erst dann umbenannt. Ein Umbenennen ist atomar – die
// Datei ist entweder vollständig alt oder vollständig neu, nie halb.

import { writeFile, rename, readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createProfil } from './profil.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');

// Über die Umgebungsvariable umlenkbar, damit Tests nie echte Daten anfassen.
const DATEI = process.env.TRACKER_DATEI || path.join(DATA_DIR, 'tagebuch.json');

export function leeresTagebuch() {
  return {
    version: 1,
    profil: createProfil(),
    sessions: [],    // absolvierte Einheiten
    essen: [],       // Lebensmitteleinträge
    checks: [],      // Morgen-Checks
    tests: [],       // Leistungstests
    muscleup: { manuell: {} }, // manuell bestätigte Stufen
    gewicht: [],     // Gewichtsverlauf
    angelegt: new Date().toISOString(),
  };
}

let cache = null;
let schreibTimer = null;

export async function laden() {
  if (cache) return cache;
  try {
    const roh = JSON.parse(await readFile(DATEI, 'utf8'));
    cache = { ...leeresTagebuch(), ...roh };
    // Ein Profil aus einer älteren Version kann Felder vermissen, die
    // inzwischen dazugekommen sind – auffüllen statt abstürzen.
    cache.profil = { ...createProfil(), ...(roh.profil || {}) };
  } catch {
    cache = leeresTagebuch();
  }
  return cache;
}

async function schreiben() {
  if (!cache) return;
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATEI}.tmp`;
  await writeFile(tmp, JSON.stringify(cache, null, 2), 'utf8');
  await rename(tmp, DATEI);
}

/**
 * Gebündeltes Speichern: Beim Tippen im Profil würde sonst jeder Tastendruck
 * die Platte anfassen. 400 ms Verzögerung fasst das zusammen, ohne dass es
 * sich beim Bedienen träge anfühlt.
 */
export function sichernBald() {
  if (schreibTimer) return;
  schreibTimer = setTimeout(() => {
    schreibTimer = null;
    schreiben().catch((err) => console.error('Speichern fehlgeschlagen:', err.message));
  }, 400);
}

/** Sofort schreiben – für Programmende und Tests. */
export async function sichernJetzt() {
  if (schreibTimer) {
    clearTimeout(schreibTimer);
    schreibTimer = null;
  }
  await schreiben();
}

/** Ändert das Tagebuch und plant das Speichern ein. */
export async function aendern(fn) {
  const daten = await laden();
  const ergebnis = fn(daten);
  sichernBald();
  return ergebnis;
}

/** Sicherungskopie vor riskanten Aktionen wie dem Import. */
export async function sicherungskopie() {
  const ziel = `${DATEI}.${new Date().toISOString().slice(0, 10)}.bak`;
  await copyFile(DATEI, ziel).catch(() => {});
  return ziel;
}

/** Nur für Tests: Zwischenspeicher verwerfen. */
export function cacheLeeren() {
  cache = null;
  if (schreibTimer) {
    clearTimeout(schreibTimer);
    schreibTimer = null;
  }
}

export function id(praefix = 'e') {
  return `${praefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

export { DATEI };
