import { describe, expect, it } from 'vitest';
import { SLOT_POSITIONS } from '../engine/constants';
import type { EquippedItem, GearSet } from '../engine/types';
import { buildCharacter, makeLevels, type Character } from '../engine/character';
import { base64UrlToBytes, bytesToBase64Url, decodeText, encodeText } from '../lib/base64url';
import { buildDictionary } from './dictionary';
import {
  decodePlan,
  decodePlanDetailed,
  encodePlan,
  encodePlanV1,
  fromTupleV1,
  isExportEnvelope,
  planCharacter,
  planFrom,
  shareHash,
  toTupleV1,
  type SharedPlan,
} from './codec';

function plan(overrides: Partial<SharedPlan> = {}): SharedPlan {
  return {
    character: planCharacter({
      name: 'Avenrae',
      classes: ['BRD', 'WAR', 'BER'],
      level: 50,
      race: 'HUM',
    }),
    set: {
      name: 'Raid Set',
      slots: {
        PRIMARY: { itemName: 'Earthshaker', upgrade: { full: 10, fraction: 0 } },
        EAR_1: { itemName: "Bauble of Thassis' Regard", upgrade: { full: 3, fraction: 5 } },
      },
      weights: { AC: 2, STR: 1.5, SV_VOID: -0.25 },
    },
    ...overrides,
  };
}

/** A 23-slot set, the worst case a link has to carry. */
function fullPlan(): SharedPlan {
  const slots: Record<string, EquippedItem> = {};
  SLOT_POSITIONS.forEach((position, index) => {
    slots[position.id] = {
      itemName: `Item ${index} — ${position.label}`,
      upgrade: { full: index % 11, fraction: 0 },
      ...(index % 4 === 0 ? { exaltations: { focus: `Donor ${index}`, proc: 'Flamestrike' } } : {}),
    };
  });
  return plan({ set: { name: 'Everything', slots, weights: { HP: 0.1 }, notes: 'Line one\nLine two' } });
}

describe('base64url', () => {
  it('round-trips arbitrary bytes at every length modulo 3', () => {
    for (let length = 0; length < 40; length++) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = (i * 37 + length) % 256;
      const decoded = base64UrlToBytes(bytesToBase64Url(bytes));
      expect([...decoded]).toEqual([...bytes]);
    }
  });

  it('produces URL-safe output only', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect(bytesToBase64Url(bytes)).toMatch(/^[A-Za-z0-9\-_]*$/);
  });

  it('round-trips text outside the Latin alphabet', () => {
    for (const text of ['', 'Sword of Ykesha', "Cazic's ✦ Charm", '深淵の剣', 'ÆØÅ é ü ñ']) {
      expect(decodeText(encodeText(text))).toBe(text);
    }
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base64UrlToBytes('abc$def')).toThrow();
  });
});

describe('share codec v2', () => {
  it('round-trips a plan losslessly', () => {
    const original = plan();
    expect(decodePlan(encodePlan(original))).toEqual(original);
  });

  it('round-trips all 23 positions, exaltations and notes', () => {
    const original = fullPlan();
    const decoded = decodePlan(encodePlan(original));
    expect(decoded).toEqual(original);
    expect(Object.keys(decoded?.set.slots ?? {})).toHaveLength(23);
  });

  it('carries per-class levels and every loadout, with the active one marked', () => {
    const character: Omit<Character, 'id'> = {
      name: 'Avenrae',
      race: 'HFL',
      levels: makeLevels({ BRD: 50, WAR: 50, BER: 50, MNK: 36, DRU: 36, SHD: 36, PAL: 21, MAG: 11 }),
      loadouts: [
        { id: 'l0', name: 'Songs', classes: ['BRD', 'SHD', 'DRU'] },
        { id: 'l1', name: 'Plate', classes: ['WAR', 'PAL', 'BER'], race: 'OGR' },
        { id: 'l2', name: 'Raid', classes: ['BRD', 'WAR', 'BER'] },
      ],
      activeLoadoutId: 'l2',
    };
    const decoded = decodePlan(encodePlan(plan({ character })));
    expect(decoded?.character).toEqual(character);
    expect(decoded?.character.levels.MNK).toBe(36);
    expect(decoded?.character.levels.WIZ).toBe(1);
    expect(decoded?.character.loadouts[1]?.race).toBe('OGR');
    expect(decoded?.character.activeLoadoutId).toBe('l2');
  });

  it('preserves fractional and negative weights exactly', () => {
    const original = plan({
      set: { name: 'Weights', slots: {}, weights: { AC: 0.125, STR: -3.75, RATIO: 41.5 } },
    });
    expect(decodePlan(encodePlan(original))?.set.weights).toEqual({
      AC: 0.125,
      STR: -3.75,
      RATIO: 41.5,
    });
  });

  it('carries a weight the fixed scale cannot hold, rather than rounding it', () => {
    const original = plan({ set: { name: 'Odd', slots: {}, weights: { AC: 0.0001234 } } });
    expect(decodePlan(encodePlan(original))?.set.weights).toEqual({ AC: 0.0001234 });
  });

  it('recognises a preset profile and still returns it verbatim', () => {
    const balanced = {
      AC: 1, HP: 0.2, MANA: 0.2, STR: 0.5, STA: 0.5, AGI: 0.5,
      DEX: 0.5, WIS: 0.5, INT: 0.5, CHA: 0.2, RATIO: 20,
    };
    const original = plan({ set: { name: 'Preset', slots: {}, weights: balanced } });
    const encoded = encodePlan(original);
    expect(decodePlan(encoded)?.set.weights).toEqual(balanced);
    // Eleven weights collapse to two bytes, so the whole link stays tiny.
    expect(encoded.length).toBeLessThan(120);
  });

  it('keeps item names with apostrophes, unicode and spacing intact', () => {
    const name = "Priest's ✦ Robe of the Ægis — 深淵";
    const original = plan({
      set: {
        name: 'Odd names',
        slots: { CHEST: { itemName: name, upgrade: { full: 4, fraction: 3 } } },
        weights: {},
      },
    });
    expect(decodePlan(encodePlan(original))?.set.slots.CHEST?.itemName).toBe(name);
  });

  it('drops zero weights, which are indistinguishable from unset', () => {
    const original = plan({ set: { name: 'x', slots: {}, weights: { AC: 0, STR: 2 } } });
    expect(decodePlan(encodePlan(original))?.set.weights).toEqual({ STR: 2 });
  });

  it('normalises out-of-range upgrade state', () => {
    const original = plan({
      set: {
        name: 'x',
        slots: { HEAD: { itemName: 'Helm', upgrade: { full: 99, fraction: 999 } } },
        weights: {},
      },
    });
    expect(decodePlan(encodePlan(original))?.set.slots.HEAD?.upgrade).toEqual({
      full: 10,
      fraction: 0,
    });
  });

  it('returns null for damaged payloads instead of throwing', () => {
    for (const bad of ['', 'not-base64!!', encodeText('{"nope":true}'), encodeText('[]'), 'AAAA']) {
      expect(decodePlan(bad)).toBeNull();
    }
  });

  it('survives a link that lost its trailing characters without crashing', () => {
    const full = encodePlan(fullPlan());
    for (let cut = 1; cut < 40; cut++) {
      expect(() => decodePlan(full.slice(0, full.length - cut))).not.toThrow();
    }
  });

  it('builds a hash that starts a share route', () => {
    expect(shareHash(plan())).toMatch(/^#\/share\/[A-Za-z0-9\-_]+$/);
  });

  it('builds a plan from live character and set objects', () => {
    const character = buildCharacter({
      id: 'c1', name: 'Tunare', classes: ['DRU'], level: 42, loadoutId: 'x',
    });
    const gearSet: GearSet = {
      id: 's1',
      characterId: 'c1',
      name: 'Solo',
      slots: { HEAD: { itemName: 'Silk Cowl', upgrade: { full: 1, fraction: 0 } } },
      weights: { WIS: 1 },
      createdAt: 1,
      updatedAt: 2,
      notes: 'hi',
    };
    const built = planFrom(character, gearSet);
    expect(built.character.levels.DRU).toBe(42);
    expect(built.character.loadouts[0]?.classes).toEqual(['DRU']);
    expect(built.set.notes).toBe('hi');
    expect(decodePlan(encodePlan(built))).toEqual(built);
  });
});

describe('share codec compression', () => {
  const dict = buildDictionary([
    'Earthshaker',
    "Bauble of Thassis' Regard",
    ...SLOT_POSITIONS.map((p, i) => `Item ${i} — ${p.label}`),
    ...SLOT_POSITIONS.map((_, i) => `Donor ${i}`),
    'Flamestrike',
  ]);

  it('is far shorter than the v1 link it replaces, with and without a dictionary', () => {
    const full = fullPlan();
    const v1 = encodePlanV1(full).length;
    const literal = encodePlan(full).length;
    const interned = encodePlan(full, dict).length;

    expect(v1).toBeGreaterThan(1200); // the 1,348-character status quo
    expect(literal).toBeLessThan(v1 * 0.8);
    expect(interned).toBeLessThan(300);
    expect(interned).toBeLessThan(literal / 3);
  });

  it('round-trips losslessly through the dictionary', () => {
    const full = fullPlan();
    expect(decodePlan(encodePlan(full, dict), dict)).toEqual(full);
  });

  it('falls back to a literal name for an item the dictionary does not know', () => {
    const original = plan({
      set: {
        name: 'Mixed',
        slots: {
          PRIMARY: { itemName: 'Earthshaker', upgrade: { full: 0, fraction: 0 } },
          HEAD: { itemName: 'Hand-typed Helm', upgrade: { full: 0, fraction: 0 } },
        },
        weights: {},
      },
    });
    expect(decodePlan(encodePlan(original, dict), dict)).toEqual(original);
  });

  it('refuses an interned link from a different catalog build rather than mistranslating', () => {
    const other = buildDictionary(['Earthshaker', 'Something Else Entirely']);
    const payload = encodePlan(fullPlan(), dict);
    const result = decodePlanDetailed(payload, other);
    expect(result.plan).toBeNull();
    expect(result.failure).toBe('catalog-mismatch');
    // And with no dictionary at all, likewise — never a half-decoded set.
    expect(decodePlan(payload)).toBeNull();
  });

  it('decodes a literal link with no dictionary in hand at all', () => {
    const full = fullPlan();
    expect(decodePlan(encodePlan(full))).toEqual(full);
  });
});

describe('share codec v1 compatibility', () => {
  it('still decodes a v1 link, mapping its single level onto its trio', () => {
    const decoded = fromTupleV1([
      1, 'Avenrae', 50, 'HUM', 'BRD/WAR/BER', 'Raid Set',
      [['PRIMARY', 'Earthshaker', 10, 0]], [['AC', 2]], 'notes here',
    ]);
    expect(decoded?.character.levels.BRD).toBe(50);
    expect(decoded?.character.levels.WAR).toBe(50);
    expect(decoded?.character.levels.WIZ).toBe(1);
    expect(decoded?.character.loadouts).toHaveLength(1);
    expect(decoded?.character.loadouts[0]?.classes).toEqual(['BRD', 'WAR', 'BER']);
    expect(decoded?.set.slots.PRIMARY?.itemName).toBe('Earthshaker');
    expect(decoded?.set.notes).toBe('notes here');
  });

  it('decodes a whole v1 payload through the public entry point', () => {
    const original = plan();
    const decoded = decodePlan(encodePlanV1(original));
    expect(decoded?.set.slots).toEqual(original.set.slots);
    expect(decoded?.set.weights).toEqual(original.set.weights);
    expect(decoded?.character.name).toBe('Avenrae');
    expect(decoded?.character.loadouts[0]?.classes).toEqual(['BRD', 'WAR', 'BER']);
  });

  it('drops zero weights from a v1 tuple, which are indistinguishable from unset', () => {
    const tuple = toTupleV1(plan({ set: { name: 'x', slots: {}, weights: { AC: 0, STR: 2 } } }));
    expect(tuple[7]).toEqual([['STR', 2]]);
  });

  it('ignores unknown slot positions rather than trusting the URL', () => {
    expect(fromTupleV1([1, 'A', 50, null, 'WAR', 'S', [['NOSE', 'Ring', 0, 0]], [], ''])?.set.slots)
      .toEqual({});
  });

  it('rejects a payload from a future version', () => {
    expect(fromTupleV1([99, 'A', 50, null, 'WAR', 'S', [], [], ''])).toBeNull();
    expect(decodePlanDetailed(bytesToBase64Url(new Uint8Array([9, 0, 0]))).failure).toBe(
      'unsupported-version',
    );
  });
});

describe('export envelope', () => {
  it('recognises its own shape and nothing else', () => {
    expect(
      isExportEnvelope({ format: 'eql-upgrades', version: 1, characters: [], sets: [] }),
    ).toBe(true);
    expect(isExportEnvelope({ format: 'other', characters: [], sets: [] })).toBe(false);
    expect(isExportEnvelope(null)).toBe(false);
    expect(isExportEnvelope('{}')).toBe(false);
  });
});
