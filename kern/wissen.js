// Evidenzbasis des Trackers.
//
// Jede Zahl, die der Planer oder der Ernährungsrechner ausspuckt, kommt aus
// diesem Modul – und jede trägt hier ihre Quelle. Wer wissen will, warum das
// Tool 1,9 g Eiweiß pro Kilo vorschlägt und nicht 3, findet die Antwort an
// genau einer Stelle statt verstreut im Code.
//
// Bewertung der Belege:
//   'stark'   – Metaanalysen, Positionspapiere von Fachgesellschaften,
//               Konsensuspapiere, große randomisierte Studien
//   'solide'  – einzelne kontrollierte Studien, konsistente Übersichtsarbeiten
//   'praxis'  – Trainerkonsens ohne harte Studienlage; als solcher gekennzeichnet
//
// Die Güte ist keine Meinung, sondern folgt aus dem Studiendesign: Jede Quelle
// trägt in `art`, was sie ist, und ein Test rechnet die Güte daraus nach. Sonst
// wandert „stark" mit der Zeit dorthin, wo man das Ergebnis mag – drei Quellen
// standen genau so da, bis das Feld eingeführt wurde.

export const QUELLEN = {
  morton2018: {
    kurz: 'Morton et al. 2018, Br J Sports Med',
    titel: 'Systematic review, meta-analysis and meta-regression of protein supplementation',
    kern: 'Zuwachs an fettfreier Masse plateaut bei ~1,62 g Protein/kg/Tag (95 %-KI 1,03–2,20).',
    art: 'metaanalyse',
    umfang: '49 Studien, 1.863 Teilnehmer',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
  },
  wilson2012: {
    kurz: 'Wilson et al. 2012, J Strength Cond Res',
    titel: 'Concurrent training: a meta-analysis examining interference',
    kern: 'Interferenz wächst mit Häufigkeit (r −0,26 bis −0,35) und Dauer (r −0,29 bis −0,75) '
      + 'des Ausdauertrainings. Laufen stört Hypertrophie und Kraft deutlich, Radfahren nicht.',
    art: 'metaanalyse',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22002517/',
  },
  robineau2016: {
    kurz: 'Robineau et al. 2016, J Strength Cond Res',
    titel: 'Specific training effects of concurrent aerobic and strength exercises',
    kern: 'Liegen Kraft- und Ausdauerreiz am selben Tag, mindert ein Abstand von ≥6 h '
      + 'die Interferenz gegenüber direkt aufeinanderfolgenden Einheiten.',
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26694508/',
  },
  lauersen2014: {
    kurz: 'Lauersen et al. 2014, Br J Sports Med',
    titel: 'The effectiveness of exercise interventions to prevent sports injuries',
    kern: 'Krafttraining senkt akute Sportverletzungen auf weniger als ein Drittel und '
      + 'Überlastungsschäden um fast die Hälfte. 25 Studien, 26 610 Teilnehmer. '
      + 'Dehnen zeigte dagegen keinen Effekt.',
    art: 'metaanalyse',
    umfang: '25 Studien, 26.610 Teilnehmer',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24100287/',
  },
  haroy2019: {
    kurz: 'Harøy et al. 2019, Br J Sports Med',
    titel: 'The Adductor Strengthening Programme prevents groin problems',
    kern: 'Ein Programm aus einer einzigen Übung – der Copenhagen Adduction – senkte '
      + 'Leistenprobleme um 41 %. Adduktorenkraft ist der wichtigste beeinflussbare Risikofaktor.',
    art: 'rct',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30498004/',
  },
  fifa11plus: {
    kurz: 'Metaanalyse 2025, Sports (Basel)',
    titel: 'Impact of the FIFA 11+ neuromuscular training programme on ankle injury',
    kern: 'Neuromuskuläres Aufwärmen mit Balance- und Sprungelementen senkte '
      + 'Sprunggelenksverletzungen um 33 %. Wirkt ab zwei Anwendungen pro Woche.',
    art: 'metaanalyse',
    guete: 'stark',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12371935/',
  },
  tanaka2001: {
    kurz: 'Tanaka et al. 2001, J Am Coll Cardiol',
    titel: 'Age-predicted maximal heart rate revisited',
    kern: 'Maximalpuls ≈ 208 − 0,7 × Alter. Metaanalyse aus 351 Studien mit 18 712 Personen. '
      + 'Deutlich treffsicherer als die verbreitete Formel 220 − Alter, aber immer noch '
      + 'mit rund 7 Schlägen Streuung – individuell also weiterhin unzuverlässig.',
    art: 'metaanalyse',
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
    art: 'uebersicht',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24578692/',
  },
  swinton2011: {
    kurz: 'Swinton et al. 2011, J Strength Cond Res',
    titel: 'A biomechanical analysis of straight and hexagonal barbell deadlifts',
    kern: 'Die Sechskantstange verlagert die Last in die Körperachse. Das verkürzt den '
      + 'Hebelarm und senkt die Spitzenmomente an der Lendenwirbelsäule deutlich – '
      + 'bei vergleichbarer Kraftentwicklung.',
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21659894/',
  },
  vandyk2019: {
    kurz: 'van Dyk et al. 2019, Br J Sports Med',
    titel: 'Nordic hamstring exercise and hamstring injury prevention – meta-analysis',
    kern: 'Programme mit Nordic Hamstring senken Hamstring-Verletzungen um etwa 51 %. '
      + 'Die Zahl ist umstritten – siehe impellizzeri2021.',
    art: 'metaanalyse',
    umfang: '8.459 Athletinnen und Athleten',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/31118191/',
  },
  impellizzeri2021: {
    kurz: 'Impellizzeri et al. 2021, J Clin Epidemiol',
    titel: 'Why methods matter in a meta-analysis: a reappraisal showed inconclusive '
      + 'injury preventive effect of Nordic hamstring exercise',
    kern: 'Nachrechnung derselben Studien mit strengerer Methodik: Der Schutzeffekt ließ sich '
      + 'nicht bestätigen. Gründe sind ein hohes Risiko für Publikationsbias, widersprüchliche '
      + 'Einzeleffekte und kaum Daten außerhalb des Fußballs. Die Autoren nennen die Wirkung '
      + 'nicht widerlegt, sondern unklar. Die Gegenrede der ursprünglichen Autoren steht in '
      + 'derselben Zeitschrift.',
    art: 'metaanalyse',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34520846/',
  },
  pelland2025: {
    kurz: 'Pelland et al. 2025, Sports Medicine',
    titel: 'The Resistance Training Dose Response: Meta-Regressions Exploring the Effects '
      + 'of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains',
    kern: 'Deutlich größer als Schoenfeld 2017 und im Kern gleichlautend: Mehr Umfang bringt '
      + 'mehr – bei abnehmendem Grenzertrag, für Maximalkraft ausgeprägter als für Muskelmasse. '
      + 'Häufigkeit hilft der Kraft, für Hypertrophie ist sie bei gleichem Wochenumfang '
      + 'praktisch belanglos.',
    art: 'metaanalyse',
    umfang: '67 Studien, 2.058 Teilnehmer',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/41343037/',
  },
  seiler2010: {
    kurz: 'Seiler 2010, Int J Sports Physiol Perform',
    titel: 'What is best practice for training intensity and duration distribution?',
    kern: 'Ausdauerathleten fahren durchweg ~80 % des Umfangs niedrigintensiv, ~20 % hart '
      + '(polarisiertes Modell). Viel „Mitteltempo" bringt Ermüdung ohne Zusatznutzen.',
    art: 'uebersicht',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20861519/',
  },
  schoenfeld2017: {
    kurz: 'Schoenfeld et al. 2017, J Sports Sci',
    titel: 'Dose-response relationship between weekly resistance training volume and muscle mass',
    kern: 'Hypertrophie steigt dosisabhängig; ab ~10 harten Sätzen pro Muskelgruppe und Woche '
      + 'liegt der Zuwachs deutlich über niedrigeren Umfängen.',
    art: 'metaanalyse',
    umfang: '15 Studien, 34 Trainingsgruppen',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27433992/',
  },
  schoenfeld2018: {
    kurz: 'Schoenfeld & Aragon 2018, J Int Soc Sports Nutr',
    titel: 'How much protein can the body use in a single meal?',
    kern: 'Für maximale Muskelproteinsynthese ~0,4 g/kg pro Mahlzeit über mindestens '
      + 'vier Mahlzeiten – also rund 1,6 g/kg am Tag als Untergrenze.',
    art: 'uebersicht',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29497353/',
  },
  impellizzeri2020: {
    kurz: 'Impellizzeri et al. 2020, J Orthop Sports Phys Ther',
    titel: 'Acute:Chronic Workload Ratio – conceptual issues and fundamental pitfalls',
    kern: 'Das ACWR taugt nicht als Verletzungsvorhersage: uneinheitliche Lastmaße, '
      + 'willkürliche Zeitfenster, problematische Statistik. Als grobe Ampel für '
      + 'Belastungssprünge bleibt es brauchbar – mehr nicht.',
    art: 'uebersicht',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32741325/',
  },
  foster2001: {
    kurz: 'Foster et al. 2001, J Strength Cond Res',
    titel: 'A new approach to monitoring exercise training',
    kern: 'Session-RPE × Dauer in Minuten liefert eine brauchbare interne Belastungszahl.',
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11708692/',
  },
  mah2011: {
    kurz: 'Mah et al. 2011, Sleep',
    titel: 'Effects of sleep extension on athletic performance',
    kern: 'Schlafverlängerung auf ~10 h verbesserte Sprintzeiten und Reaktionszeit messbar. '
      + 'Schlaf ist die wirksamste Erholungsmaßnahme, die es gibt.',
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21731144/',
  },
  haugen2019: {
    kurz: 'Haugen et al. 2019, Int J Sports Physiol Perform',
    titel: 'The training and development of elite sprint performance',
    kern: 'Sprint bei ≥95 % Maximalgeschwindigkeit oder <70 % zur Erholung – der Bereich '
      + 'dazwischen ermüdet, ohne die Schnelligkeit zu entwickeln. Wochenumfang an '
      + 'hochwertigem Sprint typischerweise 1000–2000 m.',
    art: 'uebersicht',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30840517/',
  },
  mountjoy2023: {
    kurz: 'Mountjoy et al. 2023, Br J Sports Med (IOC Consensus)',
    titel: 'REDs – Relative Energy Deficiency in Sport',
    kern: 'Energieverfügbarkeit unter 30 kcal/kg fettfreier Masse gilt als kritisch niedrig; '
      + '~45 kcal/kg FFM gelten als solide Versorgung.',
    art: 'konsens',
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
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21558571/',
  },
  kerksick2018: {
    kurz: 'Kerksick et al. 2018, J Int Soc Sports Nutr',
    titel: 'ISSN exercise & sports nutrition review',
    kern: 'Kraft-/Schnellkraftsportler: 4–7 g Kohlenhydrate/kg/Tag je nach Umfang, '
      + 'Protein 1,4–2,0 g/kg. Ausdauerlastige Tage rechtfertigen 6–10 g KH/kg.',
    art: 'positionspapier',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/30068354/',
  },
  kreider2017: {
    kurz: 'Kreider et al. 2017, J Int Soc Sports Nutr',
    titel: 'ISSN position stand: creatine supplementation',
    kern: 'Kreatin-Monohydrat 3–5 g/Tag ist das am besten belegte Supplement für '
      + 'Schnellkraft und Wiederholungsleistung; Ladephase optional.',
    art: 'positionspapier',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28615996/',
  },
  guest2021: {
    kurz: 'Guest et al. 2021, J Int Soc Sports Nutr',
    titel: 'ISSN position stand: caffeine and exercise performance',
    kern: '3–6 mg Koffein/kg, 30–60 min vorher, verbessert Sprint- und Kraftleistung zuverlässig.',
    art: 'positionspapier',
    guete: 'stark',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33388079/',
  },
  suchomel2016: {
    kurz: 'Suchomel et al. 2016, Sports Med',
    titel: 'The importance of muscular strength in athletic performance',
    kern: 'Relative Maximalkraft hängt eng mit Sprint- und Sprungleistung zusammen; '
      + 'ab etwa der doppelten Körpermasse in der Kniebeuge flacht der Zusatznutzen ab.',
    art: 'uebersicht',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26838985/',
  },
  cunningham1980: {
    kurz: 'Cunningham 1980, Am J Clin Nutr',
    titel: 'A reanalysis of the factors influencing basal metabolic rate',
    kern: 'Grundumsatz = 500 + 22 × fettfreie Masse (kg). Bei bekanntem Körperfettanteil '
      + 'treffsicherer als Formeln auf Basis des Gesamtgewichts.',
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/7435418/',
  },
  mifflin1990: {
    kurz: 'Mifflin & St Jeor 1990, Am J Clin Nutr',
    titel: 'A new predictive equation for resting energy expenditure',
    kern: 'Grundumsatz ohne bekannten Körperfettanteil: 10 × kg + 6,25 × cm − 5 × Jahre + s.',
    art: 'einzelstudie',
    guete: 'solide',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
  helms2014: {
    kurz: 'Helms et al. 2014, Int J Sport Nutr Exerc Metab',
    titel: 'Evidence-based recommendations for natural bodybuilding contest preparation',
    kern: 'Im Kaloriendefizit schützt mehr Protein die Magermasse: 2,3–3,1 g/kg fettfreier Masse.',
    art: 'uebersicht',
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
  // Hochwertiger Sprintumfang pro Woche in Metern, je Phase.
  //
  // Haugen 2019 nennt 1000–2000 m für Sprinter, die hauptberuflich sprinten.
  // Wer daneben Kraft und Ausdauer trainiert, erholt sich davon nicht – die
  // Werte hier liegen bewusst darunter. Lieber weniger Meter bei voller
  // Geschwindigkeit als die Literaturzahl bei 90 %, denn unterhalb von ~95 %
  // wird Schnelligkeit nicht mehr entwickelt.
  //
  // Hier stand vorher {1000, 900, 700, 450}, und der Planer multiplizierte das
  // noch einmal mit `PHASEN[…].volumenFaktor` – die Periodisierung war zweimal
  // aufgeschrieben und wirkte zweimal. Herausgekommen sind die Werte unten:
  // Die Entlastungswoche hat nie 450 m geplant, sondern 225. Das ist die Zahl,
  // an der die Literaturangabe gemessen werden muss, also steht sie jetzt hier.
  // Die Rechnung im Planer wurde entsprechend entfernt, der Plan bleibt gleich.
  //
  // Was dabei sichtbar wird und eine Entscheidung braucht: 225 m sind bei zwei
  // Sprinttagen vier Läufe je Einheit – genau die Untergrenze, die der Planer
  // nicht unterschreitet. Die Entlastungswoche liegt also auf dem Anschlag.
  wochenumfangMeter: { aufbau: 1000, intensivierung: 720, realisierung: 420, entlastung: 225 },
  // Obergrenze hochwertiger Läufe je Einheit. Beschleunigung verträgt mehr,
  // weil die Belastung je Lauf kürzer ist als bei Höchstgeschwindigkeit.
  maxLaeufeProEinheit: { beschleunigung: 16, maximalgeschwindigkeit: 12 },
  // Die Streckenlänge ist die Regel, an der die ganze Sprintplanung hängt:
  // Zusätzliches Volumen kommt über Sätze, nie über längere Läufe – sonst
  // wird daraus Tempohärte. Sie stand als nackte 30 in `plan.js`, also
  // ausgerechnet die Zahl, aus der der Planer alle Meter herleitet.
  distanzMeter: 30,
  // Läufe je Satz und Pause zwischen den Sätzen. Trainerpraxis: Die Pause
  // zwischen einzelnen Läufen folgt aus der Intensitätsforderung
  // (`pauseSekundenProZehnMeter`), die Satzeinteilung selbst ist Gliederung.
  laeufeProSatz: { beschleunigung: 5, maximalgeschwindigkeit: 4 },
  satzPauseMinuten: 6,
  guetePausen: 'praxis',
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
  // Die Sätze je Muskelgruppe und Woche standen hier ein zweites Mal als
  // `saetzeProMuskelWoche: { minimum: 10, ziel: 14, obergrenze: 20 }` – dieselbe
  // Größe wie in `VOLUMEN` (10 / 20), nur mit anderen Feldnamen. Gelesen wurde
  // davon einzig `minimum`; `ziel: 14` und `obergrenze: 20` rief niemand auf,
  // und `ziel` hatte auch keine Quelle: Weder Schoenfeld 2017 noch Pelland 2025
  // nennen einen Zielwert von 14, sie beschreiben einen Anstieg mit abnehmendem
  // Grenzertrag. Eine erfundene Mitte zwischen zwei belegten Marken ist genau
  // das, was dieser Tracker nicht tun soll. Die Größe steht jetzt nur noch in
  // `VOLUMEN`. Familie von Falle 13 und 21.
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
  /**
   * Wie lange eine Krafteinheit dauert – gerechnet aus den Sätzen, die
   * tatsächlich vorgegeben sind.
   *
   * Vorher stand die Dauer als `15 + Übungen × 9 + Prophylaxe × 4` im Planer
   * und kannte die Satzzahl nicht: Die Einheit war in jeder Woche 76 Minuten
   * lang, in der Entlastungswoche mit 10 Sätzen genauso wie in der
   * Spitzenwoche mit 13. Da die Minuten in den Kalorienbedarf und in die
   * Belastungsrechnung gehen, war das keine Beschriftungsfrage.
   *
   * Die Zahlen sind Praxis, keine Messung – aber die Rangfolge folgt aus der
   * Pause: Maximalkraft braucht sie voll (drei bis fünf Minuten), im
   * Hypertrophiebereich reichen zwei. Die Ausführung selbst ist bei schweren
   * Sätzen kürzer als bei zwölf Wiederholungen, das gleicht sich teilweise aus.
   */
  dauer: {
    aufwaermenMinuten: 15,
    minutenProSatz: { hypertrophie: 3, maximalkraft: 4, explosivkraft: 3.5 },
    // Prophylaxe läuft ohne nennenswerte Pause – zwei Sätze am Stück.
    minutenProProphylaxeSatz: 1.5,
    guete: 'praxis',
  },
};

/**
 * Wie stark der Ausrichtungsregler den **Umfang** skaliert – nicht nur die
 * Zahl der Einheiten.
 *
 * Ohne das kannte der Umfang den Regler gar nicht: Die Sprintmeter ergaben
 * sich allein aus der Zahl der Sprinttage mal der Qualitätsgrenze, die
 * Ausdauerminuten waren fest. Weil die Einheitenzahl gerundet wird, fielen
 * damit über zwanzig Reglerstellungen auf sieben verschiedene Wochen zusammen
 * – bei drei Trainingstagen waren die Stände 40 bis 75 **buchstäblich
 * identisch**. Wer den Regler schob, sah nichts passieren, und wo doch, sprang
 * es: von Stand 35 auf 40 halbierten sich die Sprintmeter, *und* die
 * Ausdauerminuten fielen mit.
 *
 * Jetzt trägt jeder Schritt. Die Werte sind Praxis und bewusst asymmetrisch:
 * Beim Sprint geht der Umfang weit zurück, weil Sprintmeter neben viel
 * Ausdauer nicht mehr erholt werden. Bei der Ausdauer geht er weit hoch, weil
 * eine lockere Einheit für einen Sprinter Erholung ist (rund 35 min) und für
 * einen Ausdauersportler die eigentliche Arbeit (rund 90 min). Am
 * Sprint-Anschlag steht der Literaturwert aus `SPRINT.wochenumfangMeter`,
 * darunter weniger.
 */
export const AUSRICHTUNG_UMFANG = {
  sprintMeter: { beiSprint: 1.0, beiAusdauer: 0.3 },
  ausdauerMinuten: { beiSprint: 0.65, beiAusdauer: 1.6 },
  /**
   * Auch die Kraft folgt dem Regler – vorher tat sie es nicht.
   *
   * Die Krafteinheit war über den **ganzen** Regler identisch: dreizehn Sätze,
   * fünf Übungen, derselbe Wiederholungsbereich, ob reiner Sprinter oder
   * reiner Ausdauersportler. Die Reglerbeschriftung verspricht bei 100 aber
   * „Krafttraining nur noch erhaltend" und bei 0 „alles auf Schnelligkeit und
   * Maximalkraft".
   *
   * Bewegt werden die **Sätze**, nicht die Zahl der Übungen: Jede Übung im
   * Plan steht für ein Bewegungsmuster, das auch ein Ausdauersportler braucht –
   * Kniebeuge, Hüftzug, Ziehen, Drücken. Weglassen hieße, ein Muster
   * aufzugeben; weniger Sätze heißt, dasselbe Muster günstiger zu dosieren.
   * Die Untergrenze von zwei Sätzen je Übung bleibt: Ein einzelner Satz ist
   * kein Reiz mehr.
   */
  kraftSaetze: { beiSprint: 1.25, beiAusdauer: 0.7 },
  guete: 'praxis',
};

/** Polarisierte Intensitätsverteilung (Seiler 2010). */
export const AUSDAUER = {
  quelle: 'seiler2010',
  anteilNiedrigintensiv: 0.8,
  anteilHochintensiv: 0.2,
  // Radfahren und Rudern stören die Kraftentwicklung weniger als Laufen. Die
  // Rangfolge stammt aus Wilson 2012, die einzelnen Faktoren sind Praxis: Die
  // Metaanalyse belegt, *dass* Laufen stärker stört – nicht, dass Rudern
  // genau 0,45 von der Störwirkung des Laufens hat.
  quelleInterferenz: 'wilson2012',
  interferenzFaktor: { rad: 0.35, rudern: 0.45, schwimmen: 0.4, crosstrainer: 0.5, laufen: 1.0 },
  // Am selben Tag mindert Abstand die Interferenz.
  quelleAbstand: 'robineau2016',
  mindestabstandStunden: 6,
  guete: 'praxis',
  /**
   * Aufbau einer Ausdauereinheit. Diese Zahlen standen in `plan.js`, also
   * außerhalb der einzigen Stelle für Zahlen – und die Intervalleinheit
   * beschrieb dort in *jeder* Woche „5 × 3 min hart", während die Überschrift
   * je nach Phase 60, 51, 42 oder 38 Minuten behauptete. Der Volumenfaktor
   * bewegte nur die Zahl, nicht den Inhalt: In der Entlastungswoche stand
   * „38 min" über genau derselben Einheit wie in der Spitzenwoche.
   *
   * Die Zahl der Intervalle folgt jetzt dem Volumen, und die Dauer folgt den
   * Intervallen. Praxis, keine Studienlage: Seiler 2010 belegt die
   * *Verteilung* zwischen locker und hart, nicht die Länge eines einzelnen
   * Intervalls. Drei Minuten hart bei gleich langer Pause ist ein
   * gebräuchliches VO2max-Format, mehr ist damit nicht behauptet.
   */
  dauer: {
    einfahrenMinuten: 15,
    ausfahrenMinuten: 10,
    intervall: { arbeitMinuten: 3, pauseMinuten: 3, anzahl: 5, minAnzahl: 3 },
    // Teilt sich die lockere Einheit den Tag mit dem Krafttraining, wird sie
    // kürzer angesetzt – sonst wird aus Erholung Umfang.
    lockerMinuten: { allein: 55, geteilterTag: 35 },
    /**
     * Untergrenze für eine Ausdauereinheit.
     *
     * Zwei Kürzungen multiplizieren sich sonst: der geteilte Tag (35 statt 55)
     * und der Ausrichtungsregler am Sprint-Anschlag (0,65). Heraus kamen
     * **23 Minuten** – das ist keine Grundlageneinheit mehr, sondern ein
     * längeres Aufwärmen, und der Tracker konnte die Intensitätsverteilung
     * seines eigenen Plans nicht mehr benoten. Dieselbe Familie wie Falle 36:
     * Zwei für sich sinnvolle Faktoren ergeben zusammen Unsinn.
     */
    mindestMinuten: 30,
    guete: 'praxis',
  },
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
  /**
   * Ab welchem Wochenumfang sich das Verhältnis überhaupt benoten lässt.
   *
   * Seiler beschreibt **Ausdauerathleten** und deren Umfänge. Bei zwei bis vier
   * Ausdauereinheiten neben Sprint und Kraft ist der harte Anteil keine
   * Trainingsentscheidung mehr, sondern eine Frage der Stückelung: Eine
   * Intervalleinheit dauert rund eine Stunde und ist bei drei Einheiten
   * zwangsläufig ein Drittel der Zeit. Es gibt keine Aufteilung, die bei diesem
   * Umfang auf 20 % käme – außer gar keiner harten Einheit.
   *
   * Die Grenze ist deshalb gerechnet, nicht gegriffen, und sie behauptet nichts
   * über Seilers Kohorten: Damit eine Intervalleinheit von einer Stunde
   * überhaupt ein Fünftel der Zeit sein *kann*, braucht es fünf Stunden Ausdauer
   * in der Woche. Darunter wird der Anteil angezeigt, aber nicht bewertet.
   *
   * Die Grauzone bleibt davon unberührt – die ist bei jedem Umfang
   * aussagekräftig und ist ohnehin der Teil, an dem Ausdauertraining scheitert.
   */
  minMinutenProWocheFuerVerhaeltnis: 300,
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
 * Womit der Protokolldialog den RPE-Regler vorbelegt – je Einheitenart.
 *
 * Vorher stand er fest auf 7 („hart"), egal was anstand. Das ist nicht bloß
 * unschön: RPE × Minuten *ist* die Belastungszahl. Eine 95-minütige lockere
 * Ausfahrt kam damit auf 665 statt auf 380 Belastungseinheiten – gut drei
 * Viertel zu viel, und zwar ausgerechnet bei den längsten Einheiten. Davon
 * hängen Wochenlast, Akut-zu-chronisch-Verhältnis, Monotonie und
 * Entlastungsbedarf ab. Zugleich rutschte jede lockere Einheit über die harte
 * Grenze und die Intensitätsverteilung meldete zu viel Hartes – genau der
 * Fehlalarm, den die Verteilung eigentlich aufdecken soll.
 *
 * Die Werte sind keine Messung, sondern die geplante Absicht der jeweiligen
 * Einheit: Was locker gedacht ist, startet in der lockeren Zone. Sie sind
 * ausdrücklich nur eine Vorbelegung – wer sich anders gefühlt hat, schiebt den
 * Regler, und beim Nachbearbeiten gewinnt ohnehin der gespeicherte Wert.
 */
/**
 * Die Wörter zur RPE-Skala (Borg CR10).
 *
 * Standen bisher in der Oberfläche – eine fachliche Skala, die dort nichts zu
 * suchen hat. Wichtiger: Sie widersprachen den Ausdauerzonen. Bei RPE 4 stand
 * „etwas fordernd", während `AUSDAUER_ZONEN` denselben Wert noch als „Locker –
 * du kannst in ganzen Sätzen sprechen" führt. Wer beim Protokollieren einer
 * lockeren Ausfahrt „etwas fordernd" liest, schiebt den Regler nach unten,
 * und die Verteilung stimmt danach nicht mehr.
 *
 * Beide Skalen bleiben stehen – Borg beschreibt das Gefühl, die Zone die
 * Trainingswirkung –, aber der Dialog zeigt jetzt beide nebeneinander, statt
 * die eine gegen die andere auszuspielen.
 */
/**
 * Bis zu wie vielen Wiederholungen die Epley-Formel taugt.
 *
 * Über etwa zehn Wiederholungen driftet die Schätzung deutlich ab – die Formel
 * ist an schweren Sätzen kalibriert, und wer zwanzig Wiederholungen schafft,
 * ist eher ausdauernd als maximalkräftig. Die Grenze selbst ist Praxis, kein
 * Messwert; verbreitet ist die Angabe „bis 10, danach zunehmend ungenau".
 *
 * Stand an vier Stellen im Code als nackte 10 – in `leistung.js` gleich
 * dreimal, dazu in `profil.js` und `zustand.js`. Genau die Sorte Fachzahl, die
 * in die Oberfläche zurückwandert und dann auseinanderläuft.
 *
 * **Wichtig ist, was oberhalb passiert:** Ein Wiederholungstest mit 11
 * Klimmzügen ergab bisher stillschweigend gar kein Einer-Maximum. Für jemanden
 * auf dem Weg zum Muscle-Up ist das der Normalfall – Stufe 2 verlangt
 * ausdrücklich zwölf saubere Klimmzüge. Wer sich von 10 auf 11 verbessert, darf
 * nicht erleben, dass seine Kraftzahl verschwindet. Die Zahl bleibt
 * unberechenbar, aber das wird jetzt gesagt.
 */
export const EPLEY = {
  maxWiederholungen: 10,
  guete: 'praxis',
  quelle: 'suchomel2016',
};

export const RPE_WORTE = ['', 'sehr leicht', 'leicht', 'moderat', 'etwas fordernd',
  'fordernd', 'fordernd+', 'hart', 'sehr hart', 'fast maximal', 'maximal'];

export const RPE_ERWARTUNG = {
  sprint: 8,
  plyometrie: 7,
  kraft: 8,
  ausdauerLocker: 4,
  ausdauerLang: 4,
  ausdauerIntervalle: 9,
  technik: 3,
  mobilitaet: 2,
  guete: 'praxis',
  quelle: 'foster2001',
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
    // Nicht „halbieren": Der Faktor unten ist 0,5, davon kommt aber nur ein
    // Teil an – Sätze haben eine Untergrenze, das Aufwärmen wird nicht gekürzt.
    beschreibung: 'Umfang deutlich runter, Lasten halten – hier entsteht die Anpassung.',
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
  // Für die Sonderlage „Defizit bei laufendem Training" – dort geht es nicht
  // mehr um Durchschnittsempfehlungen, sondern darum, Muskelmasse zu halten,
  // während die Energie knapp ist.
  quelleDefizit: 'helms2014',
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
  /**
   * kcal je kg fettfreier Masse (Mountjoy 2023).
   *
   * **Die Zielmarke von 45 ist bei „Gewicht halten" nicht für jeden
   * erreichbar** – und das ist keine Eigenschaft des Essverhaltens, sondern
   * der Rechnung. Wer genau seinen Erhaltungsbedarf isst, hat definitionsgemäß
   *
   *     EV = Alltagsfaktor × Grundumsatz / FFM
   *
   * denn die Trainingskalorien stecken in beiden Termen und kürzen sich weg.
   * Mit Cunningham (500 + 22 × FFM) wird daraus
   * `Alltagsfaktor × (500 / FFM + 22)`. Selbst beim höchsten Alltagsfaktor
   * (1,5) reicht das nur bis FFM ≈ 62,5 kg für die 45. Nils liegt bei 68,9 kg
   * fettfreier Masse und kommt damit höchstens auf 43,9 – real auf 39,5, also
   * dauerhaft in der Stufe „knapp" mit dem Rat „Mehr essen, nicht mehr
   * trainieren". Bei einem Kalorienziel, das der Tracker selbst vorgibt.
   *
   * Beide Zahlen sind einzeln richtig: Die Alltagsfaktoren liegen bewusst
   * unter den PAL-Werten, weil das Training separat dazukommt (Falle 5), und
   * die 45 stammen aus der RED-S-Leitlinie. Zusammen ergeben sie eine Note,
   * die der eigene Vorschlag nicht bestehen kann. Deshalb wird der Wert
   * zusätzlich gegen den **eigenen Erhaltungsbedarf** gehalten – siehe
   * `energieverfuegbarkeit()`. Die Untergrenze `kritisch` bleibt davon
   * unberührt: Sie ist der Punkt, an dem es gesundheitlich ernst wird, und
   * darf nie weich werden.
   */
  energieverfuegbarkeit: {
    kritisch: 30,
    knapp: 40,
    ziel: 45,
    /**
     * Wie weit der gemessene Wert unter dem Erhaltungswert liegen darf, bevor
     * er als Unterdeckung zählt. 1 kcal/kg FFM sind bei Nils rund 70 kcal am
     * Tag – weniger, als ein Essensprotokoll überhaupt auflöst.
     *
     * **Nur diese Zahl ist Trainerpraxis**; die Schwellen darüber stammen aus
     * der RED-S-Leitlinie. Ein `guete: 'praxis'` am ganzen Block stand hier
     * kurzzeitig und war falsch – es hätte 30, 40 und 45 mit als unbelegt
     * ausgewiesen.
     */
    protokollrauschen: 1,
    protokollrauschenGuete: 'praxis',
  },
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

  /**
   * Ab wie vielen Trainingsminuten pro Woche der Planer einen Hinweis setzt.
   *
   * Stand als nackte 600 in `plan.js`, mitten in einem Warntext („Das ist
   * viel") – eine fachliche Schwelle außerhalb der einzigen Stelle für Zahlen.
   * Zehn Stunden sind kein Grenzwert, sondern die Marke, ab der Umfang und
   * Erholung auseinanderlaufen können; deshalb ein Hinweis und kein Verbot,
   * und deshalb `praxis`.
   */
  hinweisAbWochenminuten: 600,
  hinweisAbWochenminutenGuete: 'praxis',

  /**
   * Monotonie nach Foster: Wochenschnitt geteilt durch Streuung, über sieben
   * Tage einschließlich der Ruhetage.
   *
   * Die Schwelle 2,0 stammt aus Fosters Arbeiten an Sportlern, die faktisch
   * **täglich** trainierten. Bei weniger Trainingstagen erzeugen die Ruhetage
   * selbst die Streuung, die den Quotienten klein hält: Bei n Trainingstagen
   * in der Woche liegt das rechnerische Maximum bei `wurzel(n / (7 - n))` –
   * erreicht nur, wenn die Last an jedem Trainingstag exakt gleich ist. Das
   * sind 0,87 bei drei Tagen, 1,15 bei vier und 1,58 bei fünf. Die Schwelle
   * ist unter sechs Trainingstagen also nicht erreichbar, egal wie
   * gleichförmig trainiert wird.
   *
   * Deshalb wird der Wert darunter zwar angezeigt, aber **nicht benotet** –
   * dasselbe Vorgehen wie beim Intensitätsverhältnis, das erst ab einem
   * Mindestumfang eine Note bekommt. Eine niedrigere Schwelle wäre eine
   * erfundene Zahl: Fosters 2,0 auf eine Vier-Tage-Woche umzurechnen gibt die
   * Studienlage nicht her.
   */
  monotonie: {
    hochAb: 2.0,
    minTrainingstageFuerNote: 6,
    guete: 'praxis',
    quelle: 'foster2001',
  },

  /**
   * Wie weit zurück ein Morgen-Check für die Entlastungsfrage zählt.
   *
   * Ohne Fenster gelten schlicht „die letzten fünf" Checks – auch wenn sie drei
   * Monate alt sind. Eine Entlastungsentscheidung betrifft aber diese Woche,
   * und ein Check von vor drei Monaten sagt darüber nichts.
   */
  checkFensterTage: 14,
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

/**
 * Schwellen für die Bereitschaft aus dem Morgen-Check, in Prozent der
 * erreichbaren Punktzahl.
 *
 * Sie standen als nackte Zahlen in `belastung.js` – 45 und 65 für die Ampel,
 * 60 für die Entlastungsfrage. Drei Zahlen auf derselben Skala an zwei
 * Stellen, und keine davon hier: genau die Konstellation, aus der irgendwann
 * vier werden. Belastbare Studienlage gibt es für die Höhe nicht, deshalb
 * `praxis`; belegt ist nur, dass der Schlaf von allen abgefragten Größen die
 * einzige mit klarer Leistungswirkung ist (`mah2011`, siehe WOHLBEFINDEN).
 */
export const BEREITSCHAFT = {
  /**
   * Die Prozentwerte sind feiner angegeben, als die Eingabe hergibt.
   *
   * Fünf Antworten zu je 1–5 ergeben 5 bis 25 Punkte – die Bereitschaft kann
   * also nur Vielfache von 4 % annehmen. Zwischen 44 und 48 liegt nichts, und
   * 45 wird nie erreicht. Wirksam ist die Grenze deshalb als „44 % rot,
   * 48 % gelb"; dasselbe bei 65 (64 gelb, 68 grün) und bei `schwachUnter` 60,
   * das mit 60 auf dem Raster liegt und damit exakt greift.
   *
   * Das ist kein Fehler, aber eine Angabe, die genauer aussieht als sie ist.
   * Aufgefallen beim Randtest: `mutieren.mjs` lässt `<` gegen `<=` an diesen
   * Stellen überleben, und zwar zu Recht – auf einem Raster ohne Punkt bei 45
   * sind beide Fassungen ununterscheidbar. Wer die Marken verschiebt, sollte
   * sie auf Vielfache von 4 legen, sonst bewegt sich nichts.
   */
  // Darunter ist der Tag rot: harte Einheit streichen.
  rotUnter: 45,
  // Darunter gelb: Umfang kürzen, Intensität halten.
  gelbUnter: 65,
  /**
   * Ab wann ein einzelner Check für die Entlastungsfrage als schwach zählt.
   * Bewusst zwischen den beiden Ampelwerten: Ein einzelner gelber Tag ist
   * normal, ein Muster aus knapp-gelben Tagen ist es nicht.
   */
  schwachUnter: 60,
  // Wie viele der letzten Checks das Muster tragen müssen.
  schwacheChecksFuerGrund: 3,
  /**
   * So viele **rote** Checks unter den letzten fünf tragen die
   * Entlastungsempfehlung allein.
   *
   * Sonst ist sie nicht auslösbar: Die Bereitschaft steuert genau einen Grund
   * bei, egal wie schlecht sie ist, und `entlastungFaellig` verlangt zwei. In
   * der Simulation standen 84 Tage in Folge mit allen fünf Antworten auf dem
   * Minimum – und der Tracker sagte durchgehend nur „ein Zeichen im Blick
   * behalten". Die Begründung fürs Zwei-Gründe-Prinzip stammt vom Ruhepuls
   * (unspezifisch, ein Infekt sieht genauso aus) und trägt hier nicht: An
   * jedem dieser Tage hat der Tracker ohnehin schon „harte Einheit streichen"
   * gesagt. Drei solche Tage in fünf sind eine Woche, die sich nicht wie
   * geplant durchführen lässt – das eine Entlastung zu nennen ist ehrlicher,
   * als denselben Tagesrat zum dritten Mal zu wiederholen.
   */
  roteChecksFuerEntlastung: 3,
  guete: 'praxis',
};

/** Fragen des Morgen-Checks. Alle 1–5, höher ist besser. */
export const WOHLBEFINDEN = [
  // Schlaf steht bewusst an erster Stelle: Von allem, was in diesem Check
  // abgefragt wird, ist er die einzige Größe mit belegter Leistungswirkung
  // (mah2011) – und die wirksamste Erholungsmaßnahme überhaupt. Kein
  // Supplement im Tracker kommt in die Nähe dieses Effekts.
  { id: 'schlaf', frage: 'Schlafqualität', quelle: 'mah2011', skala: ['sehr schlecht', 'schlecht', 'okay', 'gut', 'sehr gut'] },
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
 *
 * Die Übungen stehen unter `uebungen` und nicht direkt daneben, damit man über
 * sie iterieren kann, ohne die Quellenangabe als Übung mitzuschleppen. Vorher
 * lag `quelle` auf derselben Ebene; `Object.entries()` lieferte eine Zeile
 * „quelle · suchomel2016" mit, und statt das zu lösen, stand in
 * `app/fortschritt.js` eine handgeschriebene Kopie der ganzen Tabelle. Eine
 * Datenform, die zum Abschreiben einlädt, wird abgeschrieben.
 */
export const KRAFTMARKEN = {
  quelle: 'suchomel2016',
  uebungen: {
    kniebeuge: { einstieg: 1.0, solide: 1.5, stark: 2.0 },
    kreuzheben: { einstieg: 1.25, solide: 1.75, stark: 2.25 },
    bankdruecken: { einstieg: 0.75, solide: 1.0, stark: 1.4 },
    hipthrust: { einstieg: 1.25, solide: 1.75, stark: 2.5 },
  },
};

/**
 * Weg zum Muscle-Up. Jede Stufe hat ein überprüfbares Tor – erst wenn das
 * steht, lohnt die nächste. Die Zusatzlast-Marke (~+40 % Körpergewicht im
 * Klimmzug) ist Trainerpraxis, keine Studienlage.
 *
 * **Was zählbar ist und was nicht:** Ein Zähler weiß, *wie oft*, nicht *wie*.
 * Der Test „Muscle-Ups max." fragt Wiederholungen ab – ob sie mit Schwung
 * gingen, steht nirgends. Die Stufen 9 und 10 unterscheiden sich von Stufe 8
 * aber genau darin. Sie standen früher alle drei auf `muscleups`, die Stufen 8
 * und 9 sogar auf demselben Ziel: Der erste Muscle-Up mit Kip schaltete beide
 * frei, und im Tracker stand „Strikter Muscle-Up – ohne Schwung aus dem Hang"
 * über einer Leistung, die genau das nicht war. Stufe 8 war damit nie der
 * aktuelle Stand, sie wurde immer übersprungen.
 *
 * Sauberkeit ist ein Urteil, keine Zahl – dafür gibt es `manuell`, so wie bei
 * den Stufen 4 bis 7 („Stange berührt das Brustbein"). Stufe 8 bleibt zählbar:
 * der erste Muscle-Up überhaupt, gleich in welchem Stil.
 */
// `uebung` sagt, an welcher Übung des Plans die Stufe hängt. Ohne das stand
// der Hinweis „nächste Stufe" unter Klimmzügen **und** unter Dips – derselbe
// Satz zweimal in einer Einheit, und bei Stufe 5 („Straight-Bar-Dips") unter
// der falschen der beiden. Ab Stufe 7 ist das Tor der Muscle-Up selbst; von
// den zwei Übungen im Plan ist der Klimmzug die nähere, deshalb hängt es dort.
export const MUSCLEUP_STUFEN = [
  { stufe: 1, name: 'Saubere Klimmzüge', tor: '8 Wiederholungen ohne Schwung', pruefung: 'klimmzuege', ziel: 8, uebung: 'klimmzuege' },
  { stufe: 2, name: 'Klimmzug-Volumen', tor: '12 Wiederholungen ohne Schwung', pruefung: 'klimmzuege', ziel: 12, uebung: 'klimmzuege' },
  { stufe: 3, name: 'Zusatzlast', tor: 'Klimmzug mit +25 % Körpergewicht', pruefung: 'zusatzlast', ziel: 0.25, uebung: 'klimmzuege' },
  { stufe: 4, name: 'Hohe Klimmzüge', tor: 'Stange berührt das Brustbein, 5 Wiederholungen', pruefung: 'manuell', ziel: 5, uebung: 'klimmzuege' },
  { stufe: 5, name: 'Straight-Bar-Dips', tor: '8 Wiederholungen an der Stange', pruefung: 'manuell', ziel: 8, uebung: 'dips' },
  { stufe: 6, name: 'Explosive Klimmzüge', tor: 'Hände lösen sich kurz von der Stange', pruefung: 'manuell', ziel: 3, uebung: 'klimmzuege' },
  { stufe: 7, name: 'Übergang', tor: '5 negative Muscle-Ups kontrolliert', pruefung: 'manuell', ziel: 5, uebung: 'klimmzuege' },
  { stufe: 8, name: 'Muscle-Up mit Schwung', tor: 'Erster Muscle-Up mit leichtem Kip', pruefung: 'muscleups', ziel: 1, uebung: 'klimmzuege' },
  { stufe: 9, name: 'Strikter Muscle-Up', tor: 'Ohne Schwung aus dem Hang', pruefung: 'manuell', ziel: 1, uebung: 'klimmzuege' },
  { stufe: 10, name: 'Mehrfach strikt', tor: '5 strikte Muscle-Ups am Stück', pruefung: 'manuell', ziel: 5, uebung: 'klimmzuege' },
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
  // Warum es überhaupt eine Obergrenze gibt: Pelland 2025 rechnet mit 67
  // Studien statt 15 und findet denselben Anstieg, aber mit abnehmendem
  // Grenzertrag – für Maximalkraft deutlicher als für Muskelmasse. Der
  // zwanzigste Satz bringt also nicht, was der zehnte gebracht hat. Eine
  // harte Grenze nach oben ist das nicht, deshalb bleibt die Marke `praxis`.
  quelleGrenzertrag: 'pelland2025',
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
    // Die einzige Schutzzahl im Tracker, die ernsthaft bestritten ist: Eine
    // Nachrechnung derselben Studien mit strengerer Methodik fand den Effekt
    // nicht wieder. Die Übung bleibt trotzdem im Plan – zwei Sätze kosten
    // zwei Minuten, das Risiko der Übung selbst ist gering, und „unklar"
    // heißt nicht „wirkungslos". Aber die 51 % dürfen nicht als gesichert
    // dastehen, und deshalb steht der Vorbehalt auch in der Oberfläche.
    quelleVorbehalt: 'impellizzeri2021',
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
    quelle: 'swinton2011',
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
