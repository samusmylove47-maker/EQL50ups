/**
 * Equivalency Point editor.
 *
 * A preset is a starting point, not gospel — pick one, then tune any stat.
 * Every keystroke writes straight to the set, so the picker and the item
 * browser re-rank live; there is no apply button on purpose.
 */

import { PRESET_PROFILES, WEIGHTABLE_KEYS, type WeightProfile } from '../engine/ep';
import { finite } from '../lib/format';

export interface WeightsEditorProps {
  weights: WeightProfile;
  onChange: (next: WeightProfile) => void;
  readOnly?: boolean;
}

function groupKeys(): Array<{ group: string; keys: typeof WEIGHTABLE_KEYS }> {
  const groups: string[] = [];
  for (const entry of WEIGHTABLE_KEYS) if (!groups.includes(entry.group)) groups.push(entry.group);
  return groups.map((group) => ({
    group,
    keys: WEIGHTABLE_KEYS.filter((k) => k.group === group),
  }));
}

/** Which preset, if any, the current weights exactly match. */
export function matchingPreset(weights: WeightProfile): string {
  const normalize = (profile: WeightProfile) =>
    Object.entries(profile)
      .filter(([, v]) => finite(v) !== 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
  const current = normalize(weights);
  return PRESET_PROFILES.find((p) => normalize(p.weights) === current)?.id ?? 'custom';
}

export function WeightsEditor({ weights, onChange, readOnly = false }: WeightsEditorProps) {
  const preset = matchingPreset(weights);
  const active = PRESET_PROFILES.find((p) => p.id === preset);

  return (
    <div className="stack">
      <div className="panel panel-pad">
        <div className="spread">
          <label className="field" style={{ minWidth: 220 }}>
            <span>Preset profile</span>
            <select
              value={preset}
              disabled={readOnly}
              onChange={(e) => {
                const found = PRESET_PROFILES.find((p) => p.id === e.target.value);
                if (found) onChange({ ...found.weights });
              }}
            >
              {preset === 'custom' ? <option value="custom">Custom</option> : null}
              {PRESET_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p className="hint grow" style={{ maxWidth: '48ch' }}>
            {active?.description ??
              'Custom weights. Every list in the app re-ranks against these numbers as you type.'}
          </p>
          <button
            type="button"
            className="btn btn-sm"
            disabled={readOnly}
            onClick={() => onChange({})}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="weights-grid">
        {groupKeys().map(({ group, keys }) => (
          <section className="panel panel-pad" key={group}>
            <h3 className="section-label" style={{ marginBottom: 8 }}>
              {group}
            </h3>
            {keys.map((entry) => (
              <div className="weight-row" key={entry.key}>
                <label htmlFor={`w-${entry.key}`}>{entry.label}</label>
                <input
                  id={`w-${entry.key}`}
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  disabled={readOnly}
                  value={String(finite(weights[entry.key]))}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    const next = { ...weights };
                    if (!Number.isFinite(value) || value === 0) delete next[entry.key];
                    else next[entry.key] = value;
                    onChange(next);
                  }}
                />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
