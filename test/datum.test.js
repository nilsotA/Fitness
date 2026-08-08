// Datumsrechnung. Klingt nach Kleinkram, war aber ein echter Fehler: Zwischen
// Mitternacht und zwei Uhr morgens lag der ganze Tracker einen Tag zurück.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { heute, wochentagIndex, datumPlus } from '../kern/regeln.js';

test('Heute richtet sich nach der Ortszeit, nicht nach UTC', () => {
  // Halb eins nachts in Deutschland. `toISOString()` läge hier noch auf dem
  // 7. – eine nach einer späten Einheit protokollierte Einheit landete damit
  // auf dem falschen Tag, und der Vorwärtsknopf ließ den richtigen nicht zu.
  const nachts = new Date('2026-08-08T00:30:00+02:00');
  assert.equal(nachts.toISOString().slice(0, 10), '2026-08-07', 'so war es vorher');

  // Der Test läuft in der Zeitzone des Prozesses – deshalb hier ein Datum,
  // dessen Ortsangaben unabhängig davon stimmen.
  const mittags = new Date(2026, 7, 8, 12, 0, 0);
  assert.equal(heute(mittags), '2026-08-08');

  const kurzVorMitternacht = new Date(2026, 7, 8, 23, 59, 0);
  assert.equal(heute(kurzVorMitternacht), '2026-08-08');

  const kurzNachMitternacht = new Date(2026, 7, 8, 0, 1, 0);
  assert.equal(heute(kurzNachMitternacht), '2026-08-08');
});

test('Einstellige Monate und Tage bekommen ihre Null', () => {
  assert.equal(heute(new Date(2026, 0, 5, 12)), '2026-01-05');
  assert.equal(heute(new Date(2026, 11, 31, 12)), '2026-12-31');
});

test('In Berlin um halb eins nachts stimmt das Datum', () => {
  // Der eigentliche Beweis: ein zweiter Prozess in der Zeitzone, in der Nils
  // sitzt, mit einer festgesetzten Uhrzeit kurz nach Mitternacht.
  const skript = `
    import { heute } from '${new URL('../kern/regeln.js', import.meta.url).pathname}';
    process.stdout.write(heute(new Date('2026-08-08T00:30:00+02:00')));
  `;
  const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
    env: { ...process.env, TZ: 'Europe/Berlin' },
    encoding: 'utf8',
  });
  assert.equal(ausgabe, '2026-08-08');
});

test('Der Wochentag stimmt auch westlich von Greenwich', () => {
  // Der 7. August 2026 ist ein Freitag – Index 4, weil Montag 0 ist.
  const pruefen = (tz) => {
    const skript = `
      import { wochentagIndex } from '${new URL('../kern/regeln.js', import.meta.url).pathname}';
      process.stdout.write(String(wochentagIndex('2026-08-07')));
    `;
    return execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    });
  };

  // `new Date('2026-08-07')` ist UTC-Mitternacht. In Los Angeles ist das noch
  // der 6. – der Wochenplan verschöbe sich um einen ganzen Tag.
  assert.equal(pruefen('Europe/Berlin'), '4');
  assert.equal(pruefen('America/Los_Angeles'), '4');
  assert.equal(pruefen('Pacific/Kiritimati'), '4');
});

test('Wochentage laufen von Montag bis Sonntag', () => {
  // 2026-08-03 ist ein Montag.
  const woche = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06',
    '2026-08-07', '2026-08-08', '2026-08-09'];
  assert.deepEqual(woche.map(wochentagIndex), [0, 1, 2, 3, 4, 5, 6]);
});

test('Tage verschieben überspringt keine Monats- und Jahresgrenzen', () => {
  assert.equal(datumPlus('2026-08-07', 1), '2026-08-08');
  assert.equal(datumPlus('2026-08-07', -1), '2026-08-06');
  assert.equal(datumPlus('2026-08-31', 1), '2026-09-01');
  assert.equal(datumPlus('2026-01-01', -1), '2025-12-31');
  assert.equal(datumPlus('2028-02-28', 1), '2028-02-29', 'Schaltjahr');
  assert.equal(datumPlus('2026-08-07', 0), '2026-08-07');
});

test('Über die Sommerzeitumstellung hinweg bleibt es ein Tag', () => {
  // In der Nacht auf den 29. März 2026 wird in Deutschland umgestellt. Mit
  // Stundenarithmetik käme hier ein Tag zu wenig oder zu viel heraus.
  const skript = `
    import { datumPlus } from '${new URL('../kern/regeln.js', import.meta.url).pathname}';
    process.stdout.write([
      datumPlus('2026-03-28', 1), datumPlus('2026-03-29', -1),
      datumPlus('2026-10-24', 1), datumPlus('2026-10-25', -1),
    ].join(','));
  `;
  const ausgabe = execFileSync(process.execPath, ['--input-type=module', '-e', skript], {
    env: { ...process.env, TZ: 'Europe/Berlin' },
    encoding: 'utf8',
  });
  assert.equal(ausgabe, '2026-03-29,2026-03-28,2026-10-25,2026-10-24');
});

test('Unsinnige Eingaben geben keinen Unsinn zurück', () => {
  assert.equal(wochentagIndex(''), 0);
  assert.equal(wochentagIndex(null), 0);
  assert.equal(datumPlus('', 1), '');
});
