// Einheiten aus GPX- und TCX-Dateien übernehmen.
//
// Die Dateien stammen von fremden Programmen – man kann sich auf nichts
// verlassen: fehlende Sportart, fehlender Puls, andere Namensräume,
// Selbstschluss-Tags. Deshalb hier bewusst schmutzige Beispiele.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../kern/aktivitaet.js';

const TCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
 <Activities><Activity Sport="Running">
  <Id>2026-08-05T17:23:45.000Z</Id>
  <Lap StartTime="2026-08-05T17:23:45.000Z">
   <TotalTimeSeconds>1800.0</TotalTimeSeconds>
   <DistanceMeters>5200.0</DistanceMeters>
   <AverageHeartRateBpm><Value>138</Value></AverageHeartRateBpm>
  </Lap>
  <Lap StartTime="2026-08-05T17:53:45.000Z">
   <TotalTimeSeconds>1800.0</TotalTimeSeconds>
   <DistanceMeters>4800.0</DistanceMeters>
   <AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm>
  </Lap>
 </Activity></Activities>
</TrainingCenterDatabase>`;

test('TCX liefert Datum, Dauer, Strecke und Puls', () => {
  const [e] = A.ausTcx(TCX);
  assert.equal(e.datum, '2026-08-05');
  assert.equal(e.minuten, 60, 'beide Runden zusammen');
  assert.equal(e.meter, 10000);
  assert.equal(e.geraet, 'laufen');
  assert.equal(e.hfSchnitt, 144, '(138 + 150) / 2 bei gleich langen Runden');
});

test('Der Pulsschnitt wird nach Rundendauer gewichtet', () => {
  // Ungewichtet käme 160 heraus – eine Minute hart würde eine Stunde locker
  // überstimmen.
  const text = TCX
    .replace('<TotalTimeSeconds>1800.0</TotalTimeSeconds>\n   <DistanceMeters>4800.0',
      '<TotalTimeSeconds>60.0</TotalTimeSeconds>\n   <DistanceMeters>300.0')
    .replace('<Value>150</Value>', '<Value>182</Value>');
  const [e] = A.ausTcx(text);
  assert.ok(e.hfSchnitt >= 138 && e.hfSchnitt <= 142, `Schnitt ${e.hfSchnitt}`);
});

test('Ohne Rundenschnitt zählen die einzelnen Messpunkte', () => {
  const text = `<Activity Sport="Biking"><Id>2026-08-05T09:00:00Z</Id><Lap>
    <TotalTimeSeconds>3600</TotalTimeSeconds><DistanceMeters>30000</DistanceMeters>
    <Track>
      <Trackpoint><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
    </Track></Lap></Activity>`;
  const [e] = A.ausTcx(text);
  assert.equal(e.hfSchnitt, 130);
  assert.equal(e.geraet, 'rad');
});

/* ---------------------------------------------------------------- GPX */

/** Punkte entlang eines Breitengrads – dort ist ein Grad Länge gut bekannt. */
function gpxStrecke(anzahl, schrittGrad, startZeit, puls) {
  const punkte = Array.from({ length: anzahl }, (_, i) => {
    const zeit = new Date(Date.parse(startZeit) + i * 60000).toISOString();
    const hr = puls ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${puls[i] ?? puls[0]}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : '';
    return `<trkpt lat="52.0" lon="${(13 + i * schrittGrad).toFixed(6)}"><ele>34</ele><time>${zeit}</time>${hr}</trkpt>`;
  }).join('\n');
  return `<?xml version="1.0"?><gpx version="1.1" creator="adidas Running">
   <trk><name>Laufen am Morgen</name><trkseg>${punkte}</trkseg></trk></gpx>`;
}

test('GPX rechnet Strecke aus den Wegpunkten', () => {
  // Auf 52° Nord ist ein Längengrad rund 68,7 km breit. 0,01° ≈ 687 m.
  const [e] = A.ausGpx(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z'));
  assert.equal(e.datum, '2026-08-06');
  assert.equal(e.minuten, 10, 'zehn Minuten zwischen erstem und letztem Punkt');
  assert.ok(e.meter > 6300 && e.meter < 7300, `Strecke ${e.meter} m`);
  assert.equal(e.geraet, 'laufen', 'aus dem Namen der Strecke erkannt');
});

test('GPX nimmt den Puls aus den Erweiterungen mit', () => {
  const [e] = A.ausGpx(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z',
    [130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150]));
  assert.equal(e.hfSchnitt, 140);
});

test('GPX ohne Puls ist trotzdem brauchbar', () => {
  const [e] = A.ausGpx(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z'));
  assert.equal(e.hfSchnitt, null);
  assert.ok(e.meter > 0);
});

test('Eine unklare Sportart wird nicht geraten', () => {
  // Lieber nachfragen: Ein als Laufen einsortiertes Radtempo verdirbt die
  // Tempokurve, und zwar unbemerkt.
  const ohneName = gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z')
    .replace('<name>Laufen am Morgen</name>', '');
  assert.equal(A.ausGpx(ohneName)[0].geraet, null);
  assert.equal(A.geraetAusArt('Fitnessstudio'), null);
  assert.equal(A.geraetAusArt(''), null);
});

test('Sportarten werden über Sprachen hinweg erkannt', () => {
  assert.equal(A.geraetAusArt('Running'), 'laufen');
  assert.equal(A.geraetAusArt('Radfahren'), 'rad');
  assert.equal(A.geraetAusArt('Cycling'), 'rad');
  assert.equal(A.geraetAusArt('Indoor Rowing'), 'rudern');
  assert.equal(A.geraetAusArt('Swimming'), 'schwimmen');
});

/* ------------------------------------------------------------ Erkennung */

test('Das Format wird am Inhalt erkannt, nicht an der Endung', () => {
  // Exportierte Dateien heißen alles Mögliche.
  assert.equal(A.ausDatei(TCX)[0].format, 'TCX');
  assert.equal(A.ausDatei(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z'))[0].format, 'GPX');
});

test('Fremde Dateien werden mit einem brauchbaren Hinweis abgelehnt', () => {
  assert.throws(() => A.ausDatei('{"kein":"xml"}'), /GPX und TCX/);
  assert.throws(() => A.ausDatei(''), /leer/);
  assert.throws(() => A.ausDatei(null), /leer/);
});

test('Unplausible Werte werden verworfen statt eingetragen', () => {
  // Eine Zahl im Tagebuch sieht später wie eine Messung aus.
  const ohneStrecke = TCX.replace(/<DistanceMeters>[^<]*<\/DistanceMeters>/g,
    '<DistanceMeters>0</DistanceMeters>');
  assert.throws(() => A.ausDatei(ohneStrecke), /unplausibel|fehlen/);

  const zuLang = TCX.replace(/<TotalTimeSeconds>[^<]*<\/TotalTimeSeconds>/g,
    '<TotalTimeSeconds>200000</TotalTimeSeconds>');
  assert.throws(() => A.ausDatei(zuLang), /unplausibel|fehlen/);

  const ohneDatum = TCX.replace(/<Id>[^<]*<\/Id>/, '<Id></Id>');
  assert.throws(() => A.ausDatei(ohneDatum), /unplausibel|fehlen/);
});

test('Ein einzelner Wegpunkt ergibt keine Einheit', () => {
  assert.deepEqual(A.ausGpx(gpxStrecke(1, 0.01, '2026-08-06T06:00:00Z')), []);
});

/* -------------------------------------------------- Mehrere Aktivitäten */

test('Eine Datei mit mehreren Aktivitäten verliert keine davon', () => {
  // Nur die erste zu nehmen hieße, den Rest stillschweigend wegzuwerfen –
  // und stillschweigend ist hier das Problem: Man merkt es erst Wochen später
  // an einer Lücke im Verlauf.
  const zwei = `<TrainingCenterDatabase><Activities>
    <Activity Sport="Running"><Id>2026-08-05T17:00:00Z</Id><Lap>
      <TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters></Lap></Activity>
    <Activity Sport="Biking"><Id>2026-08-06T09:00:00Z</Id><Lap>
      <TotalTimeSeconds>3600</TotalTimeSeconds><DistanceMeters>30000</DistanceMeters></Lap></Activity>
  </Activities></TrainingCenterDatabase>`;
  const liste = A.ausDatei(zwei);
  assert.equal(liste.length, 2);
  assert.deepEqual(liste.map((e) => e.datum), ['2026-08-05', '2026-08-06']);
  // Und jede behält ihre eigene Sportart, nicht die der ersten.
  assert.deepEqual(liste.map((e) => e.geraet), ['laufen', 'rad']);
  assert.deepEqual(liste.map((e) => e.meter), [5000, 30000]);
});

test('Mehrere Spuren in einer GPX-Datei zählen einzeln', () => {
  const eine = (tag, name) => `<trk><name>${name}</name><trkseg>`
    + Array.from({ length: 11 }, (_, i) => {
      const t = new Date(Date.parse(`2026-08-${tag}T06:00:00Z`) + i * 60000).toISOString();
      return `<trkpt lat="52.0" lon="${(13 + i * 0.01).toFixed(6)}"><time>${t}</time></trkpt>`;
    }).join('') + '</trkseg></trk>';
  const liste = A.ausDatei(`<gpx>${eine('04', 'Radfahren')}${eine('05', 'Laufen')}</gpx>`);
  assert.equal(liste.length, 2);
  assert.deepEqual(liste.map((e) => e.geraet), ['rad', 'laufen']);
});

test('Unbrauchbare Aktivitäten fallen raus, brauchbare bleiben', () => {
  // Eine kaputte Aktivität darf nicht die ganze Datei unlesbar machen.
  const gemischt = `<TrainingCenterDatabase><Activities>
    <Activity Sport="Running"><Id></Id><Lap>
      <TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters></Lap></Activity>
    <Activity Sport="Running"><Id>2026-08-06T09:00:00Z</Id><Lap>
      <TotalTimeSeconds>2400</TotalTimeSeconds><DistanceMeters>8000</DistanceMeters></Lap></Activity>
  </Activities></TrainingCenterDatabase>`;
  const liste = A.ausDatei(gemischt);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].datum, '2026-08-06');
});

test('Die Liste kommt nach Datum sortiert – so trägt man auch nach', () => {
  const zwei = `<TrainingCenterDatabase><Activities>
    <Activity Sport="Running"><Id>2026-08-09T17:00:00Z</Id><Lap>
      <TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters></Lap></Activity>
    <Activity Sport="Running"><Id>2026-08-02T09:00:00Z</Id><Lap>
      <TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters></Lap></Activity>
  </Activities></TrainingCenterDatabase>`;
  assert.deepEqual(A.ausDatei(zwei).map((e) => e.datum), ['2026-08-02', '2026-08-09']);
});

/* ------------------------------------------------------- GPS-Rauschen */

// Eine Spur mit **bekannter** Länge, dazu Rauschen wie ein echtes GPS.
// Anders lässt sich nicht prüfen, ob die gerechnete Strecke stimmt: Bei einer
// echten Datei kennt niemand die Wahrheit.
function verrauschteSpur({ meter = 10000, sekunden = 3000, rauschen = 3, kreisR = 0 } = {}) {
  let z = 1;
  const normal = () => {
    z = (z * 1103515245 + 12345) % 2147483648;
    const u = z / 2147483648;
    z = (z * 1103515245 + 12345) % 2147483648;
    const v = z / 2147483648;
    return Math.sqrt(-2 * Math.log(u || 1e-9)) * Math.cos(2 * Math.PI * v);
  };
  const g = 1 / 111320;
  const breite = Math.cos((52 * Math.PI) / 180);
  let punkte = '';
  for (let i = 0; i <= sekunden; i += 1) {
    const weg = (meter * i) / sekunden;
    let lat; let lon;
    if (kreisR) {
      const w = weg / kreisR;
      lat = 52 + Math.sin(w) * kreisR * g;
      lon = 13 + (Math.cos(w) - 1) * kreisR * g / breite;
    } else {
      lat = 52 + weg * g;
      lon = 13;
    }
    lat += normal() * rauschen * g;
    lon += (normal() * rauschen * g) / breite;
    const t = new Date(Date.parse('2026-08-06T06:00:00Z') + i * 1000).toISOString();
    punkte += `<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><time>${t}</time></trkpt>`;
  }
  return `<gpx><trk><name>Laufen</name><trkseg>${punkte}</trkseg></trk></gpx>`;
}

test('GPS-Rauschen bläht die Strecke nicht mehr auf', () => {
  // Ohne Glättung ergab dieselbe Spur 18 432 m statt 10 000 – Rauschen macht
  // eine Strecke immer länger, nie kürzer, und jeder Zickzack zählt voll mit.
  const [e] = A.ausGpx(verrauschteSpur({ rauschen: 3 }));
  const abweichung = Math.abs(e.meter - 10000) / 10000;
  assert.ok(abweichung < 0.03, `${e.meter} m statt 10 000 (${(abweichung * 100).toFixed(1)} %)`);
});

test('Auch bei schlechtem Empfang bleibt die Strecke brauchbar', () => {
  const [e] = A.ausGpx(verrauschteSpur({ rauschen: 5 }));
  assert.ok(Math.abs(e.meter - 10000) / 10000 < 0.04, `${e.meter} m statt 10 000`);
});

test('Kurven werden nicht abgeschnitten', () => {
  // Die Gegenprobe zum Glätten: Zu stark geglättet wird aus einer 400-m-Bahn
  // eine kürzere Strecke, weil die Kurven zu Sehnen werden.
  for (const rauschen of [0, 3, 5]) {
    const [e] = A.ausGpx(verrauschteSpur({ rauschen, kreisR: 64 }));
    assert.ok(Math.abs(e.meter - 10000) / 10000 < 0.03,
      `Bahn mit ±${rauschen} m: ${e.meter} m statt 10 000`);
  }
});

test('Eine grob abgetastete Spur wird nicht kaputtgeglättet', () => {
  // Ein Punkt alle 100 m: Da gibt es kein Rauschen herauszumitteln, wohl aber
  // Kurven zu zerstören. Deshalb bleibt die Spur unangetastet.
  const [e] = A.ausGpx(verrauschteSpur({ sekunden: 100, rauschen: 0 }));
  assert.ok(Math.abs(e.meter - 10000) / 10000 < 0.01, `${e.meter} m statt 10 000`);
});

test('Spuren mit sehr wenigen Punkten überstehen die Glättung', () => {
  // Vier Punkte über 6 Minuten – da gibt es nichts zu mitteln, aber die
  // Glättung darf auch nichts kaputt machen.
  const g = 1 / 111320;
  let punkte = '';
  for (let i = 0; i <= 3; i += 1) {
    const lat = 52 + i * 400 * g;
    const t = new Date(Date.parse('2026-08-06T06:00:00Z') + i * 120000).toISOString();
    punkte += `<trkpt lat="${lat.toFixed(7)}" lon="13.0000000"><time>${t}</time></trkpt>`;
  }
  const [e] = A.ausGpx(`<gpx><trk><trkseg>${punkte}</trkseg></trk></gpx>`);
  assert.ok(e, 'die Einheit darf nicht verlorengehen');
  assert.ok(Math.abs(e.meter - 1200) < 30, `${e.meter} m statt rund 1200`);
  assert.equal(e.minuten, 6);
});
