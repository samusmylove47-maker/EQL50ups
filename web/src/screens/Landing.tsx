/**
 * Landing page.
 *
 * The previous version left 447px of black — 45% of the first screen — with no
 * product imagery of any kind: a gear planner whose front page showed no gear.
 * The hero now runs two columns, and the right one is the actual product: the
 * equipment figure from the gear page, drawn from the same glyphs, with the
 * item-name colour rule demonstrated on it.
 *
 * Blue was also doing five jobs at once (wordmark, two headline words, nav
 * pill, primary button, four card headings). §A6 reserves one azure for
 * primary buttons, active tabs and selection rings; the headline and the card
 * headings gave theirs back.
 */

import { describeCharacter, makeContext } from '../engine/character';
import type { Item } from '../engine/types';
import { tier } from '../engine/upgrade';
import { href, navigate } from '../router';
import { setsForCharacter, useApp } from '../state/store';
import { ItemWindow } from '../components/ItemWindow';
import { SlotGlyph } from '../components/SlotGlyph';

/** The sampled character, so the window's verdict line is a real judgement. */
const AVENRAE = makeContext(['BRD', 'WAR', 'BER'], null, { BRD: 50, WAR: 50, BER: 50 });

type Fill = 'usable' | 'blocked' | 'empty';

/**
 * The same five rows the gear page's character panel uses, on the sampled
 * Bard/Warrior/Berserker: everything that trio qualifies for is green, and the
 * Monk-only fists are red — the exact case the client shows.
 */
const SHOWCASE: readonly (readonly (readonly [slot: string, fill: Fill])[])[] = [
  [['EAR', 'usable'], ['HEAD', 'usable'], ['FACE', 'usable'], ['NECK', 'usable'], ['EAR', 'usable']],
  [['SHOULDERS', 'usable'], ['BACK', 'usable'], ['CHEST', 'usable'], ['ARMS', 'usable'], ['WRIST', 'empty']],
  [['HANDS', 'blocked'], ['FINGERS', 'usable'], ['WAIST', 'usable'], ['FINGERS', 'usable'], ['WRIST', 'usable']],
  [['PRIMARY', 'usable'], ['SECONDARY', 'usable'], ['LEGS', 'usable'], ['RANGE', 'empty'], ['AMMO', 'empty']],
  [['FEET', 'usable'], ['ANY', 'usable'], ['ANY', 'empty']],
];

const FILL_COLOR: Record<Fill, string | undefined> = {
  usable: 'var(--item-usable)',
  blocked: 'var(--item-blocked)',
  empty: undefined,
};

/**
 * A real item, shown in the real item window, as the product shot.
 * Earthshaker's numbers are the Tier 0 sample recorded in the validation set.
 */
const SAMPLE: Item = {
  id: 5667,
  n: 'Earthshaker',
  sl: ['PRIMARY'],
  cl: ['WAR', 'PAL', 'RNG', 'SHD', 'BER'],
  ra: ['ALL'],
  st: { STR: 6, STA: 6, DEX: -5 },
  sv: {},
  wp: { dmg: 37, dly: 70, skill: '2H Slashing' },
  fl: ['MAGIC', 'LORE'],
  wt: 16,
  sz: 'GIANT',
  era: 'Classic',
  av: true,
};

export function Landing() {
  const characters = useApp((s) => s.characters);
  const state = useApp();

  return (
    <div>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Plan your <em>EverQuest Legends</em> gear at speed
          </h1>
          <p>
            Three classes at once, twenty-three slots including the two Any Slots, and every item
            upgradeable from +0 to +10 — with the stat sheet recomputing as you touch it. No
            account, no server: your sets live in this browser and travel as links.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href={href.newCharacter}>
              Create a character
            </a>
            {/* The footer already prints the catalog size; the CTA said it too. */}
            <a className="btn" href={href.items}>
              Browse all items
            </a>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-head">
            <span className="portrait sm">A</span>
            <span>
              <b>Avenrae</b>
              <i>50 BRD/WAR/BER</i>
            </span>
          </div>
          <div className="figure-grid">
            {SHOWCASE.map((row, index) => (
              <div className="figure-row" key={index}>
                {row.map(([slot, fill], cell) => {
                  const color = FILL_COLOR[fill];
                  return (
                    <span
                      className={`figure-cell${fill === 'empty' ? '' : ' on'}`}
                      key={`${slot}-${cell}`}
                      style={color ? { color } : undefined}
                    >
                      <SlotGlyph slot={slot} size={24} />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          {/*
            The rule is stated where it actually applies. Browsing the catalog,
            green and red separate what this trio can equip from what it cannot,
            exactly as the client tints item names. On a gear set the question
            is already settled — every slot holds something you can wear — so
            the doll spends its colour on upgrade tier instead of repeating an
            answer you have. Claiming a green doll here would teach a rule the
            rest of the app no longer follows.
          */}
          <p className="hero-art-note">
            Browsing items, <span style={{ color: 'var(--item-usable)' }}>green</span> is what this
            trio can equip and <span style={{ color: 'var(--item-blocked)' }}>red</span> is what it
            cannot — the same rule the client uses.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <h2 className="section-label">Every item, in the window you already know</h2>
        <div className="showcase">
          <div className="showcase-art">
            <ItemWindow item={SAMPLE} upgrade={tier(10)} context={AVENRAE} slot="PRIMARY" />
          </div>
          <p className="hint showcase-note">
            Hover anything, anywhere — a slot on the doll, a row in a picker, a row in the item
            browser — and the item opens in the client's own window: red title bar, green numerics,
            cyan group headers. Shown at <strong>+10</strong>, with every number scaled by the
            wiki-verified upgrade curve rather than guessed at.
          </p>
        </div>
      </section>

      {characters.length ? (
        <section className="landing-section">
          <h2 className="section-label">Your characters</h2>
          <div className="card-grid">
            {characters.map((character) => {
              const sets = setsForCharacter(state, character.id);
              return (
                <article className="card" key={character.id}>
                  <div className="card-ident">
                    <div className="portrait sm" aria-hidden="true">
                      {character.name.trim().charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="grow">
                      <h3>{character.name}</h3>
                      <div className="hint">{describeCharacter(character)}</div>
                    </div>
                  </div>
                  <div className="hint">
                    {sets.length ? `${sets.length} set${sets.length === 1 ? '' : 's'}` : 'No sets yet'}
                  </div>
                  <div className="row card-foot">
                    {sets[0] ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => navigate(href.set(sets[0]?.id ?? ''))}
                      >
                        Open {sets[0].name}
                      </button>
                    ) : null}
                    <a className="btn btn-sm" href={href.characters}>
                      Manage
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="landing-section">
        <h2 className="section-label">What it does that the others do not</h2>
        <div className="feature-grid">
          <div className="feature">
            <h3>Multiclass first</h3>
            <p>
              Eligibility is the union of your trio and armour proficiency takes the best of the
              three, so a Paladin in the mix opens plate for everyone.
            </p>
          </div>
          <div className="feature">
            <h3>+0 to +10, everywhere</h3>
            <p>
              Every equipped item carries an inline upgrade control using the wiki-verified scaling
              rules, including the synthetic SV Void an upgraded item grants.
            </p>
          </div>
          <div className="feature">
            <h3>Cap-aware scoring</h3>
            <p>
              Attributes cap at 510 and resists at 1000. Points past a ceiling score nothing, so an
              item cannot win a slot by piling on a stat you have already maxed.
            </p>
          </div>
          <div className="feature">
            <h3>The URL is the product</h3>
            <p>
              Every set encodes into its own link — items, upgrade levels, exaltations and weights —
              and reopens read-only with one click to save a copy.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
