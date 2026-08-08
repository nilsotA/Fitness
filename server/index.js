// Kleiner Dateiserver für die Entwicklung.
//
// Der Tracker braucht keinen Server mehr: Gerechnet wird im Browser (`kern/`),
// gespeichert wird in der Datenbank des Geräts (`app/speicher.js`). Im Betrieb
// liegt die App auf GitHub Pages und läuft auch ohne Netz.
//
// Übrig bleibt dieser Server für genau einen Zweck: Ein Browser lädt ES-Module
// nicht über `file://`. Wer die App lokal öffnen will, braucht also etwas, das
// Dateien über HTTP ausliefert. Mehr macht das hier nicht – keine API, keine
// Datenhaltung, keine Trainingslogik.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3100;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Nur ausliefern, was zur App gehört. Ohne diese Liste läge das ganze
// Verzeichnis offen – samt allem, was sonst noch daneben liegt.
const ERLAUBT = ['app', 'kern', 'index.html', 'manifest.webmanifest', 'sw.js'];

function erlaubt(ziel) {
  const rel = path.relative(WURZEL, ziel);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return ERLAUBT.includes(rel.split(path.sep)[0]);
}

async function ausliefern(res, pfad) {
  const ziel = path.join(WURZEL, path.normalize(pfad).replace(/^(\.\.[/\\])+/, ''));
  if (!erlaubt(ziel)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Nicht gefunden.');
  }
  try {
    const info = await stat(ziel);
    if (!info.isFile()) throw new Error('kein File');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(ziel)] || 'application/octet-stream',
      'Content-Length': info.size,
      // Bewusst no-store: Beim Entwickeln ist nichts ärgerlicher als eine halb
      // alte Oberfläche aus dem Cache. Im Betrieb regelt das der Service Worker.
      'Cache-Control': 'no-store',
    });
    createReadStream(ziel).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden.');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  await ausliefern(res, url.pathname === '/' ? 'index.html' : url.pathname);
});

function adressen() {
  const gefunden = [];
  for (const liste of Object.values(os.networkInterfaces())) {
    for (const netz of liste || []) {
      if (netz.family === 'IPv4' && !netz.internal) gefunden.push(netz.address);
    }
  }
  return gefunden;
}

// Nur starten, wenn die Datei direkt aufgerufen wurde. Wird sie importiert –
// etwa vom Test, der sich einen freien Port geben lässt –, käme es sonst zu
// zwei listen-Aufrufen und der Import schlüge fehl.
const direktAufgerufen = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direktAufgerufen) {
  server.listen(PORT, () => {
    const zeilen = ['', '  Trainingstracker läuft.', '',
      `  Auf diesem Rechner:  http://localhost:${PORT}`];
    for (const adresse of adressen()) {
      zeilen.push(`  Im WLAN (Handy):     http://${adresse}:${PORT}`);
    }
    zeilen.push('', '  Die Daten liegen im Browser, nicht hier. Beenden mit Strg+C.', '');
    console.log(zeilen.join('\n'));
  });
}

export { server };
