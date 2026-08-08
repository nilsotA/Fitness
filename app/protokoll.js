// Trainingsprotokoll: Sätze mit Gewicht und Wiederholungen eintragen.
//
// Der Ablauf ist auf die Situation zugeschnitten, in der er stattfindet: Man
// steht zwischen zwei Sätzen mit dem Handy in der Hand und hat weder Lust noch
// Zeit, ein Formular auszufüllen. Deshalb ist alles vorbelegt – mit der Last,
// die der Plan vorschlägt, und den Wiederholungen aus dem Zielbereich. Im
// Normalfall genügt Antippen und Speichern.

import {
  el, feld, dialog, dialogSchliessen, toast, zahl, dauer, hinweis, datumLang, TYP_NAMEN,
} from './common.js';
import * as daten from './daten.js';
import { aktualisieren, zustand } from './app.js';
import { laufBewerten, tempo, zoneAusHf } from '../kern/regeln.js';

const RPE_TEXT = ['', 'sehr leicht', 'leicht', 'moderat', 'etwas fordernd', 'fordernd',
  'fordernd+', 'hart', 'sehr hart', 'fast maximal', 'maximal'];

/**
 * Protokolldialog für eine geplante Einheit. Bei Krafteinheiten mit
 * Satztabelle, sonst nur Dauer und Anstrengung – bei einem Dauerlauf gibt es
 * keine Sätze zu zählen.
 */
export function protokollDialog(einheit, alleEinheiten = [], vorgabe = null) {
  const istKraft = einheit?.typ === 'kraft';
  const inhalt = el('div', {});

  inhalt.append(el('h2', {}, einheit ? einheit.titel : 'Einheit eintragen'));

  // Aus einer importierten Datei kommen Datum, Dauer, Strecke und Puls schon
  // mit. Was bleibt, ist das RPE – die einzige Zahl, die kein Gerät misst.
  if (vorgabe) {
    inhalt.append(hinweis(
      `Aus ${vorgabe.format}-Datei übernommen: ${datumLang(vorgabe.datum)}, `
      + `${vorgabe.minuten} min, ${zahl(vorgabe.meter / 1000, 1)} km`
      + (vorgabe.hfSchnitt ? `, Puls ${vorgabe.hfSchnitt}` : '')
      + '. Bitte noch die Anstrengung einschätzen.', 'info'));
  }

  const vorgabeTyp = vorgabe && (vorgabe.hfSchnitt || vorgabe.meter)
    ? 'ausdauerLocker' : null;
  const typ = el('select', {},
    ...Object.entries(TYP_NAMEN).map(([wert, name]) =>
      el('option', {
        value: wert,
        selected: einheit?.typ === wert || (!einheit && wert === vorgabeTyp),
      }, name)));

  const minuten = el('input', {
    type: 'number', min: '0', max: '400',
    value: vorgabe?.minuten || einheit?.minuten || 60,
  });

  const rpeAnzeige = el('span', { class: 'mini' }, '7 – hart');
  const rpe = el('input', {
    type: 'range', min: '1', max: '10', step: '1', value: '7',
    oninput: (e) => { rpeAnzeige.textContent = `${e.target.value} – ${RPE_TEXT[Number(e.target.value)]}`; },
  });

  const notiz = el('textarea', { placeholder: 'Zeiten, Auffälligkeiten, wie es sich angefühlt hat …' });

  const uebungsFelder = [];
  let sprintFeld = null;
  let streckeFeld = null;
  let pulsFeld = null;

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
    // Bei Sprinteinheiten sind die Zeiten das Wichtigste, was es zu erfassen
    // gibt – sie entscheiden noch während der Einheit, ob weitergelaufen wird.
    if (zustand.daten?.sprint?.schwelle) {
      sprintFeld = sprintBlock(einheit, zustand.daten.sprint.schwelle);
      inhalt.append(sprintFeld.knoten);
    }

    // Bei Ausdauereinheiten Strecke und Gerät – daraus entsteht das Tempo,
    // und aus dem Tempo über die Wochen die eigentliche Ausdauerkurve. Dazu
    // freiwillig der Durchschnittspuls; ohne ihn entscheidet weiter das RPE.
    if (zustand.daten?.ausdauer?.geraete) {
      streckeFeld = streckeBlock(
        einheit,
        zustand.daten.ausdauer.geraete,
        vorgabe?.geraet || zustand.daten.profil?.ausdauerGeraet || 'laufen',
        vorgabe?.meter);
      inhalt.append(streckeFeld.knoten);

      pulsFeld = pulsBlock(zustand.daten.ausdauer.pulszonen, vorgabe?.hfSchnitt);
      inhalt.append(pulsFeld.knoten);
    }

    // Welche Blöcke sichtbar sind, hängt an der gewählten Art – und die ist
    // beim freien Eintrag erst im Dialog gesetzt. Vorher wurden Strecke und
    // Puls aus der geplanten Einheit abgeleitet und fehlten deshalb genau
    // dann, wenn man eine Einheit ohne Plan nachträgt.
    const sichtbarkeit = () => {
      const art = typ.value;
      if (sprintFeld) sprintFeld.zeigen(art === 'sprint');
      if (streckeFeld) streckeFeld.zeigen(art.startsWith('ausdauer'));
      if (pulsFeld) pulsFeld.zeigen(art.startsWith('ausdauer'));
    };
    typ.addEventListener('change', sichtbarkeit);
    sichtbarkeit();

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
  // Ändert sich die Dauer, ändert sich das Tempo – sonst stünde dort eine
  // Zahl, die zur eingetragenen Strecke nicht mehr passt.
  if (streckeFeld) {
    streckeFeld.minutenQuelle(() => Number(minuten.value) || 0);
    minuten.addEventListener('input', () => streckeFeld.minutenQuelle(() => Number(minuten.value) || 0));
  }
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
        const laeufe = sprintFeld ? sprintFeld.auslesen() : [];
        try {
          await daten.sessionAnlegen({
            // Eine importierte Datei bringt ihr eigenes Datum mit – sie kann
            // von gestern sein.
            datum: vorgabe?.datum || zustand.datum,
            typ: istKraft ? 'kraft' : typ.value,
            titel: einheit?.titel || TYP_NAMEN[typ.value],
            minuten: Number(minuten.value),
            rpe: Number(rpe.value),
            notiz: notiz.value,
            uebungen,
            laeufe,
            strecke: streckeFeld ? streckeFeld.auslesen() : null,
            hfSchnitt: pulsFeld ? pulsFeld.auslesen() : null,
          });
          dialogSchliessen();
          // Die Meldung soll benennen, was tatsächlich erfasst wurde – bei einer
          // Sprinteinheit sind das Läufe, keine Sätze.
          const teile = [];
          const saetze = uebungen.reduce((s, u) => s + u.saetze.length, 0);
          if (laeufe.length) teile.push(`${laeufe.length} Läufe`);
          if (saetze) teile.push(`${saetze} Sätze`);
          toast(teile.length ? `Gespeichert – ${teile.join(', ')} protokolliert.`
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
 * Zeiteingabe für Sprintläufe mit sofortiger Rückmeldung.
 *
 * Der Nutzen der Abbruchregel liegt genau hier: Eine Auswertung nach der
 * Einheit ist Statistik, eine Rückmeldung zwischen zwei Läufen ist Training.
 * Deshalb steht unter jedem eingegebenen Lauf, wie er zur Tagesbestzeit steht –
 * und ab wann Schluss ist.
 */
function sprintBlock(einheit, schwelle) {
  // Distanz und Art aus dem Plan vorbelegen, damit man am Platz nichts
  // einstellen muss.
  const fliegend = /fliegend/i.test(einheit?.fokus || '') || einheit?.fokus === 'Maximalgeschwindigkeit';
  const block = (einheit?.bloecke || []).find((b) => /× \d+ m$/.test(b.titel));
  const treffer = block?.titel.match(/(\d+) × (\d+) m$/);
  const geplanteLaeufe = treffer ? Number(treffer[1]) : 6;
  const distanz = treffer ? Number(treffer[2]) : 30;

  const zeilen = [];
  const zeilenBox = el('div', {});

  const werte = () => zeilen.map((z) => ({
    distanz: Number(z.distanz.value) || 0,
    sekunden: Number(z.zeit.value) || 0,
    art: fliegend ? 'fliegend' : 'beschleunigung',
  }));

  /** Alle Rückmeldungen neu berechnen – eine neue Bestzeit ändert auch die alten. */
  const bewerten = () => {
    const alle = werte();
    zeilen.forEach((z, i) => {
      if (!alle[i].sekunden) {
        z.rueckmeldung.textContent = '';
        z.rueckmeldung.className = 'sprint-rueckmeldung';
        return;
      }
      const b = laufBewerten(alle, i, schwelle);
      z.rueckmeldung.textContent = b ? b.text : '';
      z.rueckmeldung.className = `sprint-rueckmeldung ${b ? b.stufe : ''}`;
    });
  };

  const zeileBauen = (nummer) => {
    const zeit = el('input', {
      type: 'number', step: '0.01', min: '0', inputmode: 'decimal',
      placeholder: 's', style: { textAlign: 'right' },
      oninput: bewerten,
    });
    const dist = el('input', {
      type: 'number', step: '5', min: '5', inputmode: 'numeric',
      value: distanz, style: { textAlign: 'right' },
      oninput: bewerten,
    });
    const rueckmeldung = el('div', { class: 'sprint-rueckmeldung' });

    const zeile = el('div', { class: 'sprint-zeile' },
      el('span', { class: 'satz-nummer' }, nummer),
      dist,
      el('span', { class: 'satz-mal' }, 'm in'),
      zeit,
      el('span', { class: 'satz-mal' }, 's'));

    zeilen.push({ zeit, distanz: dist, rueckmeldung });
    return el('div', {}, zeile, rueckmeldung);
  };

  for (let i = 1; i <= geplanteLaeufe; i += 1) zeilenBox.append(zeileBauen(i));

  const knoten = el('div', { class: 'uebung-block' },
    el('div', { class: 'uebung-kopf' },
      el('div', {},
        el('div', { class: 'uebung-name' }, `Zeiten (${fliegend ? 'fliegend' : 'aus dem Stand'})`),
        el('div', { class: 'mini' },
          `Ab ${schwelle.abbruchProzent} % über der Tagesbestzeit ist die Qualität weg. `
          + 'Leer lassen, was du nicht gestoppt hast.')),
      el('button', {
        class: 'knopf leise',
        type: 'button',
        onclick: () => zeilenBox.append(zeileBauen(zeilen.length + 1)),
      }, '+ Lauf')),
    zeilenBox);

  const sicht = sichtbar(knoten);
  return {
    knoten,
    istSprint: true,
    zeigen: sicht.zeigen,
    auslesen: () => (sicht.aktiv()
      ? werte().filter((l) => l.sekunden > 0 && l.distanz > 0)
      : []),
  };
}

/**
 * Ein Block, der zur gewählten Art passen muss. Ausgeblendete Blöcke geben
 * nichts zurück – sonst landeten Sprintzeiten an einer Ausdauereinheit, bloß
 * weil vorher etwas anderes ausgewählt war.
 */
function sichtbar(knoten) {
  let an = true;
  return {
    aktiv: () => an,
    zeigen: (ja) => { an = ja; knoten.style.display = ja ? '' : 'none'; },
  };
}

/**
 * Strecke und Gerät für Ausdauereinheiten, mit sofort gerechnetem Tempo.
 *
 * Das Tempo steht direkt daneben, weil es die Zahl ist, die man behalten will –
 * niemand rechnet im Kopf 9,2 km in 51 min in eine Pace um.
 */
function streckeBlock(einheit, geraete, standardGeraet, vorgabeMeter = null) {
  const geraet = el('select', {},
    ...Object.entries(geraete).map(([wert, g]) =>
      el('option', { value: wert, selected: wert === standardGeraet }, g.name)));

  const km = el('input', {
    type: 'number', step: '0.1', min: '0', inputmode: 'decimal', placeholder: 'km',
    value: vorgabeMeter ? (vorgabeMeter / 1000).toFixed(2) : '',
  });
  const anzeige = el('div', { class: 'mini' });

  const rechnen = (minuten) => {
    const meter = (Number(km.value) || 0) * 1000;
    const min = Number(minuten) || 0;
    if (!meter || !min) { anzeige.textContent = ''; return; }
    const t = tempo(meter, min, geraet.value);
    anzeige.textContent = t ? `Tempo: ${t.text}` : '';
  };

  km.addEventListener('input', () => rechnen(aktuelleMinuten()));
  geraet.addEventListener('change', () => rechnen(aktuelleMinuten()));
  let aktuelleMinuten = () => einheit?.minuten || 0;

  const knoten = el('div', { class: 'uebung-block' },
    el('div', { class: 'uebung-name' }, 'Strecke'),
    el('div', { class: 'felder', style: { marginTop: '0.5rem' } },
      feld('Gerät', geraet),
      feld('Kilometer', km)),
    anzeige);

  const sicht = sichtbar(knoten);
  return {
    knoten,
    zeigen: sicht.zeigen,
    minutenQuelle: (fn) => { aktuelleMinuten = fn; rechnen(fn()); },
    auslesen: () => {
      if (!sicht.aktiv()) return null;
      const meter = Math.round((Number(km.value) || 0) * 1000);
      return meter > 0 ? { meter, geraet: geraet.value } : null;
    },
  };
}

/**
 * Durchschnittspuls einer Ausdauereinheit, mit sofort angezeigter Zone.
 *
 * Die Zone erscheint direkt beim Tippen, weil sie genau dann etwas ändert: Wer
 * nach einer als „locker" gedachten Runde 158 einträgt und Grauzone liest, weiß
 * fürs nächste Mal Bescheid. Eine Woche später im Diagramm ist das nur noch
 * eine Statistik.
 *
 * Gefragt ist ausdrücklich der Schnitt, nicht der Höchstwert – beim Intervall
 * liegt der Höchstwert immer im harten Bereich, auch wenn die Einheit
 * überwiegend Trabpause war.
 */
function pulsBlock(zonen, vorgabe = null) {
  const eingabe = el('input', {
    type: 'number', min: '30', max: '230', inputmode: 'numeric', placeholder: 'bpm',
    value: vorgabe || '',
  });
  const anzeige = el('div', { class: 'mini' });

  const ZONEN_TEXT = {
    locker: 'Locker – der Bereich, in dem die Mehrheit der Zeit liegen sollte.',
    grauzone: 'Grauzone – zu schnell für Erholung, zu langsam für einen Reiz.',
    hart: 'Hart – zählt als harte Einheit.',
  };

  const rechnen = () => {
    const wert = Number(eingabe.value) || 0;
    if (!wert || !zonen) { anzeige.textContent = ''; return; }
    const zone = zoneAusHf(wert, zonen);
    anzeige.textContent = zone ? ZONEN_TEXT[zone] : '';
  };
  eingabe.addEventListener('input', rechnen);
  // Bei vorbelegtem Wert die Zone sofort anzeigen, nicht erst nach einer Eingabe.
  if (vorgabe) rechnen();

  // Ohne Zonen lässt sich nichts einordnen. Der Wert wird trotzdem gespeichert –
  // sobald Geburtsjahr oder gemessener Maximalpuls im Profil stehen, ordnet die
  // Auswertung die alten Einheiten rückwirkend mit ein.
  const hilfe = zonen
    ? `Locker bis ${zonen.grauzone - 1}, Grauzone ab ${zonen.grauzone}, hart ab ${zonen.hart} bpm.`
    : 'Zonen erst mit Geburtsjahr oder gemessenem Maximalpuls im Profil. '
      + 'Der Wert wird trotzdem gespeichert.';

  const knoten = el('div', { class: 'uebung-block' },
    el('div', { class: 'uebung-name' }, 'Durchschnittspuls (optional)'),
    el('div', { class: 'felder', style: { marginTop: '0.5rem' } },
      feld('Schnitt über die Einheit', eingabe, hilfe)),
    anzeige);

  const sicht = sichtbar(knoten);
  return {
    knoten,
    zeigen: sicht.zeigen,
    auslesen: () => (sicht.aktiv() ? Number(eingabe.value) || null : null),
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
