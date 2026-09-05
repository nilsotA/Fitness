import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../kern/ausdauer.js';
import { RPE_ERWARTUNG, AUSDAUER_ZONEN } from '../kern/wissen.js';

const BIS = new Date('2026-08-07');

/** Baut eine Ausdauereinheit n Tage vor dem Stichtag. */
const einheit = (tageVor, rpe, minuten, meter, geraet = 'laufen') => {
  const d = new Date(BIS);
  d.setDate(d.getDate() - tageVor);
  return {
    datum: d.toISOString().slice(0, 10),
    typ: rpe >= 7 ? 'ausdauerIntervalle' : 'ausdauerLocker',
    rpe,
    minuten,
    strecke: meter ? { meter, geraet } : null,
  };
};

/* ------------------------------------------------------------- Tempo */

test('Laufen wird als Pace angezeigt, Rad als Geschwindigkeit', () => {
  // 10 km in 50 min = 5:00 min/km
  const laufen = A.tempo(10000, 50, 'laufen');
  assert.equal(laufen.text, '5:00 /km');
  assert.equal(laufen.kmh, 12);

  // 30 km in 60 min = 30 km/h
  const rad = A.tempo(30000, 60, 'rad');
  assert.equal(rad.text, '30 km/h');
});

test('Rudern und Schwimmen bekommen ihre eigenen Bezugsgrößen', () => {
  // 5000 m in 20 min = 2:00 /500 m
  assert.equal(A.tempo(5000, 20, 'rudern').text, '2:00 /500 m');
  // 1000 m in 20 min = 2:00 /100 m
  assert.equal(A.tempo(1000, 20, 'schwimmen').text, '2:00 /100 m');
});

test('Sekunden runden nie auf :60', () => {
  // Ein Tempo knapp unter der vollen Minute darf nicht als „4:60" erscheinen.
  for (let meter = 9800; meter <= 10200; meter += 7) {
    const t = A.tempo(meter, 50, 'laufen');
    assert.ok(!/:60/.test(t.text), `${meter} m ergab ${t.text}`);
  }
});

test('Ohne Strecke oder Dauer kein Tempo', () => {
  assert.equal(A.tempo(0, 50), null);
  assert.equal(A.tempo(10000, 0), null);
});

/* ----------------------------------------------------------- Strecke */

test('Unplausible Strecken fliegen raus', () => {
  assert.equal(A.pruefeStrecke({ meter: 0 }), null);
  assert.equal(A.pruefeStrecke({ meter: -5 }), null);
  assert.equal(A.pruefeStrecke({ meter: 500000 }), null);
  assert.equal(A.pruefeStrecke(null), null);
});

test('Unbekanntes Gerät fällt auf Laufen zurück', () => {
  assert.equal(A.pruefeStrecke({ meter: 5000, geraet: 'einhorn' }).geraet, 'laufen');
});

/* -------------------------------------------------------------- Zonen */

test('Zonen folgen der gefühlten Anstrengung', () => {
  assert.equal(A.zoneAusRpe(3), 'locker');
  assert.equal(A.zoneAusRpe(4), 'locker');
  assert.equal(A.zoneAusRpe(5), 'grauzone');
  assert.equal(A.zoneAusRpe(6), 'grauzone');
  assert.equal(A.zoneAusRpe(7), 'hart');
  assert.equal(A.zoneAusRpe(0), null);
});

/* -------------------------------------------------------- Verteilung */

test('Polarisierte Verteilung wird als gut erkannt', () => {
  const sessions = [
    einheit(1, 3, 60), einheit(3, 3, 70), einheit(5, 4, 60),
    einheit(8, 3, 80), einheit(10, 3, 60),
    einheit(6, 8, 40), einheit(13, 8, 35),
  ];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.bewertbar, true);
  assert.equal(v.stufe, 'gut');
  assert.ok(v.anteil.locker > 0.75, `locker ${v.anteil.locker}`);
});

test('Zu viel Grauzone wird deutlich benannt', () => {
  // Der häufigste Fehler im Ausdauertraining: alles im Mitteltempo.
  const sessions = [
    einheit(1, 5, 60), einheit(3, 6, 60), einheit(5, 5, 60), einheit(8, 6, 60),
    einheit(10, 3, 40),
  ];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.stufe, 'kritisch');
  assert.ok(v.anteil.grauzone >= 0.35);
  assert.match(v.text, /Grauzone/);
});

test('Minuten zählen, nicht Einheiten', () => {
  // Eine 90-min-Runde locker gegen ein 20-min-Intervall: nach Einheiten
  // gezählt wäre das 50/50, nach Minuten 82/18. Nur Letzteres stimmt.
  const sessions = [einheit(1, 3, 90), einheit(3, 8, 20)];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.gesamt, 110);
  assert.ok(Math.abs(v.anteil.locker - 0.818) < 0.01, `locker ${v.anteil.locker}`);
});

test('Zu wenig Umfang wird nicht bewertet', () => {
  const v = A.verteilung([einheit(1, 3, 40)], BIS);
  assert.equal(v.bewertbar, false);
  assert.match(v.hinweis, /aussagekräftig/);
});

test('Nur Ausdauereinheiten zählen in die Verteilung', () => {
  const sessions = [
    einheit(1, 3, 60), einheit(3, 3, 60),
    { datum: '2026-08-05', typ: 'kraft', rpe: 9, minuten: 200 },
    { datum: '2026-08-04', typ: 'sprint', rpe: 9, minuten: 120 },
  ];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.gesamt, 120, 'Kraft und Sprint dürfen nicht mitzählen');
  assert.equal(v.anteil.hart, 0);
});

test('Eine leere Grauzone allein macht die Verteilung nicht polarisiert', () => {
  // Der Fall, der erst mit echten Pulsdaten auffiel: 0 % Grauzone, aber mehr
  // hart als locker. Das galt als „gut" und wurde als polarisierte Verteilung
  // beschrieben – bei genau umgekehrtem Verhältnis.
  //
  // Der Umfang ist bewusst groß: Das Verhältnis wird erst ab fünf Stunden
  // Ausdauer pro Woche bewertet, weil es darunter von der Stückelung abhängt
  // und nicht vom Training. Hier geht es um das Verhältnis selbst, also muss
  // der Umfang es auch hergeben – 42/58 bleibt auf dem Kopf.
  const sessions = [
    ...Array.from({ length: 12 }, (_, i) => einheit(i * 2, 3, 50)),
    ...Array.from({ length: 12 }, (_, i) => einheit(i * 2 + 1, 8, 70)),
  ];
  const v = A.verteilung(sessions, BIS);
  assert.ok(v.proWoche >= 300, `${v.proWoche} min/Woche`);
  assert.equal(v.anteil.grauzone, 0);
  assert.equal(v.stufe, 'warnung');
  assert.doesNotMatch(v.text, /entspricht der polarisierten/);
  assert.match(v.text, /auf dem Kopf/);
});

test('Bei geschätztem Maximalpuls nennt der Hinweis die Schätzung als Ursache', () => {
  // Ein zu niedrig geschätzter Maximalpuls schiebt lockere Einheiten in den
  // harten Bereich. Wer das nicht weiß, baut sein Training nach einer Formel um.
  const z = A.pulszonen({ geburtsjahr: 1996 }, BIS);
  const sessions = Array.from({ length: 20 },
    (_, tag) => ({ ...einheit(tag, 4, 90), hfSchnitt: 170 }));
  const v = A.verteilung(sessions, BIS, 28, z);
  assert.equal(v.stufe, 'warnung');
  assert.match(v.text, /geschätzten Maximalpuls/);

  // Mit gemessenem Wert entfällt die Einschränkung – dann stimmt die Grenze.
  const gemessen = A.pulszonen({ hfMaxGemessen: 195 }, BIS);
  const v2 = A.verteilung(sessions, BIS, 28, gemessen);
  assert.doesNotMatch(v2.text, /geschätzten Maximalpuls/);
});

test('Durchweg lockere Ausdauer neben Sprint ist kein Mangel', () => {
  // Bei Sprintfokus plant der Tracker die Ausdauer absichtlich komplett
  // locker – die harte Intensität liefern die Sprints. Als „ohne harte
  // Anteile fehlt der Reiz nach oben" gelesen, schickt derselbe Satz Nils in
  // genau die Interferenz, vor der die App an anderer Stelle warnt.
  const locker = Array.from({ length: 8 }, (_, i) => einheit(i * 3, 3, 60));
  const mitSprint = [...locker, ...Array.from({ length: 8 }, (_, i) => ({
    datum: einheit(i * 3 + 1, 8, 72).datum, typ: 'sprint', rpe: 8, minuten: 72,
  }))];

  const ohne = A.verteilung(locker, BIS);
  assert.equal(ohne.stufe, 'warnung', 'ohne harten Reiz irgendwo bleibt es eine Warnung');
  assert.match(ohne.text, /wehtun/);

  const mit = A.verteilung(mitSprint, BIS);
  assert.equal(mit.stufe, 'gut');
  assert.equal(mit.harteAusserhalb, 8);
  assert.match(mit.text, /so ist es gedacht/);
  // Die Sprintminuten dürfen die Verteilung selbst nicht verschieben –
  // Sprinttraining ist kein Ausdauerumfang.
  assert.equal(mit.gesamt, ohne.gesamt);
  assert.equal(mit.anteil.locker, 1);
});

test('Das 80/20-Verhältnis wird erst ab genügend Umfang bewertet', () => {
  // Eine Intervalleinheit dauert rund eine Stunde. Bei drei Ausdauereinheiten
  // in der Woche ist sie damit zwangsläufig ein Drittel der Zeit – es gibt
  // keine Aufteilung, die auf 20 % käme. Diesen Umfang zu benoten hieße, für
  // etwas zu warnen, das sich gar nicht anders aufteilen lässt.
  const klein = [einheit(1, 3, 55), einheit(3, 3, 55), einheit(5, 9, 60),
    einheit(8, 3, 55), einheit(10, 3, 55), einheit(12, 9, 60)];
  const v = A.verteilung(klein, BIS);
  assert.equal(v.verhaeltnisBewertet, false);
  assert.ok(v.anteil.hart >= 0.35, `hart ${v.anteil.hart}`);
  assert.equal(v.stufe, 'gut', 'bei kleinem Umfang keine Note aufs Verhältnis');
  assert.match(v.text, /bewertet der Tracker dieses Verhältnis nicht/);

  // Die Grauzone dagegen wird bei jedem Umfang bewertet – sie ist der Teil,
  // an dem Ausdauertraining tatsächlich scheitert.
  const grau = [einheit(1, 5, 60), einheit(3, 6, 60), einheit(5, 5, 60)];
  const g = A.verteilung(grau, BIS);
  assert.equal(g.verhaeltnisBewertet, false);
  assert.equal(g.stufe, 'kritisch');
});

test('Fast nur locker erzeugt ebenfalls einen Hinweis', () => {
  const sessions = [einheit(1, 3, 90), einheit(3, 3, 90), einheit(5, 3, 60)];
  const v = A.verteilung(sessions, BIS);
  assert.equal(v.stufe, 'warnung');
  assert.match(v.text, /wehtun/);
});

/* ----------------------------------------------------------- Verlauf */

test('Tempoverlauf trennt Geräte und Zonen', () => {
  const sessions = [
    einheit(1, 3, 50, 9000, 'laufen'),
    einheit(3, 8, 30, 7000, 'laufen'),
    einheit(5, 3, 60, 25000, 'rad'),
  ];
  const v = A.tempoVerlauf(sessions);
  assert.deepEqual(Object.keys(v).sort(), ['laufen-hart', 'laufen-locker', 'rad-locker']);
  assert.equal(v['laufen-locker'][0].tempo, '5:33 /km');
});

test('Einheiten ohne Strecke tauchen im Verlauf nicht auf', () => {
  const v = A.tempoVerlauf([einheit(1, 3, 50, 0)]);
  assert.deepEqual(v, {});
});

test('Wochenstrecke summiert je Gerät', () => {
  const sessions = [
    einheit(1, 3, 50, 9000, 'laufen'),
    einheit(3, 3, 40, 7000, 'laufen'),
    einheit(5, 3, 60, 25000, 'rad'),
    einheit(20, 3, 60, 30000, 'rad'), // außerhalb der Woche
  ];
  const w = A.wochenstrecke(sessions, BIS);
  assert.equal(w.laufen, 16);
  assert.equal(w.rad, 25);
});

test('Verlaufsname ist lesbar', () => {
  assert.equal(A.verlaufName('laufen-locker'), 'Laufen · Locker');
  assert.equal(A.verlaufName('rad-hart'), 'Rad · Hart');
});

/* ------------------------------------------------------- Herzfrequenz */

test('Maximalpuls wird nach Tanaka geschätzt, nicht nach 220 minus Alter', () => {
  // 30 Jahre: 208 − 0,7 × 30 = 187. Die verbreitete Formel käme auf 190.
  const max = A.hfMax({ geburtsjahr: 1996 }, BIS);
  assert.equal(max.hfMax, 187);
  assert.equal(max.gemessen, false);
});

test('Ein gemessener Maximalpuls hat Vorrang vor der Schätzung', () => {
  const max = A.hfMax({ geburtsjahr: 1996, hfMaxGemessen: 198 }, BIS);
  assert.equal(max.hfMax, 198);
  assert.equal(max.gemessen, true);
});

test('Unplausible gemessene Werte fallen auf die Schätzung zurück', () => {
  // Ein vertippter Wert darf nicht die Zonengrenzen bestimmen.
  assert.equal(A.hfMax({ geburtsjahr: 1996, hfMaxGemessen: 12 }, BIS).gemessen, false);
  assert.equal(A.hfMax({ geburtsjahr: 1996, hfMaxGemessen: 400 }, BIS).gemessen, false);
});

test('Ohne Geburtsjahr und ohne Messung gibt es keine Zonen', () => {
  // Lieber nichts anzeigen als eine erfundene Grenze.
  assert.equal(A.hfMax({}, BIS), null);
  assert.equal(A.pulszonen({}, BIS), null);
});

test('Pulszonen kommen als Untergrenzen in Schlägen', () => {
  const z = A.pulszonen({ hfMaxGemessen: 200 }, BIS);
  assert.equal(z.hfMax, 200);
  assert.equal(z.grauzone, 164); // 82 %
  assert.equal(z.hart, 174); // 87 %
  assert.equal(A.zoneAusHf(150, z), 'locker');
  assert.equal(A.zoneAusHf(164, z), 'grauzone');
  assert.equal(A.zoneAusHf(173, z), 'grauzone');
  assert.equal(A.zoneAusHf(174, z), 'hart');
});

test('Der Hinweis benennt die Unsicherheit der Schätzung', () => {
  // Wer nicht liest, dass geschätzt wurde, hält die Zone für eine Messung.
  const geschaetzt = A.pulszonen({ geburtsjahr: 1996 }, BIS);
  assert.equal(geschaetzt.gemessen, false);
  assert.match(geschaetzt.hinweis, /geschätzt/);
  assert.match(geschaetzt.hinweis, /±7/);

  const gemessen = A.pulszonen({ hfMaxGemessen: 198 }, BIS);
  assert.equal(gemessen.gemessen, true);
  assert.doesNotMatch(gemessen.hinweis, /geschätzt/);
});

test('Unplausible Pulswerte werden verworfen', () => {
  assert.equal(A.pruefePuls(0), null);
  assert.equal(A.pruefePuls(12), null);
  assert.equal(A.pruefePuls(400), null);
  assert.equal(A.pruefePuls('142'), 142);
});

test('Puls schlägt RPE, RPE bleibt der Rückfall', () => {
  const z = A.pulszonen({ hfMaxGemessen: 200 }, BIS);

  // Gefühlt locker, gemessen in der Grauzone: genau der Fall, für den die
  // Herzfrequenz da ist.
  const beides = A.zoneBestimmen({ rpe: 3, hfSchnitt: 168 }, z);
  assert.equal(beides.zone, 'grauzone');
  assert.equal(beides.quelle, 'hf');
  assert.deepEqual(beides.abweichung, { rpeZone: 'locker', hfZone: 'grauzone' });

  // Ohne Puls entscheidet weiter das Gefühl.
  const ohnePuls = A.zoneBestimmen({ rpe: 3 }, z);
  assert.equal(ohnePuls.zone, 'locker');
  assert.equal(ohnePuls.quelle, 'rpe');

  // Puls da, aber keine Zonen berechenbar: dann zählt das RPE.
  const ohneZonen = A.zoneBestimmen({ rpe: 8, hfSchnitt: 168 }, null);
  assert.equal(ohneZonen.zone, 'hart');
  assert.equal(ohneZonen.quelle, 'rpe');

  // Stimmen beide überein, ist das keine Abweichung.
  assert.equal(A.zoneBestimmen({ rpe: 8, hfSchnitt: 180 }, z).abweichung, null);
});

test('Ohne jede Angabe bleibt die Zone offen', () => {
  const leer = A.zoneBestimmen({}, null);
  assert.equal(leer.zone, null);
  assert.equal(leer.quelle, null);
});

test('Die Verteilung ordnet über Puls ein, wo einer da ist', () => {
  const z = A.pulszonen({ hfMaxGemessen: 200 }, BIS);
  // Fünf Einheiten, die sich alle locker anfühlten – der Puls sagt etwas
  // anderes. Über RPE wäre die Verteilung makellos, über Puls ist sie es nicht.
  const sessions = [1, 3, 5, 8, 10].map((tag) => ({
    ...einheit(tag, 4, 60), hfSchnitt: 168,
  }));

  const ohne = A.verteilung(sessions, BIS);
  assert.equal(ohne.anteil.locker, 1);
  assert.equal(ohne.quellen.rpe, 300);

  const mit = A.verteilung(sessions, BIS, 28, z);
  assert.equal(mit.anteil.grauzone, 1);
  assert.equal(mit.stufe, 'kritisch');
  assert.equal(mit.quellen.hf, 300);
  assert.equal(mit.quellen.rpe, 0);
});

test('Gemischte Quellen werden als solche ausgewiesen', () => {
  const z = A.pulszonen({ hfMaxGemessen: 200 }, BIS);
  const sessions = [
    { ...einheit(1, 3, 60), hfSchnitt: 140 },
    { ...einheit(3, 3, 60) },
    { ...einheit(5, 8, 60) },
  ];
  const v = A.verteilung(sessions, BIS, 28, z);
  assert.equal(v.quellen.hf, 60);
  assert.equal(v.quellen.rpe, 120);
  assert.match(v.quelleText, /33 % der Minuten über Puls/);
});

test('Der Tempoverlauf gruppiert nach der tatsächlich bestimmten Zone', () => {
  const z = A.pulszonen({ hfMaxGemessen: 200 }, BIS);
  // Gefühlt locker (RPE 3), gemessen hart: die Einheit gehört nicht in die
  // Kurve der lockeren Läufe, sonst sieht ein Tempo nach Fortschritt aus,
  // das in Wahrheit aus einer härteren Einheit stammt.
  const sessions = [{ ...einheit(1, 3, 50, 9000, 'laufen'), hfSchnitt: 180 }];
  assert.deepEqual(Object.keys(A.tempoVerlauf(sessions, z)), ['laufen-hart']);
  assert.deepEqual(Object.keys(A.tempoVerlauf(sessions)), ['laufen-locker']);
});

test('Nicht einzuordnende Minuten verschwinden nicht stillschweigend', () => {
  // Eine Einheit ohne Puls und ohne brauchbares RPE fiel aus der Verteilung
  // heraus: 120 Minuten weniger im Nenner, unveränderte Prozentzahlen – und
  // darunter der Satz „Alle Einheiten über RPE eingeordnet". Über den Dialog
  // ist RPE 0 nicht erreichbar (der Regler beginnt bei 1), über eine
  // eingespielte Sicherung schon. Familie von Falle 22.
  const bis = new Date('2026-08-10');
  const tag = (n) => {
    const d = new Date(bis);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const sauber = [
    { datum: tag(1), typ: 'ausdauerLocker', minuten: 60, rpe: 4 },
    { datum: tag(3), typ: 'ausdauerLocker', minuten: 60, rpe: 4 },
    { datum: tag(5), typ: 'ausdauerIntervalle', minuten: 40, rpe: 8 },
  ];

  const ohne = A.verteilung(sauber, bis, 28, null);
  assert.equal(ohne.unklar, 0);
  assert.doesNotMatch(ohne.quelleText, /nicht eingerechnet/);

  const mit = A.verteilung(
    [...sauber, { datum: tag(7), typ: 'ausdauerLocker', minuten: 120, rpe: 0 }], bis, 28, null,
  );
  assert.equal(mit.unklar, 120, 'die Minuten werden gezählt');
  assert.match(mit.quelleText, /120 min sind nicht eingerechnet/);
  assert.doesNotMatch(mit.quelleText, /^Alle Einheiten/,
    '„alle" darf nicht dastehen, wenn etwas fehlt');

  // Die Anteile selbst bleiben, was sie sind – gerechnet wird über das,
  // was sich einordnen lässt.
  assert.equal(mit.anteil.locker, ohne.anteil.locker);
});

test('Zwei Einheiten am selben Tag stehen in der Reihenfolge, in der sie protokolliert wurden', () => {
  /*
   * Der Sortiervergleich gab bei gleichem Datum `-1` zurück statt `0` und
   * drehte damit gleichrangige Einträge um – dieselbe Sorte wie bei den
   * häufigen Lebensmitteln (Falle 63). Zwei Ausfahrten an einem Tag sind
   * hier keine Doppelung, sondern zwei echte Einheiten: eine zur Arbeit,
   * eine abends. Sie gehören in die Kurve, aber in der richtigen Folge.
   */
  const sessions = [
    { datum: '2026-08-09', typ: 'ausdauerLocker', rpe: 4, minuten: 60,
      strecke: { meter: 20000, geraet: 'rad' } },
    { datum: '2026-08-09', typ: 'ausdauerLocker', rpe: 4, minuten: 40,
      strecke: { meter: 10000, geraet: 'rad' } },
  ];
  const verlauf = A.tempoVerlauf(sessions, { ausrichtung: 30 });
  const liste = verlauf['rad-locker'];
  assert.equal(liste.length, 2, 'Beide Einheiten stehen in der Kurve');
  assert.deepEqual(liste.map((p) => p.meter), [20000, 10000],
    'Erst die zuerst protokollierte');
});

test('Keine RPE-Vorbelegung liegt in der Grauzone – und das steht dabei', () => {
  /*
   * Die Grauzone ist laut Falle 17 „der Teil, an dem Ausdauertraining
   * tatsächlich scheitert", und wird deshalb bei jedem Umfang bewertet. Nur:
   * `RPE_ERWARTUNG` belegt den Regler je Einheitenart vor, und keiner der acht
   * Werte liegt zwischen 5 und 6. Wer die Vorbelegung stehen lässt und keinen
   * Puls protokolliert, hat die Grauzone zwangsläufig leer – gemessen über
   * zwölf Wochen Plan in allen Reglerständen: 0 min in 2.182 von 2.182 Tagen.
   *
   * Das ist keine falsche Rechnung: Eine lockere Einheit *soll* RPE 4 heißen.
   * Es ist die Bauart aus den Fallen 17, 24 und 84 – der Tracker misst seine
   * eigene Vorgabe. Der Test hält beide Hälften fest: die Eigenschaft und den
   * Satz, der sie am Gerät benennt.
   */
  const imBand = Object.entries(RPE_ERWARTUNG)
    .filter(([, v]) => typeof v === 'number' && v >= AUSDAUER_ZONEN.locker.rpeBis + 1
      && v <= AUSDAUER_ZONEN.hart.rpeVon - 1);
  assert.deepEqual(imBand, [],
    'Eine Vorbelegung liegt jetzt in der Grauzone – dann stimmt der Vorbehalt nicht mehr');

  // Und die Gegenprobe: Ohne Puls muss der Satz dastehen, mit Puls nicht.
  const einheit = (typ, minuten, hfSchnitt) => ({
    datum: '2026-08-01', typ, minuten, rpe: RPE_ERWARTUNG[typ], hfSchnitt,
  });
  const bis = new Date('2026-08-05');
  const zonen = A.pulszonen({ geburtsjahr: 1996 }, bis);

  const nurRpe = A.verteilung(
    [einheit('ausdauerLocker', 90), einheit('ausdauerIntervalle', 60)], bis, 28, zonen);
  assert.match(nurRpe.quelleText, /keine dieser Vorbelegungen liegt in der Grauzone/);
  assert.equal(nurRpe.anteil.grauzone, 0, 'genau der Zustand, den der Satz erklärt');

  const mitPuls = A.verteilung([einheit('ausdauerLocker', 90, 130)], bis, 28, zonen);
  assert.doesNotMatch(mitPuls.quelleText, /Vorbelegung/,
    'mit Puls trägt die Einordnung nicht mehr den Regler – dann gehört der Satz weg');
});

test('Auch der unbewertbare Zweig nennt die verworfenen Minuten', () => {
  /*
   * Eine Einheit ohne Puls und ohne brauchbares RPE fällt aus der Verteilung
   * heraus. Der bewertbare Zweig sagt das seit Falle 29 – der unbewertbare
   * hatte dafür gar keinen `quelleText`, in dem es hätte stehen können.
   *
   * Gemessen: 40 min eingeordnet, 60 min verworfen. Die Karte schrieb „bisher
   * 40 min", während 100 Minuten Ausdauer protokolliert waren. Der Umfang sah
   * damit kleiner aus als er war und die Schwelle ferner als sie ist – Falle 22,
   * an der Stelle, an der das Ergebnis fehlt.
   *
   * Über den Dialog ist so eine Einheit nicht erzeugbar (der RPE-Regler
   * beginnt bei 1), über eine eingespielte Sicherung schon – wie in den
   * Fallen 29 und 38.
   */
  const bis = new Date('2026-08-05');
  const zonen = A.pulszonen({ geburtsjahr: 1996 }, bis);
  const e = (minuten, rpe) => ({ datum: '2026-08-01', typ: 'ausdauerLocker', minuten, rpe });

  const mitRest = A.verteilung([e(40, 4), e(60, 0)], bis, 28, zonen);
  assert.equal(mitRest.bewertbar, false, 'Testaufbau: unter der Bewertungsschwelle');
  assert.equal(mitRest.unklar, 60);
  assert.match(mitRest.hinweis, /60 min sind nicht eingerechnet/);

  // Ohne Verworfenes darf der Satz nicht dastehen – sonst hinge er dauerhaft
  // unter der Karte und wäre keine Meldung mehr, sondern Rauschen (Falle 24).
  const sauber = A.verteilung([e(40, 4)], bis, 28, zonen);
  assert.equal(sauber.bewertbar, false);
  assert.doesNotMatch(sauber.hinweis, /nicht eingerechnet/);

  // Und der bewertbare Zweig sagt weiterhin dasselbe – eine Formulierung.
  const bewertbar = A.verteilung([e(120, 4), e(60, 0)], bis, 28, zonen);
  assert.equal(bewertbar.bewertbar, true);
  assert.match(bewertbar.quelleText, /60 min sind nicht eingerechnet/);
});
