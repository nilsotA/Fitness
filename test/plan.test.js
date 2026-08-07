import test from 'node:test';
import assert from 'node:assert/strict';
import * as PL from '../server/plan.js';
import { createProfil } from '../server/profil.js';

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
