import { describe, expect, it } from 'vitest';
import { buildCharacter, loadoutClasses, type Character } from '../engine/character';
import type { GearSet } from '../engine/types';
import {
  STORAGE_KEY,
  clearState,
  emptyState,
  loadState,
  memoryStorage,
  sanitizeState,
  saveState,
  type PersistedState,
  type StorageLike,
} from './persistence';

function sampleState(): PersistedState {
  const character: Character = buildCharacter({
    id: 'char_1',
    name: 'Avenrae',
    classes: ['BRD', 'WAR', 'BER'],
    level: 50,
    race: 'HUM',
    loadoutId: 'char_1_loadout_1',
  });
  const gearSet: GearSet = {
    id: 'set_1',
    characterId: 'char_1',
    name: 'Main Set',
    slots: {
      PRIMARY: { itemName: 'Earthshaker', upgrade: { full: 6, fraction: 3 } },
      EAR_1: { itemName: 'Loop', upgrade: { full: 0, fraction: 0 }, exaltations: { focus: 'X' } },
    },
    weights: { AC: 2, STR: 1 },
    createdAt: 10,
    updatedAt: 20,
  };
  return { version: 2, characters: [character], sets: [gearSet], activeCharacterId: 'char_1' };
}

function throwingStorage(error: Error): StorageLike {
  return {
    getItem: () => {
      throw error;
    },
    setItem: () => {
      throw error;
    },
    removeItem: () => undefined,
  };
}

describe('persistence', () => {
  it('round-trips a state through storage', () => {
    const storage = memoryStorage();
    expect(saveState(sampleState(), storage)).toBe('ok');
    const result = loadState(storage);
    expect(result.status).toBe('ok');
    expect(result.state).toEqual(sampleState());
  });

  it('reports an empty store without inventing data', () => {
    const result = loadState(memoryStorage());
    expect(result.status).toBe('empty');
    expect(result.state).toEqual(emptyState());
  });

  it('treats unreadable JSON as corrupt, quarantines it, and starts clean', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{"characters":[');
    const result = loadState(storage);
    expect(result.status).toBe('corrupt');
    expect(result.state.characters).toEqual([]);
    expect(storage.getItem(`${STORAGE_KEY}.corrupt`)).toBe('{"characters":[');
  });

  it('treats structurally wrong JSON as corrupt', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '[1,2,3]');
    expect(loadState(storage).status).toBe('corrupt');
  });

  it('reports quota failures rather than throwing', () => {
    const error = new Error('exceeded');
    error.name = 'QuotaExceededError';
    expect(saveState(sampleState(), throwingStorage(error))).toBe('quota');
  });

  it('reports other write failures distinctly', () => {
    expect(saveState(sampleState(), throwingStorage(new Error('nope')))).toBe('error');
  });

  it('reports unavailable storage', () => {
    expect(saveState(sampleState(), null)).toBe('unavailable');
    expect(loadState(null).status).toBe('unavailable');
  });

  it('survives a read that throws', () => {
    expect(loadState(throwingStorage(new Error('blocked'))).status).toBe('unavailable');
  });

  it('clears without throwing when storage is missing', () => {
    expect(() => clearState(null)).not.toThrow();
  });
});

describe('sanitizeState', () => {
  it('drops malformed characters and sets rather than failing whole', () => {
    const clean = sanitizeState({
      characters: [
        { id: 'a', name: 'Keeps', level: 50, classes: ['WAR', 'NOPE', 'BRD'], race: 'HUM' },
        { name: 'no id' },
        null,
      ],
      sets: [
        { id: 's1', characterId: 'a', name: 'Good', slots: {}, weights: {} },
        { id: 's2', characterId: 'ghost', name: 'Orphan', slots: {}, weights: {} },
        'junk',
      ],
      activeCharacterId: 'ghost',
    });
    expect(clean?.characters).toHaveLength(1);
    expect(loadoutClasses(clean?.characters[0] as Character)).toEqual(['WAR', 'BRD']);
    expect(clean?.sets.map((s) => s.id)).toEqual(['s1']);
    expect(clean?.activeCharacterId).toBeNull();
  });

  it('repairs impossible values inside a set', () => {
    const clean = sanitizeState({
      characters: [{ id: 'a', name: '', level: 9999, classes: [], race: 5 }],
      sets: [
        {
          id: 's1',
          characterId: 'a',
          name: '   ',
          slots: {
            HEAD: { itemName: 'Helm', upgrade: { full: 42, fraction: -7 } },
            FACE: { itemName: '', upgrade: {} },
            BACK: 'nonsense',
          },
          weights: { AC: 'two', STR: 3 },
        },
      ],
      activeCharacterId: 'a',
    });
    const set = clean?.sets[0];
    expect(clean?.characters[0]?.name).toBe('Unnamed');
    expect(clean?.characters[0]?.levels.WAR).toBe(1);
    expect(clean?.characters[0]?.race).toBeNull();
    expect(set?.name).toBe('Untitled Set');
    expect(set?.slots.HEAD?.upgrade).toEqual({ full: 10, fraction: 0 });
    expect(set?.slots.FACE).toBeUndefined();
    expect(set?.slots.BACK).toBeUndefined();
    expect(set?.weights).toEqual({ STR: 3 });
  });

  it('rejects payloads that are not a state at all', () => {
    expect(sanitizeState(null)).toBeNull();
    expect(sanitizeState({ characters: {} })).toBeNull();
  });

  /*
   * A payload from a newer build is set aside, not migrated. Running it through
   * this version's sanitiser would drop every field this build does not know
   * about, and the next save would write the reduced shape back — silently
   * destroying a newer build's data for anyone who opened a stale tab.
   */
  it('sets aside a payload written by a newer version instead of downgrading it', () => {
    const storage = memoryStorage();
    const future = JSON.stringify({ ...sampleState(), version: 99, somethingNew: 'keep me' });
    storage.setItem(STORAGE_KEY, future);

    const result = loadState(storage);
    expect(result.status).toBe('future');
    expect(result.state.characters).toHaveLength(0);

    // The original payload survives somewhere recoverable, untouched.
    expect(storage.getItem(`${STORAGE_KEY}.future`)).toBe(future);
  });

  it('still migrates a payload written by an older version', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...sampleState(), version: 1 }));
    const result = loadState(storage);
    expect(result.status).toBe('ok');
    expect(result.state.version).toBe(2);
    expect(result.state.characters).toHaveLength(1);
  });
});
