// Gerichtevorschläge: was passt zu dem, was heute noch fehlt?
//
// Der Tracker rechnet aus, wie viel Protein, Kohlenhydrate und Fett am Tag
// noch offen sind. Das beantwortet aber nicht die Frage, die man abends um
// sieben tatsächlich hat: **was koche ich jetzt?**
//
// **Die tragende Entscheidung:** Ein Gericht bringt keine eigenen Nährwerte
// mit. Es besteht aus Zutaten der Lebensmitteltabelle und einer Menge in
// Gramm; die Nährwerte rechnet `naehrwerte()` daraus aus. Sonst gäbe es zwei
// Nährwertquellen im Projekt, und die zweite läuft irgendwann auseinander –
// dieselbe Falle wie die abgeschriebenen Kraftmarken (Falle 21) und die
// doppelt gerechnete Mahlzeitensumme (Falle 60).
//
// Reines Rechnen, kein Netzwerk, kein Dateizugriff: Beide Tabellen kommen als
// Argument herein.

import { round } from './profil.js';
import { GERICHTE } from './wissen.js';
import { menge, zahlText } from './regeln.js';

/** Nährwerte je 100 g, nach Namen aufgeschlagen. */
function tabelle(lebensmittel = []) {
  const karte = new Map();
  for (const l of lebensmittel) if (l?.name) karte.set(l.name, l);
  return karte;
}

/**
 * Die Zutatenliste eines Gerichts in der Menge, die vorgeschlagen wird.
 *
 * Gerundet, weil eine Küchenwaage zwar Gramm zeigt, aber niemand 137 g Quark
 * abwiegt. **Diese gerundete Menge ist danach die einzige Grundlage** – auch
 * für die Nährwerte. Andernfalls stünden Zutatenliste und Nährwertzeile für
 * dieselbe Portion (Falle 13), und die Abweichung wüchse mit jeder Zutat.
 *
 * Die Nährwerte je 100 g wandern mit. Wer das Gericht ins Tagebuch schreibt,
 * trägt damit genau die Werte ein, mit denen hier gerechnet wurde; ein
 * zweites Nachschlagen in der Oberfläche wäre die Gelegenheit, anders
 * nachzuschlagen.
 */
export function zutatenMitMenge(gericht, lebensmittel = [], faktor = 1) {
  const karte = tabelle(lebensmittel);
  const stufe = GERICHTE.rundungGramm;
  return (gericht?.zutaten || []).map(([name, gramm]) => ({
    name,
    mengeG: Math.max(stufe, Math.round((Number(gramm) || 0) * faktor / stufe) * stufe),
    je100: karte.get(name) || null,
  }));
}

/**
 * Nährwerte aus einer aufgelösten Zutatenliste.
 *
 * `fehlend` nennt Zutaten, die in der Tabelle nicht stehen. Ein Gericht mit
 * einer unbekannten Zutat wird **nicht** stillschweigend leichter, sondern
 * fällt aus dem Vorschlag heraus und sagt warum (Falle 22). Im ausgelieferten
 * Bestand kann das nicht vorkommen – ein Test hält jede Zutat gegen die
 * Tabelle –, aber ein Gericht ohne Nährwerte wäre die Sorte Fehler, die man
 * erst Wochen später an einer krummen Tagesbilanz bemerkt.
 */
export function naehrwerteAus(zutaten = []) {
  const summe = { kcal: 0, protein: 0, kohlenhydrate: 0, fett: 0 };
  const fehlend = [];

  for (const { name, mengeG, je100 } of zutaten) {
    if (!je100) { fehlend.push(name); continue; }
    const anteil = (Number(mengeG) || 0) / 100;
    summe.kcal += (Number(je100.kcal) || 0) * anteil;
    summe.protein += (Number(je100.protein) || 0) * anteil;
    summe.kohlenhydrate += (Number(je100.kohlenhydrate) || 0) * anteil;
    summe.fett += (Number(je100.fett) || 0) * anteil;
  }

  return {
    kcal: Math.round(summe.kcal),
    protein: Math.round(summe.protein),
    kohlenhydrate: Math.round(summe.kohlenhydrate),
    fett: Math.round(summe.fett),
    fehlend,
  };
}

/** Eine Portion eines Gerichts: Zutaten und Nährwerte aus einer Herleitung. */
export function portion(gericht, lebensmittel = [], faktor = 1) {
  const zutaten = zutatenMitMenge(gericht, lebensmittel, faktor);
  return { faktor, zutaten, ...naehrwerteAus(zutaten) };
}

/**
 * Wie gut passt ein Gericht zu dem, was am Tag noch offen ist?
 *
 * Bewertet wird die **Proteindichte** – der Anteil der Energie, der aus
 * Protein kommt. Der Grund: Von den drei Makros ist Protein das, dessen Ziel
 * man verfehlt, wenn man nicht darauf achtet; Kohlenhydrate und Fett füllen
 * sich beim normalen Essen von allein. Braucht der Rest des Tages 80 g
 * Protein bei 900 kcal, sind das 36 % der Energie – ein Gericht mit ähnlicher
 * Dichte bringt den Tag ins Ziel, eines mit 12 % nicht.
 *
 * Bewusst **kein** Punktesystem aus mehreren gewichteten Kriterien: Die
 * Gewichte wären erfunden, und das Ergebnis sähe genauer aus, als es ist.
 * Eine Kennzahl, die man in einem Satz erklären kann, ist hier mehr wert.
 */
export function proteinAnteil({ kcal, protein }) {
  const k = Number(kcal) || 0;
  if (k <= 0) return null;
  return round(((Number(protein) || 0) * 4) / k, 3);
}

/**
 * Welche Portionsgröße passt zu dem Ziel?
 *
 * **Zwei Regeln, weil es zwei verschiedene Fragen sind:**
 *
 * `darunter` (Vorgabe) nimmt die größte Portion, die unter dem Ziel bleibt.
 * Das ist richtig, wenn gegen den **Rest eines laufenden Tages** gerechnet
 * wird: Wer noch Hunger hat, isst nach; wer schon drüber ist, kann nichts
 * mehr rückgängig machen.
 *
 * `treffen` nimmt die Portion, die dem Ziel am nächsten kommt – auch wenn sie
 * darüber liegt. Das ist richtig für einen **Tagesplan**, der noch gar nicht
 * stattgefunden hat: Dort zählt die Summe der vier Mahlzeiten, und mit der
 * ersten Regel bleibt sie systematisch darunter. Gemessen an Nils' Vorgabe
 * kam ein Tag so auf 1.875 statt 2.722 kcal – ein Vorschlag, der zum
 * Unteressen rät, und das ausgerechnet in einem Tracker, der an anderer
 * Stelle vor zu geringer Energieverfügbarkeit warnt.
 *
 * Kein gewichteter Abstand in beiden Fällen: Wie viel schwerer ein Überschuss
 * wiegt als ein Rest, wäre eine erfundene Zahl und stünde nirgends in
 * `wissen.js`.
 *
 * Passt nicht einmal die kleinste Portion in den Tagesrest, kommt sie
 * trotzdem zurück, aber mit `ueberZiel`. Der Tracker verbietet nichts – er
 * sagt, was der Vorschlag kostet.
 */
export function portionsFaktor(gericht, lebensmittel = [], zielKcal, restKcal = zielKcal,
  { treffen = false } = {}) {
  const ziel = Number(zielKcal) || 0;
  const stufen = [...GERICHTE.portionen].sort((a, b) => a - b);
  const kleinste = stufen[0];

  let gewaehlt = null;
  if (treffen) {
    let abstand = Infinity;
    for (const f of stufen) {
      const d = Math.abs(portion(gericht, lebensmittel, f).kcal - ziel);
      if (d < abstand) { abstand = d; gewaehlt = f; }
    }
  } else {
    for (const f of stufen) {
      if (portion(gericht, lebensmittel, f).kcal <= ziel) gewaehlt = f;
    }
  }

  const faktor = gewaehlt ?? kleinste;
  return {
    faktor,
    ueberZiel: portion(gericht, lebensmittel, faktor).kcal > (Number(restKcal) || 0),
  };
}

/**
 * Aufschriften zu den Stufen aus `GERICHTE.portionen`.
 *
 * Zwei Listen für dieselbe Sache (Falle 13) – deshalb verlangt ein Test zu
 * jeder Stufe eine Aufschrift. Ohne ihn wäre der Rückfall darunter der
 * stille Weg: Er lieferte `${0.75} Portionen`, also **„0.75 Portionen"** mit
 * englischem Dezimalpunkt (Falle 56) und ohne Beugung (Falle 12) – und zwar
 * erst dann, wenn jemand eine Stufe ergänzt. Ein Zweig, den niemand nimmt,
 * altert genauso still wie eine Zahl, die niemand liest (Falle 58).
 */
const PORTIONS_TEXT = {
  0.5: 'halbe Portion',
  1: 'eine Portion',
  1.5: 'anderthalb Portionen',
  2: 'doppelte Portion',
};

export function portionsText(faktor) {
  return PORTIONS_TEXT[faktor] || menge(zahlText(faktor, 2), 'Portion', 'Portionen');
}

/** Ohne Fleisch und Fisch – die Auswahl, die jemand tatsächlich trifft. */
export function istFleischlos(gericht) {
  return gericht?.art === 'vegetarisch' || gericht?.art === 'vegan';
}

/**
 * Warum die Liste leer ist.
 *
 * „Kein Gericht im Vorrat" wäre bei angehakter Einschränkung eine Auskunft
 * über den Katalog, wo eine über die Auswahl gemeint ist – und der Hebel
 * (Häkchen wieder weg) bliebe unausgesprochen. Falle 22, in klein.
 */
function nichtsGefunden(einschraenkungen = []) {
  return einschraenkungen.length
    ? `Kein Gericht passt zu dieser Auswahl (${einschraenkungen.join(', ')}). `
      + 'Eine Einschränkung weniger, und es steht wieder etwas da.'
    : 'Für diese Mahlzeit steht noch kein Gericht im Vorrat.';
}

/**
 * Vorschläge für die nächste Mahlzeit.
 *
 * `rest` sind die offenen Tagesmengen aus `bilanz()`. Ist nichts mehr offen,
 * kommt **kein** Vorschlag zurück, sondern der Grund – ein Tracker, der zum
 * Nachlegen rät, obwohl das Ziel erreicht ist, wäre schlicht falsch.
 *
 * `mahlzeitKcal` ist die Kalorienmenge **einer** Mahlzeit aus
 * `mahlzeitenplan()`. Ohne sie zielte der Vorschlag auf den ganzen Tagesrest –
 * bei 1.400 offenen Kalorien am frühen Nachmittag also auf ein Abendessen, das
 * den Tag in einem Zug abschließt. Die Zahl ist keine neue: Sie folgt aus den
 * vier bis fünf Portionen, mit denen der Tracker ohnehin plant
 * (Schoenfeld 2018).
 */
export function gerichtVorschlaege(gerichte = [], lebensmittel = [], {
  rest = {}, mahlzeitKcal = null, mahlzeit = null, anzahl = 3, trainingstag = true,
  fleischlos = false, hoechstensMinuten = null, portionTrifft = false,
} = {}) {
  const restKcal = Math.round(Number(rest.kcal) || 0);
  const restProtein = Math.round(Number(rest.protein) || 0);

  if (restKcal <= 0) {
    return {
      vorschlaege: [],
      restKcal,
      restProtein,
      zielDichte: null,
      proteinGedeckt: restProtein <= 0,
      grund: restProtein > 0
        ? `Das Kalorienziel ist erreicht, ${restProtein} g Protein fehlen noch. `
          + 'Etwas sehr Mageres – Magerquark, Harzer Käse, Eiklar – bringt das Protein, '
          + 'ohne den Tag weiter aufzuladen.'
        : 'Für heute ist alles abgedeckt. Ein Vorschlag wäre hier nur eine Einladung, '
          + 'über das Ziel zu essen.',
    };
  }

  // Ziel für eine Portion: eine Mahlzeit – oder der Tagesrest, wenn davon
  // weniger übrig ist als eine Mahlzeit ausmacht.
  const ziel = mahlzeitKcal > 0 ? Math.min(restKcal, Math.round(mahlzeitKcal)) : restKcal;

  /*
   * Die Dichte, die der Rest des Tages braucht.
   *
   * **Der Anschlag bei null ist keine Kosmetik.** Steht das Protein schon über
   * dem Ziel, ist der Rest negativ – und damit auch die Dichte: In der Karte
   * stand „−36 g Protein – das sind −34 % der Energie aus Protein", eine
   * Angabe, die es nicht gibt. Gemeint ist etwas Einfaches: Am Protein ist
   * nichts mehr zu holen, gesucht sind die übrigen Kalorien. Genau das sagt
   * die Zieldichte 0, und die Rangfolge danach stimmt weiterhin.
   */
  const proteinGedeckt = restProtein <= 0;
  const zielDichte = proteinAnteil({ kcal: restKcal, protein: Math.max(0, restProtein) });

  const einschraenkungen = [
    fleischlos ? 'fleischlos' : null,
    hoechstensMinuten > 0 ? `höchstens ${hoechstensMinuten} min` : null,
  ].filter(Boolean);

  const passend = gerichte.filter((g) => {
    // Ausdrücklich Gewähltes bindet immer, auch bei der Mahlzeit: Wer
    // „vegetarisch" anhakt, will keine Ausnahme, sondern eine Auswahl.
    if (fleischlos && !istFleischlos(g)) return false;
    if (hoechstensMinuten > 0 && g.minuten > hoechstensMinuten) return false;
    if (mahlzeit) return g.mahlzeit === mahlzeit;
    // Ohne Training am Tag fällt die Trainingsverpflegung heraus. „Vor dem
    // Sprint: Datteln" über einem Ruhetag ist kein Vorschlag, sondern ein
    // Hinweis darauf, dass die Karte den Tag nicht kennt. Wer die Mahlzeit
    // ausdrücklich wählt, bekommt sie trotzdem – der Tracker verbietet nichts.
    if (!trainingstag && g.mahlzeit === 'umsTraining') return false;
    return true;
  });
  const bewertet = [];

  for (const g of passend) {
    const { faktor, ueberZiel } = portionsFaktor(g, lebensmittel, ziel, restKcal,
      { treffen: portionTrifft });
    const p = portion(g, lebensmittel, faktor);
    // Ein Gericht mit unbekannter Zutat hätte falsche Nährwerte. Lieber
    // weglassen als danebenliegen – und der Test oben verhindert den Fall.
    if (p.fehlend.length || !p.kcal) continue;

    const dichte = proteinAnteil(p);
    bewertet.push({
      gericht: g,
      faktor,
      ueberZiel,
      portion: portionsText(faktor),
      naehrwerte: { kcal: p.kcal, protein: p.protein, kohlenhydrate: p.kohlenhydrate, fett: p.fett },
      fleischlos: istFleischlos(g),
      zutaten: p.zutaten,
      proteinAnteil: dichte,
      // Wie viel des Offenen deckt der Vorschlag? Zwei Zahlen, die man
      // nachrechnen kann – statt einer Punktzahl, die niemand einordnen kann.
      deckung: {
        kcal: Math.round((p.kcal / restKcal) * 100),
        protein: restProtein > 0 ? Math.round((p.protein / restProtein) * 100) : null,
      },
      abstand: zielDichte == null ? 0 : Math.abs((dichte ?? 0) - zielDichte),
    });
  }

  // Bei gleichem Abstand entscheidet der Name – sonst schriebe ein Test die
  // Reihenfolge fest, in der die Gerichte zufällig in der Datei stehen
  // (Falle 63).
  bewertet.sort((a, b) => a.abstand - b.abstand
    || a.gericht.name.localeCompare(b.gericht.name, 'de'));

  return {
    vorschlaege: bewertet.slice(0, anzahl),
    // Wie viele Gerichte überhaupt passen – nicht wie viele gezeigt werden.
    // Ohne diese Zahl weiß die Oberfläche nicht, ob es sich lohnt, einen
    // „weitere anzeigen"-Knopf hinzustellen; und ein Knopf, hinter dem nichts
    // mehr kommt, ist ein Weg ohne Wirkung (Falle 45).
    gefunden: bewertet.length,
    restKcal,
    restProtein,
    zielKcal: ziel,
    zielDichte,
    proteinGedeckt,
    grund: bewertet.length ? null : nichtsGefunden(einschraenkungen),
  };
}

/* --------------------------------------------------------- Der ganze Tag */

/**
 * Die Mahlzeiten, aus denen ein Tagesvorschlag besteht.
 *
 * **Ihre Zahl ist keine neue Entscheidung.** Der Tracker plant den Tag ohnehin
 * über `ERNAEHRUNG.mahlzeitenProTag` Portionen – vier bis fünf à ~0,4 g/kg
 * nutzen die Muskelproteinsynthese besser als zwei große (Schoenfeld 2018).
 * Diese Liste bricht das nur auf Namen herunter. Weicht sie in der Länge ab,
 * gibt es zwei Zahlen für dieselbe Sache (Falle 13); ein Test verbietet das.
 *
 * „Ums Training" steht bewusst nicht dabei: Der Kalorienbedarf des Tages
 * enthält das Training schon, und eine fünfte Mahlzeit würde das Budget der
 * anderen vier kürzen, ohne dass irgendwo mehr Energie herkommt. Was rund um
 * die Einheit sinnvoll ist, beantwortet die Karte „Rund ums Training".
 */
export const TAGESPLAN_MAHLZEITEN = ['fruehstueck', 'mittag', 'abend', 'snack'];

/**
 * In welcher Reihenfolge geplant wird – nicht, in welcher es dasteht.
 *
 * Das Budget läuft mit (siehe unten), also schließt die letzte Mahlzeit den
 * Tag ab und muss auffangen, was die anderen offen gelassen haben. Dafür
 * taugt das Abendessen am besten: Es hat im Katalog die größte Spanne, vom
 * Salat bis zum Chili. Der Snack als Letzter kann einen Rest von 900 kcal
 * nicht mehr füllen.
 *
 * **Gemessen, nicht vermutet:** Über sieben Kalorienziele, acht Varianten und
 * beide Filterstellungen (112 Tage) fällt die größte Abweichung vom Tagesziel
 * von **21 % auf 10 %**, das 90. Perzentil von 10 % auf 7 %. Angezeigt wird
 * weiter in der Reihenfolge des Tages – man liest einen Speiseplan von morgens
 * nach abends.
 */
const PLANUNGSFOLGE = ['fruehstueck', 'mittag', 'snack', 'abend'];

/**
 * Ein ganzer Tag: Frühstück, Mittag, Abendessen und ein Snack.
 *
 * Die Gegenfrage zu `gerichtVorschlaege()`. Die dortige Karte beantwortet
 * „was passt **jetzt** noch?" und rechnet gegen den Rest des Tages; hier geht
 * es um „so könnte der Tag **aussehen**", also gegen das volle Tagesziel. Wer
 * schon gegessen hat, bekommt trotzdem den ganzen Tag vorgeschlagen – das ist
 * ein Speiseplan und keine Buchhaltung. Die Oberfläche sagt das dazu.
 *
 * Gewählt wird je Mahlzeit nach derselben einen Kennzahl wie sonst: der
 * Proteindichte, die der Tag braucht. Kein zweites Verfahren daneben, und
 * keine Gewichte, die niemand herleiten kann. Das Kalorienbudget einer
 * Mahlzeit ist schlicht das Tagesziel geteilt durch die Zahl der Mahlzeiten.
 *
 * `variante` blättert durch: 0 nimmt überall die beste Wahl, 1 überall die
 * zweitbeste. Deterministisch statt zufällig – wer zweimal dasselbe tippt,
 * soll zweimal dasselbe sehen.
 */
export function tagesvorschlag(gerichte = [], lebensmittel = [], {
  kcal, protein, variante = 0, fleischlos = false, hoechstensMinuten = null,
} = {}) {
  const zielKcal = Math.round(Number(kcal) || 0);
  const zielProtein = Math.round(Number(protein) || 0);

  if (zielKcal <= 0) {
    return {
      mahlzeiten: [],
      grund: 'Für einen Tagesvorschlag fehlen die Zielwerte – dafür braucht das '
        + 'Profil Gewicht, Größe und Geburtsjahr.',
    };
  }

  const gewaehlt = [];
  let varianten = Infinity;
  let verbraucht = 0;

  for (const [i, mahlzeit] of PLANUNGSFOLGE.entries()) {
    /*
     * Das Budget läuft mit: Was die vorigen Mahlzeiten übrig gelassen haben,
     * verteilt sich auf die verbleibenden.
     *
     * Mit einem festen Viertel je Mahlzeit blieb die Summe systematisch unter
     * dem Ziel – bei 3.400 kcal um 18 %, weil die Portionsleiter bei der
     * doppelten Portion endet und ein einzelnes Gericht das Viertel dann gar
     * nicht füllen kann. Der mitlaufende Rest holt das zurück, ohne dass
     * dafür eine neue Zahl nötig wäre: Es ist dieselbe Division durch die
     * Zahl der Mahlzeiten, nur jedes Mal neu.
     */
    const offen = zielKcal - verbraucht;
    const budgetJetzt = Math.max(1, Math.round(offen / (PLANUNGSFOLGE.length - i)));
    const ergebnis = gerichtVorschlaege(gerichte, lebensmittel, {
      rest: { kcal: zielKcal, protein: zielProtein },
      mahlzeitKcal: budgetJetzt,
      mahlzeit,
      fleischlos,
      hoechstensMinuten,
      anzahl: variante + 1,
      // Ein Tagesplan soll das Budget treffen, nicht darunter bleiben –
      // siehe die Begründung an `portionsFaktor`.
      portionTrifft: true,
    });
    if (!ergebnis.vorschlaege.length) {
      return { mahlzeiten: [], grund: ergebnis.grund };
    }
    varianten = Math.min(varianten, ergebnis.gefunden);
    // Hat eine Mahlzeit weniger Gerichte als die Variante hoch ist, bleibt sie
    // bei ihrem letzten – sonst fiele der ganze Tag aus, weil es zu einer
    // Mahlzeit nur zwei Gerichte gibt.
    const rang = Math.min(variante, ergebnis.vorschlaege.length - 1);
    const gewaehltes = ergebnis.vorschlaege[rang];
    verbraucht += gewaehltes.naehrwerte.kcal;
    gewaehlt.push({ mahlzeit, ...gewaehltes });
  }

  // Zurück in die Reihenfolge des Tages: Geplant wird mit dem Abendessen
  // zuletzt, gelesen wird von morgens nach abends.
  gewaehlt.sort((a, b) => TAGESPLAN_MAHLZEITEN.indexOf(a.mahlzeit)
    - TAGESPLAN_MAHLZEITEN.indexOf(b.mahlzeit));

  const summe = gewaehlt.reduce((s, v) => ({
    kcal: s.kcal + v.naehrwerte.kcal,
    protein: s.protein + v.naehrwerte.protein,
    kohlenhydrate: s.kohlenhydrate + v.naehrwerte.kohlenhydrate,
    fett: s.fett + v.naehrwerte.fett,
  }), { kcal: 0, protein: 0, kohlenhydrate: 0, fett: 0 });

  return {
    mahlzeiten: gewaehlt,
    summe,
    ziel: { kcal: zielKcal, protein: zielProtein },
    // Die Abweichung steht mit Vorzeichen da. Ein Vorschlag, der 200 kcal
    // unter dem Ziel liegt, ist etwas anderes als einer, der 200 darüber
    // liegt – und beides ist etwas anderes als „passt".
    abweichung: { kcal: summe.kcal - zielKcal, protein: summe.protein - zielProtein },
    varianten: Number.isFinite(varianten) ? varianten : 0,
    grund: null,
  };
}
