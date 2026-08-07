// Profil: Körperdaten, der Ausrichtungsregler und die Rahmenbedingungen des Plans.

import {
  el, karte, hinweis, feld, sende, toast, zahl,
} from './common.js';
import { aktualisieren } from './app.js';

const MARKEN = [
  { wert: 0, name: 'Reiner Sprint', beschreibung: 'Alles auf Schnelligkeit und Maximalkraft. Ausdauer nur als Erholungsmittel.' },
  { wert: 25, name: 'Sprint mit Grundlage', beschreibung: 'Schwerpunkt Sprint und Kraft, dazu eine belastbare aerobe Basis.' },
  { wert: 50, name: 'Hybrid', beschreibung: 'Schnelligkeit, Kraft und Ausdauer gleichrangig. Der Kompromiss kostet an beiden Enden etwas.' },
  { wert: 75, name: 'Ausdauer mit Spritzigkeit', beschreibung: 'Schwerpunkt Ausdauer, Sprint und Kraft halten das Tempo oben.' },
  { wert: 100, name: 'Reine Ausdauer', beschreibung: 'Alles auf aerobe Leistung. Krafttraining nur noch erhaltend.' },
];

export function profilAnsicht(d) {
  const box = el('div', {});
  const p = d.profil;
  box.append(el('h1', {}, 'Profil'));

  box.append(reglerKarte(d, p));
  box.append(koerperKarte(p));
  box.append(pulsKarte(d, p));
  box.append(rahmenKarte(p));
  box.append(datenKarte());

  return box;
}

/* --------------------------------------------------------------- Regler */

function reglerKarte(d, p) {
  const box = karte(el('h2', {}, 'Ausrichtung'));

  box.append(el('p', { class: 'klein' },
    'Der wichtigste Regler im Tracker. Er entscheidet, wie viele Sprint-, Kraft- und '
    + 'Ausdauereinheiten die Woche hat, welches Ausdauergerät empfohlen wird und wie viele '
    + 'Kohlenhydrate der Ernährungsteil einplant. Du musst dich nicht festlegen – schieb ihn, '
    + 'wenn sich dein Schwerpunkt verschiebt, und der Plan zieht mit.'));

  const anzeigeName = el('div', { class: 'regler-name' });
  const anzeigeText = el('div', { class: 'regler-text' });
  const anteile = el('div', { class: 'anteile' });

  const regler = el('input', {
    type: 'range', min: '0', max: '100', step: '5',
    value: String(p.ausrichtung ?? 30),
    oninput: (e) => zeichneAnzeige(Number(e.target.value)),
    onchange: (e) => speichern({ ausrichtung: Number(e.target.value) }),
  });

  function zeichneAnzeige(wert) {
    let marke = MARKEN[0];
    for (const m of MARKEN) if (wert >= m.wert) marke = m;
    anzeigeName.textContent = `${marke.name} (${wert})`;
    anzeigeText.textContent = marke.beschreibung;

    const s = schwerpunkte(wert);
    anteile.replaceChildren(
      el('div', { class: 'anteil sprint', style: { width: `${s.sprint * 100}%` } },
        s.sprint > 0.14 ? 'Sprint' : ''),
      el('div', { class: 'anteil kraft', style: { width: `${s.kraft * 100}%` } },
        s.kraft > 0.14 ? 'Kraft' : ''),
      el('div', { class: 'anteil ausdauer', style: { width: `${s.ausdauer * 100}%` } },
        s.ausdauer > 0.14 ? 'Ausdauer' : ''));
  }

  zeichneAnzeige(Number(p.ausrichtung ?? 30));

  box.append(regler);
  box.append(el('div', { class: 'regler-marken' },
    el('span', {}, 'Sprint'),
    el('span', {}, 'Hybrid'),
    el('span', {}, 'Ausdauer')));
  box.append(el('div', { class: 'regler-anzeige' }, anzeigeName, anzeigeText));
  box.append(anteile);

  if (d.ausdauerEmpfehlung) {
    box.append(el('p', { class: 'klein', style: { marginTop: '0.7rem' } },
      el('strong', {}, `Empfohlenes Ausdauergerät: ${geraetName(d.ausdauerEmpfehlung.geraet)}. `),
      d.ausdauerEmpfehlung.begruendung));
  }

  return box;
}

/** Spiegelt profil.js auf dem Server, damit der Regler ohne Rückfrage reagiert. */
function schwerpunkte(ausrichtung) {
  const a = Math.min(100, Math.max(0, ausrichtung)) / 100;
  const sprint = 0.40 * (1 - a) + 0.05;
  const kraft = 0.40 - 0.15 * a;
  const ausdauer = 0.15 + 0.50 * a;
  const summe = sprint + kraft + ausdauer;
  return { sprint: sprint / summe, kraft: kraft / summe, ausdauer: ausdauer / summe };
}

function geraetName(schluessel) {
  return { rad: 'Rad', laufen: 'Laufen', gemischt: 'Gemischt (Rad und Laufen)' }[schluessel] || schluessel;
}

/* ---------------------------------------------------------- Körperdaten */

function koerperKarte(p) {
  const box = karte(el('h2', {}, 'Körperdaten'));
  box.append(el('p', { class: 'klein' },
    'Grundlage für den Kalorienbedarf. Der Körperfettanteil ist freiwillig – mit ihm rechnet '
    + 'der Tracker den Grundumsatz über die fettfreie Masse, was deutlich treffsicherer ist, '
    + 'und kann zusätzlich die Energieverfügbarkeit prüfen.'));

  const felder = {
    geburtsjahr: el('input', { type: 'number', min: '1930', max: '2020', value: p.geburtsjahr ?? '' }),
    groesseCm: el('input', { type: 'number', min: '100', max: '250', value: p.groesseCm ?? '' }),
    gewichtKg: el('input', { type: 'number', min: '30', max: '250', step: '0.1', value: p.gewichtKg ?? '' }),
    koerperfettProzent: el('input', { type: 'number', min: '3', max: '60', step: '0.5', value: p.koerperfettProzent ?? '' }),
  };

  const geschlecht = el('select', {},
    el('option', { value: 'm', selected: p.geschlecht === 'm' }, 'männlich'),
    el('option', { value: 'w', selected: p.geschlecht === 'w' }, 'weiblich'));

  box.append(el('div', { class: 'felder' },
    feld('Geburtsjahr', felder.geburtsjahr),
    feld('Geschlecht', geschlecht, 'Fließt nur in die Grundumsatzformel ein.')));
  box.append(el('div', { class: 'felder' },
    feld('Größe in cm', felder.groesseCm),
    feld('Gewicht in kg', felder.gewichtKg, 'Morgens nüchtern wiegen.')));
  box.append(feld('Körperfett in % (optional)', felder.koerperfettProzent,
    'Schätzung genügt. Caliper oder Waage sind ungenau im Absolutwert, aber brauchbar im Verlauf.'));

  box.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: () => speichern({
        geburtsjahr: felder.geburtsjahr.value,
        geschlecht: geschlecht.value,
        groesseCm: felder.groesseCm.value,
        gewichtKg: felder.gewichtKg.value,
        koerperfettProzent: felder.koerperfettProzent.value,
      }),
    }, 'Speichern')));

  return box;
}

/* ------------------------------------------------------- Herzfrequenz */

/**
 * Maximalpuls und Ruhepuls.
 *
 * Die Karte macht den Unterschied zwischen geschätzt und gemessen sichtbar,
 * statt ihn in einer Fußnote zu verstecken: Mit einem geschätzten Wert ist die
 * Zoneneinteilung kaum genauer als das Gefühl, und wer das nicht weiß, hält
 * eine Zahl für eine Messung, die keine ist.
 */
function pulsKarte(d, p) {
  const box = karte(el('h2', {}, 'Herzfrequenz'));
  const zonen = d.ausdauer?.pulszonen || null;

  box.append(el('p', { class: 'klein' },
    'Freiwillig. Ohne Puls läuft die Zoneneinteilung über die gefühlte Anstrengung – '
    + 'das reicht für die Dreiteilung locker / Grauzone / hart völlig aus. Mit einem '
    + 'gemessenen Maximalpuls wird sie genauer.'));

  const hfMax = el('input', {
    type: 'number', min: '120', max: '230', value: p.hfMaxGemessen ?? '',
  });

  box.append(feld('Gemessener Maximalpuls', hfMax,
    'Höchster Wert aus einem Ausbelastungstest oder einem harten Wettkampf. '
    + 'Leer lassen, wenn du keinen hast – dann wird aus dem Alter geschätzt.'));

  if (zonen) {
    box.append(el('div', { class: 'zonen-liste' },
      zonenZeile('Locker', `unter ${zonen.grauzone}`, 'locker'),
      zonenZeile('Grauzone', `${zonen.grauzone} – ${zonen.hart - 1}`, 'grauzone'),
      zonenZeile('Hart', `ab ${zonen.hart}`, 'hart')));
    // Kein „(geschätzt)" hinter der Zahl – der Hinweis sagt es im nächsten Satz
    // ohnehin, und zweimal hintereinander liest sich wie ein Fehler.
    box.append(el('p', { class: 'mini', style: { marginTop: '0.5rem' } },
      `Maximalpuls ${zonen.hfMax}. ${zonen.hinweis}`));
  } else {
    box.append(hinweis('Ohne Geburtsjahr und ohne gemessenen Maximalpuls lassen sich keine '
      + 'Zonen berechnen. Eingetragene Pulswerte werden trotzdem gespeichert und rückwirkend '
      + 'eingeordnet, sobald einer der beiden Werte da ist.', 'info'));
  }

  // Der Ruhepuls gehört nicht ins Profil, sondern in den Morgen-Check: Ein fest
  // eingetragener Wert veraltet und lässt sich mit nichts vergleichen. Hier
  // steht nur, was daraus geworden ist.
  const rp = d.belastung?.ruhepuls;
  box.append(el('h3', { style: { marginTop: '1rem' } }, 'Ruhepuls'));
  if (rp?.belastbar) {
    box.append(el('p', { class: 'klein' },
      `Grundlinie ${rp.grundlinie} bpm, zuletzt ${rp.jetzt} bpm.`));
  } else {
    box.append(el('p', { class: 'klein' },
      rp?.letzter
        ? `Zuletzt ${rp.letzter} bpm – noch zu wenige Messungen für einen Vergleich.`
        : 'Noch keine Messungen.'));
  }
  box.append(el('p', { class: 'mini' },
    'Wird im Morgen-Check eingetragen, morgens im Liegen. Nur dort ist er '
    + 'vergleichbar – und nur der Verlauf sagt etwas.'));

  box.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: () => speichern({ hfMaxGemessen: hfMax.value }),
    }, 'Speichern')));

  return box;
}

function zonenZeile(name, bereich, zone) {
  return el('div', { class: 'zonen-zeile' },
    el('span', {},
      el('span', { class: `zone-punkt ${zone}` }),
      name),
    el('span', { class: 'zonen-wert' }, `${bereich} bpm`));
}

/* ---------------------------------------------------------- Rahmen */

function rahmenKarte(p) {
  const box = karte(el('h2', {}, 'Rahmen des Plans'));

  const tage = el('select', {},
    ...[3, 4, 5, 6].map((n) => el('option', { value: n, selected: Number(p.trainingstageProWoche) === n },
      `${n} Tage`)));

  const alltag = el('select', {},
    ...[['sitzend', 'Sitzend (Büro, wenig Bewegung)'],
      ['leicht', 'Leicht aktiv (etwas auf den Beinen)'],
      ['mittel', 'Mittel (viel unterwegs)'],
      ['hoch', 'Hoch (körperliche Arbeit)']]
      .map(([wert, name]) => el('option', { value: wert, selected: p.alltagsaktivitaet === wert }, name)));

  const geraet = el('select', {},
    ...[['rad', 'Rad'], ['laufen', 'Laufen'], ['rudern', 'Rudergerät'],
      ['crosstrainer', 'Crosstrainer'], ['schwimmen', 'Schwimmen']]
      .map(([wert, name]) => el('option', { value: wert, selected: p.ausdauerGeraet === wert }, name)));

  const ziel = el('select', {},
    ...[['aufbauen', 'Aufbauen (+10 %)'], ['halten', 'Halten'], ['abnehmen', 'Abnehmen (−15 %)']]
      .map(([wert, name]) => el('option', { value: wert, selected: p.kalorienziel === wert }, name)));

  const start = el('input', { type: 'date', value: p.startdatum || '' });

  const koerpergewicht = el('input', { type: 'checkbox', ...(p.koerpergewichtsfokus ? { checked: true } : {}) });
  const wiedereinstieg = el('input', { type: 'checkbox', ...(p.wiedereinstieg ? { checked: true } : {}) });
  const gelenkschonend = el('input', { type: 'checkbox', ...(p.gelenkschonend !== false ? { checked: true } : {}) });

  box.append(el('div', { class: 'felder' },
    feld('Trainingstage pro Woche', tage,
      'Mehr Tage heißt nicht automatisch mehr Fortschritt – der Plan verteilt den Umfang, er addiert ihn nicht.'),
    feld('Ausdauergerät', geraet)));
  box.append(el('div', { class: 'felder' },
    feld('Alltagsaktivität', alltag, 'Ohne Training – das rechnet der Tracker separat dazu.'),
    feld('Kalorienziel', ziel)));

  box.append(feld('Startdatum', start,
    'Ab hier zählt Woche 1 des Zyklus. Lass es leer, solange du noch nicht startest – '
    + 'der Plan zeigt trotzdem, was auf dich zukommt.'));

  box.append(el('div', { class: 'feld' },
    el('label', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
      koerpergewicht, 'Muscle-Up und Liegestütze einplanen'),
    el('div', { class: 'mini' },
      'Ersetzt Latzug und Bankdrücken durch Klimmzüge und Dips an der geraden Stange – '
      + 'die Positionen, aus denen der Muscle-Up entsteht.')));

  box.append(el('div', { class: 'feld' },
    el('label', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
      wiedereinstieg, 'Wiedereinstieg: erste zwei Wochen reduziert'),
    el('div', { class: 'mini' },
      'Woche 1 mit 60 %, Woche 2 mit 80 % des Umfangs. Nach jeder längeren Pause ziehen '
      + 'Sehnen und Bänder langsamer nach als Muskeln und Motivation.')));

  box.append(el('div', { class: 'feld' },
    el('label', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } },
      gelenkschonend, 'Gelenkschonende Übungsauswahl'),
    el('div', { class: 'mini' },
      'Frontkniebeuge statt Nackenkniebeuge, Sechskantstange statt gerader Stange. '
      + 'Die Frontkniebeuge ist selbstbegrenzend – wer den Oberkörper nicht aufrecht hält, '
      + 'verliert die Stange nach vorn, bevor der Rücken überlastet wird. Die Sechskantstange '
      + 'verlagert die Last in die Körperachse und senkt die Spitzenmomente an der '
      + 'Lendenwirbelsäule deutlich, bei vergleichbarer Kraftentwicklung. '
      + 'Abschalten holt die klassischen Varianten zurück.')));

  box.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: () => speichern({
        trainingstageProWoche: tage.value,
        alltagsaktivitaet: alltag.value,
        ausdauerGeraet: geraet.value,
        kalorienziel: ziel.value,
        startdatum: start.value || null,
        koerpergewichtsfokus: koerpergewicht.checked,
        wiedereinstieg: wiedereinstieg.checked,
        gelenkschonend: gelenkschonend.checked,
      }),
    }, 'Speichern')));

  return box;
}

/* ------------------------------------------------------------ Daten */

function datenKarte() {
  const box = karte(el('h2', {}, 'Daten'));
  box.append(el('p', { class: 'klein' },
    'Alles liegt in data/tagebuch.json auf deinem Rechner – kein Konto, keine Cloud, '
    + 'kein Dritter, der mitliest. Das Trainingstagebuch wird über Jahre wertvoll: '
    + 'Sichere es regelmäßig.'));

  const datei = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
  datei.addEventListener('change', async () => {
    const f = datei.files?.[0];
    if (!f) return;
    try {
      const inhalt = JSON.parse(await f.text());
      const antwort = await sende('/import', inhalt);
      toast(`Importiert. Sicherung: ${antwort.sicherung}`, 'gut');
      aktualisieren();
    } catch (err) {
      toast(err.message, 'fehler');
    }
    datei.value = '';
  });

  box.append(el('div', { class: 'knopf-reihe' },
    el('a', { class: 'knopf', href: '/api/export', download: '' }, 'Exportieren'),
    el('button', { class: 'knopf', onclick: () => datei.click() }, 'Importieren'),
    datei));

  box.append(hinweis(
    'Der Import überschreibt alle vorhandenen Daten. Vorher wird automatisch eine '
    + 'Sicherungskopie neben der Datei abgelegt.', 'warnung'));

  return box;
}

/* ---------------------------------------------------------- Speichern */

async function speichern(felder) {
  try {
    await sende('/profil', felder, 'PUT');
    toast('Gespeichert.', 'gut');
    aktualisieren();
  } catch (err) {
    toast(err.message, 'fehler');
  }
}
