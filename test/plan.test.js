import test from 'node:test';
import assert from 'node:assert/strict';
import * as PL from '../kern/plan.js';
import { createProfil, umfangFaktoren } from '../kern/profil.js';
import { verteilung } from '../kern/ausdauer.js';
import { entlastungFaellig } from '../kern/belastung.js';
import { leistungsstand } from '../kern/leistung.js';
import {
  RPE_ERWARTUNG, UEBUNGEN, BELASTUNG, SPRINT, MUSCLEUP_STUFEN, KRAFT, AUSDAUER,
  BEREITSCHAFT,
} from '../kern/wissen.js';

function profil(ueberschreiben = {}) {
  return { ...createProfil(), wiedereinstieg: false, ...ueberschreiben };
}

const sprinttage = (plan) => plan.tage.filter((t) => t.einheiten.some((e) => e.typ === 'sprint'));

test('Phasen folgen der Blockfolge und wiederholen sich nach zwölf Wochen', () => {
  assert.equal(PL.phaseSchluessel(1), 'aufbau');
  assert.equal(PL.phaseSchluessel(4), 'entlastung');
  assert.equal(PL.phaseSchluessel(5), 'intensivierung');
  assert.equal(PL.phaseSchluessel(9), 'realisierung');
  assert.equal(PL.phaseSchluessel(12), 'entlastung');
  assert.equal(PL.phaseSchluessel(13), 'aufbau');
});

test('Jede vierte Woche ist eine Entlastungswoche', () => {
  for (const woche of [4, 8, 12]) {
    const plan = PL.wochenplan(profil(), woche);
    assert.equal(plan.entlastungswoche, true, `Woche ${woche}`);
  }
  assert.equal(PL.wochenplan(profil(), 5).entlastungswoche, false);
});

test('Sprinteinheiten halten mindestens 48 Stunden Abstand', () => {
  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 10) {
    for (const tage of [3, 4, 5, 6]) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 1);
      const indizes = sprinttage(plan).map((t) => t.tag);
      for (let i = 1; i < indizes.length; i += 1) {
        assert.ok(indizes[i] - indizes[i - 1] >= 2,
          `Ausrichtung ${ausrichtung}, ${tage} Tage: Sprint an ${indizes} liegt zu dicht`);
      }
    }
  }
});

test('Nie mehr als drei Sprinteinheiten pro Woche', () => {
  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
    const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: 6 }), 1);
    assert.ok(sprinttage(plan).length <= 3, `Ausrichtung ${ausrichtung}`);
  }
});

test('Am gemeinsamen Tag steht Sprint vor Kraft', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 20, trainingstageProWoche: 4 }), 1);
  for (const tag of plan.tage) {
    const typen = tag.einheiten.map((e) => e.typ);
    if (typen.includes('sprint') && typen.includes('kraft')) {
      assert.ok(typen.indexOf('sprint') < typen.indexOf('kraft'),
        `${tag.name}: Kraft läge vor dem Sprint`);
    }
  }
});

test('Sprintfokus erzeugt mehr Sprint- und weniger Ausdauereinheiten als Ausdauerfokus', () => {
  const sprintlastig = PL.wochenplan(profil({ ausrichtung: 0, trainingstageProWoche: 5 }), 1);
  const ausdauerlastig = PL.wochenplan(profil({ ausrichtung: 100, trainingstageProWoche: 5 }), 1);

  assert.ok(sprintlastig.verteilung.sprint > ausdauerlastig.verteilung.sprint);
  assert.ok(ausdauerlastig.verteilung.ausdauer > sprintlastig.verteilung.ausdauer);
});

test('Auch bei reinem Sprintfokus bleibt eine Ausdauereinheit stehen', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 0, trainingstageProWoche: 3 }), 1);
  assert.ok(plan.verteilung.ausdauer >= 1);
});

test('Krafttraining fällt nie ganz weg', () => {
  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 10) {
    const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: 3 }), 1);
    assert.ok(plan.verteilung.kraft >= 1, `Ausrichtung ${ausrichtung}`);
  }
});

test('Entlastungswoche senkt den Umfang deutlich', () => {
  const normal = PL.wochenplan(profil(), 3);
  const entlastung = PL.wochenplan(profil(), 4);
  assert.ok(entlastung.wochenminuten < normal.wochenminuten);
  assert.ok(entlastung.sprintmeter < normal.sprintmeter);
});

test('Wiedereinstieg reduziert die ersten beiden Wochen gestaffelt', () => {
  const mit1 = PL.wochenplan(profil({ wiedereinstieg: true }), 1);
  const mit2 = PL.wochenplan(profil({ wiedereinstieg: true }), 2);
  const ohne = PL.wochenplan(profil({ wiedereinstieg: false }), 1);

  assert.equal(mit1.wiedereinstieg, true);
  assert.equal(mit1.volumenFaktor, 0.6);
  assert.equal(mit2.volumenFaktor, 0.8);
  assert.ok(mit1.wochenminuten < ohne.wochenminuten);
  assert.equal(PL.wochenplan(profil({ wiedereinstieg: true }), 3).wiedereinstieg, false);
});

test('Prophylaxe steht in jedem Krafttraining', () => {
  const plan = PL.wochenplan(profil(), 1);
  const krafteinheiten = plan.tage.flatMap((t) => t.einheiten).filter((e) => e.typ === 'kraft');
  assert.ok(krafteinheiten.length > 0);
  for (const einheit of krafteinheiten) {
    const namen = einheit.prophylaxe.map((p) => p.name);
    assert.ok(namen.includes('Nordic Hamstring'));
    assert.ok(namen.includes('Copenhagen Adduction'));
  }
});

test('Körpergewichtsfokus tauscht die Zug- und Druckübung', () => {
  const mit = PL.wochenplan(profil({ koerpergewichtsfokus: true }), 1);
  const ohne = PL.wochenplan(profil({ koerpergewichtsfokus: false }), 1);

  const namen = (plan) => plan.tage.flatMap((t) => t.einheiten)
    .filter((e) => e.typ === 'kraft')
    .flatMap((e) => e.uebungen.map((u) => u.name));

  assert.ok(namen(mit).some((n) => n.includes('Klimmzüge')));
  assert.ok(namen(ohne).some((n) => n.includes('Latzug')));
});

const ausdauerEinheiten = (plan) =>
  plan.tage.flatMap((t) => t.einheiten).filter((e) => e.typ.startsWith('ausdauer'));

test('Ausdauer ist polarisiert: die Mehrheit locker', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 80, trainingstageProWoche: 6 }), 1);
  const ausdauer = ausdauerEinheiten(plan);
  const hart = ausdauer.filter((e) => e.typ === 'ausdauerIntervalle');
  assert.ok(hart.length <= ausdauer.length / 2,
    `${hart.length} harte von ${ausdauer.length} Ausdauereinheiten`);
});

test('Nie sind alle Ausdauereinheiten hart – über alle Reglerstände', () => {
  // Regression: slice(-0) gab früher das ganze Array zurück, wodurch
  // ausgerechnet der Fall „keine harte Einheit" jede Einheit hart machte.
  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
    for (const tage of [3, 4, 5, 6]) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 1);
      const ausdauer = ausdauerEinheiten(plan);
      if (ausdauer.length < 2) continue;
      const hart = ausdauer.filter((e) => e.typ === 'ausdauerIntervalle');
      assert.ok(hart.length < ausdauer.length,
        `Ausrichtung ${ausrichtung}, ${tage} Tage: alle ${ausdauer.length} Ausdauereinheiten hart`);
    }
  }
});

test('Wer den Plan genau befolgt, wird dafür nicht gewarnt', () => {
  // Der Tracker hat sich über seinen eigenen Plan beschwert: In 21 von 28
  // Kombinationen aus Reglerstand und Trainingstagen kam die
  // Intensitätsverteilung als Warnung zurück – bei Nils' Voreinstellung
  // (Regler 30, 4 Tage) mit „ohne harte Anteile fehlt der Reiz nach oben",
  // obwohl derselbe Plan zwei Sprinteinheiten bei RPE 8 vorsieht.
  //
  // Der Test spielt zwölf Wochen Plan als Tagebuch durch – mit genau dem RPE,
  // den der Plan für die Einheit erwartet – und hält das Ergebnis gegen die
  // eigene Auswertung. Ein Plan, dem der Tracker widerspricht, ist entweder
  // als Plan falsch oder als Maßstab.
  const bis = new Date('2026-08-10');
  const start = new Date(bis);
  start.setDate(start.getDate() - 12 * 7);

  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 10) {
    for (const tage of [3, 4, 5, 6]) {
      const p = profil({ ausrichtung, trainingstageProWoche: tage });
      const sessions = [];
      for (let woche = 1; woche <= 12; woche += 1) {
        for (const tag of PL.wochenplan(p, woche).tage) {
          for (const e of tag.einheiten) {
            const d = new Date(start);
            d.setDate(d.getDate() + (woche - 1) * 7 + tag.tag);
            sessions.push({
              datum: d.toISOString().slice(0, 10),
              typ: e.typ,
              minuten: e.minuten,
              rpe: RPE_ERWARTUNG[e.typ] ?? 5,
            });
          }
        }
      }

      const v = verteilung(sessions, bis, 28);
      assert.ok(v.bewertbar, `Regler ${ausrichtung}, ${tage} Tage: nicht bewertbar`);
      assert.equal(v.stufe, 'gut',
        `Regler ${ausrichtung}, ${tage} Tage: der Tracker warnt vor seinem eigenen Plan – `
        + `${Math.round(v.anteil.locker * 100)}/${Math.round(v.anteil.grauzone * 100)}/`
        + `${Math.round(v.anteil.hart * 100)} (l/g/h): ${v.text}`);
      // Und die Grauzone bleibt in jedem Fall leer – das ist der Teil, der bei
      // jedem Umfang zählt.
      assert.equal(v.anteil.grauzone, 0, `Regler ${ausrichtung}, ${tage} Tage`);
    }
  }
});

test('Der Plan löst keine Entlastungswarnung aus – und die Warnung ist trotzdem scharf', () => {
  // Zweite Auflage desselben Gedankens: Plan hinein, Belastungssteuerung
  // heraus. Beide Richtungen müssen stimmen, sonst prüft man nur eine Hälfte.
  //
  // Die zweite Richtung ist hier die wichtigere. Die Entlastung verlangt zwei
  // Gründe von vier – und einer davon, die Monotonie, konnte unter sechs
  // Trainingstagen rechnerisch nie eintreten. Ein „keine Warnung"-Test allein
  // hätte das nie bemerkt: Ein Melder, der nie meldet, besteht ihn glänzend.
  // Bündig ausrichten: Woche 12 läuft von `tag` 0 bis 6, ihr letzter Tag muss
  // auf `bis` fallen. Mit start = bis - 84 lag die ganze letzte Woche einen Tag
  // zu früh und fiel teilweise aus dem 7-Tage-Fenster – dann misst man den
  // Rand des Aufbaus und nicht den Belastungssprung.
  const bis = new Date('2026-08-10');
  const start = new Date(bis);
  start.setDate(start.getDate() - (12 * 7 - 1));

  const tagebuch = (p) => {
    const sessions = [];
    const checks = [];
    for (let woche = 1; woche <= 12; woche += 1) {
      for (const tag of PL.wochenplan(p, woche).tage) {
        const d = new Date(start);
        d.setDate(d.getDate() + (woche - 1) * 7 + tag.tag);
        const datum = d.toISOString().slice(0, 10);
        for (const e of tag.einheiten) {
          sessions.push({ datum, typ: e.typ, minuten: e.minuten, rpe: RPE_ERWARTUNG[e.typ] ?? 5 });
        }
        // Der Morgen-Check ist täglich gedacht, nicht nur an Trainingstagen.
        checks.push({
          datum, schlaf: 4, muskelkater: 4, stress: 4, stimmung: 4, energie: 4, ruhepuls: 54,
        });
      }
    }
    return { sessions, checks };
  };

  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 25) {
    for (const tage of [3, 4, 5, 6]) {
      const p = profil({ ausrichtung, trainingstageProWoche: tage });
      const { sessions, checks } = tagebuch(p);

      const e = entlastungFaellig(sessions, checks, bis);
      assert.equal(e.faellig, false,
        `Regler ${ausrichtung}, ${tage} Tage: Entlastung gefordert, obwohl der Plan `
        + `genau so befolgt wurde – ${e.gruende.join(' / ')}`);
      assert.equal(e.stufe, 'keine',
        `Regler ${ausrichtung}, ${tage} Tage: ${e.gruende.join(' / ')}`);

      // Gegenprobe: derselbe Verlauf mit einem echten Belastungssprung in der
      // letzten Woche und eingebrochener Bereitschaft muss anschlagen.
      const grenze = new Date(bis);
      grenze.setDate(grenze.getDate() - 7);
      const sprung = sessions.filter((s) => new Date(s.datum) > grenze)
        .flatMap((s) => [{ ...s }, { ...s }, { ...s }]);
      const eingebrochen = checks.map((c) => (new Date(c.datum) > grenze
        ? { ...c, schlaf: 2, muskelkater: 2, stress: 2, stimmung: 2, energie: 2 }
        : c));
      const alarm = entlastungFaellig([...sessions, ...sprung], eingebrochen, bis);
      assert.equal(alarm.faellig, true,
        `Regler ${ausrichtung}, ${tage} Tage: vierfacher Umfang bei 40 % Bereitschaft `
        + `bleibt unbemerkt – nur ${alarm.gruende.length} Grund/Gründe: `
        + `${alarm.gruende.join(' / ') || 'keiner'}`);
    }
  }
});

test('Bei wenigen Ausdauereinheiten sind sie durchweg locker', () => {
  // Sprintfokus: die harte Intensität kommt aus den Sprints, nicht aus der Ausdauer.
  const plan = PL.wochenplan(profil({ ausrichtung: 25, trainingstageProWoche: 4 }), 1);
  const ausdauer = ausdauerEinheiten(plan);
  assert.ok(ausdauer.length > 0);
  assert.ok(ausdauer.every((e) => e.typ === 'ausdauerLocker'),
    ausdauer.map((e) => e.typ).join(', '));
});

test('Sprintstrecken bleiben im Bereich der Höchstgeschwindigkeit', () => {
  // Längere Läufe wären Tempohärte, nicht Schnelligkeit. Zusätzliches Volumen
  // muss über Sätze kommen – deshalb darf die Strecke nie mitwachsen.
  for (let woche = 1; woche <= 12; woche += 1) {
    for (const ausrichtung of [0, 15, 30]) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: 4 }), woche);
      for (const einheit of plan.tage.flatMap((t) => t.einheiten)) {
        if (einheit.typ !== 'sprint') continue;
        const block = einheit.bloecke.find((b) => /× \d+ m$/.test(b.titel));
        const [, laeufe, distanz] = block.titel.match(/(\d+) × (\d+) m$/);
        assert.ok(Number(distanz) <= 40,
          `Woche ${woche}: ${distanz} m ist zu lang für Höchstgeschwindigkeit`);
        assert.ok(Number(laeufe) <= 16, `Woche ${woche}: ${laeufe} Läufe`);
        assert.equal(einheit.meter, Number(laeufe) * Number(distanz));
      }
    }
  }
});

test('Realisierung hat weniger Sprintumfang als Intensivierung', () => {
  // Die Phasen müssen sich im Umfang unterscheiden – sonst ist die
  // Periodisierung nur ein Etikett. Vorher deckelte die Qualitätsgrenze beide
  // auf denselben Wert.
  const p = profil({ ausrichtung: 25, trainingstageProWoche: 4, wiedereinstieg: false });
  const intensivierung = PL.wochenplan(p, 5);
  const realisierung = PL.wochenplan(p, 9);
  assert.ok(realisierung.sprintmeter < intensivierung.sprintmeter,
    `Intensivierung ${intensivierung.sprintmeter} m, Realisierung ${realisierung.sprintmeter} m`);
});

test('Sprintumfang der Woche bleibt in der Größenordnung der Literatur', () => {
  // Haugen 2019: 1000–2000 m hochwertiger Sprint pro Woche. Nach unten darf der
  // Qualitätsdeckel abweichen, nach oben nicht.
  for (const ausrichtung of [0, 15, 30]) {
    for (const woche of [1, 5, 9]) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: 5 }), woche);
      assert.ok(plan.sprintmeter <= 2000,
        `Ausrichtung ${ausrichtung}, Woche ${woche}: ${plan.sprintmeter} m`);
    }
  }
});

test('Laufen bei Sprintfokus erzeugt eine Warnung', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 20, ausdauerGeraet: 'laufen' }), 1);
  assert.ok(plan.hinweise.some((h) => h.art === 'warnung' && h.text.includes('Laufen')));

  const rad = PL.wochenplan(profil({ ausrichtung: 20, ausdauerGeraet: 'rad' }), 1);
  assert.ok(!rad.hinweise.some((h) => h.text.includes('Laufen als Ausdauergerät')));
});

test('Kraft und Ausdauer am selben Tag lösen den Abstandshinweis aus', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 70, trainingstageProWoche: 3 }), 1);
  const doppelt = plan.tage.some((t) => {
    const typen = t.einheiten.map((e) => e.typ);
    return typen.includes('kraft') && typen.some((x) => x.startsWith('ausdauer'));
  });
  if (doppelt) {
    assert.ok(plan.hinweise.some((h) => h.text.includes('6 h')));
  }
});

test('Vorgegebene Last passt zur vorgegebenen Wiederholungszahl', () => {
  // Regression: Hip Thrust stand mit „6–7 Wiederholungen bei 85–92 % 1RM" im
  // Plan. Das ist nicht ausführbar – 90 % des Maximums gehen keine sieben Mal.
  // Die Last wird deshalb aus der Wiederholungszahl abgeleitet.
  const leistung = {
    maxima: { kniebeuge: { e1rm: 120 }, hipthrust: { e1rm: 160 } },
    letzte: {},
    koerpergewichtKg: 80,
  };
  for (const woche of [1, 5, 9]) {
    const plan = PL.wochenplan(profil({ ausrichtung: 25 }), woche, leistung);
    const kraft = plan.tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
    for (const u of kraft.uebungen) {
      if (!u.gewicht || u.koerpergewicht) continue;
      const [repMin, repMax] = u.repBereich;
      // Aus der Epley-Umkehrung: Bei dieser Last müssen mindestens so viele
      // Wiederholungen möglich sein, wie der Plan verlangt.
      const moeglichBeiTopLast = 30 * (u.gewicht.bis === 0 ? 0
        : (u.gewicht.e1rm / u.gewicht.bis) - 1);
      assert.ok(moeglichBeiTopLast >= repMin - 0.5,
        `Woche ${woche}, ${u.name}: ${u.gewicht.bis} kg erlauben nur `
        + `${moeglichBeiTopLast.toFixed(1)} Wiederholungen, verlangt sind ${repMin}–${repMax}`);
    }
  }
});

test('Progressionsvorschlag widerspricht der Lastvorgabe nicht grob', () => {
  // Beide Zahlen stehen nebeneinander im Plan. Weichen sie stark ab, weiß
  // niemand, welche gilt.
  const leistung = {
    maxima: { frontKniebeuge: { e1rm: 105 } },
    letzte: {
      frontKniebeuge: {
        topGewicht: 85,
        ohneFortschritt: 1,
        saetze: [{ gewicht: 85, wiederholungen: 5 }, { gewicht: 85, wiederholungen: 5 }],
      },
    },
    koerpergewichtKg: 80,
  };
  const plan = PL.wochenplan(profil({ ausrichtung: 25 }), 5, leistung);
  const kraft = plan.tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
  const beuge = kraft.uebungen.find((u) => u.schluessel === 'frontKniebeuge');

  assert.ok(beuge.vorschlag, 'Vorschlag fehlt');
  const abstand = Math.abs(beuge.vorschlag.empfehlung - beuge.gewicht.bis) / beuge.gewicht.bis;
  assert.ok(abstand < 0.2,
    `Plan sagt ${beuge.gewicht.von}–${beuge.gewicht.bis} kg, `
    + `Vorschlag sagt ${beuge.vorschlag.empfehlung} kg`);
});

test('Gelenkschonende Auswahl ist der Standard und lässt sich abschalten', () => {
  const schluessel = (p, woche) => PL.wochenplan(p, woche).tage
    .flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft')
    .uebungen.map((u) => u.schluessel);

  const standard = schluessel(profil({ ausrichtung: 25 }), 5);
  assert.ok(standard.includes('frontKniebeuge'), standard.join(', '));
  assert.ok(standard.includes('trapbarKreuzheben'), standard.join(', '));
  assert.ok(!standard.includes('kniebeuge'));

  const klassisch = schluessel(profil({ ausrichtung: 25, gelenkschonend: false }), 5);
  assert.ok(klassisch.includes('kniebeuge'), klassisch.join(', '));
  assert.ok(klassisch.includes('kreuzheben'), klassisch.join(', '));
});

test('Der Hüftzug wechselt mit der Phase', () => {
  // Im Aufbau das rumänische Kreuzheben, weil es die Hamstrings unter Dehnung
  // belastet und damit selbst schützt. In den schweren Blöcken die
  // Sechskantstange, weil dort hohe Lasten gefragt sind.
  const schluessel = (woche) => PL.wochenplan(profil({ ausrichtung: 25 }), woche).tage
    .flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft')
    .uebungen.map((u) => u.schluessel);

  assert.ok(schluessel(1).includes('rumaenischesKreuzheben'), 'Aufbau ohne RDL');
  assert.ok(schluessel(5).includes('trapbarKreuzheben'), 'Intensivierung ohne Sechskantstange');
});

test('Jede Krafteinheit deckt Hamstrings, Leiste und Achillessehne ab', () => {
  // Das sind die drei Bereiche mit eigenen, belegten Schutzprogrammen. Fällt
  // einer raus, verliert das Programm messbaren Schutz.
  for (let woche = 1; woche <= 12; woche += 1) {
    for (const ausrichtung of [0, 50, 100]) {
      const plan = PL.wochenplan(profil({ ausrichtung }), woche);
      const kraft = plan.tage.flatMap((t) => t.einheiten).filter((e) => e.typ === 'kraft');
      assert.ok(kraft.length > 0, `Woche ${woche}: keine Krafteinheit`);
      for (const einheit of kraft) {
        const namen = einheit.prophylaxe.map((p) => p.schluessel);
        for (const pflicht of ['nordic', 'copenhagen', 'wadenheben']) {
          assert.ok(namen.includes(pflicht),
            `Woche ${woche}, Ausrichtung ${ausrichtung}: ${pflicht} fehlt`);
        }
      }
    }
  }
});

test('Sprinteinheiten enthalten das neuromuskuläre Aufwärmen', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 20 }), 1);
  const sprint = plan.tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'sprint');
  const block = sprint.bloecke.find((b) => b.schluessel === 'einbeinstand');
  assert.ok(block, 'Neuromuskulärer Block fehlt');
  assert.match(block.inhalt, /Sprunggelenk/);
});

/* ------------------------------------------------ Anpassung an die Tagesform */

const gruen = { vollstaendig: true, ampel: 'gruen', prozent: 85 };
const gelb = { vollstaendig: true, ampel: 'gelb', prozent: 55 };
const rot = { vollstaendig: true, ampel: 'rot', prozent: 35 };

const einheitVom = (typ, woche = 5) => PL.wochenplan(profil({ ausrichtung: 25 }), woche)
  .tage.flatMap((t) => t.einheiten).find((e) => e.typ === typ);

test('Grüne Ampel lässt die Einheit unverändert', () => {
  const original = einheitVom('kraft');
  assert.equal(PL.angepassteEinheit(original, gruen), original);
  assert.equal(PL.angepassteEinheit(original, null), original);
  assert.equal(PL.angepassteEinheit(original, { vollstaendig: false }), original);
});

test('Gelbe Ampel kürzt den Umfang, hält aber die Lasten', () => {
  const original = einheitVom('kraft');
  const angepasst = PL.angepassteEinheit(original, gelb);

  assert.equal(angepasst.anpassung.art, 'gekuerzt');
  assert.ok(angepasst.minuten < original.minuten);

  for (let i = 0; i < original.uebungen.length; i += 1) {
    assert.ok(angepasst.uebungen[i].saetze <= original.uebungen[i].saetze,
      `${original.uebungen[i].name}: Sätze nicht gekürzt`);
    // Die Last ist das, was die Anpassung erhält – sie darf sich nicht ändern.
    assert.equal(angepasst.uebungen[i].intensitaet, original.uebungen[i].intensitaet,
      `${original.uebungen[i].name}: Last wurde verändert`);
  }
});

test('Keine Übung fällt durch die Kürzung ganz weg', () => {
  const original = einheitVom('kraft');
  for (const stand of [gelb, rot]) {
    const angepasst = PL.angepassteEinheit(original, stand);
    assert.equal(angepasst.uebungen.length, original.uebungen.length);
    for (const u of angepasst.uebungen) {
      assert.ok(u.saetze >= 1, `${u.name} auf null Sätze gekürzt`);
    }
  }
});

test('Prophylaxe bleibt auch bei roter Ampel vollständig', () => {
  // Vier Minuten Aufwand, kaum Ermüdung – und ausgerechnet an schlechten Tagen
  // ist das Verletzungsrisiko am höchsten.
  const original = einheitVom('kraft');
  const angepasst = PL.angepassteEinheit(original, rot);
  assert.deepEqual(
    angepasst.prophylaxe.map((p) => p.schluessel),
    original.prophylaxe.map((p) => p.schluessel));
});

test('Rote Ampel streicht die harte Einheit statt sie zu kürzen', () => {
  const sprint = einheitVom('sprint');
  const angepasst = PL.angepassteEinheit(sprint, rot);

  assert.equal(angepasst.anpassung.art, 'gestrichen');
  assert.equal(angepasst.typ, 'mobilitaet');
  assert.equal(angepasst.meter, 0);
  assert.ok(angepasst.minuten < sprint.minuten);
  assert.equal(angepasst.anpassung.original.titel, sprint.titel);
});

test('Gelbe Ampel kürzt den Sprint, streicht ihn aber nicht', () => {
  const sprint = einheitVom('sprint');
  const angepasst = PL.angepassteEinheit(sprint, gelb);
  assert.equal(angepasst.anpassung.art, 'gekuerzt');
  assert.equal(angepasst.typ, 'sprint');
  assert.ok(angepasst.meter < sprint.meter && angepasst.meter > 0);
});

test('Aufwärmen wird nicht mitgekürzt', () => {
  // Bei schlechter Tagesform ist es der wichtigste Teil, nicht der entbehrlichste.
  const sprint = einheitVom('sprint');
  const angepasst = PL.angepassteEinheit(sprint, gelb);

  for (const titel of ['Anlauf', 'Neuromuskulär', 'Steigerungen', 'Auslaufen']) {
    const vorher = sprint.bloecke.find((b) => b.titel.startsWith(titel));
    const nachher = angepasst.bloecke.find((b) => b.titel.startsWith(titel));
    if (!vorher) continue;
    assert.equal(nachher.minuten, vorher.minuten, `${titel} wurde gekürzt`);
  }
});

test('Die Dauer einer Einheit ist die Summe ihrer Blöcke', () => {
  // Die Intervalleinheit rechnete ihre Minuten aus dem Volumenfaktor, während
  // ihre Blöcke in jeder Woche „5 × 3 min hart" beschrieben: In der
  // Entlastungswoche stand „38 min" über exakt derselben Einheit, die in der
  // Spitzenwoche 60 Minuten hieß. Die Zahl geht in den Kalorienbedarf und in
  // die Belastungsrechnung – sie muss das beschreiben, was danebensteht.
  //
  // Gilt auch für die an die Tagesform angepasste Fassung, denn dort werden
  // die Blöcke einzeln gekürzt.
  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 20) {
    for (let woche = 1; woche <= 12; woche += 1) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: 5 }), woche);
      for (const einheit of plan.tage.flatMap((t) => t.einheiten)) {
        for (const fassung of [einheit, PL.angepassteEinheit(einheit, gelb), PL.angepassteEinheit(einheit, rot)]) {
          if (!fassung.bloecke) continue;
          const summe = fassung.bloecke.reduce((s, b) => s + b.minuten, 0);
          assert.equal(fassung.minuten, summe,
            `Woche ${woche}, ${fassung.titel}: Kopf sagt ${fassung.minuten} min, `
            + `die Blöcke ergeben ${summe}`);
        }
      }
    }
  }
});

test('Die Meter der Sprinteinheit stehen so auch im Block', () => {
  // Die gekürzte Fassung rechnete `meter` mit dem Faktor herunter und ließ die
  // Überschrift stehen: Kopf „322 m", Block „16 × 30 m … aufgeteilt in 4 Sätze
  // à 4" – also 480 m. Wer die Einheit liest, läuft die 16. Und 322 sind nicht
  // durch 30 teilbar; eine Sprinteinheit besteht aus ganzen Läufen.
  for (let ausrichtung = 0; ausrichtung <= 60; ausrichtung += 20) {
    for (let woche = 1; woche <= 12; woche += 1) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: 4 }), woche);
      for (const sprint of plan.tage.flatMap((t) => t.einheiten).filter((e) => e.typ === 'sprint')) {
        for (const fassung of [sprint, PL.angepassteEinheit(sprint, gelb)]) {
          // Rot streicht die Einheit statt sie zu kürzen – dann ist meter 0.
          if (fassung.typ !== 'sprint') continue;
          const block = fassung.bloecke.find((b) => /×\s*\d+\s*m/.test(b.titel));
          const [, laeufe, distanz] = block.titel.match(/(\d+)\s*×\s*(\d+)\s*m/);
          assert.equal(fassung.meter, Number(laeufe) * Number(distanz),
            `Woche ${woche}: Kopf sagt ${fassung.meter} m, Block sagt „${block.titel}"`);
          // Dass Überschrift und Aufteilungstext zusammenpassen, prüft der Test
          // zu `satzAufteilung()` – die gekürzte Fassung wird von derselben
          // Funktion gebaut und ist damit mit abgedeckt.
        }
      }
    }
  }
});

test('Die Zahl der Intervalle folgt dem Volumen, nicht nur die Minutenzahl', () => {
  const intervalle = (woche) => PL.wochenplan(profil({ ausrichtung: 60, trainingstageProWoche: 5 }), woche)
    .tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'ausdauerIntervalle');

  const spitze = intervalle(3);
  const entlastung = intervalle(4);
  assert.ok(spitze && entlastung, 'keine Intervalleinheit im Plan');

  const zahl = (e) => Number(e.bloecke.find((b) => /hart/.test(b.titel)).titel.match(/^(\d+) ×/)[1]);
  assert.ok(zahl(entlastung) < zahl(spitze),
    `Entlastungswoche schreibt ${zahl(entlastung)} Intervalle vor, Spitzenwoche ${zahl(spitze)}`);
});

test('Der Sprintumfang der Woche ist der aus wissen.js', () => {
  // Die Phasenabstufung stand zweimal da: einmal als `wochenumfangMeter` je
  // Phase, einmal als `PHASEN[…].volumenFaktor` – und wurde zweimal angewandt.
  // Die Entlastungswoche plante deshalb 240 m, während in der Evidenzbasis 450
  // stand und der Vergleich mit Haugen 2019 gegen die 450 geführt wurde.
  //
  // Abgezogen werden darf nur, was die Qualitätsgrenze wegnimmt: Mehr Meter
  // über längere Läufe wäre Tempohärte, mehr Läufe je Einheit als
  // `maxLaeufeProEinheit` wäre Umfang ohne Qualität.
  for (const woche of [3, 4, 5, 9]) {
    const plan = PL.wochenplan(profil({ ausrichtung: 30, trainingstageProWoche: 4 }), woche);
    const sprints = plan.tage.flatMap((t) => t.einheiten).filter((e) => e.typ === 'sprint');
    if (!sprints.length) continue;

    const maxLaeufe = SPRINT.maxLaeufeProEinheit[
      plan.phase.sprintFokus === 'beschleunigung' ? 'beschleunigung' : 'maximalgeschwindigkeit'];
    const obergrenze = sprints.length * maxLaeufe * 30;
    // Der Regler skaliert den Umfang mit – sonst fielen zwanzig
    // Reglerstellungen auf sieben Wochen zusammen, siehe Falle 46.
    const ziel = SPRINT.wochenumfangMeter[plan.phase.schluessel]
      * umfangFaktoren(30).sprint;
    const erwartet = Math.min(ziel, obergrenze);

    // Ein Lauf je Sprinttag Spielraum: Der Umfang wird je Einheit auf ganze
    // Läufe gerundet.
    assert.ok(Math.abs(plan.sprintmeter - erwartet) <= 30 * sprints.length,
      `Woche ${woche} (${plan.phase.schluessel}): geplant ${plan.sprintmeter} m, `
      + `aus wissen.js und Regler folgen ${Math.round(erwartet)} m`);
  }
});

const satzSumme = (liste) => (liste || []).reduce((s, u) => s + u.saetze, 0);

test('Der Plan kennt den Stand auf dem Muscle-Up-Weg', () => {
  // Der Muscle-Up ist das erklärte Hauptziel, `muscleupStand()` rechnet den
  // Stand samt konkretem Tor – und der Planer sah ihn nie. Auf Stufe 1
  // („8 saubere Klimmzüge") stand dieselbe Vorgabe wie auf Stufe 6
  // („Hände lösen sich kurz von der Stange"): 3 × 6–12, ohne ein Wort dazu,
  // worauf das hinarbeitet.
  const daten = (tests, manuell = {}) => ({
    profil: profil({ gewichtKg: 78 }), tests, sessions: [], muscleup: { manuell },
  });
  const klimmzugHinweis = (d) => {
    const stand = leistungsstand(d);
    const kraft = PL.wochenplan(d.profil, 1, stand)
      .tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
    // Ohne Körpergewichtsfokus heißt die Zugübung „latzug" – gesucht ist die
    // Zugübung, nicht ein fester Schlüssel.
    return kraft.uebungen.find((u) => ['klimmzuege', 'latzug'].includes(u.schluessel)).hinweis;
  };

  const anfang = klimmzugHinweis(daten([]));
  const weiter = klimmzugHinweis(daten(
    [{ art: 'klimmzuege', wert: 12, datum: '2026-08-01' },
      { art: 'klimmzugZusatzlast', wert: 20, datum: '2026-08-01' }],
    { 4: true, 5: true, 6: true },
  ));

  assert.match(anfang, /Muscle-Up-Weg/, 'die Vorgabe nennt das nächste Tor nicht');
  assert.notEqual(anfang, weiter,
    'die Vorgabe ist auf Stufe 0 dieselbe wie auf Stufe 6 – der Plan kennt den Stand nicht');
  assert.match(weiter, new RegExp(MUSCLEUP_STUFEN[6].tor.slice(0, 20)),
    'genannt wird nicht die Stufe, die tatsächlich ansteht');

  // Ohne Körpergewichtsfokus gibt es den Weg nicht – dann steht dort auch
  // nichts davon, sonst wäre es eine Vorgabe für ein Ziel, das niemand hat.
  const ohne = klimmzugHinweis({ ...daten([]), profil: profil({ koerpergewichtsfokus: false }) });
  assert.doesNotMatch(ohne, /Muscle-Up-Weg/);

  // Und der Satz steht genau einmal je Einheit, an der Übung, die das Tor
  // trainiert. Vorher stand er unter Klimmzügen *und* Dips – bei Stufe 5
  // („Straight-Bar-Dips") also auch unter der falschen der beiden.
  for (const stufe of MUSCLEUP_STUFEN) {
    assert.ok(['klimmzuege', 'dips'].includes(stufe.uebung),
      `Stufe ${stufe.stufe} hängt an keiner Übung des Plans`);
  }
  const d = daten([], { 4: true });
  const stand = leistungsstand(d);
  const kraft = PL.wochenplan(d.profil, 1, stand)
    .tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
  const mitTor = kraft.uebungen.filter((u) => /Muscle-Up-Weg/.test(u.hinweis));
  assert.equal(mitTor.length, 1,
    `${mitTor.length} Übungen nennen dasselbe Tor: ${mitTor.map((u) => u.name).join(', ')}`);
});

test('Die Dauer einer Krafteinheit folgt ihren Sätzen', () => {
  // Vorher stand die Dauer als „15 + Übungen × 9 + Prophylaxe × 4" im Planer
  // und kannte die Satzzahl nicht: 76 Minuten in jeder Woche, in der
  // Entlastungswoche mit 10 Sätzen genauso wie in der Spitzenwoche mit 13.
  // Die Minuten gehen in den Kalorienbedarf – das war keine Beschriftungsfrage.
  const einheiten = [];
  for (let woche = 1; woche <= 12; woche += 1) {
    const k = PL.wochenplan(profil({ ausrichtung: 30, trainingstageProWoche: 4 }), woche)
      .tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
    if (k) einheiten.push({ woche, saetze: satzSumme(k.uebungen), minuten: k.minuten, absicht: k.absicht });
  }

  const spannweite = new Set(einheiten.map((e) => e.minuten));
  assert.ok(spannweite.size > 1,
    `alle zwölf Wochen gleich lang (${[...spannweite]} min) – die Dauer sieht die Sätze nicht`);

  // Innerhalb derselben Absicht gilt: mehr Sätze, mehr Minuten. Über die
  // Absichten hinweg nicht, weil Maximalkraft längere Pausen braucht.
  for (const absicht of new Set(einheiten.map((e) => e.absicht))) {
    const gleich = einheiten.filter((e) => e.absicht === absicht);
    for (const a of gleich) {
      for (const b of gleich) {
        if (a.saetze === b.saetze) assert.equal(a.minuten, b.minuten);
        else assert.equal(a.saetze < b.saetze, a.minuten < b.minuten,
          `Woche ${a.woche} (${a.saetze} Sätze, ${a.minuten} min) gegen `
          + `Woche ${b.woche} (${b.saetze} Sätze, ${b.minuten} min)`);
      }
    }
  }
});

test('Die gekürzte Krafteinheit verliert nicht mehr Zeit als Sätze', () => {
  // Aufwärmen und Prophylaxe bleiben ausdrücklich stehen. Die Minuten dürfen
  // deshalb nicht stärker fallen als die Satzzahl – vorher wurden sie pauschal
  // mit dem Faktor multipliziert und behaupteten für eine halbierte Einheit
  // 38 Minuten, während die Sätze nur von 13 auf 8 gingen.
  for (const stand of [gelb, rot]) {
    const original = einheitVom('kraft');
    const angepasst = PL.angepassteEinheit(original, stand);
    const satzAnteil = satzSumme(angepasst.uebungen) / satzSumme(original.uebungen);
    const zeitAnteil = angepasst.minuten / original.minuten;
    assert.ok(zeitAnteil >= satzAnteil,
      `${stand.ampel}: Zeit auf ${Math.round(zeitAnteil * 100)} %, Sätze auf `
      + `${Math.round(satzAnteil * 100)} % – die ungekürzten Teile fehlen in der Rechnung`);
  }
});

test('Die Begründung nennt die Sätze, die übrig bleiben', () => {
  // Bei zwei Sätzen je Übung ergeben „ein Drittel weniger" und „die Hälfte
  // weniger" dieselbe Vorgabe. Solange die Minuten pauschal gerechnet wurden,
  // sah man das nicht – der Text darf keinen Bruchteil behaupten, den die
  // Einheit nicht liefert.
  const original = einheitVom('kraft');
  for (const stand of [gelb, rot]) {
    const angepasst = PL.angepassteEinheit(original, stand);
    assert.match(angepasst.warum,
      new RegExp(`${satzSumme(original.uebungen)} Sätzen auf ${satzSumme(angepasst.uebungen)}`));
    assert.doesNotMatch(angepasst.warum, /halbiert|ein Drittel/);
  }
});

test('Die Anpassung merkt sich das Original', () => {
  const original = einheitVom('kraft');
  const angepasst = PL.angepassteEinheit(original, gelb);
  assert.equal(angepasst.anpassung.original.minuten, original.minuten);
  assert.match(angepasst.anpassung.grund, /Bereitschaft/);
});

test('Trainingswoche zählt ab dem Startdatum', () => {
  assert.equal(PL.trainingswoche('2026-08-03', new Date('2026-08-07')), 1);
  assert.equal(PL.trainingswoche('2026-08-03', new Date('2026-08-10')), 2);
  assert.equal(PL.trainingswoche('2026-09-01', new Date('2026-08-07')), 0);
  assert.equal(PL.trainingswoche(null, new Date('2026-08-07')), 1);
});

test('Jeder Trainingstag hat Einheiten, jeder freie Tag keine', () => {
  const plan = PL.wochenplan(profil({ trainingstageProWoche: 4 }), 1);
  for (const tag of plan.tage) {
    assert.equal(tag.trainingstag, tag.einheiten.length > 0, tag.name);
    if (tag.trainingstag) assert.ok(tag.minuten > 0, `${tag.name} ohne Dauer`);
  }
});

test('Sprinteinheiten tragen konkrete Meter und Blöcke', () => {
  const plan = PL.wochenplan(profil({ ausrichtung: 10 }), 1);
  const sprint = plan.tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'sprint');
  assert.ok(sprint.meter > 0);
  assert.ok(sprint.bloecke.length >= 4);
  assert.ok(sprint.warum.length > 20);
});

/* ------------------------------------------------------- Satzaufteilung */

test('Die Sätze ergeben zusammen genau die Läufe', () => {
  // Der Fehler im Plan: „4 × 30 m … aufgeteilt in 1 Sätze à 5". Die
  // Überschrift zählte Läufe, der Text rechnete Sätze mal Satzgröße – und bei
  // jedem Umfang, der nicht glatt aufging, standen zwei Zahlen für dieselbe
  // Sache da. In der Entlastungswoche war das der Normalfall.
  for (let laeufe = 1; laeufe <= 24; laeufe += 1) {
    for (const proSatz of [4, 5, 6]) {
      const v = PL.satzAufteilung(laeufe, proSatz);
      assert.equal(v.reduce((s, n) => s + n, 0), laeufe,
        `${laeufe} Läufe à ${proSatz}: ${v.join('+')}`);
      assert.ok(v.every((n) => n >= 1), `leerer Satz bei ${laeufe}/${proSatz}`);
      assert.ok(Math.max(...v) <= proSatz, `Satz zu groß bei ${laeufe}/${proSatz}`);
      // Kein Restsatz, der kaum noch eine Serie ist: Die lange Satzpause davor
      // war für einen vollen Satz gedacht.
      assert.ok(Math.max(...v) - Math.min(...v) <= 1,
        `ungleich verteilt bei ${laeufe}/${proSatz}: ${v.join('+')}`);
    }
  }
});

test('Ein einzelner Satz heißt nicht „1 Sätze"', () => {
  assert.equal(PL.aufteilungText([4]), 'in einem Satz');
  assert.equal(PL.aufteilungText([5, 5]), 'aufgeteilt in 2 Sätze à 5');
  assert.equal(PL.aufteilungText([5, 4, 4]), 'aufgeteilt in 3 Sätze (5 + 4 + 4)');
});

test('Der Sprintblock nennt überall dieselbe Zahl Läufe', () => {
  // Über alle zwölf Wochen: Was in der Überschrift steht, muss im Text
  // aufgehen. Die Entlastungswochen sind der Fall, der vorher brach.
  const p = profil({ ausrichtung: 20, trainingstageProWoche: 4, gewichtKg: 78 });
  for (let woche = 1; woche <= 12; woche += 1) {
    for (const tag of PL.wochenplan(p, woche).tage) {
      for (const einheit of tag.einheiten.filter((e) => e.typ === 'sprint')) {
        const block = einheit.bloecke.find((b) => /^(Beschleunigung|Fliegende Sprints):/.test(b.titel));
        if (!block) continue;

        const ausTitel = Number(block.titel.match(/(\d+) ×/)[1]);
        const summe = block.inhalt.includes('in einem Satz')
          ? ausTitel
          : block.inhalt.match(/à (\d+)/)
            ? Number(block.inhalt.match(/aufgeteilt in (\d+) Sätze à (\d+)/)[1])
              * Number(block.inhalt.match(/aufgeteilt in (\d+) Sätze à (\d+)/)[2])
            : block.inhalt.match(/\(([\d + ]+)\)/)[1].split('+').reduce((s, n) => s + Number(n), 0);

        assert.equal(summe, ausTitel,
          `Woche ${woche}, ${tag.name}: „${block.titel}" gegen „${block.inhalt.slice(0, 90)}"`);
      }
    }
  }
});

test('Vorgabe und Progressionsvorschlag widersprechen sich in keiner Woche', () => {
  // Der geschlossene Kreis: Der Planer holt Lasten aus leistung.js, was
  // protokolliert wird fließt über einerMaxima() in den nächsten Plan. Diese
  // Rückkopplung ist nie durchgespielt worden – alle Einzeltests geben
  // leistung.js von Hand gebaute Daten.
  //
  // Beide Zahlen stehen in der Planansicht in derselben Zeile. Im
  // Realisierungsblock (Explosivkraft, 30–60 % 1RM) stand unter der Vorgabe
  // „35–75 kg" der Rat „Last auf 110 kg erhöhen", eine Woche später unter
  // „100–110 kg" der Rat „80 kg". Wer der einen Zahl folgt, verfehlt die
  // andere um bis zu 35 kg.
  const start = new Date('2026-05-18');
  const p = profil({
    ausrichtung: 30, trainingstageProWoche: 4, gewichtKg: 78.3, koerpergewichtsfokus: true,
  });
  const daten = {
    profil: p,
    tests: [
      { id: 'x1', datum: '2026-05-11', art: 'kniebeuge', wert: 100, wiederholungen: 3 },
      { id: 'x2', datum: '2026-05-11', art: 'kreuzheben', wert: 120, wiederholungen: 3 },
      { id: 'x3', datum: '2026-05-11', art: 'hipthrust', wert: 100, wiederholungen: 5 },
    ],
    sessions: [],
  };

  for (let woche = 1; woche <= 12; woche += 1) {
    const stand = leistungsstand(daten);
    const plan = PL.wochenplan(p, woche, stand);

    for (const tag of plan.tage) {
      for (const e of tag.einheiten) {
        if (e.typ !== 'kraft') continue;
        for (const u of e.uebungen) {
          const empfehlung = u.vorschlag?.empfehlung;
          if (empfehlung == null || !u.gewicht) continue;
          // Ein Hantelschritt Spielraum: Innerhalb eines Blocks landet die
          // Steigerung auf dem oberen Ende oder einen Schritt darüber.
          const schritt = UEBUNGEN[u.schluessel]?.schritt || 2.5;
          assert.ok(empfehlung >= u.gewicht.von - schritt && empfehlung <= u.gewicht.bis + schritt,
            `Woche ${woche}, ${u.name}: Vorgabe ${u.gewicht.von}–${u.gewicht.bis} kg, `
            + `Vorschlag daneben ${empfehlung} kg – dieselbe Zeile, zwei Zahlen`);
        }
      }
    }

    // Protokollieren, was der Plan vorgibt – oberes Ende der Wiederholungen.
    for (const tag of plan.tage) {
      const d = new Date(start);
      d.setDate(d.getDate() + (woche - 1) * 7 + tag.tag);
      for (const e of tag.einheiten) {
        if (e.typ !== 'kraft') continue;
        daten.sessions.push({
          id: `s${woche}_${tag.tag}`,
          datum: d.toISOString().slice(0, 10),
          typ: 'kraft',
          minuten: e.minuten,
          rpe: 7,
          uebungen: (e.uebungen || []).map((u) => ({
            schluessel: u.schluessel,
            saetze: Array.from({ length: u.saetze || 3 }, () => ({
              gewicht: u.gewicht?.bis ?? 0,
              wiederholungen: (u.repBereich || [5, 5])[1],
            })),
          })),
        });
      }
    }
  }
});

test('Der Wochenplan nennt jede Größe nur einmal – und richtig', () => {
  // Familie von Falle 13. `wochenminuten` wurde zweimal aus demselben Array
  // hergeleitet – einmal fürs Rückgabeobjekt, einmal in `wochenHinweise` für
  // die Schwelle „das ist viel". Zwei Ausdrücke für dieselbe Zahl stimmen
  // genau so lange überein, bis einer angefasst wird.
  //
  // Daneben stand ein `sprintmeterZiel` aus `sprinttage × sprintProEinheit`:
  // dieselbe Größe, zweite Herleitung, von niemandem gelesen – und laut dem
  // Kommentar darüber darf sie von `sprintmeter` abweichen, weil die
  // Qualitätsgrenze den Umfang deckelt. Wer sie irgendwann anzeigt, zeigt die
  // falsche Zahl.
  for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 25) {
    for (const tage of [3, 4, 5, 6]) {
      for (const woche of [1, 4, 6, 9, 12]) {
        const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), woche);
        const summe = plan.tage.reduce((s, t) => s + t.minuten, 0);
        assert.equal(plan.wochenminuten, summe,
          `Regler ${ausrichtung}, ${tage} Tage, Woche ${woche}`);

        const meter = plan.tage.reduce(
          (s, t) => s + t.einheiten.reduce((m, e) => m + (e.meter || 0), 0), 0);
        assert.equal(plan.sprintmeter, meter);
        assert.equal(plan.sprintmeterZiel, undefined,
          'die ungenutzte zweite Herleitung ist entfernt und bleibt es');
      }
    }
  }
});

test('Die Umfangsschwelle steht in wissen.js', () => {
  // Sie stand als nackte 600 mitten in einem Warntext. Eine fachliche Zahl
  // außerhalb der einzigen Stelle für Zahlen – die wiederkehrende
  // Aufräumaufgabe, diesmal im Kern statt in der Oberfläche.
  assert.equal(typeof BELASTUNG.hinweisAbWochenminuten, 'number');

  // Und der Hinweis richtet sich wirklich danach: sechs Tage, Ausdauerfokus.
  const viel = PL.wochenplan(profil({ ausrichtung: 100, trainingstageProWoche: 6 }), 6);
  const wenig = PL.wochenplan(profil({ ausrichtung: 0, trainingstageProWoche: 3 }), 4);
  const hatHinweis = (p) => p.hinweise.some((h) => /h Training in dieser Woche/.test(h.text));

  assert.equal(hatHinweis(viel), viel.wochenminuten > BELASTUNG.hinweisAbWochenminuten);
  assert.equal(hatHinweis(wenig), wenig.wochenminuten > BELASTUNG.hinweisAbWochenminuten);
});

test('Jeder Schritt am Ausrichtungsregler verändert die Woche', () => {
  // Der Regler bewegte nur die *Zahl* der Einheiten, und die wird gerundet.
  // Der Umfang kannte ihn gar nicht: Sprintmeter ergaben sich aus der Zahl der
  // Sprinttage mal der Qualitätsgrenze, Ausdauerminuten waren fest. Damit
  // fielen einundzwanzig Reglerstellungen auf sieben verschiedene Wochen
  // zusammen – bei drei Trainingstagen waren die Stände 40 bis 75 wörtlich
  // identisch. Wer den Regler schob, sah nichts passieren.
  for (const tage of [3, 4, 5, 6]) {
    let vorher = null;
    for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 3);
      const einheiten = plan.tage.flatMap((t) => t.einheiten);
      const jetzt = JSON.stringify({
        muster: plan.tage.map((t) => t.einheiten.map((e) => e.typ)),
        meter: plan.sprintmeter,
        ausdauer: einheiten.filter((e) => e.typ.startsWith('ausdauer'))
          .reduce((s, e) => s + e.minuten, 0),
      });
      if (vorher !== null) {
        assert.notEqual(jetzt, vorher,
          `${tage} Tage: Regler ${ausrichtung} ergibt dieselbe Woche wie ${ausrichtung - 5}`);
      }
      vorher = jetzt;
    }
  }
});

test('Mehr Ausdauerausrichtung heißt nie weniger Ausdauer und nie mehr Sprint', () => {
  // Die Richtung war nicht einmal gewahrt: Bei vier Trainingstagen fielen
  // zwischen Regler 35 und 40 die Sprintmeter von 960 auf 480 **und** die
  // Ausdauerminuten von 110 auf 90. Ursache war, dass die Zahl der Sprinttage
  // aus dem Anteil kam und der Umfang aus der Zahl der Tage – Ursache und
  // Wirkung vertauscht.
  //
  // Geprüft wird die Spitzenwoche: Dort ist der Umfang voll und die
  // Untergrenzen greifen nicht. In der Entlastungswoche sitzt der Plan auf
  // `mindestMinuten` und `minLaeufeFuerBewertung`; dort darf ein Schritt um
  // die Höhe der Untergrenze wackeln, ohne dass die Richtung falsch ist.
  for (const tage of [3, 4, 5, 6]) {
    let vorMeter = Infinity;
    let vorAusdauer = -Infinity;
    let vorIntervalle = null;
    for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 3);
      const ausdauer = plan.tage.flatMap((t) => t.einheiten)
        .filter((e) => e.typ.startsWith('ausdauer'));
      const minuten = ausdauer.reduce((s, e) => s + e.minuten, 0);
      const intervalle = ausdauer.filter((e) => e.typ === 'ausdauerIntervalle').length;

      assert.ok(plan.sprintmeter <= vorMeter,
        `${tage} Tage, Regler ${ausrichtung}: ${plan.sprintmeter} m nach ${vorMeter} m`);

      // Wird eine lockere Einheit zur Intervalleinheit, folgt ihre Dauer der
      // Zahl der Intervalle und nicht mehr dem Minutenbudget der lockeren.
      // An diesem einen Schritt darf die Wochensumme deshalb leicht fallen –
      // bei drei Tagen zwischen Regler 95 und 100 um sieben Minuten. Überall
      // sonst gilt die Richtung strikt.
      const schwelle = vorIntervalle !== null && intervalle !== vorIntervalle
        ? vorAusdauer * 0.95
        : vorAusdauer;
      assert.ok(minuten >= schwelle,
        `${tage} Tage, Regler ${ausrichtung}: ${minuten} min nach ${vorAusdauer} min`);

      vorMeter = plan.sprintmeter;
      vorAusdauer = minuten;
      vorIntervalle = intervalle;
    }
  }
});

test('Weniger belegte Tage als eingestellt werden begründet, nicht verschwiegen', () => {
  // Im Profil wählt man „5 Tage", im Wochenplan stehen vier – und niemand sagt,
  // ob das Absicht oder ein Fehler ist. Ursache ist keine Nachlässigkeit: Kraft
  // geht zuerst auf die Sprinttage, damit die übrigen Tage wirklich locker
  // bleiben. Das Volumen geht nicht verloren, es liegt auf weniger Tagen.
  //
  // Ob das Feld „verfügbare" oder „geplante" Tage heißen soll, bleibt eine
  // Trainingsentscheidung. Verschweigen darf der Plan es nicht (Falle 22).
  let unterbelegt = 0;
  for (const tage of [3, 4, 5, 6]) {
    for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 3);
      const belegt = plan.tage.filter((t) => t.trainingstag).length;
      const hinweis = plan.hinweise.some((h) => /eingestellten Tagen belegt/.test(h.text));

      if (belegt < tage) {
        unterbelegt += 1;
        assert.ok(hinweis,
          `${tage} Tage, Regler ${ausrichtung}: nur ${belegt} belegt, ohne ein Wort dazu`);
      } else {
        assert.ok(!hinweis,
          `${tage} Tage, Regler ${ausrichtung}: alle Tage belegt, aber der Hinweis steht da`);
      }
    }
  }
  // Gegenprobe: Der Fall muss überhaupt vorkommen, sonst wartet die Regel auf
  // einen Zustand, den es nicht gibt (Falle 18).
  assert.ok(unterbelegt > 0, 'kein einziger unterbelegter Plan – die Regel prüft nichts');
});

test('Kein Kalendertag bekommt drei Einheiten', () => {
  // Bei drei Trainingstagen und Regler 80 standen am Montag Sprint, Kraft und
  // eine lockere Ausfahrt: 231 Minuten, während der Mittwoch 106 und der
  // Freitag 67 hatte. Dazu die sechs Stunden Abstand, die derselbe Planer
  // zwischen Kraft und Ausdauer fordert – ein Zehn-Stunden-Tag. Die
  // Wissensansicht sagt es selbst: „Ein Plan, der nicht gemacht wird, ist
  // wertlos."
  for (const tage of [3, 4, 5, 6]) {
    for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
      for (const woche of [1, 3, 4]) {
        const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), woche);
        for (const tag of plan.tage) {
          assert.ok(tag.einheiten.length <= 2,
            `${tage} Tage, Regler ${ausrichtung}, Woche ${woche}: ${tag.name} mit `
            + `${tag.einheiten.length} Einheiten (${tag.minuten} min)`);
        }
      }
    }
  }
});

test('Auch die Kraft folgt dem Regler und nimmt nie zu', () => {
  // Die Krafteinheit war über den ganzen Regler identisch – dreizehn Sätze,
  // fünf Übungen, derselbe Wiederholungsbereich, ob reiner Sprinter oder
  // reiner Ausdauersportler. Die Beschriftung verspricht bei 100 aber
  // „Krafttraining nur noch erhaltend".
  /** Sätze der einzelnen Krafteinheit – dort sitzt die Dosis. */
  const proEinheit = (ausrichtung, tage) => {
    const einheit = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 3)
      .tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
    return einheit ? einheit.uebungen.reduce((x, u) => x + u.saetze, 0) : 0;
  };

  const saetzeDerWoche = (ausrichtung, tage) => PL
    .wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 3)
    .tage.flatMap((t) => t.einheiten).filter((e) => e.typ === 'kraft')
    .reduce((s, e) => s + e.uebungen.reduce((x, u) => x + u.saetze, 0), 0);

  for (const tage of [3, 4, 5, 6]) {
    let vorher = Infinity;
    for (let ausrichtung = 0; ausrichtung <= 100; ausrichtung += 5) {
      const jetzt = saetzeDerWoche(ausrichtung, tage);
      assert.ok(jetzt <= vorher,
        `${tage} Tage, Regler ${ausrichtung}: ${jetzt} Sätze nach ${vorher}`);
      vorher = jetzt;
    }
    // Und die Enden unterscheiden sich wirklich – gemessen an der **einzelnen
    // Einheit**, nicht an der Wochensumme. Die Wochensumme unterschied sich
    // schon vorher, weil die Zahl der Einheiten fällt; die Einheit selbst war
    // identisch. Ein Wächter auf die Summe hätte die alte Fassung durchgelassen.
    assert.ok(proEinheit(0, tage) > proEinheit(100, tage) * 1.3,
      `${tage} Tage: die einzelne Krafteinheit ist am Sprint- und am Ausdauerende `
      + `gleich groß (${proEinheit(0, tage)} gegen ${proEinheit(100, tage)} Sätze)`);
  }
});

test('Der Sprint verschwindet erst am Anschlag, nicht schon davor', () => {
  // Die Reglerbeschriftung verspricht bei 75 „Ausdauer mit Spritzigkeit:
  // Sprint und Kraft halten das Tempo oben" und erst bei 100 „Reine Ausdauer".
  // Der Plan hörte schon bei 90 mit dem Sprint auf – er widersprach damit
  // seiner eigenen Aufschrift.
  for (const tage of [3, 4, 5, 6]) {
    for (let ausrichtung = 0; ausrichtung < 100; ausrichtung += 5) {
      const plan = PL.wochenplan(profil({ ausrichtung, trainingstageProWoche: tage }), 3);
      assert.ok(plan.sprintmeter > 0,
        `${tage} Tage, Regler ${ausrichtung}: kein Sprint mehr, obwohl der Regler nicht am Anschlag steht`);
    }
    const anschlag = PL.wochenplan(profil({ ausrichtung: 100, trainingstageProWoche: tage }), 3);
    assert.equal(anschlag.sprintmeter, 0, `${tage} Tage: am Anschlag steht noch Sprint im Plan`);
  }
});

test('Die Entlastungswoche hält die Lasten des Blocks, den sie entlastet', () => {
  /*
   * `PHASEN.entlastung` hatte fest `kraftAbsicht: 'maximalkraft'`, während
   * seine eigene Beschreibung „Lasten halten" sagt. Halten ging damit in genau
   * einem von drei Fällen – nach dem Intensivierungsblock, der ohnehin
   * Maximalkraft fährt. Nach dem Aufbau hob die Entlastungswoche die Vorgabe
   * von 75–85 kg auf 90–100 kg und den Wiederholungsbereich von 6–12 auf 2–5:
   * die schwersten Lasten des Zyklus in der Woche, die erholen soll. Nach der
   * Realisierung sprang sie von 35–65 kg aus auf dieselben 90–100.
   */
  const mein = profil({ gewichtKg: 78.3, trainingstageProWoche: 4, ausrichtung: 30 });

  const kraftVon = (woche) => PL.wochenplan(mein, woche).tage
    .flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');

  let entlastungswochen = 0;
  for (let woche = 2; woche <= 24; woche++) {
    if (PL.phaseSchluessel(woche) !== 'entlastung') continue;
    entlastungswochen++;

    assert.equal(PL.kraftAbsichtDerWoche(woche), PL.kraftAbsichtDerWoche(woche - 1),
      `Woche ${woche} entlastet einen Block und wechselt dabei die Absicht`);

    const jetzt = kraftVon(woche);
    const davor = kraftVon(woche - 1);
    for (const u of jetzt.uebungen) {
      const vergleich = davor.uebungen.find((v) => v.schluessel === u.schluessel);
      assert.deepEqual(u.repBereich, vergleich.repBereich,
        `${u.name} in Woche ${woche}: anderer Wiederholungsbereich als in der Woche davor`);
      assert.deepEqual(u.prozent, vergleich.prozent,
        `${u.name} in Woche ${woche}: andere Lastvorgabe als in der Woche davor`);
      // Und der Umfang geht runter oder bleibt – nie hinauf.
      assert.ok(u.saetze <= vergleich.saetze,
        `${u.name} in Woche ${woche}: mehr Sätze als in der Woche davor`);
    }
    // Eine Entlastung, die länger dauert als die Arbeitswoche, ist keine.
    assert.ok(jetzt.minuten <= davor.minuten,
      `Woche ${woche} dauert ${jetzt.minuten} min, die Woche davor ${davor.minuten}`);
  }

  // Gegenprobe: Der Fall muss überhaupt vorkommen, sonst prüft der Test nichts.
  assert.ok(entlastungswochen >= 4, `nur ${entlastungswochen} Entlastungswochen geprüft`);
});

test('Am Übergang in die Entlastung meldet der Tracker keinen Blockwechsel', () => {
  /*
   * Der geschlossene Kreis aus Falle 23: protokollieren, was der Plan vorgibt,
   * und den nächsten Plan aus genau diesen Daten bauen. Vorher stand in jeder
   * Entlastungswoche nach dem Aufbau „Zuletzt 80 kg – das war ein anderer
   * Block mit anderer Absicht" und darüber eine um 15 kg höhere Vorgabe. Eine
   * Blockgrenze, die es fachlich nicht geben darf: Die Entlastung gehört zum
   * Block davor.
   */
  const mein = profil({
    gewichtKg: 78.3, trainingstageProWoche: 4, ausrichtung: 30, startdatum: '2026-01-05',
  });
  const daten = {
    profil: mein,
    sessions: [],
    // Hip Thrust, weil die Übung im Plan steht *und* einen Lasttest hat –
    // die Frontkniebeuge hat keinen, ihre Vorgabe bliebe leer.
    tests: [{ datum: '2026-01-01', art: 'hipthrust', wert: 120, wiederholungen: 3 }],
  };

  let tag = new Date('2026-01-05');
  const blockwechsel = [];
  for (let woche = 1; woche <= 12; woche++) {
    const plan = PL.wochenplan(mein, woche, leistungsstand(daten));
    const kraft = plan.tage.flatMap((t) => t.einheiten).find((e) => e.typ === 'kraft');
    const uebung = kraft.uebungen.find((u) => u.schluessel === 'hipthrust');

    if (uebung.vorschlag?.richtung === 'neuerBlock') {
      blockwechsel.push({ woche, phase: PL.phaseSchluessel(woche) });
    }

    // Genau das eintragen, was der Plan vorgibt.
    const last = Math.round((uebung.gewicht.von + uebung.gewicht.bis) / 5) * 2.5;
    daten.sessions.push({
      datum: tag.toISOString().slice(0, 10),
      typ: 'kraft',
      rpe: 7,
      minuten: kraft.minuten,
      uebungen: [{
        schluessel: 'hipthrust',
        saetze: Array.from({ length: uebung.saetze },
          () => ({ gewicht: last, wiederholungen: uebung.repBereich[1] })),
      }],
    });
    tag = new Date(tag.getTime() + 7 * 86400000);
  }

  const inEntlastung = blockwechsel.filter((b) => b.phase === 'entlastung');
  assert.deepEqual(inEntlastung, [],
    `Blockwechsel in Entlastungswochen: ${inEntlastung.map((b) => b.woche).join(', ')}`);

  // Gegenprobe: An den echten Blockgrenzen muss die Meldung sehr wohl stehen –
  // sonst hätte der Test auch bestanden, wenn sie gar nicht mehr vorkommt.
  assert.deepEqual(blockwechsel.map((b) => b.woche), [5, 9],
    'Die Meldung fehlt an den echten Blockgrenzen');
});

test('Wo die Entlastung im Kraftraum nicht ankommt, sagt der Plan es', () => {
  // Zwei Sätze je Übung sind die Untergrenze. Im Realisierungsblock liegt der
  // Plan schon in den Arbeitswochen darauf – die Entlastungswoche ist dort
  // Satz für Satz dieselbe Einheit. Das sieht aus wie ein Fehler und ist eine
  // Untergrenze; ohne Erklärung ist der Unterschied nicht zu erkennen.
  const mein = profil({ gewichtKg: 78.3, trainingstageProWoche: 4, ausrichtung: 30 });
  const saetze = (woche) => PL.wochenplan(mein, woche).tage
    .flatMap((t) => t.einheiten).filter((e) => e.typ === 'kraft')
    .reduce((s, e) => s + e.uebungen.reduce((a, u) => a + u.saetze, 0), 0);
  const sagtEs = (woche) => PL.wochenplan(mein, woche).hinweise
    .some((h) => h.text.includes('Kraftraum'));

  for (const woche of [4, 8, 12]) {
    const gleich = saetze(woche) === saetze(woche - 1);
    assert.equal(sagtEs(woche), gleich,
      gleich
        ? `Woche ${woche}: gleiche Satzzahl wie davor, aber kein Wort dazu`
        : `Woche ${woche}: Die Sätze gehen runter, der Hinweis behauptet das Gegenteil`);
  }

  // Beide Fälle müssen im Zyklus vorkommen, sonst prüft die Zeile darüber nur
  // eine Richtung (Falle 18 gegen Falle 24).
  assert.ok([4, 8, 12].some(sagtEs), 'Der Hinweis ist nicht auslösbar');
  assert.ok([4, 8, 12].some((w) => !sagtEs(w)), 'Der Hinweis steht in jeder Entlastungswoche');
});

test('Auch die Ausdauereinheit sagt in der Aufschrift, was sie dauert', () => {
  /*
   * Falle 37 hatte das für den Sprint behoben: Die gekürzte Einheit wird neu
   * gebaut statt nachträglich heruntergerechnet, damit Überschrift und Dauer
   * nicht auseinanderlaufen. Die Ausdauer blieb übrig – und hatte denselben
   * Fehler zweimal:
   *
   *   „47 min gleichmäßig locker" mit 31 Minuten Dauer, nach einem gelben
   *   Morgen-Check. Im Kopf der Karte stand 31, im Block 47.
   *
   *   „4 × 3 min hart / 3 min locker" mit 16 Minuten – das sind zweieinhalb
   *   Intervalle. Wer die Einheit liest, macht vier.
   *
   * Dazu wurden Ein- und Ausfahren mitgekürzt (15 → 10, 10 → 7), obwohl der
   * Planer im eigenen Kommentar sagt, dass sie stehen bleiben, aus demselben
   * Grund wie das Aufwärmen beim Sprint.
   */
  const { einfahrenMinuten, ausfahrenMinuten, intervall } = AUSDAUER.dauer;
  const profile = [
    profil({ trainingstageProWoche: 4, ausrichtung: 30 }),
    profil({ trainingstageProWoche: 5, ausrichtung: 80 }),
    profil({ trainingstageProWoche: 6, ausrichtung: 100 }),
  ];
  const lagen = [
    ['geplant', null],
    ['gelb', { vollstaendig: true, ampel: 'gelb', prozent: 50 }],
    ['rot', { vollstaendig: true, ampel: 'rot', prozent: 20 }],
  ];

  let locker = 0;
  let intervalle = 0;
  for (const p of profile) {
    for (let woche = 1; woche <= 12; woche++) {
      for (const tag of PL.wochenplan(p, woche).tage) {
        for (const geplant of tag.einheiten) {
          for (const [lage, bereitschaft] of lagen) {
            const e = bereitschaft ? PL.angepassteEinheit(geplant, bereitschaft) : geplant;
            const wo = `${p.trainingstageProWoche} Tage · Regler ${p.ausrichtung} · Woche ${woche} · ${lage}`;

            if (e.typ === 'ausdauerLocker') {
              const block = e.bloecke[0];
              const [, zahl] = block.titel.match(/^(\d+) min/) || [];
              assert.ok(zahl, `${wo}: „${block.titel}" nennt keine Minutenzahl`);
              assert.equal(Number(zahl), block.minuten,
                `${wo}: Aufschrift „${block.titel}", tatsächlich ${block.minuten} min`);
              locker++;
            }

            if (e.typ === 'ausdauerIntervalle') {
              const block = e.bloecke.find((b) => /×/.test(b.titel));
              const [, anzahl] = block.titel.match(/^(\d+) ×/) || [];
              assert.ok(anzahl, `${wo}: „${block.titel}" nennt keine Intervallzahl`);
              assert.equal(
                Number(anzahl) * (intervall.arbeitMinuten + intervall.pauseMinuten),
                block.minuten,
                `${wo}: „${block.titel}" passt nicht zu ${block.minuten} min`,
              );
              // Ein- und Ausfahren bleiben stehen, auch in der gekürzten Fassung.
              assert.equal(e.bloecke.find((b) => b.titel === 'Einfahren').minuten, einfahrenMinuten,
                `${wo}: Das Einfahren wurde gekürzt`);
              assert.equal(e.bloecke.find((b) => b.titel === 'Ausfahren').minuten, ausfahrenMinuten,
                `${wo}: Das Ausfahren wurde gekürzt`);
              intervalle++;
            }
          }
        }
      }
    }
  }

  // Beide Arten müssen vorkommen, in geplanter und in gekürzter Fassung –
  // sonst prüft der Test die Hälfte von nichts.
  assert.ok(locker > 50, `nur ${locker} lockere Einheiten geprüft`);
  assert.ok(intervalle > 10, `nur ${intervalle} Intervalleinheiten geprüft`);
});

test('Die Ersatzbewegung nennt, was sie ersetzt', () => {
  /*
   * Bei roter Ampel entfällt die harte Einheit und wird durch lockere Bewegung
   * ersetzt. Die Aufschrift stand fest auf „Statt Sprint: lockere Bewegung" –
   * der Zweig gilt aber auch für die Intervalleinheit. Über einer gestrichenen
   * Ausfahrt stand damit „Statt Sprint" an einem Tag ganz ohne Sprint; Familie
   * von Falle 38, wo ein interner Schlüssel als deutsche Überschrift landete.
   *
   * Dazu die beiden Zahlen: „20–30 min sehr locker" als Text und `minuten: 30`
   * als Feld, beide von Hand. Die zweite geht in den Kalorienbedarf.
   */
  const rot = { vollstaendig: true, ampel: 'rot', prozent: 20 };
  const { von, bis } = BEREITSCHAFT.ersatzbewegungMinuten;

  const ersetzt = [];
  for (const p of [profil({ trainingstageProWoche: 4, ausrichtung: 30 }),
    profil({ trainingstageProWoche: 5, ausrichtung: 80 })]) {
    for (let woche = 1; woche <= 12; woche++) {
      for (const tag of PL.wochenplan(p, woche).tage) {
        for (const geplant of tag.einheiten) {
          const e = PL.angepassteEinheit(geplant, rot);
          if (e.anpassung?.art !== 'gestrichen') continue;
          ersetzt.push(geplant.typ);

          assert.ok(e.titel.includes(geplant.titel),
            `„${e.titel}" nennt nicht die Einheit, die sie ersetzt (${geplant.titel})`);
          // Und die Zahl im Text passt zu der, die in den Kalorienbedarf geht.
          assert.equal(e.bloecke[0].titel, `${von}–${bis} min sehr locker`);
          assert.equal(e.minuten, bis);
          assert.equal(e.bloecke.reduce((s, b) => s + b.minuten, 0), e.minuten);
        }
      }
    }
  }

  // Beide harten Arten müssen im Durchlauf gestrichen worden sein – sonst
  // prüft der Test nur den Fall, der vorher schon stimmte.
  assert.ok(ersetzt.includes('sprint'), 'Kein Sprint gestrichen');
  assert.ok(ersetzt.includes('ausdauerIntervalle'), 'Keine Intervalleinheit gestrichen');
});
