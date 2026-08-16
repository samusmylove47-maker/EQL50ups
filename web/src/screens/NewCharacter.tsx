import { useMemo, useState } from 'react';
import { describeCharacter, validateClasses } from '../engine/character';
import { LEVEL_CAP, type ClassCode } from '../engine/constants';
import { ClassPicker } from '../components/ClassPicker';
import { useCatalog } from '../data/catalog';
import { href, navigate } from '../router';
import { useApp } from '../state/store';

/**
 * Race codes are read out of the item corpus rather than invented, so the
 * dropdown can only offer codes the eligibility check actually understands.
 * These are the codes present in the published catalog's restriction lists,
 * used as a floor until the catalog has loaded.
 */
const OBSERVED_RACE_CODES = ['BAR', 'DEF', 'ELF', 'HEF', 'IKS', 'OGR', 'TRL'];
const NON_RACE_TOKENS = new Set(['ALL', 'NONE', 'ALL_EXCEPT']);

export function NewCharacter() {
  const createCharacter = useApp((s) => s.createCharacter);
  const createSet = useApp((s) => s.createSet);
  const items = useCatalog((s) => s.items);

  const races = useMemo(() => {
    const found = new Set<string>();
    for (const item of items) {
      for (const code of item.ra) if (!NON_RACE_TOKENS.has(code)) found.add(code);
    }
    for (const code of OBSERVED_RACE_CODES) found.add(code);
    return [...found].sort();
  }, [items]);

  const [name, setName] = useState('');
  /*
   * The level is held as text, not as a clamped number. Clamping on every
   * keystroke rewrote what was being typed — emptying the field snapped it to
   * 1, so typing "40" over it produced 140 and then the cap. Keep the reader's
   * own text, refuse to submit while it is out of range, and snap on blur.
   */
  const [levelText, setLevelText] = useState(String(LEVEL_CAP));
  const [race, setRace] = useState('');
  const [classes, setClasses] = useState<ClassCode[]>([]);

  const parsedLevel = Number(levelText.trim());
  const levelOk =
    levelText.trim() !== '' &&
    Number.isFinite(parsedLevel) &&
    Number.isInteger(parsedLevel) &&
    parsedLevel >= 1 &&
    parsedLevel <= LEVEL_CAP;

  const validation = validateClasses(classes);
  const nameOk = name.trim().length > 0;
  const canCreate = nameOk && validation.ok && levelOk;

  const snapLevel = () => {
    const clamped = Number.isFinite(parsedLevel)
      ? Math.max(1, Math.min(LEVEL_CAP, Math.round(parsedLevel)))
      : LEVEL_CAP;
    setLevelText(String(levelText.trim() === '' ? LEVEL_CAP : clamped));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    const character = createCharacter({
      name: name.trim(),
      level: parsedLevel,
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
                step={1}
                value={levelText}
                aria-invalid={levelOk ? undefined : true}
                onChange={(e) => setLevelText(e.target.value)}
                onBlur={snapLevel}
              />
            </label>
            <label className="field" style={{ width: 160 }}>
              <span>Race (optional)</span>
              <select value={race} onChange={(e) => setRace(e.target.value)}>
                <option value="">Unset</option>
                {races.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Race is optional and only used to filter race-restricted items; the codes offered are
            the ones the item catalog actually restricts on. Race base attributes are
            deliberately not modelled — the only available source self-reports as unverified, so the
            planner shows gear totals rather than inventing a starting point.
          </p>
        </section>

        <section className="panel panel-pad stack">
          <div className="spread">
            <h2 className="section-label">Class trio</h2>
            <span className="hint">
              {classes.length
                ? describeCharacter({ level: levelOk ? parsedLevel : LEVEL_CAP, classes })
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
          {nameOk && validation.ok && !levelOk ? (
            <span className="hint bad" role="alert">
              Level must be a whole number between 1 and {LEVEL_CAP}.
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}
