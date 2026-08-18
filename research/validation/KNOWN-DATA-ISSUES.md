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

## 5. The wiki's `FearHateRevamp` coverage is class-incomplete — MEDIUM impact

Corrected on a Tier 0 player report, 2026-08-17. Full write-up, with the quoted
report and the evidence for every field: **`TIER0-PLAYER-REPORTS.md`**.

The `FearHateRevamp` era holds the planar class sets EQL added to Fear and Hate.
The wiki has complete 7–8 piece sets for **five** classes only — Legionnaire
Scale (WAR), Greenmist (SHD), of the Righteous (PAL), of the Untamed (RNG), of
Harmony (DRU) — and for everyone else it has scattered singles or nothing:

| Class | Class-exclusive armour in the era |
|---|---|
| WAR 8 · SHD 7 · PAL 7 · RNG 7 · DRU 7 | complete sets |
| BER 6 | Shadow Rage — recovered by the player report, not by any scrape |
| BRD 1 | one shoulder piece |
| CLR, ENC, MAG, MNK, NEC, ROG, SHM, WIZ, BST | **none at all** |

Shadow Rage is the proof this is a scrape gap rather than a design fact: the
wiki had three of its six pieces, on unrelated pages, with the era wrong on one
and absent on two, and had never recorded them as a set. Nine classes showing
zero planar armour in a revamp built around class sets is very unlikely to be
the game's actual content.

**Consequence:** an empty result for a class in this era means "we do not have
this data", not "this content does not exist". Nothing has been added on the
strength of that reasoning — see the write-up for what was deliberately not
changed, and for the open question of whether the whole era is live.

## 6. Upstream issues inherited from the pipeline

Carried over from the build report, all documented in `pipeline/README.md`:
- **8 live items exist in no wiki catalog** (Heretic Insurrection Orders,
  Essence of Wind, the two Velium Gemmed Runes, Lightweight Bag, `Backpack*`,
  and two spelling drifts). This was 11 until the Shadow Rage Helm, Gloves and
  Boots were recovered from the player report above; they now ship as records
  with `statsUnknown: true` — real items, no stats invented — and are excluded
  from all ranking, scoring and auto-fill.
- **`ALL except <list>` is unrecoverable on 8 items**, which ship as `ALL` and
  are therefore too permissive.
- **`ERA_OVERRIDE` is empty upstream** — the list of Kunark/Velious items EQL
  released early was never filled in, so some quarantined items are probably
  obtainable in game. Inventing that list is exactly the failure this project
  guards against, so they are **not shipped at all**: 7,719 records are held in
  `pipeline/quarantine.json`, named and reasoned, and restored only when a Tier
  M or Tier 1 source places them. This is a change of disposition, not of risk —
  they used to ship gated behind a "Live content only" filter, and that filter
  has been removed. The 19 items the live export and the player do vouch for are
  carried by name in `TIER0_LIVE_ITEMS` (`web/src/engine/constants.ts`).
- **2 items print `SV VOID`** as a base stat, which the engine normally
  synthesizes; flagged so it is not double-counted.

## 7. The client's AC line has a second figure the planner does not model

Shara's Equipment tab (Director capture, 2026-08-18) reads:

```
AC   20/350 | 110
```

Three numbers. The planner models the first as a total and knows nothing of the other
two. `350` is evidently a cap, in the same shape as `Strength 70/510` and
`SV Magic 25/1000` on the same window — both of which confirm `ATTRIBUTE_CAP` and
`RESIST_CAP` as Tier M rather than inferred. **`110` is unexplained.**

Candidates, none of them observed: mitigation as against avoidance, a derived defence
figure, a soft cap, or a class/level contribution shown separately from worn AC. Picking
one would be precisely the inference `research/SOURCING-STANDARD.md` exists to forbid —
the same reasoning that once read a wiki era tag as confirmation of five armour sets that
do not exist.

**Impact: unknown, and that is the finding.** If `110` responds to worn AC then the
planner's AC total is answering a different question from the one the client answers, and
a player comparing the two would find them disagreeing with no explanation on screen.

**What would settle it:** two captures of the same character's Equipment tab with
different gear, so the second figure's response to item AC can be measured. One capture
cannot distinguish a constant from a function.

Not chased on 2026-08-18 by Director's ruling: record it, do not pursue it today.

## What would close these gaps

More Tier 0 item screenshots, ideally a spread across armor and weapons, would
let us measure how systematic the flag and skill divergence is. Right now the
sample is two items — enough to prove a problem exists, not enough to correct it
safely.

**Player reports close them fastest.** One sentence from the player resolved
§5 outright: it named a set the wiki had never assembled, corrected the era on
three items, and explained three of the eleven "in no catalog at all" gaps. A
client screenshot of any Shadow Rage piece would go further still and give us
the stats. Reports are logged in `TIER0-PLAYER-REPORTS.md` with the evidence for
each field recorded beside it.
