// Die Evidenzbasis selbst.
//
// Das Versprechen dieses Trackers ist nicht, dass er rechnet – das kann jede
// Tabelle. Es ist, dass hinter jeder Zahl eine Quelle steht und dass dort, wo
// keine belastbare Studienlage existiert, „praxis" dransteht statt einer
// stillschweigenden Behauptung.
//
// Ein Versprechen, das niemand prüft, hält sich nicht. Deshalb hier.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../kern/wissen.js';

const GUETE = new Set(['stark', 'solide', 'praxis']);

/** Alle Felder, deren Name mit „quelle" beginnt – samt Pfad für die Meldung. */
function quellenVerweise() {
  const gefunden = [];
  const lauf = (wert, pfad) => {
    if (!wert || typeof wert !== 'object') return;
    for (const [name, inhalt] of Object.entries(wert)) {
      if (/^quelle/i.test(name) && typeof inhalt === 'string') gefunden.push([`${pfad}.${name}`, inhalt]);
      if (inhalt && typeof inhalt === 'object') lauf(inhalt, `${pfad}.${name}`);
    }
  };
  for (const [name, wert] of Object.entries(W)) {
    if (name !== 'QUELLEN') lauf(wert, name);
  }
  return gefunden;
}

test('Jede Quelle ist vollständig belegt', () => {
  for (const [id, q] of Object.entries(W.QUELLEN)) {
    assert.ok(q.kurz, `${id}: Kurzangabe fehlt`);
    assert.ok(q.titel, `${id}: Titel fehlt`);
    assert.ok(q.kern && q.kern.length > 40, `${id}: keine brauchbare Zusammenfassung`);
    assert.ok(GUETE.has(q.guete), `${id}: Güte „${q.guete}" ist keine der erlaubten`);
    assert.match(q.url || '', /^https?:\/\//, `${id}: keine nachschlagbare Adresse`);
  }
});

test('Jeder Quellenverweis zeigt auf eine vorhandene Quelle', () => {
  // Ein Verweis ins Leere ist schlimmer als keiner: In der Oberfläche steht
  // dann eine Zahl, die belegt aussieht und es nicht ist.
  const fehlend = quellenVerweise().filter(([, id]) => !W.QUELLEN[id]);
  assert.deepEqual(fehlend, [], `Verweise ohne Quelle: ${JSON.stringify(fehlend)}`);
});

test('Die tragenden Konstanten nennen ihre Quelle', () => {
  // Nicht jede Konstante braucht eine – Namen und Farben nicht. Die hier
  // treffen aber Trainingsentscheidungen.
  for (const name of ['SPRINT', 'SPRINT_QUALITAET', 'KRAFT', 'KRAFTMARKEN',
    'AUSDAUER_ZONEN', 'AUSDAUER_VERTEILUNG', 'BELASTUNG', 'ERNAEHRUNG',
    'HERZFREQUENZ', 'RUHEPULS', 'VOLUMEN', 'GRUNDUMSATZ']) {
    const wert = W[name];
    assert.ok(wert, `${name} fehlt`);
    const hatQuelle = JSON.stringify(wert).includes('quelle')
      || JSON.stringify(wert).includes('Quelle');
    assert.ok(hatQuelle, `${name} nennt keine Quelle`);
  }
});

test('Wo die Studienlage dünn ist, steht das dabei', () => {
  // Diese Werte sind Trainerpraxis. Sie als belegt auszugeben wäre die
  // unehrlichere Variante – lieber „praxis" als eine erfundene Güte.
  assert.equal(W.SPRINT_QUALITAET.guete, 'praxis');
  assert.equal(W.AUSDAUER_VERTEILUNG.guete, 'praxis');
  assert.equal(W.HERZFREQUENZ.guete, 'praxis');
  assert.equal(W.RUHEPULS.guete, 'praxis');
  assert.equal(W.VOLUMEN.guete, 'praxis');
});

test('Die Grundumsatzformeln stimmen mit ihrer Veröffentlichung überein', () => {
  // Nachgerechnet, nicht nachgeschlagen: Cunningham 500 + 22 × FFM,
  // Mifflin-St Jeor 10 × kg + 6,25 × cm − 5 × Jahre + 5 (Mann) / − 161 (Frau).
  const c = W.GRUNDUMSATZ.cunningham;
  assert.equal(c.basis + c.proKgFettfrei * 70, 2040, '70 kg fettfrei');

  const m = W.GRUNDUMSATZ.mifflin;
  assert.equal(m.proKg * 80 + m.proCm * 180 + m.proJahr * 30 + m.mann, 1780);
  assert.equal(m.proKg * 60 + m.proCm * 165 + m.proJahr * 30 + m.frau, 1320.25);
});

test('Die nicht verhandelbaren Trainingsregeln stehen unverändert', () => {
  // Wer sie ändert, ändert die Trainingslehre und nicht nur Code. Der Test
  // hält niemanden davon ab – er sorgt dafür, dass es auffällt.
  assert.equal(W.SPRINT.maxEinheitenProWoche, 3);
  assert.equal(W.SPRINT.minStundenZwischenEinheiten, 48);
  assert.equal(W.AUSDAUER_ZONEN.locker.ziel, 0.8);
  assert.equal(W.AUSDAUER_ZONEN.hart.ziel, 0.2);
  assert.equal(W.BLOCKFOLGE.filter((p) => p === 'entlastung').length, 3,
    'jede vierte Woche Entlastung');
  assert.equal(W.BLOCKFOLGE.length, 12);
});

test('Die Zielanteile der Ausdauerzonen ergeben zusammen eins', () => {
  const summe = W.AUSDAUER_ZONEN.locker.ziel
    + W.AUSDAUER_ZONEN.grauzone.ziel + W.AUSDAUER_ZONEN.hart.ziel;
  assert.equal(summe, 1);
});

/* ------------------------------------------------------- Art der Belege */

// Aus dem Studiendesign folgt die Güte – nicht umgekehrt.
const GUETE_AUS_ART = {
  metaanalyse: 'stark',
  positionspapier: 'stark',
  konsens: 'stark',
  rct: 'stark',
  einzelstudie: 'solide',
  uebersicht: 'solide',
};

test('Jede Quelle sagt, was für eine Arbeit sie ist', () => {
  // „Meta-Analyse" war bisher eine Behauptung im Fließtext. Wer wissen will,
  // worauf eine Regel steht, soll es nachschlagen können statt es zu glauben.
  for (const [id, q] of Object.entries(W.QUELLEN)) {
    assert.ok(GUETE_AUS_ART[q.art], `${id}: „${q.art}" ist keine bekannte Art`);
  }
});

test('Die Güte folgt dem Studiendesign', () => {
  // Sonst wandert „stark" mit der Zeit dorthin, wo einem das Ergebnis gefällt.
  // Genau das war passiert: Drei Übersichtsarbeiten standen als „stark" da.
  for (const [id, q] of Object.entries(W.QUELLEN)) {
    assert.equal(q.guete, GUETE_AUS_ART[q.art],
      `${id} ist ${q.art} und dürfte damit nicht „${q.guete}" heißen`);
  }
});

test('Keine Quelle liegt ungenutzt herum', () => {
  // Eine Quelle, auf die keine Konstante zeigt, belegt nichts – sie schmückt
  // nur die Liste. Fünf lagen so da, darunter eine Metaanalyse zur
  // Interferenz, deren Zahlen der Planer längst benutzte.
  const benutzt = new Set(quellenVerweise().map(([, id]) => id));
  const waisen = Object.keys(W.QUELLEN).filter((id) => !benutzt.has(id));
  assert.deepEqual(waisen, [], `ohne Verweis: ${waisen.join(', ')}`);
});

test('Die tragenden Regeln stehen auf Metaanalysen', () => {
  // Nicht jede Zahl kann eine Metaanalyse haben – aber die Regeln, die der
  // Tracker als nicht verhandelbar führt, sollen es. Fällt eine davon auf eine
  // schwächere Quelle zurück, ist das eine bewusste Entscheidung und keine,
  // die unbemerkt passieren darf.
  const tragend = [
    ['Proteinmenge', W.ERNAEHRUNG.quelleProtein],
    ['Satzvolumen', W.KRAFT.quelle],
    ['Grenzertrag beim Volumen', W.VOLUMEN.quelleGrenzertrag],
    ['Krafttraining als Verletzungsschutz', W.SCHUTZZIELE.achillessehne.quelle],
    ['Nordic Hamstring', W.SCHUTZZIELE.hamstrings.quelle],
    ['Sprunggelenk-Aufwärmen', W.SCHUTZZIELE.sprunggelenk.quelle],
    ['Interferenz zwischen Kraft und Ausdauer', W.AUSDAUER.quelleInterferenz],
    ['Maximalpuls-Schätzung', W.HERZFREQUENZ.quelleSchaetzung],
  ];

  for (const [was, id] of tragend) {
    assert.equal(W.QUELLEN[id]?.art, 'metaanalyse',
      `${was} stützt sich auf ${id} (${W.QUELLEN[id]?.art})`);
  }
});

test('Eine bestrittene Zahl trägt ihren Vorbehalt', () => {
  // Die 51 % des Nordic Hamstring sind die meistzitierte Zahl der
  // Verletzungsprophylaxe – und eine Nachrechnung derselben Studien fand den
  // Effekt nicht wieder. Die Übung bleibt im Plan, die Zahl darf aber nicht
  // als gesichert dastehen.
  const h = W.SCHUTZZIELE.hamstrings;
  assert.ok(h.quelleVorbehalt, 'Nordic Hamstring ohne Vorbehalt');
  assert.ok(W.QUELLEN[h.quelleVorbehalt], 'Vorbehalt zeigt ins Leere');

  // Und dasselbe für das Akut-zu-chronisch-Verhältnis, das offen als
  // untauglich zur Verletzungsvorhersage gilt.
  assert.ok(W.QUELLEN[W.BELASTUNG.quelleVorbehalt], 'ACWR ohne Vorbehalt');
});
