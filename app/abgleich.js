// Abgleich zwischen Geräten über ein privates GitHub-Repository.
//
// **Warum GitHub:** Der Tracker hat keinen Server und soll keinen bekommen –
// ein eigener Dienst wäre etwas, das jemand betreiben, bezahlen und absichern
// muss. Die App liegt ohnehin auf GitHub Pages, Nils hat also ein Konto. Ein
// privates Repository ist ein Speicher, den nur er lesen kann, mit einer
// Schnittstelle, die Browser direkt ansprechen dürfen, und mit einer
// Versionsgeschichte gratis: Jeder Abgleich ist ein Commit, jeder alte Stand
// lässt sich dort wiederfinden.
//
// **Warum nicht iCloud, Apple Health oder ein Gist:** iCloud hat keine
// Schnittstelle für Web-Apps (siehe „Was nicht geht" in CLAUDE.md), und ein
// „geheimer" Gist ist nur unaufgelistet – wer die Adresse hat, liest mit.
//
// **Der Zugangsschlüssel bleibt auf dem Gerät.** Er liegt in einer eigenen
// Datenbank neben dem Tagebuch, nicht darin: So landet er weder in einer
// Sicherungsdatei noch im Repository selbst. Gedacht ist ein feingranularer
// Schlüssel, der genau ein Repository lesen und schreiben darf und sonst
// nichts – wer ihn findet, kommt an das Trainingstagebuch und an nichts
// anderes.

import * as speicher from './speicher.js';
import { ausSicherungsText } from '../kern/aendern.js';
import { zusammenfuehren, gleicherInhalt, repositoryLesen } from '../kern/abgleich.js';

const DB_NAME = 'trainingstracker-abgleich';
const SPEICHER = 'abgleich';
const PFAD = 'trainingstagebuch.json';
const API = 'https://api.github.com';

/*
 * Nach einer Änderung wird nicht sofort abgeglichen, sondern kurz gewartet.
 * Beim Protokollieren einer Mahlzeit kommen oft drei, vier Einträge
 * hintereinander; jeder einzelne wäre ein Commit und ein Netzaufruf.
 * Technische Bündelung, keine Trainingslehre.
 */
const WARTEN_NACH_AENDERUNG_MS = 15000;

let db = null;

function oeffnen() {
  if (db) return Promise.resolve(db);
  return new Promise((erfuellen, ablehnen) => {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(SPEICHER);
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

const lesen = (k) => vorgang('readonly', (s) => s.get(k));
const ablegen = (k, wert) => vorgang('readwrite', (s) => s.put(wert, k));
const entfernen = (k) => vorgang('readwrite', (s) => s.delete(k));

/* ------------------------------------------------------------- Stand */

/**
 * Was der Abgleich gerade weiß – für die Oberfläche.
 *
 * `fehler` trägt nur Fehler, bei denen jemand etwas tun muss. Kein Netz ist
 * keiner: Trainiert wird im Keller und auf dem Sportplatz, dort wartet der
 * Abgleich einfach auf das nächste Öffnen mit Empfang. Eine Warnung bei jedem
 * Funkloch wäre die, an die man sich gewöhnt – und dann übersieht man die
 * echte, wenn der Schlüssel abgelaufen ist.
 */
export const stand = {
  eingerichtet: false,
  repository: null,
  laeuft: false,
  zuletzt: null, // Zeitpunkt des letzten gelungenen Abgleichs
  ergebnis: null, // Satz zum letzten gelungenen Abgleich
  fehler: null, // Satz, wenn etwas zu tun ist
  offline: false,
};

const zuhoerer = new Set();
/** Benachrichtigt werden, wenn sich am Stand etwas ändert; `geholt` heißt: neue Daten da. */
export function beiAenderung(fn) {
  zuhoerer.add(fn);
  return () => zuhoerer.delete(fn);
}
function melden(geholt = false) {
  for (const fn of zuhoerer) { try { fn(stand, geholt); } catch { /* egal */ } }
}

/* ------------------------------------------------------ Einstellungen */

/** Einstellungen lesen und den Stand danach ausrichten. */
export async function vorbereiten() {
  try {
    const e = await lesen('einstellung');
    const zuletzt = await lesen('zuletzt');
    stand.eingerichtet = Boolean(e?.repository && e?.schluessel);
    stand.repository = e?.repository || null;
    stand.zuletzt = zuletzt?.zeit || null;
    stand.ergebnis = zuletzt?.ergebnis || null;
  } catch {
    stand.eingerichtet = false;
  }
  melden();
  return stand;
}

/**
 * Einrichten: Repository und Schlüssel prüfen, dann speichern.
 *
 * Geprüft wird **vor** dem Speichern, mit einer echten Anfrage. Ein Tippfehler
 * im Namen oder ein Schlüssel ohne Schreibrecht fiele sonst erst beim ersten
 * Abgleich auf – und der läuft im Hintergrund, wo niemand hinsieht.
 */
export async function einrichten({ repository, schluessel, api = API }) {
  const repo = repositoryLesen(repository);
  const token = String(schluessel ?? '').trim();
  if (!token) throw new Error('Der Zugangsschlüssel fehlt.');
  const antwort = await anfrage({ api, schluessel: token }, `/repos/${repo}`);
  const info = await antwort.json();
  if (!info.private) {
    throw new Error(`„${repo}" ist öffentlich. Dort könnte jeder dein Trainingstagebuch `
      + 'lesen – bitte ein privates Repository nehmen.');
  }
  // Ob der Schlüssel auch schreiben darf, verrät diese Antwort nicht: Ihr
  // `permissions` beschreibt das Konto, nicht den Schlüssel. Das zeigt erst
  // der erste Abgleich, und dessen Meldung nennt das fehlende Recht.
  // Ein anderes Repository ist ein anderer Gegenüber: Die Basis des alten
  // gilt dort nicht, sonst hielte der Abgleich alles, was dort fehlt, für
  // gelöscht.
  const alt = await lesen('einstellung').catch(() => null);
  if (alt?.repository !== repo || alt?.api !== api) await entfernen('basis');
  await ablegen('einstellung', { repository: repo, schluessel: token, api });
  stand.fehler = null;
  await vorbereiten();
  return abgleichen();
}

/** Abgleich trennen. Das Tagebuch auf diesem Gerät bleibt, wie es ist. */
export async function trennen() {
  await entfernen('einstellung');
  await entfernen('basis');
  await entfernen('zuletzt');
  Object.assign(stand, { eingerichtet: false, repository: null, zuletzt: null,
    ergebnis: null, fehler: null, offline: false });
  melden();
}

/**
 * Die Basis verwerfen – nach dem Einspielen einer Sicherung.
 *
 * Wer eine ältere Sicherung einspielt, hat danach weniger Einträge als beim
 * letzten Abgleich. Gegen die alte Basis gemessen hieße das: „auf diesem Gerät
 * gelöscht", und der Abgleich würde die Löschungen zu allen anderen Geräten
 * tragen. Ohne Basis wird stattdessen vereinigt – was im Repository steht,
 * kommt zurück. Einspielen soll das eigene Gerät reparieren können, nicht
 * die anderen leeren.
 */
export async function basisVergessen() {
  // Ein laufender Abgleich legt am Ende seine Basis ab – die gehört zum Stand
  // vor dem Einspielen und darf nicht nachträglich wieder dastehen.
  if (laufend) await laufend.catch(() => {});
  await entfernen('basis').catch(() => {});
}

/* ------------------------------------------------------- Übertragung */

function base64AusText(text) {
  const bytes = new TextEncoder().encode(text);
  let binaer = '';
  // In Stücken: `String.fromCharCode(...bytes)` sprengt bei ein paar
  // Megabyte den Aufrufstapel.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binaer += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binaer);
}

function textAusBase64(b64) {
  const binaer = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(binaer.length);
  for (let i = 0; i < binaer.length; i += 1) bytes[i] = binaer.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Ein Fehler mit Status, damit der Ablauf Konflikt und Abbruch unterscheiden kann. */
class AnfrageFehler extends Error {
  constructor(status, text) {
    super(text);
    this.status = status;
  }
}

/**
 * Eine Anfrage an die GitHub-Schnittstelle – mit Meldungen, die weiterhelfen.
 *
 * `cache: 'no-store'`, weil GitHub Antworten eine Minute lang zum
 * Zwischenspeichern freigibt. Der Browser bekäme dann beim zweiten Abgleich
 * den Stand von vor einer Minute – und hielte alles, was das andere Gerät in
 * der Zwischenzeit geschrieben hat, für nicht vorhanden.
 */
async function anfrage(einstellung, pfad, optionen = {}) {
  let antwort;
  try {
    antwort = await fetch(`${einstellung.api || API}${pfad}`, {
      ...optionen,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${einstellung.schluessel}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(optionen.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    const f = new AnfrageFehler(0, 'Keine Verbindung.');
    f.offline = true;
    throw f;
  }
  if (antwort.ok) return antwort;
  if (antwort.status === 404 && optionen.leerErlaubt) return null;
  throw new AnfrageFehler(antwort.status, fehlerText(antwort.status));
}

function fehlerText(status) {
  if (status === 401) {
    return 'GitHub lehnt den Zugangsschlüssel ab – vermutlich ist er abgelaufen. Unter '
      + 'Profil → Abgleich einen neuen eintragen.';
  }
  if (status === 403) {
    return 'GitHub verweigert den Zugriff. Entweder fehlt dem Schlüssel das Recht '
      + '„Contents: Read and write" für dieses Repository, oder es wurden zu viele '
      + 'Anfragen gestellt – dann in einer Stunde noch einmal.';
  }
  if (status === 404) {
    return 'Das Repository ist nicht zu finden. Entweder stimmt der Name nicht, oder der '
      + 'Schlüssel darf es nicht sehen – beim Anlegen muss es unter „Repository access" '
      + 'ausgewählt sein.';
  }
  return `GitHub antwortet mit Fehler ${status}. Später noch einmal versuchen.`;
}

/** Den Stand aus dem Repository holen: `{ daten, sha }`, oder `null`, wenn dort noch nichts liegt. */
async function holen(e) {
  const antwort = await anfrage(e, `/repos/${e.repository}/contents/${PFAD}`, { leerErlaubt: true });
  if (!antwort) {
    // 404 heißt hier zweierlei: Datei fehlt (erster Abgleich) oder Repository
    // weg. Das Zweite darf nicht als „leer, also alles hochladen" durchgehen.
    await anfrage(e, `/repos/${e.repository}`);
    return null;
  }
  const info = await antwort.json();
  let b64 = info.content;
  // Über einem Megabyte liefert die Inhalte-Schnittstelle den Inhalt nicht mit
  // – nach drei Jahren Training ist das Tagebuch so groß. Die Blob-Schnittstelle
  // trägt bis 100 MB.
  if (!b64 && info.size > 0) {
    const blob = await (await anfrage(e, `/repos/${e.repository}/git/blobs/${info.sha}`)).json();
    b64 = blob.content;
  }
  let daten;
  try {
    daten = ausSicherungsText(textAusBase64(b64 || ''));
  } catch (fehler) {
    throw new AnfrageFehler(-1, `Die Datei „${PFAD}" im Repository lässt sich nicht lesen: `
      + `${fehler.message} Abgeglichen wird nichts, damit sie nicht überschrieben wird. Im `
      + 'Repository steht jeder frühere Stand als Commit – dort lässt sich der letzte '
      + 'heile wiederherstellen.');
  }
  return { daten, sha: info.sha };
}

async function senden(e, daten, sha) {
  const text = JSON.stringify(daten, null, 1);
  const antwort = await anfrage(e, `/repos/${e.repository}/contents/${PFAD}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Abgleich ${new Date().toISOString()}`,
      content: base64AusText(text),
      ...(sha ? { sha } : {}),
    }),
  });
  return (await antwort.json())?.content?.sha || null;
}

/* ---------------------------------------------------------- Abgleich */

let laufend = null;
let nochmal = false;

/**
 * Einmal abgleichen: holen, zusammenführen, beide Seiten auf den Stand bringen.
 *
 * Läuft schon einer, wird danach ein weiterer angestoßen statt parallel ein
 * zweiter – zwei gleichzeitige hätten dieselbe Basis und überschrieben sich
 * gegenseitig im Repository.
 */
export function abgleichen() {
  if (laufend) { nochmal = true; return laufend; }
  laufend = (async () => {
    try {
      return await einmalAbgleichen();
    } finally {
      laufend = null;
      if (nochmal) { nochmal = false; abgleichen().catch(() => {}); }
    }
  })();
  return laufend;
}

async function einmalAbgleichen() {
  const e = await lesen('einstellung').catch(() => null);
  if (!e?.repository || !e?.schluessel) return { ok: false, grund: 'nicht eingerichtet' };

  // Nach einem Lesefehler steht im Arbeitsspeicher ein leeres Tagebuch. Das
  // gegen die Basis abzugleichen hieße: „hier wurde alles gelöscht" – und
  // das ginge an jedes andere Gerät. Der teuerste denkbare Abgleich.
  if (!speicher.ablage.gelesen) {
    stand.fehler = 'Abgleich angehalten: Der Stand dieses Geräts ließ sich nicht lesen. Erst '
      + 'die App schließen und neu öffnen.';
    melden();
    return { ok: false, grund: 'lesefehler' };
  }

  stand.laeuft = true;
  melden();
  try {
    // Mehrere Runden nur für den Fall, dass ein anderes Gerät zwischen Holen
    // und Senden geschrieben hat; dann meldet GitHub einen Konflikt über die
    // `sha`, und es wird mit dem neuen Stand neu zusammengeführt.
    for (let runde = 0; runde < 3; runde += 1) {
      const entfernt = await holen(e);
      const basis = await lesen('basis').catch(() => null);
      // Erst **nach** dem Holen lesen: Was während der Anfrage eingetragen
      // wurde, gehört in die Zusammenführung.
      const lokal = await speicher.laden();
      const z = zusammenfuehren(basis || null, lokal, entfernt?.daten || null);

      // Zwischen Zusammenführen und Übernehmen kein `await` außer dem
      // Schreiben selbst: Sonst könnte ein Eintrag dazwischenrutschen, der im
      // zusammengeführten Stand fehlt und mit ihm überschrieben würde.
      const geholt = !gleicherInhalt(z.stand, lokal);
      if (geholt) await speicher.abgleichUebernehmen(z.stand);

      if (!entfernt || !gleicherInhalt(z.stand, entfernt.daten)) {
        try {
          await senden(e, z.stand, entfernt?.sha);
        } catch (fehler) {
          if (fehler.status === 409 || fehler.status === 422) continue;
          throw fehler;
        }
      }
      await ablegen('basis', z.stand);
      const ergebnis = ergebnisSatz(z, geholt, !entfernt, !basis);
      await ablegen('zuletzt', { zeit: new Date().toISOString(), ergebnis });
      Object.assign(stand, { zuletzt: new Date().toISOString(), ergebnis, fehler: null,
        offline: false });
      melden(geholt);
      return { ok: true, geholt, konflikte: z.konflikte };
    }
    throw new AnfrageFehler(409, 'Ein anderes Gerät schreibt gerade gleichzeitig. Gleich '
      + 'noch einmal versuchen.');
  } catch (fehler) {
    if (fehler.offline) {
      stand.offline = true;
    } else {
      stand.fehler = fehler.message;
    }
    melden();
    return { ok: false, grund: fehler.message };
  } finally {
    stand.laeuft = false;
    melden();
  }
}

function ergebnisSatz(z, geholt, erstesMal, ohneBasis) {
  if (erstesMal) return 'Erster Abgleich: Der Stand dieses Geräts liegt jetzt im Repository.';
  const teile = [];
  if (geholt) teile.push('Neues vom anderen Gerät übernommen');
  if (z.gesendet) teile.push('Änderungen dieses Geräts gesendet');
  if (!teile.length) teile.push('Beide Seiten waren schon gleich');
  let satz = `${teile.join(', ')}.`;
  // Ein Konflikt verliert nichts, entscheidet aber zwischen zwei Fassungen
  // desselben Eintrags. Das soll man wissen, statt es zu suchen.
  if (z.konflikte) {
    satz += ` ${z.konflikte === 1 ? 'Ein Eintrag war' : `${z.konflikte} Einträge waren`} auf `
      + 'beiden Geräten verschieden geändert – behalten wurde die Fassung '
      + `${ohneBasis ? 'aus dem Repository' : 'dieses Geräts'}.`;
  }
  return satz;
}

/* -------------------------------------------------------- Auslöser */

let zeitgeber = null;
let letzterVersuch = 0;

function bald() {
  if (!stand.eingerichtet) return;
  clearTimeout(zeitgeber);
  zeitgeber = setTimeout(() => { zeitgeber = null; abgleichen().catch(() => {}); },
    WARTEN_NACH_AENDERUNG_MS);
}

function jetztWennLaengerHer() {
  if (!stand.eingerichtet) return;
  // Wer zwischen zwei Sätzen kurz die App wechselt, braucht keinen Abgleich
  // bei jeder Rückkehr. Eine Minute ist Bündelung, keine Trainingslehre.
  if (Date.now() - letzterVersuch < 60000) return;
  letzterVersuch = Date.now();
  abgleichen().catch(() => {});
}

/**
 * Die Auslöser anschließen: beim Öffnen, nach Änderungen, beim Zurückkehren
 * in die App und wenn das Netz wiederkommt.
 */
export async function starten() {
  await vorbereiten();
  speicher.nachJedemSchreiben(({ abgleich }) => {
    // Der Abgleich schreibt selbst – das darf keinen neuen auslösen.
    if (!abgleich) bald();
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        jetztWennLaengerHer();
      } else if (zeitgeber) {
        // Geht die App mit einer ausstehenden Änderung in den Hintergrund,
        // sofort versuchen. Ob das noch fertig wird, entscheidet das System;
        // wenn nicht, holt es das nächste Öffnen nach.
        clearTimeout(zeitgeber);
        zeitgeber = null;
        abgleichen().catch(() => {});
      }
    });
    window.addEventListener('online', () => { letzterVersuch = 0; jetztWennLaengerHer(); });
  }
  jetztWennLaengerHer();
}
