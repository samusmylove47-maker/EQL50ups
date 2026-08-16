/**
 * The stat panel, laid out to match the in-game Stats window (UI-REFERENCE
 * §B3): Vitals, Regen, Stats with `/510` caps, Resists with `/1000` caps
 * including Void, Heroic Mods with their caps, Spell Mods, Skill Damage Mod.
 *
 * Two rules are absolute here. Values at their ceiling are flagged, because
 * the client shows caps natively and sixtyupgrades users complain about their
 * absence. And nothing may ever render `NaN` — every number goes through the
 * formatters in `lib/format`, which coerce non-finite input to zero.
 *
 * Totals are gear-only: race and class base attributes are not shipped,
 * because the one source for them self-reports as unverified.
 */

import { useState } from 'react';
import {
  ATTRIBUTES,
  ATTRIBUTE_CAP,
  ATTRIBUTE_NAMES,
  HEROIC_MODS,
  RESIST_CAP,
  SAVES,
  SAVE_NAMES,
  SKILL_DAMAGE_MODS,
  SPELL_MODS,
} from '../engine/constants';
import { withCap, type StatTotals } from '../engine/stats';
import { dec, finite, num } from '../lib/format';
import { ratioText } from '../selectors/gear';

interface RowProps {
  label: string;
  value: number;
  cap?: number;
  suffix?: string;
}

function StatRow({ label, value, cap, suffix }: RowProps) {
  const raw = finite(value);
  const capped = cap !== undefined ? withCap(raw, cap) : null;
  const shown = capped ? capped.value : raw;
  const className = [
    'stat-row',
    shown === 0 ? 'zero' : '',
    capped?.atCap ? 'at-cap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <span className="k">{label}</span>
      <span className="v">
        {num(shown)}
        {suffix ?? ''}
        {capped ? <span className="cap">/{num(capped.cap)}</span> : null}
        {capped && capped.overCap > 0 ? (
          <span className="over" title="Points above the cap, wasted">
            +{num(capped.overCap)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function Group({
  title,
  children,
  defaultOpen = true,
  note,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  note?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="stat-group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="section-label">{title}</span>
        {note ? <span className="hint" style={{ marginLeft: 'auto' }}>{note}</span> : null}
      </summary>
      <div className="stat-grid">{children}</div>
    </details>
  );
}

export function StatPanel({ totals }: { totals: StatTotals }) {
  const { primary, secondary } = totals.weapons;

  return (
    <div className="stats">
      <div className="vitals">
        <div className="vital">
          <div className="k">HP</div>
          <div className="v">{num(totals.hp)}</div>
          <div className="sub">from gear</div>
        </div>
        <div className="vital">
          <div className="k">Mana</div>
          <div className="v">{num(totals.mana)}</div>
          <div className="sub">from gear</div>
        </div>
        <div className="vital">
          <div className="k">AC</div>
          <div className="v">{num(totals.ac)}</div>
          <div className="sub">from gear</div>
        </div>
        <div className="vital">
          <div className="k">Haste</div>
          <div className="v">{num(totals.haste)}%</div>
          <div className="sub">best worn</div>
        </div>
        <div className="vital">
          <div className="k">Weight</div>
          <div className="v">{dec(totals.weight, 1)}</div>
          <div className="sub">equipped</div>
        </div>
      </div>

      <Group title="Vitals">
        <StatRow label="Hit Points" value={totals.hp} />
        <StatRow label="Mana" value={totals.mana} />
        <StatRow label="Endurance" value={totals.endurance} />
        <StatRow label="AC" value={totals.ac} />
        <StatRow label="Attack Speed" value={totals.haste} suffix="%" />
        <StatRow label="Equipped Weight" value={Math.round(totals.weight * 10) / 10} />
      </Group>

      <Group title="Weapons" defaultOpen={Boolean(primary || secondary)}>
        <div className="stat-row">
          <span className="k">Primary</span>
          <span className={primary ? 'v' : 'v dim'}>
            {primary ? `${num(primary.damage)}/${num(primary.delay)}` : '—'}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Primary Ratio</span>
          <span className={primary ? 'v' : 'v dim'}>
            {primary ? ratioText(primary.damage, primary.delay) : '—'}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Secondary</span>
          <span className={secondary ? 'v' : 'v dim'}>
            {secondary ? `${num(secondary.damage)}/${num(secondary.delay)}` : '—'}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Secondary Ratio</span>
          <span className={secondary ? 'v' : 'v dim'}>
            {secondary ? ratioText(secondary.damage, secondary.delay) : '—'}
          </span>
        </div>
      </Group>

      <Group title="Regen">
        <StatRow label="Combat HP Regen" value={totals.hpRegen} />
        <StatRow label="Combat Mana Regen" value={totals.manaRegen} />
        <StatRow label="Combat End Regen" value={totals.endRegen} />
      </Group>

      <Group title="Stats" note="gear only">
        {ATTRIBUTES.map((attr) => (
          <StatRow
            key={attr}
            label={ATTRIBUTE_NAMES[attr]}
            value={totals.attributes[attr]}
            cap={ATTRIBUTE_CAP}
          />
        ))}
      </Group>

      <Group title="Resists" note="gear only">
        {SAVES.map((save) => (
          <StatRow key={save} label={SAVE_NAMES[save]} value={totals.saves[save]} cap={RESIST_CAP} />
        ))}
      </Group>

      <Group title="Heroic Mods" defaultOpen={false} note="no item grants these yet">
        {HEROIC_MODS.map((mod) => (
          <StatRow key={mod.key} label={mod.label} value={totals.heroic[mod.key] ?? 0} cap={mod.cap} />
        ))}
      </Group>

      <Group title="Spell Mods" defaultOpen={false}>
        {SPELL_MODS.map((mod) => (
          <StatRow key={mod.key} label={mod.label} value={totals.spellMods[mod.key] ?? 0} />
        ))}
      </Group>

      <Group title="Skill Damage Mod" defaultOpen={false}>
        {SKILL_DAMAGE_MODS.map((mod) => (
          <StatRow
            key={mod.key}
            label={mod.label}
            value={totals.skillMods[mod.key] ?? 0}
            cap={mod.cap}
          />
        ))}
      </Group>
    </div>
  );
}
