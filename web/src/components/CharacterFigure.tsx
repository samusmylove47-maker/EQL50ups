/**
 * The centre of the gear page.
 *
 * sixtyupgrades puts a full-height 3D character model between its two item
 * columns, and that column is what makes the screen read as a *character*
 * rather than as a form. A model is an explicit non-goal (DESIGN.md §4), and
 * the previous build put a stat table there instead, which ended 592px short
 * of the columns beside it and turned the money screen into a spreadsheet with
 * a hole in it.
 *
 * So: an equipment map, laid out **anatomically**. Head, face and ears at the
 * top with the ears flanking the helm; shoulders/arms/hands down the left
 * flank and back/range/ammo down the right, either side of a
 * neck-chest-waist-legs-feet spine; wrists and rings paired left and right;
 * weapons flanking the legs where a sheathed weapon hangs; and the two Any
 * Slots flanking the feet. The silhouette narrows at the head, widens at the
 * shoulders and narrows again at the feet, so the panel reads as a body rather
 * than as the 5/5/5/5/3 block of identical tiles it was.
 *
 * That last clause was false until the Any Slots moved inboard: sitting in the
 * outer columns at ankle level they made the bottom row exactly as wide as the
 * shoulders (256px against 256px), so the figure ended in a straight edge while
 * two comments said otherwise. Row extents are asserted in
 * `e2e/visual-system.spec.ts` now, because a comment is not a measurement.
 *
 * **It is a summary, not a second control surface.** It used to duplicate all
 * 23 rows of the two item columns with byte-identical accessible names — 46
 * `Change item` buttons on one page, so a keyboard user paid 23 surplus tab
 * stops crossing the middle of the doll and a screen-reader user heard the
 * whole set announced twice. The grid is now one composite widget: a single
 * tab stop, roving focus, arrow keys between cells, and names that state
 * status rather than repeat the columns' action.
 *
 * Under it: what the set is worth, and the client's Vitals block, hoisted out
 * of the stat sheet so each of those numbers has exactly one home on the page.
 */

import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { LoadoutContext } from '../engine/character';
import type { StatTotals } from '../engine/stats';
import type { SlotView } from '../selectors/gear';
import { count, num } from '../lib/format';
import { usabilityOf } from '../lib/itemStyle';
import { itemHoverProps } from './ItemWindow';
import { SlotGlyph } from './SlotGlyph';
import { Vitals } from './StatPanel';

/**
 * The game's own Equipment tab, cell for cell.
 *
 * Read off a client capture of the Equipment window with every item removed so
 * the labels are legible (Director, 2026-08-18, confirmed by counting the tab:
 * 23 positions, 2 Any, 21 worn, 18 distinct non-Any types, three doubled).
 * Six columns, four rows, one gap at the head of row 1:
 *
 *     .        Ear     Neck    Face    Head    Ear
 *     Finger   Wrist   Arms    Hands   Wrist   Finger
 *     Should   Chest   Back    Waist   Legs    Feet
 *     Pri      Sec     Range   Ammo    Any     Any
 *
 * **This replaced an invented 5x7 anatomical silhouette** — ears flanking a
 * helm, a chest-waist spine, weapons beside the legs — which read as a body and
 * was defended at length in this file for looking like one. It was a picture of
 * a character. The game draws a grid, and a player arriving from the client
 * reads this panel by recognising it, not by admiring it. Every position a
 * player already knows the place of was in the wrong place.
 *
 * The doubled slots were already mirrored rather than adjacent, which was the
 * one thing suspected and the one thing that was right.
 *
 * This array remains the single source for both the visual placement (each cell
 * takes its row and column from its position here) and the arrow-key
 * navigation, so the two can never drift apart.
 */
const FIGURE_LAYOUT: readonly (readonly (string | null)[])[] = [
  [null, 'EAR_1', 'NECK', 'FACE', 'HEAD', 'EAR_2'],
  ['FINGERS_1', 'WRIST_1', 'ARMS', 'HANDS', 'WRIST_2', 'FINGERS_2'],
  ['SHOULDERS', 'CHEST', 'BACK', 'WAIST', 'LEGS', 'FEET'],
  ['PRIMARY', 'SECONDARY', 'RANGE', 'AMMO', 'ANY_1', 'ANY_2'],
];

const COLUMNS = 6;

interface Placed {
  id: string;
  row: number;
  col: number;
  /*
   * Built once, at module scope. A fresh `{gridColumn, gridRow}` object per
   * render would make React re-apply two style properties on all 23 cells every
   * time — and Auto-fill renders the doll once per slot it places.
   */
  style: CSSProperties;
}

/** Row-major reading order, which is also the DOM order. */
const PLACED: readonly Placed[] = FIGURE_LAYOUT.flatMap((row, r) =>
  row.flatMap((id, c) =>
    id ? [{ id, row: r, col: c, style: { gridColumn: c + 1, gridRow: r + 1 } }] : [],
  ),
);

/**
 * Where an arrow key lands.
 *
 * Left/right walk the reading order, so they never dead-end in a gap.
 * Up/down keep the column where they can and otherwise take the nearest
 * occupied column in the target row — the behaviour a sparse grid needs if
 * arrowing down the spine is not to stop at the first hole.
 */
function move(from: Placed, key: string): string | null {
  const index = PLACED.indexOf(from);
  if (key === 'ArrowRight') return PLACED[(index + 1) % PLACED.length]!.id;
  if (key === 'ArrowLeft') return PLACED[(index - 1 + PLACED.length) % PLACED.length]!.id;
  if (key === 'Home') return PLACED[0]!.id;
  if (key === 'End') return PLACED[PLACED.length - 1]!.id;

  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (!step) return null;
  const rows = FIGURE_LAYOUT.length;
  for (let r = from.row + step; r >= 0 && r < rows; r += step) {
    const row = FIGURE_LAYOUT[r];
    if (!row) continue;
    let best: { id: string; distance: number } | null = null;
    for (let c = 0; c < COLUMNS; c += 1) {
      const id = row[c];
      if (!id) continue;
      const distance = Math.abs(c - from.col);
      if (!best || distance < best.distance) best = { id, distance };
    }
    if (best) return best.id;
  }
  return null;
}

/*
 * The silhouette is gone, deliberately.
 *
 * A decorative SVG body used to sit behind the cells — head, torso, arms, legs —
 * drawn in the layout's own coordinate system so it stayed registered to a 5x7
 * arrangement that spelled out a figure. It was good work and it is the wrong
 * idea: the game's Equipment tab is a grid, and this panel's job is to be
 * recognised by someone who has just alt-tabbed out of the client. A body drawn
 * behind the game's grid would be decoration competing with recognition.
 *
 * Removed rather than adapted, because there is nothing to adapt it to.
 */

export interface CharacterFigureProps {
  views: readonly SlotView[];
  totals: StatTotals;
  /** Sum of the equipped items' EP under this set's own weights. */
  setScore: number;
  context?: LoadoutContext | undefined;
  onPick: (positionId: string) => void;
}

export function CharacterFigure({
  views,
  totals,
  setScore,
  context,
  onPick,
}: CharacterFigureProps) {
  const byId = new Map(views.map((v) => [v.position.id, v]));
  const filled = views.filter((v) => Boolean(v.item)).length;

  /*
   * One ref on the container, and the cells are found by `data-pos`. A ref
   * callback per cell would be a fresh closure on every render, so React would
   * detach and reattach all 23 of them each time a slot changed — and during
   * Auto-fill that is 23 renders of the whole doll.
   */
  const grid = useRef<HTMLDivElement>(null);
  /*
   * Roving tabindex: exactly one cell is reachable by Tab, and the arrow keys
   * move focus within the widget. `null` means "the first one", so the grid
   * always has a tab stop even before it has been visited.
   */
  const [focused, setFocused] = useState<string | null>(null);
  const active = focused ?? PLACED[0]!.id;

  const onKeyDown = useCallback((event: KeyboardEvent, at: Placed) => {
    const next = move(at, event.key);
    if (!next) return;
    event.preventDefault();
    setFocused(next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-pos="${next}"]`)?.focus();
  }, []);

  return (
    <section className="figure" aria-label="Equipment overview">
      {/*
       * A group rather than 23 loose buttons: one label, one tab stop, and
       * cell names that read as *status* ("Head, Indicolite Helm, plus 8")
       * rather than repeating the item column's "Change item." verbatim.
       */}
      <div
        className="figure-body"
        role="group"
        aria-label="Equipment map — arrow keys to move"
        ref={grid}
      >
        {/* First child, so it paints under every cell without a z-index. */}
        {PLACED.map((place) => {
          const view = byId.get(place.id);
          if (!view) return null;
          const item = view.item;
          const tier = view.equipped?.upgrade.full ?? 0;
          const blocked = item ? usabilityOf(item, context) === 'blocked' : false;
          const state = item ? `${item.n}${tier > 0 ? `, plus ${num(tier)}` : ''}` : 'empty';
          // The hover card binds `onFocus` too, so the two handlers are merged
          // rather than one silently overwriting the other.
          const hover = itemHoverProps(
            item,
            view.equipped?.upgrade ?? { full: 0, fraction: 0 },
            context,
            view.position.type,
          );
          return (
            <button
              type="button"
              key={place.id}
              className={[
                'figure-cell',
                item ? 'on' : '',
                blocked ? 'blocked' : '',
                view.unresolved ? 'bad' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={place.style}
              data-pos={place.id}
              tabIndex={place.id === active ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, place)}
              onClick={() => onPick(place.id)}
              title={item ? `${view.position.label}: ${item.n}` : `${view.position.label}: empty`}
              aria-label={`${view.position.label}, ${state}`}
              {...hover}
              onFocus={(event) => {
                setFocused(place.id);
                hover.onFocus(event);
              }}
            >
              <SlotGlyph slot={view.position.type} size={24} />
              {tier > 0 ? (
                <span className="figure-tier" data-tier={tier}>
                  +{num(tier)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/*
       * Two numbers, not three. `82 wt` used to sit ~300px above
       * `EQUIPPED WEIGHT 82` in the same column, under two different names.
       */}
      <div className="figure-meter">
        <div className="figure-meter-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((filled / Math.max(1, views.length)) * 100)}%` }} />
        </div>
        <div className="figure-meter-row">
          <span>
            <b>{num(filled)}</b>
            <i>/{num(views.length)} slots</i>
          </span>
          <span>
            <b>{count(Math.round(setScore))}</b>
            <i> EP</i>
          </span>
        </div>
      </div>

      <Vitals totals={totals} />
    </section>
  );
}
