/**
 * The Upgrades screen, mounted.
 *
 * The ranking rules are pinned in `upgrades.test.ts`. This covers the wiring a
 * pure test cannot see: that the route reaches the screen, that the sliced
 * ranking actually finishes and paints rows, that Equip writes the item the row
 * named at the tier the row was scored at, that a slot the app refuses to score
 * says so on screen, and that every failure mode renders words rather than a
 * blank page.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** An item with acquisition data, which the fixture catalog otherwise lacks. */
const SOURCED: Item = {
  id: null,
  n: '[Fixture] Girdle of the Deep',
  sl: ['WAIST'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: { AC: 40, STA: 12, HP: 60 },
  sv: {},
  fl: ['FIXTURE', 'NO_DROP'],
  av: true,
  era: 'Classic',
  src: { z: ['Lower Guk'], m: ['a ghoul cavalier'], q: ['The Harvester'] },
};

/** A real item nobody has published stats for — the Shadow Rage case. */
const UNSTATTED: Item = {
  id: null,
  n: '[Fixture] Shadowed Crown',
  sl: ['HEAD'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: {},
  sv: {},
  fl: ['FIXTURE'],
  av: true,
  era: 'Fear',
  statsUnknown: true,
  evidence: 'Worn in the owner’s client; no catalog carries its numbers.',
};

function seedCatalog(extra: Item[]): void {
  useCatalog.getState().loadFixture();
  const state = useCatalog.getState();
  const items = [...state.items, ...extra];
  const bySlot = new Map(state.bySlot);
  for (const item of extra) {
    for (const slot of item.sl) {
      bySlot.set(slot as never, [...(bySlot.get(slot as never) ?? []), item]);
    }
  }
  useCatalog.setState({
    items,
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
    bySlot,
    revision: state.revision + 1,
  });
}

function build(options: { slots?: Record<string, { name: string; tier: number }> } = {}): string {
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  const set = useApp.getState().createSet(character.id, 'Main Set', {
    AC: 2, STR: 1, STA: 1, HP: 0.2, RATIO: 20,
  });
  for (const [position, entry] of Object.entries(options.slots ?? {})) {
    useApp.getState().equip(set.id, position, entry.name, tier(entry.tier));
  }
  return set.id;
}

/**
 * Let the sliced ranking finish.
 *
 * It has to be its own `act` rather than a loop inside the render's: React
 * flushes passive effects at the end of an `act` scope, so the effect that
 * starts the ranking has not run yet while the render scope is still pumping —
 * every timer would be drained before there was anything waiting on one.
 */
async function pump(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 80; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Mount the app at a hash and drain the sliced ranking. */
async function render(hash: string): Promise<void> {
  window.location.hash = hash;
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await pump();
}

function text(): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ');
}

function rows(): HTMLLIElement[] {
  return [...container.querySelectorAll<HTMLLIElement>('.upg-row')];
}

async function click(element: Element | null | undefined): Promise<void> {
  expect(element, 'the control being clicked').toBeTruthy();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await pump();
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number,
  );
  seedCatalog([SOURCED, UNSTATTED]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('the upgrades screen', () => {
  it('ranks the set and prints a row for every gain, biggest first', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    expect(text()).toContain('Upgrades');
    expect(text()).toContain('Avenrae');
    expect(text()).toContain('50 WAR/BRD/BER');
    expect(text()).not.toMatch(/NaN/);

    const list = rows();
    expect(list.length).toBeGreaterThan(3);

    // EP is one decimal everywhere in this app, so a column of gains lines up.
    for (const row of list) {
      expect(row.querySelector('.upg-gainvalue')?.textContent).toMatch(/^\+\d+\.\d$/);
    }
    const gains = list.map((row) =>
      Number((row.querySelector('.upg-gainvalue')?.textContent ?? '0').replace('+', '')),
    );
    for (const gain of gains) expect(Number.isFinite(gain)).toBe(true);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i - 1]).toBeGreaterThanOrEqual(gains[i] as number);
    }
    // The strongest row is the No Drop waist piece seeded above: 40 AC on an
    // empty slot outranks everything else in the fixture catalog.
    expect(list[0]?.textContent).toContain('[Fixture] Girdle of the Deep');
  });

  it('says where the item comes from, and that it cannot be traded for', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const waist = rows().find((row) => row.textContent?.includes('Girdle of the Deep'));
    const source = (waist?.querySelector('.upg-source')?.textContent ?? '').replace(/\s+/g, ' ');
    expect(source).toContain('Lower Guk');
    expect(source).toContain('a ghoul cavalier');
    expect(source).toContain('The Harvester');
    expect(source).toContain('No Drop');
  });

  it('admits when the catalog records no source at all', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const bare = rows().find((row) => row.textContent?.includes('[Fixture] Iron Helm'));
    expect(bare?.querySelector('.upg-source-none')?.textContent).toContain(
      'No acquisition data is recorded',
    );
  });

  it('equips the item the row named, at the tier the row was scored at', async () => {
    const setId = build({ slots: { WAIST: { name: '[Fixture] Girdle of Endurance', tier: 4 } } });
    await render(`#/set/${setId}/upgrades`);

    const waist = rows().find((row) => row.textContent?.includes('Girdle of the Deep'));
    expect(waist?.textContent).toContain('[Fixture] Girdle of Endurance');
    await click(waist?.querySelector('.btn-primary'));

    const slot = useApp.getState().sets.find((s) => s.id === setId)?.slots.WAIST;
    expect(slot?.itemName).toBe('[Fixture] Girdle of the Deep');
    // Default basis is "the tier the slot already carries", so the swap keeps
    // the +4 the row compared at rather than silently dropping to +0.
    expect(slot?.upgrade.full).toBe(4);

    // The list re-ranks against the set as it now stands: the row is gone, and
    // the screen says what it did — including what it displaced, which is the
    // only way back in an app with no undo.
    expect(text()).toContain('equipped in Waist at +4');
    expect(text()).toContain('replacing [Fixture] Girdle of Endurance at +4');
    expect(rows().some((row) => row.textContent?.includes('Girdle of the Deep'))).toBe(false);
  });

  it('withholds a slot whose worn item has no published stats', async () => {
    const setId = build({ slots: { HEAD: { name: UNSTATTED.n, tier: 5 } } });
    await render(`#/set/${setId}/upgrades`);

    const held = container.querySelector('.upg-held');
    expect(held?.textContent).toContain(UNSTATTED.n);
    expect(held?.textContent).toContain('Unsourced · stats withheld');
    expect(held?.textContent).toContain('nothing can be measured against it');
    expect(held?.textContent).toContain('no catalog carries its numbers');
    // And no row anywhere claims a gain for that position.
    expect(rows().some((row) => row.textContent?.includes('Head'))).toBe(false);
  });

  it('opens the item window from a row without leaving the page', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const first = rows()[0];
    await click(first?.querySelector('.upg-name'));

    const modal = document.querySelector('.modal');
    expect(modal?.textContent).toContain('[Fixture] Girdle of the Deep');
    expect(window.location.hash).toContain('/upgrades');
  });

  it('scores every candidate at one tier when asked to', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const select = container.querySelector<HTMLSelectElement>('.upg-controls select');
    expect(select).toBeTruthy();
    await act(async () => {
      if (select) {
        select.value = 'fixed';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(text()).toContain('Every candidate is scored at +0');
    expect(container.querySelector('.stepper')).toBeTruthy();
    expect(rows().length).toBeGreaterThan(0);
  });

  it('resolves #/upgrades to the set you were last editing and says so in the URL', async () => {
    const setId = build();
    await render('#/upgrades');

    expect(window.location.hash).toBe(`#/set/${setId}/upgrades`);
    expect(text()).toContain('Main Set');
  });

  it('explains itself when there is no set to rank', async () => {
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    await render('#/upgrades');

    expect(text()).toContain('No set to rank');
    expect(text()).not.toMatch(/NaN/);
  });

  it('explains itself when the set weights nothing', async () => {
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const character = useApp.getState().createCharacter({
      name: 'Avenrae', level: 50, classes: ['WAR', 'BRD', 'BER'], race: null,
    });
    const set = useApp.getState().createSet(character.id, 'Unweighted', {});
    await render(`#/set/${set.id}/upgrades`);

    expect(text()).toContain('This set weights nothing');
    expect(rows()).toHaveLength(0);
  });

  it('says so rather than ranking when nothing can be improved', async () => {
    // Every position this trio can score, already carrying its best item.
    const setId = build();
    await render(`#/set/${setId}/upgrades`);
    for (const row of rows()) {
      const equip = row.querySelector('.btn-primary');
      // eslint-disable-next-line no-await-in-loop
      await click(equip);
      if (!rows().length) break;
    }
    expect(text()).toContain('Nothing outranks what you are wearing');
  });
});
