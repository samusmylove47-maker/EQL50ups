<!-- Written by a review agent on 2026-08-18, against the EQL Source integration build
     (workflow wf_0d4fa466-238). Preserved verbatim: these are findings to work from,
     not prose to polish. Committed so the score is auditable — the previous round's
     scores were reported in chat with no artefact behind them, which is worth less
     than no score. -->

Gates re-run independently, all confirmed: `tsc` clean, **vitest 885/885** (56 files), **playwright 145/145** (3.3m), `verify.mjs` **55 checks / 0 failures / Tier 0 100.0%**. The verifier's font correction is also confirmed — I measured the variable axes directly (Public Sans 400 → 322.09px, 600 → 327.48px; Cinzel 500 → 345.75px, 700 → 362.13px), so the axis is instancing and the `Public Sans Thin` family name CDP reports is the variable default instance, not a Thin render. `audit.json`'s `declared` block is misleading because it sampled the *first* `p` and `.mark` on the page, which are mono elements; ignore it, trust the per-family probe.

---

## What is genuinely closed

**The patch-day pipeline is done, and I proved it rather than read it.** I copied the repo to a sandbox, injected three Castle Mistmoore rows into `sightings.v1.json` (two new items, one new drop for an existing item, one deliberately deleted row, bytes changed without changing the published hash) and ran the documented sequence. It caught every single thing:

```
!! same published hash, different bytes ... Do not apply this without looking.
!! 0 items and 1 rows DISAPPEARED ... Cloak of Flames <- Lord Nagafen (was seen 2)
   zones named by a session for the first time: Castle Mistmoore
   mobs named for the first time: a Mistmoore gargoyle, Mayong Mistmoore
06 What a rebuild would newly admit
   Mistmoore Cudgel  (measured dropping)
   Vampiric Signet of Mayong  (measured dropping)
```

`build.mjs` then admitted both as existence-only, `verify.mjs` passed at 3,665 items, and the app loaded and rendered the new item with a `NO STAT DATA` badge, an em-dash EP, and an item window naming `sightings.v1.json v1.0.0 hash 1fb7dad3694443ff, seen 2 time(s)`. **Zero code changes, zero test edits.** The shipped record has no `sl`, no `cl`, no `ra` — exactly what `PATCH-DAY.md §05` promises. A tired person can do this at 2am. This is the best thing in the repository.

**The import dialog is the second best.** "21 of 22 worn items… Shadow Rage Helm is a known item with no stats in any catalog, so it was left out rather than scored as a zero. 412 bag, bank and keyring rows were skipped." It names the ID-alias matches (`Djarn's Amethyst Ring` → `Djarns Amethyst Ring`, joined on 10366), lists the skipped collection by bucket, and makes new-set-vs-replace an explicit choice. It is already better than `eqlsource.com/tools/inventory.html`.

**Planar beats the tool it replaces on the argument that matters.** "The tool this replaces ranks three of them from a classic-era stat block. That makes our answer for a Berserker look thinner than theirs, and it is the honest one." Plus `4 sets open to this trio… Fewer than five, and that is not a fault`, per-piece tier badges instead of one blanket T3, and `11 pieces in this slot belong to a planar set your trio cannot wear, and are not offered`. Contamination §01's haste section is the most self-critical page I have read in a fan project.

---

## Must fix before the owner's name goes on it

**1. The flagship screen tells a real character to wear three chestplates.** Upgrades row 5 is `Equip Ethereal Mist Chestplate at +6 in Any Slot 1` (+35.5) and row 9 is `Equip Ethereal Mist Chestplate at +6 in Any Slot 2` (+16.0) — the same item, twice — while Chest keeps Indicolite Breastplate (57.5 > 53.0) and sits in the "10 already best" bucket. Both gains are inside the `+447.7 LISTED GAIN, ADDED UP` callout. Sky Ledger's promoted correctness property, on this same site, is *"A piece can only be spent once… Every other tracker counts that item against every test that wants it. Ours did."* `Upgrades.tsx:250` already has the machinery — `isLore` deallocates a claimed Lore item across positions — it just does not run for non-Lore items. Extending that same allocation pass to any candidate name, not only Lore ones, is the fix, and it is small.

**2. The rule underneath it is the one unsourced rule in the codebase.** `web/src/data/catalog.ts:462`:

```js
// The two EQL "Any Slot" positions take any item that is worn somewhere.
return state.items.filter((item) => item.sl.length > 0);
```

Every other decision in this repo carries a paragraph of evidence. This one is a bare assertion, and it is what lets a `sl: ["CHEST"]` item win both flex positions. The Tier M export proves Any Slot held a SECONDARY item (Nautilus Shield) and an exaltation — that is evidence for weapons and shields, not for a second and third breastplate. `e2e/picker-window.spec.ts:20` (`'Any Slot should offer well over a thousand candidates'`) pins the pool size, which locks the behaviour in without ever sourcing it. Either document the evidence or narrow the pool; do not leave it as the only unargued claim in a project whose whole thesis is that inference is not evidence.

**3. An unknown class is printed as "ALL", on exactly the record shape tomorrow creates.** `web/src/data/normalize.ts:263-264`:

```js
cl: classes.length ? classes : ['ALL'],
ra: races.length ? races : ['ALL'],
```

The Mistmoore Cudgel record ships with no `cl` and no `ra` — correctly. The item window then prints `REQUIREMENTS / Class ALL / Race ALL`, indistinguishable from an item genuinely wearable by everyone. Slot gets this right (`NO SLOT`), weight gets it right (`—`), era gets it right (`eraLabel` returns null). Class and race are the two fields that convert an absent measurement into a positive claim, and they are the two that will be absent on every item that drops tomorrow. This is the exact failure `SOURCING-STANDARD.md` rule 7 was written to prevent, one field short of the finish line.

**4. On the default weights, 7 of 13 recommendations hand back something the tool is not counting.** `store.ts:38` sets `DEFAULT_WEIGHTS = profileById('balanced')` for every trio, and Balanced carries no HASTE, no REGEN, no MANA_REGEN, no END_REGEN and no resists. For Avenrae — a WAR/BER melee trio — that yields:

```
GIVES UP  HASTE -43 · FR -25  — not counted by this set's weights.
GIVES UP  REGEN -7 · MREGEN -7 · EREGEN -7 — not counted by this set's weights.
GIVES UP  MR -14 · FR -14 · CR -14 · DR -14 — not counted by this set's weights.
```

Dropping 43 haste off a warrior is not a footnote, and `HASTE: 2` exists only in the `melee-dps` preset (`ep.ts:325`). The honesty line is there and it is good; what is missing is any way to act on it. Two cheap fixes, either of which closes it: pick the opening preset from the trio at set creation, and make "not counted by this set's weights" a link into the Weights tab with that key focused. Right now the row tells you the ranking may be wrong and leaves you at a dead end.

**5. The single highest-value action is hidden behind `⋯`.** Creating a character lands you on `#/set/{id}` showing `0/23 slots · 0 EP` and a grid of empty glyphs. The only affordances are `🔗 SHARE`, `✦ AUTO-FILL`, `⚙ EDIT` and an unlabelled `<summary>⋯</summary>`; "Import from game (`/outputfile inventory`)…" is the second entry inside that menu (`SetEditor.tsx:368-372`). `CharacterDetail.tsx:68` has a proper top-level button, but the create flow never routes through that screen. There is no import entry point on the landing page at all. This tool is supposed to replace a site page whose entire hero is a paste box. Promote it to the empty-set state and to the landing CTAs.

---

## Should fix, not blocking

**6. The honesty about Shadow Rage Helm survives exactly one dismissal.** The import explains why Head is empty; the explanation lives only in a closable toast. Afterwards the doll shows a bare `Head` label and Upgrades prints `WEARING Nothing`. The player owns that helm — Tier M, it is in the export — and the app now says they own nothing. The planar screen already articulates the correct doctrine for this: *"An empty slot on a planner reads as 'nothing is good here', and that is a different statement from…"*. Apply it to the doll: `Shadow Rage Helm +5 — held, no published stats, so it cannot be scored`.

**7. "WHERE TO GO" covers 5 of 13 rows and omits the top three gains.** The panel lists Plane of Fear (2 of 13), Plane of Hate (2 of 13), Hate-Group (1 of 13). The three biggest gains — Baton of the Sky +110.9, Dagas +53.0, Qeynos Badge +42.8 — are quest rewards whose sources the rows *do* know (`QUEST · Cleric Plane of Sky Tests · Cleric Test of The Weak`) and which the routing panel silently discards. A panel titled "where to go" that omits where three quarters of your value is fails at its one job. The zone rows are also inert `SPAN.upg-zonename` inside `LI.upg-zone` — you cannot click Plane of Hate to see which two items it is.

**8. The 277 measured drops have no browse path.** That figure is eqlsource's own headline for the tool being replaced, and it is the stated reason to open this one. The item browser filters on search / slot / class / era / scoring profile only — no zone, no mob, no "measured" toggle, no column for it. Nor can you reach the 187 `eraUnknown` rows: the era dropdown offers Classic/Fear/Hate/Paineel/Temple/Sky/Kunark (2,907/27/5/22/101/382/32 = 3,476 of 3,663), so the 187 with no era — which is what every patch item is — are unfilterable by construction. Tomorrow the owner will want "show me Castle Mistmoore" and will have to type a name.

**9. No undo after Equip.** The toast is excellent (`Baton of the Sky equipped in Primary at +10, replacing Earthshaker at +10 — +110.9 EP. The list is being re-ranked…`) and the re-rank is correct (13/23 → 12/23, +447.7 → +336.9). But it destroyed a Tier-M-verified worn item and offers no way back except the gear tab. This is the action a daily user performs thirty times a session.

**10. The import does not check the export against the declared trio.** I typoed CLR instead of BRD; the dialog reported `0 not matched` and imported everything, then the doll quietly painted `FEET CAN'T EQUIP` in red. A Tier M export disagreeing with the declared classes is the strongest possible signal the trio is wrong, and rule 1 says the game wins. The import is the right place to say so.

**11. Staleness will be wrong by lunchtime.** The catalog is built from `research/data/eqlwiki-items-2026-08-03.json`. Tier 4's own rule — quoted on the Sources page — is "anything older than the last patch is stale". After tomorrow all 2,045 tier-2 rows are stale by the project's own definition and nothing on screen says so. `DataBanner` renders empty on every route I checked. A `lastPatch` field in `meta.json` and one banner would close it.

**12. Two numbers on the planar page do not match the page it replaces.** Live `eqlsource.com/tools/planar-gear.html` says **116 pieces across 18 sets**; ours says **105**, with no explanation of the 11-piece gap. Separately `PlanarGear.tsx:971` describes their page as "a hundred and six rows" — a claim about another page, checkable in five seconds, and wrong. Also: the `0 OFFERED BY NAME, REFUSED A RANK` callout reads 0 before classes are chosen and 6 after, which makes the cold-open state contradict the lede two inches above it that says six Shadow Rage pieces are unscored.

**13. Contamination overstates its own exposure.** "This app takes the wiki's HASTE field… and weights it in the upgrade ranking at 2 points per unit" is true only under `melee-dps`, not under the default. It errs toward self-criticism, so it is a wobble rather than a fabrication — but on the page whose entire product is precision about our own claims, it should read "under the Melee DPS profile".

---

## Cosmetic

- **The landing headline is a feature list, not a correctness property** — "PLAN YOUR EVERQUEST LEGENDS GEAR AT SPEED" against Sky Ledger's "01 A piece can only be spent once… a correctness property rather than a feature." The property is right there unused: *an item nobody has measured is never ranked, and never shown as a row of zeroes.*
- **The hero product shot is 23 empty slot glyphs and a colour legend.** Their pages lead with figures (`95 tests · 222 turn-in slots`, `434 items catalogued · 277 with a measured drop source`). Ours leads with a key explaining what green means. There is no big-number callout row on the one page that decides whether anyone scrolls, though the device is used well on Upgrades, Planar and Contamination.
- **Tap targets.** At 390px the Upgrades screen has 55 interactive elements under 24px in one dimension, including `BUTTON.upg-name` at 20px tall — the control that opens the item window, on the flagship screen. WCAG 2.2 SC 2.5.8 wants 24×24. The shipped AA sweep measures contrast, not target size.
- **11,371px of page at 390px with no way back to the top.** `header.site-bar` is declared `position: sticky` but measured at `top: -2897` after scrolling — it is not actually sticking, so past the first row there is no nav at all.
- **Not a bug:** the masthead appearing mid-page in `.artifacts/round3/05c-*.png` is a `position: sticky` fullPage-capture artifact. Don't chase it.
- Preview server still on `:4399` (`fuser -k 4399/tcp`). My sandbox is under `/tmp/claude-0/.../scratchpad/`; I changed no repo file.

---

The discipline here is genuinely rare — the pipeline, the import dialog and the sourcing prose are 9/10 work, and the patch-day path is proven end to end rather than merely documented. What holds it back is that the same rigour has not reached the answer the tool actually gives: the flagship screen recommends an item it cannot have twice, on a rule nothing sources, while more than half its advice trades away stats it silently scores at zero — and the one field that would betray a guessed patch item, `Class: ALL`, is the field still guessing.

SCORE: 7/10