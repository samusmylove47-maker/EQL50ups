import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveItem } from './stats';
import { tier } from './upgrade';
import type { Item } from './types';

const raw = JSON.parse(readFileSync('public/data/items-index.json', 'utf8'));
const list: Item[] = Array.isArray(raw) ? raw : raw.items;
const byName = new Map(list.map((i) => [i.n, i]));

describe('shipped catalog through the engine reproduces the live client', () => {
  it('Earthshaker at +10 matches the screenshot exactly', () => {
    const item = byName.get('Earthshaker')!;
    const r = resolveItem(item, tier(10));
    expect(r.weapon!.damage).toBe(74);
    expect(r.weapon!.delay).toBe(70);
    expect(Number(r.weapon!.ratio.toFixed(3))).toBeCloseTo(1.057, 3);
    expect(r.attributes.STR).toBe(16);
    expect(r.attributes.STA).toBe(16);
    expect(r.saves.VOID).toBe(10);
    // The screenshot shows no Dexterity line: base -5 is erased at +10.
    expect(r.attributes.DEX).toBe(0);
  });

  it('Whitened Treant Fists damage curve matches +0..+3', () => {
    const item = byName.get('Whitened Treant Fists')!;
    expect([0, 1, 2, 3].map((t) => resolveItem(item, tier(t)).weapon!.damage))
      .toEqual([14, 15, 16, 18]);
  });
});
