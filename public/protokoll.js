// Trainingsprotokoll: Sätze mit Gewicht und Wiederholungen eintragen.
//
// Der Ablauf ist auf die Situation zugeschnitten, in der er stattfindet: Man
// steht zwischen zwei Sätzen mit dem Handy in der Hand und hat weder Lust noch
// Zeit, ein Formular auszufüllen. Deshalb ist alles vorbelegt – mit der Last,
// die der Plan vorschlägt, und den Wiederholungen aus dem Zielbereich. Im
// Normalfall genügt Antippen und Speichern.

import {
  el, feld, dialog, dialogSchliessen, sende, toast, zahl, dauer, TYP_NAMEN,
} from './common.js';
import { aktualisieren, zustand } from './app.js';

const RPE_TEXT = ['', 'sehr leicht', 'leicht', 'moderat', 'etwas fordernd', 'fordernd',
  'fordernd+', 'hart', 'sehr hart', 'fast maximal', 'maximal'];

/**
 * Protokolldialog für eine geplante Einheit. Bei Krafteinheiten mit
 * Satztabelle, sonst nur Dauer und Anstrengung – bei einem Dauerlauf gibt es
 * keine Sätze zu zählen.
 */
export function protokollDialog(einheit, alleEinheiten = []) {
  const istKraft = einheit?.typ === 'kraft';
  const inhalt = el('div', {});

  inhalt.append(el('h2', {}, einheit ? einheit.titel : 'Einheit eintragen'));

  const typ = el('select', {},
    ...Object.entries(TYP_NAMEN).map(([wert, name]) =>
      el('option', { value: wert, selected: einheit?.typ === wert }, name)));

  const minuten = el('input', {
    type: 'number', min: '0', max: '400', value: einheit?.minuten || 60,
  });

  const rpeAnzeige = el('span', { class: 'mini' }, '7 – hart');
  const rpe = el('input', {
    type: 'range', min: '1', max: '10', step: '1', value: '7',
    oninput: (e) => { rpeAnzeige.textContent = `${e.target.value} – ${RPE_TEXT[Number(e.target.value)]}`; },
  });

  const notiz = el('textarea', { placeholder: 'Zeiten, Auffälligkeiten, wie es sich angefühlt hat …' });

  const uebungsFelder = [];

  if (istKraft) {
    // Satztabellen für Krafteinheiten.
    const alle = [...(einheit.uebungen || []), ...(einheit.prophylaxe || [])];
    for (const uebung of alle) {
      const block = uebungsBlock(uebung);
      if (block) {
        uebungsFelder.push(block);
        inhalt.append(block.knoten);
      }
    }
  } else {
    // Auch Sprint- und Ausdauereinheiten enthalten Blöcke, die auf ein
    // Schutzziel einzahlen – etwa das neuromuskuläre Aufwärmen fürs
    // Sprunggelenk. Ohne diese Häkchen bliebe das Ziel dauerhaft unerfüllt,
    // obwohl es jedes Mal absolviert wurde.
    for (const block of einheit?.bloecke || []) {
      if (!block.schluessel) continue;
      const feldBlock = erledigtBlock(block);
      uebungsFelder.push(feldBlock);
      inhalt.append(feldBlock.knoten);
    }
  }

  if (!istKraft) {
    inhalt.append(feld('Art', typ));
  }
  inhalt.append(feld('Dauer in Minuten', minuten));
  inhalt.append(el('div', { class: 'feld' },
    el('label', {}, 'Anstrengung der ganzen Einheit (RPE) · ', rpeAnzeige),
    rpe,
    el('div', { class: 'mini', style: { marginTop: '0.25rem' } },
      'Am besten ~30 min danach beurteilen, nicht mittendrin.')));
  inhalt.append(feld('Notiz', notiz));

  inhalt.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf haupt',
      onclick: async () => {
        const uebungen = uebungsFelder
          .map((f) => f.auslesen())
          .filter((u) => u?.saetze?.length);
        try {
          await sende('/session', {
            datum: zustand.datum,
            typ: istKraft ? 'kraft' : typ.value,
            titel: einheit?.titel || TYP_NAMEN[typ.value],
            minuten: Number(minuten.value),
            rpe: Number(rpe.value),
            notiz: notiz.value,
            uebungen,
          });
          dialogSchliessen();
          toast(uebungen.length
            ? `Gespeichert – ${uebungen.reduce((s, u) => s + u.saetze.length, 0)} Sätze protokolliert.`
            : 'Einheit gespeichert.', 'gut');
          aktualisieren();
        } catch (err) { toast(err.message, 'fehler'); }
      },
    }, 'Speichern'),
    el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen')));

  dialog(inhalt);
}

/**
 * Ein Block je Übung: Kopfzeile mit Vorgabe, darunter eine Zeile pro Satz.
 * Sätze lassen sich abwählen statt löschen – wer den vierten Satz nicht mehr
 * geschafft hat, hakt ihn einfach ab.
 */
function uebungsBlock(uebung) {
  if (!uebung?.schluessel) return null;

  const anzahl = Number(uebung.saetze) || 3;
  const [repMin, repMax] = uebung.repBereich || zielBereich(uebung.wiederholungen);
  const vorgabeGewicht = uebung.vorschlag?.empfehlung ?? uebung.gewicht?.von ?? '';

  const zeilen = [];
  const zeilenBox = el('div', {});

  // Nordic Hamstring und Copenhagen laufen ohne Zusatzlast. Ein Kilo-Feld
  // daneben wäre nicht nur überflüssig, sondern eine Aufforderung, dort etwas
  // einzutragen – und würde die Auswertung mit Fantasiewerten füllen.
  const ohneLast = Boolean(uebung.ohneLast);

  const zeileBauen = (nummer) => {
    const gewicht = ohneLast ? null : el('input', {
      type: 'number', step: '0.5', min: '0', inputmode: 'decimal',
      value: vorgabeGewicht, placeholder: 'kg',
      style: { textAlign: 'right' },
    });
    const wdh = el('input', {
      type: 'number', step: '1', min: '0', max: '100', inputmode: 'numeric',
      value: repMin, placeholder: 'Wdh',
      style: { textAlign: 'right' },
    });
    const aktiv = el('input', { type: 'checkbox', checked: true });

    const zeile = ohneLast
      ? el('div', { class: 'satz-zeile ohne-last' },
        el('span', { class: 'satz-nummer' }, nummer),
        wdh,
        el('span', { class: 'satz-mal' }, 'Wdh.'),
        el('label', { class: 'satz-haken', title: 'Satz absolviert' }, aktiv))
      : el('div', { class: 'satz-zeile' },
        el('span', { class: 'satz-nummer' }, nummer),
        gewicht,
        el('span', { class: 'satz-mal' }, '×'),
        wdh,
        el('label', { class: 'satz-haken', title: 'Satz absolviert' }, aktiv));

    zeilen.push({ gewicht, wdh, aktiv, zeile });
    return zeile;
  };

  for (let i = 1; i <= anzahl; i += 1) zeilenBox.append(zeileBauen(i));

  const vorgabe = uebung.gewicht
    ? `${uebung.intensitaet}${uebung.gewicht.geschaetzt ? ' (geschätzt)' : ''}`
    : uebung.intensitaet;

  const knoten = el('div', { class: 'uebung-block' },
    el('div', { class: 'uebung-kopf' },
      el('div', {},
        el('div', { class: 'uebung-name' }, uebung.name),
        el('div', { class: 'mini' }, `${anzahl} × ${repMin}–${repMax} · ${vorgabe}`)),
      el('button', {
        class: 'knopf leise',
        type: 'button',
        onclick: () => zeilenBox.append(zeileBauen(zeilen.length + 1)),
      }, '+ Satz')),
    uebung.vorschlag?.text
      ? el('div', { class: 'mini uebung-vorschlag' }, uebung.vorschlag.text)
      : null,
    zeilenBox);

  return {
    knoten,
    auslesen: () => ({
      schluessel: uebung.schluessel,
      saetze: zeilen
        .filter((z) => z.aktiv.checked && Number(z.wdh.value) > 0)
        .map((z) => ({
          gewicht: z.gewicht ? Number(z.gewicht.value) || 0 : 0,
          wiederholungen: Number(z.wdh.value) || 0,
        })),
    }),
  };
}

/**
 * Ein Block ohne Sätze, der nur abgehakt wird – etwa das neuromuskuläre
 * Aufwärmen. Er zahlt auf sein Schutzziel ein, ohne dass Gewichte oder
 * Wiederholungen zu zählen wären. Zwei Sätze, weil der Block je Seite
 * durchgeführt wird und die Schutzziele in Sätzen rechnen.
 */
function erledigtBlock(block) {
  const aktiv = el('input', { type: 'checkbox', checked: true });
  const knoten = el('div', { class: 'uebung-block' },
    el('label', { class: 'erledigt-zeile' },
      aktiv,
      el('div', {},
        el('div', { class: 'uebung-name' }, block.titel),
        el('div', { class: 'mini' }, block.inhalt))));

  return {
    knoten,
    auslesen: () => (aktiv.checked
      ? {
        schluessel: block.schluessel,
        saetze: [{ gewicht: 0, wiederholungen: 1 }, { gewicht: 0, wiederholungen: 1 }],
      }
      : null),
  };
}

/** Aus „6–12" den Zahlenbereich holen, falls repBereich fehlt. */
function zielBereich(text) {
  const treffer = String(text || '').match(/(\d+)\D+(\d+)/);
  return treffer ? [Number(treffer[1]), Number(treffer[2])] : [5, 8];
}

/** Kurzfassung einer protokollierten Einheit für Listen. */
export function sessionZusammenfassung(session) {
  const teile = [dauer(session.minuten), `RPE ${session.rpe}`];
  if (session.uebungen?.length) {
    const saetze = session.uebungen.reduce((s, u) => s + u.saetze.length, 0);
    teile.push(`${saetze} Sätze`);
    const schwerster = session.uebungen
      .flatMap((u) => u.saetze.map((s) => ({ ...s, name: u.name })))
      .sort((a, b) => b.gewicht - a.gewicht)[0];
    if (schwerster?.gewicht) {
      teile.push(`${schwerster.name} ${zahl(schwerster.gewicht, 1)} kg × ${schwerster.wiederholungen}`);
    }
  }
  return teile.join(' · ');
}
