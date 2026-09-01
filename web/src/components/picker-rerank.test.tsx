/**
 * The picker highlight has to survive a re-rank.
 *
 * The preview stepper re-*sorts* the candidate list without changing which
 * candidates are in it. The keyboard-active row was a bare row number, and the
 * effect that resets it listed the six filters that change list *membership* —
 * so the one control that changes list *order* moved every row out from under
 * the highlight and left the number pointing at a different item. ArrowDown,
 * five presses of "Preview at", Enter, and the set received something the
 * player had never looked at.
 *
 * This is the only path in the app that writes an item the user did not choose,
 * so it gets its own file: a catalog built so the ranking genuinely inverts
 * between +0 and +5, driven through real DOM events.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { SLOT_TYPES } from '../engine/constants';
import type { Item } from '../engine/types';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Two helms whose EP order inverts as the preview tier rises.
 *
 * A base at or under ten gains a flat point per tier, so four small attributes
 * out-scale one large one long before +10 — `SPREAD` is 16 EP against `LUMP`'s
 * 20 at +0, and 36 against 30 at +5. Both are legal for the trio and both are
 * live, so nothing but the sort order changes between the two tiers.
 */
const SPREAD = '[Fixture] Helm of Four Small Things';
const LUMP = '[Fixture] Helm of One Big Thing';
const FILLER = '[Fixture] Helm of Nothing Much';
const WORN_BOW = '[Fixture] Bow of Borrowed Damage';
const BETTER_BOW = '[Fixture] Bow of Real Stats';

const WEIGHTS = { STR: 1, STA: 1, AGI: 1, DEX: 1, DMG: 1, RATIO: 1 };

function helm(name: string, st: Record<string, number>): Item {
  return {
    id: null, n: name, sl: ['HEAD'], cl: ['ALL'], ra: ['ALL'],
    st, sv: {}, fl: ['FIXTURE'], av: true, era: 'Classic',
  };
}

let container: HTMLDivElement;
let root: Root;
let setId = '';

/** A ranged weapon: RANGE is a worn position, so weapon damage does NOT count there. */
function bow(name: string, st: Record<string, number>, dmg: number): Item {
  return {
    id: null, n: name, sl: ['RANGE'], cl: ['ALL'], ra: ['ALL'],
    st, sv: {}, fl: ['FIXTURE'], av: true, era: 'Classic',
    wp: { dmg, dly: 30, skill: 'Archery' },
  };
}

function seedCatalog(): void {
  const items = [
    helm(SPREAD, { STR: 4, STA: 4, AGI: 4, DEX: 4 }),
    helm(LUMP, { STR: 20 }),
    helm(FILLER, { STR: 1 }),
    // Worn bow: modest stats, big damage. Candidate bow: better stats, no damage.
    bow(WORN_BOW, { STR: 2 }, 60),
    bow(BETTER_BOW, { STR: 12 }, 0),
  ];
  const bySlot = new Map<string, Item[]>();
  for (const slot of SLOT_TYPES) bySlot.set(slot, []);
  bySlot.set('ANY', []);
  bySlot.set('HEAD', items.filter((i) => i.sl.includes('HEAD')));
  bySlot.set('RANGE', items.filter((i) => i.sl.includes('RANGE')));
  useCatalog.setState({
    status: 'ready',
    error: null,
    usingFixture: true,
    items,
    indexNames: items.map((i) => i.n),
    byName: new Map(items.map((item) => [item.n.toLowerCase(), item])),
    bySlot: bySlot as never,
    shards: Object.fromEntries(SLOT_TYPES.map((s) => [s, 'ready' as const])),
    revision: useCatalog.getState().revision + 1,
  });
}

function key(target: EventTarget, name: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

function click(element: Element | null | undefined): void {
  expect(element, 'element to click exists').toBeTruthy();
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function search(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('[aria-label="Search items by name"]');
  expect(input, 'the picker search box').toBeTruthy();
  return input as HTMLInputElement;
}

function rowNames(): string[] {
  return [...container.querySelectorAll<HTMLElement>('.results .result .iname')].map(
    (node) => node.textContent ?? '',
  );
}

function activeRowName(): string {
  const active = container.querySelector<HTMLElement>('.results [data-active="true"] .iname');
  expect(active, 'exactly one row is marked active').toBeTruthy();
  return active?.textContent ?? '';
}

/** The row `aria-activedescendant` points at — what a screen reader is told. */
function announcedRowName(): string {
  const id = search().getAttribute('aria-activedescendant');
  expect(id, 'aria-activedescendant is set').toBeTruthy();
  const node = container.querySelector<HTMLElement>(`#${CSS.escape(id ?? '')} .iname`);
  expect(node, `${id} is rendered`).toBeTruthy();
  return node?.textContent ?? '';
}

function raisePreview(times: number): void {
  for (let i = 0; i < times; i++) {
    click(container.querySelector('[aria-label="Raise ranking preview upgrade level"]'));
  }
}

function equippedHead(): string | undefined {
  return useApp.getState().sets.find((s) => s.id === setId)?.slots.HEAD?.itemName;
}

beforeEach(() => {
  seedCatalog();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  setId = useApp.getState().createSet(character.id, 'Main Set', WEIGHTS).id;
  window.location.hash = `#/set/${setId}`;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  act(() => {
    container.querySelector<HTMLElement>('[aria-label^="Head"]')?.click();
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useCatalog.setState({ usingFixture: false });
});

describe('the preview tier re-sorting the list', () => {
  it('genuinely inverts the ranking, so the rest of this file is testing something', () => {
    expect(rowNames()).toEqual([LUMP, SPREAD, FILLER]);
    raisePreview(5);
    expect(rowNames()).toEqual([SPREAD, LUMP, FILLER]);
  });

  it('equips the item that was highlighted, not the row number it was on', () => {
    key(search(), 'ArrowDown');
    expect(activeRowName()).toBe(SPREAD);

    raisePreview(5);

    // The item moved from row 1 to row 0. The highlight has to move with it.
    expect(activeRowName()).toBe(SPREAD);
    expect(announcedRowName()).toBe(SPREAD);

    key(search(), 'Enter');
    expect(equippedHead()).toBe(SPREAD);
  });

  it('equips the highlighted item when the re-rank pushes it down instead', () => {
    // Start at the top — the item there at +0 is the one that loses the lead.
    expect(activeRowName()).toBe(LUMP);
    key(search(), 'ArrowDown');
    key(search(), 'ArrowUp');
    expect(activeRowName()).toBe(LUMP);

    raisePreview(5);
    expect(activeRowName()).toBe(LUMP);

    key(search(), 'Enter');
    expect(equippedHead()).toBe(LUMP);
  });

  it('keeps arrow keys relative to where the highlight actually is', () => {
    key(search(), 'ArrowDown');
    expect(activeRowName()).toBe(SPREAD);
    raisePreview(5);

    // SPREAD is row 0 now, so one step down is LUMP — not the row below the
    // stale index, which would have skipped a candidate.
    key(search(), 'ArrowDown');
    expect(activeRowName()).toBe(LUMP);
    key(search(), 'Enter');
    expect(equippedHead()).toBe(LUMP);
  });

  it('equips at the previewed tier the row was scored and shown at', () => {
    key(search(), 'ArrowDown');
    raisePreview(5);
    key(search(), 'Enter');
    expect(equippedHead()).toBe(SPREAD);
    expect(useApp.getState().sets.find((s) => s.id === setId)?.slots.HEAD?.upgrade).toEqual({
      full: 5,
      fraction: 0,
    });
  });
});

describe('the highlight when the list membership changes', () => {
  it('still returns to the top when a filter removes candidates', () => {
    key(search(), 'ArrowDown');
    expect(activeRowName()).toBe(SPREAD);

    // Typing changes *which* candidates are present, so the previously active
    // item may be gone: the top is the only honest answer there.
    type(search(), 'nothing much');
    expect(rowNames()).toEqual([FILLER]);
    expect(activeRowName()).toBe(FILLER);

    type(search(), '');
    expect(rowNames()).toEqual([LUMP, SPREAD, FILLER]);
    expect(activeRowName()).toBe(LUMP);
  });

  it('follows the mouse, and equips what the mouse is on after a re-rank', () => {
    const second = container.querySelectorAll<HTMLElement>('.results .result')[1];
    act(() => {
      second?.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 40 }),
      );
    });
    expect(activeRowName()).toBe(SPREAD);

    raisePreview(5);
    expect(activeRowName()).toBe(SPREAD);
    key(search(), 'Enter');
    expect(equippedHead()).toBe(SPREAD);
  });
});

/**
 * The "vs worn" delta, and why comparing two tiers is the RIGHT answer here.
 *
 * A fan-out raised this as a defect: the picker scores candidates at the
 * preview tier while scoring the worn item at the tier it is actually worn at,
 * so the delta "compares two different tiers". The behaviour is real. It is not
 * a defect, and these tests exist so that nobody fixes it into one.
 *
 * The picker's stepper is labelled **"Preview at"**, and `onSelect(item,
 * rankPreview)` equips at exactly that tier. So `score(candidate @ preview) −
 * score(worn @ its own tier)` is the gain a player would actually get by
 * pressing Enter — the only number on this screen they can act on. Scoring the
 * worn item at the preview tier too would answer a question nobody asked:
 * what if I also upgraded the helm I am about to take off.
 *
 * It is the same rule the Upgrades screen states out loud. `basisText` there
 * reads *"every candidate at +N"* for a fixed basis — candidate, not both — and
 * `candidateUpgrade = basis.kind === 'worn' ? wornUpgrade : basis.upgrade`
 * against a `wornEp` always scored at `wornUpgrade`. The picker opens with
 * `preview = currentUpgrade`, which is Upgrades' DEFAULT 'worn' basis, and
 * stepping it moves to the fixed basis. Both modes agree across both screens.
 *
 * The one case where a cross-tier delta would be visibly absurd — the row for
 * the helm already on your head, reading a non-zero "vs worn" against itself — is
 * suppressed by `!isEquipped`. That suppression was covered nowhere: the e2e
 * suite counts `.equipped-now` and clicks it, and nothing asserted the delta
 * line is gone from it. It is the guard that makes the rest of this sound, so
 * it is pinned here.
 */
describe('the delta the picker prints against the worn item', () => {
  function deltaFor(name: string): string | null {
    const row = [...container.querySelectorAll<HTMLElement>('.results .result')]
      .find((node) => node.querySelector('.iname')?.textContent === name);
    expect(row, `the ${name} row`).toBeTruthy();
    const delta = [...(row?.querySelectorAll<HTMLElement>('.result-score .d') ?? [])]
      .find((node) => /vs worn/.test(node.textContent ?? ''));
    return delta?.textContent?.trim() ?? null;
  }

  function equipHeadAt(name: string, raises: number): void {
    // Equip through the picker so the stored tier is the one the row was scored
    // at — the same path a player takes.
    raisePreview(raises);
    click([...container.querySelectorAll<HTMLElement>('.results .result')]
      .find((node) => node.querySelector('.iname')?.textContent === name));
    act(() => {
      container.querySelector<HTMLElement>('[aria-label^="Head"]')?.click();
    });
  }

  it('shows no delta at all while the slot is empty', () => {
    // Nothing to compare against: the delta would equal the whole stat vector.
    expect(deltaFor(LUMP)).toBeNull();
    expect(deltaFor(SPREAD)).toBeNull();
  });

  it('never prints a delta on the row you are already wearing', () => {
    equipHeadAt(LUMP, 0);
    expect(equippedHead()).toBe(LUMP);
    expect(deltaFor(SPREAD), 'other rows still compare').not.toBeNull();
    expect(deltaFor(LUMP), 'the worn row must not compare with itself').toBeNull();

    // And it stays gone once the preview tier and the worn tier disagree, which
    // is precisely when a self-comparison would print a non-zero number.
    raisePreview(5);
    expect(deltaFor(LUMP), 'still no self-delta at a different preview tier').toBeNull();
  });

  it('measures the candidate at the preview tier against the worn item as worn', () => {
    equipHeadAt(LUMP, 0); // LUMP at +0: STR 20 -> 20 EP under these weights.

    // At preview +0 both sides are at +0, so the delta is the plain difference:
    // SPREAD is 4+4+4+4 = 16 against LUMP's 20.
    expect(deltaFor(SPREAD)).toBe('-4 vs worn');

    // At +5 the candidate gains a flat point per tier per attribute (16 -> 36)
    // while the worn LUMP stays at the +0 it is actually worn at: 36 - 20 = 16.
    // If the worn side moved with the preview it would read 36 - 30 = +6.0.
    raisePreview(5);
    expect(deltaFor(SPREAD), 'the worn side must NOT move with the preview')
      .toBe('+16 vs worn');
  });
});

/**
 * The picker's three numbers must agree with each other.
 *
 * `rankSlotItems` scores candidates with `weaponCounts: weaponCountsAt(slot)`,
 * which is FALSE for a worn position such as Range, Ammo or an Any Slot — a bow
 * hanging on your back deals no damage, so no candidate is paid for its ratio.
 * `wornScore` called `scoreItem` with no `weaponCounts` at all, and the scorer
 * defaults it to true (`ep.ts:148`, `ctx.weaponCounts ?? true`), so the WORN
 * item alone was paid for damage nobody else could earn.
 *
 * The result is a screen that contradicts itself: the EP column ranks a
 * candidate above the worn item while the chip beside it calls the same swap a
 * loss, in red. On the shipped payload the verified case was a worn Bow of the
 * Underfoot at 7.2 EP against a top candidate at 12.3 EP, with the chip reading
 * "-16.9 vs worn".
 *
 * Asserted as a RELATION rather than a number: whatever the EPs turn out to be,
 * a candidate the picker ranks ABOVE the worn item may not be labelled a loss.
 * That cannot go stale when the fixtures or the weights change.
 */
describe('the picker does not disagree with itself in a slot where weapons do not count', () => {
  function openRange(): void {
    act(() => {
      container.querySelector<HTMLElement>('[aria-label^="Range"]')?.click();
    });
  }

  function rows(): Array<{ name: string; ep: number; delta: string | null }> {
    return [...container.querySelectorAll<HTMLElement>('.results .result')].map((row) => {
      const score = row.querySelector<HTMLElement>('.result-score');
      const ep = Number(score?.querySelector('.n')?.textContent ?? 'NaN');
      const delta = [...(score?.querySelectorAll<HTMLElement>('.d') ?? [])]
        .find((d) => /vs worn/.test(d.textContent ?? ''));
      return {
        name: row.querySelector('.iname')?.textContent ?? '',
        ep,
        delta: delta?.textContent?.trim() ?? null,
      };
    });
  }

  it('never calls a candidate a loss while ranking it above what is worn', () => {
    act(() => {
      useApp.getState().equip(setId, 'RANGE', WORN_BOW);
    });
    openRange();
    const all = rows();
    /*
     * The worn row is found in ALL rows, not in the deltas.
     *
     * The first version of this looked it up inside the delta-bearing subset —
     * and the worn row deliberately has no delta, so `worn` was undefined, the
     * offender filter short-circuited, and the test passed against a screen
     * that was printing "-52 vs worn" for a candidate it ranked 12 against 2.
     * A guard that cannot fire is worse than none.
     */
    const worn = all.find((r) => r.name === WORN_BOW);
    expect(worn, 'the worn bow must be listed').toBeTruthy();
    expect(worn?.delta, 'and must not compare with itself').toBeNull();

    const listed = all.filter((r) => r.delta !== null && Number.isFinite(r.ep));
    expect(listed.length, 'the Range picker must list scored candidates').toBeGreaterThan(0);
    const offenders = listed
      .filter((r) => r.name !== WORN_BOW)
      .filter((r) => /^-/.test(r.delta ?? '') && r.ep > (worn?.ep ?? Infinity));

    expect(
      offenders.map((r) => `${r.name} ranked ${r.ep} EP over worn ${worn?.ep} yet labelled ${r.delta}`),
      'the EP column and the "vs worn" chip must not contradict each other',
    ).toEqual([]);
  });
});
