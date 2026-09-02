/**
 * A two-handed weapon takes both hands.
 *
 * **Reported by a player, against a set this planner's own Auto-fill built:**
 * `Baton of the Sky` (`2H Blunt`) in Primary with `Bladestopper` in the
 * offhand — a loadout the game cannot hold. *"If a weapon lists 'primary' and
 * '2 hand' then the secondary slot is always blocked out, as it requires your
 * primary and secondary hand to satisfy the '2 handed' requirement."*
 *
 * The rule was not missing. `Upgrades.tsx` has subtracted the worn offhand's EP
 * from a two-handed candidate's gain since 31 Aug, precisely because taking the
 * two-hander empties that hand. It was enforced on the ranking screen and
 * nowhere else, so the doll and the stat totals asserted a loadout the same
 * app's ranking had already priced as impossible.
 *
 * Three surfaces, three guards here:
 *
 *   1. `offhandBlockedEntries` — the rule itself, in one place.
 *   2. `totalsFor` — an offhand that cannot be worn is not summed. This is the
 *      half that made a number wrong rather than a list untidy.
 *   3. `autoFill` — never builds the pair, and picks the better of the two
 *      arrangements rather than always dropping the offhand.
 *
 * Measured against the shipped payload before the fix, over 4 trios x 5 weight
 * profiles: **12 of 20 produced the impossible pair**, and on CLR/BRD/SHM
 * Balanced — the reporter's own trio — the totals read AC 307 where 282 is what
 * the character could actually wear.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { activeContext, buildCharacter } from '../engine/character';
import { isTwoHanded } from '../engine/stats';
import { tier } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import { useCatalog, type CatalogState } from '../data/catalog';
import { DEFAULT_SET_FILTERS } from '../lib/setFilters';
import { PaperDoll } from '../components/PaperDoll';
import { autoFill, offhandBlockedEntries, slotViews, totalsFor } from './gear';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CHAR = buildCharacter({ id: 'c', name: 'Test', classes: ['WAR', 'BRD', 'BER'], level: 50 });
const CTX = activeContext(CHAR);
const WEIGHTS = { AC: 2, STR: 1, HP: 0.2, RATIO: 20 };

function item(partial: Partial<Item> & Pick<Item, 'n' | 'sl'>): Item {
  return { id: null, cl: ['ALL'], ra: ['ALL'], st: {}, sv: {}, fl: [], av: true, ...partial };
}

/** A two-hander whose stat line beats any one-hander here. */
const GREATSWORD = item({
  n: '[Test] Greatsword', sl: ['PRIMARY'],
  st: { AC: 60, STR: 40 }, wp: { dmg: 60, dly: 20, skill: '2H Slashing' },
});
/** The same weapon, one-handed, so only the skill string differs. */
const LONGSWORD = item({
  n: '[Test] Longsword', sl: ['PRIMARY'],
  st: { AC: 30, STR: 10 }, wp: { dmg: 30, dly: 20, skill: '1H Slashing' },
});
const SHIELD = item({ n: '[Test] Tower Shield', sl: ['SECONDARY'], st: { AC: 80 } });
const BUCKLER = item({ n: '[Test] Buckler', sl: ['SECONDARY'], st: { AC: 2 } });

function catalog(): CatalogState {
  return useCatalog.getState();
}

function seed(extra: Item[]): void {
  useCatalog.getState().loadFixture();
  const state = useCatalog.getState();
  const items = [...state.items, ...extra];
  const bySlot = new Map(state.bySlot);
  for (const entry of extra) {
    for (const slot of entry.sl) {
      bySlot.set(slot as never, [...(bySlot.get(slot as never) ?? []), entry]);
    }
  }
  useCatalog.setState({
    items,
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
    bySlot,
    revision: state.revision + 1,
  });
}

function set(slots: GearSet['slots']): GearSet {
  return {
    id: 's', characterId: 'c', name: 'Set', slots, weights: WEIGHTS, createdAt: 0, updatedAt: 0,
  };
}

beforeEach(() => {
  seed([GREATSWORD, LONGSWORD, SHIELD, BUCKLER]);
});

describe('the rule', () => {
  it('reads two-handedness off the weapon skill, which is the only marker there is', () => {
    // Zero shipped two-handed rows list SECONDARY, so the slot list cannot say.
    expect(GREATSWORD.sl).toEqual(['PRIMARY']);
    expect(isTwoHanded(GREATSWORD)).toBe(true);
    expect(isTwoHanded(LONGSWORD)).toBe(false);
    expect(isTwoHanded(SHIELD)).toBe(false);
    expect(isTwoHanded(undefined)).toBe(false);
  });

  it('names the offhand a two-handed Primary blocks', () => {
    const views = slotViews(set({
      PRIMARY: { itemName: GREATSWORD.n, upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    }), catalog());
    expect(offhandBlockedEntries(views).map((e) => e.item.n)).toEqual([SHIELD.n]);
  });

  it('blocks nothing when the Primary is one-handed, or empty', () => {
    const oneHanded = slotViews(set({
      PRIMARY: { itemName: LONGSWORD.n, upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    }), catalog());
    expect(offhandBlockedEntries(oneHanded)).toEqual([]);

    const bare = slotViews(set({ SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) } }), catalog());
    expect(offhandBlockedEntries(bare)).toEqual([]);
  });

  it('does not guess from an unresolved Primary', () => {
    // An item the catalogue cannot resolve is not evidence of two-handedness,
    // and treating it as such would take a real offhand out of the totals.
    const views = slotViews(set({
      PRIMARY: { itemName: 'Something Not In The Catalog', upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    }), catalog());
    expect(offhandBlockedEntries(views)).toEqual([]);
  });
});

describe('the totals', () => {
  it('does not sum an offhand the Primary leaves no hand for', () => {
    const blocked = totalsFor(slotViews(set({
      PRIMARY: { itemName: GREATSWORD.n, upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    }), catalog()), undefined, CTX);
    const alone = totalsFor(slotViews(set({
      PRIMARY: { itemName: GREATSWORD.n, upgrade: tier(0) },
    }), catalog()), undefined, CTX);

    expect(blocked.ac).toBe(alone.ac);
    // And the shield really would have moved the number, or this proves nothing.
    expect(SHIELD.st.AC).toBe(80);
    expect(alone.ac).toBe(GREATSWORD.st.AC);
  });

  it('still sums an offhand beside a one-handed Primary', () => {
    const totals = totalsFor(slotViews(set({
      PRIMARY: { itemName: LONGSWORD.n, upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    }), catalog()), undefined, CTX);
    expect(totals.ac).toBe((LONGSWORD.st.AC ?? 0) + (SHIELD.st.AC ?? 0));
  });
});

describe('auto-fill', () => {
  const fill = (slots: GearSet['slots'] = {}, keepFilled = false) =>
    autoFill(catalog(), slotViews(set(slots), catalog()), CTX, WEIGHTS, {
      filters: { ...DEFAULT_SET_FILTERS }, keepFilled,
    });

  const placed = (result: ReturnType<typeof fill>, position: string) =>
    result.assigned.find((a) => a.position === position)?.itemName;

  it('never puts an offhand beside a two-handed Primary', () => {
    const result = fill();
    const primary = placed(result, 'PRIMARY');
    const item = primary ? catalog().byName.get(primary.toLowerCase()) : undefined;
    if (isTwoHanded(item)) expect(placed(result, 'SECONDARY')).toBeUndefined();
  });

  /*
   * The reporter's second point, and the reason this is a comparison and not a
   * deletion: two-handers carry the better stat lines, so under a stat-led
   * profile the two-hander wins Primary on its own merits — and the shield it
   * displaces may be worth more than the gap to the best one-hander.
   *
   * Here the pair is worth more. Under these weights (AC 2, STR 1, RATIO 20):
   * greatsword 60*2 + 40 + 3.0*20 = 220; longsword 30*2 + 10 + 1.5*20 = 100
   * plus an 80 AC shield at 160 = 260. Always dropping the offhand would leave
   * the player with
   * the worse set. Measured on the shipped payload, the pair wins in 10 of the
   * 12 configurations that used to produce the impossible loadout.
   */
  it('keeps the offhand and takes a one-hander when the pair is worth more', () => {
    const result = fill();
    expect(placed(result, 'PRIMARY')).toBe(LONGSWORD.n);
    expect(placed(result, 'SECONDARY')).toBe(SHIELD.n);
    expect(result.handsFull).toEqual([]);
  });

  /*
   * And the converse, or a fix that simply preferred one-handers would pass the
   * test above and be equally wrong. With only a near-worthless offhand to give
   * up, the two-hander wins and the hand stays empty.
   */
  it('takes the two-hander and leaves the hand empty when it is worth more', () => {
    useCatalog.setState({
      items: catalog().items.filter((i) => i.n !== SHIELD.n),
      byName: new Map(catalog().items.filter((i) => i.n !== SHIELD.n)
        .map((i) => [i.n.toLowerCase(), i])),
      bySlot: new Map([...catalog().bySlot].map(([slot, list]) =>
        [slot, list.filter((i) => i.n !== SHIELD.n)])),
      revision: catalog().revision + 1,
    });
    const result = fill();
    expect(placed(result, 'PRIMARY')).toBe(GREATSWORD.n);
    expect(placed(result, 'SECONDARY')).toBeUndefined();
    // And it says why, rather than reporting a slot that had no match.
    expect(result.handsFull).toEqual(['Secondary']);
    expect(result.skipped).not.toContain('Secondary');
  });

  it('does not take away an offhand the player pinned', () => {
    // `keepFilled` is the player saying "leave what I chose". Auto-fill may
    // decline to add to it; removing from it is not its decision to make.
    const result = fill({ SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) } }, true);
    expect(result.assigned.find((a) => a.position === 'SECONDARY')).toBeUndefined();
    const views = slotViews(set({
      ...Object.fromEntries(result.assigned.map((a) => [a.position, { itemName: a.itemName, upgrade: tier(0) }])),
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    }), catalog());
    // Whatever it chose, the shield is still there for the doll to report on.
    expect(views.find((v) => v.position.id === 'SECONDARY')?.item?.n).toBe(SHIELD.n);
  });
});

/* ------------------------------------------------------------------------- *
 * And the doll says so, rather than quietly dropping the stats.
 *
 * The exclusion above makes a number change. A number that changes with no
 * stated reason is the fault this planner exists to prevent, and a set carrying
 * the impossible pair is already sitting in browsers — Auto-fill built them.
 *
 * Rendered rather than asserted on `offhandBlockedEntries`, because twice
 * earlier in this same sitting a guard on the data passed while the sentence on
 * the card was wrong. The sentence is what the reader gets.
 * ------------------------------------------------------------------------- */

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function renderDoll(slots: GearSet['slots']): string {
  const views = slotViews(set(slots), catalog());
  host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host as HTMLDivElement);
    root.render(
      <PaperDoll
        views={views}
        weights={WEIGHTS}
        totals={totalsFor(views, undefined, CTX)}
        context={CTX}
        onPick={() => undefined}
        onUpgrade={() => undefined}
        onClear={() => undefined}
      />,
    );
  });
  return (host.textContent ?? '').replace(/\s+/g, ' ');
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

describe('the doll', () => {
  it('says the offhand is not counted, and why', () => {
    const text = renderDoll({
      PRIMARY: { itemName: GREATSWORD.n, upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    });
    expect(text).toContain('Not counted');
    expect(text).toContain(SHIELD.n);
    expect(text).toContain('two-handed weapon takes both hands');
  });

  it('says nothing when the hands are a pair the game allows', () => {
    const text = renderDoll({
      PRIMARY: { itemName: LONGSWORD.n, upgrade: tier(0) },
      SECONDARY: { itemName: SHIELD.n, upgrade: tier(0) },
    });
    expect(text).not.toContain('two-handed weapon takes both hands');
    expect(text).not.toContain('Not counted');
  });
});
