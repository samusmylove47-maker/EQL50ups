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
import { levelCheck } from '../engine/character';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { dec, num, signed } from '../lib/format';
import { displayFlags, eraLabel, isLive, itemNameColor, usabilityNote } from '../lib/itemStyle';
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

export function ItemWindow({ item, upgrade, context, slot, wide = false }: ItemWindowProps) {
  const stats = statVector(item, upgrade);
  const weapon = item.wp;
  const damage = stats.find((s) => s.key === 'DMG')?.value ?? weapon?.dmg ?? 0;
  const headline = stats.filter((s) => HEADLINE.has(s.key));
  const rest = stats.filter((s) => !HEADLINE.has(s.key) && s.key !== 'DMG' && s.key !== 'DLY');
  const level = context ? levelCheck({ classes: item.cl, races: item.ra, ...(item.rl ? { rl: item.rl } : {}) }, context) : null;
  const note = usabilityNote(item, context);
  const era = eraLabel(item);
  const flags = displayFlags(item.fl);
  const glyphSlot = slot ?? item.sl[0] ?? 'ANY';

  return (
    <div className={`iwin${wide ? ' wide' : ''}`}>
      <div className="iwin-title">
        <span className="iwin-title-name">{item.n}</span>
      </div>

      <div className="iwin-body">
        <div className="iwin-top">
          <div className="iwin-icon" aria-hidden="true">
            <SlotGlyph slot={glyphSlot} size={34} />
          </div>
          <div className="iwin-ident">
            <div className="iwin-slots">{item.sl.join('  ') || 'NO SLOT'}</div>
            {flags.length ? <div className="iwin-flags">{flags.join('  ')}</div> : null}
            {era ? <div className="iwin-era">{era}</div> : null}
            {!isLive(item) ? <div className="iwin-warn">Not live in this era</div> : null}
          </div>
        </div>

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
                  <b>{signed(s.value)}</b>
                </span>
              ))}
            </div>
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

        <div className="iwin-group">Requirements</div>
        <div className="iwin-req">
          <div>
            <i>Class</i>
            <span>
              {item.cl.includes('ALL')
                ? 'ALL'
                : item.cl.map((c) => (wide ? (CLASS_NAMES[c as ClassCode] ?? c) : c)).join(' ') || 'ALL'}
            </span>
          </div>
          <div>
            <i>Race</i>
            <span>{item.ra.includes('ALL') ? 'ALL' : item.ra.join(' ') || 'ALL'}</span>
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
            <span className="iwin-gold">{item.wt === undefined ? '—' : dec(item.wt, 1)}</span>
          </div>
          {item.sz ? (
            <div>
              <i>Size</i>
              <span>{item.sz}</span>
            </div>
          ) : null}
        </div>

        {note ? (
          <div className={`iwin-verdict ${item ? '' : ''}`} style={{ color: itemNameColor(item, context) }}>
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
const listeners = new Set<() => void>();

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
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
} {
  const open = (element: Element | null, delay: number) => {
    if (!item || !element) return;
    if (timer) clearTimeout(timer);
    const box = element.getBoundingClientRect();
    const rect = { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    const target: HoverTarget = { item, upgrade, context, rect };
    if (slot) target.slot = slot;
    timer = setTimeout(() => showItem(target), delay);
  };
  return {
    onPointerEnter: (event) => open(event.currentTarget, 140),
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
    return () => {
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
