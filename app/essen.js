// Essen eintragen: Suche in der Lebensmitteldatenbank, Tagesübersicht, Bilanz.

import {
  el, karte, balken, hinweis, feld, dialog, dialogSchliessen,
  toast, zahl, TAGESTYP_NAMEN,
} from './common.js';
import * as daten from './daten.js';
// Die Hinweise rund ums Training kommen aus dem Kern – sie standen hier ein
// zweites Mal und waren schon leicht anders formuliert als dort.
import { versorgungUmDieEinheit } from '../kern/ernaehrung.js';
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
    balken(b.kcal.prozent,
      b.kcal.prozent > (h.grenzen?.kcalUeberschrittenAb ?? 1.1) * 100
        ? 'var(--gefahr)' : 'var(--ausdauer)')));

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
  const hinweiseListe = versorgungUmDieEinheit(d.profil, einheit.typ, einheit.minuten);
  for (const t of hinweiseListe) liste.append(el('li', {}, t));
  box.append(liste);
  return box;
}

/* --------------------------------------------------------------- Suche */

async function suchDialog() {
  if (!datenbank) {
    try { datenbank = await daten.lebensmittel(); }
    catch (err) { return toast(err.message, 'fehler'); }
  }
  // Der eigene Verlauf schlägt die Nährwerttabelle: Niemand isst alphabetisch,
  // und vier bis fünf Einträge am Tag sind der häufigste Handgriff der App.
  const eigene = await daten.haeufigeLebensmittel().catch(() => []);

  const treffer = el('div', { class: 'such-treffer' });
  const suche = el('input', {
    type: 'text',
    placeholder: 'Suchen … z. B. Quark, Reis, Banane',
    oninput: (e) => zeigeTreffer(e.target.value),
  });

  const zeile = (l) => el('div', {
    class: 'zeile',
    onclick: () => mengeDialog(l),
  },
  el('div', { class: 'zeile-text' },
    el('div', { class: 'zeile-titel' }, l.name),
    el('div', { class: 'zeile-meta' },
      `${zahl(l.kcal)} kcal · ${zahl(l.protein, 1)} P / ${zahl(l.kohlenhydrate, 1)} KH / `
      + `${zahl(l.fett, 1)} F je 100 g`
      + (l.anzahl ? ` · ${l.anzahl}× zuletzt` : ''))));

  function zeigeTreffer(text) {
    const begriff = text.trim().toLowerCase();

    if (!begriff) {
      // Ohne Suchbegriff: das Eigene zuerst. Beim ersten Mal ist es leer, dann
      // steht dort die Tabelle – aber schon nach ein paar Tagen findet man
      // seine Handvoll Lebensmittel oben, ohne zu tippen.
      const teile = [];
      if (eigene.length) {
        teile.push(el('div', { class: 'mini', style: { margin: '0.4rem 0 0.2rem' } },
          'Zuletzt und häufig'));
        teile.push(...eigene.map(zeile));
        teile.push(el('div', { class: 'mini', style: { margin: '0.7rem 0 0.2rem' } },
          'Aus der Nährwerttabelle'));
      }
      teile.push(...datenbank.lebensmittel.slice(0, 25).map(zeile));
      treffer.replaceChildren(...teile);
      return;
    }

    // Bei einer Suche zählt ebenfalls beides – Eigenes zuerst, ohne Dopplung.
    const eigeneTreffer = eigene.filter((l) => l.name.toLowerCase().includes(begriff));
    const namen = new Set(eigeneTreffer.map((l) => l.name.toLowerCase()));
    const ausTabelle = datenbank.lebensmittel
      .filter((l) => l.name.toLowerCase().includes(begriff))
      .filter((l) => !namen.has(l.name.toLowerCase()));

    const liste = [...eigeneTreffer, ...ausTabelle];
    if (!liste.length) {
      treffer.replaceChildren(el('p', { class: 'klein' },
        'Nichts gefunden. Über „Eigenes eintragen" kannst du die Werte von der Packung '
        + 'übernehmen – danach steht es hier oben.'));
      return;
    }
    treffer.replaceChildren(...liste.slice(0, 40).map(zeile));
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
  // Die zuletzt gegessene Menge vorbelegen – meistens isst man wieder dieselbe.
  const menge = el('input', {
    type: 'number', min: '1', value: String(lebensmittel.mengeG || 100),
  });
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
