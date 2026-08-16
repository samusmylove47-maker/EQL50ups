/**
 * Console cleanliness under a development build of React.
 *
 * The Playwright suite runs against `vite build`, where React strips its
 * development warnings — so a duplicate `key`, a missing `act()`, or an invalid
 * DOM prop is invisible there by construction. These tests mount the same
 * screens under the development build and fail if React says anything at all,
 * which is the only place those warnings can be caught.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

let complaints: string[] = [];

beforeEach(() => {
  complaints = [];
  for (const level of ['error', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      complaints.push(`console.${level}: ${args.map(String).join(' ')}`);
    });
  }
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(hash: string): { root: Root; container: HTMLElement } {
  window.location.hash = hash;
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  return { root, container };
}

function unmount({ root, container }: { root: Root; container: HTMLElement }): void {
  act(() => root.unmount());
  container.remove();
}

function click(node: Element | null | undefined): void {
  expect(node, 'element to click').toBeTruthy();
  act(() => {
    node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

/** A character with a full-ish set, so lists and keys are exercised. */
function seed(): string {
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['BRD', 'WAR', 'BER'],
    race: null,
  });
  const gearSet = useApp.getState().createSet(character.id, 'Main Set');
  useApp.getState().equip(gearSet.id, 'PRIMARY', '[Fixture] Bronze Longsword');
  useApp.getState().setUpgrade(gearSet.id, 'PRIMARY', tier(5));
  useApp.getState().equip(gearSet.id, 'HEAD', '[Fixture] Iron Helm');
  useApp.getState().equip(gearSet.id, 'ANY_1', '[Fixture] Charm of Anywhere');
  useApp.getState().createSet(character.id, 'Second Set');
  return gearSet.id;
}

describe('the harness itself', () => {
  it('notices a React key warning, so a silent pass means something', () => {
    const Duplicated = () => (
      <ul>
        {['a', 'a'].map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root!: Root;
    act(() => {
      root = createRoot(container);
      root.render(<Duplicated />);
    });
    act(() => root.unmount());
    container.remove();
    expect(complaints.join('\n')).toMatch(/key/i);
    complaints = [];
  });
});

describe('React says nothing on any screen', () => {
  it.each([
    ['landing', '#/'],
    ['characters', '#/characters'],
    ['character creation', '#/character/new'],
    ['item browser', '#/items'],
    ['unknown route', '#/nowhere'],
    ['damaged share link', '#/share/!!!'],
  ])('%s', (_label, hash) => {
    seed();
    unmount(mount(hash));
    expect(complaints).toEqual([]);
  });

  it('the gear set, all three tabs, and the picker', () => {
    const setId = seed();
    const view = mount(`#/set/${setId}`);

    // Open a slot picker: a long keyed list plus a modal.
    click(view.container.querySelector('.slot-wrap button.slot'));
    expect(view.container.querySelector('.modal')).toBeTruthy();
    click(view.container.querySelector('.modal .modal-foot .btn'));

    // The stepper, which writes to the store on every press.
    click(view.container.querySelector('.slot-wrap .stepper button:last-of-type'));

    unmount(view);
    unmount(mount(`#/set/${setId}/exaltations`));
    unmount(mount(`#/set/${setId}/weights`));
    expect(complaints).toEqual([]);
  });

  it('a shared set, including its read-only tabs', () => {
    const payload = encodePlan({
      character: planCharacter({ name: 'Shared One', classes: ['SHM', 'ROG'], level: 50 }),
      set: {
        name: 'Borrowed',
        slots: {
          HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(7) },
          PRIMARY: { itemName: '[Fixture] Bronze Longsword', upgrade: tier(3) },
        },
        weights: { AC: 2, HP: 0.5 },
      },
    });
    unmount(mount(`#/share/${payload}`));
    expect(complaints).toEqual([]);
  });

  it('the storage warnings', () => {
    useApp.setState({ storageStatus: 'quota' });
    unmount(mount('#/'));
    useApp.setState({ storageStatus: 'unavailable' });
    unmount(mount('#/'));
    useApp.setState({ storageStatus: 'corrupt' });
    unmount(mount('#/'));
    expect(complaints).toEqual([]);
  });
});
