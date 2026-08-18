/**
 * The planar gear screen, mounted for real.
 *
 * The catalog is loaded off disk and pushed into the store rather than fetched,
 * because jsdom has no server to fetch from and because the interesting
 * assertions here are about *this build's* pieces — the Shadow Rage refusal, the
 * race gate on Rune Etched, the repeated standing badge — none of which a
 * synthetic fixture would exercise honestly.
 *
 * If the pipeline has not run, the block skips. An absent catalog is a
 * supported state everywhere else in this app and it is one here.
 */

import { existsSync, readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { indexItems, useCatalog } from '../data/catalog';
import { normalizeCatalog } from '../data/normalize';
import type { Item } from '../engine/types';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { PLANAR_SLOTS } from './planarSets';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SHARDS = PLANAR_SLOTS.map((slot) => `public/data/items/${slot}.json`);
const published = SHARDS.every((path) => existsSync(path));

function planarItems(): Item[] {
  const byName = new Map<string, Item>();
  for (const path of SHARDS) {
    for (const item of normalizeCatalog(JSON.parse(readFileSync(path, 'utf8')))) {
      byName.set(item.n.toLowerCase(), item);
    }
  }
  return [...byName.values()];
}

interface Mounted {
  container: HTMLElement;
  unmount: () => void;
}

function mount(hash: string): Mounted {
  window.location.hash = hash;
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
  return {
    container,
    unmount: () => {
      act(() => (root as Root | null)?.unmount());
      container.remove();
    },
  };
}

function click(el: Element | null | undefined): void {
  if (!el) throw new Error('nothing to click');
  act(() => {
    (el as HTMLElement).click();
  });
}

/** Pick a class chip by its code, the way a reader does. */
function pickClass(container: HTMLElement, code: string): void {
  const chip = [...container.querySelectorAll('.class-chip')].find(
    (button) => button.querySelector('.class-orb')?.textContent === code,
  );
  click(chip);
}

/** One slot's section, re-queried each time because React replaces the nodes. */
function slotSection(container: HTMLElement, slot: string): Element {
  const head = container.querySelector(`#pl-slot-${slot}`);
  const section = head?.closest('.pl-slot');
  if (!section) throw new Error(`no section for ${slot}`);
  return section;
}

function lockButtons(container: HTMLElement, slot: string): HTMLButtonElement[] {
  return [...slotSection(container, slot).querySelectorAll<HTMLButtonElement>('.pl-lock')];
}

function lockedCount(container: HTMLElement, slot: string): number {
  return slotSection(container, slot).querySelectorAll('.pl-lock[aria-pressed="true"]').length;
}

beforeEach(() => {
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const items = published ? planarItems() : [];
  useCatalog.setState({
    status: 'ready',
    error: null,
    meta: null,
    items,
    ...indexItems(items),
    indexNames: items.map((item) => item.n),
    shards: {},
    effects: new Map(),
    effectsStatus: 'idle',
    // Stops `ensureAll` reaching for a network that is not there.
    usingFixture: true,
    revision: 1,
  });
});

describe('planar gear screen', () => {
  it('is routable and states its assumption before anything is picked', () => {
    const { container, unmount } = mount('#/planar');
    const html = container.innerHTML;
    expect(html).toContain('Planar gear');
    expect(html).toContain('One assumption, stated');
    expect(html).toContain('Wrist counts twice');
    expect(html).toContain('Pick three classes above to begin');
    expect(html).not.toMatch(/NaN/);
    unmount();
  });

  it('does not offer the slots the sets do not cover', () => {
    const { container, unmount } = mount('#/planar');
    const uncovered = [...container.querySelectorAll('.pl-uncovered span')].map(
      (node) => node.textContent,
    );
    expect(uncovered).toContain('Fingers 1');
    expect(uncovered).toContain('Ear 1');
    expect(uncovered).toContain('Primary');
    // And no slot section is rendered for them.
    expect(container.querySelector('#pl-slot-FINGERS')).toBeNull();
    unmount();
  });
});

describe.skipIf(!published)('planar gear screen, against the shipped catalog', () => {
  it('ranks a WAR/BRD/BER trio and repeats the standing badge on every card', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);

    const cards = [...container.querySelectorAll('.pl-card')];
    expect(cards.length).toBeGreaterThan(0);
    // The badge repeats on every card, which is the whole point of it: it is
    // never off screen when the reader decides.
    for (const card of cards) {
      expect(card.querySelector('.pl-standing')).not.toBeNull();
    }
    // And each card's top edge is coloured by that same standing.
    for (const card of cards) {
      expect(['trusted', 'corroborating', 'distrust', 'unattributed']).toContain(
        card.getAttribute('data-standing'),
      );
    }

    const html = container.innerHTML;
    expect(html).toContain('Indicolite Breastplate');
    expect(html).toContain('Lustrous Russet');
    // A Warrior/Bard/Berserker cannot wear Midnight Clad through any of the
    // three, so it is not offered at all.
    expect(html).not.toContain('Midnight Clad Straps');
    expect(html).not.toMatch(/NaN/);
    unmount();
  });

  it('lists Shadow Rage without a score and says why', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);

    const unmeasured = [...container.querySelectorAll('.pl-card-unmeasured')];
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const card of unmeasured) {
      expect(card.textContent).toContain('no score');
      expect(card.textContent).toContain('no source publishes its numbers');
      // Not a zero anywhere on the card.
      expect(card.querySelector('.pl-score')?.textContent).not.toMatch(/0\.0 EP/);
    }
    expect(container.innerHTML).toContain('Shadow Rage');
    unmount();
  });

  it('lets Wrist take two locks and drops the oldest at three', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);

    expect(slotSection(container, 'WRIST').textContent).toContain('wear 2');
    expect(lockButtons(container, 'WRIST').length).toBeGreaterThanOrEqual(3);

    const firstName = lockButtons(container, 'WRIST')[0]
      ?.closest('.pl-card')
      ?.querySelector('.pl-name')?.textContent;

    click(lockButtons(container, 'WRIST')[0]);
    click(lockButtons(container, 'WRIST')[1]);
    expect(lockedCount(container, 'WRIST')).toBe(2);

    click(lockButtons(container, 'WRIST')[2]);
    // Still two: you wear two bracers, so a third lock replaces the first.
    expect(lockedCount(container, 'WRIST')).toBe(2);
    const stillLocked = [...slotSection(container, 'WRIST').querySelectorAll('.pl-lock[aria-pressed="true"]')].map(
      (button) => button.closest('.pl-card')?.querySelector('.pl-name')?.textContent,
    );
    expect(stillLocked).not.toContain(firstName);

    // No other slot took a second lock from any of that.
    expect(lockedCount(container, 'HEAD')).toBe(0);
    unmount();
  });

  it('repeats the standing on the locked total, as a mix rather than one badge', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);

    // Lock the best piece in three different slots.
    const slots = [...container.querySelectorAll('.pl-slot')].slice(0, 3);
    for (const slot of slots) click(slot.querySelector('.pl-lock'));

    const total = container.querySelector('.pl-total');
    expect(total).not.toBeNull();
    expect(total?.textContent).toContain('of 8 targets locked');
    const badges = [...(total?.querySelectorAll('.pl-standing') ?? [])];
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) expect(badge.textContent).toMatch(/×\d+$/);
    unmount();
  });

  it('withholds a race-restricted set from a shaman of the wrong race', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['SHM', 'WAR', 'ROG']) pickClass(container, code);
    expect(container.innerHTML).toContain('Rune Etched');

    /*
     * The race dropdown has to offer a race no planar piece mentions, or a High
     * Elf has no way to say so. Deriving the list from the planar pieces alone
     * gave three codes and left the wrong-race case unsayable, which is how this
     * assertion passed for the wrong reason the first time it was written.
     */
    const race = [...container.querySelectorAll<HTMLSelectElement>('.pl-field select')].find((el) =>
      [...el.options].some((option) => option.value === 'HEF'),
    );
    if (!race) throw new Error('no race dropdown offering HEF');
    act(() => {
      race.value = 'HEF';
      race.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.innerHTML).not.toContain('Rune Etched Chestplate');
    unmount();
  });

  it('writes locked targets onto a gear set, leaving the unmeasured ones out', () => {
    const character = useApp.getState().createCharacter({
      name: 'Avenrae',
      level: 50,
      classes: ['BRD', 'WAR', 'BER'],
      race: null,
    });
    const gearSet = useApp.getState().createSet(character.id, 'Main Set');

    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);

    // Lock every slot's best measured piece, plus one unmeasured piece.
    for (const slot of container.querySelectorAll('.pl-slot')) {
      click(slot.querySelector('.pl-card:not(.pl-card-unmeasured) .pl-lock'));
    }
    const unmeasured = container.querySelector('.pl-card-unmeasured .pl-lock');
    click(unmeasured);

    const send = [...container.querySelectorAll<HTMLSelectElement>('.pl-send select')][0];
    expect(send).not.toBeNull();
    act(() => {
      if (!send) return;
      send.value = gearSet.id;
      send.dispatchEvent(new Event('change', { bubbles: true }));
    });
    click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Write targets'));

    const written = useApp.getState().sets.find((s) => s.id === gearSet.id);
    expect(written).toBeDefined();
    const placed = Object.entries(written?.slots ?? {}).filter(([, value]) => value);
    expect(placed.length).toBeGreaterThan(0);
    // Nothing unmeasured reached the doll: a set's totals would then read a
    // number off a row that has none.
    for (const [, equipped] of placed) {
      const item = useCatalog.getState().byName.get(equipped?.itemName.toLowerCase() ?? '');
      expect(item?.statsUnknown).not.toBe(true);
    }
    expect(container.innerHTML).toContain('left out, because it has no numbers');
    unmount();
  });

  it('re-ranks when the weight profile changes', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);

    const firstName = () =>
      container.querySelector('#pl-slot-HEAD')?.closest('.pl-slot')?.querySelector('.pl-name')
        ?.textContent ?? '';
    const before = firstName();
    expect(before).not.toBe('');

    const weights = [...container.querySelectorAll<HTMLSelectElement>('.pl-weight-pick select')][0];
    expect(weights).not.toBeNull();
    act(() => {
      if (!weights) return;
      weights.value = 'preset:caster';
      weights.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.innerHTML).toContain('Caster');
    // The Warrior helm wins on AC and loses to the Bard's on a caster profile,
    // which is the whole reason weights are a control rather than a constant.
    expect(firstName()).not.toBe(before);
    unmount();
  });

  it('never prints a bare EP zero beside a measured one', () => {
    const { container, unmount } = mount('#/planar');
    for (const code of ['WAR', 'BRD', 'BER']) pickClass(container, code);
    const scores = [...container.querySelectorAll('.pl-score')].map((node) => node.textContent);
    for (const score of scores) {
      expect(score).not.toBe('0.0 EP');
    }
    unmount();
  });
});
