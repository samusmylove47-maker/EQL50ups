/**
 * Set-vs-set diff — `#/set/{id}/compare/{id2}`.
 *
 * The route DESIGN.md §3 declared and the build never implemented. Three
 * columns per row, A on the left, B on the right, and what changed in the
 * middle: the centre column is the whole point, because the alternative the
 * reference tool offers is two browser tabs and a comparison held in your head
 * across forty numbers.
 *
 * Cap awareness is carried through from the scoring engine. On the attribute
 * and resist groups a raw delta is not a gain — a `+40 STR` that lands above
 * 510 buys nothing — so those rows print what moved, what counts, and what
 * falls off the ceiling.
 *
 * Every awkward pairing has an answer rather than a blank: a set against
 * itself, a set against an empty one, two sets belonging to different
 * characters, and an id that no longer exists.
 */

import { useEffect, useMemo } from 'react';
import { describeFor, loadoutFor } from '../engine/character';
import { useCatalog } from '../data/catalog';
import { dec, ep as epText, num, signed, signedDec } from '../lib/format';
import { diffSets, type CapRow, type DiffGroup, type PlainRow, type SlotDiff } from '../lib/setDiff';
import { shortStatLabel } from '../selectors/gear';
import { href, navigate } from '../router';
import { characterFor, useApp } from '../state/store';
import { fractionDenominator } from '../engine/upgrade';
import './SetCompare.css';

const STATUS_LABEL: Record<SlotDiff['status'], string> = {
  'both-empty': 'Both empty',
  same: 'Unchanged',
  retuned: 'Retuned',
  swapped: 'Swapped',
  added: 'Added',
  removed: 'Removed',
};

function deltaClass(delta: number, neutral?: boolean): string {
  if (!delta) return 'zero';
  if (neutral) return 'neutral';
  return delta > 0 ? 'up' : 'down';
}

function valueText(row: PlainRow, side: 'a' | 'b'): string {
  const value = side === 'a' ? row.a : row.b;
  return `${row.places === undefined ? num(value) : dec(value, row.places)}${row.suffix ?? ''}`;
}

function deltaText(row: PlainRow): string {
  return row.places === undefined ? signed(row.delta) : signedDec(row.delta, row.places);
}

function SlotSide({ side, kind }: { side: SlotDiff['a']; kind: 'a' | 'b' }) {
  if (!side) {
    return (
      <div className={`cmp-side cmp-side-${kind} empty`}>
        <span className="cmp-empty">Empty</span>
      </div>
    );
  }
  return (
    <div className={`cmp-side cmp-side-${kind}`}>
      <span className="cmp-item">
        <span className="cmp-name">{side.itemName}</span>
        <span className="cmp-tier" data-tier={side.upgrade.full}>
          +{num(side.upgrade.full)}
        </span>
        {side.upgrade.fraction ? (
          <span className="cmp-banked" title="Motes banked toward the next tier">
            {num(side.upgrade.fraction)}/{num(fractionDenominator(side.upgrade.full))}
          </span>
        ) : null}
        {side.unresolved ? <span className="tag">Not in catalog</span> : null}
      </span>
      <span className="cmp-sub">
        {epText(side.ep)} EP
        {side.donors.length
          ? ` · ${side.donors.length} exaltation${side.donors.length === 1 ? '' : 's'}`
          : ''}
      </span>
    </div>
  );
}

/**
 * A capped row's third number.
 *
 * Printed only when it says something the raw delta does not — when a ceiling
 * ate part of the move, or when the candidate is sitting on the ceiling. Every
 * row carrying `+6 counts` under `+6` trains the eye to skip the line, which is
 * exactly the line that matters on the rows where the two differ. The group
 * header states the total either way, so the accounting is never absent.
 */
function creditNote(row: CapRow): string {
  const wasted = row.delta > 0 ? Math.max(0, row.delta - row.creditable) : 0;
  const absorbed = row.delta < 0 ? Math.max(0, row.creditable - row.delta) : 0;
  if (wasted) return `only ${signed(row.creditable)} counts · ${num(wasted)} above the cap`;
  if (absorbed) return `${signed(row.creditable)} counts · ${num(absorbed)} absorbed above the cap`;
  if (row.atCapB) return 'at the ceiling';
  return '';
}

function CappedRow({ row }: { row: CapRow }) {
  const note = creditNote(row);
  return (
    <div className={`cmp-statrow${row.delta ? '' : ' zero'}`}>
      <span className="cmp-statlabel">{row.label}</span>
      <span className="cmp-statvalue">
        {num(Math.min(row.a, row.cap))}
        <span className="cmp-cap">/{num(row.cap)}</span>
      </span>
      <span className={`cmp-statdelta ${deltaClass(row.delta)}`}>
        <span className="cmp-raw">{signed(row.delta)}</span>
        {note ? <span className="cmp-credit">{note}</span> : null}
      </span>
      <span className="cmp-statvalue">
        {num(Math.min(row.b, row.cap))}
        <span className="cmp-cap">/{num(row.cap)}</span>
      </span>
    </div>
  );
}

function PlainStatRow({ row }: { row: PlainRow }) {
  return (
    <div className={`cmp-statrow${row.delta ? '' : ' zero'}`}>
      <span className="cmp-statlabel">{row.label}</span>
      <span className="cmp-statvalue">{valueText(row, 'a')}</span>
      <span className={`cmp-statdelta ${deltaClass(row.delta, row.neutral)}`}>
        <span className="cmp-raw">{deltaText(row)}</span>
      </span>
      <span className="cmp-statvalue">{valueText(row, 'b')}</span>
    </div>
  );
}

function StatGroup({ group }: { group: DiffGroup }) {
  // `CapRow extends PlainRow`, so the union of the two row arrays reads as
  // `PlainRow[]` for counting — no need to branch just to measure.
  const rows: PlainRow[] = group.rows;
  const moved = rows.filter((row) => row.delta !== 0).length;

  /*
   * The group's cap accounting, stated once whether or not any row lost
   * anything: "all of +21 counts" is a real answer to "how much of this gain is
   * creditable", and it is the answer most of the time.
   */
  let capNote = '';
  if (group.kind === 'capped') {
    let gained = 0;
    let credited = 0;
    for (const row of group.rows) {
      if (row.delta <= 0) continue;
      gained += row.delta;
      credited += row.creditable;
    }
    const wasted = gained - credited;
    capNote = !gained
      ? ''
      : wasted > 0
        ? ` · only ${signed(credited)} of ${signed(gained)} counts`
        : ` · all of ${signed(gained)} counts`;
  }

  return (
    <section className="cmp-group">
      <header className="cmp-grouphead">
        <h3 className="section-label">{group.title}</h3>
        <span className="hint">
          {moved ? `${moved} of ${rows.length} changed` : 'no change'}
          {group.kind === 'capped' ? ` · ceiling ${num(group.cap)}${capNote}` : ''}
        </span>
      </header>
      <div className="cmp-statrows">
        {group.kind === 'capped'
          ? group.rows.map((row) => <CappedRow key={row.key} row={row} />)
          : group.rows.map((row) => <PlainStatRow key={row.key} row={row} />)}
      </div>
    </section>
  );
}

function SetChooser({
  fromId,
  label,
}: {
  fromId: string;
  label: string;
}) {
  const state = useApp();
  const source = state.sets.find((s) => s.id === fromId);
  const options = state.sets.filter((s) => s.id !== fromId);
  const nameOf = (characterId: string) =>
    state.characters.find((c) => c.id === characterId)?.name ?? 'Unknown character';

  if (!options.length) {
    return (
      <div className="empty-state">
        <h2>Nothing to compare against</h2>
        <p>
          A diff needs two sets. {source ? `"${source.name}" is` : 'This is'} the only set in this
          browser's library — duplicate it, change something, and the difference becomes visible.
        </p>
        <div className="empty-actions">
          {source ? (
            <a className="btn btn-primary" href={href.set(fromId)}>
              Back to {source.name}
            </a>
          ) : null}
          <a className="btn" href={href.characters}>
            Your characters
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="cmp-chooser">
      <h2 className="page-title">{label}</h2>
      <p className="hint">
        Pick the set to compare {source ? `"${source.name}"` : 'this set'} against. Sets belonging to
        another character can be compared too — the diff says so rather than pretending the two are
        interchangeable.
      </p>
      <ul className="cmp-choices">
        {options.map((option) => (
          <li key={option.id}>
            <a className="cmp-choice" href={href.compare(fromId, option.id)}>
              <span className="cmp-choicename">{option.name}</span>
              <span className="hint">
                {nameOf(option.characterId)} · {Object.keys(option.slots).length} equipped
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SetCompare({ id, id2 }: { id: string; id2: string }) {
  const state = useApp();
  const catalog = useCatalog();
  const ensureAll = useCatalog((s) => s.ensureAll);

  const setA = state.sets.find((s) => s.id === id);
  const setB = state.sets.find((s) => s.id === id2);

  // A diff spans all twenty-three slots at once, so the per-slot lazy shards
  // the editor relies on are not enough: without this, half the rows would read
  // "Not in catalog" purely because their shard had never been opened.
  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const characterA = characterFor(state, setA);
  const characterB = characterFor(state, setB);

  const diff = useMemo(
    () => (setA && setB ? diffSets(setA, setB, catalog) : null),
    [setA, setB, catalog],
  );

  if (!setA) {
    return (
      <div className="empty-state">
        <h2>Set not found</h2>
        <p>
          The set on the left of this comparison is not in this browser's library. It may have been
          deleted, or the link may have come from another browser.
        </p>
        <div className="empty-actions">
          <a className="btn btn-primary" href={href.characters}>
            Your characters
          </a>
        </div>
      </div>
    );
  }

  if (!setB) {
    return (
      <div className="cmp">
        {id2 ? (
          <div className="notice" role="status">
            <span className="grow">
              The set you asked to compare against is no longer in this library. Pick another below.
            </span>
          </div>
        ) : null}
        <SetChooser fromId={id} label={`Compare "${setA.name}" with…`} />
      </div>
    );
  }

  const loading = catalog.status === 'loading' || catalog.status === 'idle';

  /*
   * Which set's weights every EP number on this screen is scored under. `lens`
   * falls through to B when A carries no weight at all, so naming A here — as
   * this screen used to, in two places — labelled the columns with a profile
   * they were not scored under.
   */
  /*
   * Two plans for one character can still target different class trios, and
   * then "better" is not a single question: an item the BER plan wins with may
   * be unwearable by the BRD one. The character banner below only fires when
   * the *characters* differ, so without this a same-character, different-trio
   * comparison read as though the two were interchangeable.
   */
  const loadoutA = characterA ? loadoutFor(characterA, setA.loadoutId) : undefined;
  const loadoutB = characterB ? loadoutFor(characterB, setB.loadoutId) : undefined;
  const crossLoadout =
    Boolean(diff?.sameCharacter) && Boolean(loadoutA && loadoutB) && loadoutA?.id !== loadoutB?.id;

  const lensSet = diff?.lensOwner === 'b' ? setB : setA;
  const otherSet = diff?.lensOwner === 'b' ? setA : setB;
  const otherOwnEp = diff?.lensOwner === 'b' ? diff.epA : (diff?.epB ?? 0);

  return (
    <div className="cmp">
      <header className="cmp-head">
        <div className="cmp-headline">
          <h1 className="page-title">Compare sets</h1>
          <div className="cmp-actions">
            <a className="btn btn-sm" href={href.compare(id2, id)}>
              ⇄ Swap sides
            </a>
            <a className="btn btn-sm" href={href.set(id)}>
              Edit {setA.name}
            </a>
            <a className="btn btn-sm" href={href.set(id2)}>
              Edit {setB.name}
            </a>
          </div>
        </div>

        <div className="cmp-pair">
          <div className="cmp-pairside">
            <span className="section-label">Baseline</span>
            <strong className="cmp-setname">{setA.name}</strong>
            <span className="hint">
              {characterA
                ? `${characterA.name} · ${describeFor(characterA, setA.loadoutId)}`
                : 'No character'}
              {` · ${diff?.filledA ?? 0} equipped`}
            </span>
          </div>
          <div className="cmp-pairmid" aria-hidden="true">
            →
          </div>
          <div className="cmp-pairside">
            <span className="section-label">Candidate</span>
            <strong className="cmp-setname">{setB.name}</strong>
            <span className="hint">
              {characterB
                ? `${characterB.name} · ${describeFor(characterB, setB.loadoutId)}`
                : 'No character'}
              {` · ${diff?.filledB ?? 0} equipped`}
            </span>
          </div>
        </div>
      </header>

      {id === id2 ? (
        <p className="cmp-banner" role="status">
          This is the same set on both sides, so every row below is unchanged by construction. Use
          Swap sides or the chooser to pick a second set.
        </p>
      ) : null}

      {diff && !diff.sameCharacter ? (
        <p className="cmp-banner" role="status">
          These sets belong to different characters
          {characterA && characterB ? ` — ${characterA.name} and ${characterB.name}` : ''}. The item
          and stat columns still subtract cleanly, but eligibility, per-class levels and the active
          loadout differ, so "better" here means better as a pile of stats, not necessarily wearable
          by both.
        </p>
      ) : null}

      {crossLoadout && characterA && characterB ? (
        <p className="cmp-banner" role="status">
          These two plans target different loadouts —{' '}
          <strong>{describeFor(characterA, setA.loadoutId)}</strong> and{' '}
          <strong>{describeFor(characterB, setB.loadoutId)}</strong>. The stat columns still
          subtract cleanly, but an item one trio can equip the other may not, so a gain here is not
          necessarily a gain you can wear.
        </p>
      ) : null}

      {diff && diff.weightsDiffer ? (
        <p className="cmp-banner" role="status">
          The two sets carry different EP weights. Per-slot and total EP below are scored under{' '}
          <strong>{lensSet.name}</strong>'s profile so the columns subtract on one scale;{' '}
          <strong>{otherSet.name}</strong> is worth {epText(otherOwnEp)} EP under its own.
          {diff.lensOwner === 'b'
            ? ` ${setA.name} carries no weights at all, so its profile would score every item zero.`
            : ''}
        </p>
      ) : null}

      {loading ? (
        <p className="hint" role="status">
          Loading item data — item names and stats fill in as the shards arrive.
        </p>
      ) : null}

      {diff ? (
        <>
          <div className="cmp-kpis">
            <div className="cmp-kpi">
              <span className="section-label">Equivalency points</span>
              <strong className={`cmp-kpivalue ${deltaClass(diff.epDelta)}`}>
                {signedDec(diff.epDelta)}
              </strong>
              {/* Both ends of the headline's own subtraction, on the lens
                  scale. Printing A under *its own* weights here put two scales
                  in one tile: a set with cleared weights read "0.0 → 1427.5"
                  under a red negative delta. */}
              <span className="hint">
                {epText(diff.epALens)} → {epText(diff.epBUnderLens)}
              </span>
            </div>
            <div className="cmp-kpi">
              <span className="section-label">Slots changed</span>
              <strong className="cmp-kpivalue">
                {num(diff.counts.swapped + diff.counts.added + diff.counts.removed + diff.counts.retuned)}
              </strong>
              <span className="hint">
                {num(diff.counts.swapped)} swapped · {num(diff.counts.added)} added ·{' '}
                {num(diff.counts.removed)} removed · {num(diff.counts.retuned)} retuned
              </span>
            </div>
            <div className="cmp-kpi">
              <span className="section-label">Creditable stat gain</span>
              <strong className={`cmp-kpivalue ${deltaClass(diff.capSummary.credited)}`}>
                {signed(diff.capSummary.credited)}
              </strong>
              <span className="hint">
                {signed(diff.capSummary.raw)} raw
                {diff.capSummary.wasted
                  ? ` · ${num(diff.capSummary.wasted)} lost above the 510/1000 ceilings`
                  : ' · nothing lost to a ceiling'}
              </span>
            </div>
            <div className="cmp-kpi">
              <span className="section-label">Equipped weight</span>
              <strong className="cmp-kpivalue neutral">
                {signedDec(diff.totalsB.weight - diff.totalsA.weight, 1)}
              </strong>
              <span className="hint">
                {dec(diff.totalsA.weight, 1)} → {dec(diff.totalsB.weight, 1)}
              </span>
            </div>
          </div>

          {diff.identical ? (
            <p className="cmp-banner" role="status">
              These two sets are identical: the same item at the same tier with the same exaltation
              donors in every one of the twenty-three positions, and no stat differs.
            </p>
          ) : null}

          {diff.filledA === 0 && diff.filledB === 0 ? (
            <p className="cmp-banner" role="status">
              Neither set has anything equipped yet, so there is nothing to subtract. Equip some
              items and come back.
            </p>
          ) : null}

          <section className="cmp-slots" aria-label="Slot by slot">
            <header className="cmp-grouphead">
              <h2 className="section-label">Slot by slot</h2>
              <span className="hint">
                EP scored under {lensSet.name}'s weights, cap-aware against the rest of each set ·
                unchanged slots dimmed
              </span>
            </header>
            <div className="cmp-slothead" aria-hidden="true">
              <span>{setA.name}</span>
              <span className="cmp-middle">Change</span>
              <span>{setB.name}</span>
            </div>
            {diff.slots.map((slot) => (
              <div
                key={slot.position.id}
                className={`cmp-slot status-${slot.status}${slot.changed ? '' : ' quiet'}`}
              >
                <div className="cmp-slotlabel">{slot.position.label}</div>
                <SlotSide side={slot.a} kind="a" />
                <div className="cmp-mid">
                  <span className={`cmp-status status-${slot.status}`}>
                    {STATUS_LABEL[slot.status]}
                  </span>
                  {slot.status === 'both-empty' ? null : (
                    <span className={`cmp-epdelta ${deltaClass(slot.epDelta)}`}>
                      {signedDec(slot.epDelta)} EP
                    </span>
                  )}
                  {slot.changed && slot.stats.length ? (
                    <span className="cmp-statline">
                      {slot.stats.slice(0, 5).map((stat) => (
                        <span key={stat.key} className={deltaClass(stat.delta)}>
                          {signed(stat.delta)} {shortStatLabel(stat.key)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
                <SlotSide side={slot.b} kind="b" />
              </div>
            ))}
          </section>

          <div className="cmp-groups">
            {diff.groups.map((group) => (
              <StatGroup key={group.title} group={group} />
            ))}
          </div>

          <p className="hint cmp-foot">
            Totals are from gear only. Attribute and resist rows print the capped value the client
            shows, and the middle column separates what a change actually delivers from what it
            spends above a ceiling.
          </p>
        </>
      ) : null}

      <div className="cmp-footactions">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => navigate(href.compare(id))}
        >
          Compare with a different set…
        </button>
      </div>
    </div>
  );
}
