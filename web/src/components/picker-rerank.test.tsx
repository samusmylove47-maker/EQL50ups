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

const WEIGHTS = { STR: 1, STA: 1, AGI: 1, DEX: 1 };

function helm(name: string, st: Record<string, number>): Item {
  return {
    id: null, n: name, sl: ['HEAD'], cl: ['ALL'], ra: ['ALL'],
    st, sv: {}, fl: ['FIXTURE'], av: true, era: 'Classic',
  };
}

let container: HTMLDivElement;
let root: Root;
let setId = '';

function seedCatalog(): void {
  const items = [
    helm(SPREAD, { STR: 4, STA: 4, AGI: 4, DEX: 4 }),
    helm(LUMP, { STR: 20 }),
    helm(FILLER, { STR: 1 }),
  ];
  const bySlot = new Map<string, Item[]>();
  for (const slot of SLOT_TYPES) bySlot.set(slot, []);
  bySlot.set('ANY', []);
  bySlot.set('HEAD', items);
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
