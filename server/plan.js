// Der Trainingsplaner.
//
// Aus Reglerstand, verfügbaren Tagen und Trainingswoche entsteht ein konkreter
// Mikrozyklus. Die Regeln dahinter sind nicht verhandelbar, weil sie aus der
// Literatur kommen und nicht aus Geschmack:
//
//   - Sprint nur bei voller Frische, mindestens 48 h Abstand, höchstens 3×/Woche
//   - Am selben Tag zuerst Sprint, dann Kraft: Qualität braucht ein frisches
//     Nervensystem, Kraft verträgt Restmüdigkeit besser
//   - Ausdauer möglichst an anderen Tagen, sonst mit ≥6 h Abstand (Robineau 2016)
//   - Niedrigintensive Ausdauer bevorzugt auf dem Rad, solange Sprint zählt
//     (Wilson 2012: Laufen stört Kraft und Hypertrophie, Radfahren nicht)
//   - 80 % des Ausdauerumfangs locker, 20 % hart (Seiler 2010)
//   - Jede vierte Woche Entlastung

import { SPRINT, KRAFT, AUSDAUER, PHASEN, BLOCKFOLGE, UEBUNGEN } from './wissen.js';
import { schwerpunkte, clamp, round } from './profil.js';
import { arbeitsgewicht, naechsteLast, prozentBereich } from './leistung.js';

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Welche Wochentage bei n Trainingstagen – bewusst mit Lücken für Erholung. */
const TAGESMUSTER = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

/**
 * In welcher Woche des Makrozyklus stehen wir? Ohne Startdatum ist es Woche 1,
 * damit der Planer auch vor dem offiziellen Start etwas Sinnvolles zeigt.
 */
export function trainingswoche(startdatum, heute = new Date()) {
  if (!startdatum) return 1;
  const start = new Date(startdatum);
  if (Number.isNaN(start.getTime())) return 1;
  const tage = Math.floor((heute - start) / 86400000);
  if (tage < 0) return 0; // Start liegt noch in der Zukunft
  return Math.floor(tage / 7) + 1;
}

/** Phase aus der Wochennummer. Nach zwölf Wochen beginnt der Zyklus von vorn. */
export function phaseDerWoche(woche) {
  if (woche < 1) return PHASEN.aufbau;
  const index = (woche - 1) % BLOCKFOLGE.length;
  return PHASEN[BLOCKFOLGE[index]];
}

export function phaseSchluessel(woche) {
  if (woche < 1) return 'aufbau';
  return BLOCKFOLGE[(woche - 1) % BLOCKFOLGE.length];
}

/**
 * Wie viele Einheiten welcher Art. Sprint ist nach oben gedeckelt, weil mehr
 * als drei hochwertige Sprinteinheiten pro Woche nicht mehr erholbar sind –
 * die vierte macht die anderen drei schlechter.
 */
export function einheitenVerteilung(profil) {
  const tage = clamp(Number(profil?.trainingstageProWoche) || 4, 3, 6);
  const anteil = schwerpunkte(profil?.ausrichtung);

  let sprint = Math.round(anteil.sprint * tage * 1.25);
  let kraft = Math.round(anteil.kraft * tage * 1.25);
  let ausdauer = Math.round(anteil.ausdauer * tage * 1.5);

  sprint = clamp(sprint, 0, SPRINT.maxEinheitenProWoche);
  kraft = clamp(kraft, 1, 4);
  ausdauer = clamp(ausdauer, 0, 5);

  // Bei sehr sprintlastiger Ausrichtung bleibt trotzdem eine lockere Einheit
  // stehen: Die aerobe Basis beschleunigt die Erholung zwischen den Sprints.
  if (ausdauer === 0) ausdauer = 1;

  return { tage, sprint, kraft, ausdauer, anteil };
}

/**
 * Sprinttage mit mindestens 48 h Abstand belegen. Greedy von vorn – das reicht,
 * weil die Tagesmuster ohnehin gleichmäßig über die Woche verteilt sind.
 */
function verteileSprint(tage, anzahl) {
  const gewaehlt = [];
  let letzter = -99;
  for (const tag of tage) {
    if (gewaehlt.length >= anzahl) break;
    if (tag - letzter >= 2) {
      gewaehlt.push(tag);
      letzter = tag;
    }
  }
  return gewaehlt;
}

/**
 * Der Wochenplan. Liefert für jeden Trainingstag eine Liste von Einheiten in
 * der Reihenfolge, in der sie absolviert werden sollen.
 */
export function wochenplan(profil, woche = 1, leistung = {}) {
  const verteilung = einheitenVerteilung(profil);
  const schluessel = phaseSchluessel(woche);
  const phase = PHASEN[schluessel];
  const tage = TAGESMUSTER[verteilung.tage] || TAGESMUSTER[4];

  // Der Wiedereinstieg drückt die ersten beiden Wochen bewusst nach unten.
  // Nicht wegen irgendeiner Diagnose, sondern weil nach jeder längeren Pause
  // die Sehnen und Bänder langsamer nachziehen als die Muskulatur und die Lust.
  const einstieg = profil?.wiedereinstieg && woche >= 1 && woche <= 2;
  const einstiegFaktor = einstieg ? (woche === 1 ? 0.6 : 0.8) : 1;
  const volumen = phase.volumenFaktor * einstiegFaktor;

  const sprinttage = verteileSprint(tage, verteilung.sprint);
  const sprintProEinheit = sprinttage.length
    ? Math.round(SPRINT.wochenumfangMeter[schluessel] * volumen / sprinttage.length)
    : 0;

  // Kraft zuerst auf die Sprinttage – die sind ohnehin die harten Tage, so
  // bleiben die übrigen wirklich locker. Danach auf freie Tage auffüllen.
  const krafttage = [];
  for (const tag of sprinttage) {
    if (krafttage.length < verteilung.kraft) krafttage.push(tag);
  }
  for (const tag of tage) {
    if (krafttage.length >= verteilung.kraft) break;
    if (!krafttage.includes(tag)) krafttage.push(tag);
  }

  // Ausdauer auf die Tage ohne Sprint. Erst wenn die ausgehen, teilt sie sich
  // einen Tag mit dem Krafttraining – dann aber mit Abstand.
  const freieTage = tage.filter((t) => !sprinttage.includes(t));
  const ausdauertage = [];
  for (const tag of freieTage) {
    if (ausdauertage.length >= verteilung.ausdauer) break;
    ausdauertage.push(tag);
  }
  for (const tag of tage) {
    if (ausdauertage.length >= verteilung.ausdauer) break;
    if (!ausdauertage.includes(tag)) ausdauertage.push(tag);
  }

  // 80/20 polarisiert: Nur die härtere Minderheit wird zu Intervallen. Bei
  // wenigen Ausdauereinheiten sind das null – die harte Intensität liefern dann
  // die Sprints, und die Ausdauer bleibt reine Erholungsarbeit.
  //
  // Achtung beim Anfassen: slice(-0) ist slice(0) und gäbe das ganze Array
  // zurück. Ohne die ausdrückliche Null-Prüfung würde ausgerechnet der Fall
  // „keine harte Einheit" jede Ausdauereinheit zu Intervallen machen.
  const harteAusdauer = Math.max(0, Math.round(ausdauertage.length * AUSDAUER.anteilHochintensiv));
  const kandidaten = ausdauertage.filter((t) => !sprinttage.includes(t));
  const intervalltage = new Set(harteAusdauer > 0 ? kandidaten.slice(-harteAusdauer) : []);

  const geraet = ausdauerGeraetFuer(profil);

  const plan = WOCHENTAGE.map((name, index) => {
    const einheiten = [];

    if (sprinttage.includes(index)) {
      einheiten.push(sprinteinheit(phase, sprintProEinheit, profil));
    }
    if (krafttage.includes(index)) {
      einheiten.push(krafteinheit(phase, volumen, profil, sprinttage.includes(index), leistung));
    }
    if (ausdauertage.includes(index)) {
      const hart = intervalltage.has(index);
      einheiten.push(ausdauereinheit(hart, volumen, profil, geraet, einheiten.length > 0));
    }

    return {
      tag: index,
      name,
      trainingstag: einheiten.length > 0,
      einheiten,
      minuten: einheiten.reduce((s, e) => s + e.minuten, 0),
    };
  });

  return {
    woche,
    phase: { schluessel, ...phase },
    entlastungswoche: schluessel === 'entlastung',
    wiedereinstieg: einstieg,
    volumenFaktor: round(volumen, 2),
    verteilung,
    geraet,
    tage: plan,
    wochenminuten: plan.reduce((s, t) => s + t.minuten, 0),
    // Tatsächlich geplante Meter, nicht der Zielwert: Die Qualitätsgrenze im
    // Sprintblock deckelt den Umfang, und dann soll hier auch das Gedeckelte stehen.
    sprintmeter: plan.reduce((s, t) =>
      s + t.einheiten.reduce((m, e) => m + (e.meter || 0), 0), 0),
    sprintmeterZiel: sprinttage.length * sprintProEinheit,
    hinweise: wochenHinweise(profil, plan, schluessel, einstieg),
  };
}

function ausdauerGeraetFuer(profil) {
  const gewuenscht = profil?.ausdauerGeraet || 'rad';
  return {
    name: gewuenscht,
    interferenz: AUSDAUER.interferenzFaktor[gewuenscht] ?? 1.0,
  };
}

/* ------------------------------------------------------------ Einheiten */

/**
 * Sprinteinheit. Der Umfang steht in Metern, weil das die Größe ist, die zählt –
 * Wiederholungen sagen nichts, solange die Distanz offen ist.
 */
function sprinteinheit(phase, meter, profil) {
  const beschleunigung = phase.sprintFokus === 'beschleunigung';

  // Die Streckenlänge ist nicht verhandelbar: Beschleunigungsarbeit lebt von
  // 20–30 m, Höchstgeschwindigkeit von 20–30 m fliegend. Wer die Läufe länger
  // macht, um mehr Meter unterzubringen, trainiert Tempohärte – die Geschwindigkeit
  // fällt am Ende der Strecke ab, und genau die sollte trainiert werden.
  //
  // Zusätzliches Volumen kommt deshalb über Sätze, nicht über längere Läufe.
  // Deckelt die Qualitätsgrenze den Umfang, gewinnt die Qualität: Der Wochenwert
  // aus der Literatur ist eine Obergrenze, kein Soll.
  const distanz = 30;
  const proSatz = beschleunigung ? 5 : 4;
  const maxLaeufe = SPRINT.maxLaeufeProEinheit[
    beschleunigung ? 'beschleunigung' : 'maximalgeschwindigkeit'];
  const wiederholungen = clamp(Math.round(meter / distanz), 4, maxLaeufe);
  const saetze = Math.ceil(wiederholungen / proSatz);
  const pause = Math.round(distanz / 10 * SPRINT.pauseSekundenProZehnMeter);
  const satzPause = 6; // Minuten zwischen den Sätzen

  const bloecke = [
    {
      titel: 'Anlauf',
      inhalt: '10 min lockeres Einlaufen, Mobilisation Hüfte und Sprunggelenk, '
        + 'Lauf-ABC (Skippings, Anfersen, Sprunglauf) je 2 × 20 m.',
      minuten: 20,
    },
    {
      titel: 'Steigerungen',
      inhalt: '3 × 50 m progressiv auf 90 % – das Nervensystem braucht die Rampe, '
        + 'sonst ist der erste harte Sprint der gefährlichste.',
      minuten: 8,
    },
    beschleunigung
      ? {
        titel: `Beschleunigung: ${wiederholungen} × ${distanz} m`,
        inhalt: `Aus dem 3-Punkt-Start, ${SPRINT.intensitaetProzent.beschleunigung} % Intensität, `
          + `aufgeteilt in ${saetze} Sätze à ${proSatz}. `
          + `${Math.round(pause / 60)} min zwischen den Läufen, ${satzPause} min zwischen den Sätzen – `
          + 'vollständig gehend erholen, nicht traben. Bricht die Technik ein oder wird es spürbar '
          + 'langsamer, ist die Einheit vorbei: Der Rest würde nur Ermüdung ohne Reiz sammeln.',
        minuten: Math.round(wiederholungen * pause / 60) + (saetze - 1) * satzPause + 5,
      }
      : {
        titel: `Fliegende Sprints: ${wiederholungen} × ${distanz} m`,
        inhalt: `30 m Anlauf, dann ${distanz} m fliegend bei ${SPRINT.intensitaetProzent.maximalgeschwindigkeit} %, `
          + `aufgeteilt in ${saetze} Sätze à ${proSatz}. `
          + `${Math.round(pause / 60)} min zwischen den Läufen, ${satzPause} min zwischen den Sätzen. `
          + 'Hier entsteht Höchstgeschwindigkeit – nur bei absoluter Frische sinnvoll. Länger als '
          + `${distanz} m fliegend zu laufen bringt keine höhere Geschwindigkeit, sondern nur Ermüdung.`,
        minuten: Math.round(wiederholungen * pause / 60) + (saetze - 1) * satzPause + 5,
      },
    {
      titel: 'Plyometrie',
      inhalt: beschleunigung
        ? '3 × 5 Standweitsprünge, 3 × 5 Sprünge im Wechselschritt. Zwischen den Sätzen 2 min.'
        : '3 × 5 Hürdensprünge (niedrig), 3 × 20 m Sprunglauf. Kurzer Bodenkontakt zählt, nicht die Höhe.',
      minuten: 12,
    },
    {
      titel: 'Auslaufen',
      inhalt: '8 min locker, danach Dehnen nur leicht – intensives Dehnen direkt nach Sprints bringt nichts.',
      minuten: 8,
    },
  ];

  return {
    typ: 'sprint',
    titel: 'Sprint',
    fokus: phase.sprintFokus === 'beschleunigung' ? 'Beschleunigung' : 'Maximalgeschwindigkeit',
    meter: wiederholungen * distanz,
    bloecke,
    minuten: bloecke.reduce((s, b) => s + b.minuten, 0),
    warum: 'Sprint steht am Anfang des Tages und der Woche, weil Höchstgeschwindigkeit '
      + 'nur bei frischem Nervensystem trainierbar ist. Müde sprinten heißt langsam sprinten – '
      + 'und langsam sprinten trainiert Langsamkeit.',
  };
}

/**
 * Krafteinheit. Ganzkörper, weil das bei drei bis vier Einheiten pro Woche
 * jede Muskelgruppe zweimal trifft – besser als ein Split, der bei einer
 * verpassten Einheit ganze Bereiche ausfallen lässt.
 */
function krafteinheit(phase, volumen, profil, nachSprint, leistung = {}) {
  const absicht = phase.kraftAbsicht;
  const [intMin, intMax] = KRAFT.intensitaet[absicht];
  const [repMin, repMax] = KRAFT.wiederholungen[absicht];
  const saetze = Math.max(2, Math.round((absicht === 'maximalkraft' ? 4 : 3) * volumen));

  const roh = [
    {
      schluessel: 'kniebeuge',
      name: 'Kniebeuge',
      saetze,
      repBereich: [repMin, repMax],
      prozent: [intMin, intMax],
      hinweis: absicht === 'explosivkraft'
        ? 'Bewusst zügig aus der tiefen Position – die Absicht zählt, nicht die Last.'
        : 'Letzte Wiederholung mit 1–2 Wiederholungen Reserve. Bis zum Versagen bringt kaum mehr, kostet aber Erholung.',
    },
    {
      schluessel: 'rumaenischesKreuzheben',
      name: 'Rumänisches Kreuzheben',
      saetze: Math.max(2, saetze - 1),
      repBereich: [Math.max(5, repMin), Math.max(8, repMax)],
      prozent: [intMin - 5, intMax - 5],
      hinweis: 'Hüftbeuge, kein Rückenrunden. Die Hamstrings sind beim Sprint der Motor – und die Baustelle.',
    },
    {
      schluessel: profil?.koerpergewichtsfokus ? 'klimmzuege' : 'latzug',
      name: profil?.koerpergewichtsfokus ? 'Klimmzüge (Muscle-Up-Weg)' : 'Latzug',
      saetze,
      repBereich: absicht === 'maximalkraft' ? [3, 5] : [repMin, repMax],
      prozent: [intMin, intMax],
      koerpergewicht: Boolean(profil?.koerpergewichtsfokus),
      hinweis: 'Voll ausgestreckt starten, Brustbein zur Stange. Die Teilstrecke oben ist genau die, '
        + 'die den Muscle-Up trägt.',
    },
    {
      schluessel: profil?.koerpergewichtsfokus ? 'dips' : 'bankdruecken',
      name: profil?.koerpergewichtsfokus ? 'Dips an der geraden Stange' : 'Bankdrücken',
      saetze,
      repBereich: [repMin, repMax],
      prozent: [intMin, intMax],
      koerpergewicht: Boolean(profil?.koerpergewichtsfokus),
      hinweis: 'Bei Muscle-Up-Ziel: Dips an der geraden Stange statt an Barren – das ist die Position '
        + 'nach dem Übergang.',
    },
    {
      schluessel: 'hipthrust',
      name: 'Hip Thrust',
      saetze: Math.max(2, saetze - 1),
      repBereich: [Math.max(6, repMin), repMax + 2],
      prozent: [intMin, intMax],
      hinweis: 'Hüftstreckung gegen Widerstand – die Bewegung, die den Sprint antreibt.',
    },
  ];

  // Die Last folgt der Wiederholungszahl, nicht umgekehrt. Beim
  // Explosivkrafttraining bleibt es bei der festen Prozentvorgabe, weil dort
  // die Bewegungsgeschwindigkeit die Last bestimmt und nicht die Erschöpfung.
  const reserve = KRAFT.reserve[absicht];
  const uebungen = roh.map((u) => mitLast({
    ...u,
    prozent: reserve == null ? u.prozent : prozentBereich(u.repBereich, reserve),
  }, leistung));

  // Prophylaxe steht in jedem Sprintprogramm, unabhängig von der Vorgeschichte:
  // Nordic senkt Hamstring-Verletzungen um rund die Hälfte (van Dyk 2019),
  // Copenhagen ist das Gegenstück für die Adduktoren.
  const prophylaxe = [
    {
      schluessel: 'nordic',
      ohneLast: true,
      name: 'Nordic Hamstring',
      saetze: 2,
      wiederholungen: '4–6',
      intensitaet: 'nur exzentrisch, so weit kontrollierbar',
      hinweis: 'Halbiert das Hamstring-Risiko in Metaanalysen. Zwei Sätze pro Woche reichen – '
        + 'mehr macht vor allem Muskelkater.',
    },
    {
      schluessel: 'copenhagen',
      ohneLast: true,
      name: 'Copenhagen Adduction',
      saetze: 2,
      wiederholungen: '5–8 je Seite',
      intensitaet: 'Kurzhebel, bis die Technik hält',
      hinweis: 'Adduktorenkraft ist die beste Absicherung der Leiste. Mit kurzem Hebel anfangen.',
    },
    {
      schluessel: 'wadenheben',
      name: 'Wadenheben stehend',
      saetze: 2,
      wiederholungen: '8–12',
      intensitaet: 'schwer',
      hinweis: 'Achillessehne und Fußgewölbe tragen beim Sprint die höchsten Spitzenkräfte.',
    },
  ];

  const minuten = 15 + uebungen.length * 9 + prophylaxe.length * 4;

  return {
    typ: 'kraft',
    titel: 'Kraft (Ganzkörper)',
    fokus: absicht === 'hypertrophie' ? 'Hypertrophie'
      : absicht === 'maximalkraft' ? 'Maximalkraft' : 'Explosivkraft',
    uebungen,
    prophylaxe,
    minuten,
    warum: nachSprint
      ? 'Kraft nach dem Sprint am selben Tag: So bleiben die übrigen Tage wirklich frei. '
        + 'Umgekehrt wäre der Sprint durch die Vorermüdung wertlos.'
      : 'Ganzkörper statt Split – bei dieser Frequenz trifft das jede Muskelgruppe zweimal pro Woche '
        + `und liegt damit über den ${KRAFT.saetzeProMuskelWoche.minimum} Sätzen, ab denen die Dosis-Wirkung deutlich wird.`,
  };
}

/**
 * Aus Prozentvorgabe und Leistungsstand eine Last in Kilo machen.
 *
 * Ohne Datenlage bleibt es bei der Prozentangabe – eine erfundene Zahl wäre
 * schlechter als gar keine, weil sie am Gerät wie eine Vorgabe aussähe. Sobald
 * ein Test oder ein protokollierter Satz vorliegt, steht dort ein Gewicht.
 */
function mitLast(uebung, leistung) {
  const { schluessel, repBereich, prozent, saetze, name, hinweis, koerpergewicht } = uebung;
  const gewicht = arbeitsgewicht(schluessel, prozent, leistung.maxima || {}, leistung.koerpergewichtKg);
  const letzte = leistung.letzte?.[schluessel];
  const vorschlag = naechsteLast(schluessel, letzte, repBereich);

  let intensitaet;
  if (koerpergewicht) {
    if (gewicht?.bis > 0) {
      intensitaet = gewicht.von > 0
        ? `Körpergewicht + ${gewicht.von}–${gewicht.bis} kg`
        : `Körpergewicht bis + ${gewicht.bis} kg`;
    } else if (gewicht) {
      // Zielintensität liegt unter dem eigenen Körpergewicht – dann geht es
      // über die Wiederholungen, nicht über Zusatzlast.
      intensitaet = 'Körpergewicht, noch keine Zusatzlast nötig';
    } else {
      intensitaet = 'Körpergewicht, ggf. mit Zusatzlast';
    }
  } else if (gewicht) {
    intensitaet = gewicht.von === gewicht.bis
      ? `${gewicht.von} kg`
      : `${gewicht.von}–${gewicht.bis} kg`;
  } else {
    // Ohne Datenlage bleibt die Prozentangabe. Auf ganze Prozent gerundet –
    // eine Nachkommastelle würde eine Genauigkeit vortäuschen, die eine
    // Maximalkraftschätzung ohnehin nicht hat.
    intensitaet = `${Math.round(prozent[0])}–${Math.round(prozent[1])} % 1RM`;
  }

  return {
    schluessel,
    name,
    saetze,
    // Damit die Oberfläche weiß, ob ein Gewichtsfeld überhaupt Sinn ergibt.
    ohneLast: Boolean(UEBUNGEN[schluessel]?.ohneLast),
    koerpergewicht,
    wiederholungen: `${repBereich[0]}–${repBereich[1]}`,
    repBereich,
    intensitaet,
    prozent,
    gewicht,
    // Der Vorschlag aus dem Protokoll schlägt die Prozentrechnung: Er kennt die
    // Tagesform der letzten Einheit, die Formel kennt nur eine alte Bestleistung.
    vorschlag: vorschlag?.empfehlung ? vorschlag : null,
    hinweis,
  };
}

/** Ausdauereinheit, polarisiert: entweder wirklich locker oder wirklich hart. */
function ausdauereinheit(hart, volumen, profil, geraet, teiltTag) {
  const geraetName = {
    rad: 'Rad', rudern: 'Rudergerät', laufen: 'Laufen',
    schwimmen: 'Schwimmen', crosstrainer: 'Crosstrainer',
  }[geraet.name] || 'Rad';

  if (hart) {
    const minuten = Math.round(45 * volumen) + 15;
    return {
      typ: 'ausdauerIntervalle',
      titel: `Intervalle (${geraetName})`,
      fokus: 'VO2max',
      bloecke: [
        { titel: 'Einfahren', inhalt: '15 min locker steigernd.', minuten: 15 },
        {
          titel: '5 × 3 min hart / 3 min locker',
          inhalt: 'Hart heißt: die letzten 30 s kosten Überwindung, aber die Leistung bricht nicht ein. '
            + 'Gleichmäßig, nicht als Wettkampf gegen den ersten Block.',
          minuten: 30,
        },
        { titel: 'Ausfahren', inhalt: '10 min locker.', minuten: 10 },
      ],
      minuten,
      warum: `Die harten 20 % des Ausdauerumfangs. Mehr davon bringt nicht mehr, `
        + 'sondern verhindert nur die Erholung für den Sprint.',
    };
  }

  const minuten = Math.round((teiltTag ? 35 : 55) * volumen);
  return {
    typ: 'ausdauerLocker',
    titel: `Grundlage (${geraetName})`,
    fokus: 'Aerobe Basis',
    bloecke: [
      {
        titel: `${minuten} min gleichmäßig locker`,
        inhalt: 'Test: Du kannst in ganzen Sätzen sprechen. Geht das nicht, ist es zu schnell. '
          + 'Genau hier wird am häufigsten zu hart trainiert.',
        minuten,
      },
    ],
    minuten,
    warum: teiltTag
      ? 'Teilt sich den Tag mit dem Krafttraining – dann mit mindestens 6 h Abstand, '
        + 'weil direkt aufeinander die Kraftanpassung leidet.'
      : 'Die lockere Mehrheit des Ausdauerumfangs. Sie beschleunigt die Erholung zwischen '
        + 'den harten Tagen, statt sie zu verbrauchen.',
  };
}

/* -------------------------------------------------------------- Hinweise */

function wochenHinweise(profil, plan, schluessel, einstieg) {
  const hinweise = [];

  if (einstieg) {
    hinweise.push({
      art: 'info',
      text: 'Wiedereinstiegswoche: Umfang bewusst reduziert. Sehnen und Bänder passen sich '
        + 'langsamer an als Muskeln und Motivation – die ersten beiden Wochen sind zum Ankommen da.',
    });
  }

  if (schluessel === 'entlastung') {
    hinweise.push({
      art: 'info',
      text: 'Entlastungswoche: Umfang halbiert, Lasten bleiben. Die Anpassung entsteht jetzt, '
        + 'nicht in den drei Wochen davor. Wer sie überspringt, sammelt Ermüdung statt Form.',
    });
  }

  const doppeltage = plan.filter((t) => t.einheiten.length > 1);
  for (const tag of doppeltage) {
    const typen = tag.einheiten.map((e) => e.typ);
    if (typen.includes('kraft') && typen.some((t) => t.startsWith('ausdauer'))) {
      hinweise.push({
        art: 'warnung',
        text: `${tag.name}: Kraft und Ausdauer am selben Tag – mindestens 6 h dazwischen legen, `
          + 'sonst frisst die Ausdauereinheit einen Teil der Kraftanpassung.',
      });
    }
  }

  const geraet = profil?.ausdauerGeraet;
  const ausrichtung = Number(profil?.ausrichtung) || 0;
  if (geraet === 'laufen' && ausrichtung <= 35) {
    hinweise.push({
      art: 'warnung',
      text: 'Laufen als Ausdauergerät bei starkem Sprintfokus: Das ist die Variante mit der '
        + 'größten Störung der Kraftentwicklung. Auf dem Rad bekämst du dieselbe aerobe Wirkung '
        + 'für deutlich weniger Muskelschaden.',
    });
  }

  const wochenminuten = plan.reduce((s, t) => s + t.minuten, 0);
  if (wochenminuten > 600) {
    hinweise.push({
      art: 'warnung',
      text: `${Math.round(wochenminuten / 60)} h Training in dieser Woche. Das ist viel – `
        + 'wenn Schlaf oder Essen nicht mitziehen, wird daraus Ermüdung statt Fortschritt.',
    });
  }

  return hinweise;
}

/** Flache Liste aller Einheiten – für den Kalorienbedarf je Tag. */
export function einheitenAmTag(plan, tagIndex) {
  const tag = plan?.tage?.[tagIndex];
  if (!tag) return [];
  return tag.einheiten.map((e) => ({ typ: e.typ, minuten: e.minuten }));
}
