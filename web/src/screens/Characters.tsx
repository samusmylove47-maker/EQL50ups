import { useEffect, useRef, useState } from 'react';
import { activeRace, describeCharacter } from '../engine/character';
import { href, navigate } from '../router';
import { DEFAULT_WEIGHTS, setsForCharacter, useApp } from '../state/store';
import { SetConfigDialog, type SetConfigValue } from '../components/SetConfigDialog';
import { downloadJson } from '../lib/download';
import { describeFilters, filtersFor } from '../lib/setFilters';
import {
  buildSetEnvelope, readEnvelopeText, setExportFilename, summarizeReport,
  type EnvelopeReport,
} from '../lib/setExport';
import './Characters.css';

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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [report, setReport] = useState<EnvelopeReport | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  /*
   * This screen is where `Delete set` and `Delete character` land, and both
   * destroy the control that was pressed, so a keyboard user arrives with focus
   * on `<body>` and has to re-traverse the document to get anywhere. Only when
   * focus is genuinely nowhere: arriving by nav link or by a link in a card
   * leaves focus on that control, and stealing it would be worse than the bug.
   */
  useEffect(() => {
    if (document.activeElement === document.body) {
      titleRef.current?.focus({ preventScroll: true });
    }
  }, []);

  /*
   * Deleting a *set* destroys only one row of one card, so the page title is
   * the wrong landing place — a reader pruning three sets would be thrown back
   * to the top of the document twice. The row's neighbour is where the list
   * carries on, and every candidate below outlives the re-render that drops the
   * row, so focus can be handed over in the click itself.
   */
  const landings = useRef(new Map<string, HTMLButtonElement>());
  const landing = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) landings.current.set(key, el);
    else landings.current.delete(key);
  };

  /**
   * Import reports what it dropped rather than failing silently. A file that is
   * ours but carries junk imports the good part and lists the rest; a file that
   * is not ours at all says which of the two it is.
   */
  const onImport = async (file: File) => {
    const result = readEnvelopeText(await file.text());
    if (result.ok && result.envelope) importEnvelope(result.envelope);
    setReport(result);
  };

  return (
    <div>
      <div className="page-head">
        {/* `tabIndex={-1}` so the page has a landing point for focus after a
            destruction, without becoming a tab stop of its own. */}
        <h1 className="page-title" tabIndex={-1} ref={titleRef}>
          Characters
        </h1>
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

      {report ? (
        <div className={`notice${report.ok ? '' : ' notice-warn'}`} role="status">
          <span className="grow">
            {summarizeReport(report)}
            {report.rejected.length ? (
              <ul className="import-rejects">
                {report.rejected.slice(0, 12).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {report.rejected.length > 12 ? (
                  <li>…and {report.rejected.length - 12} more.</li>
                ) : null}
              </ul>
            ) : null}
          </span>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            aria-label="Dismiss this message"
            onClick={() => setReport(null)}
          >
            <span aria-hidden="true">✕</span>
          </button>
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
                {sets.map((gearSet, index) => (
                  <li className="set-line" key={gearSet.id}>
                    <div className="grow">
                      <a href={href.set(gearSet.id)}>{gearSet.name}</a>
                      <div className="meta">
                        {Object.keys(gearSet.slots).length} equipped · edited{' '}
                        {new Date(gearSet.updatedAt).toLocaleDateString()}
                        {/* A set's own filter lens, shown only when it is not
                            the default — otherwise every card repeats the same
                            three words and none of them mean anything. */}
                        {gearSet.defaultFilters
                          ? ` · filters: ${describeFilters(filtersFor(gearSet))}`
                          : ''}
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
                        title="Download this one set as JSON"
                        onClick={() =>
                          downloadJson(
                            setExportFilename(gearSet),
                            buildSetEnvelope(gearSet, character),
                          )
                        }
                      >
                        Export
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
                        ref={landing(`set:${gearSet.id}`)}
                        onClick={() => {
                          if (!window.confirm(`Delete set "${gearSet.name}"?`)) return;
                          // The row below, the row above once this is the last
                          // one, and New set when the card runs out of sets.
                          const neighbour = sets[index + 1] ?? sets[index - 1];
                          const next = landings.current.get(
                            neighbour ? `set:${neighbour.id}` : `new:${character.id}`,
                          );
                          deleteSet(gearSet.id);
                          next?.focus({ preventScroll: true });
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
                  ref={landing(`new:${character.id}`)}
                  onClick={() => setCreatingFor(character.id)}
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
                      // The card carrying this button is about to unmount.
                      titleRef.current?.focus({ preventScroll: true });
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

      {/*
        The same dialog the set screen uses. §A4: name, scoring lens and default
        filters are chosen when the set is made, not discovered in a tab later.
      */}
      {creatingFor ? (
        <SetConfigDialog
          mode="create"
          initial={{ weights: DEFAULT_WEIGHTS }}
          siblingNames={setsForCharacter(state, creatingFor).map((s) => s.name)}
          onCancel={() => setCreatingFor(null)}
          onSubmit={(value: SetConfigValue) => {
            const created = createSet(creatingFor, value.name, value.weights, {
              notes: value.notes,
              filters: value.filters,
            });
            setCreatingFor(null);
            navigate(href.set(created.id));
          }}
        />
      ) : null}
    </div>
  );
}
