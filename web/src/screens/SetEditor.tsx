import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../data/catalog';
import type { WeightProfile } from '../engine/ep';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { Modal } from '../components/Modal';
import { SetConfigDialog, type SetConfigValue } from '../components/SetConfigDialog';
import { SetWorkspace } from '../components/SetWorkspace';
import { href, navigate, type SetTab } from '../router';
import { planFrom, shareUrl } from '../share/codec';
import { characterFor, setsForCharacter, useApp } from '../state/store';
import { downloadJson } from '../lib/download';
import { publishPickerDefaults, resetPickerDefaults } from '../lib/pickerDefaults';
import { filtersFor } from '../lib/setFilters';
import {
  buildSetEnvelope, readEnvelopeText, setExportFilename, summarizeReport,
  type EnvelopeReport,
} from '../lib/setExport';
import './SetEditor.css';
import { autoFillSteps, describeAutoFill, slotViews } from '../selectors/gear';
import { nextFrame, runSliced } from '../lib/frames';
import { activeContext, activeLoadout, describeLoadout } from '../engine/character';
import { shareDictionary } from '../data/shareDictionary';

export function SetEditor({ id, tab }: { id: string; tab: SetTab }) {
  const state = useApp();
  const gearSet = state.sets.find((s) => s.id === id);
  const character = characterFor(state, gearSet);
  const catalog = useCatalog();
  const ensureAll = useCatalog((s) => s.ensureAll);

  const [dialog, setDialog] = useState<'share' | 'edit' | 'create' | 'import' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [noticeHeld, setNoticeHeld] = useState(false);
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<EnvelopeReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const restoreMenuFocus = useRef(false);

  useEffect(() => {
    setMessage(null);
  }, [id]);

  /*
   * The notice clears itself. It used to have no timer at all and was still
   * on screen after 11.5 seconds in three separate sessions, so the one
   * transient message in the app behaved like a permanent banner. Reading is
   * the reason to keep it, so pointer or keyboard inside the toast holds it
   * open indefinitely and the countdown restarts when they leave.
   */
  useEffect(() => {
    if (!message || noticeHeld) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message, noticeHeld]);

  /*
   * `Clear all slots` lives in a `<details>` menu that closes on selection, so
   * the button that was clicked is display:none by the time the state update
   * lands and focus falls to `<body>`. The summary is the survivor and the
   * place the reader came from, so that is where focus goes back to.
   */
  useEffect(() => {
    if (!restoreMenuFocus.current) return;
    restoreMenuFocus.current = false;
    menuRef.current?.querySelector('summary')?.focus();
  });

  const filters = filtersFor(gearSet);

  /*
   * Publish this set's default filters for the pickers opened from it. §A4's
   * lesson is that a set carries its own lens; these three fields are the
   * filter half of that lens, and they have to be in place before the first
   * picker opens.
   */
  const { era: filterEra, source: filterSource, hideNoDrop: filterHideNoDrop } = filters;
  useEffect(() => {
    publishPickerDefaults({ era: filterEra, source: filterSource, hideNoDrop: filterHideNoDrop });
    return () => resetPickerDefaults();
  }, [filterEra, filterSource, filterHideNoDrop]);

  const siblings = useMemo(
    () => setsForCharacter(state, gearSet?.characterId ?? null),
    [state, gearSet?.characterId],
  );

  // Interning item names against the loaded catalog is what keeps the link
  // short; without a catalog it silently falls back to literal names.
  const dictionary = shareDictionary(catalog);
  const link = useMemo(
    () => (gearSet && character ? shareUrl(planFrom(character, gearSet), dictionary) : ''),
    [gearSet, character, dictionary],
  );

  const onImportFile = async (file: File) => {
    const result = readEnvelopeText(await file.text());
    setReport(result);
    setDialog('import');
    if (!result.ok || !result.envelope) return;
    const before = useApp.getState().sets.length;
    state.importEnvelope(result.envelope);
    const after = useApp.getState().sets;
    const landed = after[after.length - 1];
    // Land on what was just imported: an import you cannot see is an import you
    // have to go looking for.
    if (after.length > before && landed) navigate(href.set(landed.id));
  };

  if (!gearSet) {
    return (
      <div className="empty-state">
        <h2>Set not found</h2>
        <p>
          This set is not in this browser's library. If you followed a share link, it may have been
          truncated — share links live under <code>#/share/…</code>.
        </p>
        <div className="empty-actions">
          <a className="btn btn-primary" href={href.characters}>
            Your characters
          </a>
        </div>
      </div>
    );
  }

  const runAutoFill = async () => {
    const filled = Object.keys(gearSet.slots).length;
    // Replacing hand-picked gear without asking would be rude.
    const keepFilled =
      filled > 0 &&
      !window.confirm(
        `Replace all ${filled} equipped item${filled === 1 ? '' : 's'}? Cancel to fill only the empty slots.`,
      );
    setBusy(true);
    setMessage(null);
    try {
      // The busy state has to reach the screen before the work starts. Without
      // this frame React commits it and the fill blocks the same frame, so the
      // button sat unchanged and enabled through the whole freeze.
      await nextFrame();
      await ensureAll();
      const fresh = useCatalog.getState();
      const views = slotViews(gearSet, fresh);
      const result = await runSliced(
        autoFillSteps(fresh, views, character ? activeContext(character) : undefined, gearSet.weights, {
          includeUnreleased: false,
          keepFilled,
          // The same filters the pickers open with. Without them Auto-fill drew
          // from a pool this set's own pickers refuse to offer.
          filters,
        }),
      );
      for (const entry of result.assigned) {
        state.equip(gearSet.id, entry.position, entry.itemName);
      }
      const openSlots = views.length - Object.keys(gearSet.slots).length;
      setMessage(
        !result.assigned.length && keepFilled && openSlots === 0
          ? 'Every slot is already filled. Run Auto-fill again and confirm to replace what is equipped.'
          : describeAutoFill(result),
      );
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const compareTargets = siblings.filter((sibling) => sibling.id !== gearSet.id);

  return (
    <div>
      {message ? (
        <div
          className="notice notice-toast"
          role="status"
          onMouseEnter={() => setNoticeHeld(true)}
          onMouseLeave={() => setNoticeHeld(false)}
          onFocusCapture={() => setNoticeHeld(true)}
          onBlurCapture={() => setNoticeHeld(false)}
        >
          <span className="grow">{message}</span>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            aria-label="Dismiss this message"
            onClick={() => setMessage(null)}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ) : null}

      <SetWorkspace
        character={character}
        gearSet={gearSet}
        tab={tab}
        onTabChange={(next) => navigate(href.set(gearSet.id, next))}
        setSwitcher={
          <details className="menu">
            <summary className="set-switch" aria-label="Switch set">
              <span className="name">{gearSet.name}</span>
              <span aria-hidden="true">▾</span>
            </summary>
            <div className="menu-body">
              {siblings.map((sibling) => (
                /*
                 * Two actions per sibling: open it, or diff against it. The
                 * switcher is where a player already goes to hold two sets in
                 * mind, so it is the cheapest place to offer the comparison —
                 * and switching used to replace the page, leaving the reader to
                 * carry forty numbers across in their head.
                 */
                <div className="setmenu-row" key={sibling.id}>
                  <button
                    type="button"
                    className="menu-item grow"
                    aria-current={sibling.id === gearSet.id}
                    onClick={() => navigate(href.set(sibling.id, tab))}
                  >
                    {sibling.name}
                  </button>
                  {sibling.id === gearSet.id ? null : (
                    <button
                      type="button"
                      className="setmenu-compare"
                      title={`Compare ${gearSet.name} with ${sibling.name}`}
                      aria-label={`Compare ${gearSet.name} with ${sibling.name}`}
                      onClick={() => navigate(href.compare(gearSet.id, sibling.id))}
                    >
                      <span aria-hidden="true">⇄</span>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="menu-item" onClick={() => setDialog('create')}>
                + New set
              </button>
            </div>
          </details>
        }
        actions={
          <>
            {character && character.loadouts.length ? (
              <details className="menu">
                <summary className="btn btn-quiet btn-sm" aria-label="Switch loadout">
                  {describeLoadout(character, activeLoadout(character) ?? character.loadouts[0]!)}
                </summary>
                <div className="menu-body right">
                  {character.loadouts.map((loadout) => (
                    <button
                      type="button"
                      key={loadout.id}
                      className="menu-item"
                      aria-current={loadout.id === character.activeLoadoutId}
                      onClick={() => state.setActiveLoadout(character.id, loadout.id)}
                    >
                      {loadout.name} — {describeLoadout(character, loadout)}
                    </button>
                  ))}
                  <a className="menu-item" href={href.character(character.id)}>
                    Manage loadouts &amp; levels…
                  </a>
                </div>
              </details>
            ) : null}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                setDialog('share');
                setCopied(false);
              }}
            >
              🔗 Share
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => void runAutoFill()}
              disabled={busy || catalog.status === 'missing' || catalog.status === 'error'}
              // Three signals, not one: the control refuses a second press, the
              // label says what is happening, and assistive tech is told the
              // region is busy rather than finished and empty.
              aria-busy={busy}
              title={
                catalog.status === 'missing'
                  ? 'No item data published yet'
                  : catalog.status === 'error'
                    ? 'Item data could not be loaded'
                    : 'Fill every empty slot with the best scoring item'
              }
            >
              {busy ? '… Filling' : '✦ Auto-fill'}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setDialog('edit')}>
              ⚙ Edit
            </button>
            <details className="menu" ref={menuRef}>
              <summary className="btn btn-quiet btn-sm" aria-label="More set actions">
                ⋯
              </summary>
              <div className="menu-body right">
                <button
                  type="button"
                  className="menu-item"
                  onClick={() =>
                    navigate(
                      // One sibling: go straight to the diff. Several: ask which.
                      href.compare(
                        gearSet.id,
                        compareTargets.length === 1 ? compareTargets[0]?.id : undefined,
                      ),
                    )
                  }
                >
                  Compare with…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() =>
                    downloadJson(setExportFilename(gearSet), buildSetEnvelope(gearSet, character))
                  }
                >
                  Export this set (JSON)
                </button>
                <button type="button" className="menu-item" onClick={() => fileRef.current?.click()}>
                  Import a set (JSON)…
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    const copy = state.duplicateSet(gearSet.id);
                    if (copy) navigate(href.set(copy.id));
                  }}
                >
                  Duplicate set
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    restoreMenuFocus.current = true;
                    for (const view of slotViews(gearSet, catalog)) {
                      if (view.equipped) state.unequip(gearSet.id, view.position.id);
                    }
                  }}
                >
                  Clear all slots
                </button>
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={() => {
                    if (window.confirm(`Delete set "${gearSet.name}"?`)) {
                      state.deleteSet(gearSet.id);
                      navigate(href.characters);
                    }
                  }}
                >
                  Delete set
                </button>
              </div>
            </details>
            {/*
              The visible menu entry opens this, so the input itself must not be
              a tab stop: a keyboard user would otherwise land on an invisible,
              unnamed control in the middle of the tab row.
            */}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImportFile(file);
                event.target.value = '';
              }}
            />
          </>
        }
        onEquip={(position: string, item: Item, upgrade: UpgradeState) =>
          state.equip(gearSet.id, position, item.n, upgrade)
        }
        onUnequip={(position: string) => state.unequip(gearSet.id, position)}
        onUpgrade={(position: string, next: UpgradeState) =>
          state.setUpgrade(gearSet.id, position, next)
        }
        onSetDonor={(position: string, kind: string, donor: string | null) =>
          state.setExaltation(gearSet.id, position, kind, donor)
        }
        onWeights={(weights: WeightProfile) => state.setWeights(gearSet.id, weights)}
      />

      {dialog === 'share' ? (
        <Modal title="Share this set" onClose={() => setDialog(null)} width={720}>
          <div className="modal-body stack">
            <p className="hint">
              The whole plan travels in the link — every item, every +N, exaltation donors, your
              per-class levels and every loadout. No account, no server, nothing to expire.
              {dictionary
                ? ' Item names are interned against this build of the item catalog, which is what keeps it short.'
                : ' Item data has not loaded, so names travel in full and the link is longer than it needs to be.'}
            </p>
            <div className="copy-field">
              <input type="text" readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void copyLink()}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {link.length > 900 ? (
              <p className="hint">
                {link.length} characters — long enough that some chat clients will wrap or truncate
                it. Paste it as a link, not as text.
              </p>
            ) : null}
            <p className="hint">
              For a file rather than a link — one a sim, a spreadsheet or a bot can read — use{' '}
              <strong>Export this set (JSON)</strong> in the ⋯ menu.
            </p>
          </div>
        </Modal>
      ) : null}

      {/*
        One configuration surface for both verbs. A creation path with no
        options beside an edit path with two fields is two half-dialogs; §A4's
        lesson is that the scoring lens is chosen when the set is made.
      */}
      {dialog === 'edit' ? (
        <SetConfigDialog
          mode="edit"
          initial={{
            name: gearSet.name,
            notes: gearSet.notes ?? '',
            weights: gearSet.weights,
            filters,
          }}
          siblingNames={compareTargets.map((s) => s.name)}
          onCancel={() => setDialog(null)}
          onSubmit={(value: SetConfigValue) => {
            state.configureSet(gearSet.id, value);
            setDialog(null);
          }}
        />
      ) : null}

      {dialog === 'create' ? (
        <SetConfigDialog
          mode="create"
          initial={{ weights: gearSet.weights, filters }}
          siblingNames={siblings.map((s) => s.name)}
          onCancel={() => setDialog(null)}
          onSubmit={(value: SetConfigValue) => {
            const created = state.createSet(gearSet.characterId, value.name, value.weights, {
              notes: value.notes,
              filters: value.filters,
            });
            setDialog(null);
            navigate(href.set(created.id));
          }}
        />
      ) : null}

      {dialog === 'import' && report ? (
        <Modal
          title={report.ok ? 'Set imported' : 'That file could not be imported'}
          onClose={() => setDialog(null)}
          width={620}
          footer={
            <button type="button" className="btn btn-primary" onClick={() => setDialog(null)}>
              Close
            </button>
          }
        >
          <div className="modal-body stack">
            <p>{summarizeReport(report)}</p>
            {report.rejected.length ? (
              <>
                <h3 className="section-label">What could not be used</h3>
                <ul className="import-rejects">
                  {report.rejected.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {report.ok ? (
              <p className="hint">
                Imported characters and sets are given fresh ids, so importing the same file twice
                gives you two copies rather than overwriting anything.
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
