/**
 * Exaltations — EverQuest Legends' augment system.
 *
 * Sockets are a function of an item's upgrade level, not a property of the
 * item. Verified two ways: the corpus carries socket data on exactly one of
 * 11,375 items, and a live inventory export shows sub-slots appearing one per
 * upgrade level on four otherwise identical items.
 */

import type { UpgradeState } from './upgrade';
import { normalizeState } from './upgrade';

export type ExaltationKind = 'ornamentation' | 'focus' | 'click' | 'worn' | 'proc';

export interface ExaltationSocket {
  kind: ExaltationKind;
  label: string;
  /** Upgrade tier at which this socket appears. */
  unlockTier: number;
  /** Numeric sub-slot id used by the client's inventory export. */
  exportSlot: number;
}

/**
 * The unlock ladder, confirmed against the client's item window ordering and
 * against sub-slot numbering in an inventory export.
 *
 * Ornamentation is the odd one out: the socket exists from +0, but it is filled
 * with a Marketplace token rather than by transferring an effect, and it is
 * cosmetic only. It therefore contributes nothing to stats.
 */
export const EXALTATION_LADDER: readonly ExaltationSocket[] = [
  { kind: 'ornamentation', label: 'Ornamentation', unlockTier: 0, exportSlot: 2 },
  { kind: 'focus', label: 'Focus Exaltation', unlockTier: 1, exportSlot: 7 },
  { kind: 'click', label: 'Click Exaltation', unlockTier: 2, exportSlot: 8 },
  { kind: 'worn', label: 'Worn Exaltation', unlockTier: 3, exportSlot: 9 },
  { kind: 'proc', label: 'Proc Exaltation', unlockTier: 4, exportSlot: 10 },
];

/** Sockets available on an item at a given upgrade state. */
export function socketsFor(state: UpgradeState): ExaltationSocket[] {
  const { full } = normalizeState(state);
  return EXALTATION_LADDER.filter((s) => full >= s.unlockTier);
}

/** Sockets that actually affect stats — everything but the cosmetic slot. */
export function functionalSocketsFor(state: UpgradeState): ExaltationSocket[] {
  return socketsFor(state).filter((s) => s.kind !== 'ornamentation');
}

/** The effect kinds an item can donate, keyed by the socket they fill. */
export const EFFECT_KIND_TO_SOCKET: Record<string, ExaltationKind> = {
  focus: 'focus',
  click: 'click',
  worn: 'worn',
  proc: 'proc',
  combat: 'proc',
};

export interface ExaltationSource {
  itemName: string;
  kind: ExaltationKind;
  effectName: string;
  detail?: string;
  /** Restrictions inherited from the donor item. */
  classes: string[];
  slots: string[];
}

/**
 * Whether a donor exaltation may be socketed into a host item.
 * The wiki's stated rule is a shared slot plus at least one shared class.
 */
export function canSocket(
  source: Pick<ExaltationSource, 'classes' | 'slots'>,
  host: { classes: string[]; slots: string[] },
): boolean {
  const shareSlot =
    source.slots.length === 0 ||
    host.slots.length === 0 ||
    source.slots.some((s) => host.slots.includes(s));
  if (!shareSlot) return false;

  const sourceAll = source.classes.length === 0 || source.classes.includes('ALL');
  const hostAll = host.classes.length === 0 || host.classes.includes('ALL');
  if (sourceAll || hostAll) return true;
  return source.classes.some((c) => host.classes.includes(c));
}

/**
 * A socketed exaltation intersects its own restrictions onto the host, which
 * can narrow the host out of slots or classes it previously qualified for.
 */
export function intersectRestrictions(
  host: { classes: string[]; slots: string[] },
  sources: ReadonlyArray<Pick<ExaltationSource, 'classes' | 'slots'>>,
): { classes: string[]; slots: string[] } {
  let classes = [...host.classes];
  let slots = [...host.slots];

  for (const src of sources) {
    if (src.classes.length && !src.classes.includes('ALL')) {
      classes = classes.includes('ALL')
        ? [...src.classes]
        : classes.filter((c) => src.classes.includes(c));
    }
    if (src.slots.length) {
      slots = slots.length ? slots.filter((s) => src.slots.includes(s)) : [...src.slots];
    }
  }
  return { classes, slots };
}

/**
 * Focus effects do not stack within a family — only the highest rank counts.
 * Ranks are expressed as Roman numeral suffixes, so "Improved Healing III"
 * supersedes "Improved Healing I".
 */
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

export function parseEffectRank(name: string): { family: string; rank: number } {
  const match = /^(.*?)\s+(I{1,3}|IV|VI?)$/.exec(name.trim());
  if (!match?.[1]) return { family: name.trim(), rank: 1 };
  return { family: match[1], rank: ROMAN[match[2] ?? ''] ?? 1 };
}

/** Collapse a set of effects to the highest rank within each family. */
export function dedupeByFamily<T extends { effectName: string }>(effects: readonly T[]): T[] {
  const best = new Map<string, { rank: number; item: T }>();
  for (const e of effects) {
    const { family, rank } = parseEffectRank(e.effectName);
    const current = best.get(family);
    if (!current || rank > current.rank) best.set(family, { rank, item: e });
  }
  return [...best.values()].map((v) => v.item);
}
