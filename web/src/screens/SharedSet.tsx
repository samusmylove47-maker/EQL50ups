import { useMemo, useState } from 'react';
import type { Character } from '../engine/character';
import type { GearSet } from '../engine/types';
import { SetWorkspace } from '../components/SetWorkspace';
import { href, navigate, type SetTab } from '../router';
import { decodePlan } from '../share/codec';
import { useApp } from '../state/store';

/** A share link reconstructs a set read-only, with one action: save a copy. */
export function SharedSet({ payload }: { payload: string }) {
  const adoptPlan = useApp((s) => s.adoptPlan);
  const [tab, setTab] = useState<SetTab>('gear');
  const plan = useMemo(() => decodePlan(payload), [payload]);

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
    return (
      <div className="empty-state">
        <h2>That link could not be read</h2>
        <p>
          The share payload is missing or damaged — chat clients sometimes truncate long links. Ask
          for the link again, making sure everything after <code>#/share/</code> is included.
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
