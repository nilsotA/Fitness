import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../kern/belastung.js';
import { BELASTUNG, BEREITSCHAFT } from '../kern/wissen.js';

const BIS = new Date('2026-08-07');

/** Baut n Tage rückwärts ab `bis` je eine Einheit mit fester Last. */
function verlauf(tage, rpe, minuten, bis = BIS) {
  return Array.from({ length: tage }, (_, i) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - i);
    return { datum: d.toISOString().slice(0, 10), rpe, minuten };
  });
}

test('Session-RPE ist Anstrengung mal Dauer', () => {
  assert.equal(B.sessionLast(7, 60), 420);
  assert.equal(B.sessionLast(0, 60), 0);
  assert.equal(B.sessionLast(15, 60), 600, 'RPE wird auf 10 gedeckelt');
});

test('Tageslast summiert mehrere Einheiten desselben Tages', () => {
  // Stand vorher auf `tagesLast()` – einer Funktion ohne Aufrufer. Geprüft
  // wird jetzt derselbe Rechenweg an der Stelle, die der Kern tatsächlich
  // benutzt.
  const karte = B.lastProTag([
    { datum: '2026-08-10', rpe: 7, minuten: 60 },
    { datum: '2026-08-10', rpe: 4, minuten: 30 },
    { datum: '2026-08-11', rpe: 5, minuten: 40 },
  ]);
  assert.equal(karte.get('2026-08-10'), 540);
  assert.equal(karte.get('2026-08-11'), 200);
});

test('ACWR meldet zu wenig Daten offen zurück', () => {
  const kurz = B.acwr(verlauf(5, 7, 60), BIS);
  assert.equal(kurz.belastbar, false);
  // Der Hinweis sagt, was genau fehlt – eine Woche von vier. Vorher stand dort
  // pauschal „nach etwa vier Wochen", auch wenn das Warten nichts geändert
  // hätte, weil nicht die Zeit fehlte, sondern die Trainingshäufigkeit.
  assert.equal(kurz.wochenMitDaten, 1);
  assert.equal(kurz.wochenGesamt, 4);
  assert.match(kurz.hinweis, /1 Woche der letzten 4/);
});

test('Zwei Einheiten pro Woche reichen für das Verhältnis', () => {
  // Der Planer belegt bei drei eingestellten Tagen und Regler 15 bis 35 nur
  // zwei Tage in der Woche – Sprint und Kraft teilen sich einen. Die alte
  // Schranke verlangte zehn Trainingstage in 28 Tagen; erreichbar waren acht.
  // Das Verhältnis war für diese Einstellungen also dauerhaft nicht verfügbar,
  // und der Hinweis darunter versprach, es werde „nach etwa vier Wochen"
  // besser. Ein Hinweis ohne Weg – siehe die Sackgassen in CLAUDE.md.
  const zweiProWoche = [];
  for (let woche = 0; woche < 4; woche += 1) {
    for (const versatz of [0, 3]) {
      const d = new Date(BIS);
      d.setDate(d.getDate() - (woche * 7 + versatz));
      zweiProWoche.push({ datum: d.toISOString().slice(0, 10), rpe: 7, minuten: 60 });
    }
  }
  const a = B.acwr(zweiProWoche, BIS);
  assert.equal(a.belastbar, true, `acht Trainingstage in vier Wochen: ${a.hinweis}`);
  assert.equal(a.wert, 1, 'gleichmäßig trainiert ergibt ein Verhältnis von 1');
});

test('Eine Lücke von einer ganzen Woche macht das Verhältnis unbrauchbar', () => {
  // Die Gegenrichtung: Vier Wochen Zeitraum genügen nicht, wenn eine davon
  // leer ist – dann vergleicht der chronische Wert mit einer Pause.
  // Vier Wochen durchtrainiert, die dritte herausgeschnitten.
  const mitLuecke = verlauf(28, 7, 60).filter((_, i) => i < 14 || i >= 21);
  const a = B.acwr(mitLuecke, BIS);
  assert.equal(a.wochenMitDaten, 3);
  assert.equal(a.belastbar, false);
});

test('Gleichmäßige Belastung ergibt ein Verhältnis um 1', () => {
  const gleich = B.acwr(verlauf(28, 6, 60), BIS);
  assert.equal(gleich.belastbar, true);
  assert.ok(Math.abs(gleich.wert - 1) < 0.05, `Wert ${gleich.wert}`);
  assert.equal(gleich.stufe, 'unauffällig');
});

test('Belastungssprung wird als solcher erkannt', () => {
  // Drei ruhige Wochen, dann eine sehr harte.
  const ruhig = verlauf(28, 3, 30).slice(7);
  const hart = verlauf(7, 9, 120);
  const sprung = B.acwr([...ruhig, ...hart], BIS);
  assert.equal(sprung.belastbar, true);
  assert.ok(sprung.wert > 1.5, `Wert ${sprung.wert}`);
  assert.equal(sprung.stufe, 'sprung');
});

test('ACWR benennt seine eigene Grenze', () => {
  const a = B.acwr(verlauf(28, 6, 60), BIS);
  assert.match(a.einschraenkung, /keine Verletzungsvorhersage/);
});

test('Monotonie erkennt gleichförmige Wochen', () => {
  const gleichfoermig = B.monotonie(verlauf(7, 6, 60), BIS);
  // Bei identischer Last an allen sieben Tagen ist die Streuung null.
  assert.equal(gleichfoermig.belastbar, false);

  // Sechs Trainingstage, fast gleiche Last: Ab hier ist die Schwelle
  // überhaupt erreichbar – und wird gerissen.
  const sechsFastGleich = B.monotonie([
    ...Array.from({ length: 6 }, (_, i) => {
      const d = new Date(BIS);
      d.setDate(d.getDate() - i);
      return { datum: d.toISOString().slice(0, 10), rpe: 6, minuten: 60 + (i % 2) };
    }),
  ], BIS);
  assert.equal(sechsFastGleich.bewertbar, true, 'sechs Tage werden benotet');
  assert.equal(sechsFastGleich.hoch, true);
  assert.match(sechsFastGleich.text, /Wenig Abwechslung/);
});

test('Unter sechs Trainingstagen wird die Monotonie nicht benotet', () => {
  // Der Quotient hat bei n Trainingstagen ein Maximum von wurzel(n / (7 - n)):
  // 1,15 bei vier Tagen gegen eine Schwelle von 2,0. Vorher stand über jeder
  // Vier-Tage-Woche grün „gut verteilt" – eine Prüfung, die niemand bestehen
  // musste, weil sie niemand durchfallen konnte. Dieselbe Familie wie Falle 6
  // und 17: eine Schwelle ohne erreichbare Gegenseite.
  const vierTage = B.monotonie([
    { datum: '2026-08-07', rpe: 9, minuten: 90 },
    { datum: '2026-08-06', rpe: 3, minuten: 30 },
    { datum: '2026-08-05', rpe: 8, minuten: 75 },
    { datum: '2026-08-03', rpe: 4, minuten: 40 },
  ], BIS);
  assert.equal(vierTage.belastbar, true, 'der Wert wird trotzdem berechnet');
  assert.equal(vierTage.trainingstage, 4);
  assert.equal(vierTage.bewertbar, false);
  assert.equal(vierTage.hoch, false);
  assert.match(vierTage.text, /höchstens 1,15/, 'nennt das erreichbare Maximum');
  assert.doesNotMatch(vierTage.text, /Gute Verteilung/, 'kein Lob ohne Prüfung');
});

test('Die Monotonie-Schwelle ist unter sechs Trainingstagen unerreichbar', () => {
  // Nicht „selten", sondern rechnerisch ausgeschlossen – deshalb als Eigenschaft
  // geprüft und nicht an einem Beispiel. Gleiche Last an jedem Trainingstag ist
  // der monotonste denkbare Fall; jede Abweichung senkt den Wert weiter.
  for (let tage = 1; tage <= 6; tage += 1) {
    const sessions = Array.from({ length: tage }, (_, i) => {
      const d = new Date(BIS);
      d.setDate(d.getDate() - i);
      return { datum: d.toISOString().slice(0, 10), rpe: 6, minuten: 60 };
    });
    const m = B.monotonie(sessions, BIS);
    if (tage === 7) continue;
    const maximum = Math.sqrt(tage / (7 - tage));
    assert.ok(m.wert <= maximum + 0.01,
      `${tage} Trainingstage: ${m.wert} darf ${maximum.toFixed(2)} nicht überschreiten`);
    assert.equal(m.bewertbar, tage >= BELASTUNG.monotonie.minTrainingstageFuerNote,
      `${tage} Trainingstage: benotet werden darf erst ab `
      + `${BELASTUNG.monotonie.minTrainingstageFuerNote}`);
  }
});

test('Bereitschaft aus dem Morgen-Check', () => {
  const gut = B.bereitschaft({ schlaf: 5, muskelkater: 4, stress: 4, stimmung: 5, energie: 5 });
  assert.equal(gut.ampel, 'gruen');
  assert.ok(gut.prozent > 85);

  const schlecht = B.bereitschaft({ schlaf: 1, muskelkater: 1, stress: 2, stimmung: 2, energie: 1 });
  assert.equal(schlecht.ampel, 'rot');
  assert.match(schlecht.empfehlung, /streichen/);
});

test('Schlechter Schlaf drückt die Ampel auch bei sonst guten Werten', () => {
  const b = B.bereitschaft({ schlaf: 2, muskelkater: 5, stress: 5, stimmung: 5, energie: 4 });
  assert.equal(b.ampel, 'gelb');
  assert.match(b.empfehlung, /Schlaf/);
});

test('Unvollständiger Check wird nicht bewertet', () => {
  assert.equal(B.bereitschaft({ schlaf: 4 }).vollstaendig, false);
  assert.equal(B.bereitschaft(null), null);
});

test('Entlastung wird erst bei mehreren Anzeichen empfohlen', () => {
  const ruhig = B.entlastungFaellig(verlauf(28, 5, 50), [], BIS);
  assert.equal(ruhig.faellig, false);

  const schlechteChecks = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - i);
    return {
      datum: d.toISOString().slice(0, 10),
      schlaf: 2, muskelkater: 2, stress: 2, stimmung: 3, energie: 2,
    };
  });
  const belastet = B.entlastungFaellig(
    [...verlauf(28, 3, 30).slice(7), ...verlauf(7, 9, 120)],
    schlechteChecks, BIS);
  assert.equal(belastet.faellig, true);
  assert.ok(belastet.gruende.length >= 2);
});

test('Wochenverlauf liefert eine Reihe fester Länge', () => {
  const reihe = B.wochenverlauf(verlauf(28, 6, 60), 12, BIS);
  assert.equal(reihe.length, 12);
  assert.ok(reihe[reihe.length - 1].last > 0);
  assert.equal(reihe[0].last, 0, 'zwölf Wochen zurück liegen keine Daten');
});

/* ------------------------------------------------------------ Ruhepuls */

/** Checks mit Ruhepuls, `tageVor` Tage vor dem Stichtag. */
const check = (tageVor, ruhepuls) => {
  const d = new Date(BIS);
  d.setDate(d.getDate() - tageVor);
  return { datum: d.toISOString().slice(0, 10), ruhepuls };
};

/** Grundlinie: gleichmäßige Werte ab Tag `von` rückwärts. */
const grundlinie = (puls, von = 4, bis = 20) =>
  Array.from({ length: bis - von + 1 }, (_, i) => check(von + i, puls));

test('Ohne genug Messungen wird der Ruhepuls nicht gedeutet', () => {
  // Genau das Muster, das der Tracker sonst überall einhält: lieber ehrlich
  // „nicht berechenbar" als eine Zahl, die nach Aussage aussieht.
  const wenig = B.ruhepulsTrend([check(0, 62), check(1, 61)], BIS);
  assert.equal(wenig.belastbar, false);
  assert.equal(wenig.letzter, 62, 'der jüngste gemessene Wert wird trotzdem gemeldet');
  assert.match(wenig.hinweis, /Grundlinie/);

  assert.equal(B.ruhepulsTrend([], BIS).belastbar, false);
});

test('Ein stabiler Ruhepuls gilt als unauffällig', () => {
  const t = B.ruhepulsTrend([...grundlinie(55), check(0, 55), check(1, 56)], BIS);
  assert.equal(t.belastbar, true);
  assert.equal(t.stufe, 'unauffällig');
  assert.ok(Math.abs(t.abweichung) < 1, `abweichung ${t.abweichung}`);
});

test('Ein deutlich erhöhter Ruhepuls wird benannt – mit den häufigeren Ursachen zuerst', () => {
  const t = B.ruhepulsTrend([...grundlinie(55), check(0, 65), check(1, 64)], BIS);
  assert.equal(t.stufe, 'deutlich');
  assert.ok(t.abweichung >= 8, `abweichung ${t.abweichung}`);
  // Ein erhöhter Ruhepuls ist unspezifisch. Ihn als Trainingsermüdung zu
  // verkaufen wäre eine Behauptung, die die Datenlage nicht hergibt.
  assert.match(t.text, /Infekt/);
  assert.match(t.einschraenkung, /Alkohol|Infekt/);
});

test('Die Grundlinie enthält die aktuellen Tage nicht', () => {
  // Sonst zieht der aktuelle Wert seine eigene Vergleichsgröße mit hoch und
  // die Abweichung verschwindet zum Teil in sich selbst.
  const t = B.ruhepulsTrend([...grundlinie(50), check(0, 60), check(1, 60)], BIS);
  assert.equal(t.grundlinie, 50);
  assert.equal(t.jetzt, 60);
  assert.equal(t.abweichung, 10);
});

test('Ein gefallener Ruhepuls ist keine Entwarnung', () => {
  // Bei ausgeprägter Ermüdung kann er ebenfalls fallen (Buchheit 2014). Als
  // „alles bestens" zu lesen wäre genau die Fehldeutung.
  const t = B.ruhepulsTrend([...grundlinie(60), check(0, 52), check(1, 53)], BIS);
  assert.equal(t.stufe, 'niedriger');
  assert.match(t.text, /Ermüdung/);
});

test('Der Ruhepuls allein löst keine Entlastung aus', () => {
  // Der Tracker verbietet nichts und schließt nicht aus einem Signal auf eine
  // Maßnahme – ein Infekt erzeugt dasselbe Bild.
  const checks = [...grundlinie(55), check(0, 66), check(1, 65)];
  const nur = B.entlastungFaellig(verlauf(28, 5, 50), checks, BIS);
  assert.equal(nur.faellig, false);
  assert.ok(nur.gruende.some((g) => /Ruhepuls/.test(g)), 'genannt wird er trotzdem');
});

/* -------------------------------------------------- Entlastung: Stichtag */

/** Morgen-Check mit gegebener Bereitschaft, `tageVor` Tage vor dem Stichtag. */
const stimmung = (tageVor, wert) => {
  const d = new Date(BIS);
  d.setDate(d.getDate() - tageVor);
  return {
    datum: d.toISOString().slice(0, 10),
    schlaf: wert, muskelkater: wert, stress: wert, stimmung: wert, energie: wert,
  };
};

test('Checks nach dem Stichtag zählen nicht mit', () => {
  // acwr, monotonie und ruhepulsTrend bekamen `bis` alle übergeben – die
  // Morgen-Checks wurden als Einzige ungefiltert genommen. In der Rückschau
  // urteilte damit die Zukunft über die Vergangenheit.
  const zukunft = [stimmung(-1, 1), stimmung(-2, 1), stimmung(-3, 1), stimmung(-4, 1)];
  const e = B.entlastungFaellig(verlauf(28, 5, 50), zukunft, BIS);
  assert.deepEqual(e.gruende, []);
  assert.equal(e.stufe, 'keine');
});

test('Alte Checks gelten nicht als „die letzten fünf"', () => {
  // Wer sechs Wochen nicht eingetragen hat, hat keine schlechte Woche hinter
  // sich – er hat keine Daten. Das ist ein Unterschied.
  const alt = [stimmung(40, 1), stimmung(41, 1), stimmung(42, 1), stimmung(43, 1)];
  const e = B.entlastungFaellig(verlauf(28, 5, 50), alt, BIS);
  assert.deepEqual(e.gruende, [], `älter als ${BELASTUNG.checkFensterTage} Tage zählt nicht`);

  const frisch = [stimmung(1, 1), stimmung(2, 1), stimmung(3, 1)];
  const jetzt = B.entlastungFaellig(verlauf(28, 5, 50), frisch, BIS);
  assert.ok(jetzt.gruende.some((g) => /Morgen-Checks/.test(g)), 'frische Checks zählen sehr wohl');
});

test('Ein einzelner Grund wird genannt statt verschwiegen', () => {
  // Vorher stand „Keine Anzeichen für vorgezogene Entlastung" im Text, während
  // ein Grund in der Liste stand – und die Oberfläche zeigte die Karte gar
  // nicht. Der Tracker verschwieg damit etwas, das er gesehen hatte.
  //
  // Gedämpft, nicht rot: 56 % liegt unter der Marke für „schwach", aber über
  // dem roten Bereich. Drei rote Checks tragen die Entlastung inzwischen
  // allein – siehe den Test weiter unten.
  const gedaempft = (tageVor) => ({ ...stimmung(tageVor, 3), stimmung: 2 });
  const drei = [gedaempft(1), gedaempft(2), gedaempft(3)];
  const e = B.entlastungFaellig(verlauf(28, 5, 50), drei, BIS);
  assert.equal(e.gruende.length, 1);
  assert.equal(e.faellig, false, 'ein Grund fordert noch keine Entlastung');
  assert.equal(e.stufe, 'beobachten');
  assert.doesNotMatch(e.text, /Keine Anzeichen/, 'kein Widerspruch zur eigenen Liste');
});

test('Ohne jeden Grund bleibt es bei „keine Anzeichen"', () => {
  const gut = [stimmung(1, 5), stimmung(2, 5), stimmung(3, 5)];
  const e = B.entlastungFaellig(verlauf(28, 5, 50), gut, BIS);
  assert.deepEqual(e.gruende, []);
  assert.equal(e.stufe, 'keine');
  assert.equal(e.faellig, false);
  assert.match(e.text, /Keine Anzeichen/);
});

test('Nur Checks mit Ruhepuls landen im Verlauf', () => {
  const gemischt = [
    check(1, 58),
    { datum: '2026-08-05', schlaf: 3 },
    { datum: '2026-08-04', ruhepuls: 0 },
    check(3, 60),
  ];
  const v = B.ruhepulsVerlauf(gemischt, BIS);
  assert.equal(v.length, 2);
  assert.deepEqual(v.map((p) => p.ruhepuls), [60, 58], 'aufsteigend nach Datum');
});

test('Anhaltend rote Morgen-Checks tragen die Entlastung allein', () => {
  // Die Bereitschaft steuerte genau einen Grund bei – egal, ob drei Checks
  // knapp unter der Marke lagen oder alle fünf auf dem Minimum. Bei zwei
  // geforderten Gründen war die Entlastung über das Wohlbefinden damit **nie**
  // auslösbar: 84 Tage in Folge mit allen fünf Antworten auf 1 ergaben
  // durchgehend nur „ein Zeichen im Blick behalten". Familie von Falle 10 –
  // ein gedeckelter Wert kann „drüber" nicht abstufen.
  const rot = (tageVor) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - tageVor);
    return {
      datum: d.toISOString().slice(0, 10),
      schlaf: 1, muskelkater: 2, stress: 2, stimmung: 2, energie: 1,
    };
  };
  const e = B.entlastungFaellig(verlauf(28, 5, 50), [rot(1), rot(2), rot(3)], BIS);

  assert.equal(B.bereitschaft(rot(1)).ampel, 'rot', 'Testvorlage trifft den roten Bereich');
  assert.equal(e.faellig, true, 'drei rote Tage in fünf sind eindeutig genug');
  assert.equal(e.stufe, 'faellig');
  assert.match(e.gruende[0], /roten Bereich/);
});

test('Zwei rote Checks reichen noch nicht', () => {
  // Gegenprobe: Die Stufe darf nicht bei jedem schlechten Tag anspringen.
  const rot = (tageVor) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - tageVor);
    return {
      datum: d.toISOString().slice(0, 10),
      schlaf: 1, muskelkater: 2, stress: 2, stimmung: 2, energie: 1,
    };
  };
  const gut = (tageVor) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - tageVor);
    return {
      datum: d.toISOString().slice(0, 10),
      schlaf: 5, muskelkater: 4, stress: 4, stimmung: 5, energie: 5,
    };
  };
  const e = B.entlastungFaellig(verlauf(28, 5, 50), [rot(1), rot(2), gut(3), gut(4)], BIS);
  assert.equal(e.faellig, false);
});

test('Die Bereitschaftsschwellen stehen in wissen.js', () => {
  // Sie standen als nackte 45, 65 und 60 in belastung.js – drei Zahlen auf
  // derselben Skala an zwei Stellen. Genau die Konstellation, aus der
  // irgendwann vier werden.
  assert.equal(typeof BEREITSCHAFT.rotUnter, 'number');
  assert.equal(typeof BEREITSCHAFT.gelbUnter, 'number');
  assert.ok(BEREITSCHAFT.rotUnter < BEREITSCHAFT.schwachUnter,
    'rot muss strenger sein als schwach');
  assert.ok(BEREITSCHAFT.schwachUnter < BEREITSCHAFT.gelbUnter,
    'schwach liegt zwischen rot und gelb');

  // Und die Ampel richtet sich wirklich danach.
  const knappRot = { schlaf: 2, muskelkater: 2, stress: 2, stimmung: 2, energie: 2 };
  assert.ok(B.bereitschaft(knappRot).prozent < BEREITSCHAFT.rotUnter);
  assert.equal(B.bereitschaft(knappRot).ampel, 'rot');
});

test('Der Nenner zählt nur, was auch bewertet werden konnte', () => {
  // „3 der letzten 5 Morgen-Checks im roten Bereich" – wenn zwei davon
  // unvollständig ausgefüllt waren, sind es in Wahrheit 3 von 3, also *alle*.
  // Der Satz sah nach 60 % aus. Bei einer Zahl, die eine Entlastungswoche
  // auslöst, ist das kein Schönheitsfehler; das Y muss dieselbe Grundmenge
  // meinen wie das X. Familie von Falle 10.
  const tag = (n) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const rot = (n) => ({
    datum: tag(n), schlaf: 1, muskelkater: 2, stress: 2, stimmung: 2, energie: 1,
  });
  const halb = (n) => ({ datum: tag(n), schlaf: 1, muskelkater: 2 });

  const e = B.entlastungFaellig(verlauf(28, 5, 50),
    [rot(1), rot(2), rot(3), halb(4), halb(5)], BIS);
  assert.match(e.gruende[0], /3 der letzten 3 Morgen-Checks/,
    `unvollständige Checks gehören nicht in den Nenner: „${e.gruende[0]}"`);
  assert.equal(e.faellig, true);
});

test('Bei sieben Trainingstagen bleibt die Monotonie eine Aussage', () => {
  // Der Quotient ist Schnitt durch Streuung und damit nach oben offen: Bei
  // sieben fast gleichen Tagen kommen Werte wie 122 heraus, neben einer
  // Schwelle von 2,0. Die *Note* stimmt trotzdem, und darauf kommt es an –
  // die Zahl selbst ist an diesem Ende keine Messung mehr, sondern ein
  // Artefakt der kleinen Streuung. Festgehalten wird deshalb, dass das Urteil
  // trägt, nicht ein Zahlenbereich.
  const bau = (lasten) => lasten.map((l, i) => {
    const d = new Date(BIS);
    d.setDate(d.getDate() - i);
    return { datum: d.toISOString().slice(0, 10), rpe: l.rpe, minuten: l.min };
  });

  // Völlig identisch: Streuung null, keine Aussage möglich – und das sagt sie.
  assert.equal(B.monotonie(bau(Array.from({ length: 7 }, () => ({ rpe: 6, min: 60 }))), BIS)
    .belastbar, false);

  // Realistisch gemischte Woche: sinnvoller Wert, richtige Note.
  const gemischt = B.monotonie(bau([
    { rpe: 8, min: 75 }, { rpe: 4, min: 70 }, { rpe: 7, min: 80 }, { rpe: 4, min: 60 },
    { rpe: 8, min: 70 }, { rpe: 3, min: 45 }, { rpe: 5, min: 50 },
  ]), BIS);
  assert.ok(gemischt.wert < 5, `Wert ${gemischt.wert} – bei gemischter Woche unplausibel`);
  assert.equal(gemischt.bewertbar, true);

  // Und `strain` ist weg: berechnet, nie gelesen, bei kleiner Streuung absurd.
  assert.equal(gemischt.strain, undefined);
});

test('Auch die Monotonie sagt, warum sie fehlt', () => {
  /*
   * Beide Rückfälle gaben ein nacktes `{ belastbar: false }` zurück, und die
   * Oberfläche zeigt dann **gar nichts** – keine Kennzahl, keinen Satz.
   * Daneben in derselben Karte begründet das ACWR sein Fehlen ausdrücklich.
   * Zwei Zahlen nebeneinander, eine erklärt sich, die andere verschwindet:
   * Falle 22, und die Asymmetrie ist das Erkennungszeichen.
   */
  const ohne = B.monotonie([], new Date('2026-08-10'));
  assert.equal(ohne.belastbar, false);
  assert.match(ohne.hinweis, /keine Einheit protokolliert/);

  // Sieben exakt gleiche Tage: Fosters Quotient teilt durch die Streuung.
  const gleich = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date('2026-08-10');
    d.setDate(d.getDate() - i);
    gleich.push({ datum: d.toISOString().slice(0, 10), typ: 'kraft', rpe: 7, minuten: 60 });
  }
  const eben = B.monotonie(gleich, new Date('2026-08-10'));
  assert.equal(eben.belastbar, false);
  assert.match(eben.hinweis, /Streuung/);

  // Gegenprobe: Der Normalfall trägt weiterhin eine Zahl und keinen Hinweis.
  const gemischt = [
    { datum: '2026-08-10', typ: 'kraft', rpe: 8, minuten: 70 },
    { datum: '2026-08-08', typ: 'sprint', rpe: 7, minuten: 110 },
    { datum: '2026-08-06', typ: 'ausdauerLocker', rpe: 3, minuten: 55 },
  ];
  const normal = B.monotonie(gemischt, new Date('2026-08-10'));
  assert.equal(normal.belastbar, true);
  assert.ok(normal.wert > 0);
});
