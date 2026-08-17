/**
 * "Import from game" — paste an `/outputfile inventory` export, see exactly
 * what will happen, then commit it.
 *
 * Building a character by hand costs about forty-six clicks and two hundred and
 * eighty keystrokes before a single upgrade tier is set. The client already
 * knows all of it. This dialog is the bridge, and its one design rule is that
 * **nothing is written until the reader has seen what would be written** — the
 * preview lists every matched position with its tier, every exaltation donor,
 * every name that could not be resolved, and every row deliberately skipped.
 *
 * The preview is the feature. An importer that says "imported!" and quietly
 * drops eleven items is worse than no importer at all, because the gap is
 * invisible until a raid night.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../data/catalog';
import {
  exaltationsByPosition,
  itemIdIndex,
  positionsInDollOrder,
  readInventory,
  summarizeIgnored,
  summarizeImport,
  type ImportedExaltation,
  type InventoryImport,
} from '../lib/inventoryImport';
import { Modal } from './Modal';
import './InventoryImportDialog.css';

export type ImportTarget = 'new' | 'current';

export interface InventoryImportDialogProps {
  /** Whose gear this is, for the confirmation line. */
  characterName?: string;
  /** The set the reader came from, when they came from one. */
  currentSetName?: string;
  /** Name the import would give a new set. */
  newSetName: string;
  onCancel: () => void;
  onImport: (result: InventoryImport, target: ImportTarget) => void;
}

export function InventoryImportDialog({
  characterName,
  currentSetName,
  newSetName,
  onCancel,
  onImport,
}: InventoryImportDialogProps) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [target, setTarget] = useState<ImportTarget>('new');
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useCatalog((s) => s.items);
  const byName = useCatalog((s) => s.byName);
  const catalogStatus = useCatalog((s) => s.status);
  const ensureAll = useCatalog((s) => s.ensureAll);

  /*
   * Every worn item in an export can come from any of the nineteen slot shards,
   * so the whole catalog has to be in memory before the preview can be trusted.
   * The index alone would resolve the names, but the paper doll behind this
   * dialog reads stats off the same records.
   */
  useEffect(() => {
    void ensureAll();
  }, [ensureAll]);

  const byId = useMemo(() => itemIdIndex(items), [items]);
  const result = useMemo(
    () => (text.trim() ? readInventory(text, { byName, byId }) : null),
    [text, byName, byId],
  );

  const donors = useMemo<Map<string, ImportedExaltation[]>>(
    () => (result ? exaltationsByPosition(result) : new Map()),
    [result],
  );
  const rows = useMemo(() => (result ? positionsInDollOrder(result) : []), [result]);
  const ignoredGroups = useMemo(() => (result ? summarizeIgnored(result.ignored) : []), [result]);

  const catalogReady = catalogStatus === 'ready';
  const canImport = Boolean(result?.recognized) && (result?.positions.length ?? 0) > 0;
  const renamed = result
    ? [...result.positions.filter((p) => p.renamedFrom), ...result.exaltations.filter((e) => e.renamedFrom)]
    : [];

  const onFile = async (file: File) => {
    setFileError(null);
    try {
      const body = await file.text();
      setText(body);
      setFileName(file.name);
    } catch (error) {
      setFileError(
        `That file could not be read (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  };

  return (
    <Modal
      title="Import from game"
      onClose={onCancel}
      width={900}
      footer={
        <>
          <span className="invimport-foot grow">
            {result?.recognized
              ? target === 'current' && currentSetName
                ? `Replaces every slot in "${currentSetName}".`
                : `Creates a new set called "${newSetName}"${
                    characterName ? ` on ${characterName}` : ''
                  }. Nothing you already have is changed.`
              : null}
          </span>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canImport}
            onClick={() => {
              if (result) onImport(result, target);
            }}
          >
            {canImport && result
              ? `Import ${result.positions.length} item${result.positions.length === 1 ? '' : 's'}`
              : 'Import'}
          </button>
        </>
      }
    >
      <div className="modal-body stack invimport">
        <section className="invimport-how">
          <p className="hint">
            In the game, type <code>/outputfile inventory</code>. The client writes a text file into
            your EverQuest folder listing everything you are wearing and carrying. Paste it below —
            or pick the file — and this reads your worn gear, its upgrade tiers and its exaltations
            straight out of it.
          </p>
          <p className="hint">
            Your bags, your bank and your keyring are <strong>not</strong> imported. They are a
            collection, not a set: the keyring alone holds gear for classes this character cannot
            wear, and equipping it would poison every list in the planner.
          </p>
        </section>

        <label className="field">
          <span>Paste the export</span>
          <textarea
            className="invimport-paste"
            rows={6}
            spellCheck={false}
            autoFocus
            value={text}
            placeholder={'Location\tName\tID\tCount\tSlots\nPrimary\tEarthshaker +10\t5667\t1\t10\n…'}
            onChange={(event) => {
              setText(event.target.value);
              setFileName(null);
              setFileError(null);
            }}
          />
        </label>

        <div className="rowline">
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            Choose a .txt file…
          </button>
          {/* The visible button opens this; the input itself must not be a tab
              stop, or a keyboard reader lands on an invisible unnamed control. */}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = '';
            }}
          />
          {text ? (
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              onClick={() => {
                setText('');
                setFileName(null);
                setFileError(null);
              }}
            >
              Clear
            </button>
          ) : null}
          <span className="grow" />
          {fileName ? <span className="hint">{fileName}</span> : null}
          {!catalogReady ? <span className="hint">Loading item data…</span> : null}
        </div>

        {fileError ? (
          <p className="hint bad" role="alert">
            {fileError}
          </p>
        ) : null}

        {result ? (
          <div className="invimport-preview" aria-live="polite">
            <p className={result.recognized ? 'invimport-summary' : 'hint bad'}>
              {summarizeImport(result)}
            </p>

            {result.notes.map((note) => (
              <p className="hint" key={note}>
                {note}
              </p>
            ))}

            {result.recognized ? (
              <div className="invimport-counts">
                <Count value={result.positions.length} label="worn items" tone="good" />
                <Count value={result.exaltations.length} label="exaltation donors" tone="good" />
                <Count
                  value={result.unmatched.length}
                  label="not matched"
                  tone={result.unmatched.length ? 'bad' : 'quiet'}
                />
                <Count value={result.ignored.length} label="rows skipped" tone="quiet" />
              </div>
            ) : null}

            {rows.length ? (
              <>
                <h3 className="section-label">What will be equipped</h3>
                <div className="invimport-tablewrap">
                  <table className="invimport-table">
                    <thead>
                      <tr>
                        <th scope="col">Position</th>
                        <th scope="col">Item</th>
                        <th scope="col" className="num">
                          Tier
                        </th>
                        <th scope="col">Exaltations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.positionId}>
                          <th scope="row">{row.positionLabel}</th>
                          <td>
                            {row.itemName}
                            {row.renamedFrom ? (
                              <span className="invimport-drift">
                                {' '}
                                — your client calls it {row.renamedFrom}
                              </span>
                            ) : null}
                          </td>
                          <td className="num invimport-tier">+{row.tier}</td>
                          <td className="invimport-donors">
                            {(donors.get(row.positionId) ?? [])
                              .map((d) => `${d.socketLabel.replace(' Exaltation', '')}: ${d.donorName}`)
                              .join(' · ') || <span className="dim">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {result.unmatched.length ? (
              <>
                <h3 className="section-label">Not imported — no such item in this catalog</h3>
                <ul className="invimport-list invimport-list-bad">
                  {result.unmatched.map((entry) => (
                    <li key={`${entry.line}-${entry.rawName}`}>
                      <strong>{entry.rawName}</strong>
                      {' — '}
                      {entry.positionLabel}
                      {entry.socketLabel ? ` · ${entry.socketLabel}` : ''}
                      {` · line ${entry.line} · ${entry.reason}`}
                    </li>
                  ))}
                </ul>
                <p className="hint">
                  These are left empty rather than guessed at. Some are genuinely absent from every
                  wiki catalog; the rest are spellings the wiki records differently. Either way,
                  swapping in a plausible substitute would be worse than the gap.
                </p>
              </>
            ) : null}

            {renamed.length ? (
              <>
                <h3 className="section-label">Matched by item id, under another spelling</h3>
                <ul className="invimport-list">
                  {renamed.map((entry) => (
                    <li key={`${entry.line}-${entry.exportName}`}>
                      <strong>{entry.renamedFrom}</strong> in your client is{' '}
                      <strong>
                        {'itemName' in entry ? entry.itemName : entry.donorName}
                      </strong>{' '}
                      in the catalog — joined on item id {entry.exportId}, not on the name.
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {ignoredGroups.length ? (
              <>
                <h3 className="section-label">Not imported — your collection, not your gear</h3>
                <ul className="invimport-list">
                  {ignoredGroups.map((group) => (
                    <li key={group.key}>
                      <strong>{group.label}</strong>: {group.rows} row
                      {group.rows === 1 ? '' : 's'}, {group.distinct} distinct item
                      {group.distinct === 1 ? '' : 's'}
                      {group.sample.length ? (
                        <span className="dim"> — {group.sample.join(', ')}…</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {result?.recognized && currentSetName ? (
          <fieldset className="invimport-target">
            <legend className="section-label">Where it goes</legend>
            <label className="invimport-radio">
              <input
                type="radio"
                name="invimport-target"
                checked={target === 'new'}
                onChange={() => setTarget('new')}
              />
              <span>
                <strong>Into a new set</strong>
                <span className="hint"> — "{newSetName}", leaving everything else alone.</span>
              </span>
            </label>
            <label className="invimport-radio">
              <input
                type="radio"
                name="invimport-target"
                checked={target === 'current'}
                onChange={() => setTarget('current')}
              />
              <span>
                <strong>Replace "{currentSetName}"</strong>
                <span className="hint">
                  {' '}
                  — every slot in it is cleared first, including any this export leaves empty.
                </span>
              </span>
            </label>
          </fieldset>
        ) : null}
      </div>
    </Modal>
  );
}

function Count({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: 'good' | 'bad' | 'quiet';
}) {
  return (
    <div className={`invimport-count is-${tone}`}>
      <span className="invimport-count-value num">{value}</span>
      <span className="invimport-count-label">{label}</span>
    </div>
  );
}
