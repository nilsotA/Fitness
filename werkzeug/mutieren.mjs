// Halten die Tests, was sie versprechen?
//
// Alle bisherigen Prüfungen fragen „rechnet der Kern richtig?". Diese fragt das
// Gegenteil: Wenn ich den Kern absichtlich kaputt mache – merkt es jemand? Ein
// Test, der eine Verfälschung überlebt, prüft an dieser Stelle nichts (Falle 18,
// als Messung statt als Verdacht).
//
//   node werkzeug/mutieren.mjs            # alle kern/-Dateien
//   node werkzeug/mutieren.mjs leistung   # nur eine
//
// Verfälscht werden Vergleiche und Grenzen – genau die Stellen, an denen die
// Fallenliste dieses Projekts immer wieder zuschnappt (Nr. 6, 10, 17, 18, 19).
// Zeichenketten und Kommentare bleiben aussen vor: Ein geänderter Text ist
// kein geändertes Verhalten.
//
// **Das Werkzeug schreibt in `kern/`** – immer nur eine Datei zur Zeit, und es
// legt sie sofort wieder zurück, auch bei Abbruch (siehe unten). Trotzdem: Vor
// dem Lauf nichts Uncommittetes in `kern/` liegen lassen, und wenn doch etwas
// schiefgeht, hilft `git checkout -- kern/`.
//
// Ein voller Lauf über alle Dateien dauert rund eine Viertelstunde. Mit dem
// Dateinamen als Argument geht es datei­weise, was zum Nacharbeiten praktischer
// ist.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const WURZEL = new URL('..', import.meta.url).pathname;
const filter = process.argv[2] || '';

/** Vertauschungen, die das Verhalten ändern, ohne den Code zu zerstören. */
const TAUSCH = [
  [' >= ', ' > '], [' <= ', ' < '],
  [' > ', ' >= '], [' < ', ' <= '],
  ['Math.max(', 'Math.min('], ['Math.min(', 'Math.max('],
  [' && ', ' || '],
];

/** Zeilen, in denen eine Vertauschung nichts über das Verhalten aussagt. */
function ueberspringen(zeile) {
  const t = zeile.trim();
  if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  // Zeilen mit Zeichenketten: Dort steckt der Operator oft im Text.
  if (/['"`]/.test(zeile)) return true;
  return false;
}

function stellen(quelle) {
  const zeilen = quelle.split('\n');
  const gefunden = [];
  zeilen.forEach((zeile, nr) => {
    if (ueberspringen(zeile)) return;
    for (const [von, nach] of TAUSCH) {
      let ab = 0;
      for (;;) {
        const i = zeile.indexOf(von, ab);
        if (i < 0) break;
        gefunden.push({ nr, spalte: i, von, nach });
        ab = i + von.length;
      }
    }
  });
  return gefunden;
}

const dateien = readdirSync(`${WURZEL}kern`)
  .filter((n) => n.endsWith('.js') && n !== 'wissen.js')
  .filter((n) => !filter || n.includes(filter));

let gesamt = 0;
let ueberlebt = 0;
const berichte = [];

// Wer diesen Lauf abbricht, darf keine verfälschte Datei zurücklassen.
//
// Genau das ist beim ersten Einsatz passiert: Der Lauf wurde nach zehn Minuten
// gestoppt, und `kern/belastung.js` stand mit vertauschtem Vergleich im
// Arbeitsverzeichnis – einen Commit davon entfernt, eine kaputte Bedingung ins
// Repository zu schreiben. Ein Werkzeug, das die Quelle anfasst, muss beim
// Abbruch aufräumen; sonst ist es gefährlicher als das, was es misst.
let inArbeit = null;
function zuruecklegen() {
  if (!inArbeit) return;
  writeFileSync(inArbeit.pfad, inArbeit.original);
  inArbeit = null;
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { zuruecklegen(); process.exit(130); });
}
process.on('uncaughtException', (fehler) => { zuruecklegen(); throw fehler; });

for (const datei of dateien) {
  const pfad = `${WURZEL}kern/${datei}`;
  const original = readFileSync(pfad, 'utf8');
  const orte = stellen(original);
  process.stdout.write(`\n${datei}: ${orte.length} Stellen `);

  for (const ort of orte) {
    const zeilen = original.split('\n');
    const z = zeilen[ort.nr];
    zeilen[ort.nr] = z.slice(0, ort.spalte) + ort.nach + z.slice(ort.spalte + ort.von.length);
    inArbeit = { pfad, original };
    writeFileSync(pfad, zeilen.join('\n'));
    gesamt += 1;

    let gemerkt = false;
    try {
      execFileSync('bash', ['-c', 'node --test test/*.test.js'], { cwd: WURZEL, stdio: 'pipe', timeout: 120000 });
    } catch {
      gemerkt = true; // Irgendein Test ist gefallen – gut.
    }
    zuruecklegen();

    if (gemerkt) { process.stdout.write('.'); } else {
      ueberlebt += 1;
      process.stdout.write('!');
      berichte.push({
        datei, zeile: ort.nr + 1, tausch: `${ort.von.trim()} → ${ort.nach.trim()}`,
        code: z.trim().slice(0, 100),
      });
    }
  }
}

console.log(`\n\n${gesamt} Verfälschungen, ${ueberlebt} unbemerkt.`);
for (const b of berichte) {
  console.log(`\n  ${b.datei}:${b.zeile}  ${b.tausch}`);
  console.log(`    ${b.code}`);
}
process.exit(ueberlebt === 0 ? 0 : 1);
