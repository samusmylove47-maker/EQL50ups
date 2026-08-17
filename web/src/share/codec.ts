/**
 * Share-link codec.
 *
 * A set has to survive as a link with no server behind it, so the whole plan —
 * the character's per-class levels and loadouts, every equipped item, every
 * +N, every exaltation donor and the weight profile — is packed into the URL
 * fragment.
 *
 * ## v2 (current): a binary frame
 *
 * v1 was a positional JSON tuple. It was honest but fat: a full 23-slot set
 * came to 1,348 characters, because JSON spends punctuation on every field,
 * position ids cost nine characters each, and item names are stored in full.
 *
 * v2 writes a byte frame instead:
 *
 *   - positions, classes and socket kinds become one-byte table indices;
 *   - the +N tier is one byte and the banked fraction a varint;
 *   - a weight profile that matches a shipped preset is two bytes;
 *   - item names are interned against a catalog dictionary (`./dictionary`)
 *     when one is supplied, and fall back to literal UTF-8 when it is not, per
 *     item, so a hand-typed name never breaks the link.
 *
 * Decoding is **total**: any malformed payload yields `null` rather than
 * throwing. Decoding is also **lossless** — what goes in comes back exactly,
 * verified by round-trip tests over all 23 positions, unicode names, negative
 * and fractional weights. v1 links still decode; the first byte tells them
 * apart (`[` = 0x5B opens the old JSON, 0x02 opens a v2 frame).
 */

import { CLASSES, CLASS_SET, SLOT_POSITIONS, type ClassCode } from '../engine/constants';
import { PRESET_PROFILES } from '../engine/ep';
import { normalizeState } from '../engine/upgrade';
import {
  DEFAULT_CLASS_LEVEL, buildCharacter, clampLevel, defaultLoadoutName, makeLevels,
  type BuildCharacterInput, type Character, type Loadout,
} from '../engine/character';
import type { EquippedItem, GearSet } from '../engine/types';
import { base64UrlToBytes, bytesToBase64Url, decodeText, encodeText } from '../lib/base64url';
import { ByteReader, ByteWriter } from '../lib/bytes';
import { finite } from '../lib/format';
import { EMPTY_DICTIONARY, lookupName, nameAt, type ShareDictionary } from './dictionary';

/**
 * v3 is v2's frame with a two-byte trailing checksum.
 *
 * Without one, a single mistyped character in a pasted link did not fail — it
 * decoded into a *different, plausible plan*. Two of thirty single-character
 * corruptions of a real 23-item link came back as a valid set with a slot
 * quietly emptied, which for a product whose landing page says "the URL is the
 * product" is the worst possible failure mode: silently wrong beats loudly
 * broken only if nobody is planning around it.
 */
export const SHARE_VERSION = 3;

/** v2 links carry no checksum and are still decoded, unverified. */
export const SHARE_VERSION_NO_CHECKSUM = 2;
/** The version whose links this codec can still read but no longer writes. */
export const LEGACY_SHARE_VERSION = 1;

export interface SharedPlan {
  character: Omit<Character, 'id'>;
  set: Pick<GearSet, 'name' | 'slots' | 'weights' | 'notes'>;
}

const POSITION_IDS: readonly string[] = SLOT_POSITIONS.map((p) => p.id);
const POSITION_INDEX = new Map(POSITION_IDS.map((id, i) => [id, i]));

/**
 * Wire tables. Order here IS the wire format: append only, never reorder, or
 * every link already in a Discord scrollback starts decoding to other items.
 */
const SOCKET_KINDS = ['ornamentation', 'focus', 'click', 'worn', 'proc'] as const;
const WEIGHT_KEYS = [
  'AC', 'HP', 'MANA', 'ENDUR', 'STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA',
  'SV_MAGIC', 'SV_FIRE', 'SV_COLD', 'SV_DISEASE', 'SV_POISON', 'SV_VOID',
  'HASTE', 'ATTACK', 'BACKSTAB', 'RATIO', 'DMG', 'HP_REGEN', 'MANA_REGEN', 'ENDUR_REGEN',
] as const;
const WEIGHT_KEY_INDEX = new Map<string, number>(WEIGHT_KEYS.map((k, i) => [k, i]));

const FLAG_DICTIONARY = 0x01;
const FLAG_NOTES = 0x02;
const FLAG_RACE = 0x04;

const WEIGHTS_PRESET = 0;
const WEIGHTS_EXPLICIT = 1;
const VALUE_SCALED = 0;
const VALUE_TEXT = 1;
/** Weights are carried as thousandths where that is exact, as text when not. */
const WEIGHT_SCALE = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/* ------------------------------------------------------------------ helpers */

/**
 * Loadout ids are not carried on the wire — they are local bookkeeping, and
 * spending bytes on them would be spending them on nothing. Both the encoder
 * and the decoder therefore normalise them to positional ids, which is what
 * makes an encode/decode round trip compare equal.
 */
export function normalizePlanCharacter(character: Omit<Character, 'id'>): Omit<Character, 'id'> {
  const loadouts: Loadout[] = character.loadouts.map((l, i) => {
    const out: Loadout = { id: `l${i}`, name: l.name, classes: [...l.classes] };
    if (l.race !== undefined && l.race !== null) out.race = l.race;
    return out;
  });
  const activeIndex = Math.max(
    0,
    character.loadouts.findIndex((l) => l.id === character.activeLoadoutId),
  );
  return {
    name: character.name,
    race: character.race,
    levels: makeLevels(character.levels),
    loadouts,
    activeLoadoutId: loadouts[activeIndex]?.id ?? loadouts[0]?.id ?? 'l0',
  };
}

/**
 * A plan character built from plain fields — one loadout, positional ids.
 * The identity-free half of `buildCharacter`, for callers assembling a plan
 * rather than a library entry.
 */
export function planCharacter(input: Omit<BuildCharacterInput, 'id'>): Omit<Character, 'id'> {
  return normalizePlanCharacter(buildCharacter({ id: 'plan', ...input }));
}

function sameWeights(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (finite(a[key]) !== finite(b[key])) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ encoder */

function writeItemRef(w: ByteWriter, name: string, dict: ShareDictionary | undefined): void {
  const index = dict ? lookupName(dict, name) : undefined;
  if (index !== undefined) {
    w.varint(index * 2);
    return;
  }
  const bytes = new TextEncoder().encode(name);
  w.varint(bytes.length * 2 + 1);
  w.raw(bytes);
}

function writeWeights(w: ByteWriter, weights: Record<string, number>): void {
  const preset = PRESET_PROFILES.findIndex((p) => sameWeights(p.weights, weights));
  if (preset >= 0) {
    w.u8(WEIGHTS_PRESET);
    w.u8(preset);
    return;
  }
  w.u8(WEIGHTS_EXPLICIT);
  const entries = Object.entries(weights)
    .filter(([, v]) => Number.isFinite(v) && v !== 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  w.varint(entries.length);
  for (const [key, value] of entries) {
    const known = WEIGHT_KEY_INDEX.get(key);
    if (known !== undefined) w.varint(known * 2);
    else {
      const bytes = new TextEncoder().encode(key);
      w.varint(bytes.length * 2 + 1);
      w.raw(bytes);
    }
    const scaled = value * WEIGHT_SCALE;
    if (Number.isSafeInteger(Math.round(scaled)) && Math.abs(scaled - Math.round(scaled)) < 1e-9) {
      w.u8(VALUE_SCALED);
      w.signed(Math.round(scaled));
    } else {
      // Weights are player-typed, so a value the fixed scale cannot hold
      // exactly is carried verbatim rather than quietly rounded.
      w.u8(VALUE_TEXT);
      w.str(String(value));
    }
  }
}

/** Plan -> opaque URL-safe payload. Pass a dictionary for the short form. */
/**
 * FNV-1a, folded to sixteen bits.
 *
 * Not cryptographic and not meant to be: the threat is a truncated paste or a
 * mistyped character, not an adversary. Two bytes catch better than 99.998% of
 * random corruptions for four characters of link.
 */
function checksum16(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash >>> 16) ^ (hash & 0xffff)) & 0xffff;
}

export function encodePlan(plan: SharedPlan, dict?: ShareDictionary): string {
  const character = normalizePlanCharacter(plan.character);
  const useDict = Boolean(dict && dict.names.length);
  const notes = plan.set.notes ?? '';

  const w = new ByteWriter();
  w.u8(SHARE_VERSION);
  w.u8(
    (useDict ? FLAG_DICTIONARY : 0) |
      (notes ? FLAG_NOTES : 0) |
      (character.race ? FLAG_RACE : 0),
  );
  if (useDict && dict) {
    w.u8((dict.key >> 16) & 0xff);
    w.u8((dict.key >> 8) & 0xff);
    w.u8(dict.key & 0xff);
  }

  w.str(character.name);
  if (character.race) w.str(character.race);

  // Only levels that differ from the floor travel; the rest are implied.
  const levelEntries = CLASSES.map((code, i) => [i, character.levels[code]] as const).filter(
    ([, level]) => level !== DEFAULT_CLASS_LEVEL,
  );
  w.varint(levelEntries.length);
  for (const [index, level] of levelEntries) {
    w.u8(index);
    w.varint(level);
  }

  w.varint(character.loadouts.length);
  for (const loadout of character.loadouts) {
    w.str(loadout.name);
    const codes = loadout.classes.filter((c) => CLASS_SET.has(c));
    w.varint(codes.length);
    for (const code of codes) w.u8(CLASSES.indexOf(code));
    if (loadout.race) {
      w.u8(1);
      w.str(loadout.race);
    } else w.u8(0);
  }
  w.varint(Math.max(0, character.loadouts.findIndex((l) => l.id === character.activeLoadoutId)));

  w.str(plan.set.name);
  if (notes) w.str(notes);

  const slots = SLOT_POSITIONS.map((position) => ({
    position,
    equipped: plan.set.slots[position.id],
  })).filter((entry): entry is { position: (typeof SLOT_POSITIONS)[number]; equipped: EquippedItem } =>
    Boolean(entry.equipped?.itemName),
  );

  w.varint(slots.length);
  for (const { position, equipped } of slots) {
    w.u8(POSITION_INDEX.get(position.id) ?? 0);
    const state = normalizeState(equipped.upgrade);
    w.u8(state.full);
    w.varint(state.fraction);
    writeItemRef(w, equipped.itemName, useDict ? dict : undefined);

    const sockets = Object.entries(equipped.exaltations ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
      .sort((a, b) => a[0].localeCompare(b[0]));
    w.varint(sockets.length);
    for (const [kind, donor] of sockets) {
      const index = SOCKET_KINDS.indexOf(kind as (typeof SOCKET_KINDS)[number]);
      if (index >= 0) w.u8(index);
      else {
        w.u8(0xff);
        w.str(kind);
      }
      writeItemRef(w, donor, useDict ? dict : undefined);
    }
  }

  writeWeights(w, plan.set.weights);
  const body = w.finish();
  const sum = checksum16(body);
  const framed = new Uint8Array(body.length + 2);
  framed.set(body, 0);
  framed[body.length] = (sum >> 8) & 0xff;
  framed[body.length + 1] = sum & 0xff;
  return bytesToBase64Url(framed);
}

/* ------------------------------------------------------------------ decoder */

export type DecodeFailure =
  | 'malformed'
  | 'unsupported-version'
  /** The bytes parse, but the trailing checksum does not match them. */
  | 'corrupt'
  /** The link interned its item names against a catalog build we do not have. */
  | 'catalog-mismatch';

export interface DecodeResult {
  plan: SharedPlan | null;
  failure?: DecodeFailure;
}

function readItemRef(r: ByteReader, dict: ShareDictionary | undefined): string | null {
  const tag = r.varint();
  if (tag % 2 === 1) return new TextDecoder().decode(r.raw((tag - 1) / 2));
  if (!dict) return null;
  return nameAt(dict, tag / 2) ?? null;
}

function readWeights(r: ByteReader): Record<string, number> {
  const mode = r.u8();
  if (mode === WEIGHTS_PRESET) {
    const index = r.u8();
    return { ...(PRESET_PROFILES[index]?.weights ?? {}) };
  }
  const out: Record<string, number> = {};
  const count = r.varint();
  for (let i = 0; i < count; i++) {
    const tag = r.varint();
    const key =
      tag % 2 === 1
        ? new TextDecoder().decode(r.raw((tag - 1) / 2))
        : (WEIGHT_KEYS[tag / 2] ?? '');
    const kind = r.u8();
    const value = kind === VALUE_TEXT ? Number(r.str()) : r.signed() / WEIGHT_SCALE;
    if (key && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function decodeV2(bytes: Uint8Array, dict: ShareDictionary | undefined): DecodeResult {
  const r = new ByteReader(bytes);
  r.u8(); // version, already inspected
  const flags = r.u8();
  const usesDict = (flags & FLAG_DICTIONARY) !== 0;

  let available = dict;
  if (usesDict) {
    const key = (r.u8() << 16) | (r.u8() << 8) | r.u8();
    if (!dict || dict.key !== key) available = undefined;
  }

  const name = r.str();
  const race = (flags & FLAG_RACE) !== 0 ? r.str() : null;

  const levels: Partial<Record<string, number>> = {};
  const levelCount = r.varint();
  for (let i = 0; i < levelCount; i++) {
    const code = CLASSES[r.u8()];
    const level = clampLevel(r.varint());
    if (code) levels[code] = level;
  }

  const loadouts: Loadout[] = [];
  const loadoutCount = r.varint();
  for (let i = 0; i < loadoutCount; i++) {
    const loadoutName = r.str();
    const classCount = r.varint();
    const classes: ClassCode[] = [];
    for (let c = 0; c < classCount; c++) {
      const code = CLASSES[r.u8()];
      if (code && !classes.includes(code)) classes.push(code);
    }
    const loadout: Loadout = {
      id: `l${i}`,
      name: loadoutName || defaultLoadoutName(i),
      classes: classes.slice(0, 3),
    };
    if (r.u8() === 1) loadout.race = r.str();
    loadouts.push(loadout);
  }
  const activeIndex = r.varint();
  if (!loadouts.length) {
    loadouts.push({ id: 'l0', name: defaultLoadoutName(0), classes: [] });
  }

  const setName = r.str();
  const notes = (flags & FLAG_NOTES) !== 0 ? r.str() : '';

  const slots: Record<string, EquippedItem | undefined> = {};
  let unresolved = 0;
  const slotCount = r.varint();
  for (let i = 0; i < slotCount; i++) {
    const positionId = POSITION_IDS[r.u8()];
    const full = r.u8();
    const fraction = r.varint();
    const itemName = readItemRef(r, available);
    if (itemName === null) unresolved++;

    const exaltations: Record<string, string> = {};
    const socketCount = r.varint();
    for (let s = 0; s < socketCount; s++) {
      const kindByte = r.u8();
      const kind = kindByte === 0xff ? r.str() : (SOCKET_KINDS[kindByte] ?? '');
      const donor = readItemRef(r, available);
      if (donor === null) unresolved++;
      if (kind && donor) exaltations[kind] = donor;
    }

    if (!positionId || !itemName) continue;
    const equipped: EquippedItem = { itemName, upgrade: normalizeState({ full, fraction }) };
    if (Object.keys(exaltations).length) equipped.exaltations = exaltations;
    slots[positionId] = equipped;
  }

  const weights = readWeights(r);

  // Item names that the link interned but this build cannot look up would come
  // back as holes. Refusing beats handing someone a set with items missing and
  // no sign that anything was lost.
  if (unresolved > 0) return { plan: null, failure: 'catalog-mismatch' };

  const plan: SharedPlan = {
    character: {
      name: name.trim() ? name : 'Shared Character',
      race: race && race !== '' ? race : null,
      levels: makeLevels(levels),
      loadouts,
      activeLoadoutId: (loadouts[activeIndex] ?? loadouts[0] as Loadout).id,
    },
    set: { name: setName.trim() ? setName : 'Shared Set', slots, weights },
  };
  if (notes) plan.set.notes = notes;
  return { plan };
}

/* --------------------------------------------------------- legacy v1 decode */

type SocketTuple = [string, string];
type SlotTuple = [string, string, number, number] | [string, string, number, number, SocketTuple[]];
type WeightTuple = [string, number];
type PlanTupleV1 = [
  number, string, number, string | null, string, string, SlotTuple[], WeightTuple[], string,
];

/**
 * Unpack a v1 tuple. Kept because links made before the model rework are in
 * people's chat history, and a share link that stops working is a share link
 * that was never worth making.
 *
 * A v1 character had one level and one trio; it becomes a character whose
 * single loadout is that trio and whose per-class levels are that level for
 * each class in it — the same reading the old header gave.
 */
export function fromTupleV1(raw: unknown): SharedPlan | null {
  if (!Array.isArray(raw) || raw.length < 7) return null;
  const [version, name, level, race, classes, setName, slotList, weightList, notes] = raw as [
    unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown,
  ];
  if (finite(version) !== LEGACY_SHARE_VERSION) return null;

  const slots: Record<string, EquippedItem | undefined> = {};
  if (Array.isArray(slotList)) {
    for (const entry of slotList) {
      if (!Array.isArray(entry)) continue;
      const [positionId, itemName, full, fraction, sockets] = entry as [
        unknown, unknown, unknown, unknown, unknown,
      ];
      if (typeof positionId !== 'string' || !POSITION_INDEX.has(positionId)) continue;
      if (typeof itemName !== 'string' || itemName === '') continue;
      const equipped: EquippedItem = {
        itemName,
        upgrade: normalizeState({ full: finite(full), fraction: finite(fraction) }),
      };
      if (Array.isArray(sockets)) {
        const exaltations: Record<string, string> = {};
        for (const socket of sockets) {
          if (!Array.isArray(socket)) continue;
          const [kind, donor] = socket as [unknown, unknown];
          if (typeof kind === 'string' && typeof donor === 'string' && donor !== '') {
            exaltations[kind] = donor;
          }
        }
        if (Object.keys(exaltations).length) equipped.exaltations = exaltations;
      }
      slots[positionId] = equipped;
    }
  }

  const weights: Record<string, number> = {};
  if (Array.isArray(weightList)) {
    for (const entry of weightList) {
      if (!Array.isArray(entry)) continue;
      const [key, value] = entry as [unknown, unknown];
      if (typeof key !== 'string' || key === '') continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      weights[key] = value;
    }
  }

  // A stranger's URL: keep only real class codes, and only one of each, so a
  // hand-edited link cannot produce a trio the character model forbids.
  const classList = (
    typeof classes === 'string'
      ? [
          ...new Set(
            classes
              .split('/')
              .map((c) => c.trim().toUpperCase())
              .filter((c) => CLASS_SET.has(c)),
          ),
        ].slice(0, 3)
      : []
  ) as ClassCode[];

  const characterLevel = clampLevel(finite(level, 50));
  const levels: Partial<Record<string, number>> = {};
  for (const code of classList) levels[code] = characterLevel;

  const plan: SharedPlan = {
    character: {
      name: typeof name === 'string' && name.trim() ? name : 'Shared Character',
      race: typeof race === 'string' && race !== '' ? race : null,
      levels: makeLevels(levels),
      loadouts: [{ id: 'l0', name: defaultLoadoutName(0), classes: classList }],
      activeLoadoutId: 'l0',
    },
    set: {
      name: typeof setName === 'string' && setName.trim() ? setName : 'Shared Set',
      slots,
      weights,
    },
  };
  if (typeof notes === 'string' && notes !== '') plan.set.notes = notes;
  return plan;
}

/** Pack a plan in the retired v1 shape. Exists so the v1 reader stays tested. */
export function toTupleV1(plan: SharedPlan): PlanTupleV1 {
  const slots: SlotTuple[] = [];
  for (const position of SLOT_POSITIONS) {
    const equipped = plan.set.slots[position.id];
    if (!equipped?.itemName) continue;
    const state = normalizeState(equipped.upgrade);
    const sockets: SocketTuple[] = Object.entries(equipped.exaltations ?? {})
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
      .sort((a, b) => a[0].localeCompare(b[0]));
    slots.push(
      sockets.length
        ? [position.id, equipped.itemName, state.full, state.fraction, sockets]
        : [position.id, equipped.itemName, state.full, state.fraction],
    );
  }
  const weights: WeightTuple[] = Object.entries(plan.set.weights)
    .filter(([, v]) => Number.isFinite(v) && v !== 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => [k, v]);

  const loadout = plan.character.loadouts[0];
  const primary = loadout?.classes[0];
  return [
    LEGACY_SHARE_VERSION,
    plan.character.name,
    primary ? (plan.character.levels[primary] ?? DEFAULT_CLASS_LEVEL) : DEFAULT_CLASS_LEVEL,
    plan.character.race,
    (loadout?.classes ?? []).join('/'),
    plan.set.name,
    slots,
    weights,
    plan.set.notes ?? '',
  ];
}

export function encodePlanV1(plan: SharedPlan): string {
  return encodeText(JSON.stringify(toTupleV1(plan)));
}

/* ---------------------------------------------------------------- dispatch */

/** Payload -> plan plus a reason when it could not be read. Never throws. */
export function decodePlanDetailed(payload: string, dict?: ShareDictionary): DecodeResult {
  if (!payload) return { plan: null, failure: 'malformed' };
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(payload);
  } catch {
    return { plan: null, failure: 'malformed' };
  }
  if (!bytes.length) return { plan: null, failure: 'malformed' };

  try {
    const first = bytes[0];
    if (first === SHARE_VERSION) {
      if (bytes.length < 3) return { plan: null, failure: 'malformed' };
      const body = bytes.subarray(0, bytes.length - 2);
      const carried = ((bytes[bytes.length - 2] as number) << 8) | (bytes[bytes.length - 1] as number);
      // A link that does not check out is refused outright. Decoding it anyway
      // is how a corrupted paste becomes a different, plausible-looking plan.
      if (checksum16(body) !== carried) return { plan: null, failure: 'corrupt' };
      return decodeV2(body, dict);
    }
    if (first === SHARE_VERSION_NO_CHECKSUM) return decodeV2(bytes, dict);
    // 0x5B is `[`: a v1 payload is JSON.
    if (first === 0x5b) {
      const parsed: unknown = JSON.parse(decodeText(payload));
      const plan = fromTupleV1(parsed);
      return plan ? { plan } : { plan: null, failure: 'malformed' };
    }
    return { plan: null, failure: 'unsupported-version' };
  } catch {
    return { plan: null, failure: 'malformed' };
  }
}

/** Payload -> plan, or null for anything malformed. */
export function decodePlan(payload: string, dict?: ShareDictionary): SharedPlan | null {
  return decodePlanDetailed(payload, dict).plan;
}

/** The hash a share link uses, e.g. `#/share/Ag…`. */
export function shareHash(plan: SharedPlan, dict?: ShareDictionary): string {
  return `#/share/${encodePlan(plan, dict)}`;
}

/** Absolute share URL for the current document, if there is one. */
export function shareUrl(plan: SharedPlan, dict?: ShareDictionary, origin?: string): string {
  const base =
    origin ??
    (typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}${window.location.search}`);
  return `${base}${shareHash(plan, dict)}`;
}

/** Build a shareable plan from live app state. */
export function planFrom(character: Character, set: GearSet): SharedPlan {
  const plan: SharedPlan = {
    character: normalizePlanCharacter(character),
    set: { name: set.name, slots: { ...set.slots }, weights: { ...set.weights } },
  };
  if (set.notes) plan.set.notes = set.notes;
  return plan;
}

/**
 * Versioned export envelope, shared by the JSON download and the file import.
 * Kept structurally separate from the URL codec: exports favour readability,
 * links favour bytes.
 */
export interface ExportEnvelope {
  format: 'eql-upgrades';
  version: number;
  exportedAt: string;
  characters: Character[];
  sets: GearSet[];
}

export function isExportEnvelope(value: unknown): value is ExportEnvelope {
  return (
    isRecord(value) &&
    value.format === 'eql-upgrades' &&
    Array.isArray(value.characters) &&
    Array.isArray(value.sets)
  );
}

export { EMPTY_DICTIONARY, type ShareDictionary };
