import { useRef, useState } from 'react';
import { activeRace, describeCharacter } from '../engine/character';
import { isExportEnvelope } from '../share/codec';
import { href, navigate } from '../router';
import { setsForCharacter, useApp } from '../state/store';

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Characters() {
  const state = useApp();
  const {
    characters,
    createSet,
    deleteCharacter,
    deleteSet,
    duplicateSet,
    renameSet,
    buildEnvelope,
    importEnvelope,
  } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onImport = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isExportEnvelope(parsed)) {
        setMessage('That file is not an EQL Upgrades export.');
        return;
      }
      const result = importEnvelope(parsed);
      setMessage(
        `Imported ${result.characters} character${result.characters === 1 ? '' : 's'} and ${
          result.sets
        } set${result.sets === 1 ? '' : 's'}.`,
      );
    } catch {
      setMessage('That file could not be read as JSON.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Characters</h1>
        <div className="rowline">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => downloadJson('eql-upgrades-export.json', buildEnvelope())}
            disabled={!characters.length}
          >
            Export JSON
          </button>
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          {/*
            The visible button opens this, so the input itself must not be a
            tab stop: it is clipped to a pixel, and a keyboard user landing on
            it got an invisible, unnamed control between two buttons.
          */}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = '';
            }}
          />
          <a className="btn btn-sm btn-primary" href={href.newCharacter}>
            New character
          </a>
        </div>
      </div>

      {message ? (
        <div className="notice" role="status">
          <span>{message}</span>
        </div>
      ) : null}

      {!characters.length ? (
        <div className="empty-state">
          <h2>No characters yet</h2>
          <p>
            A character is a level, an optional race and up to three classes. Item eligibility is
            the union of the trio, so the class picker is the most consequential control here.
          </p>
          <div className="empty-actions">
            <a className="btn btn-primary" href={href.newCharacter}>
              Create your first character
            </a>
          </div>
        </div>
      ) : null}

      <div className="card-grid">
        {characters.map((character) => {
          const sets = setsForCharacter(state, character.id);
          return (
            <article className="card" key={character.id}>
              {/*
                The name column carries `min-width: 0` through `.grow` and the
                buttons live in their own flex track. Without that the set row
                collapsed: "Main Set" wrapped one letter per line and painted
                the word "Set" straight over the word "RENAME".
              */}
              <div className="card-ident">
                <div className="portrait sm" aria-hidden="true">
                  {character.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
                <div className="grow">
                  <h3>{character.name}</h3>
                  <div className="hint">
                    {describeCharacter(character)}
                    {activeRace(character) ? ` · ${activeRace(character)}` : ''}
                  </div>
                  <div className="hint">
                    <a href={href.character(character.id)}>
                      {character.loadouts.length} loadout
                      {character.loadouts.length === 1 ? '' : 's'} · per-class levels
                    </a>
                  </div>
                </div>
              </div>

              <ul className="stack" style={{ gap: 6 }}>
                {sets.map((gearSet) => (
                  <li className="set-line" key={gearSet.id}>
                    <div className="grow">
                      <a href={href.set(gearSet.id)}>{gearSet.name}</a>
                      <div className="meta">
                        {Object.keys(gearSet.slots).length} equipped · edited{' '}
                        {new Date(gearSet.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="set-line-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => {
                          const name = window.prompt('Rename set', gearSet.name);
                          if (name) renameSet(gearSet.id, name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => duplicateSet(gearSet.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet btn-danger"
                        onClick={() => {
                          if (window.confirm(`Delete set "${gearSet.name}"?`)) deleteSet(gearSet.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {!sets.length ? <li className="hint">No sets yet.</li> : null}
              </ul>

              <div className="row card-foot">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const created = createSet(character.id);
                    navigate(href.set(created.id));
                  }}
                >
                  New set
                </button>
                <span className="grow" />
                <button
                  type="button"
                  className="btn btn-sm btn-quiet btn-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${character.name} and ${sets.length} set${sets.length === 1 ? '' : 's'}?`,
                      )
                    ) {
                      deleteCharacter(character.id);
                    }
                  }}
                >
                  Delete character
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
