import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ItemWindow } from './ItemWindow';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';

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
