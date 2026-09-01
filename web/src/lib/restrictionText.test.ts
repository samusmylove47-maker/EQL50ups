/**
 * The Class and Race fields, checked against what a reader sees in them.
 *
 * Literal strings throughout, for the same reason as `blockReason.test.ts`: a
 * check written in terms of `readRestriction` would agree with the renderer by
 * construction and would have passed on the defect below.
 *
 * Before this fix, `ItemWindow`'s Class field rendered
 * `["ALL_EXCEPT","ENC","MAG","WIZ"]` as `ALL_EXCEPT ENC MAG WIZ`, and in wide
 * mode as `ALL_EXCEPT Enchanter Magician Wizard` — the sentinel surviving the
 * code-to-name map through its `?? c` fallback.
 */

import { describe, expect, it } from 'vitest';
import { restrictionText } from './restrictionText';
import { CLASS_NAMES, type ClassCode } from '../engine/constants';

const named = (c: string) => CLASS_NAMES[c as ClassCode] ?? c;

describe('restrictionText', () => {
  it('renders an exclusion list as an exclusion, not as an allow list', () => {
    expect(restrictionText(['ALL_EXCEPT', 'ENC', 'MAG', 'WIZ'])).toBe('ALL except ENC MAG WIZ');
  });

  it('keeps the sentinel out of the name-mapped wide form', () => {
    expect(restrictionText(['ALL_EXCEPT', 'ENC', 'MAG', 'WIZ'], named))
      .toBe('ALL except Enchanter Magician Wizard');
  });

  it('renders a race exclusion the same way', () => {
    expect(restrictionText(['ALL_EXCEPT', 'TRL', 'OGR', 'IKS'])).toBe('ALL except TRL OGR IKS');
  });

  it('renders a plain list unchanged, names and codes alike', () => {
    expect(restrictionText(['WAR', 'BRD', 'CLR'])).toBe('WAR BRD CLR');
    expect(restrictionText(['WAR', 'BRD', 'CLR'], named)).toBe('Warrior Bard Cleric');
  });

  it('renders ALL, an empty list, and NONE as the three words they mean', () => {
    expect(restrictionText(['ALL'])).toBe('ALL');
    expect(restrictionText([])).toBe('ALL');
    expect(restrictionText(['NONE'])).toBe('NONE');
  });

  it('renders a bare ALL_EXCEPT as ALL, matching what the gate concludes', () => {
    // Excluding nobody restricts nobody. 0 records ship in this shape; the
    // arm exists so the renderer cannot emit a dangling "ALL except ".
    expect(restrictionText(['ALL_EXCEPT'])).toBe('ALL');
  });

  it('honours a caller-supplied separator', () => {
    expect(restrictionText(['ALL_EXCEPT', 'ENC', 'MAG'], undefined, ', '))
      .toBe('ALL except ENC, MAG');
  });
});
