import { useState } from 'react';
import { describeCharacter, validateClasses } from '../engine/character';
import { LEVEL_CAP, type ClassCode } from '../engine/constants';
import { ClassPicker } from '../components/ClassPicker';
import { href, navigate } from '../router';
import { useApp } from '../state/store';

/** Race codes as they appear in item restrictions. Optional — items rarely gate on race. */
const RACES = [
  'HUM', 'BAR', 'ERU', 'ELF', 'HIE', 'DEF', 'HEF', 'HFL', 'DWF', 'TRL', 'OGR', 'GNM', 'IKS',
];

export function NewCharacter() {
  const createCharacter = useApp((s) => s.createCharacter);
  const createSet = useApp((s) => s.createSet);

  const [name, setName] = useState('');
  const [level, setLevel] = useState(LEVEL_CAP);
  const [race, setRace] = useState('');
  const [classes, setClasses] = useState<ClassCode[]>([]);

  const validation = validateClasses(classes);
  const nameOk = name.trim().length > 0;
  const canCreate = nameOk && validation.ok;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    const character = createCharacter({
      name: name.trim(),
      level,
      classes,
      race: race || null,
    });
    const gearSet = createSet(character.id, 'Main Set');
    navigate(href.set(gearSet.id));
  };

  return (
    <form onSubmit={submit}>
      <div className="page-head">
        <h1 className="page-title">Create character</h1>
        <a className="btn btn-sm btn-quiet" href={href.characters}>
          Cancel
        </a>
      </div>

      <div className="stack">
        <section className="panel panel-pad stack">
          <h2 className="section-label">Basic details</h2>
          <div className="rowline" style={{ alignItems: 'flex-end' }}>
            <label className="field grow" style={{ maxWidth: 320 }}>
              <span>Name</span>
              <input
                type="text"
                value={name}
                autoFocus
                maxLength={64}
                onChange={(e) => setName(e.target.value)}
                placeholder="Avenrae"
              />
            </label>
            <label className="field" style={{ width: 110 }}>
              <span>Level</span>
              <input
                type="number"
                min={1}
                max={LEVEL_CAP}
                value={level}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setLevel(Number.isFinite(next) ? Math.max(1, Math.min(LEVEL_CAP, next)) : 1);
                }}
              />
            </label>
            <label className="field" style={{ width: 160 }}>
              <span>Race (optional)</span>
              <select value={race} onChange={(e) => setRace(e.target.value)}>
                <option value="">Unset</option>
                {RACES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Race is optional and only used to filter race-restricted items. Race base attributes are
            deliberately not modelled — the only available source self-reports as unverified, so the
            planner shows gear totals rather than inventing a starting point.
          </p>
        </section>

        <section className="panel panel-pad stack">
          <div className="spread">
            <h2 className="section-label">Class trio</h2>
            <span className="hint">
              {classes.length
                ? describeCharacter({ level, classes })
                : 'Pick one to three distinct classes — the first is your primary.'}
            </span>
          </div>
          <ClassPicker value={classes} onChange={setClasses} />
          {!validation.ok && classes.length > 0 ? (
            <p className="hint bad" role="alert">
              {validation.error}
            </p>
          ) : null}
          <p className="hint">
            Eligibility is a union: an item is usable if any of the three classes qualifies. Armour
            proficiency and skill caps take the best of the trio.
          </p>
        </section>

        <div className="rowline">
          <button type="submit" className="btn btn-primary" disabled={!canCreate}>
            Create character
          </button>
          {!nameOk ? <span className="hint">A name is required.</span> : null}
          {nameOk && !validation.ok ? <span className="hint">{validation.error}</span> : null}
        </div>
      </div>
    </form>
  );
}
