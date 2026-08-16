// Essen eintragen: Suche in der Lebensmitteldatenbank, Tagesübersicht, Bilanz.

import {
  el, karte, balken, hinweis, feld, dialog, dialogSchliessen,
  toast, zahl, tagestypName,
  dezimalFeld,
} from './common.js';
import * as daten from './daten.js';
// Die Hinweise rund ums Training kommen aus dem Kern – sie standen hier ein
// zweites Mal und waren schon leicht anders formuliert als dort.
import { versorgungUmDieEinheit, tagesSumme } from '../kern/ernaehrung.js';
import { gerichtVorschlaege, tagesvorschlag } from '../kern/gerichte.js';
import { zahlAusEingabe, menge } from '../kern/regeln.js';
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

  // „Was passt jetzt?" steht zuerst: Das ist die Frage, die man mehrmals am
  // Tag hat. Der Tagesplan ist eine Frage vom Morgen oder vom Vorabend.
  if (h.makro) box.append(gerichteKarte(h), tagesKarte(h));

  box.append(tagesListe(h));

  if (h.makro) box.append(versorgungKarte(d, h));

  return box;
}

/* -------------------------------------------------------- Ein ganzer Tag */

/**
 * Frühstück, Mittag, Abendessen und ein Snack – zusammen ein Tag.
 *
 * Die Karte darunter beantwortet „was passt **jetzt** noch?" und rechnet
 * gegen den Rest des Tages. Diese hier beantwortet „so könnte der Tag
 * **aussehen**" und rechnet gegen das volle Tagesziel. Zwei Fragen, zwei
 * Karten – und weil sie leicht zu verwechseln sind, steht der Unterschied
 * auch im Text.
 */
function tagesKarte(h) {
  const box = karte(el('div', { class: 'karte-kopf' }, el('h2', {}, 'Ein ganzer Tag')));

  const inhalt = el('div', {}, el('p', { class: 'klein' }, 'Gerichte werden geladen …'));
  const chipReihe = el('div', { class: 'chips' });

  let variante = 0;
  let fleischlos = false;
  let schnell = false;
  let katalog = null;

  const chip = (text, aktiv, beiKlick) => el('button', {
    class: `chip${aktiv ? ' aktiv' : ''}`,
    type: 'button',
    'aria-pressed': aktiv ? 'true' : 'false',
    onclick: () => { beiKlick(); zeichnen(); },
  }, text);

  function zeichnen() {
    chipReihe.replaceChildren(
      chip('anderer Vorschlag', false, () => { variante += 1; }),
      chip('fleischlos', fleischlos, () => { fleischlos = !fleischlos; variante = 0; }),
      chip(`schnell (${SCHNELL_MINUTEN} min)`, schnell, () => { schnell = !schnell; variante = 0; }));
    if (!katalog) return;

    const bauen = () => tagesvorschlag(katalog.gerichte, katalog.lebensmittel, {
      kcal: h.makro.kcal,
      protein: h.makro.protein,
      variante,
      fleischlos,
      hoechstensMinuten: schnell ? SCHNELL_MINUTEN : null,
    });

    let t = bauen();
    // Am Ende der Liste angekommen wieder von vorn – sonst zeigte „anderer
    // Vorschlag" irgendwann dauerhaft denselben Tag, weil jede Mahlzeit auf
    // ihrem letzten Gericht klebt. Zurückgesetzt wird **vor** dem Anzeigen,
    // sonst sieht man den letzten Tag zweimal.
    if (t.mahlzeiten.length && variante >= t.varianten) { variante = 0; t = bauen(); }

    if (!t.mahlzeiten.length) {
      inhalt.replaceChildren(el('p', { class: 'klein' }, t.grund));
      return;
    }

    const teile = [el('p', { class: 'mini' },
      'Ein Vorschlag für den ganzen Tag, gerechnet gegen das Tagesziel – nicht gegen '
      + 'das, was heute noch offen ist. Wer schon gegessen hat, findet den Abgleich in '
      + 'der Karte darunter.')];

    // Wie in der Karte darunter: Was eingeschränkt wurde, steht als Satz da
    // und nicht nur als Farbe am Chip.
    const gesetzt = [
      fleischlos ? 'ohne Fleisch und Fisch' : null,
      schnell ? `höchstens ${SCHNELL_MINUTEN} Minuten je Mahlzeit` : null,
    ].filter(Boolean);
    if (gesetzt.length) {
      teile.push(el('p', { class: 'mini' },
        `Eingeschränkt auf: ${gesetzt.join(' · ')}. Nochmal tippen hebt es auf.`));
    }

    for (const m of t.mahlzeiten) teile.push(vorschlagZeile(m, null));

    // Die Summe steht mit ihrer Abweichung da. Ein Plan, der 300 kcal unter
    // dem Ziel liegt, ist kein Plan für diesen Tag – und das gehört
    // hingeschrieben, statt es in vier Zeilen zu verstecken.
    const abw = (wert, einheit) => (wert === 0 ? 'genau'
      : `${wert > 0 ? '+' : '−'}${zahl(Math.abs(wert))} ${einheit}`);
    teile.push(el('p', { class: 'mini' },
      `Zusammen ${zahl(t.summe.kcal)} kcal und ${zahl(t.summe.protein)} g Protein – `
      + `gegenüber dem Tagesziel ${abw(t.abweichung.kcal, 'kcal')} und `
      + `${abw(t.abweichung.protein, 'g Protein')}. Die Portionen gehen in halben `
      + 'Schritten, genauer wird es damit nicht.'));

    inhalt.replaceChildren(...teile);
  }

  zeichnen();
  daten.gerichte().then((k) => { katalog = k; zeichnen(); }).catch((err) => {
    inhalt.replaceChildren(hinweis(
      `Der Gerichtekatalog ließ sich nicht laden (${err.message}).`, 'warn'));
  });

  box.append(chipReihe, inhalt);
  return box;
}

/* ----------------------------------------------------- Was passt jetzt? */

/**
 * Die Karte, die die eigentliche Frage beantwortet.
 *
 * Der Rest der Ansicht sagt, wie viel noch offen ist. Das ist die Buchhaltung;
 * die Frage abends um sieben lautet aber „was koche ich jetzt?". Vorgeschlagen
 * wird, was zu dem passt, was fehlt – gerechnet aus denselben Nährwerten, die
 * auch der Rest der App benutzt.
 *
 * Der Katalog kommt nachgeladen: Er hängt an der Lebensmitteltabelle, und die
 * holt sich diese Ansicht ohnehin erst, wenn sie gebraucht wird. Bis dahin
 * steht in der Karte, dass geladen wird – ein leerer Kasten sähe aus wie ein
 * Fehler.
 */
function gerichteKarte(h) {
  const box = karte(el('div', { class: 'karte-kopf' },
    el('h2', {}, 'Was passt jetzt?')));

  const rest = { kcal: h.bilanz.kcal.rest, protein: h.bilanz.protein.rest };
  const inhalt = el('div', {}, el('p', { class: 'klein' }, 'Gerichte werden geladen …'));

  /*
   * Die Auswahl läuft über Knöpfe, nicht über ein Auswahlfeld und Häkchen.
   *
   * Der Grund ist das Scrollen: Ein `<select>` ist auf iOS ein natives
   * Bedienelement und **schluckt die Wischbewegung**, die auf ihm beginnt.
   * Volle Kartenbreite und 44 Pixel hoch war es damit ein toter Streifen
   * mitten in der Ansicht – wer den Daumen dort aufsetzte, kam nicht weiter.
   * Ein Knopf tut das nicht.
   *
   * Nebenbei passt es besser: Die Reiterleiste der App arbeitet mit denselben
   * Chips, und `werkzeug/knoepfe.mjs` kann Knöpfe prüfen – ein Auswahlfeld
   * sieht es nicht.
   */
  let mahlzeit = null;
  let fleischlos = false;
  let schnell = false;
  let anzahl = VORSCHLAEGE;

  const mahlzeitReihe = el('div', { class: 'chips' });
  const filterReihe = el('div', { class: 'chips' });

  const chip = (text, aktiv, beiKlick) => el('button', {
    class: `chip${aktiv ? ' aktiv' : ''}`,
    type: 'button',
    'aria-pressed': aktiv ? 'true' : 'false',
    onclick: () => { beiKlick(); zeichnen(); },
  }, text);

  function chipsZeichnen() {
    mahlzeitReihe.replaceChildren(
      chip('Alle', mahlzeit === null, () => { mahlzeit = null; }),
      ...MAHLZEITEN.map(([wert, name]) =>
        chip(name, mahlzeit === wert, () => { mahlzeit = mahlzeit === wert ? null : wert; })));
    filterReihe.replaceChildren(
      chip('fleischlos', fleischlos, () => { fleischlos = !fleischlos; }),
      chip(`schnell (${SCHNELL_MINUTEN} min)`, schnell, () => { schnell = !schnell; }));
  }

  let katalog = null;

  function zeichnen() {
    chipsZeichnen();
    if (!katalog) return;
    const ergebnis = gerichtVorschlaege(katalog.gerichte, katalog.lebensmittel, {
      rest,
      mahlzeitKcal: h.mahlzeiten?.kcalJe ?? null,
      mahlzeit,
      trainingstag: Boolean(h.trainingstag),
      fleischlos,
      hoechstensMinuten: schnell ? SCHNELL_MINUTEN : null,
      anzahl,
    });

    const teile = [];

    if (ergebnis.grund) {
      teile.push(el('p', { class: 'klein' }, ergebnis.grund));
      inhalt.replaceChildren(...teile);
      return;
    }

    // Sortiert wird nach der Proteindichte – also gehört sie auch dahin,
    // nachrechenbar. Ist das Protein schon gedeckt, steht dort keine
    // Prozentzahl: Ein negativer Rest ergibt keinen Energieanteil, und
    // „−34 % der Energie aus Protein" ist keine Auskunft (Falle 10).
    teile.push(el('p', { class: 'mini' }, ergebnis.proteinGedeckt
      ? `Offen sind ${zahl(ergebnis.restKcal)} kcal. Beim Protein ist das Ziel schon `
        + 'erreicht – gesucht ist also etwas, das vor allem Kohlenhydrate und Fett '
        + 'liefert. Danach ist auch sortiert.'
      : `Offen sind ${zahl(ergebnis.restKcal)} kcal und ${zahl(ergebnis.restProtein)} g `
        + `Protein – das sind ${Math.round(ergebnis.zielDichte * 100)} % der Energie aus `
        + 'Protein. Sortiert ist nach dieser Dichte: Kohlenhydrate und Fett kommen beim '
        + 'normalen Essen von allein zusammen, das Protein nicht.'));

    /*
     * Was gerade weggefiltert wird, steht als Satz da – nicht nur als Farbe
     * am Chip.
     *
     * Auf einem Handy im Freien ist eine Randfarbe kaum zu sehen, und wer die
     * Karte nach ein paar Minuten wieder öffnet, weiß nicht mehr, warum
     * plötzlich nur noch Quark dasteht. Nebenbei erkennt
     * `werkzeug/knoepfe.mjs` daran, dass die Chips überhaupt etwas bewirken:
     * Es vergleicht den Seitentext, und der änderte sich vorher nicht,
     * solange dieselben drei Gerichte oben blieben.
     */
    const gesetzt = [
      fleischlos ? 'ohne Fleisch und Fisch' : null,
      schnell ? `höchstens ${SCHNELL_MINUTEN} Minuten Aufwand` : null,
      mahlzeit ? `nur ${MAHLZEIT_NAMEN[mahlzeit]}` : null,
    ].filter(Boolean);
    if (gesetzt.length) {
      teile.push(el('p', { class: 'mini' },
        `Eingeschränkt auf: ${gesetzt.join(' · ')}. Nochmal tippen hebt es auf.`));
    }

    for (const v of ergebnis.vorschlaege) teile.push(vorschlagZeile(v, mahlzeit));

    // Drei Vorschläge sind die Antwort auf „was koche ich jetzt?" – bei über
    // hundert Gerichten im Katalog aber eine dünne Auswahl, wenn keiner davon
    // passt. Der Knopf steht nur da, wenn wirklich noch etwas kommt: Ein
    // „weitere anzeigen" vor einer leeren Liste wäre ein Weg ohne Wirkung.
    const weitere = ergebnis.gefunden - ergebnis.vorschlaege.length;
    if (weitere > 0 || anzahl > VORSCHLAEGE) {
      // Der Knopf nennt, was ein Tipp **tut** – nicht, wie viel es insgesamt
      // gibt. „111 weitere Gerichte anzeigen" stand hier zuerst und zeigte
      // dann sechs: eine Zahl, die etwas anderes zählt als die Handlung
      // daneben (Falle 15). Die Gesamtzahl steht als eigene Zeile darüber,
      // wo sie eine Auskunft ist und kein Versprechen.
      const schritt = Math.min(VORSCHLAEGE * 2, weitere);
      teile.push(el('p', { class: 'mini' },
        `${ergebnis.vorschlaege.length} von ${ergebnis.gefunden} passenden Gerichten.`));
      teile.push(el('div', { class: 'chips' },
        ...(weitere > 0 ? [chip(`${menge(schritt, 'weiteres', 'weitere')} anzeigen`,
          false, () => { anzahl += VORSCHLAEGE * 2; })] : []),
        ...(anzahl > VORSCHLAEGE ? [chip('wieder kürzen', false, () => { anzahl = VORSCHLAEGE; })] : [])));
    }

    teile.push(el('p', { class: 'mini' },
      'Halbe, ganze, anderthalbe oder doppelte Portion – Küchenpraxis, keine Studienlage. '
      + 'Genommen wird die größte Portion, die unter dem bleibt, was noch offen ist.'));

    inhalt.replaceChildren(...teile);
  }

  zeichnen();

  daten.gerichte().then((k) => { katalog = k; zeichnen(); }).catch((err) => {
    inhalt.replaceChildren(hinweis(
      `Der Gerichtekatalog ließ sich nicht laden (${err.message}). Eintragen und `
      + 'Suchen funktionieren weiter.', 'warn'));
  });

  box.append(mahlzeitReihe, filterReihe, inhalt);
  return box;
}

const MAHLZEIT_NAMEN = Object.fromEntries(MAHLZEITEN);

// Was „schnell" heißt, ist eine Frage des Alltags und keine der Trainingslehre –
// deshalb steht die Zahl hier und nicht in `wissen.js`. Sie ändert keine
// Empfehlung, sondern nur, wie viel von der Liste man sieht.
const SCHNELL_MINUTEN = 10;

// Wie viele Vorschläge zuerst dastehen. Drei beantworten die Frage; wer mehr
// will, tippt. Keine fachliche Zahl – sie ändert nur, wie lang die Liste ist.
const VORSCHLAEGE = 3;

function vorschlagZeile(v, gewaehlteMahlzeit) {
  const n = v.naehrwerte;
  const kopf = el('div', { class: 'zeile-titel' }, v.gericht.name);

  const meta = [
    v.portion,
    `${zahl(n.kcal)} kcal`,
    `${zahl(n.protein)} P / ${zahl(n.kohlenhydrate)} KH / ${zahl(n.fett)} F`,
    `${v.gericht.minuten} min`,
  ];
  // Nur die Kennzeichen, die etwas hinzufügen. „Fleisch" ist die
  // Voreinstellung des Katalogs und sagt niemandem etwas; „vegan" schon.
  // „Hält sich nicht" wäre bei zwei Dritteln der Gerichte reines Rauschen –
  // die Angabe steht deshalb nur da, wenn sie zutrifft.
  if (v.fleischlos) meta.push(v.gericht.art);
  if (v.gericht.haeltSich) meta.push('hält sich');
  // Die Mahlzeit nur nennen, wenn nicht ohnehin danach gefiltert wurde –
  // sonst steht in jeder Zeile dasselbe Wort wie im Auswahlfeld darüber.
  if (!gewaehlteMahlzeit) meta.unshift(MAHLZEIT_NAMEN[v.gericht.mahlzeit] || 'Sonstiges');

  const details = el('details', { class: 'klapp gericht' },
    el('summary', {}, el('div', { class: 'zeile-text' },
      kopf,
      el('div', { class: 'zeile-meta' }, meta.join(' · ')))));

  // „Deckt X % der offenen Kalorien" ist nachrechenbar; eine Punktzahl wäre es
  // nicht. Beim Protein steht die Zahl nur, wenn überhaupt noch etwas offen
  // ist – sonst wäre sie eine Division durch nichts.
  const deckung = [`deckt ${v.deckung.kcal} % der offenen Kalorien`];
  if (v.deckung.protein != null) deckung.push(`${v.deckung.protein} % des offenen Proteins`);
  details.append(el('p', { class: 'mini' }, deckung.join(' und ')));

  if (v.ueberZiel) {
    details.append(hinweis(
      'Auch die kleinste Portion liegt über dem, was heute noch offen ist. '
      + 'Kein Verbot – nur damit es nicht unbemerkt passiert.', 'warn'));
  }

  const liste = el('ul', { class: 'klein' });
  for (const z of v.zutaten) liste.append(el('li', {}, `${zahl(z.mengeG)} g ${z.name}`));
  details.append(liste);

  details.append(el('p', { class: 'klein' }, v.gericht.zubereitung));

  details.append(el('div', { class: 'knopf-reihe' },
    el('button', {
      class: 'knopf',
      onclick: async () => {
        try {
          // Jede Zutat einzeln ins Tagebuch – so lässt sich hinterher eine
          // davon löschen oder ändern, ohne das ganze Gericht anzufassen.
          // Und die Tagessumme rechnet über dieselben Einträge wie sonst
          // auch, statt über einen Sonderfall „Gericht".
          for (const z of v.zutaten) {
            await daten.essenAnlegen({
              name: z.name,
              mengeG: String(z.mengeG),
              mahlzeit: v.gericht.mahlzeit,
              kcal: z.je100.kcal,
              protein: z.je100.protein,
              kohlenhydrate: z.je100.kohlenhydrate,
              fett: z.je100.fett,
            });
          }
          toast(`${v.gericht.name} eingetragen.`, 'gut');
          aktualisieren();
        } catch (err) { toast(err.message, 'fehler'); }
      },
    }, 'Alles eintragen')));

  return details;
}

function bilanzKarte(h) {
  const b = h.bilanz;
  const inhalt = karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, 'Tagesbilanz'),
      el('span', { class: 'mini' }, tagestypName(h.tagestyp, Boolean(h.einheiten?.length)))));

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

  // Was nicht in die Summe eingeht, gehört an die Summe geschrieben – sonst
  // steht in der Liste ein Eintrag, den die Zahl darüber nicht kennt.
  if (h.ist?.ohneMenge > 0) {
    inhalt.append(hinweis(
      `${menge(h.ist.ohneMenge, 'Eintrag zählt', 'Einträge zählen')} nicht mit: `
      + 'ohne Menge lässt sich daraus nichts rechnen. Solche Einträge kann die App '
      + 'nicht anlegen – sie stammen aus einer eingespielten Sicherung.', 'warn'));
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

    /*
     * Die Summe kommt aus dem Kern. Hier stand `e.kcal * e.mengeG / 100`
     * noch einmal – eine zweite Herleitung derselben Zahl (Falle 13), und
     * eine, die schlechter rechnete: Bei einem Eintrag **ohne Menge** wird
     * daraus `NaN`, und `zahl()` macht daraus einen Strich. Über drei
     * tadellosen Zeilen stand dann „Frühstück · – kcal", während die Karte
     * darüber die 716 kcal sehr wohl mitzählte.
     */
    const summe = tagesSumme(eintraege);
    box.append(el('h3', { style: { marginTop: '0.7rem' } },
      `${titel} · ${zahl(summe.kcal)} kcal`));

    for (const e of eintraege) {
      const faktor = Number(e.mengeG) / 100;
      box.append(el('div', { class: 'zeile' },
        el('div', { class: 'zeile-text' },
          el('div', { class: 'zeile-titel' }, e.name),
          el('div', { class: 'zeile-meta' }, faktor > 0
            ? `${zahl(e.mengeG)} g · ${zahl(e.kcal * faktor)} kcal · `
              + `${zahl(e.protein * faktor)} P / ${zahl(e.kohlenhydrate * faktor)} KH / ${zahl(e.fett * faktor)} F`
            // Der Grund gehört an die Stelle, an der das Ergebnis fehlt
            // (Falle 22) – samt dem, was dagegen hilft.
            : 'Ohne Menge – zählt nicht in die Summe. Löschen und neu eintragen.')),
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
    const faktor = Number(e.mengeG) / 100;
    box.append(el('div', { class: 'zeile' },
      el('div', { class: 'zeile-text' },
        el('div', { class: 'zeile-titel' }, e.name),
        el('div', { class: 'zeile-meta' }, faktor > 0
          ? `${zahl(e.mengeG)} g · ${zahl(e.kcal * faktor)} kcal`
          : 'Ohne Menge – zählt nicht in die Summe. Löschen und neu eintragen.')),
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
  // Alle Einheiten des Tages, nicht nur die erste.
  //
  // Hier stand `h.einheiten[0]`. Über zwölf Wochen Plan geht dabei kein
  // Hinweis verloren – aber nur, weil der Planer die harte Einheit immer
  // zuerst legt und die zweite auf Doppeltagen unter den Zeitschwellen
  // bleibt. Beides ist Zufall aus Sicht dieser Karte: Läge die lange
  // Ausfahrt hinten, fehlte der Hinweis zur Verpflegung während der
  // Belastung genau an dem Tag, an dem er zählt.
  //
  // Gesammelt wird je Einheit und nicht über die Tagessumme: Zwei Einheiten
  // mit Pause dazwischen sind keine durchgehende Belastung, und „ab 90 min
  // Kohlenhydrate währenddessen" meint eine Einheit, nicht einen Tag.
  const liste = el('ul', { class: 'klein' });
  const gesehen = new Set();
  for (const einheit of h.einheiten) {
    for (const t of versorgungUmDieEinheit(d.profil, einheit.typ, einheit.minuten)) gesehen.add(t);
  }
  for (const t of gesehen) liste.append(el('li', {}, t));
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
  const menge = dezimalFeld({ value: lebensmittel.mengeG || 100 });
  const mahlzeit = el('select', {},
    ...MAHLZEITEN.map(([wert, name]) => el('option', { value: wert }, name)));

  const vorschau = el('div', { class: 'klein' });
  function aktualisiereVorschau() {
    const f = (zahlAusEingabe(menge.value) ?? 0) / 100;
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
              mengeG: menge.value,
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
  // Auch diese beiden als Dezimalfeld: „162,5 kcal" von der Packung ist keine
  // Ausnahme, und `type="number"` verwirft ein Komma stillschweigend – der
  // Wert kommt dann als leerer String an und wird zu 0. Die Mahlzeit stünde
  // mit null Kalorien im Tagebuch, ohne dass irgendwo etwas aufleuchtet.
  const menge = dezimalFeld({ value: '100' });
  const kcal = dezimalFeld({ placeholder: 'je 100 g' });
  const protein = dezimalFeld({ placeholder: 'je 100 g' });
  const kh = dezimalFeld({ placeholder: 'je 100 g' });
  const fett = dezimalFeld({ placeholder: 'je 100 g' });
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
              // Roh weiterreichen: Die Umrechnung gehört in kern/aendern.js,
              // und nur dort wird ein Komma richtig gelesen. Hier stand
              // `Number(x) || 0` – aus „27,3 g Protein" wurde damit 0 g.
              mengeG: menge.value,
              mahlzeit: mahlzeit.value,
              kcal: kcal.value,
              protein: protein.value,
              kohlenhydrate: kh.value,
              fett: fett.value,
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
