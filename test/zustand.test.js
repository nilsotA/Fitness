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
import { readFileSync } from 'node:fs';
import { zustand, uebungenPruefen, wochenplanAm } from '../kern/zustand.js';
import { wochenplan } from '../kern/plan.js';
import { RPE_ERWARTUNG } from '../kern/wissen.js';
import { createProfil } from '../kern/profil.js';
import { tagestypName } from '../app/common.js';

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

test('Ein gekürzter Trainingstag heißt nicht „Ruhetag"', () => {
  /*
   * Der Tagestyp ist die Stufe des Kohlenhydratkorridors und folgt der
   * **gekürzten** Einheit – das ist richtig: Zwanzig Minuten locker brauchen
   * nicht die Kohlenhydrate von fünfzig.
   *
   * „Ruhetag" ist aber keine Dosisangabe, sondern eine Aussage über den Tag.
   * Gemessen stand sie über **546 von 3.935** Tagen mit geplanter Einheit:
   * oben die Trainingskarte, darunter „Ruhetag" – zwei Karten auf demselben
   * Bildschirm, die sich widersprechen. Genau wofür es diese Datei gibt.
   *
   * Geprüft wird beides: dass der Fall überhaupt vorkommt (sonst wäre die
   * Regel wertlos, Falle 18) und dass der Zustand ihn erkennbar macht.
   */
  const daten = {
    profil: {
      ...createProfil(), ausrichtung: 0, trainingstageProWoche: 3,
      gewichtKg: 78.3, groesseCm: 181, geburtsjahr: 1995, koerperfettProzent: 12,
      startdatum: '2026-06-01',
    },
    sessions: [], essen: [], tests: [], gewicht: [], muscleup: { manuell: {} },
    checks: [{
      datum: '2026-08-14', schlaf: 1, muskelkater: 1, stress: 2,
      stimmung: 2, energie: 2, motivation: 2,
    }],
  };
  const z = zustand(daten, '2026-08-14');

  assert.equal(z.heute.bereitschaft.ampel, 'rot', 'Der Fall setzt eine rote Ampel voraus');
  assert.ok(z.heute.einheiten.length > 0, 'und eine geplante Einheit');
  assert.equal(z.heute.tagestyp, 'ruhetag',
    'Die gekürzte Einheit fällt unter die Schwelle für einen leichten Tag');

  // Der Zustand trägt beides – die Oberfläche kann daraus „Wie ein Ruhetag"
  // machen, statt einen Ruhetag zu behaupten.
  assert.ok(z.heute.einheiten.some((e) => e.anpassung),
    'Die Einheit ist als angepasst gekennzeichnet');

  // Und genau das macht die Aufschrift daraus. `tagestypName()` ist eine
  // reine Funktion und braucht kein DOM – sie lässt sich hier mitprüfen,
  // statt die Regel ein zweites Mal zu beschreiben.
  assert.equal(tagestypName(z.heute.tagestyp, z.heute.einheiten.length > 0), 'Wie ein Ruhetag');
  assert.equal(tagestypName('ruhetag', false), 'Ruhetag', 'Ein echter Ruhetag heißt so');
  assert.equal(tagestypName('hart', true), 'Harter Tag', 'Alle anderen Stufen unverändert');
});

test('Doppelte Wiegungen sind nicht dasselbe wie unlesbare', () => {
  /*
   * Falle 80 hat `gewichtsverlauf()` auf `eineWiegungProTag()` umgestellt –
   * seither entdoppelt dieselbe Funktion, die vorher nur aussortiert hat.
   * Der Zähler daneben hieß weiter `unlesbar` und zählte beides zusammen:
   * Drei tadellose Wiegungen, die sich einen Tag mit einer anderen teilen,
   * standen am Gerät als „3 Einträge ohne lesbares Gewicht … vermutlich aus
   * einer älteren Sicherung".
   *
   * Das ist wörtlich Falle 31 – ein Zähler, der etwas anderes zählt als sein
   * Name sagt, entstanden in der Korrektur zu einer Falle. Nur eben eine
   * Falle weiter, und deshalb prüft dieser Test die beiden Ursachen getrennt.
   */
  const daten = tagebuch();
  daten.gewicht = [
    { datum: '2026-07-01', kg: 79 },
    { datum: '2026-07-02', kg: 78.8 },
    { datum: '2026-07-02', kg: 78.9 },   // derselbe Tag, tadellos lesbar
    { datum: '2026-07-03', kg: 78.6 },
    { datum: '2026-07-03', kg: 78.5 },   // ebenso
    { datum: '2026-07-04', kg: null },   // das ist unlesbar
  ];
  const z = zustand(daten, '2026-08-01');

  // Drei Tage bleiben: der 4. Juli fällt als unlesbar ganz heraus.
  assert.equal(z.gewichtsverlauf.length, 3, 'ein Punkt je Tag');
  assert.equal(z.gewichtVerworfen, 1, 'unlesbar ist nur der null-Eintrag');
  assert.equal(z.gewichtDoppelt, 2, 'zwei Tage trugen eine zweite Wiegung');

  // Gezeichnet wird die letzte des Tages – nicht die erste, nicht der Mittelwert.
  const zweiter = z.gewichtsverlauf.find((g) => g.datum === '2026-07-02');
  assert.equal(zweiter.kg, 78.9);

  // Und die Gegenprobe: ohne Doppelungen bleibt der Zähler bei null, sonst
  // hinge der neue Satz dauerhaft unter der Karte (Falle 24).
  const sauber = tagebuch();
  sauber.gewicht = [{ datum: '2026-07-01', kg: 79 }, { datum: '2026-07-02', kg: 78.8 }];
  const s = zustand(sauber, '2026-08-01');
  assert.equal(s.gewichtDoppelt, 0);
  assert.equal(s.gewichtVerworfen, 0);
});

test('Der Zustand schickt nichts an die Oberfläche, das niemand liest', () => {
  /*
   * `saetzeDieseWoche` wurde je Übung gerechnet und mitgeschickt – gelesen hat
   * es niemand, und der Kommentar darüber sagte sogar, warum man es nicht
   * zeigen soll („pro Übung zu zählen führt in die Irre"). Ein Feld, das nur
   * existiert, um übersehen zu werden, ist der stille Vorbote einer zweiten,
   * abweichenden Rechnung (Falle 51).
   *
   * Der Test hängt an der Eigenschaft, nicht am Namen: Er verlangt, dass jedes
   * Feld unter `leistung` irgendwo in `app/` vorkommt.
   */
  const z = zustand(tagebuch(), '2026-08-01');
  const quelle = ['essen.js', 'fortschritt.js', 'heute.js', 'planAnsicht.js',
    'profilAnsicht.js', 'wissenAnsicht.js', 'protokoll.js', 'common.js', 'daten.js']
    .map((d) => readFileSync(new URL(`../app/${d}`, import.meta.url), 'utf8')).join('\n');

  for (const feld of Object.keys(z.leistung)) {
    assert.ok(quelle.includes(feld),
      `leistung.${feld} wird berechnet und in app/ nirgends gelesen – tot, oder die `
      + 'Aufgabe wird woanders ein zweites Mal erledigt');
  }
});

test('Der Sprintzusatz im Volumen zählt protokollierte Tage, nicht geplante', () => {
  /*
   * „Dazu kommt der Sprint an N Tagen, der hier nicht mitgezählt wird – die
   * Ermüdung landet aber in derselben Muskulatur." Das ist eine Aussage über
   * tatsächliches Training und die einzige Begründung dafür, dass 20+ Sätze
   * auf einer sprintbelasteten Muskelgruppe zu viel sein könnten.
   *
   * Die Zahl kam aber aus dem **Plan** der laufenden Woche, während die Sätze
   * daneben aus dem Protokoll der rollenden sieben Tage stammen: zwei
   * Datenquellen und zwei Zeitfenster in einem Satz. Wer die Sprinteinheit
   * ausgelassen hat, bekam die Warnung trotzdem.
   */
  // Der Satz erscheint erst ab `VOLUMEN.viel` Sätzen auf einer sprintbelasteten
  // Muskelgruppe – so viel plant der Tracker für Nils nie. Der Zustand wird
  // deshalb hier hergestellt und nicht aus dem Plan geliehen; sonst prüfte der
  // Test einen Fall, den er nie erreicht (Falle 18).
  const bis = '2026-06-15';
  const kraft = (datum, saetze) => ({
    id: `k${datum}`, datum, typ: 'kraft', titel: 'Kraft', minuten: 70, rpe: 8,
    uebungen: [{
      schluessel: 'kniebeuge',
      saetze: Array.from({ length: saetze }, () => ({ gewicht: 100, wiederholungen: 5 })),
    }],
  });
  const sprint = (datum) => ({
    id: `s${datum}`, datum, typ: 'sprint', titel: 'Sprint', minuten: 60, rpe: 8,
  });

  const daten = tagebuch();
  daten.sessions = [kraft('2026-06-10', 12), kraft('2026-06-12', 12), sprint('2026-06-11')];
  const mitSprint = zustand(daten, bis).leistung.volumen;

  // Dieselben Sätze, aber ohne eine einzige protokollierte Sprinteinheit.
  const ohne = tagebuch();
  ohne.sessions = daten.sessions.filter((x) => x.typ !== 'sprint');
  const ohneSprint = zustand(ohne, bis).leistung.volumen;

  const nenntSprint = (v) => Object.values(v)
    .some((e) => /Dazu kommt der Sprint an/.test(e.text || ''));

  assert.equal(nenntSprint(mitSprint), true,
    'mit protokollierten Sprints muss der Zusatz vorkommen – sonst prüft der Test nichts');
  assert.equal(nenntSprint(ohneSprint), false,
    'ohne protokollierten Sprint behauptet der Satz Training, das nicht stattgefunden hat');
});

test('Der Morgen-Check des Tages ist der zuletzt eingetragene', () => {
  /*
   * `checkSpeichern()` setzt beim Schreiben durch: „Ein Tag, ein Check – der
   * neue ersetzt den alten." Jeder Leser muss dieselbe Regel halten, sonst
   * widersprechen sich zwei Karten auf einem Bildschirm.
   *
   * `zustand()` nahm mit `find()` den **ersten** Eintrag des Tages. Eine
   * eingespielte Sicherung darf Doppelte enthalten (Falle 27 lehnt sie
   * bewusst nicht ab) – dann zeigte der Bereitschaftsring den
   * überschriebenen Wert, während `entlastungFaellig()` seit Falle 87 den
   * neueren zählt. Und weil `heute.check` den „Ändern"-Dialog vorbelegt,
   * hätte ein Speichern ohne eine einzige Eingabe den neueren Eintrag
   * stillschweigend zurückgenommen.
   */
  const profil = createProfil();
  profil.gewichtKg = 78.3;
  profil.groesseCm = 180;
  profil.geburtsjahr = 1995;
  profil.startdatum = '2026-06-01';

  const check = (wert) => ({
    datum: '2026-09-05', schlaf: wert, muskelkater: wert,
    stress: wert, stimmung: wert, energie: wert,
  });
  const basis = { profil, sessions: [], essen: [], gewicht: [], tests: [] };

  // Der alte Eintrag steht vorn, der neue hinten – so schreibt eine Sicherung.
  const z = zustand({ ...basis, checks: [check(5), check(1)] }, '2026-09-05');
  assert.equal(z.heute.bereitschaft.prozent, 20,
    'der spätere Eintrag des Tages gilt, auch wenn der frühere vorn steht');
  assert.equal(z.heute.check.schlaf, 1,
    'und derselbe steht im Ändern-Dialog');

  // Gegenprobe: umgekehrt gewinnt ebenfalls der letzte.
  const zGedreht = zustand({ ...basis, checks: [check(1), check(5)] }, '2026-09-05');
  assert.equal(zGedreht.heute.bereitschaft.prozent, 100,
    'die Reihenfolge entscheidet nicht, die Position tut es');
});

test('„Zuletzt trainiert" zeigt nur Einheiten bis zum angesehenen Tag – nach Datum', () => {
  /*
   * Zwei Eigenschaften in einer Zeile, beide vorher verletzt:
   *
   * 1. **Bis zum angesehenen Tag.** `slice(-10)` filterte gar nicht. Wer drei
   *    Tage zurückblätterte, sah unter „Zuletzt trainiert" Einheiten von
   *    danach – die Zukunft urteilt über die Vergangenheit (Falle 18), und
   *    das in einer Ansicht, deren übrige Karten „An diesem Tag" sagen.
   * 2. **Nach Datum, nicht nach Eintragereihenfolge.** `sessionAnlegen()`
   *    nimmt ein `datum` entgegen, eine vergessene Einheit lässt sich also
   *    nachtragen. Sie stand dann ganz oben, mit altem Datum darunter.
   */
  const profil = createProfil();
  profil.gewichtKg = 78.3;
  profil.groesseCm = 180;
  profil.geburtsjahr = 1995;
  profil.startdatum = '2026-06-01';

  const einheit = (datum, titel) => ({
    id: `s_${titel}`, datum, typ: 'kraft', titel, minuten: 60, rpe: 8,
    uebungen: [], laeufe: [], strecke: null, hfSchnitt: null,
  });

  // Eingetragen in dieser Reihenfolge – die nachgetragene steht hinten.
  const sessions = [
    einheit('2026-08-30', 'A'),
    einheit('2026-09-05', 'C'),
    einheit('2026-09-01', 'B'),
  ];
  const basis = { profil, essen: [], gewicht: [], tests: [], checks: [] };

  const rueckblick = zustand({ ...basis, sessions }, '2026-09-02');
  assert.deepEqual(rueckblick.letzteSessions.map((s) => s.titel), ['B', 'A'],
    'nur bis zum angesehenen Tag, und das jüngste zuerst');

  const heute = zustand({ ...basis, sessions }, '2026-09-05');
  assert.deepEqual(heute.letzteSessions.map((s) => s.titel), ['C', 'B', 'A'],
    'am aktuellen Tag zählt auch dessen eigene Einheit');

  // Zwei Einheiten an einem Tag behalten ihre Reihenfolge – Sprint vor Kraft,
  // so wie sie protokolliert wurden (Falle 63).
  const amStueck = [einheit('2026-09-05', 'Sprint'), einheit('2026-09-05', 'Kraft')];
  assert.deepEqual(
    zustand({ ...basis, sessions: amStueck }, '2026-09-05').letzteSessions.map((s) => s.titel),
    ['Sprint', 'Kraft'],
    'bei gleichem Datum entscheidet der Vergleich nichts');
});

test('Die Sprintkarte redet über eine einzige Einheit', () => {
  /*
   * In der Karte stehen zwei Aussagen über „die letzte Sprinteinheit"
   * übereinander: die Kennzahl „Zuletzt 4,30 s · 04.09." aus `bestzeiten()`
   * und die Überschrift „Letzte Einheit" über der Abbruch-Auswertung.
   *
   * Die erste las aus der nach Datum sortierten Liste, die zweite nahm den
   * letzten Eintrag im **Array**. Wer eine vergessene Sprinteinheit nachträgt,
   * bekam damit zwei verschiedene Einheiten auf einem Bildschirm (Falle 70) –
   * und die farbigen Laufpunkte, die Qualitätsmeter und die Abbruchregel
   * darunter gehörten zur falschen.
   *
   * Dazu kannte keine der beiden den angesehenen Tag, obwohl Belastung,
   * Ruhepuls und Ausdauerverteilung in derselben Ansicht ihn berücksichtigen
   * (Falle 90).
   */
  const profil = createProfil();
  profil.gewichtKg = 78.3;
  profil.groesseCm = 180;
  profil.geburtsjahr = 1995;
  profil.startdatum = '2026-06-01';

  const lauf = (sek) => ({ sekunden: sek, art: 'beschleunigung', distanz: 30 });
  const sprint = (datum, zeiten) => ({
    id: `s_${datum}`, datum, typ: 'sprint', titel: 'Sprint', minuten: 90, rpe: 8,
    uebungen: [], laeufe: zeiten.map(lauf),
  });
  const basis = { profil, essen: [], gewicht: [], tests: [], checks: [] };

  const alt = sprint('2026-09-01', [4.55, 4.58, 4.60]);
  const neu = sprint('2026-09-04', [4.30, 4.32, 4.35]);

  // Nachgetragen: die ältere Einheit steht hinten im Tagebuch.
  for (const [name, sessions] of [['nachgetragen', [neu, alt]], ['chronologisch', [alt, neu]]]) {
    const z = zustand({ ...basis, sessions }, '2026-09-05');
    const gruppe = Object.keys(z.sprint.bestzeiten)[0];
    assert.equal(z.sprint.letzte.datum, z.sprint.bestzeiten[gruppe].letzte.datum,
      `${name}: „Zuletzt" und „Letzte Einheit" müssen dieselbe Einheit meinen`);
    assert.equal(z.sprint.letzte.datum, '2026-09-04',
      `${name}: und zwar die jüngste, nicht die zuletzt eingetragene`);
  }

  // Beim Zurückblättern zählt nur, was bis dahin da war.
  const z = zustand({ ...basis, sessions: [alt, neu] }, '2026-09-02');
  assert.equal(z.sprint.letzte.datum, '2026-09-01',
    'am 02.09. ist die Einheit vom 04.09. noch nicht gelaufen');
  const gruppe = Object.keys(z.sprint.bestzeiten)[0];
  assert.equal(z.sprint.bestzeiten[gruppe].letzte.datum, '2026-09-01',
    'auch die Bestzeitenkarte blickt nicht in die Zukunft');
});

test('Prophylaxe ohne Muskelgruppe zählt trotzdem als protokolliert', () => {
  /*
   * Der Leerzustand-Fix aus Falle 89 leitete „noch nichts protokolliert" aus
   * `saetzeProMuskel` ab. Das ist ein Stellvertreter, kein Signal:
   * `einbeinstand` trägt `muskeln: {}` – die Übung wirkt über die
   * Ansteuerung, nicht über Kraft. Wer nur das Sprunggelenk-Programm
   * protokolliert, hat Sätze im Tagebuch und keine Muskelgruppe.
   *
   * Über einem Schutzziel, das mit 3 von 2 Sätzen **erfüllt** war, stand
   * damit „noch nichts protokolliert", und die Zeile war grau statt grün –
   * die Karte verschwieg eine Leistung, statt eine Warnung zurückzunehmen.
   * Ein Fehler in der Korrektur zu einer Falle (Falle 31).
   */
  const profil = createProfil();
  profil.gewichtKg = 78.3;
  profil.groesseCm = 180;
  profil.geburtsjahr = 1995;
  profil.startdatum = '2026-06-01';
  const basis = { profil, essen: [], gewicht: [], tests: [], checks: [] };

  const satz = { gewicht: 0, wiederholungen: 8 };
  const nurProphylaxe = [{
    id: 's1', datum: '2026-09-04', typ: 'kraft', titel: 'Kraft', minuten: 20, rpe: 5,
    laeufe: [], uebungen: [{ schluessel: 'einbeinstand', name: 'Einbeinstand', saetze: [satz, satz, satz] }],
  }];

  const z = zustand({ ...basis, sessions: nurProphylaxe }, '2026-09-05');
  assert.equal(z.leistung.saetzeImFenster, 3,
    'drei protokollierte Sätze sind drei protokollierte Sätze');
  assert.deepEqual(z.leistung.saetzeProMuskel, {},
    'und trotzdem trägt keine Muskelgruppe etwas davon – genau der Fall');
  assert.equal(z.leistung.schutz.sprunggelenk.erfuellt, true,
    'das Schutzziel ist erfüllt und muss auch so dastehen');

  // Gegenprobe: Ohne jeden Satz bleibt es beim Leerzustand.
  const leer = zustand({ ...basis, sessions: [] }, '2026-09-05');
  assert.equal(leer.leistung.saetzeImFenster, 0,
    'ohne Protokoll ist die Zahl null');
  assert.equal(leer.leistung.schutz.sprunggelenk.erfuellt, false,
    'und dann ist auch nichts erfüllt');
});

test('Der Kraftzettel eines vergangenen Tages kennt nur, was bis dahin da war', () => {
  /*
   * `leistungsstand()` bekam als einzige der grossen Auswertungen keinen
   * Stichtag – `acwr`, `monotonie`, `ruhepuls`, `verteilung`,
   * `saetzeProMuskel`, `schutz` und `risiko` bekommen ihn alle. Wer
   * zurückblätterte, las damit einen Übungszettel, der aus Tests und
   * Einheiten gerechnet war, die es an dem Tag noch gar nicht gab.
   *
   * Besonders unangenehm die Blockmeldung aus Falle 23: „Zuletzt 105 kg – das
   * war ein anderer Block" stand über einer Einheit aus der Zukunft.
   *
   * Familie von Falle 90 und 18.
   */
  const profil = createProfil();
  profil.gewichtKg = 78.3;
  profil.groesseCm = 180;
  profil.geburtsjahr = 1995;
  profil.startdatum = '2026-06-01';
  const basis = { profil, essen: [], gewicht: [], checks: [], sessions: [] };

  const tests = [
    { id: 'a', art: 'kniebeuge', wert: 100, wiederholungen: 5, datum: '2026-08-01' },
    { id: 'b', art: 'kniebeuge', wert: 140, wiederholungen: 5, datum: '2026-09-04' },
  ];

  const frueher = zustand({ ...basis, tests }, '2026-08-15').leistung.maxima.kniebeuge;
  assert.equal(frueher.datum, '2026-08-01',
    'am 15.08. war der Test vom 04.09. noch nicht gelaufen');

  const heute = zustand({ ...basis, tests }, '2026-09-05').leistung.maxima.kniebeuge;
  assert.equal(heute.datum, '2026-09-04',
    'am 05.09. zählt er – sonst prüfte der Test nur, dass nie etwas zählt');

  // Dasselbe für die Gewichtskurve, die in derselben Ansicht neben der
  // Belastungskarte steht – und die kennt den Stichtag längst.
  const gewicht = [
    { datum: '2026-08-10', kg: 79 },
    { datum: '2026-09-04', kg: 76 },
  ];
  assert.deepEqual(
    zustand({ ...basis, tests: [], gewicht }, '2026-08-15').gewichtsverlauf.map((p) => p.datum),
    ['2026-08-10'],
    'die Kurve endet am angesehenen Tag');
});

test('Was nach dem angesehenen Tag eingetragen wird, ändert an diesem Tag nichts', () => {
  /*
   * Die Fallen 18, 90, 93, 95 und 101 waren dieselbe Eigenschaft, jedes Mal
   * an einer anderen Karte behoben: `zustand(daten, D)` las Einträge, die
   * nach D liegen. Zuletzt die Tempokurven, die „Zuletzt …" und „besser
   * geworden" aus Einheiten schrieben, die an dem Tag noch nicht
   * stattgefunden hatten.
   *
   * Geprüft wird deshalb nicht eine Karte, sondern die Eigenschaft: Jede Art
   * Eintrag wird nach D ergänzt, und der ganze Zustand von D muss Zeichen für
   * Zeichen gleich bleiben. Eine neue Karte, die den Stichtag vergisst, fällt
   * hier auf, ohne dass jemand an sie gedacht hat.
   */
  const daten = tagebuch();
  daten.tests = [
    { id: 't1', art: 'kniebeuge', wert: 100, wiederholungen: 5, datum: '2026-05-25' },
    { id: 't2', art: 'klimmzuege', wert: 8, datum: '2026-05-25' },
  ];
  daten.gewicht = [{ datum: '2026-05-20', kg: 78.5 }, { datum: '2026-06-10', kg: 78.1 }];
  for (const s of daten.sessions) {
    if (s.typ === 'kraft') {
      s.uebungen = [
        { schluessel: 'kniebeuge', name: 'Kniebeuge', saetze: [{ gewicht: 90, wiederholungen: 5 }] },
        { schluessel: 'klimmzuege', name: 'Klimmzüge', saetze: [{ gewicht: 0, wiederholungen: 8 }] },
      ];
    }
    if (s.typ === 'sprint') {
      s.laeufe = [4.4, 4.35, 4.3].map((sekunden) => ({ sekunden, art: 'fliegend', distanz: 30 }));
    }
    if (s.typ.startsWith('ausdauer')) s.hfSchnitt = 135;
  }

  const spaeter = (d, k) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + k);
    return x.toISOString().slice(0, 10);
  };
  const eintraege = (datum) => ({
    sessions: [
      { id: 'z1', datum, typ: 'kraft', minuten: 60, rpe: 7, uebungen: [
        { schluessel: 'kniebeuge', name: 'Kniebeuge', saetze: [{ gewicht: 140, wiederholungen: 3 }] },
        { schluessel: 'nordic', name: 'Nordic', saetze: [{ gewicht: 0, wiederholungen: 6 }] },
      ] },
      { id: 'z2', datum, typ: 'sprint', minuten: 40, rpe: 8,
        laeufe: [{ sekunden: 3.9, art: 'fliegend', distanz: 30 }] },
      { id: 'z3', datum, typ: 'ausdauerLocker', minuten: 50, rpe: 3, hfSchnitt: 128,
        strecke: { meter: 30000, geraet: 'rad' } },
      { id: 'z4', datum, typ: 'ausdauerIntervalle', minuten: 55, rpe: 8, hfSchnitt: 165,
        strecke: { meter: 12000, geraet: 'lauf' } },
    ],
    checks: [{ datum, schlaf: 1, muskelkater: 1, stress: 1, stimmung: 1, energie: 1, ruhepuls: 70 }],
    essen: [{ id: 'z5', datum, name: 'Nudeln', mengeG: 300, kcal: 350, protein: 12, fett: 2, kohlenhydrate: 70 }],
    tests: [
      { id: 'z6', art: 'kniebeuge', wert: 150, wiederholungen: 3, datum },
      { id: 'z7', art: 'klimmzuege', wert: 14, datum },
      { id: 'z8', art: 'muscleups', wert: 1, datum },
      { id: 'z9', art: 'klimmzugZusatzlast', wert: 30, datum },
      { id: 'z10', art: 'cooper', wert: 3000, datum },
    ],
    gewicht: [{ datum, kg: 74 }],
  });

  const veraendert = [];
  for (const stichtag of ['2026-06-02', '2026-06-21', '2026-07-15', '2026-08-02']) {
    const vorher = JSON.stringify(zustand(daten, stichtag));
    for (const k of [1, 9]) {
      const neu = eintraege(spaeter(stichtag, k));
      for (const [liste, stuecke] of Object.entries(neu)) {
        for (const stueck of stuecke) {
          const mit = { ...daten, [liste]: [...daten[liste], stueck] };
          if (JSON.stringify(zustand(mit, stichtag)) !== vorher) {
            veraendert.push(`${stichtag} +${k} Tage: ${liste} ${stueck.typ || stueck.art || ''}`);
          }
        }
      }
    }
  }
  assert.deepEqual(veraendert, []);

  /*
   * Gegenprobe (Falle 18): Derselbe Eintrag am Tag selbst muss ankommen –
   * sonst prüfte der Test nur, dass nie etwas zählt. Ausgenommen ist der
   * Cooper-Test: Den liest allein die Testkarte, und die holt ihre Daten über
   * `daten.tests()` mit derselben `bestandBis()`.
   *
   * Diese Gegenprobe fand beim ersten Lauf selbst einen Fehler: Ein
   * eingetragener Muscle-Up änderte am Zustand kein Zeichen, solange frühere
   * Stufen offen waren (Falle 102).
   */
  const amTag = eintraege('2026-06-21');
  const ohneWirkung = [];
  const vorher = JSON.stringify(zustand(daten, '2026-06-21'));
  for (const [liste, stuecke] of Object.entries(amTag)) {
    for (const stueck of stuecke) {
      const mit = { ...daten, [liste]: [...daten[liste], stueck] };
      if (JSON.stringify(zustand(mit, '2026-06-21')) === vorher) {
        ohneWirkung.push(`${liste} ${stueck.typ || stueck.art || ''}`);
      }
    }
  }
  assert.deepEqual(ohneWirkung, ['tests cooper'], 'jeder Eintrag am Tag selbst muss ankommen');
});

test('Die Pfeile der Planansicht und der Plan des Tages rechnen dieselbe Woche', () => {
  /*
   * Zwei Wege zum Plan: `zustand()` für die Woche des angesehenen Tags, und
   * `wochenplanAm()` für die Pfeile „Woche davor/danach". Der zweite rechnete
   * den Leistungsstand aus dem ganzen Bestand statt bis zum Stichtag – über
   * die Pfeile kam dieselbe Woche mit anderen Lasten heraus als beim Öffnen,
   * gemessen an 56 von 84 Tagen bei Nils' Voreinstellung (Falle 101).
   */
  const daten = tagebuch();
  daten.tests = [
    { id: 't1', art: 'kniebeuge', wert: 100, wiederholungen: 5, datum: '2026-05-20' },
    { id: 't2', art: 'kniebeuge', wert: 130, wiederholungen: 5, datum: '2026-07-01' },
    { id: 't3', art: 'klimmzuege', wert: 13, datum: '2026-07-20' },
  ];
  for (const s of daten.sessions) {
    if (s.typ === 'kraft') {
      s.uebungen = [{ schluessel: 'kniebeuge', name: 'Kniebeuge', saetze: [{ gewicht: 95, wiederholungen: 5 }] }];
    }
  }
  const abweichend = [];
  for (const z of alleTage(daten)) {
    const ueberPfeile = wochenplanAm(daten, z.woche, z.datum);
    if (JSON.stringify(ueberPfeile) !== JSON.stringify(z.plan)) abweichend.push(z.datum);
  }
  assert.deepEqual(abweichend, []);
});

test('Der Grundumsatz rechnet mit dem Alter am angesehenen Tag', () => {
  // `tagesbedarf()` bekam als Einziges keinen Stichtag und rechnete mit dem
  // Alter von heute. Ohne Körperfettangabe läuft der Grundumsatz über
  // Mifflin-St Jeor, und dort zählt das Alter mit fünf Kilokalorien je Jahr.
  const profil = createProfil();
  Object.assign(profil, {
    gewichtKg: 78, groesseCm: 183, geburtsjahr: 1996, koerperfettProzent: null,
  });
  const daten = { profil, sessions: [], checks: [], essen: [], tests: [], gewicht: [], muscleup: { manuell: {} } };
  const damals = zustand(daten, '2026-03-01').heute.bedarf.grundumsatz;
  const spaeter = zustand(daten, '2030-03-01').heute.bedarf.grundumsatz;
  assert.equal(damals - spaeter, 20, 'vier Jahre älter heißt 20 kcal weniger');
});

test('Nachgetragenes ändert nichts: Die Reihenfolge der Tage im Tagebuch zählt nicht', () => {
  /*
   * Die Fallen 87, 88, 90, 93 und 104 waren dieselbe Eigenschaft: Die
   * Reihenfolge, in der Einträge in der Datei stehen, entschied über eine
   * Aussage – „der erste" statt „der letzte", `slice(-10)` statt der zehn
   * jüngsten, der hintere Sprinteintrag statt des ganzen Tages, beim
   * Gleichstand des Einer-Maximums der vordere statt des früheren.
   *
   * Wer nachträgt, ändert genau diese Reihenfolge. Geprüft wird deshalb: Die
   * Tage werden gemischt, innerhalb eines Tages bleibt die Reihenfolge (dort
   * ist sie eine Aussage – „der neue Check ersetzt den alten", die Läufe einer
   * Sprinteinheit in ihrer Folge), und der ganze Zustand muss gleich bleiben.
   */
  const daten = tagebuch();
  for (const s of daten.sessions) {
    if (s.typ === 'kraft') {
      s.uebungen = [{ schluessel: 'kniebeuge', name: 'Kniebeuge',
        saetze: [11, 10, 10].map((w) => ({ gewicht: 80, wiederholungen: w })) }];
    }
    if (s.typ === 'sprint') {
      s.laeufe = [4.4, 4.3, 4.32, 4.35].map((sekunden) => ({ sekunden, art: 'fliegend', distanz: 30 }));
    }
  }
  // Ein Nachtrag am selben Tag wie eine Sprinteinheit, zwei Testversuche an
  // einem Tag und ein Gleichstand im Einer-Maximum an zwei Tagen.
  const sprinttag = daten.sessions.find((s) => s.typ === 'sprint').datum;
  daten.sessions.push({ id: 'nach', datum: sprinttag, typ: 'sprint', minuten: 10, rpe: 8,
    laeufe: [4.6, 4.7].map((sekunden) => ({ sekunden, art: 'fliegend', distanz: 30 })) });
  daten.tests = [
    { id: 't1', art: 'klimmzuege', wert: 10, datum: '2026-05-25' },
    { id: 't2', art: 'klimmzuege', wert: 13, datum: '2026-06-15' },
    { id: 't3', art: 'klimmzuege', wert: 11, datum: '2026-06-15' },
    { id: 't4', art: 'kniebeuge', wert: 120, wiederholungen: 6, datum: '2026-06-01' },
    { id: 't5', art: 'kniebeuge', wert: 123.4, wiederholungen: 5, datum: '2026-06-20' },
  ];
  daten.gewicht = [{ datum: '2026-05-20', kg: 78.5 }, { datum: '2026-06-10', kg: 78.1 }];

  // Tage mischen, Reihenfolge im Tag behalten – mit festem Startwert.
  let zufall = 7;
  const naechste = () => { zufall = (zufall * 16807) % 2147483647; return zufall; };
  const tageMischen = (liste) => {
    const jeTag = new Map();
    for (const e of liste) jeTag.set(e.datum, [...(jeTag.get(e.datum) || []), e]);
    const tage = [...jeTag.keys()];
    for (let i = tage.length - 1; i > 0; i -= 1) {
      const j = naechste() % (i + 1);
      [tage[i], tage[j]] = [tage[j], tage[i]];
    }
    return tage.flatMap((t) => jeTag.get(t));
  };

  /*
   * Verglichen wird mit sortierten Schlüsseln: `maxima` füllt sich in der
   * Reihenfolge der Tests, die Werte sind aber dieselben, und die Oberfläche
   * liest es über die feste Reihenfolge der Kraftmarken. Eine Aussage ändert
   * die Schlüsselfolge dort nicht – eine andere Zahl schon.
   */
  const kanonisch = (wert) => JSON.stringify(wert, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v));
  const stichtage = ['2026-06-05', '2026-06-21', '2026-07-20', '2026-08-09'];
  const bezug = stichtage.map((d) => kanonisch(zustand(daten, d)));
  const abweichend = [];
  for (let runde = 0; runde < 3; runde += 1) {
    for (const liste of ['sessions', 'checks', 'essen', 'tests', 'gewicht']) {
      const gemischt = { ...daten, [liste]: tageMischen(daten[liste]) };
      stichtage.forEach((d, i) => {
        if (kanonisch(zustand(gemischt, d)) !== bezug[i]) abweichend.push(`${liste} ${d}`);
      });
    }
  }
  assert.deepEqual([...new Set(abweichend)], []);

  // Innerhalb des Tages bleibt die Reihenfolge – dort gehört der Nachtrag zur
  // Sprinteinheit, nicht an ihre Stelle (Falle 104): sechs Läufe, und die
  // beiden nachgetragenen liegen über der Abbruchmarke.
  const letzte = zustand(daten, sprinttag).sprint.letzte;
  assert.equal(letzte.gesamt, 6);
  assert.equal(letzte.ueberschuss, 2);
});
