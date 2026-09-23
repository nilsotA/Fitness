// Der Tracker läuft in Berlin, die Testsuite in UTC.
//
// Alles, was nur in einer anderen Zeitzone falsch ist, sah deshalb kein
// einziger Test. Genau so lag Falle 100 ein Jahr lang da: Die Fenster des
// Kerns bauten ihre Grenze aus `new Date(iso)` (UTC-Mitternacht) und
// `setDate()` (Ortszeit). In der Woche nach der Umstellung auf Winterzeit
// rutschte die Grenze in Berlin eine Stunde in den Vortag – 28 von 84 Tagen
// zeigten andere Werte als in UTC, vier Wochen lang ACWR-Stufe,
// Energieverfügbarkeit und Ruhepuls.
//
// Node stellt die Zeitzone um, sobald `process.env.TZ` gesetzt wird, und jede
// Testdatei läuft in einem eigenen Prozess. Die Zonen hier sind so gewählt,
// dass sie verschiedene Fälle abdecken: Berlin ist Nils' Zone, New York liegt
// westlich von Greenwich (dort ist UTC-Mitternacht noch der Vortag),
// Lord Howe stellt nur um eine halbe Stunde um, Chatham liegt bei +12:45, und
// Kiritimati und Pago Pago sind die beiden äußersten Zonen überhaupt.

import test from 'node:test';
import assert from 'node:assert/strict';
import { zustand } from '../kern/zustand.js';
import { wochenplan } from '../kern/plan.js';
import { RPE_ERWARTUNG } from '../kern/wissen.js';
import {
  datumPlus, kalendertag, fenster, tageZwischen, heute,
} from '../kern/regeln.js';
import { ausDatei } from '../kern/aktivitaet.js';

const ZONEN = [
  'Europe/Berlin', 'America/New_York', 'Australia/Lord_Howe',
  'Pacific/Chatham', 'Pacific/Kiritimati', 'Pacific/Pago_Pago',
];

function inZone(zone, rechnen) {
  process.env.TZ = zone;
  try {
    return rechnen();
  } finally {
    process.env.TZ = 'UTC';
  }
}

/** Alle Tage von `von` bis `bis`, rein kalendarisch. */
function tage(von, bis) {
  const raus = [];
  for (let d = von; d <= bis; d = datumPlus(d, 1)) raus.push(d);
  return raus;
}

test('Die Uhr im Test lässt sich wirklich umstellen', () => {
  // Ohne diese Gegenprobe prüfte der ganze Rest dieser Datei sechsmal UTC
  // und meldete brav Übereinstimmung (Falle 18).
  const stunden = ZONEN.map((z) => inZone(z, () => new Date('2026-10-25T12:00:00Z').getHours()));
  assert.deepEqual(stunden, [13, 8, 23, 1, 2, 1]);
});

test('Ein Fenster umfasst in jeder Zone dieselben Kalendertage – auch über die Zeitumstellung', () => {
  const stichtage = tage('2026-01-01', '2027-12-31');
  const falsch = [];
  for (const zone of ['UTC', ...ZONEN]) {
    inZone(zone, () => {
      for (const tag of stichtage) {
        // Beide Formen, in denen der Kern einen Stichtag bekommt.
        for (const bis of [tag, new Date(tag)]) {
          for (const n of [7, 14, 28]) {
            const drin = fenster(bis, n);
            for (let k = -1; k <= n + 1; k += 1) {
              const datum = datumPlus(tag, -k);
              const soll = k >= 0 && k < n;
              if (drin(datum) !== soll) falsch.push(`${zone} ${tag} (${typeof bis}) ${n} Tage, Tag −${k}`);
            }
          }
        }
      }
    });
  }
  assert.deepEqual(falsch.slice(0, 10), []);
});

test('Ein Stichtag meint in jeder Zone denselben Kalendertag', () => {
  for (const zone of ['UTC', ...ZONEN]) {
    inZone(zone, () => {
      assert.equal(kalendertag('2026-10-25'), '2026-10-25', zone);
      assert.equal(kalendertag(new Date('2026-10-25')), '2026-10-25', `${zone}: geparstes Datum`);
      assert.equal(kalendertag(new Date(2026, 9, 25)), '2026-10-25', `${zone}: in Ortszeit gebaut`);
      assert.equal(kalendertag(new Date(2026, 9, 25, 0, 30)), '2026-10-25', `${zone}: halb eins`);
      assert.equal(kalendertag(new Date(2026, 9, 25, 23, 30)), '2026-10-25', `${zone}: halb zwölf`);
      assert.equal(tageZwischen('2026-10-19', '2026-10-26'), 7, `${zone}: eine Woche über die Umstellung`);
      assert.equal(tageZwischen('2026-03-23', '2026-03-30'), 7, `${zone}: eine Woche über die Umstellung`);
    });
  }
});

/** Acht Wochen Tagebuch, jeder Tag mit einem anderen Wert. */
function tagebuch(start) {
  const profil = {
    name: 'Nils', geburtsjahr: 1996, geschlecht: 'm', groesseCm: 183, gewichtKg: 78.3,
    koerperfettProzent: 12, ausrichtung: 30, trainingstageProWoche: 4, wiedereinstieg: false,
    alltagsaktivitaet: 'mittel', ausdauerGeraet: 'rad', koerpergewichtsfokus: true,
    gelenkschonend: true, kalorienziel: 'halten', startdatum: start,
  };
  const sessions = [];
  const checks = [];
  const essen = [];
  const gewicht = [];
  for (let w = 1; w <= 8; w += 1) {
    for (const tag of wochenplan(profil, w).tage) {
      const datum = datumPlus(start, (w - 1) * 7 + tag.tag);
      for (const e of tag.einheiten) {
        /*
         * Jeder Tag bekommt eine andere Dauer. Mit gleichen Werten je Tag
         * bleibt eine Fenstersumme gleich, auch wenn das Fenster um einen Tag
         * verrutscht – der erste Anlauf dieser Messung sah deshalb nichts.
         */
        sessions.push({
          id: `s${w}_${tag.tag}_${e.typ}`, datum, typ: e.typ, titel: e.titel,
          minuten: e.minuten + ((w * 7 + tag.tag) % 11), rpe: RPE_ERWARTUNG[e.typ] ?? 5,
          strecke: e.typ.startsWith('ausdauer') ? { meter: e.minuten * 470 + w * 13, geraet: 'rad' } : null,
          uebungen: (e.uebungen || []).map((u) => ({
            schluessel: u.schluessel,
            name: u.name,
            saetze: [{ gewicht: 60 + w, wiederholungen: 5 }, { gewicht: 60 + w, wiederholungen: 5 }],
          })),
        });
      }
    }
  }
  for (let t = 0; t < 56; t += 1) {
    const datum = datumPlus(start, t);
    const v = 2 + (t % 4);
    checks.push({
      datum, schlaf: v, muskelkater: 3, stress: v, stimmung: 3, energie: v, ruhepuls: 50 + ((t * 7) % 9),
    });
    essen.push({
      id: `e${t}`, datum, name: 'Tagesration', mengeG: 100, mahlzeit: 'mittag',
      kcal: 2600 + ((t * 37) % 700), protein: 160, fett: 90, kohlenhydrate: 330,
    });
    if (t % 3 === 0) gewicht.push({ datum, kg: 78 + ((t * 13) % 7) / 10 });
  }
  return { profil, sessions, checks, essen, tests: [], gewicht, muscleup: { manuell: {} } };
}

test('Der ganze Zustand hängt nicht an der Zeitzone', () => {
  /*
   * Zwei Zeiträume: die Umstellung auf Sommerzeit (29.03.) und die auf
   * Winterzeit (25.10.), jeweils mit vier Wochen davor und danach – das
   * längste Fenster des Kerns, das bei jedem Stichtag gebraucht wird, ist
   * das ACWR mit 28 Tagen. Dazu der Jahreswechsel, an dem das Alter und damit
   * der Grundumsatz springt.
   */
  const unterschiede = [];
  for (const start of ['2026-03-02', '2026-09-28', '2026-12-07']) {
    const daten = tagebuch(start);
    const stichtage = tage(start, datumPlus(start, 55));
    const bezug = inZone('UTC', () => stichtage.map((d) => JSON.stringify(zustand(daten, d))));
    // Vier der sechs Zonen – genau die, in denen die alte Fassung scheiterte:
    // Berlin und New York im Herbst, Lord Howe im April (Südhalbkugel, halbe
    // Stunde), Pago Pago am Jahreswechsel. Die übrigen deckt der Fenstertest.
    for (const zone of ['Europe/Berlin', 'America/New_York', 'Australia/Lord_Howe', 'Pacific/Pago_Pago']) {
      inZone(zone, () => {
        stichtage.forEach((d, i) => {
          if (JSON.stringify(zustand(daten, d)) !== bezug[i]) unterschiede.push(`${zone} ${d}`);
        });
      });
    }
  }
  assert.deepEqual(unterschiede.slice(0, 12), [],
    `${unterschiede.length} Stichtage zeigen in einer anderen Zone einen anderen Zustand`);
});

test('Eine eingelesene Einheit gehört zu dem Tag, an dem sie in Ortszeit begann', () => {
  /*
   * GPX und TCX schreiben ihre Zeitstempel in UTC. Abgeschnitten landete ein
   * Lauf, der in Berlin um halb eins beginnt, auf dem Vortag – und die
   * Doppelwarnung beim Übernehmen suchte dort nach der von Hand
   * eingetragenen Einheit, die richtig auf dem Folgetag stand. Geprüft wird
   * jede volle Stunde eines Jahres, beide Formate, UTC und mit Versatz.
   */
  const tcx = (zeit) => '<?xml version="1.0"?><TrainingCenterDatabase><Activities>'
    + `<Activity Sport="Running"><Id>${zeit}</Id><Lap StartTime="${zeit}">`
    + '<TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters>'
    + '</Lap></Activity></Activities></TrainingCenterDatabase>';
  const gpx = (zeiten) => '<?xml version="1.0"?><gpx><trk><type>running</type><trkseg>'
    + zeiten.map((z, i) => `<trkpt lat="${52.5 + i * 0.01}" lon="13.4"><time>${z}</time></trkpt>`).join('')
    + '</trkseg></trk></gpx>';
  const mitVersatz = (ms) => {
    const minuten = -new Date(ms).getTimezoneOffset();
    const ort = new Date(ms + minuten * 60000).toISOString().slice(0, 19);
    const b = Math.abs(minuten);
    return `${ort}${minuten >= 0 ? '+' : '-'}${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`;
  };

  const falsch = [];
  for (const zone of ['Europe/Berlin', 'America/New_York']) {
    inZone(zone, () => {
      for (let ms = Date.parse('2026-01-01T00:00:00Z'); ms < Date.parse('2027-01-01T00:00:00Z'); ms += 3600000) {
        const soll = heute(new Date(ms));
        const z = new Date(ms).toISOString();
        const spaeter = new Date(ms + 1800000).toISOString();
        const varianten = [
          ['TCX', ausDatei(tcx(z))[0]?.datum],
          ['GPX', ausDatei(gpx([z, spaeter]))[0]?.datum],
          ['GPX mit Versatz', ausDatei(gpx([mitVersatz(ms), mitVersatz(ms + 1800000)]))[0]?.datum],
        ];
        for (const [art, ist] of varianten) {
          if (ist !== soll) falsch.push(`${zone} ${art} ${z}: ${ist} statt ${soll}`);
        }
      }
    });
  }
  assert.deepEqual(falsch.slice(0, 8), [], `${falsch.length} Einheiten auf dem falschen Tag`);

  // Ein reines Datum ohne Uhrzeit bleibt, was es ist – in jeder Zone.
  for (const zone of ZONEN) {
    inZone(zone, () => assert.equal(ausDatei(tcx('2026-10-25'))[0]?.datum, '2026-10-25', zone));
  }
});
