/**
 * Application state: the character library, the gear sets, and every mutation
 * the UI can perform on them. Persistence is a subscriber, not a concern of
 * the reducers — every change schedules a debounced write and reports storage
 * trouble through `storageStatus` instead of throwing.
 */

import { create } from 'zustand';
import {
  buildCharacter, clampLevel, defaultLoadoutName, makeLevels,
  type Character, type Loadout,
} from '../engine/character';
import type { ClassCode } from '../engine/constants';
import { profileById, type WeightProfile } from '../engine/ep';
import { BASE_STATE, normalizeState, type UpgradeState } from '../engine/upgrade';
import type { EquippedItem, GearSet } from '../engine/types';
import type { SharedPlan } from '../share/codec';
import type { ExportEnvelope } from '../share/codec';
import { isDefaultFilters, type SetFilters } from '../lib/setFilters';
import {
  emptyState,
  loadState,
  saveState,
  sanitizeState,
  type LoadStatus,
  type PersistedState,
  type SaveStatus,
} from './persistence';

export function newId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

export const DEFAULT_WEIGHTS: WeightProfile = profileById('balanced');

export interface AppState extends PersistedState {
  hydrated: boolean;
  storageStatus: SaveStatus | LoadStatus;
  hydrate: () => void;
  createCharacter: (input: {
    name: string;
    level: number;
    classes: ClassCode[];
    race: string | null;
    /** Optional per-class levels; anything omitted starts at the floor. */
    levels?: Partial<Record<string, number>>;
  }) => Character;
  updateCharacter: (id: string, patch: Partial<Omit<Character, 'id'>>) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;
  setClassLevel: (characterId: string, code: ClassCode, level: number) => void;
  addLoadout: (characterId: string, input?: { name?: string; classes?: ClassCode[] }) => Loadout | null;
  updateLoadout: (characterId: string, loadoutId: string, patch: Partial<Omit<Loadout, 'id'>>) => void;
  deleteLoadout: (characterId: string, loadoutId: string) => void;
  setActiveLoadout: (characterId: string, loadoutId: string) => void;
  createSet: (
    characterId: string,
    name?: string,
    weights?: WeightProfile,
    options?: { notes?: string; filters?: SetFilters },
  ) => GearSet;
  duplicateSet: (id: string) => GearSet | null;
  renameSet: (id: string, name: string) => void;
  /**
   * Apply a whole set configuration in one write.
   *
   * The create dialog and the edit dialog are one surface, so saving one is one
   * mutation rather than four — four would be four persists and four renders
   * for what the user experienced as pressing Save once.
   */
  configureSet: (
    id: string,
    patch: { name?: string; notes?: string; weights?: WeightProfile; filters?: SetFilters },
  ) => void;
  deleteSet: (id: string) => void;
  equip: (setId: string, position: string, itemName: string, upgrade?: UpgradeState) => void;
  unequip: (setId: string, position: string) => void;
  setUpgrade: (setId: string, position: string, upgrade: UpgradeState) => void;
  setExaltation: (setId: string, position: string, kind: string, donor: string | null) => void;
  setWeights: (setId: string, weights: WeightProfile) => void;
  setNotes: (setId: string, notes: string) => void;
  adoptPlan: (plan: SharedPlan) => { characterId: string; setId: string };
  importEnvelope: (envelope: ExportEnvelope) => { characters: number; sets: number };
  buildEnvelope: () => ExportEnvelope;
  resetAll: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingWrite: (() => void) | undefined;

function schedulePersist(get: () => AppState, set: (partial: Partial<AppState>) => void): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  const write = () => {
    saveTimer = undefined;
    pendingWrite = undefined;
    const { characters, sets, activeCharacterId, version } = get();
    const status = saveState({ version, characters, sets, activeCharacterId });
    if (status !== 'ok') set({ storageStatus: status });
    else if (get().storageStatus !== 'ok') set({ storageStatus: 'ok' });
  };
  pendingWrite = write;
  saveTimer = setTimeout(write, 200);
}

/**
 * Write a debounced change out immediately.
 *
 * The 200 ms debounce keeps a drag on the +N stepper from hammering storage,
 * but it also meant an edit followed straight away by a reload or a closed tab
 * was simply lost. Call this whenever the page is about to go away.
 */
export function flushPersist(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  pendingWrite?.();
}

export const useApp = create<AppState>((set, get) => {
  const persist = () => schedulePersist(get, set);

  const mutateCharacter = (id: string, mutate: (draft: Character) => Character): void => {
    set({ characters: get().characters.map((c) => (c.id === id ? mutate(c) : c)) });
    persist();
  };

  const mutateSet = (id: string, mutate: (draft: GearSet) => GearSet): void => {
    set({
      sets: get().sets.map((s) => (s.id === id ? { ...mutate(s), updatedAt: Date.now() } : s)),
    });
    persist();
  };

  return {
    ...emptyState(),
    hydrated: false,
    storageStatus: 'ok',

    hydrate() {
      if (get().hydrated) return;
      const { status, state, migrated } = loadState();
      set({
        ...state,
        hydrated: true,
        storageStatus: status === 'ok' || status === 'empty' ? 'ok' : status,
      });
      // A library written by an older schema is migrated on read. Write it
      // back straight away rather than leaving the old shape sitting there to
      // be re-migrated on every load — and so an export taken before the first
      // edit carries the new shape too.
      if (migrated) persist();
    },

    createCharacter(input) {
      // The level typed on the creation screen belongs to the classes actually
      // chosen; the other thirteen start at the floor and are edited later.
      const character = buildCharacter({
        id: newId('char'),
        name: input.name.trim() || 'Unnamed',
        classes: input.classes,
        race: input.race,
        level: input.level,
        loadoutId: newId('load'),
        ...(input.levels ? { levels: input.levels } : {}),
      });
      set({ characters: [...get().characters, character], activeCharacterId: character.id });
      persist();
      return character;
    },

    updateCharacter(id, patch) {
      set({
        characters: get().characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
      persist();
    },

    setClassLevel(characterId, code, level) {
      mutateCharacter(characterId, (c) => ({
        ...c,
        levels: { ...c.levels, [code]: clampLevel(level) },
      }));
    },

    addLoadout(characterId, input) {
      const character = get().characters.find((c) => c.id === characterId);
      if (!character) return null;
      const loadout: Loadout = {
        id: newId('load'),
        name: input?.name?.trim() || defaultLoadoutName(character.loadouts.length),
        classes: [...(input?.classes ?? character.loadouts[0]?.classes ?? [])],
      };
      mutateCharacter(characterId, (c) => ({ ...c, loadouts: [...c.loadouts, loadout] }));
      return loadout;
    },

    updateLoadout(characterId, loadoutId, patch) {
      mutateCharacter(characterId, (c) => ({
        ...c,
        loadouts: c.loadouts.map((l) => (l.id === loadoutId ? { ...l, ...patch, id: l.id } : l)),
      }));
    },

    deleteLoadout(characterId, loadoutId) {
      mutateCharacter(characterId, (c) => {
        // A character always has at least one loadout: without one there is no
        // trio, and every screen would have to invent an empty state for it.
        if (c.loadouts.length <= 1) return c;
        const loadouts = c.loadouts.filter((l) => l.id !== loadoutId);
        const active = loadouts.some((l) => l.id === c.activeLoadoutId)
          ? c.activeLoadoutId
          : ((loadouts[0] as Loadout).id);
        return { ...c, loadouts, activeLoadoutId: active };
      });
    },

    setActiveLoadout(characterId, loadoutId) {
      mutateCharacter(characterId, (c) =>
        c.loadouts.some((l) => l.id === loadoutId) ? { ...c, activeLoadoutId: loadoutId } : c,
      );
    },

    deleteCharacter(id) {
      const characters = get().characters.filter((c) => c.id !== id);
      set({
        characters,
        sets: get().sets.filter((s) => s.characterId !== id),
        activeCharacterId:
          get().activeCharacterId === id ? (characters[0]?.id ?? null) : get().activeCharacterId,
      });
      persist();
    },

    setActiveCharacter(id) {
      set({ activeCharacterId: id });
      persist();
    },

    createSet(characterId, name, weights, options) {
      const now = Date.now();
      const existing = get().sets.filter((s) => s.characterId === characterId).length;
      const gearSet: GearSet = {
        id: newId('set'),
        characterId,
        name: name?.trim() || (existing ? `Set ${existing + 1}` : 'Main Set'),
        slots: {},
        weights: { ...(weights ?? DEFAULT_WEIGHTS) },
        createdAt: now,
        updatedAt: now,
      };
      if (options?.notes?.trim()) gearSet.notes = options.notes.trim();
      if (options?.filters && !isDefaultFilters(options.filters)) {
        gearSet.defaultFilters = { ...options.filters };
      }
      set({ sets: [...get().sets, gearSet] });
      persist();
      return gearSet;
    },

    configureSet(id, patch) {
      mutateSet(id, (s) => {
        const next: GearSet = { ...s };
        if (patch.name !== undefined) next.name = patch.name.trim() || s.name;
        if (patch.notes !== undefined) {
          const notes = patch.notes.trim();
          if (notes) next.notes = notes;
          else delete next.notes;
        }
        if (patch.weights) next.weights = { ...patch.weights };
        if (patch.filters) {
          if (isDefaultFilters(patch.filters)) delete next.defaultFilters;
          else next.defaultFilters = { ...patch.filters };
        }
        return next;
      });
    },

    duplicateSet(id) {
      const source = get().sets.find((s) => s.id === id);
      if (!source) return null;
      const now = Date.now();
      const copy: GearSet = {
        ...source,
        id: newId('set'),
        name: `${source.name} (copy)`,
        slots: { ...source.slots },
        weights: { ...source.weights },
        createdAt: now,
        updatedAt: now,
      };
      set({ sets: [...get().sets, copy] });
      persist();
      return copy;
    },

    renameSet(id, name) {
      mutateSet(id, (s) => ({ ...s, name: name.trim() || s.name }));
    },

    deleteSet(id) {
      set({ sets: get().sets.filter((s) => s.id !== id) });
      persist();
    },

    equip(setId, position, itemName, upgrade) {
      mutateSet(setId, (s) => {
        const previous = s.slots[position];
        const equipped: EquippedItem = {
          itemName,
          upgrade: normalizeState(upgrade ?? previous?.upgrade ?? BASE_STATE),
        };
        return { ...s, slots: { ...s.slots, [position]: equipped } };
      });
    },

    unequip(setId, position) {
      mutateSet(setId, (s) => {
        const slots = { ...s.slots };
        delete slots[position];
        return { ...s, slots };
      });
    },

    setUpgrade(setId, position, upgrade) {
      mutateSet(setId, (s) => {
        const current = s.slots[position];
        if (!current) return s;
        return {
          ...s,
          slots: { ...s.slots, [position]: { ...current, upgrade: normalizeState(upgrade) } },
        };
      });
    },

    setExaltation(setId, position, kind, donor) {
      mutateSet(setId, (s) => {
        const current = s.slots[position];
        if (!current) return s;
        const exaltations = { ...(current.exaltations ?? {}) };
        if (donor) exaltations[kind] = donor;
        else delete exaltations[kind];
        const next: EquippedItem = { ...current, exaltations };
        if (!Object.keys(exaltations).length) delete next.exaltations;
        return { ...s, slots: { ...s.slots, [position]: next } };
      });
    },

    setWeights(setId, weights) {
      mutateSet(setId, (s) => ({ ...s, weights: { ...weights } }));
    },

    setNotes(setId, notes) {
      mutateSet(setId, (s) => ({ ...s, notes }));
    },

    adoptPlan(plan) {
      const now = Date.now();
      // Re-key the loadouts as well as the character, so an adopted plan can
      // never share ids with something already in the library.
      const loadouts = plan.character.loadouts.map((l) => ({ ...l, id: newId('load') }));
      if (!loadouts.length) {
        loadouts.push({ id: newId('load'), name: defaultLoadoutName(0), classes: [] });
      }
      const activeIndex = Math.max(
        0,
        plan.character.loadouts.findIndex((l) => l.id === plan.character.activeLoadoutId),
      );
      const character: Character = {
        id: newId('char'),
        name: plan.character.name,
        race: plan.character.race,
        levels: makeLevels(plan.character.levels),
        loadouts,
        activeLoadoutId: (loadouts[activeIndex] ?? loadouts[0])?.id ?? '',
      };
      const gearSet: GearSet = {
        id: newId('set'),
        characterId: character.id,
        name: plan.set.name,
        slots: { ...plan.set.slots },
        weights: { ...plan.set.weights },
        createdAt: now,
        updatedAt: now,
      };
      if (plan.set.notes) gearSet.notes = plan.set.notes;
      set({
        characters: [...get().characters, character],
        sets: [...get().sets, gearSet],
        activeCharacterId: character.id,
      });
      persist();
      return { characterId: character.id, setId: gearSet.id };
    },

    importEnvelope(envelope) {
      const clean = sanitizeState({
        characters: envelope.characters,
        sets: envelope.sets,
        activeCharacterId: null,
      });
      if (!clean) return { characters: 0, sets: 0 };

      // Re-key everything so an import can never collide with existing entries.
      const remap = new Map<string, string>();
      const characters = clean.characters.map((c) => {
        const id = newId('char');
        remap.set(c.id, id);
        return { ...c, id };
      });
      const sets = clean.sets.map((s) => ({
        ...s,
        id: newId('set'),
        characterId: remap.get(s.characterId) ?? s.characterId,
      }));

      set({
        characters: [...get().characters, ...characters],
        sets: [...get().sets, ...sets],
        activeCharacterId: characters[0]?.id ?? get().activeCharacterId,
      });
      persist();
      return { characters: characters.length, sets: sets.length };
    },

    buildEnvelope() {
      return {
        format: 'eql-upgrades',
        version: get().version,
        exportedAt: new Date().toISOString(),
        characters: get().characters,
        sets: get().sets,
      };
    },

    resetAll() {
      set({ ...emptyState(), hydrated: true });
      persist();
    },
  };
});

/** Convenience selectors used across screens. */
export function setsForCharacter(state: AppState, characterId: string | null): GearSet[] {
  if (!characterId) return [];
  return state.sets
    .filter((s) => s.characterId === characterId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function characterFor(state: AppState, gearSet: GearSet | undefined): Character | undefined {
  if (!gearSet) return undefined;
  return state.characters.find((c) => c.id === gearSet.characterId);
}
