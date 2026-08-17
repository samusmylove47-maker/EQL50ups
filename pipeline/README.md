# EQL gear-planner data pipeline

Turns the four community EverQuest Legends item scrapes in `research/data/` into the
compact JSON the web app loads from `web/public/data/`.

Two scripts, no dependencies beyond Node 22 builtins, both deterministic:

```bash
node pipeline/build.mjs      # normalize + emit web/public/data/
node pipeline/verify.mjs     # assert data quality; exit 1 on hard failure
```

`build.mjs --quiet` suppresses the report. `verify.mjs --verbose` lists every passing check.
Re-running `build.mjs` produces byte-identical output apart from `meta.builtAt`
(set `SOURCE_DATE_EPOCH` to pin that too).

---

## What it produces

| File | Contents | Size (raw / gzip) |
|---|---|---|
| `items-index.json` | Every item, search/filter/rank fields only: `id n ic sl cl st sv wp fl era av eraUnknown an` | ~1.7 MiB / ~200 KiB |
| `items/<SLOT>.json` | Full records for one worn slot, including `fx` (effects) and `src` (acquisition) | 3–730 KiB each |
| `items/OTHER.json` | Full records for items with no worn slot (food, components, containers, keys) | ~1.1 MiB / ~170 KiB |
| `focus-effects.json` | The 66 wiki focus effects with per-spell-slot breakdown | ~40 KiB |
| `meta.json` | Build timestamp, provenance (repo + commit SHA + input hashes), counts, era config, vocabularies, attribution, schema version | ~5 KiB |

`items-index.json` is the startup payload; the shards are meant to be fetched lazily when the
user opens a slot.

### Record shape

```jsonc
{
  "id": 5667,                       // numeric game item id, or null — see "Item IDs"
  "n": "Earthshaker",               // display name (the wiki page title)
  "ic": 519,                        // icon id (jmoyers only)
  "sl": ["PRIMARY"],                // worn slots
  "cl": ["WAR","PAL","RNG","SHD","BER"],   // classes; or ["ALL"] / ["ALL_EXCEPT", ...excluded] / ["NONE"]
  "ra": ["ALL"],                    // races, same convention
  "st": { "STR": 6, "STA": 6, "DEX": -5 }, // numeric stats
  "sv": { "FIRE": 15 },             // resists
  "wp": { "dmg": 37, "dly": 70, "skill": "2H Slashing", "bonus": 50, "range": 100,
          "skillRaw": "Throwingv2" },   // only when the wiki's spelling was normalized
  "fx": [ { "k": "proc", "n": "Earthquake", "d": "Combat, Casting Time: Instant", "lv": 45 } ],
  "fl": ["LORE","MAGIC"],           // flags
  "wt": 16, "sz": "GIANT",
  "era": "Classic",
  "av": true,                       // available on the live server right now
  "eraUnknown": true,               // (only when set) no source knows this item's era
  "statsUnknown": true,             // (only when set) the item is real and NO source has its stats
  "evidence": "Confirmed to exist: worn in the Head position of …",  // why, for statsUnknown items
  "an": 1,                          // (only when set) eligible for an "Any Slot" position
  "src": { "z": ["The Hole"], "m": ["Master Yael"], "q": [], "v": [], "c": 1 },

  // detail shards only — diagnostics, safe to ignore in the UI
  "es": "eqlwiki.available_from",   // where the era came from
  "ur": "era:Velious",              // why av is false
  "gb": "zone",                     // eqlwiki's gating reason (zone / recipe)
  "chg": 10,                        // charges
  "rl": 46,                         // required level
  "parsed": "statsBlock",           // record was recovered by text-parsing raw wiki markup
  "cf": [ { "f": "AC", "a": 20, "b": 15, "sa": "eqlwiki", "sb": "jmoyers" } ]  // sources disagree
}
```

Empty fields are omitted entirely, never emitted as `null`/`[]`/`{}` — except `id`, which is
always present so the UI can tell "no id known" from "field missing".

**`statsUnknown` is not the same as having no stats.** Thousands of ordinary records — food,
containers, tradeskill components — carry no `st` and are fully described that way. `statsUnknown`
is a positive assertion that the data is *missing*: the item is confirmed to exist and nothing
anywhere recorded its numbers. It is the stats-side twin of `eraUnknown`, it is set only by the
Tier 0 table below, and a consumer **must not score, rank or recommend one** — treating its absent
stats as zero would put a fabricated comparison beside real ones. 3 items currently carry it.

### Vocabularies

- **Slots (18):** `EAR HEAD FACE NECK SHOULDERS ARMS BACK WRIST RANGE HANDS PRIMARY SECONDARY FINGERS CHEST LEGS FEET WAIST AMMO`
  The client shows **21 worn positions**: Ear, Wrist and Fingers are doubled, and there are two
  EQL-specific **"Any Slot"** positions. Doubling is a UI concern.
  **Any Slot** is not a value in `sl`. A live inventory shows a `SECONDARY` shield sitting in an
  Any Slot position, so any worn item is eligible; the build marks those items `an: 1`. No
  `items/ANY.json` shard is emitted — it would duplicate every worn item. Fill Any-Slot pickers
  from the index (`an === 1`) and lazy-load the item's own slot shard for detail.
- **Classes (16 + 3):** `WAR BRD CLR DRU ENC MAG MNK NEC PAL RNG ROG SHD SHM WIZ BST BER`, plus
  `ALL`, `NONE`, and `ALL_EXCEPT` (always followed by the excluded codes).
- **Races (15 + 3):** `HUM BAR ERU ELF HIE DEF HEF DWF TRL OGR HFL GNM IKS KER FRG`, plus `ALL`, `NONE`, `ALL_EXCEPT`.
- **Stats:** `AC HP MANA ENDUR STR STA AGI DEX WIS INT CHA HASTE HP_REGEN MANA_REGEN ENDUR_REGEN ATTACK BACKSTAB`
- **Saves:** `FIRE COLD MAGIC POISON DISEASE VOID`
- **Flags:** `MAGIC LORE NO_DROP NO_TRADE TEMPORARY EXPENDABLE ATTUNEABLE ARTIFACT LORE_EQUIPPED QUEST NO_RENT PLACEABLE`
- **Effect kinds:** `click proc focus worn` plus `effect` — the last means the wiki printed an
  effect without saying what type it is. It is not a guess; do not treat it as any of the other four.
- **Weapon skills (9):** `1H Slashing 2H Slashing 1H Blunt 2H Blunt Piercing 2H Piercing Hand to Hand Archery Throwing`
  — the client's vocabulary. Only spelling is normalized; **no weapon is ever moved between
  skills**. Where the wiki spelled it differently the original survives in `wp.skillRaw`.
  A value that is not a weapon skill at all (`SHIELD`, spell-research skills on tomes) never
  reaches `wp.skill`. See "Weapon skills" below for a divergence the client exposes.

---

## Source → field mapping

Sources are tried in order per field; the first that yields a non-empty value wins, and the build
report prints the resolution counts. Stats and saves additionally **gap-fill**: keys the winning
source lacks entirely are taken from a lower-priority source (this is how `ENDUR` survives —
eqlwiki carries it on 1 item, the raw wiki text on many more).

| Field | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| `n` name | eqlwiki `name` | jmoyers `page` | nathan-bates `name` | EQBuddy `Name` |
| `id` | Tier 0 client inventory export | — | — | — |
| `ic` icon | jmoyers `iconId` | — | — | — |
| `sl` slots | eqlwiki `slots` | jmoyers `stats.slot` | statsBlock `Slot:` | nathan-bates / EQBuddy |
| `cl` classes | eqlwiki `classes` ∪ statsBlock `Class:` | statsBlock | EQBuddy `Classes` | nathan-bates `classes_raw` |
| `ra` races | eqlwiki `races` | statsBlock `Race:` | nathan-bates `races_raw` | jmoyers |
| `st` stats | eqlwiki `stats` | statsBlock | jmoyers `stats.ac` + `stats.stats[]` | nathan-bates → EQBuddy |
| `sv` saves | eqlwiki `stats["SV *"]` | statsBlock | jmoyers `saves[]` | nathan-bates `saves` |
| `wp` weapon | eqlwiki `dmg/delay/skill/range` | jmoyers `dmg/atkDelay/skill/dmgBonus/range` | statsBlock | nathan-bates → EQBuddy |
| `fx` effects | union of eqlwiki `effects{}` (typed) and jmoyers `effects[].kind`, deduped on kind+name | | | |
| `fl` flags | union of eqlwiki `tags`, jmoyers `flags`+`extras`, nathan-bates `flags`, statsBlock header — filtered to the flag vocabulary | | | |
| `wt` / `sz` | eqlwiki `wt` / `size` | jmoyers | statsBlock | nathan-bates |
| `era`, `av` | **Tier 0 correction table** | eqlwiki `available_from` | eqlwiki `era` → min of eqlwiki `eras` | jmoyers `eraTag` → nathan-bates `era` |
| `src.z/m` | eqlwiki `zones` + `drops[]` | jmoyers `dropsFrom[]` | EQBuddy `DropZones` | |
| `src.q` | eqlwiki `quests` | EQBuddy `Quests` | jmoyers `questUses[]` | |
| `src.v` | eqlwiki `vendors` (flat zone/vendor alternation, kept verbatim) | | | |
| `src.c` | jmoyers `playerCrafted` ∨ eqlwiki `crafted_by`/`recipes` ∨ nathan-bates `player_crafted` ∨ EQBuddy `Recipes` | | | |

### Why eqlwiki is primary, and what jmoyers is for

`eqlwiki-items-2026-08-03.json` (from `Thiole/EQLGearPlanner`) has the cleanest structured parse:
AC on 4,620 items, an 18-value slot vocabulary, class codes limited to the valid 16 plus
`ALL`/`ALL_EXCEPT`, usable race restrictions, and it is the only source with era gating
(`available_from`, `gated_by`, `out_of_era`, `non_legends`) and acquisition detail.

`jmoyers-items.json` is broader (11,211 names vs 6,893) and fresher (2026-08-13 vs 2026-08-03),
and is the only source of `iconId` and of effects typed by kind. Its structured `stats.stats[]`
array omits AC entirely (AC lives in a separate `stats.ac` field, present on 4,649 items), its
`classes` array leaks parser fragments (`except`, `(35)`), and its `races` array collapses to
`ALL`/`NONE`. So it enriches; it does not lead.

**The extra 4,336 jmoyers-only names are almost entirely non-equipment** — food, tradeskill
components, quest turn-ins, containers. Only **13** of them carry a worn slot. There is no large
block of gear that can only be recovered by text-parsing.

### The `statsBlock` parser

jmoyers preserves the raw wiki item block verbatim. `parseStatsBlock()` reads it for
slot / class / race / AC / stats / saves / weapon / weight / size / charges / effects, and is used
as a fallback and as a gap-filler. Measured against eqlwiki over the 6,875-item overlap:

| Field | Agreement |
|---|---|
| AC | 99.89 % (4,596 / 4,601) |
| DMG | 99.94 % (1,705 / 1,706) |
| Atk Delay | 100 % (1,656 / 1,656) |
| Slots | 100 % once both sides are normalized |

Records whose stats or slots came from the parser carry `"parsed": "statsBlock"` (95 items).

---

## Era gating policy

Chronology (`meta.era.order`):

```
Classic → Fear → Hate → Paineel → Temple → Sky → Kunark → Epic Quests
       → Nov 2000 → FearHateRevamp → Velious → Chardok Revamp → Luclin
```

`CURRENT_ERA = "Sky"`. The wiki pre-catalogues content that is not live in this pre-Kunark game,
so an item is available when its era rank is **≤ Sky**.

- **`available_from` is preferred over a raw era tag.** It is acquisition-path aware: the latest
  era across the item's own tag, its recipe, and its earliest drop zone — i.e. the first era in
  which you could actually hold one. A Classic-tagged sword that only drops in a Kunark zone is
  correctly gated out.
- `non_legends` and `out_of_era` (26 items, the same set) force `av: false` regardless of era.
  The reason is recorded in `ur`; `gb` carries eqlwiki's gating reason (`zone` or `recipe`).
- **Items with no era anywhere are shipped `av: true` with `eraUnknown: true`.** 2,412 items
  (21 %) are in this state. Hiding them would be the worse failure: they are mostly ordinary
  Classic-era goods whose wiki page simply lacks a category. The build report calls this the
  `flagged` count; the UI should surface it as "availability unverified", not as a hard filter.
- `eraUnknown` describes the *absence of information* and is independent of `av`. Fifteen items are
  both era-less and `non_legends`, so they ship `eraUnknown: true, av: false, ur: "non_legends"`.

Current split: **5,407 gated out**, 2,412 unknown-era, the rest live. (The Tier 0 correction below
moved six Shadow Rage pieces into `FearHateRevamp`, which ranks after Sky — so the era gate now
hides a set the player is demonstrably wearing, and the app un-gates those six by name.)

**Not modelled:** the `ERA_OVERRIDE` list — Kunark/Velious items EQL made available early. The
mechanism is documented upstream but the list was never filled in, and inventing one is exactly
the failure mode this project guards against. Some gated-out items are therefore likely obtainable.
The app carries the observed half of that list by name in `TIER0_LIVE_ITEMS`
(`web/src/engine/constants.ts`): 18 items seen in a live client export, plus 1 named by the player.

---

## Tier 0 corrections

Two tables at the top of `build.mjs` — `TIER0_CORRECTIONS` (fields the sources got wrong) and
`TIER0_KNOWN_ITEMS` (items no source has at all) — are the **only** place this pipeline overrides
its inputs. They exist because the project ranks the running game above every community source, and
they are kept tiny, fully enumerated and individually cited so that "Tier 0 says so" can never
become a licence to guess. `verify.mjs` §9b re-asserts their outcome against the shipped payload
independently, so a table that stops matching the catalog fails the build rather than silently
doing nothing.

Currently applied — all from one player report on 2026-08-17, written up in full with the evidence
for every field in `research/validation/TIER0-PLAYER-REPORTS.md`:

| Item | Correction |
|---|---|
| Shadow Rage Leggings | `era: Classic` → `FearHateRevamp` |
| Shadow Rage Sleeves | no era anywhere → `FearHateRevamp` |
| Shadow Rage Wristguard | no era anywhere → `FearHateRevamp` |
| Shadow Rage Helm (#55601, HEAD) | added; `statsUnknown` |
| Shadow Rage Gloves (#55605, HANDS) | added; `statsUnknown` |
| Shadow Rage Boots (#55607, FEET) | added; `statsUnknown` |

Shadow Rage is the Berserker member of the `FearHateRevamp` planar class sets, alongside
Legionnaire Scale (WAR), Greenmist (SHD), of the Righteous (PAL), of the Untamed (RNG) and of
Harmony (DRU). The wiki never scraped it as a set. The three added records carry **name, id, slot,
class and era and nothing else** — no stat, weight, size, flag or icon was invented, and the
absence is stated in the data rather than filled with zeroes.

---

## Item IDs

**No wiki scrape carries numeric game item IDs.** eqlwiki's `id` is a page slug (`"Earthshaker"`);
EQBuddy, nathan-bates and jmoyers have no id field at all. This was checked across all 74 files in
`research/data/` — the only numeric `id` fields found belong to spells and races.

The one real source is `research/validation/tier0-inventory-Avenrae.txt`, a live client
`/outputfile inventory` export: 297 distinct base item names ↔ 297 distinct IDs, a clean 1:1 map
with no name or id collisions. It confirms that neither the `+N` upgrade suffix nor the
`(Exaltation)` suffix changes an item's ID.

289 of those 297 are bound to catalog rows (285 exact, 4 via an unambiguous punctuation-insensitive
match). Three of those exact matches are the Shadow Rage pieces the Tier 0 table adds — the record
is created *because* the game has the item, so it is the right home for the id printed beside it.
The remaining 8 are unbound because the wiki has no page for them. Binding is deliberately
conservative — a loose match is only accepted when it resolves to exactly one catalog row that no
other export name has claimed. `Backpack` (#17005) and `Backpack*` (#32601) are two different items
that both appear in that inventory; an earlier draft of this pipeline merged them and shipped the
wrong ID for `Backpack`, which is what that rule now prevents.

Every other item ships `id: null`. Inventory-paste import will need name matching for those.

---

## Where the wiki disagrees with the live client

Two Tier 0 screenshots (Earthshaker, Whitened Treant Fists) contradict the catalog on *metadata*,
never on stats — the numbers reproduce exactly. Both divergences are measured and published in
`meta.json` → `dataReliability`, and **neither is "fixed" by guessing a mapping**.

### Flags — low confidence, do not filter on them

| Item | Client | Catalog |
|---|---|---|
| Earthshaker | `Lore Equipped, No Trade, Placeable` | `LORE, MAGIC` |
| Whitened Treant Fists | `No Trade, Placeable` | `MAGIC, NO_DROP` |

Measuring the raw flag line on all 7,404 jmoyers pages that carry one explains why. The wiki has
**two authoring conventions**, and the flag vocabulary partitions almost perfectly between them:

| Convention | Pages | NO_DROP | NO_TRADE | MAGIC | PLACEABLE | LORE_EQUIPPED | LORE |
|---|---|---|---|---|---|---|---|
| legacy — `MAGIC ITEM LORE ITEM NO DROP` (ALL CAPS, space-separated) | 7,185 | 3,355 | 82 | 5,398 | 1 | 29 | 4,404 |
| modern — `Lore Equipped, No Trade, Placeable` (Title Case, comma-separated) | 219 | **0** | 110 | **0** | 20 | 86 | 1 |

**Answering the question that was asked — are `NO_DROP` and `NO_TRADE` distinct in EQL?**
The evidence says almost certainly **not**; they look like one restriction under two spellings.

- **Zero** of the 7,404 pages carrying a flag line carry both spellings.
- `NO_DROP` appears on **zero** of the 219 modern-convention pages, while `NO_TRADE` appears on 110
  of them. The spellings partition by page style, not by item.
- The one item we can check against the game — Whitened Treant Fists, a legacy-style page flagged
  `NO DROP` — reads **`No Trade`** in the client.

That is strong, but it is inference from three lines of evidence, not proof, so **both flags ship
exactly as the wiki spells them**. Collapsing them would rewrite 3,355 items on a two-sample basis.
Resolving it needs a client screenshot of an item whose wiki page uses the modern convention.

Two related findings from the same measurement:

- **`MAGIC` is absent from every modern-convention page** (0 of 219) and from both client
  screenshots, while appearing on 5,398 legacy pages. It may be a classic-EverQuest concept EQL no
  longer surfaces. Unresolved.
- **`Placeable` is recorded only by the modern convention** (20 of 22 occurrences). The client shows
  it on both sampled items, so its 22-item catalog coverage is a recording gap, not a real rarity.

**Consequence for the UI:** `meta.dataReliability.flags.doNotUseAsAuthoritativeFilter` is `true`.
Do not offer a "No Trade only" filter users would trust for loot decisions, and hedge flag display.

### Weapon skills — the wiki is wrong on Monk fist weapons

Whitened Treant Fists reads **`Hand to Hand`** in the client and **`1H Blunt`** in the catalog.

**Our parse is faithful; the wiki itself is wrong.** All four independent scrapes report `1H Blunt`
for this item, the raw wiki text says `Skill: 1H Blunt`, and the wiki's own page *category* is
`1H Blunt` too. There is nothing for the pipeline to fix.

The wiki is also internally inconsistent inside a single item family, which is what makes this look
systematic rather than a one-off typo:

| `Hand to Hand` (11 items total, all dmg 3–12) | `1H Blunt` |
|---|---|
| Bronze Knuckles, Rusty Knuckles, Steel Knuckles, Weighted Gloves, Worn Weighted Gloves, Bronze Ulak, Rusty Ulak, Sharp Claws, Flaming Fist, Spirit Render, Windhowl | Brass Knuckles, Knuckle Dusters, all six Velium Knuckledusters, Priceless/Primal Velium Fist Wraps, Wurmscale Fistwraps, Wu's Fist of Mastery, Wu's Tranquil Fist, Fist of Lightning, Fist of Nature, Whitened Treant Fists |

Scope: 130 MNK-usable weapons carry a skill; 38 are MNK-only (1H Blunt 17, 2H Blunt 13,
Hand to Hand 7, Throwing 1). Every `Hand to Hand` item in the entire catalog is low-damage starter
gear; all the high-end Monk fist gear is skilled `1H Blunt`.

`meta.dataReliability.weaponSkill.suspects` enumerates the **16** affected items, selected by a
stated, auditable rule (`suspectRule`): a MNK-usable weapon with an explicit class list whose name
matches `/fist|knuckle|claw|cestus|ulak|fistwrap/i` and whose skill is not `Hand to Hand`. The
skill values themselves are untouched — flag them in the UI, don't silently rewrite them.

### `Throwingv1` / `Throwingv2` — investigated before collapsing

These are in the wiki source, not a scraper bug: all four scrapes report them identically
(v1 on 8 items, v2 on 22). They encode **no** recoverable distinction:

- the wiki's own category for all 37 throwing weapons is plain `Throwing`;
- they do not track slot — v1 is 7 `RANGE` + 1 `RANGE+AMMO`, plain `Throwing` is 6 `RANGE+AMMO` + 1 `RANGE`;
- they do not track range — v1 40–210, v2 20–250, plain 45–200, fully overlapping.

They read as an infobox template parameter version. Both collapse to `Throwing`, and the raw string
is preserved in `wp.skillRaw` so the distinction is recoverable if it ever proves meaningful.
Also folded: `1H Slash` → `1H Slashing` (1), `1H Slashing /` → `1H Slashing` (1),
`1H Piercing` → `Piercing` (2).

### Damage bonus

The client shows a `Dmg Bon` line (13 on the Fists, 50 on Earthshaker). No source carries it per
item — jmoyers has `dmgBonus` on exactly 1 of 11,375 items — so it is almost certainly derived from
character level and weapon type rather than stored. `wp.bonus` is emitted only where a source
actually printed it. Recorded in `meta.dataReliability.dmgBonus`.

---

## Known data problems

Everything here is a property of the upstream sources, not of the pipeline.

1. **8 live items are absent from every wiki catalog** (2.7 % of the Tier 0 sample): Heretic
   Insurrection Orders, Essence of Wind, Velium Gemmed Rune, Complex Velium Gemmed Rune,
   Lightweight Bag, `Backpack*`, and two spelling drifts the client and wiki disagree on
   (`Deterioriated`/`Deteriorated Ancient Faydark Longbow`, `Griffon Wing Spaulders`/`Spauldors`).
   `verify.mjs` prints the closest catalog name for each; nothing is auto-bound.
   This was 11 until the Shadow Rage Helm, Gloves and Boots were recovered from a player report;
   they now ship as `statsUnknown` records — see "Tier 0 corrections" above.
   **The wiki's coverage of the whole `FearHateRevamp` era is class-incomplete**: full 7–8 piece
   sets for WAR/SHD/PAL/RNG/DRU only, one shoulder piece for BRD, and nothing at all for the other
   nine classes. That is a scrape gap, not evidence the gear does not exist —
   `research/validation/TIER0-PLAYER-REPORTS.md` measures it.
2. **15 items where eqlwiki and jmoyers disagree** on AC (5), DMG (9) or delay (1). eqlwiki's value
   is kept and both are recorded on the item as `cf`. Spot-checking the raw wiki text shows
   jmoyers' *structured* extraction is at fault in 10 of them (Greenmist's `Bane DMG: Shissar +6`
   read as the weapon's DMG; Summoned: Modulating Rod's `Recast Delay: 300` read as Atk Delay).
   The 5 Lustrous Russet pieces are different: jmoyers' own raw text backs its lower AC, so the
   wiki page probably changed between the two scrapes and **eqlwiki's value may be stale**.
3. **eqlwiki's class parser drops classes from comma-separated lists.** 12 items were affected —
   `Cap of Mending` came through as WAR-only against 12 classes in the raw text; Earthshaker lost
   BER. The build unions eqlwiki's list with the raw `Class:` line when both are plain code lists.
4. **`ALL except <list>` is unrecoverable on 8 items** — every scraper lost the exclusion list.
   They ship as `["ALL"]`, which is too permissive. eqlwiki keeps the list on the other 747.
5. **Race restrictions exist only in eqlwiki.** jmoyers and nathan-bates both collapse the race row
   to `ALL`/`NONE`/`ALL except`, so the ~4,300 items outside eqlwiki have no usable race data.
6. **Two items carry a printed `SV VOID` line** (Anthemion Armbands +2, Darkspun Shroud +1). SV
   Void is normally *synthesised* by the +N upgrade engine, so these wiki pages are probably
   showing already-upgraded stats. Shipped as found; do not double-count them when scaling.
7. **6 arrows print `Atk Delay: 0`** and 49 more print DMG with no delay row. Faithful to the wiki;
   `verify.mjs` permits this only for `AMMO`-slotted items.
8. **37 name collisions across sources** (case-only and backtick-vs-apostrophe variants of the same
   page). The richer record wins. A further 162 are byte-identical duplicates inside jmoyers.
9. **`src.v` (vendors) is a flat alternating list** of zone and vendor names in the upstream data.
   It is kept verbatim rather than guessed into pairs.
10. **Non-equipment dominates the catalog by count**: 4,343 of 11,252 items have no worn slot.
11. **Exaltation socket contents are not in any source and never will be** — sockets are a function
    of item level, not an item property. Derive them from the chosen `+N`; do not look for a field.
12. **Flags and Monk fist-weapon skills contradict the live client** — see the section above and
    `meta.dataReliability`. Neither is corrected in the data.

---

## Licensing and attribution

All item, quest and zone data ultimately derives from the **EverQuest Legends Wiki**
(`eqlwiki.com`), used under **CC BY-SA 4.0**. Two obligations follow and both are load-bearing:

- **Attribution.** The app must visibly credit "EverQuest Legends Wiki". The exact string is in
  `meta.json` → `attribution`; render it, don't retype it.
- **Share-alike.** This derived dataset — `web/public/data/**` — is itself CC BY-SA 4.0. Anything
  redistributing it must carry the same licence.

Intermediate scrapes and their code have their own terms, which is why nothing is copied from them:

| Repo | Licence | How it is used here |
|---|---|---|
| `Thiole/EQLGearPlanner` | no licence file (all rights reserved) | its `items.json` is read as a copy of CC BY-SA wiki content; none of its code is used |
| `nathan-bates/eql` | no licence file | same |
| `jmoyers/everquest-companion` | FSL-1.1 (source-available, MIT in ~2 years) | data only. **No code from `research/mechanics/jmoyers-*.ts` is copied into this pipeline** — it is not needed, since this pipeline does normalization, not upgrade math |
| `DranakCorps-bot/EQBuddy` | MIT | data, with attribution in `meta.provenance` |

EverQuest is a trademark of Daybreak Game Company LLC. This project is unaffiliated with Daybreak
or Game Jawn.

Every input file is pinned in `meta.provenance` by repo, 40-char commit SHA, byte size and a
SHA-256 prefix, so any shipped record can be traced back to an exact upstream revision.

---

## What `verify.mjs` checks

37 assertions over the *shipped payload only* — it re-declares its own vocabularies rather than
importing the build's, so a mistake in `build.mjs` cannot validate itself.

Structure (files present, schema versions agree, meta counts match, provenance SHAs well-formed,
attribution present, `dataReliability` documents the fields the client contradicts) · names (every
item named, no duplicate name keys) · vocabularies (slots, classes, races, stat keys, save keys,
flags, weapon skills) · numeric stats are finite numbers · weapons carry
both `dmg` and `dly` or neither, with an `AMMO`-only exemption · `skillRaw` only present when it
differs from the normalized skill · era values are in the chronology
and `av` agrees with the gate · `eraUnknown` implies `av` unless another reason is recorded ·
shard integrity (every item filed under a slot it actually has, index and shard records agree,
every item reachable from some shard) · effects/sizes/weights well-formed · icon and item IDs are
positive integers · no numeric ID assigned twice · **`statsUnknown` records carry evidence and no
stats, and keep the marker into the shards** · **Tier 0 coverage** · Tier 0 spot-checks
(Earthshaker DMG 37 / delay 70 / id 5667, Cloak of Flames id 11621, Fishbone Earring id 10313) ·
**the Shadow Rage set carries the Tier 0 player correction** (all six pieces, `FearHateRevamp`,
BER, right slots and ids, and no stats on the three the wiki never had).

Tier 0 coverage is the headline metric: **289 / 297 = 97.3 %**, with 289 IDs correct and 0 wrong.
The build fails below 90 %.
