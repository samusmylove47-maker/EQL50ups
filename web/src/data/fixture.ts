/**
 * FIXTURE DATA — NOT GAME CONTENT.
 *
 * A dozen invented items used for development, tests and the "try it without
 * data" path in the empty state. Every name is prefixed `[Fixture]` and every
 * entry carries the `FIXTURE` flag so nothing here can ever be mistaken for
 * catalog content. The real catalog is produced by the data pipeline into
 * `public/data/`.
 */

import type { Item } from '../engine/types';

function fixture(item: Partial<Item> & Pick<Item, 'n' | 'sl'>): Item {
  return {
    id: null,
    ic: 0,
    cl: ['ALL'],
    ra: ['ALL'],
    st: {},
    sv: {},
    av: true,
    era: 'Classic',
    ...item,
    n: `[Fixture] ${item.n}`,
    fl: ['FIXTURE', ...(item.fl ?? [])],
  };
}

export const FIXTURE_ITEMS: Item[] = [
  fixture({
    n: 'Bronze Longsword', sl: ['PRIMARY'], st: { STR: 4, AC: 3 },
    wp: { dmg: 14, dly: 30, skill: '1H Slashing' }, wt: 6, sz: 'MEDIUM',
    cl: ['WAR', 'PAL', 'SHD', 'RNG', 'BRD', 'ROG', 'BER'],
  }),
  fixture({
    n: 'Runed Mace of Trials', sl: ['PRIMARY', 'SECONDARY'], st: { WIS: 6, MANA: 30, AC: 5 },
    wp: { dmg: 11, dly: 28, skill: '1H Blunt' }, wt: 5,
    cl: ['CLR', 'DRU', 'SHM', 'PAL'], era: 'Sky',
    fx: [{ k: 'proc', n: 'Wave of Flame', d: 'Combat Effect' }],
  }),
  fixture({
    n: 'Buckler of Practice', sl: ['SECONDARY'], st: { AC: 9, STA: 3, HP: 20 }, wt: 4,
  }),
  fixture({
    n: 'Iron Helm', sl: ['HEAD'], st: { AC: 8, STA: 4 }, sv: { SV_MAGIC: 3 }, wt: 3,
  }),
  fixture({
    n: 'Silk Cowl', sl: ['HEAD'], st: { INT: 6, MANA: 25 }, wt: 0.5, cl: ['WIZ', 'MAG', 'ENC', 'NEC'],
  }),
  fixture({
    n: 'Cloak of the Dusk', sl: ['BACK'], st: { AC: 6, AGI: 5 }, sv: { SV_COLD: 5 }, wt: 1, era: 'Fear',
  }),
  fixture({
    n: 'Band of Small Favours', sl: ['FINGERS'], st: { STR: 3, DEX: 3, HP: 15 }, wt: 0.1,
  }),
  fixture({
    n: 'Loop of Whispered Wisdom', sl: ['EAR'], st: { WIS: 5, INT: 5, MANA: 20 }, wt: 0.1, era: 'Temple',
  }),
  fixture({
    n: 'Plated Vambraces', sl: ['ARMS'], st: { AC: 11, STA: 5, HP: 25 }, wt: 8,
    cl: ['WAR', 'PAL', 'SHD', 'CLR', 'BER'],
  }),
  fixture({
    n: 'Girdle of Endurance', sl: ['WAIST'], st: { STA: 7, ENDUR: 20, HP: 30 }, wt: 2,
  }),
  fixture({
    n: 'Boots of the Swift', sl: ['FEET'], st: { AGI: 8, AC: 7, HASTE: 11 }, wt: 2, era: 'Sky',
  }),
  fixture({
    n: 'Charm of Anywhere', sl: ['ANY'], st: { CHA: 6, HP: 20, MANA: 20 }, wt: 0.2,
    fx: [{ k: 'focus', n: 'Improved Healing II', d: 'Focus Effect' }],
  }),
  fixture({
    n: 'Barbed Arrow', sl: ['AMMO'], st: { DEX: 2 }, wp: { dmg: 5, dly: 20, skill: 'Archery' }, wt: 0.1,
  }),
];

export const FIXTURE_NOTICE =
  'Fixture data loaded — these are invented placeholder items for development, not EverQuest Legends content.';
