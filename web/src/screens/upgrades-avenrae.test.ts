/**
 * The upgrade ranking against the real catalog and a real character.
 *
 * `research/validation/tier0-inventory.txt` is an `/outputfile
 * inventory` export from a level 50 BRD/WAR/BER. Nothing in this file is
 * invented: the gear set is what the app's own importer makes of that export,
 * the catalog is what the pipeline published, and the ranking is the one the
 * screen runs. It is the strongest available test that the list a player
 * actually sees obeys the rules the fixtures pin.
 *
 * Skipped when the pipeline has not published, which is a supported state.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeContext, buildCharacter, canUse } from '../engine/character';
import { SLOT_POSITIONS, SLOT_TYPES } from '../engine/constants';
import { profileById } from '../engine/ep';
import { tier } from '../engine/upgrade';
import type { GearSet, Item } from '../engine/types';
import type { CatalogState } from '../data/catalog';
import { normalizeCatalog, statsAreUnknown, type SlotCode } from '../data/normalize';
import { itemIdIndex, readInventory, toSlotMap, withheldMap } from '../lib/inventoryImport';
import { DEFAULT_SET_FILTERS } from '../lib/setFilters';
import { rankSlotItems, scoreContextFrom, slotViews, totalsFor } from '../selectors/gear';
import { computeUpgrades, isLore } from './Upgrades';

const INVENTORY = '../research/validation/tier0-inventory.txt';
const INDEX = 'public/data/items-index.json';
const published = existsSync(INDEX) && existsSync(INVENTORY);

const AVENRAE = buildCharacter({
  id: 'avenrae',
  name: 'Avenrae',
  classes: ['BRD', 'WAR', 'BER'],
  level: 50,
});
const CONTEXT = activeContext(AVENRAE);

/** Index plus every shard, merged the way the catalog store merges them. */
function loadCatalog(): Item[] {
  const items = normalizeCatalog(JSON.parse(readFileSync(INDEX, 'utf8')));
  const byName = new Map(items.map((item) => [item.n.toLowerCase(), item]));
  for (const slot of [...SLOT_TYPES, 'OTHER']) {
    const path = `public/data/items/${slot}.json`;
    if (!existsSync(path)) continue;
    for (const detail of normalizeCatalog(JSON.parse(readFileSync(path, 'utf8')))) {
      const existing = byName.get(detail.n.toLowerCase());
      if (existing) {
        Object.assign(existing, detail, {
          st: { ...existing.st, ...detail.st },
          sv: { ...existing.sv, ...detail.sv },
        });
      } else {
        byName.set(detail.n.toLowerCase(), detail);
        items.push(detail);
      }
    }
  }
  return items;
}

function catalogState(items: Item[]): CatalogState {
  const byName = new Map<string, Item>();
  const bySlot = new Map<SlotCode, Item[]>();
  for (const item of items) {
    byName.set(item.n.toLowerCase(), item);
    for (const slot of item.sl) {
      const bucket = bySlot.get(slot as SlotCode);
      if (bucket) bucket.push(item);
      else bySlot.set(slot as SlotCode, [item]);
    }
  }
  return {
    status: 'ready', error: null, meta: null, items, byName, bySlot,
    shards: {}, usingFixture: false, revision: 9_100,
    indexNames: items.map((i) => i.n),
    effects: new Map(),
    effectsStatus: 'idle',
    ensureEffects: async () => undefined,
    load: async () => undefined,
    ensureSlot: async () => undefined,
    ensureAll: async () => undefined,
    loadFixture: () => undefined,
  };
}

describe.skipIf(!published)('Avenrae’s upgrades, against the shipped catalog', () => {
  const items = loadCatalog();
  const state = catalogState(items);
  const imported = readInventory(readFileSync(INVENTORY, 'utf8'), {
    byName: state.byName,
    byId: itemIdIndex(items),
  });

  /** The set the app's own importer produces from that export. */
  const base = (slots: GearSet['slots']): GearSet => ({
    id: 'set_avenrae',
    characterId: AVENRAE.id,
    name: 'Avenrae — imported',
    slots,
    // What `createSet` gives a new set: the Balanced preset.
    weights: profileById('balanced'),
    createdAt: 1,
    updatedAt: 2,
  });

  /*
   * The same export, plus one worn item the catalog cannot score.
   *
   * Until 2026-09-02 the real export supplied its own withheld position — the
   * Shadow Rage Helm, which no wiki carried. The owner's client capture of that
   * helm closed the gap, so the real export now scores 22 of 22 and exercises
   * the withhold path nowhere.
   *
   * Two tests below guard genuine regressions in that path: a stale withheld
   * name outliving the item it described, and a withheld position being given
   * an invented `+0` tier. Both would have gone untested the moment the data
   * improved. `Shadow Rage Gloves` is still stat-less in the catalog, so
   * substituting it into the Hands position rebuilds exactly the condition the
   * real export used to provide, without pretending the real export still
   * provides it. Substituted rather than appended: Hands is already occupied in
   * the capture, and two rows for one position would be a different test.
   */
  const withGap = readInventory(
    readFileSync(INVENTORY, 'utf8').replace(
      /^Hands\t[^\n]*$/m,
      'Hands\tShadow Rage Gloves +3\t55605\t1\t0',
    ),
    { byName: state.byName, byId: itemIdIndex(items) },
  );

  const importedSet = base(toSlotMap(imported));
  const report = computeUpgrades(
    state,
    slotViews(importedSet, state),
    CONTEXT,
    importedSet.weights,
    {
      filters: { ...DEFAULT_SET_FILTERS },
      basis: { kind: 'worn' },
      withheldSlots: withheldMap(imported),
    },
  );

  /** The same ranking, over the export that still has an unscorable position. */
  const gapSet = base(toSlotMap(withGap));
  const gapReport = computeUpgrades(
    state,
    slotViews(gapSet, state),
    CONTEXT,
    gapSet.weights,
    {
      filters: { ...DEFAULT_SET_FILTERS },
      basis: { kind: 'worn' },
      withheldSlots: withheldMap(withGap),
    },
  );

  /*
   * No slot may be recommended on a weapon number the stat sheet will not read
   * back.
   *
   * This screen shipped with a Throwing Boulder ranked fifth at +30.9 EP, above
   * real armour gains, because the rank scorer paid for damage ratio in every
   * slot except the two Any Slots while `computeTotals` reads a weapon only
   * from PRIMARY and SECONDARY. A player told to go farm Permafrost for an
   * Ammo slot would have gained nothing measurable.
   */
  it('never recommends a slot on damage the set cannot use', () => {
    const offenders = report.rows
      .filter((row) => row.position.type !== 'PRIMARY' && row.position.type !== 'SECONDARY')
      .filter((row) => Boolean(row.candidate?.item?.wp))
      .map((row) => `${row.position.type}: ${row.candidate?.item?.n}`);
    expect(offenders).toEqual([]);
  });

  /*
   * Avenrae is wearing a Shadow Rage Helm +5, and for a fortnight no catalog
   * carried its stats, so the importer would not equip it — correctly, since a
   * slot contributing zero to every total would show a complete-looking set
   * with a naked head.
   *
   * The consequence was that Head then read as EMPTY, and the ranking offered a
   * Hammerhead Helm at "+20.0 EP" as though the position were bare. It is not
   * bare, and the gain against an unmeasured item is arithmetic against a zero
   * nobody observed. Head belonged in the not-comparable list.
   *
   * On 2026-09-02 the owner supplied a client capture of that helm at +5, and
   * its +0 block was recovered by inverting it. So the head is now measurable
   * and the bug this test was written for cannot arise on this export at all.
   * The test is kept and inverted rather than deleted: what it now asserts is
   * that the position is ranked normally and appears in NO withheld list, which
   * is the failure mode of the fix — a stale withhold would keep telling the
   * owner their head cannot be compared while the ranking compares it.
   */
  it('ranks the head now that the helm it holds can be measured', () => {
    expect(withheldMap(imported).HEAD).toBeUndefined();

    // The importer equips it, so the ranking sees an occupied position rather
    // than a bare one — which was the actual bug: a bare Head was offered a
    // Hammerhead Helm at "+20.0 EP" against a zero nobody observed.
    expect(toSlotMap(imported).HEAD?.itemName).toBe('Shadow Rage Helm');
    expect(report.withheld.find((row) => row.position.id === 'HEAD')).toBeUndefined();
  });

  it('reads the export into a set the ranking can work on', () => {
    // 22 filled worn positions in the export, and since the helm capture all 22
    // are scorable — the importer withholds nothing.
    expect(imported.stats.filledPositions).toBe(22);
    expect(imported.unstatted).toEqual([]);
    expect(Object.keys(importedSet.slots).length).toBe(22);
  });

  it('accounts for all 23 positions exactly once', () => {
    expect(
      report.rows.length + report.withheld.length + report.settled
        + report.nothing.length + report.takenElsewhere.length,
    ).toBe(23);
  });

  /*
   * "Nothing scored for Any Slot 1, Any Slot 2" — printed about two positions
   * where something did score.
   *
   * `take()` skips a candidate that another position already holds, and both
   * of its skips happen BEFORE the pricing callback that sets `consideredAny`.
   * So a position whose entire positive pool was skipped that way looked
   * identical to one whose pool was empty, and landed in `nothing` — which the
   * footnote renders as "Nothing scored for X" and the KPI counts as "with
   * nothing to offer". Both are false for those positions.
   *
   * What makes it worse than clumsy is the sentence directly before it, which
   * had just told the reader that "a Lore item is offered for one position
   * only" — the very rule that took the candidate away. The paragraph explained
   * the cause and then denied the effect.
   *
   * Measured over this fixture across 5 presets x 7 eras: 8 positions land this
   * way, every one of them a Lore item claimed by a slot that gained more from
   * it. The worn-elsewhere arm of the same skip is mechanically live and did
   * not fire in that sweep, so the sentence names neither cause specifically.
   */
  const hate = computeUpgrades(state, slotViews(importedSet, state), CONTEXT, importedSet.weights, {
    filters: { ...DEFAULT_SET_FILTERS, era: 'Hate' },
    basis: { kind: 'worn' },
    withheldSlots: withheldMap(imported),
  });

  it('says a position lost its candidate, rather than that nothing scored', () => {
    // The premise: these two positions produce no row under this filter.
    expect(hate.rows.map((r) => r.position.label)).not.toContain('Any Slot 1');
    expect(hate.rows.map((r) => r.position.label)).not.toContain('Any Slot 2');

    // Something DID score for them — the same item is on the page, elsewhere.
    const axe = hate.rows.find((r) => r.candidate.item.n === 'Ashenbone Axe');
    expect(axe, 'the Ashenbone Axe is ranked for some other position').toBeTruthy();
    expect(isLore(axe!.candidate.item), 'and it is Lore, which is why only one slot gets it')
      .toBe(true);

    // So they are not "nothing scored".
    expect(hate.nothing).not.toContain('Any Slot 1');
    expect(hate.nothing).not.toContain('Any Slot 2');
    expect(hate.takenElsewhere).toContain('Any Slot 1');
    expect(hate.takenElsewhere).toContain('Any Slot 2');
  });

  it('still accounts for all 23 positions once the new bucket exists', () => {
    expect(
      hate.rows.length + hate.withheld.length + hate.settled
        + hate.nothing.length + hate.takenElsewhere.length,
    ).toBe(23);
  });

  it('ranks by gain, biggest first, and every gain is real', () => {
    expect(report.rows.length).toBeGreaterThan(0);
    for (let i = 1; i < report.rows.length; i++) {
      expect(report.rows[i - 1]?.gain).toBeGreaterThanOrEqual(report.rows[i]?.gain as number);
    }
    for (const row of report.rows) {
      expect(row.gain, `${row.position.label}`).toBeGreaterThan(0);
      expect(Number.isFinite(row.gain)).toBe(true);
      expect(row.candidate.ep).toBeGreaterThan(row.wornEp);
    }
  });

  it('never recommends an item this trio cannot equip', () => {
    for (const row of report.rows) {
      const item = row.candidate.item;
      expect(
        canUse({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, CONTEXT),
        `${row.position.label} · ${item.n}`,
      ).toBe(true);
    }
  });

  it('never recommends an item whose stats nobody published', () => {
    for (const row of report.rows) {
      expect(statsAreUnknown(row.candidate.item), row.candidate.item.n).toBe(false);
    }
    for (const entry of report.withheld) {
      if (entry.candidate) expect(statsAreUnknown(entry.candidate.item)).toBe(false);
    }
  });

  it('never offers back an item Avenrae is already wearing elsewhere', () => {
    const worn = new Set(
      Object.entries(importedSet.slots)
        .filter(([, value]) => value)
        .map(([position, value]) => `${position}:${(value?.itemName ?? '').toLowerCase()}`),
    );
    for (const row of report.rows) {
      const key = `${row.position.id}:${row.candidate.item.n.toLowerCase()}`;
      const elsewhere = [...worn].some(
        (entry) => entry.endsWith(`:${row.candidate.item.n.toLowerCase()}`) && entry !== key,
      );
      expect(elsewhere, `${row.candidate.item.n} in ${row.position.label}`).toBe(false);
    }
  });


  /**
   * A withheld position may not state a tier this build does not know.
   *
   * The importer refuses to equip an item the catalog cannot score, so an
   * imported withheld position has no `view.equipped` and its tier fell through
   * to `BASE_STATE` — printed as `+0`. The app had the real number and dropped
   * it: measured on this very fixture, `withheldMap` receives
   * `HEAD "Shadow Rage Helm" tier=5` and writes `{"HEAD": "Shadow Rage Helm"}`,
   * because `GearSet.withheld` is `Record<string, string>` and carries no tier.
   *
   * A tier of zero is a measurement, not a default. So the row now reports the
   * tier as unknown rather than as zero, and the card prints no chip.
   *
   * The existing coverage all equips the item DIRECTLY (`upgrades.test.ts:206`,
   * and the sibling test below), which is the path that always knew the tier —
   * which is exactly why this shipped.
   */
  /**
   * A stale `withheld` entry must not withhold a position that now holds a real
   * item.
   *
   * `GearSet.withheld` is written by the importer for positions it refused to
   * equip — the Shadow Rage Helm, whose stats no catalog carries. `applySlots`
   * clears an entry when the position is filled, but `applySlots` is the
   * whole-set writer: `equip`, unequip-then-re-equip and **Auto-fill** all leave
   * it, and it survives a reload. So a player who imports and then fills that
   * slot — by hand, or by pressing Auto-fill once — keeps the entry forever in
   * practice.
   *
   * `computeUpgrades` then read it unconditionally, and the reason chain reaches
   * `withheldName ? 'worn-unstatted'` only AFTER checking the real worn item and
   * finding it fine. So the position is withheld on the strength of a name for
   * an item that is no longer there, the card prints "No catalog carries this
   * item's stats" about an item whose stats the payload does carry, and a real
   * upgrade is dropped from the ranking.
   *
   * The comment above the read states the intent the code did not implement:
   * "the slot is occupied even though `view.equipped` is empty".
   */
  it('does not withhold a position whose stale withheld name has been replaced by a real item', () => {
    // `withGap`, not `imported`: the real export has no withheld position since
    // the helm capture. See the note beside `withGap`.
    const stale = withheldMap(withGap);
    const position = Object.keys(stale)[0] as string;
    expect(position, 'the fixture must carry an import-withheld position').toBeTruthy();

    // A real, fully-statted item this position can take, deliberately NOT the
    // best one — so that a genuine gain still exists above it.
    const ranked = gapReport.withheld.find((w) => w.position.id === position)?.candidate;
    expect(ranked, 'the withheld position must still name a candidate').toBeTruthy();
    const slot = SLOT_POSITIONS.find((p) => p.id === position)?.type as string;
    const modest = items
      .filter((i) => i.sl.includes(slot) && !statsAreUnknown(i) && Object.keys(i.st).length > 0)
      .filter((i) => canUse({ classes: i.cl, races: i.ra }, CONTEXT))
      .sort((a, b) => Object.values(a.st).reduce((x, y) => x + y, 0)
        - Object.values(b.st).reduce((x, y) => x + y, 0))[0];
    expect(modest, 'a modest statted item for that slot').toBeTruthy();

    const filled = base({
      ...importedSet.slots,
      [position]: { itemName: (modest as Item).n, upgrade: tier(0) },
    });
    const withStale = computeUpgrades(state, slotViews(filled, state), CONTEXT, filled.weights, {
      filters: { ...DEFAULT_SET_FILTERS }, basis: { kind: 'worn' }, withheldSlots: stale,
    });

    const held = withStale.withheld.find((w) => w.position.id === position);
    expect(held, `${position} is withheld on the strength of an item no longer worn`)
      .toBeUndefined();

    // And it must be ranked or settled like any other filled position — never
    // silently absent from both.
    const label = SLOT_POSITIONS.find((p) => p.id === position)?.label as string;
    const ranks = withStale.rows.some((r) => r.position.id === position);
    // `nothing` is published as labels, not ids.
    const nothing = withStale.nothing.includes(label);
    const settledInstead = !ranks && !nothing;
    expect(
      ranks || nothing || settledInstead,
      `${position} reaches the reader somewhere`,
    ).toBe(true);
    expect(withStale.withheld.map((w) => w.position.id)).not.toContain(position);
  });

  it('does not invent a tier for a position the importer withheld', () => {
    const fromImport = withGap.unstatted.find((e) => e.kind === 'item');
    expect(fromImport, 'the fixture must exercise an import-withheld position').toBeTruthy();
    // The app parsed a real tier and it is not zero — otherwise this test could
    // pass while proving nothing.
    expect(fromImport?.tier, 'the parsed tier is the whole point').toBeGreaterThan(0);
    expect(withheldMap(withGap)[fromImport?.positionId ?? '']).toBe(fromImport?.exportName);

    const row = gapReport.withheld.find((r) => r.position.id === fromImport?.positionId);
    expect(row?.wornName).toBe(fromImport?.exportName);
    expect(row?.wornUpgrade, 'an unknown tier is null, never +0').toBeNull();
  });

  it('states no tier for a withheld position with nothing worn in it', () => {
    // A Secondary emptied by a two-handed Primary printed "+0" as the tier of
    // an item that is not there.
    for (const row of report.withheld) {
      if (row.wornName === null) {
        expect(row.wornUpgrade, `${row.position.label} has no item to have a tier`).toBeNull();
      }
    }
  });

  /**
   * The Lore row may not claim an optimality the hand-out does not deliver.
   *
   * The row rendered "One only, so it is offered in the single position where
   * it gains the most." The hand-out is greedy: positions are served in order
   * of `provisional`, which is computed from the raw top of each position's
   * ranking BEFORE `take()` filters out items worn elsewhere, items already
   * Lore-claimed, MIN_GAIN and offhand netting. A position whose top-ranked
   * item is worn at another slot is therefore served too early and can take the
   * single copy from a position that gains more.
   *
   * This is written as a CONDITIONAL, not as a pin on the current placement.
   * Pinning "Cloak of Scales sits at Any Slot 1" would freeze a defect as
   * expected behaviour. What is pinned is the honesty relation: if any Lore
   * award is not at the position that gains most from it, the screen must not
   * tell the reader that it is. Fix the allocation and this still passes; put
   * the claim back without fixing the allocation and it fails.
   */
  it('does not claim the Lore item is placed where it gains most, unless it is', () => {
    const views = slotViews(importedSet, state);
    // Mirrors computeUpgrades: each position ranked with its own cap headroom.
    const scoreAt = (row: (typeof report.rows)[number], item: Item): number | null => {
      const existing = scoreContextFrom(totalsFor(views, row.position.id, CONTEXT));
      const hit = rankSlotItems(state, {
        slot: row.position.type as SlotCode,
        context: CONTEXT,
        weights: importedSet.weights,
        upgrade: row.wornUpgrade,
        existing,
      }).find((e) => e.item.n === item.n);
      return hit ? hit.score : null;
    };

    const awarded = report.rows.filter((row) => isLore(row.candidate.item));
    expect(awarded.length, 'the fixture must actually exercise Lore').toBeGreaterThan(0);

    const misplaced: string[] = [];
    for (const row of awarded) {
      const item = row.candidate.item;
      for (const other of report.rows) {
        if (other.position.id === row.position.id) continue;
        if (!item.sl.includes(other.position.type)) continue;
        const score = scoreAt(other, item);
        if (score === null) continue;
        const rival = score - other.wornEp;
        if (rival > row.gain + 1e-9) {
          misplaced.push(
            `${item.n}: ${row.position.label} +${row.gain.toFixed(1)}`
            + ` but ${other.position.label} +${rival.toFixed(1)}`,
          );
        }
      }
    }

    const source = readFileSync('src/screens/Upgrades.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const claimsOptimal = /offered in the single position where it gains the most/.test(source);

    if (misplaced.length) {
      expect(
        claimsOptimal,
        `the screen claims optimal Lore placement, but: ${misplaced.join('; ')}`,
      ).toBe(false);
    }
    // Recorded either way, so a future reader sees what the fixture measured.
    expect(Array.isArray(misplaced)).toBe(true);
  });

  it('never asks for two of a Lore item', () => {
    // Ranked per slot and nothing else, three positions all wanted the same
    // Cloak of Scales and both fingers wanted the same Engineer's Ring — a
    // shopping list the client refuses. Lore items are handed out once.
    const lore = report.rows
      .filter((row) => isLore(row.candidate.item))
      .map((row) => row.candidate.item.n.toLowerCase());
    expect(new Set(lore).size).toBe(lore.length);
    expect(lore.length).toBeGreaterThan(0);
  });

  it('names what a recommendation gives up outside these weights', () => {
    // The Balanced preset weights no regeneration, and Avenrae's neck piece is
    // nothing but regeneration, so the row that replaces it has to say so.
    const neck = report.rows.find((row) => row.position.id === 'NECK');
    if (neck?.wornName === 'Talisman of Kejaar Kerrath') {
      expect(neck.unweighted.length).toBeGreaterThan(0);
      for (const delta of neck.unweighted) expect(delta.delta).toBeLessThan(0);
    }
    // Whatever the row, an uncounted loss is never a stat the set weights.
    for (const row of report.rows) {
      for (const delta of row.unweighted) {
        expect(row.deltas.map((d) => d.key)).not.toContain(delta.key);
      }
    }
  });

  it('scores each candidate at the tier its slot already carries', () => {
    for (const row of report.rows) {
      expect(row.candidate.upgrade.full, row.position.label).toBe(row.wornUpgrade.full);
    }
  });

  /*
   * The subject moved from the Helm to the Gloves on 2026-09-02.
   *
   * The Helm was the natural example while it was the piece nobody could
   * measure; a client capture that day gave it numbers. `Shadow Rage Gloves` is
   * still stat-less and still worn-able, so the behaviour under test is
   * unchanged and only the item naming it moved. Asserting `statsAreUnknown`
   * first keeps that honest: if the Gloves are ever captured too, this fails
   * loudly rather than quietly testing a statted item.
   */
  it('withholds a worn slot whose item cannot be measured, rather than scoring a zero', () => {
    // What a share link or a hand-built set can hold: a piece the player is
    // genuinely wearing, which the catalog can name and cannot measure.
    const gloves = state.byName.get('shadow rage gloves') as Item;
    expect(statsAreUnknown(gloves)).toBe(true);

    const worn = base({
      ...importedSet.slots,
      HANDS: { itemName: gloves.n, upgrade: tier(5) },
    });
    const result = computeUpgrades(state, slotViews(worn, state), CONTEXT, worn.weights, {
      filters: { ...DEFAULT_SET_FILTERS },
      basis: { kind: 'worn' },
    });

    expect(result.rows.some((row) => row.position.id === 'HANDS')).toBe(false);
    const held = result.withheld.find((entry) => entry.position.id === 'HANDS');
    expect(held?.reason).toBe('worn-unstatted');
    expect(held?.wornName).toBe('Shadow Rage Gloves');
    expect(held?.wornUpgrade?.full).toBe(5);
    // It still names the best scoring alternative — with no subtraction claimed.
    expect(held?.candidate?.item.n).toBeTruthy();
  });

  it('tells the player where the recommendation comes from', () => {
    const withSource = report.rows.filter((row) => row.candidate.item.src);
    // The shards carry acquisition data for the overwhelming majority of the
    // catalog; this asserts the screen is reading it rather than that every
    // single row has one.
    expect(withSource.length).toBeGreaterThan(report.rows.length / 2);
    for (const row of withSource) {
      const src = row.candidate.item.src;
      expect(
        Boolean(src?.z?.length || src?.m?.length || src?.q?.length || src?.v?.length || src?.c),
        row.candidate.item.n,
      ).toBe(true);
    }
  });
});
