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
 * Welche Portionsgröße passt in das, was noch offen ist?
 *
 * Genommen wird die **größte Portion, die unter dem Ziel bleibt**. Kein
 * gewichteter Abstand: Wie viel schwerer ein Überschuss wiegt als ein Rest,
 * wäre eine erfundene Zahl, und sie stünde nirgends in `wissen.js`. Die Regel
 * dagegen lässt sich in einem Satz sagen – wer noch Hunger hat, isst nach; wer
 * schon drüber ist, kann nichts mehr rückgängig machen.
 *
 * Passt nicht einmal die kleinste Portion in den Tagesrest, kommt sie
 * trotzdem zurück, aber mit `ueberZiel`. Der Tracker verbietet nichts – er
 * sagt, was der Vorschlag kostet.
 */
export function portionsFaktor(gericht, lebensmittel = [], zielKcal, restKcal = zielKcal) {
  const ziel = Number(zielKcal) || 0;
  const stufen = [...GERICHTE.portionen].sort((a, b) => a - b);
  const kleinste = stufen[0];

  let gewaehlt = null;
  for (const f of stufen) {
    if (portion(gericht, lebensmittel, f).kcal <= ziel) gewaehlt = f;
  }

  const faktor = gewaehlt ?? kleinste;
  return {
    faktor,
    ueberZiel: gewaehlt == null
      && portion(gericht, lebensmittel, faktor).kcal > (Number(restKcal) || 0),
  };
}

const PORTIONS_TEXT = {
  0.5: 'halbe Portion',
  1: 'eine Portion',
  1.5: 'anderthalb Portionen',
  2: 'doppelte Portion',
};

export function portionsText(faktor) {
  return PORTIONS_TEXT[faktor] || `${faktor} Portionen`;
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

export function gerichtVorschlaege(gerichte = [], lebensmittel = [], {
  rest = {}, mahlzeitKcal = null, mahlzeit = null, anzahl = 3, trainingstag = true,
  fleischlos = false, hoechstensMinuten = null,
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
    const { faktor, ueberZiel } = portionsFaktor(g, lebensmittel, ziel, restKcal);
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
    restKcal,
    restProtein,
    zielKcal: ziel,
    zielDichte,
    proteinGedeckt,
    grund: bewertet.length ? null : nichtsGefunden(einschraenkungen),
  };
}
