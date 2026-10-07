// Bleibt die App über Mitternacht offen, zieht „heute" mit?
//
// Auf dem iPhone bleibt eine App vom Startbildschirm oft über Nacht im
// Speicher. Ohne Tageswechsel stand morgens noch der Vortag da, und der
// Morgen-Check landete still auf gestern (siehe `tageswechsel()` in
// app/app.js). Nachgestellt wird der Tageswechsel über die Zeitzone: In
// Pago Pago (UTC−11) und auf Kiritimati (UTC+14) ist zu fast jeder Uhrzeit
// ein anderer Kalendertag – ein Zonenwechsel ist für die App dasselbe wie
// eine durchgeschlafene Nacht.
//
//   node werkzeug/mitternacht.mjs
//
// Gibt einen Exitcode zurück. Verändert den Bestand nicht.
import { verbinde, js, warte, vorratLeeren } from './cdp.mjs';

const APP_PORT = Number(process.env.APP_PORT) || 3140;
const fehler = [];
function pruefe(bedingung, text) {
  console.log(`${bedingung ? 'ok  ' : 'FEHL'} ${text}`);
  if (!bedingung) fehler.push(text);
}

const { ruf, zu } = await verbinde();
const zone = (timezoneId) => ruf('Emulation.setTimezoneOverride', { timezoneId });
const lage = () => js(ruf, `
  const a = await import('/app/app.js');
  const r = await import('/kern/regeln.js');
  return { angesehen: a.zustand.datum, heute: r.heute(),
    leiste: document.querySelector('.datums-leiste')?.textContent || '' };`);
const aufwachen = () => js(ruf, `
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((f) => setTimeout(f, 700));
  return true;`);

try {
  await zone('Pacific/Pago_Pago');
  await ruf('Page.navigate', { url: `http://localhost:${APP_PORT}/#heute` });
  // Der Service Worker bedient zuerst aus dem Vorrat: Ohne Leeren prüft das
  // Werkzeug die Fassung des vorigen Laufs – beim Gegenprüfen genau
  // passiert, die Verfälschung schlug erst einen Lauf später an.
  await warte(800);
  await vorratLeeren(ruf);
  // Neu laden: Eine Navigation auf denselben Hash lädt nicht, und die Seite
  // stammte dann noch aus der alten Zone (Stolperstein aus CLAUDE.md).
  await ruf('Page.reload', {});
  await warte(1500);
  const abends = await lage();
  pruefe(abends.angesehen === abends.heute, `Beim Öffnen gilt heute (${abends.angesehen})`);

  // Die Nacht vergeht, die App bleibt offen.
  await zone('Pacific/Kiritimati');
  await aufwachen();
  const morgens = await lage();
  pruefe(morgens.heute !== abends.heute, `Der Kalendertag hat gewechselt (${abends.heute} → ${morgens.heute})`);
  pruefe(morgens.angesehen === morgens.heute,
    `Nach dem Aufwachen zeigt die App den neuen Tag (${morgens.angesehen})`);
  pruefe(!/zurück zu heute/.test(morgens.leiste), 'Die Datumsleiste behauptet keinen vergangenen Tag');

  // Wer bewusst zurückgeblättert hat, bleibt dort.
  await zone('Pacific/Pago_Pago');
  await ruf('Page.reload', {});
  await warte(1500);
  await js(ruf, `
    const a = await import('/app/app.js');
    const r = await import('/kern/regeln.js');
    await a.tagWechseln(r.datumPlus(r.heute(), -3));
    return true;`);
  const geblaettert = (await lage()).angesehen;
  await zone('Pacific/Kiritimati');
  await aufwachen();
  pruefe((await lage()).angesehen === geblaettert,
    `Ein bewusst gewählter Tag bleibt über Nacht stehen (${geblaettert})`);
} finally {
  await ruf('Emulation.setTimezoneOverride', { timezoneId: '' }).catch(() => {});
  zu();
}

console.log(fehler.length ? `\n${fehler.length} Fehler.` : '\nAlles in Ordnung.');
process.exit(fehler.length ? 1 : 0);
