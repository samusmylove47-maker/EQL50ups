# Sixty Upgrades / Seventy Upgrades — Functional & UX Specification

**Purpose:** Research dossier on sixtyupgrades.com (WoW Classic gear planner) and its siblings
seventyupgrades.com (TBC) and eightyupgrades.com (WotLK), compiled to guide an equivalent tool for
EverQuest Legends.

**Method & evidence key:** The research proxy blocked direct fetches of the sites, so everything
below was mined from ~30 web searches (Reddit/teddit mirrors, Barrens Chat and Warcraft Tavern
forums, Blizzard forums, YouTube video listings, Wowhead, Similarweb, GitHub issues, indexed page
titles/URLs of sixtyupgrades.com itself). Each claim is tagged:

- **[S]** — directly evidenced in search snippets / indexed URLs & page titles.
- **[C]** — corroborated by multiple independent snippets.
- **[K]** — background knowledge of the sites consistent with the evidence, but not directly
  confirmed by a snippet in this pass; verify against the live site before treating as gospel.

---

## 1. What the product is

A **free, account-based, single-purpose web app for planning, tracking, and sharing gear sets** for
WoW Classic characters. Official self-description (indexed meta text): *"Plan, track and share gear
sets for your World of Warcraft Classic characters"*, *"Keep track of your gear sets and plan your
progression through all levels and content phases"*, and *"Create custom equivalency points and
browse available items by their relative value."* **[C]**

Origin story (from the creator, "Grits", on Warcraft Tavern forum + Patreon): it *"started out as a
little project to replace spreadsheets for gear planning in Classic WoW."* **[S]** That is the
essential product thesis: **replace the class-community BiS spreadsheet** with a fast, shareable,
game-authentic web app.

It is a hobby/passion project funded by a Patreon (patreon.com/sixtyupgrades) whose goals *"reflect
current infrastructure costs."* **[S]** No evidence of paywalled features or ads was found; the tool
itself appears fully free (registration required only to save). **[C]**

### 1.1 The family and its consolidation

| Site | Game | Status |
|---|---|---|
| sixtyupgrades.com | WoW Classic (level 60) — launched 2019 | Flagship domain **[C]** |
| seventyupgrades.com | TBC Classic (level 70) — launched Feb 2021 ("Seventy Upgrades — TBC gear planner is now live!", r/classicwow) | Now serves the same app; website.informer shows its title as "Sixty Upgrades" → alias of sixtyupgrades.com/tbc **[S]** |
| eightyupgrades.com | WotLK Classic (level 80) | Alias — its indexed title is "Sixty Upgrades — World of Warcraft: Wrath of the Lich King Classic Gear Planner" **[S]** |
| ("eighty-five upgrades") | Cataclysm | Never got its own domain; a Blizzard-forum user noted "85 upgrades wasn't coming" — instead it shipped as sixtyupgrades.com/cata **[S]** |

**One codebase, per-game route prefixes** (all directly observed in indexed URLs) **[S]**:
`/` and `/era` (Classic Era), `/sod` (Season of Discovery), `/tbc`, `/wotlk`, `/cata`.
Each game version has its own item database, talent trees, login/register routes
(`/tbc/login`, `/sod/register`, …), character list (`/tbc/characters`), and item browser
(`/era/items`, `/items`). **[S]**

**Lesson for the clone:** brand by level cap / era is memorable, but plan the URL architecture as
`domain.com/{ruleset}/…` from day one so new eras (progression servers, expansions) are routes, not
new products. Keep old domains as aliases.

---

## 2. Information architecture & data model

Observed URL structure implies this hierarchy **[S]**:

```
Account
 └─ Characters                    /{game}/characters, /{game}/characters/new
     └─ Gear Sets                 /{game}/character/{charId}/sets/new
         ├─ Gear (default tab)    /{game}/set/{setId}
         ├─ Talents tab           /{game}/set/{setId}/talents
         ├─ Buffs tab             /{game}/set/{setId}/buffs
         └─ Model tab (3D view)   /{game}/set/{setId}/model
Standalone Talent Calculator      /{game}/talents/{class}[/{buildCode}]
Item Browser                      /{game}/items
```

- **Set IDs** are ~22-char base62 short IDs (e.g. `sixtyupgrades.com/set/jrNhws7xF4oNJyij7sWcG4`,
  `eightyupgrades.com/set/mr1MM51E7t6Tq86PLhJdsu`) — unguessable, shareable, no login needed to
  view. **[S]**
- **Set page `<title>` format:** `"{Set name} - {Character name} - Sixty Upgrades - {Game}"`,
  e.g. *"P5 (R12, Hit Scope) - Alliancebis - Sixty Upgrades - Classic Era"* and *"Currently
  Equipped - Rarapriest - Sixty Upgrades - Season of Discovery"*. **[S]** Players name sets after
  phase / rank / purpose ("Currently Equipped", "P5 BiS", "Pre-raid") — the tool leans into
  many-sets-per-character as the core mental model.
- A **"Currently Equipped"** set per character is a first-class convention (seen in the wild),
  giving a baseline to diff planned sets against. **[S]** (whether it's system-generated or just
  user convention: **[K]** — likely a user-named set, possibly fed by the Linked Characters
  feature below.)
- **Linked Characters** (YouTube: "Linked Characters on Sixty/Eighty Upgrades", Apr 2024): links a
  character across the sites/games (e.g. carry a character from Classic into the TBC planner as
  realms progress). **[S]** exact mechanics **[K]**.
- **Characters** are created with name, class, race/faction, level (and per-game extras like SoD
  runes). **[K]** (creation pages `/characters/new` confirmed **[S]**; field list inferred.)

---

## 3. Core tools

### 3.1 Gear set builder (the heart of the product)

- **Paper-doll of all equipment slots** (head, neck, shoulder, back, chest, wrist, hands, waist,
  legs, feet, rings ×2, trinkets ×2, main/off-hand, ranged) that you fill slot by slot. **[K]**
  (universally described as a "gear planner" with per-slot enchant lists in guides; exact layout
  unverified this pass.)
- **Click a slot → item picker** listing every item equippable in that slot for your class/level,
  **ranked by score under the active stat weights**, with name search and filters. Corroborating
  snippets: *"browse available items by their relative value"* **[C]**; *"narrow gear down by
  source"* **[C]**; item DB spans quality tiers Poor→Legendary **[S]**.
- **Filters** include content **phase**, **source** (raid, dungeon, quest, PvP rank, profession,
  world drop), slot, and quality. Phase filtering is a headline concept — *"plan your progression
  through all levels and content phases."* **[C]**
- **Enchants per slot** are part of a set (guides list per-slot enchants copied out of the tool;
  autofill "generates entire gear sets **with enchants**"). **[C]**
- Per-game extenders: **gems/sockets** (TBC+), **glyphs** (WotLK — competitor BisBeard advertises
  parity on "talents, glyphs, sockets, gems, enchants"), **runes** (SoD), **reforging** (Cata).
  **[S]** for gems in export payloads & Cata planner existing; **[K]** for exact UI.

### 3.2 Stat weights / Equivalency Points (EP) — the differentiator

- Users select a **preset EP profile per class/spec** or define **custom weights**. Presets are
  curated with input from class theorycrafters and *"evolve as more theorycrafting happens"*
  (creator, launch thread). **[S]**
- **Scoring formula** (from user documentation of the tool): *"Each weight value is multiplied by
  an item's stat points and then added together to get the item's total score."* Linear
  Pawn/EP-style dot product. **[S]**
- Example real weight set circulating for the tool: `str/AP 1, agi 2.35, stam 2.4, health 0.24,
  hit rating 5, expertise 5`. **[S]**
- Every item list is sortable/ranked by EP score, which is what makes the picker an implicit
  **"upgrade finder."** **[C]**
- **Auto-fill / generate BiS**: *"It can generate entire gear sets with enchants for you if you
  provide it with a custom stat equivalence list and narrow gear down by source."* **[C]**
  Known, creator-acknowledged limitations of autofill (great checklist for the clone):
  - it can **overshoot stat caps** (e.g. hit% past the cap keeps scoring) **[S]**
  - it **ignores set bonuses** **[S]**
  - creator's framing: autofill is *"a quick starting point for a set,"* not an optimizer. **[S]**

### 3.3 Stat summary panel

- Every set shows computed character stats: primary attributes, attack power, crit, hit, spell
  power/healing, MP5, defense/armor, resistances — the standard Classic stat sheet, updating live
  as items change. **[K]** (Existence is certain from the product's purpose and Wowhead's
  competing planner advertising "resulting stats, secondary stats, and resistances"; exact
  grouping unverified.)
- Stats respect **caps awareness** demand from users (hit cap discussion above) — a clone should
  color-code capped/wasted stats. **[K]** (derived from user complaints.)

### 3.4 Buffs / consumables tab

- Dedicated **Buffs sub-page per set** (`…/set/{id}/buffs`). **[S]**
- At TBC launch users explicitly requested *"the ability to add different raid buffs to stats …
  helpful for predicting armor caps for druid tanks"* — the tab exists now, so raid/world
  buffs & consumables can be toggled into the stat computation. **[S]** for request + tab
  existing; **[K]** for exact buff list granularity.

### 3.5 Talent calculator

- Full standalone talent calculator per game & class: `/{game}/talents/{class}` (e.g.
  `/era/talents/mage`, `/tbc/talents/paladin`). **[S]**
- Builds serialize into **shareable URL codes**: `/tbc/talents/paladin/2BE1BECGHIo3PNTo0BD1Q`. **[S]**
- Talents also attach to a gear set via the set's Talents tab, and a **"Copy to Set"** button moves
  a standalone build into a set. **[S]** (button text observed in indexed page text.)
- Talents matter to stats (talent-granted crit/hit etc.) — presumably included in the stat panel.
  **[K]**

### 3.6 3D model viewer

- **Model sub-page per set** (`…/set/{id}/model`) — renders the character wearing the planned
  gear (dressing-room style). **[S]** (existence); rendering details **[K]**.

### 3.7 Item tooltips & comparison

- Items display as **WoW-authentic tooltips** with quality colors (Poor grey → Common white →
  Uncommon green → Rare blue → Epic purple → Legendary orange), full stat blocks, and the item's
  EP score; hover-compare against the currently slotted item with green/red deltas. **[K]**
  (quality-color item DB confirmed **[S]**; tooltip fidelity/delta display from product knowledge —
  verify.)
- Users comparing candidate drops mid-progression is a primary workflow (see §6). **[C]**

### 3.8 Set comparison

- The product's tagline workflow ("plan progression across phases") plus per-character multi-set
  model supports set-vs-set diffing; a Jan 2022 community video ("Seventy Upgrades got an
  UPGRADE!!") showcased a then-new feature, and stat panels can be compared across sets. Direct
  evidence of a formal side-by-side diff view was **not** found this pass — treat "explicit A/B
  compare view" as **[K]/unconfirmed**; at minimum the clone needs per-set stat totals that make
  manual comparison trivial, and should consider making the diff explicit (delta column between
  two chosen sets) since that's the spreadsheet behavior being replaced.

### 3.9 Item browser

- Global **Items page** per game (`/{game}/items`) — browse/search the full item DB outside any
  set, ranked by active EP. **[S]** (existence) **[K]** (details).

---

## 4. Accounts, sharing, import/export

| Capability | Detail | Evidence |
|---|---|---|
| Registration | Email register/sign-in per site (`/{game}/register`, `/{game}/login`). Needed to **save** characters/sets. Early user gripe: "requires registration to save; local storage would be nice for temporary use." | **[S]** |
| Free | No paid tier found; Patreon donations cover infra. | **[C]** |
| Share links | Every set gets a permanent short URL `…/set/{~22-char id}`; anyone can view without an account. Talent builds get their own code URLs. | **[S]** |
| Guild workflow | Users at launch: "getting shareable links for guild feedback" was a top-praised feature. | **[S]** |
| Export (JSON) | Sets export to JSON containing item names, IDs, enchants, gems, and slot assignments; consumed by the WowSims simulator ("Import from Eighty Upgrades" flow; occasional format-drift bugs filed on GitHub). | **[S]** |
| Export → in-game | Third-party addon "Sharpie's Gear Judge": *"copy your Sixty Upgrades export, then type `/sgj import` in-game and paste"* — the site's export string is a de-facto interchange format. | **[S]** |
| Import | tbcsim GitHub issue "Import gear from seventyupgrades" shows sim-tool demand for the format. Direct armory/addon **import into** the site: unconfirmed this pass. | **[S]/[K]** |
| Community distribution | Creator posts continuous changelogs on **Discord**, periodic roundups on **Reddit**; tutorials and update videos are community-made on YouTube. | **[S]** |
| Public gallery | No evidence of a browsable public set gallery; discovery happens via links pasted in guides/forums/Discord (XPOff twink guides, Barrens Chat resource lists, wowhead comments all link `…/set/…` URLs). "BiS list browsing" is thus **social, not in-app**. | **[C]** |

---

## 5. UI / UX

**Directly-quoted user sentiment** (launch thread + forums) — this is the design bar the clone must
meet:

- *"Impressed at how polished the site looks… great functionality"* (Barrens Chat). **[S]**
- *"Really well made… smooth feel, clean UI, great performance; strong frontend skills"* (r/classicwow launch thread). **[S]**
- *"Better than the Wowhead planner I had been using."* **[S]**
- Similarweb: ~1:22 avg visit, 2.5 pages/visit, ~37% bounce — quick-reference tool usage pattern. **[S]**

**Visual language** **[K]** unless noted:

- **Dark theme** matching WoW's UI sensibility; item art in square bordered icons.
- **Item quality colors** everywhere (grey/white/green/blue/purple/orange — DB includes all tiers **[S]**).
- **Class colors** for character identity (warrior tan, mage light blue, etc.).
- **Game-authentic tooltips** — stat lines in white/green exactly as in-game, so screenshots of the
  planner read like screenshots of the game. This authenticity is a big part of why players trust
  it over generic table UIs.
- **SPA responsiveness**: instant slot swaps and live stat recomputation; no page reloads —
  repeatedly praised as "smooth"/"performance." **[C]**
- Left paper-doll / right item-list-and-stats arrangement. **[K]** (layout unverified; some layout
  places stat summary alongside the doll.)

**Known complaints / gaps** (each is a requirement or explicit-non-goal for the clone):

1. Must register to save anything (no anonymous scratch mode). **[S]**
2. Autofill ignores stat caps and set bonuses. **[S]**
3. Preset EP quality depends on volunteer theorycrafters; presets lag patches until curated. **[S]**
4. New-era coverage arrives when the creator ships it (users begged for a Cata planner). **[S]**
5. Format drift breaks downstream consumers (WowSims JSON import bug). **[S]**

---

## 6. Ecosystem position & typical workflows

- **Competitors:** Wowhead Gear Planner (biggest), Warcraft Tavern's planner, BisBeard (WotLK),
  Mr. Robot (abandoned Classic). Similarweb lists wowhead.com, icy-veins.com, warcrafttavern.com as
  seventyupgrades.com's top "competitors." **[S]**
- **Why users prefer it over Wowhead** (from forums): lighter and focused ("lighter, more focused
  tools compared to heavier alternatives like Wowhead" — Barrens Chat) **[S]**; cleaner/faster UI
  **[S]**; EP-driven ranking + autofill that Wowhead's planner historically lacked **[C]**;
  character-centric multi-set organization vs Wowhead's one-off planner links. **[K]**
- **Division of labor with simulators:** sixty/seventy/eightyupgrades = planning + eyeballing EP
  values; WowSims/tbcsim = ground-truth DPS simulation, importing the planner's JSON. A clone for
  an MMO without mature sims makes the EP layer even more central. **[C]**
- **Typical workflows** (all evidenced in community usage):
  1. **Pre-launch/pre-raid planning:** build phase-1 BiS from dungeon/quest/PvP sources before the
     game or phase launches; the TBC site launched months before TBC itself and was immediately
     popular. **[S]**
  2. **Progression laddering:** one set per phase ("P5 (R12, Hit Scope)"), tracking what to chase
     next. **[S]**
  3. **Guild/loot-council sharing:** paste set link in Discord for feedback or loot
     justification. **[S]**
  4. **Mid-raid drop evaluation:** check a fresh drop against your plan (fast tooltip compare). **[C]**
  5. **Guide authorship:** class guides (XPOff, Warcraft Tavern, YouTube descriptions) embed set
     links as living BiS lists. **[S]**
  6. **Sim handoff:** export JSON → WowSims for DPS validation. **[S]**
- **Scale reference:** seventyupgrades.com alone ~14K visits/month years after TBC's era, global
  rank ~60K in games category; sixtyupgrades traffic arrives mostly from YouTube, then Reddit. **[S]**

---

## 7. Feature inventory (with clone priority for EverQuest Legends)

Priority: **P0** = defines the product, **P1** = expected, **P2** = differentiator/deferred.

| # | Feature | How it works (sixty/seventyupgrades) | Priority for EQL clone |
|---|---|---|---|
| 1 | Slot-by-slot gear set builder | Paper-doll; click slot → searchable, EP-ranked, filterable item picker for that slot/class/level | **P0** |
| 2 | Item DB with phase/source/quality filters | Per-era DB; filter by content phase, source (raid/dungeon/quest/faction/crafted/PvP), quality, slot | **P0** (map to EQL expansions/eras & sources) |
| 3 | Live stat summary panel | Full character sheet recomputed on every change | **P0** |
| 4 | Stat weights / EP system | Curated presets per class/spec + fully custom weights; linear score = Σ(stat × weight); drives all ranking | **P0** (the differentiator) |
| 5 | Shareable set URLs | Permanent short-ID links, view without login; title = set + character name | **P0** |
| 6 | Characters → many named sets | Account → characters → sets ("Currently Equipped", "P3 BiS"…) | **P0** |
| 7 | Game-authentic tooltips + quality/class colors, dark theme | Visual fidelity to the game client | **P0** (EQ item-window fidelity) |
| 8 | Augments/enchant layer per slot | Enchants (+gems/runes/glyphs per era) included in sets & stats | **P1** (EQ: aug slots are core — arguably P0) |
| 9 | Buffs/consumables toggle tab | Set-level buff selections folded into stats | **P1** |
| 10 | Auto-fill best set from weights | Greedy fill by EP within filters, incl. enchants; known caveats: caps, set bonuses | **P1** (ship with cap-aware scoring to beat the original) |
| 11 | Talent/AA calculator with share codes, attachable to sets | Standalone tree per class + URL-encoded builds + "Copy to Set" | **P1** (EQ: AA planner) |
| 12 | Export to JSON / sim & addon interchange | Stable JSON (items, IDs, enchants, gems, slots); consumed by sims and in-game addons | **P1** (publish a versioned schema) |
| 13 | Item comparison vs equipped (delta tooltips) | Hover compare with stat deltas | **P1** |
| 14 | Standalone item browser ranked by EP | /items page, search whole DB | **P1** |
| 15 | Multi-era support under one app | Route-per-ruleset (/era /sod /tbc /wotlk /cata), alias domains | **P1** (EQL: route per server-era) |
| 16 | 3D model preview of a set | /model tab per set | **P2** |
| 17 | Linked characters across eras | Carry a character between game versions | **P2** |
| 18 | Explicit set-vs-set diff view | Weakly evidenced in original; users do it via two tabs | **P2** (opportunity to leapfrog) |
| 19 | Import from game/armory/addon | Not clearly offered by original (demand exists) | **P2** (EQL: /outputfile-style paste import would be loved) |
| 20 | Public set gallery / BiS browsing in-app | Absent in original; discovery is social via links | **P2** (optional; original proves it's not required) |
| 21 | Anonymous scratch mode (no login) | Absent; a documented gripe | **P1** for clone (fix their #1 complaint) |
| 22 | Free + donation-funded, no ads | Patreon covers infra; goodwill is part of the brand | **P0** decision to make consciously |

---

## 8. UX notes distilled for the clone

1. **Speed is the brand.** Every piece of praise mentions smoothness/performance. Client-side SPA,
   item DB pre-loaded/indexed for the chosen class, zero-latency slot swaps, instant stat recompute.
2. **Authenticity is trust.** Tooltips, quality colors, class colors, and dark palette must read as
   the game. A planner that "looks like EverQuest" will win over a generic table the same way.
3. **The URL is the product.** Cheap, permanent, login-free set links are what made it the lingua
   franca of guild Discords and guide authors. Short IDs, human page titles
   ("{Set} – {Character} – {App}"), good OG/embed previews.
4. **EP/stat-weights turn a database into an advisor.** Curated presets (recruit class experts,
   credit them) + full customization + rank-everything-by-score. Do the original one better:
   cap-aware and set-bonus-aware scoring, with capped stats visually flagged.
5. **Model progression, not a single loadout.** Character → many sets across phases/eras is the
   spreadsheet-replacement insight. Include a "Currently Equipped" baseline and make diffs easy.
6. **Keep scope tight.** No guides, no news, no forums — those live elsewhere; the tool integrates
   into that ecosystem via links and exports rather than replacing it.
7. **Publish a stable export schema** early; downstream tools (sims, addons, spreadsheets) adopting
   your format is a moat (WowSims/Gear Judge effect) — and version it so you don't break them.
8. **Community changelog cadence:** Discord for continuous changes, Reddit/forum roundups every few
   weeks, and let YouTubers make the tutorials.
9. **Fix their gripes:** anonymous scratch sessions with a "sign in to keep this" upsell; autofill
   that respects caps/set bonuses; era coverage planned up front.

---

## 9. Sources

Primary indexed pages of the sites themselves (titles/URLs/meta text mined via search):
- https://sixtyupgrades.com/ — "Plan, track and share gear sets…"
- https://sixtyupgrades.com/tbc , https://sixtyupgrades.com/wotlk , https://sixtyupgrades.com/cata , https://sixtyupgrades.com/sod , https://sixtyupgrades.com/era/items , https://sixtyupgrades.com/items
- https://eightyupgrades.com/ (title: "Sixty Upgrades — WotLK Classic Gear Planner"), https://eightyupgrades.com/set/mr1MM51E7t6Tq86PLhJdsu
- Set/sub-page URL evidence: https://sixtyupgrades.com/set/jrNhws7xF4oNJyij7sWcG4 ; https://sixtyupgrades.com/set/qLZRDPuxxhQ1oJavEdCG9i ("P5 (R12, Hit Scope) - Alliancebis") ; https://sixtyupgrades.com/sod/set/pDvqszCfAVY1KsCWjrqrhn/talents ("Currently Equipped - Rarapriest") ; https://sixtyupgrades.com/sod/set/pDvqszCfAVY1KsCWjrqrhn/buffs ; https://sixtyupgrades.com/sod/set/cqxSp2YR56mH3pfzsburM5/model ; https://sixtyupgrades.com/cata/set/vPLn3FJm69BAiYCnMi9s/model
- Character/set creation routes: https://sixtyupgrades.com/characters/new ; https://sixtyupgrades.com/cata/character/desaB2tLmmYMnufJeCU4xY/sets/new ; https://sixtyupgrades.com/era/character/reim9KqNKMbhe8A7zQL4sK/sets/new ; https://sixtyupgrades.com/tbc/characters
- Talent calculator: https://sixtyupgrades.com/talents ; https://sixtyupgrades.com/era/talents/mage ; https://sixtyupgrades.com/tbc/talents/paladin/2BE1BECGHIo3PNTo0BD1Q ; https://sixtyupgrades.com/sod/talents
- Auth routes: https://sixtyupgrades.com/login ; https://sixtyupgrades.com/tbc/register ; https://sixtyupgrades.com/sod/register ; https://sixtyupgrades.com/wotlk/login

Community / third-party:
- Launch thread (r/classicwow via teddit mirror): https://teddit.ggc-project.de/r/classicwow/comments/lkn3sp/seventy_upgrades_tbc_gear_planner_is_now_live/ — creator statements on EP presets/theorycrafter curation; praise for clean UI/performance/share links; raid-buff feature request.
- Warcraft Tavern forum thread (creator participation, origin story, autofill caveats): https://www.warcrafttavern.com/community/wow-classic-general/sixty-upgrades/
- Barrens Chat threads (praise, "lighter than Wowhead", autofill-with-enchants, registration gripe): https://barrens.chat/viewtopic.php?f=3&t=1643 and https://barrens.chat/viewtopic.php?p=15102
- Patreon: https://www.patreon.com/sixtyupgrades — "Grits", infra-cost goals.
- Warcraft Tavern gear planner page (competitor context): https://www.warcrafttavern.com/wow-classic/tools/gear-planner/
- VHPG SoD gear-planner comparison (Wowhead vs Sixty Upgrades): https://www.vhpg.com/wow-classic-sod-gear-planner/
- Wowhead competing planners: https://www.wowhead.com/classic/gear-planner ; https://www.wowhead.com/tbc/gear-planner ; https://www.wowhead.com/wotlk/news/wrath-classic-gear-planner-tool-on-wowhead-328531 ; https://www.wowhead.com/cata/news/wowhead-gear-planner-tool-now-updated-for-cataclysm-classic-339076
- BisBeard (WotLK competitor feature list): https://wotlk.bisbeard.com/
- WowSims JSON import of Eighty Upgrades exports (+ format bug): https://github.com/wowsims/wotlk/issues/767
- tbcsim import request: https://github.com/marisa-ashkandi/tbcsim/issues/7
- Sharpie's Gear Judge addon (in-game import of Sixty Upgrades exports): https://www.curseforge.com/wow/addons/sharpies-gear-judge
- Blizzard forums: https://eu.forums.blizzard.com/en/wow/t/sixtyupgrades/493507 (SoD BiS checking) ; https://us.forums.blizzard.com/en/wow/t/any-cata-character-planners/1836982 ("85 upgrades wasn't coming")
- YouTube (feature/tutorial videos): SixtyUpgrades Tutorial (2020) https://www.youtube.com/watch?v=SXTLmgWX5dU ; Sixty Upgrades quick guide (2019) https://www.youtube.com/watch?v=fUqzfwBNtu0 ; "Seventy Upgrades got an UPGRADE!!" (Jan 2022) https://www.youtube.com/watch?v=cGZ21k5N42Y ; "Linked Characters on Sixty/Eighty Upgrades" (Apr 2024) https://www.youtube.com/watch?v=POX72Umz6IM
- Similarweb traffic: https://www.similarweb.com/website/seventyupgrades.com/ ; https://www.similarweb.com/website/sixtyupgrades.com/
- Domain alias evidence: https://website.informer.com/seventyupgrades.com?cf=1 (title now "Sixty Upgrades")
- EP scoring formula description: https://twowheeltour.com/nombor-alumina-yanina/sixty-upgrades-equivalence-points.html (scraped mirror of tool documentation; formula corroborated by forum usage)
- Usage-in-guides examples: https://xpoff.com/threads/tbc-gearing-guide-bis-chart.96000/ ; https://xpoff.com/threads/39-tbc-bis-standards-phase-1.96062/
