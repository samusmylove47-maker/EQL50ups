# EQL Upgrades — Design & Implementation Plan

A gear planner for **EverQuest Legends**, built to the standard set by
[sixtyupgrades.com](https://sixtyupgrades.com/tbc).

**Status:** awaiting approval before coding.

---

## 1. Product thesis

Sixtyupgrades' creator described its origin as *"a little project to replace spreadsheets for gear
planning in Classic WoW."* That is the thesis to copy: **replace the community BiS spreadsheet with a
fast, shareable, game-authentic web app.** Not a wiki, not a guide site, not a forum — one tool that
does gear, and does it instantly.

Three properties define the original and are non-negotiable here:

1. **Speed is the brand.** Every piece of praise it receives mentions smoothness. Client-side SPA,
   pre-indexed item data, zero-latency slot swaps, instant stat recompute.
2. **Authenticity is trust.** Its tooltips look like WoW. Ours must look like the EverQuest item
   window — right typography, right stat ordering, right colors — so a screenshot of the planner
   reads like a screenshot of the game.
3. **The URL is the product.** Permanent, login-free set links are what made it the lingua franca of
   guild Discords. Every set must be a link.

---

## 2. What makes this *not* a sixtyupgrades reskin

EQ Legends has three systems with no WoW analogue. These drive the architecture, and getting them
right is what separates a real tool from a generic stat calculator.

### 2.1 Multiclassing — the character is a *trio*, not a class

Characters run up to **three simultaneous classes** (two at creation, third at level 10, primary
locks at 11; ~560 documented trios). Consequences that touch nearly every feature:

- **Item eligibility is a union** — an item is usable if *any* of your three classes qualifies.
- **Armor proficiency takes the best tier** among the three (a Paladin in the trio opens plate for
  the whole combo).
- **Skill caps take the best cap** among the three.

So the character model is `{race, level, classes: [primary, second, third]}` and eligibility is a
set-intersection problem, not a single-class lookup. The class picker is the most important control
on the character screen, and swapping one class must re-rank every item list live.

### 2.2 The +0…+10 upgrade system — every item is 1024 items

Every piece of gear carries an upgrade level driven by merging duplicates or Motes of Potential.
**A planner that ignores this is useless**, because a +6 blue can beat a +0 purple.

Authoritative math (from a verbatim port of eqlwiki's own `ext.itemLevelSlider` module — the
calculator that runs on every wiki item page, not a reading of its prose):

- State is `full` (tier 0–10) + `fraction` banked toward the next tier, where the denominator is
  `2^full`. `effectiveLevel = full + fraction / 2^full`. Exactly **1024** reachable states.
- **Primary stats** (AC, attributes, HP, MP, END, all saves): `base ≤ 10` → `base + full`;
  `base > 10` → `floor(base + excelRound(base × effective / 10))`; **negatives shrink toward zero**.
- **Weapon damage**: `base + floor(base × effective / 10)`. **Delay never scales** — that is where
  the ratio gain comes from.
- **Flat stats** (regens, haste): `base + full`.
- **Weight**: log2 curve. **Bonus**: an item with ≥2 attribute/save fields gains a synthetic
  `SV VOID: +full`.
- Rounding is `excelRound` (half-away-from-zero), **not** `Math.round`. A known IEEE754 artifact at
  full=10 must be reproduced, not "fixed" — the wiki displays it.

**UI consequence:** every equipped item needs an inline **+N control**, and the stat panel resolves
the whole set at its chosen levels. This is a first-class feature sixtyupgrades never needed.

> One competing community model (Thiole's) derives this from wiki prose and is **wrong in three
> documented ways**. We use the jmoyers-verified rules, reimplemented from the documented spec
> rather than copied — that repo is FSL-1.1 licensed, which is source-available, *not* open source.

### 2.3 Exaltations — sockets are *derived*, never looked up

Sockets unlock by item level: **+0 Ornamentation, +1 Focus, +2 Click, +3 Worn, +4 Proc**. An
exaltation is a transferable effect lifted off a source item, and **it carries its source's class and
slot restrictions and intersects them onto the host**.

Verified empirically: per-item socket data *does not exist* — `exaltationSlots` is populated on
**1 of 11,375** items, because sockets are a function of level, not an item property. The planner
derives them from the chosen +N. Exaltation *sources* are available: the catalog tags
click 824 / proc 453 / focus 143 / worn 104.

### 2.4 Also different

- **23 slots**: the classic 21 worn positions **plus two new "Any Slots"** that accept qualifying
  items at full value.
- **Era gating**: the wiki pre-catalogs classic-EQ content that is *not live* in a pre-Kunark game
  (2,780 Velious and 1,243 Kunark entries in an 11,375-item scrape). `CURRENT_ERA = "Sky Era"`.
  Filtering must use the acquisition-path-aware model, including zone gating.
- **No heroic stats.** Itemization is classic-style: AC, HP, MANA, the seven attributes, five saves,
  worn haste, weapon dmg/delay.

---

## 3. Architecture

**Static SPA. No backend.** Per the agreed model: browser-local saves plus URL share links.

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript | UI is stateful (doll, picker, tooltips, live stats); TS keeps the stat math honest |
| Build | Vite | Fast builds, trivial static output for Pages |
| State | Zustand | Small, no boilerplate, easy to test in isolation |
| Routing | React Router, `/{ruleset}/…` from day one | Sixtyupgrades' lesson: new eras must be routes, not new products |
| Data | Pre-built JSON shards, lazy-loaded per slot | 11k items must not block first paint |
| Tests | Vitest (math//logic) + Playwright (UI) | The exhaustive test phase needs real browser driving |
| Host | GitHub Pages via Actions | Agreed target |

**URL architecture** (mirroring the original, which proved it):

```
/                          landing
/items                     global item browser, EP-ranked
/character/new             character creation (race, level, 3 classes)
/set/{id}                  a gear set  ← the shareable artifact
/set/{id}/exaltations      exaltation planning
/set/{id}/compare/{id2}    explicit A/B diff  ← leapfrogs the original
```

Sets serialize into the URL fragment (compact binary → base62), so **a link fully reconstructs a set
with no server**. localStorage holds the character/set library.

### Data pipeline

A build-time Node script normalizes the harvested corpus into shipped JSON:

- **Primary:** `jmoyers-items.json` — 11,375 items, freshest (2026-08-13), effects typed by `kind`
  (which maps directly onto socket types), retains raw `statsBlock`.
- **Enrich by name-join:** `nathanbates-items.json` (best normalization, 66 focus effects with
  slot-level detail) — the two agree on 10,921 names, which is strong mutual corroboration.
- **Availability flags:** `eqlwiki-items-2026-08-03.json`, uniquely carrying `available_from`,
  `gated_by`, `out_of_era`, `non_legends`.

Output: one index (name/slot/classes/score inputs) + per-slot detail shards + a spell/effect table.

**Attribution:** eqlwiki content is CC BY-SA 4.0. The site credits the EverQuest Legends Wiki and
keeps derived data share-alike. Data provenance (source repo + commit SHA) ships in an About page.

---

## 4. Feature plan

### P0 — defines the product
1. Character model: race, level, **three classes**, with union-eligibility and best-of-three rules.
2. Paper doll, **23 slots** including the two Any Slots.
3. Item picker per slot: instant search, EP-ranked, filters (source, zone, era, tags, quality).
4. **Per-item +N upgrade control** with exact scaling math.
5. Live stat panel: attributes, AC, HP, mana, five saves, haste, ATK, weapon ratio, SV VOID.
6. **EP stat weights** — presets per archetype + fully custom. This turns a database into an advisor.
7. Share links + localStorage autosave + many named sets per character.
8. **EQ-authentic item window** rendering.
9. Era filter defaulting to live content, with an explicit "show unreleased" toggle.

### P1 — expected
10. Exaltation planner (derived sockets, restriction intersection, no-stack family rule).
11. Explicit **set-vs-set diff** — weakly evidenced in the original; an opportunity to leapfrog.
12. Global item browser.
13. JSON export/import with a versioned schema (downstream adoption is a moat).
14. Autofill best-in-slot — **cap-aware**, fixing the original's documented weakness.
15. Hover-compare deltas against the equipped item.

### Explicit non-goals for v1
3D model viewer · accounts/backend · AA planner · guides/news · public gallery (the original proves
discovery can be social).

### Fixing the original's known gripes
- **Anonymous by default** — no registration wall (their #1 complaint; we have no accounts at all).
- **Cap-aware autofill** — theirs overshoots caps and ignores set bonuses.
- **Explicit diff view** — theirs makes you open two tabs.

---

## 5. Honest risk register

| Risk | Reality | Mitigation |
|---|---|---|
| Data is **Tier 1/2**, not Tier 0 | Everything is community wiki scrapes, not game files | Ship provenance visibly; request Tier 0 spot-checks from the user |
| Era gating is heuristic | ~30% of wiki items carry no era tag; the `ERA_OVERRIDE` list of early-released items is **empty** in every source | Leave unresolvable items visible (hiding is the worse failure), flag them, make the toggle obvious |
| **Race base attributes unverified** | The one chardata source self-discloses `"verified": false` and admits it carries **Classic EQ values on an assumption** | **Do not ship them.** Gear-only totals until verified. Only the "+30 points per class / 90 per trio" invariant is real (read from the client) |
| +N math could drift from live | Sourced from the wiki's calculator, fixture-verified against screenshots | Verify in-game; keep the rules in one isolated, unit-tested module |
| Mote ladder conflict | Sources disagree on Greater vs Major ordering | Out of v1 scope; do not display a ladder we cannot verify |
| FSL licensing | The best reference code is source-available, not open source | Reimplement from documented rules; never vendor the file |

---

## 6. What I need from you (Tier 0)

Low effort, high value — these settle what research cannot:

1. **`/outputfile inventory`** at a banker with Dragon's Hoard open → `inventory.txt`. Ground-truth
   item names, slots, and the client's own export format (which we should support importing).
2. **A screenshot of one item window** at a known +N (ideally the same item at +0 and upgraded) —
   validates the scaling math end to end against the live client.
3. **A directory listing** of the install (`dir /s /b` piped to a text file) — tells us whether any
   client-side item/spell data exists to mine at all. UE5 games often keep this server-side.

Nothing gets written to your install; copies only.

---

## 7. Execution sequence

1. Data pipeline + normalized corpus, with unit tests on the upgrade math fixtures.
2. Core app: character → doll → picker → stat panel.
3. EP weights, share links, persistence.
4. EQ-authentic tooltip/item-window polish.
5. P1 features.
6. **Fan-out test loop** — subagents drive every control in Playwright until zero defects.
7. **Harsh-critic loop** — adversarial agents grade against sixtyupgrades on style, feel, and
   function; iterate until 9/10.
8. Deploy to Pages, hand over for in-game testing.
