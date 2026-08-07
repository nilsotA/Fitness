// HTTP-Server: liefert die Oberfläche aus und beantwortet die API-Aufrufe.
//
// Kein Framework, keine Abhängigkeiten – node:http reicht für einen Tracker,
// den genau eine Person im eigenen Netz benutzt.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import * as store from './store.js';
import * as profilM from './profil.js';
import * as ernaehrung from './ernaehrung.js';
import * as planM from './plan.js';
import * as belastung from './belastung.js';
import * as leistungM from './leistung.js';
import {
  QUELLEN, SUPPLEMENTE, WOHLBEFINDEN, MUSCLEUP_STUFEN, KRAFTMARKEN, UEBUNGEN,
} from './wissen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3100;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

// Ein abgestürzter Prozess wäre kein Drama – die Daten liegen auf der Platte.
// Trotzdem soll ein Randfall nicht mitten in der Trainingsplanung alles beenden.
process.on('uncaughtException', (err) => console.error('Unerwarteter Fehler:', err));
process.on('unhandledRejection', (err) => console.error('Unerwarteter Fehler:', err));

let lebensmittelCache = null;

async function lebensmittel() {
  if (!lebensmittelCache) {
    const roh = JSON.parse(await readFile(path.join(store.DATA_DIR, 'lebensmittel.json'), 'utf8'));
    lebensmittelCache = roh;
  }
  return lebensmittelCache;
}

/* ------------------------------------------------------------- Werkzeuge */

function json(res, daten, code = 200) {
  const text = JSON.stringify(daten);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function fehler(res, nachricht, code = 400) {
  json(res, { fehler: nachricht }, code);
}

async function body(req) {
  const teile = [];
  let groesse = 0;
  for await (const stueck of req) {
    groesse += stueck.length;
    if (groesse > MAX_BODY_BYTES) throw new Error('Anfrage zu groß.');
    teile.push(stueck);
  }
  if (!teile.length) return {};
  try {
    return JSON.parse(Buffer.concat(teile).toString('utf8'));
  } catch {
    throw new Error('Ungültiges JSON.');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function statisch(res, pfad) {
  // Kein Ausbrechen aus public/ – auch wenn der Server nur lokal läuft.
  const ziel = path.join(PUBLIC_DIR, path.normalize(pfad).replace(/^(\.\.[/\\])+/, ''));
  if (!ziel.startsWith(PUBLIC_DIR)) return fehler(res, 'Nicht gefunden.', 404);

  try {
    const info = await stat(ziel);
    if (!info.isFile()) throw new Error('kein File');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(ziel)] || 'application/octet-stream',
      'Content-Length': info.size,
      // Bewusst no-store statt no-cache: Der Server läuft im eigenen Netz, die
      // Dateien sind winzig, und nichts ist ärgerlicher, als nach einem Update
      // eine halb alte Oberfläche zu bedienen, weil der Browser JavaScript aus
      // dem Cache nimmt. Bandbreite ist hier kein Argument.
      'Cache-Control': 'no-store',
    });
    createReadStream(ziel).pipe(res);
  } catch {
    fehler(res, 'Nicht gefunden.', 404);
  }
}

function heute() {
  return new Date().toISOString().slice(0, 10);
}

/** Wochentag-Index nach deutschem Muster: Montag = 0. */
function tagIndex(datum = new Date()) {
  return (new Date(datum).getDay() + 6) % 7;
}

/* ---------------------------------------------------------- Zusammenbau */

/**
 * Der Gesamtzustand für die Oberfläche. Alles, was das Dashboard braucht, in
 * einem Aufruf – das spart auf dem Handy spürbar Wartezeit gegenüber fünf
 * einzelnen Anfragen.
 */
async function zustand(datum = heute()) {
  const daten = await store.laden();
  const profil = daten.profil;

  const woche = planM.trainingswoche(profil.startdatum, new Date(datum));
  // Der Leistungsstand geht in den Plan ein, damit dort Kilo stehen statt
  // Prozent – am Gerät ist eine Prozentangabe nutzlos.
  const stand = leistungM.leistungsstand(daten);
  const plan = planM.wochenplan(profil, Math.max(1, woche), stand);
  const index = tagIndex(datum);
  const heutePlan = plan.tage[index];

  const einheitenHeute = heutePlan.einheiten.map((e) => ({ typ: e.typ, minuten: e.minuten }));
  const bedarf = ernaehrung.tagesbedarf(profil, einheitenHeute);
  const typ = ernaehrung.tagestyp(einheitenHeute);
  const makro = bedarf ? ernaehrung.makros(profil, bedarf.ziel, typ) : null;

  const essenHeute = daten.essen.filter((e) => e.datum === datum);
  const ist = ernaehrung.tagesSumme(essenHeute);
  const bilanz = makro ? ernaehrung.bilanz(makro, ist) : null;

  // Bewusst über abgeschlossene Tage, nicht über den laufenden – siehe
  // energieverfuegbarkeitSchnitt.
  const ev = ernaehrung.energieverfuegbarkeitSchnitt(
    profil, daten.essen, daten.sessions, new Date(datum));
  const checkHeute = daten.checks.find((c) => c.datum === datum) || null;

  return {
    datum,
    profil,
    profilStatus: profilM.pruefeProfil(profil),
    woche,
    startetErstNoch: Boolean(profil.startdatum) && woche < 1,
    plan,
    heute: {
      ...heutePlan,
      tagestyp: typ,
      bedarf,
      makro,
      ist,
      bilanz,
      energieverfuegbarkeit: ev,
      mahlzeiten: makro ? ernaehrung.mahlzeitenplan(profil, makro) : null,
      essen: essenHeute,
      check: checkHeute,
      bereitschaft: belastung.bereitschaft(checkHeute),
    },
    belastung: {
      acwr: belastung.acwr(daten.sessions, new Date(datum)),
      monotonie: belastung.monotonie(daten.sessions, new Date(datum)),
      entlastung: belastung.entlastungFaellig(daten.sessions, daten.checks, new Date(datum)),
      verlauf: belastung.wochenverlauf(daten.sessions, 12, new Date(datum)),
    },
    muscleup: profilM.muscleupStand({
      klimmzuege: bestwert(daten.tests, 'klimmzuege'),
      muscleups: bestwert(daten.tests, 'muscleups'),
      zusatzlastAnteil: zusatzlastAnteil(daten.tests, profil.gewichtKg),
      manuell: daten.muscleup?.manuell || {},
    }),
    schwerpunkte: profilM.schwerpunkte(profil.ausrichtung),
    ausrichtung: profilM.ausrichtungName(profil.ausrichtung),
    ausdauerEmpfehlung: profilM.ausdauerEmpfehlung(profil),
    letzteSessions: daten.sessions.slice(-10).reverse(),
    gewichtsverlauf: daten.gewicht.slice(-90),
    leistung: {
      maxima: stand.maxima,
      letzte: stand.letzte,
      // Wochenvolumen je Übung: die Zahl, an der sich Hypertrophie entscheidet.
      saetzeDieseWoche: leistungM.saetzeProWoche(daten.sessions, new Date(datum)),
      uebungen: UEBUNGEN,
    },
  };
}

/**
 * Protokollierte Übungen säubern. Unbekannte Schlüssel fliegen raus – sonst
 * landet ein Tippfehler als eigene Übung im Tagebuch und taucht nie wieder auf.
 * Sätze ohne Wiederholungen sind nicht absolviert und werden verworfen.
 */
function uebungenPruefen(roh) {
  if (!Array.isArray(roh)) return [];
  const sauber = [];
  for (const u of roh) {
    if (!UEBUNGEN[u?.schluessel]) continue;
    const saetze = (Array.isArray(u.saetze) ? u.saetze : [])
      .map((s) => ({
        gewicht: Number(s.gewicht) || 0,
        wiederholungen: Math.max(0, Math.round(Number(s.wiederholungen) || 0)),
        rpe: s.rpe != null ? profilM.clamp(Number(s.rpe) || 0, 0, 10) : null,
      }))
      .filter((s) => s.wiederholungen > 0);
    if (!saetze.length) continue;
    sauber.push({ schluessel: u.schluessel, name: UEBUNGEN[u.schluessel].name, saetze });
  }
  return sauber;
}

/** Verlauf je Übung: bestes geschätztes 1RM pro Trainingstag, für die Kurve. */
function uebungsVerlauf(sessions = []) {
  const verlauf = {};
  for (const session of sessions) {
    for (const uebung of session.uebungen || []) {
      const werte = (uebung.saetze || [])
        .filter((s) => s.gewicht > 0 && s.wiederholungen > 0 && s.wiederholungen <= 10)
        .map((s) => profilM.e1rm(s.gewicht, s.wiederholungen))
        .filter(Boolean);
      if (!werte.length) continue;
      verlauf[uebung.schluessel] = verlauf[uebung.schluessel] || [];
      verlauf[uebung.schluessel].push({ datum: session.datum, e1rm: Math.max(...werte) });
    }
  }
  for (const liste of Object.values(verlauf)) liste.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  return verlauf;
}

function bestwert(tests = [], art) {
  const passend = tests.filter((t) => t.art === art).map((t) => Number(t.wert) || 0);
  return passend.length ? Math.max(...passend) : 0;
}

function zusatzlastAnteil(tests = [], gewichtKg) {
  if (!gewichtKg) return 0;
  const last = bestwert(tests, 'klimmzugZusatzlast');
  return last ? last / gewichtKg : 0;
}

/* ------------------------------------------------------------- Routen */

async function api(req, res, url) {
  const pfad = url.pathname.replace(/^\/api/, '');
  const methode = req.method;

  if (methode === 'GET' && pfad === '/zustand') {
    return json(res, await zustand(url.searchParams.get('datum') || heute()));
  }

  if (methode === 'GET' && pfad === '/plan') {
    const daten = await store.laden();
    const woche = Math.max(1, Number(url.searchParams.get('woche')) || 1);
    return json(res, planM.wochenplan(daten.profil, woche));
  }

  if (methode === 'PUT' && pfad === '/profil') {
    const eingabe = await body(req);
    const neu = await store.aendern((daten) => {
      daten.profil = { ...daten.profil, ...eingabe };
      // Zahlenfelder kommen aus Formularen als Text zurück.
      for (const feld of ['groesseCm', 'gewichtKg', 'koerperfettProzent', 'geburtsjahr',
        'ausrichtung', 'trainingstageProWoche']) {
        if (daten.profil[feld] === '' || daten.profil[feld] == null) daten.profil[feld] = null;
        else daten.profil[feld] = Number(daten.profil[feld]);
      }
      return daten.profil;
    });
    // Gewichtsänderung wandert in den Verlauf, damit die Kurve stimmt.
    if (eingabe.gewichtKg) {
      await store.aendern((daten) => {
        const datum = heute();
        const vorhanden = daten.gewicht.find((g) => g.datum === datum);
        if (vorhanden) vorhanden.kg = Number(eingabe.gewichtKg);
        else daten.gewicht.push({ datum, kg: Number(eingabe.gewichtKg) });
      });
    }
    return json(res, neu);
  }

  if (methode === 'POST' && pfad === '/session') {
    const e = await body(req);
    if (!e.typ || !e.minuten) return fehler(res, 'Typ und Dauer fehlen.');
    const eintrag = {
      id: store.id('s'),
      datum: e.datum || heute(),
      typ: e.typ,
      titel: e.titel || '',
      minuten: Number(e.minuten) || 0,
      rpe: profilM.clamp(Number(e.rpe) || 0, 0, 10),
      notiz: e.notiz || '',
      uebungen: uebungenPruefen(e.uebungen),
    };
    eintrag.last = belastung.sessionLast(eintrag.rpe, eintrag.minuten);
    await store.aendern((daten) => daten.sessions.push(eintrag));
    return json(res, eintrag, 201);
  }

  if (methode === 'PUT' && pfad.startsWith('/session/')) {
    const id = pfad.slice('/session/'.length);
    const e = await body(req);
    const treffer = await store.aendern((daten) => {
      const session = daten.sessions.find((s) => s.id === id);
      if (!session) return null;
      if (e.minuten != null) session.minuten = Number(e.minuten) || 0;
      if (e.rpe != null) session.rpe = profilM.clamp(Number(e.rpe) || 0, 0, 10);
      if (e.notiz != null) session.notiz = e.notiz;
      if (e.uebungen != null) session.uebungen = uebungenPruefen(e.uebungen);
      session.last = belastung.sessionLast(session.rpe, session.minuten);
      return session;
    });
    if (!treffer) return fehler(res, 'Einheit nicht gefunden.', 404);
    return json(res, treffer);
  }

  if (methode === 'GET' && pfad === '/leistung') {
    const daten = await store.laden();
    const stand = leistungM.leistungsstand(daten);
    return json(res, {
      ...stand,
      uebungen: UEBUNGEN,
      saetzeDieseWoche: leistungM.saetzeProWoche(daten.sessions),
      verlauf: uebungsVerlauf(daten.sessions),
    });
  }

  if (methode === 'DELETE' && pfad.startsWith('/session/')) {
    const id = pfad.slice('/session/'.length);
    await store.aendern((daten) => {
      daten.sessions = daten.sessions.filter((s) => s.id !== id);
    });
    return json(res, { ok: true });
  }

  if (methode === 'GET' && pfad === '/lebensmittel') {
    return json(res, await lebensmittel());
  }

  if (methode === 'POST' && pfad === '/essen') {
    const e = await body(req);
    if (!e.name || !e.mengeG) return fehler(res, 'Name und Menge fehlen.');
    const eintrag = {
      id: store.id('f'),
      datum: e.datum || heute(),
      mahlzeit: e.mahlzeit || 'sonstiges',
      name: e.name,
      mengeG: Number(e.mengeG) || 0,
      kcal: Number(e.kcal) || 0,
      protein: Number(e.protein) || 0,
      kohlenhydrate: Number(e.kohlenhydrate) || 0,
      fett: Number(e.fett) || 0,
    };
    await store.aendern((daten) => daten.essen.push(eintrag));
    return json(res, eintrag, 201);
  }

  if (methode === 'DELETE' && pfad.startsWith('/essen/')) {
    const id = pfad.slice('/essen/'.length);
    await store.aendern((daten) => {
      daten.essen = daten.essen.filter((e) => e.id !== id);
    });
    return json(res, { ok: true });
  }

  if (methode === 'POST' && pfad === '/check') {
    const e = await body(req);
    const datum = e.datum || heute();
    const eintrag = { datum };
    for (const frage of WOHLBEFINDEN) {
      eintrag[frage.id] = profilM.clamp(Number(e[frage.id]) || 0, 0, 5);
    }
    eintrag.notiz = e.notiz || '';
    await store.aendern((daten) => {
      daten.checks = daten.checks.filter((c) => c.datum !== datum);
      daten.checks.push(eintrag);
    });
    return json(res, { ...eintrag, bereitschaft: belastung.bereitschaft(eintrag) }, 201);
  }

  if (methode === 'POST' && pfad === '/gewicht') {
    const e = await body(req);
    const kg = Number(e.kg);
    if (!kg) return fehler(res, 'Gewicht fehlt.');
    const datum = e.datum || heute();
    await store.aendern((daten) => {
      // Ein Tag, ein Wert – ein zweites Wiegen ersetzt das erste, statt die
      // Kurve mit zwei Punkten am selben Tag zu verzacken.
      daten.gewicht = daten.gewicht.filter((g) => g.datum !== datum);
      daten.gewicht.push({ datum, kg });
      daten.gewicht.sort((a, b) => (a.datum < b.datum ? -1 : 1));
      // Das aktuellste Gewicht ist zugleich das Profilgewicht – sonst rechnet
      // die Ernährung mit einem veralteten Wert weiter.
      const neuestes = daten.gewicht[daten.gewicht.length - 1];
      if (neuestes.datum >= heute()) daten.profil.gewichtKg = neuestes.kg;
    });
    return json(res, { ok: true, datum, kg }, 201);
  }

  if (methode === 'POST' && pfad === '/test') {
    const e = await body(req);
    if (!e.art || e.wert == null) return fehler(res, 'Testart und Wert fehlen.');
    const eintrag = {
      id: store.id('t'),
      datum: e.datum || heute(),
      art: e.art,
      wert: Number(e.wert),
      wiederholungen: e.wiederholungen != null ? Number(e.wiederholungen) : null,
      notiz: e.notiz || '',
    };
    await store.aendern((daten) => daten.tests.push(eintrag));
    return json(res, eintrag, 201);
  }

  if (methode === 'GET' && pfad === '/tests') {
    const daten = await store.laden();
    return json(res, { tests: daten.tests, marken: KRAFTMARKEN, stufen: MUSCLEUP_STUFEN });
  }

  if (methode === 'DELETE' && pfad.startsWith('/test/')) {
    const id = pfad.slice('/test/'.length);
    await store.aendern((daten) => {
      daten.tests = daten.tests.filter((t) => t.id !== id);
    });
    return json(res, { ok: true });
  }

  if (methode === 'POST' && pfad === '/muscleup') {
    const e = await body(req);
    await store.aendern((daten) => {
      daten.muscleup = daten.muscleup || { manuell: {} };
      daten.muscleup.manuell[String(e.stufe)] = Boolean(e.erreicht);
    });
    const daten = await store.laden();
    return json(res, profilM.muscleupStand({
      klimmzuege: bestwert(daten.tests, 'klimmzuege'),
      muscleups: bestwert(daten.tests, 'muscleups'),
      zusatzlastAnteil: zusatzlastAnteil(daten.tests, daten.profil.gewichtKg),
      manuell: daten.muscleup.manuell,
    }));
  }

  if (methode === 'GET' && pfad === '/wissen') {
    return json(res, { quellen: QUELLEN, supplemente: SUPPLEMENTE, wohlbefinden: WOHLBEFINDEN });
  }

  if (methode === 'GET' && pfad === '/export') {
    const daten = await store.laden();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="trainingstagebuch-${heute()}.json"`,
    });
    return res.end(JSON.stringify(daten, null, 2));
  }

  if (methode === 'POST' && pfad === '/import') {
    const eingabe = await body(req);
    if (!eingabe || typeof eingabe !== 'object' || !Array.isArray(eingabe.sessions)) {
      return fehler(res, 'Das sieht nicht nach einem Trainingstagebuch aus.');
    }
    // Vor dem Überschreiben eine Kopie – ein falsch gewählter Import darf
    // nicht Jahre an Daten kosten.
    const kopie = await store.sicherungskopie();
    await store.aendern((daten) => {
      Object.assign(daten, { ...store.leeresTagebuch(), ...eingabe });
    });
    await store.sichernJetzt();
    return json(res, { ok: true, sicherung: path.basename(kopie) });
  }

  return fehler(res, 'Unbekannter Aufruf.', 404);
}

/* -------------------------------------------------------------- Server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/') return await statisch(res, 'index.html');
    return await statisch(res, url.pathname);
  } catch (err) {
    console.error('Fehler bei', req.method, url.pathname, '–', err.message);
    if (!res.headersSent) fehler(res, err.message || 'Serverfehler.', 500);
    else res.end();
  }
});

function adressen() {
  const liste = [];
  for (const schnittstellen of Object.values(os.networkInterfaces())) {
    for (const s of schnittstellen || []) {
      if (s.family === 'IPv4' && !s.internal) liste.push(s.address);
    }
  }
  return liste;
}

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('\n  Trainingstracker läuft.\n');
    console.log(`  Auf diesem Rechner:  http://localhost:${PORT}`);
    for (const adresse of adressen()) {
      console.log(`  Im WLAN (Handy):     http://${adresse}:${PORT}`);
    }
    console.log('\n  Beenden mit Strg+C. Daten liegen in data/tagebuch.json.\n');
  });

  // Beim Beenden nicht die letzten 400 ms Änderungen verlieren.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      await store.sichernJetzt().catch(() => {});
      process.exit(0);
    });
  }
}

export { server, zustand };
