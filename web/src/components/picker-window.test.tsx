/**
 * Regressions for the picker's windowed result list.
 *
 * Three things must stay true together, because fixing one of them the wrong
 * way breaks another:
 *
 *  1. the list builds far fewer rows than there are candidates (it used to
 *     build 150 to show nine, at 600ms of blocked main thread per open);
 *  2. nothing is hidden — the count in the meta line is the number you can
 *     actually reach, and the last candidate is reachable with End;
 *  3. `aria-activedescendant` names an element that exists, wherever the
 *     active row is, because a windowed listbox can otherwise point at a row
 *     it has unmounted.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCatalog } from '../data/catalog';
import { SLOT_TYPES } from '../engine/constants';
import type { Item } from '../engine/types';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { App } from '../App';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** How many candidates the synthetic catalog offers a single slot. */
const CANDIDATES = 900;

function syntheticItem(index: number): Item {
  return {
    id: index,
    n: `[Fixture] Test Band ${String(index).padStart(4, '0')}`,
    sl: ['FINGERS'],
    cl: ['ALL'],
    ra: ['ALL'],
    // Descending AC keeps the EP ranking deterministic, so "the last row" is
    // a known name rather than whatever a tie-break produced.
    st: { AC: CANDIDATES - index },
    sv: {},
    fl: ['FIXTURE'],
    era: 'Classic',
    av: true,
  };
}

let container: HTMLDivElement;
let root: Root;
let setId = '';

function seedCatalog(): void {
  const items = Array.from({ length: CANDIDATES }, (_, i) => syntheticItem(i));
  const byName = new Map(items.map((item) => [item.n.toLowerCase(), item]));
  const bySlot = new Map<string, Item[]>();
  for (const slot of SLOT_TYPES) bySlot.set(slot, []);
  bySlot.set('ANY', []);
  bySlot.set('FINGERS', items);
  useCatalog.setState({
    status: 'ready',
    error: null,
    usingFixture: true,
    items,
    indexNames: items.map((i) => i.n),
    byName,
    bySlot: bySlot as never,
    shards: Object.fromEntries(SLOT_TYPES.map((s) => [s, 'ready' as const])),
    revision: useCatalog.getState().revision + 1,
  });
}

function key(target: EventTarget, name: string, init: KeyboardEventInit = {}): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, ...init }));
  });
}

function rows(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.results .result')];
}

beforeEach(() => {
  seedCatalog();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Windowed',
    level: 50,
    classes: ['WAR'],
    race: null,
  });
  setId = useApp.getState().createSet(character.id, 'Main Set').id;
  window.location.hash = `#/set/${setId}`;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  act(() => {
    container.querySelector<HTMLElement>('[aria-label^="Fingers 1"]')?.click();
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useCatalog.setState({ usingFixture: false });
});

describe('the picker result list', () => {
  it('builds a small window of rows for a large candidate list', () => {
    expect(container.querySelector('[role="listbox"]')).toBeTruthy();
    const built = rows().length;
    expect(built).toBeGreaterThan(0);
    // The old list built 150 rows for any list this long. A window is bounded
    // by the viewport, so an order of magnitude fewer is the whole point.
    expect(built).toBeLessThan(CANDIDATES / 10);
  });

  it('states the full candidate count and truncates nothing', () => {
    const meta = container.querySelector('.picker-meta')?.textContent ?? '';
    expect(meta).toContain('900 matches');
    // The cap used to announce itself here — and only sometimes.
    expect(meta).not.toMatch(/showing top/i);
    expect(rows().length).toBeLessThan(CANDIDATES);
  });

  it('reaches the last candidate with End, and keeps it mounted and selected', () => {
    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="Search items by name"]',
    );
    expect(search).toBeTruthy();
    key(search as HTMLElement, 'End', { ctrlKey: true });

    const active = container.querySelector<HTMLElement>('.results [data-active="true"]');
    expect(active?.id).toBe(`picker-option-${CANDIDATES - 1}`);
    expect(active?.textContent).toContain('Test Band 0899');
    // Still a window, not the whole list, even at the far end.
    expect(rows().length).toBeLessThan(CANDIDATES / 10);
  });

  it('always points aria-activedescendant at a row that exists', () => {
    const search = container.querySelector<HTMLInputElement>(
      '[aria-label="Search items by name"]',
    ) as HTMLElement;
    const resolves = () => {
      const id = search.getAttribute('aria-activedescendant');
      expect(id, 'aria-activedescendant is set while the list has rows').toBeTruthy();
      expect(container.querySelector(`#${CSS.escape(id ?? '')}`), `#${id} is rendered`).toBeTruthy();
    };

    resolves();
    key(search, 'End', { ctrlKey: true });
    resolves();
    key(search, 'PageUp');
    resolves();
    key(search, 'Home', { ctrlKey: true });
    resolves();
    for (let i = 0; i < 30; i++) key(search, 'ArrowDown');
    resolves();
  });

  it('gives every row the same set size, so a screen reader is told the truth', () => {
    for (const row of rows()) {
      expect(row.getAttribute('aria-setsize')).toBe(String(CANDIDATES));
      expect(Number(row.getAttribute('aria-posinset'))).toBeGreaterThan(0);
    }
  });

  it('keeps every row out of the tab order', () => {
    // The ARIA listbox pattern: the widget is one tab stop. As plain tab stops
    // these rows cost 157 Tab presses to reach Cancel.
    for (const row of rows()) expect(row.getAttribute('tabindex')).toBe('-1');
  });
});
