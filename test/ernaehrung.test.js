import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../kern/ernaehrung.js';
import * as W from '../kern/wissen.js';

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
