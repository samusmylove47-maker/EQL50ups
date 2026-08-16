/**
 * The three-class picker — the most important control on the character screen,
 * because eligibility, armour proficiency and skill caps are all "best of the
 * trio". Selection order is meaningful: the first pick is the primary class,
 * which the game locks at level 11.
 *
 * Styled per UI-REFERENCE §A5: circular icons with a glowing ring on the
 * active choice, unavailable options dimmed.
 *
 * Two defects fixed here:
 *
 *  - **A click on a fourth class did nothing and said nothing** — the worst
 *    possible response. A native `disabled` button swallows the event outright,
 *    so the remaining chips take `pointer-events: none` and the grid itself
 *    answers, with a live-region message and a flash on the three that are in
 *    the way. The chips stay genuinely `disabled` for assistive tech and for
 *    the keyboard, which is the truthful state.
 *  - **The grid reflowed as you clicked**, because `PRIMARY`/`SECOND`/`THIRD`
 *    only existed under chosen chips and `Shadow Knight` is the one two-line
 *    label. Both slots are now reserved at a fixed height.
 *
 * And when the picker opens already full — which is exactly what "Add loadout"
 * does, since a new loadout copies the active trio — there is now something to
 * do about it besides guess: a count and a Clear.
 */

import { useEffect, useRef, useState } from 'react';
import { CLASSES, CLASS_NAMES, type ClassCode } from '../engine/constants';

const ORDER_LABELS = ['Primary', 'Second', 'Third'];

export interface ClassPickerProps {
  value: ClassCode[];
  onChange: (next: ClassCode[]) => void;
  max?: number;
}

export function ClassPicker({ value, onChange, max = 3 }: ClassPickerProps) {
  const [nudge, setNudge] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const full = value.length >= max;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const toggle = (code: ClassCode) => {
    const at = value.indexOf(code);
    if (at >= 0) onChange(value.filter((c) => c !== code));
    else if (value.length < max) onChange([...value, code]);
  };

  const refuse = () => {
    setNudge(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNudge(false), 2600);
  };

  return (
    <div className="class-picker">
      <div
        className={`class-grid${nudge ? ' nudge' : ''}`}
        role="group"
        aria-label="Class trio"
        onClick={(event) => {
          // Only fires when the click landed on nothing clickable, which for a
          // full picker means one of the unavailable chips.
          if (full && !(event.target as HTMLElement).closest('.class-chip')) refuse();
        }}
      >
        {CLASSES.map((code) => {
          const index = value.indexOf(code);
          const selected = index >= 0;
          const unavailable = full && !selected;
          return (
            <button
              key={code}
              type="button"
              className="class-chip"
              aria-pressed={selected}
              disabled={unavailable}
              onClick={() => toggle(code)}
              title={
                unavailable
                  ? `Three classes already chosen — deselect one to add ${CLASS_NAMES[code]}`
                  : CLASS_NAMES[code]
              }
            >
              <span className="class-orb" aria-hidden="true">
                {code}
              </span>
              <span className="cname">{CLASS_NAMES[code]}</span>
              <span className="order">{selected ? ORDER_LABELS[index] : ''}</span>
            </button>
          );
        })}
      </div>

      <div className="class-status">
        <span className={nudge ? 'bad' : 'hint'} role="status">
          {nudge
            ? `Three is the limit — deselect one of ${value.join('/')} to swap it out.`
            : `${value.length} of ${max} chosen.`}
        </span>
        {value.length ? (
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => onChange([])}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
