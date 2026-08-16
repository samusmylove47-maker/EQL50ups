/**
 * Exaltations: what a donor actually does to its host.
 *
 * The Tier 0 fixtures are the ones the client showed us — a Bladestopper +6
 * holding a Focus donor that yields `String Resonance 11` and a Click donor
 * that yields `Rune IV (Must Equip)`, and a Bone-Clasped Girdle +4 holding
 * `Burning Affliction III`.
 */

import { describe, expect, it } from 'vitest';
import { SLOT_POSITIONS } from '../engine/constants';
import { makeContext } from '../engine/character';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';
import type { FocusEffectEntry } from '../data/catalog';
import { exaltationPlan } from './exaltations';
import type { SlotView } from './gear';

function item(overrides: Partial<Item> & { n: string }): Item {
  return {
    id: null,
    sl: ['SECONDARY'],
    cl: ['ALL'],
    ra: ['ALL'],
    st: {},
    sv: {},
    fl: [],
    av: true,
    ...overrides,
  };
}

const BLADESTOPPER = item({ n: 'Bladestopper', sl: ['SECONDARY'], st: { AC: 25, HP: 50 } });
const GIRDLE = item({ n: 'Bone-Clasped Girdle', sl: ['WAIST'], st: { AC: 4 } });

const LUTE = item({
  n: 'Lute of the Gypsy Princess',
  sl: ['SECONDARY', 'RANGE'],
  cl: ['BRD'],
  fx: [{ k: 'focus', n: 'String Resonance 11' }],
});
const RUNE_DONOR = item({
  n: 'Bladestopper',
  sl: ['SECONDARY'],
  fx: [{ k: 'click', n: 'Rune IV', d: 'Must Equip, Casting Time: Instant' }],
});
const BURNING_III = item({
  n: 'Charred Guardian Shield',
  sl: ['WAIST', 'SECONDARY'],
  fx: [{ k: 'focus', n: 'Burning Affliction III' }],
});
const BURNING_II = item({
  n: 'Lesser Ember Band',
  sl: ['WAIST', 'SECONDARY'],
  fx: [{ k: 'focus', n: 'Burning Affliction II' }],
});
const PLATE_ONLY = item({
  n: 'Warlord Sigil',
  sl: ['SECONDARY'],
  cl: ['WAR', 'PAL'],
  fx: [{ k: 'worn', n: 'Sigil of Steel' }],
});
const WRONG_SLOT = item({
  n: 'Boot Charm',
  sl: ['FEET'],
  fx: [{ k: 'proc', n: 'Kick Harder' }],
});

const CATALOG_ITEMS = [
  BLADESTOPPER, GIRDLE, LUTE, RUNE_DONOR, BURNING_III, BURNING_II, PLATE_ONLY, WRONG_SLOT,
];

const EFFECTS = new Map<string, FocusEffectEntry>([
  [
    'string resonance 11',
    { n: 'String Resonance 11', d: 'Increases the effect of stringed instruments.' },
  ],
]);

function catalog() {
  const byName = new Map<string, Item>();
  for (const entry of CATALOG_ITEMS) byName.set(entry.n.toLowerCase(), entry);
  return { byName, effects: EFFECTS };
}

function view(
  positionId: string,
  host: Item,
  full: number,
  exaltations?: Record<string, string>,
): SlotView {
  const position = SLOT_POSITIONS.find((p) => p.id === positionId);
  if (!position) throw new Error(`no position ${positionId}`);
  return {
    position,
    item: host,
    equipped: {
      itemName: host.n,
      upgrade: tier(full),
      ...(exaltations ? { exaltations } : {}),
    },
    unresolved: false,
  };
}

describe('socket availability follows the tier and nothing else', () => {
  it('opens nothing fillable at +0 and names the tier that would', () => {
    const plan = exaltationPlan([view('SECONDARY', BLADESTOPPER, 0)], catalog());
    const entry = plan.items[0];
    expect(entry?.openCount).toBe(0);
    expect(entry?.nextUnlockTier).toBe(1);
    expect(plan.counts.withSockets).toBe(0);
  });

  it('opens Focus, Click, Worn and Proc as +1 through +4 are reached', () => {
    const opened = (full: number) =>
      exaltationPlan([view('SECONDARY', BLADESTOPPER, full)], catalog()).items[0]?.openCount;
    expect(opened(1)).toBe(1);
    expect(opened(2)).toBe(2);
    expect(opened(3)).toBe(3);
    expect(opened(4)).toBe(4);
    expect(opened(10)).toBe(4);
  });
});

describe('donors carry their effect onto the host', () => {
  it('reproduces the Bladestopper +6 the client showed', () => {
    const plan = exaltationPlan(
      [
        view('SECONDARY', BLADESTOPPER, 6, {
          focus: 'Lute of the Gypsy Princess',
          click: 'Bladestopper',
        }),
      ],
      catalog(),
    );
    const entry = plan.items[0];
    expect(entry?.filled).toHaveLength(2);

    const focus = entry?.filled.find((s) => s.socket.kind === 'focus');
    expect(focus?.donorName).toBe('Lute of the Gypsy Princess');
    expect(focus?.effect?.n).toBe('String Resonance 11');
    expect(focus?.description?.d).toContain('stringed instruments');

    const click = entry?.filled.find((s) => s.socket.kind === 'click');
    expect(click?.donorName).toBe('Bladestopper');
    expect(click?.effect?.n).toBe('Rune IV');
    // The detail line the client prints under the effect, quoted not computed.
    expect(click?.effect?.d).toBe('Must Equip, Casting Time: Instant');

    expect(plan.active.map((s) => s.effect?.n).sort()).toEqual([
      'Rune IV',
      'String Resonance 11',
    ]);
    expect(plan.counts.filled).toBe(2);
  });

  it('reproduces the Bone-Clasped Girdle +4 focus donor', () => {
    const plan = exaltationPlan(
      [view('WAIST', GIRDLE, 4, { focus: 'Charred Guardian Shield' })],
      catalog(),
    );
    expect(plan.active[0]?.effect?.n).toBe('Burning Affliction III');
    expect(plan.items[0]?.openCount).toBe(3);
  });

  it('ignores a donor sitting in a socket the tier has not opened', () => {
    const plan = exaltationPlan(
      [view('SECONDARY', BLADESTOPPER, 1, { proc: 'Boot Charm' })],
      catalog(),
    );
    expect(plan.counts.filled).toBe(0);
    expect(plan.active).toHaveLength(0);
  });

  it('says so when a donor carries nothing for the socket it is in', () => {
    const plan = exaltationPlan([view('SECONDARY', BLADESTOPPER, 4, { worn: 'Lute of the Gypsy Princess' })], catalog());
    const worn = plan.items[0]?.filled.find((s) => s.socket.kind === 'worn');
    expect(worn?.donorName).toBe('Lute of the Gypsy Princess');
    expect(worn?.effect).toBeUndefined();
  });
});

describe('only the highest rank in a family counts', () => {
  it('keeps the III and marks the II as displaced', () => {
    const plan = exaltationPlan(
      [
        view('WAIST', GIRDLE, 4, { focus: 'Charred Guardian Shield' }),
        view('SECONDARY', BLADESTOPPER, 4, { focus: 'Lesser Ember Band' }),
      ],
      catalog(),
    );
    expect(plan.active.map((s) => s.effect?.n)).toEqual(['Burning Affliction III']);
    expect(plan.superseded.map((s) => s.effect?.n)).toEqual(['Burning Affliction II']);
    expect(plan.superseded[0]?.supersededBy).toBe('Burning Affliction III');
  });

  it('leaves unrelated families alone', () => {
    const plan = exaltationPlan(
      [
        view('WAIST', GIRDLE, 4, { focus: 'Charred Guardian Shield' }),
        view('SECONDARY', BLADESTOPPER, 4, { click: 'Bladestopper' }),
      ],
      catalog(),
    );
    expect(plan.active).toHaveLength(2);
    expect(plan.superseded).toHaveLength(0);
  });
});

describe('canSocket and intersectRestrictions are enforced, not decorative', () => {
  it('flags a donor that shares no slot with its host', () => {
    const plan = exaltationPlan(
      [view('SECONDARY', BLADESTOPPER, 4, { proc: 'Boot Charm' })],
      catalog(),
    );
    expect(plan.illegal).toHaveLength(1);
    expect(plan.illegal[0]?.donorName).toBe('Boot Charm');
    expect(plan.items[0]?.filled[0]?.legal).toBe(false);
  });

  it('narrows the host to the donor’s classes, and names what was lost', () => {
    const host = item({ n: 'Open Shield', sl: ['SECONDARY'], cl: ['WAR', 'PAL', 'BRD'] });
    const plan = exaltationPlan(
      [
        {
          ...view('SECONDARY', host, 4, { worn: 'Warlord Sigil' }),
          item: host,
        },
      ],
      { byName: new Map([['warlord sigil', PLATE_ONLY]]), effects: EFFECTS },
    );
    const entry = plan.items[0];
    expect(entry?.restricted.classes).toEqual(['WAR', 'PAL']);
    expect(entry?.lostClasses).toEqual(['BRD']);
  });

  it('warns when narrowing puts the item outside the active loadout', () => {
    const host = item({ n: 'Open Shield', sl: ['SECONDARY'], cl: ['BRD', 'WAR'] });
    const bardOnly = item({
      n: 'Bard Sigil',
      sl: ['SECONDARY'],
      cl: ['BRD'],
      fx: [{ k: 'worn', n: 'Songcraft' }],
    });
    const asWarrior = makeContext(['WAR', 'BER', 'ROG'], null, { WAR: 50 });
    const plan = exaltationPlan(
      [view('SECONDARY', host, 4, { worn: 'Bard Sigil' })],
      { byName: new Map([['bard sigil', bardOnly]]), effects: EFFECTS },
      asWarrior,
    );
    expect(plan.items[0]?.blocksLoadout).toBe(true);
  });

  it('does not warn when the loadout still has a qualifying class', () => {
    const host = item({ n: 'Open Shield', sl: ['SECONDARY'], cl: ['BRD', 'WAR'] });
    const asBard = makeContext(['BRD', 'WAR', 'BER'], null, { BRD: 50 });
    const bardOnly = item({
      n: 'Bard Sigil',
      sl: ['SECONDARY'],
      cl: ['BRD'],
      fx: [{ k: 'worn', n: 'Songcraft' }],
    });
    const plan = exaltationPlan(
      [view('SECONDARY', host, 4, { worn: 'Bard Sigil' })],
      { byName: new Map([['bard sigil', bardOnly]]), effects: EFFECTS },
      asBard,
    );
    expect(plan.items[0]?.blocksLoadout).toBe(false);
    expect(plan.items[0]?.lostClasses).toEqual(['WAR']);
  });

  it('an illegal donor does not get to narrow anything', () => {
    const plan = exaltationPlan(
      [view('SECONDARY', BLADESTOPPER, 4, { proc: 'Boot Charm' })],
      catalog(),
    );
    expect(plan.items[0]?.restricted.slots).toEqual(['SECONDARY']);
    expect(plan.items[0]?.lostSlots).toEqual([]);
  });
});

describe('the plan claims nothing it cannot support', () => {
  it('exposes no stat, score or value field anywhere in its output', () => {
    const plan = exaltationPlan(
      [
        view('SECONDARY', BLADESTOPPER, 6, {
          focus: 'Lute of the Gypsy Princess',
          click: 'Bladestopper',
        }),
      ],
      catalog(),
    );
    const serialised = JSON.stringify(plan.active);
    expect(serialised).not.toMatch(/"(score|points|stats?|value|total)"/);
  });

  it('survives a donor name that is not in the catalog at all', () => {
    const plan = exaltationPlan(
      [view('SECONDARY', BLADESTOPPER, 4, { focus: 'Item That Does Not Exist' })],
      catalog(),
    );
    expect(plan.items[0]?.filled[0]?.donor).toBeUndefined();
    expect(plan.items[0]?.filled[0]?.legal).toBe(true);
    expect(plan.active).toHaveLength(0);
  });
});
