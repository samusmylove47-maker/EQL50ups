# EQL GitHub Data Inventory & Provenance Report

**Compiled:** 2026-08-16 · **Target:** EverQuest Legends gear-planner data sourcing
**Data root:** `/home/user/EQL50ups/research/data/` · **Mechanics source:** `/home/user/EQL50ups/research/mechanics/`

---

## 1. Method & channel notes

The stated channel constraints turned out to be **wider than briefed**. Two capabilities were verified working and became the actual workflow:

| Channel | Status | Notes |
|---|---|---|
| `git clone` of **any public repo** | **WORKS** | Session git proxy serves anonymous reads. This replaced all path-guessing. Use `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1`. |
| `mcp__github__search_repositories` | **WORKS globally** | Not repo-scoped. Real discovery, not guesswork. |
| `mcp__github__search_code` | **WORKS globally** | Found data files by path/extension across all of GitHub. |
| `mcp__github__get_file_contents` | **BLOCKED** | Repo-scoped to `samusmylove47-maker/eql50ups` only. |
| `raw.githubusercontent.com` | WORKS | Used for initial README recon only; superseded by cloning. |

Because full repos were cloned, every file below is recorded with its **repo commit SHA**, which is stronger provenance than a raw URL (raw URLs on a branch are mutable).

### Commit SHAs pinned

| Repo | HEAD SHA | HEAD date |
|---|---|---|
| `DranakCorps-bot/EQBuddy` | `03c624cd2955c58028648ae9dbead813518b4121` | 2026-08-16 |
| `Thiole/EQLGearPlanner` | `0213a63b8ee7242dedc34fb1223423a970a56ff2` | 2026-08-05 |
| `DavisChappins/eql-tooltip` | `9ecb7b7317fb0b491a0c7828c388f74dca3eff16` | 2026-07-21 |
| `ArtSabintsev/everquest-legends-mcp` | `63f235cbd4c751f04ce9f7355d10f2f1b3a09ea9` | 2026-08-08 |
| `nathan-bates/eql` | `3caccd09710758581030d0070b03863e15f8d421` | 2026-08-06 |
| `jmoyers/everquest-companion` | `d25455ee0f251a063e7899e0e544146f4492454d` | 2026-08-16 |

---

## 2. Headline findings

### 2.1 The +N upgrade scaling rule is SOLVED — authoritatively

`jmoyers/everquest-companion` contains `src/shared/itemUpgrade.ts`, a **verbatim port of eqlwiki's own `ext.itemLevelSlider` ResourceLoader module** (`load.php?modules=ext.itemLevelSlider`) — the JavaScript that actually drives the item-level slider on every wiki item page. This is the wiki's calculator itself, not a reading of its prose. Extracted 2026-08-13.

**The state.** An upgrade state is the in-game `Tier N  x / y` row: `full` = N (0–10), `fraction` = x banked toward next tier, where **y = 2^full**.
- `effectiveLevel = full + fraction / 2^full`
- headline label `= effectiveLevel × 10` (a label only — *not* the arithmetic any stat goes through)
- exactly **1024** reachable states
- merged gear at tier T is worth 2^T exp; reaching T+1 costs 2^T; total exp for tier T is 2^T − 1

**Per-stat rules** (rounding is load-bearing — `excelRound` = half-away-from-zero, *not* `Math.round`):

| Stat class | Keys | Rule |
|---|---|---|
| **primary** | AC, STR/STA/AGI/DEX/WIS/INT/CHA, HP, MP, END, all `SV_*` | `base == 0` → 0; `0 < base ≤ 10` → **`base + full`** (fraction ignored); `base > 10` → `floor(base + excelRound(base × effective / 10))`; `base < 0` → `min(0, base + full)` (penalties **shrink toward zero**) |
| **damage** | weapon DMG | `base + floor(base × effective / 10)` — +10%/level, reads the fraction, **no** minimum guarantee |
| **delay** | atk delay | **never scales** (this is where the ratio gain comes from) |
| **flat** | HP_REGEN, MANA_REGEN, END_REGEN, HASTE | `base + full`, fraction ignored |
| **weight** | WT | `max(0, ceilToOneDecimal(base × (1 − 0.09 × log2(totalProgression))))`, where `totalProgression = 2^full + fraction`. `base ≤ 0.1` is an **entry guard** (untouched), not an output clamp |
| **unchanged** | heroic stats, Attack, Dmg Bon, Backstab, Range, Size, Rec Level, charges, effect magnitudes | untouched |

**Bonus mechanic:** an upgraded item carrying **≥2 distinct** fields from {STR STA INT AGI DEX CHA WIS, SV_FIRE SV_COLD SV_POISON SV_MAGIC SV_DISEASE} gains a **synthetic `SV VOID: +full`** line. AC, HP, MP deliberately do *not* trigger it.

**Verification fixtures** (from owner screenshots, in `tests/itemUpgrade.test.mts`): *Thelvorn, Blade of Light* (DMG 20, Delay 26, WIS +15, WT 3.0) at tier 2+3/4 reads DMG 25, WIS +19, WT 2.3, ratio 0.96 — all four reproduce. Whole-level tables are asserted for all 11 tiers.

**A float artifact must be replicated, not fixed:** at full=10, `3.0 × (1 − 0.09×10)` = 0.30000000000000027 in IEEE754, so the ceiling returns **0.4**, which is what the wiki displays.

**DEAD DATA warning:** the wiki page `MediaWiki:ItemLevelMultipliers` (`{1:1.3, 2:1.6, …}`) is loaded by nothing, contradicts the real progression, and must **not** be used.

> **Cross-source conflict — resolved.** `Thiole/EQLGearPlanner` independently derived a scaling model from the wiki's **prose** pages. It is **wrong in three documented ways**: it posits a flat +10%/tier for every stat, a separate "+1 minimum per tier" floor rule laid over the percentage, and it rejects/accepts damage rates by inference. jmoyers explicitly records these as corrections (JOS-281, 2026-08-13). The `base ≤ 10 → base + full` **branch** is what the "+1 minimum" note was actually describing. Thiole also flags its own negative-stat handling as `UNVERIFIED` and gets it **backwards** (it deepens penalties; the real rule shrinks them toward zero). **Use jmoyers. Do not use Thiole's math.** Thiole's model is preserved at `mechanics/thiole-tier-and-exalt-model.js.txt` for comparison only.

### 2.2 Exaltations — mechanics SOLVED, per-item socket data DOES NOT EXIST

Both independent sources agree exactly on the socket ladder (unlock by item level):

| Item level | Socket unlocked | What it holds |
|---|---|---|
| +0 | **Ornamentation** | Appearance copied from another item (visible gear only). Created with a Marketplace **Ornamentation Token**, *not* by leveling — the odd one out. |
| +1 | **Focus** | A Focus Effect moved from another item |
| +2 | **Click** | A Click Effect moved from another item |
| +3 | **Worn** | A passive Worn Effect moved from another item |
| +4 | **Proc** | A Proc Effect moved from another item |

So a base item shows one socket row; a +4-or-better item shows all five.

**Rules that matter to a planner:**
- An exaltation is a **transferable effect**: level an item to the tier that unlocks its effect type, and that effect becomes a removable object named `<Source Item> (Exaltation)`. **The source item loses the effect while it's moved.**
- Exaltations carry their source's **class and slot restrictions and intersect them onto the host** (a 2H proc makes the host primary-only; a WAR/PAL/RNG/SHD proc removes ROG/BRD from a 6-class sword). This can narrow a host out of its own slot.
- Socketing eligibility rule (per Thiole, from `eqlwiki.com/Exaltations`): **same slot + at least one shared class**.
- **Exaltations do not stack** — only the highest rank in a family counts (Mana Preservation I+II+III = III alone). Covering many *different* families is the optimization objective. *(This no-stack claim is sourced to Thiole's reading of the wiki; jmoyers does not restate it.)*
- Sockets survive loadout swaps; the exact exaltation is restored per loadout.

**The hard limit — be clear about this.** Per-item exaltation socket **contents** and tier state are **per-instance data that the wiki does not publish**. I verified this empirically: in jmoyers' 11,375-item scrape, the parsed `exaltationSlots` field is populated on **exactly 1 item** (`Boots of the Long Road`, which hand-writes `Slot: Ornamentation: empty` in its stats block as a one-off). This is consistent — sockets are a function of item *level*, not an item property, so there is nothing per-item to scrape. **A planner should derive sockets from the chosen +N, never look them up.**

What *is* available per-item is the **effect that can be lifted out**: jmoyers tags effects by kind across the catalog — **click 824, combat/proc 453, focus 143, worn 104, effect 52**. Those are your exaltation *sources*.

### 2.3 Live vs. pre-staged content (era gating) — solved, with a caveat

`Thiole/EQLGearPlanner`'s `index.html` contains the most developed availability model found. Chronological era order:

`Classic → Fear → Hate → Paineel → Temple → Sky → Kunark → Epic Quests → Nov 2000 → FearHateRevamp → Velious → Chardok Revamp`

**`CURRENT_ERA = "Sky Era"`** — everything at or below Sky is live; Kunark and beyond are not. This matches the pre-Kunark game scope.

Its logic is more careful than a naive tag filter:
- `available_from` (from the scraper) is preferred: the **latest** era across the item's whole acquisition path — own tag, forge needed, every ingredient, earliest drop zone — i.e. the first era you can actually *hold* one.
- Item's own era = **minimum** across its era tags (tagged Classic + Velious means it existed at Classic and was revised later).
- **Zone gating**: takes the *later* of the item's own era and its earliest reachable zone (Falchion of the Koada'Vie is tagged Classic but drops only in Firiona Vie → Kunark-gated). A hardcoded `ZONE_TABLE` of Kunark/Velious zones takes precedence over a majority poll, because "a zone's expansion is a fact, not a majority opinion" — the poll alone mis-scored Firiona Vie as Classic (25 Classic-tagged items vs 13 Kunark) and left Dreadlands unresolved at 20-20.
- ~30% of wiki item pages carry **no era category at all**; the reference tool leaves unresolvable items **visible** deliberately, since it judges hiding ~1,276 rows on a missing category to be the worse failure. **This project reversed that judgement on 2026-08-17.** Era-less is unconfirmed, not presumed classic: 2,331 era-less records are quarantined, and the 76 that ship do so because the live client export or the player places them. See `research/SOURCING-STANDARD.md` rule 3.
- `revisedLater()` flags items whose displayed stats are probably a post-buff revision.

**Caveat:** `ERA_OVERRIDE` — the map of Kunark/Velious items EQL made available early, which is exactly the interesting edge case — is **empty** in the committed code (`for(const n of [""])`). The mechanism exists; the list was never filled in.

Corroborating era data: `jmoyers-pageEra.json` and `eqlwiki-items-2026-08-03.json` (`era`, `eras`, `era_source`, `era_inferred`, `available_from`, `gated_by`, `out_of_era`, `non_legends`). jmoyers' independent `eraTag` distribution over 11,375 items: **None 3815, Velious 2780, Classic 2620, Kunark 1243, Sky 365, Chardok Revamp 136, Epics 110, Temple 96, EpicQuests 75, FearHateRevamp 53, Fear 27, Luclin 24, Paineel 22, Hate 5**. The large Velious/Kunark/Luclin blocks confirm the wiki is heavily pre-staged with content that cannot be live.

---

## 3. Full file inventory

All paths relative to `/home/user/EQL50ups/research/data/`. "Records" is the parsed top-level count.

### 3.1 Item catalogs (the four competing sources)

| File | Repo / path | Bytes | Records | Schema | Quality |
|---|---|---|---|---|---|
| `jmoyers-items.json` | jmoyers/everquest-companion `src/main/data/items.json` | 8,645,674 | **11,375** | dict keyed by lowercased name → `page, stats{flags,stats[],saves[],effects[{kind,name,detail}],exaltationSlots,extras,weight,size,classes,races}, iconId, eraTag, playerCrafted, craftedBy[{tradeskill,ingredients}], statsBlock` | **Best overall.** Largest + freshest (2026-08-13). Typed effects by kind, preserves raw `statsBlock`, has `iconId`. |
| `nathanbates-items.json` | nathan-bates/eql `data/items.json` | 15,607,257 | 10,923 | flat list; `name,url,slots,slot_raw,focus_effect,focus_effect_source,classes[16 expanded],classes_raw,races_raw,ac,hp,mana,endurance,stats{},saves{},damage,attack_delay,skill,range,effect,effect_detail,casting_time,charges,required_level,recommended_level,weight,size,flags,era,merchant_value,notes,drops_from,player_crafted,categories,has_itempage_template` | **Best normalization.** Flattest, most query-ready; every field present on every row. Has `focus_effect` inline. Also `.csv`. |
| `eqbuddy-ItemCatalog-2026.json` | DranakCorps-bot/EQBuddy `src/EQBuddy.Core/Data/ItemCatalog.json.gz` (decompressed) | 3,353,503 | 10,956 | `{Items:[{Name,StatsText,Slots,Skill,QuestFlagged,DropZones,Classes,Ac,Dmg,Delay,Hp,Mana,Attributes{},Quests,Recipes}]}` | Good breadth, **partial** structure (Ac on 4,590; Attributes on 4,265). `StatsText` verbatim. Strong `Quests`/`Recipes`/`DropZones` linkage. |
| `eqlwiki-items-2026-08-03.json` | Thiole/EQLGearPlanner `items.json` *(pre-existing, not overwritten)* | 10,593,299 | 6,903 | `{source,scraped,count,tiers_included:false,items[],components{4346}}`; item has `id,name,url,tags,slots,classes,races,stats{},effects{},drops[{zone,mobs}],era,eras,era_source,era_inferred,available_from,gated_by,out_of_era,non_legends,vendors,quests,crafted_by,crafted,recipes,foraged,source,zones,categories,size,wt,dmg,skill,delay,range,charges,haste_type` | **Richest acquisition + era metadata**, but a **subset** (6,903). Uniquely carries `available_from`/`gated_by`/`out_of_era`/`non_legends`. |

**Coverage overlap (by item name):**

```
Thiole (6,903) ∩ EQBuddy (10,956)      = 6,758
Thiole (6,903) ∩ nathan-bates (10,923) = 6,759
EQBuddy ∩ nathan-bates                 = 10,921   ← near-identical
Union of all names                     = 11,102
EQBuddy-only vs nathan-bates: 35   |   nathan-bates-only vs EQBuddy: 2
```

EQBuddy and nathan-bates independently harvest the full `Category:Items` (~10,956) and agree almost perfectly — good mutual corroboration. jmoyers uses a different discovery method (`embeddedin Template:Itempage`, ns0) yielding 11,375, a **superset**. Thiole is a deliberate subset (`tiers_included: false`).

### 3.2 Focus effects (exaltation sources) — `nathan-bates/eql`

| File | Bytes | Records | Notes |
|---|---|---|---|
| `nathanbates-focus_effects.json` | 72,365 | **66** | `name,url,description,effects[{slot,effect}]` — full spell-slot breakdown, e.g. *Affliction Efficiency I*: "Decrease Spell Mana Cost by 1% to 23%", "Limit Max Level: 20 (lose 5% per level after)", "Limit Type: Detrimental". **The best focus data found.** |
| `nathanbates-focus_items.json` | 296,245 | **176** | Items carrying a focus, full item schema + `focus_effect`, `focus_effect_source` |
| `nathanbates-raw-focus_effects.json` | 76,708 | 66 | raw pre-normalization |
| `nathanbates-raw-focus_items.json` | 120,086 | 132 | raw |
| `nathanbates-validation.json` | 6,886 | — | counts + discovery provenance: 176 focus items, 66 effects, 103 in `Category:Focus Items`, remainder discovered via effect pages only, 139 items whose effect has a wiki page |
| `nathanbates-by_slot.json` / `.csv` | 170,909 / 42,172 | 17 slots | items grouped by slot |
| `nathanbates-by_class_slot.json` / `.csv` | 1,044,360 / 221,644 | 16 classes | items grouped by class×slot |
| `nathanbates-class_slot_matrix.json` | 5,557 | 16 classes × 17 slots | counts per class/slot |
| `nathanbates-raw-all_items_titles.json` | 274,032 | 10,923 | title list |
| `nathanbates-items_report.json` | 1,433 | — | build report |

### 3.3 Spells

| File | Source | Bytes | Records |
|---|---|---|---|
| `eqbuddy-harvest-spells.json` | EQBuddy `scripts/harvests/eqlwiki/spells.json` | 2,037,781 | 1,929 |
| `jmoyers-spells.json` | jmoyers `src/main/data/spells.json` | 979,146 | 1,928 |
| `jmoyers-spelllines-merged.json` | jmoyers `docs/research/spell-lines/lines-merged.json` | 1,123,276 | 13 classes |
| `jmoyers-class-spells.json` | jmoyers `docs/research/spell-lines/class-spells.json` | 449,050 | 13 |
| `eqbuddy-core-SpellLevels.json` | EQBuddy | 116,486 | 1,427 |
| `eqbuddy-core-CcSpells.json` / `MezSpells` / `SlowSpells` / `RegenSpells` / `BuffDurations` / `DebuffLandings` / `FadeMessages` | EQBuddy | 14k–113k | 174 / 14 / 5 / 4 / — / — / 386 |

Two independent spell scrapes at 1,928 and 1,929 records — excellent agreement.

### 3.4 Quests, zones, NPCs, AAs

| File | Source | Bytes | Records |
|---|---|---|---|
| `eqbuddy-core-QuestCatalog.json` | EQBuddy | 624,246 | 1,172 quests |
| `eqbuddy-harvest-quests.json` | EQBuddy | 785,905 | 1,172 |
| `jmoyers-quests.json` | jmoyers | 572,732 | 905 |
| `eqbuddy-harvest-quest-items.json` | EQBuddy | 91,683 | 4,010 |
| `eqbuddy-harvest-quest-titles.json` | EQBuddy | 24,459 | 922 |
| `eqbuddy-core-EpicQuestChecklist.json` | EQBuddy | 189,556 | 14 classes |
| `jmoyers-posky.json` | jmoyers | 108,880 | 95 (Plane of Sky) |
| `jmoyers-mobs.json` | jmoyers | 3,079,093 | 3 keys (large NPC set) |
| `eqbuddy-core-SpawnCatalog.json` | EQBuddy | 368,155 | 119 zones |
| `jmoyers-respawns.json` | jmoyers | 53,886 | 3 |
| `eqbuddy-harvest-zones.json` | EQBuddy | 8,445 | 116 |
| `eqbuddy-core-ZoneGraph.json` | EQBuddy | 8,386 | 124 |
| `eqlmcp-eqlclient-zones.json` | everquest-legends-mcp | 206,402 | 133 |
| `eqbuddy-harvest-aas.json` | EQBuddy | 70,734 | 6 keys |
| `eqbuddy-core-AaCatalog.json` | EQBuddy | 53,396 | — |
| `thiole-EQLGearPlanner-moblevels.json` | Thiole | 50,940 | 2,124 mobs |
| `thiole-EQLGearPlanner-questlevels.json` | Thiole | 33,193 | — |
| `jmoyers-pageEra.json` | jmoyers | 181,805 | 7 keys |
| `jmoyers-itemsResearch.json` | jmoyers | 13,813 | 63 |

### 3.5 Classes, races, abilities

| File | Source | Bytes | Records |
|---|---|---|---|
| `eqlmcp-eqlbuilds-classes.json` | everquest-legends-mcp (from eqlbuilds) | **3,417,306** | **16 classes** — each with `armor, alternateAbilityList, description, spellList, skillList` |
| `eqlmcp-eqlbuilds-races.json` | " | 26,449 | 15 races |
| `eqlmcp-eqlbuilds-general-abilities.json` | " | 194,879 | 130 |
| `eqlmcp-eqlbuilds-stances.json` | " | 3,613 | 9 |
| `eqlmcp-eqlbuilds-invocations.json` | " | 3,014 | 10 |
| `eqlmcp-eqlclient-races.json` | " (from game client) | 204,372 | 982 |
| `eqlmcp-eqlclient-storylines.json` | " | 249,796 | 50 |
| `eqlmcp-eqlclient-manual-sections.json` | " | 169,938 | 91 |
| `eqlmcp-eqlclient-commands.json` / `eqlmcp-eqlwiki-commands.json` | " | 35,335 / 63,358 | 122 / 265 |
| `thiole-EQLGearPlanner-chardata.json` | Thiole | 6,216 | 15 races, 16 classes — **see warning §5** |

Class list confirmed at **16**: warrior, cleric, paladin, ranger, shadowKnight, druid, monk, bard, rogue, shaman, necromancer, wizard, magician, enchanter, beastlord, **berserker**.
Race list at **15**: human, barbarian, erudite, woodElf, highElf, darkElf, halfElf, dwarf, troll, ogre, halfling, gnome, iksar, kerran, froglok.

### 3.6 Mechanics reference (`research/mechanics/`)

| File | Origin | Why kept |
|---|---|---|
| `jmoyers-itemUpgrade.ts` | jmoyers `src/shared/itemUpgrade.ts` | **The authoritative +N scaling implementation.** Port it. |
| `jmoyers-itemStats.ts` | jmoyers `src/shared/itemStats.ts` | `EXALTATION_SLOT_TYPES`, `expToNextTier`, `unlockedExaltationSlots`, `itemTierFromName`, `itemBaseName`, stat-block parser |
| `jmoyers-itemUpgrade.test.mts` | jmoyers `tests/` | Screenshot-verified fixtures — **port these as your regression suite** |
| `jmoyers-itemLookupParse.ts` | jmoyers `src/main/itemLookupParse.ts` | The full research narrative on tiers + exaltations, with sources and corrections |
| `thiole-tier-and-exalt-model.js.txt` | Thiole `index.html` L460-620 | Superseded model, kept for diffing only |

---

## 4. Licensing

| Repo | License | Implication |
|---|---|---|
| `DranakCorps-bot/EQBuddy` | **MIT** (© 2026 David Edwards) | Safe to reuse with attribution. Has `NOTICE` file — review it. |
| `DavisChappins/eql-tooltip` | **MIT** (© 2026 Davis Chappins) | Safe with attribution. |
| `ArtSabintsev/everquest-legends-mcp` | **MIT** (© 2026 contributors) | Safe with attribution. |
| `jmoyers/everquest-companion` | **Functional Source License v1.1, MIT Future License** | ⚠️ **FSL is source-available, not open source.** It restricts competing use for ~2 years, then converts to MIT. Since this is the repo whose *code* you most want to port (`itemUpgrade.ts`), **review the FSL text before shipping a public gear planner**. The underlying *facts* (game mechanics) are not copyrightable, but the specific expression is licensed. Safest path: reimplement from the documented rules in §2.1 and cite the source, rather than copying the file. |
| `Thiole/EQLGearPlanner` | **NO LICENSE FILE** | ⚠️ Default all-rights-reserved. Do not copy code or data wholesale. |
| `nathan-bates/eql` | **NO LICENSE FILE** | ⚠️ Default all-rights-reserved. Do not redistribute wholesale. |

**Upstream data licensing.** All item/spell/quest data ultimately derives from **eqlwiki.com** (a MediaWiki). Its content license was **not** verifiable from this container (the domain is proxy-blocked). MediaWiki sites commonly use CC-BY-SA, which would impose share-alike + attribution obligations on a derived database — **verify eqlwiki's license before publishing**. Game data is also Daybreak/Game Jawn IP; every repo here disclaims affiliation. One repo (`rari/eqlfinest`, not cloned) declares **CC0** for its own work.

---

## 5. ⚠️ Data that is NOT EQL data — read before using

`thiole-EQLGearPlanner-chardata.json` (race base attributes + per-class attribute adds) carries this **explicit self-disclosure**, quoted verbatim:

> "eqlwiki.com does **NOT** publish these numbers. Its Character_Races page lists racials, starting cities and class options only, and is flagged 'outdated' by its own editors. There is nothing to scrape. So these values are **CLASSIC EVERQUEST values, carried over on the assumption that EQL reuses them. That assumption is UNVERIFIED.**"

The file sets `"verified": false`. Every race is a flat 75/75/75/75/75/75/75 placeholder in the sample inspected. **Do not ship these as EQL stats.**

What *is* verified in that file: **every class adds exactly 30 attribute points, so a 3-class trio is worth 90 to any race** — read from the game client via eqltools.com/attributes. Also noted: EQL has no point allocation at creation, so race + 3 classes fully determines the starting sheet; players report a soft cap of ~150/attribute (unconfirmed).

Similarly **heuristic, not game data** (flagged as such by their authors):
- `stat_weights` / `casting_stat` weights in `chardata.json` — "HEURISTIC, not game data… the melee weights are opinion."
- `FOCUS_WEIGHTS` and `FAMILY_ALIAS` in Thiole's `index.html` — per-class value of each focus family is the author's opinion; the family alias map (Destruction→Improved Damage, Conservation→Mana Preservation, Diuturnity→Extended Enhancement, Pernicity→Spell Haste) is **inferred from the names**, not confirmed.

---

## 6. Recommendation for the gear planner

**Primary item source: `jmoyers-items.json`** (11,375 items, 2026-08-13).
Reasons: largest coverage (superset of both other full scrapes); freshest; effects already typed by `kind` (click/proc/focus/worn) which maps directly onto the exaltation socket types; retains the raw `statsBlock` so you can re-parse without re-scraping; includes `iconId` for UI; includes `craftedBy` with ingredients.

**Join these on item name:**
- `nathanbates-items.json` → flat normalized scalar fields (`required_level`, `recommended_level`, `merchant_value`, `endurance`, split `stats`/`saves`) and inline `focus_effect`.
- `eqlwiki-items-2026-08-03.json` → **`available_from`, `gated_by`, `out_of_era`, `non_legends`** plus `drops[{zone,mobs}]` and `vendors`. Nothing else has these. Covers only 6,903 of ~11.4k, so treat as an enrichment layer, not a base.
- `eqbuddy-ItemCatalog-2026.json` → `Quests`, `Recipes`, `DropZones` cross-links.
- `nathanbates-focus_effects.json` → the 66 focus effects with slot-level detail, for exaltation tooltips.

Name-keying is safe: use `itemBaseName()` (strip ` +N`) — all four datasets key on the wiki's base title, and EQBuddy/nathan-bates agree on 10,921 of ~10,950 names.

**Scaling engine:** implement §2.1 exactly, with the `excelRound` half-away-from-zero rounding and the weight float artifact preserved. Use the Thelvorn / Crown of King Tranix / Axe of Lost Souls / A Ghoul's Heart fixtures as tests.

---

## 7. What is still missing

1. **Per-instance exaltation contents & tier state — unobtainable.** Confirmed absent from the wiki by direct measurement (1 of 11,375 items). This is not a gap in the scrapes; the data does not exist upstream. Planner must model it, not look it up.
2. **Verified EQL race base attributes and per-class adds.** No source has them. Only the "+30 per class / 90 per trio" invariant is confirmed. Requires in-game observation.
3. **The `ERA_OVERRIDE` list** — which Kunark/Velious-tagged items EQL actually made available early. Mechanism exists, list is empty. Requires live-server verification.
4. **Exaltation "no-stack" rule corroboration.** Single-sourced to Thiole's reading of `eqlwiki.com/Exaltations`; not independently confirmed by jmoyers.
5. **Focus-family taxonomy.** Whether Destruction/Conservation/Diuturnity/Pernicity really alias onto Improved Damage/Mana Preservation/Extended Enhancement/Spell Haste is **inferred from names only**. If wrong, socket-optimization advice will be wrong.
6. **Mote ladder conflict — unresolved.** Two repos disagree on the tier names:
   - EQBuddy `Motes.cs`: `Infinitesimal, Minor, Lesser, Greater, Major, Superior, Grand, Ascendant, Infinite` (eqlwiki tier pages, 2026-08-07)
   - Thiole `MOTES`: `Infinitesimal, Minor, Lesser, Potential, Major, Greater, Superior, Grand, Ascendant, Infinite`

   They disagree on the **order of Greater vs Major** and on whether a bare "Potential" occupies a rung. Thiole additionally assigns each mote an xp value (1,1,2,4,5,6,7,8,9,10) and a max-tier cap it refuses to feed above — that xp/cap table is **single-sourced and unverified**.
7. **Exaltation item-level requirements beyond the 5-socket ladder**, drop tables for exaltation tokens, and Marketplace Ornamentation Token details — not in any repo.
8. **eqlwiki.com's content license** — could not be checked (domain blocked). Blocks a confident licensing answer for the derived dataset.

### Leads not pursued (discovered, judged lower value)

`EKirschmann/WarCounsel` (wiki-grounded gear counsel), `rari/eqlfinest` (CC0; spell upgrades, loot filter), `lab1702/eq-legends-top-items` (curated item recommendations), `jungleberrydev/berryworks` (wiki-cache spell JSONs, pets.json), `uija/eqldb-website` (eqldb.org), `Portmantequilla/EQL-Character-Planner`, `blastlaster/eql-log-reader`, `kpxcoolx/eql-alerts` (`eql_permanent_buffs.json`), `samusmylove47-maker/eql-source` (**your own org** — has `assets/sky.json`, `assets/zone-provenance.json`, `public/data/sky.v1.json`, `state/watchlist.json`).
