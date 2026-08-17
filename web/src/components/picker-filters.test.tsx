/**
 * What the picker's filter controls are allowed to cost.
 *
 * Era, source and Hide No Drop are free: they filter an already-sorted array.
 * A fourth control, "Live content only", was not — `includeUnreleased` sat in
 * `rankSlotItems`' cache key, so the first press in each direction re-scored
 * the whole slot (~200 ms on an Any Slot at 4x CPU throttle) while the second
 * press read a warm cache and measured 0 ms. A benchmark that toggles twice and
 * keeps the better number reports 0 ms; a user gets the 200.
 *
 * That control is gone: the pipeline quarantines out-of-era content instead of
 * shipping it for the UI to hide, so the checkbox could not change a single row.
 * The cost rule it taught outlives it, and is what this file pins — wall-clock
 * timing being exactly the assertion a warm cache defeats, the structural fact
 * is asserted instead: the ranking is requested for one candidate set and one
 * only, and every filter narrows that result rather than joining its key.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rankCalls: Array<Record<string, unknown>> = [];

vi.mock('../selectors/gear', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../selectors/gear')>();
  return {
    ...actual,
    rankSlotItems: (catalog: never, options: Record<string, unknown>) => {
      rankCalls.push(options);
      return actual.rankSlotItems(catalog, options as never);
    },
  };
});

const { App } = await import('../App');
const { useCatalog } = await import('../data/catalog');
const { SLOT_TYPES } = await import('../engine/constants');
const { emptyState } = await import('../state/persistence');
const { useApp } = await import('../state/store');
type Item = import('../engine/types').Item;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LIVE = '[Fixture] Plain Helm';
/**
 * Shaped exactly like a record the old era gate refused: an era past Sky, and
 * `av: false`. Nothing of that shape ships any more — the pipeline quarantines
 * it and `pipeline/verify.mjs` fails the build if one slips through — so it is
 * here as an adversarial input. The picker must show it like any other row.
 */
const OUT_OF_ERA = '[Fixture] Kunark-Tagged Helm';
const NO_DROP = '[Fixture] Bound Helm';
/** Real item, no stats anywhere — the `statsUnknown` case. */
const UNSTATTED = '[Fixture] Unrecorded Helm';

function helm(name: string, patch: Partial<Item> = {}): Item {
  return {
    id: null, n: name, sl: ['HEAD'], cl: ['ALL'], ra: ['ALL'],
    st: { AC: 10 }, sv: {}, fl: ['FIXTURE'], av: true, era: 'Classic', ...patch,
  };
}

let container: HTMLDivElement;
let root: Root;

function seedCatalog(): void {
  const items = [
    helm(LIVE, { st: { AC: 30 } }),
    helm(OUT_OF_ERA, { st: { AC: 20 }, av: false, era: 'Kunark' }),
    helm(NO_DROP, { st: { AC: 10 }, fl: ['FIXTURE', 'NO_DROP'] }),
    helm(UNSTATTED, {
      st: {},
      statsUnknown: true,
      evidence: 'Seen in a live client export; no wiki page carries its stats.',
    }),
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

function checkbox(label: string): HTMLInputElement {
  const found = [...container.querySelectorAll<HTMLLabelElement>('label.checkline')].find((node) =>
    (node.textContent ?? '').includes(label),
  );
  expect(found, `the ${label} checkbox`).toBeTruthy();
  return found?.querySelector('input') as HTMLInputElement;
}

function toggle(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function select(label: string, value: string): void {
  const node = container.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`);
  expect(node, label).toBeTruthy();
  act(() => {
    (node as HTMLSelectElement).value = value;
    (node as HTMLSelectElement).dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function rowNames(): string[] {
  return [...container.querySelectorAll<HTMLElement>('.results .result .iname')].map(
    (n) => n.textContent ?? '',
  );
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
  const setId = useApp.getState().createSet(character.id, 'Main Set', { AC: 1 }).id;
  window.location.hash = `#/set/${setId}`;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  act(() => {
    container.querySelector<HTMLElement>('[aria-label^="Head:"]')?.click();
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useCatalog.setState({ usingFixture: false });
  rankCalls.length = 0;
});

describe('the three filter controls', () => {
  it('ranks the whole candidate set once, and shows all of it', () => {
    expect(rankCalls.length).toBeGreaterThan(0);
    // No filter narrows the opening view, so the list is the ranking itself.
    expect(rowNames()).toEqual([LIVE, OUT_OF_ERA, NO_DROP]);
  });

  it('never asks for a ranking at all when era, source or No Drop change', () => {
    const before = rankCalls.length;

    select('Filter by era', 'Kunark');
    expect(rowNames()).toEqual([OUT_OF_ERA]);
    select('Filter by era', 'any');

    // Pressed in both directions, and the count is checked after each: the
    // *first* press in a direction is the one a warm cache would hide.
    toggle(checkbox('Hide No Drop'));
    expect(rowNames()).toEqual([LIVE, OUT_OF_ERA]);
    expect(rankCalls.length).toBe(before);
    toggle(checkbox('Hide No Drop'));
    expect(rowNames()).toEqual([LIVE, OUT_OF_ERA, NO_DROP]);

    select('Filter by source', 'quest');
    expect(rowNames()).toEqual([]);

    expect(rankCalls.length).toBe(before);
  });

  it('still counts only what it shows', () => {
    const meta = () => container.querySelector('.picker-meta')?.textContent ?? '';
    expect(meta()).toContain('3 matches');
    toggle(checkbox('Hide No Drop'));
    expect(meta()).toContain('2 matches');
    select('Filter by era', 'Kunark');
    expect(meta()).toContain('1 match');
  });

  /*
   * The era gate is gone, and this is the row that would notice if it came back.
   *
   * `[Fixture] Kunark-Tagged Helm` carries the two marks the old `isLive()`
   * refused — `av: false` and an era past Sky. It ranks, it renders, it wears
   * its era tag like any other row, and no "Not live" chip is printed on it,
   * because there is no longer any such state to print.
   */
  it('shows a row the old era gate would have hidden, unmarked and unranked-down', () => {
    const rows = [...container.querySelectorAll<HTMLElement>('.results .result')];
    const kunark = rows.find((row) => row.textContent?.includes(OUT_OF_ERA));
    expect(kunark, OUT_OF_ERA).toBeTruthy();
    expect(kunark?.textContent).toContain('Kunark');
    expect(kunark?.textContent).not.toContain('Not live');
    // Second of three on AC, exactly where its stats put it — not demoted.
    expect(rowNames()[1]).toBe(OUT_OF_ERA);
  });
});

/**
 * An item with no stats is not a candidate, and is not a secret either.
 *
 * It cannot be ranked — every scorer reads an absent stat as zero, which would
 * put a fabricated `0.0 EP` beside measured ones — so it is kept out of the
 * list entirely. But dropping it silently turns a player searching for the helm
 * on their own head into "No matching items", which reads as a denial that the
 * item exists. It is named underneath instead.
 */
describe('an item the catalog has no stats for', () => {
  function search(text: string): void {
    const input = container.querySelector<HTMLInputElement>('[aria-label="Search items by name"]');
    expect(input, 'the search box').toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, text);
      (input as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const note = () => container.querySelector('.picker-unstatted')?.textContent ?? '';

  it('is never a row, at any filter setting', () => {
    expect(rowNames()).not.toContain(UNSTATTED);
    toggle(checkbox('Hide No Drop'));
    expect(rowNames()).not.toContain(UNSTATTED);
    select('Filter by era', 'Classic');
    expect(rowNames()).not.toContain(UNSTATTED);
  });

  it('is named beneath the list, with the reason it is not in it', () => {
    expect(note()).toContain(UNSTATTED);
    expect(note()).toContain('no catalog carries');
    expect(note()).toContain('made-up answer');
  });

  it('still answers a search for it, rather than reporting no matches', () => {
    search('Unrecorded');
    // The list is empty — correctly, it cannot be ranked — and the note is
    // what stops that from reading as "no such item".
    expect(rowNames()).toEqual([]);
    expect(note()).toContain(UNSTATTED);
  });

  it('drops out of the way when the search is about something else', () => {
    search('Plain');
    expect(rowNames()).toEqual([LIVE]);
    expect(note()).toBe('');
  });

  it('is not counted among the matches, because it is not one', () => {
    // Four helms are seeded; three are rankable.
    expect(container.querySelector('.picker-meta')?.textContent ?? '').toContain('3 matches');
  });
});
