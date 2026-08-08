// Gerüst der Oberfläche: lädt den Zustand, schaltet zwischen den Ansichten um.

import { $, $$, el, toast, hinweis, heute } from './common.js';
import * as daten from './daten.js';
import { heuteAnsicht } from './heute.js';
import { planAnsicht } from './planAnsicht.js';
import { essenAnsicht } from './essen.js';
import { fortschrittAnsicht } from './fortschritt.js';
import { profilAnsicht } from './profilAnsicht.js';
import { wissenAnsicht } from './wissenAnsicht.js';

const ANSICHTEN = {
  heute: heuteAnsicht,
  plan: planAnsicht,
  essen: essenAnsicht,
  fortschritt: fortschrittAnsicht,
  profil: profilAnsicht,
  wissen: wissenAnsicht,
};

// Der komplette Zustand. Alle Ansichten lesen daraus, damit sie nicht jede für
// sich nachrechnen und dabei auseinanderlaufen.
export const zustand = { daten: null, datum: heute() };

/**
 * Offline-Betrieb und Startbildschirm.
 *
 * Beides hängt am Service Worker. Er wird bewusst erst nach dem ersten Zeichnen
 * registriert – die App soll starten, auch wenn daran etwas schiefgeht.
 */
function offlineVorbereiten() {
  if (!('serviceWorker' in navigator)) return;
  // Über file:// gibt es keine Service Worker; dann läuft die App eben online.
  if (!location.protocol.startsWith('http')) return;

  // Weil zuerst aus dem Vorrat geladen wird, kommt eine neue Fassung erst beim
  // übernächsten Öffnen an. Ohne Hinweis sieht das aus, als sei die Änderung
  // nicht angekommen – und man lädt ratlos immer wieder neu.
  let ersterWorker = true;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Beim allerersten Registrieren übernimmt der Worker ebenfalls die
    // Kontrolle. Das ist keine Aktualisierung und braucht keine Meldung.
    if (ersterWorker) { ersterWorker = false; return; }
    toast('Neue Fassung geladen – zum Übernehmen neu öffnen.', 'info');
  });
  if (navigator.serviceWorker.controller) ersterWorker = false;

  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: './' })
    .catch(() => {});
}

/**
 * Den Browser bitten, die Daten dauerhaft zu behalten.
 *
 * Ohne diese Bitte darf er die Datenbank wegräumen, wenn der Speicher knapp
 * wird. Bei einem Trainingstagebuch wäre das ein stiller Totalverlust – und
 * genau „still" ist das Problem: Man merkt es erst, wenn man nachsehen will.
 */
function speicherSichern() {
  daten.dauerhaftBitten().catch(() => {});

  // Eine Ablage, die nicht schreibt, ist der schlimmste Fehler dieser App:
  // Man trägt weiter ein, und nichts kommt an. Deshalb keine flüchtige
  // Meldung, sondern ein Balken, der stehen bleibt, bis es wieder geht.
  daten.beiProblem(() => zeichnen());
}

/**
 * Warnung, wenn die Ablage klemmt.
 *
 * Getrennt nach Lesen und Schreiben, weil die Ratschläge entgegengesetzt sind:
 * Beim Lesefehler darf man **nichts** überschreiben, beim Schreibfehler sollte
 * man sofort sichern, solange die Daten noch im Arbeitsspeicher stehen.
 */
function ablageWarnung() {
  const a = daten.ablage;
  if (a.gelesen && a.geschrieben) return null;

  if (!a.gelesen) {
    return hinweis('Die Datenbank dieses Geräts ließ sich nicht öffnen. Was du hier siehst, '
      + 'ist deshalb möglicherweise nicht dein echter Stand – spiel jetzt keine Sicherung '
      + 'ein, sonst überschreibst du Daten, die vielleicht noch da sind. Erst die App '
      + `schließen und neu öffnen. (${a.meldung})`, 'gefahr');
  }
  return hinweis('Deine Eingaben werden gerade nicht gespeichert – die Datenbank des Geräts '
    + 'nimmt nichts an. Lade unter Profil sofort eine Sicherung herunter, solange die Daten '
    + `noch geladen sind. (${a.meldung})`, 'gefahr');
}

let aktuelleAnsicht = 'heute';

/**
 * Auf einen anderen Tag wechseln. Nicht nur Bequemlichkeit: Wer abends müde
 * nach Hause kommt, protokolliert die Einheit oft erst am nächsten Tag – ohne
 * Rückblättern wäre sie dann nicht mehr eintragbar.
 */
export async function tagWechseln(datum) {
  zustand.datum = datum;
  await aktualisieren();
}

export function istHeute() {
  return zustand.datum === heute();
}

/** Zustand neu holen und die offene Ansicht neu zeichnen. */
export async function aktualisieren() {
  try {
    zustand.daten = await daten.zustand(zustand.datum);
    kopfZeichnen();
    zeichnen();
  } catch (err) {
    toast(err.message, 'fehler');
  }
}

function kopfZeichnen() {
  const d = zustand.daten;
  if (!d) return;
  const box = $('#kopfStatus');
  const teile = [];

  if (d.startetErstNoch) {
    teile.push('Start steht noch aus');
  } else if (d.woche >= 1) {
    teile.push(`Woche ${d.woche} · ${d.plan.phase.name}`);
  }
  if (d.heute?.bereitschaft?.vollstaendig) {
    teile.push(`Bereitschaft ${d.heute.bereitschaft.prozent} %`);
  }
  box.replaceChildren(el('div', {}, teile.join(' · ') || 'Profil noch unvollständig'));
}

function zeichnen() {
  const inhalt = $('#inhalt');
  const bauen = ANSICHTEN[aktuelleAnsicht];
  if (!bauen || !zustand.daten) return;
  // Die Warnung zur Ablage steht über allem und in jeder Ansicht – sie betrifft
  // nicht das, was man gerade ansieht, sondern ob überhaupt etwas ankommt.
  const warnung = ablageWarnung();
  inhalt.replaceChildren(...(warnung ? [warnung] : []), bauen(zustand.daten));
  window.scrollTo({ top: 0 });
}

function reiterBinden() {
  for (const knopf of $$('.reiter-knopf')) {
    knopf.addEventListener('click', () => {
      aktuelleAnsicht = knopf.dataset.ansicht;
      for (const k of $$('.reiter-knopf')) k.classList.toggle('aktiv', k === knopf);
      location.hash = aktuelleAnsicht;
      zeichnen();
    });
  }
}

function ansichtAusHash() {
  const wunsch = location.hash.slice(1);
  if (ANSICHTEN[wunsch]) {
    aktuelleAnsicht = wunsch;
    for (const k of $$('.reiter-knopf')) k.classList.toggle('aktiv', k.dataset.ansicht === wunsch);
  }
}

window.addEventListener('hashchange', () => {
  ansichtAusHash();
  zeichnen();
});

reiterBinden();
ansichtAusHash();
aktualisieren().then(() => {
  offlineVorbereiten();
  speicherSichern();
});
