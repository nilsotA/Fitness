// Alles, was den Datenbestand verändert.
//
// Diese Prüfungen liefen früher über echtes HTTP gegen den Server. Seit die
// Logik in kern/aendern.js steht und der Browser sie genauso aufruft, prüfen
// sie die Funktionen direkt: schneller, und sie decken beide Betriebsarten ab
// statt nur die Server-Variante.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../kern/aendern.js';
import { zustand } from '../kern/zustand.js';
import { heute, datumPlus } from '../kern/regeln.js';
import { wiegungenAufbereiten } from '../kern/ernaehrung.js';

const neu = () => A.leeresTagebuch();

test('Zustand kommt auch bei leerem Profil vollständig zurück', () => {
  // Ohne Körperdaten kann die Ernährung nichts rechnen – die Oberfläche muss
  // sich trotzdem zeichnen lassen, sonst sieht ein neuer Nutzer nur einen Fehler.
  const z = zustand(neu(), '2026-08-07');
  assert.equal(z.datum, '2026-08-07');
  assert.ok(z.plan?.tage?.length === 7);
  assert.ok(z.heute);
  assert.equal(z.profilStatus.vollstaendig, false);
  assert.ok(z.profilStatus.fehlend.length >= 3);
});

test('Profil speichern schaltet die Ernährungsrechnung frei', () => {
  const daten = neu();
  A.profilSpeichern(daten, { geburtsjahr: 1996, groesseCm: 183, gewichtKg: 78, geschlecht: 'm' });
  const z = zustand(daten, '2026-08-07');
  assert.equal(z.profilStatus.vollstaendig, true);
  assert.ok(z.heute.bedarf.ziel > 1500, `Bedarf ${z.heute.bedarf?.ziel}`);
});

test('Zahlen aus Formularen werden als Zahlen abgelegt', () => {
  const daten = neu();
  const p = A.profilSpeichern(daten, { gewichtKg: '81.5', groesseCm: '183', hfMaxGemessen: '' });
  assert.equal(p.gewichtKg, 81.5);
  assert.equal(typeof p.groesseCm, 'number');
  assert.equal(p.hfMaxGemessen, null, 'leeres Feld wird null, nicht 0');
});

test('Gewichtsänderung landet im Verlauf', () => {
  const daten = neu();
  A.profilSpeichern(daten, { gewichtKg: 79 });
  assert.equal(daten.gewicht.length, 1);
  assert.equal(daten.gewicht[0].kg, 79);
  assert.equal(daten.gewicht[0].datum, heute());
});

test('Gewicht lässt sich für vergangene Tage nachtragen', () => {
  const daten = neu();
  // Relativ zu heute: Ein festes Datum wäre nur so lange „vergangen", wie die
  // Uhr des Rechners es zulässt.
  const vorEinemMonat = datumPlus(heute(), -30);
  A.gewichtSpeichern(daten, { kg: 77.4, datum: vorEinemMonat });
  assert.equal(daten.gewicht[0].datum, vorEinemMonat);
  // Ein nachgetragener alter Wert darf das Profilgewicht nicht überschreiben.
  assert.notEqual(daten.profil.gewichtKg, 77.4);
});

test('Zweites Wiegen am selben Tag ersetzt das erste', () => {
  const daten = neu();
  A.gewichtSpeichern(daten, { kg: 78.0, datum: '2026-07-01' });
  A.gewichtSpeichern(daten, { kg: 78.6, datum: '2026-07-01' });
  assert.equal(daten.gewicht.length, 1, 'sonst verzackt die Kurve');
  assert.equal(daten.gewicht[0].kg, 78.6);
});

test('Gewicht ohne Wert wird abgelehnt', () => {
  assert.throws(() => A.gewichtSpeichern(neu(), {}), /Gewicht fehlt/);
});

test('Einheit eintragen berechnet die Belastung mit', () => {
  const daten = neu();
  const e = A.sessionAnlegen(daten, { typ: 'kraft', minuten: 60, rpe: 7, titel: 'Kraft' });
  assert.equal(e.last, 420);
  assert.equal(daten.sessions.length, 1);
});

test('Einheit ohne Pflichtfelder wird abgelehnt', () => {
  assert.throws(() => A.sessionAnlegen(neu(), { typ: 'kraft' }), /Dauer/);
  assert.throws(() => A.sessionAnlegen(neu(), { minuten: 60 }), /Typ/);
});

test('Einheit ändern und löschen', () => {
  const daten = neu();
  const e = A.sessionAnlegen(daten, { typ: 'kraft', minuten: 60, rpe: 7 });
  const geaendert = A.sessionAendern(daten, e.id, { rpe: 9 });
  assert.equal(geaendert.rpe, 9);
  assert.equal(geaendert.last, 540, 'die Belastung wird neu gerechnet');
  A.sessionLoeschen(daten, e.id);
  assert.equal(daten.sessions.length, 0);
  assert.equal(A.sessionAendern(daten, 'gibtesnicht', {}), null);
});

test('Essen eintragen und wieder löschen', () => {
  const daten = neu();
  const e = A.essenAnlegen(daten, {
    datum: '2026-08-07', name: 'Haferflocken', mengeG: 100,
    kcal: 370, protein: 13, kohlenhydrate: 59, fett: 7,
  });
  const z = zustand(daten, '2026-08-07');
  assert.equal(z.heute.ist.kcal, 370);
  A.essenLoeschen(daten, e.id);
  assert.equal(zustand(daten, '2026-08-07').heute.ist.kcal, 0);
});

test('Essen ohne Namen oder Menge wird abgelehnt', () => {
  assert.throws(() => A.essenAnlegen(neu(), { name: 'Brot' }), /Menge/);
});

test('Ein Essenseintrag lässt sich korrigieren, statt ihn neu zu tippen', () => {
  // Der häufigste Fall: die Menge um eine Stelle vertippt. Vorher blieb nur
  // Löschen und alle sechs Felder erneut eintragen (Falle 82, nach Falle 81).
  const daten = neu();
  const e = A.essenAnlegen(daten, {
    datum: '2026-08-07', name: 'Haferflocken', mengeG: 500,
    kcal: 370, protein: 13, kohlenhydrate: 59, fett: 7,
  });
  assert.equal(zustand(daten, '2026-08-07').heute.ist.kcal, 1850);

  A.essenAendern(daten, e.id, { mengeG: '62,5' });
  assert.equal(daten.essen.length, 1, 'kein zweiter Eintrag');
  assert.equal(daten.essen[0].mengeG, 62.5, 'das Komma wird deutsch gelesen');
  // Was nicht mitgeschickt wurde, bleibt stehen.
  assert.equal(daten.essen[0].name, 'Haferflocken');
  assert.equal(daten.essen[0].kcal, 370);
  assert.equal(zustand(daten, '2026-08-07').heute.ist.kcal, 231.25);
});

test('Ändern kann einen Essenseintrag nicht leerräumen', () => {
  // Was das Anlegen verbietet, darf das Ändern nicht erlauben: Ein Eintrag
  // ohne Menge trägt nichts zur Summe bei und muss dann eigens erklärt
  // werden (Falle 60).
  const daten = neu();
  const e = A.essenAnlegen(daten, { name: 'Brot', mengeG: 50, kcal: 250 });
  assert.throws(() => A.essenAendern(daten, e.id, { mengeG: '' }), /Menge/);
  assert.throws(() => A.essenAendern(daten, e.id, { name: '   ' }), /Name/);
  assert.equal(daten.essen[0].mengeG, 50, 'nach dem Fehlschlag steht der alte Wert');
  assert.equal(A.essenAendern(daten, 'gibtesnicht', { mengeG: 10 }), null);
});

test('Eine abgelehnte Änderung lässt gar nichts stehen – auch nicht halb', () => {
  /*
   * `speicher.aendern()` arbeitet auf dem lebenden Bestand und schreibt erst
   * danach. Wirft die Prüfung beim vierten von sechs Feldern, wären die
   * ersten drei im Arbeitsspeicher gesetzt – nicht gespeichert, aber da. Der
   * nächste beliebige Schreibvorgang macht sie dauerhaft, ohne dass jemand
   * etwas bestätigt hätte.
   */
  const daten = neu();
  const e = A.essenAnlegen(daten, {
    name: 'Haferflocken', mengeG: 100, kcal: 370, protein: 13, kohlenhydrate: 59, fett: 7,
  });
  const vorher = { ...daten.essen[0] };

  assert.throws(() => A.essenAendern(daten, e.id, {
    name: 'Neuer Name', mengeG: '55', kcal: '400', protein: 'zwölf',
  }), /Protein/);
  assert.deepEqual(daten.essen[0], vorher,
    'Name, Menge und Kalorien stehen schon geändert da, obwohl nichts gespeichert wurde');

  const t = A.testAnlegen(daten, { art: 'kniebeuge', wert: 100, wiederholungen: 5 });
  const testVorher = { ...daten.tests[0] };
  assert.throws(() => A.testAendern(daten, t.id, { art: 'bankdruecken', wert: 'schwer' }), /Wert/);
  assert.deepEqual(daten.tests[0], testVorher);
});

test('Morgen-Check ersetzt einen bestehenden Eintrag desselben Tages', () => {
  const daten = neu();
  A.checkSpeichern(daten, { datum: '2026-08-07', schlaf: 2, muskelkater: 2, stress: 2, stimmung: 2, energie: 2 });
  const zweite = A.checkSpeichern(daten, {
    datum: '2026-08-07', schlaf: 5, muskelkater: 5, stress: 5, stimmung: 5, energie: 5,
  });
  assert.equal(daten.checks.length, 1);
  assert.equal(zweite.bereitschaft.prozent, 100);
});

test('Tests eintragen treibt den Muscle-Up-Weg voran', () => {
  /*
   * Das Datum stand vorher nicht dabei, `testAnlegen()` setzte also `heute()`
   * – und angesehen wurde der 07.08. Seit der Zustand einen Stichtag hält
   * (die Zukunft urteilt nicht über die Vergangenheit), zählt ein Test von
   * heute an einem Tag im August zu Recht nicht mehr mit. Die Behauptung des
   * Tests bleibt dieselbe, seine Daten waren in sich widersprüchlich.
   */
  const daten = neu();
  A.testAnlegen(daten, { art: 'klimmzuege', wert: 12, datum: '2026-08-01' });
  const z = zustand(daten, '2026-08-07');
  assert.ok(z.muscleup.erreicht >= 2, `Stufe ${z.muscleup.erreicht}`);

  // Gegenprobe: derselbe Test einen Tag NACH dem angesehenen Tag zählt nicht.
  const spaeter = neu();
  A.testAnlegen(spaeter, { art: 'klimmzuege', wert: 12, datum: '2026-08-08' });
  assert.equal(zustand(spaeter, '2026-08-07').muscleup.erreicht, 0,
    'am 07.08. ist ein Test vom 08.08. noch nicht gelaufen');
});

test('Test ohne Art oder Wert wird abgelehnt', () => {
  assert.throws(() => A.testAnlegen(neu(), { art: 'klimmzuege' }), /Wert/);
});

test('Ein Leistungstest lässt sich korrigieren – und das Einer-Maximum zieht mit', () => {
  // Teurer als er aussieht: Aus dem Wert schätzt der Kern das Einer-Maximum,
  // und daran hängt jede Lastvorgabe des Plans. Eine Stelle vertippt hiess
  // vorher: löschen und alles neu (Falle 82).
  const daten = neu();
  const t = A.testAnlegen(daten, {
    datum: '2026-08-01', art: 'kniebeuge', wert: 1050, wiederholungen: 5,
  });
  const vorher = zustand(daten, '2026-08-07').leistung.maxima.kniebeuge.e1rm;

  A.testAendern(daten, t.id, { wert: '105', datum: '2026-07-20' });
  assert.equal(daten.tests.length, 1);
  assert.equal(daten.tests[0].wert, 105);
  assert.equal(daten.tests[0].datum, '2026-07-20');
  assert.equal(daten.tests[0].wiederholungen, 5, 'was nicht mitkam, bleibt stehen');
  const nachher = zustand(daten, '2026-08-07').leistung.maxima.kniebeuge.e1rm;
  assert.ok(nachher < vorher / 5, `${nachher} statt ${vorher}`);
});

test('Beim Wechsel der Testart verschwinden die Wiederholungen wirklich', () => {
  // `null` muss löschen, nicht "nicht mitgeschickt" bedeuten: Sonst bliebe
  // unter „Cooper-Test" eine Wiederholungszahl aus der Kniebeuge stehen und
  // liefe weiter in die Epley-Schätzung.
  const daten = neu();
  const t = A.testAnlegen(daten, { art: 'kniebeuge', wert: 100, wiederholungen: 5 });
  A.testAendern(daten, t.id, { art: 'cooper', wert: 2800, wiederholungen: null });
  assert.equal(daten.tests[0].art, 'cooper');
  assert.equal(daten.tests[0].wiederholungen, null);

  // Ohne das Feld bleibt der alte Wert stehen – das ist der Unterschied,
  // den `undefined` gegen `null` trägt.
  const u = A.testAnlegen(daten, { art: 'kniebeuge', wert: 100, wiederholungen: 5 });
  A.testAendern(daten, u.id, { wert: 110 });
  assert.equal(daten.tests[1].wiederholungen, 5);
  assert.equal(A.testAendern(daten, 'gibtesnicht', { wert: 1 }), null);
});

test('Manuelle Stufen lassen sich bestätigen', () => {
  const daten = neu();
  A.testAnlegen(daten, { art: 'klimmzuege', wert: 12 });
  const stand = A.muscleupSpeichern(daten, { stufe: 3, erreicht: true });
  assert.equal(daten.muscleup.manuell['3'], true);
  assert.ok(stand.erreicht >= 2);
});

test('Ein kaputter Import überschreibt nichts', () => {
  // Ein jahrelang geführtes Tagebuch darf nicht an einer falschen Datei sterben.
  assert.throws(() => A.pruefeImport({ irgendwas: true }), /Export/);
  assert.throws(() => A.pruefeImport(null), /lesbaren/);
  assert.throws(() => A.pruefeImport('text'), /lesbaren/);
});

test('Ein gültiger Import wird auf die aktuelle Form gebracht', () => {
  // Ein Tagebuch aus einer älteren Fassung kennt neue Felder nicht.
  const alt = { profil: { gewichtKg: 80 }, sessions: [] };
  const geprueft = A.pruefeImport(alt);
  assert.equal(geprueft.profil.gewichtKg, 80);
  assert.equal(geprueft.profil.ausrichtung, 30, 'fehlende Felder werden ergänzt');
  assert.ok(Array.isArray(geprueft.checks));
  assert.ok(geprueft.muscleup.manuell);
});

test('Kennungen sind eindeutig', () => {
  const gesehen = new Set();
  for (let i = 0; i < 500; i += 1) gesehen.add(A.id('s'));
  assert.equal(gesehen.size, 500);
});

test('Die Bestandsübersicht nennt den jüngsten Eintrag', () => {
  // Grundlage für die Rückfrage vor dem Einspielen: Wer zwischen zwei Geräten
  // hin- und herschiebt, erwischt irgendwann die ältere Datei.
  const daten = neu();
  A.sessionAnlegen(daten, { typ: 'kraft', minuten: 60, rpe: 7, datum: '2026-08-01' });
  A.sessionAnlegen(daten, { typ: 'sprint', minuten: 75, rpe: 8, datum: '2026-08-05' });
  A.essenAnlegen(daten, { datum: '2026-08-03', name: 'Brot', mengeG: 100, kcal: 250 });
  A.checkSpeichern(daten, { datum: '2026-08-06', schlaf: 4 });

  const u = A.bestandsUebersicht(daten);
  assert.equal(u.sessions, 2);
  assert.equal(u.essen, 1);
  assert.equal(u.checks, 1);
  assert.equal(u.letztesDatum, '2026-08-06', 'auch ein Check zählt als Eintrag');
});

test('Ein leerer Bestand hat kein Datum statt eines erfundenen', () => {
  const u = A.bestandsUebersicht(neu());
  assert.equal(u.letztesDatum, null);
  assert.equal(u.eintraege, 0);
});

test('Die Übersicht kommt auch mit unvollständigen Daten klar', () => {
  // Eine Datei aus einer älteren Fassung kennt manche Listen noch nicht.
  const u = A.bestandsUebersicht({ sessions: [{ datum: '2026-08-01' }] });
  assert.equal(u.sessions, 1);
  assert.equal(u.essen, 0);
  assert.equal(u.letztesDatum, '2026-08-01');
  assert.deepEqual(A.bestandsUebersicht(), A.bestandsUebersicht({}));
});

/* ------------------------------------------------- Sicherung einlesen */

test('Eine echte Sicherung geht durch', () => {
  const tagebuch = A.leeresTagebuch();
  A.sessionAnlegen(tagebuch, { typ: 'kraft', minuten: 60, rpe: 8 });
  const zurueck = A.ausSicherungsText(JSON.stringify(tagebuch));
  assert.equal(zurueck.sessions.length, 1);
});

test('Kaputte Sicherungen sagen auf Deutsch, was los ist', () => {
  // `JSON.parse` wirft Meldungen wie „Expected ',' or '}' after property value
  // in JSON at position 35". Die standen in einer sonst durchweg deutschen
  // Oberfläche – und sagen vor allem nicht, was zu tun ist.
  const faelle = [
    ['', /leer/i],
    ['   ', /leer/i],
    ['<?xml version="1.0"?><gpx><trk/></gpx>', /GPX|XML/],
    ['{"version":1,"sessions":[{"id":"s1"', /unvollständig/i],
    ['völliger unsinn', /nicht lesen/i],
    ['{"hallo":"welt"}', /Tracker-Export/],
    ['null', /Keine lesbaren Daten/],
  ];

  for (const [text, muster] of faelle) {
    assert.throws(() => A.ausSicherungsText(text), muster,
      `„${text.slice(0, 30)}" ergibt keine passende Meldung`);
  }
});

test('Keine Sicherungsmeldung ist englisches Parserkauderwelsch', () => {
  // Der Fehler, der das ausgelöst hat: „Unexpected token '<'" stand da, wenn
  // man beim Zurückspielen versehentlich eine GPX-Datei erwischt hatte – und
  // GPX liest der Tracker an anderer Stelle tatsächlich ein.
  const proben = ['', '<gpx/>', '{"a":', 'quatsch', '{}', 'null', '[1,2,3]'];
  for (const p of proben) {
    let meldung = '';
    try { A.ausSicherungsText(p); } catch (e) { meldung = e.message; }
    assert.ok(meldung, `„${p}" wirft gar nicht`);
    assert.doesNotMatch(meldung, /Unexpected|Expected|JSON at position|token/,
      `englische Parsermeldung bei „${p}": ${meldung}`);
  }
});

/* ------------------------------------------------------- Deutsche Zahlen */

test('Ein Komma ist eine Zahl, kein Tippfehler', () => {
  // Das hier ist eine deutsche App – auf der Tastatur liegt das Komma. Vorher
  // stand überall `Number(x) || 0`: Aus „162,5 kcal" wurden stillschweigend
  // 0 kcal, aus „62,5 min" eine Einheit ganz ohne Belastung. Kein Fehler,
  // keine Meldung, nur ein falscher Eintrag im Tagebuch.
  const t = A.leeresTagebuch();

  const essen = A.essenAnlegen(t, {
    name: 'Skyr', mengeG: '250', kcal: '162,5', protein: '27,3', fett: '0,5',
  });
  assert.equal(essen.kcal, 162.5);
  assert.equal(essen.protein, 27.3);
  assert.equal(essen.fett, 0.5);

  const einheit = A.sessionAnlegen(t, { typ: 'kraft', minuten: '62,5', rpe: '7' });
  assert.equal(einheit.minuten, 62.5);
  assert.ok(einheit.last > 0, 'Einheit ohne Belastung');

  A.gewichtSpeichern(t, { kg: '78,3' });
  assert.equal(t.gewicht.at(-1).kg, 78.3);

  const test = A.testAnlegen(t, { art: 'kniebeuge', wert: '102,5', wiederholungen: 3 });
  assert.equal(test.wert, 102.5);
});

test('Der Gewichtsverlauf bekommt nie ein NaN', () => {
  // profilSpeichern rechnete das Profil sauber um, schrieb in den Verlauf aber
  // die rohe Eingabe: Bei „78,3" stand das Profilgewicht auf null und im
  // Verlauf ein NaN – das überlebt das Speichern und verdirbt die Kurve.
  for (const eingabe of ['78,3', '78.3', 78.3, '1.078,3']) {
    const t = A.leeresTagebuch();
    try {
      A.profilSpeichern(t, { gewichtKg: eingabe, groesseCm: 183, geburtsjahr: 1997 });
    } catch (err) {
      // „1.078,3" ist lesbar, aber kein Körpergewicht – dann wird abgelehnt,
      // und im Bestand darf auch nichts davon stehen bleiben (Falle 103).
      assert.match(err.message, /^Gewicht: /);
      assert.deepEqual(t, { ...A.leeresTagebuch(), angelegt: t.angelegt });
      continue;
    }
    for (const g of t.gewicht) {
      assert.ok(Number.isFinite(g.kg), `${JSON.stringify(eingabe)} ergibt ${g.kg}`);
    }
    assert.ok(Number.isFinite(t.profil.gewichtKg), `Profil: ${t.profil.gewichtKg}`);
  }
});

test('Ein Profilwert in der falschen Einheit wird abgelehnt, und es bleibt nichts davon stehen', () => {
  /*
   * `profilSpeichern()` prüfte nur, ob eine Zahl lesbar ist. „96" als
   * Geburtsjahr ergab ein Kalorienziel von −8.997 kcal, „1.83" als Größe
   * (Meter statt Zentimeter) 1.530 kcal weniger am Tag – beides mit
   * „Gespeichert." quittiert. Und weil die rohe Eingabe zuerst ins Profil
   * geschrieben wurde, stand bei einem Wurf das halbe Formular schon im
   * lebenden Bestand (Falle 103).
   */
  const falsch = [
    [{ geburtsjahr: '96' }, /Geburtsjahr: .*1996/],
    [{ groesseCm: '1.83' }, /Größe: .*183 cm/],
    [{ groesseCm: '1,83' }, /Größe: /],
    [{ gewichtKg: '7,83' }, /Gewicht: /],
    [{ koerperfettProzent: '0,15' }, /Körperfett: /],
    [{ hfMaxGemessen: '19' }, /Maximalpuls: /],
    [{ geburtsjahr: '19996' }, /Geburtsjahr: /],
    [{ gewichtKg: '80,1', koerperfettProzent: '12,,5' }, /Körperfett: .*keine Zahl/],
  ];
  // Ohne `^`: `assert.throws` prüft das Muster gegen `String(err)`, also mit
  // „Error: " davor.
  for (const [eingabe, meldung] of falsch) {
    const t = A.leeresTagebuch();
    A.profilSpeichern(t, { gewichtKg: 78.3, groesseCm: 183, geburtsjahr: 1996, koerperfettProzent: 12 });
    const vorher = structuredClone(t);
    assert.throws(() => A.profilSpeichern(t, eingabe), meldung, JSON.stringify(eingabe));
    assert.deepEqual(t, vorher, `${JSON.stringify(eingabe)} hat den Bestand verändert`);
  }

  // Gegenprobe: Was in der richtigen Einheit kommt, geht durch – auch am Rand.
  const t = A.leeresTagebuch();
  A.profilSpeichern(t, {
    geburtsjahr: '1996', groesseCm: '183', gewichtKg: '78,3', koerperfettProzent: '12,5', hfMaxGemessen: '195',
  });
  assert.equal(t.profil.groesseCm, 183);
  assert.equal(t.profil.koerperfettProzent, 12.5);
  A.profilSpeichern(t, { groesseCm: '100' });
  A.profilSpeichern(t, { groesseCm: '250' });
  assert.throws(() => A.profilSpeichern(t, { groesseCm: '99' }), /Größe: /);
  assert.throws(() => A.profilSpeichern(t, { groesseCm: '251' }), /Größe: /);

  // Ein alter Wert aus einer Sicherung sperrt nicht das Verschieben des Reglers.
  const alt = A.leeresTagebuch();
  alt.profil.geburtsjahr = 96;
  A.profilSpeichern(alt, { ausrichtung: 40 });
  assert.equal(alt.profil.ausrichtung, 40);
});

test('Unlesbares wird nicht stillschweigend zu null', () => {
  // „Nichts eingetragen" und „etwas eingetragen, das ich nicht lesen kann"
  // sind zweierlei. Das Erste darf ein Vorgabewert sein, das Zweite nicht.
  const t = A.leeresTagebuch();
  assert.throws(() => A.essenAnlegen(t, { name: 'X', mengeG: 100, kcal: 'abc' }), /keine Zahl/);
  assert.throws(() => A.sessionAnlegen(t, { typ: 'kraft', minuten: 'zwölf', rpe: 7 }), /keine Zahl/);
  assert.throws(() => A.gewichtSpeichern(t, { kg: 'schwer' }), /keine Zahl/);

  // Leere Felder bleiben dagegen erlaubt – Fett darf fehlen und ist dann 0.
  const ohne = A.essenAnlegen(t, { name: 'Y', mengeG: 100, kcal: 200 });
  assert.equal(ohne.fett, 0);
});

/* --------------------------------- Beschädigte Sicherungen abweisen */

/** Eine gesunde Sicherung, die einzelne Tests dann kaputt machen. */
const sicherung = (aendern = (d) => d) => aendern({
  version: 1,
  profil: { name: 'Nils', geburtsjahr: 1996, gewichtKg: 78.3, groesseCm: 183 },
  sessions: [{ id: 's1', datum: '2026-08-01', typ: 'kraft', minuten: 60, rpe: 7 }],
  checks: [], essen: [], tests: [], gewicht: [], muscleup: { manuell: {} },
});

test('Eine Liste, die keine ist, wird abgewiesen', () => {
  // Das Einspielen ersetzt alles. `essen` als Objekt statt Array liess danach
  // `daten.essen.filter` beim Aufbau des Zustands werfen – die App war nach
  // dem Zurückspielen nicht mehr zu öffnen, und der alte Bestand war weg.
  assert.throws(() => A.pruefeImport(sicherung((d) => { d.essen = { a: 1 }; return d; })),
    /Ernährungstagebuch/);
  assert.throws(() => A.pruefeImport(sicherung((d) => { d.checks = 'nein'; return d; })),
    /Morgen-Checks/);
});

test('Leere Einträge in einer Liste werden abgewiesen', () => {
  // Ein einzelnes `null` in `sessions` reichte für denselben Absturz.
  assert.throws(
    () => A.pruefeImport(sicherung((d) => { d.sessions = [null, d.sessions[0]]; return d; })),
    /1 Eintrag in „Tagebuch" ist leer/);
  assert.throws(
    () => A.pruefeImport(sicherung((d) => { d.gewicht = ['78,3']; return d; })),
    /Gewichtsverlauf/);
});

test('Ein Profil, das kein Objekt ist, wird abgewiesen', () => {
  // `{...createProfil(), ...'Nils'}` ergibt Schlüssel 0,1,2,3 – das Profil
  // wäre stillschweigend durch die Vorgabewerte ersetzt.
  assert.throws(() => A.pruefeImport(sicherung((d) => { d.profil = 'Nils'; return d; })),
    /Profil/);
});

test('Die Meldung sagt, dass nichts eingespielt wurde', () => {
  // Beim Zurückspielen einer Sicherung ist die wichtigste Auskunft, ob der
  // eigene Stand noch da ist. Ohne sie bleibt nur Raten.
  try {
    A.pruefeImport(sicherung((d) => { d.sessions = [null]; return d; }));
    assert.fail('hätte werfen müssen');
  } catch (err) {
    assert.match(err.message, /bisheriger Stand bleibt unangetastet/);
  }
});

test('Eine gesunde Sicherung geht weiterhin durch', () => {
  // Gegenprobe: Die Härtung darf keine brauchbare Datei abweisen. Fehlende
  // Listen sind in Ordnung – `vervollstaendigen()` legt leere an.
  const ok = A.pruefeImport(sicherung());
  assert.equal(ok.sessions.length, 1);

  const ohneChecks = A.pruefeImport(sicherung((d) => { delete d.checks; return d; }));
  assert.deepEqual(ohneChecks.checks, [], 'fehlende Liste wird ergänzt, nicht abgelehnt');
});

test('Eine protokollierte Einheit lässt sich korrigieren, ohne sie neu einzutragen', () => {
  /*
   * `sessionAendern()` war bis `app/daten.js` verdrahtet und rief niemand auf –
   * in „Zuletzt trainiert" gab es nur „×". Wer einen RPE verrutschte, musste
   * die ganze Einheit löschen und alles neu eintragen: alle Sätze mit Gewicht
   * und Wiederholungen, alle Sprintzeiten, Strecke und Puls. Beim Morgen-Check
   * gab es „Ändern" längst; das war ein Loch mitten in einer Reihe
   * gleichartiger Bedienelemente (Falle 45).
   */
  const d = A.leeresTagebuch();
  const s = A.sessionAnlegen(d, {
    typ: 'ausdauerLocker', titel: 'Grundlage (Rad)', minuten: 55, rpe: 4,
    strecke: { meter: 15400, geraet: 'rad' }, hfSchnitt: 132,
  });

  // Nur was übergeben wird, ändert sich – der Rest bleibt unangetastet.
  A.sessionAendern(d, s.id, { rpe: 6, minuten: 62 });
  assert.equal(s.rpe, 6);
  assert.equal(s.minuten, 62);
  assert.equal(s.strecke.meter, 15400, 'die Strecke darf nicht mitverschwinden');
  assert.equal(s.hfSchnitt, 132);
  assert.equal(d.sessions.length, 1, 'ändern darf keine zweite Einheit anlegen');
  // Die Belastungszahl zieht mit – sie ist RPE × Minuten und stünde sonst
  // veraltet im Tagebuch.
  assert.equal(s.last, 6 * 62);

  // Auch die Art: Wer eine Ausfahrt versehentlich als Intervalleinheit
  // protokolliert, verschiebt sonst die Intensitätsverteilung und kann es nur
  // durch Löschen richtigstellen.
  A.sessionAendern(d, s.id, { typ: 'ausdauerIntervalle', titel: 'Intervalle' });
  assert.equal(s.typ, 'ausdauerIntervalle');
  assert.equal(s.titel, 'Intervalle');

  // Ein Komma wird gelesen, kein stilles Nullsetzen (Falle 14).
  A.sessionAendern(d, s.id, { minuten: '62,5' });
  assert.equal(s.minuten, 62.5);
  assert.throws(() => A.sessionAendern(d, s.id, { minuten: 'viel' }), /keine Zahl/);

  // Und eine unbekannte Kennung ändert nichts, statt etwas anzulegen.
  assert.equal(A.sessionAendern(d, 'gibt-es-nicht', { rpe: 1 }), null);
  assert.equal(d.sessions.length, 1);
});

test('Profil und Wiegung schreiben nach derselben Tagesregel', () => {
  /*
   * `gewichtSpeichern()` setzt „Ein Tag, ein Wert" durch, indem es alle
   * Einträge des Tages entfernt und einen neuen anhängt. `profilSpeichern()`
   * tat dasselbe mit einem `find()` – es änderte nur den **ersten**. Bei zwei
   * Wiegungen desselben Tages aus einer eingespielten Sicherung (Falle 27
   * lehnt die bewusst nicht ab) blieb die zweite stehen, und genau die zeigt
   * `wiegungenAufbereiten()` an: Das neue Gewicht war gespeichert und in der
   * Kurve nicht zu sehen.
   *
   * Zwei Schreiber für dieselbe Sache laufen auseinander (Falle 13); geprüft
   * wird deshalb, dass beide dasselbe hinterlassen.
   */
  const heuteDatum = heute();
  const doppelt = () => ({
    ...A.leeresTagebuch(),
    gewicht: [{ datum: heuteDatum, kg: 80 }, { datum: heuteDatum, kg: 90 }],
  });

  const ueberProfil = doppelt();
  A.profilSpeichern(ueberProfil, { gewichtKg: 78.3, groesseCm: 180, geburtsjahr: 1995 });

  const ueberWiegung = doppelt();
  A.gewichtSpeichern(ueberWiegung, { kg: 78.3, datum: heuteDatum });

  const nurHeute = (d) => d.gewicht.filter((g) => g.datum === heuteDatum);
  assert.equal(nurHeute(ueberProfil).length, 1,
    'nach dem Profil steht genau ein Wert für heute im Verlauf');
  assert.deepEqual(nurHeute(ueberProfil), nurHeute(ueberWiegung),
    'beide Wege hinterlassen denselben Verlauf');
  assert.equal(nurHeute(ueberProfil)[0].kg, 78.3,
    'und zwar den neu eingetragenen Wert');
});

test('Eine Wiegung zu speichern ändert keinen anderen Tag', () => {
  /*
   * `gewichtSpeichern()` sortiert den ganzen Verlauf neu. Doppelte Tage kann
   * eine eingespielte Sicherung enthalten – gefiltert wird nur der Tag, der
   * gerade geschrieben wird –, und `wiegungenAufbereiten()` nimmt je Tag den
   * **letzten** Eintrag. Dreht der Sortiervergleich gleichrangige Einträge
   * um, zeigt die Kurve nach dem Speichern für **andere** Tage andere Kilos:
   * gemessen 80 statt 90 kg, ohne dass jemand diese Tage angefasst hätte.
   *
   * Ein Sortiervergleich soll ordnen, nicht entscheiden (Falle 63). Geprüft
   * wird deshalb die Eigenschaft, auf die es ankommt: Was der Nutzer für
   * fremde Tage sieht, darf sich durch das Speichern nicht ändern.
   */
  const verlauf = [
    { datum: '2026-08-01', kg: 80 }, { datum: '2026-08-01', kg: 90 },
    { datum: '2026-08-02', kg: 81 }, { datum: '2026-08-02', kg: 85 },
  ];
  const vorher = wiegungenAufbereiten(verlauf).punkte;

  const daten = { ...A.leeresTagebuch(), gewicht: verlauf.map((g) => ({ ...g })) };
  A.gewichtSpeichern(daten, { kg: 78.3, datum: '2026-09-05' });
  const nachher = wiegungenAufbereiten(daten.gewicht).punkte;

  assert.deepEqual(nachher.filter((p) => p.datum !== '2026-09-05'), vorher,
    'die übrigen Tage stehen nach dem Speichern unverändert in der Kurve');
});

test('Eine Einheit behält beim Ändern eine Dauer – wie beim Anlegen', () => {
  /*
   * `sessionAendern()` nahm eine geleerte Dauer als 0 an, `sessionAnlegen()`
   * lehnte sie ab. Am Gerät stand „Einheit geändert." über „Grundlage (Rad) ·
   * 0 min", die Last fiel auf 0 und der Punkt verschwand aus der Tempokurve,
   * während die Strecke weiter zählte (Falle 103).
   */
  for (const minuten of [0, '', '0', -60, '-1']) {
    const t = A.leeresTagebuch();
    const s = A.sessionAnlegen(t, { typ: 'ausdauerLocker', minuten: 45, rpe: 3 });
    const vorher = structuredClone(t);
    assert.throws(() => A.sessionAendern(t, s.id, { typ: 'ausdauerLocker', minuten, rpe: 4 }), /Dauer/,
      `ändern mit ${JSON.stringify(minuten)}`);
    assert.deepEqual(t, vorher, `${JSON.stringify(minuten)} hat den Eintrag verändert`);
    assert.throws(() => A.sessionAnlegen(t, { typ: 'kraft', minuten, rpe: 7 }), /Dauer/,
      `anlegen mit ${JSON.stringify(minuten)}`);
  }
  // Gegenprobe: Eine echte Dauer geht auf beiden Wegen durch.
  const t = A.leeresTagebuch();
  const s = A.sessionAnlegen(t, { typ: 'kraft', minuten: '62,5', rpe: 7 });
  assert.equal(A.sessionAendern(t, s.id, { typ: 'kraft', minuten: 50, rpe: 7 }).minuten, 50);
});

test('Eine Sicherung mit kaputten Listen in einer Einheit wird abgelehnt – und ein schon eingespielter Bestand heilt', () => {
  /*
   * Falle 27 prüfte die Listen des Tagebuchs, nicht die Listen in einer
   * Einheit. `uebungen: [null]`, Sätze als Text oder `laeufe: [null]` gingen
   * durch, danach warf `zustand()`, und die App blieb in jeder Ansicht leer –
   * auch im Profil, wo „Einspielen" liegt (Falle 106).
   */
  const mit = (einheit) => ({ ...A.leeresTagebuch(), sessions: [
    { id: 'a', datum: '2026-08-01', typ: 'kraft', minuten: 60, rpe: 7,
      uebungen: [{ schluessel: 'kniebeuge', saetze: [{ gewicht: 90, wiederholungen: 5 }] }] },
    { id: 'b', datum: '2026-08-03', typ: 'kraft', minuten: 60, rpe: 7, ...einheit },
  ] });
  const kaputt = [
    { uebungen: [null] },
    { uebungen: 'Kniebeuge' },
    { uebungen: [{ schluessel: 'kniebeuge', saetze: [null] }] },
    { uebungen: [{ schluessel: 'kniebeuge', saetze: '3x5' }] },
    { typ: 'sprint', laeufe: [null] },
    { typ: 'sprint', laeufe: 4.3 },
  ];
  for (const einheit of kaputt) {
    assert.throws(() => A.pruefeImport(mit(einheit)), /1 Einheit im „Tagebuch" hat eine unlesbare.*unangetastet/,
      JSON.stringify(einheit));
    // Das Netz darunter: Wurde so ein Bestand vor dieser Prüfung eingespielt,
    // startet die App trotzdem wieder.
    const geheilt = A.vervollstaendigen(mit(einheit));
    assert.doesNotThrow(() => zustand(geheilt, '2026-08-05'), JSON.stringify(einheit));
    assert.equal(geheilt.sessions[0].uebungen[0].saetze.length, 1, 'die heile Einheit bleibt, wie sie ist');
  }
  // Gegenprobe: Einheiten ohne Übungen oder Läufe sind in Ordnung.
  assert.doesNotThrow(() => A.pruefeImport(mit({ uebungen: undefined })));
});

test('Einträge ohne oder mit doppelter id bekommen beim Laden eine eigene', () => {
  /*
   * Löschen und Ändern greifen über die `id`. Ohne sie warf ein Tipp auf „×"
   * alle id-losen Einträge auf einmal hinaus – 68 Einheiten, 510 Mahlzeiten –,
   * und „Ändern" schrieb in den ältesten Eintrag statt in den angetippten
   * (Falle 106).
   */
  const roh = {
    ...A.leeresTagebuch(),
    sessions: [
      { datum: '2026-08-01', typ: 'kraft', minuten: 60, rpe: 7 },
      { datum: '2026-08-02', typ: 'kraft', minuten: 50, rpe: 6 },
      { id: 'x', datum: '2026-08-03', typ: 'kraft', minuten: 40, rpe: 5 },
      { id: 'x', datum: '2026-08-04', typ: 'kraft', minuten: 30, rpe: 4 },
    ],
    essen: [{ datum: '2026-08-01', name: 'A', mengeG: 100, kcal: 100 }, { datum: '2026-08-01', name: 'B', mengeG: 100, kcal: 100 }],
    tests: [{ art: 'klimmzuege', wert: 9, datum: '2026-08-01' }, { art: 'klimmzuege', wert: 10, datum: '2026-08-02' }],
  };
  const d = A.pruefeImport(roh);
  for (const liste of ['sessions', 'essen', 'tests']) {
    const ids = d[liste].map((e) => e.id);
    assert.ok(ids.every(Boolean), `${liste}: jede Zeile hat eine id`);
    assert.equal(new Set(ids).size, ids.length, `${liste}: keine doppelt`);
  }
  assert.equal(d.sessions[2].id, 'x', 'eine vorhandene, eindeutige id bleibt');

  // Löschen trifft genau einen Eintrag, Ändern genau den gemeinten.
  A.sessionLoeschen(d, d.sessions[1].id);
  assert.equal(d.sessions.length, 3);
  A.sessionAendern(d, d.sessions[2].id, { typ: 'kraft', minuten: 35, rpe: 4 });
  assert.deepEqual(d.sessions.map((s) => s.minuten), [60, 40, 35]);
  A.essenLoeschen(d, d.essen[0].id);
  assert.deepEqual(d.essen.map((e) => e.name), ['B']);
});

test('Was die Importprüfung annimmt, bringt die App nicht zum Stehen', () => {
  /*
   * Falle 27 und 106 in allgemeiner Form: Einzelwerte werden bewusst nicht
   * abgelehnt – eine krumme Zahl soll niemanden aus seiner Sicherung
   * aussperren. Dann muss aber alles, was angenommen wird, einen Zustand
   * ergeben, ohne Wurf und ohne „NaN" oder „undefined" im Text. Jedes Feld
   * jeder Eintragsart wird einzeln mit unsinnigen Werten belegt.
   */
  const basis = () => ({
    ...A.leeresTagebuch(),
    profil: { ...A.leeresTagebuch().profil, gewichtKg: 78, groesseCm: 183, geburtsjahr: 1996,
      koerperfettProzent: 12, startdatum: '2026-07-06' },
    sessions: [
      { id: 'k', datum: '2026-07-20', typ: 'kraft', minuten: 60, rpe: 7,
        uebungen: [{ schluessel: 'kniebeuge', name: 'Kniebeuge', saetze: [{ gewicht: 90, wiederholungen: 5 }] }] },
      { id: 's', datum: '2026-07-21', typ: 'sprint', minuten: 60, rpe: 8,
        laeufe: [4.3, 4.2, 4.25].map((sekunden) => ({ sekunden, art: 'fliegend', distanz: 30 })) },
      { id: 'a', datum: '2026-07-22', typ: 'ausdauerLocker', minuten: 60, rpe: 3, hfSchnitt: 130,
        strecke: { meter: 30000, geraet: 'rad' } },
    ],
    checks: [{ datum: '2026-07-22', schlaf: 3, muskelkater: 3, stress: 3, stimmung: 3, energie: 3, ruhepuls: 52 }],
    essen: [{ id: 'e', datum: '2026-07-22', name: 'Haferflocken', mengeG: 100, kcal: 372, protein: 13,
      fett: 7, kohlenhydrate: 59, mahlzeit: 'fruehstueck' }],
    tests: [{ id: 't', art: 'kniebeuge', wert: 100, wiederholungen: 5, datum: '2026-07-06' }],
    gewicht: [{ datum: '2026-07-06', kg: 78 }],
  });
  const felder = {
    sessions: ['datum', 'typ', 'minuten', 'rpe', 'uebungen', 'laeufe', 'strecke', 'hfSchnitt'],
    checks: ['datum', 'schlaf', 'ruhepuls'],
    essen: ['datum', 'name', 'mengeG', 'kcal', 'mahlzeit'],
    tests: ['datum', 'art', 'wert', 'wiederholungen'],
    gewicht: ['datum', 'kg'],
    profil: ['gewichtKg', 'geburtsjahr', 'koerperfettProzent', 'startdatum', 'kalorienziel'],
  };
  const unsinn = [null, '', 'x', -1, {}, [null], '78,3'];
  const befunde = new Set();
  let angenommen = 0;
  for (const [liste, namen] of Object.entries(felder)) {
    for (const feld of namen) {
      for (const wert of unsinn) {
        const d = basis();
        if (liste === 'profil') d.profil[feld] = wert;
        else for (const e of d[liste]) e[feld] = wert;
        let geprueft;
        try { geprueft = A.pruefeImport(structuredClone(d)); } catch { continue; }
        angenommen += 1;
        try {
          const text = JSON.stringify(zustand(geprueft, '2026-07-25'));
          for (const muster of ['NaN', 'undefined', 'Infinity']) {
            if (text.includes(muster)) befunde.add(`${muster}: ${liste}.${feld} = ${JSON.stringify(wert)}`);
          }
        } catch (err) {
          befunde.add(`wirft: ${liste}.${feld} = ${JSON.stringify(wert)} (${err.message.slice(0, 60)})`);
        }
      }
    }
  }
  assert.ok(angenommen > 100, `die Prüfung muss den Großteil annehmen (${angenommen}) – sonst prüft der Test nichts`);
  assert.deepEqual([...befunde], []);
});
