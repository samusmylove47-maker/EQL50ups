<!-- Written by a review agent on 2026-08-18, against the EQL Source integration build
     (workflow wf_0d4fa466-238). Preserved verbatim: these are findings to work from,
     not prose to polish. Committed so the score is auditable — the previous round's
     scores were reported in chat with no artefact behind them, which is worth less
     than no score. -->

Read the two governing docs first, then audited the running app rather than the screenshots — I re-ran every gate, drove Chromium against the preview on :4399, and fetched eqlsource.com to check comparative claims. Preview server left running (not mine to kill).

---

# Review: 50 Upgrades, as the eqlsource editor

## What I independently confirmed green

- `pipeline/verify.mjs` — 55 checks, **0 failures**, Tier 0 coverage **100.0%**, 2 documented warnings.
- `npx tsc --noEmit` clean; `npx vitest run` **885/885** in 56 files.
- `node pipeline/refresh.mjs` **works against the live site right now** — fetched all four datasets, byte-identical, printed §06 with 5 alias resolutions. This is the most valuable thing in the repo tonight and it is not theoretical.
- All seven masthead URLs return 200; the nav is a verified copy of `/tools/index.html`, not an impression.
- `vite build --base=/tools/50-upgrades/` emits correct asset URLs, relative font/favicon paths, `data/` intact, hash routing so no server rewrite. **It is attachable.**
- Haste: no `%` on the item field anywhere in `web/src`; one shared `HASTE_PROVENANCE`/`HASTE_STACKING`; badge on StatPanel, ItemWindow and Upgrades rows; stacking labelled *assumed, not measured*.
- No drop rate derived from counts. The division does not exist. `surveyText` prints "4 of 5 facets measured" as two counts.
- Existence-only records are exercised, not aspirational: 10 ship, including `Griffon Wing Spaulders` with **no slot** on an item whose name obviously means shoulders. Rule 7 holding under temptation.

---

## BLOCKING

### B1. The contamination page publishes source code that does not exist

`/home/user/EQL50ups/web/public/data/contamination.json`, rendered under **"OUR OWN SOURCE, QUOTED"**. I confirmed it on the served page, not just the PNG:

```
web/src/components/StatPanel.tsx:143   PRINTED WITH A PERCENT SIGN
<StatRow className="vital" label="Atk Speed" value={totals.haste} suffix="%" />
```

Line 143 of that file is a comment (`* The client's Vitals block, rendered as tiles.`). The string `suffix="%"` occurs **nowhere in `web/src`**. Same for `web/src/lib/setDiff.ts:252`, which is now `plain('ATTACK', 'Attack', a.attack, b.attack),`. The prose is false too: *"not one of them carries a badge"* and the markRule *"nothing counts as marked — no surface in this app tells a reader that this figure carries a classic unit"* — the badge shipped hours ago.

**Root cause is a build-graph gap, not a stale number.** `contamination.json` mtime 03:42:23; `StatPanel.tsx` 04:02; `setDiff.ts` 04:19. `pipeline/build.mjs` contains **zero** references to contamination; so does `verify.mjs`. The only invocation anywhere is line 253 of `research/PATCH-DAY.md`, in the *when something looks wrong* section — not in §00's one-minute version. The happy path never regenerates it.

This matters more than the wrong numbers. The page's own rule 1 is *"Nothing is transcribed. Every figure is read live."* That guarantee is structurally unsound, not accidentally violated. Today's error happens to make us look worse; the same gap will **flatter** us the day a badge is removed. The direction is luck.

**Fix (~30 min):** (a) add `node pipeline/contamination.mjs` to the build chain and PATCH-DAY §00; (b) in `verify.mjs`, for every `signatures[].codeSites[]`, re-read `file` at `line` and fail unless the trimmed text matches. That is the same discipline `web/src/screens/sourcesData.ts` already applies to the purge counts — *"Computed, never typed."*

### B2. Classic EverQuest spell-focus percentages ship as Legends fact, unbadged — and the scanner cannot see them

This is the direct answer to your haste question, and it is worse than the haste field ever was. I imported the owner's own `research/validation/tier0-inventory-Avenrae.txt` into a fresh character on the running app and opened Exaltations. Under **"EFFECTS ON THIS SET · Named, not scored — see below"**, with no tier chip anywhere on the panel:

- *"Improved Damage III — Increases the damage of spells by up to 20%. **This bonus will decay on spells over level 60.**"*
- *"Enhancement Haste I — Reduces the cast time of long term beneficial spells by 30%…"*
- *"Spell Haste II — Reduces the cast time of spells by 15%…"*
- *"Increases the power of percussion instrument based bard songs by up to 140%."*

Level 60 decay, in a game that stops at 50. Twice on one screen.

`web/public/data/focus-effects.json` ships 66 effects. **66 of 66 contain a percentage. 60 of 66 carry the classic focus-decay line `Limit Max Level: N (lose 5% per level after)`** keyed to 20/44/60. Slot text includes classic limit vocabulary — `Limit Target: Exclude Old Giants`, `Exclude Old Dragons`. **120 `fx` entries across the shipped shards resolve to this prose**, so ordinary gear reaches it. Rendered at `web/src/components/ExaltationsTab.tsx:185–186` as bare `<div>`/`<p className="hint">`. The only caveat on the panel — *"listed, not scored. None of them moves the stat panel"* — is about **scoring**, which is a different claim from **provenance**.

The scanner never opens the file: `pipeline/contamination.mjs:865` computes `catalogFiles: catalog.shardFiles.length + 2` (shards + index). And `corpus.excluded` names only test files and `quarantine.json`, so the omission is not disclosed either.

So the app refuses a single `%` on the Vitals tile and prints 66 classic percentages one tab away.

**Fix (~20 min), reusing what exists:** one `.tier.t5` chip on the "Effects on this set" header — *"Tier 5 · classic wiki prose"* — one sentence in the `HASTE_PROVENANCE` voice (*"Legends caps at 50; this text describes decay above 60"*), and add `focus-effects.json` to the scanner corpus so the next scan reports the count instead of a reviewer finding it by hand.

### B3. Two records claim "No catalog record exists" while their twin sits in the same build

| existence-only record | already in the catalog | distance |
|---|---|---|
| `Griffon Wing Spaulders` (id 2703, no slot/class/era/stats) | `Griffon Wing Spauldors` — SHOULDERS, ROG, Sky, AC 9 / HP 30 / STR 6 / AGI 4 / DEX 6 | 1 |
| `Deterioriated Ancient Faydark Longbow` (id 177863) | `Deteriorated Ancient Faydark Longbow` — RANGE, Classic, full stats | 1 |

Both publish: *"No catalog record exists for it in any wiki source, so its stats, slot, class and era are all unknown."*

Credit where due: `Backpack*` (32601) vs `Backpack` (17005) is **not** this bug — the client export lists both IDs, so they are genuinely two items and the wiki's `*` convention is vindicated by Tier M.

I am **not** asking for an auto-merge; merging is the inference rule 7 forbids. The defect is the sentence. `verify.mjs` already warns on trailing-`*` twins (`distinct-but-similar names`, 3 hits) — widen it to edit-distance ≤1 over `looseKey` and make it a **failure** when one side is `xo:true`. Then soften the string to *"No catalog record **under this name**…"* and name the near-twin.

**Why this is deadline-critical:** tomorrow's names arrive from combat logs, and log-vs-wiki spelling is exactly where this lives. `refresh.mjs` §06 caught 5 apostrophe/article cases today and missed both of these, which are already shipped.

### B4. The front door abandons the house method — and it is what gets attached first

`web/src/screens/Landing.tsx:94–99`: h1 *"Plan your EverQuest Legends gear at speed"*; lede *"Three classes at once, twenty-three slots including the two Any Slots… No account, no server."* A speed claim over a feature list. No numbered sections, no callout, no correctness property, no self-criticism.

Their own template, fetched today from `/tools/sky-ledger.html`: h1 is the bare name **"Sky Ledger."**; section **01 is "A piece can only be spent once"**, lede *"This is the whole reason it is promoted here, and it is a correctness property rather than a feature"*, then *"Every other tracker counts that item against every test that wants it… Ours did."*

**You already have the exact analogue and it is buried.** `web/src/screens/Upgrades.tsx:241–290` allocates Lore items once, in the position where they gain the most, *"because ranked independently, three of Avenrae's positions all wanted the same Cloak of Scales and two wanted the same Engineer's Ring, which is a shopping list the client will not let anyone complete."* That is a correctness property with the self-criticism attached. On screen it appears as a five-word row detail: *"One only, so it is offered in the single position where it gains the most."*

Meanwhile `PlanarGear.tsx` gets it completely right — eyebrow *"ABSORBED FROM EQLSOURCE.COM/TOOLS/PLANAR-GEAR"*, numbered sections, three callouts each with a consequence sentence, and an honest comparison to the tool it replaces. The voice exists in this codebase. The landing page just doesn't use it. **Copy only, ~1 hour, no engine change.**

---

## Non-blocking but real

**N1. A Tier 2 scrape is painted the same green as a client reading, on the busiest surface.** Measured via `getComputedStyle` on the running app: hovering `Griffon Talon Necklace`, the chip *"Tier 2 · structured wiki data"* computes to `rgb(143,174,130)` — **identical** to `--source-trusted-t` (#8fae82), the colour of *"Tier M · stats read off the client"*. Cause and fix are already written at `web/src/styles.css:4135–4157`: `ItemWindow.tsx` renders `.standing-label` with no per-chip tier class, and `.tier.t2` steel exists unused. Their own note calls it *"a one-line change in that component."* It is the one place the colour system flatters the data, on the surface that opens on hover from every table, picker and slot.

**N2. "No source publishes their numbers" is over-stated on the Planar page.** I pulled `https://eqlsource.com/tools/planar-gear.html`: its `__PG__` payload ships `Shadow Rage Sleeves` (ac 10, str 3, sta 5, dex 5), `Wristguard` (ac 6, str/agi/dex 4, svfire/svcold 5) and `Leggings` (ac 12, agi 6, wis 6, svfire 2, svdisease 8), and even tags `"thin":{"Shadow Rage":3}`. `research/SOURCING-STANDARD.md:84` states it correctly; the on-screen compression drops the qualifier and then contradicts itself one sentence later. Fix: *"No source **that can be shown to describe Legends** publishes their numbers."* The comparative claim beside it is accurate and checkable, which is rare and good.

**N3. Items is the one top-level page with no eyebrow, no lede, and no statement of what it does not replace.** `SiteChrome.tsx:1–10` says the tool replaces Planar gear targets, the Inventory reader and The Index. Planar says so on screen and earns it. The other two don't: the live `/tools/index-search.html` answers *where does this drop / which named have I not met* over 434 items and 232 named mobs — our Items screen ranks 3,663 items by EP with **no mob dimension at all**; the live `/tools/inventory.html` reads bags and bank, which the importer explicitly discards ("412 bag, bank and keyring rows were skipped"). Both limits are already stated honestly in the code and the modal. They just aren't on the two pages a reader would compare. One sentence each.

**N4. Cosmetic, ranked.**
- `web/src/screens/SetCompare.tsx:294` — `Compare "${setA.name}" with…` renders straight ASCII quotes in Cinzel at h1 size, beside a correctly-typeset `…`.
- Same screen: ~250px of content above an ~800px footer, no eyebrow.
- Sources: the Tier 1 and Tier 3 cards are full-height and near-empty; `align-items: start` stops the two emptiest cards being the two biggest shapes on the page.
- Palette token *names* diverge (`--bg-panel` vs `--surface-1`, `--line` vs `--rule`) though the values are exact (#191309, #282013, #544833, radius 4px). `SiteChrome.tsx` claims class names were copied "so anyone holding both stylesheets can diff them" — true for the chrome, not the palette.
- One 502 kB JS chunk (155 kB gzip) + 103 kB CSS, no splitting.

---

## A caution about the evidence I was handed

The full-page PNGs in `/home/user/EQL50ups/.artifacts/round3/` render sticky elements at their capture offset. In `05c-upgrades-real-imported-set-390x844.png` the masthead appears to clip the tool nav. **It does not.** I checked live before reporting it: at 390px `.site-bar` is sticky at y 0–59, the nav links sit at y 87–120 and 124–157, and `elementFromPoint` at each link's centre returns the link. Worth knowing before someone "fixes" it.

---

## The judgement

The engineering discipline here is 9/10 work — the sourcing standard is enforced in the pipeline, in the tests, in the empty states and at the point of use, and the patch-day path is live tonight. But the flagship self-audit page is currently publishing three fabricated quotations of its own source; a whole shipped data file is unbadged, unscanned, and undisclosed as unscanned, promising spell decay above a level the game does not have; and the front door drops the house method that the Planar page executes perfectly.

Two of those three are the exact failure this project exists to prevent, and I found them in under an hour with the repo open. Everything needed to fix all three is already written somewhere in this repository — the badge pattern, the verify-gate pattern, the correctness-property copy. That is what keeps this high rather than middling.

SCORE: 7/10