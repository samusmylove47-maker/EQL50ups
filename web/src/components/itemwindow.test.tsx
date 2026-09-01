import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ItemWindow } from './ItemWindow';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { makeContext } from '../engine/character';
import type { ClassCode } from '../engine/constants';

/** Earthshaker as the catalog carries it, with the client's own base weight. */
const EARTHSHAKER: Item = {
  id: 5667,
  n: 'Earthshaker',
  sl: ['PRIMARY'],
  cl: ['WAR', 'PAL', 'RNG', 'SHD', 'BER'],
  ra: ['ALL'],
  st: { STR: 6, STA: 6, DEX: -5 },
  sv: {},
  wp: { dmg: 37, dly: 70, skill: '2H Slashing' },
  fl: ['LORE', 'MAGIC'],
  wt: 16,
  sz: 'GIANT',
  era: 'Classic',
  av: true,
};

let host: HTMLDivElement | null = null;

function render(node: React.ReactElement): string {
  host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(node);
  });
  return host.textContent ?? '';
}

afterEach(() => {
  host?.remove();
  host = null;
});

/*
 * The verdict line, over a race gate that was never checked.
 *
 * This panel used to print "Usable by this loadout" in green directly beneath
 * a Requirements block reading "Race BAR TRL OGR", for any character with no
 * race set — which is the default for a new one. Nothing had gone wrong with
 * the gate: race is optional and deliberately does not narrow. What had gone
 * wrong was the sentence, which reported a skipped check as a passed one.
 *
 * Rendered here rather than asserted through `usabilityNote` alone, because the
 * defect was that two parts of one panel contradicted each other, and only the
 * panel can show that they no longer do.
 */
const CRUSHBONE_BELT: Item = {
  id: null,
  n: 'Crushbone Belt',
  sl: ['WAIST'],
  cl: ['WAR', 'ROG', 'SHD', 'SHM'],
  ra: ['BAR', 'TRL', 'OGR'],
  st: { AC: 4 },
  sv: {},
  fl: [],
  av: true,
};

const TRIO: ClassCode[] = ['WAR', 'ROG', 'SHM'];
const LEVELS = { WAR: 50, ROG: 50, SHM: 50 };

describe('the item window does not vouch for a race it never checked', () => {
  it('withholds the verdict when the character has no race set', () => {
    const text = render(
      <ItemWindow item={CRUSHBONE_BELT} upgrade={tier(0)} context={makeContext(TRIO, null, LEVELS)} />,
    );
    // The requirement is on screen, as it always was.
    expect(text).toContain('BAR TRL OGR');
    // The claim about it is not.
    expect(text).not.toContain('Usable by this loadout');
    expect(text).toContain('no race set');
    // And it is not the opposite claim either: the item is still eligible.
    expect(text).not.toContain('This loadout cannot equip it');
  });

  it('gives a real verdict the moment a race is set, either way', () => {
    const ok = render(
      <ItemWindow item={CRUSHBONE_BELT} upgrade={tier(0)} context={makeContext(TRIO, 'BAR', LEVELS)} />,
    );
    expect(ok).toContain('Usable by this loadout');
    expect(ok).not.toContain('no race set');
    host?.remove();

    const no = render(
      <ItemWindow item={CRUSHBONE_BELT} upgrade={tier(0)} context={makeContext(TRIO, 'HUM', LEVELS)} />,
    );
    expect(no).toContain('This loadout cannot equip it');
  });

  it('still vouches for an unrestricted item with no race set', () => {
    const text = render(
      <ItemWindow item={EARTHSHAKER} upgrade={tier(0)} context={makeContext(['WAR'], null, { WAR: 50 })} />,
    );
    expect(text).toContain('Usable by this loadout');
  });
});

describe('item window weight tracks the upgrade level', () => {
  /*
   * The panel is headed "Stats at +N", so every number under it must be the
   * value at that tier. Weight was printing the base, which contradicted both
   * the heading beside it and the client: the live game drops Earthshaker from
   * 16 to 1.6 at +10.
   */
  it('prints the base weight at +0', () => {
    const text = render(<ItemWindow item={EARTHSHAKER} upgrade={tier(0)} />);
    expect(text).toContain('Weight16');
  });

  it('prints 1.6 at +10, as the client does', () => {
    const text = render(<ItemWindow item={EARTHSHAKER} upgrade={tier(10)} />);
    expect(text).toContain('Weight1.6');
    expect(text).not.toContain('Weight16');
  });

  it('still scales the numbers the client confirmed alongside it', () => {
    const text = render(<ItemWindow item={EARTHSHAKER} upgrade={tier(10)} />);
    expect(text).toContain('74'); // damage
    expect(text).toContain('1.057'); // ratio
    expect(text).toContain('+16'); // Strength and Stamina
  });

  it('renders nothing malformed for an item with no weight', () => {
    const { wt: _drop, ...noWeight } = EARTHSHAKER;
    const text = render(<ItemWindow item={noWeight as Item} upgrade={tier(4)} />);
    expect(text).not.toMatch(/NaN|undefined|\[object Object\]/);
  });
});

/**
 * The haste line, marked where a player actually decides.
 *
 * This window is the surface someone reads while working out whether an item is
 * worth farming. A caveat that lives only on the totals panel two screens away
 * is a caveat that arrives after the decision, so the mark rides on the figure
 * here as well — a dagger inside the value, and the sentence it stands for
 * directly below the stat grid.
 */
describe('a haste figure is never printed bare', () => {
  const CLOAK: Item = {
    id: null, n: 'Cloak of Flames', sl: ['BACK'], cl: ['ALL'], ra: ['ALL'],
    st: { HASTE: 36, AC: 10 }, sv: {}, fl: [], av: true,
  };

  it('marks the value and explains the mark in the same window', () => {
    const text = render(<ItemWindow item={CLOAK} upgrade={tier(0)} wide />);
    expect(text).toContain('Haste');
    expect(text).toContain('+36');
    expect(text).not.toContain('36%');
    expect(text).toContain('†');
    expect(text).toContain('Classic unit');
    expect(text).toMatch(/percentage that divided weapon delay/i);
    expect(text).toMatch(/Only the highest worn haste counts/i);
  });

  it('keeps the narrow hover card to the short form of the same claim', () => {
    const text = render(<ItemWindow item={CLOAK} upgrade={tier(0)} />);
    expect(text).toContain('Classic unit');
    expect(text).toMatch(/percentage that divided weapon delay/i);
    // The two-source paragraph is the dialog's job; 330px cannot hold it.
    expect(text).not.toMatch(/flat attack-speed/i);
  });

  it('says nothing about haste on an item that has none', () => {
    const text = render(<ItemWindow item={EARTHSHAKER} upgrade={tier(0)} wide />);
    expect(text).not.toContain('Classic unit');
    expect(text).not.toContain('†');
  });
});
