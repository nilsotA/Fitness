// Zwei Karten auf demselben Bildschirm dürfen sich nicht widersprechen.
//
// Alle bisherigen Integrationstests halten *ein* Modul gegen den Plan. Die
// schwersten Funde entstanden aber im Zusammenspiel: Vorgabe gegen Vorschlag
// (Falle 23), Alltagsfaktor gegen RED-S-Marke (Falle 24). Dieser Test baut
// deshalb den kompletten Zustand, wie die Oberfläche ihn bekommt, und prüft
// ihn Tag für Tag gegen eine Liste von Widersprüchen.
//
// Wichtig ist die Abdeckung: Eine Regel, deren Auslösezustand nie eintritt,
// ist so wertlos wie der Melder aus Falle 18. Der letzte Test hier besteht
// deshalb darauf, dass die geprüften Zustände in den Durchläufen vorkommen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { zustand, uebungenPruefen } from '../kern/zustand.js';
import { wochenplan } from '../kern/plan.js';
import { RPE_ERWARTUNG } from '../kern/wissen.js';
import { createProfil } from '../kern/profil.js';

const START = new Date('2026-05-18');
const WOCHEN = 12;
const HART = new Set(['sprint', 'plyometrie', 'ausdauerIntervalle']);

/** Zwölf Wochen Plan als vollständiges Tagebuch – Einheiten, Checks, Essen. */
function tagebuch({ ausrichtung = 30, tage = 4, kalorienziel = 'halten', checkWert = null } = {}) {
  const profil = {
    name: 'Nils', geburtsjahr: 1996, geschlecht: 'm', groesseCm: 183, gewichtKg: 78.3,
    koerperfettProzent: 12, ausrichtung, trainingstageProWoche: tage, wiedereinstieg: false,
    alltagsaktivitaet: 'mittel', ausdauerGeraet: 'rad', koerpergewichtsfokus: true,
    gelenkschonend: true, kalorienziel, startdatum: START.toISOString().slice(0, 10),
  };
  const sessions = [];
  const checks = [];
  const essen = [];
  for (let w = 1; w <= WOCHEN; w += 1) {
    for (const tag of wochenplan(profil, w).tage) {
      const d = new Date(START);
      d.setDate(d.getDate() + (w - 1) * 7 + tag.tag);
      const datum = d.toISOString().slice(0, 10);
      for (const e of tag.einheiten) {
        sessions.push({
          id: `s${w}_${tag.tag}_${e.typ}`, datum, typ: e.typ, titel: e.titel,
          minuten: e.minuten, rpe: RPE_ERWARTUNG[e.typ] ?? 5,
          strecke: e.typ.startsWith('ausdauer') ? { meter: e.minuten * 470, geraet: 'rad' } : null,
        });
      }
      const v = checkWert ?? (3 + ((w + tag.tag) % 3));
      checks.push({
        datum, schlaf: v, muskelkater: v, stress: v, stimmung: v, energie: v,
        ruhepuls: 52 + ((w * 3 + tag.tag) % 5),
      });
      essen.push({
        id: `e${datum}`, datum, name: 'Tagesration', mengeG: 100,
        kcal: 3000, protein: 170, fett: 100, kohlenhydrate: 350,
      });
    }
  }
  return { profil, sessions, checks, essen, tests: [], gewicht: [], muscleup: { manuell: {} } };
}

/** Jeden Tag der zwölf Wochen als Zustand bauen. */
function alleTage(daten) {
  const raus = [];
  for (let t = 0; t < WOCHEN * 7; t += 1) {
    const d = new Date(START);
    d.setDate(d.getDate() + t);
    raus.push(zustand(daten, d.toISOString().slice(0, 10)));
  }
  return raus;
}

const LAEUFE = [
  ['Voreinstellung', {}],
  ['Sprintfokus, 3 Tage', { ausrichtung: 0, tage: 3 }],
  ['Ausdauerfokus, 6 Tage', { ausrichtung: 100, tage: 6 }],
  ['Im Defizit', { kalorienziel: 'abnehmen' }],
  ['Durchweg rote Checks', { checkWert: 2 }],
];

/** Die Widersprüche. Rückgabe: Text, wenn etwas nicht zusammenpasst. */
const REGELN = {
  'Bereitschaft rot, harte Einheit steht unverändert': (z) => {
    if (z.heute.bereitschaft?.ampel !== 'rot') return null;
    const harte = z.heute.einheiten.filter((e) => HART.has(e.typ) && !e.anpassung);
    return harte.length ? `„harte Einheit streichen", aber ${harte.map((e) => e.typ)} steht` : null;
  },

  'Entlastung fällig, Bereitschaft rät zum Durchziehen': (z) => (
    z.belastung.entlastung.faellig && z.heute.bereitschaft?.ampel === 'gruen'
      ? `${z.belastung.entlastung.gruende.length} Gründe gegen „Plan wie vorgesehen durchziehen"`
      : null),

  'Ernährung rechnet mit hartem Tag, der Plan hat keinen': (z) => {
    if (z.heute.tagestyp !== 'hart') return null;
    const hat = z.heute.einheiten.some((e) => HART.has(e.typ) || e.typ === 'kraft');
    return hat ? null : `Tagestyp hart, Plan zeigt ${z.heute.einheiten.map((e) => e.typ) || 'nichts'}`;
  },

  'In der Entlastungswoche wird zu einer Entlastungswoche geraten': (z) => (
    z.plan.entlastungswoche
      && /Eine Entlastungswoche jetzt kostet/.test(z.belastung.entlastung.text)
      ? `Woche ${z.woche} ist geplante Entlastung` : null),

  'Kalorienziel enthält Training, das gestrichen wurde': (z) => (
    z.heute.angepasst && z.heute.minuten === 0 && z.heute.bedarf?.training > 0
      ? `keine Einheit übrig, aber ${z.heute.bedarf.training} kcal Training im Bedarf` : null),
};

for (const [name, opt] of LAEUFE) {
  test(`Keine widersprüchlichen Karten – ${name}`, () => {
    const daten = tagebuch(opt);
    const funde = [];
    for (const z of alleTage(daten)) {
      for (const [regel, pruefen] of Object.entries(REGELN)) {
        const treffer = pruefen(z);
        if (treffer) funde.push(`${z.datum} · ${regel}: ${treffer}`);
      }
    }
    assert.deepEqual(funde, [], `${funde.length} Widersprüche:\n  ${funde.slice(0, 5).join('\n  ')}`);
  });
}

test('Die geprüften Zustände kommen in den Durchläufen wirklich vor', () => {
  // Ohne das wäre der Test oben ein Melder, der nie meldet: Sechs Regeln, die
  // sechsmal auf einen Zustand warten, den es nie gibt.
  const gesehen = {
    bereitschaftRot: 0, bereitschaftGruen: 0, entlastungFaellig: 0,
    angepasst: 0, harterTagestyp: 0, entlastungswoche: 0,
  };
  for (const [, opt] of LAEUFE) {
    for (const z of alleTage(tagebuch(opt))) {
      if (z.heute.bereitschaft?.ampel === 'rot') gesehen.bereitschaftRot += 1;
      if (z.heute.bereitschaft?.ampel === 'gruen') gesehen.bereitschaftGruen += 1;
      if (z.belastung.entlastung.faellig) gesehen.entlastungFaellig += 1;
      if (z.heute.angepasst) gesehen.angepasst += 1;
      if (z.heute.tagestyp === 'hart') gesehen.harterTagestyp += 1;
      if (z.plan.entlastungswoche) gesehen.entlastungswoche += 1;
    }
  }
  for (const [was, wieOft] of Object.entries(gesehen)) {
    assert.ok(wieOft > 0, `„${was}" kommt in keinem Durchlauf vor – die Regel dazu prüft nichts`);
  }
});

test('Unlesbare Gewichtspunkte kommen nicht in die Kurve', () => {
  // Eine Fassung vor Falle 14 schrieb bei Komma-Eingabe ein NaN in den
  // Verlauf; über JSON wird daraus beim Sichern ein `null`. Die Gewichtskarte
  // rechnet stumpf „letzter − erster" und schrieb daraus
  // „null kg → 78,3 kg · +78,3 kg". Wer das liest, hat 78 Kilo zugenommen.
  const daten = tagebuch();
  daten.gewicht = [
    { datum: '2026-06-01', kg: null },
    { datum: '2026-06-15', kg: 'ungültig' },
    { datum: '2026-07-01', kg: 79 },
    { datum: '2026-08-01', kg: 78.3 },
  ];
  const z = zustand(daten, '2026-08-01');

  assert.equal(z.gewichtsverlauf.length, 2, 'nur die brauchbaren Punkte');
  assert.equal(z.gewichtVerworfen, 2, 'und die Zahl der verworfenen steht daneben');
  for (const g of z.gewichtsverlauf) {
    assert.ok(Number.isFinite(g.kg), `${g.datum}: ${g.kg} ist keine Zahl`);
  }

  // Die Aussage, die die Karte daraus baut, muss stimmen.
  const erste = z.gewichtsverlauf[0];
  const letzte = z.gewichtsverlauf[z.gewichtsverlauf.length - 1];
  assert.ok(Math.abs((letzte.kg - erste.kg) - -0.7) < 0.01,
    `Differenz ${letzte.kg - erste.kg} statt -0,7 kg`);
});

test('Ein sauberer Gewichtsverlauf verliert nichts', () => {
  const daten = tagebuch();
  daten.gewicht = [{ datum: '2026-07-01', kg: 79 }, { datum: '2026-08-01', kg: 78.3 }];
  const z = zustand(daten, '2026-08-01');
  assert.equal(z.gewichtsverlauf.length, 2);
  assert.equal(z.gewichtVerworfen, 0);
});

test('Ein langer Verlauf gilt nicht als unlesbar', () => {
  // Der Test darüber prüfte mit vier Einträgen und ging deshalb an dem Fehler
  // vorbei, der in derselben Korrektur entstand: `gewichtVerworfen` wurde als
  // `alle.length - gezeichnet.length` gebildet und zählte damit auch die
  // Punkte mit, die bloß außerhalb der letzten 90 liegen.
  //
  // Bei 200 sauberen Wiegungen – nach einem Jahr regelmäßigen Wiegens der
  // Normalfall – stand in der Gewichtskarte „110 Einträge ohne lesbares
  // Gewicht … vermutlich aus einer älteren Sicherung". Kein einziger davon
  // war unlesbar. Wer eine Zahl prüft, muss sie über die Fenstergrenze hinaus
  // prüfen.
  const daten = tagebuch();
  daten.gewicht = Array.from({ length: 200 }, (_, i) => {
    const d = new Date('2026-08-01');
    d.setDate(d.getDate() - (200 - i));
    return { datum: d.toISOString().slice(0, 10), kg: 78 + (i % 3) * 0.1 };
  });
  const z = zustand(daten, '2026-08-01');

  assert.equal(z.gewichtsverlauf.length, 90, 'gezeichnet wird das Fenster');
  assert.equal(z.gewichtVerworfen, 0, 'aber verworfen wurde nichts');

  // Und mit einem echten Ausreißer dazwischen: genau einer.
  daten.gewicht[5].kg = null;
  assert.equal(zustand(daten, '2026-08-01').gewichtVerworfen, 1);
});

/*
 * Zwei Stellen, die `werkzeug/mutieren.mjs` in `zustand.js` überleben ließ.
 * Beide sind zeilengenau nachgemessen (Falle 64).
 */

test('Der Plan startet erst noch – aber nicht in Woche 1', () => {
  /*
   * `Boolean(profil.startdatum) && woche < 1`. Mit `<=` stünde in der ersten
   * echten Trainingswoche „Der Plan startet erst noch"; mit `||` stünde es
   * auch ohne Startdatum da. Beides ist eine Aussage an der Kopfzeile, die
   * jeder sieht.
   */
  const basis = {
    profil: { ...createProfil(), gewichtKg: 78.3, groesseCm: 181, geburtsjahr: 1995,
      startdatum: '2026-08-10' },
    sessions: [], essen: [], checks: [], tests: [], gewicht: [], muscleup: { manuell: {} },
  };

  // Der 10.08. ist der erste Tag von Woche 1.
  assert.equal(zustand(basis, '2026-08-10').startetErstNoch, false,
    'Am Starttag läuft der Plan');
  assert.equal(zustand(basis, '2026-08-14').startetErstNoch, false, 'Mitten in Woche 1 auch');
  assert.equal(zustand(basis, '2026-08-03').startetErstNoch, true,
    'Eine Woche davor steht er noch aus');

  // Ohne Startdatum gibt es nichts, worauf man wartet.
  const ohne = { ...basis, profil: { ...basis.profil, startdatum: null } };
  assert.equal(zustand(ohne, '2026-08-03').startetErstNoch, false,
    'Ohne Startdatum wartet niemand');
});

test('Beim Speichern überlebt kein Satz ohne Wiederholung', () => {
  /*
   * `Math.max(0, …)` und der Filter `wiederholungen > 0` in
   * `uebungenPruefen()` – die Stelle, an der die App ihre eigene Regel
   * durchsetzt. Sie ist der Grund, warum ein leerer Satz aus dem Dialog nie
   * im Tagebuch landet; `letzteLeistung()` verlässt sich darauf.
   */
  const sauber = uebungenPruefen([{
    schluessel: 'kniebeuge',
    saetze: [
      { gewicht: 105, wiederholungen: 5 },
      { gewicht: 105, wiederholungen: 0 },
      { gewicht: 105, wiederholungen: -3 },
      { gewicht: 105, wiederholungen: 4 },
    ],
  }]);

  assert.equal(sauber.length, 1);
  assert.deepEqual(sauber[0].saetze.map((s) => s.wiederholungen), [5, 4],
    'Null und negativ fallen heraus, der Rest bleibt');

  // Und eine Übung, von der nichts übrig bleibt, verschwindet ganz.
  assert.deepEqual(uebungenPruefen([{ schluessel: 'kniebeuge',
    saetze: [{ gewicht: 105, wiederholungen: 0 }] }]), []);
});
