// Gerichtevorschläge.
//
// Der Katalog ist die erste Datei dieses Projekts, in der ein Gericht steht
// statt einer Zahl – und genau deshalb ist die tragende Prüfung hier keine
// Rechenprüfung, sondern eine Kupplungsprüfung: Jede Zutat muss es in der
// Nährwerttabelle wirklich geben. Ein Tippfehler in einem Zutatennamen wäre
// sonst ein Gericht, das leiser ist, als es ist.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  zutatenMitMenge, naehrwerteAus, portion, proteinAnteil,
  portionsFaktor, gerichtVorschlaege, tagesvorschlag, TAGESPLAN_MAHLZEITEN,
} from '../kern/gerichte.js';
import { GERICHTE, ERNAEHRUNG } from '../kern/wissen.js';

const lies = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8');
const KATALOG = JSON.parse(lies('kern/gerichte.json'));
const TABELLE = JSON.parse(lies('kern/lebensmittel.json')).lebensmittel;

/* ------------------------------------------------- Der Katalog als Datei */

test('Jede Zutat jedes Gerichts steht in der Nährwerttabelle', () => {
  // Die Prüfung, um die es hier eigentlich geht. Ein unbekannter Name macht
  // das Gericht nicht kaputt – `naehrwerteAus()` lässt ihn weg –, sondern
  // leichter, und das fällt erst an einer krummen Tagesbilanz auf.
  const namen = new Set(TABELLE.map((l) => l.name));
  const fehlend = [];
  for (const g of KATALOG.gerichte) {
    for (const [name] of g.zutaten) if (!namen.has(name)) fehlend.push(`${g.name}: ${name}`);
  }
  assert.deepEqual(fehlend, [], `Zutaten ohne Eintrag in der Tabelle: ${fehlend.join(' · ')}`);
});

test('Kein Gericht bringt eigene Nährwerte mit', () => {
  // Der Wächter gegen die zweite Nährwertquelle (Falle 21, Falle 60). Sobald
  // ein Gericht `kcal` oder `protein` selbst führt, gibt es im Projekt zwei
  // Zahlen für dasselbe – und die zweite läuft auseinander.
  for (const g of KATALOG.gerichte) {
    for (const feld of ['kcal', 'protein', 'kohlenhydrate', 'fett']) {
      assert.equal(g[feld], undefined,
        `„${g.name}" führt ${feld} selbst – gerechnet wird aus den Zutaten`);
    }
  }
});

test('Jedes Gericht ist vollständig beschrieben', () => {
  const namen = new Set();
  for (const g of KATALOG.gerichte) {
    assert.ok(g.name, 'Gericht ohne Name');
    assert.ok(!namen.has(g.name), `„${g.name}" steht zweimal im Katalog`);
    namen.add(g.name);
    assert.ok(g.zubereitung && g.zubereitung.length > 20, `${g.name}: keine brauchbare Zubereitung`);
    assert.ok(g.minuten > 0, `${g.name}: keine Zeitangabe`);
    assert.equal(typeof g.haeltSich, 'boolean', `${g.name}: sagt nicht, ob es sich hält`);
    assert.ok(g.zutaten?.length >= 1, `${g.name}: keine Zutaten`);
    for (const [name, gramm] of g.zutaten) {
      assert.ok(name, `${g.name}: Zutat ohne Namen`);
      assert.ok(gramm > 0, `${g.name}: „${name}" ohne Menge`);
    }
  }
});

test('Die Kennzeichnung „vegetarisch" ist aus den Zutaten hergeleitet, nicht behauptet', () => {
  /*
   * Ein falsches Etikett ist hier schlimmer als gar keins: Wer nach
   * „vegetarisch" filtert, prüft die Zutatenliste nicht mehr nach.
   *
   * Geprüft wird gegen die **Gruppen der Nährwerttabelle**, nicht gegen eine
   * getippte Liste von Zutatennamen – eine solche Liste wäre wieder ein
   * Melder, der nur meldet, was er kennt (Falle 41). Die vier tierischen
   * Erzeugnisse außerhalb der beiden offensichtlichen Gruppen (Honig, Butter,
   * die beiden Proteinpulver) tragen dafür ein `tierisch` an sich selbst.
   */
  const gruppe = new Map(TABELLE.map((l) => [l.name, l.gruppe]));
  const tierisch = new Set(TABELLE.filter((l) => l.tierisch).map((l) => l.name));
  assert.ok(tierisch.size >= 3, 'ohne Kennzeichen am Lebensmittel prüft dieser Test nichts');

  const ARTEN = new Set(['fleisch', 'fisch', 'vegetarisch', 'vegan']);
  for (const g of KATALOG.gerichte) {
    assert.ok(ARTEN.has(g.art), `${g.name}: „${g.art}" ist keine bekannte Art`);
    const gruppen = new Set(g.zutaten.map(([n]) => gruppe.get(n)));
    const ausTier = g.zutaten.some(([n]) => tierisch.has(n));
    const fleischlos = !gruppen.has('Fleisch & Fisch');

    if (g.art === 'vegetarisch' || g.art === 'vegan') {
      assert.ok(fleischlos, `${g.name}: „${g.art}" mit Fleisch oder Fisch darin`);
    }
    if (g.art === 'vegan') {
      assert.ok(!gruppen.has('Eier & Milchprodukte') && !ausTier,
        `${g.name}: „vegan" mit tierischem Erzeugnis darin`);
    }
    // Die Gegenrichtung, sonst könnte alles „fleisch" heißen und bestünde.
    if (g.art === 'fleisch' || g.art === 'fisch') {
      assert.ok(!fleischlos, `${g.name}: „${g.art}" ohne Fleisch oder Fisch`);
    }
  }
});

test('Zu jeder Kennzeichnung gibt es genug Gerichte, dass ein Filter etwas übrig lässt', () => {
  // Ein Filter, der in eine leere Liste führt, ist ein Bedienweg ohne Ziel.
  // Fleischlos ist die Auswahl, die jemand tatsächlich trifft – und sie muss
  // in **jeder** Mahlzeit tragen, nicht nur in der Summe.
  const mahlzeiten = new Set(KATALOG.gerichte.map((g) => g.mahlzeit));
  for (const m of mahlzeiten) {
    const fleischlos = KATALOG.gerichte
      .filter((g) => g.mahlzeit === m && (g.art === 'vegetarisch' || g.art === 'vegan'));
    assert.ok(fleischlos.length >= 2,
      `${m}: nur ${fleischlos.length} fleischlose Gerichte – zu wenig für eine Auswahl`);
  }
  for (const art of ['fleisch', 'fisch', 'vegetarisch', 'vegan']) {
    const wieviele = KATALOG.gerichte.filter((g) => g.art === art).length;
    assert.ok(wieviele >= 3, `nur ${wieviele} Gerichte der Art „${art}"`);
  }
});

test('Jede Mahlzeit deckt eine Spanne von Proteindichten ab', () => {
  /*
   * Sortiert wird nach der Proteindichte. Läge in einer Mahlzeit alles eng
   * beieinander, wäre die Rangfolge eine Behauptung ohne Wirkung: Es käme
   * immer dasselbe zuerst, egal wie der Tag aussieht. Geprüft wird deshalb
   * nicht die Zahl der Gerichte, sondern ob sie sich **unterscheiden**.
   */
  const je = new Map();
  for (const g of KATALOG.gerichte) {
    const d = proteinAnteil(portion(g, TABELLE, 1));
    if (!je.has(g.mahlzeit)) je.set(g.mahlzeit, []);
    je.get(g.mahlzeit).push(d);
  }
  for (const [m, dichten] of je) {
    const spanne = Math.max(...dichten) - Math.min(...dichten);
    assert.ok(spanne >= 0.15,
      `${m}: alle Gerichte liegen zwischen ${Math.round(Math.min(...dichten) * 100)} % und `
      + `${Math.round(Math.max(...dichten) * 100)} % Protein – da hat die Auswahl nichts zu wählen`);
  }
});

test('Jede Mahlzeit der Oberfläche hat mindestens ein Gericht', () => {
  /*
   * Das Auswahlfeld in `app/essen.js` bietet fünf Mahlzeiten an. Gäbe es zu
   * einer davon kein Gericht, liefe man in eine leere Liste – ein Bedienweg
   * ohne Ziel, dieselbe Familie wie das Schutzziel, das sich über die
   * Oberfläche nicht erfüllen ließ.
   *
   * Und die Gegenrichtung: Ein Gericht mit einer Mahlzeit, die es im
   * Auswahlfeld gar nicht gibt, wäre über die Oberfläche nie zu sehen –
   * der interne Schlüssel ohne Entsprechung aus Falle 50.
   */
  const angeboten = [...lies('app/essen.js').matchAll(/\['(\w+)', '[^']+'\],/g)]
    .map((m) => m[1]);
  assert.ok(angeboten.length >= 5, `Mahlzeitenliste nicht gefunden: ${angeboten}`);

  const imKatalog = new Set(KATALOG.gerichte.map((g) => g.mahlzeit));
  for (const m of angeboten) {
    assert.ok(imKatalog.has(m), `Für „${m}" gibt es kein einziges Gericht`);
  }
  for (const m of imKatalog) {
    assert.ok(angeboten.includes(m), `„${m}" steht in keinem Auswahlfeld`);
  }
});

test('Jede Portion ist eine plausible Mahlzeit', () => {
  // Kein Genauigkeitstest – der wäre gegen die eigene Rechnung gerichtet.
  // Geprüft wird, dass keine Zeile offensichtlich daneben liegt: ein
  // Hauptgericht mit 80 kcal oder ein Snack mit 1.500.
  const grenzen = {
    fruehstueck: [250, 900], mittag: [400, 1000], abend: [400, 1000],
    snack: [100, 450], umsTraining: [100, 800],
  };
  for (const g of KATALOG.gerichte) {
    const p = portion(g, TABELLE, 1);
    assert.deepEqual(p.fehlend, [], `${g.name}: unbekannte Zutat`);
    const [min, max] = grenzen[g.mahlzeit];
    assert.ok(p.kcal >= min && p.kcal <= max,
      `${g.name}: ${p.kcal} kcal liegen außerhalb von ${min}–${max} für „${g.mahlzeit}"`);
  }
});

/* ------------------------------------------------------------- Rechnung */

test('Zutatenliste und Nährwerte beschreiben dieselbe Portion', () => {
  /*
   * Falle 13 in dieser Ecke: Die angezeigten Gramm werden auf fünf gerundet.
   * Rechnete `naehrwerteAus()` weiter mit den ungerundeten Mengen, stünden
   * unter derselben Überschrift zwei verschiedene Portionen – und die
   * Abweichung wüchse mit jeder Zutat.
   *
   * Nachgerechnet wird hier unabhängig, aus den angezeigten Gramm und der
   * Tabelle.
   */
  const karte = new Map(TABELLE.map((l) => [l.name, l]));
  for (const g of KATALOG.gerichte) {
    for (const faktor of GERICHTE.portionen) {
      const p = portion(g, TABELLE, faktor);
      let kcal = 0;
      for (const z of p.zutaten) kcal += karte.get(z.name).kcal * (z.mengeG / 100);
      assert.equal(p.kcal, Math.round(kcal),
        `${g.name} (${faktor}): Zutatenliste ergibt ${Math.round(kcal)}, angezeigt ${p.kcal}`);
    }
  }
});

test('Die Mengen werden auf die Rundungsstufe gerundet und nie auf null', () => {
  const stufe = GERICHTE.rundungGramm;
  // Eine halbe Portion von 5 g Öl wären 2,5 g – gerundet 5, nicht 0. Eine
  // Zutat mit null Gramm ist keine Zutat, sondern ein Rechenfehler in der
  // Liste.
  const winzig = { zutaten: [['Olivenöl', 5], ['Honig', 4]] };
  for (const z of zutatenMitMenge(winzig, TABELLE, 0.5)) {
    assert.equal(z.mengeG, stufe, `${z.name} auf ${z.mengeG} g gerundet`);
  }
  for (const g of KATALOG.gerichte) {
    for (const z of portion(g, TABELLE, 0.5).zutaten) {
      assert.equal(z.mengeG % stufe, 0, `${g.name}: ${z.mengeG} g ist kein Vielfaches von ${stufe}`);
      assert.ok(z.mengeG > 0, `${g.name}: ${z.name} auf 0 g`);
    }
  }
});

test('Eine unbekannte Zutat wird genannt und nicht verschwiegen', () => {
  // Falle 22: Wo Daten wegfallen, gehört der Grund an die Stelle, an der das
  // Ergebnis fehlt. Hier heißt das: Der Name kommt zurück, und der Vorschlag
  // fällt heraus statt zu leicht dazustehen.
  const erfunden = {
    name: 'Erfundenes', mahlzeit: 'abend', minuten: 5, zubereitung: 'x',
    zutaten: [['Magerquark', 200], ['Mondstaub', 50]],
  };
  const p = portion(erfunden, TABELLE, 1);
  assert.deepEqual(p.fehlend, ['Mondstaub']);

  const r = gerichtVorschlaege([erfunden], TABELLE, { rest: { kcal: 800, protein: 60 } });
  assert.deepEqual(r.vorschlaege, []);
  assert.ok(r.grund, 'ohne Vorschlag muss ein Grund dastehen');
});

test('Der Proteinanteil ist der Energieanteil, nicht das Gewicht', () => {
  // 25 g Protein bei 400 kcal sind 100 kcal, also ein Viertel.
  assert.equal(proteinAnteil({ kcal: 400, protein: 25 }), 0.25);
  // Ohne Energie gibt es keinen Anteil – lieber null als eine Division durch
  // nichts, die als 0 % dastünde.
  assert.equal(proteinAnteil({ kcal: 0, protein: 20 }), null);
});

/* -------------------------------------------------------- Portionswahl */

test('Genommen wird die größte Portion, die unter dem Ziel bleibt', () => {
  const gericht = { zutaten: [['Magerquark', 100]] }; // 67 kcal je Portion
  const stufen = [...GERICHTE.portionen].sort((a, b) => a - b);
  const groesste = stufen[stufen.length - 1];

  // Reichlich Platz: die größte Stufe.
  assert.equal(portionsFaktor(gericht, TABELLE, 1000).faktor, groesste);
  // Knapp: nur die halbe passt.
  assert.equal(portionsFaktor(gericht, TABELLE, 60).faktor, 0.5);

  // **Der Rand, um den es geht:** Trifft eine Portion das Ziel exakt, passt
  // sie noch. Mit `<` statt `<=` fiele sie eine Stufe zurück – und das ist
  // genau der Fall, den ein Test mit runden Wunschzahlen nie berührt.
  const eine = portion(gericht, TABELLE, 1).kcal;
  assert.equal(portionsFaktor(gericht, TABELLE, eine).faktor, 1);
  assert.equal(portionsFaktor(gericht, TABELLE, eine - 1).faktor, 0.5);
});

test('Passt nicht einmal die kleinste Portion, steht das dabei', () => {
  // Der Tracker verbietet nichts – aber er sagt, was der Vorschlag kostet.
  const gericht = { zutaten: [['Magerquark', 100]] };
  const kleinste = portion(gericht, TABELLE, 0.5).kcal;

  const eng = portionsFaktor(gericht, TABELLE, kleinste - 1, kleinste - 1);
  assert.equal(eng.faktor, 0.5, 'trotzdem ein Vorschlag');
  assert.equal(eng.ueberZiel, true);

  // Über dem Mahlzeitenziel, aber innerhalb des Tagesrests: kein Hinweis.
  // Sonst stünde er an jedem Nachmittag, an dem eine Mahlzeit größer ausfällt
  // als der Schnitt – und würde damit bedeutungslos.
  const weit = portionsFaktor(gericht, TABELLE, kleinste - 1, 2000);
  assert.equal(weit.ueberZiel, false);
});

/* --------------------------------------------------------- Die Auswahl */

test('Ist nichts mehr offen, kommt kein Vorschlag', () => {
  // Ein Tracker, der zum Nachlegen rät, obwohl das Ziel erreicht ist, wäre
  // schlicht falsch. Beide Fälle sind erreichbar und sagen Verschiedenes.
  const satt = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest: { kcal: -200, protein: -10 } });
  assert.deepEqual(satt.vorschlaege, []);
  assert.match(satt.grund, /abgedeckt/);

  const proteinOffen = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest: { kcal: -200, protein: 30 } });
  assert.deepEqual(proteinOffen.vorschlaege, []);
  assert.match(proteinOffen.grund, /30 g Protein/);
});

test('Sortiert wird nach der Proteindichte, die der Rest des Tages braucht', () => {
  // Die Gegenprobe zur Sortierung: Derselbe Katalog, zwei Tagesreste – und
  // eine Auswahl, die sich unterscheidet. Ohne diese Gegenrichtung bestünde
  // den Test auch eine Rangfolge, die immer dasselbe zuerst nennt.
  const mager = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 600, protein: 70 }, mahlzeit: 'snack', anzahl: 1,
  }).vorschlaege[0];
  const fettig = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 600, protein: 8 }, mahlzeit: 'snack', anzahl: 1,
  }).vorschlaege[0];

  assert.notEqual(mager.gericht.name, fettig.gericht.name);
  assert.ok(mager.proteinAnteil > fettig.proteinAnteil,
    `${mager.gericht.name} (${mager.proteinAnteil}) müsste proteinreicher sein `
    + `als ${fettig.gericht.name} (${fettig.proteinAnteil})`);
});

test('Ein gedecktes Protein ergibt keine negative Dichte', () => {
  /*
   * Am Gerät stand „Offen sind 423 kcal und −36 g Protein – das sind −34 %
   * der Energie aus Protein". Einen negativen Energieanteil gibt es nicht;
   * gemeint war etwas Einfaches, nämlich dass am Protein nichts mehr zu holen
   * ist. Dieselbe Familie wie Falle 10: Eine Größe, die über ihr Ziel
   * hinausläuft, braucht dort eine eigene Formulierung.
   */
  const r = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 423, protein: -36 }, anzahl: 3,
  });
  assert.equal(r.proteinGedeckt, true);
  assert.equal(r.zielDichte, 0);
  assert.ok(r.vorschlaege.length, 'trotzdem Vorschläge – die Kalorien sind ja offen');

  // Und die Rangfolge stimmt weiter: gesucht ist jetzt das Proteinärmste.
  const [erster] = r.vorschlaege;
  const reichste = Math.max(...r.vorschlaege.map((v) => v.proteinAnteil));
  assert.equal(erster.proteinAnteil, Math.min(...r.vorschlaege.map((v) => v.proteinAnteil)));
  assert.ok(erster.proteinAnteil <= reichste);

  // Die Gegenrichtung, damit der Anschlag nicht einfach jede Dichte platt
  // macht: Bei offenem Protein steht wieder eine echte Zahl da.
  const offen = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 600, protein: 45 },
  });
  assert.equal(offen.proteinGedeckt, false);
  assert.ok(offen.zielDichte > 0);
});

test('An einem Tag ohne Training fällt die Trainingsverpflegung heraus', () => {
  // „Vor dem Sprint: Datteln" über einem Ruhetag ist kein Vorschlag, sondern
  // ein Hinweis darauf, dass die Karte den Tag nicht kennt. Gefunden nicht
  // durch einen Test, sondern im Screenshot der Essensansicht.
  const ruhetag = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 423, protein: -36 }, trainingstag: false, anzahl: 10,
  });
  for (const v of ruhetag.vorschlaege) {
    assert.notEqual(v.gericht.mahlzeit, 'umsTraining',
      `„${v.gericht.name}" an einem Tag ohne Training`);
  }

  // Am Trainingstag darf sie vorkommen – sonst wäre der halbe Katalog tot.
  const trainingstag = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 423, protein: -36 }, trainingstag: true, anzahl: 10,
  });
  assert.ok(trainingstag.vorschlaege.some((v) => v.gericht.mahlzeit === 'umsTraining'),
    'am Trainingstag müsste die Verpflegung wieder auftauchen');

  // Und wer die Mahlzeit ausdrücklich wählt, bekommt sie auch am Ruhetag:
  // Der Tracker verbietet nichts, er sortiert nur.
  const gewaehlt = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 423, protein: -36 }, trainingstag: false, mahlzeit: 'umsTraining',
  });
  assert.ok(gewaehlt.vorschlaege.length, 'ausdrücklich gewählt und trotzdem leer');
});

test('Der Mahlzeitenfilter liefert nur Gerichte dieser Mahlzeit', () => {
  for (const m of new Set(KATALOG.gerichte.map((g) => g.mahlzeit))) {
    const r = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
      rest: { kcal: 900, protein: 60 }, mahlzeit: m, anzahl: 3,
    });
    assert.ok(r.vorschlaege.length, `${m}: keine Vorschläge`);
    for (const v of r.vorschlaege) assert.equal(v.gericht.mahlzeit, m);
  }
});

test('Die Einschränkungen greifen – und nennen sich, wenn nichts übrig bleibt', () => {
  const rest = { kcal: 800, protein: 55 };

  const ohneFleisch = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest, fleischlos: true, anzahl: 20 });
  assert.ok(ohneFleisch.vorschlaege.length, 'fleischlos darf nicht leer sein');
  for (const v of ohneFleisch.vorschlaege) {
    assert.ok(v.fleischlos, `${v.gericht.name} ist nicht fleischlos`);
  }
  // Gegenprobe: Ohne Häkchen kommt auch Fleisch vor – sonst prüfte der Filter
  // nichts, weil ohnehin nur Fleischloses im Katalog stünde.
  const alles = gerichtVorschlaege(KATALOG.gerichte, TABELLE, { rest, anzahl: 20 });
  assert.ok(alles.vorschlaege.some((v) => !v.fleischlos));

  const schnell = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest, hoechstensMinuten: 10, anzahl: 20 });
  assert.ok(schnell.vorschlaege.length);
  for (const v of schnell.vorschlaege) assert.ok(v.gericht.minuten <= 10);
  assert.ok(alles.vorschlaege.some((v) => v.gericht.minuten > 10), 'Gegenprobe zur Zeitgrenze');

  /*
   * **Höchstens heißt einschließlich.** Ein Gericht mit genau zehn Minuten
   * darf unter „höchstens 10 min" nicht herausfallen – die Aufschrift wäre
   * sonst falsch, und der Rand ist erreichbar: Fünf Gerichte im Katalog
   * stehen exakt auf zehn.
   */
  const genau = KATALOG.gerichte.filter((g) => g.minuten === 10);
  assert.ok(genau.length, 'ohne ein Gericht auf der Grenze prüft das hier nichts');
  const aufDerGrenze = gerichtVorschlaege(genau, TABELLE,
    { rest, hoechstensMinuten: 10, anzahl: 20 });
  assert.equal(aufDerGrenze.vorschlaege.length, genau.length,
    'ein Gericht mit genau zehn Minuten fällt unter „höchstens 10 min" heraus');

  // Und wenn eine Einschränkung die Liste leert, sagt der Grund welche.
  // „Kein Gericht im Vorrat" wäre eine Auskunft über den Katalog, wo eine
  // über die Auswahl gemeint ist.
  const leer = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest, mahlzeit: 'mittag', fleischlos: true, hoechstensMinuten: 1 });
  assert.deepEqual(leer.vorschlaege, []);
  assert.match(leer.grund, /fleischlos/);
  assert.match(leer.grund, /1 min/);

  // Ohne Einschränkung heißt derselbe Fall anders – sonst stünde bei einer
  // Mahlzeit ohne Gerichte ein Satz über Filter, die niemand gesetzt hat.
  const keinKatalog = gerichtVorschlaege([], TABELLE, { rest });
  assert.match(keinKatalog.grund, /noch kein Gericht im Vorrat/);
});

test('Das Ziel einer Portion ist eine Mahlzeit, nicht der ganze Tagesrest', () => {
  /*
   * Ohne diese Begrenzung zielte der Vorschlag am frühen Nachmittag auf den
   * kompletten Rest – bei 1.400 offenen Kalorien also auf ein Abendessen, das
   * den Tag in einem Zug abschließt. Die Zahl ist keine neue: Sie folgt aus
   * den vier bis fünf Portionen, mit denen `mahlzeitenplan()` ohnehin rechnet.
   */
  const gross = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 1400, protein: 90 }, mahlzeitKcal: 500, mahlzeit: 'abend', anzahl: 3,
  });
  assert.equal(gross.zielKcal, 500);
  for (const v of gross.vorschlaege) {
    assert.ok(v.naehrwerte.kcal <= 500 || v.ueberZiel,
      `${v.gericht.name}: ${v.naehrwerte.kcal} kcal über dem Mahlzeitenziel ohne Hinweis`);
  }

  // Bleibt vom Tag weniger übrig als eine Mahlzeit ausmacht, zählt der Rest.
  const knapp = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 300, protein: 30 }, mahlzeitKcal: 700, mahlzeit: 'snack',
  });
  assert.equal(knapp.zielKcal, 300);
});

test('„gefunden" zählt die passenden Gerichte, nicht die gezeigten', () => {
  /*
   * Die Oberfläche entscheidet daran, ob ein „weitere anzeigen" dasteht. Wäre
   * es die Zahl der gezeigten, stünde der Knopf immer da – und hinter ihm
   * käme irgendwann nichts mehr (Falle 45). Und weil es zwei Zahlen für
   * benachbarte Dinge sind, gehört geprüft, dass sie nicht dasselbe zählen
   * (Falle 15).
   */
  const rest = { kcal: 900, protein: 60 };
  const drei = gerichtVorschlaege(KATALOG.gerichte, TABELLE, { rest, anzahl: 3 });
  const zehn = gerichtVorschlaege(KATALOG.gerichte, TABELLE, { rest, anzahl: 10 });

  assert.equal(drei.vorschlaege.length, 3);
  assert.equal(zehn.vorschlaege.length, 10);
  assert.equal(drei.gefunden, zehn.gefunden, '„gefunden" darf nicht an der Anzahl hängen');
  assert.ok(drei.gefunden > 10, `nur ${drei.gefunden} passende Gerichte`);

  // Und mit Einschränkung fällt die Zahl mit – sonst zählte sie den Katalog
  // statt die Auswahl.
  const eng = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest, mahlzeit: 'snack', fleischlos: true, anzahl: 3 });
  assert.ok(eng.gefunden < drei.gefunden, `${eng.gefunden} statt weniger als ${drei.gefunden}`);
  assert.equal(eng.gefunden,
    KATALOG.gerichte.filter((g) => g.mahlzeit === 'snack'
      && (g.art === 'vegetarisch' || g.art === 'vegan')).length);
});

test('Die Deckung ist nachrechenbar', () => {
  // „Deckt 61 % der offenen Kalorien" ist eine Aussage, die man nachprüfen
  // kann – eine Punktzahl wäre es nicht.
  const r = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 800, protein: 50 }, mahlzeit: 'abend', anzahl: 3,
  });
  for (const v of r.vorschlaege) {
    assert.equal(v.deckung.kcal, Math.round((v.naehrwerte.kcal / 800) * 100));
    assert.equal(v.deckung.protein, Math.round((v.naehrwerte.protein / 50) * 100));
  }

  // Ohne offenes Protein gibt es keine Proteindeckung – lieber nichts als
  // eine Division durch null, die als Zahl dastünde.
  const ohne = gerichtVorschlaege(KATALOG.gerichte, TABELLE, {
    rest: { kcal: 800, protein: 0 }, mahlzeit: 'abend', anzahl: 1,
  });
  assert.equal(ohne.vorschlaege[0].deckung.protein, null);
});

test('Die Ränder liegen auf der Null, und die Null ist erreichbar', () => {
  /*
   * Sechs Schwellen dieser Datei stehen auf exakt null – „nichts mehr offen",
   * „Protein genau getroffen", „kein Mahlzeitenbudget". Ein Test mit runden
   * Wunschzahlen berührt keine davon; der Mutationslauf meldete sie
   * ausnahmslos als ungeprüft. Hinter jeder steht ein Satz, den jemand liest.
   */

  // Genau null Kalorien offen ist „abgedeckt", nicht „423 kcal übrig". Sonst
  // stünde über einer Auswahl, die in nichts mehr hineinpasst, ein Vorschlag.
  const nullKcal = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest: { kcal: 0, protein: 20 } });
  assert.deepEqual(nullKcal.vorschlaege, []);
  assert.match(nullKcal.grund, /20 g Protein/);

  // Genau null Protein offen heißt gedeckt. „0 g Protein fehlen noch" wäre
  // keine Auskunft, sondern ein Zählfehler.
  const nullProtein = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest: { kcal: 0, protein: 0 } });
  assert.equal(nullProtein.proteinGedeckt, true);
  assert.match(nullProtein.grund, /abgedeckt/);
  assert.doesNotMatch(nullProtein.grund, /0 g Protein/);

  // Dasselbe im laufenden Tag: Protein getroffen, Kalorien noch offen.
  const getroffen = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest: { kcal: 500, protein: 0 } });
  assert.equal(getroffen.proteinGedeckt, true);
  assert.equal(getroffen.zielDichte, 0);

  // Ein Mahlzeitenbudget von null ist kein Budget. Sonst passte nichts mehr
  // hinein, und die Karte zeigte lauter Gerichte mit „über dem Ziel".
  const ohneBudget = gerichtVorschlaege(KATALOG.gerichte, TABELLE,
    { rest: { kcal: 700, protein: 50 }, mahlzeitKcal: 0, mahlzeit: 'abend' });
  assert.equal(ohneBudget.zielKcal, 700);
  assert.ok(ohneBudget.vorschlaege.every((v) => !v.ueberZiel));

  // Und die kleinste Portion, die den Tagesrest **genau** trifft, liegt nicht
  // darüber. „Auch die kleinste Portion liegt über dem, was offen ist" wäre
  // dort schlicht falsch.
  const gericht = { zutaten: [['Magerquark', 100]] };
  const kleinste = portion(gericht, TABELLE, 0.5).kcal;
  assert.equal(portionsFaktor(gericht, TABELLE, kleinste - 1, kleinste).ueberZiel, false);
  assert.equal(portionsFaktor(gericht, TABELLE, kleinste - 1, kleinste - 1).ueberZiel, true);
});

test('Eine leere Zutatenliste ergibt keine Nährwerte und keinen Vorschlag', () => {
  assert.deepEqual(naehrwerteAus([]),
    { kcal: 0, protein: 0, kohlenhydrate: 0, fett: 0, fehlend: [] });
  const leer = { name: 'Nichts', mahlzeit: 'snack', zutaten: [] };
  assert.deepEqual(
    gerichtVorschlaege([leer], TABELLE, { rest: { kcal: 500, protein: 30 } }).vorschlaege, []);
});

/* ------------------------------------------------------- Der ganze Tag */

test('Der Tagesplan hat so viele Mahlzeiten, wie der Tracker plant', () => {
  // Zwei Zahlen für dieselbe Sache driften auseinander (Falle 13). Die Liste
  // der Mahlzeiten ist nur die Benennung dessen, was `mahlzeitenplan()` als
  // Anzahl führt – weicht sie ab, rechnet der Tagesplan mit einem anderen
  // Budget als die Karte darüber.
  assert.equal(TAGESPLAN_MAHLZEITEN.length, ERNAEHRUNG.mahlzeitenProTag);

  // Und jede davon muss es im Katalog geben, sonst fällt der ganze Tag aus.
  const imKatalog = new Set(KATALOG.gerichte.map((g) => g.mahlzeit));
  for (const m of TAGESPLAN_MAHLZEITEN) assert.ok(imKatalog.has(m), `${m} fehlt im Katalog`);

  // „Ums Training" gehört bewusst nicht dazu: Eine fünfte Mahlzeit kürzte das
  // Budget der anderen vier, ohne dass mehr Energie herkäme.
  assert.ok(!TAGESPLAN_MAHLZEITEN.includes('umsTraining'));
});

test('Über den ganzen Bereich der Kalorienziele bleibt der Tag nah dran', () => {
  /*
   * Der Einzeltest oben prüft drei Ziele in Variante 0 – das ist die Mitte
   * des Bereichs, und genau dort hat dieser Vorschlag nie das Problem. Der
   * Fehler steckt in den Rändern und in den hinteren Varianten: Mit dem
   * Abendessen **nicht** zuletzt geplant lag die schlimmste Abweichung bei
   * 21 %, also über 700 kcal an einem 3.400er-Tag.
   *
   * Geprüft wird deshalb der ganze Bereich, und zwar auf den schlimmsten
   * Fall – ein Mittelwert verstecht genau die Ausreißer, um die es geht.
   */
  let schlimmste = 0;
  let wo = '';
  for (const kcal of [1600, 1900, 2200, 2500, 2800, 3100, 3400]) {
    const protein = Math.round(kcal * 0.055);
    for (let variante = 0; variante < 8; variante += 1) {
      for (const fleischlos of [false, true]) {
        const t = tagesvorschlag(KATALOG.gerichte, TABELLE,
          { kcal, protein, variante, fleischlos });
        assert.equal(t.mahlzeiten.length, TAGESPLAN_MAHLZEITEN.length,
          `${kcal} kcal, Variante ${variante}: unvollständiger Tag`);
        const daneben = Math.abs(t.abweichung.kcal) / kcal;
        if (daneben > schlimmste) {
          schlimmste = daneben;
          wo = `${kcal} kcal, Variante ${variante}${fleischlos ? ', fleischlos' : ''}`
            + ` → ${t.summe.kcal} kcal`;
        }
      }
    }
  }
  assert.ok(schlimmste <= 0.12,
    `schlimmster Fall ${Math.round(schlimmste * 100)} % daneben: ${wo}`);
});

test('Ein Tagesvorschlag trifft das Tagesziel', () => {
  /*
   * Der eigentliche Zweck: vier Mahlzeiten, die zusammen aufgehen.
   *
   * Mit der Portionsregel des Einzelvorschlags („die größte, die darunter
   * bleibt") kam ein Tag auf 1.875 statt 2.722 kcal – 31 % zu wenig, und das
   * in einem Tracker, der an anderer Stelle vor zu geringer
   * Energieverfügbarkeit warnt. Geprüft wird deshalb die Summe, nicht die
   * einzelne Mahlzeit.
   */
  for (const [kcal, protein] of [[2722, 149], [2000, 120], [3400, 180]]) {
    const t = tagesvorschlag(KATALOG.gerichte, TABELLE, { kcal, protein });
    assert.equal(t.mahlzeiten.length, TAGESPLAN_MAHLZEITEN.length, `${kcal} kcal: unvollständig`);
    assert.deepEqual(t.mahlzeiten.map((m) => m.mahlzeit), TAGESPLAN_MAHLZEITEN);

    // Die Summe ist die Summe der Teile – keine zweite Herleitung daneben.
    const nach = t.mahlzeiten.reduce((s, m) => s + m.naehrwerte.kcal, 0);
    assert.equal(t.summe.kcal, nach);
    assert.equal(t.abweichung.kcal, t.summe.kcal - kcal);

    // 12 % Spielraum: Die Portionen sind halbe, ganze, anderthalbe, doppelte –
    // genauer geht es mit diesem Raster nicht, und eine engere Schranke wäre
    // erfundene Genauigkeit. Gemessen liegt die schlimmste Abweichung über
    // 112 durchgerechnete Tage bei 10 %, der Median bei 3 %.
    const daneben = Math.abs(t.abweichung.kcal) / kcal;
    assert.ok(daneben <= 0.12,
      `${kcal} kcal Ziel, ${t.summe.kcal} vorgeschlagen (${Math.round(daneben * 100)} % daneben)`);
  }
});

test('Die beiden Portionsregeln sind wirklich verschieden', () => {
  /*
   * Die Gegenprobe zur Regel oben. Wären `darunter` und `treffen` dasselbe,
   * hätte die Unterscheidung keinen Wert – und die Begründung im Docstring
   * wäre eine Behauptung. Gemessen, nicht begründet (die Lehre aus Falle 68).
   */
  let unterschiedlich = 0;
  for (const g of KATALOG.gerichte) {
    for (const ziel of [300, 500, 700, 900]) {
      const a = portionsFaktor(g, TABELLE, ziel, ziel).faktor;
      const b = portionsFaktor(g, TABELLE, ziel, ziel, { treffen: true }).faktor;
      if (a !== b) unterschiedlich += 1;
    }
  }
  assert.ok(unterschiedlich > 50,
    `nur ${unterschiedlich} Unterschiede – dann trägt die zweite Regel nichts`);

  // Und die Richtung stimmt: `treffen` darf über das Ziel gehen, `darunter` nie.
  const gericht = { zutaten: [['Magerquark', 300]] };
  const ziel = portion(gericht, TABELLE, 1).kcal - 10;
  assert.ok(portion(gericht, TABELLE, portionsFaktor(gericht, TABELLE, ziel, ziel).faktor).kcal <= ziel);
  assert.ok(portion(gericht, TABELLE,
    portionsFaktor(gericht, TABELLE, ziel, ziel, { treffen: true }).faktor).kcal > ziel);
});

test('Der Tagesvorschlag lässt sich durchblättern und folgt den Filtern', () => {
  const ziel = { kcal: 2722, protein: 149 };
  const eins = tagesvorschlag(KATALOG.gerichte, TABELLE, ziel);
  const zwei = tagesvorschlag(KATALOG.gerichte, TABELLE, { ...ziel, variante: 1 });
  const nochmal = tagesvorschlag(KATALOG.gerichte, TABELLE, ziel);

  const namen = (t) => t.mahlzeiten.map((m) => m.gericht.name).join(' · ');
  assert.notEqual(namen(eins), namen(zwei), 'die zweite Variante zeigt dasselbe');
  // Deterministisch: Wer zweimal dasselbe tippt, soll zweimal dasselbe sehen.
  assert.equal(namen(eins), namen(nochmal));
  assert.ok(eins.varianten > 1, 'ohne mehrere Varianten wäre der Knopf ein Weg ohne Ziel');

  const ohneFleisch = tagesvorschlag(KATALOG.gerichte, TABELLE, { ...ziel, fleischlos: true });
  for (const m of ohneFleisch.mahlzeiten) {
    assert.ok(m.fleischlos, `${m.gericht.name} ist nicht fleischlos`);
  }
  // Gegenprobe – sonst prüfte der Filter nichts, weil ohnehin alles
  // fleischlos wäre.
  const alle = [0, 1, 2, 3].flatMap((v) =>
    tagesvorschlag(KATALOG.gerichte, TABELLE, { ...ziel, variante: v }).mahlzeiten);
  assert.ok(alle.some((m) => !m.fleischlos));
});

test('Ohne Zielwerte kommt kein Tagesvorschlag, sondern der Grund', () => {
  // Dieselbe Regel wie überall: lieber sagen, was fehlt, als eine Zahl
  // erfinden. Ohne Körperdaten gibt es kein Kalorienziel.
  const ohne = tagesvorschlag(KATALOG.gerichte, TABELLE, { kcal: 0, protein: 0 });
  assert.deepEqual(ohne.mahlzeiten, []);
  assert.match(ohne.grund, /Profil/);

  // Und wenn eine Einschränkung eine Mahlzeit leer räumt, fällt der Tag aus –
  // mit dem Grund der Einschränkung, nicht mit einer leeren Liste.
  const eng = tagesvorschlag(KATALOG.gerichte, TABELLE,
    { kcal: 2722, protein: 149, fleischlos: true, hoechstensMinuten: 1 });
  assert.deepEqual(eng.mahlzeiten, []);
  assert.match(eng.grund, /fleischlos/);
});

test('Bei gleichem Abstand gewinnt die kleinere Portion', () => {
  /*
   * Liegen zwei Portionen gleich weit vom Ziel – 300 und 600 kcal bei einem
   * Ziel von 450 –, ist keine „richtiger". Entschieden wird trotzdem, und
   * zwar zugunsten der kleineren: Nachlegen geht, zurücknehmen nicht. Ohne
   * diesen Test schriebe die nächste Runde die Regel unbemerkt um.
   */
  const gericht = { zutaten: [['Magerquark', 300]] };
  const halb = portion(gericht, TABELLE, 0.5).kcal;
  const ganz = portion(gericht, TABELLE, 1).kcal;
  const mitte = (halb + ganz) / 2;
  assert.notEqual(halb, ganz, 'ohne Unterschied prüft das hier nichts');

  const { faktor } = portionsFaktor(gericht, TABELLE, mitte, mitte, { treffen: true });
  assert.equal(faktor, 0.5, `bei genau ${mitte} kcal wurde die größere Portion genommen`);

  // Und einen Hauch darüber kippt es – sonst wäre die Grenze gar nicht dort.
  assert.equal(
    portionsFaktor(gericht, TABELLE, mitte + 1, mitte + 1, { treffen: true }).faktor, 1);
});

test('Eine Variante jenseits der vorhandenen Gerichte bricht den Tag nicht', () => {
  /*
   * „Anderer Vorschlag" zählt hoch. Hat eine Mahlzeit weniger Gerichte als
   * die Variante hoch ist, bleibt sie bei ihrem letzten – sonst griffe der
   * Zugriff ins Leere und der ganze Tag fiele aus, weil es zu einer einzigen
   * Mahlzeit nur zwei Gerichte gibt.
   */
  const winzig = KATALOG.gerichte.filter((g, i) =>
    TAGESPLAN_MAHLZEITEN.includes(g.mahlzeit)
    && KATALOG.gerichte.filter((x, j) => x.mahlzeit === g.mahlzeit && j < i).length < 2);
  assert.equal(winzig.length, TAGESPLAN_MAHLZEITEN.length * 2, 'Testkatalog falsch gebaut');

  for (const variante of [0, 1, 2, 9]) {
    const t = tagesvorschlag(winzig, TABELLE, { kcal: 2400, protein: 140, variante });
    assert.equal(t.mahlzeiten.length, TAGESPLAN_MAHLZEITEN.length,
      `Variante ${variante} liefert keinen vollständigen Tag`);
    for (const m of t.mahlzeiten) assert.ok(m.gericht?.name, 'Mahlzeit ohne Gericht');
  }
});
