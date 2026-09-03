import { useState } from 'react';
import { validateClasses } from '../engine/character';
import { LEVEL_CAP, RACES, raceLabel, type ClassCode } from '../engine/constants';
import { ClassPicker } from '../components/ClassPicker';
import { href, navigate } from '../router';
import { useApp } from '../state/store';

export function NewCharacter() {
  const createCharacter = useApp((s) => s.createCharacter);
  const createSet = useApp((s) => s.createSet);

  /*
   * Every playable race, not the subset the corpus happens to restrict on.
   *
   * This used to read race codes out of the loaded items and union a
   * seven-code floor, so the dropdown offered 7 of 15 and eight races could not
   * be picked at all. A player who cannot say they are a Gnome leaves it unset,
   * and unset does not narrow — so they were shown Ogre-only gear as an upgrade.
   *
   * **The figure this comment used to cite was impossible.** It said "7,341
   * items carry a restriction" against a payload that held 3,663 items in total
   * at the time. Re-measured over `web/public/data/items-index.json`, and the
   * two readings are given separately because they answer different questions:
   *
   *   items naming an actual race code      163
   *   items whose `ra` is not simply ALL    254   (163 naming a code + 91 NONE)
   *   distinct race codes named               5   BAR ELF IKS OGR TRL
   *
   * The narrow figure is the one this argument rests on: the dropdown was built
   * from codes the corpus names, and 163 items between them name five. The
   * five-codes half was right all along; only the population was wrong.
   * `prose-vs-record.test.ts` derives both counts and fails if either drifts.
   */
  const races = RACES;

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
                    {raceLabel(code)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Race is optional and only used to filter race-restricted items; all fifteen playable
            races are offered, whether or not this catalog happens to carry an item restricted to
            one. Leaving it unset does not narrow anything — race-restricted gear stays in your
            lists — but the planner will then say it has not checked the requirement rather than
            telling you that you meet it. Race base attributes are
            deliberately not modelled — the only available source self-reports as unverified, so the
            planner shows gear totals rather than inventing a starting point.
          </p>
        </section>

        <section className="panel panel-pad stack">
          <div className="spread">
            <h2 className="section-label">Class trio</h2>
            <span className="hint">
              {classes.length
                ? `${levelOk ? parsedLevel : LEVEL_CAP} ${classes.join('/')}`
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
            proficiency and skill caps take the best of the trio, and an item's level requirement is
            checked against the class that qualifies you for it. This becomes your first loadout —
            add more, and set each class's own level, from the character page.
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
