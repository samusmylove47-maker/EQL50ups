import { useMemo, useState } from 'react';
import type { Character } from '../engine/character';
import type { GearSet } from '../engine/types';
import { SetWorkspace } from '../components/SetWorkspace';
import { useCatalog } from '../data/catalog';
import { shareDictionary } from '../data/shareDictionary';
import { href, navigate, type SetTab } from '../router';
import { decodePlanDetailed } from '../share/codec';
import { useApp } from '../state/store';

/** A share link reconstructs a set read-only, with one action: save a copy. */
export function SharedSet({ payload }: { payload: string }) {
  const adoptPlan = useApp((s) => s.adoptPlan);
  const catalog = useCatalog();
  const [tab, setTab] = useState<SetTab>('gear');

  /*
   * Short links intern their item names against the shipped catalog, so the
   * decode has to wait for it. `catalog.status` is in the dependency list on
   * purpose: decoding before the index lands would report a mismatch on a
   * perfectly good link.
   */
  const dictionary = shareDictionary(catalog);
  const result = useMemo(
    () => decodePlanDetailed(payload, dictionary),
    [payload, dictionary],
  );
  const plan = result.plan;

  const pair = useMemo(() => {
    if (!plan) return null;
    const character: Character = { id: 'shared', ...plan.character };
    const gearSet: GearSet = {
      id: 'shared',
      characterId: 'shared',
      name: plan.set.name,
      slots: plan.set.slots,
      weights: plan.set.weights,
      createdAt: 0,
      updatedAt: 0,
      ...(plan.set.notes ? { notes: plan.set.notes } : {}),
    };
    return { character, gearSet };
  }, [plan]);

  if (!plan || !pair) {
    const loading = catalog.status === 'idle' || catalog.status === 'loading';
    if (loading) {
      return (
        <div className="empty-state">
          <h2>Opening shared set…</h2>
          <p>Reading the link against the item catalog.</p>
        </div>
      );
    }

    /*
     * The catalog is what is broken here, not the link — so this is a separate
     * screen, not a variant sentence under "That link could not be read".
     *
     * Short links intern item names against the shipped catalog to keep a
     * 23-slot set inside a pasteable URL, so a reader whose catalog did not
     * load cannot resolve them. Every failure on this path has *already* had
     * its checksum verified — `decodePlanDetailed` only reaches the v3 body
     * decode after `checksum16(body) === carried` — so "the link arrived
     * intact" is a checked fact and not a reassurance.
     *
     * What that rules out is the advice this screen used to give: a fresh link
     * from the sender would be interned against the very catalog this reader
     * still cannot fetch, and would fail in exactly the same way. The action
     * that can work is retrying the load, so that is the action offered.
     */
    if (result.failure === 'catalog-unavailable') {
      return (
        <div className="empty-state">
          <h2>The item catalog did not load</h2>
          <p>
            The link arrived intact — its checksum matches. But a short link stores its items as
            positions in the item catalog, and this browser has not been able to fetch that
            catalog, so there is nothing to look them up in. Nothing is wrong with the link, and a
            new one from whoever sent it would run into exactly the same thing.
          </p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={() => void catalog.load()}>
              Try again
            </button>
            <a className="btn" href={href.landing}>
              Go to the planner
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="empty-state">
        <h2>That link could not be read</h2>
        {/*
          Each failure says what actually happened, because a blank result or a
          silently empty set reproduces the fault the refusal exists to prevent:
          the reader acts on a plan that is not the one that was shared.

          `unverifiable` is the loud half of refusing v2. It is not a damaged
          link — it is a well-formed one written in a format that carries no
          checksum, so nothing about it can be confirmed. Saying "damaged" there
          would send the holder back to the sender for a link that is not broken,
          and saying nothing would look like the planner had failed.
        */}
        <p>
          {result.failure === 'catalog-mismatch'
            ? 'This link was made against a different build of the item catalog, so its item references no longer line up. Ask for a fresh link.'
            : result.failure === 'unverifiable'
              ? 'This link uses an old share format that carried no checksum, so there is no way to confirm it still says what its author meant. It is refused rather than opened: a link damaged in transit used to decode into a different, plausible-looking plan with a slot quietly emptied, and acting on that is worse than being told no. No version of this planner that has ever been published writes this format, so a link in this shape did not come from the live site — if someone sent you one, ask them to open their set here and share a fresh link.'
              : 'The share payload is missing or damaged — chat clients sometimes truncate long links. Ask for the link again, making sure everything after #/share/ is included.'}
        </p>
        <div className="empty-actions">
          <a className="btn btn-primary" href={href.landing}>
            Go to the planner
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="notice" role="status">
        <span>
          <strong>Shared set.</strong> This is someone else's plan, opened read-only. Save a copy to
          edit it in your own library.
        </span>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            const created = adoptPlan(plan);
            navigate(href.set(created.setId));
          }}
        >
          Save a copy
        </button>
      </div>

      <SetWorkspace
        character={pair.character}
        gearSet={pair.gearSet}
        tab={tab}
        onTabChange={setTab}
        readOnly
        onEquip={() => undefined}
        onUnequip={() => undefined}
        onUpgrade={() => undefined}
        onSetDonor={() => undefined}
        onWeights={() => undefined}
      />
    </div>
  );
}
