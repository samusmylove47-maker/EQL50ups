/**
 * Auto-fill yields, and yielding changes nothing.
 *
 * The button used to block the frame for seconds with nothing on screen saying
 * so, so the fill now hands the main thread back between slot rankings. The
 * one thing that must not move is the answer: whatever the user gets from the
 * chunked run has to be exactly what the single-shot run produced.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { activeContext, buildCharacter } from '../engine/character';
import { useCatalog } from '../data/catalog';
import { tier } from '../engine/upgrade';
import type { GearSet } from '../engine/types';
import { runSliced } from '../lib/frames';
import { DEFAULT_SET_FILTERS } from '../lib/setFilters';
import { autoFill, autoFillSteps, slotViews, type AutoFillProgress } from './gear';

const WARRIOR = buildCharacter({ id: 'c', name: 'Test', classes: ['WAR', 'BRD', 'BER'], level: 50 });
const CONTEXT = activeContext(WARRIOR);
const WEIGHTS = { AC: 2, STR: 1, HP: 0.2, RATIO: 20 };

function gearSet(slots: GearSet['slots'] = {}): GearSet {
  return {
    id: 's', characterId: 'c', name: 'Set', slots, weights: WEIGHTS, createdAt: 0, updatedAt: 0,
  };
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
});

describe('chunked auto-fill', () => {
  it('produces exactly the result the single-shot run does', async () => {
    const catalog = useCatalog.getState();
    const views = slotViews(gearSet(), catalog);
    const options = { keepFilled: false, filters: DEFAULT_SET_FILTERS };

    const oneShot = autoFill(catalog, views, CONTEXT, WEIGHTS, options);
    const chunked = await runSliced(autoFillSteps(catalog, views, CONTEXT, WEIGHTS, options), 0);

    expect(chunked).toEqual(oneShot);
    expect(chunked.assigned.length).toBeGreaterThan(0);
  });

  it('keeps the same promise when slots are already filled', async () => {
    const catalog = useCatalog.getState();
    const views = slotViews(
      gearSet({ HEAD: { itemName: '[Fixture] Iron Helm', upgrade: tier(2) } }),
      catalog,
    );
    const options = { keepFilled: true, filters: DEFAULT_SET_FILTERS };

    const oneShot = autoFill(catalog, views, CONTEXT, WEIGHTS, options);
    const chunked = await runSliced(autoFillSteps(catalog, views, CONTEXT, WEIGHTS, options), 0);

    expect(chunked).toEqual(oneShot);
    expect(chunked.assigned.some((a) => a.position === 'HEAD')).toBe(false);
  });

  it('yields once per slot ranking, twice over — that is what makes it interruptible', () => {
    const catalog = useCatalog.getState();
    const views = slotViews(gearSet(), catalog);
    const work = autoFillSteps(catalog, views, CONTEXT, WEIGHTS, {
      keepFilled: false,
      filters: DEFAULT_SET_FILTERS,
    });

    const progress: AutoFillProgress[] = [];
    let step = work.next();
    while (!step.done) {
      progress.push(step.value);
      step = work.next();
    }

    // 23 positions, two passes.
    expect(progress.length).toBe(46);
    expect(progress[0]).toEqual({ done: 1, total: 46 });
    expect(progress[progress.length - 1]).toEqual({ done: 46, total: 46 });
    // Monotonic, so a caller can render it as a bar without it going backwards.
    for (let i = 1; i < progress.length; i++) {
      expect((progress[i] as AutoFillProgress).done).toBe(
        (progress[i - 1] as AutoFillProgress).done + 1,
      );
    }
  });
});
