// Füllt die IndexedDB mit einem realistischen Tagebuch.
//
// Der Leerzustand ist der einzige Zustand, den Nils garantiert erlebt – aber
// fast alle Karten zeigen erst mit Daten, was sie können. Gesät wird deshalb
// genau das, was der Wochenplaner vorschlägt, mit dem RPE, den er erwartet:
// So laufen Plan und Auswertung gegeneinander, und Widersprüche zwischen
// beiden werden im Bild sichtbar (siehe Falle Nr. 17).
//
//   node werkzeug/saeen.mjs [ausrichtung] [trainingstage] [wochen]
//   node werkzeug/saeen.mjs --leeren        # alles wegräumen
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte } from './cdp.mjs';
import { wochenplan } from '../kern/plan.js';
import { leistungsstand } from '../kern/leistung.js';
import { RPE_ERWARTUNG } from '../kern/wissen.js';

const leeren = process.argv.includes('--leeren');
const [ausrichtung = 30, tage = 4, wochen = 12] = process.argv.slice(2)
  .filter((a) => !a.startsWith('--')).map(Number);

const heute = new Date();
const start = new Date(heute);
start.setDate(start.getDate() - wochen * 7);

const profil = {
  name: 'Nils', geburtsjahr: 1996, geschlecht: 'm', groesseCm: 183, gewichtKg: 78.3,
  ausrichtung, trainingstageProWoche: tage, wiedereinstieg: false,
  alltagsaktivitaet: 'mittel', ausdauerGeraet: 'rad', koerpergewichtsfokus: true,
  gelenkschonend: true, kalorienziel: 'halten',
  startdatum: start.toISOString().slice(0, 10),
};

const sessions = [];
const checks = [];
/*
 * Ausgangswerte, damit der Planer von Woche 1 an Kilo statt Prozente vorgibt.
 *
 * Ohne sie protokolliert die Schleife unten Sätze mit `gewicht: 0` – und
 * daraus wird im Bild echter Unsinn: „24 Einheiten auf 0 kg ohne Fortschritt.
 * Zurück auf 0 kg" stand so unter der Frontkniebeuge. Frontkniebeuge und
 * rumänisches Kreuzheben leiten sich aus Kniebeuge und Kreuzheben ab, die
 * beiden Tests decken also vier Übungen.
 */
const testDatum = start.toISOString().slice(0, 10);
const spaeterDatum = new Date(start.getTime() + Math.round(wochen * 0.7) * 7 * 86400000)
  .toISOString().slice(0, 10);

/*
 * Gewichtsverlauf – die vierte Hälfte, die hier gefehlt hat.
 *
 * Ohne ihn steht in der Gewichtskarte „Noch zu wenig Verlauf", und damit sind
 * die Kurve, das 90-Punkte-Fenster und die Trendbewertung in keinem
 * Screenshot je zu sehen gewesen. Gewogen wird an fünf von sieben Tagen, mit
 * dem Rauschen, das eine Waage nun einmal hat – eine glatte Linie wäre keine
 * Prüfung für eine Kurve, die Trends beurteilen soll.
 */
const gewicht = [];
for (let t = 0; t < wochen * 7; t += 1) {
  if (t % 7 === 3 || t % 7 === 6) continue;
  const tagDatum = new Date(start.getTime() + t * 86400000);
  if (tagDatum > heute) break;
  const rauschen = ((t * 37) % 13 - 6) / 10;
  gewicht.push({
    id: `g_${t}`,
    datum: tagDatum.toISOString().slice(0, 10),
    kg: Math.round((77.6 + t * 0.008 + rauschen) * 10) / 10,
  });
}

const tests = [
  { id: 't_kniebeuge', datum: testDatum, art: 'kniebeuge', wert: 95, wiederholungen: 3 },
  { id: 't_kreuzheben', datum: testDatum, art: 'kreuzheben', wert: 120, wiederholungen: 3 },
  { id: 't_bank', datum: testDatum, art: 'bankdruecken', wert: 70, wiederholungen: 3 },
  { id: 't_hipthrust', datum: testDatum, art: 'hipthrust', wert: 110, wiederholungen: 3 },
  /*
   * Eine zweite Messung, damit überhaupt ein Verlauf entsteht: Bei nur einem
   * Wert stand unter jedem Test „Ein Verlauf entsteht ab der zweiten
   * Messung", und die Verlaufskurven der Leistungstests waren nie zu sehen.
   */
  { id: 't_kniebeuge2', datum: spaeterDatum, art: 'kniebeuge', wert: 105, wiederholungen: 3 },
  { id: 't_kreuzheben2', datum: spaeterDatum, art: 'kreuzheben', wert: 130, wiederholungen: 3 },
  // Und ein Wiederholungstest: Ohne ihn steht der Muscle-Up-Weg – das
  // erklärte Hauptziel – in jedem Screenshot auf „Stufe 0 von 10".
  { id: 't_klimmzuege', datum: testDatum, art: 'klimmzuege', wert: 9 },
  { id: 't_klimmzuege2', datum: spaeterDatum, art: 'klimmzuege', wert: 13 },
];

/*
 * Auch die Sätze werden protokolliert – und zwar die, die der Plan vorgibt.
 *
 * Vorher schrieb dieses Werkzeug nur die Einheit selbst (Art, Minuten, RPE).
 * Damit blieb die halbe App im Bild leer: Einer-Maxima, Progression,
 * Muskelvolumen und die Kraftmarken haben alle keine Grundlage, und die
 * Kraft-Tabelle zeigte in jedem Screenshot „–". Der Kommentar oben behauptet,
 * hier laufe Plan gegen Auswertung – für die Kraft stimmte das nicht.
 *
 * Gearbeitet wird am oberen Ende des Wiederholungsbereichs: Genau das
 * verlangt die doppelte Progression, bevor die Last steigt. Das ist zugleich
 * der Fall, der die Epley-Grenze reizt (Aufbaublock bis 12, Epley bis 10).
 */
const protokolliere = (einheit) => [
  ...(einheit.uebungen || []).map((u) => ({
    schluessel: u.schluessel,
    saetze: Array.from({ length: u.saetze }, () => ({
      gewicht: u.gewicht ? u.gewicht.bis : 0,
      wiederholungen: u.repBereich[1],
    })),
  })),
  /*
   * Prophylaxe und abhakbare Aufwärmblöcke gehören in dieselbe Liste.
   *
   * Der Protokolldialog führt `uebungen` und `prophylaxe` zusammen und
   * schreibt beides als `uebungen` weg – `schutzabdeckung()` zählt nur dort.
   * Ohne sie stand die Karte „Verletzungsschutz" im Bild auf **4 offen** und
   * jedes Ziel auf „0 von 2 Sätzen", obwohl der Plan Nordic, Copenhagen und
   * Wadenarbeit in jede Krafteinheit schreibt. Wieder eine Hälfte, die das
   * Werkzeug nicht erzeugt und damit unsichtbar macht (Falle 55).
   */
  ...(einheit.prophylaxe || []).map((u) => ({
    schluessel: u.schluessel,
    saetze: Array.from({ length: u.saetze || 2 }, () => ({ gewicht: 0, wiederholungen: 5 })),
  })),
  // Das neuromuskuläre Aufwärmen im Sprint zahlt aufs Sprunggelenk ein und
  // ist im Dialog ein Häkchen – dort entstehen zwei Sätze mit je einer
  // Wiederholung. Genau so wird es hier geschrieben.
  ...(einheit.bloecke || []).filter((b) => b.schluessel).map((b) => ({
    schluessel: b.schluessel,
    saetze: [{ gewicht: 0, wiederholungen: 1 }, { gewicht: 0, wiederholungen: 1 }],
  })),
];

for (let w = 1; w <= wochen; w += 1) {
  // Der Plan der Woche kennt, was bis dahin protokolliert wurde – so wie in
  // der App. Ohne das stünde in Woche 12 dieselbe Vorgabe wie in Woche 1.
  const stand = leistungsstand({ profil, sessions, tests });
  for (const tag of wochenplan(profil, w, stand).tage) {
    const d = new Date(start);
    d.setDate(d.getDate() + (w - 1) * 7 + tag.tag);
    if (d > heute) continue;
    const datum = d.toISOString().slice(0, 10);
    for (const e of tag.einheiten) {
      /*
       * Sprintzeiten – die dritte Hälfte, die dieses Werkzeug nicht erzeugt
       * hat. Ohne sie steht in der Fortschrittsansicht „Noch keine Zeiten
       * erfasst", und damit sind Abbruchregel, Bestzeiten und Verlauf in
       * jedem Screenshot unsichtbar (Falle 55, zum dritten Mal).
       *
       * Gesät wird ein realistischer Verlauf: leichte Verbesserung über die
       * Wochen, der erste Lauf noch nicht der schnellste (dafür gibt es die
       * Stufe `anlauf`, Falle 25), und gegen Ende der Serie langsamer werdend
       * – so, wie eine Sprinteinheit tatsächlich verläuft.
       */
      const laeufe = [];
      if (e.typ === 'sprint') {
        const art = e.sprintFokus === 'beschleunigung' ? 'beschleunigung' : 'fliegend';
        const anzahl = Math.max(1, Math.round((e.meter || 0) / 30));
        const grund = (art === 'fliegend' ? 3.28 : 4.32) - w * 0.012;
        for (let i = 0; i < anzahl; i += 1) {
          // Anlauf, dann das Fenster mit den besten Zeiten, dann Abfall.
          const aufschlag = i === 0 ? 0.09 : Math.max(0, (i - anzahl * 0.6) * 0.035);
          laeufe.push({
            distanz: 30,
            art,
            sekunden: Math.round((grund + aufschlag + ((w * 3 + i) % 4) * 0.008) * 100) / 100,
          });
        }
      }

      sessions.push({
        id: `s_${w}_${tag.tag}_${e.typ}`,
        datum,
        typ: e.typ,
        laeufe: laeufe.length ? laeufe : undefined,
        titel: e.titel,
        minuten: e.minuten,
        rpe: RPE_ERWARTUNG[e.typ] ?? 5,
        uebungen: protokolliere(e).length ? protokolliere(e) : undefined,
        // Etwas Streuung, sonst ist jede Verlaufskurve eine Gerade.
        strecke: e.typ.startsWith('ausdauer')
          ? { meter: Math.round(e.minuten * (380 + ((w * 7 + tag.tag) % 11) * 6)), geraet: 'rad' }
          : null,
      });
    }
    if (tag.trainingstag) {
      checks.push({
        datum,
        schlaf: 3 + ((w + tag.tag) % 3),
        muskelkater: 3 + ((w * 2 + tag.tag) % 3),
        stimmung: 4, energie: 3 + ((w + tag.tag) % 2), stress: 4,
        ruhepuls: 52 + ((w * 3 + tag.tag) % 5),
      });
    }
  }
}

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf);
await zurAnsicht(ruf, 'heute');

const anzahl = await js(ruf, `
  const db = await new Promise((f, r) => {
    const a = indexedDB.open('trainingstracker', 1);
    a.onupgradeneeded = () => {
      if (!a.result.objectStoreNames.contains('tagebuch')) a.result.createObjectStore('tagebuch');
    };
    a.onsuccess = () => f(a.result);
    a.onerror = () => r(a.error);
  });
  const schreiben = (wert) => new Promise((f, r) => {
    const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').put(wert, 'aktuell');
    t.onsuccess = f; t.onerror = () => r(t.error);
  });
  if (${leeren}) {
    await new Promise((f) => {
      const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').delete('aktuell');
      t.onsuccess = f; t.onerror = f;
    });
    return 0;
  }
  await schreiben({
    version: 1, essen: [], muscleup: { manuell: {} },
    gewicht: ${JSON.stringify(gewicht)},
    tests: ${JSON.stringify(tests)},
    angelegt: new Date().toISOString(),
    profil: ${JSON.stringify(profil)},
    sessions: ${JSON.stringify(sessions)},
    checks: ${JSON.stringify(checks)},
  });
  return ${sessions.length};
`);

await vorratLeeren(ruf);
await zurAnsicht(ruf, 'heute', { neuLaden: true });
await warte(500);

console.log(leeren
  ? 'Tagebuch geleert.'
  : `${anzahl} Einheiten und ${checks.length} Morgen-Checks gesät `
    + `(Regler ${ausrichtung}, ${tage} Tage, ${wochen} Wochen).`);
zu();
