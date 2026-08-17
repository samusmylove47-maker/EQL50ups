/**
 * Slot glyphs.
 *
 * The catalog carries an `iconId` for almost every item, but those resolve to
 * `File:Item <id>.png` on the wiki, which this build cannot reach. Rather than
 * fall back to two-letter monograms — which collide, and which make the paper
 * doll read as two bulleted lists — each slot type gets a drawn mark.
 *
 * Deliberately simple line work at a 24-unit grid: these sit at 24-28px and
 * must stay legible as silhouettes, so no detail smaller than about 1.5 units
 * and no fill at all.
 *
 * **One stroke, one colour.** Twenty-one of the twenty-three marks used to
 * carry a second path stroked in the azure accent, which put 48 azure strokes
 * on a filled gear tab against 5 azure words — spending the app's one
 * interactive colour as decoration, and fighting the usability tint the glyph
 * sits inside (the Hands mark was a mostly-blue palm with a thin green
 * outline). Interior detail is now separated the way a line drawing separates
 * it: by weight and opacity, via `.glyph-detail`. Everything inherits
 * `currentColor`.
 */

import { memo } from 'react';
import type { CSSProperties, ReactElement } from 'react';

export type GlyphKey =
  | 'EAR' | 'HEAD' | 'FACE' | 'NECK' | 'SHOULDERS' | 'ARMS' | 'BACK' | 'WRIST'
  | 'RANGE' | 'HANDS' | 'PRIMARY' | 'SECONDARY' | 'FINGERS' | 'CHEST' | 'LEGS'
  | 'FEET' | 'WAIST' | 'AMMO' | 'ANY';

/** Path data per slot, drawn on a 0 0 24 24 grid. */
const PATHS: Record<GlyphKey, ReactElement> = {
  /*
   * A drop earring: post, link, teardrop. The old curled-ear-plus-stone mark
   * reduced at 26px to a question mark, which on a paper doll reads as
   * "unknown slot".
   */
  EAR: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.2v2.1" className="glyph-detail" />
      <path d="M12 9.3c3.1 2.5 3.1 7.6 0 10.4-3.1-2.8-3.1-7.9 0-10.4z" />
    </>
  ),
  // A great helm: dome, brow bar, nasal bar and two eye slits. Without the
  // nasal bar the silhouette is a handbag.
  HEAD: (
    <>
      <path d="M5 13a7 7 0 0 1 14 0v5.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5z" />
      <path d="M5.4 11.5h13.2" />
      <path d="M12 11.5v8.5" />
      <path d="M8.6 14.8h2M13.4 14.8h2" className="glyph-detail" />
    </>
  ),
  /*
   * A half-mask on a strap. The strap running off both edges is what makes it
   * read as something *worn on the face* rather than as a helm; the old mark
   * was a rounded shield with two dots and a curved mouth, i.e. a comedy mask,
   * and the first replacement reduced to a lampshade.
   */
  FACE: (
    <>
      <path d="M2.4 11.4h3.2M18.4 11.4h3.2" className="glyph-detail" />
      <path d="M6.4 8.4h11.2a1.4 1.4 0 0 1 1.3 1.7c-.4 2.7-1.6 4.7-3.6 4.7-1.5 0-2.3-1-3.3-1s-1.8 1-3.3 1c-2 0-3.2-2-3.6-4.7a1.4 1.4 0 0 1 1.3-1.7z" />
      <path d="M8.4 11.2h1.9M13.7 11.2h1.9" className="glyph-detail" />
    </>
  ),
  // A torc with a hanging gem.
  NECK: (
    <>
      <path d="M6 6.5c0 5 2.7 8 6 8s6-3 6-8" />
      <path d="M12 14.5v2.2" className="glyph-detail" />
      <path d="M12 16.8l2.2 2.2L12 21.2 9.8 19z" />
    </>
  ),
  // A pauldron: a domed cap over a flared plate. Three nested arcs alone are
  // a wifi bars mark.
  SHOULDERS: (
    <>
      <path d="M4.4 16.4v-1.6a7.6 7.6 0 0 1 15.2 0v1.6" />
      <path d="M4.4 16.4h15.2" />
      <path d="M6.2 19.8a5.8 3.4 0 0 1 11.6 0" />
      <path d="M12 7.4v9" className="glyph-detail" />
    </>
  ),
  // A vambrace: a pointed elbow cop over a tapering forearm plate, with two
  // straps. Point-down was a pen nib; an untapered sleeve was a drinking cup.
  ARMS: (
    <>
      <path d="M12 3.2 17.6 7.6l-2.1 12.2a1.3 1.3 0 0 1-1.3 1.1h-4.4a1.3 1.3 0 0 1-1.3-1.1L6.4 7.6z" />
      <path d="M7.6 11.4h8.8" className="glyph-detail" />
      <path d="M8.2 15.4h7.6" className="glyph-detail" />
    </>
  ),
  // A cloak: collar, clasp, and a hem that falls in folds. A straight hem made
  // the shape a handbag.
  BACK: (
    <>
      <path d="M8.8 4.6a4.4 4.4 0 0 0 6.4 0" />
      <path d="M8.8 4.6C6.3 5.2 5.1 6.1 4.7 7.2L4 19.4" />
      <path d="M15.2 4.6c2.5.6 3.7 1.5 4.1 2.6l.7 12.2" />
      <path d="M4 19.4c1.7 1.1 3.4 1.1 5.3 0 1.8-1 3.6-1 5.4 0 1.8 1.1 3.5 1.1 5.3 0" />
      <circle cx="12" cy="8" r="1.4" className="glyph-detail" />
    </>
  ),
  /*
   * A bangle seen at an angle: the ring, plus the inside of the far edge so the
   * band has thickness. Concentric ellipses read as an eye, and a rectangular
   * band reduced to the same silhouette as the Waist belt — which the
   * anatomical layout now puts one cell away.
   */
  WRIST: (
    <>
      <ellipse cx="12" cy="12" rx="8.2" ry="5.6" />
      <path d="M4.4 13.6c1.6 2.4 4.3 3.8 7.6 3.8s6-1.4 7.6-3.8" className="glyph-detail" />
      <path d="M9.6 6.9h4.8" className="glyph-detail" />
    </>
  ),
  // A bow: limb, string, and a nocked arrow across it.
  RANGE: (
    <>
      <path d="M7.6 3.6c6.4 3 6.4 13.8 0 16.8" />
      <path d="M7.6 3.6v16.8" className="glyph-detail" />
      <path d="M5.4 12h13.2" />
      <path d="M16.2 9.8 18.6 12l-2.4 2.2" />
    </>
  ),
  // A gauntlet.
  HANDS: (
    <>
      <path d="M7.5 11V6.6a1.4 1.4 0 0 1 2.8 0V11" className="glyph-detail" />
      <path d="M10.3 10.4V5.4a1.4 1.4 0 0 1 2.8 0v5" className="glyph-detail" />
      <path d="M13.1 10.6V6.4a1.4 1.4 0 0 1 2.8 0V12" className="glyph-detail" />
      <path d="M7.5 11c-1.9.6-2.4 2-1.7 3.6l2 4.2a3 3 0 0 0 2.7 1.6h3.4a3 3 0 0 0 2.9-2.4l.8-4.2" />
    </>
  ),
  // A longsword, point up.
  PRIMARY: (
    <>
      <path d="M12 2.6 13.7 6v9.2h-3.4V6z" />
      <path d="M8 15.6h8" />
      <path d="M12 15.6v5.8" className="glyph-detail" />
      <path d="M10.4 21.4h3.2" className="glyph-detail" />
    </>
  ),
  // A round shield with a boss.
  SECONDARY: (
    <>
      <path d="M12 3.2 19 6v6.6c0 4-3 6.8-7 8.2-4-1.4-7-4.2-7-8.2V6z" />
      <circle cx="12" cy="11.4" r="2.6" className="glyph-detail" />
    </>
  ),
  // A ring, seen face on.
  FINGERS: (
    <>
      <circle cx="12" cy="14" r="5.5" />
      <path d="M9.4 8.8 12 3.4l2.6 5.4" className="glyph-detail" />
      <circle cx="12" cy="5.6" r="1.5" />
    </>
  ),
  // A breastplate.
  CHEST: (
    <>
      <path d="M8 4.5 12 6.6l4-2.1 3 2.4-1.2 4 .8 8.6a1.4 1.4 0 0 1-1.4 1.5H6.8a1.4 1.4 0 0 1-1.4-1.5l.8-8.6L5 6.9z" />
      <path d="M12 6.6v13.4" className="glyph-detail" />
    </>
  ),
  // Greaves: a hip yoke over two separate legs with a gap between them. A
  // full-width plate over two tapers is a waste bin with a lid.
  LEGS: (
    <>
      <path d="M8 3.8h8v2.8H8z" />
      <path d="M8.3 6.6 7.7 20.4h3.4l.4-10.4" />
      <path d="M15.7 6.6l.6 13.8h-3.4l-.4-10.4" />
      <path d="M8 13h2.8M13.2 13H16" className="glyph-detail" />
    </>
  ),
  // A sabaton.
  FEET: (
    <>
      <path d="M7 4.4h4.6l.6 8.2c2.6.7 5 1.7 6.6 2.8a1.8 1.8 0 0 1 .8 1.6v1.4a1.4 1.4 0 0 1-1.4 1.4H7A1.4 1.4 0 0 1 5.6 18.4z" />
      <path d="M6 15.6h12.4" className="glyph-detail" />
    </>
  ),
  /*
   * A strap with a square buckle — the buckle is the whole point of the mark,
   * so it is the heavy element and the strap is the detail. Previously the
   * buckle was a rounded rect in the accent colour and the strap was a solid
   * bar, which at 26px read as a plain band and collided with Wrist.
   */
  WAIST: (
    <>
      <path d="M2.4 10.2h6.4M15.2 10.2h6.4" />
      <path d="M2.4 13.8h6.4M15.2 13.8h6.4" />
      <rect x="8.8" y="8.2" width="6.4" height="7.6" />
      <path d="M12 8.2v7.6" className="glyph-detail" />
    </>
  ),
  /*
   * A bound bundle of arrows, heads up. Three plain shafts crossed by a band
   * read as a fence; the arrowheads are what make it ammunition.
   */
  AMMO: (
    <>
      <path d="M12 21.2V5" />
      <path d="M6.6 20.6 8.8 7.4M17.4 20.6 15.2 7.4" />
      <path d="M9.4 8.2 12 4.4l2.6 3.8" />
      <path d="M6.4 10.4 8.8 6.8l2 3.2M13.2 10 15.2 6.8l2.4 3.6" className="glyph-detail" />
      <path d="M6 16.6c4-1.1 8-1.1 12 0" />
    </>
  ),
  /*
   * A wildcard: a dashed square with a star in it. The EQL-only position takes
   * *any* wearable item, and the old faceted-stone mark read as a gift box on
   * the two rows the product most wants understood.
   */
  ANY: (
    <>
      <path
        d="M5 4.5h14v15H5z"
        strokeDasharray="3.4 2.6"
        className="glyph-detail"
      />
      <path d="M12 7.6v8.8M8.2 9.8l7.6 4.4M15.8 9.8l-7.6 4.4" />
    </>
  ),
};

export interface SlotGlyphProps {
  slot: string;
  size?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

function keyFor(slot: string): GlyphKey {
  const upper = slot.toUpperCase();
  const base = upper.replace(/_\d+$/, '');
  return (base in PATHS ? base : 'ANY') as GlyphKey;
}

function Glyph({ slot, size = 26, title, className, style }: SlotGlyphProps) {
  const key = keyFor(slot);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={['slot-glyph', className].filter(Boolean).join(' ')}
      style={style}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[key]}
    </svg>
  );
}

/*
 * Memoised: the doll draws 46 of these (23 rows plus 23 grid cells) and the
 * picker up to 150, and none of them change when a sibling slot does.
 */
export const SlotGlyph = memo(Glyph);

export const GLYPH_KEYS = Object.keys(PATHS) as GlyphKey[];
