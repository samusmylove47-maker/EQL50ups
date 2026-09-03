/**
 * What the item window says about where its numbers came from.
 *
 * The window used to print one mark from one name list. `TIER0_LIVE_ITEMS` is
 * the era-purge rescue list, not an inventory, so the strongest label in the
 * project's vocabulary — "Tier M · confirmed in the live game" — sat directly
 * on top of Orb of Tishan's wiki stat block, while Earthshaker, nine of nine
 * predictions exact against a live client window, carried no mark at all.
 *
 * Two independent facts now ship on every record, and this file asserts the
 * window renders them as two. The fixtures are the shipped rows verbatim.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ItemWindow } from './ItemWindow';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';

/** Earthshaker as the pipeline now ships it: in era, and client-verified. */
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
  ex: 'live-export',
  sd: 'tier-M',
  sdc: 'TIER0-VALIDATION.md §1: observed in a live client window at +10 — nine of nine exact.',
  vf: ['DLY', 'DMG', 'STA', 'STR'],
};

/** Orb of Tishan: held in a live inventory, stat block a Kunark wiki page. */
const ORB_OF_TISHAN: Item = {
  id: 11625,
  n: 'Orb of Tishan',
  sl: ['SECONDARY'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: { MANA: 35, STA: 9, STR: 9 },
  sv: {},
  wp: { dmg: 7, dly: 25, skill: '1H Blunt' },
  fl: ['MAGIC'],
  era: 'Kunark',
  av: true,
  ex: 'live-export',
  sd: 'tier-5',
};

/** An ordinary in-era catalog row: no sighting, structured wiki numbers. */
const RUBICITE_BRACER: Item = {
  id: null,
  n: 'Rubicite Bracer',
  sl: ['WRIST'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: { AC: 12 },
  sv: {},
  fl: ['MAGIC'],
  era: 'Classic',
  av: true,
  sd: 'tier-2',
};

/** Shadow Rage Helm: real, and nobody has ever measured it. */
const SHADOW_RAGE_HELM: Item = {
  id: 55601,
  n: 'Shadow Rage Helm',
  sl: ['HEAD'],
  cl: ['BER'],
  ra: ['ALL'],
  st: {},
  sv: {},
  fl: [],
  av: true,
  eraUnknown: true,
  statsUnknown: true,
  evidence: 'Worn in the Head position of the live client inventory export, item #55601.',
  ex: 'live-export',
  sd: 'unattributed',
};

let host: HTMLDivElement | null = null;

function render(node: React.ReactElement): HTMLDivElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(node);
  });
  return host;
}

const textOf = (node: HTMLDivElement) => node.textContent ?? '';
const standingAttr = (node: HTMLDivElement) =>
  node.querySelector('.iwin')?.getAttribute('data-standing') ?? null;

afterEach(() => {
  host?.remove();
  host = null;
});

describe('the window states existence and stat provenance as two separate facts', () => {
  it('gives Earthshaker the client-verified mark it earned', () => {
    const text = textOf(render(<ItemWindow item={EARTHSHAKER} upgrade={tier(0)} />));
    expect(text).toContain('Tier M · stats read off the client');
    expect(text).toContain('Tier M · held in a live inventory');
  });

  it('does not print "read off the client" over Orb of Tishan\'s wiki numbers', () => {
    const node = render(<ItemWindow item={ORB_OF_TISHAN} upgrade={tier(0)} />);
    const text = textOf(node);
    // The item is real — the export holds it — so that much is still said.
    expect(text).toContain('Tier M · held in a live inventory');
    // But the numbers under it are a wiki page nothing places in this game.
    expect(text).toContain('Tier 5 · wiki stats, era unplaced');
    expect(text).not.toContain('read off the client');
    expect(text).not.toContain('confirmed in the live game');
    expect(standingAttr(node)).toBe('distrust');
  });

  it('separates the two facts rather than letting one imply the other', () => {
    // Same existence evidence, opposite stat standing: the pair only reads
    // correctly because the marks are computed from different files.
    const orb = textOf(render(<ItemWindow item={ORB_OF_TISHAN} upgrade={tier(0)} />));
    host?.remove();
    const shaker = textOf(render(<ItemWindow item={EARTHSHAKER} upgrade={tier(0)} />));
    const held = 'Tier M · held in a live inventory';
    expect(orb).toContain(held);
    expect(shaker).toContain(held);
    expect(orb).toContain('Tier 5');
    expect(shaker).not.toContain('Tier 5');
  });
});

describe('the accent band and eyebrow reach every row, not nine of them', () => {
  it('marks an ordinary in-era catalog row as Tier 2 rather than saying nothing', () => {
    const node = render(<ItemWindow item={RUBICITE_BRACER} upgrade={tier(0)} />);
    expect(textOf(node)).toContain('Tier 2 · structured wiki data');
    expect(standingAttr(node)).toBe('trusted');
    // No sighting: the item ships on its era, and the window does not pretend
    // somebody has held it.
    expect(textOf(node)).not.toContain('live inventory');
  });

  it('says withheld stats are withheld, and still vouches for the item', () => {
    const node = render(<ItemWindow item={SHADOW_RAGE_HELM} upgrade={tier(0)} />);
    const text = textOf(node);
    expect(text).toContain('Stats withheld · known item, numbers not published');
    expect(text).toContain('Tier M · held in a live inventory');
    expect(text).toContain('Not known.');
    expect(standingAttr(node)).toBe('unattributed');
  });

  it('states a standing even for a row the payload left blank', () => {
    const { sd: _drop, ex: _also, ...bare } = RUBICITE_BRACER;
    const node = render(<ItemWindow item={bare as Item} upgrade={tier(0)} />);
    expect(textOf(node)).toContain('No scoreable stats · nothing to attribute');
    expect(standingAttr(node)).toBe('unattributed');
  });
});

describe('the receipt is available where there is room to read it', () => {
  it('cites the client capture and the fields it covered, in the dialog', () => {
    const text = textOf(render(<ItemWindow item={EARTHSHAKER} upgrade={tier(0)} wide />));
    expect(text).toContain('TIER0-VALIDATION.md');
    expect(text).toContain('DLY, DMG, STA, STR');
    // The width of the claim is stated: DEX is on this item and in no capture.
    expect(text).toContain('no client capture covers');
  });

  it('explains why a tier-5 stat block cannot be placed', () => {
    const text = textOf(render(<ItemWindow item={ORB_OF_TISHAN} upgrade={tier(0)} wide />));
    expect(text).toContain('Kunark, which is past this game');
    expect(text).toContain('a live client holds it');
  });

  it('keeps the hover card to the eyebrows alone', () => {
    const text = textOf(render(<ItemWindow item={EARTHSHAKER} upgrade={tier(0)} />));
    expect(text).toContain('Tier M · stats read off the client');
    expect(text).not.toContain('TIER0-VALIDATION.md');
  });
});
