/**
 * localStorage persistence.
 *
 * Three failure modes are treated as normal operating conditions rather than
 * exceptions: storage absent (private browsing, SSR, a locked-down browser),
 * storage full (quota), and storage corrupt (a half-written value, or a
 * previous version's shape). None of them may take the app down; the planner
 * still works, it just stops remembering.
 */

import { CLASS_SET, type ClassCode } from '../engine/constants';
import { normalizeState } from '../engine/upgrade';
import {
  DEFAULT_CLASS_LEVEL, clampLevel, defaultLoadoutName, makeLevels,
  type Character, type ClassLevels, type Loadout,
} from '../engine/character';
import type { EquippedItem, GearSet } from '../engine/types';
import { finite } from '../lib/format';

/**
 * The storage key is deliberately frozen at `.v1`: it is where every existing
 * player's library already lives. Shape changes are handled by the `version`
 * field inside the payload and the migrations below, never by moving the key —
 * a new key would silently orphan everyone's saved characters.
 */
export const STORAGE_KEY = 'eqlups.state.v1';

/**
 * 1 — character = one level + one class trio.
 * 2 — character = a per-class level map plus a list of named loadouts.
 */
export const STATE_VERSION = 2;

export interface PersistedState {
  version: number;
  characters: Character[];
  sets: GearSet[];
  activeCharacterId: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadStatus = 'ok' | 'empty' | 'corrupt' | 'unavailable' | 'future';
export type SaveStatus = 'ok' | 'unavailable' | 'quota' | 'error';

export interface LoadResult {
  status: LoadStatus;
  state: PersistedState;
  /** True when the stored payload was written by an older schema version. */
  migrated?: boolean;
}

export function emptyState(): PersistedState {
  return { version: STATE_VERSION, characters: [], sets: [], activeCharacterId: null };
}

/** The browser's storage, or null when it is unusable for any reason. */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!storage) return null;
    // Safari in private mode exposes localStorage but throws on write.
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Distinct, per `validateClasses` — a repeated code would print as "WAR/WAR"
 * in the header and is not a trio the game can produce.
 */
function sanitizeClassList(raw: unknown): ClassCode[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.toUpperCase())
        .filter((c) => CLASS_SET.has(c)),
    ),
  ].slice(0, 3) as ClassCode[];
}

function sanitizeLevels(raw: unknown): ClassLevels {
  const partial: Partial<Record<string, number>> = {};
  if (isRecord(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const code = key.toUpperCase();
      if (!CLASS_SET.has(code)) continue;
      if (typeof value !== 'number' && typeof value !== 'string') continue;
      partial[code] = clampLevel(value);
    }
  }
  return makeLevels(partial);
}

function sanitizeLoadout(raw: unknown, index: number): Loadout | null {
  if (!isRecord(raw)) return null;
  const classes = sanitizeClassList(raw.classes);
  if (!classes.length) return null;
  const loadout: Loadout = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `loadout_${index + 1}`,
    name:
      typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : defaultLoadoutName(index),
    classes,
  };
  if (typeof raw.race === 'string' && raw.race) loadout.race = raw.race;
  return loadout;
}

/**
 * Migration v1 -> v2.
 *
 * A v1 character was `{level, classes}`. The trio becomes the character's one
 * loadout, and the single level is written onto each class in that trio —
 * which is exactly what the header used to display, so nobody's numbers move.
 * Classes outside the trio were never tracked and start at the floor.
 */
export function migrateCharacterV1(raw: Record<string, unknown>): Character | null {
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  if (!id) return null;
  const classes = sanitizeClassList(raw.classes);
  const level = clampLevel(finite(raw.level, 50));
  const levels: Partial<Record<string, number>> = {};
  for (const code of classes) levels[code] = level;

  const loadout: Loadout = {
    id: `${id}_loadout_1`,
    name: defaultLoadoutName(0),
    classes,
  };
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Unnamed',
    race: typeof raw.race === 'string' && raw.race ? raw.race : null,
    levels: makeLevels(levels),
    // A v1 character with no valid class still has to have a loadout to be
    // switchable later; it just has nothing in it.
    loadouts: [loadout],
    activeLoadoutId: loadout.id,
  };
}

function sanitizeCharacter(raw: unknown): Character | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  if (!id) return null;

  // v1 shape: no loadout list, but a class trio and one level.
  if (!Array.isArray(raw.loadouts)) return migrateCharacterV1(raw);

  const loadouts = raw.loadouts
    .map((entry, i) => sanitizeLoadout(entry, i))
    .filter((l): l is Loadout => l !== null);
  if (!loadouts.length) {
    // Loadouts all unusable: fall back through the v1 path so a legible
    // character survives rather than being dropped entirely.
    return migrateCharacterV1(raw);
  }

  const seen = new Set<string>();
  for (const loadout of loadouts) {
    while (seen.has(loadout.id)) loadout.id = `${loadout.id}_`;
    seen.add(loadout.id);
  }

  const activeId =
    typeof raw.activeLoadoutId === 'string' && seen.has(raw.activeLoadoutId)
      ? raw.activeLoadoutId
      : (loadouts[0] as Loadout).id;

  const levels = isRecord(raw.levels)
    ? sanitizeLevels(raw.levels)
    : // A v2-shaped record with no level map at all: seed the trio from any
      // legacy `level` field so the header keeps reading the same number.
      sanitizeLevels(
        Object.fromEntries(
          (loadouts[0] as Loadout).classes.map((c) => [c, clampLevel(finite(raw.level, DEFAULT_CLASS_LEVEL))]),
        ),
      );

  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Unnamed',
    race: typeof raw.race === 'string' && raw.race ? raw.race : null,
    levels,
    loadouts,
    activeLoadoutId: activeId,
  };
}

function sanitizeEquipped(raw: unknown): EquippedItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.itemName !== 'string' || !raw.itemName) return null;
  const upgradeRaw = isRecord(raw.upgrade) ? raw.upgrade : {};
  const equipped: EquippedItem = {
    itemName: raw.itemName,
    upgrade: normalizeState({
      full: finite(upgradeRaw.full),
      fraction: finite(upgradeRaw.fraction),
    }),
  };
  if (isRecord(raw.exaltations)) {
    const exaltations: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.exaltations)) {
      if (typeof v === 'string' && v) exaltations[k] = v;
    }
    if (Object.keys(exaltations).length) equipped.exaltations = exaltations;
  }
  return equipped;
}

function sanitizeSet(raw: unknown): GearSet | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const characterId = typeof raw.characterId === 'string' ? raw.characterId : null;
  if (!id || !characterId) return null;

  const slots: Record<string, EquippedItem | undefined> = {};
  if (isRecord(raw.slots)) {
    for (const [position, value] of Object.entries(raw.slots)) {
      const equipped = sanitizeEquipped(value);
      if (equipped) slots[position] = equipped;
    }
  }

  const weights: Record<string, number> = {};
  if (isRecord(raw.weights)) {
    for (const [key, value] of Object.entries(raw.weights)) {
      if (typeof value === 'number' && Number.isFinite(value)) weights[key] = value;
    }
  }

  const now = Date.now();
  const set: GearSet = {
    id,
    characterId,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled Set',
    slots,
    weights,
    createdAt: finite(raw.createdAt, now),
    updatedAt: finite(raw.updatedAt, now),
  };
  if (typeof raw.notes === 'string' && raw.notes) set.notes = raw.notes;
  return set;
}

/** Coerce anything into a valid state, dropping what cannot be repaired. */
export function sanitizeState(raw: unknown): PersistedState | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.characters) || !Array.isArray(raw.sets)) return null;

  const characters = raw.characters
    .map(sanitizeCharacter)
    .filter((c): c is Character => c !== null);
  const knownIds = new Set(characters.map((c) => c.id));
  const sets = raw.sets
    .map(sanitizeSet)
    .filter((s): s is GearSet => s !== null && knownIds.has(s.characterId));

  const active =
    typeof raw.activeCharacterId === 'string' && knownIds.has(raw.activeCharacterId)
      ? raw.activeCharacterId
      : null;

  return { version: STATE_VERSION, characters, sets, activeCharacterId: active };
}

export function loadState(storage: StorageLike | null = defaultStorage()): LoadResult {
  if (!storage) return { status: 'unavailable', state: emptyState() };
  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable', state: emptyState() };
  }
  if (text === null || text === '') return { status: 'empty', state: emptyState() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    quarantine(storage, text);
    return { status: 'corrupt', state: emptyState() };
  }

  const storedVersion =
    isRecord(parsed) && typeof parsed.version === 'number' ? parsed.version : 0;

  /*
   * A payload from a *newer* build must not be run through this build's
   * sanitiser. Sanitising drops every field this version does not know about
   * and then the next save writes the reduced shape back, quietly destroying
   * whatever the newer build stored — the worst outcome for someone who opened
   * a stale tab. Park it and start clean instead; nothing is lost.
   */
  if (storedVersion > STATE_VERSION) {
    quarantine(storage, text, 'future');
    return { status: 'future', state: emptyState() };
  }

  const state = sanitizeState(parsed);
  if (!state) {
    quarantine(storage, text);
    return { status: 'corrupt', state: emptyState() };
  }
  return { status: 'ok', state, migrated: storedVersion !== STATE_VERSION };
}

/** Park an unreadable payload aside so a bug report can still recover it. */
function quarantine(storage: StorageLike, text: string, reason: 'corrupt' | 'future' = 'corrupt'): void {
  try {
    storage.setItem(`${STORAGE_KEY}.${reason}`, text.slice(0, 200_000));
  } catch {
    /* quarantine is best-effort; never let it break startup */
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(error.message)
  );
}

export function saveState(
  state: PersistedState,
  storage: StorageLike | null = defaultStorage(),
): SaveStatus {
  if (!storage) return 'unavailable';
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: STATE_VERSION }));
    return 'ok';
  } catch (error) {
    if (isQuotaError(error)) return 'quota';
    return 'error';
  }
}

export function clearState(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** In-memory Storage stand-in — used by tests and as a fallback. */
export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
