import test from 'node:test';
import assert from 'node:assert/strict';
import * as PL from '../kern/plan.js';
import { createProfil } from '../kern/profil.js';
import { verteilung } from '../kern/ausdauer.js';
import { entlastungFaellig } from '../kern/belastung.js';
import { leistungsstand } from '../kern/leistung.js';
import { RPE_ERWARTUNG, UEBUNGEN, BELASTUNG } from '../kern/wissen.js';

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
