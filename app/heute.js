// Die Startansicht: Was steht heute an, wie bereit bin ich, was fehlt beim Essen.

import {
  el, karte, kennzahl, balken, hinweis, dialog, dialogSchliessen, feld,
  toast, zahl, dauer, datumLang, sessionZusammenfassung,
  TYP_NAMEN, TAGESTYP_NAMEN, TAGESTYP_GEBEUGT,
  heute as heuteDatum, wochentagIndex, datumPlus,
} from './common.js';
import * as daten from './daten.js';
import { aktualisieren, tagWechseln, istHeute, zustand, zuAnsicht } from './app.js';
import { einheitKarte } from './planAnsicht.js';
import { protokollDialog } from './protokoll.js';
import { installKarte } from './installieren.js';
import { ausDatei } from '../kern/aktivitaet.js';

export function heuteAnsicht(d) {
  const box = el('div', {});
  const h = d.heute;

  if (!d.profilStatus.vollstaendig) {
    // Der Hinweis nennt nicht nur, was fehlt, sondern führt hin. Vorher stand
    // er am ersten Tag ganz oben und der Profil-Reiter war rechts aus der
    // Leiste herausgescrollt – ein Hinweis ohne Weg ist eine Sackgasse.
    const kasten = hinweis(
      `Im Profil fehlen noch: ${d.profilStatus.fehlend.join(', ')}. `
      + 'Ohne diese Angaben kann der Ernährungsteil nichts rechnen.', 'warnung');
    kasten.append(el('div', { class: 'knopf-reihe' },
      el('button', { class: 'knopf haupt', onclick: () => zuAnsicht('profil') },
        'Profil ausfüllen')));
    box.append(kasten);
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

  // Auch der einzelne Grund kommt auf den Schirm. Er wurde vorher berechnet und
  // stillschweigend verworfen – ein Tracker, der etwas sieht und nichts sagt,
  // ist an der Stelle unbrauchbar, an der es zählt.
  const { entlastung } = d.belastung;
  if (entlastung.stufe !== 'keine') {
    box.append(karte(
      el('h2', {}, entlastung.faellig
        ? 'Entlastung wäre jetzt sinnvoll'
        : 'Ein Zeichen im Blick behalten'),
      el('p', { class: 'klein' }, entlastung.text),
      el('ul', { class: 'klein' }, ...entlastung.gruende.map((g) => el('li', {}, g)))));
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
    // Der Vorbehalt gehört dorthin, wo die Zahl steht.
    //
    // `BEREITSCHAFT` ist in `wissen.js` als `praxis` gekennzeichnet, hier
    // stand davon nichts: eine Prozentzahl, eine farbige Ampel und ein
    // konkreter Rat – das liest sich wie eine Messung. Seit drei rote Tage
    // eine Entlastungswoche auslösen, hängt an den Schwellen mehr als eine
    // Tagesempfehlung.
    el('p', { class: 'mini' },
      'Die fünf Fragen und ihre Schwellen sind Trainerpraxis, keine Messgröße – belegt ist '
      + 'davon nur die Leistungswirkung des Schlafs (Mah 2011). Aussagekräftig wird der Wert '
      + 'durch die Regelmäßigkeit, nicht durch die Genauigkeit.'),
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

/**
 * Eine Ausdauereinheit aus der Exportdatei einer Lauf-App übernehmen.
 *
 * Automatisch geht das nicht: Apple Health ist ausschließlich für native
 * iOS-Apps geöffnet, und Adidas Running hat für Dritte keine Schnittstelle
 * mehr. Exportieren können aber beide – und aus GPX oder TCX kommen Datum,
 * Dauer, Strecke und Puls fertig heraus. Zu tippen bleibt das RPE.
 */
function ausDateiKnopf() {
  const eingabe = el('input', {
    type: 'file',
    // Nicht auf Endungen festnageln: Exportierte Dateien heißen alles Mögliche,
    // und iOS reicht sie ohnehin mit wechselnden Typen durch.
    accept: '.gpx,.tcx,.xml,application/gpx+xml,application/xml,text/xml',
    style: { display: 'none' },
  });

  eingabe.addEventListener('change', async () => {
    const f = eingabe.files?.[0];
    eingabe.value = '';
    if (!f) return;
    try {
      const gefunden = ausDatei(await f.text());
      if (gefunden.length === 1) await uebernehmen(gefunden[0]);
      else auswahlDialog(gefunden);
    } catch (err) {
      toast(err.message, 'fehler');
    }
  });

  return el('span', {},
    el('button', { class: 'knopf leise', onclick: () => eingabe.click() },
      'Aus Lauf-App übernehmen'),
    eingabe);
}

/** Kurzfassung einer eingelesenen Einheit für Listen und Hinweise. */
function einheitKurz(e) {
  return `${datumLang(e.datum)} · ${zahl(e.meter / 1000, 1)} km in ${e.minuten} min`
    + (e.hfSchnitt ? ` · Puls ${e.hfSchnitt}` : '');
}

/**
 * Vor dem Übernehmen prüfen, ob an dem Tag schon etwas steht.
 *
 * Wer eine Einheit erst von Hand einträgt und später die Datei importiert,
 * hätte sie sonst zweimal – und doppelte Einheiten verfälschen jede
 * Belastungsrechnung, ohne dass man den Grund noch findet.
 */
async function uebernehmen(einheit) {
  const schon = await daten.einheitenAmTag(einheit.datum);
  protokollDialog(null, [], { ...einheit, schonProtokolliert: schon });
}

/** Mehrere Aktivitäten in einer Datei: eine auswählen statt raten. */
function auswahlDialog(liste) {
  const inhalt = el('div', {}, el('h2', {}, 'Welche Einheit?'));
  inhalt.append(el('p', { class: 'klein' },
    `Die Datei enthält ${liste.length} Aktivitäten. Trag sie einzeln ein – die `
    + 'Anstrengung ist bei jeder eine eigene Einschätzung.'));

  for (const e of liste) {
    inhalt.append(el('button', {
      class: 'knopf',
      style: { display: 'block', width: '100%', marginBottom: '0.4rem', textAlign: 'left' },
      onclick: async () => { dialogSchliessen(); await uebernehmen(e); },
    }, einheitKurz(e)));
  }

  inhalt.append(el('div', { class: 'knopf-reihe' },
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
      }, 'Trotzdem etwas eintragen')]),
    ausDateiKnopf()));

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

/**
 * „Übrig" nur, solange etwas übrig ist.
 *
 * Über der Vorgabe stand hier „-1.200 kcal übrig" – ein negativer Rest ist
 * kein Rest, und das Minus vor der Zahl las sich wie ein Defizit statt wie
 * ein Überschuss. Dieselbe Sorte Widerspruch wie die Kurve, über der „besser
 * geworden" stand, während der Ruhepuls stieg: Die Zahl war richtig, die
 * Beschriftung behauptete das Gegenteil.
 *
 * Bewusst ohne Warnfarbe. Über der Proteinvorgabe zu liegen ist kein Fehler,
 * und der Tracker verbietet nichts – die Balken darunter zeigen ohnehin, wie
 * weit darüber.
 */
function restKennzahl(rest, einheit, was, zusatz) {
  const drueber = rest < 0;
  return kennzahl(
    `${zahl(Math.abs(rest))}${einheit}`,
    drueber ? `${was} zu viel` : `${was} übrig`,
    zusatz);
}

function ernaehrungKarte(d, h) {
  if (!h.makro) {
    return karte(
      el('h2', {}, 'Ernährung'),
      el('p', { class: 'klein' },
        'Sobald Gewicht, Größe und Geburtsjahr im Profil stehen, rechnet der Tracker '
        + 'hier deinen Tagesbedarf – abgestimmt auf die Belastung genau dieses Tages.'),
      el('div', { class: 'knopf-reihe' },
        el('button', { class: 'knopf', onclick: () => zuAnsicht('profil') }, 'Zum Profil')));
  }

  const b = h.bilanz;
  const inhalt = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, istHeute() ? 'Ernährung heute' : 'Ernährung an diesem Tag'),
      el('span', { class: 'mini' }, TAGESTYP_NAMEN[h.tagestyp] || h.tagestyp)));

  inhalt.append(el('div', { class: 'kennzahlen' },
    restKennzahl(b.kcal.rest, '', 'kcal', `${zahl(b.kcal.ist)} von ${zahl(b.kcal.soll)}`),
    restKennzahl(b.protein.rest, ' g', 'Protein', `${zahl(b.protein.ist)} von ${zahl(b.protein.soll)} g`)));

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
    + `${TAGESTYP_GEBEUGT[h.tagestyp] || h.tagestyp} ist `
    + `${h.makro.korridor[0]}–${h.makro.korridor[1]} g/kg. Kohlenhydrate gehören dorthin, wo die Intensität liegt.`
    // Das Fett gleicht aus, was der Korridor offen lässt – es schwankt damit
    // stärker als die beiden anderen. Diese Zahl stand vorher nirgends: Der
    // Balken zeigt Gramm, und `fettProKg` meldete stur den Zielwert.
    + (h.makro.fettProKg > h.makro.fettZielProKg
      ? ` Der Rest der Energie liegt im Fett, heute ${zahl(h.makro.fettProKg, 1)} g/kg `
        + `statt der üblichen ${zahl(h.makro.fettZielProKg, 1)} – der Korridor deckelt die `
        + 'Kohlenhydrate, irgendwo müssen die Kalorien hin.'
      : '')));

  for (const text of h.makro.hinweise) inhalt.append(hinweis(text, 'warnung'));

  if (h.mahlzeiten) {
    inhalt.append(hinweis(h.mahlzeiten.hinweis, h.mahlzeiten.ausreichend ? 'gut' : 'warnung'));
  }

  const ev = h.energieverfuegbarkeit;
  if (ev?.berechenbar) {
    inhalt.append(hinweis(
      // `zahl()` statt der rohen Zahl: Sonst stand „33.8" mit Punkt direkt
      // neben dem „39,5" mit Komma aus dem Fließtext – im selben Satz.
      `Energieverfügbarkeit ⌀ ${zahl(ev.wert, 1)} kcal/kg fettfreier Masse `
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
