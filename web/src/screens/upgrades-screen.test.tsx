/**
 * The Upgrades screen, mounted.
 *
 * The ranking rules are pinned in `upgrades.test.ts`. This covers the wiring a
 * pure test cannot see: that the route reaches the screen, that the sliced
 * ranking actually finishes and paints rows, that Equip writes the item the row
 * named at the tier the row was scored at, that a slot the app refuses to score
 * says so on screen, and that every failure mode renders words rather than a
 * blank page.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { tier } from '../engine/upgrade';
import type { Item } from '../engine/types';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** An item with acquisition data, which the fixture catalog otherwise lacks. */
const SOURCED: Item = {
  id: null,
  n: '[Fixture] Girdle of the Deep',
  sl: ['WAIST'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: { AC: 40, STA: 12, HP: 60 },
  sv: {},
  fl: ['FIXTURE', 'NO_DROP'],
  av: true,
  era: 'Classic',
  // Wiki numbers with no era to place them — the standing the row must call out.
  sd: 'tier-5',
  src: { z: ['Lower Guk'], m: ['a ghoul cavalier'], q: ['The Harvester'] },
};

/**
 * An item the game has been watched producing, with the wiki's account beside
 * it. Both halves matter: the screen has to show that the two are different
 * classes of claim, which it cannot do with only one of them.
 */
const MEASURED: Item = {
  id: null,
  n: '[Fixture] Throwing Boulder',
  sl: ['AMMO'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: { AC: 30, STR: 14 },
  sv: {},
  fl: ['FIXTURE'],
  av: true,
  era: 'Classic',
  sd: 'tier-2',
  ex: 'measured-drop',
  src: { z: ['Nagafen\u2019s Lair'], m: ['a fire giant'] },
  ms: [
    {
      mob: 'Fire Giant Warrior',
      seen: 73,
      sessions: 5,
      zones: ["Nagafen's Lair - Group"],
      zs: [{
        zone: "Nagafen's Lair - Group", slug: 'nagafenslair', title: "Nagafen's Lair",
        survey: 'partial', measured: 4, facets: 5,
      }],
      first: '10 Aug 2026',
      last: '12 Aug 2026',
    },
    {
      mob: 'An ice giant priest',
      seen: 18,
      sessions: 5,
      zones: ['The Permafrost Caverns - Group'],
      first: '10 Aug 2026',
      last: '11 Aug 2026',
      offRoster: true,
    },
  ],
};

/** A real item nobody has published stats for — the Shadow Rage case. */
const UNSTATTED: Item = {
  id: null,
  n: '[Fixture] Shadowed Crown',
  sl: ['HEAD'],
  cl: ['ALL'],
  ra: ['ALL'],
  st: {},
  sv: {},
  fl: ['FIXTURE'],
  av: true,
  era: 'Fear',
  statsUnknown: true,
  evidence: 'Worn in the owner’s client; no catalog carries its numbers.',
};

function seedCatalog(extra: Item[]): void {
  useCatalog.getState().loadFixture();
  const state = useCatalog.getState();
  const items = [...state.items, ...extra];
  const bySlot = new Map(state.bySlot);
  for (const item of extra) {
    for (const slot of item.sl) {
      bySlot.set(slot as never, [...(bySlot.get(slot as never) ?? []), item]);
    }
  }
  useCatalog.setState({
    items,
    byName: new Map(items.map((i) => [i.n.toLowerCase(), i])),
    bySlot,
    revision: state.revision + 1,
  });
}

function build(options: { slots?: Record<string, { name: string; tier: number }> } = {}): string {
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  const character = useApp.getState().createCharacter({
    name: 'Avenrae',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  const set = useApp.getState().createSet(character.id, 'Main Set', {
    AC: 2, STR: 1, STA: 1, HP: 0.2, RATIO: 20,
  });
  for (const [position, entry] of Object.entries(options.slots ?? {})) {
    useApp.getState().equip(set.id, position, entry.name, tier(entry.tier));
  }
  return set.id;
}

/**
 * Let the sliced ranking finish.
 *
 * It has to be its own `act` rather than a loop inside the render's: React
 * flushes passive effects at the end of an `act` scope, so the effect that
 * starts the ranking has not run yet while the render scope is still pumping —
 * every timer would be drained before there was anything waiting on one.
 */
async function pump(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 80; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Mount the app at a hash and drain the sliced ranking. */
async function render(hash: string): Promise<void> {
  window.location.hash = hash;
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  await pump();
}

function text(): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ');
}

function rows(): HTMLLIElement[] {
  return [...container.querySelectorAll<HTMLLIElement>('.upg-row')];
}

async function click(element: Element | null | undefined): Promise<void> {
  expect(element, 'the control being clicked').toBeTruthy();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await pump();
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number,
  );
  seedCatalog([SOURCED, UNSTATTED, MEASURED]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('the upgrades screen', () => {
  it('ranks the set and prints a row for every gain, biggest first', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    expect(text()).toContain('Upgrades');
    expect(text()).toContain('Avenrae');
    expect(text()).toContain('50 WAR/BRD/BER');
    expect(text()).not.toMatch(/NaN/);

    const list = rows();
    expect(list.length).toBeGreaterThan(3);

    // EP is one decimal everywhere in this app, so a column of gains lines up.
    for (const row of list) {
      expect(row.querySelector('.upg-gainvalue')?.textContent).toMatch(/^\+\d+\.\d$/);
    }
    const gains = list.map((row) =>
      Number((row.querySelector('.upg-gainvalue')?.textContent ?? '0').replace('+', '')),
    );
    for (const gain of gains) expect(Number.isFinite(gain)).toBe(true);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i - 1]).toBeGreaterThanOrEqual(gains[i] as number);
    }
    // The strongest row is the No Drop waist piece seeded above: 40 AC on an
    // empty slot outranks everything else in the fixture catalog.
    expect(list[0]?.textContent).toContain('[Fixture] Girdle of the Deep');
  });

  it('says where the item comes from, and that it cannot be traded for', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const waist = rows().find((row) => row.textContent?.includes('Girdle of the Deep'));
    const source = (waist?.querySelector('.upg-source')?.textContent ?? '').replace(/\s+/g, ' ');
    expect(source).toContain('Lower Guk');
    expect(source).toContain('a ghoul cavalier');
    expect(source).toContain('The Harvester');
    expect(source).toContain('No Drop');
  });

  it('admits when the catalog records no source at all', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const bare = rows().find((row) => row.textContent?.includes('[Fixture] Iron Helm'));
    expect(bare?.querySelector('.upg-source-none')?.textContent).toContain(
      'No acquisition data is recorded',
    );
  });

  it('equips the item the row named, at the tier the row was scored at', async () => {
    const setId = build({ slots: { WAIST: { name: '[Fixture] Girdle of Endurance', tier: 4 } } });
    await render(`#/set/${setId}/upgrades`);

    const waist = rows().find((row) => row.textContent?.includes('Girdle of the Deep'));
    expect(waist?.textContent).toContain('[Fixture] Girdle of Endurance');
    await click(waist?.querySelector('.btn-primary'));

    const slot = useApp.getState().sets.find((s) => s.id === setId)?.slots.WAIST;
    expect(slot?.itemName).toBe('[Fixture] Girdle of the Deep');
    // Default basis is "the tier the slot already carries", so the swap keeps
    // the +4 the row compared at rather than silently dropping to +0.
    expect(slot?.upgrade.full).toBe(4);

    // The list re-ranks against the set as it now stands: the row is gone, and
    // the screen says what it did — including what it displaced, which is the
    // only way back in an app with no undo.
    expect(text()).toContain('equipped in Waist at +4');
    expect(text()).toContain('replacing [Fixture] Girdle of Endurance at +4');
    expect(rows().some((row) => row.textContent?.includes('Girdle of the Deep'))).toBe(false);
  });

  it('withholds a slot whose worn item has no published stats', async () => {
    const setId = build({ slots: { HEAD: { name: UNSTATTED.n, tier: 5 } } });
    await render(`#/set/${setId}/upgrades`);

    const held = container.querySelector('.upg-held');
    expect(held?.textContent).toContain(UNSTATTED.n);
    expect(held?.textContent).toContain('Unsourced · stats withheld');
    expect(held?.textContent).toContain('nothing can be measured against it');
    expect(held?.textContent).toContain('no catalog carries its numbers');
    // And no row anywhere claims a gain for that position.
    expect(rows().some((row) => row.textContent?.includes('Head'))).toBe(false);
  });

  it('opens the item window from a row without leaving the page', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const first = rows()[0];
    await click(first?.querySelector('.upg-name'));

    const modal = document.querySelector('.modal');
    expect(modal?.textContent).toContain('[Fixture] Girdle of the Deep');
    expect(window.location.hash).toContain('/upgrades');
  });

  it('scores every candidate at one tier when asked to', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const select = container.querySelector<HTMLSelectElement>('.upg-controls select');
    expect(select).toBeTruthy();
    await act(async () => {
      if (select) {
        select.value = 'fixed';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(text()).toContain('Every candidate is scored at +0');
    expect(container.querySelector('.stepper')).toBeTruthy();
    expect(rows().length).toBeGreaterThan(0);
  });

  it('resolves #/upgrades to the set you were last editing and says so in the URL', async () => {
    const setId = build();
    await render('#/upgrades');

    expect(window.location.hash).toBe(`#/set/${setId}/upgrades`);
    expect(text()).toContain('Main Set');
  });

  it('explains itself when there is no set to rank', async () => {
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    await render('#/upgrades');

    expect(text()).toContain('No set to rank');
    expect(text()).not.toMatch(/NaN/);
  });

  it('explains itself when the set weights nothing', async () => {
    useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
    const character = useApp.getState().createCharacter({
      name: 'Avenrae', level: 50, classes: ['WAR', 'BRD', 'BER'], race: null,
    });
    const set = useApp.getState().createSet(character.id, 'Unweighted', {});
    await render(`#/set/${set.id}/upgrades`);

    expect(text()).toContain('This set weights nothing');
    expect(rows()).toHaveLength(0);
  });

  it('says so rather than ranking when nothing can be improved', async () => {
    // Every position this trio can score, already carrying its best item.
    const setId = build();
    await render(`#/set/${setId}/upgrades`);
    for (const row of rows()) {
      const equip = row.querySelector('.btn-primary');
      // eslint-disable-next-line no-await-in-loop
      await click(equip);
      if (!rows().length) break;
    }
    expect(text()).toContain('Nothing outranks what you are wearing');
  });
});

/**
 * The measured drop data on screen.
 *
 * This is the single biggest reason to open this tool rather than a wiki page,
 * so these tests are about whether it *lands*: that it is present, that it
 * leads, that it is visibly a different class of claim from the wiki account
 * below it, that it carries its own standing mark, and that every figure on it
 * is a count with its sample size attached.
 */
describe('the measured drops lead, and are marked as measured', () => {
  function measuredRow(): HTMLElement | undefined {
    return rows().find((row) => row.querySelector('.upg-measured')) as HTMLElement | undefined;
  }

  it('shows the mob, the zone, the count, the sample size and the dates', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const row = measuredRow();
    expect(row, 'a row for the measured fixture item').toBeTruthy();
    const card = (row?.querySelector('.upg-measured')?.textContent ?? '').replace(/\s+/g, ' ');

    expect(card).toContain('Fire Giant Warrior');
    expect(card).toContain("Nagafen's Lair - Group");
    expect(card).toContain('73 seen');
    expect(card).toContain('over 5 sessions');
    expect(card).toContain('10 Aug 2026');
    expect(card).toContain('12 Aug 2026');
    expect(card).toContain('partial survey · 4 of 5 facets measured');
    // Measured, but named by the log rather than by a roster we had written.
    expect(card).toContain('off roster');
  });

  it('carries a Tier M mark and the sourcing standard’s trusted rule', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const card = measuredRow()?.querySelector('.upg-measured');
    expect(card?.getAttribute('data-standing')).toBe('trusted');
    expect(card?.querySelector('.tier.tM')?.textContent).toContain('Tier M');
  });

  it('puts the measured card above the wiki account, not among it', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const source = measuredRow()?.querySelector('.upg-source');
    const children = [...(source?.children ?? [])];
    expect(children[0]?.classList.contains('upg-measured')).toBe(true);
    // And the wiki lines are held in their own block, labelled as transcribed.
    const wiki = source?.querySelector('.upg-wiki')?.textContent ?? '';
    expect(wiki).toContain('Transcribed');
    expect(wiki).toContain('not measured');
    expect(wiki).toContain('a fire giant');
  });

  it('states the count rule on the card, and prints no percentage on it', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const card = (measuredRow()?.querySelector('.upg-measured')?.textContent ?? '')
      .replace(/\s+/g, ' ');
    expect(card).toContain('A count, never a rate');
    expect(card).toContain('a dry streak is a ceiling, not a zero');
    expect(card).not.toContain('%');
    // 73 + 18, added because each sighting is one event. Sessions are not added.
    expect(card).toContain('91 sightings across 2 mobs');
  });

  it('answers “so where do I go” with counts of items and sightings', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const zones = container.querySelector('.upg-zones');
    expect(zones, 'the where-to-go section').toBeTruthy();
    const body = (zones?.textContent ?? '').replace(/\s+/g, ' ');
    expect(body).toContain('Where to go');
    expect(body).toContain("Nagafen's Lair - Group");
    expect(body).toContain('73 sightings');
    expect(body).toContain('partial survey · 4 of 5 facets measured');
    expect(body).toContain('no published survey for this zone');
    expect(body).not.toContain('%');
  });

  it('counts the measured rows in the headline, and says what the rest are', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const body = text();
    expect(body).toContain('Measured dropping in game');
    expect(body).toContain('watched dropping');
  });

  /*
   * Scannability. A player deciding what to farm tonight reads a list of
   * twenty-three rows; if the measured half only exists inside the detail
   * block, they have to open every one to find it.
   */
  it('marks the row itself, so a measured upgrade is findable without opening it', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const row = measuredRow();
    expect(row?.querySelector('.upg-seenmark')?.textContent).toContain('91 sightings');
    const wikiOnly = rows().find(
      (other) => (other.textContent ?? '').includes('[Fixture] Girdle of the Deep'),
    );
    expect(wikiOnly?.querySelector('.upg-seenmark')).toBeNull();
  });

  it('says a wiki-only item is a wiki-only item rather than showing it a blank', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const wikiOnly = rows().find(
      (row) => (row.textContent ?? '').includes('[Fixture] Girdle of the Deep'),
    );
    expect(wikiOnly, 'the wiki-sourced fixture row').toBeTruthy();
    expect(wikiOnly?.querySelector('.upg-measured')).toBeNull();
    expect(wikiOnly?.textContent).toContain('Nobody has measured this item dropping');
  });
});

/**
 * The persisted library arrives after the first paint, always.
 *
 * `App.tsx:41-47` calls `hydrate()` from an effect, and `store.ts` starts at
 * `hydrated: false` with an empty library — so the first render of any route,
 * on any real page load, sees `sets: []`. On this screen that reaches the
 * `No set to rank` early return; the render after hydration reaches the ranked
 * one. Every hook this component calls therefore has to sit *above* that
 * return, or the two renders call different numbers of hooks and React aborts
 * the tree with error #310 rather than painting anything at all.
 *
 * `itembrowser-agreement.test.tsx` pins the same crossing for the browser
 * screen. This is the Upgrades half of it, and it is a mount test rather than a
 * lint rule because the failure is a runtime throw: it is invisible to `tsc`,
 * invisible to every test that seeds the store before mounting — which is every
 * other test in this file — and invisible in dev whenever storage happens to be
 * read back before first paint.
 */
describe('the persisted library arrives after the first paint', () => {
  it('crosses from the empty state to the ranked one without losing the tree', async () => {
    const setId = build({ slots: { WAIST: { name: '[Fixture] Girdle of the Deep', tier: 0 } } });
    const { characters, sets, activeCharacterId } = useApp.getState();

    // Rewind to what the browser actually renders first.
    useApp.setState({ ...emptyState(), hydrated: false, storageStatus: 'ok' });

    await render(`#/set/${setId}/upgrades`);
    expect(text(), 'the pre-hydration paint is the empty state').toContain('No set to rank');

    // Hydration. Under a rules-of-hooks violation this render throws
    // `Rendered more hooks than during the previous render` and the container
    // is emptied, so the assertions below fail on a blank page rather than on
    // a wrong number.
    await act(async () => {
      useApp.setState({
        characters, sets, activeCharacterId, hydrated: true, storageStatus: 'ok',
      });
    });
    await pump();

    expect(text(), 'the empty state is gone').not.toContain('No set to rank');
    expect(rows().length, 'the ranking painted rows after hydration').toBeGreaterThan(0);
  });
});


/*
 * Where the EP came from, on the row that prints it.
 *
 * The sub-line carried the item's existence evidence and nothing about its stat
 * provenance. `SOURCING-STANDARD.md` rule 5 puts that on screen, and the EP is
 * the number this screen exists to give — so the row that prints it is where it
 * belongs. Existence and stat standing are two independent facts; this pins the
 * second, and pins that the first is still there beside it.
 */
describe('every ranked row says where its EP came from', () => {
  it('names the stat standing on the row, not only in the item window', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const marks = rows().map((row) => row.querySelector('.upg-standing')?.textContent?.trim());
    expect(marks.length, 'ranked rows').toBeGreaterThan(0);
    expect(
      marks.every(Boolean),
      'a ranked row prints an EP, so it must name where that EP came from',
    ).toBe(true);
  });

  it('marks wiki stats that cannot be placed, and does not tint the ordinary case', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const find = (name: string) =>
      rows()
        .find((row) => (row.textContent ?? '').includes(name))
        ?.querySelector('.upg-standing');

    const unplaced = find('[Fixture] Girdle of the Deep');
    expect(unplaced?.textContent).toContain('Tier 5');
    expect(unplaced?.getAttribute('data-band'), 'unplaced wiki stats read as distrust')
      .toBe('distrust');

    const ordinary = find('[Fixture] Throwing Boulder');
    expect(ordinary?.textContent).toContain('Tier 2');
    expect(
      ordinary?.getAttribute('data-band'),
      'the 94% case must not be tinted — a colour every row shares is a wash',
    ).toBe('trusted');
  });

  /*
   * The empty list has to say which empty it is.
   *
   * This branch read `rows.length` and nothing else, so an empty set under a
   * narrowed filter got "Nothing outranks what you are wearing" over "Every
   * position this set can score is already carrying the best item the catalog
   * offers it" — with the KPI directly above reading "0 already best · 23 with
   * nothing to offer" and the footnote directly below reading "Nothing scored
   * for any position". The screen carried the true reading twice and the false
   * one in the heading.
   *
   * The KPI and the footnote are asserted here as well as the heading, because
   * what makes this a defect rather than clumsy wording is that the same view
   * contradicts itself — and because they are the measurement that this really
   * is the settled=0 / nothing=23 state rather than some other empty.
   */
  it('does not call an unsearched ranking "nothing outranks what you are wearing"', async () => {
    const setId = build();
    useApp.getState().configureSet(setId, {
      filters: { era: 'Kunark', source: 'vendor', hideNoDrop: false },
    });
    await render(`#/set/${setId}/upgrades`);

    // The state, measured from the same render rather than assumed.
    expect(text()).toContain('0 already best');
    expect(text()).toContain('23 with nothing to offer');
    expect(text()).toContain('Nothing scored for any position.');

    expect(text()).not.toContain('Nothing outranks what you are wearing');
    expect(text()).not.toContain('already carrying the best item the catalog offers it');
    expect(text()).toContain('Nothing scored under these filters');
    // It names the filter it is blaming, which is the one thing the reader can act on.
    expect(text()).toContain('Kunark era');
  });

  /*
   * "Nothing scored for Ear 2" — printed about a position where something did.
   *
   * A Lore item goes to exactly one position. `take()` skips a claimed
   * candidate BEFORE the pricing callback that sets `consideredAny`, so a
   * position whose whole positive pool was skipped that way looked identical to
   * one with an empty pool and landed in the `nothing` bucket — rendered as
   * "Nothing scored for X" and counted as "with nothing to offer". Both are
   * false: it scored, and the sentence immediately before it had just explained
   * the rule that took it away.
   *
   * Rendered rather than asserted on the report, and that distinction is not
   * decorative: with the report bucket guarded but the prose left alone, the
   * whole suite passed while the footnote printed the original false sentence
   * about the new bucket. The sentence is the deliverable.
   *
   * The era filter is what isolates the contest. A first attempt seeded only
   * the Lore item and expected the second ear to be empty-handed; it was not,
   * because the two "Any Slot" wildcards are candidates for every position and
   * gave it a fallback row. Narrowing to an era only this item carries leaves
   * it as the entire pool for both ears and both Any Slots.
   */
  const LORE_STUD: Item = {
    id: null,
    n: '[Fixture] Lore Stud',
    sl: ['EAR'],
    cl: ['ALL'],
    ra: ['ALL'],
    st: { AC: 30, STA: 10 },
    sv: {},
    fl: ['FIXTURE', 'LORE'],
    av: true,
    // No other fixture item is of this era, so the filter below leaves this
    // item and nothing else.
    era: 'Hate',
  };

  it('says the candidate went elsewhere, not that nothing scored', async () => {
    seedCatalog([LORE_STUD]);
    const setId = build();
    useApp.getState().configureSet(setId, {
      filters: { era: 'Hate', source: 'any', hideNoDrop: false },
    });
    await render(`#/set/${setId}/upgrades`);

    // The premise: exactly one position gets the single Lore copy.
    const holders = rows().filter((r) => (r.textContent ?? '').includes(LORE_STUD.n));
    expect(holders, 'one position takes the single Lore copy').toHaveLength(1);

    // The positions that wanted it and lost are named as such...
    expect(text()).toContain('is already spoken for elsewhere in this set');
    expect(text()).toContain('taken elsewhere');
    // ...and are NOT in the sentence that says nothing scored for them.
    const nothingSentence = /Nothing scored for ([^.]*)\./.exec(text())?.[1] ?? '';
    expect(nothingSentence).not.toMatch(/Ear|Any Slot/);
  });

  it('leaves the existence mark alone — the two facts stay separate', async () => {
    const setId = build();
    await render(`#/set/${setId}/upgrades`);

    const measured = rows().find((row) =>
      (row.textContent ?? '').includes('[Fixture] Throwing Boulder'));
    expect(measured?.querySelector('.upg-seenmark')?.textContent).toContain('sighting');
    expect(measured?.querySelector('.upg-standing')?.textContent).toContain('Tier 2');
  });
});
