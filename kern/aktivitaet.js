// Einheiten aus den Dateien anderer Apps übernehmen.
//
// **Automatisch geht das nicht, und zwar aus einem harten Grund:** Apple Health
// ist ausschließlich für native iOS-Apps geöffnet (HealthKit). Eine Web-App
// kommt dort nicht heran – es gibt keine Schnittstelle, auch keinen Umweg.
// Adidas Running bietet Dritten ebenfalls keine offene Schnittstelle mehr.
//
// Was beide können: **exportieren**. Und eine exportierte Aktivität ist fast
// immer GPX oder TCX – zwei alte, gut dokumentierte XML-Formate, die praktisch
// jede Uhr und jede Lauf-App schreibt. Daraus lassen sich Datum, Dauer,
// Strecke und Durchschnittspuls holen: genau die Felder, die eine
// Ausdauereinheit hier braucht. Bleibt das RPE, das ohnehin niemand messen kann.
//
// Bewusst kein XML-Paket und kein DOMParser: Ersteres verletzt die
// Abhängigkeitsfreiheit, Letzteres gibt es in Node nicht – und dann wäre dieses
// Modul nicht mehr testbar. Für zwei maschinengeschriebene Formate mit einer
// Handvoll gesuchter Felder genügt gezieltes Herausschneiden.

import { GERAETE } from './regeln.js';

/** Inhalte aller Elemente mit diesem Namen, Namensräume egal. */
function inhalte(text, name) {
  const muster = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'gi');
  return [...text.matchAll(muster)].map((t) => t[1]);
}

/** Erster Inhalt oder `null`. */
function inhalt(text, name) {
  const treffer = inhalte(text, name);
  return treffer.length ? treffer[0].trim() : null;
}

/** Wert eines Attributs am ersten Element mit diesem Namen. */
function attribut(text, name, attr) {
  const muster = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*\\b${attr}="([^"]*)"`, 'i');
  return text.match(muster)?.[1] ?? null;
}

const zahl = (wert) => {
  const n = Number(String(wert ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Sportart der Datei auf ein Gerät des Trackers abbilden.
 *
 * Was nicht sicher zuzuordnen ist, bleibt `null` – dann fragt die Oberfläche
 * nach. Eine Einheit stillschweigend als „Laufen" einzusortieren, wäre die
 * schlechtere Vermutung: Ein falsch zugeordnetes Rad-Tempo verdirbt die
 * Tempokurve, und zwar unbemerkt.
 */
export function geraetAusArt(roh) {
  const wort = String(roh || '').toLowerCase();
  if (!wort) return null;
  if (/run|lauf|jog|walk|gehen|hiking|wandern/.test(wort)) return 'laufen';
  if (/bik|cycl|rad|ride/.test(wort)) return 'rad';
  if (/row|ruder/.test(wort)) return 'rudern';
  if (/swim|schwimm/.test(wort)) return 'schwimmen';
  if (/ellipt|cross/.test(wort)) return 'crosstrainer';
  return null;
}

/** Abstand zweier Punkte auf der Erdkugel in Metern. */
function abstand(a, b) {
  const R = 6371000;
  const bogen = (grad) => (grad * Math.PI) / 180;
  const dLat = bogen(b.lat - a.lat);
  const dLon = bogen(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(bogen(a.lat)) * Math.cos(bogen(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* ---------------------------------------------------------------- TCX */

/**
 * TCX schreiben Garmin, Polar, Wahoo und die meisten Portale beim Export.
 * Es enthält Strecke und Dauer als fertige Zahlen – dort muss nichts aus
 * Koordinaten gerechnet werden, und die Werte stammen ggf. aus einem
 * Fußsensor, sind also genauer als GPS.
 */
export function ausTcx(text) {
  const aktivitaet = inhalte(text, 'Activity')[0] || text;
  const runden = inhalte(aktivitaet, 'Lap');
  if (!runden.length) return null;

  let sekunden = 0;
  let meter = 0;
  let pulsSumme = 0;
  let pulsZeit = 0;

  for (const runde of runden) {
    const dauer = zahl(inhalt(runde, 'TotalTimeSeconds')) || 0;
    sekunden += dauer;
    meter += zahl(inhalt(runde, 'DistanceMeters')) || 0;

    // Der Rundenschnitt gilt für die Dauer dieser Runde – ungewichtet gemittelt
    // zöge eine kurze harte Runde den Gesamtschnitt zu weit nach oben.
    const schnitt = zahl(inhalt(inhalt(runde, 'AverageHeartRateBpm') || '', 'Value'));
    if (schnitt && dauer) { pulsSumme += schnitt * dauer; pulsZeit += dauer; }
  }

  // Ohne Rundenschnitte: aus den einzelnen Messpunkten mitteln.
  if (!pulsZeit) {
    const punkte = inhalte(aktivitaet, 'HeartRateBpm')
      .map((h) => zahl(inhalt(h, 'Value')))
      .filter(Boolean);
    if (punkte.length) {
      pulsSumme = punkte.reduce((s, p) => s + p, 0);
      pulsZeit = punkte.length;
    }
  }

  return zusammenstellen({
    datum: inhalt(aktivitaet, 'Id') || inhalt(text, 'Id'),
    sekunden,
    meter,
    hfSchnitt: pulsZeit ? pulsSumme / pulsZeit : null,
    geraet: geraetAusArt(attribut(text, 'Activity', 'Sport')),
    format: 'TCX',
  });
}

/* ---------------------------------------------------------------- GPX */

/**
 * GPX ist der kleinste gemeinsame Nenner – auch Adidas Running und die
 * Routen aus Apple Health kommen so heraus. Der Preis: Strecke und Dauer
 * stehen nicht drin, sie werden aus den Wegpunkten gerechnet.
 */
export function ausGpx(text) {
  const punkte = [...text.matchAll(/<(?:\w+:)?trkpt\b[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"([\s\S]*?)(?:<\/(?:\w+:)?trkpt>|\/>)/gi)]
    .map((t) => ({
      lat: Number(t[1]),
      lon: Number(t[2]),
      zeit: inhalt(t[3], 'time'),
      puls: zahl(inhalt(t[3], 'hr')),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (punkte.length < 2) return null;

  let meter = 0;
  for (let i = 1; i < punkte.length; i += 1) meter += abstand(punkte[i - 1], punkte[i]);

  const zeiten = punkte.map((p) => p.zeit).filter(Boolean).map((z) => Date.parse(z))
    .filter(Number.isFinite);
  const sekunden = zeiten.length >= 2
    ? (Math.max(...zeiten) - Math.min(...zeiten)) / 1000 : 0;

  const pulse = punkte.map((p) => p.puls).filter(Boolean);

  return zusammenstellen({
    datum: punkte.find((p) => p.zeit)?.zeit,
    sekunden,
    meter,
    hfSchnitt: pulse.length ? pulse.reduce((s, p) => s + p, 0) / pulse.length : null,
    // GPX kennt keine feste Sportart. Manche Schreiber setzen <type>.
    geraet: geraetAusArt(inhalt(text, 'type') || inhalt(text, 'name')),
    format: 'GPX',
  });
}

/* ------------------------------------------------------------ Gemeinsam */

/**
 * Aus den Rohwerten eine Einheit machen – oder ehrlich nichts.
 *
 * Geprüft wird auf Plausibilität, nicht auf Vollständigkeit: Eine Datei ohne
 * Puls ist in Ordnung, eine mit 900 km Strecke nicht.
 */
function zusammenstellen({ datum, sekunden, meter, hfSchnitt, geraet, format }) {
  const minuten = Math.round((sekunden || 0) / 60);
  const gerundet = Math.round(meter || 0);
  if (minuten < 1 || minuten > 1440) return null;
  if (gerundet <= 0 || gerundet > 300000) return null;

  const tag = String(datum || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) return null;

  return {
    datum: tag,
    minuten,
    meter: gerundet,
    geraet: GERAETE[geraet] ? geraet : null,
    hfSchnitt: hfSchnitt ? Math.round(hfSchnitt) : null,
    format,
  };
}

/**
 * Eine Datei einlesen, das Format am Inhalt erkennen.
 *
 * Am Inhalt und nicht an der Endung: Exportierte Dateien heißen erfahrungsgemäß
 * alles Mögliche, und `activity.xml` sagt nichts.
 */
export function ausDatei(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Die Datei ist leer.');
  }
  const kopf = text.slice(0, 4000);

  let einheit = null;
  if (/<TrainingCenterDatabase|<Activity\b/i.test(kopf)) einheit = ausTcx(text);
  else if (/<gpx\b|<trkpt\b/i.test(kopf)) einheit = ausGpx(text);
  else {
    throw new Error('Unbekanntes Format. Der Tracker liest GPX und TCX – '
      + 'die Formate, die Lauf-Apps und Uhren beim Export anbieten.');
  }

  if (!einheit) {
    throw new Error('Die Datei enthält keine brauchbare Einheit: Datum, Dauer oder '
      + 'Strecke fehlen oder sind unplausibel.');
  }
  return einheit;
}
