/**
 * The item browser has to agree with the rest of the app.
 *
 * Three findings, all of them "two surfaces, two answers":
 *
 *  - the same sword read **41.0 EP** here and **53.0 EP** in the slot picker
 *    one screen away, because this screen hardcoded `PRESET_PROFILES[0]`
 *    (*Melee DPS*) and never looked at the set. Across the five presets one
 *    item spans 14.0 to 92.4;
 *  - the class filter opened on *Any class* with a character loaded, so most
 *    of the top rows were items the trio can never wear;
 *  - a search for a deliberately withheld item said "loosen a filter" with no
 *    filter set.
 *
 * Every assertion below is a number or a string one of those produced.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { PRESET_PROFILES, scoreItem } from '../engine/ep';
import { BASE_STATE } from '../engine/upgrade';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { FIXTURE_ITEMS } from '../data/fixture';
import { resetQuarantineIndex } from '../data/quarantine';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const SWORD = FIXTURE_ITEMS.find((i) => i.n === '[Fixture] Bronze Longsword')!;
/** WIZ/MAG/ENC/NEC only: nothing a WAR/BRD/BER trio can wear. */
const COWL = FIXTURE_ITEMS.find((i) => i.n === '[Fixture] Silk Cowl')!;

function mount(): void {
  window.location.hash = '#/items';
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<App />);
  });
}

function seedCharacter(): string {
  const character = useApp.getState().createCharacter({
    name: 'Critic',
    level: 50,
    classes: ['WAR', 'BRD', 'BER'],
    race: null,
  });
  useApp.setState({ activeCharacterId: character.id });
  return useApp.getState().createSet(character.id, 'Main Set').id;
}

function select(label: string): HTMLSelectElement {
  const el = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  expect(el, `<select> "${label}"`).toBeTruthy();
  return el as HTMLSelectElement;
}

function change(el: HTMLSelectElement | HTMLInputElement, value: string): void {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

/** Every row as `{ name, ep, colour }`, read off the rendered table. */
function rows(): Array<{ name: string; ep: string; colour: string }> {
  return [...container.querySelectorAll('table.data tbody tr')].map((tr) => {
    const cells = tr.querySelectorAll('td');
    const button = tr.querySelector<HTMLElement>('td:first-child button');
    return {
      name: button?.textContent?.trim() ?? '',
      ep: cells[5]?.textContent?.trim() ?? '',
      colour: button?.style.color ?? '',
    };
  });
}

function rowFor(name: string) {
  return rows().find((r) => r.name === name);
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  resetQuarantineIndex();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('one item, one EP', () => {
  it('scores with the set’s own weights, not with Melee DPS', () => {
    seedCharacter();
    mount();

    const gearSet = useApp.getState().sets[0]!;
    const mine = scoreItem(SWORD, BASE_STATE, gearSet.weights).total;
    const melee = scoreItem(SWORD, BASE_STATE, PRESET_PROFILES[0]!.weights).total;
    // The two really are different, or this test proves nothing.
    expect(mine.toFixed(1)).not.toBe(melee.toFixed(1));

    expect(select('Scoring profile').value).toBe('set');
    expect(rowFor(SWORD.n)?.ep).toBe(mine.toFixed(1));
  });

  it('offers the set’s weights as the first option and names the preset case honestly', () => {
    seedCharacter();
    mount();
    const options = [...select('Scoring profile').options].map((o) => o.value);
    expect(options[0]).toBe('set');

    // A preset is still reachable, and picking one still moves the number.
    const gearSet = useApp.getState().sets[0]!;
    change(select('Scoring profile'), 'tank');
    expect(rowFor(SWORD.n)?.ep).toBe(
      scoreItem(SWORD, BASE_STATE, PRESET_PROFILES.find((p) => p.id === 'tank')!.weights).total.toFixed(1),
    );
    expect(rowFor(SWORD.n)?.ep).not.toBe(scoreItem(SWORD, BASE_STATE, gearSet.weights).total.toFixed(1));
  });

  it('falls back to a preset only when there is no set to read weights from', () => {
    mount();
    expect(select('Scoring profile').value).toBe(PRESET_PROFILES[0]!.id);
    expect([...select('Scoring profile').options].map((o) => o.value)).not.toContain('set');
    expect(rowFor(SWORD.n)?.ep).toBe(
      scoreItem(SWORD, BASE_STATE, PRESET_PROFILES[0]!.weights).total.toFixed(1),
    );
  });

  it('says which weights produced the numbers, in the caption a screen reader gets', () => {
    seedCharacter();
    mount();
    const caption = container.querySelector('table.data caption')?.textContent ?? '';
    expect(caption).toContain('Main Set weights');
    expect(caption).toContain('usable by Critic’s WAR/BRD/BER');
  });
});

describe('the class filter opens on the character, not on the catalog', () => {
  it('defaults to the loadout and hides what the trio cannot wear', () => {
    seedCharacter();
    mount();

    expect(select('Filter by class').value).toBe('loadout');
    expect([...select('Filter by class').options][0]?.textContent).toContain('Critic');

    const names = rows().map((r) => r.name);
    expect(names).toContain(SWORD.n);
    expect(names, 'a WIZ/MAG/ENC/NEC hood is not this trio’s to browse').not.toContain(COWL.n);
  });

  it('still opens on Any class when there is nobody to default to', () => {
    mount();
    expect(select('Filter by class').value).toBe('any');
    expect(rows().map((r) => r.name)).toContain(COWL.n);
  });

  it('gives the whole catalog back on request', () => {
    seedCharacter();
    mount();
    change(select('Filter by class'), 'any');
    expect(rows().map((r) => r.name)).toContain(COWL.n);
  });

  it('survives a store that hydrates after the first render', () => {
    // The defaults are derived, not seeded, precisely because the persisted
    // store arrives late: seeding `useState` would latch `any` / `melee-dps`
    // for anyone who lands on this route directly.
    mount();
    expect(select('Filter by class').value).toBe('any');
    act(() => {
      seedCharacter();
    });
    expect(select('Filter by class').value).toBe('loadout');
    expect(select('Scoring profile').value).toBe('set');
  });
});

describe('red is spent on the exception, not on the default view', () => {
  it('tints nothing while the list is already narrowed to the loadout', () => {
    seedCharacter();
    mount();
    const colours = new Set(rows().map((r) => r.colour));
    // A value every row shares is a full-screen tint, not a signal — the same
    // reasoning `SlotCard` applies to the paper doll.
    expect(colours).toEqual(new Set(['var(--item-neutral)']));
    expect([...colours]).not.toContain('var(--item-blocked)');
  });

  it('tints again the moment the reader asks for a wider list', () => {
    seedCharacter();
    mount();
    change(select('Filter by class'), 'any');
    expect(rowFor(COWL.n)?.colour).toBe('var(--item-blocked)');
    expect(rowFor(SWORD.n)?.colour).toBe('var(--item-usable)');
  });
});

describe('a search for a withheld item explains itself', () => {
  const INDEX = {
    counts: { scraped: 11252, shipped: 3653, quarantined: 7599, explained: 7599 },
    reasons: {
      epic: {
        why: 'era:Epic Quests',
        title: 'Epic quests',
        line: 'It is Epic Quest content, and this server does not have the epic quests.',
      },
    },
    names: { epic: ['Ragebringer'] },
  };

  function stubFetch(body: unknown, ok = true): ReturnType<typeof vi.fn> {
    const fn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('quarantine.json')) {
        return ok
          ? new Response(JSON.stringify(body), { status: 200 })
          : new Response('nope', { status: 404 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  async function search(term: string): Promise<void> {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search items"]')!;
    change(input, term);
    // One tick for the deferred query, one for the fetch, one for the re-render.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('names the item, the rule and the count instead of blaming the reader', async () => {
    const fetched = stubFetch(INDEX);
    mount();
    await search('Ragebringer');

    const empty = container.querySelector('.empty-state');
    expect(empty?.getAttribute('data-empty')).toBe('quarantined');
    const text = empty?.textContent ?? '';
    expect(text).toContain('Ragebringer');
    expect(text).toContain('Epic Quest content');
    expect(text).toContain('era:Epic Quests');
    expect(text).toContain('7,599');
    expect(text).toContain('pipeline/quarantine.json');
    // The sentence that was wrong is gone.
    expect(text).not.toMatch(/loosen a filter/i);
    expect(fetched).toHaveBeenCalled();
  });

  it('does not fetch the withheld list until a search has already failed', async () => {
    const fetched = stubFetch(INDEX);
    mount();
    const quarantineCalls = () =>
      fetched.mock.calls.filter((c) => String(c[0]).includes('quarantine.json')).length;

    expect(quarantineCalls(), 'nothing is downloaded just for opening the browser').toBe(0);
    await search('Bronze');
    expect(quarantineCalls(), 'a search that finds rows costs nothing either').toBe(0);
    await search('Ragebringer');
    expect(quarantineCalls()).toBe(1);

    // A second dead search reuses it rather than re-fetching.
    await search('Ragebring');
    expect(quarantineCalls()).toBe(1);
  });

  it('degrades to the old wording when the list will not load', async () => {
    stubFetch(INDEX, false);
    mount();
    await search('Ragebringer');
    const empty = container.querySelector('.empty-state');
    expect(empty?.getAttribute('data-empty')).toBe('none');
    expect(empty?.textContent).toContain('Ragebringer');
  });

  it('keeps “loosen a filter” for the case it was written for', async () => {
    stubFetch(INDEX);
    mount();
    change(select('Filter by slot'), 'HEAD');
    change(select('Filter by class'), 'WIZ');
    change(select('Filter by era'), 'Sky');
    await act(async () => {
      await Promise.resolve();
    });
    const empty = container.querySelector('.empty-state');
    expect(empty?.getAttribute('data-empty')).toBe('none');
    expect(empty?.textContent).toMatch(/loosen a filter/i);
  });

  it('offers a way out of the dead end', async () => {
    stubFetch(INDEX);
    mount();
    change(select('Filter by slot'), 'HEAD');
    await search('Ragebringer');

    const clear = [...container.querySelectorAll('button')].find((b) =>
      /clear search and filters/i.test(b.textContent ?? ''),
    );
    expect(clear).toBeTruthy();
    act(() => {
      clear!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('.empty-state')).toBeNull();
    expect(select('Filter by slot').value).toBe('any');
    expect(rows().length).toBeGreaterThan(0);
  });
});
