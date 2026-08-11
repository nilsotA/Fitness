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
import { readFileSync } from 'node:fs';
import * as W from '../kern/wissen.js';
import * as E from '../kern/ernaehrung.js';
import * as LE from '../kern/leistung.js';
import * as SP from '../kern/sprint.js';
import * as R from '../kern/regeln.js';

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

/**
 * Alle als `praxis` gekennzeichneten Konstanten, mit Pfad.
 *
 * Gesucht wird nach jedem Feld, dessen Name „guete" enthält – nicht nur nach
 * `guete` selbst. Zwei Kennzeichen heißen `protokollrauschenGuete` und
 * `hinweisAbWochenminutenGuete`, weil sie nur für einen Teil ihres Blocks
 * gelten; eine Suche nach dem exakten Namen übersieht sie.
 */
function praxisKonstanten() {
  const gefunden = [];
  const lauf = (wert, pfad, tiefe = 0) => {
    if (!wert || typeof wert !== 'object' || tiefe > 5) return;
    for (const [name, inhalt] of Object.entries(wert)) {
      if (/guete/i.test(name) && inhalt === 'praxis') {
        gefunden.push(name.toLowerCase() === 'guete' ? pfad : `${pfad}.${name}`);
      }
      if (inhalt && typeof inhalt === 'object') lauf(inhalt, `${pfad}.${name}`, tiefe + 1);
    }
  };
  for (const [name, wert] of Object.entries(W)) {
    if (name !== 'QUELLEN') lauf(wert, name);
  }
  return gefunden.sort();
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

test('Die Sätze je Muskelgruppe stehen nur an einer Stelle', () => {
  // `KRAFT.saetzeProMuskelWoche` führte dieselbe Größe wie `VOLUMEN` ein
  // zweites Mal – 10 / 14 / 20 gegen 10 / 20, nur mit anderen Feldnamen.
  // Gelesen wurde davon einzig `minimum`, und der Zielwert 14 hatte gar keine
  // Quelle: Weder Schoenfeld 2017 noch Pelland 2025 nennen ihn, sie
  // beschreiben einen Anstieg mit abnehmendem Grenzertrag. Eine erfundene
  // Mitte zwischen zwei belegten Marken ist genau das, was dieser Tracker
  // nicht tun soll.
  assert.equal(W.KRAFT.saetzeProMuskelWoche, undefined,
    'die Satzmarken gehören ausschließlich in VOLUMEN');

  // Und die verbliebene Tabelle bleibt vollständig belegt.
  assert.ok(W.VOLUMEN.quelleMinimum, 'VOLUMEN.minimum ohne Quelle');
  assert.ok(W.VOLUMEN.quelleGrenzertrag, 'die Obergrenze ohne Quelle');
  assert.ok(W.VOLUMEN.minimum < W.VOLUMEN.viel,
    'Mindestmarke und „viel" stehen in der falschen Reihenfolge');
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

test('Die RPE-Vorbelegung passt zur Absicht der Einheit', () => {
  // Der Regler stand fest auf 7 („hart"), auch für eine lockere Grundlage.
  // RPE × Minuten ist die Belastungszahl selbst – eine 95-Minuten-Ausfahrt kam
  // damit auf 665 statt 380 Belastungseinheiten.
  const zone = (rpe) => (rpe <= W.AUSDAUER_ZONEN.locker.rpeBis ? 'locker'
    : rpe <= W.AUSDAUER_ZONEN.grauzone.rpeBis ? 'grauzone' : 'hart');

  assert.equal(zone(W.RPE_ERWARTUNG.ausdauerLocker), 'locker');
  assert.equal(zone(W.RPE_ERWARTUNG.ausdauerLang), 'locker');
  assert.equal(zone(W.RPE_ERWARTUNG.ausdauerIntervalle), 'hart');

  // Keine Vorbelegung in der Grauzone: Der Bereich, den das polarisierte
  // Modell gerade vermeiden will, darf nicht die Voreinstellung sein.
  for (const [art, rpe] of Object.entries(W.RPE_ERWARTUNG)) {
    if (typeof rpe !== 'number' || !art.startsWith('ausdauer')) continue;
    assert.notEqual(zone(rpe), 'grauzone', `${art} startet in der Grauzone`);
  }
});

test('Jede Einheitenart hat eine Vorbelegung und ein RPE-Wort', () => {
  // Fehlt die Art in RPE_ERWARTUNG, fällt der Dialog stillschweigend auf 5
  // zurück – mitten in die Grauzone.
  for (const art of Object.keys(W.RPE_ERWARTUNG)) {
    const rpe = W.RPE_ERWARTUNG[art];
    if (typeof rpe !== 'number') continue;
    assert.ok(rpe >= 1 && rpe <= 10, `${art}: RPE ${rpe} außerhalb der Skala`);
    assert.ok(W.RPE_WORTE[rpe], `RPE ${rpe} hat kein Wort`);
  }
  assert.equal(W.RPE_WORTE.length, 11, 'Die Skala geht von 0 bis 10');
});

test('Jede Quelle wird auch gebraucht', () => {
  // Die Gegenrichtung zum Test darüber: Der prüft, dass jeder Verweis eine
  // Quelle hat. Eine Quelle ohne Verweis ist der umgekehrte Fall – sie steht
  // in der Wissensansicht und stützt nichts mehr. Das passiert lautlos, wenn
  // eine Konstante umgebaut wird und ihr `quelle:` dabei verschwindet.
  const dateien = ['wissen', 'plan', 'leistung', 'ernaehrung', 'belastung',
    'ausdauer', 'sprint', 'profil', 'aktivitaet']
    .map((n) => readFileSync(new URL(`../kern/${n}.js`, import.meta.url), 'utf8'))
    .join('\n');

  const verwaist = Object.keys(W.QUELLEN)
    .filter((id) => !new RegExp(`'${id}'`).test(dateien));
  assert.deepEqual(verwaist, [],
    `Quellen ohne Verweis: ${verwaist.join(', ')} – entweder wieder verwenden oder entfernen`);
});

test('Jede als praxis gekennzeichnete Zahl trägt ihren Vorbehalt in der Oberfläche', () => {
  // Die Kernzusage des Projekts: „Wo es keine belastbare Studienlage gibt,
  // wird das ausdrücklich gekennzeichnet – nicht stillschweigend behauptet."
  // In `wissen.js` steht das Kennzeichen; ob es am Gerät ankommt, stand
  // nirgends. Die Bereitschaft zeigte eine Prozentzahl, eine farbige Ampel
  // und einen konkreten Rat – und nichts davon sagte, dass die Schwellen
  // Trainerpraxis sind.
  //
  // Geprüft wird pro Konstante eine Stelle, an der der Vorbehalt stehen muss.
  // Grob, aber es schlägt an, wenn jemand den Satz herauslöscht.
  //
  // **Und die Liste wird nicht mehr getippt.** Vorher standen hier sieben
  // Namen von Hand – während `wissen.js` fünfzehn `praxis`-Konstanten führte.
  // Acht trugen ihren Vorbehalt nirgends, darunter die Interferenzfaktoren und
  // die erwarteten RPE-Werte, und keine davon konnte den Test je durchfallen
  // lassen: Ein Melder, der Neues gar nicht kennt, meldet nie (Falle 18).
  // Jetzt zählt der Test selbst und verlangt zu jeder Konstante eine
  // Entscheidung – auch zu jeder, die morgen dazukommt.
  const quelltext = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8');
  const kern = ['belastung', 'ausdauer', 'sprint', 'ernaehrung', 'plan', 'leistung']
    .map((n) => quelltext(`kern/${n}.js`)).join('\n');
  const oberflaeche = ['heute', 'fortschritt', 'essen', 'planAnsicht', 'protokoll', 'profilAnsicht']
    .map((n) => quelltext(`app/${n}.js`)).join('\n');
  // Zusammengesetzte Zeichenketten wieder zusammenfügen: Ein Satz, der im
  // Quelltext über drei Zeilen als `'a ' + 'b ' + 'c'` steht, ist derselbe
  // Satz. Vorher stand deshalb ein Muster wie `/gängige Praxis,\s*'?\s*\+?…/`
  // im Test – eine Suchmaske, die niemand liest und die beim nächsten Umbruch
  // wieder bricht.
  const alles = `${kern}\n${oberflaeche}`
    .replace(/'\s*\+\s*'/g, '')
    .replace(/`\s*\+\s*`/g, '')
    .replace(/\s+/g, ' ');

  const VORBEHALT = {
    BEREITSCHAFT: /Trainerpraxis, keine Messgröße/,
    SPRINT_QUALITAET: /Trainerkonsens, keine Studienlage/,
    VOLUMEN: /gängige Praxis, keine Messgröße/,
    HERZFREQUENZ: /Aus dem Alter geschätzt/,
    RUHEPULS: /Unspezifisch/,
    'BELASTUNG.monotonie': /nicht als bestandene Prüfung/,
    EPLEY: /zunehmend ungenau/,
    // Wilson 2012 belegt die Rangfolge (Laufen stört am stärksten), nicht die
    // einzelnen Faktoren und nicht die sechs Stunden Abstand.
    AUSDAUER: /Rangfolge ist belegt, die einzelnen Zahlen sind Erfahrungswerte/,
    // Seiler belegt das polarisierte Prinzip, nicht die Prozentmarken, ab
    // denen die Grauzone als zu viel gilt.
    AUSDAUER_VERTEILUNG: /Prinzip ist belegt, die Prozentmarken sind Erfahrungswerte/,
    // Die Dauerangaben sind gerechnet, nicht gemessen – und sie gehen in den
    // Kalorienbedarf. Je Einheitenart eine eigene Wendung, damit der Satz
    // nicht für drei Konstanten mit einer Floskel durchgeht.
    'KRAFT.dauer': /Sätzen und Satzpausen/,
    'AUSDAUER.dauer': /Intervallen sowie Ein- und Ausfahren/,
    'SPRINT.guetePausen': /Läufen und ihren Pausen/,
    'BELASTUNG.hinweisAbWochenminutenGuete': /Wo „viel" anfängt, ist Erfahrung/,
    'ERNAEHRUNG.energieverfuegbarkeit.protokollrauschenGuete': /Spielraum fängt das Rauschen/,
    RPE_ERWARTUNG: /Erwartungswerte aus der Praxis/,
    // Der Regler skaliert seit Falle 46 auch den Umfang. Die Richtung ist
    // belegt, der Betrag nicht.
    AUSRICHTUNG_UMFANG: /Erfahrung und keine Studienlage – belegt ist die Richtung/,
    // Ab wann eine Einheit als „lang" gilt und damit den höchsten
    // Kohlenhydratkorridor auslöst.
    'ERNAEHRUNG.langeAusdauerGuete': /ab dort bestimmt die Glykogenversorgung die Einheit/,
    // Ab wann „es gibt keinen harten Reiz" gilt. Die Grenze entscheidet
    // zwischen „so ist es gedacht" und einer Warnung – also darüber, ob jemand
    // sein Training umbaut.
    'AUSDAUER_VERTEILUNG.hartVernachlaessigbarGuete': /gar kein harter Reiz/,
    // Belegt ist die Dosis je Muskelgruppe und Woche, nicht ihre Aufteilung auf
    // einzelne Übungen – und an dieser Aufteilung hängt, ob die
    // Entlastungswoche im Kraftraum überhaupt ankommt.
    'KRAFT.saetzeProUebung': /belegt ist die Dosis je Muskelgruppe und Woche/,
  };

  const fehlend = praxisKonstanten().filter((n) => !VORBEHALT[n]);
  assert.deepEqual(fehlend, [],
    `als praxis gekennzeichnet, aber ohne festgelegte Vorbehaltsstelle: ${fehlend.join(', ')}`);

  for (const [name, muster] of Object.entries(VORBEHALT)) {
    assert.match(alles, muster,
      `${name} ist als praxis gekennzeichnet, aber der Vorbehalt steht nirgends im Text`);
  }
});

test('Jede Zahl in wissen.js hat einen Leser', () => {
  /*
   * Die Gegenrichtung zu „jede Zahl hat eine Quelle": eine Zahl, die niemand
   * liest. Sie ist nicht bloß Ballast – sie ist eine Behauptung, die nichts
   * bewirkt, und die nächste Runde baut die Regel daneben noch einmal.
   *
   * Gefunden hat dieser Test vier Stück auf einmal, jede von der Sorte, die man
   * für erledigt hält, weil sie in `wissen.js` sauber dasteht:
   *
   *   - `SPRINT.minStundenZwischenEinheiten` (48) – der Planer rechnete mit
   *     einer nackten `2`. Wer die 48 auf 72 gesetzt hätte, hätte nichts
   *     bewegt. Ausgerechnet eine der Regeln, die CLAUDE.md „nicht
   *     verhandelbar" nennt.
   *   - `PROGRESSION.anteilFuerSteigerung` (1,0) – `every()` entschied.
   *   - `AUSDAUER.anteilNiedrigintensiv` (0,8) – Zwilling von
   *     `AUSDAUER_ZONEN.locker.ziel`.
   *   - `BELASTUNG.maxWochensteigerungProzent` (10) – nirgends umgesetzt; die
   *     Aufgabe erledigt das ACWR darüber.
   *
   * `minStundenZwischenEinheiten` hatte sogar einen Test, der ihren Wert
   * abfragte. Genau davor warnt Falle 21: Findet sich nur der eigene Test, gibt
   * es die Aufgabe entweder nicht mehr – oder zweimal.
   *
   * Tabellen, die als Ganzes durchlaufen oder dynamisch indiziert werden
   * (`UEBUNGEN[…]`, `Object.entries(MUSKELGRUPPEN)`), sind ausgenommen: Dort
   * steht kein Feldname im Quelltext, und das ist kein Fehler. Diese Ausnahme
   * wird **hergeleitet** und nicht getippt – eine Liste von Hand wäre wieder
   * ein Melder, der nur meldet, was er kennt (Falle 41).
   *
   * **Was er nicht findet, und das gehört dazugesagt:** Gesucht wird der
   * Feldname allein, nicht der Pfad. Ein allgemeiner Name wie `obergrenze`
   * steht auch bei `acwr.obergrenze` im Quelltext und deckt damit ein totes
   * `protein.obergrenze` mit zu. Über den Pfad zu suchen war der erste Versuch
   * und ging schief: Die halbe Datei wird über einen lokalen Namen gelesen
   * (`const u = ERNAEHRUNG.umDieEinheit`) oder dynamisch indiziert
   * (`kohlenhydrate[typ]`) – fünfzig Fehlalarme. Dieser Test findet also
   * verlässlich einen Namen, den es sonst nirgends gibt; ein totes Feld mit
   * einem Allerweltsnamen findet weiterhin nur, wer hinsieht.
   */
  const quellen = ['plan', 'leistung', 'ernaehrung', 'belastung', 'ausdauer',
    'sprint', 'profil', 'aktivitaet', 'regeln', 'zustand', 'aendern']
    .map((n) => readFileSync(new URL(`../kern/${n}.js`, import.meta.url), 'utf8'))
    .concat(['heute', 'fortschritt', 'essen', 'planAnsicht', 'protokoll',
      'profilAnsicht', 'wissenAnsicht']
      .map((n) => readFileSync(new URL(`../app/${n}.js`, import.meta.url), 'utf8')));
  const text = quellen.join('\n');

  const durchlaufen = (name) => new RegExp(
    `Object\\.(entries|keys|values)\\(\\s*${name}|\\b${name}\\[`).test(text);
  const gelesen = (schluessel) => new RegExp(`\\b${schluessel}\\b`).test(text);

  const ohneLeser = [];
  const gehe = (pfad, obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'quelle' || k.startsWith('quelle')) continue;
      if (v && typeof v === 'object') {
        if (!Array.isArray(v)) gehe(`${pfad}.${k}`, v);
        else if (!gelesen(k)) ohneLeser.push(`${pfad}.${k}`);
        continue;
      }
      if (typeof v !== 'number') continue;
      if (!gelesen(k)) ohneLeser.push(`${pfad}.${k}`);
    }
  };
  for (const [name, wert] of Object.entries(W)) {
    if (!wert || typeof wert !== 'object' || Array.isArray(wert)) continue;
    if (durchlaufen(name)) continue;
    gehe(name, wert);
  }

  assert.deepEqual(ohneLeser, [],
    `Zahlen ohne Leser: ${ohneLeser.join(', ')} – erst fragen, ob es die Aufgabe `
    + 'woanders schon gibt, dann entfernen oder anschließen');
});

test('Der harte Ausdaueranteil steht nur in einer Tabelle', () => {
  // `AUSDAUER` führte `anteilNiedrigintensiv: 0.8` und `anteilHochintensiv: 0.2`
  // neben `AUSDAUER_ZONEN.locker.ziel` und `.hart.ziel` – dieselben Zahlen aus
  // derselben Quelle. Die eine las niemand, die andere las der Planer, während
  // die Bewertung die Zonentabelle nahm. Ein geänderter Wert hätte Vorschlag
  // und Note auseinanderlaufen lassen, ohne dass ein Test angeschlagen wäre –
  // genau die Konstellation aus Falle 17.
  for (const feld of ['anteilNiedrigintensiv', 'anteilHochintensiv']) {
    assert.equal(W.AUSDAUER[feld], undefined,
      `AUSDAUER.${feld} ist wieder da – der Anteil gehört in AUSDAUER_ZONEN`);
  }
  assert.equal(W.AUSDAUER_ZONEN.locker.ziel + W.AUSDAUER_ZONEN.hart.ziel
    + W.AUSDAUER_ZONEN.grauzone.ziel, 1, 'Die Zielanteile ergeben zusammen nicht 1');
});

test('Kein Kerntext schreibt Zahlen mit Dezimalpunkt', () => {
  /*
   * Der Kern baut Sätze, die unverändert am Gerät landen. Falle 56 hat dafür
   * `zahlText()` eingeführt und `leistung.js` und `plan.js` gerichtet –
   * `regeln.js` blieb übersehen und schrieb „2.5 % über der Tagesbestzeit"
   * mitten in die Abbruchregel, also in den Satz, den man **während** der
   * Einheit liest.
   *
   * Statt einer dritten Einzelkorrektur prüft dieser Test die ganze Familie:
   * Alle Textproduzenten des Kerns werden mit Werten aufgerufen, die
   * Nachkommastellen erzeugen, und kein Ergebnis darf „Ziffer Punkt Ziffer"
   * enthalten. Tausenderpunkte („1.200 kcal") sind erlaubt und sehen anders
   * aus – dort steht hinter dem Punkt immer eine dreistellige Gruppe.
   */
  const texte = [];
  const sammle = (wert) => {
    if (typeof wert === 'string') texte.push(wert);
    else if (Array.isArray(wert)) wert.forEach(sammle);
    else if (wert && typeof wert === 'object') Object.values(wert).forEach(sammle);
  };

  const lauf = (sekunden) => ({ distanz: 30, art: 'beschleunigung', sekunden });
  const serie = [lauf(4.0), lauf(4.0), lauf(4.13), lauf(4.27)];
  sammle(R.laufBewerten(serie, 2, W.SPRINT_QUALITAET));
  sammle(R.laufBewerten(serie, 3, W.SPRINT_QUALITAET));
  sammle(SP.auswertung(serie));

  // Lasten mit halben Kilo – der Regelfall an der Hantel.
  const letzte = {
    datum: '2026-08-01',
    saetze: [{ gewicht: 97.5, wiederholungen: 4 }],
    topGewicht: 97.5,
    gesamtWdh: 4,
    ohneFortschritt: 3,
  };
  sammle(LE.naechsteLast('kniebeuge', letzte, [3, 5], { von: 92.5, bis: 102.5 }));

  // Makros und Verpflegung mit einem Gewicht, das krumme Werte erzeugt.
  const profil = { gewichtKg: 78.3, kalorienziel: 'halten' };
  sammle(E.makros(profil, 3137, 'hart'));
  sammle(E.versorgungUmDieEinheit(profil, 'ausdauerLocker', 95));
  sammle(E.mahlzeitenplan(profil, E.makros(profil, 3137, 'hart')));

  const punkt = /\d\.\d(?!\d\d)/;
  const treffer = texte.filter((t) => punkt.test(t));
  assert.deepEqual(treffer, [],
    `Dezimalpunkt statt Komma:\n${treffer.join('\n')}`);
});
