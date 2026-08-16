import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../data/catalog';
import type { WeightProfile } from '../engine/ep';
import type { Item } from '../engine/types';
import type { UpgradeState } from '../engine/upgrade';
import { Modal } from '../components/Modal';
import { SetWorkspace } from '../components/SetWorkspace';
import { href, navigate, type SetTab } from '../router';
import { planFrom, shareUrl } from '../share/codec';
import { characterFor, setsForCharacter, useApp } from '../state/store';
import { autoFill, slotViews } from '../selectors/gear';
import { activeContext, activeLoadout, describeLoadout } from '../engine/character';
import { shareDictionary } from '../data/shareDictionary';

export function SetEditor({ id, tab }: { id: string; tab: SetTab }) {
  const state = useApp();
  const gearSet = state.sets.find((s) => s.id === id);
  const character = characterFor(state, gearSet);
  const catalog = useCatalog();
  const ensureAll = useCatalog((s) => s.ensureAll);

  const [dialog, setDialog] = useState<'share' | 'edit' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');

  useEffect(() => {
    setMessage(null);
  }, [id]);

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
      await ensureAll();
      const fresh = useCatalog.getState();
      const views = slotViews(gearSet, fresh);
      const result = autoFill(fresh, views, character ? activeContext(character) : undefined, gearSet.weights, {
        includeUnreleased: false,
        keepFilled,
      });
      for (const entry of result.assigned) {
        state.equip(gearSet.id, entry.position, entry.itemName);
      }
      const openSlots = views.length - Object.keys(gearSet.slots).length;
      setMessage(
        result.assigned.length
          ? `Auto-fill placed ${result.assigned.length} item${result.assigned.length === 1 ? '' : 's'}${
              result.skipped.length ? `; nothing scored above zero for ${result.skipped.join(', ')}.` : '.'
            }`
          : keepFilled && openSlots === 0
            ? 'Every slot is already filled. Run Auto-fill again and confirm to replace what is equipped.'
            : 'Auto-fill found nothing to place — check that item data is loaded and your weights are not all zero.',
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

  return (
    <div>
      {/* The notice used to have no dismiss and shifted the whole page down 60px
          until you navigated away. */}
      {message ? (
        <div className="notice" role="status">
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
                <button
                  type="button"
                  key={sibling.id}
                  className="menu-item"
                  aria-current={sibling.id === gearSet.id}
                  onClick={() => navigate(href.set(sibling.id, tab))}
                >
                  {sibling.name}
                </button>
              ))}
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  const created = state.createSet(gearSet.characterId);
                  navigate(href.set(created.id));
                }}
              >
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
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                setDraftName(gearSet.name);
                setDraftNotes(gearSet.notes ?? '');
                setDialog('edit');
              }}
            >
              ⚙ Edit
            </button>
            <details className="menu">
              <summary className="btn btn-quiet btn-sm" aria-label="More set actions">
                ⋯
              </summary>
              <div className="menu-body right">
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
          </div>
        </Modal>
      ) : null}

      {dialog === 'edit' ? (
        <Modal
          title="Edit set"
          onClose={() => setDialog(null)}
          width={560}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  state.renameSet(gearSet.id, draftName);
                  state.setNotes(gearSet.id, draftNotes);
                  setDialog(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <div className="modal-body stack">
            <label className="field">
              <span>Set name</span>
              <input
                type="text"
                value={draftName}
                autoFocus
                maxLength={80}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={4}
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="What this set is for, what you are still hunting…"
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
