/**
 * Item presentation rules: the colour an item's name takes, and the labels
 * that ride alongside it.
 *
 * **There are no rarity tiers in EverQuest Legends**, so a WoW-style
 * grey/green/blue/purple ladder would be imported nonsense. The client instead
 * tints an item's name by whether *this character* can use it. On the sampled
 * Bard/Warrior/Berserker, Monk-only "Whitened Treant Fists" renders red while
 * Earthshaker, Cloak of Flames and Bone-Clasped Girdle — each qualifying
 * through one of the trio — render green.
 *
 * That is what we reproduce, driven by the active loadout: an item a class in
 * the trio qualifies for is `--item-usable`, one that none of them qualifies
 * for is `--item-blocked`, and when there is no character to judge against
 * (the item browser with no class filter, a share link's read-only view) the
 * name is simply plain. `--item-caution` maps to an unexplained third client
 * state and stays deliberately unused.
 */

import { canUse, type LoadoutContext } from '../engine/character';
import type { Item } from '../engine/types';

export type Usability = 'usable' | 'blocked' | 'unjudged';

/** Restriction shape `canUse` wants, built from a catalog item. */
function restrictionsOf(item: Item) {
  return { classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) };
}

export function usabilityOf(item: Item, context: LoadoutContext | undefined): Usability {
  if (!context || !context.classes.length) return 'unjudged';
  return canUse(restrictionsOf(item), context) ? 'usable' : 'blocked';
}

/** The colour an item name takes on every surface. */
export function itemNameColor(item: Item, context: LoadoutContext | undefined): string {
  const state = usabilityOf(item, context);
  if (state === 'usable') return 'var(--item-usable)';
  if (state === 'blocked') return 'var(--item-blocked)';
  return 'var(--item-neutral)';
}

/**
 * Why an item is tinted the way it is, for a tooltip or an assistive label.
 * Silent when there is no character to judge against.
 */
export function usabilityNote(item: Item, context: LoadoutContext | undefined): string | null {
  const state = usabilityOf(item, context);
  if (state === 'unjudged') return null;
  if (state === 'usable') return 'Usable by this loadout';
  return 'This loadout cannot equip it';
}

/**
 * The era badge, and only when the era is actually known.
 *
 * A missing era used to render as `ERA UNKNOWN` in an amber outlined badge —
 * the loudest treatment in the row, spent on the absence of data. Amber is
 * reserved for real era/phase labels (§A6); a null is simply absent.
 */
export function eraLabel(item: Item): string | null {
  return item.era ? item.era : null;
}

const FLAG_LABELS: Record<string, string> = {
  MAGIC: 'Magic',
  LORE: 'Lore',
  LORE_ITEM: 'Lore',
  NO_DROP: 'No Drop',
  NO_TRADE: 'No Trade',
  TEMPORARY: 'Temporary',
  QUEST: 'Quest',
  EXPENDABLE: 'Expendable',
  ATTUNEABLE: 'Attuneable',
  NO_RENT: 'No Rent',
  ARTIFACT: 'Artifact',
  LORE_EQUIPPED: 'Lore',
  PLACEABLE: 'Placeable',
  FIXTURE: 'Fixture',
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ').toLowerCase();
}

/**
 * Flags as they should be shown: de-duplicated by label.
 *
 * `LORE` and `LORE_EQUIPPED` are both "Lore" to a reader and used to render as
 * two adjacent identical-looking tags on the same row.
 */
export function displayFlags(flags: readonly string[]): string[] {
  const out: string[] = [];
  for (const flag of flags) {
    const label = flagLabel(flag);
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

export function sourceSummary(item: Item): string | null {
  const src = item.src;
  if (!src) return null;
  const parts: string[] = [];
  if (src.z?.length) parts.push(src.z.slice(0, 2).join(', '));
  if (src.m?.length) parts.push(src.m.slice(0, 2).join(', '));
  if (src.q?.length) parts.push(`Quest: ${src.q[0]}`);
  if (src.v?.length) parts.push(`Vendor: ${src.v[0]}`);
  if (src.c) parts.push('Crafted');
  return parts.length ? parts.join(' · ') : null;
}
