/**
 * What the picker's filter controls are allowed to cost.
 *
 * Era, source and Hide No Drop have always been free: they filter an
 * already-sorted array. "Live content only" was not, because
 * `includeUnreleased` sat in `rankSlotItems`' cache key, so the first press in
 * each direction re-scored the whole slot — ~200 ms on an Any Slot at 4x CPU
 * throttle — while the second press read a warm cache and measured 0 ms. A
 * benchmark that toggles twice and keeps the better number reports 0 ms; a user
 * gets the 200.
 *
 * Wall-clock timing is the wrong assertion for that, since it is exactly what
 * the warm cache hides. What is asserted instead is the structural fact: the
 * ranking is requested for one candidate set and one only, and the live filter
 * is applied to the result.
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
const UNRELEASED = '[Fixture] Helm From The Future';
const NO_DROP = '[Fixture] Bound Helm';

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
    helm(UNRELEASED, { st: { AC: 20 }, av: false, era: 'Kunark' }),
    helm(NO_DROP, { st: { AC: 10 }, fl: ['FIXTURE', 'NO_DROP'] }),
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

describe('the four filter controls', () => {
  it('ranks the whole candidate set once, released or not', () => {
    expect(rankCalls.length).toBeGreaterThan(0);
    expect(rankCalls.every((options) => options.includeUnreleased === true)).toBe(true);
    // The live filter is applied to the result, so the default view is narrower
    // than the ranking behind it.
    expect(rowNames()).toEqual([LIVE, NO_DROP]);
  });

  it('never asks for a second ranking when Live content only is toggled', () => {
    const opened = rankCalls.length;
    expect(opened).toBeGreaterThan(0);

    toggle(checkbox('Live content only'));
    expect(rowNames()).toEqual([LIVE, UNRELEASED, NO_DROP]);
    // The *first* press in this direction, not the second: a round trip would
    // read a warm cache and prove nothing.
    expect(rankCalls.length).toBe(opened);

    toggle(checkbox('Live content only'));
    expect(rowNames()).toEqual([LIVE, NO_DROP]);
    expect(rankCalls.length).toBe(opened);
  });

  it('never asks for a ranking at all when era, source or No Drop change', () => {
    const before = rankCalls.length;

    select('Filter by era', 'Kunark');
    expect(rowNames()).toEqual([]);
    select('Filter by era', 'any');
    toggle(checkbox('Hide No Drop'));
    expect(rowNames()).toEqual([LIVE]);
    select('Filter by source', 'quest');
    expect(rowNames()).toEqual([]);

    expect(rankCalls.length).toBe(before);
  });

  it('still counts only what it shows', () => {
    const meta = () => container.querySelector('.picker-meta')?.textContent ?? '';
    expect(meta()).toContain('2 matches');
    toggle(checkbox('Live content only'));
    expect(meta()).toContain('3 matches');
    toggle(checkbox('Hide No Drop'));
    expect(meta()).toContain('2 matches');
  });

  it('marks the unreleased row as such rather than hiding what it is', () => {
    toggle(checkbox('Live content only'));
    const rows = [...container.querySelectorAll<HTMLElement>('.results .result')];
    const future = rows.find((row) => row.textContent?.includes(UNRELEASED));
    expect(future?.textContent).toContain('Not live');
  });
});
