// Profil: Körperdaten, der Ausrichtungsregler und die Rahmenbedingungen des Plans.

import {
  el, karte, hinweis, feld, toast, zahl, dialog, dialogSchliessen, datumLang,
  dezimalFeld,
} from './common.js';
import * as daten from './daten.js';
import { aktualisieren } from './app.js';
// Fachliche Zahlen kommen aus der einzigen Stelle für Zahlen, auch wenn sie
// hier nur in einem Satz auftauchen.
import { ERNAEHRUNG, WIEDEREINSTIEG } from '../kern/wissen.js';
import { zahlText } from '../kern/regeln.js';
/*
 * `schwerpunkte()` stand hier nachgebaut, unter dem Kommentar „Spiegelt
 * profil.js auf dem Server, damit der Regler ohne Rückfrage reagiert" – die
 * Begründung ist mit dem Server verschwunden, die Kopie blieb. Und sie war
 * schon abgewichen: Der Kern rundet auf drei Stellen, die Kopie nicht.
 * Familie von Falle 21.
 */
import { schwerpunkte, ausrichtungName } from '../kern/profil.js';

/*
 * Ab welchem Anteil die Aufschrift in den Balkenabschnitt passt. Das ist eine
 * Platzfrage und keine Trainingsgröße – deshalb steht sie hier und nicht in
 * `wissen.js`. Sie stand dreimal als nackte 0.14 im Code.
 */
const AUFSCHRIFT_AB_ANTEIL = 0.14;

/*
 * `AUSRICHTUNG.marken` stand hier als `MARKEN` noch einmal – fünf Einträge
 * mit identischen Namen und Beschreibungen –, dazu die Auswahlschleife als
 * zweite Fassung von `ausrichtungName()`. Genau das Paar aus Falle 21:
 * Tabelle plus eigene Einordnung daneben.
 *
 * Der Zustand trägt die Marke zwar schon (`d.ausrichtung`), aber nur für den
 * **gespeicherten** Stand. Der Regler beschriftet sich beim Ziehen live, also
 * braucht die Ansicht die Einordnung für einen beliebigen Wert – dafür gibt
 * es die Kernfunktion, und dafür bekommt sie hier ihren zweiten Aufrufer.
 */
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

  // Der Regler bewegt seit Falle 46 auch den Umfang, nicht nur die Zahl der
  // Einheiten. Wie stark, ist eine Praxisentscheidung – und das gehört ans
  // Gerät und nicht nur in `wissen.js`.
  box.append(el('p', { class: 'mini' },
    'Jeder Schritt ändert etwas: die Zahl der Einheiten und ihren Umfang. Wie stark der '
    + 'Umfang mitzieht, ist Erfahrung und keine Studienlage – belegt ist die Richtung, '
    + 'nicht der Betrag. Am Sprint-Anschlag steht der Wochenumfang aus der Literatur, '
    + 'darunter weniger; die lockere Ausdauer wächst umgekehrt vom Erholungsmittel zur '
    + 'eigentlichen Arbeit, und die Krafteinheit wird von Aufbau zu Erhalt. Die Übungen '
    + 'bleiben dabei dieselben – jede steht für ein Bewegungsmuster, das auch ein '
    + 'Ausdauersportler braucht. Was sich ändert, sind die Sätze.'));

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
    const marke = ausrichtungName(wert);
    anzeigeName.textContent = `${marke.name} (${wert})`;
    anzeigeText.textContent = marke.beschreibung;

    const s = schwerpunkte(wert);
    anteile.replaceChildren(
      el('div', { class: 'anteil sprint', style: { width: `${s.sprint * 100}%` } },
        s.sprint > AUFSCHRIFT_AB_ANTEIL ? 'Sprint' : ''),
      el('div', { class: 'anteil kraft', style: { width: `${s.kraft * 100}%` } },
        s.kraft > AUFSCHRIFT_AB_ANTEIL ? 'Kraft' : ''),
      el('div', { class: 'anteil ausdauer', style: { width: `${s.ausdauer * 100}%` } },
        s.ausdauer > AUFSCHRIFT_AB_ANTEIL ? 'Ausdauer' : ''));
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
    gewichtKg: dezimalFeld({ value: p.gewichtKg ?? '' }),
    koerperfettProzent: dezimalFeld({ value: p.koerperfettProzent ?? '' }),
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
  // Was das Feld bewirkt, gehört daneben: Mit Angabe rechnet der Grundumsatz
  // über Cunningham (fettfreie Masse), ohne sie über Mifflin-St Jeor
  // (Gewicht, Größe, Alter). Und die Energieverfügbarkeit – die Zahl, an der
  // der Tracker vor Unterversorgung warnt – gibt es ohne fettfreie Masse gar
  // nicht. Vorher stand hier nur, wie man misst, nicht wozu.
  box.append(feld('Körperfett in % (optional)', felder.koerperfettProzent,
    'Schätzung genügt. Caliper oder Waage sind ungenau im Absolutwert, aber brauchbar im '
    + 'Verlauf. Mit Angabe läuft der Grundumsatz über die fettfreie Masse (Cunningham) statt '
    + 'über Gewicht, Größe und Alter (Mifflin-St Jeor) – und die Energieverfügbarkeit lässt '
    + 'sich überhaupt erst berechnen.'));

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

  // Die Prozentsätze standen hier als Text. Sie stammen aus
  // `ERNAEHRUNG.zielanpassung` und hängen an jedem Makroziel – abgetippt
  // altern sie still, sobald jemand die Konstante ändert.
  const zielProzent = (wert) => {
    const anteil = ERNAEHRUNG.zielanpassung[wert];
    if (!anteil) return '';
    return ` (${anteil > 0 ? '+' : '−'}${zahlText(Math.abs(anteil) * 100)} %)`;
  };
  const ziel = el('select', {},
    ...[['aufbauen', 'Aufbauen'], ['halten', 'Halten'], ['abnehmen', 'Abnehmen']]
      .map(([wert, name]) => el('option', { value: wert, selected: p.kalorienziel === wert },
        `${name}${zielProzent(wert)}`)));

  const start = el('input', { type: 'date', value: p.startdatum || '' });

  const koerpergewicht = el('input', { type: 'checkbox', ...(p.koerpergewichtsfokus ? { checked: true } : {}) });
  const wiedereinstieg = el('input', { type: 'checkbox', ...(p.wiedereinstieg ? { checked: true } : {}) });
  const gelenkschonend = el('input', { type: 'checkbox', ...(p.gelenkschonend !== false ? { checked: true } : {}) });

  box.append(el('div', { class: 'felder' },
    feld('Trainingstage pro Woche', tage,
      'Mehr Tage heißt nicht automatisch mehr Fortschritt – der Plan verteilt den Umfang, er addiert ihn nicht.'),
    feld('Ausdauergerät', geraet)));
  box.append(el('div', { class: 'felder' },
    // Der Faktor multipliziert den Grundumsatz und geht damit in das
    // Kalorienziel *und* in die Energieverfügbarkeit. Dass er bewusst unter
    // den geläufigen PAL-Werten liegt, ist die eigene Anpassung des Trackers
    // und keine Literaturzahl – das gehört ans Gerät (Falle 41).
    feld('Alltagsaktivität', alltag,
      'Ohne Training – das rechnet der Tracker separat dazu. Die Faktoren liegen deshalb '
      + 'unter den geläufigen PAL-Werten, die das Training bereits enthalten; dieser Abschlag '
      + 'ist eine eigene Anpassung und keine Literaturzahl.'),
    feld('Kalorienziel', ziel,
      'Richtung und Größenordnung sind unstrittig, die Prozentsätze selbst sind eine '
      + 'Abwägung zwischen Tempo und Qualität – keine Studienzahl.')));

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
      // Keine Wochenzahl in der Aufschrift: Die Zeile darunter zählt die
      // Wochen einzeln auf, das wäre dieselbe Angabe zweimal (Falle 13) –
      // und „erste 2 Wochen" liest sich obendrein schlechter als der Satz,
      // der die Faktoren ohnehin nennt.
      wiedereinstieg, 'Wiedereinstieg: reduzierter Umfang zu Beginn'),
    el('div', { class: 'mini' },
      // Faktoren und Länge kommen aus derselben Liste – „zwei Wochen" und
      // „60 / 80 %" waren vorher drei Zahlen, die getrennt altern konnten.
      `${WIEDEREINSTIEG.volumenFaktorJeWoche
        .map((f, i) => `Woche ${i + 1} mit ${zahlText(f * 100)} %`).join(', ')} des Umfangs. `
      + 'Nach jeder längeren Pause ziehen Sehnen und Bänder langsamer nach als Muskeln '
      + 'und Motivation. Die abgestufte Rückkehr ist unstrittig, die Abstufung selbst '
      + 'ist Erfahrung und keine Studienzahl.')));

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
    'Alles liegt auf diesem Gerät – kein Konto, keine Cloud, kein Dritter, der mitliest. '
    + 'Das ist die gute Nachricht und zugleich der Haken: Geht das Gerät verloren, sind '
    + 'die Daten weg. Ein Trainingstagebuch wird über Jahre wertvoll, also sichere es '
    + 'regelmäßig.'));
  if (daten.kannTeilen()) {
    box.append(el('p', { class: 'klein' },
      '„Teilen" öffnet den Dialog deines Geräts – darüber geht die Sicherung per AirDrop '
      + 'direkt auf den Laptop. Dort spielst du sie mit „Einspielen" ein; so haben beide '
      + 'Geräte denselben Stand.'));
  }

  // Ob der Browser die Daten dauerhaft behält, entscheidet er selbst. Steht es
  // nicht dabei, hält man den Speicher für sicherer, als er ist.
  const speicherStand = el('p', { class: 'mini' });
  daten.istDauerhaft().then((dauerhaft) => {
    speicherStand.textContent = dauerhaft
      ? 'Der Browser hat zugesagt, die Daten dauerhaft zu behalten.'
      : 'Der Browser hat den Speicher noch nicht als dauerhaft zugesagt. Am '
        + 'zuverlässigsten wird er, wenn du die App zum Startbildschirm hinzufügst.';
  }).catch(() => {});

  const datei = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
  datei.addEventListener('change', async () => {
    const f = datei.files?.[0];
    if (!f) return;
    try {
      einspielenBestaetigen(await daten.importVorschau(f));
    } catch (err) {
      toast(err.message, 'fehler');
    }
    datei.value = '';
  });

  const knoepfe = el('div', { class: 'knopf-reihe' });

  // Wo der Teilen-Dialog Dateien kann, ist er der kürzere Weg: Auf dem iPhone
  // steht AirDrop direkt darin, und die Sicherung ist mit zwei Tipps auf dem
  // Laptop. Herunterladen bleibt daneben stehen, weil man die Datei auch
  // einfach ablegen können soll.
  if (daten.kannTeilen()) {
    knoepfe.append(el('button', {
      class: 'knopf haupt',
      onclick: async () => {
        try {
          await daten.teilen();
        } catch (err) {
          // Abbrechen im Teilen-Dialog ist kein Fehler, den man melden muss.
          if (err.name !== 'AbortError') toast(err.message, 'fehler');
        }
      },
    }, 'Sicherung teilen'));
  }

  knoepfe.append(
    el('button', {
      class: 'knopf',
      onclick: async () => {
        try {
          await daten.exportieren();
          toast('Sicherung heruntergeladen.', 'gut');
        } catch (err) { toast(err.message, 'fehler'); }
      },
    }, 'Herunterladen'),
    el('button', { class: 'knopf', onclick: () => datei.click() }, 'Einspielen'),
    datei);
  box.append(knoepfe);

  box.append(speicherStand);
  box.append(hinweis(
    'Das Einspielen ersetzt alle vorhandenen Daten. Was drinsteht, siehst du vorher – '
    + 'und der bisherige Stand wird automatisch als Datei gesichert.', 'warnung'));

  return box;
}

/**
 * Vor dem Ersetzen zeigen, was auf beiden Seiten steht.
 *
 * Der Tracker verbietet nichts, auch hier nicht – aber er lässt niemanden
 * blind einen Jahresbestand überschreiben. Ist die Datei älter als das, was
 * auf dem Gerät liegt, steht das als Warnung darüber statt als Kleingedrucktes.
 */
function einspielenBestaetigen(vorschau) {
  const { datei: neu, bisher, aelter, leert } = vorschau;
  const zeile = (name, a, b) => el('tr', {},
    el('td', {}, name),
    el('td', { style: { textAlign: 'right' } }, String(b)),
    el('td', { style: { textAlign: 'right' } }, String(a)));

  const inhalt = el('div', {},
    el('h2', {}, 'Sicherung einspielen'),
    el('table', { style: { width: '100%' } },
      el('thead', {}, el('tr', {},
        el('th', {}, ''),
        el('th', { style: { textAlign: 'right' } }, 'Jetzt'),
        el('th', { style: { textAlign: 'right' } }, 'Datei'))),
      el('tbody', {},
        zeile('Einheiten', neu.sessions, bisher.sessions),
        zeile('Mahlzeiten', neu.essen, bisher.essen),
        zeile('Morgen-Checks', neu.checks, bisher.checks),
        zeile('Tests', neu.tests, bisher.tests),
        zeile('Letzter Eintrag',
          neu.letztesDatum ? datumLang(neu.letztesDatum) : '–',
          bisher.letztesDatum ? datumLang(bisher.letztesDatum) : '–'))));

  if (aelter) {
    inhalt.append(hinweis(
      'Die Datei ist älter als dein aktueller Stand. Alles, was du seitdem eingetragen '
      + 'hast, wäre danach weg. Sicher, dass es die richtige Datei ist?', 'gefahr'));
  } else if (leert) {
    inhalt.append(hinweis(
      'Die Datei enthält keine Einträge. Danach wäre dein Tagebuch leer.', 'gefahr'));
  }

  inhalt.append(el('p', { class: 'mini' },
    'Dein bisheriger Stand wird vor dem Ersetzen automatisch als Datei gesichert.'));

  inhalt.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: async () => {
        try {
          await daten.importUebernehmen(vorschau.geprueft);
          dialogSchliessen();
          toast('Eingespielt. Der vorherige Stand wurde gesichert.', 'gut');
          aktualisieren();
        } catch (err) { toast(err.message, 'fehler'); }
      },
    }, 'Einspielen'),
    el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen')));

  dialog(inhalt);
}

/* ---------------------------------------------------------- Speichern */

async function speichern(felder) {
  try {
    await daten.profilSpeichern(felder);
    toast('Gespeichert.', 'gut');
    aktualisieren();
  } catch (err) {
    toast(err.message, 'fehler');
  }
}
