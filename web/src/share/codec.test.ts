import { describe, expect, it } from 'vitest';
import { SLOT_POSITIONS } from '../engine/constants';
import type { EquippedItem, GearSet } from '../engine/types';
import type { Character } from '../engine/character';
import { base64UrlToBytes, bytesToBase64Url, decodeText, encodeText } from '../lib/base64url';
import {
  decodePlan,
  encodePlan,
  fromTuple,
  isExportEnvelope,
  planFrom,
  shareHash,
  toTuple,
  type SharedPlan,
} from './codec';

function plan(overrides: Partial<SharedPlan> = {}): SharedPlan {
  return {
    character: { name: 'Avenrae', level: 50, race: 'HUM', classes: ['BRD', 'WAR', 'BER'] },
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

describe('share codec', () => {
  it('round-trips a plan losslessly', () => {
    const original = plan();
    const decoded = decodePlan(encodePlan(original));
    expect(decoded).toEqual(original);
  });

  it('round-trips all 23 positions, exaltations and notes', () => {
    const slots: Record<string, EquippedItem> = {};
    SLOT_POSITIONS.forEach((position, index) => {
      slots[position.id] = {
        itemName: `Item ${index} — ${position.label}`,
        upgrade: { full: index % 11, fraction: 0 },
        ...(index % 4 === 0 ? { exaltations: { focus: `Donor ${index}`, proc: 'Flamestrike' } } : {}),
      };
    });
    const original = plan({
      set: { name: 'Everything', slots, weights: { HP: 0.1 }, notes: 'Line one\nLine two' },
    });
    const decoded = decodePlan(encodePlan(original));
    expect(decoded).toEqual(original);
    expect(Object.keys(decoded?.set.slots ?? {})).toHaveLength(23);
  });

  it('preserves fractional and negative weights exactly', () => {
    const original = plan({
      set: { name: 'Weights', slots: {}, weights: { AC: 0.125, STR: -3.75, RATIO: 41.5 } },
    });
    const decoded = decodePlan(encodePlan(original));
    expect(decoded?.set.weights).toEqual({ AC: 0.125, STR: -3.75, RATIO: 41.5 });
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
    const tuple = toTuple(plan({ set: { name: 'x', slots: {}, weights: { AC: 0, STR: 2 } } }));
    expect(tuple[7]).toEqual([['STR', 2]]);
  });

  it('normalises out-of-range upgrade state', () => {
    const decoded = fromTuple([1, 'A', 50, null, 'WAR', 'S', [['HEAD', 'Helm', 99, 999]], [], '']);
    expect(decoded?.set.slots.HEAD?.upgrade).toEqual({ full: 10, fraction: 0 });
  });

  it('ignores unknown slot positions rather than trusting the URL', () => {
    const decoded = fromTuple([1, 'A', 50, null, 'WAR', 'S', [['NOSE', 'Ring', 0, 0]], [], '']);
    expect(decoded?.set.slots).toEqual({});
  });

  it('returns null for damaged payloads instead of throwing', () => {
    for (const bad of ['', 'not-base64!!', encodeText('{"nope":true}'), encodeText('[]'), 'AAAA']) {
      expect(decodePlan(bad)).toBeNull();
    }
  });

  it('rejects a payload from a future version', () => {
    expect(fromTuple([99, 'A', 50, null, 'WAR', 'S', [], [], ''])).toBeNull();
  });

  it('survives a link that lost its trailing characters without crashing', () => {
    const full = encodePlan(plan());
    for (let cut = 1; cut < 12; cut++) {
      expect(() => decodePlan(full.slice(0, full.length - cut))).not.toThrow();
    }
  });

  it('builds a hash that starts a share route', () => {
    expect(shareHash(plan())).toMatch(/^#\/share\/[A-Za-z0-9\-_]+$/);
  });

  it('builds a plan from live character and set objects', () => {
    const character: Character = {
      id: 'c1',
      name: 'Tunare',
      level: 42,
      classes: ['DRU'],
      race: null,
    };
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
    expect(built.character).toEqual({ name: 'Tunare', level: 42, race: null, classes: ['DRU'] });
    expect(built.set.notes).toBe('hi');
    expect(decodePlan(encodePlan(built))).toEqual(built);
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
