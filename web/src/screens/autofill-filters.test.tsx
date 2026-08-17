/**
 * Auto-fill and the set's own DEFAULT FILTERS, on the screen that runs it.
 *
 * `SetConfigDialog` states, verbatim, "Every item picker in this set opens with
 * these already applied." The filters reached the pickers and never reached
 * Auto-fill, so pressing the button on a set configured for a single era placed
 * a byte-identical answer to the unfiltered run — items its own picker reported
 * "1 match" for, and No Drop items a fresh alt can never obtain.
 *
 * The selector-level rules are pinned in `gear.test.ts`. This covers the wiring
 * between them, which is where the promise was actually broken: the filters are
 * computed on this screen, published to the pickers, and were never handed to
 * the fill.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import type { SetFilters } from '../lib/setFilters';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let setId = '';

function build(filters?: SetFilters): void {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  setId = useApp
    .getState()
    .createSet(
      character.id,
      'Main Set',
      { AC: 2, STR: 1, HP: 0.2, RATIO: 20 },
      filters ? { filters } : undefined,
    ).id;
  window.location.hash = `#/set/${setId}`;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
}

async function autoFill(): Promise<void> {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.textContent ?? '').includes('Auto-fill'),
  );
  expect(button, 'the Auto-fill button').toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // `runAutoFill` awaits a frame, then slices the fill across more of them.
    for (let i = 0; i < 60; i++) await new Promise((r) => setTimeout(r, 0));
  });
}

function equipped(): Array<{ position: string; name: string }> {
  const slots = useApp.getState().sets.find((s) => s.id === setId)?.slots ?? {};
  return Object.entries(slots)
    .filter(([, value]) => value)
    .map(([position, value]) => ({ position, name: value?.itemName ?? '' }));
}

/** The transient Auto-fill announcement, whatever else is on screen. */
function notice(): string {
  const node = [...container.querySelectorAll<HTMLElement>('[role="status"]')].find((n) =>
    (n.textContent ?? '').includes('Auto-fill'),
  );
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number;
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Auto-fill on a set with default filters', () => {
  it('fills from the whole catalog when the set asks for no filters', async () => {
    build();
    await autoFill();

    const placed = equipped();
    expect(placed.length).toBeGreaterThan(3);
    // Several eras are represented, which is the baseline the filtered runs are
    // measured against.
    const eras = new Set(
      placed.map((p) => useCatalog.getState().byName.get(p.name.toLowerCase())?.era),
    );
    expect(eras.size).toBeGreaterThan(1);
    expect(notice()).toContain('Auto-fill placed');
    expect(notice()).not.toContain('era)');
  });

  it('places only what the set’s era filter allows, and says so', async () => {
    build({ era: 'Sky', source: 'any', hideNoDrop: false });
    await autoFill();

    const placed = equipped();
    expect(placed.length).toBeGreaterThan(0);
    for (const entry of placed) {
      expect(
        useCatalog.getState().byName.get(entry.name.toLowerCase())?.era,
        `${entry.name} in ${entry.position}`,
      ).toBe('Sky');
    }

    // The notice names what it applied rather than reporting a bare count.
    expect(notice()).toContain('(Sky era)');
    expect(notice()).toMatch(/slots? had no match/);
  });

  it('never equips a No Drop item when the set hides them', async () => {
    const fixture = useCatalog.getState();
    fixture.loadFixture();
    const bound = {
      ...useCatalog.getState().byName.get('[fixture] iron helm')!,
      n: '[Fixture] Bound Helm',
      st: { AC: 60 },
      fl: ['FIXTURE', 'NO_DROP'],
    };
    const items = [...useCatalog.getState().items, bound];
    useCatalog.setState({
      items,
      byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
      bySlot: new Map([
        ...useCatalog.getState().bySlot,
        ['HEAD', [...(useCatalog.getState().bySlot.get('HEAD') ?? []), bound]],
      ] as never),
      revision: useCatalog.getState().revision + 1,
    });
    const seeded = [...items];

    build({ era: 'any', source: 'any', hideNoDrop: true });
    // `build` reloads the fixture, so put the No Drop helm back.
    act(() => {
      useCatalog.setState({
        items: seeded,
        byName: new Map(seeded.map((i) => [i.n.toLowerCase(), i])),
        bySlot: new Map([
          ...useCatalog.getState().bySlot,
          ['HEAD', seeded.filter((i) => i.sl.includes('HEAD'))],
        ] as never),
        revision: useCatalog.getState().revision + 1,
      });
    });
    await autoFill();

    const names = equipped().map((p) => p.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('[Fixture] Bound Helm');
    expect(notice()).toContain('(No Drop hidden)');
  });
});
