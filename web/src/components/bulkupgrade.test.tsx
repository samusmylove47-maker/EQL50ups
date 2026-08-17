/**
 * The bulk `+N` strip, driven through the real DOM.
 *
 * The store's semantics are pinned in `state/bulk-upgrade.test.ts`; what this
 * file is for is the contract the control makes with a person: eleven targets
 * that are one press each, one tab stop rather than eleven, a revert that
 * appears only when there is something to revert, and — the requirement that
 * would be easiest to break — a per-slot stepper that still works afterwards.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { tier } from '../engine/upgrade';
import { encodePlan, planCharacter } from '../share/codec';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let setId = '';

function mount(hash: string): void {
  window.location.hash = hash;
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
}

function click(element: Element | null | undefined): void {
  expect(element, 'element to click exists').toBeTruthy();
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function key(target: EventTarget, name: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

function chips(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('.bulk-tiers button')];
}

function chip(tier: number): HTMLButtonElement {
  const found = chips()[tier];
  expect(found, `a +${tier} target exists`).toBeTruthy();
  return found as HTMLButtonElement;
}

function revertButton(): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('.bulk-undo button');
}

function currentSet() {
  const found = useApp.getState().sets.find((s) => s.id === setId);
  expect(found).toBeTruthy();
  return found!;
}

/** Tier and banked fraction of every equipped slot, keyed by position. */
function tiers(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(currentSet().slots).map(([position, equipped]) => [
      position,
      `${equipped?.upgrade.full}.${equipped?.upgrade.fraction}`,
    ]),
  );
}

function equipFixtures(): void {
  const store = useApp.getState();
  store.equip(setId, 'HEAD', '[Fixture] Iron Helm');
  store.equip(setId, 'ARMS', '[Fixture] Plated Vambraces');
  store.equip(setId, 'PRIMARY', '[Fixture] Bronze Longsword');
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok', bulkUpgrade: null });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  setId = useApp.getState().createSet(character.id, 'Main Set').id;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the bulk +N strip', () => {
  beforeEach(() => {
    equipFixtures();
    mount(`#/set/${setId}`);
  });

  it('offers every legal tier, +0 through +10', () => {
    expect(chips().map((b) => b.textContent)).toEqual([
      '+0', '+1', '+2', '+3', '+4', '+5', '+6', '+7', '+8', '+9', '+10',
    ]);
  });

  it('takes the whole set to +5 in one press, and touches no empty slot', () => {
    click(chip(5));
    expect(tiers()).toEqual({ HEAD: '5.0', ARMS: '5.0', PRIMARY: '5.0' });
    expect(currentSet().slots.FEET).toBeUndefined();
    expect(Object.keys(currentSet().slots)).toHaveLength(3);
  });

  it('applies +0 as a real target', () => {
    click(chip(7));
    expect(tiers()).toEqual({ HEAD: '7.0', ARMS: '7.0', PRIMARY: '7.0' });
    click(chip(0));
    expect(tiers()).toEqual({ HEAD: '0.0', ARMS: '0.0', PRIMARY: '0.0' });
  });

  it('marks where the set already is, and moves the mark as the set moves', () => {
    expect(chip(0).getAttribute('aria-current')).toBe('true');
    click(chip(6));
    expect(chip(0).getAttribute('aria-current')).toBeNull();
    expect(chip(6).getAttribute('aria-current')).toBe('true');
  });

  it('marks nothing while the set is mixed', () => {
    click(chip(4));
    click(container.querySelector('[aria-label="Raise [Fixture] Iron Helm upgrade level"]'));
    expect(chips().filter((b) => b.getAttribute('aria-current') === 'true')).toHaveLength(0);
  });

  it('is one tab stop, with the arrows moving inside it', () => {
    expect(chips().filter((b) => b.tabIndex === 0)).toHaveLength(1);

    const start = chip(0);
    key(start, 'ArrowRight');
    key(start, 'ArrowRight');
    expect(chips().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(chip(2).tabIndex).toBe(0);
    // Moving focus must not be the same thing as applying a tier.
    expect(tiers()).toEqual({ HEAD: '0.0', ARMS: '0.0', PRIMARY: '0.0' });

    key(start, 'End');
    expect(chip(10).tabIndex).toBe(0);
    key(start, 'Home');
    expect(chip(0).tabIndex).toBe(0);
    // A scale, not a carousel.
    key(start, 'ArrowLeft');
    expect(chip(0).tabIndex).toBe(0);
  });

  it('leaves the per-slot stepper working', () => {
    click(chip(3));
    click(container.querySelector('[aria-label="Raise [Fixture] Iron Helm upgrade level"]'));
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(4);
    expect(currentSet().slots.ARMS?.upgrade.full).toBe(3);

    // …and the strip still drives every slot afterwards.
    click(chip(8));
    expect(tiers()).toEqual({ HEAD: '8.0', ARMS: '8.0', PRIMARY: '8.0' });
  });

  it('moves the stat panel with it', () => {
    // Iron Helm 8 + Plated Vambraces 11 + Bronze Longsword 3 = AC 22 at +0, and
    // 18 + 22 + 13 = 53 at +10. The panel must already say so.
    const ac = () => container.querySelector('.vitals')?.textContent ?? '';
    expect(ac()).toContain('22');
    click(chip(10));
    expect(ac()).toContain('53');
  });
});

describe('the revert offer', () => {
  beforeEach(() => {
    equipFixtures();
    mount(`#/set/${setId}`);
  });

  it('is absent until a bulk apply has happened', () => {
    expect(revertButton()).toBeNull();
  });

  it('appears afterwards, naming what was written', () => {
    click(chip(5));
    const note = container.querySelector('.bulk-undo');
    expect(note?.getAttribute('role')).toBe('status');
    expect(note?.textContent).toContain('3 items');
    expect(note?.textContent).toContain('+5');
    expect(revertButton()?.getAttribute('aria-label')).toBe('Revert those 3 items to plus 0');
  });

  it('restores the exact prior tiers, banked fractions included', () => {
    act(() => {
      useApp.getState().setUpgrade(setId, 'HEAD', { full: 2, fraction: 3 });
      useApp.getState().setUpgrade(setId, 'ARMS', { full: 7, fraction: 0 });
    });
    const before = tiers();
    expect(before).toEqual({ HEAD: '2.3', ARMS: '7.0', PRIMARY: '0.0' });

    click(chip(10));
    expect(tiers()).toEqual({ HEAD: '10.0', ARMS: '10.0', PRIMARY: '10.0' });
    // Mixed beforehand, so the offer says so rather than naming a tier.
    expect(revertButton()?.getAttribute('aria-label')).toBe(
      'Revert those 3 items to their previous tiers',
    );

    click(revertButton());
    expect(tiers()).toEqual(before);
    expect(revertButton()).toBeNull();
  });

  it('is withdrawn once a per-slot stepper has moved', () => {
    click(chip(5));
    expect(revertButton()).toBeTruthy();
    click(container.querySelector('[aria-label="Raise [Fixture] Iron Helm upgrade level"]'));
    expect(revertButton()).toBeNull();
  });

  it('is withdrawn when a slot is cleared', () => {
    click(chip(5));
    click(container.querySelector('[aria-label="Remove [Fixture] Iron Helm from Head"]'));
    expect(revertButton()).toBeNull();
  });

  it('is not offered when the press changed nothing', () => {
    click(chip(0));
    expect(revertButton()).toBeNull();
    expect(tiers()).toEqual({ HEAD: '0.0', ARMS: '0.0', PRIMARY: '0.0' });
  });
});

describe('an empty set', () => {
  beforeEach(() => {
    mount(`#/set/${setId}`);
  });

  it('offers the strip but refuses it, because there is nothing to upgrade', () => {
    expect(chips()).toHaveLength(11);
    expect(chips().every((b) => b.disabled)).toBe(true);
    expect(chip(5).title).toBe('Nothing is equipped yet');
    click(chip(5));
    expect(currentSet().slots).toEqual({});
  });
});

describe('a shared set', () => {
  it('gets no bulk strip, because there is nothing it could write to', () => {
    const payload = encodePlan({
      character: planCharacter({ name: 'Shared One', classes: ['WAR'], level: 50 }),
      set: {
        name: 'Borrowed',
        slots: { HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(7) } },
        weights: { AC: 2 },
      },
    });
    mount(`#/share/${payload}`);
    expect(container.textContent).toContain('Shared One');
    expect(container.querySelector('.bulk-tiers')).toBeNull();
    expect(container.querySelector('.bulk')).toBeNull();
  });
});
