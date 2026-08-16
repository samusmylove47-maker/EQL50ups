import { describe, expect, it } from 'vitest';
import { hasStats, normalizeCatalog, normalizeItem, normalizeSlots } from './normalize';
import { SearchIndex } from './searchIndex';

describe('slot normalisation', () => {
  it('maps the corpus spellings onto canonical slot codes', () => {
    expect(normalizeSlots('FINGER')).toEqual(['FINGERS']);
    expect(normalizeSlots('SHOULDER')).toEqual(['SHOULDERS']);
    expect(normalizeSlots('SECONDAY')).toEqual(['SECONDARY']);
    expect(normalizeSlots('Any Slot')).toEqual(['ANY']);
    expect(normalizeSlots(['ear', 'EAR'])).toEqual(['EAR']);
  });

  it('splits compound slot expressions', () => {
    expect(normalizeSlots('PRIMARY/SECONDARY')).toEqual(['PRIMARY', 'SECONDARY']);
  });

  it('discards tokens it does not recognise', () => {
    expect(normalizeSlots('WT / NOSE')).toEqual([]);
    expect(normalizeSlots(undefined)).toEqual([]);
  });
});

describe('item normalisation', () => {
  it('reads the compact shipping shape unchanged', () => {
    const item = normalizeItem({
      id: 5667,
      n: 'Earthshaker',
      sl: ['PRIMARY'],
      cl: ['WAR', 'PAL'],
      ra: ['ALL'],
      st: { STR: 6, DEX: -5 },
      wp: { dmg: 37, dly: 70, skill: '2H Slashing' },
      fl: ['LORE', 'MAGIC'],
      wt: 16,
      era: 'Classic',
      av: true,
    });
    expect(item?.n).toBe('Earthshaker');
    expect(item?.st).toEqual({ STR: 6, DEX: -5 });
    expect(item?.wp).toEqual({ dmg: 37, dly: 70, skill: '2H Slashing' });
    expect(hasStats(item!)).toBe(true);
  });

  it('reads the long-form wiki shape, including nested stats', () => {
    const item = normalizeItem(
      {
        page: 'A Bone Necklace',
        stats: {
          flags: ['Lore Item', 'No Drop'],
          stats: [{ key: 'STA', value: '+4' }],
          saves: [{ key: 'SV_MAGIC', value: '3' }],
          slot: 'NECK',
          ac: 2,
          weight: '1.0',
          size: 'SMALL',
          classes: ['ALL'],
          races: ['ALL'],
        },
        iconId: 502,
        eraTag: 'Kunark',
      },
      'a bone necklace',
    );
    expect(item?.n).toBe('A Bone Necklace');
    expect(item?.sl).toEqual(['NECK']);
    expect(item?.st).toEqual({ STA: 4, AC: 2 });
    expect(item?.sv).toEqual({ SV_MAGIC: 3 });
    expect(item?.fl).toContain('LORE_ITEM');
    expect(item?.wt).toBe(1);
    expect(item?.era).toBe('Kunark');
  });

  it('falls back to the map key when an entry carries no name', () => {
    expect(normalizeItem({ sl: ['HEAD'] }, 'Hat of Nothing')?.n).toBe('Hat of Nothing');
    expect(normalizeItem({ sl: ['HEAD'] })).toBeNull();
    expect(normalizeItem('nonsense')).toBeNull();
  });

  it('defaults restrictions to ALL rather than to nothing', () => {
    const item = normalizeItem({ n: 'Plain Ring', sl: ['FINGER'] });
    expect(item?.cl).toEqual(['ALL']);
    expect(item?.ra).toEqual(['ALL']);
    expect(item?.av).toBe(true);
    expect(hasStats(item!)).toBe(false);
  });
});

describe('catalog normalisation', () => {
  it('accepts an array, an items array, or a name-keyed object', () => {
    const array = normalizeCatalog([{ n: 'A', sl: ['HEAD'] }]);
    const wrapped = normalizeCatalog({ v: 1, count: 1, items: [{ n: 'A', sl: ['HEAD'] }] });
    const keyed = normalizeCatalog({ items: { a: { stats: { slot: 'HEAD' } } } });
    expect(array).toHaveLength(1);
    expect(wrapped).toHaveLength(1);
    expect(keyed[0]?.n).toBe('a');
  });

  it('returns nothing for absent or unusable payloads instead of throwing', () => {
    expect(normalizeCatalog(null)).toEqual([]);
    expect(normalizeCatalog(undefined)).toEqual([]);
    expect(normalizeCatalog({ items: 42 })).toEqual([]);
  });
});

describe('search index', () => {
  const items = normalizeCatalog([
    { n: 'Earthshaker', sl: ['PRIMARY'] },
    { n: 'Shield of the Shaker', sl: ['SECONDARY'] },
    { n: "Bauble of Thassis' Regard", sl: ['EAR'] },
    { n: 'Iron Helm', sl: ['HEAD'] },
  ]);
  const index = new SearchIndex(items);
  const names = (query: string) => [...(index.search(query) ?? [])].map((i) => i.n).sort();

  it('returns null for an empty query so callers can skip filtering', () => {
    expect(index.search('')).toBeNull();
    expect(index.search('   ')).toBeNull();
  });

  it('matches on prefixes and on substrings within a word', () => {
    expect(names('earth')).toEqual(['Earthshaker']);
    expect(names('shak')).toEqual(['Earthshaker', 'Shield of the Shaker']);
  });

  it('requires every token to match', () => {
    expect(names('shield shaker')).toEqual(['Shield of the Shaker']);
    expect(names('shield earth')).toEqual([]);
  });

  it('is case-insensitive and tolerates punctuation in names', () => {
    expect(names('THASSIS')).toEqual(["Bauble of Thassis' Regard"]);
    expect(names("thassis'")).toEqual(["Bauble of Thassis' Regard"]);
  });

  it('returns an empty set for terms that appear nowhere', () => {
    expect(names('zzzz')).toEqual([]);
  });
});
