/**
 * Slot glyphs.
 *
 * The catalog carries an `iconId` for almost every item, but those resolve to
 * `File:Item <id>.png` on the wiki, which this build cannot reach. Rather than
 * fall back to two-letter monograms — which collide, and which make the paper
 * doll read as two bulleted lists — each slot type gets a drawn mark.
 *
 * Deliberately simple line work at a 24-unit grid: these sit at 28-36px and
 * must stay legible as silhouettes, so no detail smaller than about 1.5 units
 * and no fill beyond a couple of solid accents.
 */

import type { CSSProperties, ReactElement } from 'react';

export type GlyphKey =
  | 'EAR' | 'HEAD' | 'FACE' | 'NECK' | 'SHOULDERS' | 'ARMS' | 'BACK' | 'WRIST'
  | 'RANGE' | 'HANDS' | 'PRIMARY' | 'SECONDARY' | 'FINGERS' | 'CHEST' | 'LEGS'
  | 'FEET' | 'WAIST' | 'AMMO' | 'ANY';

/** Path data per slot, drawn on a 0 0 24 24 grid. */
const PATHS: Record<GlyphKey, ReactElement> = {
  // A curled ear with a dangling stone.
  EAR: (
    <>
      <path d="M9 6.5a4 4 0 0 1 6.5 3c0 2.4-2 3.3-2 5.2a1.8 1.8 0 0 0 1.2 1.7" />
      <circle cx="11.6" cy="10" r="1.5" />
      <path d="M15.7 18.2v1.4" />
      <circle cx="15.7" cy="21" r="1.4" className="glyph-accent" />
    </>
  ),
  // A great helm with a brow bar and eye slit.
  HEAD: (
    <>
      <path d="M5 13a7 7 0 0 1 14 0v5.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5z" />
      <path d="M5.4 11.5h13.2" />
      <path d="M9 14.5h2M13 14.5h2" className="glyph-accent" />
    </>
  ),
  // A visor mask with cheek line.
  FACE: (
    <>
      <path d="M6 7h12v6.5a6 6 0 0 1-6 6 6 6 0 0 1-6-6z" />
      <path d="M8.8 11h2M13.2 11h2" className="glyph-accent" />
      <path d="M10 15.5c1.2.8 2.8.8 4 0" />
    </>
  ),
  // A torc with a hanging gem.
  NECK: (
    <>
      <path d="M6 6.5c0 5 2.7 8 6 8s6-3 6-8" />
      <path d="M12 14.5v2.2" />
      <path d="M12 16.8l2.2 2.2L12 21.2 9.8 19z" className="glyph-accent" />
    </>
  ),
  // Layered pauldron plates.
  SHOULDERS: (
    <>
      <path d="M3.5 12.5a8.5 5.5 0 0 1 17 0" />
      <path d="M4.6 16a7.4 4.6 0 0 1 14.8 0" />
      <path d="M6 19.2a6 3.6 0 0 1 12 0" className="glyph-accent" />
    </>
  ),
  // A vambrace: a tapered forearm plate closing to a point.
  ARMS: (
    <>
      <path d="M8.6 4.2h6.8l1 9.6L12 20.2l-4.4-6.4z" />
      <path d="M8.9 8.2h6.2" className="glyph-accent" />
      <path d="M9.3 11.8h5.4" />
    </>
  ),
  // A cloak draped from a collar, with a clasp.
  BACK: (
    <>
      <path d="M12 4.4c-3.6.4-5.6 1.7-6.2 2.8L4.4 20.2h15.2L18.2 7.2c-.6-1.1-2.6-2.4-6.2-2.8z" />
      <path d="M8.8 5.6a4.4 4.4 0 0 0 6.4 0" />
      <circle cx="12" cy="8.4" r="1.4" className="glyph-accent" />
    </>
  ),
  // A bracer band.
  WRIST: (
    <>
      <rect x="5.5" y="8" width="13" height="8" rx="2.5" />
      <path d="M9 8v8M15 8v8" />
      <circle cx="12" cy="12" r="1.5" className="glyph-accent" />
    </>
  ),
  // A bow: limb, string, and a nocked arrow across it.
  RANGE: (
    <>
      <path d="M7.6 3.6c6.4 3 6.4 13.8 0 16.8" />
      <path d="M7.6 3.6v16.8" />
      <path d="M5.4 12h13.2" className="glyph-accent" />
      <path d="M16.2 9.8 18.6 12l-2.4 2.2" className="glyph-accent" />
    </>
  ),
  // A gauntlet.
  HANDS: (
    <>
      <path d="M7.5 11V6.6a1.4 1.4 0 0 1 2.8 0V11" />
      <path d="M10.3 10.4V5.4a1.4 1.4 0 0 1 2.8 0v5" />
      <path d="M13.1 10.6V6.4a1.4 1.4 0 0 1 2.8 0V12" />
      <path d="M7.5 11c-1.9.6-2.4 2-1.7 3.6l2 4.2a3 3 0 0 0 2.7 1.6h3.4a3 3 0 0 0 2.9-2.4l.8-4.2" className="glyph-accent" />
    </>
  ),
  // A longsword, point up.
  PRIMARY: (
    <>
      <path d="M12 2.6 13.7 6v9.2h-3.4V6z" />
      <path d="M8 15.6h8" />
      <path d="M12 15.6v5.8" className="glyph-accent" />
      <path d="M10.4 21.4h3.2" />
    </>
  ),
  // A round shield with a boss.
  SECONDARY: (
    <>
      <path d="M12 3.2 19 6v6.6c0 4-3 6.8-7 8.2-4-1.4-7-4.2-7-8.2V6z" />
      <circle cx="12" cy="11.4" r="2.6" className="glyph-accent" />
    </>
  ),
  // A ring, seen face on.
  FINGERS: (
    <>
      <circle cx="12" cy="14" r="5.5" />
      <path d="M9.4 8.8 12 3.4l2.6 5.4" />
      <circle cx="12" cy="5.6" r="1.5" className="glyph-accent" />
    </>
  ),
  // A breastplate.
  CHEST: (
    <>
      <path d="M8 4.5 12 6.6l4-2.1 3 2.4-1.2 4 .8 8.6a1.4 1.4 0 0 1-1.4 1.5H6.8a1.4 1.4 0 0 1-1.4-1.5l.8-8.6L5 6.9z" />
      <path d="M12 6.6v13.4" className="glyph-accent" />
    </>
  ),
  // Greaves: a waist plate over two separate legs.
  LEGS: (
    <>
      <path d="M6.4 3.8h11.2v3.4H6.4z" />
      <path d="M7.2 7.2 8.2 20.4h3L12 9.8" />
      <path d="M16.8 7.2 15.8 20.4h-3L12 9.8" />
      <path d="M6.7 5.5h10.6" className="glyph-accent" />
    </>
  ),
  // A sabaton.
  FEET: (
    <>
      <path d="M7 4.4h4.6l.6 8.2c2.6.7 5 1.7 6.6 2.8a1.8 1.8 0 0 1 .8 1.6v1.4a1.4 1.4 0 0 1-1.4 1.4H7A1.4 1.4 0 0 1 5.6 18.4z" />
      <path d="M6 15.6h12.4" className="glyph-accent" />
    </>
  ),
  // A belt with a buckle.
  WAIST: (
    <>
      <path d="M3 9.5h18v5H3z" />
      <rect x="9.4" y="8" width="5.2" height="8" rx="1.2" className="glyph-accent" />
      <path d="M12 10.6v2.8" />
    </>
  ),
  // A quiver of arrows.
  AMMO: (
    <>
      <path d="M8 9.5h8l-1 10.2a1.4 1.4 0 0 1-1.4 1.3h-3.2A1.4 1.4 0 0 1 9 19.7z" />
      <path d="M10.5 9.5V3.4M13.5 9.5V4.8" />
      <path d="M9.2 5 10.5 3l1.3 2M12.2 6.4l1.3-2 1.3 2" className="glyph-accent" />
    </>
  ),
  // A faceted stone: the EQL-specific flexible position.
  ANY: (
    <>
      <path d="M12 3 20 9.4 17 20H7L4 9.4z" />
      <path d="M4 9.4h16M12 3v17" className="glyph-accent" />
    </>
  ),
};

export interface SlotGlyphProps {
  slot: string;
  size?: number;
  /** Accent colour, typically the item's era or quality colour. */
  tone?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

function keyFor(slot: string): GlyphKey {
  const upper = slot.toUpperCase();
  const base = upper.replace(/_\d+$/, '');
  return (base in PATHS ? base : 'ANY') as GlyphKey;
}

export function SlotGlyph({ slot, size = 28, tone, title, className, style }: SlotGlyphProps) {
  const key = keyFor(slot);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={['slot-glyph', className].filter(Boolean).join(' ')}
      style={tone ? { ...style, ['--glyph-accent' as string]: tone } : style}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[key]}
    </svg>
  );
}

export const GLYPH_KEYS = Object.keys(PATHS) as GlyphKey[];
