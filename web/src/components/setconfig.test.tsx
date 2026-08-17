/**
 * The set-configuration dialog and the filter inheritance it exists to set up.
 *
 * Driven through real DOM events in jsdom, like the other interaction tests, so
 * the disabled-until-valid contract is exercised the way a user meets it rather
 * than by calling a validator directly.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useCatalog } from '../data/catalog';
import { pickerFilterDefaults, resetPickerDefaults } from '../lib/pickerDefaults';
import { emptyState } from '../state/persistence';
import { useApp } from '../state/store';
import { SetConfigDialog, type SetConfigValue } from './SetConfigDialog';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactNode): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
}

function unmount(): void {
  act(() => root?.unmount());
  container?.remove();
}

function click(element: Element | null | undefined): void {
  expect(element, 'element to click exists').toBeTruthy();
  act(() => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  const proto =
    element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function check(element: HTMLInputElement, value: boolean): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('click', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** The dialog's primary button — `Create` or `Save`. */
function primary(): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('.modal-foot .btn-primary')][0];
  expect(button, 'primary button exists').toBeTruthy();
  return button!;
}

function field(label: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  expect(input, `field ${label} exists`).toBeTruthy();
  return input!;
}

function nameInput(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="text"]')!;
}

function weightKeys(): string[] {
  return [...container.querySelectorAll('.setconfig-weight .k')].map((n) => n.textContent ?? '');
}

beforeEach(() => {
  useCatalog.getState().loadFixture();
  useApp.setState({ ...emptyState(), hydrated: true, storageStatus: 'ok' });
  resetPickerDefaults();
});

afterEach(() => {
  unmount();
});

describe('validation', () => {
  it('keeps Create disabled until the set has a name', () => {
    mount(<SetConfigDialog mode="create" initial={{ weights: { AC: 1 } }} onCancel={() => {}} onSubmit={() => {}} />);

    expect(primary().disabled).toBe(true);
    expect(container.textContent).toContain('Give the set a name.');

    setValue(nameInput(), 'Raid tank');
    expect(primary().disabled).toBe(false);

    // Whitespace is not a name.
    setValue(nameInput(), '   ');
    expect(primary().disabled).toBe(true);
  });

  it('refuses a profile with nothing weighted, and says why', () => {
    mount(
      <SetConfigDialog
        mode="edit"
        initial={{ name: 'Named', weights: { AC: 2 } }}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(primary().disabled).toBe(false);
    click(container.querySelector('[aria-label="Remove AC"]'));
    expect(weightKeys()).toHaveLength(0);
    expect(primary().disabled).toBe(true);
    expect(container.textContent).toContain('non-zero weight');
  });

  it('blocks on a weight left blank rather than silently dropping the stat', () => {
    mount(
      <SetConfigDialog
        mode="edit"
        initial={{ name: 'Named', weights: { AC: 2, HP: 0.5 } }}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );

    // A number input reports anything unparseable as the empty string, so this
    // is the shape a mistyped weight actually arrives in.
    setValue(field('AC weight'), 'lots');
    expect(field('AC weight').value).toBe('');
    expect(primary().disabled).toBe(true);
    expect(container.textContent).toMatch(/Give AC a weight, or remove it/i);

    setValue(field('AC weight'), '3.5');
    expect(primary().disabled).toBe(false);
    expect(field('AC weight').value).toBe('3.5');
  });

  it('does not block on a duplicate name, but does point it out', () => {
    mount(
      <SetConfigDialog
        mode="create"
        initial={{ weights: { AC: 1 } }}
        siblingNames={['Main Set']}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );
    setValue(nameInput(), 'main set');
    expect(primary().disabled).toBe(false);
    expect(container.textContent).toContain('Another set already has this name.');
  });
});

describe('equivalency points', () => {
  it('seeds the weights from a preset and shows that preset’s own description', () => {
    mount(<SetConfigDialog mode="create" initial={{ weights: { AC: 1 } }} onCancel={() => {}} onSubmit={() => {}} />);

    const preset = container.querySelector<HTMLSelectElement>('select')!;
    setValue(preset, 'tank');
    expect(container.textContent).toContain('Favours mitigation and health over offence.');
    expect(weightKeys()).toContain('AC');
    expect(weightKeys()).toContain('Stamina');
    expect(field('AC weight').value).toBe('2');

    setValue(preset, 'caster');
    expect(container.textContent).toContain('Favours mana pool and the casting attributes.');
    expect(weightKeys()).toContain('Wisdom');
  });

  it('falls back to Custom the moment a preset value is edited', () => {
    mount(<SetConfigDialog mode="create" initial={{ weights: { AC: 1 } }} onCancel={() => {}} onSubmit={() => {}} />);
    const preset = container.querySelector<HTMLSelectElement>('select')!;
    setValue(preset, 'tank');
    expect(preset.value).toBe('tank');
    setValue(field('AC weight'), '9');
    expect(preset.value).toBe('custom');
  });

  it('adds an individual stat through + Add Point, and offers it only once', () => {
    mount(<SetConfigDialog mode="create" initial={{ weights: { AC: 1 } }} onCancel={() => {}} onSubmit={() => {}} />);

    expect(weightKeys()).toEqual(['AC']);
    click(container.querySelector('.setconfig-add'));

    const chooser = container.querySelector<HTMLSelectElement>('[aria-label="Stat to add"]')!;
    expect(chooser).toBeTruthy();
    // Already-weighted stats are not on offer.
    expect([...chooser.options].map((o) => o.value)).not.toContain('AC');

    setValue(chooser, 'BACKSTAB');
    click([...container.querySelectorAll('.setconfig-addrow .btn-primary')][0]);

    expect(weightKeys()).toContain('Backstab Mod');
    expect(container.querySelector('[aria-label="Stat to add"]')).toBeNull();
  });
});

describe('default filters', () => {
  it('carries era, source and hide-No-Drop out through onSubmit', () => {
    const onSubmit = vi.fn<(value: SetConfigValue) => void>();
    mount(<SetConfigDialog mode="create" initial={{ weights: { AC: 1 } }} onCancel={() => {}} onSubmit={onSubmit} />);

    setValue(nameInput(), 'Kunark hunt');
    const selects = [...container.querySelectorAll<HTMLSelectElement>('.setconfig-filters select')];
    expect(selects).toHaveLength(2);
    setValue(selects[0]!, 'Kunark');
    setValue(selects[1]!, 'quest');
    check(container.querySelector<HTMLInputElement>('.setconfig-filters input[type="checkbox"]')!, true);

    click(primary());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: 'Kunark hunt',
      notes: '',
      weights: { AC: 1 },
      filters: { era: 'Kunark', source: 'quest', hideNoDrop: true },
    });
  });

  it('round-trips the filters of the set being edited', () => {
    const onSubmit = vi.fn<(value: SetConfigValue) => void>();
    mount(
      <SetConfigDialog
        mode="edit"
        initial={{
          name: 'Existing',
          notes: 'keep me',
          weights: { AC: 1 },
          filters: { era: 'Kunark', source: 'vendor', hideNoDrop: true },
        }}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );

    const selects = [...container.querySelectorAll<HTMLSelectElement>('.setconfig-filters select')];
    expect(selects[0]?.value).toBe('Kunark');
    expect(selects[1]?.value).toBe('vendor');

    click(primary());
    expect(onSubmit.mock.calls[0]?.[0]?.filters).toEqual({
      era: 'Kunark',
      source: 'vendor',
      hideNoDrop: true,
    });
    expect(onSubmit.mock.calls[0]?.[0]?.notes).toBe('keep me');
  });
});

describe('filter inheritance', () => {
  function seedSet(filters?: { era: string; source: 'any' | 'quest'; hideNoDrop: boolean }) {
    const character = useApp.getState().createCharacter({
      name: 'Avenrae',
      level: 50,
      classes: ['BRD'],
      race: null,
    });
    return useApp
      .getState()
      .createSet(character.id, 'Main Set', { AC: 1 }, filters ? { filters } : undefined);
  }

  it('publishes the open set’s filters for the pickers it opens', () => {
    const gearSet = seedSet({ era: 'Kunark', source: 'quest', hideNoDrop: true });
    expect(pickerFilterDefaults()).toEqual({ era: 'any', source: 'any', hideNoDrop: false });

    window.location.hash = `#/set/${gearSet.id}`;
    mount(<App />);

    expect(pickerFilterDefaults()).toEqual({
      era: 'Kunark',
      source: 'quest',
      hideNoDrop: true,
    });
  });

  it('drops back to the app defaults when the set screen goes away', () => {
    const gearSet = seedSet({ era: 'Kunark', source: 'quest', hideNoDrop: true });
    window.location.hash = `#/set/${gearSet.id}`;
    mount(<App />);
    expect(pickerFilterDefaults().era).toBe('Kunark');

    unmount();
    expect(pickerFilterDefaults()).toEqual({ era: 'any', source: 'any', hideNoDrop: false });
    // `afterEach` unmounts again; make that a no-op rather than a crash.
    container = document.createElement('div');
    act(() => {
      root = createRoot(container);
    });
  });

  it('a set created without filters inherits nothing and stores nothing', () => {
    const gearSet = seedSet();
    expect(gearSet.defaultFilters).toBeUndefined();
    window.location.hash = `#/set/${gearSet.id}`;
    mount(<App />);
    expect(pickerFilterDefaults()).toEqual({ era: 'any', source: 'any', hideNoDrop: false });
  });
});
