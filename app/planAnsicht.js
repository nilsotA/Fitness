// Wochenplan: was der Planer aus Regler, Phase und verfügbaren Tagen macht.

import { el, karte, kennzahl, hinweis, toast, zahl, dauer, TYP_NAMEN } from './common.js';
import * as daten from './daten.js';
import { BLOCKFOLGE, PHASEN } from '../kern/wissen.js';

let gezeigteWoche = null;

export function planAnsicht(d) {
  if (gezeigteWoche == null) gezeigteWoche = Math.max(1, d.woche);
  const box = el('div', {});
  box.append(el('h1', {}, 'Wochenplan'));
  box.append(planInhalt(d.plan, d));
  return box;
}

function planInhalt(plan, d) {
  const box = el('div', {});

  box.append(karte(
    el('div', { class: 'karte-kopf' },
      el('h2', {}, `Woche ${plan.woche} · ${plan.phase.name}`),
      el('span', { class: 'mini' }, dauer(plan.wochenminuten))),
    el('p', { class: 'klein' }, plan.phase.beschreibung),
    el('div', { class: 'kennzahlen', style: { marginTop: '0.7rem' } },
      kennzahl(plan.verteilung.sprint, 'Sprint', 'Einheiten', 'var(--sprint)'),
      kennzahl(plan.verteilung.kraft, 'Kraft', 'Einheiten', 'var(--kraft)'),
      kennzahl(plan.verteilung.ausdauer, 'Ausdauer', 'Einheiten', 'var(--ausdauer)'),
      kennzahl(zahl(plan.sprintmeter), 'Sprintmeter', 'hochwertig')),
    el('div', { class: 'knopf-reihe' },
      el('button', {
        class: 'knopf leise',
        onclick: () => bewegeWoche(-1, d),
        disabled: plan.woche <= 1,
      }, '← Woche davor'),
      el('button', { class: 'knopf leise', onclick: () => bewegeWoche(1, d) }, 'Woche danach →'),
      plan.woche !== Math.max(1, d.woche)
        ? el('button', { class: 'knopf leise', onclick: () => springeZu(Math.max(1, d.woche), d) }, 'Zur aktuellen')
        : null)));

  for (const h of plan.hinweise) box.append(hinweis(h.text, h.art));

  for (const tag of plan.tage) {
    const tagBox = karte(
      el('div', { class: 'karte-kopf' },
        el('h2', {}, tag.name),
        el('span', { class: 'mini' }, tag.trainingstag ? dauer(tag.minuten) : 'frei')));

    if (!tag.trainingstag) {
      tagBox.style.opacity = '0.6';
      tagBox.append(el('p', { class: 'klein' }, 'Ruhetag.'));
    } else {
      for (const einheit of tag.einheiten) tagBox.append(einheitKarte(einheit));
    }
    box.append(tagBox);
  }

  box.append(zyklusKarte(plan.woche));

  return box;
}

/* -------------------------------------------------------------- Zyklus */

export const PHASENFARBE = {
  aufbau: 'var(--ausdauer)',
  intensivierung: 'var(--kraft)',
  realisierung: 'var(--sprint)',
  entlastung: 'rgba(255,255,255,0.1)',
};

const ZAHLWORT = ['keine', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs',
  'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'];

const grossAmAnfang = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** „drei Wochen Aufbau, eine Woche Entlastung, …" – aus der Blockfolge selbst. */
function zyklusSatz() {
  const bloecke = [];
  for (const schluessel of BLOCKFOLGE) {
    const letzter = bloecke[bloecke.length - 1];
    if (letzter && letzter.schluessel === schluessel) letzter.wochen += 1;
    else bloecke.push({ schluessel, wochen: 1 });
  }
  return bloecke.map(({ schluessel, wochen }) => {
    const name = PHASEN[schluessel]?.name || schluessel;
    const zahlwort = ZAHLWORT[wochen] || String(wochen);
    return wochen === 1 ? `eine Woche ${name}` : `${zahlwort} Wochen ${name}`;
  }).join(', ');
}

/**
 * Der Streifen kommt aus BLOCKFOLGE, nicht aus nachgebauten Wochengrenzen.
 *
 * Vorher stand hier „Woche ≤ 3 ist Aufbau, ≤ 7 Intensivierung" plus
 * „jede vierte ist Entlastung" – eine zweite Fassung derselben Regel. Ändert
 * jemand den Zyklus in `wissen.js`, zeigt der Streifen andere Farben als der
 * Plan direkt darüber, und keiner der beiden sagt, welcher recht hat.
 *
 * Zugleich behoben: Der aktuelle Balken hing an `nummer === plan.woche`. Ab
 * Woche 13 leuchtete deshalb keiner mehr – der Zyklus läuft aber weiter, er
 * fängt nur von vorn an.
 */
function zyklusKarte(woche) {
  const imZyklus = ((Math.max(1, woche) - 1) % BLOCKFOLGE.length) + 1;
  const gesehen = [];

  return karte(
    el('h2', {}, 'Der Zyklus'),
    el('p', { class: 'klein' },
      `${grossAmAnfang(ZAHLWORT[BLOCKFOLGE.length] || String(BLOCKFOLGE.length))} Wochen: `
      + `${zyklusSatz()}. Jeder Block verschiebt den Schwerpunkt, statt alles `
      + 'gleichzeitig zu wollen – das ist der Unterschied zwischen Training und '
      + 'bloßem Trainieren.'),
    el('div', { style: { display: 'flex', gap: '2px', marginTop: '0.6rem' } },
      ...BLOCKFOLGE.map((schluessel, i) => {
        const nummer = i + 1;
        if (!gesehen.includes(schluessel)) gesehen.push(schluessel);
        return el('div', {
          title: `Woche ${nummer} · ${PHASEN[schluessel]?.name || schluessel}`,
          style: {
            flex: '1',
            height: '22px',
            borderRadius: '4px',
            background: PHASENFARBE[schluessel] || 'var(--line)',
            opacity: nummer === imZyklus ? '1' : '0.35',
            outline: nummer === imZyklus ? '2px solid var(--text)' : 'none',
          },
        });
      })),
    el('div', { class: 'mini', style: { marginTop: '0.4rem', display: 'flex', gap: '0.7rem', flexWrap: 'wrap' } },
      ...gesehen.map((schluessel) => el('span',
        { style: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem' } },
        el('span', {
          style: {
            width: '10px',
            height: '10px',
            borderRadius: '3px',
            background: PHASENFARBE[schluessel] || 'var(--line)',
          },
        }),
        PHASEN[schluessel]?.name || schluessel))),
    woche > BLOCKFOLGE.length
      ? el('p', { class: 'mini', style: { marginTop: '0.4rem' } },
        `Woche ${woche} insgesamt – der Zyklus läuft in seiner `
        + `${Math.floor((woche - 1) / BLOCKFOLGE.length) + 1}. Runde.`)
      : null);
}

async function bewegeWoche(richtung, d) {
  await springeZu(Math.max(1, gezeigteWoche + richtung), d);
}

async function springeZu(woche, d) {
  try {
    const plan = await daten.wochenplan(woche);
    gezeigteWoche = woche;
    const box = document.querySelector('#inhalt');
    box.replaceChildren(el('div', {}, el('h1', {}, 'Wochenplan'), planInhalt(plan, d)));
    window.scrollTo({ top: 0 });
  } catch (err) {
    toast(err.message, 'fehler');
  }
}

/** Eine Einheit als aufklappbare Karte. Auch von der Heute-Ansicht genutzt. */
export function einheitKarte(einheit) {
  const a = einheit.anpassung;

  const box = el('div', { class: `einheit ${einheit.typ} ${a ? 'angepasst' : ''}` },
    el('div', { class: 'einheit-kopf' },
      el('div', {},
        el('div', { class: 'einheit-titel' }, einheit.titel),
        el('div', { class: 'mini' }, einheit.fokus || TYP_NAMEN[einheit.typ] || '')),
      el('div', { class: 'einheit-meta' },
        dauer(einheit.minuten),
        einheit.meter ? el('div', {}, `${zahl(einheit.meter)} m`) : null)));

  // Eine stillschweigend veränderte Einheit wäre schlimmer als eine unveränderte:
  // Man würde sich fragen, warum der Plan heute anders aussieht als gestern.
  if (a) {
    box.append(el('div', { class: 'anpassung-hinweis' },
      el('strong', {}, a.art === 'gestrichen' ? 'Gestrichen' : 'Gekürzt'),
      ` – ${a.grund}. `,
      a.art === 'gestrichen'
        ? `Ursprünglich geplant: ${a.original.titel}, ${dauer(a.original.minuten)}.`
        : `Ursprünglich ${dauer(a.original.minuten)}.`));
  }

  for (const block of einheit.bloecke || []) {
    box.append(el('div', { class: 'block' },
      el('div', { class: 'block-titel' }, block.titel),
      el('div', { class: 'block-inhalt' }, block.inhalt)));
  }

  if (einheit.uebungen) {
    // Keine Tabelle: Vier Spalten sind auf einem 390 px breiten Bildschirm zu
    // eng, und genau dort wird das hier gelesen – zwischen zwei Sätzen, mit dem
    // Handy in der Hand. Die Vorgabe steht deshalb als eigene Zeile, groß genug
    // zum Erfassen, ohne die Augen zusammenzukneifen.
    const liste = el('div', { class: 'uebung-liste' });

    for (const u of einheit.uebungen) {
      liste.append(el('div', { class: 'uebung-zeile' },
        el('div', { class: 'uebung-zeile-kopf' },
          el('span', { class: 'uebung-zeile-name' }, u.name),
          el('span', { class: 'uebung-zeile-vorgabe' }, `${u.saetze} × ${u.wiederholungen}`)),
        el('div', {
          class: `uebung-zeile-last ${u.gewicht && !u.gewicht.geschaetzt ? 'last-konkret' : 'last-geschaetzt'}`,
        }, u.intensitaet),
        u.gewicht
          ? el('div', { class: 'mini' },
            `1RM ${zahl(u.gewicht.e1rm, 1)} kg`
            + (u.gewicht.geschaetzt ? ', geschätzt' : ` · ${u.gewicht.quelle}`))
          : null,
        el('div', { class: 'mini' }, u.hinweis),
        u.vorschlag ? el('div', { class: 'mini uebung-vorschlag' }, u.vorschlag.text) : null));
    }

    box.append(el('div', { class: 'block' }, liste));

    // Ohne Datenlage stehen dort Prozentangaben, mit denen am Gerät niemand
    // etwas anfangen kann. Das sagt der Plan lieber offen.
    if (einheit.uebungen.some((u) => !u.gewicht && !u.koerpergewicht)) {
      box.append(el('div', { class: 'mini', style: { marginTop: '0.4rem' } },
        'Noch Prozentangaben statt Kilo: Sobald du Sätze protokollierst oder unter '
        + 'Fortschritt einen Krafttest einträgst, rechnet der Plan hier echte Lasten aus.'));
    }
  }

  if (einheit.prophylaxe) {
    const liste = el('div', { class: 'uebung-liste' });
    for (const u of einheit.prophylaxe) {
      liste.append(el('div', { class: 'uebung-zeile' },
        el('div', { class: 'uebung-zeile-kopf' },
          el('span', { class: 'uebung-zeile-name' }, u.name),
          el('span', { class: 'uebung-zeile-vorgabe' }, `${u.saetze} × ${u.wiederholungen}`)),
        el('div', { class: 'mini' }, u.hinweis)));
    }
    box.append(el('div', { class: 'block' },
      el('div', { class: 'block-titel' }, 'Prophylaxe (immer dabei)'),
      liste));
  }

  if (einheit.warum) box.append(el('div', { class: 'warum' }, einheit.warum));

  return box;
}
