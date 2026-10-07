// Abgleich zwischen Geräten: zwei Stände zu einem zusammenführen.
//
// Hier steht nur die Rechnung. Woher der zweite Stand kommt (ein Gist, eine
// Datei, ein anderes Gerät), weiß dieses Modul nicht – die
// Übertragung liegt in `app/abgleich.js`, damit `kern/` frei von Netzwerk
// bleibt und sich in Node prüfen lässt.
//
// **Warum dreiseitig und nicht „der Neuere gewinnt":** Ein Tagebuch wird auf
// zwei Geräten zugleich weitergeführt – morgens der Check am Handy, abends
// das Essen am Laptop. Ein Ganzes-gegen-Ganzes-Vergleich verliert dabei
// zwangsläufig die Einträge der einen Seite, und zwar still. Verglichen wird
// deshalb jeder Eintrag einzeln gegen die **Basis** – den Stand, auf den sich
// beide Geräte beim letzten Abgleich geeinigt haben. Nur so lässt sich
// unterscheiden, ob ein Eintrag auf einer Seite *neu* ist oder auf der
// anderen *gelöscht* wurde; beides sieht ohne Basis gleich aus.
//
// **Die Leitlinie bei jedem Zweifelsfall: nichts verlieren.** Wurde ein
// Eintrag auf einem Gerät gelöscht und auf dem anderen geändert, bleibt die
// geänderte Fassung stehen. Eine Löschung lässt sich wiederholen, eine
// verlorene Eingabe nicht.

import { createProfil } from './profil.js';

/**
 * Wie die Einträge einer Liste wiedererkannt werden.
 *
 * Einheiten, Mahlzeiten und Tests tragen eine `id`. Morgen-Check und Gewicht
 * nicht – dort gilt beim Schreiben „ein Tag, ein Eintrag" (`checkSpeichern`,
 * `gewichtSpeichern`), also ist der Tag der Schlüssel. Zwei Checks desselben
 * Tages von zwei Geräten sind damit *derselbe* Eintrag in zwei Fassungen und
 * nicht zwei Einträge; sonst brächte der Abgleich genau die Doppelten zurück,
 * die die Fallen 65, 87 und 88 an den Lesern mühsam abgefangen haben.
 */
const LISTEN = {
  sessions: (e) => e.id,
  essen: (e) => e.id,
  tests: (e) => e.id,
  checks: (e) => e.datum,
  gewicht: (e) => e.datum,
};

/**
 * Vergleichbare Form eines Werts: Schlüssel sortiert.
 *
 * `JSON.stringify` hängt an der Reihenfolge der Felder, und die ist nicht
 * garantiert gleich, wenn derselbe Eintrag auf zwei Geräten über
 * verschiedene Wege entstanden ist (Anlegen gegen Ändern). Ohne diese Form
 * gälte er als auf beiden Seiten verschieden geändert – ein Scheinkonflikt.
 */
export function vergleichsform(wert) {
  if (Array.isArray(wert)) return `[${wert.map(vergleichsform).join(',')}]`;
  if (wert && typeof wert === 'object') {
    return `{${Object.keys(wert).sort()
      .filter((k) => wert[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${vergleichsform(wert[k])}`).join(',')}}`;
  }
  return JSON.stringify(wert ?? null);
}

const gleich = (a, b) => vergleichsform(a) === vergleichsform(b);

/**
 * Einen Wert dreiseitig entscheiden.
 *
 * `undefined` heißt „auf dieser Seite nicht vorhanden". Rückgabe ist der
 * gewählte Wert und, falls beide Seiten ihn verschieden geändert haben, ein
 * Konflikt.
 *
 * Bei einem echten Konflikt gilt mit Basis die eigene Seite, ohne Basis die
 * entfernte. Ohne Basis hat dieses Gerät noch nie abgeglichen – es ist neu
 * eingerichtet oder hat gerade eine Sicherung eingespielt –, und dann ist der
 * Stand im Gist der, an dem zuletzt gearbeitet wurde.
 */
function entscheiden(b, l, r, mitBasis) {
  if (gleich(l, r)) return { wert: l };
  if (gleich(l, b)) return { wert: r };
  if (gleich(r, b)) return { wert: l };
  // Gelöscht gegen geändert: die Änderung behalten.
  if (l === undefined) return { wert: r, konflikt: true };
  if (r === undefined) return { wert: l, konflikt: true };
  return { wert: mitBasis ? l : r, konflikt: true };
}

/** Eine Liste in eine Zuordnung Schlüssel → Eintrag; bei Doppelten gilt der letzte. */
function zuordnen(liste, schluessel) {
  const karte = new Map();
  for (const e of Array.isArray(liste) ? liste : []) {
    if (!e || typeof e !== 'object') continue;
    const k = schluessel(e);
    if (k == null || k === '') continue;
    karte.set(String(k), e);
  }
  return karte;
}

function listeZusammenfuehren(basis, lokal, entfernt, schluessel, mitBasis, zaehler) {
  const b = zuordnen(basis, schluessel);
  const l = zuordnen(lokal, schluessel);
  const r = zuordnen(entfernt, schluessel);
  // Reihenfolge: erst die des Gists, dann was nur hier steht. Beide
  // Geräte müssen am Ende dieselbe Folge haben – sonst hielte jedes die
  // eigene für eine Änderung, sendete sie, und der Abgleich käme nie zur Ruhe:
  // ein Commit je Öffnen, abwechselnd von beiden Seiten. Innerhalb eines
  // Tages ist die Reihenfolge eine Aussage (Sprint vor Kraft, Falle 90); was
  // hier neu dazukommt, ist das Jüngste und gehört ans Ende.
  const schluesselFolge = [...new Set([...r.keys(), ...l.keys()])];
  const ergebnis = [];
  for (const k of schluesselFolge) {
    const { wert, konflikt } = entscheiden(b.get(k), l.get(k), r.get(k), mitBasis);
    if (konflikt) zaehler.konflikte += 1;
    if (wert !== undefined) ergebnis.push(wert);
  }
  return ergebnis;
}

/** Ein Objekt feldweise zusammenführen – fürs Profil und die Muscle-Up-Bestätigungen. */
function objektZusammenfuehren(basis = {}, lokal = {}, entfernt = {}, mitBasis, zaehler) {
  const ergebnis = {};
  const felder = new Set([...Object.keys(lokal || {}), ...Object.keys(entfernt || {})]);
  for (const f of felder) {
    const { wert, konflikt } = entscheiden(basis?.[f], lokal?.[f], entfernt?.[f], mitBasis);
    if (konflikt) zaehler.konflikte += 1;
    if (wert !== undefined) ergebnis[f] = wert;
  }
  return ergebnis;
}

/**
 * Was ein Gerät, das noch nie abgeglichen hat, als Basis annimmt.
 *
 * Leere Listen – dann ist alles auf beiden Seiten „neu", und es wird
 * vereinigt statt gelöscht. Beim Profil dagegen die **Voreinstellung**: Ein
 * frisch geöffnetes Gerät hat ein Profil voller Vorgaben (Regler 30, vier
 * Tage), und die sollen die ausgefüllten Werte des anderen Geräts nicht
 * überstimmen. Gegen die Voreinstellung verglichen gilt die Vorgabe als
 * „unverändert", und der eingetragene Wert setzt sich durch.
 */
function ersteBasis() {
  return {
    profil: createProfil(),
    muscleup: { manuell: {} },
    sessions: [], essen: [], tests: [], checks: [], gewicht: [],
  };
}

/**
 * Zwei Stände dreiseitig zusammenführen.
 *
 * @param basis    Stand des letzten Abgleichs, oder `null`, wenn dieses Gerät
 *                 noch nie abgeglichen hat
 * @param lokal    Stand dieses Geräts
 * @param entfernt Stand des anderen Endes, oder `null`, wenn dort noch nichts
 *                 liegt
 * @returns `{ stand, konflikte, geholt, gesendet }` – `geholt` heißt: der
 *          zusammengeführte Stand unterscheidet sich von dem dieses Geräts;
 *          `gesendet`: er unterscheidet sich vom entfernten.
 */
export function zusammenfuehren(basis, lokal, entfernt) {
  if (!entfernt) {
    return { stand: lokal, konflikte: 0, geholt: false, gesendet: true };
  }
  const mitBasis = Boolean(basis);
  const b = basis || ersteBasis();
  const zaehler = { konflikte: 0 };

  const stand = { ...entfernt, ...lokal };
  for (const [feld, schluessel] of Object.entries(LISTEN)) {
    stand[feld] = listeZusammenfuehren(b[feld], lokal[feld], entfernt[feld],
      schluessel, mitBasis, zaehler);
  }
  // Beim Gewicht ist die Reihenfolge keine Aussage, sondern Verlauf – so
  // sortiert auch `gewichtSpeichern()`.
  stand.gewicht.sort((a, c) => (a.datum < c.datum ? -1 : a.datum > c.datum ? 1 : 0));

  stand.profil = objektZusammenfuehren(b.profil, lokal.profil, entfernt.profil,
    mitBasis, zaehler);
  stand.muscleup = {
    ...(entfernt.muscleup || {}),
    ...(lokal.muscleup || {}),
    manuell: objektZusammenfuehren(b.muscleup?.manuell, lokal.muscleup?.manuell,
      entfernt.muscleup?.manuell, mitBasis, zaehler),
  };

  return {
    stand,
    konflikte: zaehler.konflikte,
    geholt: !gleich(inhalt(stand), inhalt(lokal)),
    gesendet: !gleich(inhalt(stand), inhalt(entfernt)),
  };
}

/**
 * Der Teil eines Stands, der abgeglichen wird.
 *
 * `angelegt` und `version` gehören zum Gerät und nicht zum Tagebuch; ein
 * Unterschied dort ist kein Grund, etwas zu senden.
 */
export function inhalt(stand) {
  if (!stand) return null;
  const { profil, muscleup } = stand;
  const teil = { profil, muscleup };
  for (const feld of Object.keys(LISTEN)) teil[feld] = stand[feld];
  return teil;
}

/** Sind zwei Stände inhaltlich gleich? */
export function gleicherInhalt(a, b) {
  return gleich(inhalt(a), inhalt(b));
}

/** Der Dateiname im Gist – an ihm erkennt die App „ihr" Gist unter allen des Kontos. */
export const GIST_DATEI = 'fitness-trainingstagebuch.json';

/**
 * Einen Zugangsschlüssel prüfen, bevor er an GitHub geht.
 *
 * Steht hier und nicht im Formular, damit die Prüfung an einer Stelle liegt
 * (siehe `profilGrenzen()`). Geprüft wird nur, was beim Einfügen schiefgeht:
 * ein leeres Feld, ein Leerzeichen mittendrin, ein abgeschnittener Rest.
 * Ob der Schlüssel gilt, weiß erst GitHub.
 */
export function schluesselLesen(eingabe) {
  const text = String(eingabe ?? '').trim();
  if (!text) throw new Error('Der Zugangsschlüssel fehlt.');
  if (/\s/.test(text) || text.length < 20) {
    throw new Error('Das sieht nicht nach einem vollständigen Zugangsschlüssel aus – er beginnt '
      + 'meist mit „ghp_" oder „github_pat_" und ist ohne Leerzeichen. Bitte noch einmal ganz '
      + 'kopieren.');
  }
  return text;
}

/**
 * Unter allen Gists des Kontos das des Trackers finden.
 *
 * Erkannt wird es am Dateinamen, nicht an der Beschreibung – die lässt sich
 * auf github.com umschreiben, der Dateiname gehört zum Inhalt. Liegen zwei da
 * (zwei Geräte haben gleichzeitig eingerichtet), gilt das **älteste**: Jedes
 * Gerät muss dasselbe wählen, sonst gleicht jedes mit seinem eigenen ab und
 * keines merkt es. „Das erste in der Liste" wäre das jüngste, und das hängt
 * davon ab, wer zuletzt geschrieben hat.
 */
export function gistAuswaehlen(liste) {
  const treffer = (Array.isArray(liste) ? liste : [])
    .filter((g) => g && g.id && g.files && g.files[GIST_DATEI]);
  if (!treffer.length) return null;
  treffer.sort((a, b) => (String(a.created_at || '') < String(b.created_at || '') ? -1
    : String(a.created_at || '') > String(b.created_at || '') ? 1
      : String(a.id) < String(b.id) ? -1 : 1));
  return treffer[0].id;
}
