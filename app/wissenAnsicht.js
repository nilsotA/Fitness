// Die Belegstelle: worauf sich jede Zahl im Tracker stützt.
//
// Der Sinn dieser Ansicht ist Nachprüfbarkeit. Ein Trainingsplan, der seine
// Herkunft nicht offenlegt, ist von einer Meinung nicht zu unterscheiden.

import { el, karte, hinweis, tabelle } from './common.js';
import * as daten from './daten.js';

// Der Wissensbestand kommt direkt aus wissen.js – früher lag dafür ein
// Netzwerkaufruf dazwischen, samt Ladezustand. Beides entfällt.
let wissen = null;

export const ART_NAMEN = {
  metaanalyse: 'Metaanalyse',
  positionspapier: 'Positionspapier einer Fachgesellschaft',
  konsens: 'Konsenspapier',
  rct: 'Randomisierte kontrollierte Studie',
  einzelstudie: 'Einzelstudie',
  uebersicht: 'Übersichtsarbeit',
};

export function wissenAnsicht() {
  const box = el('div', {});
  box.append(el('h1', {}, 'Wissen'));

  if (!wissen) wissen = daten.wissen();

  box.append(grundsaetze());
  box.append(supplemente());
  box.append(quellen());
  box.append(grenzen());

  return box;
}

function grundsaetze() {
  const box = karte(el('h2', {}, 'Die Regeln hinter dem Plan'));

  const regeln = [
    ['Sprint nur frisch',
      'Höchstgeschwindigkeit entsteht ausschließlich bei ausgeruhtem Nervensystem. Deshalb '
      + 'höchstens drei Sprinteinheiten pro Woche, mindestens 48 h Abstand, und am Trainingstag '
      + 'immer zuerst. Müde sprinten trainiert Langsamkeit.'],
    ['Zwischen den Stühlen wird nicht trainiert',
      'Entweder ≥95 % der Maximalgeschwindigkeit oder <70 % zur Erholung. Der Bereich dazwischen '
      + 'ermüdet, ohne Schnelligkeit zu entwickeln – derselbe Gedanke wie beim polarisierten '
      + 'Ausdauermodell (80 % locker, 20 % hart).'],
    ['Interferenz ist eine Frage der Dosis',
      'Ausdauertraining stört die Kraftentwicklung umso mehr, je häufiger und länger es ist. '
      + 'Laufen stört deutlich, Radfahren praktisch nicht – der Unterschied liegt im exzentrischen '
      + 'Muskelschaden. Am selben Tag mindestens 6 h Abstand.'],
    ['Umfang schlägt Intensität – bis zu einem Punkt',
      'Für Muskelaufbau zählt die Zahl harter Sätze pro Muskelgruppe und Woche; ab etwa zehn wird '
      + 'die Dosis-Wirkung deutlich. Für Maximalkraft zählt die Last. Beides gleichzeitig maximieren '
      + 'geht nicht, deshalb die Blöcke.'],
    ['Anpassung passiert in der Erholung',
      'Die Entlastungswoche ist kein Nachlassen, sondern der Teil, in dem die Arbeit der drei Wochen '
      + 'davor wirksam wird. Wer sie überspringt, sammelt Ermüdung statt Form.'],
    ['Schlaf ist die wirksamste Maßnahme',
      'Sieben bis neun Stunden. In Studien verbesserte verlängerter Schlaf Sprintzeiten messbar – '
      + 'kein Supplement kommt in die Nähe dieses Effekts.'],
    ['Prophylaxe ist Teil des Programms',
      'Copenhagen Adduction senkte Leistenprobleme in einer randomisierten Studie um 41 %, Nordic '
      + 'Hamstring gilt als Gegenstück für die hintere Kette. Bei der viel zitierten Halbierung des '
      + 'Hamstring-Risikos ist die Lage allerdings uneindeutig: Eine Nachrechnung derselben Studien '
      + 'fand den Effekt nicht wieder. Beides steht trotzdem in jedem Krafttag – vier Minuten für '
      + 'eine Maßnahme, die vielleicht viel bringt und sicher wenig kostet, ist eine leichte '
      + 'Rechnung. Nur eine sichere Sache ist es nicht.'],
  ];

  for (const [titel, text] of regeln) {
    box.append(el('div', { style: { marginBottom: '0.8rem' } },
      el('h3', {}, titel),
      el('p', { class: 'klein', style: { margin: '0' } }, text)));
  }

  return box;
}

function supplemente() {
  const box = karte(el('h2', {}, 'Supplemente'));
  box.append(el('p', { class: 'klein' },
    'Kurz gehalten, weil die Liste dessen, was tatsächlich wirkt, kurz ist. Alles hier Genannte '
    + 'bewegt sich im niedrigen einstelligen Prozentbereich – Training, Schlaf und Essen entscheiden '
    + 'um Größenordnungen mehr.'));

  box.append(tabelle(
    el('thead', {}, el('tr', {},
      el('th', {}, 'Mittel'),
      el('th', {}, 'Dosis'),
      el('th', {}, 'Beleg'))),
    el('tbody', {}, ...wissen.supplemente.map((s) => el('tr', {},
      el('td', {}, el('div', {}, s.name), el('div', { class: 'mini' }, s.nutzen)),
      el('td', { class: 'mini' }, s.dosis),
      el('td', {}, el('span', { class: `guete ${s.guete}` }, s.guete)))))));

  box.append(el('p', { class: 'mini', style: { marginTop: '0.6rem' } },
    'Wenn du in einem Verband startest, der Dopingkontrollen durchführt: Nur Produkte mit '
    + 'Chargenprüfung (z. B. Kölner Liste) verwenden. Verunreinigungen sind der häufigste Grund '
    + 'für unbeabsichtigte positive Tests.'));

  return box;
}

function quellen() {
  const box = karte(el('h2', {}, 'Quellen'));
  box.append(el('p', { class: 'klein' },
    'Jede Zahl im Tracker stammt aus einer dieser Arbeiten. Wo es keine belastbare Studienlage '
    + 'gibt, steht das ausdrücklich dabei.'));

  // Zusammengeklappt, eine Zeile je Arbeit.
  //
  // Ausgeklappt sind es fünf Zeilen mal 28 Quellen: Die Karte war 6.649 px
  // hoch, also sieben iPhone-Bildschirme reiner Fließtext ohne eine einzige
  // Zwischenüberschrift. Wer nachschlagen will, wo eine Zahl herkommt,
  // scrollt daran vorbei statt sie zu finden. `<details>` ist dafür da, kostet
  // keine Abhängigkeit und funktioniert offline; die Kurzangabe samt
  // Güte-Abzeichen bleibt sichtbar, weil genau die beim Überfliegen zählt.
  for (const [, q] of Object.entries(wissen.quellen)) {
    box.append(el('details', { class: 'quelle-karte' },
      el('summary', {},
        el('span', { style: { fontSize: '0.88rem', fontWeight: '700' } }, q.kurz),
        el('span', { class: `guete ${q.guete}` }, q.guete)),
      // Die Art der Arbeit gehört sichtbar dazu: „stark" allein ist ein
      // Abzeichen, „Metaanalyse, 49 Studien, 1.863 Teilnehmer" ist eine
      // nachprüfbare Angabe. Die Güte folgt ohnehin aus der Art.
      el('div', { class: 'mini', style: { marginTop: '0.3rem', color: 'var(--muted-hell)' } },
        [ART_NAMEN[q.art] || q.art, q.umfang].filter(Boolean).join(' · ')),
      el('div', { class: 'mini', style: { marginTop: '0.15rem' } }, q.titel),
      el('p', { class: 'klein', style: { margin: '0.3rem 0 0' } }, q.kern),
      q.url ? el('a', { class: 'mini', href: q.url, target: '_blank', rel: 'noopener' }, 'Studie ansehen →') : null));
  }

  return box;
}

function grenzen() {
  const box = karte(el('h2', {}, 'Was dieser Tracker nicht kann'));

  box.append(hinweis(
    'Er ersetzt keine ärztliche oder physiotherapeutische Einschätzung. Bei Schmerzen, die über '
    + 'normalen Muskelkater hinausgehen, ist der richtige nächste Schritt eine Untersuchung – '
    + 'kein Plan und keine Formel.', 'warnung'));

  const grenzenListe = [
    ['Formeln sind Schätzungen',
      'Grundumsatz, Einer-Maximum und VO2max werden gerechnet, nicht gemessen. Sie taugen als '
      + 'Startpunkt und für den Verlauf – nicht als absolute Wahrheit. Wenn die Waage über vier '
      + 'Wochen etwas anderes sagt als die Kalorienrechnung, hat die Waage recht.'],
    ['Das Akut-zu-chronisch-Verhältnis sagt keine Verletzungen voraus',
      'Es wird oft so verkauft, hält der methodischen Prüfung aber nicht stand. Im Tracker steht es '
      + 'als Ampel für Belastungssprünge – das kann es, mehr nicht.'],
    ['Studienlage ist nicht dein Körper',
      'Alle Werte sind Gruppenmittel. Die Streuung zwischen Personen ist erheblich. Deine eigenen '
      + 'Testergebnisse über die Wochen sind aussagekräftiger als jede Empfehlung hier.'],
    ['Ein Plan, der nicht gemacht wird, ist wertlos',
      'Vier Tage, die stattfinden, schlagen sechs geplante, von denen drei ausfallen. Wenn der '
      + 'Umfang nicht in die Woche passt, schraub die Trainingstage runter statt Einheiten zu streichen.'],
  ];

  for (const [titel, text] of grenzenListe) {
    box.append(el('div', { style: { marginBottom: '0.8rem' } },
      el('h3', {}, titel),
      el('p', { class: 'klein', style: { margin: '0' } }, text)));
  }

  return box;
}
