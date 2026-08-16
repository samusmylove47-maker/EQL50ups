/**
 * Hardening tests for the two places untrusted data enters the app: a saved
 * library from a previous version (or a hand-edited localStorage), and a share
 * payload a stranger pasted into Discord.
 *
 * Both were letting through a trio the character model itself rejects — a
 * repeated class code — which printed as "50 WAR/WAR" in the set header.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateClasses } from '../engine/character';
import { decodePlan, encodePlan, type SharedPlan } from '../share/codec';
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
    expect(clean?.characters[0]?.classes).toEqual(['WAR', 'CLR']);
    expect(validateClasses(clean?.characters[0]?.classes ?? []).ok).toBe(true);
  });

  it('drops codes that are not classes at all', () => {
    const clean = sanitizeState(baseState(['WAR', 'NOPE', 42, null, 'CLR']));
    expect(clean?.characters[0]?.classes).toEqual(['WAR', 'CLR']);
  });

  it('never returns more than three classes', () => {
    const clean = sanitizeState(baseState(['WAR', 'CLR', 'PAL', 'RNG', 'DRU']));
    expect(clean?.characters[0]?.classes).toHaveLength(3);
    expect(validateClasses(clean?.characters[0]?.classes ?? []).ok).toBe(true);
  });
});

describe('decodePlan', () => {
  const link = (classes: string) =>
    encodePlan({
      character: { name: 'A', level: 50, race: null, classes: classes.split('/') as never },
      set: { name: 'S', slots: {}, weights: {} },
    } as SharedPlan);

  it('collapses repeats and discards unknown codes from a hand-edited link', () => {
    const plan = decodePlan(link('WAR/WAR/NOPE/CLR'));
    expect(plan?.character.classes).toEqual(['WAR', 'CLR']);
    expect(validateClasses(plan?.character.classes ?? []).ok).toBe(true);
  });

  it('yields a usable plan even when every class is junk', () => {
    const plan = decodePlan(link('XXX/YYY'));
    expect(plan?.character.classes).toEqual([]);
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
