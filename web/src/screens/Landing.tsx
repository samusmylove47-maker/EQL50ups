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
 *
 * This is the shipped `Earthshaker` record, field for field — including the
 * provenance fields, which is the whole reason it is the exemplar. Its stat
 * block is the only one in this project that has been read off a live client
 * window and agreed with digit for digit (`research/validation/TIER0-VALIDATION.md`
 * §1), so the window on the front page prints the two Tier M marks it earned
 * rather than the silence it used to.
 *
 * Its flag line is the counter-example, and it stays in on purpose: the client
 * shows *Lore Equipped, No Trade, Placeable* where the wiki says *Lore, Magic*.
 * The note beside the window says so, because printing a value we hold Tier M
 * evidence against, unmarked, on the first screen is exactly what the sourcing
 * standard exists to stop.
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
  fl: ['LORE', 'MAGIC'],
  wt: 16,
  sz: 'GIANT',
  era: 'Classic',
  av: true,
  /*
   * `measured-drop`, not `live-export` — the stronger of the two, and the one
   * the payload actually holds.
   *
   * This shot is described on the page as a copy of the shipped record, and it
   * had drifted: every STAT in it matches exactly, but the existence eyebrow
   * rendered "Tier M · held in a live inventory" where the record renders
   * "Tier M · seen dropping in game". The payload carries `ex: 'measured-drop'`
   * with an `ms` block recording Master Yael, seen 4 times over 4 sessions,
   * 10–11 Aug 2026 — so the front page was UNDERSTATING evidence we hold, on
   * the one claim this project is judged by, and a reader who hovered
   * Earthshaker anywhere else in the app saw a different provenance line for
   * the same item. `landing-sample.test.ts` now derives this from the record.
   */
  ex: 'measured-drop',
  // `lv` is in the shipped record's JSON and absent from `ItemEffect`, so the
  // app never renders it; the shot carries what the type models.
  fx: [{ k: 'proc', n: 'Earthquake', d: 'Combat, Casting Time: Instant' }],
  sd: 'tier-M',
  vf: ['DLY', 'DMG', 'STA', 'STR'],
  sdc:
    'TIER0-VALIDATION.md §1: observed in a live client window at +10 — Base Dmg 74, Delay 70, ' +
    'Ratio 1.057, Dmg Bon 50, Strength 16, Stamina 16, SV Void 10. Seven of seven predictions ' +
    'exact.',
};

/** Exported for `landing-sample.test.ts`, which holds it against the shipped record. */
export const SAMPLE_FOR_TEST: Item = SAMPLE;

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
            account and no backend: your sets live in this browser and travel as links, and
            nothing you enter is ever sent anywhere. The app does fetch its own item catalogue
            from the site serving it.
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
              {/*
                An invented character, and it has to stay invented. This card
                printed the owner's own character name — the site reserves its
                real character names to `credits.html`, once, and this was the
                site's voice using one a second time. `Ashvane` belongs to
                nobody; it is the same name the product screenshots are taken
                with, so the demo art and the shots now agree.
              */}
              <b>Ashvane</b>
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
            green separates what this trio can equip from what it cannot,
            following the client's own tint. On a gear set the question is
            already settled — every slot holds something you can wear — so the
            doll spends its colour on upgrade tier instead of repeating an
            answer you have. Claiming a green doll here would teach a rule the
            rest of the app no longer follows.

            **This sentence used to promise red as well, and it has to stop.**
            The client tints a blocked name red and §12 of `styles.css` now
            declines to on the catalog table, for a measured reason: opened to
            the whole game, "your trio cannot wear this" is 69 rows in 100, and
            a warning colour spent on the majority state is not a warning. Red
            survives where a blocked item is the exception — a shared set or an
            import putting one on the doll — and that is where the legend now
            points. A legend that describes a screen the app no longer draws is
            worse than no legend.
          */}
          <p className="hero-art-note">
            Browsing items, <span style={{ color: 'var(--item-usable)' }}>green</span> is what this
            trio can equip, following the client's own tint; the rest simply
            recede. On a set, an item nobody in the trio can wear is marked{' '}
            <span style={{ color: 'var(--item-blocked)' }}>red</span> and said in words.
          </p>
        </div>
      </section>

      <section className="landing-section">
        <h2 className="section-label">Every item, in the window you already know</h2>
        <div className="showcase">
          <div className="showcase-art">
            <ItemWindow item={SAMPLE} upgrade={tier(10)} context={AVENRAE} slot="PRIMARY" />
          </div>
          {/*
            The claim under the product shot has to match the evidence in it.
            This said "the wiki-verified upgrade curve" while sitting beside the
            one stat block in the project that was checked against the running
            game — a four-tier demotion, in the sentence meant to establish
            trust. It now cites the receipt that exists.
          */}
          <div style={{ display: 'grid', gap: 'var(--s3)', minWidth: 0 }}>
            <p className="hint showcase-note">
              Hover anything, anywhere — a slot on the doll, a row in a picker, a row in the item
              browser — and the item opens in the client's own window: red title bar, green
              numerics, cyan group headers.
            </p>
            <p className="hint showcase-note">
              Shown at <strong>+10</strong>, and these are not estimates. This exact window was read
              off a live client and the planner reproduces it:{' '}
              <strong>seven of seven predictions exact</strong> — 74 damage, delay unchanged at
              70, ratio 1.057, damage bonus 50, Strength and Stamina 16, and the synthetic SV Void
              at 10, a rule that appears in no documentation. Its flag line is the one part a client contradicts, which
              is what <a href={href.sources}>Sources</a> is for.
            </p>
          </div>
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
              Every equipped item carries an inline upgrade control. The scaling rules were
              re-derived from the wiki's own item-level slider and then checked against live client
              windows, which corrected two of them — the weight rounding, and the percentage
              branch, which truncates rather than rounds. The synthetic SV Void an upgraded item
              grants went the other way: it exists in no documentation, was recovered from the
              calculator's source alone, and the client showed it exactly as predicted.
            </p>
          </div>
          <div className="feature">
            <h3>Cap-aware scoring</h3>
            <p>
              Attributes cap at 510 and resists at 1000, both read straight off the client's stats
              window. Points past a ceiling score nothing, so an item cannot win a slot by piling on
              a stat you have already maxed.
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
        {/*
          Not a footnote. Two thirds of the scraped catalog is content this game
          does not have, the flag vocabulary is unreliable enough that the data
          says so itself, and a planner that hides either is asking to be
          trusted on nothing.
        */}
        <p className="hint">
          Every item window names where its numbers came from.{' '}
          <a href={href.sources}>Sources</a> does it for the catalog as a whole — the tier
          hierarchy, what was cut before this shipped, and what is known to be wrong with what
          remains.
        </p>
      </section>
    </div>
  );
}
