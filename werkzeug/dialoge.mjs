// Die Eingabedialoge bedienen und nachsehen, was in der Datenbank landet.
//
// `breite.mjs` prüft Überlauf, `konsole.mjs` Fehler – beides sagt nichts
// darüber, ob ein Eintrag richtig ankommt. Genau dort sitzen aber die teuersten
// Fehler dieses Projekts: Falle 14 (ein Komma wurde stillschweigend zu null,
// die Mahlzeit stand mit 0 kcal im Tagebuch) und die Sache mit dem gebündelten
// Schreiben (35 Einträge getippt, null gespeichert). Beides ist im Kern
// abgedeckt; der Weg *durch die Oberfläche* war es nie.
//
//   node werkzeug/dialoge.mjs
//
// Gibt einen Exitcode zurück und taugt damit wie die anderen als letzte
// Prüfung vor dem Commit. Verändert den Datenbestand – vorher `saeen.mjs`
// laufen lassen, hinterher gegebenenfalls neu säen.
import { verbinde, js, zurAnsicht, geraet, vorratLeeren, warte } from './cdp.mjs';

const { ruf, zu } = await verbinde();
await ruf('Page.enable');
await ruf('Runtime.enable');
await geraet(ruf);

const heute = new Date().toISOString().slice(0, 10);
let fehler = 0;

const pruefe = (name, ok, was = '') => {
  console.log(`  ${ok ? 'ok  ' : '>>  '}${name}${ok ? '' : ` – ${was}`}`);
  if (!ok) fehler += 1;
};

/** Der komplette Bestand aus der IndexedDB. */
const bestand = () => js(ruf, `
  const db = await new Promise((f, r) => {
    const a = indexedDB.open('trainingstracker', 1);
    a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
  });
  return await new Promise((f, r) => {
    const t = db.transaction('tagebuch', 'readonly').objectStore('tagebuch').get('aktuell');
    t.onsuccess = () => f(t.result); t.onerror = () => r(t.error);
  });
`);

/** Bestand ändern und die Ansicht mit frischem Vorrat neu laden. */
async function vorbereiten(ansicht, aenderung) {
  await js(ruf, `
    const db = await new Promise((f, r) => {
      const a = indexedDB.open('trainingstracker', 1);
      a.onsuccess = () => f(a.result); a.onerror = () => r(a.error);
    });
    const d = await new Promise((f, r) => {
      const t = db.transaction('tagebuch', 'readonly').objectStore('tagebuch').get('aktuell');
      t.onsuccess = () => f(t.result); t.onerror = () => r(t.error);
    });
    (${aenderung})(d, ${JSON.stringify(heute)});
    await new Promise((f, r) => {
      const t = db.transaction('tagebuch', 'readwrite').objectStore('tagebuch').put(d, 'aktuell');
      t.onsuccess = f; t.onerror = () => r(t.error);
    });
    return 1;
  `);
  // Ohne frischen Vorrat zeigt der Service Worker die vorige Fassung.
  await vorratLeeren(ruf);
  await zurAnsicht(ruf, ansicht, { neuLaden: true });
  await warte(700);
}

/* ------------------------------------------------ Gewicht mit Komma */

console.log('\nGewicht eintragen · „77,4"');
await vorbereiten('fortschritt', '(d) => {}');
await js(ruf, `
  [...document.querySelectorAll('button')].find((b) => /Wiegen/.test(b.textContent)).click();
  await new Promise((f) => setTimeout(f, 250));
  const feld = document.querySelector('.dialog input, dialog input');
  feld.value = '77,4';
  feld.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('button')].find((b) => /Speichern/.test(b.textContent)).click();
  return 1;
`);
await warte(700);
{
  const d = await bestand();
  const g = (d.gewicht || []).find((x) => x.datum === heute);
  pruefe('landet als 77,4 kg', g?.kg === 77.4, `gespeichert: ${JSON.stringify(g)}`);
  // Zwei Stellen, ein Wert: Vorher schrieb das Profil den geprüften Wert und
  // der Verlauf die rohe Eingabe – bei einem Komma ein NaN in der Kurve.
  pruefe('Profilgewicht zieht mit', d.profil.gewichtKg === 77.4, `Profil: ${d.profil.gewichtKg}`);
}

/* ------------------------------------- Eigenes Lebensmittel mit Komma */

console.log('\nEigenes Lebensmittel · „162,5" kcal');
await vorbereiten('essen', "(d) => { d.essen = (d.essen || []).filter((e) => e.name !== 'Prüfbrot'); }");
await js(ruf, `
  [...document.querySelectorAll('button')].find((b) => /Eigenes eintragen/.test(b.textContent)).click();
  await new Promise((f) => setTimeout(f, 250));
  // Nur die Felder im Dialog. Vorher stand hier ein ungefiltertes
  // querySelectorAll('input') – das griff jedes Eingabefeld der ganzen
  // Seite. Solange die Essensansicht keins hatte, ging das gut; mit den beiden
  // Häkchen über den Gerichtevorschlägen landete „Prüfbrot" in einer Checkbox
  // und der Befund lautete „nichts gespeichert", obwohl die App fehlerfrei
  // war. Falle 34: Beim Prüfen über das Protokoll ist die Fehlerquelle zuerst
  // die Prüfung.
  const felder = [...document.querySelectorAll('.dialog input, dialog input')];
  // Reihenfolge im DOM: Name, kcal, Protein, Kohlenhydrate, Fett, Menge.
  const werte = ['Prüfbrot', '162,5', '9,2', '30,5', '2,4', '150'];
  felder.forEach((f, i) => {
    if (werte[i] == null) return;
    f.value = werte[i];
    f.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // Der Knopf heißt hier „Eintragen", nicht „Speichern" – Beschriftungen
  // unterscheiden sich je Dialog, deshalb beide Muster.
  [...document.querySelectorAll('button')]
    .find((b) => /^(Eintragen|Speichern)$/.test(b.textContent.trim())).click();
  return 1;
`);
await warte(700);
{
  const e = ((await bestand()).essen || []).find((x) => x.name === 'Prüfbrot');
  pruefe('Eintrag existiert', Boolean(e), 'nichts gespeichert');
  if (e) {
    pruefe('kcal 162,5 statt 0', e.kcal === 162.5, `gespeichert: ${e.kcal}`);
    pruefe('Protein 9,2', e.protein === 9.2, `gespeichert: ${e.protein}`);
    pruefe('Fett 2,4', e.fett === 2.4, `gespeichert: ${e.fett}`);
  }
}

/* ------------------------------------------------ Morgen-Check ändern */

console.log('\nMorgen-Check ändern · nur eine Antwort');
await vorbereiten('heute', `(d, datum) => {
  d.checks = (d.checks || []).filter((c) => c.datum !== datum);
  d.checks.push({ datum, schlaf: 5, muskelkater: 4, stress: 5, stimmung: 4, energie: 5, ruhepuls: 53 });
}`);
const vorher = ((await bestand()).checks || []).find((c) => c.datum === heute);
await js(ruf, `
  [...document.querySelectorAll('button')].find((b) => /^Ändern$/.test(b.textContent.trim())).click();
  await new Promise((f) => setTimeout(f, 250));
  // Ebenfalls auf den Dialog eingegrenzt, aus demselben Grund wie oben.
  const regler = [...document.querySelectorAll('.dialog input[type=range], dialog input[type=range]')];
  const letzter = regler[regler.length - 1];
  letzter.value = '1';
  letzter.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('button')].find((b) => /Speichern/.test(b.textContent)).click();
  return 1;
`);
await warte(700);
{
  const nachher = ((await bestand()).checks || []).find((c) => c.datum === heute);
  // Der Dialog setzte früher jeden Regler auf 3 – wer eine Antwort korrigieren
  // wollte, überschrieb damit stillschweigend alle anderen mit „okay".
  const gleich = ['schlaf', 'muskelkater', 'stress', 'stimmung']
    .filter((f) => vorher?.[f] === nachher?.[f]).length;
  pruefe('die übrigen Antworten bleiben stehen', gleich >= 3,
    `vorher ${JSON.stringify(vorher)} nachher ${JSON.stringify(nachher)}`);
}

/* --------------------------------------- Freier Eintrag im Protokoll */

console.log('\nFreier Eintrag · Felder folgen der Auswahl, nicht dem Plan');
await vorbereiten('heute', '(d) => {}');
const felder = await js(ruf, `
  // „Trotzdem etwas eintragen" steht nur an einem Ruhetag – an Trainingstagen
  // heißen die Knöpfe nach der jeweiligen Einheit. Also zurückblättern, bis
  // ein freier Tag kommt; bei vier Trainingstagen dauert das höchstens drei.
  const zurueck = () => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === '‹');
  let knopf = null;
  for (let i = 0; i < 7; i += 1) {
    knopf = [...document.querySelectorAll('button')]
      .find((b) => /Trotzdem etwas eintragen/.test(b.textContent));
    if (knopf) break;
    const z = zurueck();
    if (!z) break;
    z.click();
    await new Promise((f) => setTimeout(f, 350));
  }
  if (!knopf) return { fehlt: 'kein Ruhetag in den letzten sieben Tagen gefunden' };
  knopf.click();
  await new Promise((f) => setTimeout(f, 300));

  const kasten = document.querySelector('.dialog, dialog');
  // Nicht das erste Auswahlfeld nehmen: Der Sprintblock steht im DOM davor
  // und hat ein eigenes (aus dem Stand / fliegend). Gesucht ist das mit den
  // Einheitenarten – daran hängt die Sichtbarkeit der Blöcke.
  const auswahl = [...kasten.querySelectorAll('select')]
    .find((s) => [...s.options].some((o) => o.value === 'kraft'));
  if (!auswahl) return { fehlt: 'keine Art-Auswahl im Dialog gefunden' };

  const sichtbar = () => {
    const t = kasten.innerText;
    return {
      strecke: t.includes('Kilometer'),
      zeiten: t.includes('Lauf') && t.includes('Tagesbestzeit'),
    };
  };

  const waehle = async (wert) => {
    auswahl.value = wert;
    auswahl.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((f) => setTimeout(f, 250));
    return sichtbar();
  };
  return {
    ausdauer: await waehle('ausdauerLocker'),
    sprint: await waehle('sprint'),
    kraft: await waehle('kraft'),
  };
`);
if (felder.fehlt) {
  pruefe('Dialog erreichbar', false, felder.fehlt);
} else {
  // Die Felder hingen früher an `einheit.typ` aus dem Plan. Beim freien
  // Eintrag ist der leer – die Felder fehlten also genau dann, wenn man eine
  // ungeplante Einheit nachträgt.
  pruefe('Ausdauer: Strecke ja, Zeiten nein',
    felder.ausdauer.strecke && !felder.ausdauer.zeiten, JSON.stringify(felder.ausdauer));
  pruefe('Sprint: Zeiten ja, Strecke nein',
    felder.sprint.zeiten && !felder.sprint.strecke, JSON.stringify(felder.sprint));
  pruefe('Kraft: weder noch',
    !felder.kraft.strecke && !felder.kraft.zeiten, JSON.stringify(felder.kraft));
}

console.log(fehler === 0
  ? '\nAlle Eingabewege tragen.'
  : `\n${fehler} Befund(e) – siehe oben.`);
zu();
process.exit(fehler === 0 ? 0 : 1);
