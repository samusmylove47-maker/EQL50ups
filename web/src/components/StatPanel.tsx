/**
 * The stat panel, laid out to match the in-game Stats window (UI-REFERENCE
 * §B3): Vitals, Regen, Stats with `/510` caps, Resists with `/1000` caps
 * including Void, Heroic Mods with their caps, Spell Mods, Skill Damage Mod.
 *
 * Three rules are absolute here.
 *
 * Values at their ceiling are flagged, because the client shows caps natively
 * and sixtyupgrades users complain about their absence.
 *
 * Nothing may ever render `NaN` — every number goes through the formatters in
 * `lib/format`, which coerce non-finite input to zero.
 *
 * **Every number appears exactly once.** There used to be a KPI strip above
 * this panel restating five of the six Vitals rows verbatim, each under a
 * different name (`HP`/`Hit Points`, `HASTE`/`Attack Speed`), with the caveat
 * "gear only" printed five times on one panel. The strip is gone; the Vitals
 * block below *is* the strip, and it is hoisted into the character panel on
 * the gear page by passing `vitals="hoisted"`. The caveat is stated once.
 *
 * Totals are gear-only: race and class base attributes are not shipped,
 * because the one source for them self-reports as unverified.
 */

import { useState } from 'react';
import {
  ATTRIBUTES,
  ATTRIBUTE_CAP,
  ATTRIBUTE_NAMES,
  HEROIC_MODS,
  RESIST_CAP,
  SAVES,
  SAVE_NAMES,
  SKILL_DAMAGE_MODS,
  SPELL_MODS,
} from '../engine/constants';
import {
  HASTE_PROVENANCE, HASTE_STACKING, withCap, type StatTotals,
} from '../engine/stats';
import { dec, finite, num } from '../lib/format';
import { ratioText } from '../selectors/gear';
import './StatPanel.css';

interface RowProps {
  label: string;
  value: number;
  cap?: number;
  suffix?: string;
  /** Decimal places, for the one quantity that is not a whole number. */
  places?: number;
  className?: string;
  /**
   * A provenance chip under the figure, in eqlsource's own tier-chip device.
   *
   * Used by exactly one row — see `Vitals` — because exactly one number in this
   * panel is printed in a unit nobody has confirmed. It rides on the row rather
   * than beside the panel so that it travels with the figure: the Vitals block
   * is hoisted into the gear page's character panel, where none of this file's
   * prose goes with it, and a badge that is off screen when the reader decides
   * is not a badge.
   */
  mark?: { text: string; tone: string; title: string };
}

function StatRow({ label, value, cap, suffix, places, className, mark }: RowProps) {
  const raw = finite(value);
  const capped = cap !== undefined ? withCap(raw, cap) : null;
  const shown = capped ? capped.value : raw;
  const text = places === undefined ? num(shown) : dec(shown, places);
  const classes = [
    'stat-row',
    className ?? '',
    shown === 0 ? 'zero' : '',
    capped?.atCap ? 'at-cap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <span className="k">{label}</span>
      <span className="v">
        {text}
        {suffix ?? ''}
        {capped ? <span className="cap">/{num(capped.cap)}</span> : null}
        {capped && capped.overCap > 0 ? (
          <span className="over" title="Points above the cap, wasted">
            +{num(capped.overCap)}
          </span>
        ) : null}
      </span>
      {mark ? (
        <span className={`tier ${mark.tone}`} title={mark.title}>
          {mark.text}
        </span>
      ) : null}
    </div>
  );
}

function Group({
  title,
  children,
  defaultOpen = true,
  note,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  note?: string;
  /** One column rather than an auto-fill grid, for rows that carry units. */
  wide?: boolean;
}) {
  /*
   * `defaultOpen` is a live fact, not a one-off: the Weapons group opens when a
   * weapon is equipped, which happens after this component first mounts.
   * Seeding `useState` with it froze the group shut, hiding damage, delay and
   * ratio for the whole session. Follow `defaultOpen` until the reader
   * expresses a preference, then honour theirs.
   */
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? defaultOpen;
  return (
    <details
      className={`stat-group${wide ? ' wide' : ''}`}
      open={open}
      onToggle={(e) => setChosen(e.currentTarget.open)}
    >
      <summary>
        <span className="section-label">{title}</span>
        {note ? <span className="hint" style={{ marginLeft: 'auto' }}>{note}</span> : null}
      </summary>
      <div className="stat-grid">{children}</div>
    </details>
  );
}

/**
 * The client's Vitals block, rendered as tiles.
 *
 * Exported on its own because the gear page hoists it into the character panel
 * in the middle of the doll; wherever it renders, it is the only place these
 * seven numbers appear.
 */
export function Vitals({ totals }: { totals: StatTotals }) {
  return (
    <div className="vitals">
      {/*
        The client's own abbreviations: its inventory window prints HP, Mana,
        End, AC and Attack. Using them is both more authentic and materially
        shorter, which is what the narrowest tile needs. Spelling "Endurance"
        out cost the tile more width than it had, and an earlier attempt to let
        it wrap only traded a truncated "ENDURANC" for a mid-word "ENDURA/NCE".
        A label that fits beats a label that breaks.
      */}
      <StatRow className="vital" label="HP" value={totals.hp} />
      <StatRow className="vital" label="Mana" value={totals.mana} />
      <StatRow className="vital" label="End" value={totals.endurance} />
      <StatRow className="vital" label="AC" value={totals.ac} />
      <StatRow className="vital" label="Attack" value={totals.attack} />
      {/*
        Atk Speed used to print `36%`.

        The label is right and it is the client's own: `research/validation/
        UI-REFERENCE.md` §B3 records the game's Stats window heading this row
        `Attack Speed %`, so the *total a player sees in the game* is a
        percentage, and that much is Tier M.

        The percent sign was wrong, because the number under it is not that
        total. It is the wiki's per-item haste field, and the two best sources
        in the field disagree about whether that field is the same percentage or
        a flat attack-speed value on another scale (`HASTE_PROVENANCE`). Putting
        the client's unit on the wiki's number asserted the disputed reading and
        printed it as confirmed — laundering, in one character.

        So: the figure, no unit, and a chip that says which of the two facts is
        which. Not a blank — the catalog holds the number and hiding it helps
        nobody; not a zero — that would be an invention.
      */}
      <StatRow
        className="vital"
        label="Atk Speed"
        value={totals.haste}
        {...(totals.haste
          ? {
              mark: {
                text: HASTE_PROVENANCE.chip,
                tone: 't5',
                title: `${HASTE_PROVENANCE.short} ${HASTE_PROVENANCE.settle}`,
              },
            }
          : {})}
      />
      {/* One decimal: rounding printed the same weight as 1.7 in one place and
          2 in the other. */}
      <StatRow className="vital" label="Equipped Wt" value={totals.weight} places={1} />
    </div>
  );
}

/**
 * The paragraph the chip on the Vitals tile cannot hold.
 *
 * The contamination page's shape, on the panel that prints the figure: what the
 * classic game did, what Legends is said to do, what this app therefore prints,
 * and the single artefact that would end the argument. Rendered only when a
 * haste figure is actually on screen — a caveat about a number nobody is
 * looking at is noise, and this project spends its warnings where the reader is.
 */
export function HasteNote({ totals }: { totals: StatTotals }) {
  if (!totals.haste) return null;
  return (
    <div className="stat-note" data-standing="distrust">
      <div className="stat-note-head">
        <span className="tier t5" title={HASTE_PROVENANCE.short}>
          {HASTE_PROVENANCE.chip}
        </span>
        <span className="section-label">Atk Speed carries an unconfirmed unit</span>
      </div>
      <p className="hint">
        {HASTE_PROVENANCE.classic} {HASTE_PROVENANCE.legends} This panel therefore prints the
        figure with no unit at all. The row's label is the client's own — the game's Stats
        window does head it <b>Attack Speed %</b> — but the number under it is the wiki's, and
        the two have not been shown to be the same thing.
      </p>
      <p className="hint">
        <b>{HASTE_STACKING.rule}</b>{' '}
        {totals.hasteSources > 1
          ? `${num(totals.hasteSources)} worn items carry a haste figure and only the largest is counted here. `
          : ''}
        {HASTE_STACKING.standing}
      </p>
      <p className="hint">
        {HASTE_PROVENANCE.settle} Send one and this note gets shorter.{' '}
        <a href="#/contamination">What else this build inherited</a>.
      </p>
    </div>
  );
}

export interface StatPanelProps {
  totals: StatTotals;
  /**
   * `hoisted` means the Vitals block is being rendered elsewhere on the page —
   * the gear tab puts it inside the character panel — so this panel must not
   * print those numbers a second time.
   */
  vitals?: 'inline' | 'hoisted';
}

export function StatPanel({ totals, vitals = 'inline' }: StatPanelProps) {
  const { primary, secondary } = totals.weapons;
  /*
   * Heroic Mods, Spell Mods and Skill Damage Mod are 23 rows that are
   * structurally always zero — no item in the corpus grants any of them, which
   * matches what a fully-geared character sees in the client. They belong on
   * screen for fidelity, but not at the same weight as the stats that move.
   * One toggle, closed by default.
   */
  const [showFull, setShowFull] = useState(false);

  return (
    <div className="stats">
      <div className="stats-head">
        <h2 className="section-label">Stat sheet</h2>
        <span className="hint">From gear only — race and class base values are not modelled.</span>
      </div>

      {vitals === 'inline' ? <Vitals totals={totals} /> : null}

      {/*
        Renders whether the Vitals block is here or hoisted, because the figure
        it is about is on screen either way — the gear page puts the tiles in
        the character panel and this panel below them, and a caveat that only
        appears on one of the two tabs is a caveat the reader can miss.
      */}
      <HasteNote totals={totals} />

      <div className="stat-columns">
        {/*
          `29/35` (damage over delay) and `107/510` (value against a cap) used
          to be the same glyph pattern 400px apart, so `36/35` read as being
          over a ceiling. The weapon pair now carries its units, and the ratio
          rides on the same row instead of restating the quotient underneath —
          which also stops the 3-column grid orphaning a lone "Secondary Ratio".
        */}
        <Group title="Weapons" wide defaultOpen={Boolean(primary || secondary)}>
          <div className="stat-row">
            <span className="k">Primary</span>
            <span className={primary ? 'v' : 'v dim'}>
              {primary ? `${num(primary.damage)}/${num(primary.delay)}` : '—'}
              {primary ? (
                <span className="cap">
                  {' '}
                  dmg/dly · ratio {ratioText(primary.damage, primary.delay)}
                </span>
              ) : null}
            </span>
          </div>
          <div className="stat-row">
            <span className="k">Secondary</span>
            <span className={secondary ? 'v' : 'v dim'}>
              {secondary ? `${num(secondary.damage)}/${num(secondary.delay)}` : '—'}
              {secondary ? (
                <span className="cap">
                  {' '}
                  dmg/dly · ratio {ratioText(secondary.damage, secondary.delay)}
                </span>
              ) : null}
            </span>
          </div>
        </Group>

        <Group title="Regen">
          <StatRow label="Combat HP Regen" value={totals.hpRegen} />
          <StatRow label="Combat Mana Regen" value={totals.manaRegen} />
          <StatRow label="Combat End Regen" value={totals.endRegen} />
        </Group>

        <Group title="Stats">
          {ATTRIBUTES.map((attr) => (
            <StatRow
              key={attr}
              label={ATTRIBUTE_NAMES[attr]}
              value={totals.attributes[attr]}
              cap={ATTRIBUTE_CAP}
            />
          ))}
        </Group>

        <Group title="Resists">
          {SAVES.map((save) => (
            <StatRow key={save} label={SAVE_NAMES[save]} value={totals.saves[save]} cap={RESIST_CAP} />
          ))}
        </Group>
      </div>

      {/*
        One disclosure, closed by default, rather than 23 permanently-zero rows
        given the same weight as the stats that move. Heroic Mods used to state
        "no item grants these yet" *and* then show you ten rows of nothing, and
        the Skill Damage list is five Monk skills at 0/100 on a BRD/WAR/BER.
      */}
      <details
        className="stat-group full-sheet"
        open={showFull}
        onToggle={(e) => setShowFull(e.currentTarget.open)}
      >
        <summary>
          <span className="section-label">Full client stat sheet</span>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            Heroic, Spell and Skill Damage mods — in the client, granted by no item yet
          </span>
        </summary>
        <div className="stat-columns">
          <Group title="Heroic Mods">
            {HEROIC_MODS.map((mod) => (
              <StatRow key={mod.key} label={mod.label} value={totals.heroic[mod.key] ?? 0} cap={mod.cap} />
            ))}
          </Group>

          <Group title="Spell Mods">
            {SPELL_MODS.map((mod) => (
              <StatRow key={mod.key} label={mod.label} value={totals.spellMods[mod.key] ?? 0} />
            ))}
          </Group>

          <Group title="Skill Damage Mod">
            {SKILL_DAMAGE_MODS.map((mod) => (
              <StatRow
                key={mod.key}
                label={mod.label}
                value={totals.skillMods[mod.key] ?? 0}
                cap={mod.cap}
              />
            ))}
          </Group>
        </div>
      </details>
    </div>
  );
}
