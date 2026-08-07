// Die Startansicht: Was steht heute an, wie bereit bin ich, was fehlt beim Essen.

import {
  el, karte, kennzahl, balken, hinweis, feld, dialog, dialogSchliessen,
  sende, toast, zahl, dauer, TYP_NAMEN, TAGESTYP_NAMEN, heute as heuteDatum,
} from './common.js';
import { aktualisieren } from './app.js';
import { einheitKarte } from './planAnsicht.js';

export function heuteAnsicht(d) {
  const box = el('div', {});
  const h = d.heute;

  if (!d.profilStatus.vollstaendig) {
    box.append(hinweis(
      `Im Profil fehlen noch: ${d.profilStatus.fehlend.join(', ')}. `
      + 'Ohne diese Angaben kann der Ernährungsteil nichts rechnen.', 'warnung'));
  }

  if (d.startetErstNoch) {
    box.append(hinweis(
      `Dein Startdatum liegt in der Zukunft. Der Plan unten zeigt schon Woche 1, `
      + 'damit du weißt, was auf dich zukommt – gezählt wird ab dem Startdatum.', 'info'));
  }

  box.append(el('h1', {}, `${d.plan.tage[tagIndex(d.datum)].name}, ${new Date(d.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}`));

  box.append(bereitschaftKarte(h));
  box.append(trainingKarte(d, h));
  box.append(ernaehrungKarte(d, h));

  if (d.belastung.entlastung.faellig) {
    box.append(karte(
      el('h2', {}, 'Entlastung wäre jetzt sinnvoll'),
      el('p', { class: 'klein' }, d.belastung.entlastung.text),
      el('ul', { class: 'klein' }, ...d.belastung.entlastung.gruende.map((g) => el('li', {}, g)))));
  }

  return box;
}

function tagIndex(datum) {
  return (new Date(datum).getDay() + 6) % 7;
}

/* -------------------------------------------------------- Morgen-Check */

function bereitschaftKarte(h) {
  const b = h.bereitschaft;

  if (!b?.vollstaendig) {
    return karte(
      el('div', { class: 'karte-kopf' }, el('h2', {}, 'Morgen-Check')),
      el('p', { class: 'klein' },
        'Fünf Fragen, zwanzig Sekunden. Der Wert entscheidet, ob der geplante Tag '
        + 'heute Sinn ergibt – und er ist nur dann aussagekräftig, wenn er täglich kommt.'),
      el('div', { class: 'knopf-reihe' },
        el('button', { class: 'knopf haupt', onclick: checkDialog }, 'Check ausfüllen')));
  }

  return karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, el('span', { class: `ampel ${b.ampel}` }), 'Bereitschaft'),
      el('span', { class: 'mini' }, `${b.prozent} %`)),
    balken(b.prozent, b.ampel === 'gruen' ? 'var(--ausdauer)' : b.ampel === 'gelb' ? 'var(--warn)' : 'var(--gefahr)'),
    el('p', { class: 'klein' }, b.empfehlung),
    el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf leise', onclick: checkDialog }, 'Ändern')));
}

function checkDialog() {
  const fragen = [
    { id: 'schlaf', frage: 'Schlafqualität', skala: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] },
    { id: 'muskelkater', frage: 'Muskelkater', skala: ['extrem', 'stark', 'spürbar', 'leicht', 'keiner'] },
    { id: 'stress', frage: 'Stresslevel', skala: ['sehr hoch', 'hoch', 'mittel', 'niedrig', 'sehr niedrig'] },
    { id: 'stimmung', frage: 'Stimmung', skala: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] },
    { id: 'energie', frage: 'Energie', skala: ['leer', 'wenig', 'okay', 'viel', 'topfit'] },
  ];

  const werte = {};
  const inhalt = el('div', {}, el('h2', {}, 'Morgen-Check'));

  for (const frage of fragen) {
    const anzeige = el('span', { class: 'mini' }, '–');
    const regler = el('input', {
      type: 'range', min: '1', max: '5', step: '1', value: '3',
      oninput: (e) => {
        werte[frage.id] = Number(e.target.value);
        anzeige.textContent = frage.skala[Number(e.target.value) - 1];
      },
    });
    werte[frage.id] = 3;
    anzeige.textContent = frage.skala[2];
    inhalt.append(el('div', { class: 'feld' },
      el('label', {}, frage.frage, ' · ', anzeige),
      regler));
  }

  inhalt.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: async () => {
        try {
          await sende('/check', { datum: heuteDatum(), ...werte });
          dialogSchliessen();
          toast('Check gespeichert.', 'gut');
          aktualisieren();
        } catch (err) { toast(err.message, 'fehler'); }
      },
    }, 'Speichern'),
    el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen')));

  dialog(inhalt);
}

/* ------------------------------------------------------------ Training */

function trainingKarte(d, h) {
  const inhalt = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, h.trainingstag ? 'Heute im Plan' : 'Heute frei'),
      el('span', { class: 'mini' }, h.trainingstag ? dauer(h.minuten) : 'Ruhetag')));

  if (!h.trainingstag) {
    inhalt.append(el('p', { class: 'klein' },
      'Ruhetag. Er ist Teil des Plans, nicht das Fehlen davon – Anpassung passiert in der Erholung. '
      + 'Lockeres Gehen oder Mobilität ist in Ordnung, alles mit Anstrengung nicht.'));
  } else {
    for (const einheit of h.einheiten) inhalt.append(einheitKarte(einheit));
  }

  inhalt.append(el('div', { class: 'knopf-reihe' },
    el('button', { class: 'knopf haupt', onclick: () => sessionDialog(h) }, 'Einheit eintragen')));

  return inhalt;
}

function sessionDialog(h) {
  const vorschlag = h.einheiten[0];
  const inhalt = el('div', {}, el('h2', {}, 'Einheit eintragen'));

  const typ = el('select', {},
    ...Object.entries(TYP_NAMEN).map(([wert, name]) =>
      el('option', { value: wert, selected: vorschlag?.typ === wert }, name)));

  const minuten = el('input', { type: 'number', min: '0', max: '400', value: vorschlag?.minuten || 60 });
  const rpeAnzeige = el('span', { class: 'mini' }, '7 – hart');
  const RPE_TEXT = ['', 'sehr leicht', 'leicht', 'moderat', 'etwas fordernd', 'fordernd',
    'fordernd+', 'hart', 'sehr hart', 'fast maximal', 'maximal'];
  const rpe = el('input', {
    type: 'range', min: '1', max: '10', step: '1', value: '7',
    oninput: (e) => { rpeAnzeige.textContent = `${e.target.value} – ${RPE_TEXT[Number(e.target.value)]}`; },
  });
  const notiz = el('textarea', { placeholder: 'Wie lief es? Zeiten, Gewichte, Auffälligkeiten …' });

  inhalt.append(
    feld('Art', typ),
    feld('Dauer in Minuten', minuten),
    el('div', { class: 'feld' },
      el('label', {}, 'Anstrengung (RPE) · ', rpeAnzeige),
      rpe,
      el('div', { class: 'mini', style: { marginTop: '0.25rem' } },
        'Wie hart war die ganze Einheit im Rückblick? Am besten ~30 min danach beurteilen, '
        + 'nicht mittendrin.')),
    feld('Notiz', notiz),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          try {
            await sende('/session', {
              datum: heuteDatum(),
              typ: typ.value,
              titel: vorschlag?.titel || TYP_NAMEN[typ.value],
              minuten: Number(minuten.value),
              rpe: Number(rpe.value),
              notiz: notiz.value,
            });
            dialogSchliessen();
            toast('Einheit gespeichert.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Speichern'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen')));

  dialog(inhalt);
}

/* ----------------------------------------------------------- Ernährung */

function ernaehrungKarte(d, h) {
  if (!h.makro) {
    return karte(
      el('h2', {}, 'Ernährung'),
      el('p', { class: 'klein' },
        'Sobald Gewicht, Größe und Geburtsjahr im Profil stehen, rechnet der Tracker '
        + 'hier deinen Tagesbedarf – abgestimmt auf die Belastung genau dieses Tages.'));
  }

  const b = h.bilanz;
  const inhalt = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Ernährung heute'),
      el('span', { class: 'mini' }, TAGESTYP_NAMEN[h.tagestyp] || h.tagestyp)));

  inhalt.append(el('div', { class: 'kennzahlen' },
    kennzahl(zahl(b.kcal.rest), 'kcal übrig', `${zahl(b.kcal.ist)} von ${zahl(b.kcal.soll)}`),
    kennzahl(`${zahl(b.protein.rest)} g`, 'Protein übrig', `${zahl(b.protein.ist)} von ${zahl(b.protein.soll)} g`)));

  for (const [name, titel, farbe] of [
    ['protein', 'Protein', 'var(--sprint)'],
    ['kohlenhydrate', 'Kohlenhydrate', 'var(--kraft)'],
    ['fett', 'Fett', 'var(--warn)'],
  ]) {
    inhalt.append(el('div', { class: 'makro-zeile' },
      el('div', { class: 'makro-kopf' },
        el('span', { class: 'makro-name' }, titel),
        el('span', { class: 'makro-zahl' }, `${zahl(b[name].ist)} / ${zahl(b[name].soll)} g`)),
      balken(b[name].prozent, farbe)));
  }

  inhalt.append(el('p', { class: 'klein' },
    `Kohlenhydrate liegen heute bei ${h.makro.khProKg} g/kg – Korridor für einen `
    + `${(TAGESTYP_NAMEN[h.tagestyp] || h.tagestyp).toLowerCase()} ist `
    + `${h.makro.korridor[0]}–${h.makro.korridor[1]} g/kg. Kohlenhydrate gehören dorthin, wo die Intensität liegt.`));

  for (const text of h.makro.hinweise) inhalt.append(hinweis(text, 'warnung'));

  if (h.mahlzeiten) {
    inhalt.append(hinweis(h.mahlzeiten.hinweis, h.mahlzeiten.ausreichend ? 'gut' : 'warnung'));
  }

  const ev = h.energieverfuegbarkeit;
  if (ev?.berechenbar) {
    inhalt.append(hinweis(
      `Energieverfügbarkeit ⌀ ${ev.wert} kcal/kg fettfreier Masse `
      + `(${ev.tage} abgeschlossene Tage). ${ev.text}`,
      ev.stufe === 'kritisch' ? 'gefahr' : ev.stufe === 'knapp' ? 'warnung' : 'gut'));
  }

  inhalt.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf',
      onclick: () => { location.hash = 'essen'; },
    }, 'Essen eintragen')));

  return inhalt;
}
