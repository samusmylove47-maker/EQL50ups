import { describe, it, expect } from 'vitest';
import { statChip } from './gear';

/**
 * Delay is the reason this formatter exists.
 *
 * Compact stat lists rendered every entry through `signed()`, so a two-handed
 * weapon printed `DLY +70` — the slowest weapon on the page carrying the
 * biggest, most positive-looking number on it. Three consecutive reviews
 * flagged it. Anything where "more" is not "better" prints bare.
 */
describe('statChip', () => {
  it('never signs delay', () => {
    expect(statChip('DLY', 70)).toBe('DLY 70');
    expect(statChip('DLY', 26)).not.toContain('+');
  });

  it('never signs the damage ratio', () => {
    expect(statChip('RATIO', 1.057)).not.toContain('+');
  });

  it('still signs the stats where more really is better', () => {
    expect(statChip('STR', 16)).toBe('STR +16');
    expect(statChip('AC', 35)).toBe('AC +35');
    expect(statChip('HP', 85)).toBe('HP +85');
  });

  it('keeps a penalty legible as a penalty', () => {
    expect(statChip('DEX', -5)).toBe('DEX -5');
  });

  it('uses the client abbreviations rather than inventing words', () => {
    // A truncating fallback once turned "Delay" into "DELA" and
    // "Dragon Punch Mod" into "DRAG" — plausible-looking fictions.
    expect(statChip('SV_VOID', 10)).toBe('VR +10');
    expect(statChip('DMG', 74)).toBe('DMG +74');
  });

  it('does not print NaN for a missing value', () => {
    expect(statChip('STR', Number.NaN)).not.toContain('NaN');
  });
});
