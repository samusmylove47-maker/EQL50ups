/**
 * Interaction tests for the two controls the product lives or dies by: the
 * slot picker and the inline +N stepper. Driven through real DOM events in
 * jsdom rather than by calling handlers directly, so keyboard support is
 * actually exercised.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
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

function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function key(target: EventTarget, name: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  });
}

function byLabel(label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

function slotButton(label: string): HTMLElement | null {
  return (
    container.querySelector<HTMLElement>(`[aria-label^="${label}:"]`) ??
    container.querySelector<HTMLElement>(`[aria-label^="${label}"]`)
  );
}

function currentSet() {
  const found = useApp.getState().sets.find((s) => s.id === setId);
  expect(found).toBeTruthy();
  return found!;
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  const gearSet = useApp.getState().createSet(character.id, 'Main Set');
  setId = gearSet.id;
  mount(`#/set/${setId}`);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the slot picker', () => {
  it('opens from an empty slot, ranks candidates, and equips with the mouse', () => {
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    click(slotButton('Head'));

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    // Warrior trio: the caster-only cowl is not offered.
    expect(dialog?.textContent).toContain('[Fixture] Iron Helm');
    expect(dialog?.textContent).not.toContain('[Fixture] Silk Cowl');

    click(options[0]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(currentSet().slots.HEAD?.itemName).toBe('[Fixture] Iron Helm');
    expect(container.textContent).toContain('[Fixture] Iron Helm');
  });

  it('filters as you type and equips the highlighted row with the keyboard', () => {
    click(slotButton('Primary'));
    const search = byLabel('Search items by name') as HTMLInputElement;
    expect(search).toBeTruthy();

    type(search, 'longsword');
    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('Bronze Longsword');

    key(search, 'ArrowDown');
    key(search, 'Enter');
    expect(currentSet().slots.PRIMARY?.itemName).toBe('[Fixture] Bronze Longsword');
  });

  it('closes on Escape without equipping anything', () => {
    click(slotButton('Chest'));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    key(document, 'Escape');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(currentSet().slots.CHEST).toBeUndefined();
  });

  it('offers wearable items to an Any Slot position', () => {
    click(slotButton('Any Slot 1'));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Any Slot accepts any wearable item');
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(1);
  });
});

describe('the +N stepper', () => {
  beforeEach(() => {
    click(slotButton('Head'));
    click(container.querySelectorAll('[role="option"]')[0]);
  });

  it('raises the tier on click and recomputes the stat panel immediately', () => {
    const before = container.textContent ?? '';
    expect(before).toContain('AC');
    click(byLabel('Raise [Fixture] Iron Helm upgrade level'));
    expect(currentSet().slots.HEAD?.upgrade).toEqual({ full: 1, fraction: 0 });
    // Iron Helm is AC 8 at +0 and AC 9 at +1; the panel must already show it.
    const vitals = container.querySelector('.vitals')?.textContent ?? '';
    expect(vitals).toContain('9');
  });

  it('steps with arrow keys and jumps with Home and End', () => {
    const spin = byLabel('[Fixture] Iron Helm upgrade level');
    expect(spin?.getAttribute('role')).toBe('spinbutton');
    key(spin as HTMLElement, 'ArrowUp');
    key(spin as HTMLElement, 'ArrowUp');
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(2);
    key(spin as HTMLElement, 'ArrowDown');
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(1);
    key(spin as HTMLElement, 'End');
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(10);
    key(spin as HTMLElement, 'Home');
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(0);
  });

  it('never leaves the legal 0..10 range', () => {
    const spin = byLabel('[Fixture] Iron Helm upgrade level') as HTMLElement;
    for (let i = 0; i < 15; i++) key(spin, 'ArrowUp');
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(10);
    for (let i = 0; i < 15; i++) key(spin, 'ArrowDown');
    expect(currentSet().slots.HEAD?.upgrade.full).toBe(0);
  });

  it('clears the slot from the doll', () => {
    click(byLabel('Remove [Fixture] Iron Helm from Head'));
    expect(currentSet().slots.HEAD).toBeUndefined();
  });
});

describe('exaltation sockets', () => {
  it('unlock as the tier rises', () => {
    click(slotButton('Head'));
    click(container.querySelectorAll('[role="option"]')[0]);
    window.location.hash = `#/set/${setId}/exaltations`;
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(container.textContent).toContain('Unlocks at +1');
    const spin = byLabel('[Fixture] Iron Helm upgrade level') as HTMLElement;
    key(spin, 'ArrowUp');
    key(spin, 'ArrowUp');
    expect(container.textContent).not.toContain('Unlocks at +1');
    expect(container.textContent).toContain('Unlocks at +3');
  });
});
