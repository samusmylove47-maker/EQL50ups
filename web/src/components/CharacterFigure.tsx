/**
 * The centre of the gear page.
 *
 * sixtyupgrades puts a full-height 3D character model between its two item
 * columns, and that column is what makes the screen read as a *character*
 * rather than as a form. We have no model — and the previous build put a stat
 * table there instead, which ended 592px short of the columns beside it and
 * turned the money screen into a spreadsheet with a hole in it.
 *
 * So: an equipment grid, laid out the way the client's own inventory window
 * lays one out (UI-REFERENCE §B4), built from the drawn slot glyphs. Head at
 * the top, feet at the bottom, symmetric about the spine. Every cell is the
 * slot itself — lit and tinted when filled, dim when not, carrying its +N — so
 * the panel answers the one question a paper doll exists to answer (*what is
 * still empty?*) in a single glance, and doubles as navigation.
 *
 * Under it: what the set is worth, and the client's Vitals block, hoisted out
 * of the stat sheet so each of those numbers has exactly one home on the page.
 */

import type { LoadoutContext } from '../engine/character';
import type { StatTotals } from '../engine/stats';
import type { SlotView } from '../selectors/gear';
import { count, dec, num } from '../lib/format';
import { itemNameColor } from '../lib/itemStyle';
import { itemHoverProps } from './ItemWindow';
import { SlotGlyph } from './SlotGlyph';
import { Vitals } from './StatPanel';

/**
 * Five rows, symmetric about the centre column: head and ears, then the torso,
 * then arms and hands, then what is held, then what is worn below.
 */
const FIGURE_ROWS: readonly (readonly string[])[] = [
  ['EAR_1', 'HEAD', 'FACE', 'NECK', 'EAR_2'],
  ['SHOULDERS', 'BACK', 'CHEST', 'ARMS', 'WRIST_1'],
  ['HANDS', 'FINGERS_1', 'WAIST', 'FINGERS_2', 'WRIST_2'],
  ['PRIMARY', 'SECONDARY', 'LEGS', 'RANGE', 'AMMO'],
  ['FEET', 'ANY_1', 'ANY_2'],
];

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

  return (
    <section className="figure" aria-label="Equipment overview">
      <div className="figure-grid">
        {FIGURE_ROWS.map((row, index) => (
          <div className="figure-row" key={index}>
            {row.map((id) => {
              const view = byId.get(id);
              if (!view) return null;
              const item = view.item;
              const tier = view.equipped?.upgrade.full ?? 0;
              const tone = item ? itemNameColor(item, context) : undefined;
              return (
                <button
                  type="button"
                  key={id}
                  className={`figure-cell${item ? ' on' : ''}${view.unresolved ? ' bad' : ''}`}
                  style={tone ? { color: tone } : undefined}
                  onClick={() => onPick(id)}
                  title={item ? `${view.position.label}: ${item.n}` : `${view.position.label}: empty`}
                  aria-label={
                    item
                      ? `${view.position.label}: ${item.n}. Change item.`
                      : `${view.position.label}: empty. Choose an item.`
                  }
                  {...itemHoverProps(
                    item,
                    view.equipped?.upgrade ?? { full: 0, fraction: 0 },
                    context,
                    view.position.type,
                  )}
                >
                  <SlotGlyph slot={view.position.type} size={24} />
                  {tier > 0 ? <span className="figure-tier">+{num(tier)}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

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
          <span>
            <b>{dec(totals.weight, 1)}</b>
            <i> wt</i>
          </span>
        </div>
      </div>

      <Vitals totals={totals} />
    </section>
  );
}
