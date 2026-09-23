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

import { GERAETE, heute } from './regeln.js';

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
  /*
   * Geprüft wird **je Wort**, nicht auf Teilstücke. Hier stand
   * `/run|lauf|…/.test(text)`, und „run" steckt in „Radrunde", „MTB-Runde",
   * „Grunewald Ride" und „Brunch Ride" – alle wurden zu Laufen, samt
   * 30 km in 60 min als 2:00 /km in der Laufkurve. Genau das, wovor der
   * Kommentar oben warnt (Falle 105).
   *
   * Englische Namen sind ganze Wörter („Morning Run", „Ride"), deutsche oft
   * Zusammensetzungen („Abendlauf", „Radrunde", „Rennrad"): Dort zählt der
   * Wortstamm am Anfang oder am Ende des Wortes. Sprechen zwei Wörter für
   * zwei Geräte, bleibt es `null` – dann fragt die Oberfläche nach.
   */
  const woerter = String(roh || '').toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
  const geraete = new Set();
  for (const w of woerter) {
    for (const [geraet, muster] of GERAETE_WOERTER) {
      if (muster.test(w)) geraete.add(geraet);
    }
  }
  return geraete.size === 1 ? [...geraete][0] : null;
}

/**
 * Welches Wort auf welches Gerät weist. Englisch als ganzes Wort, deutsch als
 * Stamm am Anfang oder Ende einer Zusammensetzung.
 */
const GERAETE_WOERTER = [
  ['laufen', /^(run|runs|running|runner|jog|jogging|walk|walking|hike|hiking|trail|treadmill|gehen)$|^(lauf|jogg|wander|spazier)|lauf$/],
  ['rad', /^(ride|rides|riding|cycling|cycle|bike|biking|ebike|mtb|gravel|velo)$|^(rad|fahrrad|rennrad|mountainbike|gravel|mtb)|(rad|bike)$/],
  ['rudern', /^(row|rows|rowing|rower)$|^ruder/],
  ['schwimmen', /^(swim|swims|swimming)$|^schwimm|schwimmen$/],
  ['crosstrainer', /^(elliptical|crosstrainer)$|^ellipt|crosstrainer$/],
];

/**
 * GPS-Rauschen herausmitteln, bevor die Strecke summiert wird.
 *
 * **Ohne das ist die Strecke aus einer GPX-Datei unbrauchbar.** Nachgemessen an
 * einer simulierten Spur mit bekannter Länge: 10 km, ein Punkt je Sekunde,
 * ±3 m Rauschen – die rohe Summe der Teilstrecken ergibt 18,4 km. Kein
 * Rundungsfehler, sondern das Doppelte.
 *
 * Der Grund ist einfach: Bei 3,3 m/s liegen die Punkte 3,3 m auseinander, das
 * Rauschen bewegt sie aber um ähnlich viel. Jeder Zickzack zählt voll mit, und
 * Rauschen macht eine Strecke immer *länger*, nie kürzer.
 *
 * Ein gleitender Mittelwert räumt das auf. Die Fenstergröße richtet sich nach
 * der Punktdichte, nicht nach einer festen Zahl: Geglättet wird über rund
 * 30 zurückgelegte Meter. Bei sekündlichen Punkten sind das neun, bei einer
 * Spur mit einem Punkt alle 50 m gar keine – dort wäre Glätten schädlich, weil
 * es Kurven abschneiden würde.
 *
 * Ein Haken steckt dabei im Detail: Die Punktdichte darf **nicht** an den
 * verrauschten Abständen gemessen werden – die sind ja selbst schon zu lang,
 * und das Fenster fiele zu klein aus. Bei ±5 m Rauschen blieben so 28 % Fehler
 * übrig. Deshalb zwei Schritte: erst grob vorglätten, nur um die echte Dichte
 * zu schätzen, dann einmal richtig glätten.
 *
 * Nachgemessen bleiben damit höchstens 2,6 % Abweichung, meist unter 1,5 % –
 * auf gerader Strecke wie auf einer 400-m-Bahn. Zweimal zu glätten wäre auf
 * der Geraden noch genauer, schneidet in Kurven aber 2 % ab; ein reines
 * Ausdünnen der Punkte ebenso.
 */
const GLAETTUNG_METER = 30;
const GLAETTUNG_MAX = 15;
const VORGLAETTUNG = 5;

/** Typischer Abstand zwischen zwei Punkten. Median, weil eine Pause mitten im
 *  Lauf eine einzelne sehr lange Teilstrecke erzeugt, die den Mittelwert verzöge. */
function medianAbstand(punkte) {
  const laengen = [];
  for (let i = 1; i < punkte.length; i += 1) laengen.push(abstand(punkte[i - 1], punkte[i]));
  if (!laengen.length) return 0;
  laengen.sort((a, b) => a - b);
  return laengen[Math.floor(laengen.length / 2)];
}

function mitteln(punkte, fenster) {
  if (fenster < 3) return punkte;
  const halb = fenster >> 1;
  return punkte.map((p, i) => {
    const teil = punkte.slice(Math.max(0, i - halb), Math.min(punkte.length, i + halb + 1));
    return {
      ...p,
      lat: teil.reduce((s, q) => s + q.lat, 0) / teil.length,
      lon: teil.reduce((s, q) => s + q.lon, 0) / teil.length,
    };
  });
}

function geglaettet(punkte) {
  if (punkte.length < 5) return punkte;

  // Die Dichte an der vorgeglätteten Spur messen, nicht an der rohen.
  const dichte = medianAbstand(mitteln(punkte, VORGLAETTUNG));
  if (!dichte) return punkte;

  let fenster = Math.round(GLAETTUNG_METER / dichte);
  if (fenster % 2 === 0) fenster += 1;              // ungerade, damit mittig
  fenster = Math.min(GLAETTUNG_MAX, fenster);
  // Schon grob abgetastet: Glätten würde hier Kurven abschneiden, nicht
  // Rauschen entfernen.
  if (fenster < 3) return punkte;

  return mitteln(punkte, fenster);
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
  // Eine TCX-Datei darf mehrere Aktivitäten enthalten. Nur die erste zu nehmen
  // hieße, den Rest stillschweigend wegzuwerfen – und stillschweigend ist hier
  // das Problem: Man merkt es erst Wochen später an einer Lücke im Verlauf.
  const aktivitaeten = inhalte(text, 'Activity');
  if (aktivitaeten.length > 1) {
    return aktivitaeten
      .map((a, i) => eineTcxAktivitaet(a, sportArten(text)[i]))
      .filter(Boolean);
  }
  const einzeln = eineTcxAktivitaet(aktivitaeten[0] || text, attribut(text, 'Activity', 'Sport'));
  return einzeln ? [einzeln] : [];
}

/** Alle Sport-Attribute in Dateireihenfolge – je Aktivität eines. */
function sportArten(text) {
  return [...text.matchAll(/<(?:\w+:)?Activity\b[^>]*\bSport="([^"]*)"/gi)].map((t) => t[1]);
}

function eineTcxAktivitaet(aktivitaet, sport) {
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
    datum: inhalt(aktivitaet, 'Id'),
    sekunden,
    meter,
    hfSchnitt: pulsZeit ? pulsSumme / pulsZeit : null,
    geraet: geraetAusArt(sport),
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
  // GPX kennt mehrere Spuren (<trk>). Jede ist eine eigene Einheit.
  const spuren = inhalte(text, 'trk');
  if (spuren.length > 1) {
    return spuren.map((spur) => eineGpxSpur(spur, text)).filter(Boolean);
  }
  const einzeln = eineGpxSpur(spuren[0] || text, text);
  return einzeln ? [einzeln] : [];
}

/**
 * Wie lange die Aufzeichnung stand – Auto-Pause an der Ampel, eine Rast.
 *
 * GPX kennt keine Timerzeit, nur Zeitpunkte. Gerechnet wurde deshalb vom
 * ersten bis zum letzten Punkt, und zehn Ampelstopps à einer Minute machten
 * aus 60 Minuten Fahrt 70 – mit 17 % mehr Belastung (RPE × Minuten) und einem
 * Tempo von 25,8 statt 30 km/h in der Kurve. Dieselbe Fahrt als TCX kam mit
 * der Timerzeit an, also mit 60 (Falle 105).
 *
 * Eine Pause erkennt man daran, dass ein Schritt **viel länger** dauert als
 * die übliche Abtastung der Datei und man dabei **kaum vorankam**. Beides wird
 * an der Datei selbst gemessen, nicht an einer festen Uhrzeit: Manche Apps
 * setzen nur jede Minute einen Punkt, dort wäre „eine Minute ohne Punkt" der
 * Normalfall. Die zweite Bedingung trennt die Pause vom Funkloch – wer im
 * Tunnel weiterfährt, kommt am anderen Ende weit entfernt wieder heraus, und
 * die Zeit bleibt Bewegungszeit.
 *
 * Ob eine Lücke Pause oder Funkloch war, weiß die Datei nicht sicher. Deshalb
 * nennt der Dialog beide Zahlen, und die Dauer bleibt änderbar.
 */
const PAUSE_SCHRITT_FAKTOR = 10;   // „viel länger" als der übliche Schritt
const PAUSE_TEMPO_ANTEIL = 0.5;    // „kaum voran": unter halbem üblichem Tempo

function pausenSekunden(punkte) {
  const mitZeit = punkte
    .map((p) => ({ ...p, t: Date.parse(p.zeit) }))
    .filter((p) => Number.isFinite(p.t));
  const schritte = [];
  for (let i = 1; i < mitZeit.length; i += 1) {
    const dauer = (mitZeit[i].t - mitZeit[i - 1].t) / 1000;
    if (dauer > 0) schritte.push({ dauer, meter: abstand(mitZeit[i - 1], mitZeit[i]) });
  }
  if (schritte.length < 3) return 0;
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const ueblicheDauer = median(schritte.map((x) => x.dauer));
  const ueblichesTempo = median(schritte.map((x) => x.meter / x.dauer));
  return schritte
    .filter((x) => x.dauer > PAUSE_SCHRITT_FAKTOR * ueblicheDauer
      && x.meter / x.dauer < PAUSE_TEMPO_ANTEIL * ueblichesTempo)
    .reduce((summe, x) => summe + x.dauer, 0);
}

function eineGpxSpur(text, ganzeDatei) {
  const punkte = [...text.matchAll(/<(?:\w+:)?trkpt\b[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"([\s\S]*?)(?:<\/(?:\w+:)?trkpt>|\/>)/gi)]
    .map((t) => ({
      lat: Number(t[1]),
      lon: Number(t[2]),
      zeit: inhalt(t[3], 'time'),
      puls: zahl(inhalt(t[3], 'hr')),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (punkte.length < 2) return null;

  const gesaeubert = geglaettet(punkte);
  let meter = 0;
  for (let i = 1; i < gesaeubert.length; i += 1) {
    meter += abstand(gesaeubert[i - 1], gesaeubert[i]);
  }

  const zeiten = punkte.map((p) => p.zeit).filter(Boolean).map((z) => Date.parse(z))
    .filter(Number.isFinite);
  const gesamt = zeiten.length >= 2
    ? (Math.max(...zeiten) - Math.min(...zeiten)) / 1000 : 0;
  const pause = pausenSekunden(punkte);

  const pulse = punkte.map((p) => p.puls).filter(Boolean);

  return zusammenstellen({
    datum: punkte.find((p) => p.zeit)?.zeit,
    sekunden: gesamt - pause,
    pauseSekunden: pause,
    meter,
    hfSchnitt: pulse.length ? pulse.reduce((s, p) => s + p, 0) / pulse.length : null,
    // GPX kennt keine feste Sportart. Manche Schreiber setzen <type>.
    geraet: geraetAusArt(inhalt(text, 'type') || inhalt(text, 'name')
      || inhalt(ganzeDatei, 'type')),
    format: 'GPX',
  });
}

/* ------------------------------------------------------------ Gemeinsam */

/**
 * Der Kalendertag, an dem die Einheit begann – in **Ortszeit**.
 *
 * GPX und TCX schreiben ihre Zeitstempel fast immer in UTC (`…Z`). Hier stand
 * `slice(0, 10)`, und damit landete ein Lauf, der in Berlin um halb eins
 * beginnt, auf dem Vortag: gemessen jeder Start zwischen Mitternacht und ein
 * Uhr, im Sommer bis zwei Uhr. Der Fehler blieb nicht beim Datum – die
 * Doppelwarnung beim Übernehmen („Ist das dieselbe?") sucht am Tag der Datei
 * und fand die von Hand eingetragene Einheit nicht, die richtig auf dem
 * Folgetag stand. Dann zählt dieselbe Einheit zweimal in jeder
 * Belastungsrechnung (Falle 100, dieselbe Verwechslung wie bei `heute()`).
 *
 * Ein reines Datum ohne Uhrzeit bleibt, was es ist; ein Zeitstempel mit
 * Versatz (`+02:00`) ergab schon vorher den richtigen Tag, aber nur, weil die
 * Datei zufällig in Ortszeit schrieb.
 */
function starttag(zeitstempel) {
  const roh = String(zeitstempel || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(roh)) return roh;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(roh)) return null;
  const zeitpunkt = Date.parse(roh);
  return Number.isFinite(zeitpunkt) ? heute(new Date(zeitpunkt)) : null;
}

/**
 * Aus den Rohwerten eine Einheit machen – oder ehrlich nichts.
 *
 * Geprüft wird auf Plausibilität, nicht auf Vollständigkeit: Eine Datei ohne
 * Puls ist in Ordnung, eine mit 900 km Strecke nicht.
 */
function zusammenstellen({ datum, sekunden, meter, hfSchnitt, geraet, format, pauseSekunden = 0 }) {
  const minuten = Math.round((sekunden || 0) / 60);
  const gerundet = Math.round(meter || 0);
  if (minuten < 1 || minuten > 1440) return null;
  if (gerundet <= 0 || gerundet > 300000) return null;

  const tag = starttag(datum);
  if (!tag) return null;

  return {
    datum: tag,
    minuten,
    meter: gerundet,
    geraet: GERAETE[geraet] ? geraet : null,
    hfSchnitt: hfSchnitt ? Math.round(hfSchnitt) : null,
    format,
    pauseMinuten: Math.round(pauseSekunden / 60),
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

  let einheiten = [];
  if (/<TrainingCenterDatabase|<Activity\b/i.test(kopf)) einheiten = ausTcx(text);
  else if (/<gpx\b|<trkpt\b/i.test(kopf)) einheiten = ausGpx(text);
  else {
    throw new Error('Unbekanntes Format. Der Tracker liest GPX und TCX – '
      + 'die Formate, die Lauf-Apps und Uhren beim Export anbieten.');
  }

  if (!einheiten.length) {
    throw new Error('Die Datei enthält keine brauchbare Einheit: Datum, Dauer oder '
      + 'Strecke fehlen oder sind unplausibel.');
  }
  // Älteste zuerst – so wie man sie auch nachtragen würde.
  return einheiten.sort((a, b) => (a.datum < b.datum ? -1 : 1));
}
