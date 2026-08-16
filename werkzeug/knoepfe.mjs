// Jeden Knopf einmal drücken – und nachsehen, ob etwas passiert.
//
// Falle 45: In der Muscle-Up-Karte war „geschafft" auf jeder noch nicht
// erreichbaren Stufe folgenlos. Der Tipp wurde gespeichert, die Anzeige leitete
// sich aber allein aus dem Stand ab, und der konnte sich nicht bewegen.
// Aufgefallen ist das nur, weil Nils ein Bildschirmfoto geschickt hat.
//
// Ein Bedienelement, das nichts tut, ist schlimmer als keines: Man hält die App
// für kaputt oder sich für blind. Dieses Werkzeug drückt deshalb jeden
// sichtbaren Knopf jeder Ansicht einmal und vergleicht den Text der Seite
// davor und danach.
//
//   node werkzeug/knoepfe.mjs            # alle Ansichten
//   node werkzeug/knoepfe.mjs fortschritt
//
// **Es verändert den Datenbestand** – hinterher neu säen. Vor jedem Knopf wird
// die Ansicht frisch geladen, damit die Wirkung des einen nicht die des
// nächsten verdeckt.
//
// Was es *nicht* kann: beurteilen, ob die Veränderung die richtige ist. Es
// findet nur den Fall „gar nichts". Der ist dafür verlässlich zu finden.
//
// Der Bestand wird vor jedem Knopf zurückgesetzt und am Ende wiederhergestellt
// – siehe `bestandZurueck()`. Neu säen ist danach nicht mehr nötig.
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte, ANSICHTEN } from './cdp.mjs';

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf);

const nur = process.argv[2];
const ansichten = nur ? ANSICHTEN.filter((a) => a === nur) : ANSICHTEN;
let stumm = 0;
const uebersprungen = [];

/*
 * Zugriff auf das Tagebuch. Der gesamte Bestand steht als **ein** Datensatz
 * unter dem Schlüssel `aktuell`; eine Sicherung ist deshalb ein einziges
 * `put` und muss nicht über das Protokoll hin- und hergereicht werden.
 */
const SICHERUNG = 'knoepfe-vorher';
const tagebuch = (rumpf) => js(ruf, `
  const db = await new Promise((f, r) => {
    const a = indexedDB.open('trainingstracker', 1);
    a.onsuccess = () => f(a.result);
    a.onerror = () => r(a.error);
  });
  const holen = (k) => new Promise((f, r) => {
    const t = db.transaction('tagebuch', 'readonly').objectStore('tagebuch').get(k);
    t.onsuccess = () => f(t.result); t.onerror = () => r(t.error);
  });
  const setzen = (k, w) => new Promise((f, r) => {
    const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').put(w, k);
    t.onsuccess = () => f(true); t.onerror = () => r(t.error);
  });
  const weg = (k) => new Promise((f) => {
    const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').delete(k);
    t.onsuccess = () => f(true); t.onerror = () => f(false);
  });
  ${rumpf}
`);

/*
 * Vor jedem Knopf den Bestand zurücksetzen.
 *
 * Über der Schleife stand „frisch laden, damit jeder Knopf denselben
 * Ausgangszustand vorfindet" – und das stimmte nur für die Seite, nicht für
 * die Daten. Ein Teil der Knöpfe **löscht** nämlich: das `×` an jedem
 * Leistungstest und an jedem Essenseintrag. Wer sie der Reihe nach drückt,
 * kürzt die Liste, aus der er selbst noch liest. Weil die Knöpfe über ihren
 * **Index** gegriffen werden, fielen so die letzten vier jeder löschenden
 * Karte heraus – acht von 43, und zwar reproduzierbar dieselben. Ich hatte
 * das zuerst für ein Nachladerennen gehalten und auf einen stabilen Zustand
 * gewartet; das änderte erwartungsgemäß nichts, weil die Einträge wirklich
 * weg waren (Falle 34: erst messen, dann deuten).
 *
 * Nebenbei löst das den Hinweis „verändert den Datenbestand" ab: Am Ende
 * steht wieder da, was vorher da stand – auch das, was ein Dialog
 * dazugeschrieben hat.
 */
async function bestandZurueck() {
  await tagebuch(`
    const s = await holen('${SICHERUNG}');
    if (!s) return false;
    if (s.da) await setzen('aktuell', s.wert); else await weg('aktuell');
    return true;
  `);
}

/*
 * Warten, bis die Ansicht steht – nicht auf die Uhr, sondern auf einen
 * stabilen Zustand. Karten, die ihre Daten nachladen (die Leistungstests
 * holen sie über `daten.tests()` und zeichnen dann neu), hätten ihre Knöpfe
 * sonst mal schon und mal noch nicht.
 */
async function fertigGeladen(hoechstens = 4000) {
  let vorige = -1;
  for (let gewartet = 0; gewartet < hoechstens; gewartet += 200) {
    await warte(200);
    const anzahl = await js(ruf, "return document.querySelectorAll('#inhalt button').length;");
    // Null Knöpfe ist ein gültiger Endzustand („wissen"), aber auch der Stand
    // *vor* dem Zeichnen – deshalb dort zusätzlich eine Sekunde abwarten.
    if (anzahl === vorige && (anzahl > 0 || gewartet >= 1000)) return;
    vorige = anzahl;
  }
}
let gedrueckt = 0;

/**
 * Text der Seite – die Grundlage für „hat sich etwas verändert?".
 *
 * Der Dialog wird über `dialog[open]` erkannt, **nicht** über `.dialog`: Das
 * Element steht dauerhaft im DOM und trägt die Klasse immer. Mit `.dialog`
 * meldete diese Prüfung im ersten Anlauf acht Knöpfe als wirkungslos, die alle
 * tadellos einen Dialog öffneten – ein Befund, den die Prüfung selbst erzeugt
 * hatte (Falle 34, hier zum dritten Mal). Der Dialoginhalt zählt mit, sonst
 * bliebe ein Wechsel *zwischen* zwei Dialogen unsichtbar.
 */
const seitenText = () => js(ruf, `
  const dlg = document.querySelector('dialog[open]');
  return {
    text: document.querySelector('#inhalt')?.innerText || document.body.innerText,
    dialog: dlg ? dlg.innerText.slice(0, 400) : '',
    meldung: document.querySelector('.toast, .meldung')?.textContent || '',
  };
`);

await zurAnsicht(ruf, 'heute');
await tagebuch(`
  const w = await holen('aktuell');
  await setzen('${SICHERUNG}', { da: w !== undefined, wert: w ?? null });
  return true;
`);

for (const ansicht of ansichten) {
  await vorratLeeren(ruf);
  await bestandZurueck();
  await zurAnsicht(ruf, ansicht, { neuLaden: true });
  await fertigGeladen();

  const knoepfe = await js(ruf, `
    return [...document.querySelectorAll('#inhalt button')]
      .map((b, i) => ({ i, text: b.textContent.trim().slice(0, 40), aus: b.disabled }))
      .filter((b) => !b.aus);
  `);
  console.log(`\n${ansicht}: ${knoepfe.length} Knöpfe`);

  for (const knopf of knoepfe) {
    // Bestand zurücksetzen und frisch laden, damit jeder Knopf denselben
    // Ausgangszustand vorfindet – und einen etwaigen offenen Dialog dabei
    // schließen.
    await bestandZurueck();
    await zurAnsicht(ruf, ansicht, { neuLaden: true });
    await fertigGeladen();
    const vorher = await seitenText();

    // Knöpfe, die einen Dateiauswahl-Dialog des Systems öffnen, sind so nicht
    // zu beurteilen: Der liegt außerhalb der Seite und hinterlässt im DOM
    // keine Spur. „Aus Lauf-App übernehmen" und „Einspielen" standen deshalb
    // als wirkungslos da, obwohl sie genau das Richtige tun.
    const ergebnis = await js(ruf, `
      const b = [...document.querySelectorAll('#inhalt button')][${knopf.i}];
      if (!b || b.disabled) return { da: false };
      let datei = false;
      const echt = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (...a) {
        if (this.type === 'file') { datei = true; return undefined; }
        return echt.apply(this, a);
      };
      const vorGedrueckt = b.getAttribute('aria-pressed');
      try { b.click(); } finally { HTMLInputElement.prototype.click = echt; }
      return { da: true, datei, vorGedrueckt, nachGedrueckt: b.getAttribute('aria-pressed') };
    `);
    /*
     * Ein Knopf, der beim frischen Laden nicht mehr an seinem Platz ist, wurde
     * hier **stumm** übersprungen – kein Zeichen, keine Zählung, und die
     * Schlusszeile meldete trotzdem „0 ohne sichtbare Wirkung". Mit vollem
     * Bestand fielen so acht von 43 Knöpfen heraus, die meisten in den
     * nachladenden Karten. Ein Prüfwerkzeug, das schweigend auslässt, sieht
     * gründlicher aus als es ist – dieselbe Falle, die es selbst sucht
     * (Falle 18), und dieselbe Regel wie in Falle 22: Wo etwas wegfällt,
     * gehört der Grund an die Stelle.
     */
    if (!ergebnis.da) {
      uebersprungen.push(`${ansicht}: „${knopf.text}"`);
      process.stdout.write('?');
      continue;
    }
    gedrueckt += 1;
    await warte(900);

    if (ergebnis.datei) {
      process.stdout.write('D');
      continue;
    }

    const nachher = await seitenText();
    const gleich = vorher.text === nachher.text
      && vorher.dialog === nachher.dialog
      && vorher.meldung === nachher.meldung;

    /*
     * Ein Knopf, der vorher **und** nachher „gedrückt" meldet, war schon die
     * Auswahl – wie der Reiter, auf dem man ohnehin steht. Dass sich nichts
     * ändert, ist dort die richtige Antwort und kein toter Knopf.
     *
     * Ein Umschalter fällt nicht darunter: Der kippt beim Tippen von `true`
     * auf `false`, die Bedingung greift also nur bei einer Auswahl aus
     * mehreren. Wer die Regel weiter fasst, macht sich einen Melder, der
     * echte tote Knöpfe durchwinkt (Falle 18).
     */
    const warSchonGewaehlt = ergebnis.vorGedrueckt === 'true' && ergebnis.nachGedrueckt === 'true';

    if (gleich && warSchonGewaehlt) {
      process.stdout.write('A');
    } else if (gleich) {
      stumm += 1;
      console.log(`  >>  „${knopf.text}" bewirkt nichts Sichtbares`);
    } else {
      process.stdout.write('.');
    }
  }
}

console.log(`\n\n${gedrueckt} Knöpfe gedrückt, ${stumm} ohne sichtbare Wirkung.`
  + '\n(D = öffnet die Dateiauswahl des Systems und ist von hier aus nicht beurteilbar.'
  + '\n A = war bereits ausgewählt, dass nichts passiert ist dort die richtige Antwort.)');

if (uebersprungen.length) {
  console.log(`\n${uebersprungen.length} Knöpfe waren beim zweiten Laden nicht mehr da `
    + 'und wurden nicht geprüft (?):');
  for (const k of uebersprungen) console.log(`  ${k}`);
  console.log('Ein Knopf, der beim frischen Laden fehlt, hängt an Daten, die ein '
    + 'vorheriger Knopf verändert hat – obwohl der Bestand zurückgesetzt wird.');
}

// Den Ausgangsbestand wiederherstellen und die Sicherung wieder abräumen –
// sonst bliebe ein zweiter Datensatz in der IndexedDB liegen, den niemand
// erwartet (dieselbe Sorgfalt wie bei den eingeschleusten Skripten in
// `lesefehler.mjs` und `ablage.mjs`).
await bestandZurueck();
await tagebuch(`await weg('${SICHERUNG}'); return true;`);
zu();
// Übersprungene zählen als Fehlschlag: Ein Werkzeug, das schweigend auslässt,
// meldet Vollzug, den es nicht geprüft hat.
process.exit(stumm === 0 && uebersprungen.length === 0 ? 0 : 1);
