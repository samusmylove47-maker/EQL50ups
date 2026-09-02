/**
 * The `/outputfile inventory` reader.
 *
 * Two halves. The first drives synthetic exports through every branch of the
 * grammar — doubled positions, sub-slots, containers, junk — because those are
 * the cases a real file happens not to contain. The second runs the genuine
 * client export in `research/validation/tier0-inventory-Avenrae.txt` against
 * the genuine shipped catalog, and asserts the exact numbers it produces: that
 * file is the only Tier 0 evidence there is, and an importer that drifts away
 * from it has stopped importing the game's own format.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../engine/types';
import { normalizeCatalog } from '../data/normalize';
import {
  MAX_ROWS,
  exaltationsByPosition,
  importedSetName,
  itemIdIndex,
  positionsInDollOrder,
  readInventory,
  splitUpgradeSuffix,
  stripExaltationSuffix,
  summarizeIgnored,
  summarizeImport,
  toSlotMap,
  type InventoryCatalog,
} from './inventoryImport';

/* --------------------------------------------------------------- fixtures */

function item(n: string, id: number | null, slots: string[] = ['PRIMARY']): Item {
  return { id, n, sl: slots, cl: ['ALL'], ra: ['ALL'], st: {}, sv: {}, fl: [], av: true };
}

function catalogOf(items: Item[]): InventoryCatalog {
  return {
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
    byId: itemIdIndex(items),
  };
}

/** Build an export body from `Location\tName\tID` triples. */
function sheet(rows: Array<[string, string, number | string]>): string {
  return ['Location\tName\tID\tCount\tSlots', ...rows.map((r) => `${r[0]}\t${r[1]}\t${r[2]}\t1\t10`)]
    .join('\r\n');
}

const EMPTY_CATALOG: InventoryCatalog = { byName: new Map(), byId: new Map() };

/* ------------------------------------------------------------- name pieces */

describe('splitUpgradeSuffix', () => {
  it('lifts the +N off the end of a name', () => {
    expect(splitUpgradeSuffix('Earthshaker +10')).toEqual({ name: 'Earthshaker', tier: 10 });
    expect(splitUpgradeSuffix('Cloak of Flames +7')).toEqual({ name: 'Cloak of Flames', tier: 7 });
  });

  it('leaves a name with no suffix at tier 0', () => {
    expect(splitUpgradeSuffix('Spacious Rucksack')).toEqual({ name: 'Spacious Rucksack', tier: 0 });
  });

  it('clamps a tier the game cannot reach rather than trusting it', () => {
    expect(splitUpgradeSuffix('Impossible Sword +99').tier).toBe(10);
  });

  it('does not mistake a plus in the middle of a name for a tier', () => {
    expect(splitUpgradeSuffix('Rune of +Al`Kabor')).toEqual({
      name: 'Rune of +Al`Kabor',
      tier: 0,
    });
  });

  it('tidies whitespace without altering the characters', () => {
    expect(splitUpgradeSuffix('  Cloak   of Flames  +7 ')).toEqual({
      name: 'Cloak of Flames',
      tier: 7,
    });
  });
});

describe('stripExaltationSuffix', () => {
  it('removes the client marker and says it saw one', () => {
    expect(stripExaltationSuffix('Fishbone Earring (Exaltation)')).toEqual({
      name: 'Fishbone Earring',
      marked: true,
    });
  });

  it('leaves an unmarked name alone', () => {
    expect(stripExaltationSuffix('Ornate Bauble')).toEqual({ name: 'Ornate Bauble', marked: false });
  });
});

/* ------------------------------------------------------------ worn parsing */

describe('readInventory — worn positions', () => {
  it('fills the doubled positions in the order the client printed them', () => {
    const catalog = catalogOf([item('Left Ring', 1, ['FINGERS']), item('Right Ring', 2, ['FINGERS'])]);
    const result = readInventory(
      sheet([
        ['Fingers', 'Left Ring +3', 1],
        ['Fingers', 'Right Ring +5', 2],
      ]),
      catalog,
    );
    expect(result.positions.map((p) => [p.positionId, p.itemName, p.tier])).toEqual([
      ['FINGERS_1', 'Left Ring', 3],
      ['FINGERS_2', 'Right Ring', 5],
    ]);
  });

  it('counts an empty first position, so a lone earring lands in Ear 2', () => {
    const catalog = catalogOf([item('Fishbone Earring', 10313, ['EAR'])]);
    const result = readInventory(
      sheet([
        ['Ear', 'Empty', 0],
        ['Ear', 'Fishbone Earring +2', 10313],
      ]),
      catalog,
    );
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]?.positionId).toBe('EAR_2');
    expect(result.empty).toEqual(['EAR_1']);
  });

  it('maps every location name the client prints to a paper-doll position', () => {
    const names = [
      'Any Slot', 'Ear', 'Head', 'Face', 'Neck', 'Shoulders', 'Arms', 'Back', 'Wrist',
      'Range', 'Hands', 'Primary', 'Secondary', 'Fingers', 'Chest', 'Legs', 'Feet',
      'Waist', 'Ammo',
    ];
    const items = names.map((_location, i) => item(`Thing ${i}`, 100 + i, ['PRIMARY']));
    const result = readInventory(
      sheet(names.map((loc, i) => [loc, `Thing ${i} +1`, 100 + i])),
      catalogOf(items),
    );
    expect(result.unmatched).toEqual([]);
    expect(result.positions).toHaveLength(names.length);
    expect(new Set(result.positions.map((p) => p.positionId)).size).toBe(names.length);
  });

  it('reports a third Ear row rather than overwriting Ear 2', () => {
    const catalog = catalogOf([item('A', 1, ['EAR']), item('B', 2, ['EAR']), item('C', 3, ['EAR'])]);
    const result = readInventory(
      sheet([
        ['Ear', 'A', 1],
        ['Ear', 'B', 2],
        ['Ear', 'C', 3],
      ]),
      catalog,
    );
    expect(result.positions.map((p) => p.itemName)).toEqual(['A', 'B']);
    expect(result.ignored.map((r) => r.rawName)).toEqual(['C']);
  });

  it('records the position the export never mentioned', () => {
    const result = readInventory(sheet([['Primary', 'Empty', 0]]), EMPTY_CATALOG);
    expect(result.recognized).toBe(true);
    expect(result.notes.join(' ')).toContain('22 worn positions');
  });
});

/* -------------------------------------------------------------- containers */

describe('readInventory — bags, bank and keyring', () => {
  const collection = [
    'Location\tName\tID\tCount\tSlots',
    'Primary\tEarthshaker +10\t5667\t1\t10',
    'General 1\tSpacious Rucksack\t177751\t1\t24',
    'General 1-Slot20\tNightmare Hide +5\t2333\t1\t10',
    'Bank1-Slot3\tCrystalline Spear +2\t11610\t1\t10',
    'SharedBank1\tGolden Idol\t999\t1\t10',
    'Held\tEmpty\t0\t0\t0',
    '',
    'KeyRing\tName\tID\t',
    'Augmentation\tBladestopper (Exaltation)\t11632',
    'Activated\tGuise of the Deceiver +4\t2469',
    'Equipment\tMithril Breastplate\t4309',
  ].join('\r\n');

  const catalog = catalogOf([
    item('Earthshaker', 5667),
    item('Spacious Rucksack', 177751),
    item('Nightmare Hide', 2333),
    item('Crystalline Spear', 11610),
    item('Golden Idol', 999),
    item('Bladestopper', 11632),
    item('Guise of the Deceiver', 2469),
    item('Mithril Breastplate', 4309),
  ]);

  it('imports only the worn row', () => {
    const result = readInventory(collection, catalog);
    expect(result.positions.map((p) => p.itemName)).toEqual(['Earthshaker']);
    expect(Object.keys(toSlotMap(result))).toEqual(['PRIMARY']);
  });

  it('names every skipped row instead of losing it', () => {
    const result = readInventory(collection, catalog);
    expect(result.ignored.map((r) => r.rawName)).toEqual([
      'Spacious Rucksack',
      'Nightmare Hide +5',
      'Crystalline Spear +2',
      'Golden Idol',
      'Bladestopper (Exaltation)',
      'Guise of the Deceiver +4',
      'Mithril Breastplate',
    ]);
  });

  it('groups them by the place they live', () => {
    const groups = summarizeIgnored(readInventory(collection, catalog).ignored);
    expect(groups.map((g) => [g.key, g.rows])).toEqual([
      ['bag', 2],
      ['bank', 1],
      ['shared-bank', 1],
      ['keyring', 3],
    ]);
  });

  it('reads the keyring header rather than treating it as an item', () => {
    const result = readInventory(collection, catalog);
    expect(result.ignored.some((r) => r.rawName === 'Name')).toBe(false);
  });

  it('reads a nested bag sub-slot as bag contents rather than an unknown place', () => {
    const result = readInventory(
      sheet([
        ['General 6-Slot5', 'Ghoulbane +2', 5010],
        ['General 6-Slot5-Slot10', 'Ghoulbane (Exaltation)', 5010],
        ['Bank16-Slot1-Slot7', 'Diamond Rod (Exaltation)', 6011],
      ]),
      catalog,
    );
    expect(result.exaltations).toEqual([]);
    expect(result.ignored.map((r) => r.group)).toEqual(['bag', 'bag', 'bank']);
  });

  it('flags a location it has never heard of', () => {
    const result = readInventory(
      sheet([
        ['Primary', 'Earthshaker +10', 5667],
        ['Cursor', 'Mysterious Gem', 42],
      ]),
      catalog,
    );
    expect(result.ignored).toHaveLength(1);
    expect(result.ignored[0]?.group).toBe('unknown');
  });
});

/* ------------------------------------------------------------- exaltations */

describe('readInventory — exaltations', () => {
  const catalog = catalogOf([
    item('Cloak of Flames', 11621, ['BACK']),
    item('White Dragonscale Cloak', 11603, ['BACK']),
    item('Fishbone Earring', 10313, ['EAR']),
  ]);

  it('socketed the donor into the position printed above it', () => {
    const result = readInventory(
      sheet([
        ['Back', 'Cloak of Flames +7', 11621],
        ['Back-Slot7', 'White Dragonscale Cloak (Exaltation)', 11603],
      ]),
      catalog,
    );
    expect(result.exaltations).toHaveLength(1);
    expect(result.exaltations[0]).toMatchObject({
      positionId: 'BACK',
      kind: 'focus',
      donorName: 'White Dragonscale Cloak',
    });
    expect(toSlotMap(result).BACK?.exaltations).toEqual({ focus: 'White Dragonscale Cloak' });
  });

  it('maps every sub-slot the ladder knows', () => {
    const rows: Array<[string, string, number]> = [['Back', 'Cloak of Flames +7', 11621]];
    for (const slot of [2, 7, 8, 9, 10]) {
      rows.push([`Back-Slot${slot}`, 'White Dragonscale Cloak (Exaltation)', 11603]);
    }
    const result = readInventory(sheet(rows), catalog);
    expect(result.exaltations.map((e) => e.kind)).toEqual([
      'ornamentation', 'focus', 'click', 'worn', 'proc',
    ]);
  });

  it('accepts Slot1 for ornamentation, which the client sometimes emits instead', () => {
    const result = readInventory(
      sheet([
        ['Back', 'Cloak of Flames +7', 11621],
        ['Back-Slot1', 'White Dragonscale Cloak (Exaltation)', 11603],
      ]),
      catalog,
    );
    expect(result.exaltations[0]?.kind).toBe('ornamentation');
  });

  it('reports a sub-slot number that is not a socket', () => {
    const result = readInventory(
      sheet([
        ['Back', 'Cloak of Flames +7', 11621],
        ['Back-Slot4', 'White Dragonscale Cloak (Exaltation)', 11603],
      ]),
      catalog,
    );
    expect(result.exaltations).toEqual([]);
    expect(result.unmatched[0]?.reason).toContain('sub-slot 4');
  });

  it('reports a donor whose host item is not in the catalog', () => {
    const result = readInventory(
      sheet([
        ['Head', 'Shadow Rage Helm +5', 55601],
        ['Head-Slot7', 'White Dragonscale Cloak (Exaltation)', 11603],
      ]),
      catalog,
    );
    expect(result.exaltations).toEqual([]);
    expect(result.unmatched.map((u) => u.kind)).toEqual(['item', 'exaltation']);
    expect(result.unmatched[1]?.reason).toContain('Shadow Rage Helm');
  });

  it('reports a donor with no host row before it', () => {
    const result = readInventory(
      sheet([['Back-Slot7', 'White Dragonscale Cloak (Exaltation)', 11603]]),
      catalog,
    );
    expect(result.unmatched[0]?.reason).toContain('nothing to socket it into');
  });

  it('keeps two donors on the same position together', () => {
    const result = readInventory(
      sheet([
        ['Back', 'Cloak of Flames +7', 11621],
        ['Back-Slot7', 'White Dragonscale Cloak (Exaltation)', 11603],
        ['Back-Slot8', 'Fishbone Earring (Exaltation)', 10313],
      ]),
      catalog,
    );
    expect(exaltationsByPosition(result).get('BACK')).toHaveLength(2);
    expect(toSlotMap(result).BACK?.exaltations).toEqual({
      focus: 'White Dragonscale Cloak',
      click: 'Fishbone Earring',
    });
  });

  it('does not treat a bag sub-slot as an exaltation', () => {
    const result = readInventory(
      sheet([
        ['General 1', 'Spacious Rucksack', 177751],
        ['General 1-Slot7', 'Cloak of Flames +7', 11621],
      ]),
      catalog,
    );
    expect(result.exaltations).toEqual([]);
    expect(result.ignored).toHaveLength(2);
  });
});

/* ----------------------------------------------------------------- joining */

describe('readInventory — joining to the catalog', () => {
  it('joins on the numeric id even when the catalog spells the name differently', () => {
    const catalog = catalogOf([item('Djarns Amethyst Ring', 10366, ['FINGERS'])]);
    const result = readInventory(sheet([['Fingers', "Djarn's Amethyst Ring +4", 10366]]), catalog);
    expect(result.positions[0]).toMatchObject({
      itemName: 'Djarns Amethyst Ring',
      matchedBy: 'id',
      renamedFrom: "Djarn's Amethyst Ring",
    });
    expect(result.stats.renamed).toBe(1);
  });

  it('falls back to an exact name when the id is unknown', () => {
    const catalog = catalogOf([item('Cloak of Flames', null, ['BACK'])]);
    const result = readInventory(sheet([['Back', 'Cloak of Flames +7', 11621]]), catalog);
    expect(result.positions[0]).toMatchObject({ matchedBy: 'name', itemName: 'Cloak of Flames' });
  });

  it('matches a name case-insensitively, which is not the same as guessing', () => {
    const catalog = catalogOf([item('Cloak of Flames', null, ['BACK'])]);
    const result = readInventory(sheet([['Back', 'CLOAK OF FLAMES +7', 0]]), catalog);
    expect(result.positions[0]?.itemName).toBe('Cloak of Flames');
  });

  it('never fuzzy-matches a near miss into a plausible item', () => {
    const catalog = catalogOf([
      item('Shadow Rage Helm of Fury', 1, ['HEAD']),
      item('Shadow Rage Helmet', 2, ['HEAD']),
    ]);
    const result = readInventory(sheet([['Head', 'Shadow Rage Helm +5', 55601]]), catalog);
    expect(result.positions).toEqual([]);
    expect(result.unmatched[0]).toMatchObject({
      kind: 'item',
      positionId: 'HEAD',
      exportName: 'Shadow Rage Helm',
      tier: 5,
      exportId: 55601,
    });
  });

  it('says which join key was missing when nothing resolves', () => {
    const noId = readInventory(sheet([['Head', 'Shadow Rage Helm +5', 0]]), EMPTY_CATALOG);
    expect(noId.unmatched[0]?.reason).toContain('no item id');
    const withId = readInventory(sheet([['Head', 'Shadow Rage Helm +5', 55601]]), EMPTY_CATALOG);
    expect(withId.unmatched[0]?.reason).toContain('55601');
  });
});

/* ------------------------------------------ known items with no stat data */

/**
 * "We have never heard of this" and "we know exactly what this is and have no
 * numbers for it" are different failures with different remedies, and the
 * importer's job is to tell them apart rather than lump both under "missing".
 */
describe('readInventory — a known item with no stat data', () => {
  const unstatted = (n: string, id: number, slots: string[]): Item => ({
    ...item(n, id, slots),
    statsUnknown: true,
    evidence: 'Seen in a live client export; no wiki page carries its stats.',
  });

  const CATALOG = catalogOf([
    unstatted('Shadow Rage Helm', 55601, ['HEAD']),
    item('Darkbrood Mask', 1544, ['FACE']),
  ]);

  it('reports it separately from an item it has never heard of', () => {
    const result = readInventory(
      sheet([
        ['Head', 'Shadow Rage Helm +5', 55601],
        ['Face', 'Darkbrood Mask +4', 1544],
        ['Chest', 'Nonexistent Breastplate +2', 99999],
      ]),
      CATALOG,
    );

    expect(result.unstatted.map((u) => u.itemName)).toEqual(['Shadow Rage Helm']);
    expect(result.unmatched.map((u) => u.exportName)).toEqual(['Nonexistent Breastplate']);
    // The one that does have stats is imported exactly as before.
    expect(result.positions.map((p) => p.itemName)).toEqual(['Darkbrood Mask']);
  });

  it('records how it was found, and does not count it as an import', () => {
    const result = readInventory(sheet([['Head', 'Shadow Rage Helm +5', 55601]]), CATALOG);
    expect(result.unstatted[0]).toMatchObject({
      kind: 'item',
      positionId: 'HEAD',
      positionLabel: 'Head',
      itemName: 'Shadow Rage Helm',
      exportName: 'Shadow Rage Helm',
      rawName: 'Shadow Rage Helm +5',
      tier: 5,
      exportId: 55601,
      matchedBy: 'id',
    });
    expect(result.unstatted[0]?.evidence).toContain('no wiki page');
    expect(result.stats.unstattedRows).toBe(1);
    expect(result.stats.filledPositions).toBe(1);
    expect(result.stats.matchedPositions).toBe(0);
  });

  it('keeps it out of the set entirely, rather than equipping a zero', () => {
    const result = readInventory(sheet([['Head', 'Shadow Rage Helm +5', 55601]]), CATALOG);
    expect(result.positions).toEqual([]);
    expect(toSlotMap(result)).toEqual({});
  });

  it('holds back an exaltation donor with no stats for the same reason', () => {
    const catalog = catalogOf([
      item('Earthshaker', 5667, ['PRIMARY']),
      unstatted('Unrecorded Bauble', 424242, ['EAR']),
    ]);
    const result = readInventory(
      sheet([
        ['Primary', 'Earthshaker +10', 5667],
        ['Primary-Slot7', 'Unrecorded Bauble (Exaltation)', 424242],
      ]),
      catalog,
    );
    expect(result.exaltations).toEqual([]);
    expect(result.unstatted.map((u) => [u.kind, u.itemName])).toEqual([
      ['exaltation', 'Unrecorded Bauble'],
    ]);
    expect(result.unstatted[0]?.socketLabel).toContain('Focus');
    // The host is untouched — one unusable donor does not cost you the weapon.
    expect(result.positions.map((p) => p.itemName)).toEqual(['Earthshaker']);
  });

  it('blames the right gap when a donor sits on an unstatted host', () => {
    const catalog = catalogOf([
      unstatted('Shadow Rage Helm', 55601, ['HEAD']),
      item('Fishbone Earring', 10313, ['EAR']),
    ]);
    const result = readInventory(
      sheet([
        ['Head', 'Shadow Rage Helm +5', 55601],
        ['Head-Slot9', 'Fishbone Earring (Exaltation)', 10313],
      ]),
      catalog,
    );
    // Not "its host is not in the catalog" — it is, and saying otherwise would
    // send the reader hunting for the wrong problem.
    expect(result.unmatched[0]?.reason).toBe(
      'its host item, Shadow Rage Helm, has no stat data, so nothing was equipped there',
    );
  });

  it('says so in the summary, in different words from the unknown case', () => {
    const line = summarizeImport(
      readInventory(
        sheet([
          ['Head', 'Shadow Rage Helm +5', 55601],
          ['Chest', 'Nonexistent Breastplate +2', 99999],
        ]),
        CATALOG,
      ),
    );
    expect(line).toContain(
      'Shadow Rage Helm is a known item with no stats in any catalog, so it was left out rather than scored as a zero',
    );
    expect(line).toContain(
      'Nonexistent Breastplate is in no catalog this build has, so it was left out',
    );
  });
});

/* --------------------------------------------------------------- reporting */

describe('summarizeImport', () => {
  it('names what it could not match, because the toast has no list under it', () => {
    const result = readInventory(
      sheet([
        ['Head', 'Shadow Rage Helm +5', 55601],
        ['Hands', 'Shadow Rage Gloves +5', 55602],
      ]),
      EMPTY_CATALOG,
    );
    const line = summarizeImport(result);
    expect(line).toContain('Shadow Rage Helm, Shadow Rage Gloves');
    expect(line).toContain('are in no catalog this build has, so they were left out');
  });

  it('caps the naming rather than printing twenty items into a toast', () => {
    const places = ['Head', 'Face', 'Neck', 'Arms', 'Back', 'Chest', 'Legs', 'Feet'];
    const rows = places.map((place, i): [string, string, number] => [
      place,
      `Ghost ${i}`,
      900 + i,
    ]);
    const line = summarizeImport(readInventory(sheet(rows), EMPTY_CATALOG));
    expect(line).toContain('Ghost 0, Ghost 1, Ghost 2 and 5 more');
  });
});

describe('importedSetName', () => {
  it('names the first import plainly', () => {
    expect(importedSetName([])).toBe('In-game gear');
    expect(importedSetName(['Main Set', 'Raid'])).toBe('In-game gear');
  });

  it('never collides with a set that is already there', () => {
    expect(importedSetName(['In-game gear'])).toBe('In-game gear 2');
    expect(importedSetName(['in-game GEAR', 'In-game gear 2'])).toBe('In-game gear 3');
  });
});

/* ---------------------------------------------------------------- totality */

describe('readInventory — never throws, whatever it is fed', () => {
  const junk: unknown[] = [
    '',
    '   ',
    '\n\n\n',
    'not an inventory at all',
    '\u0000\u0001\u0002binary�',
    'Location\tName\tID\tCount\tSlots',
    'Ear',
    '\t\t\t\t',
    'Ear\t\t\t\t',
    '-Slot7\tThing\t1\t1\t1',
    'Ear-SlotNaN\tThing\t1\t1\t1',
    'Ear-Slot99999999999999999999\tThing\t1\t1\t1',
    null,
    undefined,
    42,
    { toString: () => 'Primary\tEarthshaker +10\t5667\t1\t10' },
    [],
  ];

  for (const [index, input] of junk.entries()) {
    it(`survives input ${index}`, () => {
      const result = readInventory(input, EMPTY_CATALOG);
      expect(Array.isArray(result.positions)).toBe(true);
      expect(Array.isArray(result.unmatched)).toBe(true);
      expect(Array.isArray(result.ignored)).toBe(true);
      expect(typeof summarizeImport(result)).toBe('string');
      expect(summarizeImport(result)).not.toContain('undefined');
    });
  }

  it('says plainly when the text is not an inventory export', () => {
    const result = readInventory('hello, world', EMPTY_CATALOG);
    expect(result.recognized).toBe(false);
    expect(result.positions).toEqual([]);
    expect(summarizeImport(result)).toContain('/outputfile inventory');
  });

  it('reads LF as happily as the CRLF the client writes', () => {
    const catalog = catalogOf([item('Earthshaker', 5667)]);
    const crlf = readInventory('Location\tName\tID\r\nPrimary\tEarthshaker +10\t5667\r\n', catalog);
    const lf = readInventory('Location\tName\tID\nPrimary\tEarthshaker +10\t5667\n', catalog);
    expect(crlf.positions).toEqual(lf.positions);
    expect(lf.positions[0]?.tier).toBe(10);
  });

  it('tolerates a leading byte-order mark', () => {
    const catalog = catalogOf([item('Earthshaker', 5667)]);
    const result = readInventory('﻿Location\tName\tID\nPrimary\tEarthshaker +10\t5667\n', catalog);
    expect(result.positions).toHaveLength(1);
  });

  it('stops reading, and says so, well before a huge paste can lock the tab', () => {
    const flood = ['Location\tName\tID', ...Array.from({ length: MAX_ROWS + 500 }, () => 'Bank1\tRock\t1')].join('\n');
    const result = readInventory(flood, EMPTY_CATALOG);
    expect(result.notes.join(' ')).toContain('only the first');
    expect(result.stats.rows).toBeLessThanOrEqual(MAX_ROWS);
  });
});

/* ------------------------------------------------------ the real client file */

const INVENTORY = '../research/validation/tier0-inventory-Avenrae.txt';
const INDEX = 'public/data/items-index.json';
const available = existsSync(INVENTORY) && existsSync(INDEX);

describe.skipIf(!available)('the real Avenrae export', () => {
  const text = readFileSync(INVENTORY, 'utf8');
  const items: Item[] = normalizeCatalog(JSON.parse(readFileSync(INDEX, 'utf8')));
  const catalog = catalogOf(items);
  const result = readInventory(text, catalog);

  it('recognises it as a client export', () => {
    expect(result.recognized).toBe(true);
    expect(result.notes).toEqual([]);
  });

  /*
   * 22 of 22, as of 2 September 2026 — and it was 21 of 22 for a fortnight.
   *
   * The gap was `Shadow Rage Helm`, the one worn item in the owner's own
   * inventory that no wiki carried and that therefore had no stats to score. Its
   * +0 block was recovered that day by inverting a client capture at +5, so the
   * whole loadout is now scorable and the "known but unstatted" branch has no
   * example left in this export.
   *
   * That branch is not dead and must not be deleted: `Shadow Rage Gloves` and
   * `Shadow Rage Boots` are still stat-less, they are simply not worn in this
   * capture. The unit tests above this block exercise the branch on fixtures,
   * which is where it belongs — a behaviour that depends on one row of one real
   * file happening to stay broken is not a tested behaviour.
   */
  it('finds 22 filled worn positions and imports all 22', () => {
    expect(result.stats.filledPositions).toBe(22);
    expect(result.stats.matchedPositions).toBe(22);
    expect(result.positions).toHaveLength(22);
  });

  it('has nothing left it cannot name at all', () => {
    expect(result.unmatched).toEqual([]);
  });

  it('no longer holds back Shadow Rage Helm, and equips it on the head', () => {
    expect(result.unstatted).toEqual([]);
    expect(result.stats.unstattedRows).toBe(0);

    const head = result.positions.find((p) => p.positionId === 'HEAD');
    expect(head).toMatchObject({
      itemName: 'Shadow Rage Helm',
      exportName: 'Shadow Rage Helm',
      exportId: 55601,
      matchedBy: 'id',
      tier: 5,
    });
    expect(toSlotMap(result).HEAD).toBeDefined();
  });

  it('scores the head with the block derived from the +5 capture', () => {
    // The numbers themselves, so this test fails if the derivation is ever
    // quietly re-typed. +0 base; the export wears it at +5.
    const head = items.find((i) => i.n === 'Shadow Rage Helm');
    expect(head?.st).toMatchObject({ AC: 14, STR: 7, AGI: 5 });
    expect(head?.sv).toMatchObject({ DISEASE: 12 });
    expect(head?.statsUnknown).toBeFalsy();
    expect(head?.sd).toBe('tier-M');
    expect(head?.sdc ?? '').toContain('DERIVED');
  });

  it('carries every exported tier through', () => {
    const tiers = Object.fromEntries(result.positions.map((p) => [p.positionId, p.tier]));
    expect(tiers).toMatchObject({
      PRIMARY: 10, BACK: 7, WRIST_2: 7, ANY_1: 6, ANY_2: 6, CHEST: 6, LEGS: 6,
      FINGERS_2: 6, RANGE: 6, AMMO: 5, FEET: 5, NECK: 5, EAR_1: 4, EAR_2: 4,
      FACE: 4, SHOULDERS: 4, ARMS: 4, WRIST_1: 4, HANDS: 4, FINGERS_1: 4, WAIST: 4,
    });
  });

  it('reads the second Any Slot and the second of each doubled position', () => {
    const byId = Object.fromEntries(result.positions.map((p) => [p.positionId, p.itemName]));
    expect(byId.ANY_1).toBe('Nautilus Shield');
    expect(byId.ANY_2).toBe('Bladestopper');
    expect(byId.WRIST_1).toBe("Hotof's Bracer");
    expect(byId.WRIST_2).toBe('Indicolite Bracer');
    expect(byId.FINGERS_2).toBe("Hamed's Ring of Tears");
  });

  it('finds the one empty worn position', () => {
    expect(result.empty).toEqual(['SECONDARY']);
  });

  it('recovers all twelve exaltation donors', () => {
    expect(result.stats.matchedExaltations).toBe(12);
    expect(result.stats.donorRows).toBe(12);
    const focusOnBack = result.exaltations.find(
      (e) => e.positionId === 'BACK' && e.kind === 'focus',
    );
    expect(focusOnBack?.donorName).toBe('White Dragonscale Cloak');
    expect(exaltationsByPosition(result).get('ANY_2')?.map((e) => e.kind)).toEqual([
      'focus',
      'click',
    ]);
  });

  it('reports the two names the catalog spells differently', () => {
    expect(result.stats.renamed).toBe(2);
    const drifted = [
      ...result.positions.filter((p) => p.renamedFrom),
      ...result.exaltations.filter((e) => e.renamedFrom),
    ];
    expect(drifted.map((d) => d.renamedFrom)).toEqual([
      "Djarn's Amethyst Ring",
      "Djarn's Amethyst Ring",
    ]);
  });

  it('skips the bags, the bank and the keyring, and counts them', () => {
    expect(result.ignored).toHaveLength(412);
    expect(summarizeIgnored(result.ignored).map((g) => [g.key, g.rows])).toEqual([
      ['bag', 85],
      ['bank', 167],
      ['keyring', 160],
    ]);
    // Nothing in this file is a location the reader would have to puzzle over.
    expect(result.ignored.filter((r) => r.group === 'unknown')).toEqual([]);
  });

  it('reads a socket nested inside a bag as bag contents, not as gear', () => {
    // `General 6-Slot5-Slot10` is a proc exaltation inside a sword inside bag
    // six. Two levels of nesting, and none of it worn.
    const nested = result.ignored.filter((r) => /-Slot\d+-Slot\d+$/.test(r.location));
    expect(nested.length).toBe(36);
    expect(new Set(nested.map((r) => r.group))).toEqual(new Set(['bag', 'bank']));
  });

  it('puts no ignored row into a worn position', () => {
    // The honest invariant is about rows, not names: `Earthshaker` is both worn
    // and stocked as a spare donor, so comparing names alone would false-alarm.
    const skipped = new Set(result.ignored.map((r) => r.line));
    for (const line of [...result.positions, ...result.exaltations].map((e) => e.line)) {
      expect(skipped.has(line)).toBe(false);
    }
    const worn = new Set(Object.values(toSlotMap(result)).map((e) => e.itemName));
    for (const name of ['Spacious Rucksack', 'Nightmare Hide', 'Mithril Breastplate', 'Bone Chips']) {
      expect(worn.has(name)).toBe(false);
    }
  });

  it('produces a slot map of 22 filled positions with their donors attached', () => {
    const slots = toSlotMap(result);
    expect(Object.keys(slots)).toHaveLength(22);
    expect(slots.PRIMARY).toEqual({ itemName: 'Earthshaker', upgrade: { full: 10, fraction: 0 } });
    expect(slots.ANY_2?.exaltations).toEqual({
      focus: 'Lute of the Gypsy Princess',
      click: 'Bladestopper',
    });
  });

  it('orders the preview by the paper doll, not by the export', () => {
    const order = positionsInDollOrder(result).map((p) => p.positionId);
    expect(order[0]).toBe('EAR_1');
    expect(order[order.length - 1]).toBe('ANY_2');
  });

  it('summarises honestly, and no longer reports a gap it does not have', () => {
    const line = summarizeImport(result);
    expect(line).toContain('22 of 22');
    expect(line).toContain('12 exaltation donors');
    expect(line).toContain('412 bag, bank and keyring rows');
    // The sentence that named the Helm as unscorable must be gone, not merely
    // unasserted — leaving it would tell the owner their own head slot was
    // dropped, on an import that equipped it.
    expect(line).not.toContain('Shadow Rage Helm');
    expect(line).not.toContain('left out rather than scored as a zero');
  });
});
