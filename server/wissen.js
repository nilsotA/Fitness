// Evidenzbasis des Trackers.
//
// Jede Zahl, die der Planer oder der Ernährungsrechner ausspuckt, kommt aus
// diesem Modul – und jede trägt hier ihre Quelle. Wer wissen will, warum das
// Tool 1,9 g Eiweiß pro Kilo vorschlägt und nicht 3, findet die Antwort an
// genau einer Stelle statt verstreut im Code.
//
// Bewertung der Belege:
//   'stark'   – Meta-Analysen oder Positionspapiere von Fachgesellschaften
//   'solide'  – einzelne kontrollierte Studien, konsistente Übersichtsarbeiten
//   'praxis'  – Trainerkonsens ohne harte Studienlage; als solcher gekennzeichnet

export const QUELLEN = {
  morton2018: {
    kurz: 'Morton et al. 2018, Br J Sports Med',
    titel: 'Systematic review, meta-analysis and meta-regression of protein supplementation',
    kern: 'Zuwachs an fettfreier Masse plateaut bei ~1,62 g Protein/kg/Tag (95 %-KI 1,03–2,20).',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
  },
  wilson2012: {
    kurz: 'Wilson et al. 2012, J Strength Cond Res',
    titel: 'Concurrent training: a meta-analysis examining interference',
    kern: 'Interferenz wächst mit Häufigkeit (r −0,26 bis −0,35) und Dauer (r −0,29 bis −0,75) '
      + 'des Ausdauertrainings. Laufen stört Hypertrophie und Kraft deutlich, Radfahren nicht.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22002517/',
  },
  robineau2016: {
    kurz: 'Robineau et al. 2016, J Strength Cond Res',
    titel: 'Specific training effects of concurrent aerobic and strength exercises',
    kern: 'Liegen Kraft- und Ausdauerreiz am selben Tag, mindert ein Abstand von ≥6 h '
      + 'die Interferenz gegenüber direkt aufeinanderfolgenden Einheiten.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26694508/',
  },
  vandyk2019: {
    kurz: 'van Dyk et al. 2019, Br J Sports Med',
    titel: 'Nordic hamstring exercise and hamstring injury prevention – meta-analysis',
    kern: 'Programme mit Nordic Hamstring senken Hamstring-Verletzungen um etwa 51 %.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31118191/',
  },
  seiler2010: {
    kurz: 'Seiler 2010, Int J Sports Physiol Perform',
    titel: 'What is best practice for training intensity and duration distribution?',
    kern: 'Ausdauerathleten fahren durchweg ~80 % des Umfangs niedrigintensiv, ~20 % hart '
      + '(polarisiertes Modell). Viel „Mitteltempo" bringt Ermüdung ohne Zusatznutzen.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20861519/',
  },
  schoenfeld2017: {
    kurz: 'Schoenfeld et al. 2017, J Sports Sci',
    titel: 'Dose-response relationship between weekly resistance training volume and muscle mass',
    kern: 'Hypertrophie steigt dosisabhängig; ab ~10 harten Sätzen pro Muskelgruppe und Woche '
      + 'liegt der Zuwachs deutlich über niedrigeren Umfängen.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/',
  },
  schoenfeld2018: {
    kurz: 'Schoenfeld & Aragon 2018, J Int Soc Sports Nutr',
    titel: 'How much protein can the body use in a single meal?',
    kern: 'Für maximale Muskelproteinsynthese ~0,4 g/kg pro Mahlzeit über mindestens '
      + 'vier Mahlzeiten – also rund 1,6 g/kg am Tag als Untergrenze.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29497353/',
  },
  impellizzeri2020: {
    kurz: 'Impellizzeri et al. 2020, J Orthop Sports Phys Ther',
    titel: 'Acute:Chronic Workload Ratio – conceptual issues and fundamental pitfalls',
    kern: 'Das ACWR taugt nicht als Verletzungsvorhersage: uneinheitliche Lastmaße, '
      + 'willkürliche Zeitfenster, problematische Statistik. Als grobe Ampel für '
      + 'Belastungssprünge bleibt es brauchbar – mehr nicht.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32741325/',
  },
  foster2001: {
    kurz: 'Foster et al. 2001, J Strength Cond Res',
    titel: 'A new approach to monitoring exercise training',
    kern: 'Session-RPE × Dauer in Minuten liefert eine brauchbare interne Belastungszahl.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11708692/',
  },
  mah2011: {
    kurz: 'Mah et al. 2011, Sleep',
    titel: 'Effects of sleep extension on athletic performance',
    kern: 'Schlafverlängerung auf ~10 h verbesserte Sprintzeiten und Reaktionszeit messbar. '
      + 'Schlaf ist die wirksamste Erholungsmaßnahme, die es gibt.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21731144/',
  },
  haugen2019: {
    kurz: 'Haugen et al. 2019, Int J Sports Physiol Perform',
    titel: 'The training and development of elite sprint performance',
    kern: 'Sprint bei ≥95 % Maximalgeschwindigkeit oder <70 % zur Erholung – der Bereich '
      + 'dazwischen ermüdet, ohne die Schnelligkeit zu entwickeln. Wochenumfang an '
      + 'hochwertigem Sprint typischerweise 1000–2000 m.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30840517/',
  },
  mountjoy2023: {
    kurz: 'Mountjoy et al. 2023, Br J Sports Med (IOC Consensus)',
    titel: 'REDs – Relative Energy Deficiency in Sport',
    kern: 'Energieverfügbarkeit unter 30 kcal/kg fettfreier Masse gilt als kritisch niedrig; '
      + '~45 kcal/kg FFM gelten als solide Versorgung.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/37752011/',
  },
  kerksick2018: {
    kurz: 'Kerksick et al. 2018, J Int Soc Sports Nutr',
    titel: 'ISSN exercise & sports nutrition review',
    kern: 'Kraft-/Schnellkraftsportler: 4–7 g Kohlenhydrate/kg/Tag je nach Umfang, '
      + 'Protein 1,4–2,0 g/kg. Ausdauerlastige Tage rechtfertigen 6–10 g KH/kg.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30068354/',
  },
  kreider2017: {
    kurz: 'Kreider et al. 2017, J Int Soc Sports Nutr',
    titel: 'ISSN position stand: creatine supplementation',
    kern: 'Kreatin-Monohydrat 3–5 g/Tag ist das am besten belegte Supplement für '
      + 'Schnellkraft und Wiederholungsleistung; Ladephase optional.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28615996/',
  },
  guest2021: {
    kurz: 'Guest et al. 2021, J Int Soc Sports Nutr',
    titel: 'ISSN position stand: caffeine and exercise performance',
    kern: '3–6 mg Koffein/kg, 30–60 min vorher, verbessert Sprint- und Kraftleistung zuverlässig.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33388079/',
  },
  suchomel2016: {
    kurz: 'Suchomel et al. 2016, Sports Med',
    titel: 'The importance of muscular strength in athletic performance',
    kern: 'Relative Maximalkraft hängt eng mit Sprint- und Sprungleistung zusammen; '
      + 'ab etwa der doppelten Körpermasse in der Kniebeuge flacht der Zusatznutzen ab.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26838985/',
  },
  cunningham1980: {
    kurz: 'Cunningham 1980, Am J Clin Nutr',
    titel: 'A reanalysis of the factors influencing basal metabolic rate',
    kern: 'Grundumsatz = 500 + 22 × fettfreie Masse (kg). Bei bekanntem Körperfettanteil '
      + 'treffsicherer als Formeln auf Basis des Gesamtgewichts.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/7435418/',
  },
  mifflin1990: {
    kurz: 'Mifflin & St Jeor 1990, Am J Clin Nutr',
    titel: 'A new predictive equation for resting energy expenditure',
    kern: 'Grundumsatz ohne bekannten Körperfettanteil: 10 × kg + 6,25 × cm − 5 × Jahre + s.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
  helms2014: {
    kurz: 'Helms et al. 2014, Int J Sport Nutr Exerc Metab',
    titel: 'Evidence-based recommendations for natural bodybuilding contest preparation',
    kern: 'Im Kaloriendefizit schützt mehr Protein die Magermasse: 2,3–3,1 g/kg fettfreier Masse.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24092765/',
  },
};

/* ------------------------------------------------------- Trainingssteuerung */

/** Sprint lohnt sich nur bei voller Frische – dazwischen gehören ganze Tage. */
export const SPRINT = {
  minStundenZwischenEinheiten: 48,
  maxEinheitenProWoche: 3,
  // Hochwertiger Sprintumfang pro Woche in Metern.
  //
  // Haugen 2019 nennt 1000–2000 m für Sprinter, die hauptberuflich sprinten.
  // Wer daneben Kraft und Ausdauer trainiert, erholt sich davon nicht – die
  // Werte hier liegen bewusst darunter. Lieber weniger Meter bei voller
  // Geschwindigkeit als die Literaturzahl bei 90 %, denn unterhalb von ~95 %
  // wird Schnelligkeit nicht mehr entwickelt.
  wochenumfangMeter: { aufbau: 1000, intensivierung: 900, realisierung: 700, entlastung: 450 },
  // Obergrenze hochwertiger Läufe je Einheit. Beschleunigung verträgt mehr,
  // weil die Belastung je Lauf kürzer ist als bei Höchstgeschwindigkeit.
  maxLaeufeProEinheit: { beschleunigung: 16, maximalgeschwindigkeit: 12 },
  // Faustregel Pause: 60–90 s je 10 m bei ≥95 % Intensität.
  pauseSekundenProZehnMeter: 75,
  intensitaetProzent: { beschleunigung: 95, maximalgeschwindigkeit: 98, tempo: 70 },
};

/** Krafttraining: Umfang pro Muskelgruppe und Woche (Schoenfeld 2017). */
export const KRAFT = {
  saetzeProMuskelWoche: { minimum: 10, ziel: 14, obergrenze: 20 },
  // Prozent des 1RM je Trainingsabsicht.
  intensitaet: {
    hypertrophie: [67, 80],
    maximalkraft: [85, 92],
    explosivkraft: [30, 60],
  },
  wiederholungen: {
    hypertrophie: [6, 12],
    maximalkraft: [2, 5],
    explosivkraft: [3, 5],
  },
};

/** Polarisierte Intensitätsverteilung (Seiler 2010). */
export const AUSDAUER = {
  anteilNiedrigintensiv: 0.8,
  anteilHochintensiv: 0.2,
  // Radfahren und Rudern stören die Kraftentwicklung weniger als Laufen (Wilson 2012).
  interferenzFaktor: { rad: 0.35, rudern: 0.45, schwimmen: 0.4, crosstrainer: 0.5, laufen: 1.0 },
};

/**
 * Blockperiodisierung: drei Phasen plus Entlastung. Jede Phase verschiebt den
 * Schwerpunkt, statt alles gleichzeitig zu wollen.
 */
export const PHASEN = {
  aufbau: {
    name: 'Aufbau',
    beschreibung: 'Umfang sammeln: Hypertrophie, aerobe Basis, Sprinttechnik aus dem Block.',
    kraftAbsicht: 'hypertrophie',
    volumenFaktor: 1.0,
    sprintFokus: 'beschleunigung',
  },
  intensivierung: {
    name: 'Intensivierung',
    beschreibung: 'Lasten hoch, Umfang runter: Maximalkraft und schnellere Sprints.',
    kraftAbsicht: 'maximalkraft',
    volumenFaktor: 0.8,
    sprintFokus: 'maximalgeschwindigkeit',
  },
  realisierung: {
    name: 'Realisierung',
    beschreibung: 'Wenig Umfang, viel Qualität: Explosivkraft und Höchstgeschwindigkeit.',
    kraftAbsicht: 'explosivkraft',
    volumenFaktor: 0.6,
    sprintFokus: 'maximalgeschwindigkeit',
  },
  entlastung: {
    name: 'Entlastung',
    beschreibung: 'Umfang halbieren, Lasten halten – hier entsteht die Anpassung.',
    kraftAbsicht: 'maximalkraft',
    volumenFaktor: 0.5,
    sprintFokus: 'beschleunigung',
  },
};

/** Reihenfolge der Blöcke über einen Makrozyklus von zwölf Wochen. */
export const BLOCKFOLGE = ['aufbau', 'aufbau', 'aufbau', 'entlastung',
  'intensivierung', 'intensivierung', 'intensivierung', 'entlastung',
  'realisierung', 'realisierung', 'realisierung', 'entlastung'];

/* ------------------------------------------------------------- Ernährung */

export const ERNAEHRUNG = {
  // g/kg Körpergewicht (Morton 2018, Kerksick 2018).
  protein: { minimum: 1.6, ziel: 1.9, imDefizit: 2.2, obergrenze: 2.5 },
  // g/kg – Untergrenze für Hormonhaushalt und fettlösliche Vitamine.
  fett: { minimum: 0.8, ziel: 1.0 },
  // g/kg je nach Tagesbelastung (Kerksick 2018).
  kohlenhydrate: {
    ruhetag: [3, 4],
    leicht: [4, 5],
    mittel: [5, 6],
    hart: [6, 7],
    langeAusdauer: [7, 9],
  },
  // kcal je kg fettfreier Masse (Mountjoy 2023).
  energieverfuegbarkeit: { kritisch: 30, knapp: 40, ziel: 45 },
  proteinProMahlzeit: 0.4,
  mahlzeitenProTag: 4,
};

/** Supplemente nach Belegstärke – bewusst kurz gehalten. */
export const SUPPLEMENTE = [
  {
    name: 'Kreatin-Monohydrat',
    dosis: '3–5 g täglich, Zeitpunkt egal',
    nutzen: 'Wiederholungsleistung, Schnellkraft, Muskelmasse',
    guete: 'stark',
    quelle: 'kreider2017',
  },
  {
    name: 'Koffein',
    dosis: '3–6 mg/kg, 30–60 min vor der Einheit',
    nutzen: 'Sprint, Maximalkraft, wahrgenommene Anstrengung',
    guete: 'stark',
    quelle: 'guest2021',
  },
  {
    name: 'Beta-Alanin',
    dosis: '3,2–6,4 g täglich über Wochen aufsättigen',
    nutzen: 'Belastungen von 60–240 s – für reine Kurzsprints kaum relevant',
    guete: 'solide',
    quelle: 'kerksick2018',
  },
  {
    name: 'Rote-Bete-Saft (Nitrat)',
    dosis: '6–8 mmol Nitrat, 2–3 h vorher',
    nutzen: 'Ausdauerökonomie, wiederholte Sprints',
    guete: 'solide',
    quelle: 'kerksick2018',
  },
  {
    name: 'Vitamin D',
    dosis: 'nur bei nachgewiesenem Mangel, sonst wirkungslos',
    nutzen: 'Knochen, Muskelfunktion',
    guete: 'solide',
    quelle: 'kerksick2018',
  },
];

/* ------------------------------------------------------ Belastungssteuerung */

export const BELASTUNG = {
  // Akut-zu-chronisch-Verhältnis: grobe Ampel, keine Vorhersage (Impellizzeri 2020).
  acwr: { untergrenze: 0.8, obergrenze: 1.3, warnung: 1.5 },
  akutTage: 7,
  chronischTage: 28,
  // Wochensteigerung des Umfangs – Trainerpraxis, keine belastbare Studienlage.
  maxWochensteigerungProzent: 10,
};

/** Fragen des Morgen-Checks. Alle 1–5, höher ist besser. */
export const WOHLBEFINDEN = [
  { id: 'schlaf', frage: 'Schlafqualität', skala: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] },
  { id: 'muskelkater', frage: 'Muskelkater', skala: ['extrem', 'stark', 'spürbar', 'leicht', 'keiner'] },
  { id: 'stress', frage: 'Stresslevel', skala: ['sehr hoch', 'hoch', 'mittel', 'niedrig', 'sehr niedrig'] },
  { id: 'stimmung', frage: 'Stimmung', skala: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] },
  { id: 'energie', frage: 'Energie', skala: ['leer', 'wenig', 'okay', 'viel', 'topfit'] },
];

/* -------------------------------------------------------------- Leistung */

/**
 * Kraftmarken relativ zur Körpermasse. Der Sprintnutzen flacht oberhalb der
 * „stark"-Marke ab (Suchomel 2016) – dann lohnt Explosivkraft mehr als noch
 * mehr Maximalkraft.
 */
export const KRAFTMARKEN = {
  kniebeuge: { einstieg: 1.0, solide: 1.5, stark: 2.0 },
  kreuzheben: { einstieg: 1.25, solide: 1.75, stark: 2.25 },
  bankdruecken: { einstieg: 0.75, solide: 1.0, stark: 1.4 },
  hipthrust: { einstieg: 1.25, solide: 1.75, stark: 2.5 },
};

/**
 * Weg zum Muscle-Up. Jede Stufe hat ein überprüfbares Tor – erst wenn das
 * steht, lohnt die nächste. Die Zusatzlast-Marke (~+40 % Körpergewicht im
 * Klimmzug) ist Trainerpraxis, keine Studienlage.
 */
export const MUSCLEUP_STUFEN = [
  { stufe: 1, name: 'Saubere Klimmzüge', tor: '8 Wiederholungen ohne Schwung', pruefung: 'klimmzuege', ziel: 8 },
  { stufe: 2, name: 'Klimmzug-Volumen', tor: '12 Wiederholungen ohne Schwung', pruefung: 'klimmzuege', ziel: 12 },
  { stufe: 3, name: 'Zusatzlast', tor: 'Klimmzug mit +25 % Körpergewicht', pruefung: 'zusatzlast', ziel: 0.25 },
  { stufe: 4, name: 'Hohe Klimmzüge', tor: 'Stange berührt das Brustbein, 5 Wiederholungen', pruefung: 'manuell', ziel: 5 },
  { stufe: 5, name: 'Straight-Bar-Dips', tor: '8 Wiederholungen an der Stange', pruefung: 'manuell', ziel: 8 },
  { stufe: 6, name: 'Explosive Klimmzüge', tor: 'Hände lösen sich kurz von der Stange', pruefung: 'manuell', ziel: 3 },
  { stufe: 7, name: 'Übergang', tor: '5 negative Muscle-Ups kontrolliert', pruefung: 'manuell', ziel: 5 },
  { stufe: 8, name: 'Muscle-Up mit Schwung', tor: 'Erster Muscle-Up mit leichtem Kip', pruefung: 'muscleups', ziel: 1 },
  { stufe: 9, name: 'Strikter Muscle-Up', tor: 'Ohne Schwung aus dem Hang', pruefung: 'muscleups', ziel: 1 },
  { stufe: 10, name: 'Mehrfach strikt', tor: '5 strikte Muscle-Ups am Stück', pruefung: 'muscleups', ziel: 5 },
];

/** Nachschlagen einer Quelle für die Oberfläche. */
export function quelle(id) {
  return QUELLEN[id] || null;
}
