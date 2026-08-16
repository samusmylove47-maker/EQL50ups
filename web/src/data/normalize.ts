/**
 * Catalog normalisation.
 *
 * The shipped data files are produced by a separate pipeline, so this module
 * is deliberately forgiving: it accepts the compact shipping shape defined in
 * `engine/types.ts`, the longer human-readable shape, an array or a
 * name-keyed object, and repairs the slot vocabulary (the wiki corpus carries
 * `FINGER`, `SHOULDER` and a scattering of typos alongside the canonical
 * names). Anything it cannot understand is dropped rather than crashing a
 * screen.
 */

import { SLOT_TYPES, type SlotType } from '../engine/constants';
import type { Item, ItemEffect, ItemSource, WeaponData } from '../engine/types';
import { finite } from '../lib/format';

/** Slot token, including the EQL-specific "fits anywhere" marker. */
export type SlotCode = SlotType | 'ANY';

const SLOT_ALIASES: Record<string, SlotCode> = {
  FINGER: 'FINGERS',
  FINGERS: 'FINGERS',
  RING: 'FINGERS',
  RINGS: 'FINGERS',
  EAR: 'EAR',
  EARS: 'EAR',
  EARRING: 'EAR',
  SHOULDER: 'SHOULDERS',
  SHOULDERS: 'SHOULDERS',
  WRISTS: 'WRIST',
  WRIST: 'WRIST',
  ARM: 'ARMS',
  ARMS: 'ARMS',
  HAND: 'HANDS',
  HANDS: 'HANDS',
  FOOT: 'FEET',
  FEET: 'FEET',
  LEG: 'LEGS',
  LEGS: 'LEGS',
  SECONDAY: 'SECONDARY',
  SECONDARY: 'SECONDARY',
  OFFHAND: 'SECONDARY',
  PRIMARY: 'PRIMARY',
  MAINHAND: 'PRIMARY',
  RANGED: 'RANGE',
  RANGE: 'RANGE',
  'ANY SLOT': 'ANY',
  ANYSLOT: 'ANY',
  ANY: 'ANY',
};

for (const slot of SLOT_TYPES) SLOT_ALIASES[slot] = slot;

/** Split and repair a slot expression such as `PRIMARY/SECONDARY`. */
export function normalizeSlots(raw: unknown): SlotCode[] {
  const tokens: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    for (const part of value.split(/[/,|]+/)) {
      const trimmed = part.trim().toUpperCase();
      if (trimmed) tokens.push(trimmed);
    }
  };
  if (Array.isArray(raw)) raw.forEach(push);
  else push(raw);

  const out: SlotCode[] = [];
  for (const token of tokens) {
    const mapped = SLOT_ALIASES[token];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringList(raw: unknown): string[] {
  if (typeof raw === 'string') return raw.split(/[/,|]+/).map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string').map((s) => s.trim()).filter(Boolean);
}

function upperList(raw: unknown): string[] {
  return stringList(raw).map((s) => s.toUpperCase().replace(/\s+/g, '_'));
}

/**
 * Stat maps arrive either as `{STR: 10}` or as `[{key: 'STR', value: '10'}]`.
 * Values may be strings with a leading `+`.
 */
function numberMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const set = (key: unknown, value: unknown) => {
    if (typeof key !== 'string' || !key.trim()) return;
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[+\s,]/g, ''));
    if (!Number.isFinite(n) || n === 0) return;
    out[key.trim().toUpperCase()] = n;
  };
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (isRecord(entry)) set(entry.key ?? entry.name ?? entry.stat, entry.value ?? entry.amount);
    }
  } else if (isRecord(raw)) {
    for (const [k, v] of Object.entries(raw)) set(k, v);
  }
  return out;
}

function normalizeEffects(raw: unknown): ItemEffect[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ItemEffect[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const kind = entry.k ?? entry.kind;
    const name = entry.n ?? entry.name;
    if (typeof name !== 'string' || !name) continue;
    const effect: ItemEffect = {
      k: typeof kind === 'string' ? kind.toLowerCase() : 'unknown',
      n: name,
    };
    const detail = entry.d ?? entry.detail;
    if (typeof detail === 'string' && detail) effect.d = detail;
    out.push(effect);
  }
  return out.length ? out : undefined;
}

function normalizeWeapon(raw: unknown, stats: Record<string, number>): WeaponData | undefined {
  const source = isRecord(raw) ? raw : null;
  const dmg = source ? finite(source.dmg ?? source.damage) : finite(stats.DMG);
  const dly = source ? finite(source.dly ?? source.delay) : finite(stats.DLY ?? stats.DELAY);
  if (dmg <= 0 || dly <= 0) return undefined;
  const weapon: WeaponData = { dmg, dly };
  const skill = source?.skill ?? source?.type;
  if (typeof skill === 'string' && skill) weapon.skill = skill;
  const bonus = finite(source?.bonus ?? stats.AC_BONUS);
  if (bonus) weapon.bonus = bonus;
  const range = finite(source?.range);
  if (range) weapon.range = range;
  return weapon;
}

function normalizeSource(raw: unknown): ItemSource | undefined {
  if (!isRecord(raw)) return undefined;
  const src: ItemSource = {};
  const zones = stringList(raw.z ?? raw.zones ?? raw.zone);
  const mobs = stringList(raw.m ?? raw.mobs ?? raw.dropsFrom);
  const quests = stringList(raw.q ?? raw.quests);
  const vendors = stringList(raw.v ?? raw.vendors);
  if (zones.length) src.z = zones;
  if (mobs.length) src.m = mobs;
  if (quests.length) src.q = quests;
  if (vendors.length) src.v = vendors;
  if (raw.c === true || raw.crafted === true || raw.playerCrafted === true) src.c = true;
  return Object.keys(src).length ? src : undefined;
}

/** One catalog entry, or null when the payload has no usable name. */
export function normalizeItem(raw: unknown, fallbackName?: string): Item | null {
  if (!isRecord(raw)) return null;
  const nameRaw = raw.n ?? raw.name ?? raw.page ?? fallbackName;
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  if (!name) return null;

  const nested = isRecord(raw.stats) && !Array.isArray(raw.stats) && (raw.stats.stats || raw.stats.slot)
    ? (raw.stats as Record<string, unknown>)
    : null;

  const stats = numberMap(raw.st ?? nested?.stats ?? raw.stats);
  const saves = numberMap(raw.sv ?? nested?.saves ?? raw.saves);
  if (nested) {
    const ac = finite(nested.ac);
    if (ac && !stats.AC) stats.AC = ac;
  }

  const slots = normalizeSlots(raw.sl ?? nested?.slot ?? nested?.slots ?? raw.slot ?? raw.slots);
  const classes = upperList(raw.cl ?? nested?.classes ?? raw.classes);
  const races = upperList(raw.ra ?? nested?.races ?? raw.races);
  const flags = upperList(raw.fl ?? nested?.flags ?? raw.flags);
  for (const extra of upperList(nested?.extras)) if (!flags.includes(extra)) flags.push(extra);

  const item: Item = {
    id: typeof raw.id === 'number' ? raw.id : null,
    n: name,
    sl: slots,
    cl: classes.length ? classes : ['ALL'],
    ra: races.length ? races : ['ALL'],
    st: stats,
    sv: saves,
    fl: flags,
    av: raw.av === undefined ? true : raw.av !== false,
  };

  const icon = raw.ic ?? raw.iconId;
  if (typeof icon === 'number') item.ic = icon;

  const effects = normalizeEffects(raw.fx ?? nested?.effects ?? raw.effects);
  if (effects) item.fx = effects;

  const weapon = normalizeWeapon(raw.wp ?? raw.weapon, stats);
  if (weapon) item.wp = weapon;

  const weight = finite(raw.wt ?? nested?.weight ?? raw.weight);
  if (weight) item.wt = weight;

  const size = raw.sz ?? nested?.size ?? raw.size;
  if (typeof size === 'string' && size) item.sz = size.toUpperCase();

  const era = raw.era ?? raw.eraTag;
  if (typeof era === 'string' && era) item.era = era;
  else if (era === null) item.era = null;
  if (raw.eraUnknown === true || (!item.era && era === undefined)) item.eraUnknown = true;

  const src = normalizeSource(raw.src ?? raw.source);
  if (src) item.src = src;

  if (typeof raw.parsed === 'string') item.parsed = raw.parsed;

  return item;
}

/**
 * Accepts `Item[]`, `{items: Item[]}` or `{items: {name: Item}}` — whichever
 * shape the pipeline emits — and returns clean entries.
 */
export function normalizeCatalog(raw: unknown): Item[] {
  const out: Item[] = [];
  const push = (value: unknown, key?: string) => {
    const item = normalizeItem(value, key);
    if (item) out.push(item);
  };

  if (Array.isArray(raw)) {
    raw.forEach((entry) => push(entry));
    return out;
  }
  if (!isRecord(raw)) return out;

  const container = raw.items ?? raw.data ?? raw.catalog ?? raw.entries;
  if (Array.isArray(container)) {
    container.forEach((entry) => push(entry));
    return out;
  }
  if (isRecord(container)) {
    for (const [key, value] of Object.entries(container)) push(value, key);
    return out;
  }
  // A bare object that is itself one item.
  push(raw);
  return out;
}

/** Does this item have any stat worth showing? Used to rank empties last. */
export function hasStats(item: Item): boolean {
  return Boolean(item.wp) || Object.keys(item.st).length > 0 || Object.keys(item.sv).length > 0;
}
