// Hinweis zum Hinzufügen auf den Startbildschirm.
//
// Das ist keine Kosmetik. Zwei Dinge hängen daran:
//
// 1. Der Browser sagt dauerhaften Speicher erst dann zuverlässig zu. Ohne das
//    darf er die Datenbank wegräumen, wenn der Platz knapp wird – bei einem
//    Trainingstagebuch ein stiller Totalverlust.
// 2. Auf der Bahn will man antippen und eintragen, nicht erst einen Browser
//    öffnen und eine Adresse suchen.
//
// Der Hinweis kommt einmal und lässt sich wegklicken. Ein Banner, das jeden Tag
// wiederkommt, wird nach drei Tagen nicht mehr gelesen – und dann übersieht man
// auch die Meldungen daneben.

import { el, karte, hinweis } from './common.js';

const WEGGEKLICKT = 'tracker-installhinweis-weg';

/** Läuft die App bereits als eigenständige App? */
export function istInstalliert() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

// Chrome meldet die Installierbarkeit über ein Ereignis, das man auffangen und
// später auslösen muss – danach ist es verbraucht. Deshalb wird es hier
// weggelegt, statt sofort verwendet zu werden.
let angebot = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  angebot = e;
});

function istApple() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    // iPads melden sich seit einiger Zeit als Mac; der Touchscreen verrät sie.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Die Karte, oder `null`, wenn sie nicht gebraucht wird. Der Aufrufer hängt sie
 * einfach ein – so muss die Ansicht nichts über Installierbarkeit wissen.
 */
export function installKarte(neuZeichnen) {
  if (istInstalliert()) return null;
  try {
    if (localStorage.getItem(WEGGEKLICKT)) return null;
  } catch { /* Privater Modus: dann eben jedes Mal. */ }

  const box = karte(el('h2', {}, 'Auf den Startbildschirm legen'));
  box.append(el('p', { class: 'klein' },
    'Dann startet der Tracker wie eine App – ohne Browserleiste, und ohne Netz. '
    + 'Wichtiger noch: Erst dann sagt der Browser zu, deine Daten dauerhaft zu '
    + 'behalten. Sie liegen nur auf diesem Gerät.'));

  if (angebot) {
    box.append(el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          angebot.prompt();
          await angebot.userChoice;
          angebot = null;
          neuZeichnen?.();
        },
      }, 'Hinzufügen'),
      el('button', { class: 'knopf leise', onclick: () => wegklicken(neuZeichnen) }, 'Später')));
  } else if (istApple()) {
    // Safari bietet keinen Knopf an – hier hilft nur die Anleitung.
    box.append(hinweis(
      'In Safari unten auf „Teilen" tippen und „Zum Home-Bildschirm" wählen.', 'info'));
    box.append(el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf leise', onclick: () => wegklicken(neuZeichnen) }, 'Verstanden')));
  } else {
    box.append(el('p', { class: 'mini' },
      'Im Browsermenü findest du dafür „App installieren" oder „Zum Startbildschirm '
      + 'hinzufügen".'));
    box.append(el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf leise', onclick: () => wegklicken(neuZeichnen) }, 'Verstanden')));
  }

  return box;
}

function wegklicken(neuZeichnen) {
  try { localStorage.setItem(WEGGEKLICKT, '1'); } catch { /* egal */ }
  neuZeichnen?.();
}
