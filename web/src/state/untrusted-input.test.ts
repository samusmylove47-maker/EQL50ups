/**
 * Hardening tests for the two places untrusted data enters the app: a saved
 * library from a previous version (or a hand-edited localStorage), and a share
 * payload a stranger pasted into Discord.
 *
 * Both were letting through a trio the character model itself rejects — a
 * repeated class code — which printed as "50 WAR/WAR" in the set header.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadoutClasses, validateClasses, type Character } from '../engine/character';
import { decodePlan, encodePlan, planCharacter } from '../share/codec';
import { encodeText } from '../lib/base64url';
import { memoryStorage, sanitizeState, saveState, STORAGE_KEY } from './persistence';
import { flushPersist, useApp } from './store';

const baseState = (classes: unknown) => ({
  version: 1,
  characters: [{ id: 'c1', name: 'Ghost', level: 50, classes, race: null }],
  sets: [],
  activeCharacterId: 'c1',
});

describe('sanitizeState', () => {
  it('collapses a repeated class code into a trio the model accepts', () => {
    const clean = sanitizeState(baseState(['WAR', 'war', 'WAR', 'CLR']));
    expect(loadoutClasses(clean?.characters[0] as Character)).toEqual(['WAR', 'CLR']);
    expect(validateClasses(loadoutClasses(clean?.characters[0] as Character) ?? []).ok).toBe(true);
  });

  it('drops codes that are not classes at all', () => {
    const clean = sanitizeState(baseState(['WAR', 'NOPE', 42, null, 'CLR']));
    expect(loadoutClasses(clean?.characters[0] as Character)).toEqual(['WAR', 'CLR']);
  });

  it('never returns more than three classes', () => {
    const clean = sanitizeState(baseState(['WAR', 'CLR', 'PAL', 'RNG', 'DRU']));
    expect(loadoutClasses(clean?.characters[0] as Character)).toHaveLength(3);
    expect(validateClasses(loadoutClasses(clean?.characters[0] as Character) ?? []).ok).toBe(true);
  });
});

describe('decodePlan', () => {
  /* A v1 link is JSON, so its class list is free text a stranger can edit. */
  const legacyLink = (classes: string) =>
    encodeText(JSON.stringify([1, 'A', 50, null, classes, 'S', [], [], '']));

  it('collapses repeats and discards unknown codes from a hand-edited link', () => {
    const plan = decodePlan(legacyLink('WAR/WAR/NOPE/CLR'));
    expect(plan?.character.loadouts[0]?.classes ?? []).toEqual(['WAR', 'CLR']);
    expect(validateClasses(plan?.character.loadouts[0]?.classes ?? []).ok).toBe(true);
  });

  it('yields a usable plan even when every class is junk', () => {
    const plan = decodePlan(legacyLink('XXX/YYY'));
    expect(plan?.character.loadouts[0]?.classes ?? []).toEqual([]);
  });

  it('refuses to build a repeated trio out of a v2 payload either', () => {
    const payload = encodePlan({
      character: planCharacter({ name: 'A', classes: ['WAR', 'WAR', 'CLR'] as never }),
      set: { name: 'S', slots: {}, weights: {} },
    });
    expect(decodePlan(payload)?.character.loadouts[0]?.classes).toEqual(['WAR', 'CLR']);
  });
});

describe('flushPersist', () => {
  beforeEach(() => {
    useApp.getState().resetAll();
    flushPersist();
    localStorage.clear();
  });

  it('writes a change that is still inside the debounce window', () => {
    vi.useFakeTimers();
    try {
      useApp.getState().createCharacter({ name: 'Flushed', level: 50, classes: ['WAR'], race: null });
      // Nothing has hit storage yet — the write is still queued.
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

      flushPersist();
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      expect(saved.characters).toHaveLength(1);
      expect(saved.characters[0].name).toBe('Flushed');

      // Flushing twice must not write twice or throw.
      flushPersist();
      vi.runAllTimers();
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').characters).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a no-op when nothing is pending', () => {
    expect(() => flushPersist()).not.toThrow();
  });
});

describe('saveState', () => {
  it('reports a full quota instead of throwing', () => {
    const storage = memoryStorage();
    const full = {
      ...storage,
      setItem: () => {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      },
    };
    expect(saveState({ version: 1, characters: [], sets: [], activeCharacterId: null }, full)).toBe(
      'quota',
    );
  });
});
