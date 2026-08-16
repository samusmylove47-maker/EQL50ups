/**
 * localStorage persistence.
 *
 * Three failure modes are treated as normal operating conditions rather than
 * exceptions: storage absent (private browsing, SSR, a locked-down browser),
 * storage full (quota), and storage corrupt (a half-written value, or a
 * previous version's shape). None of them may take the app down; the planner
 * still works, it just stops remembering.
 */

import { CLASS_SET } from '../engine/constants';
import { normalizeState } from '../engine/upgrade';
import type { Character } from '../engine/character';
import type { EquippedItem, GearSet } from '../engine/types';
import { finite } from '../lib/format';

export const STORAGE_KEY = 'eqlups.state.v1';
export const STATE_VERSION = 1;

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

export type LoadStatus = 'ok' | 'empty' | 'unavailable' | 'corrupt';
export type SaveStatus = 'ok' | 'unavailable' | 'quota' | 'error';

export interface LoadResult {
  status: LoadStatus;
  state: PersistedState;
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

function sanitizeCharacter(raw: unknown): Character | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  if (!id) return null;
  const classes = Array.isArray(raw.classes)
    ? raw.classes
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.toUpperCase())
        .filter((c) => CLASS_SET.has(c))
        .slice(0, 3)
    : [];
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Unnamed',
    level: Math.max(1, Math.min(255, Math.round(finite(raw.level, 50)))),
    classes: classes as Character['classes'],
    race: typeof raw.race === 'string' && raw.race ? raw.race : null,
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

  const state = sanitizeState(parsed);
  if (!state) {
    quarantine(storage, text);
    return { status: 'corrupt', state: emptyState() };
  }
  return { status: 'ok', state };
}

/** Park an unreadable payload aside so a bug report can still recover it. */
function quarantine(storage: StorageLike, text: string): void {
  try {
    storage.setItem(`${STORAGE_KEY}.corrupt`, text.slice(0, 200_000));
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
