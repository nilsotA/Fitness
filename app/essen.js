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
import { gerichtVorschlaege, mahlzeitBudget, tagesvorschlag } from '../kern/gerichte.js';
import { zahlAusEingabe, menge } from '../kern/regeln.js';
import { aktualisieren, zuAnsicht, zustand } from './app.js';

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
    /*
     * Ohne Körperdaten fallen **drei** Karten weg: die Tagesbilanz, die
     * Gerichtevorschläge samt Tagesplan und die Verpflegung rund ums Training.
     * Der Hinweis nannte nur die erste („nur der Abgleich fehlt") – wer die App
     * am ersten Tag öffnet, sieht einen Suchknopf und eine leere Liste und
     * erfährt nie, dass der Tracker Gerichte vorschlagen kann.
     *
     * Und er führte nirgendwohin. „Wer benennt, was fehlt, soll auch
     * hinführen" steht seit dem ersten Tag in dieser Datei – „Heute" und
     * „Fortschritt" tun es längst, „Essen" war die letzte Ansicht ohne Weg.
     */
    box.append(karte(
      el('h2', {}, 'Zielwerte fehlen noch'),
      el('p', { class: 'klein' },
        'Eintragen kannst du trotzdem, und die Summen unten stimmen. Was fehlt, ist '
        + 'alles, was einen Zielwert braucht: die Tagesbilanz, die Gerichtevorschläge '
        + 'für das, was heute noch offen ist, und die Verpflegung rund ums Training. '
        + 'Dafür genügen Gewicht, Größe und Geburtsjahr im Profil.'),
      el('div', { class: 'knopf-reihe' },
        el('button', { class: 'knopf', onclick: () => zuAnsicht('profil') }, 'Zum Profil'))));
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
      kohlenhydrate: h.makro.kohlenhydrate,
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

    for (const m of t.mahlzeiten) teile.push(vorschlagZeile(m, null, 'tag'));

    // Die Summe steht mit ihrer Abweichung da. Ein Plan, der 300 kcal unter
    // dem Ziel liegt, ist kein Plan für diesen Tag – und das gehört
    // hingeschrieben, statt es in vier Zeilen zu verstecken. Die
    // Kohlenhydrate gehören dazu: Sie fehlten in dieser Zeile, während der
    // Plan an harten Tagen fast immer unter dem eigenen Korridor lag
    // (Falle 108).
    // „±0" statt „genau": In einer Aufzählung von dreien bliebe sonst offen,
    // was genau getroffen ist.
    const abw = (wert, einheit) => `${wert > 0 ? '+' : wert < 0 ? '−' : '±'}`
      + `${zahl(Math.abs(wert))} ${einheit}`;
    teile.push(el('p', { class: 'mini' },
      `Zusammen ${zahl(t.summe.kcal)} kcal, ${zahl(t.summe.protein)} g Protein und `
      + `${zahl(t.summe.kohlenhydrate)} g Kohlenhydrate – gegenüber dem Tagesziel `
      + `${abw(t.abweichung.kcal, 'kcal')}, ${abw(t.abweichung.protein, 'g Protein')} und `
      + `${abw(t.abweichung.kohlenhydrate, 'g Kohlenhydrate')}. Die Portionen gehen in halben `
      + 'Schritten, genauer wird es damit nicht.'));

    // Bei langer Ausdauer liegt der Korridor bei 7–9 g/kg, und den erreichen
    // vier Mahlzeiten aus diesem Katalog kaum: gemessen an 84 % dieser Tage
    // nicht. Das ist keine Schwäche der Auswahl, sondern der Grund, warum es
    // Verpflegung während der Einheit gibt – der Plan lässt „Ums Training"
    // bewusst weg (siehe `TAGESPLAN_MAHLZEITEN`). Gesagt werden muss es
    // trotzdem, sonst steht ein Minus da ohne Weg (Falle 108).
    if (h.tagestyp === 'langeAusdauer' && t.abweichung.kohlenhydrate < 0) {
      teile.push(el('p', { class: 'mini' },
        'Bei einer langen Einheit kommt ein Teil der Kohlenhydrate während der Belastung – '
        + 'wie viel, steht in der Karte „Rund ums Training". Der Plan hier enthält nur die '
        + 'vier Mahlzeiten.'));
    }

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
 * Wonach sortiert ist, samt den Zahlen dazu.
 *
 * „Sortiert ist nach dieser Dichte: Kohlenhydrate und Fett kommen beim
 * normalen Essen von allein zusammen" stand hier, bis der Tagesplan an harten
 * Tagen fast immer unter dem eigenen Kohlenhydratkorridor lag (Falle 108).
 * Sortiert wird jetzt nach Protein **und** Kohlenhydraten, und der Satz nennt
 * beide. Was schon gedeckt ist, bekommt keine Prozentzahl – ein negativer
 * Rest ergibt keinen Energieanteil, und „−34 % der Energie aus Protein" ist
 * keine Auskunft (Falle 10).
 */
function sortierSatz(e) {
  const offen = [`${zahl(e.restKcal)} kcal`];
  const anteile = [];
  const gedeckt = [];
  if (e.proteinGedeckt) gedeckt.push('Protein');
  else {
    offen.push(`${zahl(e.restProtein)} g Protein`);
    anteile.push(`${Math.round(e.zielDichte * 100)} % aus Protein`);
  }
  if (e.zielKohlenhydrate != null) {
    if (e.restKohlenhydrate <= 0) gedeckt.push('Kohlenhydraten');
    else {
      offen.push(`${zahl(e.restKohlenhydrate)} g Kohlenhydrate`);
      anteile.push(`${Math.round(e.zielKohlenhydrate * 100)} % aus Kohlenhydraten`);
    }
  }
  const und = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} und ${xs.at(-1)}` : xs[0]);
  const bei = { Protein: 'Protein', Kohlenhydraten: 'den Kohlenhydraten' };
  return `Offen sind ${und(offen)}`
    + (anteile.length ? ` – von der Energie also ${und(anteile)}.` : '.')
    + (gedeckt.length === 2 ? ' Bei Protein und Kohlenhydraten ist das Ziel schon erreicht.'
      : gedeckt.length ? ` ${gedeckt[0] === 'Protein' ? 'Beim' : 'Bei'} ${bei[gedeckt[0]]} ist das Ziel `
        + 'schon erreicht.' : '')
    + (e.zielKohlenhydrate != null
      ? ' Sortiert ist danach, wie nah ein Gericht an dieser Verteilung liegt; das Fett ist der Rest.'
      : ' Sortiert ist nach der Proteindichte.');
}

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

  // Mit den Kohlenhydraten: Sortiert wird nach der Zusammensetzung, und
  // ohne sie zählte wie früher allein das Protein (Falle 108).
  const rest = {
    kcal: h.bilanz.kcal.rest,
    protein: h.bilanz.protein.rest,
    kohlenhydrate: h.bilanz.kohlenhydrate.rest,
  };
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
    // Das Budget läuft mit wie im Tagesplan darüber: das Offene, geteilt
    // durch die Mahlzeiten, die heute noch ausstehen – nicht ein festes
    // Viertel des Tagesziels, das auch die letzte Mahlzeit deckelte
    // (Falle 108).
    const budget = mahlzeitBudget(rest.kcal, h.essen, h.mahlzeiten?.kcalJe);
    const ergebnis = gerichtVorschlaege(katalog.gerichte, katalog.lebensmittel, {
      rest,
      mahlzeitKcal: budget.kcal,
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
    teile.push(el('p', { class: 'mini' }, sortierSatz(ergebnis)));

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

    // Der Satz nennt die Grenze, gegen die tatsächlich gerechnet wird. Vorher
    // behauptete er „unter dem, was noch offen ist", während ein festes
    // Viertel des Tagesziels deckelte – anderthalb und doppelt hätten beim
    // Abendessen oft noch gepasst (Falle 108).
    teile.push(el('p', { class: 'mini' },
      'Halbe, ganze, anderthalbe oder doppelte Portion – Küchenpraxis, keine Studienlage. '
      + {
        geteilt: `Genommen wird die größte Portion unter ~${zahl(budget.kcal)} kcal: dem `
          + `Offenen, verteilt auf die ${budget.offeneMahlzeiten} Mahlzeiten, die heute noch `
          + 'ausstehen.',
        mahlzeit: `Genommen wird die größte Portion unter ~${zahl(budget.kcal)} kcal, der `
          + 'Größe einer Mahlzeit im Tagesplan.',
        rest: 'Genommen wird die größte Portion, die unter dem bleibt, was noch offen ist.',
      }[budget.grundlage]));

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

function vorschlagZeile(v, gewaehlteMahlzeit, bezug = 'offen') {
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
  //
  // Im Tagesplan ist der Bezug das Tagesziel, nicht das Offene: Der Plan
  // rechnet ausdrücklich gegen den ganzen Tag. Dort stand trotzdem „der
  // offenen Kalorien" – eine Zahl, die etwas anderes zählte als ihre
  // Aufschrift (Falle 15).
  const deckung = bezug === 'tag'
    ? [`deckt ${v.deckung.kcal} % der Kalorien des Tagesziels`]
    : [`deckt ${v.deckung.kcal} % der offenen Kalorien`];
  if (v.deckung.protein != null) {
    deckung.push(bezug === 'tag' ? `${v.deckung.protein} % des Proteins`
      : `${v.deckung.protein} % des offenen Proteins`);
  }
  details.append(el('p', { class: 'mini' }, deckung.join(' und ')));

  if (v.ueberZiel) {
    details.append(hinweis(
      (bezug === 'tag' ? 'Auch die kleinste Portion liegt über dem Tagesziel. '
        : 'Auch die kleinste Portion liegt über dem, was heute noch offen ist. ')
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
              // Auf den **angesehenen** Tag, nicht auf das echte Heute. Ohne
              // das landete jeder Eintrag auf dem Kalendertag, während die
              // Ansicht den zurückgeblätterten Tag zeigt und ihre Liste
              // „Heute gegessen" nennt – der Eintrag erschien schlicht nicht,
              // und beide Tagesbilanzen waren falsch. `checkSpeichern()` und
              // `sessionAnlegen()` machen es seit jeher richtig.
              datum: zustand.datum,
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
    /*
     * Der Trainingsumsatz ist an Trainingstagen die größte der drei Zahlen –
     * und war die einzige ohne jede Herkunft: Der Grundumsatz nennt seine
     * Formel, der Alltagsfaktor trägt seinen Vorbehalt seit Falle 62 im
     * Profil. Die MET-Werte trugen nirgends etwas, obwohl sie bewusst
     * heruntergesetzte Schätzungen sind und nicht Tabellenwerte für die
     * Belastungsphase (Falle 5).
     */
    inhalt.append(el('p', { class: 'mini' },
      'Der Trainingsanteil ist geschätzt: Die zugrunde liegenden MET-Werte sind gängige '
      + 'Praxis, keine Messgröße. Sie gelten für die ganze Einheit – eine '
      + 'Sprinteinheit besteht zu neun Zehnteln aus Stehen und Gehen. Bewusst eher zu '
      + 'niedrig angesetzt: Zu viel gerechnet heißt hier täglich zu viel gegessen.'));
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

    for (const e of eintraege) box.append(essenZeile(e));
  }

  const sonstige = h.essen.filter((e) => !MAHLZEITEN.some(([s]) => s === e.mahlzeit));
  for (const e of sonstige) box.append(essenZeile(e));

  return box;
}

/**
 * Eine Zeile des Ernährungstagebuchs.
 *
 * Sie stand zweimal da – einmal für die vier Mahlzeiten, einmal für alles
 * andere – und war schon abgewichen: Die zweite Fassung zeigte die Makros
 * nicht. Zwei Herleitungen derselben Zeile, Falle 13, und beim Anbauen des
 * „Ändern" hätte man sie ein drittes Mal geschrieben.
 */
function essenZeile(e) {
  const faktor = Number(e.mengeG) / 100;
  return el('div', { class: 'zeile' },
    el('div', { class: 'zeile-text' },
      el('div', { class: 'zeile-titel' }, e.name),
      faktor > 0
        // Die drei Makros zusammenhalten: Neben dem „Ändern"-Knopf ist die
        // Zeile 179 statt 275 px breit und bricht um – ohne Klammer mitten
        // in „14 P / 59 | KH / 7 F". Die Zeilenhöhe kostet das nichts (der
        // Knopf gibt ohnehin 44 px vor), es liest sich nur richtig herum.
        ? el('div', { class: 'zeile-meta' },
          `${zahl(e.mengeG)} g · ${zahl(e.kcal * faktor)} kcal · `,
          el('span', { style: { whiteSpace: 'nowrap' } },
            `${zahl(e.protein * faktor)} P / ${zahl(e.kohlenhydrate * faktor)} KH / `
            + `${zahl(e.fett * faktor)} F`))
        // Der Grund gehört an die Stelle, an der das Ergebnis fehlt
        // (Falle 22) – samt dem, was dagegen hilft. Der Rat lautete
        // „Löschen und neu eintragen", weil es das Ändern nicht gab.
        : el('div', { class: 'zeile-meta' },
          'Ohne Menge – zählt nicht in die Summe. Über „Ändern" nachtragen.')),
    el('button', { class: 'knopf leise', onclick: () => eintragDialog(e) }, 'Ändern'),
    el('button', {
      class: 'knopf leise gefahr',
      onclick: async () => {
        try {
          await daten.essenLoeschen(e.id);
          aktualisieren();
        } catch (err) { toast(err.message, 'fehler'); }
      },
    }, '×'));
}

/**
 * Einen Eintrag im Tagebuch korrigieren.
 *
 * Der häufigste Fall ist die Menge – und bis hierher gab es dafür nur
 * Löschen und sechs Felder neu eintragen. Der Kommentar beim Eintragen eines
 * ganzen Gerichts versprach das Gegenteil: „so lässt sich hinterher eine
 * davon löschen oder ändern". Die Nährwerte stehen mit dabei, weil ein
 * eigenes Lebensmittel auch dort einen Vertipper haben kann; sie gelten wie
 * überall je 100 g.
 */
function eintragDialog(e) {
  const name = el('input', { type: 'text', value: e.name });
  // Rohe Zahlen, nicht `zahlText()`: `dezimalFeld` germanisiert selbst, und
  // zwar über ein `replace('.', ',')`. Eine bereits formatierte „2.800" wird
  // dadurch zu „2,800" und beim Speichern zu 2,8 – tausendfach daneben, ohne
  // eine Meldung. Stand hier im ersten Wurf und ist am Gerät aufgefallen.
  const mengeFeld = dezimalFeld({ value: e.mengeG });
  const kcal = dezimalFeld({ value: e.kcal });
  const protein = dezimalFeld({ value: e.protein });
  const kh = dezimalFeld({ value: e.kohlenhydrate });
  const fett = dezimalFeld({ value: e.fett });
  const mahlzeit = el('select', {}, ...MAHLZEITEN.map(([w, n]) =>
    el('option', { value: w, selected: e.mahlzeit === w }, n)));

  const vorschau = el('div', { class: 'klein' });
  function aktualisiereVorschau() {
    const f = (zahlAusEingabe(mengeFeld.value) ?? 0) / 100;
    const w = (feldWert) => (zahlAusEingabe(feldWert.value) ?? 0) * f;
    vorschau.textContent = `${zahl(w(kcal))} kcal · ${zahl(w(protein), 1)} g Protein · `
      + `${zahl(w(kh), 1)} g KH · ${zahl(w(fett), 1)} g Fett`;
  }
  for (const f of [mengeFeld, kcal, protein, kh, fett]) f.addEventListener('input', aktualisiereVorschau);
  aktualisiereVorschau();

  dialog(el('div', {},
    el('h2', {}, 'Eintrag ändern'),
    feld('Name', name),
    el('div', { class: 'felder' },
      feld('Menge in Gramm', mengeFeld),
      feld('Mahlzeit', mahlzeit)),
    el('div', { class: 'felder' },
      feld('kcal / 100 g', kcal),
      feld('Protein / 100 g', protein)),
    el('div', { class: 'felder' },
      feld('Kohlenhydrate / 100 g', kh),
      feld('Fett / 100 g', fett)),
    vorschau,
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf haupt',
        onclick: async () => {
          try {
            // Roh weiterreichen – das Komma liest nur `kern/aendern.js`
            // richtig (Falle 14).
            await daten.essenAendern(e.id, {
              name: name.value.trim(),
              mengeG: mengeFeld.value,
              mahlzeit: mahlzeit.value,
              kcal: kcal.value,
              protein: protein.value,
              kohlenhydrate: kh.value,
              fett: fett.value,
            });
            dialogSchliessen();
            toast('Geändert.', 'gut');
            aktualisieren();
          } catch (err) { toast(err.message, 'fehler'); }
        },
      }, 'Speichern'),
      el('button', { class: 'knopf leise', onclick: dialogSchliessen }, 'Abbrechen'))));
  mengeFeld.select();
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
              datum: zustand.datum,
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
              datum: zustand.datum,
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
