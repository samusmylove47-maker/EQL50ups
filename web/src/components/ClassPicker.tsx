/**
 * The three-class picker — the most important control on the character screen,
 * because eligibility, armour proficiency and skill caps are all "best of the
 * trio". Selection order is meaningful: the first pick is the primary class,
 * which the game locks at level 11.
 *
 * Styled per UI-REFERENCE §A5: circular icons with a glowing ring on the
 * active choice, unavailable options dimmed.
 */

import { CLASSES, CLASS_NAMES, type ClassCode } from '../engine/constants';

const ORDER_LABELS = ['Primary', 'Second', 'Third'];

export interface ClassPickerProps {
  value: ClassCode[];
  onChange: (next: ClassCode[]) => void;
  max?: number;
}

export function ClassPicker({ value, onChange, max = 3 }: ClassPickerProps) {
  const toggle = (code: ClassCode) => {
    const at = value.indexOf(code);
    if (at >= 0) onChange(value.filter((c) => c !== code));
    else if (value.length < max) onChange([...value, code]);
  };

  return (
    <div className="class-grid" role="group" aria-label="Class trio">
      {CLASSES.map((code) => {
        const index = value.indexOf(code);
        const selected = index >= 0;
        const full = value.length >= max && !selected;
        return (
          <button
            key={code}
            type="button"
            className="class-chip"
            aria-pressed={selected}
            disabled={full}
            onClick={() => toggle(code)}
            title={full ? `Deselect a class to choose ${CLASS_NAMES[code]}` : CLASS_NAMES[code]}
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
  );
}
