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
  lauersen2014: {
    kurz: 'Lauersen et al. 2014, Br J Sports Med',
    titel: 'The effectiveness of exercise interventions to prevent sports injuries',
    kern: 'Krafttraining senkt akute Sportverletzungen auf weniger als ein Drittel und '
      + 'Überlastungsschäden um fast die Hälfte. 25 Studien, 26 610 Teilnehmer. '
      + 'Dehnen zeigte dagegen keinen Effekt.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24100287/',
  },
  haroy2019: {
    kurz: 'Harøy et al. 2019, Br J Sports Med',
    titel: 'The Adductor Strengthening Programme prevents groin problems',
    kern: 'Ein Programm aus einer einzigen Übung – der Copenhagen Adduction – senkte '
      + 'Leistenprobleme um 41 %. Adduktorenkraft ist der wichtigste beeinflussbare Risikofaktor.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30498004/',
  },
  fifa11plus: {
    kurz: 'Metaanalyse 2025, Sports (Basel)',
    titel: 'Impact of the FIFA 11+ neuromuscular training programme on ankle injury',
    kern: 'Neuromuskuläres Aufwärmen mit Balance- und Sprungelementen senkte '
      + 'Sprunggelenksverletzungen um 33 %. Wirkt ab zwei Anwendungen pro Woche.',
    guete: 'stark',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12371935/',
  },
  tanaka2001: {
    kurz: 'Tanaka et al. 2001, J Am Coll Cardiol',
    titel: 'Age-predicted maximal heart rate revisited',
    kern: 'Maximalpuls ≈ 208 − 0,7 × Alter. Metaanalyse aus 351 Studien mit 18 712 Personen. '
      + 'Deutlich treffsicherer als die verbreitete Formel 220 − Alter, aber immer noch '
      + 'mit rund 7 Schlägen Streuung – individuell also weiterhin unzuverlässig.',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11153730/',
  },
  buchheit2014: {
    kurz: 'Buchheit 2014, Front Physiol',
    titel: 'Monitoring training status with HR measures: do all roads lead to Rome?',
    kern: 'Herzfrequenzbasierte Marker taugen zur Verlaufsbeobachtung – aber nur gegen eine '
      + 'individuelle Ausgangslage und über mehrere Tage gemittelt. Einzelmessungen schwanken '
      + 'zu stark. Die Richtung ist zudem nicht eindeutig: Bei starker Ermüdung kann der '
      + 'Ruhepuls steigen oder fallen, je nachdem, welcher Teil des vegetativen Nervensystems '
      + 'überwiegt. Ein Wert allein trägt keine Entscheidung.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24578692/',
  },
  swinton2011: {
    kurz: 'Swinton et al. 2011, J Strength Cond Res',
    titel: 'A biomechanical analysis of straight and hexagonal barbell deadlifts',
    kern: 'Die Sechskantstange verlagert die Last in die Körperachse. Das verkürzt den '
      + 'Hebelarm und senkt die Spitzenmomente an der Lendenwirbelsäule deutlich – '
      + 'bei vergleichbarer Kraftentwicklung.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21659894/',
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
  garthe2011: {
    kurz: 'Garthe et al. 2011, Int J Sport Nutr Exerc Metab',
    titel: 'Effect of nutritional intervention on body composition and performance in elite athletes',
    kern: 'Langsame Gewichtszunahme (rund 0,5 % pro Woche) brachte bei Leistungssportlern '
      + 'mehr Magermasse und weniger Fett als eine schnellere. Umgekehrt kostet ein Defizit '
      + 'oberhalb von etwa 1 % pro Woche Magermasse – bei einem Sprinter also genau das, '
      + 'was Leistung bringt.',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21558571/',
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
  quelle: 'haugen2019',
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

/**
 * Abbruchregel für Sprinteinheiten.
 *
 * Sprinttraining verlangt ≥95 % der Maximalgeschwindigkeit (Haugen 2019).
 * Fällt die Zeit innerhalb der Einheit merklich ab, ist genau diese Bedingung
 * verletzt: Was danach kommt, trainiert nicht mehr Schnelligkeit, sondern
 * Ermüdungsresistenz – und erhöht dabei das Verletzungsrisiko, weil die
 * Technik als Erstes leidet.
 *
 * Die Zahl selbst ist Trainerkonsens, keine Studienlage. Sie folgt aber direkt
 * aus der Intensitätsforderung: Drei Prozent mehr Zeit sind rund drei Prozent
 * weniger Geschwindigkeit, und damit ist der Zielkorridor verlassen.
 *
 * Gemessen wird gegen die **Tagesbestzeit**, nicht gegen eine Saisonbestzeit.
 * Wer an einem schlechten Tag ohnehin langsamer ist, soll deshalb nicht die
 * ganze Einheit gestrichen bekommen – es geht um den Abfall innerhalb der
 * Einheit.
 */
export const SPRINT_QUALITAET = {
  quelle: 'haugen2019',
  abbruchProzent: 3.0,
  warnungProzent: 2.0,
  // Vor drei Läufen ist keine Tagesbestzeit bestimmbar; der erste Lauf ist
  // erfahrungsgemäß noch nicht der schnellste.
  minLaeufeFuerBewertung: 3,
  guete: 'praxis',
};

/** Krafttraining: Umfang pro Muskelgruppe und Woche (Schoenfeld 2017). */
export const KRAFT = {
  quelle: 'schoenfeld2017',
  saetzeProMuskelWoche: { minimum: 10, ziel: 14, obergrenze: 20 },
  // Prozent des 1RM je Trainingsabsicht – als Orientierung, welcher Bereich
  // gemeint ist. Die tatsächliche Last rechnet der Planer aus der
  // Wiederholungszahl plus Reserve (siehe leistung.js/prozentFuerWdh), weil
  // beides sonst auseinanderdriftet: „7 Wiederholungen bei 90 % 1RM" wäre eine
  // Vorgabe, die niemand ausführen kann.
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
  /**
   * Wiederholungen in Reserve je Absicht. Beim Maximalkrafttraining wird
   * dichter an die Grenze gegangen, beim Explosivkrafttraining gar nicht:
   * Dort bestimmt die Bewegungsgeschwindigkeit die Last, nicht die Erschöpfung.
   */
  reserve: {
    hypertrophie: 2,
    maximalkraft: 1,
    explosivkraft: null, // feste Prozentvorgabe, nicht aus Wiederholungen abgeleitet
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
 * Intensitätszonen für Ausdauereinheiten, eingeteilt nach gefühlter
 * Anstrengung.
 *
 * Warum RPE und nicht Herzfrequenz oder Laktat: RPE liegt für jede
 * protokollierte Einheit vor, braucht kein Gerät und korreliert für die
 * Zoneneinteilung gut genug. Wer Herzfrequenz misst, kann die Zone daraus
 * ableiten – die Einteilung bleibt dieselbe.
 *
 * Die mittlere Zone heißt bewusst „Grauzone". Sie ist der häufigste Fehler im
 * Ausdauertraining: zu schnell für Erholung, zu langsam für einen Reiz. Wer
 * dort viel Zeit verbringt, sammelt Ermüdung ohne Anpassung – und die fehlt
 * dann am Sprinttag.
 */
export const AUSDAUER_ZONEN = {
  quelle: 'seiler2010',
  locker: {
    name: 'Locker',
    rpeBis: 4,
    ziel: 0.8,
    kennzeichen: 'Du kannst in ganzen Sätzen sprechen.',
    farbe: 'ausdauer',
  },
  grauzone: {
    name: 'Grauzone',
    rpeVon: 5,
    rpeBis: 6,
    ziel: 0,
    kennzeichen: 'Sprechen geht noch, ist aber unangenehm. Genau der Bereich, '
      + 'der wenig bringt und trotzdem ermüdet.',
    farbe: 'warn',
  },
  hart: {
    name: 'Hart',
    rpeVon: 7,
    ziel: 0.2,
    kennzeichen: 'Sprechen in Bruchstücken. Die letzten Minuten kosten Überwindung.',
    farbe: 'sprint',
  },
};

/**
 * Ab wann die Verteilung als schief gilt.
 *
 * Seiler 2010 findet bei Ausdauerathleten durchweg rund 80/20. Ein Fünftel der
 * Zeit in der Grauzone ist noch normal – ein Drittel oder mehr ist das Muster,
 * bei dem Ausdauertraining regelmäßig scheitert. Die Schwellen sind
 * Trainerpraxis, der 80/20-Bezug ist es nicht.
 */
export const AUSDAUER_VERTEILUNG = {
  quelle: 'seiler2010',
  grauzoneWarnung: 0.25,
  grauzoneKritisch: 0.35,
  // Auch nach oben gibt es eine Grenze. Ohne sie galt eine leere Grauzone als
  // gut, egal wie viel hart war – „42 % locker, 58 % hart" stand als
  // polarisierte Verteilung da, obwohl das Verhältnis genau umgekehrt ist.
  hartZuViel: 0.35,
  minMinutenFuerBewertung: 90,
  guete: 'praxis',
};

/**
 * Herzfrequenz als genauere Alternative zur gefühlten Anstrengung.
 *
 * Die Zonengrenzen orientieren sich an den beiden ventilatorischen Schwellen,
 * an denen auch das polarisierte Modell hängt: Unterhalb der ersten Schwelle
 * ist es wirklich locker, oberhalb der zweiten wirklich hart, dazwischen liegt
 * die Grauzone. Als Prozentsätze der Maximalfrequenz liegen sie erfahrungsgemäß
 * bei rund 82 % und 87 %.
 *
 * **Wichtige Einschränkung, die auch in der Oberfläche steht:** Diese Prozente
 * sind Näherungen. Die tatsächlichen Schwellen schwanken zwischen Personen um
 * mehrere Prozentpunkte, und ein *geschätzter* Maximalpuls bringt zusätzlich
 * rund 7 Schläge Unsicherheit mit. Mit geschätztem Maximalpuls ist die
 * Zoneneinteilung deshalb kaum besser als die über RPE – der Gewinn entsteht
 * erst mit einem gemessenen Wert.
 */
export const HERZFREQUENZ = {
  // Tanaka 2001 statt der verbreiteten Formel 220 − Alter.
  schaetzungBasis: 208,
  schaetzungFaktor: 0.7,
  schaetzungStreuung: 7,
  // Anteil der Maximalfrequenz, ab dem die jeweilige Zone beginnt.
  grenzen: { grauzone: 0.82, hart: 0.87 },
  guete: 'praxis',
  quelleSchaetzung: 'tanaka2001',
  // Plausibilitätsgrenzen für Eingaben.
  minPuls: 30,
  maxPuls: 230,
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

/**
 * Die beiden Grundumsatzformeln – Koeffizienten und Quelle.
 *
 * Sie standen als Zahlen mitten in `ernaehrung.js`. Das widerspricht der
 * Regel, dass jede Zahl hier steht, und macht sie unauffindbar: Wer wissen
 * will, worauf der Kalorienbedarf fußt, sucht in der Evidenzbasis und nicht
 * in einer Rechenfunktion.
 *
 * Cunningham rechnet über die fettfreie Masse und ist deshalb treffsicherer –
 * Muskelmasse treibt den Umsatz, nicht das Gesamtgewicht. Ohne Körperfettanteil
 * bleibt Mifflin-St Jeor.
 */
export const GRUNDUMSATZ = {
  cunningham: {
    name: 'Cunningham',
    basis: 500,
    proKgFettfrei: 22,
    quelle: 'cunningham1980',
  },
  mifflin: {
    name: 'Mifflin-St Jeor',
    proKg: 10,
    proCm: 6.25,
    proJahr: -5,
    // Geschlechtsterm der Formel.
    mann: 5,
    frau: -161,
    quelle: 'mifflin1990',
  },
};

export const ERNAEHRUNG = {
  quelle: 'kerksick2018',
  quelleProtein: 'morton2018',
  quelleMahlzeiten: 'schoenfeld2018',
  quelleEnergieverfuegbarkeit: 'mountjoy2023',
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
  /**
   * Wie schnell das Körpergewicht sich ändern sollte, in Prozent pro Woche
   * (Garthe 2011). Nach oben, weil ein schnellerer Aufbau überwiegend Fett
   * wird; nach unten, weil ein zu großes Defizit Magermasse kostet – bei einem
   * Sprinter also genau das, was Leistung bringt.
   */
  gewichtProWoche: { aufbauMax: 0.5, abnahmeMax: 1.0, quelle: 'garthe2011' },
  // Ab wann die Tagesbilanz als deutlich überschritten gilt. Trainerpraxis:
  // Ein Zehntel darüber ist Messrauschen, mehr ist eine Entscheidung.
  kcalUeberschrittenAb: 1.10,
  proteinProMahlzeit: 0.4,
  mahlzeitenProTag: 4,
  /**
   * Versorgung rund um die Einheit.
   *
   * Die Zahlen standen bisher nur als Text in zwei Funktionen – einmal im Kern
   * und einmal in der Oberfläche, und schon leicht auseinandergelaufen. Hier
   * stehen sie einmal, wie jede andere Zahl auch.
   */
  umDieEinheit: {
    // g/kg 1–3 h vor einer harten Einheit (Kerksick 2018).
    khVorherProKg: [1, 2],
    // Ab dieser Dauer lohnt Kohlenhydratzufuhr während der Belastung.
    khAbMinuten: 90,
    khProStunde: [30, 60],
    // Ab dieser Dauer wird Trinken zum Thema.
    trinkenAbMinuten: 60,
    trinkenProStundeMl: [400, 800],
    natriumProLiterMg: 500,
    // g/kg danach. Die Tagesmenge zählt mehr als das Timing – deshalb steht
    // das auch im Text dabei.
    proteinNachherProKg: 0.3,
  },
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
  quelle: 'foster2001',
  // Der Vorbehalt zum Verhältnis selbst – es wird oft als Vorhersage verkauft.
  quelleVorbehalt: 'impellizzeri2020',
  // Akut-zu-chronisch-Verhältnis: grobe Ampel, keine Vorhersage (Impellizzeri 2020).
  acwr: { untergrenze: 0.8, obergrenze: 1.3, warnung: 1.5 },
  akutTage: 7,
  chronischTage: 28,
  // Wochensteigerung des Umfangs – Trainerpraxis, keine belastbare Studienlage.
  maxWochensteigerungProzent: 10,
};

/**
 * Ruhepuls als Erholungssignal.
 *
 * Nützlich ist nicht der Wert, sondern die **Abweichung von der eigenen
 * Ausgangslage** – ein Ruhepuls von 58 sagt für sich genommen nichts. Deshalb
 * wird ein Schnitt der letzten Tage gegen eine längere Grundlinie gestellt,
 * und beides braucht eine Mindestzahl an Messungen.
 *
 * Die Schwellen sind Trainerpraxis. Was belegt ist (Buchheit 2014): Einzelwerte
 * schwanken zu stark, gemittelte Verläufe gegen eine individuelle Grundlinie
 * sind brauchbar – und die Richtung ist **nicht eindeutig**. Bei starker
 * Ermüdung kann der Ruhepuls auch fallen. Ein erhöhter Wert ist außerdem
 * unspezifisch: Infekt, Alkohol, Hitze und Stress erzeugen dasselbe Bild.
 * Deshalb zählt er im Tracker nur als **ein** Grund neben anderen und nie
 * allein.
 */
export const RUHEPULS = {
  schnittTage: 3,
  grundlinieTage: 21,
  minMessungenSchnitt: 2,
  minMessungenGrundlinie: 7,
  // Abweichung nach oben in Schlägen pro Minute.
  warnungAb: 5,
  deutlichAb: 8,
  guete: 'praxis',
  quelle: 'buchheit2014',
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
  quelle: 'suchomel2016',
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

/* -------------------------------------------------------- Muskelgruppen */

/**
 * Muskelgruppen für die Volumenzählung. Die Dosis-Wirkung aus Schoenfeld 2017
 * bezieht sich auf Sätze **pro Muskelgruppe**, nicht pro Übung – Kniebeuge und
 * Hip Thrust treffen beide das Gesäß und müssen zusammengezählt werden.
 */
export const MUSKELGRUPPEN = {
  quadrizeps: 'Quadrizeps',
  hamstrings: 'Hamstrings',
  gesaess: 'Gesäß',
  adduktoren: 'Adduktoren',
  waden: 'Waden',
  schienbein: 'Schienbein',
  ruecken: 'Rücken',
  brust: 'Brust',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  rumpf: 'Rumpf',
};

/**
 * Anteil, mit dem ein Satz für eine Muskelgruppe zählt.
 *
 * 1,0 heißt: Die Muskelgruppe ist der Hauptantrieb der Bewegung.
 * 0,5 heißt: Sie arbeitet deutlich mit, bekommt aber nicht den vollen Reiz.
 *
 * Diese Halbierung ist gängige Praxis in der Volumenzählung und keine exakte
 * Messgröße – sie verhindert vor allem, dass Hilfsmuskulatur rechnerisch
 * überversorgt aussieht, obwohl sie nie direkt trainiert wurde.
 */
export const ANTEIL = { haupt: 1, mit: 0.5 };

/**
 * Wochenvolumen je Muskelgruppe: die Marken, an denen der Umfang bewertet wird.
 *
 * Nach unten ist die Lage klar (Schoenfeld 2017): Ab rund zehn harten Sätzen je
 * Muskelgruppe und Woche liegt der Zuwachs deutlich über niedrigeren Umfängen.
 *
 * Nach oben ist sie es **nicht** – und genau deshalb stehen hier Zahlen. Ohne
 * obere Marke sah der Tracker 30 Sätze Quadrizeps genauso aus wie 14: voller
 * grüner Balken, alles bestens. Für einen Sprinter ist das die falsche
 * Rückmeldung, und zwar aus einem Grund, der nicht in der Hypertrophieliteratur
 * steht: Beinvolumen konkurriert direkt mit der Sprintqualität. Die Ermüdung
 * landet in denselben Muskeln, die zwei Tage später schnell sein sollen.
 *
 * `viel` ist deshalb keine Verbotsgrenze, sondern der Punkt, ab dem der Tracker
 * daran erinnert – die Abwägung bleibt bei Nils.
 */
export const VOLUMEN = {
  minimum: 10,
  // Obergrenze der Darstellung. Darüber sagt der Balken nichts mehr aus.
  skalaBis: 20,
  viel: 20,
  guete: 'praxis',
  quelleMinimum: 'schoenfeld2017',
  // Muskelgruppen, die im Sprint ohnehin voll belastet werden. Bei ihnen kommt
  // das Sprintvolumen zum Kraftvolumen dazu, ohne dass es hier mitgezählt wird.
  sprintbelastet: ['hamstrings', 'quadrizeps', 'gesaess', 'waden', 'adduktoren'],
};

/* ---------------------------------------------------- Verletzungsschutz */

/**
 * Bereiche, die ein Sprintprogramm aktiv absichern muss, mit der jeweils am
 * besten belegten Übung. Krafttraining an sich senkt akute Verletzungen auf
 * unter ein Drittel (Lauersen 2014) – diese vier Bereiche haben darüber hinaus
 * eigene, gezielt untersuchte Programme.
 */
export const SCHUTZZIELE = {
  hamstrings: {
    name: 'Hamstrings',
    warum: 'Die häufigste Verletzung im Sprint überhaupt. Der Riss passiert in der '
      + 'späten Schwungphase, wenn der Muskel unter Dehnung bremst.',
    uebung: 'nordic',
    reduktion: 0.51,
    quelle: 'vandyk2019',
    minSaetzeWoche: 2,
  },
  leiste: {
    name: 'Leiste und Adduktoren',
    warum: 'Adduktorenkraft ist der wichtigste beeinflussbare Risikofaktor für '
      + 'Leistenprobleme. Sprint und Richtungswechsel belasten sie stark.',
    uebung: 'copenhagen',
    reduktion: 0.41,
    quelle: 'haroy2019',
    minSaetzeWoche: 2,
  },
  achillessehne: {
    name: 'Achillessehne und Wade',
    warum: 'Beim Sprint wirken hier die höchsten Spitzenkräfte des ganzen Körpers. '
      + 'Sehnen passen sich langsamer an als Muskeln – sie brauchen eigene Reize.',
    uebung: 'wadenheben',
    quelle: 'lauersen2014',
    minSaetzeWoche: 2,
  },
  sprunggelenk: {
    name: 'Sprunggelenk',
    warum: 'Balance- und Sprungelemente im Aufwärmen senken Sprunggelenksverletzungen '
      + 'um etwa ein Drittel – unabhängig davon, wie stark jemand ist.',
    uebung: 'einbeinstand',
    reduktion: 0.33,
    quelle: 'fifa11plus',
    minSaetzeWoche: 2,
  },
};

/** Risikostufen mit ihrer Bedeutung – für die Anzeige. */
export const RISIKOSTUFEN = {
  niedrig: 'Geringes Risiko: selbstbegrenzend oder mit kurzem Hebel.',
  mittel: 'Mittleres Risiko: Technik und Ermüdung entscheiden.',
  erhoeht: 'Erhöhtes Risiko: nur mit sicherer Technik und frisch.',
};

/* ------------------------------------------------------------- Übungen */

/**
 * Übungsregister. Plan, Trainingsprotokoll und Kraftmarken greifen über
 * denselben Schlüssel zu – so findet das Protokoll vom Montag den Weg in die
 * Gewichtsempfehlung vom Donnerstag, ohne dass irgendwo Namensstrings
 * verglichen werden müssen.
 *
 * `schritt` ist die kleinste sinnvolle Laststeigerung: An der Langhantel sind
 * das 5 kg (zwei 2,5er-Scheiben), bei Zusatzlast am Gürtel 2,5 kg. Kleiner zu
 * springen suggeriert eine Messgenauigkeit, die es an der Hantel nicht gibt.
 */
// `lastTest` benennt die Testart, aus der eine Last in Kilo ablesbar ist.
// Ohne diese Zuordnung würde der Test „Klimmzüge max." mit dem Wert 9 als
// 9 kg gelesen – er zählt aber Wiederholungen. `wdhTest` ist das Gegenstück:
// eine Testart, die Wiederholungen mit dem eigenen Körpergewicht misst.
export const UEBUNGEN = {
  /* ------------------------------------------------------- Unterkörper */

  kniebeuge: {
    name: 'Kniebeuge',
    schritt: 5,
    marke: 'kniebeuge',
    lastTest: 'kniebeuge',
    muskeln: { quadrizeps: 1, gesaess: 1, hamstrings: 0.5, rumpf: 0.5 },
    risiko: 'mittel',
    risikoNotiz: 'Die Lendenwirbelsäule trägt hier mit. Bricht die Technik unter Ermüdung ein, '
      + 'rundet der Rücken – deshalb 1–2 Wiederholungen Reserve statt bis zum Versagen.',
    sicherer: 'frontKniebeuge',
  },
  frontKniebeuge: {
    name: 'Frontkniebeuge',
    schritt: 5,
    ableitenVon: 'kniebeuge',
    faktor: 0.85,
    muskeln: { quadrizeps: 1, gesaess: 0.5, rumpf: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Selbstbegrenzend: Wer den Oberkörper nicht aufrecht hält, verliert die Stange '
      + 'nach vorn, bevor der Rücken überlastet wird. Die Last ist niedriger, der Reiz auf den '
      + 'Quadrizeps ähnlich.',
  },
  gobletKniebeuge: {
    name: 'Goblet-Kniebeuge',
    schritt: 2.5,
    ableitenVon: 'kniebeuge',
    faktor: 0.45,
    muskeln: { quadrizeps: 1, gesaess: 0.5, rumpf: 0.5 },
    risiko: 'niedrig',
    risikoNotiz: 'Kaum Wirbelsäulenbelastung, verzeiht Technikfehler. Gut zum Wiedereinstieg '
      + 'und als Aufwärmsatz.',
  },
  kreuzheben: {
    name: 'Kreuzheben',
    schritt: 5,
    marke: 'kreuzheben',
    lastTest: 'kreuzheben',
    muskeln: { hamstrings: 1, gesaess: 1, ruecken: 1, rumpf: 0.5 },
    risiko: 'erhoeht',
    risikoNotiz: 'Die Stange liegt vor dem Körper, der Hebelarm zur Lendenwirbelsäule ist lang. '
      + 'Das ergibt die höchsten Scherkräfte aller Standardübungen.',
    sicherer: 'trapbarKreuzheben',
  },
  trapbarKreuzheben: {
    name: 'Kreuzheben an der Sechskantstange',
    schritt: 5,
    ableitenVon: 'kreuzheben',
    faktor: 1.05,
    muskeln: { quadrizeps: 0.5, hamstrings: 1, gesaess: 1, ruecken: 0.5, rumpf: 0.5 },
    risiko: 'niedrig',
    risikoNotiz: 'Die Last liegt in der Körperachse statt davor. Der kürzere Hebelarm senkt die '
      + 'Spitzenmomente an der Lendenwirbelsäule deutlich, bei vergleichbarer Kraftentwicklung '
      + '(Swinton 2011). Für Sprintzwecke die bessere Wahl.',
  },
  rumaenischesKreuzheben: {
    name: 'Rumänisches Kreuzheben',
    schritt: 5,
    // Ohne eigene Daten aus dem Kreuzheben ableiten. Der Faktor ist
    // Trainerpraxis: Das RDL läuft mit kürzerem Weg und ohne Boden-Start
    // typischerweise bei 70–80 % des klassischen Kreuzhebens.
    ableitenVon: 'kreuzheben',
    faktor: 0.75,
    muskeln: { hamstrings: 1, gesaess: 1, ruecken: 0.5 },
    risiko: 'mittel',
    risikoNotiz: 'Belastet die Hamstrings in Dehnung – genau darin liegt der Schutzeffekt, '
      + 'aber auch das Risiko. Mit mäßiger Last und ohne Rückenrunden arbeiten.',
  },
  hipthrust: {
    name: 'Hip Thrust',
    schritt: 5,
    marke: 'hipthrust',
    lastTest: 'hipthrust',
    muskeln: { gesaess: 1, hamstrings: 0.5 },
    risiko: 'niedrig',
    risikoNotiz: 'Hohe Last aufs Gesäß bei minimaler Wirbelsäulenbelastung. Eine der wenigen '
      + 'Übungen, die schwer sein dürfen, ohne dass der Rücken mitleidet.',
  },

  /* --------------------------------------------------------- Oberkörper */

  bankdruecken: {
    name: 'Bankdrücken',
    schritt: 2.5,
    marke: 'bankdruecken',
    lastTest: 'bankdruecken',
    muskeln: { brust: 1, trizeps: 0.5, schultern: 0.5 },
    risiko: 'mittel',
    risikoNotiz: 'Die Schulter steht am tiefsten Punkt unter Zug. Ellenbogen nicht ganz '
      + 'ausstellen, Schulterblätter zusammenziehen und fixieren.',
  },
  klimmzuege: {
    name: 'Klimmzüge',
    schritt: 2.5,
    koerpergewicht: true,
    lastTest: 'klimmzugZusatzlast',
    wdhTest: 'klimmzuege',
    muskeln: { ruecken: 1, bizeps: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Der Körper hängt frei, das Schultergelenk sucht sich seinen Weg. '
      + 'Schwungvolles Kippen vermeiden – das belastet die Schulter, ohne mehr Kraft aufzubauen.',
  },
  latzug: {
    name: 'Latzug',
    schritt: 2.5,
    muskeln: { ruecken: 1, bizeps: 0.5 },
    risiko: 'niedrig',
    risikoNotiz: 'Zur Brust ziehen, nicht in den Nacken. Der Nackenzug bringt nichts zusätzlich '
      + 'und drängt die Schulter in eine ungünstige Position.',
  },
  dips: {
    name: 'Dips an der geraden Stange',
    schritt: 2.5,
    koerpergewicht: true,
    muskeln: { brust: 1, trizeps: 1, schultern: 0.5 },
    risiko: 'mittel',
    risikoNotiz: 'Nur so tief, wie die Schulter es schmerzfrei zulässt – etwa bis der Oberarm '
      + 'waagerecht ist. Tiefer wird das Schultergelenk in Endstellung belastet, ohne dass der '
      + 'Reiz noch zunimmt.',
  },

  /* -------------------------------------------------- Verletzungsschutz */

  nordic: {
    name: 'Nordic Hamstring',
    koerpergewicht: true,
    ohneLast: true,
    muskeln: { hamstrings: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Macht ordentlich Muskelkater, aber die Verletzungsgefahr ist gering, solange '
      + 'man langsam absenkt und mit den Händen abfängt.',
    schutz: 'hamstrings',
  },
  copenhagen: {
    name: 'Copenhagen Adduction',
    koerpergewicht: true,
    ohneLast: true,
    muskeln: { adduktoren: 1, rumpf: 0.5 },
    risiko: 'niedrig',
    risikoNotiz: 'Mit kurzem Hebel anfangen (Knie auf der Auflage), erst später mit gestrecktem '
      + 'Bein. Zu früh am langen Hebel zieht die Adduktoren selbst in Mitleidenschaft.',
    schutz: 'leiste',
  },
  wadenheben: {
    name: 'Wadenheben stehend',
    schritt: 5,
    muskeln: { waden: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Volle Bewegungsamplitude über eine Stufe, oben kurz halten. Belastet die '
      + 'Achillessehne kontrolliert – genau das, was sie braucht.',
    schutz: 'achillessehne',
  },
  wadenhebenSitzend: {
    name: 'Wadenheben sitzend',
    schritt: 5,
    muskeln: { waden: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Trifft bei gebeugtem Knie den Schollenmuskel, den das stehende Wadenheben '
      + 'kaum erreicht. Er trägt beim Laufen den größeren Teil der Last.',
    schutz: 'achillessehne',
  },
  tibialisRaise: {
    name: 'Zehenheben (Tibialis)',
    koerpergewicht: true,
    ohneLast: true,
    muskeln: { schienbein: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Gegenspieler der Wade. Kostet zwei Minuten und ist die naheliegendste '
      + 'Maßnahme gegen Schienbeinbeschwerden beim Wiedereinstieg ins Laufen.',
  },
  einbeinstand: {
    name: 'Einbeinstand mit Störreizen',
    koerpergewicht: true,
    ohneLast: true,
    muskeln: {},
    risiko: 'niedrig',
    risikoNotiz: 'Balance auf einem Bein, Augen zu oder Ball zuwerfen lassen. Wirkt über '
      + 'Ansteuerung, nicht über Kraft.',
    schutz: 'sprunggelenk',
  },
  seitstuetz: {
    name: 'Seitstütz mit Beinheben',
    koerpergewicht: true,
    ohneLast: true,
    muskeln: { rumpf: 1, gesaess: 0.5 },
    risiko: 'niedrig',
    risikoNotiz: 'Trainiert die seitliche Rumpfkette und den Gesäßmuskel, der das Becken beim '
      + 'einbeinigen Aufsetzen stabil hält.',
  },
  pallofPress: {
    name: 'Pallof Press',
    schritt: 2.5,
    muskeln: { rumpf: 1 },
    risiko: 'niedrig',
    risikoNotiz: 'Gegen Rotation halten statt sich zu drehen. Genau die Aufgabe, die der Rumpf '
      + 'beim Sprint hat – er soll die Kraft übertragen, nicht selbst Bewegung erzeugen.',
  },
};

/**
 * Doppelte Progression: Erst die Wiederholungen im vorgegebenen Bereich nach
 * oben arbeiten, dann die Last erhöhen und im Bereich wieder unten anfangen.
 * Das ist die konservative Variante – sie steigert nur, wenn die Leistung im
 * letzten Training tatsächlich stand, statt nach Kalender zu erhöhen.
 */
export const PROGRESSION = {
  // So viele Sätze müssen das obere Ende des Bereichs erreicht haben.
  anteilFuerSteigerung: 1.0,
  // Nach zwei Einheiten ohne Fortschritt ist die Last zu hoch angesetzt.
  einheitenBisRuecknahme: 3,
  ruecknahmeProzent: 0.9,
};

/** Nachschlagen einer Quelle für die Oberfläche. */
export function quelle(id) {
  return QUELLEN[id] || null;
}
