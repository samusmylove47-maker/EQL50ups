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
 * Slots offset outboard at the bottom. The silhouette narrows at the head,
 * widens at the shoulders and narrows again at the feet, so the panel reads as
 * a body rather than as the 5/5/5/5/3 block of identical tiles it was.
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
import type { KeyboardEvent } from 'react';
import type { LoadoutContext } from '../engine/character';
import type { StatTotals } from '../engine/stats';
import type { SlotView } from '../selectors/gear';
import { count, num } from '../lib/format';
import { usabilityOf } from '../lib/itemStyle';
import { itemHoverProps } from './ItemWindow';
import { SlotGlyph } from './SlotGlyph';
import { Vitals } from './StatPanel';

/**
 * The body, as a grid. `null` is a gap in the silhouette.
 *
 * This array is the single source for both the visual placement (each cell
 * takes its row and column from its position here) and the arrow-key
 * navigation, so the two can never drift apart.
 */
const FIGURE_LAYOUT: readonly (readonly (string | null)[])[] = [
  [null, 'EAR_1', 'HEAD', 'EAR_2', null],
  [null, null, 'FACE', null, null],
  ['SHOULDERS', null, 'NECK', null, 'BACK'],
  ['ARMS', 'WRIST_1', 'CHEST', 'WRIST_2', 'RANGE'],
  ['HANDS', 'FINGERS_1', 'WAIST', 'FINGERS_2', 'AMMO'],
  [null, 'PRIMARY', 'LEGS', 'SECONDARY', null],
  ['ANY_1', null, 'FEET', null, 'ANY_2'],
];

const COLUMNS = 5;

interface Placed {
  id: string;
  row: number;
  col: number;
}

/** Row-major reading order, which is also the DOM order. */
const PLACED: readonly Placed[] = FIGURE_LAYOUT.flatMap((row, r) =>
  row.flatMap((id, c) => (id ? [{ id, row: r, col: c }] : [])),
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

  const cells = useRef(new Map<string, HTMLButtonElement>());
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
    cells.current.get(next)?.focus();
  }, []);

  return (
    <section className="figure" aria-label="Equipment overview">
      {/*
       * A group rather than 23 loose buttons: one label, one tab stop, and
       * cell names that read as *status* ("Head, Indicolite Helm, plus 8")
       * rather than repeating the item column's "Change item." verbatim.
       */}
      <div className="figure-body" role="group" aria-label="Equipment map — arrow keys to move">
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
              ref={(node) => {
                if (node) cells.current.set(place.id, node);
                else cells.current.delete(place.id);
              }}
              className={[
                'figure-cell',
                item ? 'on' : '',
                blocked ? 'blocked' : '',
                view.unresolved ? 'bad' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ gridColumn: place.col + 1, gridRow: place.row + 1 }}
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
