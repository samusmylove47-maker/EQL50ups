/**
 * The v1 -> v2 migration.
 *
 * Anyone who used the planner before the model rework has a v1 library in
 * localStorage: a character with one `level` and one `classes` array. Losing
 * it would be the single most expensive bug this change could ship, so every
 * shape that could plausibly be in a browser right now is pinned here — the
 * good case, the half-broken case, and the already-migrated case.
 */

import { describe, expect, it } from 'vitest';
import {
  activeContext, canUse, describeCharacter, loadoutClasses, makeLevels, primaryLevel,
  type Character,
} from '../engine/character';
import {
  STATE_VERSION, STORAGE_KEY, loadState, memoryStorage, migrateCharacterV1, sanitizeState,
  saveState,
} from './persistence';

/** Exactly what version 1 wrote to localStorage. */
function v1Payload() {
  return {
    version: 1,
    characters: [
      { id: 'char_1', name: 'Avenrae', level: 50, classes: ['BRD', 'WAR', 'BER'], race: 'HFL' },
      { id: 'char_2', name: 'Alt', level: 12, classes: ['WIZ'], race: null },
    ],
    sets: [
      {
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
        notes: 'keep me',
      },
    ],
    activeCharacterId: 'char_1',
  };
}

describe('v1 -> v2 character migration', () => {
  it('keeps every character and every set', () => {
    const clean = sanitizeState(v1Payload());
    expect(clean?.version).toBe(STATE_VERSION);
    expect(clean?.characters).toHaveLength(2);
    expect(clean?.sets).toHaveLength(1);
    expect(clean?.activeCharacterId).toBe('char_1');
    expect(clean?.sets[0]?.notes).toBe('keep me');
    expect(clean?.sets[0]?.slots.PRIMARY?.upgrade).toEqual({ full: 6, fraction: 3 });
    expect(clean?.sets[0]?.slots.EAR_1?.exaltations).toEqual({ focus: 'X' });
  });

  it('turns the old trio into the character’s one loadout', () => {
    const character = sanitizeState(v1Payload())?.characters[0] as Character;
    expect(character.loadouts).toHaveLength(1);
    expect(loadoutClasses(character)).toEqual(['BRD', 'WAR', 'BER']);
    expect(character.activeLoadoutId).toBe(character.loadouts[0]?.id);
    expect(character.race).toBe('HFL');
  });

  it('writes the old single level onto every class in the old trio', () => {
    const character = sanitizeState(v1Payload())?.characters[0] as Character;
    expect(character.levels.BRD).toBe(50);
    expect(character.levels.WAR).toBe(50);
    expect(character.levels.BER).toBe(50);
    // Classes that were never tracked start at the floor rather than at 50.
    expect(character.levels.WIZ).toBe(1);
    expect(Object.keys(character.levels)).toHaveLength(16);
  });

  it('renders the same header string it rendered before the migration', () => {
    const character = sanitizeState(v1Payload())?.characters[0] as Character;
    expect(describeCharacter(character)).toBe('50 BRD/WAR/BER');
    expect(primaryLevel(character)).toBe(50);
  });

  it('preserves eligibility exactly: same trio, same items', () => {
    const character = sanitizeState(v1Payload())?.characters[0] as Character;
    const ctx = activeContext(character);
    expect(canUse({ classes: ['WAR'], races: ['ALL'] }, ctx)).toBe(true);
    expect(canUse({ classes: ['CLR'], races: ['ALL'] }, ctx)).toBe(false);
    expect(canUse({ classes: ['ALL'], races: ['HFL'] }, ctx)).toBe(true);
    expect(canUse({ classes: ['ALL'], races: ['OGR'] }, ctx)).toBe(false);
  });

  it('survives a v1 character with junk in it', () => {
    const clean = sanitizeState({
      version: 1,
      characters: [
        { id: 'c', name: '', level: 'abc', classes: ['WAR', 'WAR', 'NOPE', 'CLR'], race: 5 },
      ],
      sets: [],
      activeCharacterId: null,
    });
    const character = clean?.characters[0] as Character;
    expect(character.name).toBe('Unnamed');
    expect(loadoutClasses(character)).toEqual(['WAR', 'CLR']);
    expect(character.race).toBeNull();
    expect(character.levels.WAR).toBe(50); // finite() default for an unreadable level
  });

  it('migrates a v1 character with no classes at all into an empty loadout', () => {
    const character = migrateCharacterV1({ id: 'c', name: 'Blank', level: 20, classes: [] });
    expect(character?.loadouts).toHaveLength(1);
    expect(character?.loadouts[0]?.classes).toEqual([]);
    expect(describeCharacter(character as Character)).toBe('1');
  });

  it('refuses a character with no id, as before', () => {
    expect(migrateCharacterV1({ name: 'ghost', level: 50, classes: ['WAR'] })).toBeNull();
  });

  it('migrates through a real storage round trip and then stays put', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(v1Payload()));

    const first = loadState(storage);
    expect(first.status).toBe('ok');
    expect(first.state.version).toBe(STATE_VERSION);
    const migrated = first.state.characters[0] as Character;
    expect(loadoutClasses(migrated)).toEqual(['BRD', 'WAR', 'BER']);

    // Save the migrated state back and reload: v2 must be idempotent.
    expect(saveState(first.state, storage)).toBe('ok');
    const second = loadState(storage);
    expect(second.state).toEqual(first.state);
  });

  it('leaves a v2 character untouched', () => {
    const v2: Character = {
      id: 'c',
      name: 'Modern',
      race: null,
      levels: makeLevels({ WAR: 44 }),
      loadouts: [
        { id: 'a', name: 'One', classes: ['WAR'] },
        { id: 'b', name: 'Two', classes: ['BRD', 'DRU'] },
      ],
      activeLoadoutId: 'b',
    };
    const clean = sanitizeState({ version: 2, characters: [v2], sets: [], activeCharacterId: 'c' });
    const out = clean?.characters[0] as Character;
    expect(out.loadouts).toHaveLength(2);
    expect(out.activeLoadoutId).toBe('b');
    expect(out.levels.WAR).toBe(44);
    expect(out.levels.BRD).toBe(1);
  });

  it('repairs a v2 character whose active loadout id points at nothing', () => {
    const clean = sanitizeState({
      version: 2,
      characters: [
        {
          id: 'c',
          name: 'Stale',
          levels: { WAR: 30 },
          loadouts: [{ id: 'a', name: 'One', classes: ['WAR'] }],
          activeLoadoutId: 'deleted',
        },
      ],
      sets: [],
      activeCharacterId: 'c',
    });
    expect((clean?.characters[0] as Character).activeLoadoutId).toBe('a');
  });

  it('falls back to the v1 path when a v2 loadout list is unusable', () => {
    const clean = sanitizeState({
      version: 2,
      characters: [
        { id: 'c', name: 'Broken', level: 33, classes: ['ROG'], loadouts: [null, {}, 'junk'] },
      ],
      sets: [],
      activeCharacterId: null,
    });
    const character = clean?.characters[0] as Character;
    expect(loadoutClasses(character)).toEqual(['ROG']);
    expect(character.levels.ROG).toBe(33);
  });

  it('deduplicates loadout ids so a hand-edited file cannot collide', () => {
    const clean = sanitizeState({
      version: 2,
      characters: [
        {
          id: 'c',
          name: 'Dupes',
          levels: {},
          loadouts: [
            { id: 'same', name: 'A', classes: ['WAR'] },
            { id: 'same', name: 'B', classes: ['BRD'] },
          ],
          activeLoadoutId: 'same',
        },
      ],
      sets: [],
      activeCharacterId: 'c',
    });
    const ids = (clean?.characters[0] as Character).loadouts.map((l) => l.id);
    expect(new Set(ids).size).toBe(2);
  });
});
