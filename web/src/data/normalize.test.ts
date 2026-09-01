import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

/* ------------------------------------------------------------------------- *
 * The crafted flag, against the encoding the pipeline actually writes.
 * ------------------------------------------------------------------------- */

describe('src.c survives normalisation', () => {
  /**
   * `pipeline/build.mjs:1532` writes `if (crafted) src.c = 1` — the compact
   * NUMERIC encoding this payload uses for flags. This normaliser accepted
   * `raw.c === true`, `raw.crafted === true` and `raw.playerCrafted === true`
   * and not the one spelling the pipeline emits, and `1 === true` is `false`.
   *
   * Measured on the shipped payload before the fix: **956 records carry
   * `src.c === 1`, and 0 survived normalisation with `src.c === true`.** Every
   * one of them lost its "Crafted" label, and `'crafted'` — one of the five
   * values in `SOURCE_FILTERS` — matched nothing at all.
   *
   * Three spellings were listed and the fourth was the live one. That is what
   * an accept-list does when it is written from what a reader expects rather
   * than from what the writer emits.
   */
  it('accepts the numeric 1 the pipeline emits, not only a boolean', () => {
    const one = normalizeCatalog({ items: [
      { n: 'Numeric', sl: ['CHEST'], src: { c: 1 } },
      { n: 'Boolean', sl: ['CHEST'], src: { c: true } },
      { n: 'Absent', sl: ['CHEST'], src: { z: ['Somewhere'] } },
      { n: 'Zero', sl: ['CHEST'], src: { c: 0, z: ['Somewhere'] } },
      // These two are what make `=== 1` a real choice rather than decoration:
      // a truthy test would take both, and neither is a flag this payload writes.
      { n: 'StringOne', sl: ['CHEST'], src: { c: '1', z: ['Somewhere'] } },
      { n: 'Two', sl: ['CHEST'], src: { c: 2, z: ['Somewhere'] } },
    ] });
    const by = new Map(one.map((i) => [i.n, i]));
    expect(by.get('Numeric')?.src?.c, 'the encoding the pipeline writes').toBe(true);
    expect(by.get('Boolean')?.src?.c).toBe(true);
    expect(by.get('Absent')?.src?.c).toBeUndefined();
    // A zero is an explicit "not crafted" and must not become true.
    expect(by.get('Zero')?.src?.c).toBeUndefined();
    /*
     * And the strictness is pinned. A truthy test passes this whole suite on
     * today's payload — measured: the only value `src.c` ever holds is the
     * number 1, 956 times — so nothing would have caught a loosening until a
     * payload started writing something else, which is exactly when it matters.
     */
    expect(by.get('StringOne')?.src?.c, 'a string is not a flag').toBeUndefined();
    expect(by.get('Two')?.src?.c, 'an unknown numeric code is not "crafted"').toBeUndefined();
  });

  it('carries crafted items through from the real shipped payload', () => {
    const dir = 'public/data/items';
    if (!existsSync(dir)) return expect(true).toBe(true);
    let rawOne = 0;
    let normalised = 0;
    let files = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      files += 1;
      const json = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
      for (const item of (json.items ?? json)) if (item?.src?.c === 1) rawOne += 1;
      for (const item of normalizeCatalog(json)) if (item.src?.c === true) normalised += 1;
    }
    // Names the subject searched, so a zero can never read as "nothing to find".
    expect(files).toBeGreaterThan(0);
    expect(rawOne, 'the payload carries crafted items at all').toBeGreaterThan(0);
    expect(normalised, 'and normalisation keeps them').toBe(rawOne);
  });
});
