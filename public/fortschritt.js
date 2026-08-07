// Fortschritt: Leistungstests, Kraftmarken, der Weg zum Muscle-Up, Belastungsverlauf.

import {
  el, karte, kennzahl, hinweis, feld, dialog, dialogSchliessen, linienDiagramm,
  hole, sende, loesche, toast, zahl, datumLang,
} from './common.js';
import { aktualisieren } from './app.js';

/** Was getestet wird und wie es zu lesen ist. */
const TESTS = {
  sprint30: { name: '30 m Sprint', einheit: 's', besser: 'kleiner', hilfe: 'Fliegend oder aus dem Stand – Hauptsache immer gleich messen.' },
  sprint10: { name: '10 m Sprint', einheit: 's', besser: 'kleiner', hilfe: 'Beschleunigung aus dem Stand.' },
  standweitsprung: { name: 'Standweitsprung', einheit: 'cm', besser: 'groesser', hilfe: 'Beidbeinig, aus dem Stand. Guter Ersatz für eine Kraftmessplatte.' },
  klimmzuege: { name: 'Klimmzüge max.', einheit: 'Wdh.', besser: 'groesser', hilfe: 'Ohne Schwung, voll ausgestreckt starten.' },
  liegestuetze: { name: 'Liegestütze max.', einheit: 'Wdh.', besser: 'groesser', hilfe: 'Brust bis auf Fausthöhe, Körper in einer Linie.' },
  muscleups: { name: 'Muscle-Ups max.', einheit: 'Wdh.', besser: 'groesser', hilfe: 'Am Stück, ohne Absetzen.' },
  klimmzugZusatzlast: { name: 'Klimmzug Zusatzlast', einheit: 'kg', besser: 'groesser', hilfe: 'Schwerste saubere Einzelwiederholung mit Zusatzgewicht.' },
  kniebeuge: { name: 'Kniebeuge', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen – daraus wird das Einer-Maximum geschätzt.', mitWdh: true },
  kreuzheben: { name: 'Kreuzheben', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen.', mitWdh: true },
  bankdruecken: { name: 'Bankdrücken', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen.', mitWdh: true },
  hipthrust: { name: 'Hip Thrust', einheit: 'kg', besser: 'groesser', hilfe: 'Gewicht und Wiederholungen eintragen.', mitWdh: true },
  cooper: { name: 'Cooper-Test', einheit: 'm', besser: 'groesser', hilfe: '12 Minuten so weit wie möglich. Daraus schätzt der Tracker die VO2max.' },
};

let testDaten = null;

export function fortschrittAnsicht(d) {
  const box = el('div', {});
  box.append(el('h1', {}, 'Fortschritt'));

  box.append(muscleupKarte(d));
  box.append(kraftKarte(d));
  box.append(belastungKarte(d));
  box.append(gewichtKarte(d));
  box.append(testKarte(d));

  return box;
}

/* ------------------------------------------------------------ Muscle-Up */

function muscleupKarte(d) {
  const m = d.muscleup;
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Weg zum Muscle-Up'),
      el('span', { class: 'mini' }, `Stufe ${m.erreicht} von ${m.gesamt}`)));

  box.append(el('div', { class: 'balken' },
    el('div', {
      class: 'balken-fuellung',
      style: { width: `${m.fortschrittProzent}%`, background: 'var(--sprint)' },
    })));

  if (m.naechste) {
    box.append(el('p', { class: 'klein' },
      `Als Nächstes: ${m.naechste.name} – ${m.naechste.tor}`));
  } else {
    box.append(hinweis('Alle Stufen erreicht. Jetzt geht es um Wiederholungszahl und Sauberkeit.', 'gut'));
  }

  const stufen = el('div', { style: { marginTop: '0.7rem' } });
  for (const s of STUFEN) {
    const erreicht = s.stufe <= m.erreicht;
    const aktuell = s.stufe === m.erreicht + 1;
    const zeile = el('div', { class: `stufe ${erreicht ? 'erreicht' : ''} ${aktuell ? 'aktuell' : ''}` },
      el('div', { class: 'stufe-nummer' }, erreicht ? '✓' : s.stufe),
      el('div', { class: 'stufe-text' },
        el('div', { class: 'stufe-name' }, s.name),
        el('div', { class: 'stufe-tor' }, s.tor)));

    // Stufen ohne messbaren Test bestätigt man selbst – sonst bliebe der Weg
    // an Stufe 4 hängen, obwohl sie längst steht.
    if (s.pruefung === 'manuell') {
      zeile.append(el('button', {
        class: 'knopf leise',
        onclick: async () => {
          try {
            await sende('/muscleup', { stufe: s.stufe, erreicht: !erreicht });
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, erreicht ? 'zurück' : 'geschafft'));
    }
    stufen.append(zeile);
  }
  box.append(stufen);

  box.append(el('p', { class: 'mini', style: { marginTop: '0.6rem' } },
    'Die Stufen bauen aufeinander auf: Ohne Zugkraft über die Stange hinaus gibt es keinen '
    + 'Übergang, und ohne Dip-Kraft keinen Ausstoß. Überspringen führt zu Schwung statt Kraft – '
    + 'und Schwung belastet die Schulter, ohne den Muscle-Up näher zu bringen. Die Marke von '
    + '+25 % Zusatzlast ist Trainerpraxis, keine Studienlage.'));

  return box;
}

const STUFEN = [
  { stufe: 1, name: 'Saubere Klimmzüge', tor: '8 Wiederholungen ohne Schwung', pruefung: 'klimmzuege' },
  { stufe: 2, name: 'Klimmzug-Volumen', tor: '12 Wiederholungen ohne Schwung', pruefung: 'klimmzuege' },
  { stufe: 3, name: 'Zusatzlast', tor: 'Klimmzug mit +25 % Körpergewicht', pruefung: 'zusatzlast' },
  { stufe: 4, name: 'Hohe Klimmzüge', tor: 'Stange berührt das Brustbein, 5 Wiederholungen', pruefung: 'manuell' },
  { stufe: 5, name: 'Straight-Bar-Dips', tor: '8 Wiederholungen an der Stange', pruefung: 'manuell' },
  { stufe: 6, name: 'Explosive Klimmzüge', tor: 'Hände lösen sich kurz von der Stange', pruefung: 'manuell' },
  { stufe: 7, name: 'Übergang', tor: '5 negative Muscle-Ups kontrolliert', pruefung: 'manuell' },
  { stufe: 8, name: 'Muscle-Up mit Schwung', tor: 'Erster Muscle-Up mit leichtem Kip', pruefung: 'muscleups' },
  { stufe: 9, name: 'Strikter Muscle-Up', tor: 'Ohne Schwung aus dem Hang', pruefung: 'muscleups' },
  { stufe: 10, name: 'Mehrfach strikt', tor: '5 strikte Muscle-Ups am Stück', pruefung: 'muscleups' },
];

/* ---------------------------------------------------------- Kraftmarken */

const MARKEN = {
  kniebeuge: { einstieg: 1.0, solide: 1.5, stark: 2.0 },
  kreuzheben: { einstieg: 1.25, solide: 1.75, stark: 2.25 },
  bankdruecken: { einstieg: 0.75, solide: 1.0, stark: 1.4 },
  hipthrust: { einstieg: 1.25, solide: 1.75, stark: 2.5 },
};

function kraftKarte(d) {
  const box = karte(el('h2', {}, 'Kraft im Verhältnis zum Körpergewicht'));
  const kg = Number(d.profil.gewichtKg);

  if (!kg) {
    box.append(el('p', { class: 'klein' }, 'Ohne Körpergewicht im Profil lässt sich das nicht einordnen.'));
    return box;
  }

  const tests = testDaten?.tests || [];
  const zeilen = [];

  for (const [uebung, marken] of Object.entries(MARKEN)) {
    const beste = besteSchaetzung(tests, uebung);
    const faktor = beste ? beste / kg : null;
    zeilen.push(el('tr', {},
      el('td', {}, TESTS[uebung]?.name || uebung),
      el('td', { class: 'zahl' }, beste ? `${zahl(beste, 1)} kg` : '–'),
      el('td', { class: 'zahl' }, faktor ? `${zahl(faktor, 2)} ×` : '–'),
      el('td', { class: 'mini' }, faktor ? einordnung(faktor, marken) : `Ziel ${marken.solide} ×`)));
  }

  box.append(el('table', {},
    el('thead', {}, el('tr', {},
      el('th', {}, 'Übung'),
      el('th', { class: 'zahl' }, 'Geschätztes 1RM'),
      el('th', { class: 'zahl' }, 'x KG'),
      el('th', {}, 'Einordnung'))),
    el('tbody', {}, ...zeilen)));

  box.append(el('p', { class: 'mini', style: { marginTop: '0.6rem' } },
    'Relative Maximalkraft hängt eng mit Sprintleistung zusammen. Oberhalb der Marke „stark" '
    + 'flacht dieser Zusammenhang ab – dann bringt Explosivkraft mehr als noch mehr Maximalkraft '
    + '(Suchomel 2016). Das Einer-Maximum wird nach Epley geschätzt und wird über zehn '
    + 'Wiederholungen zunehmend ungenau.'));

  return box;
}

function besteSchaetzung(tests, art) {
  const passend = tests.filter((t) => t.art === art);
  if (!passend.length) return null;
  return Math.max(...passend.map((t) => {
    const w = Number(t.wert) || 0;
    const r = Number(t.wiederholungen) || 1;
    return r <= 1 ? w : w * (1 + r / 30);
  }));
}

function einordnung(faktor, marken) {
  if (faktor >= marken.stark) return 'stark';
  if (faktor >= marken.solide) return 'solide';
  if (faktor >= marken.einstieg) return 'Einstieg';
  return 'unter Einstieg';
}

/* --------------------------------------------------------- Belastung */

function belastungKarte(d) {
  const b = d.belastung;
  const box = karte(el('h2', {}, 'Belastung'));

  const punkte = b.verlauf.map((w) => ({ wert: w.last }));
  box.append(el('h3', {}, 'Wochenlast (RPE × Minuten), letzte 12 Wochen'));
  // Belastungssummen gehören auf eine Achse ab null: Hier ist „doppelt so viel"
  // eine sinnvolle Aussage, anders als bei einer Sprintzeit.
  box.append(linienDiagramm(punkte, { farbe: 'var(--kraft)', abNull: true }));

  const kennzahlen = el('div', { class: 'kennzahlen', style: { marginTop: '0.7rem' } });
  kennzahlen.append(kennzahl(zahl(b.acwr.akut), 'Diese Woche', 'Belastungseinheiten'));
  if (b.acwr.belastbar) {
    kennzahlen.append(kennzahl(zahl(b.acwr.wert, 2), 'Akut / chronisch',
      b.acwr.stufe,
      b.acwr.stufe === 'sprung' ? 'var(--gefahr)' : b.acwr.stufe === 'erhoeht' ? 'var(--warn)' : 'var(--ausdauer)'));
  }
  if (b.monotonie.belastbar) {
    kennzahlen.append(kennzahl(zahl(b.monotonie.wert, 2), 'Monotonie',
      b.monotonie.hoch ? 'zu gleichförmig' : 'gut verteilt',
      b.monotonie.hoch ? 'var(--warn)' : 'var(--ausdauer)'));
  }
  box.append(kennzahlen);

  if (b.acwr.belastbar) {
    box.append(el('p', { class: 'klein' }, b.acwr.text));
    box.append(el('p', { class: 'mini' }, b.acwr.einschraenkung));
  } else {
    box.append(el('p', { class: 'klein' }, b.acwr.hinweis));
  }

  if (b.monotonie.belastbar) box.append(el('p', { class: 'klein' }, b.monotonie.text));

  return box;
}

/* ------------------------------------------------------------- Gewicht */

function gewichtKarte(d) {
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Gewicht'),
      el('button', { class: 'knopf', onclick: () => gewichtDialog() }, '+ Wiegen')));

  const verlauf = d.gewichtsverlauf || [];
  if (verlauf.length < 2) {
    box.append(el('p', { class: 'klein' },
      'Noch zu wenig Verlauf. Am besten immer morgens nüchtern wiegen – sonst misst du '
      + 'vor allem den Mageninhalt. Einzelne Tage schwanken um ein bis zwei Kilo; '
      + 'aussagekräftig wird erst der Verlauf über zwei bis drei Wochen.'));
    return box;
  }

  box.append(linienDiagramm(verlauf.map((g) => ({ wert: g.kg })), {
    farbe: 'var(--ausdauer)', einheit: ' kg',
  }));

  const erste = verlauf[0];
  const letzte = verlauf[verlauf.length - 1];
  const diff = letzte.kg - erste.kg;
  box.append(el('p', { class: 'klein' },
    `${zahl(erste.kg, 1)} kg (${datumLang(erste.datum)}) → ${zahl(letzte.kg, 1)} kg (${datumLang(letzte.datum)}) · `
    + `${diff >= 0 ? '+' : ''}${zahl(diff, 1)} kg`));

  // Wöchentliche Änderungsrate einordnen: Beim Aufbau sind mehr als ~0,5 %
  // Körpergewicht pro Woche überwiegend Fett, beim Abnehmen kostet mehr als
  // ~1 % zunehmend Muskelmasse und Sprintleistung.
  const wochen = (new Date(letzte.datum) - new Date(erste.datum)) / (7 * 86400000);
  if (wochen >= 2) {
    const proWoche = diff / wochen;
    const prozent = (proWoche / letzte.kg) * 100;
    box.append(el('p', { class: 'mini' },
      `Im Schnitt ${proWoche >= 0 ? '+' : ''}${zahl(proWoche, 2)} kg pro Woche `
      + `(${zahl(prozent, 2)} % Körpergewicht).`));
    if (prozent > 0.5) {
      box.append(hinweis('Aufbau schneller als ~0,5 % pro Woche – der Überschuss landet '
        + 'überwiegend als Fett. Kalorien etwas zurücknehmen.', 'warnung'));
    } else if (prozent < -1) {
      box.append(hinweis('Abnahme schneller als ~1 % pro Woche. Das kostet Magermasse und '
        + 'Sprintleistung. Defizit verkleinern und Protein oben halten.', 'warnung'));
    }
  }

  return box;
}

function gewichtDialog() {
  const kg = el('input', { type: 'number', step: '0.1', min: '30', max: '250' });
  const datum = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });

  dialog(el('div', {},
    el('h2', {}, 'Gewicht eintragen'),
    feld('Gewicht in kg', kg, 'Morgens nüchtern, nach dem Toilettengang.'),
    feld('Datum', datum, 'Lässt sich nachtragen, falls du das Wiegen vergessen hast.'),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          if (!kg.value) return toast('Gewicht fehlt.', 'fehler');
          try {
            await sende('/gewicht', { kg: Number(kg.value), datum: datum.value });
            dialogSchliessen();
            toast('Gewicht gespeichert.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Speichern'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen'))));
  kg.focus();
}

/* --------------------------------------------------------------- Tests */

function testKarte(d) {
  const box = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Leistungstests'),
      el('button', { class: 'knopf', onclick: () => testDialog() }, '+ Test')));

  box.append(el('p', { class: 'klein' },
    'Alle vier bis sechs Wochen testen, am besten am Ende einer Entlastungswoche – '
    + 'dann misst du Leistung und nicht Ermüdung.'));

  if (!testDaten) {
    hole('/tests').then((daten) => { testDaten = daten; aktualisieren(); }).catch(() => {});
    box.append(el('p', { class: 'klein' }, 'Lädt …'));
    return box;
  }

  if (!testDaten.tests.length) {
    box.append(el('p', { class: 'klein' }, 'Noch keine Tests eingetragen.'));
    return box;
  }

  const nachArt = new Map();
  for (const t of testDaten.tests) {
    if (!nachArt.has(t.art)) nachArt.set(t.art, []);
    nachArt.get(t.art).push(t);
  }

  for (const [art, liste] of nachArt) {
    const info = TESTS[art] || { name: art, einheit: '' };
    const sortiert = [...liste].sort((a, b) => (a.datum < b.datum ? -1 : 1));
    box.append(el('h3', { style: { marginTop: '0.8rem' } }, info.name));
    box.append(linienDiagramm(sortiert.map((t) => ({ wert: t.wert })), {
      farbe: 'var(--sprint)',
      hoehe: 60,
      einheit: ` ${info.einheit}`,
      kleinerIstBesser: info.besser === 'kleiner',
    }));
    for (const t of sortiert.slice().reverse().slice(0, 3)) {
      box.append(el('div', { class: 'zeile' },
        el('div', { class: 'zeile-text' },
          el('div', { class: 'zeile-titel' },
            `${zahl(t.wert, info.einheit === 's' ? 2 : 0)} ${info.einheit}`
            + (t.wiederholungen ? ` × ${t.wiederholungen}` : '')),
          el('div', { class: 'zeile-meta' }, datumLang(t.datum) + (t.notiz ? ` · ${t.notiz}` : ''))),
        el('button', {
          class: 'knopf leise gefahr',
          onclick: async () => {
            try {
              await loesche(`/test/${t.id}`);
              testDaten = null;
              aktualisieren();
            } catch (err) { toast(err.message, 'fehler'); }
          },
        }, '×')));
    }
    if (art === 'cooper') {
      const letzter = sortiert[sortiert.length - 1];
      const vo2 = (letzter.wert - 504.9) / 44.73;
      box.append(el('p', { class: 'mini' },
        `Geschätzte VO2max: ${zahl(vo2, 1)} ml/kg/min (Cooper-Formel).`));
    }
  }

  return box;
}

function testDialog() {
  const art = el('select', {},
    ...Object.entries(TESTS).map(([wert, t]) => el('option', { value: wert }, t.name)));
  const wert = el('input', { type: 'number', step: '0.01', min: '0' });
  const wdh = el('input', { type: 'number', min: '1', max: '20', value: '5' });
  const notiz = el('input', { type: 'text', placeholder: 'optional' });
  const hilfe = el('div', { class: 'mini' });
  const wdhFeld = feld('Wiederholungen', wdh,
    'Aus Gewicht und Wiederholungen wird das Einer-Maximum nach Epley geschätzt.');

  function anpassen() {
    const info = TESTS[art.value];
    hilfe.textContent = `${info.hilfe} Einheit: ${info.einheit}`;
    wdhFeld.hidden = !info.mitWdh;
  }
  art.addEventListener('change', anpassen);
  anpassen();

  dialog(el('div', {},
    el('h2', {}, 'Test eintragen'),
    feld('Art', art),
    hilfe,
    feld('Wert', wert),
    wdhFeld,
    feld('Notiz', notiz),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          if (!wert.value) return toast('Wert fehlt.', 'fehler');
          try {
            await sende('/test', {
              art: art.value,
              wert: Number(wert.value),
              wiederholungen: TESTS[art.value].mitWdh ? Number(wdh.value) : null,
              notiz: notiz.value,
            });
            dialogSchliessen();
            testDaten = null;
            toast('Test gespeichert.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Speichern'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen'))));
  wert.focus();
}
