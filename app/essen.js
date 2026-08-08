// Essen eintragen: Suche in der Lebensmitteldatenbank, Tagesübersicht, Bilanz.

import {
  el, karte, balken, hinweis, feld, dialog, dialogSchliessen,
  toast, zahl, TAGESTYP_NAMEN,
} from './common.js';
import * as daten from './daten.js';
import { aktualisieren } from './app.js';

let datenbank = null;

const MAHLZEITEN = [
  ['fruehstueck', 'Frühstück'],
  ['mittag', 'Mittag'],
  ['abend', 'Abend'],
  ['snack', 'Snack'],
  ['umsTraining', 'Ums Training'],
];

export function essenAnsicht(d) {
  const box = el('div', {});
  const h = d.heute;

  box.append(el('h1', {}, 'Essen'));

  if (!h.makro) {
    box.append(hinweis(
      'Für Zielwerte fehlen noch Körperdaten im Profil. Eintragen kannst du trotzdem – '
      + 'die Summen stimmen, nur der Abgleich fehlt.', 'warnung'));
  } else {
    box.append(bilanzKarte(h));
  }

  box.append(el('div', { class: 'knopf-reihe', style: { marginBottom: '0.9rem' } },
    el('button', { class: 'knopf haupt', onclick: () => suchDialog() }, '+ Lebensmittel'),
    el('button', { class: 'knopf', onclick: () => eigenesDialog() }, 'Eigenes eintragen')));

  box.append(tagesListe(h));

  if (h.makro) box.append(versorgungKarte(d, h));

  return box;
}

function bilanzKarte(h) {
  const b = h.bilanz;
  const inhalt = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Tagesbilanz'),
      el('span', { class: 'mini' }, TAGESTYP_NAMEN[h.tagestyp] || h.tagestyp)));

  inhalt.append(el('div', { class: 'makro-zeile' },
    el('div', { class: 'makro-kopf' },
      el('span', { class: 'makro-name' }, 'Kalorien'),
      el('span', { class: 'makro-zahl' }, `${zahl(b.kcal.ist)} / ${zahl(b.kcal.soll)} kcal`)),
    balken(b.kcal.prozent, b.kcal.prozent > 110 ? 'var(--gefahr)' : 'var(--ausdauer)')));

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

  if (h.bedarf) {
    inhalt.append(el('p', { class: 'mini' },
      `Grundumsatz ${zahl(h.bedarf.grundumsatz)} kcal (${h.bedarf.grundumsatzFormel}) `
      + `+ Alltag ${zahl(h.bedarf.alltag - h.bedarf.grundumsatz)} kcal `
      + `+ Training ${zahl(h.bedarf.training)} kcal`
      + (h.bedarf.anpassungProzent ? ` · Ziel ${h.bedarf.anpassungProzent > 0 ? '+' : ''}${h.bedarf.anpassungProzent} %` : '')));
  }

  return inhalt;
}

function tagesListe(h) {
  const box = karte(el('h2', {}, 'Heute gegessen'));

  if (!h.essen.length) {
    box.append(el('p', { class: 'klein' }, 'Noch nichts eingetragen.'));
    return box;
  }

  for (const [schluessel, titel] of MAHLZEITEN) {
    const eintraege = h.essen.filter((e) => e.mahlzeit === schluessel);
    if (!eintraege.length) continue;

    const summe = eintraege.reduce((s, e) => s + (e.kcal * e.mengeG / 100), 0);
    box.append(el('h3', { style: { marginTop: '0.7rem' } },
      `${titel} · ${zahl(summe)} kcal`));

    for (const e of eintraege) {
      const faktor = e.mengeG / 100;
      box.append(el('div', { class: 'zeile' },
        el('div', { class: 'zeile-text' },
          el('div', { class: 'zeile-titel' }, e.name),
          el('div', { class: 'zeile-meta' },
            `${zahl(e.mengeG)} g · ${zahl(e.kcal * faktor)} kcal · `
            + `${zahl(e.protein * faktor)} P / ${zahl(e.kohlenhydrate * faktor)} KH / ${zahl(e.fett * faktor)} F`)),
        el('button', {
          class: 'knopf leise gefahr',
          onclick: async () => {
            try {
              await daten.essenLoeschen(e.id);
              aktualisieren();
            } catch (err) { toast(err.message, 'fehler'); }
          },
        }, '×')));
    }
  }

  const sonstige = h.essen.filter((e) => !MAHLZEITEN.some(([s]) => s === e.mahlzeit));
  for (const e of sonstige) {
    const faktor = e.mengeG / 100;
    box.append(el('div', { class: 'zeile' },
      el('div', { class: 'zeile-text' },
        el('div', { class: 'zeile-titel' }, e.name),
        el('div', { class: 'zeile-meta' }, `${zahl(e.mengeG)} g · ${zahl(e.kcal * faktor)} kcal`)),
      el('button', {
        class: 'knopf leise gefahr',
        onclick: async () => {
          try { await daten.essenLoeschen(e.id); aktualisieren(); }
          catch (err) { toast(err.message, 'fehler'); }
        },
      }, '×')));
  }

  return box;
}

function versorgungKarte(d, h) {
  const box = karte(el('h2', {}, 'Rund ums Training'));
  if (!h.trainingstag) {
    box.append(el('p', { class: 'klein' },
      'Heute kein Training. Die Tagesmenge zählt trotzdem – Ruhetage sind die Tage, '
      + 'an denen der Aufbau tatsächlich stattfindet.'));
    return box;
  }
  const liste = el('ul', { class: 'klein' });
  const einheit = h.einheiten[0];
  const hinweiseListe = versorgungHinweise(d.profil, einheit.typ, einheit.minuten);
  for (const t of hinweiseListe) liste.append(el('li', {}, t));
  box.append(liste);
  return box;
}

/** Spiegelt die Serverlogik, damit die Ansicht ohne Zusatzaufruf auskommt. */
function versorgungHinweise(profil, typ, minuten) {
  const kg = Number(profil?.gewichtKg) || 0;
  const min = Number(minuten) || 0;
  const hinweise = [];
  if (['sprint', 'kraft', 'plyometrie'].includes(typ)) {
    hinweise.push('1–3 h vorher 1–2 g Kohlenhydrate/kg, gut verträglich und fettarm.');
    hinweise.push('Während der Einheit reicht Wasser – die Speicher halten das aus.');
  }
  if (min >= 90) hinweise.push(`Ab 90 min: 30–60 g Kohlenhydrate pro Stunde (~${Math.round(min / 60 * 45)} g gesamt).`);
  if (min >= 60) hinweise.push('Trinken nach Durst, bei Hitze 400–800 ml/h mit ~500 mg Natrium pro Liter.');
  if (kg) hinweise.push(`Danach ${Math.round(kg * 0.3)} g Protein – Timing zweitrangig, die Tagesmenge zählt.`);
  return hinweise;
}

/* --------------------------------------------------------------- Suche */

async function suchDialog() {
  if (!datenbank) {
    try { datenbank = await daten.lebensmittel(); }
    catch (err) { return toast(err.message, 'fehler'); }
  }

  const treffer = el('div', { class: 'such-treffer' });
  const suche = el('input', {
    type: 'text',
    placeholder: 'Suchen … z. B. Quark, Reis, Banane',
    oninput: (e) => zeigeTreffer(e.target.value),
  });

  function zeigeTreffer(text) {
    const begriff = text.trim().toLowerCase();
    const liste = begriff
      ? datenbank.lebensmittel.filter((l) => l.name.toLowerCase().includes(begriff))
      : datenbank.lebensmittel.slice(0, 25);

    treffer.replaceChildren(...liste.slice(0, 40).map((l) => el('div', {
      class: 'zeile',
      onclick: () => mengeDialog(l),
    },
    el('div', { class: 'zeile-text' },
      el('div', { class: 'zeile-titel' }, l.name),
      el('div', { class: 'zeile-meta' },
        `${zahl(l.kcal)} kcal · ${zahl(l.protein, 1)} P / ${zahl(l.kohlenhydrate, 1)} KH / ${zahl(l.fett, 1)} F je 100 g`)))));

    if (!liste.length) {
      treffer.replaceChildren(el('p', { class: 'klein' },
        'Nichts gefunden. Über „Eigenes eintragen" kannst du die Werte von der Packung übernehmen.'));
    }
  }

  zeigeTreffer('');
  dialog(el('div', {},
    el('h2', {}, 'Lebensmittel suchen'),
    suche,
    treffer,
    el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Schließen'))));
  suche.focus();
}

function mengeDialog(lebensmittel) {
  const menge = el('input', { type: 'number', min: '1', value: '100' });
  const mahlzeit = el('select', {},
    ...MAHLZEITEN.map(([wert, name]) => el('option', { value: wert }, name)));

  const vorschau = el('div', { class: 'klein' });
  function aktualisiereVorschau() {
    const f = (Number(menge.value) || 0) / 100;
    vorschau.textContent = `${zahl(lebensmittel.kcal * f)} kcal · `
      + `${zahl(lebensmittel.protein * f, 1)} g Protein · `
      + `${zahl(lebensmittel.kohlenhydrate * f, 1)} g KH · `
      + `${zahl(lebensmittel.fett * f, 1)} g Fett`;
  }
  menge.addEventListener('input', aktualisiereVorschau);
  aktualisiereVorschau();

  dialog(el('div', {},
    el('h2', {}, lebensmittel.name),
    feld('Menge in Gramm', menge),
    feld('Mahlzeit', mahlzeit),
    vorschau,
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          try {
            await daten.essenAnlegen({
              name: lebensmittel.name,
              mengeG: Number(menge.value),
              mahlzeit: mahlzeit.value,
              kcal: lebensmittel.kcal,
              protein: lebensmittel.protein,
              kohlenhydrate: lebensmittel.kohlenhydrate,
              fett: lebensmittel.fett,
            });
            dialogSchliessen();
            toast('Eingetragen.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Eintragen'),
      el('button', { class: 'knopf leise', onclick: () => suchDialog() }, 'Zurück'))));
  menge.select();
}

function eigenesDialog() {
  const name = el('input', { type: 'text', placeholder: 'z. B. Proteinriegel Marke X' });
  const menge = el('input', { type: 'number', min: '1', value: '100' });
  const kcal = el('input', { type: 'number', min: '0', placeholder: 'je 100 g' });
  const protein = el('input', { type: 'number', min: '0', step: '0.1', placeholder: 'je 100 g' });
  const kh = el('input', { type: 'number', min: '0', step: '0.1', placeholder: 'je 100 g' });
  const fett = el('input', { type: 'number', min: '0', step: '0.1', placeholder: 'je 100 g' });
  const mahlzeit = el('select', {}, ...MAHLZEITEN.map(([w, n]) => el('option', { value: w }, n)));

  dialog(el('div', {},
    el('h2', {}, 'Eigenes Lebensmittel'),
    el('p', { class: 'mini' }, 'Nährwerte je 100 g von der Packung übernehmen.'),
    feld('Name', name),
    el('div', { class: 'felder' },
      feld('kcal / 100 g', kcal),
      feld('Protein / 100 g', protein)),
    el('div', { class: 'felder' },
      feld('Kohlenhydrate / 100 g', kh),
      feld('Fett / 100 g', fett)),
    el('div', { class: 'felder' },
      feld('Menge in Gramm', menge),
      feld('Mahlzeit', mahlzeit)),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          if (!name.value.trim()) return toast('Name fehlt.', 'fehler');
          try {
            await daten.essenAnlegen({
              name: name.value.trim(),
              mengeG: Number(menge.value),
              mahlzeit: mahlzeit.value,
              kcal: Number(kcal.value) || 0,
              protein: Number(protein.value) || 0,
              kohlenhydrate: Number(kh.value) || 0,
              fett: Number(fett.value) || 0,
            });
            dialogSchliessen();
            toast('Eingetragen.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Eintragen'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen'))));
  name.focus();
}
