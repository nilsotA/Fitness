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
const VORRAT = 'tracker-v1';

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/style.css',
  './app/symbol.svg',
  './app/app.js',
  './app/common.js',
  './app/daten.js',
  './app/speicher.js',
  './app/heute.js',
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // Erst das Netz, damit Änderungen ankommen; fällt es aus, der Vorrat.
    // Andersherum säße man nach jeder Änderung auf altem Stand, bis der Vorrat
    // erneuert wird – und Änderungen kommen hier häufiger als Netzausfälle.
    fetch(e.request)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(VORRAT).then((vorrat) => vorrat.put(e.request, kopie)).catch(() => {});
        return antwort;
      })
      .catch(() => caches.match(e.request).then((treffer) => treffer
        || caches.match('./index.html'))),
  );
});
