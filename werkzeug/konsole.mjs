// Sammelt Konsolenfehler und Ausnahmen über alle Ansichten.
//
// Ein Fehler in einer Ansicht, die man gerade nicht ansieht, bleibt sonst
// unbemerkt – die App fängt fast alles ab und zeigt weiter etwas an.
//
//   node werkzeug/konsole.mjs
import { verbinde, zurAnsicht, ANSICHTEN, warte } from './cdp.mjs';

const { ruf, bei, zu } = await verbinde();
const meldungen = [];

bei((a) => {
  if (a.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(a.params.type)) {
    meldungen.push(`${a.params.type}: `
      + a.params.args.map((x) => x.value ?? x.description ?? x.type).join(' '));
  }
  if (a.method === 'Runtime.exceptionThrown') {
    const d = a.params.exceptionDetails;
    meldungen.push(`AUSNAHME: ${d.text} ${d.exception?.description || ''}`.slice(0, 400));
  }
  if (a.method === 'Log.entryAdded' && a.params.entry.level === 'error') {
    meldungen.push(`log: ${a.params.entry.text}`.slice(0, 400));
  }
});

await ruf('Runtime.enable');
await ruf('Log.enable');
await ruf('Page.enable');

for (const ansicht of ANSICHTEN) {
  await zurAnsicht(ruf, ansicht);
  await warte(500);
}

console.log(meldungen.length ? meldungen.join('\n') : 'Keine Fehler oder Warnungen.');
zu();
process.exit(meldungen.length ? 1 : 0);
