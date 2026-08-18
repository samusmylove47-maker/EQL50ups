/**
 * Why *this* loadout cannot wear *this* item, in the reader's words.
 *
 * `usabilityOf` answers yes or no; two surfaces now have to answer *why*, and
 * they must not answer it differently or with a guess. The item browser's
 * dialog used to offer EQUIP anyway, and the paper doll marked the refusal with
 * a colour and nothing else — a WCAG 1.4.1 failure on a tab with no legend. The
 * fix for both is the same sentence, so it is written once.
 *
 * `canUse` is class AND race AND level. Naming the wrong gate — "restricted to
 * WAR" on a level-46 sword the Warrior in the trio is simply too low for — is
 * how a reader decides the tool is guessing. So each gate is checked
 * separately and only the ones that actually closed are reported.
 */

import { canUseClass, canUseRace, levelCheck, type LoadoutContext } from '../engine/character';
import type { Item } from '../engine/types';

/** The restriction shape the engine's checks want, built from a catalog item. */
function restrictionsOf(item: Item) {
  return { classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) };
}

/**
 * One clause per closed gate, in the order the client would hit them. Empty
 * when the loadout can wear the item, or when there is no loadout to judge
 * against — a share link opening somebody else's set is not a place to have an
 * opinion about their trio.
 */
export function blockReasons(item: Item, context: LoadoutContext | undefined): string[] {
  if (!context || !context.classes.length) return [];
  const restrictions = restrictionsOf(item);
  const out: string[] = [];

  if (!canUseClass(restrictions, context)) {
    out.push(
      `it is restricted to ${item.cl.length ? item.cl.join(', ') : 'other classes'}, and this loadout is ${context.classes.join(', ')}`,
    );
  }
  if (!canUseRace(restrictions, context)) {
    out.push(
      `it is restricted to ${item.ra.length ? item.ra.join(', ') : 'other races'}, and this character is ${context.race ?? 'another race'}`,
    );
  }
  const level = levelCheck(restrictions, context);
  if (!level.ok) {
    out.push(
      level.via
        ? `it needs level ${level.required} and the qualifying class (${level.via}) is ${level.best}`
        : `it needs level ${level.required} and no class in this loadout qualifies for it`,
    );
  }
  return out;
}

/**
 * The same thing as one sentence, or `null` when nothing is wrong.
 *
 * Falls back to the plain statement rather than to silence: an item can be
 * blocked by a rule these three checks do not model, and "this loadout cannot
 * equip it" is still true and still better than an unexplained red word.
 */
export function blockSentence(item: Item, context: LoadoutContext | undefined): string | null {
  if (!context || !context.classes.length) return null;
  const restrictions = restrictionsOf(item);
  if (canUseClass(restrictions, context) && canUseRace(restrictions, context) && levelCheck(restrictions, context).ok) {
    return null;
  }
  const reasons = blockReasons(item, context);
  return reasons.length ? reasons.join('; and ') : 'this loadout cannot equip it';
}
