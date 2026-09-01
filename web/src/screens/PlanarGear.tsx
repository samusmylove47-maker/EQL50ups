/**
 * Planar gear targets.
 *
 * This absorbed the site's own Planar gear targets, since withdrawn —
 * `/tools/planar-gear` 301s to `/tools/50-upgrades.html` and 307s on to
 * `/tools/50-upgrades`, checked 2026-08-18. Everything below that speaks of
 * "that tool" in the present is describing what it did while it was up, read
 * off it on 2026-08-18 and recorded in `planarSets.ts`; it is history now, and
 * the comparison is kept because it is why this screen is shaped as it is.
 *
 * That tool existed for one
 * genuinely hard reason and it is worth restating rather than paraphrasing: a
 * trio can wear planar armour from all three of its classes **plus the two
 * shared sets**, so up to five sets compete for every slot, and nobody can hold
 * that in their head.
 *
 * It does everything that tool does — pick three classes, choose what you are
 * optimising for, lock a target per slot, see a running total — and four things
 * it cannot:
 *
 *  1. **It scores against real weights.** Theirs offers five named presets, each
 *     a hand-written expression (`AC`, `mana+INT+WIS`, "every attribute added
 *     up"). This scores with `rankScorer` — the same compiled scorer the item
 *     picker and Auto-fill use — against a weight profile, and the profile can
 *     be *your own gear set's*, so the answer here is the same answer the rest
 *     of the planner gives. The five presets are still there for a visitor with
 *     no saved set.
 *
 *  2. **It never ranks a piece nobody has measured.** Six Shadow Rage pieces are
 *     in this catalog because a live client holds them and the owner named the
 *     set; not one of them carries a stat block this project is willing to
 *     publish. They are listed, by name, under every slot they belong to, and
 *     they carry no score. The tool this replaces ranks three of them from a
 *     classic-era block.
 *
 *  3. **It gates on race and level, not only class.** Rune Etched is Barbarian,
 *     Troll and Ogre only. A Shaman of any other race is offered it by the tool
 *     this replaces, because that tool has no concept of race. Eligibility here
 *     runs through `canUse` — the same gate the item picker uses.
 *
 *  4. **It shows each piece's own standing** — Tier 2, Tier 5, unattributed, and
 *     the separate Tier M fact of whether the game has been seen to hold it —
 *     instead of one blanket T3 over everything. Their badge repeats on every
 *     card and on the locked total so it is never off screen when you decide;
 *     so does this one, and on the total it repeats as a *mix*, because a plan
 *     resting on five Tier 5 rows and one Tier 2 row is not one badge's worth
 *     of a claim.
 *
 * Their honesty devices are kept, all of them: the assumption stated, Wrist
 * counted twice, slots the sets do not cover not offered rather than guessed
 * at, and blanks shown as blanks.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClassPicker } from '../components/ClassPicker';
import { itemHoverProps } from '../components/ItemWindow';
import { useCatalog } from '../data/catalog';
import {
  activeContext,
  activeLoadout,
  describeCharacter,
  makeContext,
  type LoadoutContext,
} from '../engine/character';
import { CLASS_NAMES, LEVEL_CAP, RACES, raceLabel, type ClassCode } from '../engine/constants';
import { PRESET_PROFILES, type WeightProfile } from '../engine/ep';
import type { Item } from '../engine/types';
import { BASE_STATE, tier as tierState } from '../engine/upgrade';
import { count, ep, pluralize, signed } from '../lib/format';
import { existenceMark, sourceStanding, sourceSummary } from '../lib/itemStyle';
import { statVector, shortStatLabel } from '../selectors/gear';
import { href } from '../router';
import { useApp } from '../state/store';
import {
  PLANAR_SETS,
  PLANAR_SLOTS,
  PLANAR_SLOT_LABELS,
  coveredPositionCount,
  positionsFor,
  rankPlanarSlot,
  resolvePlanarPieces,
  setsAvailable,
  uncoveredPositions,
  wearCount,
  type PlanarPiece,
  type PlanarSlot,
} from './planarSets';
import './PlanarGear.css';

/* ------------------------------------------------------------ small parts */

function Section({
  num,
  id,
  title,
  lede,
  children,
}: {
  num: string;
  id: string;
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="pl-section" aria-labelledby={id}>
      <div className="pl-section-head">
        <span className="pl-section-num" aria-hidden="true">
          {num}
        </span>
        <h2 className="pl-section-title" id={id}>
          {title}
        </h2>
      </div>
      {lede ? <p className="pl-lede">{lede}</p> : null}
      {children}
    </section>
  );
}

/** A note: a left rule and no box, per `research/DESIGN-EQLSOURCE.md`. */
function Note({
  tone = 'plain',
  lead,
  children,
}: {
  tone?: 'plain' | 'sig' | 'warn';
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className={`pl-note pl-note-${tone}`}>
      {lead ? <strong>{lead}</strong> : null} {children}
    </div>
  );
}

/** Figure, label, one sentence of consequence. The sentence is not optional. */
function Callout({
  figure,
  label,
  tone = 'plain',
  children,
}: {
  figure: string;
  label: string;
  tone?: 'plain' | 'good' | 'bad';
  children: ReactNode;
}) {
  return (
    <div className="pl-callout" data-tone={tone}>
      <b className="pl-callout-figure">{figure}</b>
      <span className="pl-callout-label">{label}</span>
      <p className="pl-callout-body">{children}</p>
    </div>
  );
}

/**
 * The standing badge, repeated everywhere a decision is made.
 *
 * `data-band` rather than `data-standing`: the global `[data-standing]` rule is
 * the card device — a 2px accent on the top edge — and a chip does not want a
 * top edge. The band and the wording both come from `sourceStanding`, so this
 * chip cannot say something the item window does not.
 */
function StandingChip({ item }: { item: Item }) {
  const mark = sourceStanding(item);
  return (
    <span className="pl-standing" data-band={mark.band} title={mark.label}>
      {mark.short}
    </span>
  );
}

/**
 * The second, independent fact: whether the game is known to hold the item.
 *
 * Silent where there is no sighting — the piece ships on its era, and saying
 * "Tier M" over that would be a claim about content rather than an observation.
 */
function ExistenceChip({ item }: { item: Item }) {
  const mark = existenceMark(item);
  if (!mark) return null;
  return (
    <span className="pl-existence">{mark.label}</span>
  );
}

/* ------------------------------------------------------------ the weights */

type WeightChoice = { kind: 'preset'; id: string } | { kind: 'set'; id: string };

interface ResolvedWeights {
  weights: WeightProfile;
  label: string;
  /** Where the numbers being optimised for came from, in the reader's words. */
  provenance: string;
}

/* ----------------------------------------------------------- the screen */

export function PlanarGear() {
  const items = useCatalog((s) => s.items);
  const status = useCatalog((s) => s.status);
  const ensureAll = useCatalog((s) => s.ensureAll);
  const characters = useApp((s) => s.characters);
  const sets = useApp((s) => s.sets);
  const equip = useApp((s) => s.equip);

  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const [trio, setTrio] = useState<ClassCode[]>([]);
  const [race, setRace] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [choice, setChoice] = useState<WeightChoice | null>(null);
  const [upgradeTier, setUpgradeTier] = useState(0);
  const [locks, setLocks] = useState<Partial<Record<PlanarSlot, string[]>>>({});
  const [sendTo, setSendTo] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  /* ---- who is asking ---------------------------------------------------- */

  const character = characters.find((c) => c.id === characterId);

  const context: LoadoutContext | undefined = useMemo(() => {
    if (character) return activeContext(character);
    if (!trio.length) return undefined;
    /*
     * A hand-picked trio is assumed to be at the level cap. Stated rather than
     * hidden: this planner is called "50 Upgrades", every planar piece in this
     * catalog carries no level requirement at all, and the alternative default —
     * level 1 — would silently blank the screen the day one does. Adopt a saved
     * character to use its real per-class levels instead.
     */
    return makeContext(
      trio,
      race || null,
      Object.fromEntries(trio.map((code) => [code, LEVEL_CAP])),
    );
  }, [character, trio, race]);

  const shownTrio = character ? (activeLoadout(character)?.classes ?? []) : trio;
  const shownRace = character ? (context?.race ?? null) : race || null;

  /* ---- the catalog ------------------------------------------------------ */

  const pieces = useMemo(() => resolvePlanarPieces(items), [items]);

  /*
   * The published vocabulary, not a set observed in the corpus.
   *
   * The comment that stood here had the diagnosis exactly right — *"only three
   * race codes appear on planar armour at all, so a High Elf had no way to say
   * so and was quietly offered a set their character cannot wear"* — and then
   * widened from the pieces to the whole corpus, which is the same mistake one
   * step further out. Measured 2026-09-01: the whole corpus names five distinct
   * codes, the hard-coded floor added two more, and the dropdown offered 7 of
   * 15. **`HIE` was not among them.** The High Elf this comment was written to
   * rescue still had no way to say so, for a year of commits.
   *
   * A vocabulary derived from the subset of the data that happens to mention it
   * can only ever be a lower bound. `RACES` is what `meta.races` publishes and
   * what `verify.mjs` independently restates; `races.test.ts` pins them equal.
   */
  const races = RACES;

  /* ---- what we are optimising for --------------------------------------- */

  const orderedSets = useMemo(
    () => [...sets].sort((a, b) => b.updatedAt - a.updatedAt),
    [sets],
  );

  const resolved: ResolvedWeights = useMemo(() => {
    const fallback = PRESET_PROFILES.find((p) => p.id === 'balanced') ?? PRESET_PROFILES[0];
    const active =
      choice ??
      (orderedSets[0]
        ? ({ kind: 'set', id: orderedSets[0].id } as WeightChoice)
        : ({ kind: 'preset', id: fallback?.id ?? 'balanced' } as WeightChoice));

    if (active.kind === 'set') {
      const gearSet = orderedSets.find((s) => s.id === active.id);
      if (gearSet) {
        const owner = characters.find((c) => c.id === gearSet.characterId);
        return {
          weights: gearSet.weights,
          label: owner ? `${owner.name} · ${gearSet.name}` : gearSet.name,
          provenance: 'Your own weights, read off that gear set. Edit them on its Weights tab.',
        };
      }
    }
    const preset =
      PRESET_PROFILES.find((p) => p.id === (active.kind === 'preset' ? active.id : '')) ?? fallback;
    return {
      weights: preset?.weights ?? {},
      label: preset?.label ?? 'Balanced',
      provenance: `${preset?.description ?? ''} A starting point, not gospel — save a gear set to score against your own.`,
    };
  }, [choice, orderedSets, characters]);

  const weightSummary = useMemo(
    () =>
      Object.entries(resolved.weights)
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .map(([key, value]) => `${shortStatLabel(key)} ×${value}`),
    [resolved],
  );

  /* ---- the ranking ------------------------------------------------------ */

  // Memoised because it is a dependency of the ranking: rebuilding `{full,
  // fraction}` on every render would re-rank every slot on every keystroke.
  const upgrade = useMemo(
    () => (upgradeTier > 0 ? tierState(upgradeTier) : BASE_STATE),
    [upgradeTier],
  );

  const results = useMemo(
    () =>
      PLANAR_SLOTS.map((slot) =>
        rankPlanarSlot(pieces, slot, context, resolved.weights, upgrade),
      ),
    [pieces, context, resolved, upgrade],
  );

  const available = useMemo(() => setsAvailable(pieces, context), [pieces, context]);

  /**
   * Why the unrankable pieces are in the catalog at all, quoted once.
   *
   * De-duplicated: a whole set shares one evidence string, so a card each would
   * print the same paragraph six times over. It is quoted rather than
   * paraphrased because it is somebody's actual words and the standard treats a
   * player report as Tier M evidence.
   */
  const withheldEvidence = useMemo(() => {
    const seen = new Set<string>();
    for (const result of results) {
      for (const piece of result.unmeasured) {
        if (piece.item.evidence) seen.add(piece.item.evidence);
      }
    }
    return [...seen];
  }, [results]);
  const unmeasuredCount = results.reduce((total, r) => total + r.unmeasured.length, 0);
  const rankedCount = results.reduce((total, r) => total + r.ranked.length, 0);

  /* ---- locking ---------------------------------------------------------- */

  const pieceByName = useMemo(() => {
    const map = new Map<string, PlanarPiece>();
    for (const piece of pieces) map.set(`${piece.slot}|${piece.item.n}`, piece);
    return map;
  }, [pieces]);

  const toggleLock = (slot: PlanarSlot, name: string) => {
    setSent(null);
    setLocks((prev) => {
      const max = wearCount(slot);
      const current = prev[slot] ?? [];
      const at = current.indexOf(name);
      const next = at >= 0 ? current.filter((n) => n !== name) : [...current, name];
      // Locking a third bracer drops the first, which is what "you wear two"
      // means. Same rule as the tool this replaces.
      while (next.length > max) next.shift();
      const out = { ...prev };
      if (next.length) out[slot] = next;
      else delete out[slot];
      return out;
    });
  };

  /*
   * A piece locked for a class or race you have since dropped is no longer
   * yours to want. Cleared on the way out rather than left to show a total the
   * trio cannot reach.
   */
  const lockedPieces = useMemo(() => {
    const out: Array<{ slot: PlanarSlot; piece: PlanarPiece }> = [];
    for (const slot of PLANAR_SLOTS) {
      for (const name of locks[slot] ?? []) {
        const piece = pieceByName.get(`${slot}|${name}`);
        if (!piece) continue;
        const wearable = results.find((r) => r.slot === slot);
        const stillOffered =
          wearable?.ranked.some((r) => r.piece.item.n === name) ||
          wearable?.unmeasured.some((p) => p.item.n === name);
        if (stillOffered) out.push({ slot, piece });
      }
    }
    return out;
  }, [locks, pieceByName, results]);

  const lockedTotals = useMemo(() => {
    const totals = new Map<string, number>();
    let withheld = 0;
    for (const { piece } of lockedPieces) {
      if (piece.item.statsUnknown) {
        withheld++;
        continue;
      }
      for (const entry of statVector(piece.item, upgrade)) {
        totals.set(entry.key, (totals.get(entry.key) ?? 0) + entry.value);
      }
    }
    return { totals: [...totals.entries()], withheld };
  }, [lockedPieces, upgrade]);

  /** The standing mix under the locked plan — the badge, repeated as a count. */
  const lockedStanding = useMemo(() => {
    const mix = new Map<string, { short: string; band: string; n: number }>();
    for (const { piece } of lockedPieces) {
      const mark = sourceStanding(piece.item);
      const row = mix.get(mark.standing) ?? { short: mark.short, band: mark.band, n: 0 };
      row.n++;
      mix.set(mark.standing, row);
    }
    return [...mix.values()].sort((a, b) => b.n - a.n);
  }, [lockedPieces]);

  const sendLocked = () => {
    const gearSet = sets.find((s) => s.id === sendTo);
    if (!gearSet) return;
    let placed = 0;
    for (const slot of PLANAR_SLOTS) {
      const positions = positionsFor(slot);
      const names = (locks[slot] ?? []).filter((name) =>
        lockedPieces.some((l) => l.slot === slot && l.piece.item.n === name),
      );
      names.forEach((name, index) => {
        const position = positions[index];
        const piece = pieceByName.get(`${slot}|${name}`);
        // An unmeasured piece is not equipped. The set's own totals would then
        // read a real number off a row that has none, which is the exact
        // fabrication this screen refuses to make in its own ranking.
        if (!position || !piece || piece.item.statsUnknown) return;
        equip(gearSet.id, position.id, name, upgrade);
        placed++;
      });
    }
    const held = lockedPieces.filter((l) => l.piece.item.statsUnknown).length;
    setSent(
      `${pluralize(placed, 'target')} written to ${gearSet.name}${
        held ? ` · ${pluralize(held, 'unmeasured piece')} left out, because it has no numbers to place` : ''
      }.`,
    );
  };

  /* ---- render ----------------------------------------------------------- */

  const ready = pieces.length > 0;
  const catalogAbsent = status === 'missing' || status === 'error';
  const uncovered = uncoveredPositions();
  const covered = coveredPositionCount();

  return (
    <div className="pl">
      <header className="pl-head">
        {/*
          This read `absorbed from eqlsource.com/tools/planar-gear` until that
          page was withdrawn. It is prose rather than an `<a>`, so nothing 404s
          and no link checker would ever have flagged it — it simply named, to a
          reader, on screen, a URL they could type in and not arrive at. (It
          301s to `/tools/50-upgrades.html` and 307s on to `/tools/50-upgrades`
          — `curl -o /dev/null -w '%{http_code} %{redirect_url}'`, 2026-08-18 —
          so a reader who tried would land on the site's page about this very
          tool, which is a confusing way to be told a page is gone.)

          The absorption is real history and worth keeping; the address is what
          had to go. `Planar gear targets` is the name the site published it
          under, and naming it rather than its URL is what makes the line stay
          true after the redirect rule is eventually retired too.
        */}
        <div className="pl-head-eyebrow">
          Tool · planar armour · absorbed from the site&apos;s Planar gear targets, now withdrawn
        </div>
        <h1 className="pl-head-title">
          Planar gear <em>targets</em>
        </h1>
        <p className="pl-head-lede">
          Your trio can wear planar armour from all three of its classes, plus the two shared sets.
          That is up to five sets competing for every slot, and holding it in your head is genuinely
          hard. Pick three classes, choose what you are optimising for, and lock a target for each
          slot. <em>{count(pieces.length)} pieces</em> across <em>{PLANAR_SETS.length} sets</em>,
          every figure read off the piece&apos;s own record in this catalog.
        </p>
      </header>

      <Note tone="sig" lead="Nothing here is ranked that nobody has measured.">
        Six Shadow Rage pieces are in this catalog because a live client holds them and the owner
        named the set. No source publishes their numbers, so this tool offers them by name under
        every slot they belong to and gives them <em>no score at all</em>. The tool this replaces
        ranks three of them from a classic-era stat block. That makes our answer for a Berserker
        look thinner than theirs, and it is the honest one: an absent stat is unknown, not zero.
      </Note>

      <div className="pl-callouts">
        <Callout figure={count(pieces.length)} label="pieces resolved out of this catalog" tone="plain">
          Grouped under the eighteen set names by name alone — the one inference on this screen, and
          it fills in no field. Every stat, slot, class, race and source below is read off the
          piece&apos;s own record.
        </Callout>
        <Callout
          figure={count(unmeasuredCount)}
          label="offered by name, refused a rank"
          tone={unmeasuredCount ? 'bad' : 'good'}
        >
          A piece with no published stats would score zero against any weights, and a zero sitting
          in a ranking beside measured numbers is a fabrication. These are listed and left unscored.
        </Callout>
        <Callout figure={`${covered} of 23`} label="worn positions these sets can fill" tone="plain">
          The planar sets carry no rings and no earrings, and nothing for eleven other positions
          either. Those slots are not offered rather than guessed at — see section 05.
        </Callout>
      </div>

      {/* ------------------------------------------------------------ 01 */}
      <Section
        num="01"
        id="pl-trio"
        title="Your three classes"
        lede="Eligibility runs through the same class, race and level gate the item picker uses. A piece one of your three classes can wear is offered; a piece none of them can wear is not on this page at all."
      >
        <div className="pl-adopt">
          <label className="pl-field">
            <span>Read a saved character</span>
            <select
              value={characterId}
              onChange={(event) => {
                setCharacterId(event.target.value);
                setSent(null);
              }}
            >
              <option value="">Pick by hand</option>
              {characters.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} — {describeCharacter(entry)}
                </option>
              ))}
            </select>
          </label>
          {character ? (
            <p className="pl-hint">
              Reading {character.name}&apos;s active loadout: {describeCharacter(character)}
              {shownRace ? ` · ${shownRace}` : ' · race unset, so race does not narrow anything'}.
              Its real per-class levels are used. Choose <em>Pick by hand</em> to set a trio here
              instead.
            </p>
          ) : null}
        </div>

        {character ? (
          <div className="pl-trio-read">
            {shownTrio.map((code) => (
              <span key={code} className="pl-trio-chip">
                {code}
                <i>{CLASS_NAMES[code]}</i>
              </span>
            ))}
          </div>
        ) : (
          <>
            <ClassPicker
              value={trio}
              onChange={(next) => {
                setTrio(next);
                setSent(null);
              }}
            />
            <label className="pl-field">
              <span>Race</span>
              <select value={race} onChange={(event) => setRace(event.target.value)}>
                <option value="">Do not narrow on race</option>
                {races.map((code) => (
                  <option key={code} value={code}>
                    {raceLabel(code)}
                  </option>
                ))}
              </select>
            </label>
            <p className="pl-hint">
              Race is a real restriction on this armour: Rune Etched is Barbarian, Troll and Ogre
              only. Left unset it narrows nothing, which is the honest default — we will not guess a
              race you have not told us.
            </p>
          </>
        )}

        {shownTrio.length ? (
          <p className="pl-hint">
            {pluralize(available.length, 'set')} open to this trio:{' '}
            {available.map((set) => set.name).join(' · ') || 'none'}.
            {available.length < 5 ? (
              <>
                {' '}
                Fewer than five, and that is not a fault: the shared sets are not open to every
                class, so &ldquo;five sets compete for every slot&rdquo; is true of some trios and
                not of yours.
              </>
            ) : null}
          </p>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------ 02 */}
      <Section
        num="02"
        id="pl-weights"
        title="What you are optimising for"
        lede="Not a menu of five hand-written expressions. Every piece below is scored by the planner's own equivalency-point engine against a weight profile — and the profile can be one of your own gear sets, so this screen and the rest of the app cannot disagree about which bracer is better."
      >
        <div className="pl-weight-pick">
          <label className="pl-field">
            <span>Weights</span>
            <select
              value={choice ? `${choice.kind}:${choice.id}` : ''}
              onChange={(event) => {
                const raw = event.target.value;
                if (!raw) {
                  setChoice(null);
                  return;
                }
                const [kind, id] = raw.split(':');
                setChoice({ kind: kind === 'set' ? 'set' : 'preset', id: id ?? '' });
              }}
            >
              <option value="">Default — {resolved.label}</option>
              {orderedSets.length ? (
                <optgroup label="Your saved sets">
                  {orderedSets.map((gearSet) => {
                    const owner = characters.find((c) => c.id === gearSet.characterId);
                    return (
                      <option key={gearSet.id} value={`set:${gearSet.id}`}>
                        {owner ? `${owner.name} · ` : ''}
                        {gearSet.name}
                      </option>
                    );
                  })}
                </optgroup>
              ) : null}
              <optgroup label="Presets">
                {PRESET_PROFILES.map((preset) => (
                  <option key={preset.id} value={`preset:${preset.id}`}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label className="pl-field">
            <span>Upgrade tier</span>
            <select
              value={String(upgradeTier)}
              onChange={(event) => setUpgradeTier(Number(event.target.value))}
            >
              {Array.from({ length: 11 }, (_, index) => (
                <option key={index} value={String(index)}>
                  +{index}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="pl-hint">
          <strong>{resolved.label}.</strong> {resolved.provenance}
        </p>
        {weightSummary.length ? (
          <div className="pl-weights" aria-label="Active weights">
            {weightSummary.map((entry) => (
              <span key={entry} className="pl-weight">
                {entry}
              </span>
            ))}
          </div>
        ) : (
          <p className="pl-hint pl-warn">
            Every weight in this profile is zero, so every piece scores zero and the order below is
            alphabetical. That is what a blank profile means; it is not a ranking.
          </p>
        )}
        <p className="pl-hint">
          Ranked at <strong>+{upgradeTier}</strong>. Upgrade tiers are this planner&apos;s own
          ground and the tool this replaces has no concept of them — a +10 bracer is a different
          item from a +0 one, and which piece wins a slot can change between them.
        </p>
      </Section>

      {/* ------------------------------------------------------------ 03 */}
      <Section
        num="03"
        id="pl-targets"
        title="Lock a target for each slot"
        lede={
          <>
            Best first, by equivalency points at your weights. Wrist counts twice — you wear two, so
            you may lock two.
            {shownTrio.length ? (
              <>
                {' '}
                {pluralize(rankedCount, 'piece')} scored for this trio
                {unmeasuredCount ? `, ${count(unmeasuredCount)} listed without a score` : ''}.
              </>
            ) : null}
          </>
        }
      >
        {!ready && catalogAbsent ? (
          <p className="pl-absent">
            No item data was published with this build, so there is nothing to rank. That is a
            missing catalog, not an empty game — the page says so rather than printing eighteen
            empty sets.
          </p>
        ) : null}
        {!ready && !catalogAbsent ? <p className="pl-absent">Loading the catalog…</p> : null}
        {ready && !shownTrio.length ? (
          <p className="pl-absent">Pick three classes above to begin.</p>
        ) : null}

        {ready && shownTrio.length
          ? results.map((result) => {
              const slotLocks = locks[result.slot] ?? [];
              const max = wearCount(result.slot);
              return (
                <section className="pl-slot" key={result.slot} aria-labelledby={`pl-slot-${result.slot}`}>
                  <div className="pl-slot-head">
                    <h3 id={`pl-slot-${result.slot}`}>
                      {PLANAR_SLOT_LABELS[result.slot]}
                      {max > 1 ? <span className="pl-wear">wear {max}</span> : null}
                    </h3>
                    <p className="pl-slot-sub">
                      {pluralize(result.ranked.length, 'ranked piece')}
                      {result.unmeasured.length
                        ? ` · ${pluralize(result.unmeasured.length, 'unmeasured')}`
                        : ''}
                      {max > 1 ? ` · lock up to ${max}` : ''}
                      {slotLocks.length ? ` · ${slotLocks.length} locked` : ''}
                    </p>
                  </div>

                  {!result.ranked.length && !result.unmeasured.length ? (
                    <p className="pl-none">
                      Nothing in this catalog that your trio can wear fills this slot. That is a gap
                      in the source or a restriction on your trio, not an empty slot in the game.
                    </p>
                  ) : null}

                  <div className="pl-cards">
                    {result.ranked.map(({ piece, score }) => {
                      const locked = slotLocks.includes(piece.item.n);
                      const mark = sourceStanding(piece.item);
                      const where = sourceSummary(piece.item);
                      return (
                        <div
                          className={`pl-card${locked ? ' is-locked' : ''}`}
                          key={piece.item.n}
                          data-standing={mark.band}
                        >
                          <div className="pl-card-top">
                            <span className="pl-name">{piece.item.n}</span>
                            <span className="pl-score num">{ep(score)} EP</span>
                          </div>
                          <div className="pl-card-meta">
                            <span className="pl-set">
                              {piece.set.name}
                              {piece.set.cls ? ` · ${piece.set.cls}` : ' · shared'}
                            </span>
                            <StandingChip item={piece.item} />
                            <ExistenceChip item={piece.item} />
                          </div>
                          <div className="pl-stats">
                            {statVector(piece.item, upgrade).map((entry) => (
                              <span key={entry.key}>
                                {shortStatLabel(entry.key)} <b>{signed(entry.value)}</b>
                              </span>
                            ))}
                          </div>
                          {piece.item.fx?.length ? (
                            <p className="pl-fx">
                              Effect: {piece.item.fx.map((effect) => effect.n).join(', ')}{' '}
                              <i>shown, never scored — this engine has no price for a clicky</i>
                            </p>
                          ) : null}
                          {where ? <p className="pl-src">{where}</p> : null}
                          <button
                            type="button"
                            className={`pl-lock${locked ? ' on' : ''}`}
                            aria-pressed={locked}
                            onClick={() => toggleLock(result.slot, piece.item.n)}
                            {...itemHoverProps(piece.item, upgrade, context, result.slot)}
                          >
                            {locked ? 'Locked as your target' : 'Lock as target'}
                          </button>
                        </div>
                      );
                    })}

                    {result.unmeasured.map((piece) => (
                      <div className="pl-card pl-card-unmeasured" key={piece.item.n} data-standing="unattributed">
                        <div className="pl-card-top">
                          <span className="pl-name">{piece.item.n}</span>
                          <span className="pl-score pl-score-none">no score</span>
                        </div>
                        <div className="pl-card-meta">
                          <span className="pl-set">
                            {piece.set.name}
                            {piece.set.cls ? ` · ${piece.set.cls}` : ' · shared'}
                          </span>
                          <StandingChip item={piece.item} />
                          <ExistenceChip item={piece.item} />
                        </div>
                        {/*
                          The refusal, and not the whole of the evidence behind
                          it. The evidence is one paragraph repeated verbatim on
                          every piece of the set, so printing it here printed it
                          six times; it is quoted once, in full, in section 07.
                        */}
                        <p className="pl-withheld">
                          The game holds this piece and no source publishes its numbers, so it is
                          not ranked and cannot be. Quoted in full below.
                        </p>
                        <button
                          type="button"
                          className={`pl-lock${slotLocks.includes(piece.item.n) ? ' on' : ''}`}
                          aria-pressed={slotLocks.includes(piece.item.n)}
                          onClick={() => toggleLock(result.slot, piece.item.n)}
                        >
                          {slotLocks.includes(piece.item.n)
                            ? 'Locked — contributes nothing to the total'
                            : 'Lock anyway'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {result.ineligible ? (
                    <p className="pl-hidden-note">
                      {pluralize(result.ineligible, 'piece')} in this slot{' '}
                      {result.ineligible === 1 ? 'belongs' : 'belong'} to a planar set your trio
                      cannot wear, and {result.ineligible === 1 ? 'is' : 'are'} not offered.
                    </p>
                  ) : null}
                </section>
              );
            })
          : null}
      </Section>

      {/* ------------------------------------------------------------ 04 */}
      <Section
        num="04"
        id="pl-total"
        title="What you have locked"
        lede="The badge repeats here on purpose. A total is where you decide, and the standing of the rows under it should not be a scroll away when you do."
      >
        {!lockedPieces.length ? (
          <p className="pl-absent">
            {shownTrio.length
              ? 'Nothing locked yet. Lock a target above and it lands here.'
              : 'Pick three classes to begin.'}
          </p>
        ) : (
          <>
            <div className="pl-total">
              <span className="pl-total-count">
                <b>{count(lockedPieces.length)}</b> of {covered} targets locked
              </span>
              {lockedStanding.map((row) => (
                <span key={row.short} className="pl-standing" data-band={row.band}>
                  {row.short} ×{row.n}
                </span>
              ))}
              {lockedTotals.totals.map(([key, value]) => (
                <span key={key} className="pl-total-stat">
                  {shortStatLabel(key)} <b className="num">{signed(value)}</b>
                </span>
              ))}
            </div>
            {lockedTotals.withheld ? (
              <p className="pl-hint pl-warn">
                {pluralize(lockedTotals.withheld, 'locked piece')} contributes nothing to these
                totals, because nobody has published its stats. The total is of what is measured, and
                it is short by whatever those pieces are actually worth.
              </p>
            ) : null}

            {sets.length ? (
              <div className="pl-send">
                <label className="pl-field">
                  <span>Write these targets into a gear set</span>
                  <select value={sendTo} onChange={(event) => setSendTo(event.target.value)}>
                    <option value="">Choose a set…</option>
                    {orderedSets.map((gearSet) => {
                      const owner = characters.find((c) => c.id === gearSet.characterId);
                      return (
                        <option key={gearSet.id} value={gearSet.id}>
                          {owner ? `${owner.name} · ` : ''}
                          {gearSet.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!sendTo}
                  onClick={sendLocked}
                >
                  Write targets
                </button>
                {sent ? (
                  <p className="pl-hint" role="status">
                    {sent}
                  </p>
                ) : null}
                <p className="pl-hint">
                  Written at <strong>+{upgradeTier}</strong>, into Head, Chest, Arms, both Wrists,
                  Hands, Legs and Feet. If the set belongs to a different trio the planner marks
                  what that trio cannot wear rather than folding it into the totals, which is the
                  behaviour everywhere else in this app.
                </p>
              </div>
            ) : (
              <p className="pl-hint">
                <a href={href.characters}>Save a character and a gear set</a> and these targets can be
                written straight onto its paper doll.
              </p>
            )}
          </>
        )}
      </Section>

      {/* ------------------------------------------------------------ 05 */}
      <Section
        num="05"
        id="pl-uncovered"
        title="The slots these sets do not cover"
        lede="Not offered, rather than offered empty. An empty slot on a planner reads as 'nothing is good here', and that is a different statement from 'these sets contain nothing for it'."
      >
        <div className="pl-uncovered">
          {uncovered.map((position) => (
            <span key={position.id}>{position.label}</span>
          ))}
        </div>
        <p className="pl-hint">
          {pluralize(uncovered.length, 'position')} of the paper doll&apos;s 23. The planar sets
          carry no rings and no earrings; they also carry no neck, face, shoulders, back, waist,
          range, ammo, weapon or Any Slot piece. Fill those from{' '}
          <a href={href.upgrades()}>the ranked upgrades screen</a>, which reads the whole catalog.
        </p>
        <Note lead="Wrist counts twice.">
          You wear two bracers, so this tool lets you lock two — and the second one is a real
          decision, not a copy of the first. The count comes from the paper doll&apos;s own position
          list, the one validated against a live <code>/outputfile inventory</code>, so it is the
          same fact here as it is there rather than a second copy that could drift.
        </Note>
      </Section>

      {/* ------------------------------------------------------------ 06 */}
      <Section num="06" id="pl-assumption" title="One assumption, stated">
        <Note lead="Any piece one of your three classes can wear is offered to the trio.">
          That follows how multiclassing works elsewhere in this game, and this planner assumes it
          everywhere — armour proficiency, skill caps and item eligibility are all &ldquo;best of the
          trio&rdquo;. It has not been confirmed for equipment specifically. If you find a piece your
          trio cannot equip in game, that is a finding worth sending, and it is a correction to the
          gate rather than to this screen.
        </Note>
        <Note lead="The grouping is by name, and only the grouping.">
          A catalog item joins a set when its name begins with the set&apos;s name and it is worn in
          one of the seven covered slots. That is a name inference, which this repository is
          otherwise hostile to. It is admitted because it fills in nothing: every stat, slot, class,
          race, source and standing shown here is read off the piece&apos;s own record, and a wrong
          grouping can only file a piece under the wrong heading. The slot test is not decoration —
          without it, a Plane of Sky quest feather filed itself under the Wizard set.
        </Note>
      </Section>

      {/* ------------------------------------------------------------ 07 */}
      <Section
        num="07"
        id="pl-sources"
        title="Where these numbers come from"
        lede="Per piece, never in bulk. The tool this replaces badges every stat on the page T3 — one honest sentence about a hundred and six rows that do not all deserve the same sentence."
      >
        <p className="pl-body">
          Most of these pieces are wiki item records. Some of those records carry an era that places
          them in this game and are marked <em>Tier 2</em>; more of them carry no era at all, ship
          only because a live client has been seen holding the item, and are marked{' '}
          <em>Tier 5 · wiki stats, era unplaced</em> — the mark the standard says to apply on sight.
          A handful publish no numbers at all. Every card above carries its own mark and so does your
          locked total.
        </p>
        <p className="pl-body">
          Existence is a second and separate fact, and it is shown separately: whether a mob has been
          watched dropping the piece in EQL Source&apos;s parsed logs, whether it appears in a live
          inventory export, or whether it rests on a player&apos;s word. None of those says anything
          whatsoever about the stats on the row — the export is a name and an id table and carries no
          stat values at all. A blank on the source is shown here as nothing, never as a zero.
        </p>
        {withheldEvidence.length ? (
          <>
            <p className="pl-body">
              And where a piece is in the catalog with no numbers on it at all, this is the evidence
              that put it there — quoted, once, rather than paraphrased onto every card:
            </p>
            {withheldEvidence.map((line) => (
              <blockquote className="pl-quote" key={line}>
                {line}
              </blockquote>
            ))}
          </>
        ) : null}
        <p className="pl-body">
          <a href={href.sources}>Where every number came from</a> ·{' '}
          <a href={href.contamination}>what the contamination scanner finds here</a>
        </p>
      </Section>
    </div>
  );
}
