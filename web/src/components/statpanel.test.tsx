/**
 * Stat panel display regressions.
 *
 * The panel is the product: whatever it prints is what a player will compare
 * against their client. Each test here pins a number that was once rendered
 * wrong or not rendered at all.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeTotals, type StatTotals } from '../engine/stats';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { StatPanel } from './StatPanel';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(totals: StatTotals): void {
  act(() => {
    root.render(<StatPanel totals={totals} />);
  });
}

function text(): string {
  return container.textContent ?? '';
}

const EARTHSHAKER: Item = {
  id: 5667, n: 'Earthshaker', sl: ['PRIMARY'],
  cl: ['WAR', 'PAL', 'RNG', 'SHD', 'BER'], ra: ['ALL'],
  st: { STR: 6, STA: 6, DEX: -5 }, sv: {},
  wp: { dmg: 37, dly: 70, skill: '2H Slashing' },
  fl: [], wt: 16, av: true,
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the stat panel prints the Tier 0 numbers', () => {
  it('shows a weapon that arrives after the panel has already mounted', () => {
    // The Weapons group seeded its open state once, so equipping a first
    // weapon left damage, delay and ratio hidden for the rest of the session.
    render(computeTotals([]));
    expect(text()).not.toContain('74/70');

    render(computeTotals([{ position: 'PRIMARY', item: EARTHSHAKER, upgrade: tier(10) }]));
    expect(text()).toContain('74/70');
    expect(text()).toContain('1.057');
  });

  it('prints Earthshaker +10 exactly as the client does', () => {
    render(computeTotals([{ position: 'PRIMARY', item: EARTHSHAKER, upgrade: tier(10) }]));
    const body = text();
    expect(body).toContain('74/70'); // damage / delay
    expect(body).toContain('1.057'); // ratio
    expect(body).toContain('16/510'); // Strength and Stamina against the cap
    expect(body).toContain('10/1000'); // synthetic SV Void
    expect(body).not.toContain('NaN');
  });

  it('prints equipped weight once, to one decimal, in both places', () => {
    const totals = computeTotals([
      { position: 'PRIMARY', item: EARTHSHAKER, upgrade: tier(10) },
    ]);
    expect(totals.weight).toBeCloseTo(1.6, 5);
    // Rounding the row to a whole number printed the same weight as 1.7 and 2.
    render(totals);
    const shown = [...container.querySelectorAll('.stat-row')]
      .filter((row) => row.textContent?.includes('Equipped Wt'))
      .map((row) => row.textContent);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain("1.6");
    expect(shown[0]).not.toContain("Wt2");
  });

  it('renders zeros rather than blanks on an empty set', () => {
    render(computeTotals([]));
    const body = text();
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');
    expect(body).toContain('0/510');
    expect(body).toContain('0/1000');
  });

  it('shows the stats that used to be dropped on the floor', () => {
    const talisman: Item = {
      id: null, n: 'Talisman of Kejaar Kerrath', sl: ['NECK'], cl: ['ALL'], ra: ['ALL'],
      st: { ENDUR_REGEN: 2, HP_REGEN: 2, MANA_REGEN: 2, ATTACK: 7, BACKSTAB: 10 },
      sv: {}, fl: [], av: true,
    };
    render(computeTotals([{ position: 'NECK', item: talisman, upgrade: tier(0) }]));
    const rows = [...container.querySelectorAll('.stat-row')].map((r) => r.textContent ?? '');
    const find = (label: string) => rows.find((r) => r.startsWith(label)) ?? '';
    expect(find('Combat End Regen')).toContain('2');
    expect(find('Combat HP Regen')).toContain('2');
    expect(find('Combat Mana Regen')).toContain('2');
    expect(find('Attack')).toContain('7');
    expect(find('Backstab')).toContain('10');
  });
});

/**
 * Haste, which is the one figure on this panel printed in a unit nobody has
 * confirmed.
 *
 * The row used to read `36%`. The label is the client's own — the game's Stats
 * window does head it `Attack Speed %` — but the number under it is the wiki's
 * per-item haste field, and two sources disagree about whether that field is
 * that percentage or a flat attack-speed value on another scale. A percent sign
 * on it asserted the disputed reading and printed it as settled.
 *
 * These tests pin the honest shape: the figure, no unit, a mark on the tile, and
 * the paragraph beside it. The day a Legends haste tooltip settles the question,
 * they are rewritten to the new truth rather than deleted.
 */
describe('the haste figure carries its provenance instead of a percent sign', () => {
  const CLOAK: Item = {
    id: null, n: 'Cloak of Flames', sl: ['BACK'], cl: ['ALL'], ra: ['ALL'],
    st: { HASTE: 36 }, sv: {}, fl: [], av: true,
  };
  const BELT: Item = {
    id: null, n: 'Belt of Contention', sl: ['WAIST'], cl: ['ALL'], ra: ['ALL'],
    st: { HASTE: 21 }, sv: {}, fl: [], av: true,
  };

  function vital(label: string): string {
    const rows = [...container.querySelectorAll('.stat-row.vital')];
    return rows.find((r) => (r.textContent ?? '').startsWith(label))?.textContent ?? '';
  }

  it('prints the number and refuses to print the unit', () => {
    render(computeTotals([{ position: 'BACK', item: CLOAK, upgrade: tier(0) }]));
    const row = vital('Atk Speed');
    expect(row).toContain('36');
    expect(row).not.toContain('36%');
  });

  it('marks the tile itself, so the badge travels with the hoisted Vitals block', () => {
    render(computeTotals([{ position: 'BACK', item: CLOAK, upgrade: tier(0) }]));
    const rows = [...container.querySelectorAll('.stat-row.vital')];
    const speed = rows.find((r) => (r.textContent ?? '').startsWith('Atk Speed'));
    expect(speed?.querySelector('.tier.t5')).toBeTruthy();
  });

  it('states both readings, picks neither, and names what would settle it', () => {
    render(computeTotals([{ position: 'BACK', item: CLOAK, upgrade: tier(0) }]));
    const body = text();
    expect(body).toContain('Atk Speed carries an unconfirmed unit');
    expect(body).toMatch(/percentage that divided weapon delay/i);
    expect(body).toMatch(/flat attack-speed/i);
    expect(body).toMatch(/screenshot/i);
  });

  it('states the highest-wins rule as an assumption, and says what it discarded', () => {
    render(
      computeTotals([
        { position: 'BACK', item: CLOAK, upgrade: tier(0) },
        { position: 'WAIST', item: BELT, upgrade: tier(0) },
      ]),
    );
    const body = text();
    expect(vital('Atk Speed')).toContain('36');
    expect(body).toMatch(/Only the highest worn haste counts/i);
    expect(body).toMatch(/2 worn items carry a haste figure/i);
    expect(body).toMatch(/assumed, not measured/i);
  });

  it('says nothing at all about haste on a set that has none', () => {
    render(computeTotals([]));
    expect(container.querySelector('.stat-note')).toBeNull();
    expect(vital('Atk Speed')).toContain('0');
    expect(container.querySelector('.stat-row.vital .tier')).toBeNull();
  });
});
