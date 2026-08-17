/**
 * Character detail: per-class levels and the loadout list.
 *
 * This is the screen the client's Loadouts tab implies (Tier 0 §6). A
 * character is not one trio at one level — it is sixteen independent class
 * levels plus a set of named race/primary/secondary combinations, one active.
 * Switching the active loadout here changes eligibility everywhere.
 */

import { useState } from 'react';
import {
  activeLoadout, describeLoadout, validateClasses, type Loadout,
} from '../engine/character';
import { CLASSES, CLASS_NAMES, LEVEL_CAP, type ClassCode } from '../engine/constants';
import { ClassPicker } from '../components/ClassPicker';
import { InventoryImportDialog } from '../components/InventoryImportDialog';
import { Modal } from '../components/Modal';
import { queueImportNotice } from '../lib/importNotice';
import { importedSetName, summarizeImport, toSlotMap } from '../lib/inventoryImport';
import { href, navigate } from '../router';
import { setsForCharacter, useApp } from '../state/store';

export function CharacterDetail({ id }: { id: string }) {
  const state = useApp();
  const character = state.characters.find((c) => c.id === id);
  const [editing, setEditing] = useState<Loadout | null>(null);
  const [draftClasses, setDraftClasses] = useState<ClassCode[]>([]);
  const [draftName, setDraftName] = useState('');
  const [importing, setImporting] = useState(false);

  if (!character) {
    return (
      <div className="empty-state">
        <h2>Character not found</h2>
        <p>This character is not in this browser's library.</p>
        <div className="empty-actions">
          <a className="btn btn-primary" href={href.characters}>
            Your characters
          </a>
        </div>
      </div>
    );
  }

  const active = activeLoadout(character);
  const sets = setsForCharacter(state, character.id);
  const openEditor = (loadout: Loadout) => {
    setEditing(loadout);
    setDraftClasses([...loadout.classes]);
    setDraftName(loadout.name);
  };
  const draftValid = validateClasses(draftClasses);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{character.name}</h1>
        <div className="rowline">
          <a className="btn btn-sm btn-quiet" href={href.characters}>
            All characters
          </a>
          {/*
            The game writes the whole character out already. Building it by hand
            is ~46 clicks and ~280 keystrokes before a single +N is set, so this
            sits beside the character rather than buried in a set's menu.
          */}
          <button type="button" className="btn btn-sm" onClick={() => setImporting(true)}>
            ⇩ Import from game
          </button>
          {sets[0] ? (
            <a className="btn btn-sm btn-primary" href={href.set(sets[0].id)}>
              Open {sets[0].name}
            </a>
          ) : null}
        </div>
      </div>

      <section className="panel panel-pad stack" style={{ marginBottom: 'var(--s4)' }}>
        <div className="spread">
          <h2 className="section-label">Loadouts</h2>
          <span className="hint">
            {active ? `Active: ${describeLoadout(character, active)}` : 'No active loadout'}
          </span>
        </div>
        <p className="hint">
          Each loadout is a primary class and up to two secondaries. Item eligibility is the union
          of the three, armour proficiency takes the best of them, and a level requirement is
          checked against the class that qualifies you for the item.
        </p>

        <ul className="stack" style={{ gap: 'var(--s2)' }}>
          {character.loadouts.map((loadout) => {
            const isActive = loadout.id === character.activeLoadoutId;
            return (
              <li className="set-line" key={loadout.id}>
                <div className="grow">
                  <strong>{loadout.name}</strong>
                  {isActive ? <span className="tag" style={{ marginLeft: 'var(--s2)' }}>Active</span> : null}
                  <div className="meta">
                    {describeLoadout(character, loadout)}
                    {' · '}
                    {loadout.classes.map((c) => CLASS_NAMES[c]).join(' · ') || 'No classes'}
                  </div>
                </div>
                <div className="rowline">
                  {!isActive ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => state.setActiveLoadout(character.id, loadout.id)}
                    >
                      Activate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() => openEditor(loadout)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet btn-danger"
                    disabled={character.loadouts.length <= 1}
                    title={
                      character.loadouts.length <= 1
                        ? 'A character keeps at least one loadout'
                        : `Delete ${loadout.name}`
                    }
                    onClick={() => state.deleteLoadout(character.id, loadout.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="rowline">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              const created = state.addLoadout(character.id);
              if (created) openEditor(created);
            }}
          >
            Add loadout
          </button>
        </div>
      </section>

      <section className="panel panel-pad stack">
        <div className="spread">
          <h2 className="section-label">Class levels</h2>
          <span className="hint">All sixteen classes level independently.</span>
        </div>
        <div className="level-grid">
          {CLASSES.map((code) => (
            <label className="field" key={code}>
              <span>
                {CLASS_NAMES[code]} <span className="dim">{code}</span>
              </span>
              <input
                type="number"
                min={1}
                max={LEVEL_CAP}
                step={1}
                value={character.levels[code]}
                aria-label={`${CLASS_NAMES[code]} level`}
                onChange={(e) => state.setClassLevel(character.id, code, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>

      {importing ? (
        <InventoryImportDialog
          characterName={character.name}
          newSetName={importedSetName(sets.map((s) => s.name))}
          onCancel={() => setImporting(false)}
          onImport={(result) => {
            const created = state.createSet(
              character.id,
              importedSetName(sets.map((s) => s.name)),
            );
            state.applySlots(created.id, toSlotMap(result), true);
            setImporting(false);
            // The report travels to the set the reader is about to land on.
            queueImportNotice(summarizeImport(result));
            navigate(href.set(created.id));
          }}
        />
      ) : null}

      {editing ? (
        <Modal
          title={`Edit ${editing.name}`}
          onClose={() => setEditing(null)}
          width={720}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!draftValid.ok}
                onClick={() => {
                  state.updateLoadout(character.id, editing.id, {
                    name: draftName.trim() || editing.name,
                    classes: draftClasses,
                  });
                  setEditing(null);
                }}
              >
                Save loadout
              </button>
            </>
          }
        >
          <div className="modal-body stack">
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Loadout name</span>
              <input
                type="text"
                value={draftName}
                maxLength={48}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>
            <ClassPicker value={draftClasses} onChange={setDraftClasses} />
            {!draftValid.ok ? (
              <p className="hint bad" role="alert">
                {draftValid.error}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <div className="rowline" style={{ marginTop: 'var(--s4)' }}>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (window.confirm(`Delete ${character.name} and ${sets.length} set(s)?`)) {
              state.deleteCharacter(character.id);
              navigate(href.characters);
            }
          }}
        >
          Delete character
        </button>
      </div>
    </div>
  );
}
