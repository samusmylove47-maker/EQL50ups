/**
 * The Exaltations tab, mounted — specifically the block where it strikes an
 * effect off a player's set.
 *
 * Nothing rendered that block before. `selectors/exaltations.test.ts` proved the
 * plan puts the right rows in `superseded`, and no test — unit or browser — had
 * ever painted one, so the sentence a reader actually sees was unexamined. Two
 * things are pinned here because both are claims made to a player's face:
 *
 * 1. **The source-tier chip is present.** The rule doing the striking is
 *    `EXALTATION_STACKING`: Tier 5, one community author's reading of a wiki,
 *    never observed in the client. Rule 5 of `research/SOURCING-STANDARD.md`
 *    says a reader looking at a claim is entitled to know where it came from,
 *    and a struck-out row is a claim.
 * 2. **A duplicate does not read as its own superior.** The old sentence
 *    resolved the winner's name out of the family, so two copies of one effect
 *    rendered "X does not count — X is the higher rank in the same family".
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCatalog } from '../data/catalog';
import { makeContext } from '../engine/character';
import { SLOT_POSITIONS } from '../engine/constants';
import { EXALTATION_STACKING } from '../engine/exaltation';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';
import type { SlotView } from '../selectors/gear';
import { ExaltationsTab } from './ExaltationsTab';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function item(overrides: Partial<Item> & { n: string }): Item {
  return {
    id: null, sl: ['SECONDARY'], cl: ['ALL'], ra: ['ALL'],
    st: {}, sv: {}, fl: [], av: true,
    ...overrides,
  };
}

const HOST_A = item({ n: '[Fixture] Bladestopper', sl: ['SECONDARY'], st: { AC: 25 } });
const HOST_B = item({ n: '[Fixture] Girdle', sl: ['WAIST'], st: { AC: 4 } });

const BURNING_III = item({
  n: '[Fixture] Charred Shield',
  sl: ['WAIST', 'SECONDARY'],
  fx: [{ k: 'focus', n: 'Burning Affliction III' }],
});
const BURNING_II = item({
  n: '[Fixture] Ember Band',
  sl: ['WAIST', 'SECONDARY'],
  fx: [{ k: 'focus', n: 'Burning Affliction II' }],
});

const CATALOG = [HOST_A, HOST_B, BURNING_III, BURNING_II];

function view(positionId: string, host: Item, donor: string): SlotView {
  const position = SLOT_POSITIONS.find((p) => p.id === positionId);
  if (!position) throw new Error(`no position ${positionId}`);
  return {
    position,
    item: host,
    equipped: { itemName: host.n, upgrade: tier(4), exaltations: { focus: donor } },
    unresolved: false,
  };
}

let container: HTMLDivElement;
let root: Root;

function mount(views: SlotView[]): void {
  act(() => {
    root.render(
      <ExaltationsTab
        views={views}
        context={makeContext(['WAR'], null, { WAR: 50 })}
        readOnly={false}
        onUpgrade={() => {}}
        onSetDonor={() => {}}
      />,
    );
  });
}

beforeEach(() => {
  const byName = new Map<string, Item>();
  for (const entry of CATALOG) byName.set(entry.n.toLowerCase(), entry);
  // `effectsStatus: 'ready'` so the mount does not reach for the network; the
  // prose file is not what this test is about.
  useCatalog.setState({ byName, effects: new Map(), effectsStatus: 'ready' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useCatalog.setState({ byName: new Map(), effects: new Map(), effectsStatus: 'idle' });
});

describe('the block that strikes an effect out', () => {
  it('carries the source tier of the rule it strikes on', () => {
    mount([
      view('WAIST', HOST_B, BURNING_III.n),
      view('SECONDARY', HOST_A, BURNING_II.n),
    ]);

    const text = container.textContent ?? '';
    expect(text).toContain('Burning Affliction II does not count');
    expect(text).toContain('Burning Affliction III is the higher rank');

    const chip = container.querySelector('.tier.t5');
    expect(chip, 'the struck-out block renders no source-tier chip').not.toBeNull();
    expect(chip?.textContent).toBe(EXALTATION_STACKING.chip);
    // The hover carries the standing and the capture that would end it, so the
    // chip is not merely a colour.
    expect(chip?.getAttribute('title')).toContain('Assumed, not measured');
    expect(chip?.getAttribute('title')).toContain('CAPTURE-REQUESTS.md');
  });

  it('does not tell a reader an effect is its own superior', () => {
    mount([
      view('WAIST', HOST_B, BURNING_II.n),
      view('SECONDARY', HOST_A, BURNING_II.n),
    ]);

    const text = container.textContent ?? '';
    expect(text).toContain('Burning Affliction II is socketed twice');
    expect(text).not.toContain(
      'Burning Affliction II does not count — Burning Affliction II is the higher rank',
    );
    expect(container.querySelector('.tier.t5')).not.toBeNull();
  });

  it('renders no struck-out block, and no chip, when nothing is struck out', () => {
    mount([view('SECONDARY', HOST_A, BURNING_III.n)]);
    expect(container.textContent ?? '').not.toContain('Not counted');
    expect(container.querySelector('.tier.t5')).toBeNull();
  });
});
