// Abgleich zwischen Geräten über ein geheimes GitHub-Gist.
//
// **Warum GitHub:** Der Tracker hat keinen Server und soll keinen bekommen –
// ein eigener Dienst wäre etwas, das jemand betreiben, bezahlen und absichern
// muss. Die App liegt ohnehin auf GitHub Pages, Nils hat also ein Konto.
//
// **Warum ein Gist und kein Repository:** Nils' andere Apps (Deutsch-Trainer)
// gleichen genauso ab – ein Schlüssel mit dem Recht „gist", eingefügt, fertig.
// Die App sucht ihr Gist selbst und legt es beim ersten Mal an. Ein Repository
// hätte zusätzlich einen Namen gebraucht, der richtig abgetippt sein will,
// und einen Schlüssel, der genau dieses Repository sehen darf. Derselbe
// Schlüssel dient jetzt beiden Apps; jede erkennt ihr Gist an ihrem eigenen
// Dateinamen.
//
// **Was „geheim" heißt, gehört dazugesagt:** Ein geheimes Gist ist nicht
// öffentlich gelistet und taucht in keiner Suche auf. Wer die Adresse kennt,
// kann es aber lesen. Die Adresse ist eine lange Zufallskennung und steht
// nirgends außer im eigenen Konto. Das ist weniger als ein privates
// Repository, und die Karte im Profil sagt es so.
//
// **Warum nicht iCloud oder Apple Health:** keine Schnittstelle für Web-Apps
// (siehe „Was nicht geht" in CLAUDE.md).
//
// **Der Zugangsschlüssel bleibt auf dem Gerät.** Er liegt in einer eigenen
// Datenbank neben dem Tagebuch, nicht darin: So landet er weder in einer
// Sicherungsdatei noch im Gist selbst.

import * as speicher from './speicher.js';
import { ausSicherungsText } from '../kern/aendern.js';
import {
  zusammenfuehren, gleicherInhalt, schluesselLesen, gistAuswaehlen, GIST_DATEI,
} from '../kern/abgleich.js';

const DB_NAME = 'trainingstracker-abgleich';
const SPEICHER = 'abgleich';
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
  gist: null, // Kennung des Gists, sobald gefunden oder angelegt
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
    let e = await lesen('einstellung');
    // Die erste Fassung glich über ein Repository ab. Deren Einstellung passt
    // zu keinem Gist; sie wird verworfen statt halb weiterbenutzt. Das
    // Tagebuch selbst ist davon nicht berührt, es liegt vollständig hier.
    if (e?.repository) {
      await entfernen('einstellung');
      await basisLoeschen();
      e = null;
    }
    const zuletzt = await lesen('zuletzt');
    stand.eingerichtet = Boolean(e?.schluessel);
    stand.gist = e?.gist || null;
    stand.zuletzt = zuletzt?.zeit || null;
    stand.ergebnis = zuletzt?.ergebnis || null;
  } catch {
    stand.eingerichtet = false;
  }
  melden();
  return stand;
}

/**
 * Einrichten: Schlüssel prüfen, das Gist suchen, dann speichern.
 *
 * Geprüft wird **vor** dem Speichern, mit einer echten Anfrage. Ein
 * abgeschnittener Schlüssel fiele sonst erst beim ersten Abgleich auf – und
 * der läuft im Hintergrund, wo niemand hinsieht.
 *
 * Gibt es noch kein Gist, wird es hier angelegt und nicht erst beim ersten
 * Abgleich: Dabei zeigt sich, ob der Schlüssel schreiben darf. Fehlt ihm das
 * Recht „gist", steht die Meldung jetzt da, wo man den Schlüssel gerade
 * eingefügt hat.
 */
export async function einrichten({ schluessel, api = API }) {
  const token = schluesselLesen(schluessel);
  const e = { schluessel: token, api };
  let gist = await gistSuchen(e);
  if (!gist) {
    if (!speicher.ablage.gelesen) throw new Error(LESEFEHLER);
    gist = (await gistAnlegen(e, await speicher.laden())).id;
  }
  // Ein anderes Gist ist ein anderes Gegenüber: Die Basis des alten gilt dort
  // nicht, sonst hielte der Abgleich alles, was dort fehlt, für gelöscht.
  const alt = await lesen('einstellung').catch(() => null);
  if (alt?.gist !== gist || alt?.api !== api) await basisLoeschen();
  await ablegen('einstellung', { schluessel: token, api, gist });
  stand.fehler = null;
  await vorbereiten();
  return abgleichen();
}

/** Abgleich trennen. Das Tagebuch auf diesem Gerät bleibt, wie es ist. */
export async function trennen() {
  await entfernen('einstellung');
  await basisLoeschen();
  await entfernen('zuletzt');
  Object.assign(stand, { eingerichtet: false, gist: null, zuletzt: null,
    ergebnis: null, fehler: null, offline: false });
  melden();
}

/**
 * Die Basis verwerfen – nach dem Einspielen einer Sicherung.
 *
 * Wer eine ältere Sicherung einspielt, hat danach weniger Einträge als beim
 * letzten Abgleich. Gegen die alte Basis gemessen hieße das: „auf diesem Gerät
 * gelöscht", und der Abgleich würde die Löschungen zu allen anderen Geräten
 * tragen. Ohne Basis wird stattdessen vereinigt – was im Gist steht,
 * kommt zurück. Einspielen soll das eigene Gerät reparieren können, nicht
 * die anderen leeren.
 */
export async function basisVergessen() {
  // Ein laufender Abgleich legt am Ende seine Basis ab – die gehört zum Stand
  // vor dem Einspielen und darf nicht nachträglich wieder dastehen.
  if (laufend) await laufend.catch(() => {});
  await basisLoeschen().catch(() => {});
}

/**
 * Basis und Kennung der Gist-Fassung gehören zusammen und gehen zusammen.
 *
 * Die Kennung (`fern`) behauptet: „Im Gist steht genau die Basis." Nur
 * deshalb darf ein „nicht geändert" der Schnittstelle als Stand des Gists die
 * Basis einsetzen. Bliebe die Kennung stehen, während die Basis verworfen
 * wird, gäbe ein „nicht geändert" einen Stand zurück, den es nicht mehr gibt.
 */
async function basisLoeschen() {
  await entfernen('fern');
  await entfernen('basis');
}

/* ------------------------------------------------------- Übertragung */

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
  const { wennNicht, leerErlaubt, ...rest } = optionen;
  const schicken = (bedingt) => fetch(`${einstellung.api || API}${pfad}`, {
    ...rest,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${einstellung.schluessel}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(bedingt ? { 'If-None-Match': wennNicht } : {}),
    },
  });
  let antwort;
  try {
    antwort = await schicken(Boolean(wennNicht) && !ohneBedingung);
  } catch {
    // Scheitert die bedingte Anfrage, kann das auch die CORS-Rückfrage zum
    // zusätzlichen Kopf sein und nicht das Netz. Dann einmal ohne: Gelingt
    // das, bleibt es für diese Sitzung dabei. Sonst hielte eine abgelehnte
    // Rückfrage den Abgleich für immer für „offline", und niemand sähe es.
    let gelungen = false;
    if (wennNicht && !ohneBedingung) {
      try {
        antwort = await schicken(false);
        ohneBedingung = true;
        gelungen = true;
      } catch { /* wirklich kein Netz */ }
    }
    if (!gelungen) {
      const f = new AnfrageFehler(0, 'Keine Verbindung.');
      f.offline = true;
      throw f;
    }
  }
  if (antwort.status === 304 && wennNicht) return antwort;
  if (antwort.ok) return antwort;
  if (antwort.status === 404 && leerErlaubt) return null;
  throw new AnfrageFehler(antwort.status, fehlerText(antwort.status));
}

function fehlerText(status) {
  if (status === 401) {
    return 'GitHub lehnt den Zugangsschlüssel ab – vermutlich ist er abgelaufen oder '
      + 'widerrufen. Unter Profil → Abgleich einen neuen eintragen.';
  }
  if (status === 403 || status === 404) {
    // 404 ist bei GitHub die übliche Antwort auf fehlende Rechte: Was man
    // nicht sehen darf, gibt es für einen nicht.
    return 'GitHub verweigert den Zugriff aufs Gist. Meist fehlt dem Schlüssel das Recht '
      + '„gist" – beim Erzeugen das Häkchen bei „gist" setzen. Selten waren es zu viele '
      + 'Anfragen; dann in einer Stunde noch einmal.';
  }
  return `GitHub antwortet mit Fehler ${status}. Später noch einmal versuchen.`;
}

/** Lehnt die Gegenseite die bedingte Anfrage ab, wird sie nicht mehr versucht. */
let ohneBedingung = false;

const LESEFEHLER = 'Der Stand dieses Geräts ließ sich nicht lesen. Erst die App schließen '
  + 'und neu öffnen, dann einrichten.';

/**
 * Das Gist des Trackers unter allen Gists des Kontos suchen.
 *
 * Seitenweise, weil die Schnittstelle höchstens hundert auf einmal liefert –
 * wer viele Gists hat, hätte sonst ein zweites angelegt bekommen, und zwei
 * Geräte hätten mit zwei verschiedenen abgeglichen. Gesucht wird bis zum
 * Ende der Liste, weil `gistAuswaehlen()` das **älteste** nimmt.
 */
async function gistSuchen(e) {
  const alle = [];
  for (let seite = 1; seite <= 30; seite += 1) {
    const liste = await (await anfrage(e, `/gists?per_page=100&page=${seite}`)).json();
    if (!Array.isArray(liste)) break;
    alle.push(...liste);
    if (liste.length < 100) break;
  }
  return gistAuswaehlen(alle);
}

async function gistAnlegen(e, daten) {
  const antwort = await anfrage(e, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: 'Trainingstracker: Tagebuch (Abgleich zwischen Geräten)',
      public: false,
      files: { [GIST_DATEI]: { content: JSON.stringify(daten) } },
    }),
  });
  return { id: (await antwort.json()).id, kennung: antwort.headers.get('ETag') };
}

/** Inhalt der Tagebuchdatei aus einer Gist-Antwort lesen. */
async function dateiLesen(info) {
  const datei = info?.files?.[GIST_DATEI];
  if (!datei) return null;
  let text = datei.content;
  // Über einem Megabyte kürzt die Schnittstelle den Inhalt – nach rund zwei
  // Jahren Training ist das Tagebuch so groß. Die Rohdatei kommt dann über
  // ihre eigene Adresse, und zwar **ohne** Schlüssel: Sie liegt auf einem
  // anderen Rechner, und ein Schlüssel dort zöge eine CORS-Rückfrage nach
  // sich, die der nicht beantwortet. Die Adresse enthält die Fassung, ist
  // also nie veraltet.
  if (datei.truncated && datei.raw_url) {
    try {
      text = await (await fetch(datei.raw_url, { cache: 'no-store' })).text();
    } catch {
      const f = new AnfrageFehler(0, 'Keine Verbindung.');
      f.offline = true;
      throw f;
    }
  }
  try {
    return ausSicherungsText(text || '');
  } catch (fehler) {
    throw new AnfrageFehler(-1, `Die Datei „${GIST_DATEI}" im Gist lässt sich nicht lesen: `
      + `${fehler.message} Abgeglichen wird nichts, damit sie nicht überschrieben wird. Das `
      + 'Gist hebt jede frühere Fassung auf („Revisions" auf github.com) – dort lässt sich '
      + 'die letzte heile wiederherstellen.');
  }
}

/**
 * Den Stand aus dem Gist holen: `{ daten, fassung, kennung }`.
 *
 * `null` heißt: Das Gist ist weg (auf github.com gelöscht). Dann legt der
 * nächste Schreibvorgang ein neues an – das Tagebuch liegt ja vollständig
 * auf diesem Gerät.
 *
 * Mit `bekannt` (Kennung und Stand des letzten Abgleichs) wird bedingt
 * gefragt: Hat sich am Gist nichts geändert, antwortet GitHub mit „nicht
 * geändert" und ohne Inhalt. Das Tagebuch wächst über die Jahre auf
 * Megabytes, und abgeglichen wird bei jedem Öffnen der App – meist, ohne dass
 * das andere Gerät inzwischen etwas geschrieben hat. Ohne die Bedingung lüde
 * das Handy dann jedes Mal das ganze Tagebuch über das Mobilnetz, um
 * festzustellen, dass es schon alles hat. Bedingte Anfragen zählen bei
 * GitHub zudem nicht gegen das Anfragenlimit.
 */
async function holen(e, fassung = null, bekannt = null) {
  const antwort = await anfrage(e, `/gists/${e.gist}${fassung ? `/${fassung}` : ''}`,
    { leerErlaubt: !fassung, wennNicht: fassung ? null : bekannt?.kennung });
  if (!antwort) return null;
  if (antwort.status === 304) {
    return { daten: bekannt.daten, fassung: bekannt.fassung, kennung: bekannt.kennung,
      unveraendert: true };
  }
  const info = await antwort.json();
  return { daten: await dateiLesen(info), fassung: info.history?.[0]?.version || null,
    kennung: antwort.headers.get('ETag') };
}

/**
 * Den zusammengeführten Stand ins Gist schreiben.
 *
 * Ein Gist kennt keine bedingte Änderung („nur, wenn dort noch Fassung X
 * liegt"), anders als die Dateien eines Repositorys. Hat ein anderes Gerät
 * zwischen Holen und Schreiben geschrieben, überschreibt dieses Schreiben
 * dessen Stand – und das andere Gerät hielte beim nächsten Abgleich seine
 * eigenen neuen Einträge für „drüben gelöscht".
 *
 * Erkannt wird das hinterher, an der Geschichte, die die Antwort mitbringt:
 * Liegt unter der eigenen Fassung eine andere als die geholte, hat jemand
 * dazwischen geschrieben. Rückgabe ist dann diese Fassung, damit der Ablauf
 * sie nachträglich einmischt.
 */
async function senden(e, daten, geholteFassung) {
  const antwort = await anfrage(e, `/gists/${e.gist}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_DATEI]: { content: JSON.stringify(daten) } } }),
  });
  const verlauf = (await antwort.json())?.history;
  const davor = Array.isArray(verlauf) ? verlauf[1]?.version : undefined;
  const kennung = antwort.headers.get('ETag');
  const fassung = Array.isArray(verlauf) ? verlauf[0]?.version || null : null;
  if (geholteFassung && davor && davor !== geholteFassung) return { dazwischen: davor };
  return { dazwischen: null, kennung, fassung };
}

/* ---------------------------------------------------------- Abgleich */

let laufend = null;
let nochmal = false;

/**
 * Einmal abgleichen: holen, zusammenführen, beide Seiten auf den Stand bringen.
 *
 * Läuft schon einer, wird danach ein weiterer angestoßen statt parallel ein
 * zweiter – zwei gleichzeitige hätten dieselbe Basis und überschrieben sich
 * gegenseitig im Gist.
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
  if (!e?.schluessel) return { ok: false, grund: 'nicht eingerichtet' };

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
    // Was ein anderes Gerät zwischen Holen und Schreiben ins Gist gelegt hat
    // und von diesem Schreiben überdeckt wurde – siehe `senden()`.
    let ueberschrieben = null;
    for (let runde = 0; runde < 4; runde += 1) {
      // Bedingt fragen nur, wenn Basis und Kennung zusammen dastehen – und
      // nicht in einer Nachholrunde: Dort ist das Gist gerade geändert worden.
      const bekannt = ueberschrieben ? null : await bekannterStand();
      let entfernt = e.gist ? await holen(e, null, bekannt) : null;
      if (ueberschrieben && entfernt?.daten) {
        // Dreiseitig gegen den Stand, den beide Seiten zuletzt gemeinsam
        // gesehen haben: So kommen die Einträge des anderen Geräts zurück,
        // ohne dass seine Löschungen als Neuanlagen wiederkehren.
        entfernt = { ...entfernt, daten: zusammenfuehren(ueberschrieben.basis,
          entfernt.daten, ueberschrieben.daten).stand };
      }
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

      // Kennung und Fassung des Gists, wenn es danach genau `z.stand` enthält.
      let fern = null;
      if (!entfernt) {
        // Kein Gist (mehr): neu anlegen und die Kennung merken.
        const neu = await gistAnlegen(e, z.stand);
        e.gist = neu.id;
        await ablegen('einstellung', e);
        stand.gist = e.gist;
      } else if (ueberschrieben || !gleicherInhalt(z.stand, entfernt.daten)) {
        const gesendet = await senden(e, z.stand, entfernt.fassung);
        if (gesendet.dazwischen) {
          const fremd = await holen(e, gesendet.dazwischen);
          ueberschrieben = { basis: entfernt.daten, daten: fremd?.daten || null };
          if (ueberschrieben.daten) continue;
        } else {
          fern = gesendet;
        }
        ueberschrieben = null;
      } else {
        fern = entfernt;
      }
      // Erst die alte Kennung weg, dann die Basis, dann die neue Kennung:
      // Bricht das Ablegen mittendrin ab, fehlt höchstens die Kennung, und
      // der nächste Abgleich lädt eben einmal vollständig.
      await entfernen('fern');
      await ablegen('basis', z.stand);
      if (fern?.kennung) {
        await ablegen('fern', { kennung: fern.kennung, fassung: fern.fassung || null });
      }
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

/** Basis samt Kennung des Gists, oder `null`, wenn eins von beiden fehlt. */
async function bekannterStand() {
  const fern = await lesen('fern').catch(() => null);
  if (!fern?.kennung) return null;
  const daten = await lesen('basis').catch(() => null);
  return daten ? { ...fern, daten } : null;
}

function ergebnisSatz(z, geholt, erstesMal, ohneBasis) {
  if (erstesMal) return 'Der Stand dieses Geräts liegt jetzt in einem neuen Gist.';
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
      + `${ohneBasis ? 'aus dem Gist' : 'dieses Geräts'}.`;
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
