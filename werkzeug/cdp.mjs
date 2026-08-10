// Ein sehr kleiner Klient fürs DevTools-Protokoll.
//
// Warum nicht Playwright: null Abhängigkeiten gilt auch fürs Werkzeug. Node 22
// bringt `WebSocket` und `fetch` mit, und mehr braucht es für das bisschen
// Fernsteuerung nicht. Diese Dateien werden **nicht** ausgeliefert – sie stehen
// deshalb nicht in der Dateiliste von `sw.js`.

/** Verbindet sich mit einer laufenden Chromium-Instanz. Siehe `starten.sh`. */
export async function verbinde(port = Number(process.env.CDP_PORT) || 9560) {
  const holen = async () => (await fetch(`http://localhost:${port}/json/list`)).json();
  let ziel = (await holen()).find((t) => t.type === 'page');
  if (!ziel) {
    await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' });
    ziel = (await holen()).find((t) => t.type === 'page');
  }
  if (!ziel) throw new Error(`Keine Seite auf Port ${port}. Läuft Chromium? Siehe werkzeug/starten.sh`);

  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise((f, r) => {
    ws.addEventListener('open', f, { once: true });
    ws.addEventListener('error', () => r(new Error('CDP-Verbindung fehlgeschlagen')), { once: true });
  });

  let id = 0;
  const offen = new Map();
  const horcher = new Set();
  ws.addEventListener('message', (e) => {
    const a = JSON.parse(e.data);
    if (a.method) { for (const fn of horcher) fn(a); return; }
    if (!offen.has(a.id)) return;
    const { fertig, fehler } = offen.get(a.id);
    offen.delete(a.id);
    if (a.error) fehler(new Error(JSON.stringify(a.error))); else fertig(a.result);
  });

  // Achtung, schon einmal reingefallen: `ruf` liefert bereits `a.result`. Das
  // Ergebnis von `Runtime.evaluate` steht damit unter `treffer.result.value`
  // und nicht eine Ebene tiefer.
  const ruf = (method, params = {}) => new Promise((fertig, fehler) => {
    id += 1;
    offen.set(id, { fertig, fehler });
    ws.send(JSON.stringify({ id, method, params }));
  });

  /** Auf Ereignisse horchen (`Runtime.consoleAPICalled` und Verwandte). */
  const bei = (fn) => { horcher.add(fn); return () => horcher.delete(fn); };

  return { ruf, bei, zu: () => ws.close() };
}

/** JavaScript in der Seite ausführen und das Ergebnis zurückholen. */
export async function js(ruf, ausdruck) {
  const t = await ruf('Runtime.evaluate', {
    expression: `(async () => { ${ausdruck} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (t.exceptionDetails) throw new Error(JSON.stringify(t.exceptionDetails).slice(0, 800));
  return t.result.value;
}

/**
 * Zu einer Ansicht wechseln.
 *
 * Mit `neuLaden` wird zusätzlich `Page.reload` mit `ignoreCache` geschickt.
 * Das braucht es nach jeder Codeänderung: Eine Navigation auf denselben Hash
 * lädt die Seite nicht neu, und der Service Worker bedient ohnehin zuerst aus
 * dem Vorrat – ohne das prüft man den alten Stand.
 */
export async function zurAnsicht(ruf, ansicht, { port = Number(process.env.APP_PORT) || 3140, neuLaden = false } = {}) {
  await ruf('Page.navigate', { url: `http://localhost:${port}/#${ansicht}` });
  await warte(600);
  if (neuLaden) {
    await ruf('Page.reload', { ignoreCache: true });
    await warte(1500);
    await ruf('Page.navigate', { url: `http://localhost:${port}/#${ansicht}` });
    await warte(900);
  }
}

/** Service Worker und Vorrat wegräumen – sonst sieht man die alte Fassung. */
export async function vorratLeeren(ruf) {
  return js(ruf, `
    const rs = await navigator.serviceWorker.getRegistrations();
    for (const r of rs) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    return true;
  `);
}

/** Gerätemaße setzen. 390 × 1400 ist das übliche Handyformat, 320 das schmalste. */
export function geraet(ruf, breite = 390, hoehe = 1400) {
  return ruf('Emulation.setDeviceMetricsOverride',
    { width: breite, height: hoehe, deviceScaleFactor: 2, mobile: true });
}

export const ANSICHTEN = ['heute', 'plan', 'fortschritt', 'essen', 'profil', 'wissen'];

export function warte(ms) { return new Promise((f) => setTimeout(f, ms)); }
