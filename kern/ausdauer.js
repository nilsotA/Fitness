// Ausdauer: Strecke, Tempo und die Frage, ob die lockeren Einheiten locker sind.
//
// Das Mitschreiben von Kilometern ist der einfache Teil. Der nützliche Teil ist
// die Intensitätsverteilung: Ausdauertraining scheitert in der Praxis fast
// immer am selben Muster – die lockeren Einheiten sind zu schnell, die harten
// zu lasch, und alles landet in der Mitte. Dort sammelt man Ermüdung ohne
// Anpassung, und die fehlt dann am Sprinttag.
//
// Reine Rechenfunktionen ohne Netzwerk oder Dateizugriff – damit testbar.

import { AUSDAUER_ZONEN, AUSDAUER_VERTEILUNG, HERZFREQUENZ } from './wissen.js';
import { round, alter } from './profil.js';

// Tempo und Pulszonen müssen auch im Browser gerechnet werden – während der
// Eingabe, damit man sieht, was aus Strecke, Dauer und Puls wird. Wie die
// Sprint-Abbruchregel liegen sie deshalb in regeln.js statt hier ein
// zweites Mal.
import {
  GERAETE, tempo, pruefeStrecke, hfMaxSchaetzung, zonenGrenzen, zoneAusHf,
} from './regeln.js';

export {
  GERAETE, tempo, pruefeStrecke, zoneAusHf,
};

/**
 * Zone aus der gefühlten Anstrengung.
 *
 * RPE ist der Normalfall: liegt für jede Einheit vor, braucht kein Gerät, und
 * für eine Dreiteilung ist es genau genug. Wer eine Uhr trägt, kann die Zone
 * stattdessen aus dem Puls ableiten – siehe `zoneBestimmen`.
 */
export function zoneAusRpe(rpe) {
  const r = Number(rpe) || 0;
  if (!r) return null;
  if (r <= AUSDAUER_ZONEN.locker.rpeBis) return 'locker';
  if (r <= AUSDAUER_ZONEN.grauzone.rpeBis) return 'grauzone';
  return 'hart';
}

/**
 * Maximalpuls aus dem Profil: gemessen, wenn vorhanden, sonst geschätzt.
 *
 * Der Unterschied zwischen beiden ist kein Detail, sondern der ganze Punkt.
 * Ein gemessener Wert stammt aus einem Ausbelastungstest und macht die Zonen
 * tatsächlich genauer. Ein geschätzter bringt rund sieben Schläge Unsicherheit
 * mit – bei 5 Prozentpunkten Abstand zwischen den Zonengrenzen ist das eine
 * ganze Zone. Deshalb steht in `quelle` immer, woher der Wert kommt, und die
 * Oberfläche sagt es dazu.
 */
export function hfMax(profil, heute = new Date()) {
  const gemessen = Number(profil?.hfMaxGemessen);
  if (gemessen >= HERZFREQUENZ.minPuls && gemessen <= HERZFREQUENZ.maxPuls) {
    return { hfMax: Math.round(gemessen), gemessen: true, quelle: 'gemessen' };
  }
  const geschaetzt = hfMaxSchaetzung(alter(profil, heute), HERZFREQUENZ);
  if (!geschaetzt) return null;
  return { ...geschaetzt, quelle: 'geschaetzt' };
}

/**
 * Zonengrenzen in Schlägen pro Minute für ein Profil – oder `null`, wenn ohne
 * Geburtsjahr und ohne gemessenen Wert gar nichts zu rechnen ist. Lieber nichts
 * anzeigen als eine Grenze erfinden: Am Handgelenk sieht eine Zahl wie eine
 * Vorgabe aus.
 */
export function pulszonen(profil, heute = new Date()) {
  const max = hfMax(profil, heute);
  if (!max) return null;
  const grenzen = zonenGrenzen(max.hfMax, HERZFREQUENZ.grenzen);
  return {
    ...grenzen,
    gemessen: max.gemessen,
    quelle: max.quelle,
    streuung: max.streuung ?? null,
    anteile: HERZFREQUENZ.grenzen,
    guete: HERZFREQUENZ.guete,
    // Mit geschätztem Maximalpuls ist die Einteilung kaum besser als über RPE.
    // Das gehört an die Zahl geschrieben, nicht in eine Fußnote.
    hinweis: max.gemessen
      ? 'Aus deinem gemessenen Maximalpuls. Die Prozentsätze der Zonengrenzen bleiben '
        + 'Näherungen, aber die Basis stimmt.'
      : `Aus dem Alter geschätzt (±${max.streuung} Schläge). Damit ist die Zone kaum `
        + 'genauer als dein RPE-Gefühl. Wirklich besser wird sie erst mit einem '
        + 'gemessenen Maximalpuls aus einem Ausbelastungstest.',
  };
}

/**
 * Durchschnittspuls säubern. Alles außerhalb des Plausiblen ist ein Tippfehler
 * – und ein Tippfehler verschiebt die ganze Verteilung, weil er die Minuten
 * einer kompletten Einheit in die falsche Zone einsortiert.
 */
export function pruefePuls(roh) {
  const wert = Math.round(Number(roh) || 0);
  if (wert < HERZFREQUENZ.minPuls || wert > HERZFREQUENZ.maxPuls) return null;
  return wert;
}

/**
 * Zone einer Einheit: Puls, wenn vorhanden, sonst RPE.
 *
 * Der Puls hat Vorrang, weil er die tatsächliche Belastung misst statt sie zu
 * schätzen – aber nur, wenn beides da ist: ein Durchschnittspuls **und**
 * belastbare Grenzen. Zurück kommt immer auch `quelle`, denn eine Verteilung
 * aus gemischten Quellen ist etwas anderes als eine durchgemessene. Wo Puls
 * und Gefühl weit auseinanderliegen, steht das in `abweichung` – das ist keine
 * Fehlermeldung, sondern oft die interessanteste Information des Tages
 * (Hitze, Restmüdigkeit, unterschätzte Anstrengung).
 */
export function zoneBestimmen(session, grenzen = null) {
  const ausRpe = zoneAusRpe(session?.rpe);
  const puls = pruefePuls(session?.hfSchnitt);
  const ausPuls = puls ? zoneAusHf(puls, grenzen) : null;

  if (!ausPuls) return { zone: ausRpe, quelle: ausRpe ? 'rpe' : null, abweichung: null };

  return {
    zone: ausPuls,
    quelle: 'hf',
    // `hfSchnitt` stand hier ebenfalls und hatte keinen Leser – der Wert
    // steht dem Aufrufer ohnehin an der Einheit selbst zur Verfügung.
    abweichung: ausRpe && ausRpe !== ausPuls
      ? { rpeZone: ausRpe, hfZone: ausPuls }
      : null,
  };
}

const IST_AUSDAUER = (typ) => typeof typ === 'string' && typ.startsWith('ausdauer');

/**
 * Harte Reize, die **nicht** im Ausdauerumfang stehen.
 *
 * Sie gehören bewusst nicht in die Verteilung: Ein Sprinttraining ist kein
 * Ausdauerumfang, und mitgezählt wären die Anteile nicht mehr das, was Seiler
 * beschreibt. Für die *Bewertung* sind sie trotzdem entscheidend. Ohne diesen
 * Blick hielt die Auswertung einem Sprinter vor, ihm fehle „der Reiz nach
 * oben" – während er zweimal pro Woche bei RPE 8 über die Bahn geht. Wer dem
 * folgt, baut harte Ausdauer neben das Sprinttraining und landet genau in der
 * Interferenz, vor der derselbe Tracker an anderer Stelle warnt (Wilson 2012).
 */
const HARTER_REIZ_AUSSERHALB = ['sprint', 'plyometrie'];

/**
 * Intensitätsverteilung über die letzten Wochen.
 *
 * Gezählt werden **Minuten**, nicht Einheiten: Eine 90-minütige lockere Runde
 * und ein 20-minütiges Intervall sind nicht dasselbe „eine Einheit". Genau
 * diese Verwechslung lässt Trainingspläne polarisiert aussehen, die es nicht
 * sind.
 *
 * `grenzen` sind die Pulszonen aus `pulszonen()`. Fehlen sie, läuft alles über
 * RPE weiter – die Verteilung bleibt also auch ohne Uhr vollständig.
 */
export function verteilung(sessions = [], bis = new Date(), tage = 28, grenzen = null) {
  const grenze = new Date(bis);
  grenze.setDate(grenze.getDate() - tage);

  const minuten = { locker: 0, grauzone: 0, hart: 0 };
  const quellen = { hf: 0, rpe: 0 };
  let abweichendeMinuten = 0;
  let gesamt = 0;
  let harteAusserhalb = 0;
  let unklar = 0;

  for (const s of sessions) {
    const datum = new Date(s.datum);
    if (datum < grenze || datum > bis) continue;

    if (!IST_AUSDAUER(s.typ)) {
      if (HARTER_REIZ_AUSSERHALB.includes(s.typ)) harteAusserhalb += 1;
      continue;
    }

    const { zone, quelle, abweichung } = zoneBestimmen(s, grenzen);
    const min = Number(s.minuten) || 0;
    if (!zone) {
      // Weder Puls noch brauchbares RPE: Die Einheit lässt sich nicht
      // einordnen. Sie fiel hier stillschweigend heraus – 120 Minuten weniger
      // im Nenner, unveränderte Prozentzahlen und darunter der Satz „Alle
      // Einheiten über RPE eingeordnet". Die Minuten werden jetzt gezählt und
      // genannt; siehe Falle 22.
      unklar += min;
      continue;
    }
    minuten[zone] += min;
    quellen[quelle] += min;
    gesamt += min;
    /*
     * Puls und Gefühl in verschiedenen Zonen. `zoneBestimmen()` hat das seit
     * jeher zurückgegeben, und der Docstring dort nennt es „oft die
     * interessanteste Information des Tages (Hitze, Restmüdigkeit,
     * unterschätzte Anstrengung)" – gelesen hat es niemand. Ein Versprechen im
     * Kommentar, das die Oberfläche nie eingelöst hat (Falle 51, aber
     * andersherum: nicht toter Ballast, sondern eine unerfüllte Zusage).
     */
    if (abweichung) abweichendeMinuten += min;
  }

  /*
   * Der Satz zu den nicht einordenbaren Minuten. Er gehört in **beide**
   * Rückgabezweige – in beiden fehlt dieselbe Zahl im Ergebnis – und ist
   * deshalb einmal formuliert (Falle 13).
   */
  const unklarSatz = unklar
    ? ` ${Math.round(unklar)} min sind nicht eingerechnet – dort fehlt sowohl ein `
      + 'Puls als auch eine Angabe zur Anstrengung.'
    : '';

  /*
   * Der Satz zur Abweichung dagegen nur im `quelleText`: Er sagt etwas über
   * die **Herkunft** der Einordnung, und die Zeile ist genau dafür da. Im
   * unbewertbaren Zweig gibt es sie nicht, und der Hinweis dort beantwortet
   * eine andere Frage („warum steht hier noch keine Verteilung?").
   */
  const abweichungSatz = abweichendeMinuten
    ? ` Bei ${Math.round(abweichendeMinuten)} min lag der Puls in einer anderen Zone als dein `
      + 'Gefühl – meist Hitze, Restmüdigkeit oder eine unterschätzte Anstrengung. Gezählt '
      + 'wird der Puls.'
    : '';

  if (gesamt < AUSDAUER_VERTEILUNG.minMinutenFuerBewertung) {
    /*
     * Auch hier gehört der Grund an die Stelle, an der das Ergebnis fehlt
     * (Falle 22). Vorher stand hier nur „bisher 40 min", während 60 weitere
     * Minuten Ausdauer protokolliert waren, die sich bloß nicht einordnen
     * ließen: Die Schwelle sah damit ferner aus als sie ist, und der Umfang
     * kleiner als er war. Der bewertbare Zweig sagt es seit Falle 29 – dieser
     * hat gar keinen `quelleText`, in dem es hätte stehen können.
     */
    return {
      bewertbar: false,
      minuten,
      gesamt,
      quellen,
      unklar,
      hinweis: `Erst ab ${AUSDAUER_VERTEILUNG.minMinutenFuerBewertung} min Ausdauer in `
        + `${tage} Tagen aussagekräftig – bisher ${Math.round(gesamt)} min.${unklarSatz}`,
    };
  }

  const anteil = {
    locker: round(minuten.locker / gesamt, 3),
    grauzone: round(minuten.grauzone / gesamt, 3),
    hart: round(minuten.hart / gesamt, 3),
  };

  const g = AUSDAUER_VERTEILUNG;

  // Reicht der Umfang, damit das Verhältnis überhaupt eine Aussage ist? Bei
  // zwei bis vier Ausdauereinheiten entscheidet die Stückelung, nicht das
  // Training – eine einzelne Intervalleinheit ist dann zwangsläufig ein
  // Viertel bis Drittel der Zeit. Siehe minMinutenProWocheFuerVerhaeltnis.
  const proWoche = gesamt / (tage / 7);
  const verhaeltnisBewertet = proWoche >= g.minMinutenProWocheFuerVerhaeltnis;

  let stufe = 'gut';
  let text = `${Math.round(anteil.locker * 100)} % locker, `
    + `${Math.round(anteil.hart * 100)} % hart. Das entspricht der polarisierten Verteilung, `
    + 'die bei Ausdauerathleten durchweg gefunden wird.';

  if (anteil.grauzone >= g.grauzoneKritisch) {
    stufe = 'kritisch';
    text = `${Math.round(anteil.grauzone * 100)} % deiner Ausdauerzeit liegt in der Grauzone. `
      + 'Das ist das Muster, an dem Ausdauertraining am häufigsten scheitert: zu schnell für '
      + 'Erholung, zu langsam für einen Reiz. Die lockeren Einheiten deutlich langsamer '
      + 'machen – und dafür die harten wirklich hart.';
  } else if (anteil.grauzone >= g.grauzoneWarnung) {
    stufe = 'warnung';
    text = `${Math.round(anteil.grauzone * 100)} % in der Grauzone. Noch im Rahmen, aber die `
      + 'Richtung stimmt nicht. Locker heißt: Du kannst in ganzen Sätzen sprechen.';
  } else if (anteil.hart < g.hartVernachlaessigbar && harteAusserhalb) {
    // Kein Mangel, sondern Absicht: Bei Sprintfokus plant dieser Tracker die
    // Ausdauer bewusst durchweg locker, weil die Sprints die harte Intensität
    // liefern. Als Warnung gelesen, führt derselbe Satz direkt in die
    // Interferenz (Wilson 2012) – hart neben hart.
    stufe = 'gut';
    text = 'Alle Ausdauereinheiten locker – so ist es gedacht. Die harte Intensität liefern '
      + `deine ${harteAusserhalb} Sprinteinheiten in diesem Zeitraum. Zusätzlich harte Ausdauer `
      + 'daneben zu legen, kostet mehr Erholung als sie bringt und stört die Kraftentwicklung.';
  } else if (anteil.hart < g.hartVernachlaessigbar) {
    // Gar kein harter Reiz, auch nicht außerhalb der Ausdauer. Das gilt bei
    // jedem Umfang und steht deshalb **vor** der Umfangsschwelle: „zu wenig
    // hart" ist keine Frage der Stückelung, „zu viel hart" schon.
    stufe = 'warnung';
    text = 'Fast alles locker. Die aerobe Basis wächst so, aber ohne harte Anteile fehlt der '
      + 'Reiz nach oben – rund ein Fünftel der Zeit darf wehtun. '
      + `Weniger als ${Math.round(g.hartVernachlaessigbar * 100)} % harte Zeit zählt hier als `
      + 'gar kein harter Reiz; wo diese Grenze liegt, ist Erfahrung und keine Messung.';
  } else if (!verhaeltnisBewertet) {
    // Grauzone leer, harter Anteil vorhanden, Umfang klein: Hier ist nichts zu
    // benoten. Vorher lief dieser Fall in die Warnung „Verhältnis steht auf dem
    // Kopf" und traf damit fast jede Woche, die dieser Tracker selbst vorschlägt.
    stufe = 'gut';
    text = `${Math.round(anteil.locker * 100)} % locker, `
      + `${Math.round(anteil.hart * 100)} % hart – bei ${Math.round(proWoche)} min Ausdauer `
      + 'pro Woche bewertet der Tracker dieses Verhältnis nicht. Eine Intervalleinheit dauert '
      + `rund eine Stunde und kann erst ab etwa ${Math.round(g.minMinutenProWocheFuerVerhaeltnis / 60)} `
      + 'Stunden Ausdauer pro Woche ein Fünftel der Zeit sein. Darunter entscheidet die '
      + 'Stückelung und nicht das Training. Aussagekräftig ist hier die Grauzone – und die ist leer.';
    if (harteAusserhalb) {
      text += ` Die harte Intensität liefern ohnehin deine ${harteAusserhalb} Sprinteinheiten.`;
    }
  } else if (anteil.hart >= g.hartZuViel) {
    // Eine leere Grauzone allein macht die Verteilung nicht polarisiert. Ohne
    // diese Prüfung galt „42 % locker, 58 % hart" als vorbildlich – das ist
    // das Verhältnis auf dem Kopf.
    stufe = 'warnung';
    text = `${Math.round(anteil.hart * 100)} % hart. Die Grauzone ist leer, aber das Verhältnis `
      + `steht auf dem Kopf: Ziel sind rund ${Math.round(AUSDAUER_ZONEN.hart.ziel * 100)} % hart. `
      + 'So viel harte Zeit lässt sich neben Sprint und Kraft nicht erholen.';
    // Wenn die Einteilung über einen geschätzten Maximalpuls lief, kann auch
    // schlicht die Grenze zu niedrig liegen. Das gehört dazugesagt, bevor
    // jemand sein Training nach einer Formel umbaut.
    if (quellen.hf > quellen.rpe && grenzen && grenzen.gemessen === false) {
      text += ` Achtung: Die Zonen stammen aus einem geschätzten Maximalpuls (${grenzen.hfMax}). `
        + 'Liegt dein echter Maximalpuls höher, ist ein Teil dieser Zeit in Wahrheit locker – '
        + 'ein Ausbelastungstest würde das klären.';
    }
  }

  return {
    bewertbar: true,
    minuten,
    gesamt: Math.round(gesamt),
    anteil,
    stufe,
    text,
    ziel: { locker: AUSDAUER_ZONEN.locker.ziel, hart: AUSDAUER_ZONEN.hart.ziel },
    tage,
    grenzwerte: g,
    // Seiler 2010 belegt, dass die Mehrheit locker gehört – nicht, dass genau
    // bei 25 % Grauzone eine Warnung fällig ist und bei 35 % eine deutliche.
    // Ohne diesen Satz liest sich eine farbige Ampel wie eine Messung.
    vorbehalt: 'Das polarisierte Prinzip ist belegt, die Prozentmarken sind Erfahrungswerte '
      + 'aus der Trainingspraxis.',
    // Damit die Oberfläche kein Ziel danebenschreibt, das bei diesem Umfang
    // gar nicht erreichbar ist.
    verhaeltnisBewertet,
    proWoche: Math.round(proWoche),
    harteAusserhalb,
    // Woher die Einteilung stammt. Eine zur Hälfte gemessene und zur Hälfte
    // gefühlte Verteilung ist etwas anderes als eine durchgemessene, und wer
    // das nicht sieht, hält beides für gleich belastbar.
    quellen,
    unklar,
    abweichendeMinuten,
    quelleText: (quellen.hf && quellen.rpe
      ? `${Math.round((quellen.hf / gesamt) * 100)} % der Minuten über Puls eingeordnet, `
        + 'der Rest über RPE.'
      : quellen.hf
        ? 'Alle eingeordneten Einheiten über Puls.'
        /*
         * Ohne einen einzigen Puls sagt die Grauzone weniger über das Training
         * als über den Regler: `RPE_ERWARTUNG` belegt ihn je Einheitenart vor,
         * und **keiner** der acht Werte liegt zwischen 5 und 6. Wer die
         * Vorbelegung stehen lässt, bekommt zwangsläufig eine leere Grauzone.
         *
         * Gemessen über zwölf Wochen Plan in allen Reglerständen: Grauzone
         * 0 min in 2.182 von 2.182 bewertbaren Tagen. Das ist keine falsche
         * Rechnung – eine lockere Einheit *soll* RPE 4 heißen –, aber es ist
         * dieselbe Bauart wie in den Fallen 17, 24 und 84: Der Tracker misst
         * seine eigene Vorgabe. Also steht es dabei, statt eine erfundene
         * Zahl dagegenzusetzen.
         *
         * Wen es trifft, ist eine eigene Frage – und die erste Fassung dieses
         * Kommentars hat sie falsch beantwortet. Bei Nils' Voreinstellung
         * (Regler 30, vier Tage) steht an 79 von 79 Tagen „Alle
         * Ausdauereinheiten locker – so ist es gedacht", ein Zweig, der die
         * Grauzone gar nicht als Beleg anführt. Die Sätze, die es tun
         * („Aussagekräftig ist hier die Grauzone – und die ist leer", „Das
         * entspricht der polarisierten Verteilung"), stehen an 46 % aller
         * Tage über alle Reglerstände. Der Vorbehalt gehört trotzdem hierher:
         * Er hängt an der Herkunft der Einordnung und nicht am Zweig darüber.
         */
        : 'Alle eingeordneten Einheiten über RPE. Der Regler ist je Einheitenart '
          + 'vorbelegt, und keine dieser Vorbelegungen liegt in der Grauzone – wer sie '
          + 'stehen lässt, bekommt sie zwangsläufig leer. Aussagekräftig wird die '
          + 'Grauzone erst mit selbst gesetzten Werten oder mit Puls.')
      // „Alle" darf nicht dastehen, wenn etwas fehlt.
      + unklarSatz + abweichungSatz,
  };
}

/**
 * Tempoverlauf je Gerät. Getrennt, weil ein Radtempo und ein Laufttempo nichts
 * miteinander zu tun haben – zusammen aufgetragen ergäbe die Kurve Unsinn.
 *
 * Verglichen werden nur Einheiten derselben Zone: Ein lockerer Lauf, der
 * schneller wird, ist ein Fortschritt. Ein lockerer Lauf, der schneller wird,
 * weil er in Wahrheit ein harter war, ist keiner – deshalb steht die Zone
 * an jedem Punkt.
 */
export function tempoVerlauf(sessions = [], grenzen = null) {
  const verlauf = {};

  for (const s of sessions) {
    if (!IST_AUSDAUER(s.typ)) continue;
    const strecke = pruefeStrecke(s.strecke);
    if (!strecke || !s.minuten) continue;

    const { zone, quelle } = zoneBestimmen(s, grenzen);
    const schluessel = `${strecke.geraet}-${zone || 'unbekannt'}`;
    const t = tempo(strecke.meter, s.minuten, strecke.geraet);
    if (!t) continue;

    verlauf[schluessel] = verlauf[schluessel] || [];
    verlauf[schluessel].push({
      datum: s.datum,
      meter: strecke.meter,
      minuten: s.minuten,
      kmh: t.kmh,
      tempo: t.text,
      zone,
      quelle,
      hfSchnitt: Number(s.hfSchnitt) || null,
    });
  }

  // Bei zwei Einheiten am selben Tag entscheidet die Reihenfolge, in der sie
  // protokolliert wurden – deshalb `0` und nicht `-1`. Ein Vergleich, der bei
  // Gleichstand ±1 zurückgibt, dreht gleichrangige Einträge um (Falle 63);
  // zwei Ausfahrten an einem Tag stünden dann verkehrt herum in der Kurve.
  for (const liste of Object.values(verlauf)) {
    liste.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  }
  return verlauf;
}

/** Wochenkilometer je Gerät – die Zahl, nach der Ausdauersportler fragen. */
export function wochenstrecke(sessions = [], bis = new Date(), tage = 7) {
  const grenze = new Date(bis);
  grenze.setDate(grenze.getDate() - tage);
  const proGeraet = {};

  for (const s of sessions) {
    if (!IST_AUSDAUER(s.typ)) continue;
    const datum = new Date(s.datum);
    if (datum < grenze || datum > bis) continue;
    const strecke = pruefeStrecke(s.strecke);
    if (!strecke) continue;
    proGeraet[strecke.geraet] = (proGeraet[strecke.geraet] || 0) + strecke.meter;
  }

  return Object.fromEntries(
    Object.entries(proGeraet).map(([g, m]) => [g, round(m / 1000, 1)]),
  );
}

/** Klartext für einen Verlaufsschlüssel wie „laufen-locker". */
export function verlaufName(schluessel) {
  const [geraet, zone] = String(schluessel).split('-');
  const g = GERAETE[geraet]?.name || geraet;
  const z = AUSDAUER_ZONEN[zone]?.name || 'ohne Zone';
  return `${g} · ${z}`;
}
