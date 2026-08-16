import { describeCharacter } from '../engine/character';
import { href, navigate } from '../router';
import { setsForCharacter, useApp } from '../state/store';
import { count } from '../lib/format';
import { useCatalog } from '../data/catalog';

export function Landing() {
  const characters = useApp((s) => s.characters);
  const state = useApp();
  const items = useCatalog((s) => s.items.length);

  return (
    <div>
      <section className="hero">
        <h1>
          Plan your <em>EverQuest Legends</em> gear at speed
        </h1>
        <p>
          Three classes at once, twenty-three slots including the two Any Slots, and every item
          upgradeable from +0 to +10 — with the stat sheet recomputing as you touch it. No account,
          no server: your sets live in this browser and travel as links.
        </p>
        <div className="empty-actions" style={{ justifyContent: 'flex-start' }}>
          <a className="btn btn-primary" href={href.newCharacter}>
            Create a character
          </a>
          <a className="btn" href={href.items}>
            Browse items{items ? ` (${count(items)})` : ''}
          </a>
        </div>
      </section>

      {characters.length ? (
        <section>
          <h2 className="section-label" style={{ marginBottom: 10 }}>
            Your characters
          </h2>
          <div className="card-grid">
            {characters.map((character) => {
              const sets = setsForCharacter(state, character.id);
              return (
                <article className="card" key={character.id}>
                  <div>
                    <h3>{character.name}</h3>
                    <div className="hint">{describeCharacter(character)}</div>
                  </div>
                  <div className="hint">
                    {sets.length ? `${sets.length} set${sets.length === 1 ? '' : 's'}` : 'No sets yet'}
                  </div>
                  <div className="row">
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
    </div>
  );
}
