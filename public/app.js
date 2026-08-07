// Gerüst der Oberfläche: lädt den Zustand, schaltet zwischen den Ansichten um.

import { $, $$, el, hole, toast } from './common.js';
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

// Der komplette Serverzustand. Alle Ansichten lesen daraus, damit sie nicht
// jede für sich nachladen und dabei auseinanderlaufen.
export const zustand = { daten: null, datum: heute() };

let aktuelleAnsicht = 'heute';

function heute() {
  return new Date().toISOString().slice(0, 10);
}

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
    zustand.daten = await hole(`/zustand?datum=${zustand.datum}`);
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
  inhalt.replaceChildren(bauen(zustand.daten));
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
aktualisieren();
