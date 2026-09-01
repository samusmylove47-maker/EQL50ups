/**
 * The EverQuest item window.
 *
 * UI-REFERENCE §B5 describes the client's own artefact precisely: a dark
 * stone-grey beveled panel, a **red gradient title bar with the item name in
 * white**, cyan group headers, green numerics, gold for currency-like values.
 * This is that window, and it is the one thing in the app that is supposed to
 * look as though it came out of the game rather than out of a CSS framework.
 *
 * It renders in two places from one implementation:
 *   - `ItemWindow` — the panel itself, used full-size inside the item dialog;
 *   - `itemHoverProps()` + `<ItemWindowLayer/>` — the same panel as a hover /
 *     focus card, floating beside a slot, a picker row or a browser row.
 *
 * The hover layer is a module-level singleton rather than per-row state: a
 * picker list is 150 rows, and 150 components each owning a timer and a portal
 * would cost more than the whole ranking pass it sits on top of.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { LoadoutContext } from '../engine/character';
import { CLASS_NAMES, type ClassCode } from '../engine/constants';
import {
  canUseClass, canUseRace, levelCheck,
  DUAL_WIELD_STANDING, offhandAdvisoryApplies,
} from '../engine/character';
import type { Item } from '../engine/types';
import { statsAreUnknown } from '../data/normalize';
import { restrictionText } from '../lib/restrictionText';
import { HASTE_PROVENANCE, HASTE_STACKING } from '../engine/stats';
import { scaleWeight, type UpgradeState } from '../engine/upgrade';
import { dec, num, signed } from '../lib/format';
import {
  displayFlags, eraLabel, existenceMark, itemNameColor, sourceStanding, usabilityNote,
} from '../lib/itemStyle';
import { ratioText, shortStatLabel, statLabel, statVector } from '../selectors/gear';
import { SlotGlyph } from './SlotGlyph';

/* ---------------------------------------------------------------- the panel */

export interface ItemWindowProps {
  item: Item;
  upgrade: UpgradeState;
  context?: LoadoutContext | undefined;
  /** Slot the window was opened from, so the glyph matches the position. */
  slot?: string;
  /** Wide layout for the dialog; the hover card stays narrow. */
  wide?: boolean;
}

/** Stats the client prints in the item's headline block rather than as a list. */
const HEADLINE = new Set(['AC', 'HP', 'MANA', 'ENDUR']);

/*
 * Provenance, per `research/SOURCING-STANDARD.md` rule 5: a player looking at a
 * number is entitled to know where it came from. eqlsource.com marks every
 * source card with a coloured rule on its top edge and a mono eyebrow naming
 * the tier; this window is the surface that prints an individual item's
 * numbers, so it carries both marks.
 *
 * **Two eyebrows, because there are two facts and they are independent.**
 *
 * This used to be one. `standingOf` read an 18-name list called
 * `TIER0_LIVE_ITEMS` and printed "Tier M · confirmed in the live game" for any
 * hit — but that list is the era-purge rescue list, and the file it stands for
 * is a `Location / Name / ID / Count / Slots` inventory export carrying no stat
 * values whatsoever. So Orb of Tishan printed the strongest label in the
 * vocabulary directly above `DMG 7 DLY 25 MANA +35 STR +9 STA +9`, every digit
 * of which is a wiki scrape, and Earthshaker — 9 of 9 predictions exact against
 * a live client window — printed nothing. The badge decorated twelve wiki stat
 * blocks and skipped the project's only client-verified one.
 *
 * The pipeline now computes both facts from the files that carry them, so this
 * component looks them up rather than deriving them:
 *
 *   `existenceMark` — is the item in the game? From the export and the player
 *                     reports. Says nothing about stats, and its wording is
 *                     about possession for exactly that reason.
 *   `sourceStanding` — where did these numbers come from? From the client
 *                     captures, the scrape, and the era that places or fails to
 *                     place that scrape. Never null: a row with nothing to
 *                     attribute says so.
 *
 * Orb of Tishan now reads "held in a live inventory" over "Tier 5 · wiki stats,
 * era unplaced", which is both halves of the truth about it.
 */

export function ItemWindow({ item, upgrade, context, slot, wide = false }: ItemWindowProps) {
  const stats = statVector(item, upgrade);
  const weapon = item.wp;
  const damage = stats.find((s) => s.key === 'DMG')?.value ?? weapon?.dmg ?? 0;
  const headline = stats.filter((s) => HEADLINE.has(s.key));
  const rest = stats.filter((s) => !HEADLINE.has(s.key) && s.key !== 'DMG' && s.key !== 'DLY');
  const level = context ? levelCheck({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, context) : null;
  const classOk = context ? canUseClass({ classes: item.cl }, context) : true;
  const raceOk = context ? canUseRace({ races: item.ra }, context) : true;
  const note = usabilityNote(item, context);
  const era = eraLabel(item);
  const flags = displayFlags(item.fl);
  const glyphSlot = slot ?? item.sl[0] ?? 'ANY';
  const standing = sourceStanding(item);
  const existence = existenceMark(item);
  const hasHaste = rest.some((s) => s.key === 'HASTE');

  return (
    <div className={`iwin${wide ? ' wide' : ''}`} data-standing={standing.band}>
      <div className="iwin-title">
        <span className="iwin-title-name">{item.n}</span>
      </div>

      <div className="iwin-body">
        {/* Existence first: it is the stronger and simpler claim, and it is
            what a reader checks before asking where the numbers came from. */}
        {existence ? <div className="standing-label">{existence.label}</div> : null}
        <div className="standing-label">{standing.label}</div>
        <div className="iwin-top">
          <div className="iwin-icon" aria-hidden="true">
            <SlotGlyph slot={glyphSlot} size={34} />
          </div>
          <div className="iwin-ident">
            <div className="iwin-slots">{item.sl.join('  ') || 'NO SLOT'}</div>
            {flags.length ? <div className="iwin-flags">{flags.join('  ')}</div> : null}
            {era ? <div className="iwin-era">{era}</div> : null}
          </div>
        </div>

        {/*
          An item we know is real and have no numbers for. Said in words, in the
          place the numbers would have been: the alternative is this panel
          printing nothing between the slot line and Requirements, which reads
          as an item with no stats rather than as stats nobody recorded.
        */}
        {statsAreUnknown(item) ? (
          <>
            <div className="iwin-group">Stats</div>
            <div className="iwin-unstatted">
              <p>
                <b>Not known.</b> This item exists in the game, but no catalog carries its stats.
                Nothing is shown here because there is nothing to show — and it cannot be ranked,
                scored or auto-filled, since a zero would be an invention rather than a measurement.
              </p>
              {item.evidence ? <p className="iwin-dim">{item.evidence}</p> : null}
            </div>
          </>
        ) : null}

        {headline.length || weapon ? (
          <div className="iwin-headline">
            {weapon ? (
              <span>
                DMG <b>{num(damage)}</b> DLY <b>{num(weapon.dly)}</b> RATIO{' '}
                <b>{ratioText(damage, weapon.dly)}</b>
              </span>
            ) : null}
            {headline.map((s) => (
              <span key={s.key}>
                {shortStatLabel(s.key)} <b>{signed(s.value)}</b>
              </span>
            ))}
          </div>
        ) : null}

        {rest.length ? (
          <>
            <div className="iwin-group">Stats at +{upgrade.full}</div>
            <div className="iwin-stats">
              {rest.map((s) => (
                <span key={s.key} className="iwin-stat">
                  <i>{statLabel(s.key)}</i>
                  {/*
                    One stat in this window is printed in a unit nobody has
                    confirmed, and it is marked here rather than only on the
                    totals panel — this is the surface a player reads while
                    deciding whether to farm the item, and a caveat two screens
                    away is a caveat they will not see. The dagger rides inside
                    the value so the 126px stat cell keeps its two columns; the
                    chip and the sentence it stands for are directly below.
                  */}
                  <b>
                    {signed(s.value)}
                    {s.key === 'HASTE' ? (
                      <sup title={HASTE_PROVENANCE.short}>†</sup>
                    ) : null}
                  </b>
                </span>
              ))}
            </div>
            {offhandAdvisoryApplies(item) ? (
              /*
                An offhand weapon, marked rather than filtered.

                The slot rule is applied — this item lists SECONDARY, which is
                Tier M and why it is offered at all. The CLASS rule is not: it
                is classic EverQuest's, unmeasured on Legends, and a gate built
                on it would refuse equipment the game may allow. `canUse` is
                deliberately untouched; the reader gets the fact instead of a
                shorter list they cannot interrogate.
              */
              <div className="iwin-effect">
                <span className="tier t5" title={DUAL_WIELD_STANDING.standing}>
                  † {DUAL_WIELD_STANDING.chip}
                </span>{' '}
                <span className="iwin-dim">
                  {DUAL_WIELD_STANDING.short}
                  {wide ? ` ${DUAL_WIELD_STANDING.settle}` : ''}
                </span>
              </div>
            ) : null}
            {hasHaste ? (
              <div className="iwin-effect">
                <span className="tier t5" title={HASTE_PROVENANCE.short}>
                  † {HASTE_PROVENANCE.chip}
                </span>{' '}
                <span className="iwin-dim">
                  {HASTE_PROVENANCE.classic} {wide ? `${HASTE_PROVENANCE.legends} ` : ''}No unit is
                  printed beside the figure, because which one applies here is unsettled.{' '}
                  {HASTE_STACKING.rule} {wide ? HASTE_STACKING.standing : ''}
                </span>
              </div>
            ) : null}
          </>
        ) : null}

        {item.fx?.length ? (
          <>
            <div className="iwin-group">Effects</div>
            {item.fx.map((fx) => (
              <div className="iwin-effect" key={`${fx.k}-${fx.n}`}>
                <i>{fx.k}</i> {fx.n}
                {fx.d ? <span className="iwin-dim"> — {fx.d}</span> : null}
              </div>
            ))}
          </>
        ) : null}

        {/*
          The receipt behind the eyebrow, in the dialog only. The eyebrow states
          the tier in four words; a reader who wants to check it needs the
          capture named or the reason stated, and the hover card is 330px wide
          with no room for either. Tier 2 gets nothing here on purpose — it is
          the catalog's ordinary condition, already named above, and repeating
          it on 2,045 items would turn the note into wallpaper.
        */}
        {wide && (standing.citation || standing.standing === 'tier-5') ? (
          <>
            <div className="iwin-group">Provenance</div>
            <div className="iwin-effect">
              <span className="iwin-dim">
                {standing.citation ??
                  `No source places this item in EverQuest Legends' content — the wiki gives it ${
                    item.era ? `${item.era}, which is past this game's era` : 'no era at all'
                  }. It is in the catalog because a live client holds it, but its numbers are a ` +
                    'wiki page that may describe the original EverQuest item of the same name.'}
              </span>
            </div>
            {standing.verifiedFields?.length ? (
              <div className="iwin-effect">
                <span className="iwin-dim">
                  Checked field by field: {standing.verifiedFields.join(', ')}. Anything else on
                  this item is catalog data that no client capture covers.
                </span>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="iwin-group">Requirements</div>
        <div className="iwin-req">
          {/* A requirement that fails is the reason the name is red, so it says
              so where the reader is looking rather than only at the bottom. */}
          <div>
            <i>Class</i>
            <span className={context && !classOk ? 'iwin-bad' : undefined}>
              {restrictionText(item.cl, (c) => (wide ? (CLASS_NAMES[c as ClassCode] ?? c) : c))}
            </span>
          </div>
          <div>
            <i>Race</i>
            <span className={context && !raceOk ? 'iwin-bad' : undefined}>
              {restrictionText(item.ra)}
            </span>
          </div>
          {item.rl ? (
            <div>
              <i>Level</i>
              <span className={level && !level.ok ? 'iwin-bad' : undefined}>
                {num(item.rl)}
                {level && !level.ok ? ` — your ${level.via ?? 'class'} is ${num(level.best)}` : ''}
              </span>
            </div>
          ) : null}
          <div>
            <i>Weight</i>
            {/*
              Weight is scaled like every other number in this window. The panel
              is headed "Stats at +N", and the client itself drops Earthshaker
              from 16 to 1.6 at +10, so printing the base here contradicted both
              the heading beside it and the game.
            */}
            <span className="iwin-gold">
              {item.wt === undefined ? '—' : dec(scaleWeight(item.wt, upgrade), 1)}
            </span>
          </div>
          {item.sz ? (
            <div>
              <i>Size</i>
              <span>{item.sz}</span>
            </div>
          ) : null}
        </div>

        {note ? (
          <div className="iwin-verdict" style={{ color: itemNameColor(item, context) }}>
            {note}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- the hover layer */

interface HoverTarget {
  item: Item;
  upgrade: UpgradeState;
  context: LoadoutContext | undefined;
  slot?: string;
  rect: { top: number; bottom: number; left: number; right: number };
}

let current: HoverTarget | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let anchor: Element | null = null;
const listeners = new Set<() => void>();

/*
 * Chromium dispatches a synthetic pointer event at the *unchanged* coordinates
 * after a scroll, so that hover state follows the content moving under a
 * stationary cursor. In a keyboard-driven list that is wrong twice over: it
 * pops an item window nobody asked for, and — in the picker, which uses the
 * same guard — it used to drag the active row out from under the arrow keys.
 * A pointer that has not moved is not a pointer that is pointing at anything.
 */
let lastX = Number.NaN;
let lastY = Number.NaN;

export function pointerMoved(event: { clientX: number; clientY: number }): boolean {
  if (event.clientX === lastX && event.clientY === lastY) return false;
  lastX = event.clientX;
  lastY = event.clientY;
  return true;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function showItem(target: HoverTarget): void {
  current = target;
  emit();
}

export function hideItemWindow(): void {
  anchor = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!current) return;
  current = null;
  emit();
}

/**
 * Handlers that make any element show the item window while pointed at or
 * focused. Spread onto a row, a slot card, a table row.
 */
export function itemHoverProps(
  item: Item | undefined,
  upgrade: UpgradeState,
  context: LoadoutContext | undefined,
  slot?: string,
): {
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
} {
  const open = (element: Element | null, delay: number) => {
    if (!item || !element) return;
    anchor = element;
    if (timer) clearTimeout(timer);
    const box = element.getBoundingClientRect();
    const rect = { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    const target: HoverTarget = { item, upgrade, context, rect };
    if (slot) target.slot = slot;
    timer = setTimeout(() => showItem(target), delay);
  };
  return {
    onPointerMove: (event) => {
      // Already armed for this row, or the pointer never actually moved.
      if (anchor === event.currentTarget) return;
      if (!pointerMoved(event)) return;
      open(event.currentTarget, 140);
    },
    onPointerLeave: hideItemWindow,
    // Keyboard users get it immediately; there is no pointer to "rest".
    onFocus: (event) => open(event.currentTarget, 0),
    onBlur: hideItemWindow,
  };
}

const CARD_WIDTH = 330;
const GAP = 12;

/**
 * Mounted once, at the app root. Portals the floating window into `body` so it
 * escapes the picker's own scroll container and the doll's grid.
 *
 * Marked `aria-hidden`: everything in it is already reachable — the slot button
 * names its item, the picker row reads its own stats, and the full window opens
 * in a real dialog. A hover card that also announced itself would read the same
 * item twice to a screen reader.
 */
export function ItemWindowLayer() {
  const target = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (!target) return;
    const node = ref.current;
    const height = node?.offsetHeight ?? 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceRight = vw - target.rect.right - GAP;
    const left =
      spaceRight >= CARD_WIDTH
        ? target.rect.right + GAP
        : target.rect.left - GAP - CARD_WIDTH >= 0
          ? target.rect.left - GAP - CARD_WIDTH
          : Math.max(GAP, vw - CARD_WIDTH - GAP);
    const top = Math.max(GAP, Math.min(target.rect.top, vh - height - GAP));

    setStyle({ left: Math.round(left), top: Math.round(top), visibility: 'visible' });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const drop = () => hideItemWindow();
    window.addEventListener('scroll', drop, true);
    window.addEventListener('resize', drop);
    /*
     * `pointerleave` never fires for an element that is removed under the
     * cursor, so navigating away from a hovered slot used to leave its window
     * floating over the next screen. Watch the anchor instead of trusting the
     * pointer, but only while something is open.
     */
    const watch = setInterval(() => {
      if (anchor && !anchor.isConnected) hideItemWindow();
    }, 200);
    return () => {
      clearInterval(watch);
      window.removeEventListener('scroll', drop, true);
      window.removeEventListener('resize', drop);
    };
  }, [target]);

  if (!target || typeof document === 'undefined') return null;

  return createPortal(
    <div className="iwin-float" ref={ref} style={style} aria-hidden="true">
      <ItemWindow
        item={target.item}
        upgrade={target.upgrade}
        context={target.context}
        {...(target.slot ? { slot: target.slot } : {})}
      />
    </div>,
    document.body,
  );
}
