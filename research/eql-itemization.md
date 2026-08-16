# EverQuest Legends — Itemization & Gear Data Research

Research date: 2026-08-16. Purpose: ground a gear-planner website (sixtyupgrades-style) for EverQuest Legends (EQL) — the standalone MMORPG released July 28, 2026 by Daybreak Game Company + Game Jawn.

Confidence labels used throughout:
- **[CONFIRMED]** — multiple independent sources, or verified directly against downloaded data.
- **[SINGLE-SOURCE]** — one source only; plausible but unverified.
- **[UNKNOWN]** — no reliable information found.
- **[CAUTION]** — source-quality concern (see "SEO-farm warning" below).

---

## 1. Game platform facts

- **[CONFIRMED]** EQL launched **July 28, 2026**; box price + subscription; PvE; developed by indie studio **Game Jawn** (leads are recognized EverQuest **emulator-community** veterans) in collaboration with Daybreak. (Daybreak press release, MMORPG.com GDC 2026 preview, RPG Site.)
- **[CONFIRMED]** Engine: **Unreal Engine 5** (Daybreak press announcement).
- **[CONFIRMED]** Launch content: continents **Antonica, Faydwer, Odus** (pre-Kunark scope), heavily revamped: revised enemies, new named mobs, "more purposeful loot tables," instanced dungeons/raids with difficulty scaling. Monthly content updates; **Kunark expansion announced, date TBD**, and explicitly *not* a 1:1 replay of classic content (RPG Site launch roadmap; everquestlegends.com).
- **[CONFIRMED]** **16 classes** (classic 14 + **Beastlord** + **Berserker**) and **15 races** (including Iksar and Vah Shir at launch). Multiclassing: pick 2 classes at creation (one tied to race), 3rd unlocks at level 10; primary locks at 11; ~560 documented tri-class combos. (eqlwiki Character_Races, eqlegends.wiki, Massively Overpowered, EQProgression; class list corroborated by BER/BST entries in the scraped item data.)
- **[CONFIRMED]** Client is Windows; installs under `\Daybreak Game Company\Installed Games\EverQuest Legends`; writes classic-style chat logs to `...\EverQuest Legends\Logs\eqlog_<Character>_<Server>.txt`; supports **`/outputfile inventory`** (at a banker with "Dragon's Hoard" open) producing `inventory.txt`. (Loadout Legends docs, jmoyers/everquest-companion, DorskFR/eql.)

---

## 2. Item system mechanics

### 2.1 Equipment slots
- **[CONFIRMED — verified against 6,903-item dataset]** Slot vocabulary in community item data is exactly the classic set (18 slot types): `EAR, HEAD, FACE, NECK, SHOULDERS, ARMS, BACK, WRIST, RANGE, HANDS, PRIMARY, SECONDARY, FINGERS, CHEST, LEGS, FEET, WAIST, AMMO`. With doubled Ear/Wrist/Fingers that is the classic **21 worn positions** — eqlplanner.com explicitly models "all 21 gear slots." No CHARM slot, no POWER-source-style slots.
- **[CONFIRMED — multi-source]** **Plus two "Any Slots"** — a new EQL mechanic: two flexible equipment positions that accept qualifying items at **full value**. Confirmed uses: shields (full AC while both hands hold weapons), breastplates (stat stacking), an off-hand/boot dagger enabling Rogue backstab while a different weapon is in primary. (eqlegends.wiki Exaltation/Any-Slot guide, everquestguides.com FAQ, Massively OP multiclass brief.) A planner must model 21 classic slots **+ 2 Any Slots = 23 positions**, with Any-Slot eligibility rules per item ("qualifying items… when requirements are met" — exact eligibility list **[UNKNOWN]**).

### 2.2 Item stats (field vocabulary, verified from scraped wiki data)
From direct analysis of the Thiole/EQLGearPlanner `items.json` (6,903 items scraped from eqlwiki.com on 2026-08-03) — **[CONFIRMED as the wiki's data model]**:
- Attributes: `STR, STA, AGI, DEX, WIS, INT, CHA`
- Defense/pools: `AC, HP, MANA` (`ENDUR` appears on exactly 1 item — endurance exists but is essentially absent from itemization so far)
- Resists: `SV FIRE, SV COLD, SV MAGIC, SV POISON, SV DISEASE`
- `HASTE` (worn haste %, 64 items; `haste_type: "worn"`)
- Weapons: `skill` (1H/2H Slashing, 1H/2H Blunt, Piercing, 2H Piercing, Hand to Hand, Archery, Throwing), `dmg`, `delay`, `range`, plus rare `BACKSTAB` bonus stat
- Misc: `wt` (weight), `size` (SMALL/MEDIUM/LARGE/...), `charges`
- Effects object with four kinds: **`click`** (603 items; casting time + slot restriction e.g. "Any Slot"), **`proc`** (378; named spell + required level), **`focus`** (143; e.g. "Summoning Haste I", "Improved Healing I"), **`worn`** (102; e.g. Ultravision).
- **[CONFIRMED]** **Focus effects exist at launch** (unlike classic pre-Luclin EQ): Improved Damage I–III, Improved Healing I–III, Mana Preservation I–II, Enhancement Haste, Extended Range, Extended Enhancement, Burning Affliction, Affliction Efficiency, Reanimation, Summoning Haste, etc. (eqlwiki Category:Focus_Items, eqlegendstools.com/focus-effects.)
- **[CONFIRMED — absence]** **No heroic stats** anywhere in the 6,903-item dataset; itemization is classic-style. (Heroic-stat search results all pointed to EQ Live, not EQL.)
- **[UNKNOWN]** Whether items carry hidden fields the wiki doesn't capture (e.g. item IDs, recommended level, instrument modifiers — bard mods were not present as a stat key in the dataset).

### 2.3 Restriction flags / tradability
- **[CONFIRMED — verified in dataset]** Tags observed: `MAGIC` (4,564), `LORE` (2,898), `NO_DROP` (2,042), `LORE_EQUIPPED` (103), `TEMPORARY` (99), `QUEST` (89), `NO_TRADE` (82), `EXPENDABLE` (10), `ATTUNEABLE` (4), `NO_RENT` (3), `ARTIFACT` (2). So EQL uses classic NO DROP/LORE plus modern NO TRADE/ATTUNEABLE/LORE EQUIPPED flags.
- **[SINGLE-SOURCE]** July 14, 2026 (beta) patch made all **Motes of Potential no-trade** (everquestguides.com mote guide citing beta Natch Potes).
- **[UNKNOWN]** Whether a Bazaar-style offline trading system exists in EQL.

### 2.4 Class/race restrictions and the multiclass system
- **[CONFIRMED — verified in dataset]** Items carry class lists (`ALL`, `ALL_EXCEPT`, or explicit lists over all 16 classes) and race lists (mostly `ALL`; racial restrictions concentrated in cultural gear: BAR/TRL/OGR/IKS etc.).
- **[CONFIRMED — multi-source]** Interaction with multiclassing: you can use an item if any of your three active classes qualifies. **Armor proficiency follows the highest armor tier among your three classes** (a Paladin class in the trio opens plate for the whole combo); **combat skill caps take the best cap among the three classes** (Massively OP, eqltools.com, eqlegends.wiki).
- **[SINGLE-SOURCE]** Loadout system: saved class loadouts re-equip stored gear sets automatically on swap unless loadouts share a linked gear set (Massively OP brief).

### 2.5 Item upgrade system: levels +0…+10, merging, motes (the defining EQL system)
This replaces a rarity-tier treadmill and is the single most important planner-relevant mechanic:
- **[CONFIRMED — multi-source]** Every piece of gear has an upgrade level ("tier"/"plus level") from **+0 to a max of +10** (eqlwiki Item_Upgrade_System, eqltools.com/learn/upgrades, MMORPG.com review: "merged to give it a bonus ranging from +1 to +10, which upgrades its stats and attached effects").
- **[CONFIRMED — multi-source]** **Merging**: feed an identical duplicate (same name/slot/quality) into a base item; the duplicate is consumed, granting item XP; crossing thresholds raises the + level and lifts stats. Alternative fuel: **Motes of Potential** (Infinitesimal → … → Minor → Major → Grand → Ascendant; ranked, and rank-locked to item tier — e.g. a Mote of Major Potential works on tier ≤4 items only). Two motes of the same rank combine into the next rank. (eqlwiki Mote_Guide, everquestguides.com, everquestlegends-wiki.wiki.)
- **[CONFIRMED]** **Drops come pre-leveled by difficulty**: dungeon difficulty D1 drops **+1 or higher**, D4 drops **+4 or higher**, with diminishing odds to roll above your tier (official Natch Potes via patch-note roundups; eqltools.com/learn/difficulty).
- **[SINGLE-SOURCE]** **Void-touched Potential**: weekly-capped (≤3/week) upgrade material from "raid voidlings" in endgame raids; merges like a mote to push an item **or spell** +1 (everquestlegends-wiki.wiki; corroborated by an Aug 5 official hotfix touching "Void-touched" timers — the currency's existence is effectively confirmed, details single-source).
- **[CONFIRMED]** **Spells also upgrade in ranks** using the same mote economy (multiple wiki guides + official patch notes mention spell upgrades).
- **[CAUTION/DISCREPANCY]** everquestlegends-wiki.wiki-family sites describe merge mechanics consistently with eqlwiki, but sub-details (exact XP thresholds per level, stat-growth-per-level formula) are **[UNKNOWN]** — no source publishes the per-level stat scaling table. The Thiole scrape explicitly says `"tiers_included": false` — i.e., the wiki lists base (+0) stats only. **A gear planner will need the +N stat scaling rule — currently the biggest single data gap.**

### 2.6 Exaltations (the augment system)
- **[CONFIRMED — multi-source]** "Exaltations" are EQL's redesign of EQ's augment system: slottable enhancements on gear, unlocked by the item's upgrade level. **Five slot types** unlock progressively: **Ornamentation (+0), Focus (+1), Click (+2), Worn (+3), Proc (+4)** — a +4 item has all five. Exaltations grant HP/mana/resists/ATK/focus effects etc., are separate from the gear (swappable between items), and augmented group gear can rival unaugmented raid gear. (EQProgression Exaltations page, eqlegends.wiki, eqlwiki Exaltations, everquestlegendswiki.wiki augment guides, eqlegendstools.com Exaltation planner.)
- **[UNKNOWN]** Full Exaltation item list, acquisition tables, and any slot-type restrictions per gear piece — partial data exists on eqlegendstools.com (planner) and eqlwiki, not yet verified here.

### 2.7 Rarity / quality tiers
- **[CONFIRMED — absence]** No evidence of colored rarity grades (common/rare/epic). Progression quality is expressed through the +0…+10 level, era gating, and source (group vs. raid vs. epic quest). One merge-rule quote mentions "same quality tier" as a merge requirement — most plausibly meaning the same + level **[UNKNOWN — ambiguous]**.

### 2.8 Era gating
- **[CONFIRMED — verified in dataset]** eqlwiki tags items with availability eras: `Classic Era` (1,371), `Velious Era` (2,067), `Kunark Era` (900), plus micro-eras mirroring the classic patch timeline (`Temple Era`, `Sky Era`, `Epic Quests Era`, `Fear Era`, `Hate Era`, `FearHateRevamp Era`, `Chardok Revamp Era`, `Paineel Era`, `Nov 2000 Era`). 246 items are flagged `gated_by: zone` (zone not yet in game) and 26 flagged `non_legends`. **Interpretation [CAUTION]**: the wiki pre-catalogs classic-EQ items ahead of EQL availability; since EQL's Kunark will be "altered," pre-staged Kunark/Velious entries are **speculative for EQL** and a planner should filter to `available_from`/era ≤ current live content.

---

## 3. Combat & stat math (for a stat-weight/comparison tool)

Primary formula source: **eqltools.com/combat** ("Combat & Stats — EQ Legends") plus eqlwiki `Statistics` and `Game_Mechanics` pages. eqltools states some values come "straight from the game client" while other mechanics are "inherited from other EverQuest eras and not yet fully confirmed on Legends" — treat numeric constants as provisional.

- **[SINGLE-SOURCE (eqltools), detailed]** Melee resolution: two independent rolls — **Accuracy vs. Evasion** (hit chance) and **Offense vs. Mitigation** (damage). The client's displayed **ATK = Offense + Accuracy**; displayed **AC = Mitigation + Evasion**.
- **[SINGLE-SOURCE]** **Worn-AC cap applies to Mitigation only**: worn AC counts fully to a per-class per-level cap, then at a per-class fraction beyond it; the full 16-class × level cap table "ships in the client"; the stat window prints your own cap; **multiclass takes the best of the three**. **Shield AC counts past the cap** (raises the effective ceiling). Monk-style worn-weight AC bonus exists (additive, threshold ≈ 34 wt). **Evasion is uncapped** (inputs: Defense skill + AGI).
- **[SINGLE-SOURCE (eqlwiki Statistics)]** Soft cap for raw/worn AC at ≤50: `Level * 6 + 25`; "Item Avoidance" cap 100. (Overlaps awkwardly with the eqltools description — the two sites may describe the same cap differently. **[UNKNOWN]** which formulation is exact.)
- **[SINGLE-SOURCE]** **Shielding** = % mitigation of the fixed (non-AC-affected) damage portion — classic-EQ-style DI/DB split implied.
- **[SINGLE-SOURCE (eqltools/eqlwiki Haste Guide)]** **Haste/slow are flat attack-speed values, not classic multiplicative %**. Total haste capped ~**50% below L30, ~75% at L50**; only the highest worn-haste item counts; item/spell/song haste of different types stack; Berserker stance haste (+100%) sits **outside** the haste system; minimum weapon delay ≈ **5** (needs confirmation per source).
- **[SINGLE-SOURCE]** Main-hand **damage bonus scales with level and weapon delay** (not damage) — slow 2-handers gain proportionally vs. high-mitigation targets.
- **[SINGLE-SOURCE (eqlwiki Statistics)]** Stat plumbing: STR→ATK/AC-with-shield contribution; STA→HP; AGI→Evasion; mana from INT or WIS by class archetype (INT: casters/SHD/BRD noted in one snippet — bard mana archetype **[UNKNOWN]**, snippet may be garbled).
- **[UNKNOWN]** Spell damage scaling (no +spell-damage item stat exists; spell power comes from spell rank upgrades + focus effects), resist mechanics math, avoidance formula constants, proc rate (PPM?) rules, dual-wield/double-attack tables. eqltools has "learn" pages (control, trio, difficulty, upgrades) that likely cover more — worth a full crawl.
- **[CONFIRMED]** A DPS-parsing ecosystem exists (EQL Meter, EQLogParser EQL support, EQBuddy, everquest-companion, WarCounsel, Loadout Legends leaderboards) — log combat lines are parseable, so empirical stat-weight validation is feasible.

---

## 4. Item data sources — inventory & assessment

### Tier 1 — the canonical community database
**eqlwiki.com — "EverQuest Legends Wiki"** (MediaWiki)
- **[CONFIRMED]** The de-facto canonical community item DB. Structured item pages (stats, tags, slots, classes, races, drops with zone+mob, vendors, quests, recipes, eras), category system (per-slot, per-class, per-era, Focus Items, Raid Encounters), item icons, spell pages, Game_Mechanics/Statistics articles.
- **[CONFIRMED]** It is a real **MediaWiki with a working `api.php`** — at least four independent projects consume it programmatically (Thiole scrape, EQBuddy weekly harvest, eql-tooltip MediaWiki client + SQLite cache, ArtSabintsev MCP server, everquest-companion icon bundle, EQL Metrics spells.json scraper).
- **Licensing [CONFIRMED]**: `EQLWiki:About` — all original text **CC BY-SA 4.0**; reuse allowed with attribution + share-alike. This makes wiki-derived item data legally clean for a gear-planner site (attribute "EverQuest Legends Wiki," keep BY-SA).
- Coverage **[CONFIRMED]**: ≥6,903 item pages as of Aug 3, 2026 (equipment-focused scrape) and ~10,956 items in EQBuddy's broader weekly harvest (includes non-equipment). Caveats: base (+0) stats only; some pages pre-staged from classic EQ and possibly not Legends-accurate (26 flagged `non_legends` in the scrape); community-verified continuously.
- Egress note: eqlwiki.com is **blocked by this environment's proxy** but freely reachable publicly.

### Tier 1 — ready-made downloadable datasets (GitHub)
1. **`Thiole/EQLGearPlanner`** — https://github.com/Thiole/EQLGearPlanner — an existing (small) EQL gear planner. **Downloaded and analyzed in this session**: `items.json` (10.6 MB, 6,903 items, `"source": "https://eqlwiki.com"`, scraped 2026-08-03) with the full schema listed in §2.2; also `chardata.json`, `moblevels.json`, `questlevels.json`. **This file alone bootstraps a gear-planner database.** Local copy saved at `/tmp/claude-0/-home-user-EQL50ups/b71726cd-1814-503f-880d-c245d5982023/scratchpad/eql/items.json`. Repo has no license file visible **[UNKNOWN]** — but the underlying data is CC BY-SA wiki content.
2. **`DranakCorps-bot/EQBuddy`** — https://github.com/DranakCorps-bot/EQBuddy — bundles a **10,956-item catalog** "refreshed weekly from the community wiki" via `scripts/harvests/refresh.py` + GitHub Actions (`.github/workflows/knowledge-refresh.yml`); harvest data + rerunnable scripts in `scripts/harvests/` (`eqlwiki/`, `eqltools/`, `itemcatalog-build/` — catalog built by a C# `Program.cs`; storage format not confirmed). **Best open reference implementation of a sustainable wiki→DB pipeline.**
3. **`DavisChappins/eql-tooltip`** — eqlwiki MediaWiki client + section parser + SQLite cache (C#).
4. **`ArtSabintsev/everquest-legends-mcp`** — read-only MCP server over eqlwiki api.php, everquestlegends.com news, eqlbuilds.com client dataset, eqlegendstools item pages ("HTML indexing rather than locked APIs"), EQArchives. Useful map of what's programmatically reachable.
5. **`GiuffreLab/eql-metrics`** — scrapes wiki spell pages to `spells.json`.
6. **`lab1702/eq-legends-top-items`** — curated 39-item "worth chasing" markdown list (BiS seed data).

### Tier 2 — fan database sites (scrape targets, no public APIs found)
- **eqlbase.com** ("EQLBase") — sortable DB: items with full stats/effects/drops/merchants, **1,448 spells, 568 zones**, interactive maps, multiclass tools; updated daily (Aug 15, 2026 at search time). No API/export found **[CONFIRMED absence in search; UNKNOWN definitively]**.
- **gnollguard.com** ("Gnoll Guard") — **crowd-sourced from player logs**: desktop app + browser log-upload extract item/mob/zone from `/log` files into a shared drop DB; items, spells (numeric spell IDs in URLs), quests, effects, news. Coverage grows with player submissions; drop-location data here is *empirical* rather than wiki-copied — valuable complement. No public API documented.
- **eqlegendstools.com** ("EQ Legends Tools") — BiS gear search (filter by tri-class/slot/source/zone/stats/effects), weapon-proc lookup, focus-effect lookup, clicky search, **Exaltation planner**, character sheet, Plane of Sky quest tracker; imports `inventory.txt`. Item pages are plain HTML (the MCP server indexes them).
- **eqltools.com** ("EQL Tools") — best **mechanics/formula** reference (combat, difficulty, upgrades, trio, control); has a Sources page citing client data + in-game measurements; also character profiles at eql-tools.com.
- **eqlsource.com** ("EQL Source") — **13 dungeon surveys from primary sources** (population tables, named rosters, loot with drop sources, coordinate maps), searchable loot index, interactive 3D raid guides, character sheet, race/primary calculator; every claim carries a named source + date. High editorial quality; good for verifying drop tables.
- **loadoutlegends.com** ("Loadout Legends") — wearable-item search (by proc/worn/click/focus effect), zone/mob/drop DB, **automatic gear sync from `inventory.txt`**, DPS parser, character/raid leaderboards.
- **eqlplanner.com** ("EQL Gear Planner") — an existing **Magelo-style planner** by the p99planner.com author: full item catalog search, 21-slot loadout, live AC/HP/mana/resists totals by class/race/level. Data "sourced from the EverQuest Legends Wiki (eqlwiki.com — community data) and parsed best-effort." **Direct competitor/prior art for this project.**
- **eqlforge.com** ("EQLForge") — raid guides + loot per boss, voidling locations, patch notes.
- **eqlbuildforge.com** ("EQL Build Forge") — builds, leveling, gear, spells, AA, maps; item pages exist.
- **eqlbuilds.com** ("EQL Builds") — character planner; described by the MCP repo as having a "client dataset" (spells with per-class learn levels, AA, class/race/zone reference — possibly client-extracted) **[SINGLE-SOURCE]**.
- **eqlegendsdb.com**, **eqlegends.tools**, **beecanyonretro.com** (offline character builder), **eqlmeter.com**, **itemlevel.net** — smaller/secondary tools.
- **eqarchives.com** — classic-EQ historical BiS corpus (useful cross-reference only).

### Tier 2 — official
- **everquestlegends.com** — official site: news + **"Natch Potes" patch notes** (e.g. 7-14, 7-28, 7-29, 8-4 2026) — the only *official* itemization changelog (loot-table changes, proc removals, drop-rule changes). **No official item database or API found [CONFIRMED absence in searches]**. Discord `#natch-potes` mirrors notes; official Discord ~38k+ members.

### SEO-farm warning **[CAUTION]**
A cluster of near-identical AI-generated "wiki" domains exists: `everquestlegends-wiki.wiki`, `everquestlegendswiki.wiki`, `everquest-legends-wiki.wiki`, `everquestlegends.wiki`, `eqlegends.wiki`, `everquestlegends.online`, `itemlevel.net`. Their mechanics articles broadly agree with primary sources and occasionally add useful detail (mote ranks, D1–D4 loot rules, Void-touched caps), but they cross-plagiarize and carry no sourcing. Use only as leads; verify against eqlwiki/eqltools/official notes. eqlwiki.com and eqlsource.com are the trustworthy ends of the spectrum.

---

## 5. Game files / datamining

- **[CONFIRMED]** UE5 client → community datamining would go through **.pak/.utoc/.ucas archives with FModel/CUE4Parse**, but **no evidence was found of anyone datamining EQL item data from the client**. Every community tool without exception works from (a) the wiki, (b) chat logs, or (c) `/outputfile` dumps, and tools prominently advertise "no game files touched, no memory read" — the community is deliberately conservative (subscription game, EULA).
- **[SINGLE-SOURCE]** Some reference data demonstrably ships in the client and has leaked into tools: eqltools' per-class/per-level skill-cap and AC-cap tables "come straight from the game client"; eqlbuilds.com hosts a "client dataset" (zones, races, spell learn-levels). Mechanism unpublished.
- **[INFERENCE, flagged]** Given Game Jawn's EQEmu pedigree and the faithful reproduction of classic flags/stats/log formats, item definitions are very likely **server-side** (EQEmu-style items table), i.e., *not* fully minable from the client even in principle — crowd/wiki sourcing will remain the path. No source states this outright.
- **[CONFIRMED]** Log/output surface: `eqlog_<Character>_<Server>.txt` (classic-format combat/loot/chat lines; parsed by ≥8 open-source tools) and `inventory.txt` via `/outputfile inventory` (P99-style dump listing slots + item names; known gap: wind-rune currencies omitted). Item stats do **not** appear in logs — logs give item *names* + drop context; stats must come from a database. Useful planner feature: import `inventory.txt` (Loadout Legends, eqlegendstools, DorskFR/eql all do this).
- MacOS players run the Windows client via Wine/DXMT (osxEQL) — confirms DirectX 11 Windows build, no native Mac/Linux client.

---

## 6. Endgame gear landscape (what the planner must cover)

- **[CONFIRMED]** Difficulty system **D0–D4** on instanced content (D2 "Veteran", D3 "Champion", D4 "Legend"); higher difficulty = higher base + level drops (D4 → +4 minimum), more motes, best XP; raids scale from solo-capable personal instances (with **personal loot**) up to 8-player classic raids; **loot lockouts** exist (loot-locked bosses still grant one guaranteed unique-table drop + chance at standard loot).
- **[CONFIRMED]** Marquee endgame targets at launch: **Lord Nagafen** (L55 warrior-type dragon, ~32,000 HP per eqlforge — single-source number), **Lady Vox**, **Cazic-Thule**, **Innoruuk**, and the **Plane of Sky** island gauntlet (key progression per island; much of its best gear from **class quests** rather than drops).
- **[CONFIRMED]** Hardest dungeon tier: Nagafen's Lair (40–50), then Lower Guk / Cazic-Thule (35–45); The Hole, Splitpaw, The Warrens, Mistmoore, Kedge also endgame-relevant (Aug 4 patch touched all).
- **[CONFIRMED]** **Epic quests** exist at launch ("Epic Quests Era" items in wiki; class-defining weapons; "rival or exceed raid drops for specific slots").
- **[SINGLE-SOURCE]** Weekly cadence gearing loop: raid voidlings → ≤3 Void-touched Potential/week → +1 item/spell rank. Upcoming content: Aug 18 Mistmoore preview, Deity Achievements, Rujarkian Hills open-world zone, Nektropos Castle mini-expansion, then Kunark.
- BiS discussion venues: eqlegendstools BiS search, everquestlegends-wiki.wiki best-gear guides [CAUTION], lab1702 top-items list, class Discords. No authoritative maintained BiS lists comparable to EQProgression's classic lists yet — a genuine niche for this project.

---

## 7. Verdict — best path to a usable item database

1. **Bootstrap now** from `Thiole/EQLGearPlanner`'s `items.json` (6,903 equipment items, clean JSON, schema in §2.2, already downloaded to scratchpad). Immediate, zero-scrape start.
2. **Build a sustainable pipeline against eqlwiki.com's MediaWiki API** (`api.php`) — the canonical, CC BY-SA 4.0-licensed source that every serious tool (EQBuddy, eql-tooltip, eqlplanner, MCP servers) already consumes. Clone the approach in `DranakCorps-bot/EQBuddy`'s `scripts/harvests/refresh.py` + weekly GitHub Action. Filter by `available_from`/era and `non_legends` flags. Attribute the wiki; keep derived data share-alike.
3. **Enrich** with: Gnoll Guard's empirically crowd-sourced drop locations; eqlsource.com's sourced dungeon loot surveys (verification layer); eqlegendstools' Exaltation/focus/proc reference; official Natch Potes as the change feed; spell data from eqlbase/eqlwiki for clicky/proc/focus tooltips.
4. **Do not plan on client datamining** — UE5 pak extraction has no community precedent for EQL and item data is likely server-side.
5. Ship an `inventory.txt` importer — the established community mechanism for character sync.

### Biggest data gaps
1. **+0→+10 stat scaling**: no public per-level stat/effect growth table; wiki stores +0 stats only (`tiers_included: false`). Must be crowdsourced/measured — the planner's hardest problem and biggest differentiation opportunity.
2. **Exaltation catalog**: no complete machine-readable list of Exaltations, their stats, and acquisition.
3. **Combat constants**: haste-cap values, delay floor, damage-bonus formula, AC-cap tables (exist in client per eqltools, not published as data), avoidance/proc-rate math — mostly single-source (eqltools) and partially unverified on Legends.
4. **Any-Slot eligibility rules** per item (no structured field for it in wiki data).
5. **Drop rates** (Gnoll Guard has counts but no published rates; eql-log-reader borrows Project Quarm baselines — proxy data, not EQL).
6. **Item IDs**: no numeric item IDs surfaced anywhere (wiki uses page names) — the planner will need its own stable ID scheme.

---

## 8. Sources

Primary / high-trust:
- https://eqlwiki.com — EverQuest Legends Wiki (MediaWiki; CC BY-SA 4.0 per https://eqlwiki.com/EQLWiki:About). Key pages: /Equipment_By_Slot, /index.php/Statistics, /Game_Mechanics, /index.php/Item_Upgrade_System, /Mote_Guide, /Exaltations, /Haste_Guide, /Character_Races, /Category:Focus_Items, /Category:Raid_Encounters, /Difficulty_Level
- https://www.everquestlegends.com — official site; Natch Potes: /patch-notes/eql-update-notes-7-14-2026, -7-28-2026, -7-29-2026, -8-4-2026
- https://www.daybreakgames.com/press/eqlegends/article/dbg-eql-announce — announcement (UE5, Game Jawn)
- https://www.mmorpg.com/previews/gdc-2026-everquest-legends-aims-to-recreate-classic-everquest-but-more-approachable-for-new-players-2000137614 ; https://www.mmorpg.com/reviews/everquest-legends-review-playing-like-its-1999-2000138654
- https://www.rpgsite.net/news/20980-everquest-legends-available-today-launch-roadmap-shared
- https://massivelyop.com/2026/04/11/everquest-legends-briefs-players-on-its-multiclassing-and-class-loadout-systems/
- https://eqltools.com/combat ; https://eqltools.com/learn/upgrades ; https://eqltools.com/learn/difficulty ; https://eqltools.com/learn/control ; https://eqltools.com/sources
- https://eqlsource.com/ (dungeon surveys, loot index, raid guides)
- https://www.eqprogression.com/legends/ (multi-class-gameplay, exaltations, spells, faq)

Databases / tools:
- https://eqlbase.com/ · https://www.gnollguard.com/ (+ /items /spells /quests /download) · https://eqlegendstools.com/ (+ /bis-gear /focus-effects /weapon-procs /char-sheet) · https://www.loadoutlegends.com/ (+ /database/items) · https://eqlplanner.com/ · https://eqlforge.com/raids (+ /raid/lord-nagafen, /raid/plane-of-sky, /voidlings) · https://eqlbuildforge.com/ · https://eqlbuilds.com/ · https://eqlegendsdb.com/ · https://eqlegends.tools/ · https://eqlmeter.com/ · https://www.beecanyonretro.com/ · https://eqarchives.com/

GitHub:
- https://github.com/Thiole/EQLGearPlanner (items.json — analyzed in session)
- https://github.com/DranakCorps-bot/EQBuddy (10,956-item weekly wiki harvest; scripts/harvests/)
- https://github.com/DavisChappins/eql-tooltip · https://github.com/ArtSabintsev/everquest-legends-mcp · https://github.com/GiuffreLab/eql-metrics · https://github.com/jmoyers/everquest-companion · https://github.com/DorskFR/eql · https://github.com/lab1702/eq-legends-top-items · https://github.com/blastlaster/eql-log-reader · https://github.com/kpxcoolx/eql-meter · https://github.com/EKirschmann/WarCounsel · https://github.com/sowoky/osxEQL · https://github.com/topics/eq-legends

Lower-trust (SEO-farm cluster — leads only):
- https://everquestlegends-wiki.wiki/ · https://www.everquestlegendswiki.wiki/ · https://everquest-legends-wiki.wiki/ · https://everquestlegends.wiki/ · https://eqlegends.wiki/ · https://everquestlegends.online/ · https://itemlevel.net/ · https://www.everquestguides.com/ · https://www.wutshot.com/
