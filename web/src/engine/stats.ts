/**
 * Stat aggregation.
 *
 * Produces the same groups the client's Stats window shows, so the planner's
 * numbers can be compared against the game line by line.
 */

import {
  ATTRIBUTES, SAVES, ATTRIBUTE_CAP, RESIST_CAP,
  HEROIC_MODS, SPELL_MODS, SKILL_DAMAGE_MODS,
  type Attribute, type Save,
} from './constants';
import { scalePrimary, scaleDamage, scaleFlat, scaleWeight, voidBonus, damageRatio } from './upgrade';
import type { Item, EquippedItem } from './types';

/* --------------------------------------------------- haste, and what it isn't */

/**
 * Haste is the one figure in this app whose **unit is not established**, and
 * every surface that prints it says so from here rather than from its own copy
 * of the sentence.
 *
 * The repository's own contamination scanner (`pipeline/contamination.mjs`,
 * signature `haste-pct`) counts 27 unmarked classic haste figures in what this
 * project ships, 5 of them in our own source. This is the record of what is
 * known, what is not, and what one screenshot would settle.
 *
 * **What is measured (Tier M).** The client's Stats window has a row headed
 * `Attack Speed %` (`research/validation/UI-REFERENCE.md` §B3), so the *total*
 * the game shows a player is a percentage. Separately, Cloak of Flames reads
 * HASTE 36 at +0 and was observed at 43 at +7 in a live client window
 * (`TIER0-VALIDATION.md` §5): the per-item figure scales as a flat additive
 * quantity through exaltation.
 *
 * **What is not.** Whether the per-item number this catalog carries *is* that
 * percentage. Classic haste was a percentage that divided weapon delay. The
 * eqltools/eqlwiki Haste Guide says Legends uses flat attack-speed values under
 * a level-scaled cap; eqlwiki's own item field is still documented as "worn
 * haste %". The two best sources in the field disagree, and every haste figure
 * in this catalog is scraped from the one that still says percentage.
 *
 * **So we print the number and refuse to print the unit.** Not a percent sign,
 * which would assert the disputed reading; not a blank, which would hide a
 * figure the catalog holds; not zero, which would be an invention. The figure,
 * marked, with this attached — the site's own rule that a classic figure
 * carrying a badge is doing its job and the same figure printed bare is the
 * fault this project exists to prevent.
 */
export const HASTE_PROVENANCE = {
  /** Chip text wherever the figure appears. Short enough for a 112px tile. */
  chip: 'Classic unit',
  /** One line, for a `title` on a surface with no room for the paragraph. */
  short:
    'The number is the wiki’s classic haste field. Whether Legends reads it as a percentage or as a flat attack-speed value is unsettled, so no unit is printed.',
  classic:
    'Classic: haste was a percentage that divided weapon delay, and the number on the item was the number in the tooltip.',
  legends:
    'Legends: the eqltools Haste Guide describes flat attack-speed values under a level-scaled cap, while eqlwiki still documents its own item field as “worn haste %”. The two best sources disagree, and every haste figure here is scraped from the one that still says percentage.',
  /** The contamination page's device: name the evidence that would end it. */
  settle:
    'One screenshot settles it: a Legends item tooltip showing its haste line beside the character’s Attack Speed reading, on a character wearing that item and nothing else hasted.',
} as const;

/**
 * "Only the single highest worn haste applies; they do not sum."
 *
 * This app applies that rule — in `computeTotals` below and, since it must be
 * the same rule in both places, in `ep.ts`'s scoring. It is stated here because
 * **it is an assumption and not a measurement**, and an assumption applied
 * silently is indistinguishable from a fact.
 *
 * Its standing: classic EverQuest worked this way, and the eqltools Haste Guide
 * says Legends does too — a named community guide, Tier 3 under
 * `research/SOURCING-STANDARD.md`, which is corroboration and not observation.
 * Nothing in this repository has measured two hasted items on one character.
 *
 * The alternative was to sum them, which is not a neutral fallback: it is the
 * other candidate answer, asserted. Choosing the corroborated one and labelling
 * it is the only move here that adds no claim of its own.
 */
/**
 * The haste ceiling this app does not model.
 *
 * **Every other capped stat on this panel prints a denominator.** Attributes
 * show `value/510`, saves `value/1000`, the ten heroic mods their own caps —
 * all Tier M, read off the client's Stats window. `Atk Speed` prints a bare
 * number, and that asymmetry is not a design choice. It is a gap.
 *
 * Our own source names the cap. `research/eql-itemization.md`:
 *
 *   **[SINGLE-SOURCE (eqltools/eqlwiki Haste Guide)]** … Total haste capped
 *   ~**50% below L30, ~75% at L50**; only the highest worn-haste item counts;
 *   item/spell/song haste of different types stack …
 *
 * **We took the middle clause and left the other two.** `HASTE_STACKING` below
 * is that middle clause. `HASTE_PROVENANCE` above even quotes the cap back at
 * the reader — *"flat attack-speed values under a level-scaled cap"* — inside a
 * constant whose whole job is to say what is unknown. Then nothing caps
 * anything: a grep for a haste cap in `web/src` returns zero.
 *
 * **Why it is marked rather than modelled.** The figure is Tier 5 and
 * level-scaled, and this planner has no confirmed level→cap curve — inventing
 * one is the fault this project exists to prevent. Two of the three clauses in
 * that sentence are also unverified in their own right, so applying a cap would
 * mean building on an unmeasured rule to fix an unmeasured omission.
 *
 * **Why it matters more than the missing denominator suggests.** 23 catalogue
 * items carry haste, and under the shipped Melee DPS profile a belt at +10 is
 * the single largest EP any item can earn — larger than the best weapon in the
 * game. If the cited source is right that item, spell and song haste share one
 * ceiling, a trio holding a Bard, Shaman or Enchanter is at or near it before
 * equipping anything, and all 23 are ranked as though their full figure lands.
 */
export const HASTE_CAP_STANDING = {
  chip: 'Tier 5 rule',
  rule: 'The game caps total haste. This planner does not model that cap.',
  short:
    'Every other capped stat here prints a denominator, read off the client. This one does not, because the cap is level-scaled and no confirmed curve exists — so the figure above is what your gear offers, not necessarily what you would feel.',
  standing:
    'Named by one community guide, never measured here, and applied nowhere in this app. Tier 5, and the omission is deliberate: guessing a level→cap curve would be inventing the number this project exists not to invent.',
  settle:
    'Two readings settle it: a character’s Attack Speed with enough worn haste to be near the ceiling, beside the same reading with a haste song or spell also running. research/validation/CAPTURE-REQUESTS.md §3 is the instruction.',
} as const;

export const HASTE_STACKING = {
  chip: 'Classic rule',
  rule: 'Only the highest worn haste counts. They do not add up.',
  standing:
    'Assumed, not measured. Classic EverQuest worked this way and the eqltools Haste Guide says Legends does too — a named community guide, which corroborates rather than observes. No session in this repository has put two hasted items on one character.',
  settle:
    'One screenshot settles it: a character’s Attack Speed reading with two hasted items worn, beside the same reading with one.',
} as const;

export interface StatTotals {
  attributes: Record<Attribute, number>;
  saves: Record<Save, number>;
  ac: number;
  hp: number;
  mana: number;
  endurance: number;
  /**
   * The highest single worn haste figure — see `HASTE_STACKING`. Carries no
   * unit; see `HASTE_PROVENANCE` before printing one beside it.
   */
  haste: number;
  /**
   * How many worn items carry a haste figure at all.
   *
   * Exists so a panel can say "two items carry one, the larger is counted"
   * rather than showing a total that silently discards the other. Without it
   * the highest-wins rule is invisible on exactly the sets where it changes the
   * answer.
   */
  hasteSources: number;
  attack: number;
  hpRegen: number;
  manaRegen: number;
  endRegen: number;
  weight: number;
  heroic: Record<string, number>;
  spellMods: Record<string, number>;
  skillMods: Record<string, number>;
  weapons: { primary?: WeaponSummary; secondary?: WeaponSummary };
}

export interface WeaponSummary {
  name: string;
  damage: number;
  delay: number;
  ratio: number;
  skill?: string;
  bonus?: number;
}

function emptyTotals(): StatTotals {
  const attributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>;
  const saves = Object.fromEntries(SAVES.map((s) => [s, 0])) as Record<Save, number>;
  return {
    attributes, saves,
    ac: 0, hp: 0, mana: 0, endurance: 0, haste: 0, hasteSources: 0, attack: 0,
    hpRegen: 0, manaRegen: 0, endRegen: 0, weight: 0,
    heroic: Object.fromEntries(HEROIC_MODS.map((m) => [m.key, 0])),
    spellMods: Object.fromEntries(SPELL_MODS.map((m) => [m.key, 0])),
    skillMods: Object.fromEntries(SKILL_DAMAGE_MODS.map((m) => [m.key, 0])),
    weapons: {},
  };
}

/**
 * Spellings the corpus uses for each save, in priority order.
 *
 * A save is read **once** per item: the first spelling present wins and the
 * rest are ignored. Summing the aliases instead — which is what an
 * alias-to-canonical map invites — silently triples a resist on any payload
 * that carries two spellings, and the normaliser deliberately accepts several
 * input shapes, so that payload is reachable.
 */
const SAVE_ALIASES: Readonly<Record<Save, readonly string[]>> = {
  MAGIC: ['SV MAGIC', 'SV_MAGIC', 'MAGIC'],
  FIRE: ['SV FIRE', 'SV_FIRE', 'FIRE'],
  COLD: ['SV COLD', 'SV_COLD', 'COLD'],
  DISEASE: ['SV DISEASE', 'SV_DISEASE', 'DISEASE'],
  POISON: ['SV POISON', 'SV_POISON', 'POISON'],
  VOID: ['SV VOID', 'SV_VOID', 'VOID'],
};

/**
 * The one base value an item declares for a save, under any spelling.
 *
 * Reads the two maps in place rather than through a merged copy. `st` wins over
 * `sv` for the same spelling, which is what `{...sv, ...st}` meant — including
 * for an explicit zero, which shadows the other map's value and sends the
 * lookup on to the next alias exactly as before. Building that merged object
 * cost two spreads per item, on every rank of every slot.
 */
function baseSave(st: Record<string, number>, sv: Record<string, number>, save: Save): number {
  for (const alias of SAVE_ALIASES[save]) {
    const value = st[alias] ?? sv[alias];
    if (value) return value;
  }
  return 0;
}

/**
 * Flat additive stat keys, with every spelling the corpus and the pipeline use.
 * `ENDUR_REGEN` is the pipeline's vocabulary; `END_REGEN` is kept as an alias
 * so an older payload still resolves.
 */
export const FLAT_KEYS = [
  'HASTE',
  'REGEN', 'HP_REGEN',
  'MANA REGEN', 'MANA_REGEN',
  'END_REGEN', 'ENDUR_REGEN',
] as const;

/**
 * Stat keys carried into the totals **at their base value**, never scaled.
 *
 * `research/github-data-inventory.md:56` — the only rule table this tree cites
 * for +N behaviour — has a *flat* row (`base + full`) and an *unchanged* row
 * that reads "heroic stats, Attack, Dmg Bon, Backstab, Range, Size, Rec Level,
 * charges, effect magnitudes: untouched". `ATTACK` sat in `FLAT_KEYS` until
 * 2026-08-31 against that table and against every other source in `research/`,
 * which say nothing at all about it scaling.
 *
 * It inflated nothing while it sat there — 0 of 4,004 shipped records carry the
 * key — but `build.mjs` parses `ATTACK`, so it would have begun scaling
 * silently the day any source supplied one. It stays in this list rather than
 * being deleted outright because `totals.attack` reads it: dropping the key
 * would have stopped the scaling by stopping the reporting, which is a
 * different bug wearing the fix's clothes.
 */
export const UNCHANGED_KEYS = ['ATTACK'] as const;

/**
 * Which stat keys on an item can trigger the synthetic Void save.
 *
 * Stops at two, because that is where `voidBonus` stops counting: the rule is
 * "at least two distinct qualifying fields", and every key this yields is
 * already distinct by construction, so collecting all thirteen and de-duping
 * them through a Set was work with no reader.
 */
function voidTriggerKeys(st: Record<string, number>, sv: Record<string, number>): string[] {
  const keys: string[] = [];
  for (const a of ATTRIBUTES) {
    if (st[a]) {
      keys.push(a);
      if (keys.length >= 2) return keys;
    }
  }
  for (const save of SAVES) {
    if (save === 'VOID') continue;
    if (baseSave(st, sv, save)) {
      keys.push(`SV_${save}`);
      if (keys.length >= 2) return keys;
    }
  }
  return keys;
}

/**
 * One save's resolved value, or `null` when the item declares nothing for it.
 *
 * SV Void is synthesised from the tier, and two catalog rows (Anthemion
 * Armbands, Darkspun Shroud) also *print* a Void line — pipeline/README.md §6
 * reads those two wiki pages as captures of already-upgraded items, and their
 * printed values are exactly what the synthetic rule yields at the tier named
 * in that note (+2 and +1). The two therefore describe one line, not two, so
 * they are reconciled with `max` and never added together. Summing them
 * overstated Anthemion's Void by 12 at +10.
 *
 * Exported so the ranking scorer resolves a save exactly the way the stat panel
 * does, rather than carrying a second copy of this rule.
 */
export function resolvedSave(
  st: Record<string, number>,
  sv: Record<string, number>,
  save: Save,
  upgrade: EquippedItem['upgrade'],
): number | null {
  const base = baseSave(st, sv, save);
  // `voidBonus` is zero below +1 and its trigger scan is the most expensive
  // read in this file, so at +0 — where every catalog row starts — it is not
  // run at all.
  const bonus = save === 'VOID' && upgrade.full > 0 ? voidBonus(voidTriggerKeys(st, sv), upgrade) : 0;
  if (!base && !bonus) return null;
  return Math.max(base ? scalePrimary(base, upgrade) : 0, bonus);
}

/**
 * Resolve one item's contribution at its chosen upgrade level.
 *
 * The catalog omits empty containers to keep the payload small, so every
 * optional collection is read defensively rather than assumed present.
 */
export function resolveItem(item: Item, upgrade: EquippedItem['upgrade']) {
  const st: Record<string, number> = item.st ?? {};
  const sv: Record<string, number> = item.sv ?? {};

  const attributes: Partial<Record<Attribute, number>> = {};
  for (const a of ATTRIBUTES) {
    const base = st[a];
    if (base) attributes[a] = scalePrimary(base, upgrade);
  }

  const saves: Partial<Record<Save, number>> = {};
  for (const save of SAVES) {
    const value = resolvedSave(st, sv, save, upgrade);
    if (value !== null) saves[save] = value;
  }

  const ac = st.AC ? scalePrimary(st.AC, upgrade) : 0;
  const hp = st.HP ? scalePrimary(st.HP, upgrade) : 0;
  const mana = st.MANA ? scalePrimary(st.MANA, upgrade) : 0;
  const enduranceBase = st.ENDUR ?? st.END ?? 0;
  const endurance = enduranceBase ? scalePrimary(enduranceBase, upgrade) : 0;

  const flat: Record<string, number> = {};
  for (const key of FLAT_KEYS) {
    const base = st[key];
    if (base) flat[key] = scaleFlat(base, upgrade);
  }
  // Same map, deliberately: `totals.attack` and the panels read `flat`. The
  // difference is the arithmetic, not the destination — no `upgrade` term here.
  for (const key of UNCHANGED_KEYS) {
    const base = st[key];
    if (base) flat[key] = base;
  }

  // Skill damage modifiers (Backstab, Kick, …) ride in the same stat map, and
  // **they do not scale with +N.** The only rule table this tree cites,
  // `research/github-data-inventory.md:56`, lists Backstab in the *unchanged*
  // row beside Attack and Dmg Bon; nothing in `research/` says otherwise.
  // Until 2026-08-31 these ran through `scaleFlat`, inflating Backstab by one
  // point per tier on the four items that carry it — 13 → 23 at +10 on
  // Serpent's Tooth. `ep.ts` scores them through the `unchanged` plan entry so
  // the two sums stay identical; changing one without the other is the
  // divergence that comment at `ep.ts` is guarding against.
  const skillMods: Record<string, number> = {};
  for (const mod of SKILL_DAMAGE_MODS) {
    const base = st[mod.key];
    if (base) skillMods[mod.key] = base;
  }

  const weapon = item.wp
    ? {
        name: item.n,
        damage: scaleDamage(item.wp.dmg, upgrade),
        delay: item.wp.dly,
        ratio: damageRatio(scaleDamage(item.wp.dmg, upgrade), item.wp.dly),
        skill: item.wp.skill,
        bonus: item.wp.bonus,
      }
    : undefined;

  return {
    attributes, saves, ac, hp, mana, endurance, flat, skillMods, weapon,
    weight: item.wt ? scaleWeight(item.wt, upgrade) : 0,
  };
}

/** Aggregate a full gear set. */
export function computeTotals(
  equipped: ReadonlyArray<{ position: string; item: Item; upgrade: EquippedItem['upgrade'] }>,
): StatTotals {
  const totals = emptyTotals();
  let weightTenths = 0;

  for (const { position, item, upgrade } of equipped) {
    const r = resolveItem(item, upgrade);

    for (const [k, v] of Object.entries(r.attributes)) {
      totals.attributes[k as Attribute] += v ?? 0;
    }
    for (const [k, v] of Object.entries(r.saves)) {
      totals.saves[k as Save] += v ?? 0;
    }
    totals.ac += r.ac;
    totals.hp += r.hp;
    totals.mana += r.mana;
    totals.endurance += r.endurance;
    // Every per-item weight is a one-decimal quantity, so the running total is
    // kept in tenths. Adding the decimals directly accumulated float residue
    // and made the sum depend on the order the positions happened to be in.
    weightTenths += Math.round(r.weight * 10);

    totals.hpRegen += r.flat.REGEN ?? r.flat.HP_REGEN ?? 0;
    totals.manaRegen += r.flat['MANA REGEN'] ?? r.flat.MANA_REGEN ?? 0;
    totals.endRegen += r.flat.ENDUR_REGEN ?? r.flat.END_REGEN ?? 0;
    totals.attack += r.flat.ATTACK ?? 0;

    for (const [k, v] of Object.entries(r.skillMods)) {
      totals.skillMods[k] = (totals.skillMods[k] ?? 0) + v;
    }

    /*
     * Only the single highest worn haste applies; they do not sum. That rule
     * is `HASTE_STACKING` above — an assumption carried from classic and
     * corroborated by a community guide, not something this repository has
     * measured — and `hasteSources` is what lets the panel say so on the sets
     * where it actually changes the total.
     */
    const haste = r.flat.HASTE ?? 0;
    if (haste) {
      totals.hasteSources += 1;
      if (haste > totals.haste) totals.haste = haste;
    }

    if (r.weapon) {
      if (position === 'PRIMARY') totals.weapons.primary = r.weapon;
      else if (position === 'SECONDARY') totals.weapons.secondary = r.weapon;
    }
  }

  totals.weight = weightTenths / 10;
  return totals;
}

export interface CappedValue {
  value: number;
  cap: number;
  overCap: number;
  atCap: boolean;
}

/** Present a value against its ceiling, the way the client does. */
export function withCap(value: number, cap: number): CappedValue {
  const clamped = Math.min(value, cap);
  return {
    value: clamped,
    cap,
    overCap: Math.max(0, value - cap),
    atCap: value >= cap,
  };
}

export function attributeWithCap(totals: StatTotals, attr: Attribute): CappedValue {
  return withCap(totals.attributes[attr], ATTRIBUTE_CAP);
}

export function saveWithCap(totals: StatTotals, save: Save): CappedValue {
  return withCap(totals.saves[save], RESIST_CAP);
}
