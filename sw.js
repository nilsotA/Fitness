// Service Worker: macht den Tracker offline benutzbar.
//
// Der Grund ist nicht Bequemlichkeit, sondern der Ort: Trainiert wird auf der
// Bahn, im Keller oder in einer Halle – überall dort, wo das Netz wegbleibt.
// Eine App, die dann eine Fehlerseite zeigt, ist genau im entscheidenden Moment
// nutzlos.
//
// Bewusst simpel gehalten: Alle Dateien der App werden bei der Installation
// abgelegt, danach zuerst aus diesem Vorrat bedient. Die Trainingsdaten liegen
// nicht hier, sondern in der IndexedDB – der Vorrat enthält nur Programmcode
// und darf jederzeit verworfen werden.

// Die Version im Namen ist der ganze Aktualisierungsmechanismus: Ändert sich
// der Name, gilt der alte Vorrat als veraltet und wird gelöscht. Ohne das säße
// man nach einer Änderung dauerhaft auf der alten Fassung.
const VORRAT = 'tracker-v5';

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/style.css',
  './app/symbol.svg',
  './app/symbol-180.png',
  './app/symbol-192.png',
  './app/symbol-512.png',
  './app/app.js',
  './app/common.js',
  './app/daten.js',
  './app/speicher.js',
  './app/heute.js',
  './app/installieren.js',
  './app/essen.js',
  './app/fortschritt.js',
  './app/planAnsicht.js',
  './app/profilAnsicht.js',
  './app/protokoll.js',
  './app/wissenAnsicht.js',
  './kern/regeln.js',
  './kern/wissen.js',
  './kern/profil.js',
  './kern/plan.js',
  './kern/leistung.js',
  './kern/ernaehrung.js',
  './kern/belastung.js',
  './kern/sprint.js',
  './kern/ausdauer.js',
  './kern/aktivitaet.js',
  './kern/zustand.js',
  './kern/aendern.js',
  './kern/lebensmittel.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VORRAT)
      // Einzeln statt addAll: Sonst lässt eine einzige fehlende Datei die
      // ganze Installation scheitern, und die App bleibt für immer online-only.
      .then((vorrat) => Promise.all(DATEIEN.map((d) => vorrat.add(d).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VORRAT).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Erst der Vorrat, dann das Netz – und die Erneuerung läuft nebenher.
 *
 * Andersherum wäre naheliegender („immer das Neueste"), ist hier aber falsch:
 * Ein Netzaufruf scheitert nur *sofort*, wenn gar keine Verbindung besteht. Am
 * Sportplatz mit einem Balken hängt er stattdessen sekundenlang, bevor er
 * aufgibt – und genau dort steht man zwischen zwei Sätzen mit dem Handy in der
 * Hand. Der Vorrat antwortet ohne Verzögerung.
 *
 * Der Preis: Nach einer Änderung sieht man sie erst beim übernächsten Öffnen.
 * Für einen persönlichen Tracker, der sich selten ändert und täglich benutzt
 * wird, ist das der bessere Tausch.
 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((treffer) => {
      const ausDemNetz = fetch(e.request)
        .then((antwort) => {
          if (antwort.ok) {
            const kopie = antwort.clone();
            caches.open(VORRAT).then((vorrat) => vorrat.put(e.request, kopie)).catch(() => {});
          }
          return antwort;
        })
        // Ohne Netz und ohne Vorrat bleibt bei einem Seitenaufruf immer noch
        // die Startseite – besser als die Fehlerseite des Browsers.
        .catch(() => (e.request.mode === 'navigate'
          ? caches.match('./index.html') : Promise.reject(new Error('offline'))));

      return treffer || ausDemNetz;
    }),
  );
});
