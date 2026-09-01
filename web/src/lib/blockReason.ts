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
 *
 * ## The sentinels, and the sentence that got them backwards
 *
 * A `cl` or `ra` list is not a vocabulary. It carries three sentinels the
 * catalog writes inside the list itself, and this module printed them with
 * `join(', ')` as though they were classes:
 *
 * ```
 *   cl: ["ALL_EXCEPT","ENC","MAG","WIZ"]
 *     was  "it is restricted to ALL_EXCEPT, ENC, MAG, WIZ"
 *     now  "it is open to every class except ENC, MAG, WIZ"
 *   cl: ["NONE"]
 *     was  "it is restricted to NONE"        (reads as: restricted to nothing)
 *     now  "no class can use it"
 * ```
 *
 * The first is not a cosmetic slip. It names a class that does not exist and
 * then states **the exact opposite of who may wear the item** — to a reader who
 * cannot see the gate, the sentence is a confident lie. Counted over the
 * shipped 3,663 records: 255 carry `ALL_EXCEPT` in `cl`, 59 in `ra`, 74 and 84
 * carry `NONE`. `blockReason.test.ts` holds the command and the full tally.
 *
 * The reading is `readRestriction`, in `engine/character.ts`, and it is the
 * same call the eligibility gate makes — so the sentence a reader is shown and
 * the decision they are shown it for cannot disagree.
 */

import {
  canUseClass,
  canUseRace,
  levelCheck,
  readRestriction,
  type LoadoutContext,
} from '../engine/character';
import type { Item } from '../engine/types';

/** The restriction shape the engine's checks want, built from a catalog item. */
function restrictionsOf(item: Item) {
  return { classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) };
}

/**
 * One closed gate, in words, for whichever of `cl` or `ra` closed it.
 *
 * `axis` is the noun ("class"/"race") and `held` is what the loadout actually
 * is, so the reader gets the rule and their own position against it in one
 * breath.
 *
 * The `unrestricted` arm is unreachable and says so rather than inventing
 * wording for it: an empty list or one containing `ALL` passes the gate, so
 * this function is never called for it. The old code had two such arms —
 * `'other classes'` and `'other races'`, reached only when the list was empty —
 * and both were dead for exactly this reason. `blockReason.test.ts` pins that
 * an empty list produces no clause at all, so the deletion is checked rather
 * than assumed.
 */
function clause(list: string[], axis: 'class' | 'race', held: string): string {
  const reading = readRestriction(list);
  switch (reading.kind) {
    case 'none':
      return `no ${axis} can use it`;
    case 'except':
      return `it is open to every ${axis} except ${reading.codes.join(', ')}, and ${held}`;
    case 'only':
      return `it is restricted to ${reading.codes.join(', ')}, and ${held}`;
    case 'unrestricted':
      return `this loadout cannot equip it`;
  }
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
    out.push(clause(item.cl, 'class', `this loadout is ${context.classes.join(', ')}`));
  }
  if (!canUseRace(restrictions, context)) {
    out.push(clause(item.ra, 'race', `this character is ${context.race ?? 'another race'}`));
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
