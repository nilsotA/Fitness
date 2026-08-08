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
  const e = A.ausTcx(TCX);
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
  const e = A.ausTcx(text);
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
  const e = A.ausTcx(text);
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
  const e = A.ausGpx(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z'));
  assert.equal(e.datum, '2026-08-06');
  assert.equal(e.minuten, 10, 'zehn Minuten zwischen erstem und letztem Punkt');
  assert.ok(e.meter > 6300 && e.meter < 7300, `Strecke ${e.meter} m`);
  assert.equal(e.geraet, 'laufen', 'aus dem Namen der Strecke erkannt');
});

test('GPX nimmt den Puls aus den Erweiterungen mit', () => {
  const e = A.ausGpx(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z',
    [130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150]));
  assert.equal(e.hfSchnitt, 140);
});

test('GPX ohne Puls ist trotzdem brauchbar', () => {
  const e = A.ausGpx(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z'));
  assert.equal(e.hfSchnitt, null);
  assert.ok(e.meter > 0);
});

test('Eine unklare Sportart wird nicht geraten', () => {
  // Lieber nachfragen: Ein als Laufen einsortiertes Radtempo verdirbt die
  // Tempokurve, und zwar unbemerkt.
  const ohneName = gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z')
    .replace('<name>Laufen am Morgen</name>', '');
  assert.equal(A.ausGpx(ohneName).geraet, null);
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
  assert.equal(A.ausDatei(TCX).format, 'TCX');
  assert.equal(A.ausDatei(gpxStrecke(11, 0.01, '2026-08-06T06:00:00Z')).format, 'GPX');
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
  assert.equal(A.ausGpx(gpxStrecke(1, 0.01, '2026-08-06T06:00:00Z')), null);
});
