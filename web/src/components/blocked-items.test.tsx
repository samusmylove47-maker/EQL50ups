/**
 * An item this loadout cannot wear must be refused, and must say so in words.
 *
 * Two halves of one finding:
 *
 *  1. The item browser's dialog printed **THIS LOADOUT CANNOT EQUIP IT** and
 *     then offered *EQUIP IN MAIN SET → WAIST* four lines below it. Clicking it
 *     put a Monk-only sash on a WAR/BRD/BER doll and folded 41% haste into the
 *     headline totals, with no confirm and no warning — while every slot picker
 *     in the app refuses to *list* the same item. Two surfaces, two rules.
 *
 *  2. When such an item does reach the doll — a shared set, an import, or a
 *     character whose classes changed after the slot was filled — the only
 *     signal was the name turning `#c86454`. Colour as the sole carrier of
 *     meaning is a WCAG 1.4.1 failure, and there is no legend on that tab to
 *     decode it.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { activeContext } from '../engine/character';
import { BASE_STATE } from '../engine/upgrade';
import { useCatalog } from '../data/catalog';
import { FIXTURE_ITEMS } from '../data/fixture';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { ItemDetail } from './ItemDetail';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** WIZ/MAG/ENC/NEC only — nothing a WAR/BRD/BER trio can ever wear. */
const COWL = FIXTURE_ITEMS.find((i) => i.n === '[Fixture] Silk Cowl')!;
/** Open to WAR among others. */
const HELM = FIXTURE_ITEMS.find((i) => i.n === '[Fixture] Iron Helm')!;

const TARGETS = [{ positionId: 'HEAD', label: 'Head' }];

function trio() {
  return useApp.getState().createCharacter({
    name: 'Critic',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the detail dialog applies the picker’s rule', () => {
  function open(item: typeof COWL, classes: Array<'WAR' | 'WIZ'> = ['WAR']): void {
    const character = useApp.getState().createCharacter({
      name: 'Reader',
      level: 50,
      classes,
      race: null,
    });
    act(() => {
      root.render(
        <ItemDetail
          item={item}
          upgrade={BASE_STATE}
          equipTargets={TARGETS}
          setName="Main Set"
          context={activeContext(character)}
          onEquip={() => undefined}
          onClose={() => undefined}
        />,
      );
    });
  }

  it('withdraws the equip buttons the window has already said are impossible', () => {
    open(COWL);
    expect(container.querySelectorAll('.chip-row .btn')).toHaveLength(0);
    // …and the window's own verdict is still on screen, so the two agree.
    expect(container.textContent).toContain('This loadout cannot equip it');
  });

  it('says why, with the class list that decides it', () => {
    open(COWL);
    const note = container.querySelector('[data-blocked="equip"]');
    expect(note).toBeTruthy();
    const text = note?.textContent ?? '';
    expect(text).toContain('Main Set');
    expect(text).toContain('WIZ');
    expect(text).toContain('WAR');
    expect(text).toMatch(/slot pickers/i);
  });

  it('still equips anything the loadout can actually wear', () => {
    open(HELM);
    const buttons = [...container.querySelectorAll('.chip-row .btn')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Head']);
    expect(container.querySelector('[data-blocked="equip"]')).toBeNull();
  });

  it('names the gate that actually closed, not the first one it can think of', () => {
    /*
     * `canUse` is class AND race AND level. "Restricted to WAR" is the wrong
     * sentence for a Warrior sword a Warrior 12 is simply too low for, and a
     * reader who catches the tool naming the wrong reason will not believe the
     * next number either.
     */
    const character = useApp.getState().createCharacter({
      name: 'Sprout',
      level: 12,
      classes: ['WAR'],
      race: null,
    });
    const gated = { ...HELM, n: 'Veteran’s Helm', cl: ['WAR'], rl: 46 };
    act(() => {
      root.render(
        <ItemDetail
          item={gated}
          upgrade={BASE_STATE}
          equipTargets={TARGETS}
          setName="Main Set"
          context={activeContext(character)}
          onEquip={() => undefined}
          onClose={() => undefined}
        />,
      );
    });

    const text = container.querySelector('[data-blocked="equip"]')?.textContent ?? '';
    expect(text).toContain('needs level 46');
    expect(text).toContain('WAR');
    expect(text).toContain('12');
    expect(text, 'the class gate is open — do not blame it').not.toContain('restricted to');
    expect(container.querySelectorAll('.chip-row .btn')).toHaveLength(0);
  });

  it('judges nothing when there is no loadout to judge against', () => {
    // A share link opens read-only with no character: refusing there would be
    // an opinion about somebody else's trio.
    act(() => {
      root.render(
        <ItemDetail
          item={COWL}
          upgrade={BASE_STATE}
          equipTargets={TARGETS}
          setName="Main Set"
          onEquip={() => undefined}
          onClose={() => undefined}
        />,
      );
    });
    expect(container.querySelectorAll('.chip-row .btn')).toHaveLength(1);
    expect(container.querySelector('[data-blocked="equip"]')).toBeNull();
  });
});

describe('the paper doll says it in words, not only in red', () => {
  function mountSet(itemName: string): void {
    const character = trio();
    const gearSet = useApp.getState().createSet(character.id, 'Main Set');
    // Straight into the store: the UI paths that would place it are exactly the
    // ones now closed, but a shared set, an import or a class change still can.
    useApp.getState().equip(gearSet.id, 'HEAD', itemName);
    window.location.hash = `#/set/${gearSet.id}`;
    act(() => {
      root.render(<App />);
    });
  }

  function headRow(): HTMLElement {
    const row = [...container.querySelectorAll<HTMLElement>('.slot-wrap')].find((el) =>
      /^Head:/.test(el.querySelector('button.slot')?.getAttribute('aria-label') ?? ''),
    );
    expect(row, 'the Head row').toBeTruthy();
    return row as HTMLElement;
  }

  it('marks the row with text, and names the classes in its tooltip', () => {
    mountSet(COWL.n);
    const row = headRow();

    const marker = row.querySelector('.slot-blocked');
    expect(marker, 'a text affordance, not only a colour').toBeTruthy();
    expect(marker?.textContent).toMatch(/can.t equip/i);
    expect(marker?.getAttribute('title')).toContain('WIZ');

    const name = row.querySelector<HTMLElement>('.slot-item');
    const title = name?.getAttribute('title') ?? '';
    expect(title).toContain('this loadout cannot equip it');
    expect(title).toContain('WIZ');
    // The note already opens with the item's name; it must not be prefixed
    // with a second copy of it.
    expect(title.split(COWL.n)).toHaveLength(2);
    // The colour is still there — it is now the second signal rather than the only one.
    expect(name?.style.color).toBe('var(--item-blocked)');
  });

  it('puts it in the accessible name, where a screen reader will reach it', () => {
    mountSet(COWL.n);
    const label = headRow().querySelector('button.slot')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('[Fixture] Silk Cowl');
    expect(label).toContain('This loadout cannot equip it');
  });

  it('says nothing at all about an item the trio can wear', () => {
    mountSet(HELM.n);
    const row = headRow();
    expect(row.querySelector('.slot-blocked')).toBeNull();
    expect(row.querySelector('.slot-item')?.getAttribute('title')).toBe(HELM.n);
    expect(row.querySelector('button.slot')?.getAttribute('aria-label')).not.toContain('cannot');
  });

  it('leaves the twenty-two other rows unmarked, so the marker means something', () => {
    mountSet(COWL.n);
    expect(container.querySelectorAll('.slot-blocked')).toHaveLength(1);
  });
});
