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
    expect(totals.weight).toBeCloseTo(1.7, 5);
    // Rounding the row to a whole number printed the same weight as 1.7 and 2.
    render(totals);
    const shown = [...container.querySelectorAll('.stat-row')]
      .filter((row) => row.textContent?.includes('Equipped Weight'))
      .map((row) => row.textContent);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain('1.7');
    expect(shown[0]).not.toContain('Weight2');
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
