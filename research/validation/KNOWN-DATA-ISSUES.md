# Known data issues — wiki catalog vs. live client

Found by diffing the shipped catalog against Tier 0 screenshots. The stat math
is validated and exact; these are **metadata** divergences, where the community
wiki still reflects classic EverQuest conventions that EverQuest Legends has
changed. The client is ground truth in every case below.

## 1. Item flags diverge substantially — HIGH impact on filtering

Both Tier 0 items disagree with the catalog:

| Item | Client shows | Catalog has |
|---|---|---|
| Earthshaker | `Lore Equipped, No Trade, Placeable` | `LORE, MAGIC` |
| Whitened Treant Fists | `No Trade, Placeable` | `MAGIC, NO_DROP` |

Three separate problems:
- **`NO_DROP` vs `No Trade`.** The catalog carries `NO_DROP` on 3,390 items and
  `NO_TRADE` on 221. The client says "No Trade" for at least one item the wiki
  flags `NO_DROP`. These are most likely the same restriction under the game's
  new name, with the wiki inconsistently carrying both spellings.
- **`LORE` vs `Lore Equipped`.** Earthshaker reads `Lore Equipped` in-client but
  plain `LORE` in the catalog. The catalog does have a distinct `LORE_EQUIPPED`
  (117 items), so the two are being conflated somewhere upstream.
- **`Placeable` is largely unrecorded.** Present on both sampled items in-client;
  only 21 items carry it in the catalog.
- **`MAGIC` appears in the catalog on items where the client does not show it.**

**Consequence:** filtering or displaying by flag is unreliable. Do not present
flags as authoritative, and do not offer a "No Trade only" filter that users
would trust for loot decisions, until this is resolved against more samples.

## 2. Weapon skill is wrong on at least one item — MEDIUM impact

Whitened Treant Fists reads **`Skill: Hand to Hand`** in-client but
**`1H Blunt`** in the catalog. Among 37 Monk-only weapons the catalog splits
1H Blunt 17 / 2H Blunt 13 / Hand to Hand 6, so this is unlikely to be a single
typo — fist-type weapons appear to be systematically mis-skilled upstream.

Skill affects which combat skill a weapon trains and benefits from, so this
matters for anyone planning around a specific skill.

## 3. Weapon skill vocabulary is dirty — LOW impact, easily fixed

Parse artifacts in the shipped values:
`Throwingv1` (8), `Throwingv2` (22), `1H Slashing /` (1), `1H Slash` (1),
`1H Piercing` (2, where the canonical value elsewhere is plain `Piercing`).

These should be normalized to the client's vocabulary: `1H Slashing`,
`2H Slashing`, `1H Blunt`, `2H Blunt`, `Piercing`, `2H Piercing`,
`Hand to Hand`, `Archery`, `Throwing`.

## 4. Damage Bonus is not captured

Both screenshots show a `Dmg Bon` line (13 on the Fists, 50 on Earthshaker).
No catalog source carries it. It is probably derived from character level and
weapon type rather than stored per item, but it is currently absent from the
planner's weapon display.

## 5. Upstream issues inherited from the pipeline

Carried over from the build report, all documented in `pipeline/README.md`:
- **11 live items exist in no wiki catalog** (Shadow Rage Helm/Gloves/Boots,
  Heretic Insurrection Orders, Essence of Wind, the two Velium Gemmed Runes,
  Lightweight Bag, `Backpack*`, and two spelling drifts).
- **`ALL except <list>` is unrecoverable on 8 items**, which ship as `ALL` and
  are therefore too permissive.
- **`ERA_OVERRIDE` is empty upstream** — the list of Kunark/Velious items EQL
  released early was never filled in, so some era-gated items are probably
  obtainable in game. Inventing that list is exactly the failure this project
  guards against, so they stay gated with the filter exposed to the user.
- **2 items print `SV VOID`** as a base stat, which the engine normally
  synthesizes; flagged so it is not double-counted.

## What would close these gaps

More Tier 0 item screenshots, ideally a spread across armor and weapons, would
let us measure how systematic the flag and skill divergence is. Right now the
sample is two items — enough to prove a problem exists, not enough to correct it
safely.
