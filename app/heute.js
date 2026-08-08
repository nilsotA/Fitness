// Die Startansicht: Was steht heute an, wie bereit bin ich, was fehlt beim Essen.

import {
  el, karte, kennzahl, balken, hinweis, dialog, dialogSchliessen, feld,
  toast, zahl, dauer, datumLang, TYP_NAMEN, TAGESTYP_NAMEN,
  heute as heuteDatum, wochentagIndex, datumPlus,
} from './common.js';
import * as daten from './daten.js';
import { aktualisieren, tagWechseln, istHeute, zustand } from './app.js';
import { einheitKarte } from './planAnsicht.js';
import { protokollDialog, sessionZusammenfassung } from './protokoll.js';
import { installKarte } from './installieren.js';

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

  // Ganz oben und nur, solange die App im Browser läuft: Am Startbildschirm
  // hängen der Offline-Betrieb und die Haltbarkeit der Daten.
  const install = installKarte(aktualisieren);
  if (install) box.append(install);

  box.append(datumsLeiste(d));

  box.append(bereitschaftKarte(h));
  box.append(trainingKarte(d, h));
  box.append(letzteEinheitenKarte(d));
  box.append(ernaehrungKarte(d, h));

  if (d.belastung.entlastung.faellig) {
    box.append(karte(
      el('h2', {}, 'Entlastung wäre jetzt sinnvoll'),
      el('p', { class: 'klein' }, d.belastung.entlastung.text),
      el('ul', { class: 'klein' }, ...d.belastung.entlastung.gruende.map((g) => el('li', {}, g)))));
  }

  return box;
}

/** Kopfzeile mit Tagesnavigation – blättern statt nur „heute". */
function datumsLeiste(d) {
  const verschieben = (tage) => {
    const neu = datumPlus(d.datum, tage);
    // Kein Blick in die Zukunft: Dort gibt es nichts zu protokollieren, und der
    // Plan für kommende Tage steht ohnehin in der Planansicht.
    if (neu > heuteDatum()) return;
    tagWechseln(neu);
  };

  const [jahr, monat, tag] = d.datum.split('-').map(Number);
  const titel = `${d.plan.tage[wochentagIndex(d.datum)].name}, `
    + new Date(jahr, monat - 1, tag).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' });

  return el('div', { class: 'datums-leiste' },
    el('button', { class: 'knopf leise', onclick: () => verschieben(-1), title: 'Tag zurück' }, '‹'),
    el('div', { class: 'datums-mitte' },
      el('h1', { style: { margin: '0' } }, titel),
      istHeute() ? null : el('button', {
        class: 'knopf leise mini',
        onclick: () => tagWechseln(heuteDatum()),
      }, 'zurück zu heute')),
    el('button', {
      class: 'knopf leise',
      onclick: () => verschieben(1),
      disabled: istHeute(),
      title: 'Tag vor',
    }, '›'));
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
    // Der Check bleibt sonst folgenlos – und ein Check ohne Folgen wird nach
    // ein paar Tagen nicht mehr ausgefüllt.
    h.angepasst
      ? el('p', { class: 'klein', style: { color: 'var(--warn)' } },
        'Der heutige Plan unten ist bereits entsprechend angepasst.')
      : null,
    el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf leise', onclick: checkDialog }, 'Ändern')));
}

function checkDialog() {
  // Die Fragen kommen aus wissen.js über den Zustand – sie standen hier schon
  // einmal doppelt.
  const fragen = zustand.daten?.belastung?.wohlbefinden || [];
  const vorher = zustand.daten?.heute?.check || null;

  const werte = {};
  const inhalt = el('div', {}, el('h2', {}, 'Morgen-Check'));

  for (const frage of fragen) {
    // Beim Ändern den gespeicherten Wert vorbelegen. Vorher stand jeder Regler
    // wieder auf 3 – wer nur eine Antwort korrigieren wollte, überschrieb damit
    // stillschweigend alle anderen mit „okay".
    const start = Number(vorher?.[frage.id]) || 3;
    const anzeige = el('span', { class: 'mini' }, frage.skala[start - 1]);
    const regler = el('input', {
      type: 'range', min: '1', max: '5', step: '1', value: String(start),
      oninput: (e) => {
        werte[frage.id] = Number(e.target.value);
        anzeige.textContent = frage.skala[Number(e.target.value) - 1];
      },
    });
    werte[frage.id] = start;
    inhalt.append(el('div', { class: 'feld' },
      el('label', {}, frage.frage, ' · ', anzeige),
      regler));
  }

  // Ruhepuls: freiwillig, und nur hier – morgens im Liegen ist der einzige
  // Zeitpunkt, zu dem der Wert vergleichbar ist.
  const puls = zustand.daten?.belastung?.ruhepuls;
  const ruhepuls = el('input', {
    type: 'number', min: '30', max: '120', inputmode: 'numeric', placeholder: 'bpm',
    value: vorher?.ruhepuls ?? '',
  });
  inhalt.append(feld('Ruhepuls (optional)', ruhepuls,
    puls?.belastbar
      ? `Deine Grundlinie liegt bei ${puls.grundlinie} bpm.`
      : 'Direkt nach dem Aufwachen, im Liegen. Nützlich wird der Wert erst im Verlauf – '
        + 'einzeln sagt er nichts.'));

  inhalt.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: async () => {
        try {
          await daten.checkSpeichern({
            datum: zustand.datum, ...werte, ruhepuls: Number(ruhepuls.value) || null,
          });
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
  // Beim Zurückblättern wäre „Heute im Plan" schlicht falsch.
  const wann = istHeute() ? 'Heute' : 'An diesem Tag';
  const inhalt = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, h.trainingstag ? `${wann} im Plan` : `${wann} frei`),
      el('span', { class: 'mini' }, h.trainingstag ? dauer(h.minuten) : 'Ruhetag')));

  if (!h.trainingstag) {
    inhalt.append(el('p', { class: 'klein' },
      'Ruhetag. Er ist Teil des Plans, nicht das Fehlen davon – Anpassung passiert in der Erholung. '
      + 'Lockeres Gehen oder Mobilität ist in Ordnung, alles mit Anstrengung nicht.'));
  } else {
    for (const einheit of h.einheiten) inhalt.append(einheitKarte(einheit));
  }

  inhalt.append(el('div', { class: 'knopf-reihe' },
    ...(h.einheiten.length
      ? h.einheiten.map((e) => el('button', {
        class: 'knopf haupt',
        onclick: () => protokollDialog(e, h.einheiten),
      }, `${e.titel} eintragen`))
      : [el('button', {
        class: 'knopf',
        onclick: () => protokollDialog(null),
      }, 'Trotzdem etwas eintragen')])));

  return inhalt;
}

/* ------------------------------------------------------ Letzte Einheiten */

/**
 * Die Antwort auf „was hatte ich letzten Montag?" – ohne diese Karte müsste man
 * dafür in die Fortschrittsansicht wechseln und suchen.
 */
function letzteEinheitenKarte(d) {
  const sessions = d.letzteSessions || [];
  const box = karte(el('h2', {}, 'Zuletzt trainiert'));

  if (!sessions.length) {
    box.append(el('p', { class: 'klein' }, 'Noch nichts protokolliert.'));
    return box;
  }

  for (const session of sessions.slice(0, 5)) {
    box.append(el('div', { class: 'zeile' },
      el('div', { class: 'zeile-text' },
        el('div', { class: 'zeile-titel' },
          `${datumLang(session.datum)} · ${session.titel || TYP_NAMEN[session.typ] || session.typ}`),
        el('div', { class: 'zeile-meta' }, sessionZusammenfassung(session))),
      el('button', {
        class: 'knopf leise gefahr',
        title: 'Einheit löschen',
        onclick: async () => {
          try {
            await daten.sessionLoeschen(session.id);
            toast('Einheit gelöscht.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, '×')));
  }

  return box;
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
      el('h2', {}, istHeute() ? 'Ernährung heute' : 'Ernährung an diesem Tag'),
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
    `Kohlenhydrate liegen bei ${h.makro.khProKg} g/kg – Korridor für einen `
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
