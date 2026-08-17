import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../kern/ernaehrung.js';
import * as W from '../kern/wissen.js';
import { fettfreieMasse, createProfil } from '../kern/profil.js';

const PROFIL = {
  geburtsjahr: 1997,
  geschlecht: 'm',
  groesseCm: 183,
  gewichtKg: 80,
  alltagsaktivitaet: 'mittel',
  kalorienziel: 'halten',
};

const HEUTE = new Date('2026-08-07');

test('Grundumsatz nach Mifflin-St Jeor ohne Körperfettanteil', () => {
  const gu = E.grundumsatz(PROFIL, HEUTE);
  // 10×80 + 6,25×183 − 5×29 + 5 = 800 + 1143,75 − 145 + 5 = 1803,75
  assert.equal(gu.kcal, 1804);
  assert.equal(gu.formel, 'Mifflin-St Jeor');
});

test('Mit Körperfettanteil rechnet Cunningham', () => {
  const gu = E.grundumsatz({ ...PROFIL, koerperfettProzent: 12 }, HEUTE);
  // FFM 70,4 kg → 500 + 22×70,4 = 2048,8
  assert.equal(gu.kcal, 2049);
  assert.equal(gu.formel, 'Cunningham');
});

test('Ohne Gewicht kein Grundumsatz', () => {
  assert.equal(E.grundumsatz({ groesseCm: 183 }, HEUTE), null);
});

test('Trainingsumsatz steigt mit Dauer und Intensität', () => {
  const sprint = E.einheitKcal('sprint', 60, 80);
  const locker = E.einheitKcal('mobilitaet', 60, 80);
  const intervalle = E.einheitKcal('ausdauerIntervalle', 60, 80);
  assert.ok(intervalle > sprint);
  assert.ok(sprint > locker);
  assert.equal(E.einheitKcal('sprint', 0, 80), 0);
});

test('Tagesbedarf zählt Training nicht doppelt', () => {
  const ohne = E.tagesbedarf(PROFIL, [], HEUTE);
  const mit = E.tagesbedarf(PROFIL, [{ typ: 'kraft', minuten: 60 }], HEUTE);
  assert.equal(ohne.training, 0);
  assert.ok(mit.training > 0);
  assert.equal(mit.erhaltung - ohne.erhaltung, mit.training);
});

test('Trainingsumsatz bleibt für eine Sprinteinheit plausibel', () => {
  // Regression: Mit den MET-Werten *während* der Belastung statt im Schnitt über
  // die Einheit kam eine zweistündige Sprinteinheit auf über 1200 kcal – so viel
  // wie zwei Stunden Dauerlauf. Eine Sprinteinheit besteht aber überwiegend aus
  // Stehen und Gehen.
  const sprint = E.einheitKcal('sprint', 114, 78);
  assert.ok(sprint > 400 && sprint < 1000, `${sprint} kcal für 114 min Sprinttraining`);

  const kraft = E.einheitKcal('kraft', 76, 78);
  assert.ok(kraft > 250 && kraft < 600, `${kraft} kcal für 76 min Krafttraining`);

  // Durchgehende Ausdauer darf pro Minute mehr kosten als Sprint mit Pausen.
  assert.ok(E.einheitKcal('ausdauerLocker', 60, 78) > E.einheitKcal('sprint', 60, 78));
});

test('Ein sehr großer Trainingstag bleibt im plausiblen Rahmen', () => {
  // Schutz gegen doppelte Zählung: Der Alltagsfaktor deckt Bewegung ohne Sport
  // ab, das Training kommt separat dazu. Sind die Faktoren zu hoch angesetzt,
  // landet man bei Fantasiewerten – und isst dauerhaft zu viel.
  const bedarf = E.tagesbedarf(PROFIL, [
    { typ: 'sprint', minuten: 114 },
    { typ: 'kraft', minuten: 76 },
  ], HEUTE);

  assert.ok(bedarf.ziel > 3000, `${bedarf.ziel} kcal – für 3 h Training zu wenig`);
  assert.ok(bedarf.ziel < 4600, `${bedarf.ziel} kcal – unrealistisch hoch für 78 kg`);
  // Der Trainingsanteil darf den Rest nicht überholen.
  assert.ok(bedarf.training < bedarf.alltag,
    `Training ${bedarf.training} kcal gegen Alltag ${bedarf.alltag} kcal`);
});

test('Ruhetag liegt deutlich unter dem harten Trainingstag', () => {
  const ruhe = E.tagesbedarf(PROFIL, [], HEUTE);
  const hart = E.tagesbedarf(PROFIL, [
    { typ: 'sprint', minuten: 114 }, { typ: 'kraft', minuten: 76 },
  ], HEUTE);
  assert.ok(hart.ziel - ruhe.ziel > 800, 'Unterschied zwischen Ruhe- und Trainingstag zu klein');
});

test('Kalorienziel verschiebt den Bedarf in die richtige Richtung', () => {
  const halten = E.tagesbedarf(PROFIL, [], HEUTE);
  const aufbau = E.tagesbedarf({ ...PROFIL, kalorienziel: 'aufbauen' }, [], HEUTE);
  const defizit = E.tagesbedarf({ ...PROFIL, kalorienziel: 'abnehmen' }, [], HEUTE);
  assert.ok(aufbau.ziel > halten.ziel);
  assert.ok(defizit.ziel < halten.ziel);
  assert.equal(halten.ziel, halten.erhaltung);
});

test('Tagestyp folgt der geplanten Belastung', () => {
  assert.equal(E.tagestyp([]), 'ruhetag');
  assert.equal(E.tagestyp([{ typ: 'mobilitaet', minuten: 35 }]), 'leicht');
  assert.equal(E.tagestyp([{ typ: 'kraft', minuten: 60 }]), 'mittel');
  assert.equal(E.tagestyp([
    { typ: 'sprint', minuten: 60 }, { typ: 'kraft', minuten: 55 },
  ]), 'hart');
  assert.equal(E.tagestyp([{ typ: 'ausdauerIntervalle', minuten: 55 }]), 'hart');
  assert.equal(E.tagestyp([{ typ: 'ausdauerLang', minuten: 120 }]), 'langeAusdauer');
});

test('Makros: Protein, dann Kohlenhydrate nach Trainingslast, dann Fett', () => {
  // Dieser Test hieß einmal „Protein und Fett zuerst, Kohlenhydrate füllen
  // auf" – und beschrieb damit genau die Reihenfolge, die den Widerspruch
  // erzeugte: Die Kohlenhydrate waren der Rest und wurden anschließend gegen
  // einen Korridor gehalten, an den sie nie gebunden waren.
  const m = E.makros(PROFIL, 3000, 'hart');
  assert.equal(m.protein, 152); // 80 × 1,9 – unverändert

  // 3000 kcal reichen an einem harten Tag nicht für den Korridor: Selbst am
  // Fettminimum (80 × 0,8 = 64 g) bleiben nur 5,7 g/kg statt der geforderten
  // 6–7. Die Kohlenhydrate bekommen, was geht, und der Rest wird gesagt.
  assert.equal(m.fett, 64);
  assert.equal(m.kohlenhydrate, 454);
  assert.equal(m.kcal, 3000);
  assert.equal(m.protein * 4 + m.kohlenhydrate * 4 + m.fett * 9, 3000);
  assert.match(m.hinweise[0], /Korridor/);
});

test('Die Vorgabe liegt in ihrem eigenen Korridor', () => {
  // Der Fehler, der das ausgelöst hat: Bei drei von fünf Tagestypen lag die
  // berechnete Kohlenhydratmenge außerhalb des Korridors, den der Tracker
  // selbst nennt – am Ruhetag 4,6 g/kg bei einem Korridor von 3–4. Er warnte
  // also vor seiner eigenen Vorgabe.
  const profil = { ...PROFIL, gewichtKg: 78 };
  const tage = [
    [[], 'ruhetag'],
    [[{ typ: 'ausdauerLocker', minuten: 55 }], 'leicht'],
    [[{ typ: 'kraft', minuten: 65 }], 'mittel'],
    [[{ typ: 'sprint', minuten: 70 }, { typ: 'kraft', minuten: 65 }], 'hart'],
    [[{ typ: 'ausdauerLang', minuten: 95 }], 'langeAusdauer'],
  ];

  for (const [einheiten, erwarteterTyp] of tage) {
    const typ = E.tagestyp(einheiten);
    assert.equal(typ, erwarteterTyp);
    const bedarf = E.tagesbedarf(profil, einheiten);
    const m = E.makros(profil, bedarf.ziel, typ);

    assert.ok(m.khProKg >= m.korridor[0] && m.khProKg <= m.korridor[1],
      `${typ}: ${m.khProKg} g/kg liegt außerhalb von ${m.korridor.join('–')}`);
    // Und die Rechnung geht auf – bis auf Rundung auf ganze Gramm.
    const summe = m.protein * 4 + m.kohlenhydrate * 4 + m.fett * 9;
    assert.ok(Math.abs(summe - m.kcal) <= 5, `${typ}: ${summe} statt ${m.kcal} kcal`);
    // Das Fettminimum ist hart.
    assert.ok(m.fett >= Math.round(profil.gewichtKg * 0.8), `${typ}: nur ${m.fett} g Fett`);
  }
});

test('Im Defizit steigt der Proteinanteil', () => {
  const normal = E.makros(PROFIL, 2500, 'mittel');
  const defizit = E.makros({ ...PROFIL, kalorienziel: 'abnehmen' }, 2500, 'mittel');
  assert.ok(defizit.protein > normal.protein);
});

test('Zu wenig Kalorien für den Kohlenhydratkorridor wird gemeldet', () => {
  const knapp = E.makros(PROFIL, 1900, 'hart');
  assert.ok(knapp.hinweise.length > 0);
  assert.match(knapp.hinweise[0], /Korridor/);
});

test('Kohlenhydrate sind an harten Tagen höher gefordert als am Ruhetag', () => {
  const hart = E.makros(PROFIL, 3000, 'hart');
  const ruhe = E.makros(PROFIL, 3000, 'ruhetag');
  assert.ok(hart.korridor[0] > ruhe.korridor[0]);
});

test('Energieverfügbarkeit braucht den Körperfettanteil', () => {
  const ohne = E.energieverfuegbarkeit(PROFIL, 2500, 400);
  assert.equal(ohne.berechenbar, false);

  const mit = E.energieverfuegbarkeit({ ...PROFIL, koerperfettProzent: 12 }, 3000, 400);
  assert.equal(mit.berechenbar, true);
  // (3000 − 400) / 70,4 = 36,9
  assert.equal(mit.wert, 36.9);
  assert.equal(mit.stufe, 'knapp');
});

test('Kritisch niedrige Energieverfügbarkeit wird deutlich benannt', () => {
  const kritisch = E.energieverfuegbarkeit(
    { ...PROFIL, koerperfettProzent: 12 }, 2400, 600);
  assert.equal(kritisch.stufe, 'kritisch');
  assert.match(kritisch.text, /Mehr essen/);
});

test('Energieverfügbarkeit ignoriert den laufenden Tag', () => {
  // Regression: Ein halb protokollierter Vormittag ergab früher „kritisch" –
  // jeden Tag aufs Neue, bis die Warnung nichts mehr bedeutet hätte.
  const profil = { ...PROFIL, koerperfettProzent: 12 };
  const heute = new Date('2026-08-07');
  const essen = [];

  // Sieben gut versorgte Vortage.
  for (let i = 1; i <= 7; i += 1) {
    const d = new Date(heute);
    d.setDate(d.getDate() - i);
    essen.push({
      datum: d.toISOString().slice(0, 10),
      mengeG: 100, kcal: 3400, protein: 0, kohlenhydrate: 0, fett: 0,
    });
  }
  // Heute erst ein kleines Frühstück.
  essen.push({ datum: '2026-08-07', mengeG: 100, kcal: 400, protein: 0, kohlenhydrate: 0, fett: 0 });

  const ev = E.energieverfuegbarkeitSchnitt(profil, essen, [], heute);
  assert.equal(ev.berechenbar, true);
  assert.equal(ev.tage, 7);
  assert.equal(ev.stufe, 'gut', `Wert ${ev.wert} – der heutige Teiltag darf nicht durchschlagen`);
});

test('Energieverfügbarkeit zieht das Training ab', () => {
  const profil = { ...PROFIL, koerperfettProzent: 12 };
  const heute = new Date('2026-08-07');
  const essen = [];
  const sessions = [];
  for (let i = 1; i <= 5; i += 1) {
    const d = new Date(heute);
    d.setDate(d.getDate() - i);
    const datum = d.toISOString().slice(0, 10);
    essen.push({ datum, mengeG: 100, kcal: 2600, protein: 0, kohlenhydrate: 0, fett: 0 });
    sessions.push({ datum, typ: 'ausdauerIntervalle', minuten: 90 });
  }
  const ev = E.energieverfuegbarkeitSchnitt(profil, essen, sessions, heute);
  assert.equal(ev.berechenbar, true);
  assert.ok(ev.wert < 30, `Wert ${ev.wert} sollte nach Trainingsabzug kritisch sein`);
  assert.equal(ev.stufe, 'kritisch');
});

test('Zu wenige protokollierte Tage ergeben keine Bewertung', () => {
  const profil = { ...PROFIL, koerperfettProzent: 12 };
  const ev = E.energieverfuegbarkeitSchnitt(profil, [
    { datum: '2026-08-06', mengeG: 100, kcal: 3000, protein: 0, kohlenhydrate: 0, fett: 0 },
  ], [], new Date('2026-08-07'));
  assert.equal(ev.berechenbar, false);
  assert.match(ev.hinweis, /Wochenwert/);
});

test('Tagessumme rechnet Mengen korrekt auf 100 g um', () => {
  const summe = E.tagesSumme([
    { mengeG: 200, kcal: 100, protein: 10, kohlenhydrate: 5, fett: 2 },
    { mengeG: 50, kcal: 400, protein: 20, kohlenhydrate: 40, fett: 10 },
  ]);
  assert.equal(summe.kcal, 400);   // 200 + 200
  assert.equal(summe.protein, 30); // 20 + 10
  assert.equal(summe.ohneMenge, 0);
});

/*
 * Ein Eintrag ohne Menge kann nur aus einer eingespielten Sicherung stammen –
 * `essenAnlegen()` verlangt eine Menge, und die Importprüfung lässt so einen
 * Eintrag bewusst durch (Falle 27). Er trug nichts zur Summe bei und wurde
 * dabei **verschwiegen**: In der Tagesliste stand er, in der Zahl darüber
 * fehlte er (Falle 22).
 */
test('Ein Eintrag ohne Menge zählt nicht mit – und wird dabei genannt', () => {
  const summe = E.tagesSumme([
    { mengeG: 200, kcal: 100, protein: 10, kohlenhydrate: 5, fett: 2 },
    { kcal: 250, protein: 10, kohlenhydrate: 30, fett: 8 },       // ohne mengeG
    { mengeG: 0, kcal: 250 },                                      // 0 g ist keine Menge
    { mengeG: 'viel', kcal: 250 },                                 // unlesbar
  ]);
  assert.equal(summe.kcal, 200);
  assert.equal(summe.protein, 20);
  assert.equal(summe.ohneMenge, 3);
});

test('Bilanz meldet Rest und Prozent', () => {
  const b = E.bilanz(
    { kcal: 3000, protein: 150, kohlenhydrate: 400, fett: 80 },
    { kcal: 1500, protein: 75, kohlenhydrate: 200, fett: 40 });
  assert.equal(b.kcal.rest, 1500);
  assert.equal(b.protein.prozent, 50);
});

test('Mahlzeitenplan prüft die Portionsgröße gegen den Reizschwellenwert', () => {
  const genug = E.mahlzeitenplan(PROFIL, { protein: 152, kcal: 3000 });
  assert.equal(genug.ausreichend, true); // 38 g je Mahlzeit bei Ziel 32 g

  const zuwenig = E.mahlzeitenplan(PROFIL, { protein: 100, kcal: 2000 });
  assert.equal(zuwenig.ausreichend, false);
  assert.match(zuwenig.hinweis, /vollen Reiz/);
});

test('Versorgungshinweise passen sich der Dauer an', () => {
  const kurz = E.versorgungUmDieEinheit(PROFIL, 'sprint', 45);
  const lang = E.versorgungUmDieEinheit(PROFIL, 'ausdauerLang', 120);
  assert.ok(!kurz.some((h) => h.includes('pro Stunde')));
  assert.ok(lang.some((h) => h.includes('pro Stunde')));
});

/* ------------------------------------------------- Häufige Lebensmittel */

const BIS = new Date('2026-08-08');
const mahlzeit = (tageVor, name, mengeG = 100, kcal = 100) => {
  const d = new Date(BIS);
  d.setDate(d.getDate() - tageVor);
  return {
    datum: d.toISOString().slice(0, 10),
    name,
    mengeG,
    kcal,
    protein: 10,
    kohlenhydrate: 20,
    fett: 5,
  };
};

test('Häufig Gegessenes steht oben, nicht das Alphabet', () => {
  const essen = [
    ...Array.from({ length: 5 }, (_, i) => mahlzeit(i, 'Magerquark')),
    ...Array.from({ length: 2 }, (_, i) => mahlzeit(i, 'Banane')),
    mahlzeit(3, 'Aal'),
  ];
  const liste = E.haeufigeLebensmittel(essen, { bis: BIS });
  assert.deepEqual(liste.map((l) => l.name), ['Magerquark', 'Banane', 'Aal']);
  assert.equal(liste[0].anzahl, 5);
});

test('Was lange her ist, zählt nicht mehr', () => {
  // Was man im Frühjahr täglich gegessen hat und seit Monaten nicht mehr,
  // gehört nicht nach oben.
  const essen = [
    ...Array.from({ length: 20 }, (_, i) => mahlzeit(100 + i, 'Alte Gewohnheit')),
    mahlzeit(1, 'Aktuell'),
  ];
  const liste = E.haeufigeLebensmittel(essen, { bis: BIS });
  assert.deepEqual(liste.map((l) => l.name), ['Aktuell']);
});

test('Bei Gleichstand gewinnt das Zuletztgegessene', () => {
  const essen = [mahlzeit(20, 'Älter'), mahlzeit(2, 'Neuer')];
  const liste = E.haeufigeLebensmittel(essen, { bis: BIS });
  assert.deepEqual(liste.map((l) => l.name), ['Neuer', 'Älter']);
});

test('Die Nährwerte kommen als „je 100 g" zurück', () => {
  // Gespeichert wird die tatsächlich gegessene Menge; die Oberfläche rechnet
  // aber mit Hundertgrammwerten.
  const liste = E.haeufigeLebensmittel([mahlzeit(1, 'Reis', 250, 320)], { bis: BIS });
  assert.equal(liste[0].kcal, 128, '320 kcal auf 250 g sind 128 je 100 g');
  assert.equal(liste[0].protein, 4);
  assert.equal(liste[0].mengeG, 250, 'die gewohnte Menge bleibt als Vorschlag');
});

test('Der jüngste Eintrag bestimmt die Werte', () => {
  // Eine geänderte Packung soll sich durchsetzen, nicht die alte Angabe.
  const essen = [
    mahlzeit(30, 'Riegel', 100, 400),
    mahlzeit(1, 'Riegel', 100, 350),
  ];
  const liste = E.haeufigeLebensmittel(essen, { bis: BIS });
  assert.equal(liste[0].kcal, 350);
  assert.equal(liste[0].anzahl, 2);
});

test('Ohne Verlauf gibt es keine Vorschläge statt erfundener', () => {
  assert.deepEqual(E.haeufigeLebensmittel([], { bis: BIS }), []);
  assert.deepEqual(E.haeufigeLebensmittel(), []);
  // Einträge ohne Namen oder Datum fliegen raus, statt als „undefined" zu landen.
  assert.deepEqual(E.haeufigeLebensmittel([{ mengeG: 100 }, { name: 'X' }], { bis: BIS }), []);
});

test('Eine Menge von null erzeugt keine Division durch null', () => {
  const liste = E.haeufigeLebensmittel([mahlzeit(1, 'Kaputt', 0, 200)], { bis: BIS });
  assert.equal(liste[0].kcal, 0);
  assert.ok(Number.isFinite(liste[0].protein));
});

/* ------------------------------------------- Zahlen nur an einer Stelle */

test('Die Hinweise rund um die Einheit kommen aus wissen.js', () => {
  // Sie standen einmal im Kern und einmal in der Oberfläche – und waren schon
  // auseinandergelaufen. Wer sie ändert, soll das an einer Stelle tun.
  const u = W.ERNAEHRUNG.umDieEinheit;
  const lang = E.versorgungUmDieEinheit({ gewichtKg: 80 }, 'ausdauerLang', 120);
  assert.ok(lang.some((h) => h.includes(`${u.khAbMinuten} min`)));
  assert.ok(lang.some((h) => h.includes(`${u.khProStunde[0]}–${u.khProStunde[1]} g`)));
  assert.ok(lang.some((h) => h.includes(`${u.natriumProLiterMg} mg`)));
  assert.ok(lang.some((h) => h.includes(`${Math.round(80 * u.proteinNachherProKg)} g Protein`)));
});

test('Kurze Einheiten bekommen keine Verpflegungshinweise', () => {
  const kurz = E.versorgungUmDieEinheit({ gewichtKg: 80 }, 'kraft', 45);
  assert.ok(!kurz.some((h) => /pro Stunde/.test(h)), 'unter 90 min kein Kohlenhydrat-Hinweis');
  assert.ok(!kurz.some((h) => /Trinken/.test(h)), 'unter 60 min kein Trink-Hinweis');
  assert.ok(kurz.some((h) => /vorher/.test(h)), 'vor einer harten Einheit schon');
});

test('Ohne Körpergewicht wird keine Proteinmenge erfunden', () => {
  const ohne = E.versorgungUmDieEinheit({}, 'kraft', 60);
  assert.ok(!ohne.some((h) => /g Protein/.test(h)));
});

test('Die Grenzen der Gewichtsentwicklung haben eine Quelle', () => {
  const g = W.ERNAEHRUNG.gewichtProWoche;
  assert.ok(g.aufbauMax > 0 && g.aufbauMax < 2);
  assert.ok(g.abnahmeMax > g.aufbauMax, 'abnehmen darf schneller gehen als aufbauen');
  assert.ok(W.QUELLEN[g.quelle], `Quelle ${g.quelle} fehlt in QUELLEN`);
});

/* ------------------------------- Energieverfügbarkeit gegen den Eigenbedarf */

const athlet = (ueberschreiben = {}) => ({
  geburtsjahr: 1996, geschlecht: 'm', groesseCm: 183, gewichtKg: 78.3,
  koerperfettProzent: 12, alltagsaktivitaet: 'mittel', kalorienziel: 'halten',
  ...ueberschreiben,
});

test('Wer nach Vorgabe isst, bekommt keine Mangelmeldung', () => {
  // Bei „Gewicht halten" kürzen sich die Trainingskalorien aus der
  // Energieverfügbarkeit heraus – übrig bleibt Alltagsfaktor × Grundumsatz /
  // FFM. Mit Cunningham sind das bei Nils 39,5 kcal/kg, die Zielmarke steht
  // bei 45. Vorher stand darunter „auf Dauer zu wenig. Mehr essen, nicht mehr
  // trainieren" – als orange Warnung, jeden Tag, unter einem Kalorienziel aus
  // demselben Tracker.
  const p = athlet();
  const bedarf = E.tagesbedarf(p, [], new Date('2026-08-10'));
  const ev = E.energieverfuegbarkeit(p, bedarf.ziel, 0);

  assert.equal(ev.stufe, 'erhaltung');
  assert.equal(ev.wert, ev.erhaltung, 'genau der eigene Erhaltungsbedarf');
  assert.doesNotMatch(ev.text, /auf Dauer zu wenig/, 'kein Mangel, wo keiner ist');
  assert.doesNotMatch(ev.text, /Mehr essen/, 'kein Rat gegen die eigene Vorgabe');
  assert.match(ev.text, /39,5/, 'deutsche Schreibweise mit Komma');
});

test('Die Zielmarke ist ab einer gewissen fettfreien Masse unerreichbar', () => {
  // Nicht „selten", sondern rechnerisch: EV bei Erhaltung ist
  // Alltagsfaktor × (500 / FFM + 22). Selbst beim höchsten Faktor reicht das
  // nur bis rund 62,5 kg fettfreier Masse für die 45 – dieselbe Familie wie
  // die Monotonie-Schwelle aus Falle 18.
  const g = W.ERNAEHRUNG.energieverfuegbarkeit;
  for (const kfa of [8, 12, 15]) {
    const p = athlet({ koerperfettProzent: kfa, alltagsaktivitaet: 'hoch' });
    const bedarf = E.tagesbedarf(p, [], new Date('2026-08-10'));
    const ev = E.energieverfuegbarkeit(p, bedarf.ziel, 0);
    assert.ok(ev.wert < g.ziel,
      `${kfa} % KFA: ${ev.wert} – wenn die Marke erreichbar wird, ist die Begründung `
      + 'in wissen.js zu prüfen');
    assert.notEqual(ev.stufe, 'knapp', `${kfa} % KFA: Erhaltung darf nicht als Mangel gelten`);
  }
});

test('Ein echtes Defizit wird weiterhin gemeldet', () => {
  // Die Gegenprobe: Die Entschärfung darf das Signal nicht abwürgen. Ein
  // Melder, der nie meldet, besteht jeden Test.
  const p = athlet();
  const bedarf = E.tagesbedarf(p, [], new Date('2026-08-10'));

  const knapp = E.energieverfuegbarkeit(p, bedarf.ziel - 500, 0);
  assert.equal(knapp.stufe, 'knapp');
  assert.match(knapp.text, /Erhaltungsbedarf/, 'nennt, wogegen verglichen wird');

  const kritisch = E.energieverfuegbarkeit(p, bedarf.ziel - 1200, 0);
  assert.equal(kritisch.stufe, 'kritisch');
  assert.match(kritisch.text, /Mehr essen, nicht mehr trainieren/);
});

test('Die kritische Grenze bleibt absolut', () => {
  // Auch wer seinen Erhaltungsbedarf deckt, bekommt unter 30 kcal/kg FFM die
  // harte Meldung – dort geht es nicht mehr um Rechenmodelle. Konstruiert über
  // einen sehr niedrigen Alltagsfaktor, damit Erhaltung und Grenze kollidieren.
  const p = athlet({ alltagsaktivitaet: 'sitzend' });
  const ev = E.energieverfuegbarkeit(p, 25 * fettfreieMasse(p), 0);
  assert.equal(ev.stufe, 'kritisch');
});

test('Makros melden das Fett, das sie wirklich vorgeben', () => {
  // `fettProKg` gab stur ERNAEHRUNG.fett.ziel zurück – 1,0 –, während im
  // selben Objekt 174 g standen, also 2,2 g/kg. Überbleibsel aus der Zeit, als
  // das Fett vorgegeben war und die Kohlenhydrate der Rest (Falle 16).
  const p = athlet();
  for (const typ of ['ruhetag', 'leicht', 'mittel', 'hart']) {
    const m = E.makros(p, 4353, typ);
    assert.equal(m.fettProKg, Math.round((m.fett / p.gewichtKg) * 100) / 100,
      `${typ}: fettProKg passt nicht zu fett`);
  }
  assert.equal(E.makros(p, 4353, 'hart').fettZielProKg, W.ERNAEHRUNG.fett.ziel);
});

test('Der Fett-Überschuss ist kein Hinweis mehr', () => {
  // Seit der Korridor die Kohlenhydrate bindet, liegt das Fett fast immer über
  // dem Zielwert – über zwölf Wochen Plan an 84 von 84 Tagen. Die Oberfläche
  // malt jeden Hinweis als orange Warnung; eine Warnung, die immer dasteht,
  // trainiert einen darauf, auch die daneben zu übersehen.
  const p = athlet();
  const m = E.makros(p, 4353, 'hart');
  assert.ok(m.fettProKg > m.fettZielProKg, 'Testfall trifft den Regelfall');
  assert.deepEqual(m.hinweise, [], 'der Regelfall braucht keine Warnung');

  // Der echte Engpass bleibt einer: zu wenig Energie für den Korridor.
  const eng = E.makros(p, 1800, 'hart');
  assert.ok(eng.hinweise.some((h) => /Korridor/.test(h)), 'Unterdeckung wird gemeldet');
});

test('Der Zielwert für Protein steht im Verhältnis zum Plateau', () => {
  // `protein.minimum` (1,6) und `protein.obergrenze` (2,5) hatten beide keinen
  // Leser. Die 1,6 sind der Plateaupunkt aus Morton 2018 und damit die
  // Begründung für den Zielwert – ohne sie sind 1,9 g/kg eine Hausnummer.
  // Die 2,5 lagen **oberhalb des Konfidenzintervalls der eigenen Quelle**
  // (1,03–2,20) und sind weg.
  const m = E.makros(PROFIL, 3000, 'mittel');
  assert.equal(m.proteinPlateau, W.ERNAEHRUNG.protein.plateau);
  assert.ok(m.proteinProKg > m.proteinPlateau,
    'Der Zielwert soll über dem Plateau liegen, sonst braucht er keine Begründung');

  // Beide belegten Werte bleiben im Intervall der Quelle. Wer sie anhebt,
  // verlässt die Studienlage – und das soll auffallen.
  const [unten, oben] = W.ERNAEHRUNG.protein.vertrauensbereich;
  for (const wert of [W.ERNAEHRUNG.protein.ziel, W.ERNAEHRUNG.protein.imDefizit]) {
    assert.ok(wert >= unten && wert <= oben,
      `${wert} g/kg liegt außerhalb des Konfidenzintervalls von Morton 2018`);
  }
  assert.equal(W.ERNAEHRUNG.protein.obergrenze, undefined,
    'Eine Marke oberhalb der belegten Spanne ist wieder da');
});

test('Wenn Fett die Kohlenhydrate überholt, sagt der Tracker es – und sonst nicht', () => {
  /*
   * Das Fett gleicht aus, was der gedeckelte Kohlenhydratkorridor offen lässt,
   * und zwar ohne Obergrenze. Bei hohem Kalorienziel und wenig Training kippt
   * das Verhältnis: mehr Energie aus Fett als aus Kohlenhydraten, an einem
   * Trainingstag. Über zwölf Wochen Plan und alle Profile passiert das an
   * 3,2 % der Tage – selten genug, dass die Aussage etwas bedeutet.
   *
   * Beide Richtungen, weil eine allein wertlos wäre: Ein Melder, der nie
   * meldet, besteht jeden „warnt nicht grundlos"-Test (Falle 18) – und einer,
   * der immer meldet, ist keine Meldung mehr (Falle 24).
   */
  const kippt = (m) => m.fettAnteilEnergie > m.khAnteilEnergie;

  // Nils an seinem härtesten Tag: Der Satz darf nicht dastehen.
  const nils = { ...PROFIL, gewichtKg: 78.3, groesseCm: 180 };
  for (const [typ, kcal] of [['hart', 3795], ['mittel', 3120], ['leicht', 2862],
    ['ruhetag', 2373]]) {
    assert.ok(!kippt(E.makros(nils, kcal, typ)),
      `${typ}: Der Satz erscheint bei Nils' eigenen Vorgaben`);
  }

  // Und der Fall, den es wirklich gibt: viel Energie, wenig Trainingslast.
  const leicht = { ...PROFIL, gewichtKg: 55, groesseCm: 165 };
  const gekippt = E.makros(leicht, 2629, 'leicht');
  assert.ok(kippt(gekippt), 'Der Fall lässt sich gar nicht auslösen');
  assert.ok(gekippt.fettAnteilEnergie > 0.4);

  // Die Anteile beschreiben denselben Tag, den die Gramm beschreiben.
  for (const m of [gekippt, E.makros(nils, 3795, 'hart')]) {
    const summe = m.fettAnteilEnergie + m.khAnteilEnergie + (m.protein * 4) / m.kcal;
    assert.ok(Math.abs(summe - 1) < 0.01, `Die Energieanteile ergeben ${summe} statt 1`);
  }
});

test('Ohne Körperfettangabe gibt es keine fettfreie Masse', () => {
  /*
   * `fettfreieMasse()` prüfte mit `if (!kfa && kfa !== 0) return null;` –
   * gedacht als „ohne Angabe nichts, aber die Null ist ein gültiger Wert".
   * Die Null ist kein gültiger Wert, und `Number(null)` **ist** 0, genau wie
   * `Number('')`. Die Prüfung liess damit ausgerechnet die beiden Fälle
   * durch, die sie abfangen sollte: `createProfil()` legt das Feld als `null`
   * an, `profilSpeichern()` normalisiert ein leeres Formularfeld ebenfalls
   * auf `null`.
   *
   * Ergebnis war `FFM = Körpergewicht` für jeden, der seinen
   * Körperfettanteil nie eingetragen hat – der Normalfall. Der Grundumsatz
   * lief dann über Cunningham und lag bei 78,3 kg um 441 kcal zu hoch; mit
   * dem Alltagsfaktor sind das rund 600 kcal am Tag, und jedes Makroziel
   * hängt daran. Kein einziger Test hat das bemerkt.
   */
  const basis = { ...createProfil(), gewichtKg: 78.3, groesseCm: 183, geburtsjahr: 1996 };

  for (const ohne of [null, '', undefined]) {
    const p = { ...basis, koerperfettProzent: ohne };
    assert.equal(fettfreieMasse(p), null,
      `${JSON.stringify(ohne)} bedeutet „nicht angegeben" und nicht „0 %"`);
    assert.equal(E.grundumsatz(p).formel, W.GRUNDUMSATZ.mifflin.name,
      'Ohne fettfreie Masse muss Mifflin-St Jeor rechnen');
  }

  // Mit Angabe bleibt alles beim Alten.
  const mit = { ...basis, koerperfettProzent: 12 };
  assert.equal(fettfreieMasse(mit), 68.9);
  assert.equal(E.grundumsatz(mit).formel, W.GRUNDUMSATZ.cunningham.name);

  // Und der Definitionsbereich: Bei 0 % wäre die fettfreie Masse das ganze
  // Gewicht, bei 100 % null. Beides ist keine Angabe, sondern ein Fehler.
  for (const unmoeglich of [0, -5, 100, 140]) {
    assert.equal(fettfreieMasse({ ...basis, koerperfettProzent: unmoeglich }), null,
      `${unmoeglich} % ist kein Körperfettanteil`);
  }

  // Die Energieverfügbarkeit fällt ohne fettfreie Masse aus – und sagt warum.
  const ev = E.energieverfuegbarkeit(basis, 3000, 600);
  assert.equal(ev.berechenbar, false);
  assert.match(ev.hinweis, /Körperfettanteil/);
});

/*
 * Die Kohlenhydrate folgen der Energie, sie liegen nicht auf dem Korridorboden.
 *
 * `Math.max(0, …)` vor der Korridorklammer sah nach reiner Vorsicht aus, und
 * ich hatte hergeleitet, die Klammer darunter hole ohnehin alles zurück. Über
 * 270 durchgerechnete Kombinationen unterscheiden sich **140**: Die
 * Untergrenze holt nur den *Boden* zurück, nicht den gerechneten Wert. Wer
 * die Stelle verfälscht, bekommt an jedem Tag die Mindestmenge des Korridors
 * – und kein Test hat es gemerkt.
 *
 * Zum dritten Mal in dieser Runde schlägt Messen das Herleiten (Falle 44).
 */
test('Kohlenhydrate folgen der Energie, statt auf dem Korridorboden zu liegen', () => {
  const profil = {
    ...createProfil(), gewichtKg: 78.3, groesseCm: 181,
    geburtsjahr: 1995, koerperfettProzent: 12,
  };
  const knapp = E.makros(profil, 2200, 'mittel');
  const reichlich = E.makros(profil, 3600, 'mittel');

  assert.ok(reichlich.kohlenhydrate > knapp.kohlenhydrate,
    'Mehr Energie heißt mehr Kohlenhydrate, solange der Korridor Luft lässt');
  // Und der Boden ist wirklich ein Boden, keine Vorgabe: Bei reichlich
  // Energie liegt der Wert oben im Korridor, nicht unten.
  assert.ok(reichlich.khProKg > knapp.khProKg, 'Der Wert je Kilogramm zieht mit');
  assert.equal(reichlich.khProKg, reichlich.korridor[1],
    'Bei reichlich Energie steht der Korridor am oberen Ende');
});

test('Das Fenster der häufigen Lebensmittel schließt auf dem Randtag ein', () => {
  // `new Date(e.datum) < grenze` – der Tag *auf* der Grenze zählt noch mit.
  // Nur dieser eine Tag unterscheidet `<` von `<=`; alles davor und danach
  // verhält sich gleich (die Lehre aus Falle 44: Ein Randtest, der den Rand
  // nicht trifft, ist grün und wertlos).
  const eintrag = (datum) => ({
    name: 'Skyr', datum, mengeG: 100, kcal: 63, protein: 11, kohlenhydrate: 4, fett: 0.2,
  });
  const opt = { bis: new Date('2026-08-11'), tage: 60 };

  // 60 Tage vor dem 11.08.2026 ist der 12.06.2026 – genau die Grenze.
  assert.equal(E.haeufigeLebensmittel([eintrag('2026-06-12')], opt).length, 1,
    'Der Randtag zählt noch mit');
  assert.equal(E.haeufigeLebensmittel([eintrag('2026-06-11')], opt).length, 0,
    'Einen Tag davor nicht mehr');
});

test('Bei zwei Einträgen am selben Tag gewinnen die Nährwerte des späteren', () => {
  /*
   * `e.datum >= bisher.zuletzt` – am *gleichen* Tag setzt sich der zuletzt
   * gelesene Eintrag durch. Der Kommentar daneben sagt, warum: „eine
   * geänderte Packung soll sich durchsetzen, nicht die Angabe von vor zwei
   * Monaten". Mit `>` bliebe am selben Tag die erste Angabe stehen, und die
   * neue Packung käme erst am Folgetag durch.
   */
  const treffer = E.haeufigeLebensmittel([
    { name: 'Müsli', datum: '2026-08-10', mengeG: 100, kcal: 350, protein: 10, kohlenhydrate: 60, fett: 6 },
    { name: 'Müsli', datum: '2026-08-10', mengeG: 100, kcal: 420, protein: 12, kohlenhydrate: 62, fett: 12 },
  ], { bis: new Date('2026-08-11') });

  assert.equal(treffer.length, 1);
  assert.equal(treffer[0].anzahl, 2);
  assert.equal(treffer[0].kcal, 420, 'Die zuletzt eingetragene Packung gilt');
});

test('Gleich häufig und gleich frisch heißt alphabetisch', () => {
  // Der Vergleich gab bei gleichem Datum -1 zurück statt 0 und drehte
  // gleichrangige Einträge um – die Reihenfolge im Suchdialog hing damit an
  // der Einfügereihenfolge. Jetzt entscheidet der Name, und das ist eine
  // Aussage, die man prüfen kann.
  const e = (name) => ({
    name, datum: '2026-08-10', mengeG: 100, kcal: 100, protein: 5, kohlenhydrate: 10, fett: 2,
  });
  const treffer = E.haeufigeLebensmittel([e('Banane'), e('Apfel'), e('Clementine')],
    { bis: new Date('2026-08-11') });
  assert.deepEqual(treffer.map((t) => t.name), ['Apfel', 'Banane', 'Clementine']);
});

/* ----------------------------------------------------- Gewichtsverlauf */

test('Ein Gewicht, das nur zappelt, ergibt keine Rate', () => {
  /*
   * Der Fehler, für den es diese Funktion gibt: Die Oberfläche bildete die
   * Rate aus dem ersten und dem letzten Punkt. Über zwölf Wochen mit
   * unverändertem Gewicht – aber täglichem Schwanken um ein Kilo – stand
   * damit „Aufbau schneller als ~0,5 % pro Woche, Kalorien zurücknehmen".
   * Genau die Methode, die Falle 7 für die Verlaufskurven verworfen hat.
   */
  const tag = (i) => new Date(Date.UTC(2026, 4, 1) + i * 86400000).toISOString().slice(0, 10);
  // Zehn Wiegungen über knapp vier Wochen, Gewicht unverändert bei 78 kg,
  // täglich ±1,4 kg – ein realistisches Bild für jemanden, der nicht immer
  // zur selben Zeit auf die Waage steigt.
  const flach = Array.from({ length: 10 },
    (_, i) => ({ datum: tag(i * 3), kg: 78 + (i % 2 ? 1.4 : -1.4) }));

  const t = E.gewichtsTrend(flach);
  assert.equal(t.beurteilbar, false);
  assert.match(t.grund, /noch kein Trend/);

  // Gegenprobe: Dieselben Daten, erster gegen letzter Punkt – so kam die alte
  // Rechnung auf eine Rate, und zwar auf eine, die eine Warnung auslöst.
  const alt = (flach[flach.length - 1].kg - flach[0].kg)
    / ((new Date(flach[flach.length - 1].datum) - new Date(flach[0].datum)) / (7 * 86400000));
  assert.ok(Math.abs(alt / flach[flach.length - 1].kg) * 100 > W.ERNAEHRUNG.gewichtProWoche.aufbauMax,
    'ohne diesen Unterschied prüft der Test nichts');
});

test('Ein echter Trend wird erkannt und eingeordnet', () => {
  const tag = (i) => new Date(Date.UTC(2026, 4, 1) + i * 86400000).toISOString().slice(0, 10);
  const mitRauschen = (steigung) => Array.from({ length: 14 },
    (_, i) => ({ datum: tag(i * 6), kg: 80 + i * steigung + (i % 2 ? 0.6 : -0.6) }));

  const auf = E.gewichtsTrend(mitRauschen(0.51));
  assert.equal(auf.beurteilbar, true);
  assert.ok(auf.proWoche > 0.5, `nur ${auf.proWoche} kg/Woche`);
  assert.equal(auf.bewertung, 'aufbauZuSchnell');

  const ab = E.gewichtsTrend(mitRauschen(-0.75));
  assert.equal(ab.bewertung, 'abnahmeZuSchnell');

  // Und die Mitte: langsamer Aufbau bleibt im Rahmen und löst nichts aus.
  const langsam = E.gewichtsTrend(mitRauschen(0.15));
  assert.equal(langsam.beurteilbar, true);
  assert.equal(langsam.bewertung, 'imRahmen');
});

test('Ein Trend braucht Punkte und Zeit – und sagt, woran es fehlt', () => {
  const tag = (i) => new Date(Date.UTC(2026, 4, 1) + i * 86400000).toISOString().slice(0, 10);

  assert.match(E.gewichtsTrend([{ datum: tag(0), kg: 78 }, { datum: tag(20), kg: 80 }]).grund,
    /drei Wiegungen/);

  // Drei Punkte, aber alle in derselben Woche: Die Spanne zwischen den
  // Mittelpunkten der Drittel ist zu kurz für eine Rate.
  const eng = [0, 2, 4, 6].map((i) => ({ datum: tag(i), kg: 78 + i * 0.4 }));
  const t = E.gewichtsTrend(eng);
  assert.equal(t.beurteilbar, false);
  assert.match(t.grund, /Wochen Abstand/);
  // Deutsche Zahl, kein Dezimalpunkt (Falle 56).
  assert.doesNotMatch(t.grund, /\d\.\d/);
});

test('Ein Tag trägt eine Wiegung – der jüngste Eintrag gewinnt', () => {
  // Eine eingespielte Sicherung darf Doppelte enthalten; die Kurve zeichnete
  // daraus zwei Punkte auf denselben Tag, eine senkrechte Kante, die wie eine
  // Messung aussieht (Falle 65, dort beim Ruhepuls).
  const roh = [
    { datum: '2026-05-03', kg: 78.0 },
    { datum: '2026-05-01', kg: 77.0 },
    { datum: '2026-05-03', kg: 79.5 },
    { datum: '2026-05-02', kg: 0 },
    { datum: '', kg: 80 },
    { kg: 81 },
  ];
  const raus = E.eineWiegungProTag(roh);
  assert.deepEqual(raus, [
    { datum: '2026-05-01', kg: 77 },
    { datum: '2026-05-03', kg: 79.5 },
  ]);
});

test('Die Ränder des Gewichtstrends liegen dort, wo sie behauptet werden', () => {
  const tag = (i) => new Date(Date.UTC(2026, 4, 1) + i * 86400000).toISOString().slice(0, 10);

  // Genau drei Wiegungen reichen – „mindestens drei" heißt einschließlich.
  const drei = [0, 14, 28].map((i) => ({ datum: tag(i), kg: 78 + i * 0.1 }));
  assert.equal(E.gewichtsTrend(drei).beurteilbar, true, 'drei Wiegungen müssen reichen');

  // Genau zwei Wochen zwischen den Mittelpunkten reichen ebenfalls.
  const zwei = [0, 7, 14].map((i) => ({ datum: tag(i), kg: 78 + i * 0.1 }));
  const t = E.gewichtsTrend(zwei, { mindestWochen: 2 });
  assert.equal(t.beurteilbar, true, `genau zwei Wochen: ${t.grund}`);
  assert.equal(E.gewichtsTrend(zwei, { mindestWochen: 2.1 }).beurteilbar, false);

  /*
   * Gleichstand: Ist der Unterschied zwischen den Dritteln genauso groß wie
   * das Zappeln, ist das **kein** Trend. Die Reihe 78 / 79 / 78 / 79 trifft
   * das exakt – Drittel ist eins, Unterschied 1 kg, mittlerer
   * Punkt-zu-Punkt-Abstand ebenfalls 1 kg.
   */
  const gleich = [0, 10, 20, 30].map((i, k) => ({ datum: tag(i), kg: k % 2 ? 79 : 78 }));
  const g = E.gewichtsTrend(gleich);
  assert.equal(g.unterschied, 1);
  assert.equal(g.zappeln, 1);
  assert.equal(g.beurteilbar, false, 'bei Gleichstand darf keine Rate behauptet werden');

  /*
   * Und das Drittel muss wirklich ein Drittel sein: Mit nur je einem Punkt an
   * den Enden wäre die Funktion genau die alte, verworfene Rechnung. Neun
   * Wiegungen, echter Aufbau, aber ein Ausreißer ganz am Anfang – über ein
   * Drittel gemittelt fällt er kaum ins Gewicht, als einzelner Anfangspunkt
   * bestimmt er die ganze Rate.
   */
  const mitAusreisser = [77.0, 80.2, 80.4, 80.6, 80.9, 81.1, 81.3, 81.6, 81.8]
    .map((kg, i) => ({ datum: tag(i * 5), kg }));
  const ueberDrittel = E.gewichtsTrend(mitAusreisser);
  const nurEnden = (mitAusreisser[8].kg - mitAusreisser[0].kg) / (40 / 7);
  assert.ok(ueberDrittel.beurteilbar);
  assert.ok(ueberDrittel.proWoche < nurEnden * 0.7,
    `über Drittel ${ueberDrittel.proWoche}, über die Enden ${nurEnden.toFixed(2)} – `
    + 'der Ausreißer schlägt noch voll durch');
});
