import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../kern/ausdauer.js';

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
