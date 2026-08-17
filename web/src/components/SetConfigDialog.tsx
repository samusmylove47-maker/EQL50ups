/**
 * The one set-configuration surface.
 *
 * UI-REFERENCE §A4 records the reference tool's create flow — `BASIC DETAILS →
 * EQUIVALENCY POINTS → DEFAULT FILTERS → Create` — and states the lesson in
 * bold: stat weights and filters are configured *at set creation*, so every set
 * carries its own scoring lens. Mirror this.
 *
 * The same dialog serves Edit. A creation path with no options beside an edit
 * path with two fields is two half-surfaces; this is one, and the only
 * difference between the modes is the verb on the primary button.
 *
 * Weight values are held as **text**, not numbers. A number input bound to a
 * number cannot hold the intermediate states of typing — `-`, `0.`, an empty
 * box — without either rejecting the keystroke or silently substituting a
 * value, so the draft stays text and validation is a separate, visible step.
 */

import { useMemo, useRef, useState } from 'react';
import { ERA_ORDER } from '../engine/constants';
import { PRESET_PROFILES, WEIGHTABLE_KEYS, type WeightProfile } from '../engine/ep';
import { statLabel } from '../selectors/gear';
import { finite } from '../lib/format';
import {
  DEFAULT_SET_FILTERS, SOURCE_FILTERS, SOURCE_LABELS,
  type SetFilters, type SourceFilter,
} from '../lib/setFilters';
import { Modal } from './Modal';
import './SetConfigDialog.css';

export interface SetConfigValue {
  name: string;
  notes: string;
  weights: WeightProfile;
  filters: SetFilters;
}

export interface SetConfigDialogProps {
  mode: 'create' | 'edit';
  initial?: Partial<SetConfigValue>;
  /** Sibling set names, so a collision can be pointed out without blocking. */
  siblingNames?: readonly string[];
  onCancel: () => void;
  onSubmit: (value: SetConfigValue) => void;
}

interface WeightRow {
  key: string;
  text: string;
}

const KEY_ORDER = new Map(WEIGHTABLE_KEYS.map((entry, index) => [entry.key, index]));
const WEIGHT_GROUPS = [...new Set(WEIGHTABLE_KEYS.map((entry) => entry.group))];

function labelFor(key: string): string {
  return WEIGHTABLE_KEYS.find((entry) => entry.key === key)?.label ?? statLabel(key);
}

function sortRows(rows: WeightRow[]): WeightRow[] {
  return [...rows].sort(
    (a, b) => (KEY_ORDER.get(a.key) ?? 999) - (KEY_ORDER.get(b.key) ?? 999) || a.key.localeCompare(b.key),
  );
}

function rowsFrom(weights: WeightProfile): WeightRow[] {
  return sortRows(
    Object.entries(weights)
      .filter(([, value]) => finite(value) !== 0)
      .map(([key, value]) => ({ key, text: String(finite(value)) })),
  );
}

function weightsFrom(rows: readonly WeightRow[]): WeightProfile {
  const out: WeightProfile = {};
  for (const row of rows) {
    const text = row.text.trim();
    if (!text) continue;
    const value = Number(text);
    if (Number.isFinite(value) && value !== 0) out[row.key] = value;
  }
  return out;
}

function samePreset(weights: WeightProfile, preset: WeightProfile): boolean {
  const keys = new Set([...Object.keys(weights), ...Object.keys(preset)]);
  for (const key of keys) if (finite(weights[key]) !== finite(preset[key])) return false;
  return true;
}

function presetMatching(weights: WeightProfile): string {
  return PRESET_PROFILES.find((p) => samePreset(weights, p.weights))?.id ?? 'custom';
}

export function SetConfigDialog({
  mode,
  initial,
  siblingNames = [],
  onCancel,
  onSubmit,
}: SetConfigDialogProps) {
  const startingWeights = initial?.weights ?? {};
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rows, setRows] = useState<WeightRow[]>(() => rowsFrom(startingWeights));
  const [preset, setPreset] = useState<string>(() => presetMatching(startingWeights));
  const [filters, setFilters] = useState<SetFilters>(initial?.filters ?? { ...DEFAULT_SET_FILTERS });
  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState('');
  const addRef = useRef<HTMLSelectElement>(null);

  const available = useMemo(
    () => WEIGHTABLE_KEYS.filter((entry) => !rows.some((row) => row.key === entry.key)),
    [rows],
  );

  const weights = useMemo(() => weightsFrom(rows), [rows]);

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('Give the set a name.');
    for (const row of rows) {
      const text = row.text.trim();
      /*
       * A blank row blocks rather than being dropped on save. A number input
       * reports anything it cannot parse — `lots`, `1e`, a lone `-` — as the
       * empty string, so "blank" is the shape every bad keystroke arrives in,
       * and silently discarding the stat would lose a deliberate choice.
       */
      if (!text) {
        list.push(`Give ${labelFor(row.key)} a weight, or remove it.`);
        continue;
      }
      if (!Number.isFinite(Number(text))) {
        list.push(`The weight for ${labelFor(row.key)} is not a number.`);
      }
    }
    if (!Object.keys(weights).length) {
      list.push('Give at least one stat a non-zero weight — with none, nothing can be ranked.');
    }
    return list;
  }, [name, rows, weights]);

  const valid = problems.length === 0;
  const duplicateName =
    Boolean(name.trim()) && siblingNames.some((other) => other.toLowerCase() === name.trim().toLowerCase());

  const applyPreset = (id: string) => {
    setPreset(id);
    if (id === 'custom') return;
    const profile = PRESET_PROFILES.find((p) => p.id === id);
    if (profile) setRows(rowsFrom(profile.weights));
  };

  const editRow = (key: string, text: string) => {
    const next = rows.map((row) => (row.key === key ? { ...row, text } : row));
    setRows(next);
    setPreset(presetMatching(weightsFrom(next)));
  };

  const removeRow = (key: string) => {
    const next = rows.filter((row) => row.key !== key);
    setRows(next);
    setPreset(presetMatching(weightsFrom(next)));
  };

  const addRow = () => {
    const key = addKey || available[0]?.key;
    if (!key) return;
    const next = sortRows([...rows, { key, text: '1' }]);
    setRows(next);
    setPreset(presetMatching(weightsFrom(next)));
    setAddKey('');
    setAdding(false);
  };

  const presetHelp =
    preset === 'custom'
      ? 'Your own profile. Every stat below is worth its weight per point, and scoring is cap-aware: points above 510 (attributes) or 1000 (resists) score nothing.'
      : (PRESET_PROFILES.find((p) => p.id === preset)?.description ?? '');

  const submit = () => {
    if (!valid) return;
    onSubmit({ name: name.trim(), notes: notes.trim(), weights, filters });
  };

  return (
    <Modal
      title={mode === 'create' ? 'New gear set' : 'Set configuration'}
      onClose={onCancel}
      width={620}
      footer={
        <>
          <span className="setconfig-footnote" id="setconfig-problem" role="status">
            {problems[0] ?? (duplicateName ? 'Another set already has this name.' : '')}
          </span>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={!valid}
            aria-describedby={valid ? undefined : 'setconfig-problem'}
          >
            {mode === 'create' ? 'Create' : 'Save'}
          </button>
        </>
      }
    >
      <div className="modal-body stack setconfig">
        <section className="setconfig-section" aria-labelledby="setconfig-basic">
          <h3 className="section-label" id="setconfig-basic">
            Basic details
          </h3>
          <label className="field">
            <span>Set name</span>
            <input
              type="text"
              value={name}
              autoFocus
              maxLength={80}
              required
              aria-invalid={!name.trim()}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && valid) submit();
              }}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What this set is for, what you are still hunting…"
            />
          </label>
        </section>

        <section className="setconfig-section" aria-labelledby="setconfig-ep">
          <h3 className="section-label" id="setconfig-ep">
            Equivalency points
          </h3>
          <p className="hint">
            The scoring lens this set ranks and auto-fills with. Points above a stat's ceiling score
            nothing, so an item cannot win a slot with a stat you have already maxed.
          </p>
          <label className="field">
            <span>Starting profile</span>
            <select value={preset} onChange={(event) => applyPreset(event.target.value)}>
              {PRESET_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          <p className="hint setconfig-help">{presetHelp}</p>

          <ul className="setconfig-weights">
            {rows.map((row) => (
              <li className="setconfig-weight" key={row.key}>
                <span className="k">{labelFor(row.key)}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={row.text}
                  aria-label={`${labelFor(row.key)} weight`}
                  onChange={(event) => editRow(row.key, event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-quiet btn-icon"
                  aria-label={`Remove ${labelFor(row.key)}`}
                  onClick={() => removeRow(row.key)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
            {!rows.length ? <li className="hint">No stats weighted yet.</li> : null}
          </ul>

          {adding && available.length ? (
            <div className="setconfig-addrow">
              <select
                ref={addRef}
                value={addKey || (available[0]?.key ?? '')}
                aria-label="Stat to add"
                onChange={(event) => setAddKey(event.target.value)}
              >
                {WEIGHT_GROUPS.map((group) => {
                  const entries = available.filter((entry) => entry.group === group);
                  if (!entries.length) return null;
                  return (
                    <optgroup label={group} key={group}>
                      {entries.map((entry) => (
                        <option key={entry.key} value={entry.key}>
                          {entry.label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <button type="button" className="btn btn-sm btn-primary" onClick={addRow}>
                Add
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="setconfig-add"
              disabled={!available.length}
              onClick={() => {
                setAdding(true);
                // The select replaces this button, so focus has to be moved on
                // or a keyboard user is left on a control that no longer exists.
                setTimeout(() => addRef.current?.focus(), 0);
              }}
            >
              + Add Point
            </button>
          )}
        </section>

        <section className="setconfig-section" aria-labelledby="setconfig-filters">
          <h3 className="section-label" id="setconfig-filters">
            Default filters
          </h3>
          <p className="hint">
            Every item picker in this set opens with these already applied. Change them here rather
            than re-picking them in twenty-three pickers.
          </p>
          <div className="setconfig-filters">
            <label className="field">
              <span>Era</span>
              <select
                value={filters.era}
                onChange={(event) => setFilters({ ...filters, era: event.target.value })}
              >
                <option value="any">Any era</option>
                {ERA_ORDER.map((era) => (
                  <option key={era} value={era}>
                    {era}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Source</span>
              <select
                value={filters.source}
                onChange={(event) =>
                  setFilters({ ...filters, source: event.target.value as SourceFilter })
                }
              >
                {SOURCE_FILTERS.map((source) => (
                  <option key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkline setconfig-check">
              <input
                type="checkbox"
                checked={filters.hideNoDrop}
                onChange={(event) => setFilters({ ...filters, hideNoDrop: event.target.checked })}
              />
              Hide No Drop items
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
}
