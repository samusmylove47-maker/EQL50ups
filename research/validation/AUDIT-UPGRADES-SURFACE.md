# Fan-out audit of the player-facing =Upgrades surface

**This file exists because the record of it was not durable and its summary was wrong.**

`HANDOFF.md` cited the raw journal as `subagents/workflows/wf_d2d73ce2-770/journal.jsonl`.
No such path exists from the repository root. The journal is real but lives under the
session directory — `/root/.claude/projects/…/subagents/workflows/wf_d2d73ce2-770/` —
which does not survive the container. Everything below is extracted from it and from the
per-agent transcripts beside it, so that it survives in the repository instead.

## The numbers, recomputed from the journal

`HANDOFF.md` reported *"31 findings raised, 16 verdicts returned, 15 mechanisms CONFIRMED
by a refuter, 1 refuted. Severity: 12 agree, 3 too-high, 1 too-low."* Every figure in that
sentence except the last is wrong — it was written while the run was still reporting and
never re-derived. Counted over the journal:

```
  finder agents                 8
  findings raised              31
  verdicts returned            23
    mechanism CONFIRMED       22
    mechanism REFUTED         1
    severity  AGREE           15
    severity  TOO-HIGH        5
    severity  TOO-LOW         3
    scope     AGREE           7
    scope     NARROWER        6
    scope     WIDER           10
  findings NEVER judged        8
```

**The eight unjudged findings were not dismissed — they were never looked at.** The
workflow script verifies `(found?.findings ?? []).slice(0, 3)` per lens, so any lens that
raised more than three had the remainder silently dropped before the verify stage. That cap
appears nowhere in the run's own reporting.

## What has since been done about them

**Mapped from commit subjects and bodies on `claude/eql-gear-optimizer-tfzvh6`, not re-verified
by this extraction.** A commit that names a mechanism is evidence it was worked, not proof the
finding is gone; anything not listed here is untouched as far as this file can tell.

| Finding | Status | Commit |
|---|---|---|
| 1, 5, 9 — "Not in catalog" badge on an offhand blocked by a two-hander | closed | `eb88e2b` |
| 2 — zone tallies attribute a drop's full count to every zone name | closed | `d93384e` |
| 3 — the three EP figures on a row do not reconcile | closed | `c79bc10` |
| 8 — `src.c` written as `1`, read as `=== true` (verdict was REFUTED) | closed anyway | `c4cfb1c` |
| 12 — Landing says the client "corrected" the SV Void rule | closed | `7340dc0` |
| 14 — Sources says two client windows, prints five | closed | `7340dc0` |
| 15 — picker's "vs worn" compares candidate@preview to worn@own tier | **REFUTED by B** | `f108ef0` |
| 18, 20 — share links drop `withheld` and `defaultFilters` | disclosed, wire unchanged | `e9ede66` |
| 19 — `sanitizeSet` drops `withheld` on every reload | closed | `52c7e0e` |
| 22 — `blockReason` prints `ALL_EXCEPT` as an inclusion list | closed | `c682786` |
| 23 — item window prints the raw `ALL_EXCEPT` token | closed | `c682786` |

**Finding 8 is the one to read twice.** A refuter marked its mechanism REFUTED; it was real, and
it was fixed — 956 items had never been labelled Crafted and one of five source filters matched
nothing. It is the standing evidence in this repository that a REFUTED verdict is a claim like any
other, and that the killed pile is worth re-reading.

**Finding 16 is NOT finding 15.** They sit one line apart in the same file and both concern the
picker's "vs worn" baseline, but 16 is a different claim — that the baseline counts weapon
ratio/damage in slots where no candidate may score them. Refuting 15 says nothing about 16, which
remains open and unexamined.

## Findings with a verdict

| # | Mech | Sev | Scope | File:line | Title |
|---|---|---|---|---|---|
| 1 | CONFIRMED | TOO-HIGH | AGREE | `web/src/screens/Upgrades.tsx:1810` | "Not compared" card labels a two-handed-occupied offhand as "Not in catalog", contradicting its own body text |
| 2 | CONFIRMED | AGREE | WIDER | `web/src/screens/Upgrades.tsx:890` | Zone tallies attribute a drop's full sighting count to every zone name it carries, so "Where to go" sums to more sightings than the rows report |
| 3 | CONFIRMED | AGREE | AGREE | `web/src/screens/Upgrades.tsx:1282` | The three EP figures on a row do not reconcile: printed candidate EP minus printed worn EP disagrees with the printed gain on 3% of rows |
| 4 | CONFIRMED | AGREE | NARROWER | `web/src/screens/Upgrades.tsx:517` | A stale importer `withheld` entry locks a position out of the ranking forever and prints "no catalog carries this item's stats" about the fully-statted item now worn there |
| 5 | CONFIRMED | AGREE | WIDER | `web/src/screens/Upgrades.tsx:1809` | The "Not compared" card marks an offhand blocked by a two-handed Primary as "Not in catalog" |
| 6 | CONFIRMED | AGREE | WIDER | `web/src/screens/Upgrades.tsx:648` | The `nothing` bucket reports "nothing scored" for positions whose only positive candidate was skipped as Lore-claimed or worn elsewhere |
| 7 | CONFIRMED | TOO-HIGH | NARROWER | `web/src/screens/Upgrades.tsx:1781` | An empty ranking headlines "Nothing outranks what you are wearing" when nothing is worn and nothing was scored |
| 8 | REFUTED | AGREE | AGREE | `web/src/data/normalize.ts:175` | `src.c` is written as the number 1 and read as `=== true`, so the Crafted source filter matches zero items and 665 items are told "no acquisition data is recorded" |
| 9 | CONFIRMED | TOO-LOW | WIDER | `web/src/screens/Upgrades.tsx:1810` | An empty offhand under a two-handed Primary is marked "Not in catalog" |
| 10 | CONFIRMED | AGREE | NARROWER | `web/src/screens/Upgrades.tsx:572` | Primary row shows the first two-hander that clears the 0.05 EP floor, not the biggest net gain — a one-hander further down the same list can be worth more |
| 11 | CONFIRMED | AGREE | WIDER | `web/src/screens/Upgrades.tsx:536` | The Lore hand-out is ordered by a key computed from an item the position can never be offered, and the row then prints 'offered in the single position where it gains the most' — false on the repo's own Avenrae fixture |
| 12 | CONFIRMED | TOO-HIGH | AGREE | `web/src/screens/Landing.tsx:256` | Landing page says the client "corrected" the SV Void rule; the cited record and the same page say it predicted it exactly |
| 13 | CONFIRMED | AGREE | WIDER | `web/src/screens/Upgrades.tsx:1146` | Upgrades tells the reader a Lore item is placed where it gains the most; the allocation is greedy and is not, in 2 of 8 Lore rows on the shipped Avenrae import |
| 14 | CONFIRMED | AGREE | WIDER | `web/src/screens/Sources.tsx:680` | Sources page says a client window has been read for two items; the same page prints the list of five |
| 15 | CONFIRMED | AGREE | WIDER | `web/src/components/ItemPicker.tsx:240` | Item picker's "vs worn" delta compares candidate@preview against worn@its-own-tier, contradicting the worn item's own EP one row away |
| 16 | CONFIRMED | AGREE | NARROWER | `web/src/components/ItemPicker.tsx:241` | Picker's "vs worn" baseline counts weapon ratio/damage in slots where no candidate is allowed to score them |
| 17 | CONFIRMED | TOO-LOW | NARROWER | `web/src/screens/Upgrades.tsx:464` | Import-withheld slot prints "+0" for gear the export said was +5 — the parsed tier is discarded |
| 18 | CONFIRMED | AGREE | WIDER | `web/src/share/codec.ts:63` | Share links drop GearSet.withheld, so a position the author's screen called "not comparable" is ranked as an upgrade for the reader |
| 19 | CONFIRMED | AGREE | AGREE | `web/src/state/persistence.ts:249` | GearSet.withheld is also dropped on every page reload, because sanitizeSet does not copy it |
| 20 | CONFIRMED | AGREE | AGREE | `web/src/share/codec.ts:654` | Share links drop GearSet.defaultFilters, so the reader's ranking is computed over a different candidate pool than the author's |
| 21 | CONFIRMED | TOO-HIGH | AGREE | `web/src/engine/character.ts:234` | Race unset skips the race gate entirely, so "Usable by this loadout" prints over items the character's race cannot wear |
| 22 | CONFIRMED | TOO-HIGH | NARROWER | `web/src/lib/blockReason.ts:37` | blockReason prints the ALL_EXCEPT sentinel as an inclusion list, producing a sentence that states the opposite of the truth |
| 23 | CONFIRMED | TOO-LOW | WIDER | `web/src/components/ItemWindow.tsx:276` | The item window's Class and Race requirement rows print the raw ALL_EXCEPT token, so an exclusion list reads as an inclusion list |

## Findings that were raised and never judged

| # | Sev claimed | File:line | Title |
|---|---|---|---|
| 1 | minor | `web/src/screens/Upgrades.tsx:1015` | Measured-drops header counts the same mob twice when the payload spells it with different capitalisation |
| 2 | minor | `web/src/screens/Upgrades.tsx:1461` | The screen ranks as soon as the index loads, so every row claims "nobody has measured it dropping" until the shards land |
| 3 | minor | `web/src/screens/Sources.tsx:397` | Sources card is titled "The largest reason is not an expansion" directly under a table whose largest reason is era:Velious |
| 4 | minor | `web/src/screens/PlanarGear.tsx:990` | Planar gear page says "a hundred and six rows" where its own header counts 105 pieces |
| 5 | minor | `web/src/screens/Landing.tsx:64` | The front page's Earthshaker product shot has drifted from the shipped Earthshaker record it is described as copying |
| 6 | minor | `web/src/screens/NewCharacter.tsx:16` | NewCharacter's justification comment measures the shipped payload at 7,341 race-restricted items; it holds 248 |
| 7 | minor | `web/src/screens/SharedSet.tsx:71` | A good share link opened while the item catalog failed to load says the link was made against a different catalog build and to ask for a fresh one |
| 8 | minor | `pipeline/build.mjs:2148` | items-index.json ships no required-level field, so the level gate and the Level requirement row are absent until the slot shard loads |

## Full text

Every finding below carries the mechanism its author claimed, the evidence they said they
ran, and — where one exists — the refuter's verdict and corrected scope. Nothing here is
re-verified by this extraction; it is a faithful copy of what the run produced.

### 1. "Not compared" card labels a two-handed-occupied offhand as "Not in catalog", contradicting its own body text

`web/src/screens/Upgrades.tsx:1810` — severity claimed **serious**, scope claimed **Measured over the shipped payload and the repo's own validation character. web/src/screens/audit-2h.test.ts ran the Avenrae import (research/validation/tier0-inventory-Avenrae.txt, which wears Earthshaker — a two-hander) across all 5 presets x 3 comparison bases = 15 runs: `heldOffhandOccupied: 15`, i.e. every single run produces a SECONDARY withheld row with reason `offhand-occupied`, and therefore this badge. It is not an edge case for any player wielding a two-handed weapon.**

**Mechanism.** The `.upg-heldmark` badge is a three-branch ternary over five `WithheldReason` values. It names only `worn-unstatted` and `profile-blind-to-weapons`; `worn-unresolved`, `offhand-occupied` and `offhand-unpriceable` all fall through to the literal string `'Not in catalog'`. So a Secondary slot withheld because the Primary is two-handed renders the badge "Not in catalog" directly above the paragraph `WITHHELD_TEXT['offhand-occupied']`, which correctly says "The weapon in your Primary takes both hands, so there is no offhand to fill." For `offhand-unpriceable` the withheld entry is the PRIMARY position (Upgrades.tsx:639-646), whose worn weapon *is* in the catalog, so the badge is false about that item too.

**Evidence the author ran.** Mounted the real screen in jsdom (new file web/src/screens/audit-dom.test.tsx): seeded the fixture catalog with a 2H item ('[Fixture] Greatsword of Audit', wp.skill '2H Slashing'), equipped it in PRIMARY on a WAR/BRD/BER 50 with RATIO-weighted set, rendered `#/set/{id}/upgrades`, then read the `.upg-held` cards.
$ cd web && npx vitest run src/screens/audit-dom.test.tsx   # 1 passed
DOM dump:
[ { "slot": "Secondary", "worn": "nothing equipped", "mark": "Not in catalog",
    "body": "The weapon in your Primary takes both hands, so there is no offhand to fill. Ranking one h…" } ]

**Player impact.** A player wielding a greatsword opens Upgrades and is told, in the badge, that their offhand slot is "Not in catalog" — a statement about missing data — when the actual reason is that they have no free offhand. The correct explanation is one line below, so the card says two contradictory things about the same slot. In the `offhand-unpriceable` case the badge additionally asserts that a Primary weapon the app just scored and named is not in the catalog.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-HIGH**, scope **AGREE**.

*Corrected scope.* The lens's "15 of 15" reproduces, and the real scope is wider than one character. Measured against the shipped payload (3,663 items, `public/data/items-index.json` count field, cross-checked by walking all 23 shards):

1. 2H inventory: 123 distinct items match `isTwoHanded` (`/^2H/i` on `wp.skill`) — 63 "2H Slashing", 59 "2H Blunt", 2 "2H Piercing" as raw shard rows (124 rows, 123 distinct names). Every class can wield at least some: WAR 71, SHD 72, PAL 66, RNG 54, BER 30, CLR/SHM 29, DRU 27, NEC/MAG/BST 22, MNK 21, ENC 19, WIZ 18, BRD 10, ROG 8.

2. Determinism, not edge case: for a WAR/BRD/BER 50 on the Melee DPS preset, I equipped each of the 73 distinct 2H items that trio can use, one run each, and ran `computeUpgrades` against the real catalog: 73 runs, 73 SECONDARY withheld rows with reason `offhand-occupied`, 73 of which evaluate the shipped ternary to "Not in catalog". Not one exception. The badge is a pure function of the reason, so it fires on 100% of 2H-primary loadouts.

3. Preset x basis sweep on a 2H wearer (5 presets x 3 bases = 15 runs): `{"offhand-occupied":15,"profile-blind-to-weapons":9}` — the lens's 15/15 for `offhand-occupied` is exact. The 9 `profile-blind-to-weapons` rows (tank/caster/healer x 3 bases) are the PRIMARY row and are labelled correctly.

4. `offhand-unpriceable` is real but rare, and the lens's claim about it holds. Sweeping all 279 usable 1H primaries for that trio, each worn at +10 with an unresolved item in SECONDARY: 1 of 279 runs produced an `offhand-unpriceable` withheld row. It was on PRIMARY, wornName "Dagas", and "Dagas" IS in the shipped catalog (present in `public/data/items/PRIMARY.json`, `cl:["WAR"]`, 1H Slashing) — so the badge asserts "Not in catalog" about an item the app just looked up and named. Rare, but the lens described it accurately.

5. One correction in the finding's favour that the lens did not state: the third fallthrough value, `worn-unresolved`, renders "Not in catalog" TRUTHFULLY. So of the three reasons that fall through, one is right and two are false. I confirmed `worn-unresolved` fires on a real unresolved offhand (probe run: `[{"slot":"SECONDARY","reason":"worn-unresolved","worn":"Shield Of Nothing That Exists"}]`).

Not measurable from here: what fraction of real players wield a two-hander. The only real character in the repo (research/validation/tier0-inventory-Avenrae.txt) wears Earthshaker, a two-hander, so it is 1 of 1 — but that is a sample of one and should not be reported as a rate.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with two instruments, neither of them the one quoted.

(a) Source. `web/src/screens/Upgrades.tsx:1809-1812` is a three-branch ternary over the five-member `WithheldReason` union (declared at :135-137). It names `worn-unstatted` and `profile-blind-to-weapons`; `worn-unresolved`, `offhand-occupied` and `offhand-unpriceable` all fall to the literal `'Not in catalog'`. The very next line, :1815, prints `WITHHELD_TEXT[entry.reason]`, which for `offhand-occupied` (:1407-1408) is "The weapon in your Primary takes both hands, so there is no offhand to fill…". TypeScript agrees the reason is fully narrowed: when I wrote the same ternary in a probe against a value already narrowed to `'offhand-occupied'`, `tsc -b` rejected the first two branches as unreachable (`TS2367: types '"offhand-occupied"' and '"worn-unstatted"' have no overlap`), which is a compiler-issued proof that the fallthrough is the only reachable branch for that reason.

(b) Real browser, real build, real payload — a different instrument from the quoted jsdom + fixture-catalog test. New spec `web/e2e/audit9-badge.spec.ts` seeds `localStorage['eqlups.state.v1']` with a WAR/BRD/BER 50 wearing the shipped catalog's real "An Executioners Axe" (`cl:["WAR","BER"]`, `wp.skill:"2H Slashing"`) in PRIMARY on the Melee DPS preset, then loads `#/set/set_audit/upgrades` in Chromium against `vite preview` of `npm run build`. The card that painted:
  slot "Secondary" / worn "nothing equipped" / mark "Not in catalog" / body "The weapon in your Primary takes both hands, so there is no offhand to fill. …"
Section header above it: "Not compared". So the shipped app tells a greatsword-wielder their empty offhand is "Not in catalog" directly above the paragraph explaining that they have no offhand. The string is in the bundle: `grep -o "Not in catalog" dist/assets/index-*.js | wc -l` → 3.

(c) Engine level, real payload, my own loader (`web/src/screens/audit9-scope.test.ts`, `audit9-unpriceable.test.ts`) — 73/73 and 1/279 as described in scope.

(d) One thing the lens missed that strengthens the mechanism: "Not in catalog" is not an arbitrary phrase here. Everywhere else in this app it is gated strictly on `unresolved` — `src/components/SlotCard.tsx:167` (`{unresolved ? … 'Not in catalog' …}`) and `src/screens/SetCompare.tsx:75` (`{side.unresolved ? …}`). The file set searched was all of `web/src` (`grep -rn "Not in catalog" src/`), 5 hits, of which those two plus `Upgrades.tsx:1812` are renders. So the string has one established meaning across the UI — "this item is not in the shipped catalog" — and Upgrades is the only place that prints it when that is not what happened.

Instrument check: my first two runs failed because I passed an `Item` to `canUse`, which takes `ItemRestrictions {classes, races, rl}`; the guard I wrapped it in swallowed the TypeError and made the 2H pool empty, so a run reported a vacuous pass. I found that by noticing the sweep found no 2H item at all, and fixed it to the same shape `src/selectors/gear.ts:384` uses. The 73/73 and 1/279 numbers are from after that fix.

SEVERITY — the mechanism holds, but "serious" is one notch too high; I would call it moderate.
Against: no number is wrong. The ranking is correct, the withholding is correct, the correct explanation is in the same card, one line below the badge, in full prose. Nothing the player could act on is misdirected — there is no action to take on an occupied offhand, and the body text says so. It is a mislabel, not a miscalculation, and it is self-correcting within the card for anyone who reads two lines.
For: it is a false claim about data provenance in a tool whose stated constitution is that every claim on screen is sourced; it reuses a string that means something specific and different in two other screens; it fires on 100% of two-handed loadouts, so no 2H player escapes it; and in the `offhand-unpriceable` case it contradicts the app's own naming of an item it just scored. It also reads as nonsense next to "nothing equipped" — an empty hand cannot be absent from a catalog.
That combination is a real copy defect worth fixing (two more branches in the ternary), but it is not in the class of defects this repository calls serious — a wrong number or advice a player cannot act on. Moderate.

SCOPE — AGREE with the lens, and I measured it wider; see corrected_scope. The lens's 15/15 is exactly reproduced, and the underlying rate is 100% of 2H-primary loadouts (73/73 distinct items), not merely one character's runs.

### 2. Zone tallies attribute a drop's full sighting count to every zone name it carries, so "Where to go" sums to more sightings than the rows report

`web/src/screens/Upgrades.tsx:890` — severity claimed **serious**, scope claimed **7 of 60 rankings measured (4 trios x 5 presets x 3 bases, Avenrae's imported set, shipped payload). Worst observed inflation: 12 true sightings rendered as 18 across the column (+50%). 25 of 677 drop rows in the payload carry >1 zone.**

**Mechanism.** `zoneTallies` loops `for (const zone of drop.zones ?? [])` and adds `Math.max(0, drop.seen)` — the whole count — once per zone, with no split and no de-duplication by the survey slug that `drop.zs` carries. A drop row recorded under two zone strings that resolve to the same survey (`slug: 'planeofhate'`, `title: 'Plane of Hate'`) therefore produces two separate `ZoneTally` entries, each claiming the row's entire `seen`. The list is rendered by raw `tally.zone` (Upgrades.tsx:1739); `tally.slug`, which would collapse them, is computed and never read in the render.

**Evidence the author ran.** Payload, verified directly:
$ cd web && node -e '...' public/data/items/LEGS.json → Imbrued Platemail Greaves ms = [{"mob":"Mistress of Scorn","seen":6,"sessions":5,"zones":["The Plane of Hate","The Plane of Hate - Group"],"zs":[{...slug:"planeofhate",title:"Plane of Hate"...},{...slug:"planeofhate",title:"Plane of Hate"...}]}]  — one mob, 6 sightings, one surveyed zone under two names.
Sweep (new file web/src/screens/audit-zones.test.ts), 4 trios x 5 presets x 3 bases = 60 rankings against the shipped 3,663-item payload:
$ cd web && npx vitest run src/screens/audit-zones.test.ts
{ "runs": 60, "runsWithInflation": 7, examples: [
 "avenrae/melee-dps/worn: rows report 12 sightings, Where-to-go column sums to 18; multi-zone rows [\"LEGS:Imbrued Platemail Greaves\"]; tallies [[\"The Plane of Hate\",1,6],[\"The Plane of Hate - Group\",1,6],[\"The Plane of Fear\",1,3],[\"The Castle of Mistmoore\",1,2],[\"Nagafen's Lair - Group\",1,1]]", … ] }
Payload-wide: 25 of 677 measured drop rows carry more than one zone (node one-liner over web/public/data/items/*.json).

**Player impact.** The "Where to go" section — whose own note insists it is "made of nothing but counts" and "never a rate" — lists Plane of Hate and Plane of Hate - Group as two destinations, each credited with all 6 sightings of an item that was seen 6 times in one surveyed zone. A player comparing the row's own "6 sightings" mark against the zone table sees 12, and reads two places to farm where the payload records one.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* Payload census (deduped by item name over web/public/data/items/*.json, all 21 shard files, 3,663 unique names — matches items-index.json `count`):

- 25 of 677 measured drop rows carry more than one zone string. THEIR NUMBER IS CORRECT; I reproduced it exactly.
- 21 unique items have a "Where to go" column that sums HIGHER than the sum of their own row sighting marks. Of those 21, three (Drop of Mercury, Froglok Meat, Living Heart of a Brell Minion) live in OTHER.json with `sl` undefined and `st` undefined — they can never become a ranked upgrade row. So the player-facing item scope is 18 of 3,663 items (0.49%), all of them Plane of Hate armour (Imbrued/Apothic/Indicolite/Insidious/Rune Etched/Woven Shadow).
- Of the 25 multi-zone rows, 19 are the pair ["The Plane of Hate", "The Plane of Hate - Group"] with identical slug `planeofhate`; 1 more is ["The Ruins of Old Paineel", "The Ruins of Old Paineel - Group"] with no survey at all; the remaining 5 name genuinely different zones (Old Paineel + Northern Felwithe, City of Guk + Ruins of Old Guk). So 20 of 25 are same-place duplicates and 5 are a distinct over-attribution case. Zero multi-zone rows carry two DIFFERENT survey slugs.
- Total arithmetic inflation across the payload: 146 sightings (sum of seen*(zones-1)).

Rankings sweep, my own harness, Avenrae's imported set x 5 presets x 4 bases = 20 runs: 1 run (melee-dps/worn) shows an inflated sum. I reproduced their headline example number-for-number: rows report 12 sightings, column sums to 18, zone list [["The Plane of Hate",1,6],["The Plane of Hate - Group",1,6],["The Plane of Fear",1,3],["The Castle of Mistmoore",1,2],["Nagafen's Lair - Group",1,1]]. Their 7-of-60 spans 4 trios I do not have fixtures for; I neither confirm nor refute it, but the one config we share matched exactly.

WHERE IT IS WIDER THAN THEY MEASURED — the phantom-destination half does not need a multi-zone drop row at all. Two DIFFERENT items, one logged under "The Plane of Hate" and one under "The Plane of Hate - Group", also produce two ZoneTally rows for one place, with no sum inflation. In my Avenrae sweep, 2 of 20 runs render a duplicate destination pair while only 1 of 20 has an inflated sum. Feeding the whole payload into one ranking (309 sighted item records, 19 rendered zone rows) yields THREE survey slugs rendered twice, not one: planeofhate (64 items/177 seen + 31 items/83 seen), planeoffear (54/229 + 3/3), nagafenslair (26/98 + 23/250). Six of the nineteen zone rows a maximal list prints are half of a split destination.

WHERE THE HEADLINE IS ONE-SIDED — the same function also UNDER-counts. `zoneTallies` contributes nothing for a drop row with no `zones` key, so 33 sightings across 11 items (Gnoll Fang, Giant Snake Fang, Blackburrow Gnoll Pelt, Jade, Crude Arrow, Spiked Collar, Giant Snake Rattle, Ill-Fitting Robes, Wooden Totem, Runed Shawl, Darkpaw Sash) are silently dropped from the column. Whole-payload-in-one-ranking: rows report 2,881 sightings, column sums to 2,983 (+102 net = +146 inflation - 44 dropped on duplicate shard records). The true invariant that fails is "the column sums to the rows", not "the column sums high".

Worst inflation is worse than they reported. They cite +50% (12 -> 18) as the worst observed; that is the worst RANKING-level figure. Per item the worst equippable case is 100%: Imbrued Platemail Greaves rows report 6 sightings and its column sums to 12, and Apothic Kilt (5 -> 10), Indicolite Greaves (5 -> 10), Insidious Slippers (3 -> 6), Indicolite Boots (4 -> 8), Rune Etched Greaves (3 -> 6) all double. Drop of Mercury goes 102 -> 180 but is unslottable.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with two instruments neither of which is theirs.

The code at /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-10/web/src/screens/Upgrades.tsx:880-918 is exactly as described. Inside `zoneTallies`, per item: `for (const zone of drop.zones ?? []) seenHere.set(zone, (seenHere.get(zone) ?? 0) + Math.max(0, drop.seen))` — the whole `seen`, once per zone string, no split. The outer map `byZone` is keyed on the raw zone string, so two strings that resolve to one survey become two `ZoneTally` entries. `tally.slug` is written at lines 904 and 910 and read NOWHERE: `grep -rn "slug" src/screens/Upgrades.tsx` returns only those two writes plus the interface declaration at 859, and `grep -rn "zoneTallies\|ZoneTally" src/` shows the only consumer is `Upgrades.tsx:1528`, whose render at 1738-1743 prints `tally.zone` and `tally.seen`. `tally.title` (the survey's own "Plane of Hate") is likewise computed and never printed. Their mechanism sentence is accurate in every particular.

The comparator they use is real and on the same screen, not buried in a detail panel: the per-row sighting mark is `{pluralize(totalSightings(drops), 'sighting')}` at Upgrades.tsx:1246, rendered in the collapsed row's `upg-sub` line beside the item name, with an authoring comment saying it is there so a reader can see it "without opening any of them". So a player really can read "6 sightings" on the row and "6 sightings" twice in the zone column below it.

The payload backs it: LEGS.json's Imbrued Platemail Greaves has one `ms` row, mob "Mistress of Scorn", seen 6, zones ["The Plane of Hate","The Plane of Hate - Group"], with `zs` carrying two entries both slug "planeofhate", title "Plane of Hate". The pipeline knows these are one place — pipeline/build.mjs:992-1004 documents the " - Group" difficulty suffix and `zoneTokens` strips /\s*-\s*(group|raid|solo)\s*$/i precisely so both names match one survey. The app then un-does that folding by grouping on the unfolded string.

Instrument 1 (web/src/screens/verify-zonetally.test.ts): calls `zoneTallies` directly with rows synthesized from the shipped payload, one item at a time and then all at once — no `computeUpgrades`, no character, no preset. Instrument 2 (web/src/screens/verify-zonetally2.test.ts): a real `computeUpgrades` ranking over Avenrae's imported inventory, 5 presets x 4 bases. Both reproduce it, and instrument 2 reproduces their exact quoted numbers.

Instrument check: `zoneTallies` reads only `row.candidate.item` (line 883), so my minimal row shims are faithful; instrument 2 does not shim at all, it uses real ranked rows. My first run surprised me — whole-payload delta +102 against a computed inflation of 146 — and rather than report either number I chased it and found the under-count path (drop rows with no `zones`), which is reported above.

SEVERITY — AGREE, at the low end of "serious". Arguments for: it is a self-contradicting number on the same screen, in the one section whose own header text insists it is "made of nothing but counts, never a rate", under a "Tier M · measured" badge; it invents a destination that does not exist; and the affected items are the marquee Plane of Hate armour a level-50 trio actually farms, not a fringe corner. Arguments against a higher grade: no EP, gain, ranking order or recommendation is touched — I checked the melee-dps/worn case specifically and collapsing the duplicate would not reorder that zone list; the duplicate row is visibly labelled "- Group", so a player who knows the game may read it as one zone; and it is 18 of 3,663 items. I would not grade it lower than serious in a repository whose stated constitution is "compute it, or check it, or don't print it", because the failure mode here is precisely a printed number contradicting another printed number.

SCOPE — WIDER, with one of their figures confirmed and two corrected. See corrected_scope.

### 3. The three EP figures on a row do not reconcile: printed candidate EP minus printed worn EP disagrees with the printed gain on 3% of rows

`web/src/screens/Upgrades.tsx:1282` — severity claimed **minor**, scope claimed **24 of 810 ranked rows = 2.96%, measured over 60 rankings (4 trios x 5 EP presets x 3 comparison bases) against the shipped catalogue with Avenrae's imported gear. Always off by exactly 0.1.**

**Mechanism.** `gain` is computed from unrounded floats (`candidate.ep - entry.wornEp`, Upgrades.tsx:611) and then each of the three quantities is independently rounded to 1dp for display: worn EP by `epText(row.wornEp)` (line 1202), candidate EP by `epText(candidate.ep)` (line 1233), gain by `signedEp(row.gain)` (line 1282). Nothing re-derives the gain from the rounded operands, so whenever the two operands round in opposite directions the row prints A, B and G with B − A ≠ G.

**Evidence the author ran.** New file web/src/screens/audit-exact.test.ts reproduces the screen's own formatters over 4 trios x 5 presets x 3 bases against the shipped payload:
$ cd web && npx vitest run src/screens/audit-exact.test.ts
{ runs: 60, rows: 810, epDiff: 24 }
Exact floats for one case (avenrae/balanced/worn, PRIMARY):
  wornEp 37.14285714285714 → prints "37.1"
  candidate.ep 113.45238095238095 (Dagas) → prints "113.5"
  gain 76.30952380952381 → prints "+76.3"
  113.5 − 37.1 = 76.4
Another (avenrae/healer/+0, FEET): worn 14.4 → "14.4", candidate 29.75 → "29.8", gain 15.35 → "+15.3"; 29.8 − 14.4 = 15.4.
Arithmetic confirmed independently: node -e '(29.75).toFixed(1)' → "29.8"; '(15.35).toFixed(1)' → "15.3".

**Player impact.** The row is laid out as an equation the reader is invited to check — "Wearing X · 37.1 EP → Best available Dagas · 113.5 EP" with "+76.3 EP" in the gain column. On one row in thirty-three the subtraction the reader performs gives a different answer from the number the app prints beside it, on a screen whose whole premise is that its numbers can be checked.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **AGREE**.

*Corrected scope.* Rounding class (the mechanism as stated): 103 of 3,414 ranked rows = 3.02%, measured over 160 rankings (8 trios x 5 EP presets x 4 comparison bases: worn, fixed +0, +5, +10) against the shipped catalogue with deterministically-built worn sets. This agrees with the previous lens's 2.96% (24/810) from a different sample. Their sub-claim "always off by exactly 0.1" holds for this class over my sample (deltas seen: -0.10 x73, +0.10 x30) and is provable: |(b-a)-g| <= 0.05*3 = 0.15 and all three printed values are multiples of 0.1, so the discrepancy can only be 0 or 0.1.

Correction to the headline number, not the mechanism: the row's printed equation fails on MORE rows than the finding says — 135 of 3,414 = 3.95%. The extra 32 rows (0.94%) are a SECOND, independent mechanism the finding does not name: two-handed candidates, where `gain` is `candidate.ep - entry.wornEp - netting.offhandEp` (Upgrades.tsx:610) so the gain is net of an offhand EP that is not one of the two figures on the row. Those miss by 0.6 to 33.5 EP, e.g. WAR/BRD/BER melee-dps, PRIMARY: worn "14.4", candidate "176.7" (Monsoon, Sword of the Swiftwind), gain "+161.7"; 176.7 - 14.4 = 162.3, offhandEp 0.6. Unlike the rounding class this one is disclosed: a "TWO-HANDED -0.6 EP, giving up X" chip renders in `.upg-detail`, which Upgrades.css:315 shows is always visible, not collapsed. So the rounding class remains the only silent one, and 3% is the right number for it.

*Refuter reasoning.* MECHANISM — confirmed by reading and by two instruments, neither of them theirs.

Reading: `ep()` in web/src/lib/format.ts:36-38 is `finite(value).toFixed(1)`. On the row, worn EP prints via `epText(row.wornEp)` (Upgrades.tsx:1202), candidate via `epText(candidate.ep)` (1233), gain via `signedEp(row.gain)` (1282, which is `epText(Math.abs(v))` at 959-961). `gain` is set at Upgrades.tsx:610 as `candidate.ep - entry.wornEp - (netting?.offhandEp ?? 0)` from unrounded floats. Nothing re-derives the gain from the rounded operands. All three sit in the same `<li className="upg-row">` (1184-1307): two `.upg-side` blocks and the `.upg-gain` block, no expansion needed.

Instrument 1 (pure, new file web/src/screens/recon-audit.test.ts): my own trios and my own worn sets built out of the shipped catalogue, rounding re-implemented locally as `v.toFixed(1)` and first asserted equal to the screen's own `epText` on 8 probe values before being trusted. 160 rankings, 3,414 rows, 135 non-reconciling.

Instrument 2 (DOM, new file web/src/screens/recon-dom.test.tsx): mounts the real `<App/>` on the shipped catalogue with a real character and set, drains the sliced ranking, then scrapes the three figures back off the painted `.upg-row` as strings. 21 rows painted, 3 fail: Waist "36.8 EP" -> "59.3 EP" printed "+22.6" (59.3-36.8=22.5); Ear 1 "2.3" -> "21.3" printed "+18.9" (=19.0); Wrist 1 "0.8" -> "14.5" printed "+13.8" (=13.7). This is the strongest form of the claim — the numbers as a player sees them, not as a function returns them.

Their quoted arithmetic also checks out independently: node -e prints (29.75).toFixed(1)="29.8", (15.35).toFixed(1)="15.3", (37.14285714285714).toFixed(1)="37.1", (113.45238095238095).toFixed(1)="113.5", (76.30952380952381).toFixed(1)="76.3".

SEVERITY — minor is right. The error is one display unit (0.1 EP), it never changes the ranking (the sort is on the unrounded `gain`, upgrades-avenrae.test.ts pins monotonicity on the float), and it never changes which item a player is told to farm. What makes it a defect rather than nothing is the project's own rule — the row is laid out as an equation with all three terms on it, and on ~1 row in 33 the subtraction the reader performs returns a different answer from the one printed beside it. Minor, but real; I would not call it cosmetic and I would not call it more than minor.

SCOPE — agrees with theirs for the mechanism they named (3.02% vs 2.96%, different sample, same magnitude). The one thing I would change in the write-up is the headline: "the three EP figures on a row do not reconcile on 3% of rows" is true of the rounding mechanism but understates total non-reconciliation, which is 3.95% once two-handed netting is counted. That second class is a different mechanism with a much larger error, and it is disclosed on screen, so it belongs in a separate finding rather than folded into this one.

WHAT I DID NOT TEST — I did not check whether any reader has ever noticed, and I did not measure the imported-Avenrae sample they used (I deliberately built a different one). Both instrument files are left in the worktree at /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-11/web/src/screens/.

### 4. Measured-drops header counts the same mob twice when the payload spells it with different capitalisation

`web/src/screens/Upgrades.tsx:1015` — severity claimed **minor**, scope claimed **6 of 810 ranked rows across the 60-ranking sweep (0.74%); 17 items and 22 duplicate pairs in the shipped payload of 3,663 items.**

**Mechanism.** `measuredDrops` (Upgrades.tsx:797) filters and sorts the raw `item.ms` rows but never merges rows whose `mob` differs only in case, and the header prints `pluralize(rows.length, 'mob')` — a count of drop rows presented as a count of mobs. The `<ol className="upg-drops">` below it likewise renders both rows, keyed on `${drop.mob}|${zones}`, so the same creature appears twice in the list.

**Evidence the author ran.** $ cd web && npx vitest run src/screens/audit-exact.test.ts → { rows: 810, mobDupRows: 6, runsWithMobDup: 6 }, with:
"heal/melee-dps HANDS Lustrous Russet Gauntlets: header prints \"6 sightings across 3 mobs\" but distinct mob names (case-insensitive) = 2; mobs=[\"A shiverback\",\"A scareling\",\"a scareling\"]"
"caster/melee-dps HANDS Midnight Clad Fistwraps: header prints \"7 sightings across 5 mobs\" … mobs=[…,\"phoboplasm\",\"Phoboplasm\"]"
Payload-wide (node one-liner over web/public/data/items/*.json): 17 items carry 22 such case-duplicate mob pairs.

**Player impact.** A player reading "6 sightings across 3 mobs" and the list beneath it sees "A scareling" and "a scareling" as two separate creatures to hunt, and a mob count one higher than the number of mobs actually observed dropping the item.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 5. A stale importer `withheld` entry locks a position out of the ranking forever and prints "no catalog carries this item's stats" about the fully-statted item now worn there

`web/src/screens/Upgrades.tsx:517` — severity claimed **serious**, scope claimed **Measured, not asserted. Triggered by any set built through the inventory importer that had at least one worn item with no published stats — on the project's own shipped Tier-0 capture that is exactly 1 of 23 positions (HEAD / Shadow Rage Helm), i.e. the very case Upgrades.tsx's own header comment cites as the reason `withheld` exists. Every equip path in the app goes through `store.equip` and therefore leaves the entry stuck: the Upgrades screen's own Equip button (Upgrades.tsx:1559), its ItemDetail equip (Upgrades.tsx:1850), the slot picker (SetEditor.tsx:443), Auto-fill (SetEditor.tsx:167) and the item browser (ItemBrowser.tsx:727). `grep -rn "\.equip(\\|applySlots(" --include=*.tsx --include=*.ts web/src \| grep -v '\.test\.' \| grep -v state/store.ts` returns those five `equip` call sites plus three `applySlots` sites; only `applySlots` (a re-import) clears the map. Nothing else in the app reads `GearSet.withheld` — same grep over web/src shows Upgrades.tsx:1479 as the only reader — so there is no other surface where the player can see or clear it.**

**Mechanism.** `upgradeSteps` reads `options.withheldSlots?.[position.id]` (Upgrades.tsx:470) and, in the reason ternary at Upgrades.tsx:509-519, sets `reason = 'worn-unstatted'` from that name alone — with no check that the position is still empty. `store.equip` (web/src/state/store.ts:369-378) writes `slots[position]` but never deletes `s.withheld[position]`; only `applySlots` (store.ts:484-487) clears it. So once an inventory import records a withheld position, every subsequent equip into that position leaves the entry in place, the position is pushed into `report.withheld` instead of being ranked, and the card's `wornName` (`view.equipped?.itemName ?? withheldName`, Upgrades.tsx:534) names the NEW item while `WITHHELD_TEXT['worn-unstatted']` describes the OLD one.

**Evidence the author ran.** Reproduced end-to-end against the shipped payload (3,663 items) and the repository's own Tier-0 capture, `research/validation/tier0-inventory-Avenrae.txt`, rendering the real `Upgrades` screen in jsdom (`cd web && npx vitest run src/screens/audit-render.test.tsx`, scratch file, no source modified):

  readInventory(...) -> withheldMap = {"HEAD":"Shadow Rage Helm"}
  applySlots(setId, toSlotMap(res), true, withheldMap(res))

  === AS IMPORTED ===
  KPI: "Slots with a better option 16/23 — 5 already best · 2 not comparable · 0 with nothing to offer"
  CARD: "Head  Shadow Rage Helm +0  Unsourced · stats withheld  No catalog carries this item's stats..."

  useApp.getState().equip(setId, 'HEAD', 'Cap of Mending', {full:0,fraction:0})
  helm stats: {"AC":3,"CHA":5,"ENDUR":10,"HP":10,"STR":5}  statsUnknown: undefined

  === AFTER EQUIPPING Cap of Mending IN HEAD ===
  KPI: "Slots with a better option 16/23 — 5 already best · 2 not comparable · 0 with nothing to offer"
  CARD: "Head  Cap of Mending +0  Unsourced · stats withheld  No catalog carries this item's stats, so nothing can be measured against it. A gain here would be arithmetic against a zero nobody recorded. The best scoring item this position can take is Hammerhead Helm at 15.1 EP. Whether that beats what you have is a question only your own client can answer."

Store-level confirmation of the same mechanism (`npx vitest run src/screens/audit-sticky.test.tsx`):
  after import,  withheld = {"HEAD":"Shadow Rage Helm"}
  after equip,   slots.HEAD = {"itemName":"Cap of Mending",...}  withheld = {"HEAD":"Shadow Rage Helm"}
  expect(after?.withheld).toBeUndefined() -> FAILED, received {"HEAD":"Shadow Rage Helm"}

**Player impact.** One of the 23 positions permanently disappears from the ranking (16/23 stays 16/23 after a legitimate upgrade), and the "Not compared" card makes a flatly false Tier-claim about a real item: it names Cap of Mending — AC 3, CHA 5, ENDUR 10, HP 10, STR 5 in the shipped catalog — and says no catalog carries its stats. A player who follows the card's own advice ("the best scoring item this position can take is Hammerhead Helm") and equips it is rewarded by the same card reappearing, now accusing the Hammerhead Helm of being unsourced.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **NARROWER**.

*Corrected scope.* The lens's measured figure is right; its stated trigger population is not measured and is far narrower than the phrasing implies.

TRIGGER POPULATION, MEASURED. The only route into `GearSet.withheld` is `withheldMap(result)` (inventoryImport.ts:856), which copies `result.unstatted` entries of `kind:'item'`. The only route into `result.unstatted` for a worn item is `statsAreUnknown(match.item)` at inventoryImport.ts:550 — i.e. the item must RESOLVE in the shipped catalog and have unknown stats. So the trigger set is exactly the shipped items for which `statsAreUnknown` is true AND which occupy a wearable slot. Measured over the full merged payload (items-index.json + every public/data/items/*.json shard, 3,663 items):

  items with unknown stats = 16 of 3663
  wearable unstatted (sl non-empty) = 6
  the six: Shadow Rage Helm (HEAD), Sleeves (ARMS), Wristguard (WRIST), Gloves (HANDS), Leggings (LEGS), Boots (FEET) — all cl:["BER"]
  the other 10 have sl:[] (Backpack*, Lightweight Bag, Velium Gemmed Rune, Crushbone Battle Plans, …) and can never occupy a position

So this is 6 items in 3,663 (0.16%), one armour set, one class. "Any set built through the inventory importer that had at least one worn item with no published stats" is true but reads much wider than the payload allows: in the shipped catalog it means "a Berserker wearing Shadow Rage armour", and nothing else.

PER-SET IMPACT IS WIDER THAN 1 OF 23. The six pieces sit in six distinct positions, so a fully Shadow-Rage-geared BER records six withheld entries and locks six positions at once. Ran that case (D in the scratch file):
  D rows/settled/withheld = 9 / 7 / 7   vs   E (same slots, withheld cleared) = 11 / 11 / 1
and five of the seven "Not compared" cards name a real, fully-statted worn item under the "no catalog carries this item's stats" text: Lustrous Russet Vambraces (ARMS), Hotof's Bracer (WRIST_1), Indicolite Gauntlets (HANDS), Indicolite Greaves (LEGS), Imbrued Platemail Boots (FEET). One stale entry produces one false claim; six produce five at once (the sixth position was still empty in that construction).

ESCAPE HATCH THE LENS DID NOT NAME. `applySlots` (store.ts:484-487) does clear the entry, and it is reachable from the UI: SetEditor.tsx:191 re-imports into the existing set with replace=true. So a player who re-runs the inventory import from a fresh export in which the Shadow Rage piece is gone does get the position back. Nothing on screen says so, and no other action clears it — `store.equip` and `store.unequip` both leave it (measured below), and store.ts:484-489 is the only write of `withheld` anywhere in web/src.

DELIVERY SCOPE unchanged and confirmed: `gearSet.withheld` has exactly one reader, Upgrades.tsx:1479. No existing test exercises `withheldSlots` against a re-equipped position — `grep -n "withheldSlots" src/screens/upgrades.test.ts src/screens/upgrades-screen.test.tsx` returns nothing; only upgrades-avenrae.test.ts passes it, and only in the as-imported state.

*Refuter reasoning.* MECHANISM — CONFIRMED, with two instruments neither of which the lens used.

(1) Engine level, no React and no jsdom: I called `computeUpgrades` directly against the real merged payload (3,663 items) and the repo's own Tier-0 capture. The lens rendered the `Upgrades` screen in jsdom; I bypassed the component entirely and read the returned report object.

  withheldMap = {"HEAD":"Shadow Rage Helm"}
  A (as imported)                      rows/settled/withheld = 10 / 11 / 2
    HEAD -> withheld  reason="worn-unstatted"  wornName="Shadow Rage Helm"
  Cap of Mending stats = {"AC":3,"CHA":5,"ENDUR":10,"HP":10,"STR":5}  statsAreUnknown = false
  B (slots.HEAD = Cap of Mending, withheld map untouched — store.equip semantics)
                                       rows/settled/withheld = 10 / 11 / 2
    HEAD -> withheld  reason="worn-unstatted"  wornName="Cap of Mending"
    HEAD in rows = false
  C (control: identical slots, withheld entry cleared)
                                       rows/settled/withheld = 11 / 11 / 1
    HEAD row: worn "Cap of Mending" wornEp 8.5, candidate "Indicolite Helm", gain 15.0 EP

B vs C isolates the entry as the sole cause: same slots, same weights, same filters; the only difference is the stale map, and it costs the player one ranked row carrying a real 15.0 EP gain. `WITHHELD_TEXT['worn-unstatted']` (Upgrades.tsx:1399-1400) is then printed against `wornName = "Cap of Mending"` — an item the same payload gives five stats. My run used the Balanced profile, so my KPI split (10/11/2) differs from the lens's (16/5/2); the invariant they claimed holds under both, and the KPI is byte-identical between A and B.

(2) Store level, node environment (`// @vitest-environment node`), not jsdom:
  after import  withheld = {"HEAD":"Shadow Rage Helm"}  slots = ["CHEST"]
  after equip   withheld = {"HEAD":"Shadow Rage Helm"}  slots.HEAD = {"itemName":"Cap of Mending",...}
  after unequip withheld = {"HEAD":"Shadow Rage Helm"}
`unequip` leaving it too is a detail the lens did not report.

Code reading matches: `equip` (store.ts:369-378) returns `{ ...s, slots: {...} }` and never touches `s.withheld`; `mutateSet` (store.ts:189-195) only spreads. The reason ternary at Upgrades.tsx:509-519 falls through to `withheldName ? 'worn-unstatted'` with no emptiness check, and `wornName` at :534 is `view.equipped?.itemName ?? withheldName` — so the name and the sentence describing it come from different sources, which is the defect in one line. Every finding element the lens stated is reproduced.

SEVERITY — AGREE with "serious". The house rule this repository is built around is "compute it, or check it, or don't print it", and this prints an uncomputed claim: a sentence asserting no catalog carries an item's stats, rendered next to an item whose stats the same payload just supplied. It is persistent (the map is written to localStorage by `persist()` and survives reload), self-reinforcing (following the card's own "best scoring item this position can take" advice re-enters through `store.equip`, which does not clear it), and it silently removes a real 15.0 EP ranking from a screen whose entire purpose is that ranking. Rarity belongs to scope, not here, and the lens correctly kept them apart. Not higher than "serious": no data is corrupted, the escape hatch (re-import) exists, and no number the app computes is itself wrong — the failure is that a correct number is suppressed and a false sentence shown.

SCOPE — NARROWER; see corrected_scope. The one figure the lens actually measured (1 of 23 on tier0-inventory-Avenrae.txt) I reproduce exactly. What is unmeasured is the population that can trigger it, and measuring it shrinks the finding to six catalog items, all BER-only Shadow Rage armour, reachable only through the inventory importer — while simultaneously showing the per-set worst case is six locked positions, not one.

### 6. The "Not compared" card marks an offhand blocked by a two-handed Primary as "Not in catalog"

`web/src/screens/Upgrades.tsx:1809` — severity claimed **minor**, scope claimed **Fires on every render in which the Primary holds a two-handed weapon. On the shipped Tier-0 capture that is 1 of 23 positions, on every paint. Across a 864-case adversarial sweep against the shipped payload (`npx vitest run src/screens/audit-adv.test.ts`), `offhand-occupied` was reached 864 times and `profile-blind-to-weapons` 576 times; the withheld-reason distribution was {"worn-unresolved":1728,"worn-unstatted":3456,"offhand-occupied":864,"profile-blind-to-weapons":576}. `offhand-unpriceable` was not reached in that sweep, so its mark is unverified in a render.**

**Mechanism.** The `upg-heldmark` ternary (Upgrades.tsx:1809-1813) has branches for only two of the five `WithheldReason` values: `worn-unstatted` and `profile-blind-to-weapons`. `offhand-occupied` and `offhand-unpriceable` fall through to the else branch and render the literal string 'Not in catalog'. `WithheldReason` is a five-member union (Upgrades.tsx:135-137) and nothing forces the ternary to cover it, so adding a reason silently inherits the wrong mark.

**Evidence the author ran.** Reproduced by rendering the real screen against the repository's Tier-0 capture (Avenrae wields a two-hander), `cd web && npx vitest run src/screens/audit-render.test.tsx`, dumping `container.querySelectorAll('.upg-held')`:

  CARD: "Secondary  nothing equipped +0  Not in catalog  The weapon in your Primary takes both hands, so there is no offhand to fill. Ranking one here would be advice you cannot act on. ..."

The mark and the paragraph directly beneath it contradict each other, and the mark is attached to a position the same card says holds nothing.

**Player impact.** A one-line mark that reads as the card's headline says the item is missing from the catalog, when the card's own body says the opposite — the offhand is blocked because the Primary takes both hands. For `offhand-occupied` with an empty Secondary it reads "nothing equipped … Not in catalog", which asserts a catalog gap about no item at all.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* The card appears on 1 of 23 positions (TOTAL_POSITIONS === 23, SLOT_POSITIONS includes SECONDARY — printed by `npx vitest run src/screens/verify-positions.test.ts --disable-console-intercept`), and it is the only render site: `grep -rn "upg-heldmark" web/src/` returns exactly one JSX call site (Upgrades.tsx:1809) plus its CSS rule and my own test — no other screen renders this mark.

TRIGGER CONDITION, corrected. The prior lens said it "fires on every render in which the Primary holds a two-handed weapon." Precisely: `offhandOccupied = position.id === 'SECONDARY' && wornTwoHander !== null` (Upgrades.tsx:507) with `wornTwoHander` from `views.find(v => v.position.id === 'PRIMARY' && isTwoHanded(v.item ?? undefined))?.item ?? null` (441-442). So the worn Primary must ALSO resolve in the loaded catalog — a Primary worn but not in the catalog gives `isTwoHanded(undefined) === false` and the Secondary is not withheld at all. Otherwise the prior lens is right that nothing else gates it: `offhand-occupied` is first in the reason ladder (509-518), it is a member of `WITHHELD_WITHOUT_WORN` (153-156) so the card is pushed with an empty Secondary too, and I reproduced both the empty and the shield-worn Secondary.

HOW OFTEN, measured against the shipped payload (web/public/data/items-index.json, count 3663):
- 123 rows carry a `wp.skill` matching /^2H/i, out of 560 rows with any `wp`; all 123 list PRIMARY and none lists SECONDARY. 123 of 526 PRIMARY-eligible rows = 23.4% of everything a player can put in the Primary hand is a two-hander. (`node -e` over items-index.json.)
- Per class, share of PRIMARY-eligible rows that are two-handed: SHD 24.7%, WAR 23.8%, PAL 22.9%, BER 21.3%, RNG 18.4%, MAG 15.8%, NEC 15.2%, ENC 13.4%, WIZ 13.3%, CLR 11.5%, ROG 9.8%, SHM 9.7%, DRU 9.4%, BRD 9.2%, MNK 7.0%.
- This is where the prior scope is understated. For 46 of 75 (class x preset-profile) cells, the HIGHEST-EP Primary item in the shipped catalog at +0 is two-handed — including melee-dps/WAR (Monsoon, Sword of the Swiftwind), melee-dps/PAL and /SHD (Mithril Two-Handed Sword), and every caster/healer staff class. Command: `cd web && npx vitest run src/screens/verify-scope.test.ts --disable-console-intercept`; it scores every PRIMARY row with `scoreItem(item, tier(0), profile.weights, { weaponCounts: true })` over `PRESET_PROFILES`. Caveat on my own instrument: that is raw top-EP at +0, a PROXY for the screen's ranking, which additionally applies set filters, race/level gating, Lore, and net-of-worn gain. It is not the app's full pipeline. But it means a player who takes the tool's own strongest Primary suggestion lands in this state in the majority of configurations, so this is not an edge case reachable only by unusual gear choices.
- The repository's own Tier-0 reference confirms the exact worst variant independently of the prior lens's render: research/validation/tier0-inventory-Avenrae.txt line 75 is `Primary  Earthshaker +10`, line 81 is `Secondary  Empty`, and `Earthshaker` in items-index.json carries `wp.skill: "2H Slashing"`. So "nothing equipped ... NOT IN CATALOG" is what the shipped capture produces.

NOT REPRODUCED: I did not reach `offhand-unpriceable` in a render either (I built an unbeatable one-handed Primary plus an unresolved offhand; only the Secondary's `worn-unresolved` card appeared). Its mark stays unverified in a render, same as the prior lens reported. I also did not re-run their 864-case sweep — that file does not exist on this worktree's HEAD (66825bc) — so their 864/576 counts are neither confirmed nor contradicted here.

*Refuter reasoning.* MECHANISM — CONFIRMED, with a different instrument than the one quoted. I did not use their Tier-0 capture render or their test files (neither `audit-render.test.tsx` nor `audit-adv.test.ts` exists at this worktree's HEAD). I wrote web/src/screens/verify-heldmark.test.tsx, which mounts the real `<App/>` over the FIXTURE catalog seeded with a two-handed row copied verbatim out of the shipped payload (`An Executioners Axe`, id 5407, `wp.skill: "2H Slashing"`), and dumps `.upg-slot` / `.upg-heldmark` / full text per `.upg-held` card.

Two-handed Primary, EMPTY Secondary:
  slot "Secondary", mark "Not in catalog", body "Secondary | nothing equipped | +0 | Not in catalog | The weapon in your Primary takes both hands, so there is no offhand to fill..."
Two-handed Primary, shield WORN in Secondary: same mark "Not in catalog", same two-handed body.
Control, one-handed Primary + a real fixture shield: NO withheld card at all (`[]`) — so the mark on the two cases above is caused by the two-hander, not by anything incidental in my fixture.

Reading Upgrades.tsx:1809-1813 confirms the shape the prior lens described: the ternary covers `worn-unstatted` and `profile-blind-to-weapons` and lets everything else hit the literal `'Not in catalog'`. Of the three uncovered reasons, `worn-unresolved` lands correctly (I rendered it: "not in the catalog this build shipped"), `offhand-occupied` is flatly wrong, and `offhand-unpriceable` is wrong-by-attachment (its body says the OFFHAND is uncatalogued, but the mark sits on the Primary card whose worn item is in the catalog).

Their claim that "nothing forces the ternary to cover it" is also confirmed by direct experiment rather than by inspection. I added a sixth member `'probe-new-reason'` to the `WithheldReason` union and ran `npx tsc --noEmit`: exactly one error, TS2741 at Upgrades.tsx:1398 — the `Record<WithheldReason, string>` body-text table. Zero errors at the ternary. So the body text is exhaustiveness-checked and the mark is not; a new reason silently inherits "Not in catalog". I restored Upgrades.tsx afterward (`git status` shows it unmodified; only my three new test files are untracked).

SEVERITY — AGREE, minor, at the upper end of minor. Arguments for keeping it minor: the correct, detailed explanation sits one line below the mark and is never wrong; no EP number, no ranking, and no recommendation is affected; and the mark is a small badge, not the headline. That last point is a correction to the prior lens's IMPACT wording — `.upg-heldmark` (web/src/screens/Upgrades.css:730-737) is `font-size: var(--fs-micro)`, uppercase mono, `margin-left: auto`, i.e. a right-aligned micro label in the card head, not a headline. Argument against dropping it lower: "Not in catalog" is not vague filler in this UI, it is an established term with one meaning — SlotCard.tsx:167 and SetCompare.tsx:75 both use that exact string for a genuinely unresolved item. So a reader who has met it on the Gear screen reads a definite false claim here, and in the empty-Secondary case the false claim is about no item at all. Minor is the right bucket; it is a wrong sentence, not wrong advice.

SCOPE — WIDER than stated. Their per-render count is right (1 of 23 positions, every paint), but the framing of how many players hit it is understated. Measured numbers are in corrected_scope; the headline is that a two-hander is the highest-EP Primary in the shipped catalog for 46 of 75 class x preset-profile combinations, so the tool's own advice steers users into this state rather than it being a fringe configuration.

### 7. The `nothing` bucket reports "nothing scored" for positions whose only positive candidate was skipped as Lore-claimed or worn elsewhere

`web/src/screens/Upgrades.tsx:648` — severity claimed **minor**, scope claimed **Measured per weight profile in the same run: {melee-dps:[0 false,0 true], tank:[0,0], caster:[0,0], healer:[0,0], balanced:[0,0], ENDUR-only:[9,47], CHA-only:[0,16], SV_DISEASE-only:[0,8]}. Zero false verdicts across 920 position-verdicts under all five shipped presets — the bucket never fires at all there — so this needs a hand-set single-stat weight profile that narrows a doubled slot's scoring pool to one item. Separately, the four buckets themselves are sound: across 984 generated sets against the shipped payload (22,632 position verdicts: 120 random sets over 5 presets × 4 trios, plus an 864-case adversarial sweep over unresolved names, importer-withheld slots, statsUnknown items, two-handed primaries, negative and single-stat weights, four filter sets and both comparison bases) `rows + withheld + settled + nothing` was 23 in every case and no position appeared in two buckets.**

**Mechanism.** `consideredAny` is set only inside the `accept` callback (Upgrades.tsx:599, 602-603). `take` skips a candidate with a bare `continue` when it is worn in another position (Upgrades.tsx:567) or when a Lore item has already been claimed (Upgrades.tsx:568), never reaching `accept`. If those skips consume every positively-scoring candidate, `best` is null with `consideredAny === false`, and the emit loop takes the `nothing.push(entry.position)` branch (Upgrades.tsx:648) rather than `settled`. The report's own doc comment says `nothing` means "the pool held no usable candidate at all", the KPI renders it as "N with nothing to offer" (Upgrades.tsx:1681) and the footer as "Nothing scored for <labels>" (Upgrades.tsx:1836).

**Evidence the author ran.** For every position the report placed in `nothing`, I re-ran `rankSlotItems` with the identical slot, context, weights, `upgrade` and `existing` arguments `upgradeSteps` uses, and counted candidates scoring > 0 (`cd web && npx vitest run src/screens/audit-nothing.test.ts`):

  nothing-bucket check: false= 9 true= 71
  "Fingers 1: report says 'nothing scored'; top Hamed's Ring of Tears @ 24.0 EP; wornIn=nowhere; lore=true; claimedByRow=FINGERS_2 (weights {\"ENDUR\":1})"
  "Ear 2: report says 'nothing scored'; top Black Sapphire Electrum Earring @ 27.0 EP; wornIn=EAR_1; lore=false; claimedByRow=none (weights {\"ENDUR\":1})"

Both skip paths are represented: a Lore ring handed to the sibling finger, and an earring already worn in Ear 1.

**Player impact.** The footer names the slot in "Nothing scored for Ear 2" and the KPI counts it under "with nothing to offer", when in fact a 27.0 EP candidate exists and was withheld for an allocation reason the footer states one sentence earlier. A player reading "nothing scored" concludes the catalog has no answer for that slot rather than that they need a second copy or a non-Lore alternative.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* The mechanism is real but its trigger conditions are WIDER than stated in two measured respects, while the headline "zero under the shipped presets" survives and is confirmed at ~10x the sample.

1. NOT single-stat-only. Prior lens: "this needs a hand-set single-stat weight profile". Measured over 400 random sets x random custom profiles of 1-3 weighted stats (`SCOPE: custom profiles of 1-3 stats`): 56 false `nothing` entries out of 1,660, in 41 of 400 runs. Split by profile width — 1 stat: 138 runs, 22 with a false entry, 32 false entries; 2 stats: 144 runs, 19 with a false entry, 24 false entries; 3 stats: 118 runs, 0 and 0. Two-stat profiles account for 24 of the 56 false entries (43%). The floor is "narrow", not "single".

2. NOT doubled-slot-only. Prior lens: "narrows a doubled slot's scoring pool to one item". Measured affected positions across the 56: WRIST_2=16, EAR_2=11, WRIST_1=11, FINGERS_2=8, NECK=6, FINGERS_1=2, EAR_1=2. NECK is a singleton position. Pinned deterministically (`SCOPE detail: a singleton position can be starved by a different slot type`): under {HP_REGEN:1}, seeds 21/56/180/199 all show `Neck "nothing scored" | top=Talisman of Kejaar Kerrath @ 3.0 EP lore=true slots=[NECK] | handed instead to ANY_2`. An ANY position consumes a NECK-only Lore item and starves the one slot that item exists for. The finding's framing does not cover this.

3. Blocker weighting is off. The finding presents both skip paths as comparably represented. Measured: of 95 false entries in sweep A, 94 were Lore-claimed (Upgrades.tsx:568) and 1 was worn-elsewhere (:567); of 56 in sweep B, 56 Lore and 0 worn-elsewhere. The :567 path is real and I reproduced it deterministically (below), but it is rare under random sets — Lore is the dominant path by ~95:1.

4. Preset claim confirmed and corrected in wording. Prior lens: "Zero false verdicts across 920 position-verdicts under all five shipped presets — the bucket never fires at all there." The zero survives at larger sample: 400 preset runs (5 presets x 4 eras x 5 sources x 2 hideNoDrop x 2 seeds) = 9,200 position-verdicts, 0 false. But "the bucket never fires at all there" is only true under DEFAULT filters (0 `nothing` entries measured). Under narrow filters the bucket fires 4,178 times across those same preset runs — every one of them a genuine empty pool. Their statement generalizes a default-filters observation.

5. Reachability, relevant to whether the trigger is exotic. web/src/components/WeightsEditor.tsx ships a "Clear all" button (onClick={() => onChange({})}) plus a `type="number"` input per WEIGHTABLE_KEY. So {ENDUR:1} is Clear all + one typed number — two clicks and a keystroke, not a hand-edited state.

*Refuter reasoning.* MECHANISM — CONFIRMED, both skip paths, with two instruments neither of which is the one quoted (I never call `rankSlotItems`; the prior lens's `audit-nothing.test.ts` does not exist in this worktree, so nothing was reused).

Instrument 1, the decisive one — a confound-free END-TO-END DIFFERENTIAL through `computeUpgrades`. For every position the report placed in `nothing`, I reran the IDENTICAL gear set with `withheldSlots` set on every other position. That flag only sets `reason`, which the queue sort at Upgrades.tsx:582-585 pushes to the back; no worn item changes, so `totalsFor`/`scoreContextFrom` and therefore every candidate score are bit-identical to the original run. Only the allocation order moves. Result: 94 of 94 Lore-blocked positions that had reported "nothing scored" produced a real row with a positive gain, e.g. `Fingers 2: "nothing scored" ... diffA_row=Hamed's Ring of Tears +16.0`. A pool that yields a +16.0 EP row when the same position picks first was not a pool that "held no usable candidate at all" — which is exactly what the doc comment at Upgrades.tsx:631-635 says `nothing` means, what the KPI at :1681 renders as "with nothing to offer", and what the footer at :1836 prints as "Nothing scored for Fingers 2".

Instrument 2, for the `wornAt` path at :567 in isolation — a targeted deterministic case, no randomness. Under {ENDUR:1} the EAR pool contains exactly one wearable positively-scoring item, Black Sapphire Electrum Earring @ 25.0 EP, non-Lore. Equip it in EAR_1 and nothing else: EAR_2 lands in `nothing` (nothing=true, row=false). Empty EAR_1 and rerun: EAR_2 gets `Black Sapphire Electrum Earring +25.0`. This is the prior lens's Ear 2 example independently rebuilt from a different starting set (they reported 27.0 EP against a full imported set, I get 25.0 against an otherwise-empty one — the gap is cap headroom in `existing`, not a disagreement).

INSTRUMENT SELF-CHECK (house rule 4). My `scoreItem`-based cross-check replicates the ranker's gates by hand, so it could over-report. Three guards: (a) the 94/94 differential result does not depend on it at all; (b) it agreed exactly with the app's own output in the targeted test — I computed 25.0, the control run printed +25.0; (c) my first preset sweep ignored `matchesFilters` and would have mis-scored every narrow-filter case, so I fixed it to filter the pool with the app's own `matchesFilters` before re-measuring — the corrected preset false-count is 0. `npx tsc --noEmit` exits 0.

FILE SET SEARCHED, so the zeros mean something: the shipped payload at web/public/data/items-index.json (count field = 3663, verified by node) merged with every web/public/data/items/<SLOT>.json shard, loaded exactly as upgrades-avenrae.test.ts loads it; character BRD/WAR/BER level 50. The 3-stat zero is over 118 runs, the preset zero over 400 runs x 23 positions.

SEVERITY — AGREE with "minor", and I want the reasons on record rather than assumed. Downward: it cannot occur under any of the five shipped presets under any of the 40 era/source/no-drop filter combinations (0/9,200 position-verdicts); even under a narrow custom profile only 3.4% of `nothing` entries (56/1,660) are false; and the footer at Upgrades.tsx:1830-1834 already states "Items already worn elsewhere in this set are not offered again, a Lore item is offered for one position only" in the sentence immediately before the "Nothing scored for ..." list, so the explanation is on screen even though it is not attached to the named slot. Upward: the KPI subtitle "N with nothing to offer" carries no such qualifier at all, and the defect is a false statement of fact on a player-facing surface in a project whose stated constitution is "compute it, check it, or don't print it" — a 25.0 EP candidate exists and the screen says nothing does. Those roughly cancel; the mis-stated fact sits on a footer sentence and a KPI subtitle rather than on any ranked row's number, so "minor" is the right call. I would not raise it and I would not drop it.

### 8. An empty ranking headlines "Nothing outranks what you are wearing" when nothing is worn and nothing was scored

`web/src/screens/Upgrades.tsx:1781` — severity claimed **serious**, scope claimed **Measured over the shipped payload (3,663 normalized items from web/public/data/items/*.json) with a WAR/BRD/BER-50 context and an empty set, running `computeUpgrades` across all 40 era x source combinations the set-config dialog offers: 18 of 40 produce rows=0, settled=0, nothing=23 — i.e. render this headline. They include plain single-axis choices, not just exotic pairs: `era=Paineel, source=any` (22 Paineel items in the payload, none eligible for this trio) and every one of the 5 `source=crafted` rows. Command: cd web && npx vitest run src/screens/__probe3.test.ts --silent=false --reporter=verbose.**

**Mechanism.** The screen branches on `rows.length` alone. Two different report states collapse into one branch: `settled > 0` (every candidate was priced and none beat what is worn) and `nothing.length > 0` (no candidate reached the ranking at all). When the second happens for all 23 positions and every slot is empty, the empty state still renders the heading "Nothing outranks what you are wearing" and the body "Every position this set can score is already carrying the best item the catalog offers it". `upgradeSteps` has already distinguished the two — it increments `settled` only when `consideredAny` is true (line 647) and pushes to `nothing` otherwise — but `report.settled` and `report.nothing` are not consulted at the branch.

**Evidence the author ran.** Mounted the real screen (`<App/>` at `#/set/{id}/upgrades`) with the fixture catalog, a WAR/BRD/BER 50 character, an entirely empty gear set, and the set's own `defaultFilters` set to `{era:'any', source:'crafted', hideNoDrop:false}` — both dropdowns exist in `SetConfigDialog.tsx:350-370`.

  cd web && npx vitest run src/screens/__probe2.test.tsx --silent=false --reporter=verbose

  --- rows on screen: 0
  --- empty-state h2: Nothing outranks what you are wearing
  --- empty-state p: Every position this set can score is already carrying the best item the catalog offers it, each candidate at the tier its slot already carries. ...
  --- KPIs: Slots with a better option 0/23 · 0 already best · 0 not comparable · 23 with nothing to offer
  --- foot: ... Nothing scored for any position.

Control run in the same file, same set, no filters: 23 rows, "23/23 · 0 already best ... 0 with nothing to offer". So the branch is driven by the empty candidate pool, not by anything about the worn gear. Note the KPI hint ("0 already best · 23 with nothing to offer") and the footer ("Nothing scored for any position") both state the truth; only the headline contradicts it.

**Player impact.** A player who has just set a narrow filter and is looking at 23 empty slots is told, in the largest text on the page, that they are already wearing the best the catalog offers. The correct statement — that the filter left nothing to rank — is present only in a KPI sub-hint and in the last sentence of a footnote paragraph below the fold.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-HIGH**, scope **NARROWER**.

*Corrected scope.* Scope is NARROWER than reported, and the supporting examples are partly wrong.

MEASURED, same context the prior lens named (WAR/BRD/BER level 50, empty set, 40 era x source states with hideNoDrop=false, shipped payload = 3,663 items after merging items-index.json with the 19 shards):
- 16 of 40 states render the headline, not 18. All 16 have settled=0, nothing=23 — i.e. all 16 are the false-headline case, so the prior lens's characterisation of the states is right even though the count is not.
- The 16: Fear/vendor, Fear/crafted, Hate/quest, Hate/vendor, Hate/crafted, Paineel/{any,drop,quest,vendor,crafted}, Temple/vendor, Temple/crafted, Sky/vendor, Sky/crafted, Kunark/vendor, Kunark/crafted.
- 16 is robust to my instrument choices: identical under shards-only (4,004 records) and index+shards-merged (3,663) catalogs, and identical under three weight profiles — balanced (the store default), melee-dps, and the prior lens's own {AC:2,STR:1,STA:1,HP:0.2,RATIO:20}. The tank preset gives 17 (it withholds 2 positions).
- Across other class trios: CLR/DRU/SHM 14, PAL/SHD/NEC 14, WAR/BRD/BER 16, WIZ/MAG/ENC 17, ROG/MNK/RNG 17. So the honest range is 14–17 of 40, not 18.
- Counting the hideNoDrop checkbox as a third axis (80 states) gives 35 of 80 for WAR/BRD/BER, all settled=0.

TWO SUPPORTING CLAIMS CORRECTED:
- "every one of the 5 source=crafted rows" is wrong twice over. There are 8 crafted states (7 eras + 'any'), and only 6 of them are zero-row. era=any/source=crafted renders 22 rows on screen (mounted probe: ".upg-row count = 22", KPI "22/23"), and Classic/crafted also ranks. So crafted is not a clean single-axis example.
- era=Paineel/source=any IS confirmed as a single-axis example (mounted: 0 rows, headline shown). Payload era counts, computed: Classic=2907, Sky=382, (no era)=187, Temple=101, Kunark=32, Fear=27, Paineel=22, Hate=5.

SCOPE DIMENSION THE FINDING DID NOT MEASURE — reachability without a filter: 0 of 112 states (16 classes x levels 1,5,10,20,30,40,50, empty set, DEFAULT filters any/any/false) produce rows=0. WAR/BRD/BER at levels 1–5 all give 23 rows. So the state is unreachable until the player (or a set they imported) deliberately narrows a filter. That is a real narrowing of who ever sees it.

SCOPE DIMENSION THAT WIDENS IT SLIGHTLY: with a fully geared set (autoFill best-in-slot, 23 assigned), 40 of 40 states render the empty state — but only the same 16 have settled=0. The other 24 are settled>0 (e.g. Sky/any: settled=18, nothing=5), where the headline is defensible for the scored positions and merely silent about the unscored ones.

*Refuter reasoning.* MECHANISM — confirmed, by reading and by a different instrument.

By reading: web/src/screens/Upgrades.tsx:1760 is `{rows.length ? (<ol className="upg-list">…) : (<div className="empty-state"><h2>Nothing outranks what you are wearing</h2>…)}`. Neither `report.settled` nor `report.nothing` appears anywhere in that ternary or its body — `grep -n "settled\|nothing" src/screens/Upgrades.tsx` puts their only render-side uses at 1680–1681 (the KPI sub-hint) and 1835–1836 (the footnote). upgradeSteps really does separate the two at line 647–648 (`else if (consideredAny) settled += 1; else nothing.push(entry.position);`), under a comment that says in so many words "Two different facts, and they were one branch."

By instrument: the prior lens mounted `<App/>` against the FIXTURE catalog. I mounted `<App/>` against the REAL shipped payload, with `fetch` stubbed to read `public/data/**` off disk so the catalog goes through its own index fetch, shard merge and normalisation (status=ready, items=3663). Results, verbatim from the probe:
  CONTROL any/any   → .upg-row = 23, empty-state h2 = "" , KPI "23/23", hint "0 already best · 0 not comparable · 0 with nothing to offer"
  Paineel/any       → .upg-row = 0,  h2 = "Nothing outranks what you are wearing", p = "Every position this set can score is already carrying the best item the catalog offers it…", KPI "0/23", hint "0 already best · 0 not comparable · 23 with nothing to offer", footnote ends "Nothing scored for any position."
  Sky/crafted       → identical to Paineel/any
  any/crafted       → .upg-row = 22 (no empty state)
So with an entirely empty gear set and a filter that empties the candidate pool, the screen states that every position already carries the best item the catalog offers. The mechanism holds.

SEVERITY — too high. The finding is real but "serious" overstates it, on three measured grounds and one that cuts the other way.
(1) The impact line says the false claim is "in the largest text on the page". It is not. `.empty-state h2` is `--fs-large` = clamp(20px,2.2vw,30px) (src/styles.css:715-718, src/styles/tokens.css:522). `.page-title` is `--fs-title` = clamp(30px,4.4vw,56px) (styles.css:192-194, tokens.css:559) — strictly larger. And `.upg-kpivalue` (Upgrades.css:113-115) is the SAME `--fs-large` step, so the true reading "0/23" is rendered at equal size and sits ABOVE the headline in DOM order, with "23 with nothing to offer" immediately under it. The reader meets the correct number before the wrong sentence, not only after it.
(2) No number is wrong. The ranking, the KPIs and the footnote are all correct; this is a copy/branch defect in one heading and one paragraph.
(3) It is unreachable from a default set: 0 of 112 class x level states with default filters reproduce it (measured). The player must have narrowed a filter, which is exactly the context in which "widen this set's filters" — already the third clause of the empty-state paragraph — is the right next move.
Cutting the other way: `defaultFilters` round-trips through set import/export (src/lib/setExport.ts:40,198), so someone who imports another player's set JSON can land on this screen without having chosen the filter themselves and with no idea a filter is on — the active filters are named only in the footnote (`applied` is used at Upgrades.tsx:1831 and nowhere else). That keeps it above cosmetic. I would call it moderate: a contradictory headline on a player-facing surface, contradicted by correct text of equal prominence directly above it.

SCOPE — narrower, and two of the supporting examples do not hold. See corrected_scope for the numbers and the command that produced each.

Probe files left in the worktree: web/src/screens/__audit_render.test.tsx, __audit_scope.test.ts, __audit_scope2.test.ts, __audit_scope3.test.ts, __audit_scope4.test.ts.

### 9. `src.c` is written as the number 1 and read as `=== true`, so the Crafted source filter matches zero items and 665 items are told "no acquisition data is recorded"

`web/src/data/normalize.ts:175` — severity claimed **serious**, scope claimed **901 of 3,663 distinct shipped items lose their crafted flag; 665 of them have no other source datum and therefore render the "no acquisition data" paragraph. The `crafted` option is a live dropdown entry in two places — `SOURCE_FILTERS` rendered by web/src/components/SetConfigDialog.tsx:366 (which feeds Upgrades via `filtersFor`) and the hard-coded `<option value="crafted">Crafted</option>` at web/src/components/ItemPicker.tsx:484 — so selecting it anywhere in the app yields an empty result set, for every slot, always.**

**Mechanism.** `pipeline/build.mjs:1532` emits `src.c = 1`. `normalizeSource` sets `src.c` only when `raw.c === true || raw.crafted === true || raw.playerCrafted === true` — a strict boolean test that `1` fails. `normalizeSource` then returns `undefined` whenever `c` was the only key present, so those items reach the app with no `src` at all. Two consumers read the result: `matchesSource(item,'crafted')` in web/src/lib/setFilters.ts returns `src.c === true`, and `acquisitionLines` in Upgrades.tsx:945 emits the "Crafted · Player-made" line on `src.c`. Both are dead against the shipped payload.

**Evidence the author ran.** Raw payload scan over web/public/data/items/*.json:
  rows with src.c present: 956  values: {"1": 956}   (node -e over the 19 shard files)

After running the app's own `normalizeCatalog` over the same files:
  cd web && npx vitest run src/data/__probe.test.ts --silent=false --reporter=verbose
  distinct normalized items: 3663
  distinct raw names carrying src.c: 901
  normalized items with src.c === true: 0
  items passing source=crafted filter: 0
  items passing source=drop: 1995 / quest: 1508 / vendor: 189
  distinct items carrying ONLY src.c (no z/m/q/v): 665
  crafted-only items whose acquisitionLines() is empty: 665
  sample name: CLASS 1 Bone Hooked Arrow  normalized src: undefined  acquisitionLines: []

For those 665, `SourceBlock` (Upgrades.tsx:1126-1131) falls to `.upg-source-none`: "No acquisition data is recorded for this item, and nobody has measured it dropping. That is a gap in our data, not a statement that it cannot be obtained." The payload does record where it comes from.

**Player impact.** Choosing "Crafted" produces an empty list everywhere in the app, which reads as "there are no crafted items in EverQuest Legends". Separately, 665 item detail blocks make a positive claim about our own data ("No acquisition data is recorded for this item") that the payload contradicts.

**Verdict** — mechanism **REFUTED**, severity **AGREE**, scope **AGREE**.

*Corrected scope.* Scope numbers are correct, reproduced exactly under a counterfactual mutation. Confirmed against the shipped payload (19 shard files, web/public/data/items/*.json): 4,004 item rows, 3,663 distinct names; 956 rows carry `src.c`, and the only value it ever holds is the number 1 (`values: {"1": 956}`); 901 distinct names carry it; 665 distinct names carry `c` with no non-empty z/m/q/v.

Running the real `normalizeCatalog` + real `matchesSource` + real `acquisitionLines` with normalize.ts:188 reverted to the pre-fix `raw.c === true || raw.crafted === true || raw.playerCrafted === true`:
  normalized src.c === true: 0
  matchesSource(item,'crafted') passes: 0   (drop 1995 / quest 1508 / vendor 189)
  items with NO src at all: 872
  sample 'CLASS 1 Bone Hooked Arrow' -> src: undefined, acquisitionLines: []
With the line as it actually ships at HEAD:
  normalized src.c === true: 901
  matchesSource(item,'crafted') passes: 901
  items with NO src at all: 207
  sample 'CLASS 1 Bone Hooked Arrow' -> src: {"c":true}, lines: [{key:'c',label:'Crafted',text:'Player-made'}]

872 − 207 = 665, exactly the previous lens's figure for items that would render the "No acquisition data is recorded for this item" paragraph. One nuance they did not state: 207 items legitimately have no source datum at all and show that paragraph either way, so the pre-fix total displaying it was 872, of which 665 were the wrongly-blanked crafted-only items.

Two UI surfaces claim confirmed and complete: `SOURCE_FILTERS = ['any','drop','quest','vendor','crafted']` at web/src/lib/setFilters.ts:18, rendered by web/src/components/SetConfigDialog.tsx:366, and the hard-coded `<option value="crafted">Crafted</option>` at web/src/components/ItemPicker.tsx:484. I checked the third candidate surface myself — the `#/items` ItemBrowser screen (web/src/screens/ItemBrowser.tsx) has four `<select>`s and none of them is a source filter — so the two places named are indeed the only ones.

*Refuter reasoning.* MECHANISM — REFUTED at HEAD, and it is not a close call: the fix is already committed. web/src/data/normalize.ts:188 currently reads `if (raw.c === true || raw.c === 1 || raw.crafted === true || raw.playerCrafted === true) src.c = true;`, with a comment block above it (lines 173-186) that recounts this exact defect. `git log -3 -- web/src/data/normalize.ts` shows c4cfb1c "CLOSES the dead Crafted flag: 956 items were never labelled, and one of five source filters matched nothing", which is HEAD~2 (HEAD is 087c0d4). The finding's quoted line number (175) and its three-spelling accept-list are the pre-c4cfb1c text. So the finding is accurate about a revision that is two commits behind the tree I was asked to audit, and false about the tree itself.

I did not settle this by reading the diff. Four instruments, three of them different from the vitest probe the previous lens used:

1. A plain `node -e` scan over the 19 raw shard files (no app code): 956 rows with `src.c`, value `1` in all 956, 901 distinct names, 665 crafted-only. This confirms the payload side of their claim is exactly right and unchanged.
2. The real app code end-to-end (`normalizeCatalog` -> `matchesSource` -> `acquisitionLines`) over the same files: 901 items normalize to `src.c === true`, 901 pass the crafted filter, and the previous lens's own sample item now returns `{"c":true}` and a "Crafted / Player-made" line. Their sample is the cleanest single refutation.
3. The production bundle. `VITE_BASE=/EQL50ups/ npx vite build`, then grepping the minified output: `(e.c===!0||e.c===1||e.crafted===!0||e.playerCrafted===!0)&&(t.c=!0)`. The numeric acceptance survives into the artifact CI actually ships, not just into source.
4. The built app booted in the local Chromium against a local static server — it loads and renders ("50 Upgrades — EQL Source"). I could not complete the click-through to the Crafted dropdown: that control lives in ItemPicker inside SetWorkspace, which needs a character and a saved set, and the `#/items` route has no source filter. So the browser leg is a load-check only; the filter-count evidence is from instrument 2, running the same functions the browser runs.

I checked my own instrument before trusting it, per the house rule, and it was wrong the first time: my probe keyed items by `it.name` when the `Item` interface (web/src/engine/types.ts:133) uses `n`, so every item collapsed onto one map entry and it printed "normalized distinct items: 1". Fixed to `it.n`, it printed 3,663 — matching the raw scan's distinct-name count independently. That agreement is what makes me trust the 901.

To confirm the previous lens was not simply wrong, I reproduced their result by mutation rather than by assumption: reverted line 188 to the pre-fix form (asserting the anchor string was present before writing), re-ran, and got 0 crafted matches and 872 source-less items — their numbers exactly. Then confirmed the repository's own regression tests catch it: under the mutation `web/src/data/normalize.test.ts` fails 2 of 16, on "accepts the numeric 1 the pipeline emits, not only a boolean" and "carries crafted items through from the real shipped payload". Restored the file; `git diff` clean, 16/16 pass.

SEVERITY — the question is conditional ("given the mechanism holds"), and on that reading "serious" was right, so I agree. I measured what the pre-fix code cost: one of five player-selectable source filters matching nothing in both places it is offered, and 665 item cards making a positive false claim about our own data. That is the right word for it. But stated plainly and separately: in the tree as it stands there is no impact at all, because the mechanism is not present. Severity of this finding against HEAD is nil.

SCOPE — agree, and unusually precisely. Every figure the previous lens gave reproduced to the unit under my counterfactual, from a different scan of the payload and a probe I wrote myself. I also independently verified the two UI surfaces they named are the complete set.

The one thing worth flagging to whoever routes these: the previous lens appears to have been run against a stale checkout. Its evidence is sound and its arithmetic is right; it is describing c4cfb1c^. Nothing to fix here.

### 10. An empty offhand under a two-handed Primary is marked "Not in catalog"

`web/src/screens/Upgrades.tsx:1810` — severity claimed **minor**, scope claimed **Fires whenever the loadout's Primary is two-handed — 124 two-handed rows / 123 distinct items in the shipped catalogue, per the measurement recorded at Upgrades.tsx:348 — and also for `offhand-unpriceable`. Exactly one withheld card per affected set, and the correct explanation sits directly beneath the wrong label.**

**Mechanism.** The `.upg-heldmark` ternary handles only two of the five `WithheldReason` values by name — `worn-unstatted` and `profile-blind-to-weapons` — and falls through to the literal string 'Not in catalog' for the other three. Two of those three, `offhand-occupied` and `offhand-unpriceable`, are reasons that fire specifically when nothing is worn in the slot (they are the members of `WITHHELD_WITHOUT_WORN`, Upgrades.tsx:153). The `wornName` beside the mark is null in that case and renders as 'nothing equipped', so the header line reads "Secondary · nothing equipped · Not in catalog". `WITHHELD_TEXT[entry.reason]` in the paragraph below is correct.

**Evidence the author ran.** Mounted the screen against the real shipped shards with a WAR/BRD/BER-50 character, `Abandoned Orc Shovel` (wp.skill '2H Blunt') equipped in PRIMARY at +0 and SECONDARY left empty:

  cd web && npx vitest run src/screens/__probe5.test.tsx --silent=false --reporter=verbose
  withheld entries: [ { "slot": "Secondary",
                       "worn": "nothing equipped",
                       "mark": "Not in catalog",
                       "body": "The weapon in your Primary takes both hands, so there is no offhand to fill. Ranking one here would be advice you cannot..." } ]

**Player impact.** The card's summary line accuses the catalog of a gap it does not have. A reader who scans marks rather than paragraphs concludes their empty offhand is a data problem rather than a consequence of holding a greatsword.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-LOW**, scope **WIDER**.

*Corrected scope.* The catalogue figure the finding quotes is exactly right, but the description of WHEN the wrong mark fires is narrower than the code.

CATALOGUE COUNT — recomputed independently over the shipped shards (node one-liner over web/public/data/items/*.json, 19 shard files, 4,004 rows, 3,663 distinct names): 788 rows carry `wp`; 2H Slashing 63 + 2H Blunt 59 + 2H Piercing 2 = 124 two-handed rows, 123 distinct names; 0 of them list SECONDARY; all 124 list PRIMARY. Identical to the comment at Upgrades.tsx:348. AGREE on that number.

FOUR WAYS THE SCOPE IS WIDER THAN STATED:

1. Not only an EMPTY offhand. `offhand-occupied` is computed from the Primary alone (`position.id === 'SECONDARY' && wornTwoHander !== null`, Upgrades.tsx:509) — nothing about the Secondary enters it. Case B: Primary = 2H, Secondary = a resolvable catalogued shield, renders `Secondary · [Fixture] Buckler of Practice · Not in catalog`. That is strictly worse than the reported case: the mark names a real, present catalogue item and declares it absent. `WITHHELD_WITHOUT_WORN` means "withheld even when nothing is worn", not "fires only when nothing is worn"; the finding's mechanism paragraph reads it the other way.

2. All five presets, not just weapon-aware ones. `offhand-occupied` is the FIRST arm of the reason ternary (Upgrades.tsx:509-517), so it beats `blindToWeapons`. Case G (tank-shaped weights, no RATIO/DMG term, 2H Primary): Primary correctly reads "Profile scores no weapon term", Secondary still reads "Not in catalog".

3. `offhand-unpriceable` names a worn item that IS in the catalogue. Case F (worn 2H Primary, unresolved Secondary) produces a Primary card `Primary · [Audit] Abandoned Orc Shovel · Not in catalog` — the Shovel is in the seeded catalogue. The finding lists this reason but not that its `wornName` is normally resolvable, which is what makes the mark a false claim rather than merely a vague one.

4. `worn-unresolved`, the third fall-through, is CORRECT (Case C). So it is 2 of 5 reasons wrong, exactly as the finding says — that half is right.

HOW OFTEN A PLAYER LANDS IN THE TRIGGERING STATE (measured, not asserted): of 844 PRIMARY-slot rows / 526 distinct PRIMARY items in the shipped shard, 124 rows / 123 distinct are two-handed (14.7% of rows, 23.4% of distinct). Per-class share of primary-usable rows that are two-handed: WAR 63/442, SHD 60/398, PAL 54/396, RNG 42/386, NEC 24/274, MAG 24/262, ROG 22/387, BRD 22/406, ENC 21/268, WIZ 20/260, BER 18/147, CLR 17/260, SHM 17/297, DRU 15/280, MNK 9/221.

More decisive: the app's own Primary ranking puts a two-hander on top in 17 of 30 trio x preset cells (`rankSlotItems` on the real PRIMARY shard, +0, no filters, 6 trios x the 5 `PRESET_PROFILES`), and the first two-hander is within the top 5 in all 30. Examples: WAR/BRD/BER melee-dps -> "Monsoon, Sword of the Swiftwind" (2H); PAL/RNG/ROG balanced -> "Fiery Avenger" (2H); CLR/DRU/ENC -> "Baton of the Sky" (2H) under all five presets. So the tool routinely recommends its way into the state that produces the wrong mark. Caveat: that is the picker/slot ranking, which is what a player actually clicks; the Upgrades screen's own list nets the offhand cost afterward, so this measures how a player arrives at a 2H Primary, not the Upgrades row order.

WHAT DOES NOT WIDEN: exactly one withheld card per affected position, the correct `WITHHELD_TEXT` paragraph sits directly beneath, and no ranking, EP or gain number is affected. The finding is right about that.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced and then some.

Read first: the ternary at web/src/screens/Upgrades.tsx:1809-1813 tests exactly two of the five `WithheldReason` members by name and falls through to the literal 'Not in catalog' for `worn-unresolved`, `offhand-occupied` and `offhand-unpriceable`. `WITHHELD_TEXT[entry.reason]` on line 1815 is a full `Record<WithheldReason, string>` (line 1398) and is correct for all five. The push at line 618 admits `offhand-occupied` unconditionally because it is a member of `WITHHELD_WITHOUT_WORN` (line 153), and `wornName: entry.wornName ?? null` renders through `{entry.wornName ?? 'nothing equipped'}` at line 1806.

Then ran it, with a different instrument than the quoted one. The original lens mounted the real shipped shards; I mounted the App against the FIXTURE catalog with a seeded two-hander (`[Audit] Abandoned Orc Shovel`, wp.skill '2H Blunt'), read the card fields out of the DOM by class rather than through a report object:

  cd web && npx vitest run src/screens/__audit_heldmark.test.tsx --reporter=verbose
  (probe file: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-17/web/src/screens/__audit_heldmark.test.tsx)

  CASE A  2H Primary, empty Secondary
          slot "Secondary" worn "nothing equipped" mark "Not in catalog"
          body "The weapon in your Primary takes both hands, so there is no offhand to fill..."
  CASE B  2H Primary, Secondary holds a resolvable shield
          slot "Secondary" worn "[Fixture] Buckler of Practice" mark "Not in catalog"
  CASE C  worn item genuinely absent -> mark "Not in catalog", body "not in the catalog this build shipped" (CORRECT)
  CASE D  weapon-blind profile, 1H Primary -> mark "Profile scores no weapon term" (CORRECT, both hands)
  CASE F  worn 2H Primary + unresolved Secondary
          slot "Primary" worn "[Audit] Abandoned Orc Shovel" mark "Not in catalog", body = the offhand-unpriceable text
  CASE G  2H Primary under weapon-blind weights
          Primary "Profile scores no weapon term" / Secondary "Not in catalog"

Case A is the reported finding, verbatim, from a different fixture set. So: CONFIRMED.

INSTRUMENT CHECK (house rule 4). My first run of Case B surprised me — it produced an `offhand-unpriceable` card on Primary that I had not asked for. The cause was mine, not the app's: `fixture()` in src/data/fixture.ts:24 prefixes every fixture name with `[Fixture] `, so equipping 'Buckler of Practice' left the Secondary unresolved. I corrected the names and re-ran; Case B then gave the resolvable-shield result above, and I kept the accidental configuration deliberately as Case F. Reporting both, and reporting that the first Case B number was my error.

SEVERITY — reported "minor"; I read it as one notch TOO LOW.

Three things push it up, none of which is "the paragraph below is right", which remains true.

(a) 'Not in catalog' is not a loose phrase in this app — it is the established mark for exactly one condition. `SlotCard.tsx:167` renders it as `{unresolved ? <span className="slot-stats bad">Not in catalog</span> : null}` and `SetCompare.tsx:75` as `{side.unresolved ? <span className="tag">Not in catalog</span> : null}`. Both gate strictly on `unresolved`. In Case B the same set therefore contradicts itself across screens: the Set screen shows the Buckler as a normal resolved item, and Upgrades marks it "Not in catalog". A reader who has learned the phrase from the other two screens will read it as a data defect, because everywhere else in the app it is one.

(b) A mark is a provenance claim, and this one is false about a named item that is present. That is the class of defect this repository's constitution is built around — a claim printed rather than computed. Case F is the cleanest example: the card names the Abandoned Orc Shovel, which is in the catalogue, and marks it absent.

(c) The triggering state is common and the tool steers into it: 17 of 30 trio x preset cells top-rank a two-hander from the shipped PRIMARY shard (measurement in corrected_scope).

What keeps it from being major: one line of text, the correct explanation is immediately adjacent, and no EP, gain, ordering or recommendation is wrong. I would put it at moderate — a false provenance label on a real item, bounded to one line and self-correcting to anyone who reads the next sentence.

FILE SET for the zero-results claim. `grep -rn "Not in catalog\|upg-heldmark"` over web/src (all .ts/.tsx/.css) returns 7 lines and no test anywhere asserts the mark for a withheld card: screens.test.tsx:102 asserts the string on a different screen. So the wrong label is not pinned by the suite — fixing it breaks nothing.

Not verified: what a real player's set actually holds. Nothing here can measure that; the 17/30 figure is the app's own recommendation, which is the nearest measurable proxy and is labelled as such.

### 11. The screen ranks as soon as the index loads, so every row claims "nobody has measured it dropping" until the shards land

`web/src/screens/Upgrades.tsx:1461` — severity claimed **minor**, scope claimed **Every cold load of the Upgrades screen crosses this state; the ranking is not gated on shard arrival by construction. The window's wall-clock duration is NOT measured — per CLAUDE.md §5 no headless browser here reaches a host, so I could not time the real fetches. What is measurable is that the two loads race: items-index.json is 693,096 bytes in one request against 1,605,260 bytes across 19 shard requests (du -b), so the index normally resolves first. The state self-corrects when `commitShards` bumps `revision` and the effect re-runs.**

**Mechanism.** `const ready = catalog.status === 'ready'` is the only load gate. `useCatalog.load()` sets `status: 'ready'` on the strength of `items-index.json` alone (catalog.ts:355), and `items-index.json` carries no `src` and no `ms` fields at all. `catalog.shards` — the per-shard status map that would say whether the acquisition data has arrived — is never read by Upgrades.tsx (grep for `shards` in that file returns only a comment at :1439 and a string at :1660). So the ranking effect fires, paints 23 rows, and each one renders `SourceBlock`'s absence branch while `ensureAll()`'s 19 shard fetches are still in flight.

**Evidence the author ran.** Index field census (node -e over web/public/data/items-index.json): 3663 rows; keys present are id,n,ic,cl,ra,wt,fl,era,av,sd,sl,an,st,ex,wp,sv,... — no `src`, no `ms`.

Seeded the catalog store with index-only normalized items and mounted the screen:
  cd web && npx vitest run src/screens/__probe5.test.tsx --silent=false --reporter=verbose
  rows: 23
  "No acquisition data" blocks: 23
  first such: No acquisition data is recorded for this item, and nobody has measured it dropping. That is a gap in our data, not a statement that it cannot be obtained.
  measured KPI: Measured dropping in game 0/23 — Nothing on this list has been watched dropping yet. That is a gap in the logs, not a statement about the items.

Same set, same weights, catalog seeded from the shards instead:
  cd web && npx vitest run src/screens/__probe4.test.ts --silent=false --reporter=verbose
  INDEX-ONLY:  rows=23 rows-with-NO-acquisition-lines=23 rows-with-no-measured-drops=23
  WITH-SHARDS: rows=23 rows-with-NO-acquisition-lines=2  rows-with-no-measured-drops=14
So 21 of 23 rows and the 9/23 measured KPI are wrong during the window, and correct after it.

**Player impact.** For the length of the window the page makes a positive Tier-M claim about absence — "nobody has measured it dropping", "Nothing on this list has been watched dropping yet" — for 21 items that have measured sightings in the payload it is about to load. The KPI the tool is built around reads 0/23 instead of 9/23.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 12. Primary row shows the first two-hander that clears the 0.05 EP floor, not the biggest net gain — a one-hander further down the same list can be worth more

`web/src/screens/Upgrades.tsx:572` — severity claimed **serious**, scope claimed **Measured by web/src/screens/probe-order7.test.ts (`vitest run src/screens/probe-order7.test.ts --testTimeout=600000`), which enumerates all 16 classes x the 2 presets that score weapons (melee-dps, balanced — the other 3 withhold hand slots per `scoresWeapons`, ep.ts:398) x all 383 statted SECONDARY items as the worn offhand: `combos 12256 rows with a 2H recommendation beaten by a listed 1H: 1444 mean shortfall 6.25 max 28.88`. That is 11.8% of scanned loadouts. Preconditions: a weapon-scoring weight profile, something worn in Secondary, and a two-hander topping the Primary ranking. Avenrae's shipped fixture does not hit it (empty Secondary, so `twoHandedCost` returns null).**

**Mechanism.** `take()` (Upgrades.tsx:563-574) walks `entry.ranked` in RAW EP order and returns the FIRST candidate whose `accept` callback passes. `accept` (line 604-615) computes `netGain = candidate.ep - wornEp - offhandEp` and returns true at `netGain >= MIN_GAIN` (0.05). Because the offhand cost is subtracted only from two-handed candidates, net gain is NOT monotonic in the raw-EP order the list is sorted by: a two-hander at index i is accepted and returned even when a one-handed candidate at index j>i has a strictly larger net gain. The walk stops at the first acceptance; nothing compares net gains across candidates.

**Evidence the author ran.** Ranking sorted by raw score only — web/src/selectors/gear.ts:389 `scored.sort((a, b) => b.score - a.score || a.item.n.localeCompare(b.item.n));`

Single reproduction against the shipped 3,663-item payload (web/src/screens/probe-order6.test.ts, run: `cd web && ./node_modules/.bin/vitest run src/screens/probe-order6.test.ts --silent=false --reporter=verbose`). BER, level 50, melee-dps preset, Nautilus Shield worn in Secondary, Primary empty:

  PRIMARY row: Cudgel of the Fool gain 16.615 2h note: Nautilus Shield -18.00 via 2H Blunt
  offhand EP 18.000
    0 Cudgel of the Fool   skill=2H Blunt   raw 34.615  net 16.615
    1 TornEar Thumper      skill=2H Blunt   raw 29.933  net 11.933
    2 Earthshaker          skill=2H Slashing raw 26.743 net  8.743
    3 Enchanted Fine Steel Bastard Sword     raw 26.048 net  8.048
    4 Blued Two-Handed Hammer                raw 23.291 net  5.291
    5 Serpent's Tooth      skill=Piercing   raw 22.259  net 22.259
    6 Fanged Skull Stiletto skill=Piercing  raw 21.818  net 21.818

Serpent's Tooth is one-handed, in the same ranked list, eligible, not worn, and nets +22.259 — 5.64 EP more than the row the engine emitted. Row order printed by the same run places PRIMARY 8th of 23 at 16.62; at 22.26 it would sit 5th.

Not an empty-slot artifact — web/src/screens/probe-order8.test.ts, PAL/melee-dps, worn Rusty Long Sword (5.71 EP) + worn Dagas offhand (-40.95):
  row: Mithril Two-Handed Sword +36.33 at list position 6/22
  available: Aldryn, Blade of the Ocean +41.05

**Player impact.** The Primary row names the wrong item to farm, prints a gain understated by a mean of 6.25 EP (max 28.88 measured), and sits too low in a list the screen orders 'biggest gain first'. It also tells the player to give up their offhand for a swap that is worse than a one-hander that costs them nothing — the exact failure the surrounding comment at Upgrades.tsx:551-558 says the walk was introduced to fix ('a one-hander one place down the list was a real gain nobody looked at'). The walk was added; the comparison was not.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **NARROWER**.

*Corrected scope.* Their headline number reproduces almost exactly, but its denominator includes loadouts a character cannot actually have.

REPRODUCED (their grid, my instrument): 16 classes x 2 weapon-scoring presets (melee-dps, balanced, per `scoresWeapons`) x 383 statted SECONDARY items as the worn offhand, empty Primary = 12,256 combos. My run: 12,256 combos, 12,256 with a PRIMARY row, 7,165 of them recommending a two-hander, 1,443 of those beaten by the engine's own best one-hander; mean shortfall 6.259 EP, max 28.885 EP; 11.77% of all combos. Their figures were 1,444 / 6.25 / 28.88 / 11.8% — agreement to within one combo (a tie/tie-break edge), so their arithmetic is sound.

CORRECTION — the denominator is too wide. That grid pairs every class with every offhand regardless of whether the class can equip it (`slotViews` resolves a worn item by name and never applies `canUse`). Filtering the offhand through `canUse({classes: off.cl, races: off.ra, rl: off.rl}, ctx)` — the same predicate `rankSlotItems` applies to candidates — leaves 5,988 reachable combos: 3,244 with a 2H recommendation, 362 beaten. That is 6.05% of reachable loadouts, not 11.8%; mean shortfall 5.129 EP, max 22.861 EP. Their 28.88 max came from PAL/balanced with "Aegis of the Wind" in the offhand, which a Paladin cannot equip.

The conditional rate is the more useful one and is close to their number: given the finding's own preconditions actually met (weapon-scoring profile, occupied Secondary, a two-hander topping the raw Primary ranking), 362/3,244 = 11.16% of those rows are wrong.

Concentration, which the finding does not report and which matters more than the average: it is not spread evenly. Per class, share of that class's reachable combos that get a beaten 2H row — MNK 116/256 = 45.3%, SHM 108/360 = 30.0%, DRU 8.1%, BER 8.6%, ENC 8.0%, NEC 6.2%, WIZ/MAG 5.3%, PAL 3.9%, SHD 1.5%, and exactly 0 for WAR, CLR, RNG, BRD, ROG, BST (RNG/BRD/ROG/BST never get a 2H Primary row at all in this grid). So it is much WIDER than 6% for a monk and zero for six of sixteen classes.

Magnitude of each miss (362 misses, equippable grid): min 0.05, p25 1.75, median 4.38, p75 6.64, p90 11.27, max 22.86 EP. In 31 of 362 (8.6%) the best one-hander is at least twice the printed gain. Worst measured: MNK/melee-dps with Wu's Fist of Mastery in the offhand — printed "TornEar Thumper +0.84", actual best "Wu's Tranquil Fist +23.70". Only 14 distinct (class, preset, wrongly-recommended item) triples produce all 362 misses, so a fix touches a small set of named items.

One small factual correction to the write-up: in the BER / Nautilus Shield case they say the correct row "would sit 5th"; my run places Serpent's Tooth 6th of 23 (the emitted row sits 8th). Direction confirmed, position off by one.

Avenrae check confirms their caveat: `research/validation/tier0-inventory-Avenrae.txt` line 81 is `Secondary	Empty`, so the shipped fixture cannot hit this path.

*Refuter reasoning.* MECHANISM — confirmed, by code read and by an instrument that never computes a net gain itself.

Code (web/src/screens/Upgrades.tsx): `take()` at 563-574 walks `entry.ranked` and `return candidate` at 572 on the FIRST candidate whose `accept` passes. `accept` at 604-615 calls `twoHandedCost` (361-406), which returns a non-null offhand cost only when `position.id === 'PRIMARY'` and `isTwoHanded(best.item)`, then tests `netGain = candidate.ep - entry.wornEp - (netting?.offhandEp ?? 0)` against `MIN_GAIN = 0.05` (line 217). `entry.ranked` is ordered by RAW score — web/src/selectors/gear.ts:389 `scored.sort((a, b) => b.score - a.score || a.item.n.localeCompare(b.item.n))` — and the offhand cost is subtracted from only some members of that list, so net gain is not monotone in it. Nothing anywhere compares net gains across candidates. The claim is exactly right.

Reproduction with a DIFFERENT instrument (web/src/screens/verify2h-counterfactual.test.ts). I never compute a net gain. I ask the shipped `computeUpgrades` what it recommends for Primary, delete that item from the catalog, and ask again — if deleting an option makes the engine's OWN reported gain rise, the engine was not returning the best option. BER / melee-dps / Nautilus Shield in Secondary, empty Primary:
  0: Cudgel of the Fool [2H Blunt] gain 16.615 row 8/23 (gives up Nautilus Shield -18.00)
  1: TornEar Thumper 11.933  2: Earthshaker 8.743  3: Enchanted Fine Steel Bastard Sword 8.048  4: Blued Two-Handed Hammer 5.291
  5: Serpent's Tooth [Piercing] gain 22.259 row 6/23
first 16.615, best-after-deletions 22.259, shortfall 5.644. PAL / melee-dps / Rusty Long Sword + Dagas: Mithril Two-Handed Sword 36.333 row 6/22 -> ... -> Aldryn, Blade of the Ocean 41.055 row 6/22, shortfall 4.722. Both match the prior lens's numbers to three decimals without running their code.

Instrument check before trusting it (web/src/screens/verify2h-sanity.test.ts): restricting `views` to PRIMARY+SECONDARY (which I do for grid speed) returns the identical Primary row and gain as full 23-slot views — Cudgel of the Fool 16.615 both ways. My scope grids replace "the best one-hander" with a second `computeUpgrades` run over a catalog with every `isTwoHanded` item deleted, so eligibility, Lore claiming, filters and the 0.05 floor are all applied by the shipped engine, not by me. That is sound because among one-handers there is no offhand cost, so first-accepted is highest-net by construction.

SEVERITY — "serious" is right, at the lower end of it. In favour: this is the flagship player-facing surface, and its lede at Upgrades.tsx:1585 promises "The best item this loadout can wear in every position, ranked by what it adds to this set." The screen renders one candidate per position and no alternatives list, so the wrong item is the only thing the player sees for that slot. `rows.sort((a,b) => b.gain - a.gain || ...)` at Upgrades.tsx:717 orders the list by gain, so an understated gain also misplaces the row (BER case: 8th when it should be 6th), and `totalGain` at line 736 sums the understated figure into a headline KPI. And it defeats the stated purpose of the very code it lives in — the comment at 551-558 says the walk exists because "a one-hander one place down the list was a real gain nobody looked at"; the walk was added, the comparison was not. Against a higher rating: the emitted advice is always still a real gain (netGain >= 0.05), never a loss, so it wastes a farm target rather than causing harm; median miss is 4.38 EP; six of sixteen classes never hit it; and it is one slot of 23. Not critical, clearly above minor.

SCOPE — see corrected_scope. Their arithmetic reproduces (1,443 vs 1,444), but the denominator counts class/offhand pairs the character cannot equip; the reachable rate is 6.05%, and the rate given the finding's own preconditions is 11.16%.

### 13. The Lore hand-out is ordered by a key computed from an item the position can never be offered, and the row then prints 'offered in the single position where it gains the most' — false on the repo's own Avenrae fixture

`web/src/screens/Upgrades.tsx:536` — severity claimed **serious**, scope claimed **Provisional inflation: 4 of 23 positions in the Avenrae fixture. Lore mis-award under the strict test: 1 of 301 sets — 0 of 300 seeded random sets, 1 of 1 real imported inventories (the repo's own `research/validation/tier0-inventory-Avenrae.txt`, its strongest fixture). Total listed gain is NOT worse: reordering the queue by true-best-available gives 292.510 vs the shipped 293.010 (probe-order3.test.ts), so this is a wrong-slot/false-claim defect, not a lost-EP one — greedy is not optimal under either key.**

**Mechanism.** `provisional: (ranked[0]?.score ?? 0) - wornEp` (line 536) is the sort key for the Lore hand-out queue (lines 582-585). It reads `ranked[0]` — the top of the raw ranking — before any of the filters `take()` later applies: items worn at another position (line 567), items already Lore-claimed (568), MIN_GAIN, and offhand netting. So a position whose top-ranked item is worn elsewhere carries a provisional it can never realise, is served earlier than its true best warrants, and claims the single Lore copy ahead of a position that gains more from it. Separately, the row's SourceBlock renders the unconditional sentence 'One only, so it is offered in the single position where it gains the most.' (line 1146), which the greedy pass does not guarantee.

**Evidence the author ran.** web/src/screens/probe-order3.test.ts (`vitest run src/screens/probe-order3.test.ts --silent=false --reporter=verbose`), Avenrae's `/outputfile inventory` fixture + Balanced preset + shipped catalog:

  INFLATED ANY_1  prov 43.500 via Indicolite Breastplate (worn at CHEST) true best 31.500 via Cloak of Scales
  INFLATED ANY_2  prov 24.000 via Indicolite Breastplate (worn at CHEST) true best 12.000 via Cloak of Scales
  INFLATED WRIST_2 prov 7.400 via Hotof's Bracer (worn at WRIST_1) true best 1.400
  INFLATED EAR_1   prov 0.000 via Black Sapphire Electrum Earring (worn at EAR_2) true best -0.800
  inflated positions: 4 of 23

Queue order (probe-order2.test.ts): ANY_1 43.500 -> BACK 34.500. Consequence, from probe-order.test.ts:

  LORE Cloak of Scales -> awarded ANY_1 +31.500 | also wanted by: BACK: +34.500 (rank 0); ANY_2: +12.000 (rank 1)
  ANY_1 row: 31.5000 LORE Cloak of Scales; BACK row: 26.0000 LORE Brewer's Mesh Cloak

BACK's own #0 candidate is Cloak of Scales at +34.50 and it loses it to a slot that gains +31.50, because ANY_1 was queued on 43.50 EP of Indicolite Breastplate — which sits in CHEST and is skipped by `take()` at line 567. The item detail for the ANY_1 row renders SourceBlock (line 1392) and therefore prints 'offered in the single position where it gains the most', which is false for this row by 3.00 EP.

Instrument checked: probe-order9.test.ts applies the strict test (rival must value the Lore item above what it actually got AND above what the awarded row got) across the Avenrae fixture plus 300 seeded generated sets — `sets 301 loreRows 3240 misawarded 1 setsAffected 1 maxGap 3.00 / set -1: Cloak of Scales -> ANY_1 +31.50, but BACK would gain +34.50`. The one hit is the real fixture, confirming the detector fires and is not firing spuriously.

**Player impact.** A player following the shipped Avenrae plan is told to farm Cloak of Scales for Any Slot 1 (+31.5) and Brewer's Mesh Cloak for Back (+26.0), while the same page's own numbers say Cloak of Scales is worth +34.5 in Back. Under the recommendation the app prints a sentence asserting the opposite of what it did. The 13-test shipped suite `web/src/screens/upgrades-avenrae.test.ts` passes on this set: 'never asks for two of a Lore item' checks uniqueness, and 'ranks by gain, biggest first' checks the row sort — neither checks that the single copy went to the position that gains most, which is the claim on screen.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* Three separate scopes; the finding gets two right and understates the third.

(1) PROVISIONAL INFLATION — finding says "4 of 23 positions in the Avenrae fixture". CONFIRMED EXACTLY, and it is not confined to Balanced. Avenrae's real `/outputfile inventory` import, basis `worn`, default filters, per preset (inflated / rankable positions; 23 positions total, the rest withheld):
  balanced 4/21  (EAR_1 0.000 vs -0.800; WRIST_2 7.400 vs 1.400; ANY_1 43.500 vs 31.500; ANY_2 24.000 vs 12.000)
  tank 2/20, melee-dps 2/21, caster 0/20, healer 3/20  — 11 inflated positions across the 5 shipped presets on one real set.

(2) STRICT MIS-AWARD (a Lore item awarded to P while rival Q values it above both P's realised gain and above what Q actually got) — finding says 1 of 301 sets. My independent sweep: 1 of 401 sets. 0 of 400 generated sets (xorshift seed 20260901; 8 class trios x 6 races x 5 presets x random +0..+5 tiers x 50-100% fill), 1 of 1 real imported inventory — the Avenrae fixture on Balanced, the app's default preset, `Cloak of Scales -> ANY_1 +31.50 while BACK would gain +34.50 (BACK got +26.00)`, gap 3.00 EP. Across the 5 presets on that fixture it is 1 of 30 Lore rows. So the finding's rarity claim is right, and my different generator corroborates its 0/300.

(3) THE PRINTED SENTENCE — the finding scopes the false "offered in the single position where it gains the most" to this one mis-awarded row. MEASURED MUCH WIDER. On the Avenrae fixture across the 5 presets, some rankable position values the awarded Lore item above the gain the row prints on 10 of 30 Lore rows (balanced 2/8, tank 1/5, melee-dps 2/11, caster 3/3, healer 2/3). Nine of those ten SURVIVE the queue-key fix — re-running with the sort key changed to best-available-net-of-worn leaves 9/30 — because they are a property of greedy allocation, not of the inflated provisional. Across the 401-set sweep the same condition holds on 1331 of 4578 Lore rows (29.1%; 2589 row/rival pairs). So the sentence is false roughly a third of the time, and fixing the sort key removes about one case in ten of that. The finding's mechanism half is right; its attribution of the false sentence to the sort key is too narrow.

Two scope facts the finding did not state that a reader needs: the sentence is not behind a click — `.upg-detail` has no `display:none` in `web/src/screens/Upgrades.css` (rules at :315 and :786 set flex/gap only), so SourceBlock's Lore line renders on every listed row; and Balanced is the app's default (`web/src/state/store.ts:38 DEFAULT_WEIGHTS = profileById('balanced')`), so the one strict mis-award sits on the default preset.

Total-gain claim CONFIRMED: shipped key 293.010 vs true-best key 292.510 on Avenrae/Balanced — the shipped order is 0.500 EP *higher*, so this is a wrong-slot/false-claim defect, not a lost-EP one.

*Refuter reasoning.* MECHANISM — CONFIRMED, with a different instrument. I did not run the previous lens's probe files (they are not in this worktree; `ls web/src/screens/probe*` → no such file). I wrote my own pass-one recomputation from the same engine primitives the screen calls (`rankSlotItems` + `totalsFor`/`scoreContextFrom` + `scoreItem` with `weaponCountsAt`), and gated it behind an instrument check that asserts my recomputed `wornEp` and my recomputed score for each awarded item equal the shipped report's `row.wornEp` and `row.candidate.ep` to 9 decimals, for every row under all 5 presets — that test passes, so my numbers are the app's numbers.

Reading `web/src/screens/Upgrades.tsx`: line 536 sets `provisional: (ranked[0]?.score ?? 0) - wornEp` inside pass one; the queue at 583-586 sorts on `provisional`; `take()` at 563-577 is where the worn-elsewhere skip (`wornAt` lookup, 566-567), the Lore-claim skip (568), and via `accept()` the MIN_GAIN and offhand-netting rejections (604-615) actually happen. So the sort key is computed from a candidate the position may never be offered. Measured consequence: ANY_1 is queued on 43.500 EP of Indicolite Breastplate, which `wornAt` maps to CHEST; the best ANY_1 can actually be offered is 31.500.

The decisive check was a counterfactual on the real code rather than a reimplementation of pass two: I patched line 536 in this worktree behind `process.env.AUDIT_TRUEBEST` to walk `ranked` past items worn at another position, and ran the same `computeUpgrades` both ways. Shipped: `ANY_1 +31.500 LORE Cloak of Scales / BACK +26.000 LORE Brewer's Mesh Cloak`, totalGain 293.010. Fixed key: `BACK +34.500 LORE Cloak of Scales / ANY_1 +28.500 LORE Lustrous Russet Breastplate`, totalGain 292.510. The award moves, and the numbers match the finding's to the digit. I reverted the patch (`git checkout web/src/screens/Upgrades.tsx`); the repo is unmodified apart from my five added audit files.

The second half of the mechanism is a read, not a computation: `Upgrades.tsx:1141-1148` renders "One only, so it is offered in the single position where it gains the most." under `{lore ? ... : null}` with no reference to the allocation, and `SourceBlock` is called unconditionally at :1392 inside `.upg-detail`, which carries no `display:none`. So the sentence is on screen for every Lore row.

SEVERITY — I agree with "serious", but for a different reason than the finding gives, and the two halves deserve different labels. The allocation half alone is minor-to-moderate: one mis-award in 401 sets, 3.00 EP on one row, and the player loses no total EP (the shipped order totals 0.500 EP more). What carries "serious" is the printed sentence, and that is worse than the finding says — it is false on 10 of 30 Lore rows on the repo's own strongest fixture and on 29% of Lore rows across my sweep. For a tool whose stated constitution is "compute it, check it, or don't print it", an unconditional sentence asserting a property the greedy pass does not enforce is the repository's own named failure mode. I would not have marked the finding "serious" on the sort key alone.

SCOPE — WIDER, specifically because the finding treats the false sentence as a consequence of the sort key and therefore scopes it to one row. It is not: 9 of the 10 false-sentence rows on the fixture persist after the sort key is fixed. Everything else the finding measured, I reproduce.

Instrument caveats I owe you: (a) my rival-gain figure is `score - wornEp` and does not apply MIN_GAIN or two-handed offhand netting, so for PRIMARY/SECONDARY rivals it can overstate slightly — the Avenrae per-row table above is armour and jewellery, where no netting applies; (b) my sweep's detector is proven to fire, not merely to return zero: I ran the Avenrae fixture through the identical detector code path as set -1 in the same sweep and it produced the one known hit, so the 0/400 on generated sets is a measured zero rather than a silent one; (c) file set searched for the sentence: `grep -rn "single position where it gains" --include=*.ts --include=*.tsx --include=*.md .` excluding node_modules — one occurrence in source (Upgrades.tsx:1146), one in a critique doc, none in any test, so no shipped test asserts it. The shipped Avenrae suite is 13 tests, all passing on this set; its only Lore assertion (`upgrades-avenrae.test.ts:220-228`) checks uniqueness of the awarded names, which the finding states correctly.

### 14. Landing page says the client "corrected" the SV Void rule; the cited record and the same page say it predicted it exactly

`web/src/screens/Landing.tsx:256` — severity claimed **serious**, scope claimed **One sentence, always rendered (the feature card is unconditional) on the app's front page, in the card whose job is to establish that the upgrade math is trustworthy. Measured by rendering Landing with no character state: both sentences appear in container.textContent.**

**Mechanism.** The "+0 to +10, everywhere" feature card renders: "The scaling rules were re-derived from the wiki's own item-level slider and then checked against live client windows, which corrected two of them — including the synthetic SV Void an upgraded item grants." The synthetic SV Void rule was never corrected by a client window: research/validation/TIER0-VALIDATION.md §1 lists it as a prediction that MATCHED ("| SV Void (synthetic, `= full`, ≥2 attrs) | 10 | 10 | MATCH |", "appears exactly as predicted"), and research/validation/UI-REFERENCE.md:78 says the client is "confirming the synthetic SV Void: +N". The two rules the record says the client actually overturned are the weight rounding (web/src/engine/upgrade.ts:91-102) and the percentage branch, which truncates rather than rounding half-away-from-zero (upgrade.ts:112-119, TIER0-VALIDATION.md §5: "This is the second arithmetic error inherited from the same third-party model (the first being weight...)"). The same Landing page contradicts itself: 65 characters of rendered text earlier it lists SV Void among the exact predictions — "nine of nine predictions exact — 74 damage, delay unchanged at 70, ratio 1.057, Strength and Stamina 16, and the synthetic SV Void at 10" (Landing.tsx:189-193).

**Evidence the author ran.** Rendered both sentences by mounting <Landing/> with react-dom/client under vitest (probe file, since deleted; harness copied from web/src/screens/sources.test.tsx):
  cd web && npx vitest run src/screens/zz-probe2.test.tsx --silent=false --reporter=verbose
  >>> "corrected two of them" @1898
  ...from the wiki's own item-level slider and then checked against live client windows, which corrected two of them — including the synthetic SV Void an upgraded item grants.Cap-aware scoring...
  >>> "nine of nine predictions exact" @1248
  ...This exact window was read off a live client and the planner reproduces it: nine of nine predictions exact — 74 damage, delay unchanged at 70, ratio 1.057, Strength and Stamina 16, and the synthetic SV Void at 10...
Source of the contradiction:
  sed -n 15,45p research/validation/TIER0-VALIDATION.md   -> Earthshaker table, SV Void row "10 | 10 | MATCH"
  grep -rn -i "sv void" research/  -> UI-REFERENCE.md:78 "confirming the synthetic SV Void: +N granted"
  sed -n 85,135p web/src/engine/upgrade.ts  -> the two corrections named in code: ceilToOneDecimal (weight) and the truncating percentage branch

**Player impact.** A reader is told the live-client checks overturned the SV Void rule, when the record says the client confirmed it. The planner's arithmetic is unaffected — no printed number changes — but the front page's own trust argument is self-contradicting on one screen, in a project whose stated rule is "compute it, check it, or don't print it".

**Verdict** — mechanism **CONFIRMED**, severity **TOO-HIGH**, scope **AGREE**.

*Corrected scope.* Scope stands as stated, with one number corrected and one addition.

CONFIRMED AS STATED:
- The feature card is unconditional. `Landing.tsx:241-288` is a bare `<section className="landing-section">` with no guard; the only gated block on the page is the character list at 200-238 (`{characters.length ? (`). Verified by `grep -n "return\|<section\|{characters\|? (\|&& (\|</section>" src/screens/Landing.tsx`.
- Landing is the default route: `web/src/router.ts:63` `if (!head) return { name: 'landing' };`, rendered at `App.tsx:143`. So this is the first screen a visitor with no URL fragment sees.
- Rendered with empty state (`useApp.setState({...emptyState(), hydrated: true})`), both sentences appear exactly once each in 2,558 chars of `container.textContent`. "corrected two of them" count=1, "nine of nine predictions exact" count=1.

CORRECTED — the "65 characters" figure is wrong by 10x:
The lens's prose says the exact-predictions sentence sits "65 characters of rendered text earlier", but its own quoted evidence gives offsets @1248 and @1898. I reproduced those exact offsets and measured the gap:
  OFFSET nine-of-nine = 1248 / OFFSET corrected-two = 1898 / DISTANCE = 650 / TOTAL TEXT = 2558
  BLOCK INDEX nine-of-nine = 5, corrected-two = 10, of 16 -> BLOCKS BETWEEN = 4
The true distance is 650 characters and four block elements (two `<p>`, an `<h2>` section label, an `<h3>`), not 65. They are in different sections of the page, not adjacent sentences. This weakens "on one screen" — a reader may well not have both in view at once — but not "on one page".

NOT WIDER THAN CLAIMED (a candidate third statement does not render):
`Landing.tsx:81-83` holds an `sdc` field reading "...Ratio 1.057, Strength 16, Stamina 16, SV Void 10. Nine of nine predictions exact." I traced it: `normalize.ts:332` -> `itemStyle.ts:187` (`mark.citation`) -> `ItemWindow.tsx:244`, which renders it only when `wide`. Measured in the default Landing render: "SV Void 10" count=0 in textContent AND count=0 in innerHTML; "Nine of nine predictions exact" count=0. So it is hover/wide-gated and does not add a third visible contradiction to the default view. Scope is two statements, not three.

UNDERLYING RULE'S PAYLOAD SCOPE (context, not defect count):
Against the shipped payload, the rule the sentence misdescribes governs 731 of 3,663 unique items (20.0%) — those carrying >=2 fields from the trigger set in `upgrade.ts` (STR STA INT AGI DEX CHA WIS, SV_FIRE/COLD/POISON/MAGIC/DISEASE), which gain synthetic SV Void when upgraded. My dedupe returned exactly 3,663 unique items, matching `meta.json` `items: 3663`, which is the check that my slot-file walk was not double-counting (the raw walk over all 19 slot files gives 4,004 rows because items appear in several slots). None of those 731 items print a wrong number — see severity.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with two instruments, neither the lens's.

Instrument 1, production bundle grep (the lens used a vitest react-dom probe; I built and grepped the shipped JS). `npm run build` produced `dist/assets/index-NDT84SVL.js`, 509.62 kB. Both strings ship, once each:
  >>> "corrected two of them" @344210 — "...The scaling rules were re-derived from the wiki's own item-level slider and then checked against live client windows, which corrected two of them — including the synthetic SV Void an upgraded item grants."
  >>> "nine of nine predictions exact" @342131 — "...nine of nine predictions exact — 74 damage, delay unchanged at 70, ratio 1.057, Strength and Stamina 16, and the synthetic SV Void at 10..."

Instrument 2, an independent render of `<Landing/>` (my own probe, harness pattern from sources.test.tsx) confirming both reach `container.textContent`.

The record says the client CONFIRMED the SV Void rule, in four places, one of which is the engine's own code:
- `research/validation/TIER0-VALIDATION.md:30` — "| SV Void (synthetic, `= full`, >=2 attrs) | 10 | 10 | MATCH |"
- `TIER0-VALIDATION.md:32` — "appears exactly as predicted. That is strong evidence the whole model is correct"
- `TIER0-VALIDATION.md:137` — a second client window, Cloak of Flames at +7: "| SV Void | — | 7 | 7 | 7 |", i.e. MATCH again
- `web/src/engine/upgrade.ts:184` — the `voidBonus` doc comment: "Confirmed in-client: Earthshaker +10 (Strength and Stamina) shows SV Void 10."
- `research/validation/UI-REFERENCE.md:78` — "confirming the synthetic `SV Void: +N` granted by item upgrades feeds a genuine resist line"

And the two rules the client actually overturned are named in the record and in code, and neither is SV Void:
- `TIER0-VALIDATION.md:112` — "## 5. The percentage branch TRUNCATES — a correction"
- `TIER0-VALIDATION.md:126` — "This is the **second** arithmetic error inherited from the same third-party model (the first being weight, which ceilinged floating-point residue up a step)."
- Both live in `upgrade.ts`: `ceilToOneDecimal` (weight, lines 91-102) and the truncating percentage branch of `scalePrimary` (lines 112-119, whose comment names the discriminating datum: Cloak of Flames SV Fire 15 at +7, "Half-away-from-zero predicts 26; the client prints **25**").

So the count "two" is right and the identification is wrong. The mechanism holds.

One caveat I owe, which the lens did not raise: the sentence is grammatically ambiguous. "checked against live client windows, which corrected two of them — including the synthetic SV Void an upgraded item grants." The em-dash "including" could in principle attach to the rules that were *checked* rather than the two that were *corrected*. But "two of them" is the nearest antecedent, so the natural reading is the false one. This is partial cover, not a defence; it does not refute the mechanism, and it does feed severity.

SEVERITY — TOO-HIGH. "serious" overstates it; I would put it at moderate. Three reasons, each checked:

1. No printed number is affected. `npx vitest run src/engine/correctness.test.ts src/engine/upgrade.test.ts` -> 89 passed, including `correctness.test.ts:38` "at +10 reads dmg 74 / delay 70 / ratio 1.057, STR 16, STA 16, SV Void 10". The engine implements the rule the record confirmed. A player acting on any of the 731 affected items gets a correct number.

2. The error runs self-deprecating, not self-flattering. It claims the model needed MORE correction than it did — it understates the accuracy of the project's own derivation. The failure mode of a provenance overclaim is a reader trusting a number they should not; here the reader is invited to trust the model slightly less than the evidence warrants. Nobody is led into a wrong decision.

3. The grammatical ambiguity above means a fair share of readers will not extract the false proposition at all, and the 650-character, four-block separation I measured means few readers hold both sentences in view simultaneously — so "self-contradicting on one screen" is stronger than what I could measure.

Against that, the case for keeping it non-trivial is real and I do not want to argue it away: this is a provenance claim on the front page's trust card, in a repository whose stated constitution is "Compute it, or check it, or don't print it" and whose CLAUDE.md §7 names exactly this defect class — "a number that was typed where it could have been computed... A licence assumed rather than checked." A miscredited correction is that habit in prose. It is worth fixing, and the fix is a few words. But moderate, not serious: serious should be reserved for a claim that could cause a player to act wrongly, and this one cannot.

SCOPE — AGREE on the substance; I measured it and it holds, with the "65 characters" figure corrected to 650 (the lens's own quoted offsets, 1248 and 1898, already implied 650, so its prose contradicted its evidence — the same class of unchecked number the finding is about). I also ran down a candidate third statement (`Landing.tsx:83`) and found it hover-gated and absent from the rendered page, so scope is not wider than claimed.

### 15. Upgrades tells the reader a Lore item is placed where it gains the most; the allocation is greedy and is not, in 2 of 8 Lore rows on the shipped Avenrae import

`web/src/screens/Upgrades.tsx:1146` — severity claimed **serious**, scope claimed **2 of the 8 Lore rows (25%) in the one real-data scenario the repo ships a fixture for — the Avenrae /outputfile inventory import at the Balanced preset. The sentence itself renders on 100% of Lore rows: it is inside .upg-detail, which Upgrades.css:315 lays out as a plain flex row with no collapse.**

**Mechanism.** SourceBlock renders, for every Lore candidate: "Lore — One only, so it is offered in the single position where it gains the most." The allocator (upgradeSteps, pass two) does not compute that. Positions are queued by `provisional = ranked[0].score - wornEp` (Upgrades.tsx:536, 583-586) — the gain of each position's *top* candidate, not of the Lore item — and each position takes the first candidate in its own list that is not worn elsewhere and not already `claimed` (take(), Upgrades.tsx:555-573). When a position's top candidate is skipped (worn in another position via `wornAt`, or claimed), it falls through to the Lore item even though another position, later in the queue, would gain more from it. Reproduced on the real Avenrae inventory import with the Balanced preset: `Cloak of Scales` is offered in ANY_1 for +31.5 EP while at BACK it would gain +34.5 EP, and `Lustrous Russet Breastplate` is offered in ANY_2 for +9.0 EP while at ANY_1 it would gain +28.5 EP. (The other 6 Lore rows do satisfy the claim.) Note the page's own footer states the weaker, true version — "a Lore item is offered for one position only" (Upgrades.tsx:1832).

**Evidence the author ran.** Probe reusing the harness of web/src/screens/upgrades-avenrae.test.ts verbatim (real shipped shards + research/validation/tier0-inventory-Avenrae.txt + profileById('balanced')), calling computeUpgrades and then re-scoring each Lore candidate at every other position with the same rankSlotItems/scoreContextFrom(totalsFor(...)) call upgradeSteps makes:
  cd web && npx vitest run src/screens/zz-probe3.test.ts --silent=false --reporter=verbose
  LORE ROWS 8
  Dagas -> PRIMARY gain 76.3 | SECONDARY 53.0 | ANY_1 24.0 | ANY_2 4.5
  Engineer's Ring -> FINGERS_2 gain 71.0 | FINGERS_1 35.3 | ANY_1 27.3 | ANY_2 7.8
  Qeynos Badge of Honor -> NECK gain 42.8 | ANY_1 -1.5 | ANY_2 -21.0
  Cloak of Scales -> ANY_1 gain 31.5 | BACK: score 84.5 worn 50.0 gain 34.5 | ANY_2 12.0
  Brewer's Mesh Cloak -> BACK gain 26.0 | ANY_1 22.5 | ANY_2 3.0
  Pauldrons of the Blue Sky -> SHOULDERS gain 13.5 | ANY_1 0.0 | ANY_2 -19.5
  Leatherfoot Sandals -> FEET gain 11.5 | ANY_1 2.1 | ANY_2 -17.4
  Lustrous Russet Breastplate -> ANY_2 gain 9.0 | CHEST -15.0 | ANY_1: score 77.0 worn 48.5 gain 28.5
Instrument check: the probe's recomputed worn EP agrees with the report's own rows where they overlap (ANY_1 worn 48.5, BACK worn 50.0 in both).

**Player impact.** The reader is told the placement they are looking at is the best use of a one-per-character item, so they have no reason to check the alternative. In the Cloak of Scales case the named position is 3.0 EP worse for that item than Back; in the Breastplate case 19.5 EP worse than the other Any Slot. (The whole-set allocation is not necessarily worse — swapping Cloak of Scales to Back nets 57.0 EP against the greedy 57.5 — so what is wrong is the sentence, not the plan.)

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* The reported "2 of 8 Lore rows (25%) in the one real-data scenario" is correct as far as it goes, and understates the mechanism in two ways.

Corrected, measured with the probe above (all numbers from that one command's stdout):

1. The one shipped real-data fixture, at its default preset (balanced): 2 of 8 Lore rows misplaced — 25%. Exactly as reported, with the same two items and the same EP figures (Cloak of Scales ANY_1 +31.5 vs BACK +34.5; Lustrous Russet Breastplate ANY_2 +9.0 vs ANY_1 +28.5).

2. Same real import across all five PRESET_PROFILES: 10 of 30 Lore rows misplaced — 33%. Per profile: melee-dps 2/11, tank 1/5, caster 3/3, healer 2/3, balanced 2/8. Note caster is 3 of 3.

3. Across 125 runs (25 loadouts x 5 presets): 217 of 1030 Lore rows misplaced — 21.1%. The loadouts were the real import, four bare sets (BRD/WAR/BER, CLR/PAL/DRU, WIZ/MAG/ENC, ROG/MNK/SHD), and 20 deterministic partial-gear derivatives of the real import (each worn position kept with p=0.6, seeded LCG). The four synthetic families are mine, not shipped fixtures — say so if the number is quoted.

4. The rate splits sharply by loadout state, which the original report could not see from one scenario:
   - bare sets: 1 of 197 Lore rows (0.5%). With nothing worn, wornEp is 0 everywhere and wornAt is empty, so the greedy queue order rarely diverges.
   - partially geared: 206 of 763 (27.0%). This is where a real player sits.

5. Magnitude of the miss (EP the named position gives up against the item's best position): n=217, min 0.1, median 7.2, max 88.8; 157 of 217 are >= 5 EP. Largest: tank / a 12-worn partial — Dagas offered at ANY_2 for +3.6 while ANY_1 would gain +92.4.

6. Exposure: 1435 of the 3663 shipped items (39.2%) carry LORE or LORE_EQUIPPED, and Lore rows are the majority of a typical list (8 of 10 rows on the Avenrae/balanced view). The sentence itself renders on 100% of Lore rows — SourceBlock is called unconditionally at Upgrades.tsx:1392 inside the always-rendered .upg-detail div, and the Lore <p> has no guard beyond isLore(item).

Two directions in which 21.1% is a FLOOR, not a ceiling: my counterfactual refuses SECONDARY entirely, and refuses PRIMARY for two-handed candidates, because I do not model the offhand netting — so misplacements whose better home is a hand slot holding a two-hander are not counted.

One correction in the other direction to the original report's framing: it did not distinguish positions the screen withholds. My first pass wrongly counted "Dagas would gain +166.8 at PRIMARY" under the tank preset; tank carries no RATIO/DMG, so PRIMARY is withheld as profile-blind-to-weapons and can state no gain at all. Excluding weapon-blind hand slots removed 3 of my 14 initial Avenrae hits. The corrected numbers above already exclude them.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with a different instrument.

The reported probe re-ran rankSlotItems to price the counterfactual. Mine does not: for each Lore row, it prices the candidate at every other position with scoreItem(item, wornUpgradeAtP, weights, {existing: scoreContextFrom(totalsFor(views, P.id, context)), weaponCounts: weaponCountsAt(P.type)}) minus the same call on the worn item — the call upgradeSteps itself uses for wornEp (Upgrades.tsx:519-522), not the ranking path.

Instrument check before trusting any counterfactual (house rule 4): the probe's independently computed gain at the position the screen actually chose must equal the screen's own row.gain. Over 984 Lore rows (the 1030 minus 46 two-handed rows I exclude), max |probe gain - screen gain| = 0.000000. Printed by the run as the INSTRUMENT line, and asserted (expect(...).toBeLessThan(1e-6)).

Both named cases reproduce to the tenth of an EP on the shipped payload + shipped inventory fixture + balanced preset:
  balanced/avenrae-import: Cloak of Scales offered at ANY_1 (gain 31.5) but BACK would gain 34.5 (delta 3.0)
  balanced/avenrae-import: Lustrous Russet Breastplate offered at ANY_2 (gain 9.0) but ANY_1 would gain 28.5 (delta 19.5)

The code path is as described. The Lore sentence at Upgrades.tsx:1146 asserts a per-item argmax. upgradeSteps computes no such thing: rankings carry `provisional: (ranked[0]?.score ?? 0) - wornEp` (Upgrades.tsx:536) — the gain of each position's OWN top candidate — the queue sorts on that (:583-586), and take() walks a position's list and returns the first entry not blocked by wornAt or claimed (:555-573). The Lore item is consumed by whichever queued position reaches it first, which is an argmax over positions' top-candidate gains, not over the Lore item's gain. I also note claimed.add sits inside take() (:571) and take() runs before the withheld branch (:618), so a position the screen ultimately withholds can still consume the single Lore item.

SEVERITY — AGREE with "serious".

It is a printed claim the code does not compute, on a player-facing surface, on 100% of Lore rows, false at a measured ~1 in 5 (27% on partially-geared sets, the realistic case), with a median 7.2 EP and worst 88.8 EP gap between what the reader is told is best and what actually is. Lore items are 39% of the catalog and the majority of rows on a typical list. That is exactly the defect class CLAUDE.md §7 names as this repo's recurring one.

Not higher than serious: the row's own gain number is correct — my probe confirms row.gain to 1e-6 at the offered position on all 984 comparable rows — so nobody is shown a fabricated EP. The harm is that a reader is told not to reconsider a placement they should reconsider. The prior lens's own note that the whole-set allocation is not necessarily worse (Cloak of Scales to Back nets 57.0 vs greedy 57.5) is right and correctly kept out of the mechanism claim. The page footer at Upgrades.tsx:1832 already states the weaker, true version — "a Lore item is offered for one position only" — which is both evidence the stronger sentence is an overreach and a ready-made fix.

SCOPE — WIDER; see corrected_scope.

### 16. Sources page says a client window has been read for two items; the same page prints the list of five

`web/src/screens/Sources.tsx:680` — severity claimed **minor**, scope claimed **One sentence, rendered whenever meta.dataReliability.flags.clientVerifiedContradictions is non-empty — i.e. on every build of this payload. The contradicting figure is ~2,350 characters earlier in the same page's text content.**

**Mechanism.** Section 04 renders: "Both of the items a client window has been read for contradict the catalog's flag line. Two samples is not a rate — but it is two out of two, and one of them is the weapon on this app's front page." Section 03 of the same page renders `meta.sourceStanding.stats.clientVerified` and then says "That is the whole list — 5 items out of 3,663" (Sources.tsx:541). The payload names five items whose stat blocks were read off a client window (Earthshaker, Whitened Treant Fists, Cloak of Flames, Bone-Clasped Girdle, Bladestopper); only the first two appear in `dataReliability.flags.clientVerifiedContradictions`. The "two out of two" denominator is hardcoded prose beside a `.map` over a two-element array, so it is a claim about how many windows were read, and by the payload's own account that number is five. Whether the flag lines of the other three windows were captured is not published anywhere in meta.json, so the rate cannot be confirmed either way.

**Evidence the author ran.** node -e "const m=require('./web/public/data/meta.json'); console.log(m.sourceStanding.stats.clientVerified); console.log(m.dataReliability.flags.clientVerifiedContradictions.map(c=>c.item))"
  -> 5 clientVerified entries: Earthshaker, Whitened Treant Fists, Cloak of Flames, Bone-Clasped Girdle, Bladestopper
  -> contradictions: [ 'Earthshaker', 'Whitened Treant Fists' ]
Rendered both sentences from one mount of <Sources/> against the real public/data/meta.json (probe using sources.test.tsx's fileResponse stub):
  >>> "That is the whole list" @9063  ...That is the whole list — 5 items out of 3,663...
  >>> "Both of the items a client window" @11410  ...Both of the items a client window has been read for contradict the catalog's flag line. Two samples is not a rate — but it is two out of two...

**Player impact.** The page's flag-distrust argument is stated at 2/2 when the payload supports at most 2 of 5 client windows read. It overstates the evidence on the one page whose whole purpose is not to overstate evidence, and a reader who scrolls up sees the two numbers disagree.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* Not one sentence — THREE independent two-denominator claims render on the same Sources page from the shipped payload, and two of them originate in the pipeline rather than in Sources.tsx, so they survive a payload rebuild:

1. `web/src/screens/Sources.tsx:680-682` (hardcoded JSX text) — "Both of the items a client window has been read for contradict the catalog's flag line. Two samples is not a rate — but it is two out of two…". This is the one the finding named.
2. `meta.dataReliability.flags.summary`, emitted as a string literal at `pipeline/build.mjs:2607`, rendered on the SAME card ~220 chars above claim 1 via `<Prose text={asText(flags?.summary)}/>` (Sources.tsx:659) — "The client disagrees with the catalog on both Tier 0 items sampled."
3. `meta.dataReliability.flags.findings[5]`, a string literal at `pipeline/build.mjs:2619`, rendered in the same section — "MAGIC is absent from every modern-style page and from both client screenshots…".

All three verified RENDERED in one production-build page load (probe3.mjs) alongside the live figure "That is the whole list — 5 items out of 3,663".

Frequency: 100% of Sources-route views on the shipped payload. Section 04's flag card is unconditional and `clientVerifiedContradictions` is non-empty (len 2); section 03's list is non-empty (len 5). The route is one hop from the Upgrades surface (`DataBanner.tsx:117` links "Sources & data quality").

Measured distance between the live "5 items" figure and claim 1 in `document.body.innerText`: 2,397 characters (the finding said ~2,350 — close; the difference is instrument, jsdom vs. real Chromium layout).

Root cause is upstream of all three: `research/validation/KNOWN-DATA-ISSUES.md:10` says "Both Tier 0 items disagree with the catalog", written when only Round 1 existed. `research/validation/TIER0-VALIDATION.md:108-110` records "Round 2 — three more client screenshots (2026-08-16): Cloak of Flames +7, Bone-Clasped Girdle +4, Bladestopper +6". The prose in build.mjs and Sources.tsx was never re-derived after Round 2. `meta.dataReliability.stats.note` ("every Tier 0 sample") was, and is correct at 5.

No test pins any of the three strings (grepped web/src/screens/sources.test.tsx and web/tests), so nothing fails when they go stale.

*Refuter reasoning.* MECHANISM — CONFIRMED, with a different instrument than the one quoted. Instead of a jsdom mount with the test file's fetch stub, I ran a real production build (`npm run build`, dist/assets/index-NDT84SVL.js) served by `vite preview` and loaded it in the project's local Chromium via Playwright, reading `document.body.innerText`. Both sentences render on one page: "That is the whole list — 5 items out of 3,663" at char 9,423 and "Both of the items a client window has been read for … two out of two" at char 11,820, 0 console errors. Payload read with python3 (not node): `sourceStanding.stats.clientVerified` has 5 entries, `sourceStanding.stats.counts["tier-M"]` is 5, and `dataReliability.flags.clientVerifiedContradictions` has 2 (Earthshaker, Whitened Treant Fists). `clientVerifiedRejected` is []. The DOM confirms the two render paths: 5 `<li>` under the section-03 heading, 2 `.src-contra` cards inside the card carrying the "Both of the items" note.

I went one step past the original lens to prove the prose is genuinely hardcoded rather than merely coincident: I mutated the served `dist/data/meta.json` to 4 contradictions and 1 clientVerified entry and re-rendered. The page then showed 4 contradiction cards and 1 list item, and the note directly beneath the 4 cards still read "Both of the items a client window has been read for … it is two out of two". The denominator does not track the array in either direction.

The finding's careful hedge also holds: nothing in meta.json distinguishes "a window was read" from "the window's flag line was captured", and `research/validation/TIER0-VALIDATION.md` records no flag line for the three Round-2 items (grep for flag|placeable|no trade|lore|no drop over that file returned zero hits; the only flag capture in research/ is the two-row table at KNOWN-DATA-ISSUES.md:14-15). So the charitable reading — "read for its flag line", 2 of 2 — is neither published nor refutable from the payload, exactly as stated.

SEVERITY — AGREE, minor. No number a player acts on moves: no ranking, stat, tier or filter output depends on this prose, and the direction of the error reinforces a warning that is independently correct and independently published (`flags.confidence: "low"`, `flags.doNotUseAsAuthoritativeFilter: true`). A reader's takeaway ("do not trust the flag line") is the same at 2/2 or 2/5. It is not lower than minor because the page self-contradicts within one screenful, and because `Sources.tsx`'s own header comment states rule 1: "Nothing is inferred. Every number is either read live out of the shipped meta.json or transcribed from a named file in the repository" — a hardcoded denominator that the payload's live figure contradicts 2,397 chars earlier is precisely the failure that rule exists to prevent. It is not higher because nothing actionable is wrong.

SCOPE — WIDER. See corrected_scope. The finding scoped this to one sentence in one TSX file; measurement found three rendered claims sharing the stale denominator, two of which are string literals in pipeline/build.mjs and therefore reach the browser through the payload. Fixing only Sources.tsx:680 would leave the same overstatement on the same card, one paragraph up.

### 17. Sources card is titled "The largest reason is not an expansion" directly under a table whose largest reason is era:Velious

`web/src/screens/Sources.tsx:397` — severity claimed **minor**, scope claimed **One card heading on the Sources page, rendered on every build that publishes a purge block (this one does).**

**Mechanism.** Section 02 renders a card titled "The largest reason is not an expansion", whose own body then says "The second largest quarantine reason is not an expansion at all — it is `no era in any source`, 2,230 items nobody can place." The quarantine table rendered immediately above it (largest first, asserted by sources.test.tsx) opens with `era:Velious` at 2,828 — an expansion. The title and the body of the same card make different claims and only the body matches the payload.

**Evidence the author ran.** node -e "const m=require('./web/public/data/meta.json'); console.log(m.counts.purge.quarantineReasons.slice(0,3))"
  -> [ {reason:'era:Velious', items:2828}, {reason:'no era in any source', items:2230}, {reason:'era:Kunark', items:1438} ]
Rendered text of <Sources/> against the real meta.json, contiguous:
  "...Era-less is not classicThe largest reason is not an expansionAn item with no era anywhere is unconfirmed, not assumed in-era. The second largest quarantine reason is not an expansion at all — it is no era in any source, 2,230 items nobody can..."

**Player impact.** A reader skimming headings is told the biggest reason items were withheld is not an expansion; the biggest reason is Velious, an expansion, and the number is on screen a few lines above.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 18. Planar gear page says "a hundred and six rows" where its own header counts 105 pieces

`web/src/screens/PlanarGear.tsx:990` — severity claimed **minor**, scope claimed **One lede on the Planar gear screen, always rendered; off by one against the figure printed in that screen's own header. (Every other claim I checked on this screen holds: 18 sets, 6 Shadow Rage pieces all statsUnknown, 8 of 23 covered positions, rings + earrings + 11 others uncovered, Tier 5 (79) outnumbering Tier 2 (20).)**

**Mechanism.** Section 07's lede is hardcoded: "one honest sentence about a hundred and six rows that do not all deserve the same sentence." The page header on the same screen prints the computed figure — `{count(pieces.length)} pieces across {PLANAR_SETS.length} sets` (PlanarGear.tsx:489) — and resolvePlanarPieces over the shipped shards returns 105, not 106. planar.test.ts only pins `pieces.length > 100`, so the drift is not caught.

**Evidence the author ran.** Probe calling the real resolvePlanarPieces on the shipped shards, loaded exactly as planar.test.ts loads them:
  cd web && npx vitest run src/screens/zz-probe.test.ts --silent=false --reporter=verbose
  PIECES 105
  BANDS {"distrust|tier-5|Tier 5 · wiki stats, era unplaced": 79, "trusted|tier-2|Tier 2 · structured wiki data": 20, "unattributed|unattributed|Unattributed · stats withheld": 6}
  SETS Lustrous Russet:7 Midnight Clad:7 Ethereal Mist:6 ... (18 sets)
Independent recount straight off the JSON with the same prefix+slot rule: 105.
grep -rn "106\|hundred and six" web/src/screens/*.tsx research/*.md -> only this one line; no other artefact in the repo carries 106.

**Player impact.** Two different totals for the same list on one screen; the reader cannot tell which is the catalog's.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 19. The front page's Earthshaker product shot has drifted from the shipped Earthshaker record it is described as copying

`web/src/screens/Landing.tsx:64` — severity claimed **minor**, scope claimed **One item window, always rendered, in the front page's "Every item, in the window you already know" showcase. Both divergences confirmed by rendering the two records through the same component in one vitest run.**

**Mechanism.** Landing.tsx hardcodes a SAMPLE Item introduced in its own comment as "the shipped `Earthshaker` record, field for field" (line 51) and renders it through the real ItemWindow beside the sentence "This exact window was read off a live client and the planner reproduces it". The shipped record differs in two ways a reader sees: (1) it carries `fx: [{k:'proc', n:'Earthquake', d:'Combat, Casting Time: Instant'}]`, which ItemWindow.tsx:224-231 renders as an "Effects — proc Earthquake" block; the Landing copy has no fx and prints no Effects block. (2) the shipped record has `ex:'measured-drop'` with four Master Yael sightings, so the app badges it "Tier M · seen dropping in game"; the Landing copy sets `ex:'live-export'` and badges it "Tier M · held in a live inventory". (The Landing copy also drops `ic`, `an`, `src` and `ms`.)

**Evidence the author ran.** node -e "...read web/public/data/items/PRIMARY.json, find n==='Earthshaker'..." -> "fx":[{"k":"proc","n":"Earthquake",...}], "ex":"measured-drop", "ms":[{mob:"Master Yael", seen:4, ...}]
Rendering the SHIPPED record through ItemWindow (probe):
  WINDOW TEXT: EarthshakerTier M · seen dropping in gameTier M · stats read off the clientPRIMARYLore  MagicClassicDMG 74 DLY 70 RATIO 1.057Stats at +10Strength+16Stamina+16Void Resist+10Effectsproc Earthquake — Combat, Casting Time: InstantRequirements...
Rendering <Landing/> (same probe run as finding 1):
  >>> "Earthquake" @-1  NOT FOUND
  >>> "Requirements" @855  ...EarthshakerTier M · held in a live inventoryTier M · stats read off the clientPRIMARYMagic  LoreClassicDMG 74 DLY 70 RATIO 1.057Stats at +10Strength+16Stamina+16Void Resist+10Requirements...

**Player impact.** The showcase promises the window a player will see for this item and shows a different one: no proc line, and a different Tier M existence badge from the one the app prints for Earthshaker everywhere else. Both statements about the item are individually defensible (it is in the live inventory export at line 75), but the page and the catalog disagree about which evidence it is standing on.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 20. NewCharacter's justification comment measures the shipped payload at 7,341 race-restricted items; it holds 248

`web/src/screens/NewCharacter.tsx:16` — severity claimed **minor**, scope claimed **One comment in one screen file; no rendered text depends on it. Reported because it is a numeric claim in web/src/screens that no longer survives a check against the payload it names.**

**Mechanism.** The comment above `const races = RACES` reads: "Measured against the shipped payload: 7,341 items carry a restriction and between them name five distinct codes, so the dropdown offered 7 of 15". The shipped payload is 3,663 items in total, so 7,341 restricted items is impossible against it; the real figure is 248 items carrying a race restriction. The "five distinct codes" half still holds (BAR, TRL, OGR, IKS, ELF, plus the ALL_EXCEPT and NONE sentinels). This is a code comment, not rendered text; the behaviour it justifies is correct — all 15 RACES are offered.

**Evidence the author ran.** node -e "read all web/public/data/items/*.json, dedupe by name+id -> 3663 unique; count items whose ra is set and is not just ['ALL']"
  unique items 3663 restricted 248 distinct codes 7 BAR,TRL,OGR,IKS,ALL_EXCEPT,ELF,NONE
grep -n "export const RACES" -A 4 web/src/engine/constants.ts -> 15 codes; NewCharacter.tsx:21 `const races = RACES` -> all 15 offered, so the claim's conclusion is right and only its measurement is stale.

**Player impact.** None on screen. The risk is to the next session: the comment is the recorded justification for the fix, and its measurement now points at a catalog that does not exist, so anyone re-deriving it will not reproduce the number.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 21. Item picker's "vs worn" delta compares candidate@preview against worn@its-own-tier, contradicting the worn item's own EP one row away

`web/src/components/ItemPicker.tsx:240` — severity claimed **serious**, scope claimed **Measured over the real imported Avenrae set (shipped payload, balanced preset, `research/validation/tier0-inventory-Avenrae.txt`) by computing, for every occupied position, the worn item's score at its own tier versus at preview +10 — the distortion the "vs worn" column carries at that preview: ``` EAR_1 Black Sapphire Electrum Earring +4: baseline=22.80 sameTier=36.00 distortion=13.20 EP FACE Darkbrood Mask +4: baseline=44.80 sameTier=70.00 distortion=25.20 EP CHEST Indicolite Breastplate +6: baseline=92.00 sameTier=115.00 distortion=23.00 EP WAIST Bone-Clasped Girdle +4: baseline=66.50 sameTier=99.50 distortion=33.00 EP … slots distorted at preview +10: 18 of 21 occupied ``` Range 1.20–33.00 EP. Zero distortion while the preview sits at its initial value (`useState(currentUpgrade)`), and on an empty slot. Nothing in `picker-rerank.test.tsx` or `picker-filters.test.tsx` asserts the baseline tier.**

**Mechanism.** `wornScore` is memoised on `currentUpgrade` (the worn tier) and deliberately does not depend on `rankPreview`: `useMemo(() => scoreItem(currentItem, currentUpgrade, weights, { existing }).total, [currentItem, currentUpgrade, weights, existing])`. Every candidate row, by contrast, is scored at `rankPreview` (ItemPicker.tsx:214-221). The row then prints `signedDec(entry.score - wornScore)` followed by the words "vs worn" (ItemPicker.tsx:651-652). So as soon as the reader moves the "Preview at" stepper — the control's only purpose — the delta mixes two tiers. The worn item itself is still in the same list, scored at the preview tier, so the list shows two mutually inconsistent numbers. The Upgrades screen makes the identical choice deliberately and labels it ("Every candidate is scored at +N against what you are wearing at its own tier", Upgrades.tsx:1635-1638); the picker's only label is the two words "Preview at" (ItemPicker.tsx:420), and its code comment at line 238 asserts the opposite of what it does: "The worn item scored under the same lens".

**Evidence the author ran.** Mounted DOM probe (temporary vitest file, since removed) on the App, fixture catalog with two helms, weights {STR,STA,AGI,DEX}=1, LUMP (STR 20) worn at +0, picker opened on Head, then the real "Raise ranking preview upgrade level" button clicked 5 times. Command: `cd web && npx vitest run src/components/<probe>.test.tsx --silent=false --reporter=verbose`
```
worn LUMP is at +0.  rows at preview +0:
[Fixture] Helm of One Big Thing | 20.0 EP
[Fixture] Helm of Four Small Things | 16.0 EP-4 vs worn
after raising "Preview at" to +5:
[Fixture] Helm of Four Small Things | 36.0 EP+16 vs worn
[Fixture] Helm of One Big Thing | 30.0 EP
engine: SPREAD@+5 = 36  LUMP@+0 = 20  LUMP@+5 = 30
printed delta = 16 ; same-tier delta = 6
picker header hint: Preview at−+5+
```
The list simultaneously says the worn helm is worth 30.0 EP and that the other helm is +16 ahead of it at 36.0 EP.

**Player impact.** The "Preview at" stepper is the natural way to ask "which of these is better once I have upgraded them". The answer the picker prints is "how much better is this candidate at +N than what I have at its current tier", inflated by the whole worn-side upgrade, and it disagrees by that amount with the worn item's own EP shown a row away in the same list. Candidates are ranked correctly among themselves; only the gain against what you already have is wrong.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* Their headline number is exactly right and I reproduced it independently (my own parse of the Avenrae export through readInventory + toSlotMap, balanced preset, cap context from computeTotals): 18 of 21 occupied positions distorted at preview +10, distortion range 1.20-33.00 EP, per-position figures identical to theirs (FACE Darkbrood Mask +4: 25.20; CHEST Indicolite Breastplate +6: 23.00; WAIST Bone-Clasped Girdle +4: 33.00). It is wider than that in three measured ways.

1) 18/21 is the count at ONE stepper position. Each picker's preview is seeded to that slot's own worn tier, so the relevant population is "positions whose worn item has tier-dependent EP" — those distort as soon as the stepper moves in any direction. That is 19 of 21, not 18. At preview +0 the count is 19/21 (PRIMARY Earthshaker is already worn at +10, so it is undistorted at +10 and distorted at every lower preview); the only two positions that can never distort are NECK Talisman of Kejaar Kerrath and AMMO Crude Arrow, which score 0.00 at every tier under the balanced preset. Measured counts across the stepper: +0 19/21, +1 19/21, +2 19/21, +3 19/21, +5 18/21, +8 19/21, +10 18/21.

2) Beyond this one set: 2,080 of the 3,663 unique shipped items have tier-dependent EP under the balanced preset (score at +0 vs +10; 1,583 are flat), median gain +10.00 EP, max +74.00 EP. So any worn item drawn from that 57% carries the distortion.

3) They did not measure the sign-flip subset, which is the part that reverses a verdict rather than only inflating a magnitude. Over the same 21 Avenrae pickers at preview +10, 62 of 4,215 candidate rows (1.5%) print a green positive "+x vs worn" while being WORSE than the worn item at the same tier — e.g. EAR 5 of 37, WRIST 6 of 86, ANY 21 of 1,368. These are exactly the near-equal candidates, i.e. the marginal decisions.

4) Their impact line "disagrees ... with the worn item's own EP shown a row away" needs a measurement, because the list is windowed and long. Measured: the worn item sits within the first 9 rows (one screenful) of its own picker in 15 of 21 Avenrae positions, and at rank 1-3 in 12 of them. So the on-screen self-contradiction is the common case, not the exception.

Two of their supporting claims I checked and confirmed: distortion is exactly zero while the preview sits at its seeded value (SetWorkspace.tsx:228 passes the slot's worn tier; ItemPicker.tsx:158 `useState(currentUpgrade ?? BASE_STATE)`), and on an empty slot no "vs worn" is rendered at all (ItemPicker.tsx:648 gates on `currentItem`). One claim I would correct: they wrote that "The Upgrades screen makes the identical choice deliberately and labels it." Upgrades DEFAULTS to the same-tier basis (`useState<'worn'|'fixed'>('worn')`, Upgrades.tsx:1425, "What you are wearing keeps its own +N and the candidate is scored at the same tier"); the cross-tier basis is a labelled opt-in. So the picker silently applies the non-default basis of the flagship surface, which makes the inconsistency slightly worse than they stated, not milder.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with a different instrument. Their probe mounted the whole App against a 3-helm fixture catalog. Mine mounts `ItemPicker` directly with props, seeded with the real shipped HEAD shard (136 items through `normalizeCatalog`), and drives the real "Raise ranking preview upgrade level" button.

Reading the code first: `wornScore` (ItemPicker.tsx:240-243) is `scoreItem(currentItem, currentUpgrade, ...)` with dependency array `[currentItem, currentUpgrade, weights, existing]` — `rankPreview` is absent. Rows come from `rankSlotItems(..., upgrade: rankPreview, ...)` (212-222). The row prints `signedDec(entry.score - wornScore)` + " vs worn" (651-652) and colours it `entry.score >= wornScore ? 'good' : 'bad'`. So the subtraction crosses tiers.

Run 1 (worn = Aqualung at +4, weights {STR:1,STA:1,AC:1,HP:0.2}, warrior context): printed "+55 vs worn" on Hammerhead Helm at preview +10. Engine ground truth from the same run: Hammerhead@+10 = 60.00, worn@+4 = 5.00, worn@+10 = 11.00. 60.00-5.00 = 55.00 = the printed value; the same-tier answer is 49.00. Cross-tier arithmetic confirmed to the decimal.

Run 2, sharpened so the worn row is on screen (worn = the top-ranked helm, Hammerhead Helm, at +4). At the seeded preview +4 the list is self-consistent: Hammerhead 40.0 EP, Indicolite Helm 28.0 EP "-12 vs worn" (40-28=12, correct). After clicking the real stepper to +10 the same viewport prints:
  Hammerhead Helm      60.0 EP            <- the worn item's own row
  Indicolite Helm      40.0 EP   0 vs worn
  Lustrous Russet Helm 40.0 EP   0 vs worn
  Skull-shaped Barbute 40.0 EP   0 vs worn
Three helms are told they are level with a helm the row above says is worth 60.0, and the "0" carries the `good` class. That is the contradiction, in one screenful, off real payload data.

SEVERITY — AGREE with "serious", though at the lower end of it, and I want the limits on the record so it is judged on its actual shape. Against a higher rating: the subtraction is a constant per open picker, so candidate-vs-candidate ORDER is untouched; the tier written on equip is `rankPreview` (405, 607), so nothing wrong is persisted; the per-stat delta chips use the same basis (`statDeltas(item, rankPreview, currentItem, currentUpgrade)`, 576-578), so the picker is internally consistent with itself; and the picker opens honest — the distortion only exists once the reader touches the stepper. For "serious": the number is wrong on its face by up to 33 EP on a real set, it is contradicted by another number in the same viewport in 15 of 21 measured positions, 62 rows in that set have the SIGN wrong so the colour recommends a downgrade, the control has no label beyond the words "Preview at" while the flagship Upgrades screen labels this exact basis and does not default to it, and the code comment at line 239 ("The worn item scored under the same lens") states the opposite of what the code does — which is how this survives review. Not "critical": no corruption, no wrong write, no wrong ordering.

SCOPE — WIDER; see corrected_scope. Their +10 figure is exactly right; the population that the stepper can distort is 19 of 21 rather than 18, they omitted the sign-flip subset, and the "one row away" claim needed measuring (it holds in 15 of 21).

Instrument checks, per the house rules: (a) my engine ground truth uses `scoreItem` while the rows come through `rankScorer` inside `rankSlotItems` — the two agree by construction (asserted in ep.test, ItemPicker's own comment at gear.ts:368), and in run 2 the DOM's 60.0 matched my `scoreItem` 60.00, so the instrument is not the source of the gap; (b) the two positions I report as never-distorted score 0.00 at BOTH tiers, i.e. the balanced preset weights none of their stats, not a scoring failure; (c) in the rank probe FEET and WAIST returned -1 for the worn item because the WAR/HUM context I invented cannot use them — that is my fixture, not a product defect, and it affects only those two rows of the rank/sign-flip tables.

Test coverage claim, with the file set named: grep for "vs worn|wornScore" over web/src/**/*.{ts,tsx} and web/e2e/*.spec.ts returns 3 hits, all three inside ItemPicker.tsx itself. grep for ".result-score" over the same set returns one test hit, e2e/picker.spec.ts:217, which reads only the `.n` (absolute EP) element; the surrounding test ("the ranking preview rescoring is reflected in scores and in the equipped tier") asserts only that the top score RISES with the preview. Nothing anywhere asserts the baseline the delta is taken against. Their "nothing in picker-rerank/picker-filters asserts it" is true and understated — nothing in the whole suite does.

Probe files left in the worktree for reproduction, all marked AUDIT PROBE: web/src/components/audit-worn.test.tsx (DOM), audit-scope.test.ts (Avenrae + full-payload scope), audit-signflip.test.ts, audit-rank.test.ts. Note the worktree's web/ had no node_modules; I symlinked /home/user/EQL50ups/web/node_modules (gitignored, git status shows only the four probe files).

### 22. Picker's "vs worn" baseline counts weapon ratio/damage in slots where no candidate is allowed to score them

`web/src/components/ItemPicker.tsx:241` — severity claimed **serious**, scope claimed **Requires an item with a weapon block worn in a non-hand position. Counted over the shipped payload (`web/public/data/items-index.json` merged with all 19 slot shards, 3,663 items, via a node one-liner): 560 items carry a `wp` block, and because `itemsForSlot` returns every wearable item for 'ANY' (data/catalog.ts:461-464) all 560 are eligible for the two Any Slots; 94 of them list RANGE/AMMO among their slots, 86 of which the Avenrae trio can equip. The distortion equals weight(RATIO)×ratio + weight(DMG)×damage, so it is zero for the tank/caster/healer presets, which weight no weapon term (`scoresWeapons`, ep.ts). The real Avenrae export happens to wear no weapon outside a hand — its only `wp` item is Earthshaker in PRIMARY, where the two rules agree (skew 0.00) — so this is reproduced on constructed loadouts, not on that fixture.**

**Mechanism.** `scoreItem(currentItem, currentUpgrade, weights, { existing })` omits `weaponCounts`, and `ScoreContext.weaponCounts` defaults to true (ep.ts:38-46, `ctx.weaponCounts ?? true`), so the worn item is paid for RATIO and DMG in every slot. The candidates it is subtracted from are scored by `rankSlotItems`, which sets `weaponCounts = weaponCountsAt(slot)` (selectors/gear.ts:366) — false everywhere except PRIMARY and SECONDARY (constants.ts:147-149). So on RANGE, AMMO and the two Any Slots, a worn item with a `wp` block contributes a weapon term to the baseline that no candidate can earn, and `entry.score - wornScore` (ItemPicker.tsx:652) is understated by that term on every row. The Upgrades screen passes `weaponCounts` explicitly on both sides (Upgrades.tsx:463 and the `wornEp` call at 517) and is not affected; the picker even prints a hint on the Any Slot saying "weapon damage scores nothing here" (ItemPicker.tsx:513) while its own worn baseline counts it.

**Evidence the author ran.** Probe (temporary vitest file, since removed) against the shipped payload, balanced preset (RATIO 20), real cap context from the imported Avenrae set. Command: `cd web && npx vitest run src/screens/<probe>.test.ts --silent=false --reporter=verbose`

Bow worn in RANGE:
```
bow {"n":"Bow of the Underfoot","sl":["RANGE"],"wp":{"dmg":33,"dly":60,…},"st":{"DEX":4,"STR":4}}
RANGE worn=Bow of the Underfoot +5 pickerWornScore=25.33 candidateRuleScore=9.00 skew=16.33
ranked RANGE candidates: 96
   Soldier's Brooch of the Stalwart score=33.00 printedVsWorn=7.67 honestVsWorn=24.00
   Idol of the Underking score=16.00 printedVsWorn=-9.33 honestVsWorn=7.00
   Kerran Toy score=11.50 printedVsWorn=-13.83 honestVsWorn=2.50
candidates printed as a LOSS that are really a GAIN: 3 of 96
```
Weapon worn in an Any Slot:
```
ANY_1 worn=Earthshaker +10 pickerWornScore=37.14 candidateRuleScore=16.00 skew=21.14
ANY candidates: 1548; printed as a loss but really a gain: 507
   Indicolite Breastplate 115.00 printed=77.86 honest=99.00
```

**Player impact.** A player who keeps a bow in Range or a weapon in an Any Slot — both legal — sees every alternative for that slot marked down by the worn weapon's whole ratio contribution: in the Earthshaker-in-Any-Slot case, 507 of 1,548 candidates are printed as a loss when they are in fact a gain, including the best item in the slot at 99 EP ahead.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **NARROWER**.

*Corrected scope.* Narrower on the headline number, slightly wider on slots.

1. "560 items carry a wp block … all 560 are eligible for the two Any Slots" — 560 is the count of raw `wp` blocks in the JSON, but the app does not read all of them. `normalizeWeapon` (web/src/data/normalize.ts:149-153) drops any block without both dmg>0 and dly>0, which discards the arrows and similar. The catalog the picker actually holds has 515 weapon items (`node`/vitest counts above), of which 370 are usable by the Avenrae trio. So the Any-Slot exposure is 515 ceiling / 370 realistic, not 560.

2. "94 of them list RANGE/AMMO, 86 of which the trio can equip" — 94/86 is exactly right for RANGE. AMMO adds 11 (10 trio-usable), though all 11 also list RANGE, and one slot was missed: EAR holds one weapon-block item, Fang of the Wolf (skew 7.69 EP at +10, balanced). Distinct non-hand, non-Any items that trigger this: 95 (94 RANGE + 1 EAR). Every other one of the 23 positions holds zero weapon-block items in the shipped payload, so the affected surface is exactly RANGE, AMMO, EAR and the two Any Slots.

3. Flip counts are slightly overstated. RANGE / Bow of the Underfoot +5 / balanced: 2 of 96 candidates are printed as a loss but are really a gain, not 3 (the third item quoted in the finding, Soldier's Brooch at +7.67, is printed as a gain and is not a flip). ANY / Earthshaker +10 / balanced: 449 of 1548 strict flips, or 506 if rows scoring exactly the honest baseline (printed red as a loss, honestly neutral) are counted — the reported 507 is that second measure ±1, so it is defensible; the strict figure is 449.

4. Unchanged and confirmed: zero under tank, caster and healer (bow +5 skew 0.00 for all three); 16.33 EP under balanced and 32.67 under melee-dps for that bow; and every row of the affected picker — not just the sign-flipped ones — carries a delta wrong by exactly that constant. The imported Avenrae set genuinely wears no weapon outside PRIMARY (its only wp item is Earthshaker in PRIMARY), so this is reproduced on constructed loadouts, as the finding said.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with a different instrument (the rendered DOM, not a scorer probe).

Code path, read line by line:
- /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-24/web/src/components/ItemPicker.tsx:240-242 — `scoreItem(currentItem, currentUpgrade, weights, { existing })`. No `weaponCounts`.
- web/src/engine/ep.ts:147 — `if (resolved.weapon && (ctx.weaponCounts ?? true)) { add('RATIO', …); add('DMG', …); }`. Default true, so the worn item is paid for its weapon block in every slot.
- web/src/selectors/gear.ts:366-369 — candidates are scored by `rankScorer(weights, { weaponCounts: weaponCountsAt(slot), … })`.
- web/src/engine/constants.ts:144-149 — `weaponCountsAt` is true only for PRIMARY/SECONDARY (and explicitly false for 'ANY').
- ItemPicker.tsx:651-653 — the printed row is `entry.score - wornScore`, colored good/bad on `entry.score >= wornScore`.
So the two sides of the subtraction obey different rules everywhere except the two hands. That is exactly the reported mechanism.

Independent reproduction (DOM, not the scorer): I rendered `<ItemPicker/>` in jsdom against the real shipped RANGE shard, worn = Bow of the Underfoot +5, `profileById('balanced')`, Avenrae trio context, and read the rendered text. Probe: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-24/web/src/components/audit-picker-worn.test.tsx. Output:
  worn row as the picker prints it: {"name":"Bow of the Underfoot…","ep":9,"equipped":true}
  Soldier's Brooch of the Stalwart EP=33   printed vsWorn=+7.7   EP − printed worn EP = 24.00
  Idol of the Underking            EP=16   printed vsWorn=-9.3   EP − printed worn EP =  7.00
  Kerran Toy                       EP=11.5 printed vsWorn=-13.8  EP − printed worn EP =  2.50
  rows=15 rendered, contradicting=14, printedLossButRealGain=2
The picker prints the worn bow's own EP as 9.0 in the same list and then computes every delta against 25.33 — the page contradicts itself on screen, and two candidates that are gains are printed in red as losses. (Only 15 rows render because the list is windowed and jsdom has zero viewport height; the count over the full ranked list is below.)

The stated contrast holds too: web/src/screens/Upgrades.tsx:461 and :523 pass `weaponCounts` on both sides, and web/src/lib/setDiff.ts:181/:363 do the same, so ItemPicker.tsx:241 is the odd one out among slot-aware call sites. The Any-Slot hint at ItemPicker.tsx:513 ("weapon damage scores nothing here") is present and does contradict the baseline the same component computes.
Adjacent, NOT part of this finding and only read, not measured: web/src/components/PaperDoll.tsx:86 sums `scoreItem(entry.item, entry.upgrade, weights)` over every equipped entry with no `weaponCounts` either — same omission on the whole-set headline number.

SEVERITY — AGREE with "serious", at its low end, and the mitigations are worth stating.
Against: the ranking order is correct (rows are sorted by `entry.score`, which is slot-correct), the per-row EP is correct, the stat-delta chips are unaffected, nothing is written to the set, and the flagship Upgrades screen is clean. Also the honest baseline is visible two rows away as the equipped row's own EP.
For: the "vs worn" figure is the number the picker exists to print, and when a weapon-block item is worn in one of these slots EVERY row's figure is wrong (all 96 RANGE rows off by exactly 16.33 EP at balanced, 32.67 at melee-dps), and some rows carry a false red "downgrade" verdict on genuine upgrades. A player who trusts the color skips a real gain. That is an actionable false claim on the player-facing surface, which is the class of defect this repository treats as serious.

SCOPE — measured; the reported numbers are mostly right but the headline eligibility figure is an overcount, and one affected slot was missed. See corrected_scope.

### 23. Import-withheld slot prints "+0" for gear the export said was +5 — the parsed tier is discarded

`web/src/screens/Upgrades.tsx:464` — severity claimed **minor**, scope claimed **Measured on the one real export the repo ships (`tier0-inventory-Avenrae.txt`): 1 of 23 positions is withheld by the importer, and its parsed tier is 5, so 1 of 1 withheld-by-import rows shows a wrong tier. Generalises to every worn item an import cannot score at a tier above 0. No computed number depends on it — the slot is deliberately not scored, and `wornEp` is 0 by construction — so the defect is confined to the displayed tier on the "Not compared" card. The directly-equipped withheld path is the one the existing suite covers (upgrades-screen.test.tsx:272 equips UNSTATTED at tier 5), which is why this is not caught.**

**Mechanism.** When a position is occupied by an item the catalog has no stats for, the importer records it in `GearSet.withheld` by NAME only: `withheldMap` (web/src/lib/inventoryImport.ts:856-863) writes `out[entry.positionId] = entry.exportName` and drops `entry.tier`, even though `UnstattedEntry` carries a parsed `tier` field (inventoryImport.ts:236) and `SetEditor.tsx:188-191` feeds that map straight into `applySlots`. On the Upgrades screen such a slot has no `view.equipped`, so `Upgrades.tsx:464` falls through to `BASE_STATE`, and the "Not compared" card renders `<TierChip value={entry.wornUpgrade}/>` (Upgrades.tsx:1807), which prints `+{value.full}` unconditionally (Upgrades.tsx:980-986). The chip therefore states a tier of 0 for an item whose tier the app parsed and then threw away. The same helm equipped directly rather than via import keeps its tier and renders correctly, so the two paths disagree.

**Evidence the author ran.** Temporary vitest probes (since removed) against the shipped payload and the real export fixture `research/validation/tier0-inventory-Avenrae.txt`. Command: `cd web && npx vitest run src/screens/<probe> --silent=false --reporter=verbose`

(a) The importer knows the tier and withheldMap drops it:
```
items 3663
unstatted entries [ 'HEAD Shadow Rage Helm tier=5 kind=item' ]
withheldMap { HEAD: 'Shadow Rage Helm' }
```

(b) computeUpgrades on that imported set (balanced preset, basis {kind:'worn'}):
```
WITHHELD HEAD Shadow Rage Helm shownTier=+0 candidate= Indicolite Helm +0
WITHHELD SECONDARY null shownTier=+0 candidate= Rokyls Channelling Crystal +0
```

(c) Mounted DOM probe — `applySlots(setId, {}, true, { HEAD: '[Fixture] Shadow Rage Helm' })`, exactly what SetEditor's import does, then route `#/set/<id>/upgrades`:
```
WITHHELD CARD TEXT >>> Head[Fixture] Shadow Rage Helm+0Unsourced · stats withheldNo catalog carries this item's stats, so nothing can be measured against it. …
TIER CHIP >>> +0 title= Upgrade tier 0
```
Same helm equipped directly at tier(5) instead of imported:
```
TIER CHIP (equipped path) >>> +5
```

**Player impact.** A player who imports their inventory sees their own +5 helm described on screen as "+0", with a tooltip reading "Upgrade tier 0", on the one card that exists to tell them why that slot could not be ranked. By this repository's own standard it is a number that was parsed and then invented rather than carried.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-LOW**, scope **NARROWER**.

*Corrected scope.* HOW OFTEN IT FIRES — narrower than implied, on two axes.

(1) ENTRY POINTS: 2 of 3, and the Set-editor DEFAULT is not one of them.
`GearSet.withheld` (web/src/engine/types.ts:231, typed `Record<string, string>`) is written by exactly one function, `store.applySlots` (web/src/state/store.ts:470). File set searched: all of web/src via `grep -rn "withheld" src/ --include=*.ts --include=*.tsx`. Three call sites:
  - web/src/screens/CharacterDetail.tsx:190 — passes `withheldMap(result)` -> mechanism FIRES.
  - web/src/screens/SetEditor.tsx:191 (`target === 'current'`) — passes it -> FIRES.
  - web/src/screens/SetEditor.tsx:201 (`target === 'new'`) — calls `applySlots(created.id, slots, true)` with NO withheld argument -> does NOT fire.
And `'new'` is the dialog's default: web/src/components/InventoryImportDialog.tsx:55 `useState<ImportTarget>('new')`, pinned by web/src/components/inventoryimport.test.tsx:232 `expect(target).toBe('new')`. Measured consequence of that third path (probe section E, real payload + real export): HEAD gets NO withheld card and NO upgrade row — the withheld item disappears from the screen entirely. That is a separate defect, not this one, and it means the finding's "+0" chip is unreachable from a Set-editor import left on its default.

(2) CATALOG POPULATION: 6 Berserker-only armor pieces, not an open-ended class.
Census over web/public/data/items-index.json + web/public/data/items/*.json (3,663 items):
  - 16 items carry `statsUnknown: true` (0.44%).
  - 6 of those have a worn slot, and they are one set: Shadow Rage Helm/Sleeves/Wristguard/Gloves/Leggings/Boots, `sl` = HEAD/ARMS/WRIST/HANDS/LEGS/FEET, every one `cl: ["BER"]`. Berserker-only.
  - The other 10 carry `sl: []` (Backpack*, Lightweight Bag, Velium Gemmed Rune, Complex Velium Gemmed Rune, Crushbone Battle Plans, Heretic Insurrection Orders, Essence of Wind, Sarialiyn's Lute, Deterioriated Ancient Faydark Longbow, Griffon Wing Spaulders). These can still be withheld: the importer assigns positions from the export's Location column and the row index alone (web/src/lib/inventoryImport.ts:487-518), with no `item.sl` check before the unstatted branch at :550.

(3) PER-OCCURRENCE, the finding's own numbers are right, and its "tier above 0" caveat almost never saves it.
On research/validation/tier0-inventory-Avenrae.txt: 22 placed worn positions, 1 empty, 0 unmatched, 1 withheld (HEAD Shadow Rage Helm, parsed tier 5). So 1 of 1 withheld-by-import rows shows a wrong tier — as stated. Tier histogram over all 22 placed positions: {+4: 9, +5: 4, +6: 6, +7: 2, +10: 1} — 22 of 22 above +0. On a geared character the discarded tier is essentially never coincidentally zero.

(4) WIDER in what breaks per occurrence: 3 things on the card, not 1. See reasoning.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with two instruments neither of which is the one quoted.

Static chain, read not grepped: `UnstattedEntry.tier` exists (web/src/lib/inventoryImport.ts:236) and is populated at :550-560 from `splitUpgradeSuffix(rawName)`. `withheldMap` (:856-863) writes `out[entry.positionId] = entry.exportName` and nothing else. The destination type forecloses it: `GearSet.withheld?: Record<string, string>` (web/src/engine/types.ts:231) and `applySlots(..., withheld?: Record<string, string>)` (store.ts:133) have nowhere to put a tier. Upgrades.tsx:464 `const wornUpgrade = view.equipped ? normalizeState(view.equipped.upgrade) : BASE_STATE;` — an import-withheld position has no `view.equipped`, so BASE_STATE. Upgrades.tsx:1807 renders `<TierChip value={entry.wornUpgrade} />`; TierChip (:980-986) prints `+{num(value.full)}` with `title={`Upgrade tier ${value.full}`}` unconditionally.

Instrument A — vite SSR bundle run in PLAIN NODE (no vitest, no jsdom), against web/public/data (3,663 items) and the real export:
  unstatted entries: [ 'HEAD "Shadow Rage Helm" tier=5 kind=item' ]
  withheldMap (what is persisted): {"HEAD":"Shadow Rage Helm"}   value types: HEAD:string
  [HEAD]      worn="Shadow Rage Helm" reason=worn-unstatted CHIP="+0"
  [PRIMARY]   worn="Earthshaker"      reason=profile-blind-to-weapons CHIP="+10"
  control, same helm equipped at tier(5): [HEAD] CHIP="+5"
The PRIMARY line matters: a withheld row whose item IS in `view.equipped` prints its real tier (+10). Only the import-withheld row loses it, so this is not "withheld rows show +0" generally.

INSTRUMENT CHECK (house rule): my first run of Instrument A printed `unstatted entries: []` — a surprising zero. Cause was mine, not the code: I passed a `CatalogState` with no `byId`, so `readInventory` threw and returned an empty parse. Supplying `itemIdIndex(catalog.items)` (byId size 299) produced the output above. I am reporting the corrected run.

Instrument B — mounted DOM under the repo's own vitest, `applySlots(id, {}, true, { HEAD: name })`, i.e. exactly the shape `withheldMap` produces:
  IMPORT chip: "+0" title= Upgrade tier 0
  EQUIP  chip: "+5" title= Upgrade tier 5

SEVERITY — TOO-LOW, on one specific point. The finding asserts "No computed number depends on it — the slot is deliberately not scored, and wornEp is 0 by construction — so the defect is confined to the displayed tier." The first half is right (`wornEp` is `view.item && !reason ? scoreItem(...) : 0`, Upgrades.tsx:522-525) but the conclusion is wrong, because `candidateUpgrade` is derived from the same discarded value: `basis.kind === 'worn' ? wornUpgrade : normalizeState(basis.upgrade)` (Upgrades.tsx:465-466), and `'worn'` is the screen's default basis (Upgrades.tsx:1425 `useState<'worn' | 'fixed'>('worn')`). Instrument C — the repo's own real-payload harness (the setup from web/src/screens/upgrades-avenrae.test.ts: shipped catalog, real export, balanced preset, DEFAULT_SET_FILTERS, Avenrae's context):
  PROBE IMPORTED: chip=+0 candidate="Indicolite Helm" EP=23.50 candTier=+0 evidence=ABSENT
  PROBE EQUIPPED: chip=+5 candidate="Indicolite Helm" EP=37.00 candTier=+5 evidence=PRESENT
The card's one prose sentence — "The best scoring item this position can take is Indicolite Helm at 23.5 EP" (Upgrades.tsx:1820-1824) — understates by 13.50 EP, 36.5% low, against the same item at the player's actual tier. That is a computed number on screen that depends on the discarded tier. The quoted lens's own evidence block (b) printed `candidate= Indicolite Helm +0` and did not follow it through.

Third symptom, same root cause, separable claim: the evidence line vanishes on the import path. `evidence: entry.view.item?.evidence` (Upgrades.tsx:625, :644); with no `view.equipped` there is no `view.item`, so `{entry.evidence ? <p .../> : null}` (Upgrades.tsx:1815) renders nothing. Instrument B card text, import path, ends "...arithmetic against a zero nobody recorded." — the equip path additionally carries "Worn in the owner's client; no catalog carries its numbers." The sentence that says why the item has no stats is dropped precisely on the path that learned of the item from the player's own client. Caused by the same name-only map, but by the missing `view.item` rather than by the missing tier, so it should be judged on its own.

Severity still sits inside "minor" in the sense that nothing in `report.rows` — the ranked list players act on — is affected, and the population is small (see corrected_scope). But "confined to the displayed tier" is not true, and the 23.5-vs-37.0 EP figure is the kind of number this repository's own rule ("compute it, or check it, or don't print it") is written about.

COVERAGE — the finding's citation is off by a file. The test that equips UNSTATTED at tier 5 and asserts `held?.wornUpgrade.full === 5` is web/src/screens/upgrades-avenrae.test.ts:272 ('withholds the Shadow Rage Helm slot rather than scoring a zero'), not upgrades-screen.test.tsx:272 (which asserts only card text). The diagnosis is right, though, and sharper than stated: the SAME FILE has an import-path test at :148-158 that asserts `wornName` and `reason` on the imported HEAD row and pointedly does not assert `wornUpgrade`. The two paths are tested side by side and only the hand-built one has the tier assertion.

### 24. Share links drop GearSet.withheld, so a position the author's screen called "not comparable" is ranked as an upgrade for the reader

`web/src/share/codec.ts:63` — severity claimed **serious**, scope claimed **Every share link made from a set the inventory importer produced where at least one worn position held an item this build cannot score. Measured on the repository's only real export (tier0-inventory-Avenrae.txt): 1 of 23 positions (HEAD / Shadow Rage Helm). `withheldMap` (lib/inventoryImport.ts:855) populates it from `result.unstatted` where `kind === 'item'`; the shipped catalogue carries 16 `statsUnknown` records (asserted at src/data/source-standing.test.ts:194), and any export item absent from the catalogue entirely also lands there. The `withheld` field has exactly two writers (SetEditor.tsx:191, CharacterDetail.tsx:190) and one reader (Upgrades.tsx:1479), so nothing outside the importer path is affected.**

**Mechanism.** `SharedPlan.set` is typed `Pick<GearSet, 'name' | 'slots' | 'weights' | 'notes'>` (codec.ts:63) and `planFrom` copies only those fields (codec.ts:654). `GearSet.withheld` — the map of positions an inventory import found occupied by an item with no published stats — is therefore never encoded. Neither `SharedSet.tsx:33-42` (the read-only view) nor `store.ts:522-529` (`adoptPlan`, behind the "Save a copy" button) reconstructs it, so the reader's copy has `withheld === undefined`. `Upgrades.tsx:1479` passes `withheldSlots: gearSet.withheld` into `computeUpgrades`, so an undefined map makes those positions read as empty.

**Evidence the author ran.** Harness: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-7/web/src/share/audit-withheld.test.ts (mirrors the setup of the shipped src/screens/upgrades-avenrae.test.ts: real `/outputfile inventory` export research/validation/tier0-inventory-Avenrae.txt + the shipped 3,663-item payload).

$ cd web && npx vitest run src/share/audit-withheld.test.ts --reporter=verbose --silent=false

withheld positions in the real import: {"HEAD":"Shadow Rage Helm"}
plan.set keys: [ 'name', 'slots', 'weights' ]
payload length: 300
reopened.withheld: undefined
BEFORE { "ranked": 10, "withheld": ["HEAD:worn-unstatted:Shadow Rage Helm", "SECONDARY:offhand-occupied:"], "nothing": [], "settled": 11 }
AFTER  { "ranked": 11, "withheld": ["SECONDARY:offhand-occupied:"], "nothing": [], "settled": 11 }
position HEAD: before ranked=no; after ranked=23.5 EP -> Indicolite Helm
  before in "not comparable": worn-unstatted; after: no

The codec itself is not at fault: a separate sweep (src/share/audit-roundtrip.test.ts) shows 0 mismatches over 500 dictionary-interned fuzz plans, 0 over 300 literal plans, and all 3,663 shipped catalogue names surviving a one-item round trip exactly. The loss is the field that is not in `SharedPlan`.

**Player impact.** The author's ranked-upgrades screen lists Head under "Not compared — Unsourced · stats withheld", naming the Shadow Rage Helm they are wearing. The person they send the link to, after pressing the page's one action ("Save a copy") and opening Upgrades, is told Head is the #6 upgrade worth +23.5 EP from an Indicolite Helm. That number is the whole item scored against zero, which is precisely the fabricated comparison the `withheld` field's own doc comment (engine/types.ts:220-231) says it exists to prevent.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **WIDER**.

*Corrected scope.* Two corrections, one narrowing and one widening. The widening one is the important one.

NARROWER on the item side. The finding says "any export item absent from the catalogue entirely also lands there [in `withheld`]". That is false. `withheldMap` (web/src/lib/inventoryImport.ts:856-863) reads only `result.unstatted`, and the only branch that pushes a `kind:'item'` entry into `unstatted` is the `statsAreUnknown(match.item)` guard at inventoryImport.ts:550-566 — which is reached ONLY after `resolve(name, exportId, catalog)` returns a match. An export name the catalogue does not carry takes the `if (!match)` branch four lines earlier (inventoryImport.ts:524-540) and goes to `out.unmatched`, which `withheldMap` never reads. Measured on the real export: `unstatted entries: ["item:HEAD:Shadow Rage Helm"]`, `unmatched entries: 0`.

The measured trigger surface is therefore exactly: a worn row naming a catalogue record with `statsUnknown === true`. Against the shipped payload (3,663 records, computed in src/state/audit-scope.test.ts): 16 records carry `statsUnknown`; 6 of the 16 carry any slot code at all — Shadow Rage Boots/Gloves/Helm/Leggings/Sleeves/Wristguard — reaching 7 of the 23 paper-doll positions (ARMS, FEET, HANDS, HEAD, LEGS, WRIST_1, WRIST_2). The other 10 (Backpack*, Lightweight Bag, Velium Gemmed Rune, Crushbone Battle Plans, Essence of Wind, Griffon Wing Spaulders, Heretic Insurrection Orders, Sarialiyn's Lute, Deterioriated Ancient Faydark Longbow, Complex Velium Gemmed Rune) have `sl: []`, so no worn row would place them. The finding's headline count (1 of 23 positions on the one real export) is correct.

WIDER on the code side, and this is the correction that matters. The finding asserts "`withheld` has exactly two writers (SetEditor.tsx:191, CharacterDetail.tsx:190) and one reader (Upgrades.tsx:1479), so nothing outside the importer path is affected." That misses a third site that DROPS the field: `sanitizeSet` in web/src/state/persistence.ts:227-265 builds its `GearSet` literal field by field and never copies `withheld` (it does copy `notes` at :258 and `defaultFilters` at :262). `sanitizeSet` sits on two paths the finding does not mention:

  - `store.ts:205` — `hydrate()` calls `loadState()` -> `sanitizeState` -> `sanitizeSet`. This runs on every page load.
  - `store.ts:499` — `importEnvelope()` calls `sanitizeState`, so the JSON export/re-import round trip loses it too.

Measured through the store's own `persist()`/`hydrate()` against jsdom localStorage (src/state/audit-reload.test.ts):
  in-session withheld: {"HEAD":"Shadow Rage Helm"}
  written to localStorage: {"HEAD":"Shadow Rage Helm"}     <- saveState stringifies verbatim, so it IS on disk
  after hydrate(), withheld: undefined                      <- sanitizeSet strips it on read back
  slots still intact: 21 positions

So `GearSet.withheld` is effectively a memory-only field that survives only until the tab reloads. The corrected scope of the underlying defect is: every set the importer produced, on the author's own next page load — not only sets that were shared. The share link is one of three lossy channels (share link, JSON export/import, page reload), and it is not the widest.

A consequence worth stating precisely, because it cuts the other way for this particular finding: the share-link-SPECIFIC differential (author sees "not comparable", reader sees a ranked number) exists only for a link made in the same page session as the import. After one reload the author's own screen already shows the fabricated ranking, so the reader is merely seeing what the author sees. The reader is harmed in every case; the author/reader divergence the finding describes is confined to that pre-reload window.

*Refuter reasoning.* MECHANISM — CONFIRMED, with a different instrument. The quoted evidence was a codec-level test in src/share/. I wrote a store-level test that walks the whole journey through the shipped code: real `/outputfile inventory` export -> `readInventory` -> `applySlots(setId, toSlotMap, true, withheldMap)` (the exact call CharacterDetail.tsx:190 and SetEditor.tsx:191 make) -> `planFrom` -> `encodePlan` -> `decodePlan` -> `adoptPlan` (the real store action behind the "Save a copy" button, store.ts:502-538) -> `computeUpgrades` on both sets. Output:

  AUTHOR withheld: {"HEAD":"Shadow Rage Helm"}
  READER withheld: undefined
  AUTHOR screen: {"ranked":10,"notComparable":["HEAD:worn-unstatted","SECONDARY:offhand-occupied"],"settled":11}
  READER screen: {"ranked":11,"notComparable":["SECONDARY:offhand-occupied"],"settled":11}
  position HEAD (wearing "Shadow Rage Helm"): author -> not comparable / worn-unstatted; reader -> RANKED #6 +23.5 EP -> Indicolite Helm

Identical to the reported figures, arrived at through the store rather than the codec. Reading the source confirms each link: `SharedPlan.set` is `Pick<GearSet,'name'|'slots'|'weights'|'notes'>` (codec.ts:63); `planFrom` copies name/slots/weights and conditionally notes (codec.ts:651-658); `adoptPlan` builds its `GearSet` literal with id/characterId/name/slots/weights/createdAt/updatedAt and conditionally notes, and never touches `withheld` (store.ts:521-531); `SharedSet.tsx:32-42` builds the read-only `GearSet` the same way; `Upgrades.tsx:1479` passes `withheldSlots: gearSet.withheld`, and `Upgrades.tsx:470` reads `options.withheldSlots?.[position.id]`, so `undefined` makes the position read as empty.

One qualification on the reported IMPACT, which I checked and which holds: the read-only shared view cannot itself show the fabricated number — `SetWorkspace` renders only the gear/exaltations/weights tabs (SetWorkspace.tsx:177-216), no upgrades panel. The reader must press "Save a copy" (SharedSet.tsx:97) and open Upgrades, exactly as the finding states.

I also checked my own instrument where it disagreed with expectation. It first printed `slots identical: false`, which would have been a second finding; a per-position diff showed the only difference is JSON key order inside one `exaltations` object (ANY_2: author `{focus, click}`, reader `{click, focus}`) — no data difference. And my first reload test printed "written to localStorage: undefined" because `persist()` is debounced 200ms (store.ts:143-157); calling the store's own `flushPersist()` fixed the instrument, not the code. Both are instrument artefacts, reported here so neither is mistaken for a defect.

SEVERITY — AGREE, "serious". The output is not a missing warning; it is a specific fabricated recommendation with a number attached ("#6, +23.5 EP, Indicolite Helm") on the product's flagship screen, produced by scoring a candidate against zero — precisely what the `withheld` doc comment (engine/types.ts:217-231) says the field exists to prevent, and what upgrades-avenrae.test.ts:269 pins for the author. It is not higher than serious because it is confined to positions holding one of 6 catalogue items and does not corrupt stored data or any other screen. It is not lower because the number is plausible, actionable, and indistinguishable from a real one.

SCOPE — WIDER, see corrected_scope. The finding's claim that catalogue-absent items also populate `withheld` is wrong (narrower there), but its claim that "nothing outside the importer path is affected" misses `sanitizeSet`, which strips the field on every page load, so the same fabricated ranking reaches the author's own screen without any share link at all.

### 25. GearSet.withheld is also dropped on every page reload, because sanitizeSet does not copy it

`web/src/state/persistence.ts:249` — severity claimed **serious**, scope claimed **Same population as the finding above — sets built by the inventory importer that contain an unscoreable item — but triggered by any page reload rather than only by sharing, and it hits the author's own screen rather than only the reader's. The JSON export/import path (lib/setExport.ts) loses it too, for the same reason: it round-trips through `sanitizeSet`.**

**Mechanism.** `sanitizeSet` rebuilds a `GearSet` field by field (persistence.ts:249-265) and copies id, characterId, name, slots, weights, createdAt, updatedAt, notes and defaultFilters. It never copies `withheld`. `saveState` writes the whole set object to localStorage, so the field IS persisted, but `loadState` -> `sanitizeState` -> `sanitizeSet` discards it on read. `grep -n withheld src/state/persistence.ts src/lib/setExport.ts` returns nothing.

**Evidence the author ran.** Harness: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-7/web/src/share/audit-persist.test.ts — feeds a set carrying both `withheld` and `defaultFilters` through `sanitizeState`, which is exactly what `loadState` calls on the parsed localStorage blob.

$ cd web && npx vitest run src/share/audit-persist.test.ts --reporter=verbose --silent=false

keys after a save/load cycle: [ 'characterId', 'createdAt', 'defaultFilters', 'id', 'name', 'slots', 'updatedAt', 'weights' ]
withheld survived: undefined
defaultFilters survived: {"era":"any","source":"quest","hideNoDrop":true}
slots survived: {"CHEST":{"itemName":"Lambent Breastplate","upgrade":{"full":3,"fraction":1}}}

$ cd web && grep -n withheld src/state/persistence.ts src/lib/setExport.ts
(no output; exit 1)

**Player impact.** The same phantom recommendation as above (HEAD, Indicolite Helm, +23.5 EP against an unmeasured Shadow Rage Helm) appears on the importer's own machine the first time they reload the tab. It also means the share-link loss above is partly shadowed: a link made after a reload has nothing left to drop. Both need the same fix, and fixing only the codec would leave the field dying on reload anyway.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **AGREE**.

*Corrected scope.* Scope as stated is right; here are the measured numbers it lacked, plus two refinements.

GATING ITEM SET — measured against the shipped payload. `withheld` is populated only from `InventoryImport.unstatted`, which is populated only where `statsAreUnknown(match.item)` is true (inventoryImport.ts:550). 16 of the 3,663 rows in web/public/data/items-index.json carry `statsUnknown:true` (0.44%): Backpack*, Complex Velium Gemmed Rune, Crushbone Battle Plans, Deterioriated Ancient Faydark Longbow, Essence of Wind, Griffon Wing Spaulders, Heretic Insurrection Orders, Lightweight Bag, Sarialiyn's Lute, Velium Gemmed Rune, and the six-piece Shadow Rage set (ARMS/FEET/HANDS/HEAD/LEGS/WRIST).

Only the 6 Shadow Rage pieces carry a slot list, but the gating set is all 16, not 6: the importer applies no slot check before recording an unstatted worn row, so any of the 16 named in any worn Location produces a withheld entry. Measured by feeding each of the 16 through `readInventory` at Head/Primary/Range/Chest/Ear/Any Slot — all 16 x 6 probes yielded a non-empty `withheldMap`.

REAL POPULATION — the repo ships exactly one real inventory capture (research/validation/tier0-inventory-Avenrae.txt, the only file of its kind in research/validation/). It withholds 1 of 23 worn positions: `{"HEAD":"Shadow Rage Helm"}`. That same player has four more Shadow Rage pieces in Bank15 (lines 734/740/746/752), each of which would add another withheld position if worn — so this one capture is 1 affected position today, up to 6 after a gear swap. Popularity of the Shadow Rage set across the real playerbase is not measurable from here.

TRIGGER — "any page reload" is right and is if anything understated. `store.hydrate()` calls `loadState()` (store.ts:205), so every fresh tab strips it. It is also not merely a display loss: `schedulePersist` writes `get().sets` back (store.ts:146-157), so the next edit after a reload rewrites the reduced shape to localStorage. Measured: pass-1 storage text contains `"withheld"` = true; after loadState -> saveState, pass-2 text = false. The field is destroyed, not just hidden.

REFINEMENT ON THE EXPORT PATH — the claim "the JSON export/import path loses it too" holds for the round trip, but the loss is one-sided. `buildSetEnvelope` does NOT strip the field: the emitted file text contains `"withheld"` (measured true). Only `readEnvelope` -> `sanitizeState` -> `sanitizeSet` drops it. So an already-exported file still carries the data and a fixed reader would recover it; only localStorage loses it irretrievably.

WRITERS — `withheld` has exactly one writer, `applySlots` (store.ts:470-489), called only from CharacterDetail.tsx:190 and SetEditor.tsx:191, both with `withheldMap(result)` from an inventory import. Confirmed by grepping web/src for `applySlots` excluding *.test.*. Nothing else can create the field, so "sets built by the inventory importer" is exact.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with a different instrument than the one quoted. The prior lens called `sanitizeState` directly; I went through the real reload path (`saveState` -> `loadState` with `memoryStorage`), the real per-set export path (`buildSetEnvelope` -> `readEnvelope`), and then ran `computeUpgrades` on both sides to see the player-visible consequence.

Read confirmation first: `sanitizeSet` (web/src/state/persistence.ts:229-266) builds the returned `GearSet` field by field — id, characterId, name, slots, weights, createdAt, updatedAt, then conditionally notes and defaultFilters. `withheld` is never read from `raw` and never written to `set`. (It also never copies `loadoutId`, a declared optional field of `GearSet` at engine/types.ts:212 — separate issue, not part of this finding.) `loadState` ends at `sanitizeState(parsed)` (persistence.ts:322), and `sanitizeState` maps every set through `sanitizeSet`.

Measured, on the real Avenrae capture against the shipped 3,663-item catalog:
- withheldMap from the real inventory: {"HEAD":"Shadow Rage Helm"}
- withheld present in the localStorage TEXT: true  (so saveState does persist it)
- load status: ok; withheld after reload: undefined
- keys after reload: characterId,createdAt,id,name,slots,updatedAt,weights
- withheld present in the EXPORT FILE text: true; withheld after readEnvelope: undefined; envelope error: undefined, rejected: []

Player-visible consequence, both sides run through `computeUpgrades` exactly as Upgrades.tsx:1479 does (`withheldSlots: gearSet.withheld`):
- before reload: HEAD -> ranked row = none; withheld-list entry = yes; rows=10 withheld=2
- after reload:  HEAD -> ranked row = Indicolite Helm +23.5 EP (worn: undefined); withheld-list entry = no; rows=11 withheld=1

That is the same item and the same +23.5 EP the prior lens reported, arrived at independently. HEAD moves out of the honest "cannot be scored" list and into the ranked list as a full-item gain measured against nothing.

SEVERITY — AGREE with "serious". This is precisely the defect class the code's own comment at Upgrades.tsx:202-209 says `withheld` exists to prevent ("Head was offered a Hammerhead Helm at '+20.0 EP' as though the position were bare"), and the fix is defeated by the first reload. Two things push it up: the player is given an actionable farming target on a false number on the flagship surface, and the loss is permanent — the next edit after a reload writes the stripped set back to storage (pass-2 text has withheld: false), so it cannot be recovered without re-importing. One thing holds it back from higher: it is gated behind the importer path plus one of 16 catalog rows out of 3,663, it corrupts only the affected positions (the other 10-11 ranked rows in the Avenrae run are unchanged), and the ranking itself is not wrong for any slot the player actually has measured gear in. "Serious" rather than "critical" is the right call.

SCOPE — AGREE with the population as described; the numbers are in corrected_scope. Two refinements worth carrying: the gating item set is 16 items rather than the 6 with armor slots, because the importer performs no slot-compatibility check before recording an unstatted worn row; and on the export path the loss is read-side only — the emitted JSON file does carry `withheld`, so an existing export is recoverable by a fixed reader while localStorage is not.

CAVEATS ON MY OWN INSTRUMENT — the worktree had no web/node_modules, so I symlinked /home/user/EQL50ups/web/node_modules (read-only use; no install run, main tree untouched). Both my test files skip when the payload is absent; they ran (not skipped), 6 tests passed. The catalog loader and CatalogState stub are copied from the repo's own src/screens/upgrades-avenrae.test.ts so the ranking runs against the same merged index+shard catalog the screen uses.

### 26. Share links drop GearSet.defaultFilters, so the reader's ranking is computed over a different candidate pool than the author's

`web/src/share/codec.ts:654` — severity claimed **serious**, scope claimed **Any share link whose set carries a non-default filter choice. `store.ts:316` stores the field only when the choice is non-default, so untouched sets are unaffected. Measured on one configured set: 6 of 6 of the author's ranked positions get a different top recommendation for the reader, and the reader gets 11 ranked positions where the author had 6. The same field survives the JSON export/import path (see the persistence measurement above), so the two sharing routes disagree about what a set is.**

**Mechanism.** `planFrom` builds the shared set as `{ name, slots, weights }` plus optional notes (codec.ts:651-658). `defaultFilters` — the per-set era / source / hide-NO-DROP lens set in SetConfigDialog and stored by `store.ts:317` and `store.ts:335-336` — is not carried. `adoptPlan` (store.ts:522-529) does not restore it. `Upgrades.tsx:1445` reads `filtersFor(gearSet)`, which falls back to `DEFAULT_SET_FILTERS` when the field is absent (lib/setFilters.ts:97-99), so the reader ranks against every candidate in the catalogue while the author ranked against a filtered subset.

**Evidence the author ran.** Harness: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-7/web/src/share/audit-filters.test.ts — same real export and shipped catalogue, set configured with `{era:'any', source:'quest', hideNoDrop:true}` (all three values are reachable from the SetConfigDialog controls at SetConfigDialog.tsx:347/361/376).

$ cd web && npx vitest run src/share/audit-filters.test.ts --reporter=verbose --silent=false

authored filters: {"era":"any","source":"quest","hideNoDrop":true}
reopened filters: {"era":"any","source":"any","hideNoDrop":false}
AUTHOR sees ranked rows: 6
["NECK=Black Sapphire Platinum Necklace (32.8)", "FINGERS_2=Adamantite Band (19.2)", "HEAD=Lambent Helm (16.1)", "BACK=White Dragonscale Cloak (8.4)", "PRIMARY=Blued Two-Handed Hammer (6.9)", "ANY_1=White Dragonscale Cloak (6.5)"]
RECIPIENT sees ranked rows: 11
["PRIMARY=Dagas (76.3)", "FINGERS_2=Engineer's Ring (71.0)", "NECK=Qeynos Badge of Honor (42.8)", "ANY_1=Cloak of Scales (31.5)", "BACK=Brewer's Mesh Cloak (26.0)", "HEAD=Indicolite Helm (23.5)", "SHOULDERS=Pauldrons of the Blue Sky (13.5)", "FEET=Leatherfoot Sandals (11.5)"]
positions whose top recommendation differs: 6 of 6

**Player impact.** A player who narrowed a set to quest rewards and hid NO-DROP items — because that is what they can actually go and get — sends the link, and the recipient is shown a completely different list headed by items the author deliberately filtered out (a NO-DROP `Dagas` at +76.3 EP against the author's top row of +32.8). Neither screen says a filter was applied or lost, so the two people are looking at incompatible plans with no sign of it.

**Verdict** — mechanism **CONFIRMED**, severity **AGREE**, scope **AGREE**.

*Corrected scope.* The prior lens measured one filter combination on one set. I measured the entire reachable option space of SetConfigDialog against the shipped payload and the real Avenrae inventory.

The dialog's option space is exactly 8 era values (`'any'` + `ERA_ORDER`, 7 entries, web/src/engine/constants.ts:282) x 5 sources (`SOURCE_FILTERS`) x 2 `hideNoDrop` = 80, of which 1 is the default. So there are 79 distinct non-default choices a set can carry, and `store.ts:316/335` stores the field for all 79 and for none other — the prior lens's "untouched sets are unaffected" is correct.

Measured on the Avenrae set (11 ranked positions unfiltered), comparing the author's ranking against the reader's over the UNION of positions:
  combosTested: 79
  combosWhereReaderSeesADifferentTopPick: 79
  combosIdenticalToUnfiltered: 0
  combosThatRankNothingForAuthor: 42
  combosNonEmptyForAuthorAndStillDiffering: 37
  baselineRows: 11
  maxRowsLostByFiltering: 11

So: every one of the 79 non-default choices produces a reader view that differs from the author's, and 37 of them do so while still leaving the author a non-empty ranking (the other 42 empty the author's screen entirely — an author is unlikely to share those, but the divergence is maximal there too: 0 rows vs 11).

Why the filters bite this hard, from the same shipped payload (3663 items):
  source=drop 1995/3663, source=quest 1508/3663, source=vendor 189/3663, source=crafted 901/3663
  era=Classic 2907, Sky 382, Temple 101, Kunark 32, Fear 27, Paineel 22, Hate 5
  hideNoDrop leaves 2738/3663

One correction to the prior lens's counting method, which I hit in my own first run: comparing only over the author's positions scores an author-empty ranking as "identical". Counted that way I got 42 "identical" combos, which is an artifact. Over the union it is 0. I report the union number.

Two corrections to the finding's IMPACT prose, one in each direction:

(a) UNDERSTATED. "Neither screen says a filter was applied or lost" is wrong, and wrong in the finding's favour. Upgrades.tsx:1569 computes `describeActiveFilters(filters)` and Upgrades.tsx:1831 renders it: the author's footer reads "This set's filters apply: Quest only, No Drop hidden." and the reader's reads, verbatim, "This set applies no filters." The reader's screen does not merely omit the disclosure — it makes a positive, confident, false statement about the author's plan. That is the exact failure shape CLAUDE.md §7 names.

(b) MITIGATING. The divergence is not visible on the shared screen itself. `SET_TABS = ['gear', 'exaltations', 'weights']` (router.ts:51) — there is no Upgrades tab, and SharedSet.tsx renders only `SetWorkspace`, so a reader who opens the link and does not press "Save a copy" never sees a ranking at all. The wrong ranking appears one step later, after `adoptPlan` and a navigation to the Upgrades screen. Since "Save a copy to edit it in your own library" is the notice's own advertised action and Upgrades is the app's headline surface, this delays the harm rather than preventing it.

Also confirmed the finding's sub-claim that the two sharing routes disagree: `buildSetEnvelope` (setExport.ts:105-113) spreads the whole `GearSet`, and `sanitizeSet` (persistence.ts:261-263) restores `defaultFilters`, so the JSON export/import path round-trips `{era:'Sky', source:'drop', hideNoDrop:true}` intact while the link drops it.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with a different instrument than the one quoted.

The prior lens's harness exercised `planFrom` and inferred the rest. I ran the full link: `planFrom` -> `encodePlan` -> `decodePlan` -> the real `useApp.getState().adoptPlan`, then ranked both sides with `computeUpgrades` against the shipped payload and the real Avenrae inventory export. New harness: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-28/web/src/share/audit28.test.ts

Reading the code first, the claim is exactly what is there:
- codec.ts:651-658 `planFrom` builds `{ character, set: { name, slots, weights } }` plus `notes` only. There is no `defaultFilters` in the shared shape at all — it is not encoded, so nothing downstream could restore it.
- store.ts:502-538 `adoptPlan` constructs the new `GearSet` field by field and carries `notes` (line 528) but not `defaultFilters`.
- SharedSet.tsx:31-42 builds the read-only `gearSet` the same way, also carrying `notes` and not `defaultFilters`.
- setFilters.ts:97-99 `filtersFor` returns `DEFAULT_SET_FILTERS` for an absent field, and Upgrades.tsx:1445 reads exactly that, feeding it to the `narrow` predicate at Upgrades.tsx:417-419.

Reproduced (single run, output below in commands_run):
  decoded set has no `defaultFilters`; `filtersFor(adopted)` === DEFAULT_SET_FILTERS
  weights and all slot entries DO survive, so this is a per-field loss, not a broken link
  author rows 6, reader rows 11, differing top picks 6 of 6
  author top 3: NECK=Black Sapphire Platinum Necklace, FINGERS_2=Adamantite Band, HEAD=Lambent Helm
  reader top 3: PRIMARY=Dagas, FINGERS_2=Engineer's Ring, NECK=Qeynos Badge of Honor

Those numbers land on the prior lens's numbers exactly (6/11/6 and the same head items), which is reassuring rather than circular: I got them from the encode/decode/store path, not from `planFrom` alone.

Instrument check per house rules: my own first scope pass reported "42 combos identical to unfiltered", which was my bug, not a fact about the code — I was iterating over the author's positions only, so an author whose filters ranked nothing scored as agreeing with the reader. Recounted over the union of positions the number is 0. I report the corrected figure and flag the trap because the same trap sits in the prior lens's "6 of 6" phrasing.

SEVERITY — AGREE with "serious", on balance, and I want the two halves stated separately because they pull opposite ways.

Arguing it up: the reader's Upgrades footer does not go quiet, it asserts "This set applies no filters." (Upgrades.tsx:1831). A player who narrowed to quest rewards and hid NO-DROP because that is what a fresh alt can actually obtain sends a link, and the recipient gets a ranking headed by a NO-DROP `Dagas` under a sentence that positively tells them no filter is in play. Silence would be a disclosure gap; this is a false statement generated from the missing field. It also breaks the invariant setFilters.ts:160-168 was written to establish — one predicate, every surface honouring the set's own rules — one route further out than the Auto-fill fix that comment describes.

Arguing it down: nothing the reader is shown about the gear itself is wrong. Slots, tiers, weights and every EP number round-trip correctly; only the derived candidate ranking differs. And the wrong ranking is not on the shared screen — SET_TABS has no Upgrades tab, so it takes a "Save a copy" click plus a navigation to reach it. Someone who only reads the link never sees it.

That is a real correctness fault on the app's headline surface with an affirmative false disclosure attached, gated behind one expected click, and recoverable in seconds once noticed (the reader can set the filters by hand — if they knew to). "Serious" rather than "critical" is where I would put it too. Not too high, not too low.

SCOPE — AGREE, with the measurement sharpened; see corrected_scope. The qualitative claim ("any share link whose set carries a non-default filter choice") is right and I confirmed the `isDefaultFilters` gate at store.ts:316/335 that makes untouched sets safe. What I could not measure, and neither could the prior lens: how many real players actually set filters. Sets live only in the reader's browser (CLAUDE.md §1: no account, no server) and there is no telemetry in this repo, so the population frequency is not knowable from here. What is measurable is that when it happens, it diverges every time — 79 of 79 reachable choices.

### 27. A good share link opened while the item catalog failed to load says the link was made against a different catalog build and to ask for a fresh one

`web/src/screens/SharedSet.tsx:71` — severity claimed **minor**, scope claimed **Every share link opened on a page load where `items-index.json` fetch throws (`status: 'error'`, catalog.ts:363-369) or returns an empty list (`status: 'missing'`, catalog.ts:327-336). Applies to all dictionary-interned links, which is every link the app writes when the catalog is available — the 23-item Avenrae link measured 251-300 characters interned. Links made with literal names are unaffected. I could not measure how often that fetch fails in the wild from here; the condition is a failed static-asset fetch, not something the app can be driven into by input.**

**Mechanism.** `shareDictionary` returns `undefined` when `catalog.indexNames` is empty (data/shareDictionary.ts:17-18). `decodeV2` then sets `available = undefined` for a dictionary-interned payload, every `readItemRef` returns null, `unresolved > 0`, and the decode fails with `catalog-mismatch` (codec.ts:344-348, 418). `SharedSet` only shows its loading state while `catalog.status` is `idle` or `loading` (SharedSet.tsx:47); for `error` and `missing` it falls through to the failure branch, whose `catalog-mismatch` string is the only thing it can print (SharedSet.tsx:71-72). Nothing distinguishes "the link is stale" from "the catalog never arrived".

**Evidence the author ran.** Harness: /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-7/web/src/share/audit-sharedset.test.tsx — renders the real `SharedSet` component with a freshly-encoded link against the shipped catalogue, then puts `useCatalog` into `error` and `missing`.

$ cd web && npx vitest run src/share/audit-sharedset.test.tsx --reporter=verbose --silent=false

--- status=error ---
That link could not be readThis link was made against a different build of the item catalog, so its item references no longer line up. Ask for a fresh link.Go to the planner
--- status=missing ---
That link could not be readThis link was made against a different build of the item catalog, so its item references no longer line up. Ask for a fresh link.Go to the planner

Corroborated at the codec level in src/share/audit-corrupt.test.ts:
  shareDictionary with no catalog: undefined
  decode of a good link with no catalog -> catalog-mismatch plan: null

**Player impact.** The reader is told, in the app's own confident voice, that the sender's link is stale and to ask for a new one. The sender makes a new link and it fails identically, because the problem is on the reader's side and is transient. The one thing that would have helped — "the item catalog did not load; reload the page" — is never offered, and the app already knows it (`catalog.status === 'error'` is in scope three lines above the message).

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

### 28. Race unset skips the race gate entirely, so "Usable by this loadout" prints over items the character's race cannot wear

`web/src/engine/character.ts:234` — severity claimed **serious**, scope claimed **Measured with `npx vitest run src/lib/AUDIT-scope.test.ts --disable-console-intercept` over all 3,663 shipped records in web/public/data/items-index.json. 164 items carry a race restriction that is not `NONE`. Count of items whose race gate is skipped purely because race is unset, by the race that would have failed it: `HUM: 105 \| BAR: 19 \| ERU: 105 \| ELF: 110 \| HIE: 105 \| DEF: 105 \| HEF: 105 \| DWF: 105 \| TRL: 18 \| OGR: 19 \| HFL: 105 \| GNM: 105 \| IKS: 121 \| KER: 105 \| FRG: 105` Worst trio/race sampled across five trios x 15 races: `{"combo":"WAR/CLR/SHM","race":"IKS","n":111}` — 111 items read 'usable' with race unset and 'blocked' the moment IKS is set. Separately measured: of the 85 positive-race-list items a WAR/BRD/BER trio is told it can wear with race unset, 85 of 85 flip to blocked at race=HUM.**

**Mechanism.** `canUseRace` returns `true` whenever `ctx.race` is null (`if (!ctx.race) return true;`), so the race gate is not *deferred* — it is *passed*. `usabilityOf` (web/src/lib/itemStyle.ts:32) therefore returns 'usable' rather than the 'unjudged' state it already has a word for, `usabilityNote` (itemStyle.ts:50) prints "Usable by this loadout", `itemNameColor` tints the name `--item-usable`, and ItemWindow renders the item's real race list in the Requirements block with NO `iwin-bad` class — so one panel shows "Race BAR TRL OGR" in normal colour directly above the verdict "Usable by this loadout". Race is optional at character creation (web/src/screens/NewCharacter.tsx:32 `useState('')`, option value "Unset"), so this is the default state.

**Evidence the author ran.** Repro: `ln -s /home/user/EQL50ups/web/node_modules <worktree>/web/node_modules; cd web && npx vitest run src/components/AUDIT-render.test.tsx --disable-console-intercept` (test file added at web/src/components/AUDIT-render.test.tsx; loads public/data/items-index.json through the app's own `normalizeCatalog` and renders the real `ItemWindow`).

Output, Crushbone Belt (`cl: WAR ROG SHD SHM`, `ra: BAR TRL OGR`) against `makeContext(['WAR','ROG','SHM'], null, {50,50,50})`:
```
item {"n":"Crushbone Belt","cl":["WAR","ROG","SHD","SHM"],"ra":["BAR","TRL","OGR"]}
--- rendered requirements + verdict ---
ClassWarrior Rogue Shadow Knight ShamanRaceBAR TRL OGRWeight1.3
VERDICT: Usable by this loadout
race span classes: [ 'Warrior Rogue Shadow Knight Shaman|', 'BAR TRL OGR|', '1.3|iwin-gold' ]
```
The race span's className is empty — `iwin-bad` is not applied.

**Player impact.** 12 of the 15 playable races have no item in the catalog restricted to them, so a player of any of those races has no reason to set the field — and the creation screen tells them "Leaving it unset does not narrow anything." They then get ~105 items they can never equip ranked into their slot pickers (web/src/selectors/gear.ts:384 filters candidates with the same `canUse`), painted green, labelled "Usable by this loadout", equippable, and summed into the set totals (`totalsFor` excludes only entries `usabilityOf` calls 'blocked'). The app has an 'unjudged' state for exactly this situation and does not use it for an unjudgeable gate.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-HIGH**, scope **AGREE**.

*Corrected scope.* Payload-level counts reproduced exactly (all via `node web/audit/scope.cjs`, using the app's own `normalizeCatalog`, over all 3,663 records of web/public/data/items-index.json):

{"total":3663,"all":3415,"empty":0,"none":84,"restrictedNotNone":164,"positive":105,"allExcept":59}

Per-race count of items whose race gate `canUseRace` skips purely because race is unset — identical to the reported figures, digit for digit:
HUM 105 | BAR 19 | ERU 105 | ELF 110 | HIE 105 | DEF 105 | HEF 105 | DWF 105 | TRL 18 | OGR 19 | HFL 105 | GNM 105 | IKS 121 | KER 105 | FRG 105

Player-facing flip (`usabilityOf` 'usable' with race unset -> 'blocked' with race set), 8 trios x 15 races = 120 pairs: min 0, median 83, max 111; only 1 pair flips nothing. Worst = {"trio":"WAR/CLR/SHM","race":"IKS","flipped":111} — the reported figure exactly. "85 of 85 positive-race-list items a WAR/BRD/BER trio is told it can wear flip to blocked at HUM" also reproduced exactly (at IKS it is 50 of 85, at ELF 83 of 85).

ADDED — scope measured in the real browser rather than in the engine (`e2e/AUDIT-race.spec.ts`, CLR/DRU/SHM, all 23 slot pickers opened, count read from the picker's own "N matches" line):
  race unset: 4,457 candidate entries offered across 23 pickers
  race HUM  : 4,141
  delta     : 316 entries; the two "Any Slot" pickers each carry 101 distinct extra items.

ADDED — decision-point scope, which the original did not measure: 4 of 414 (6 trios x 3 races x 23 slots) rank-1 =Upgrades recommendations change when race is set, at default weights (`e2e/AUDIT-rank1.spec.ts`).

TWO CORRECTIONS to the report's IMPACT prose (mechanism unaffected):

1. "12 of the 15 playable races have no item in the catalog restricted to them" is WRONG. Measured over the normalized catalog: only 5 race codes appear in any race list — BAR ELF IKS OGR TRL — and the same 5 are the only ones with a positive-list item. **10 of 15**, not 12, are never mentioned: HUM ERU HIE DEF HEF DWF HFL GNM KER FRG. (This also matches constants.ts's own comment and HANDOFF.md:4262-4263.)

2. "painted green ... into their slot pickers" is REFUTED at the picker surface. `web/src/styles.css:932-935` re-points `--item-usable: var(--text-strong)` inside `.doll, .results, .exalt-rows`. Browser-measured `getComputedStyle` on the `.iname` of Large Banded Belt in the WAIST picker: **rgb(242, 234, 218)** — not the green rgb(143, 174, 130). Green is real on the ItemWindow verdict (measured, above) and on `#/items` / ExaltationsTab, which are outside those three scopes; it is not real in the slot picker or on the paper doll.

*Refuter reasoning.* MECHANISM — CONFIRMED, reproduced with two instruments neither of which is the one quoted.

Source, read not grepped: `web/src/engine/character.ts:229-235` is
```
if (isUnrestricted(item.races)) return true;
if (item.races.includes('NONE')) return false;
if (!ctx.race) return true; // race unset: don't narrow on it
return matchesList(item.races, [ctx.race]);
```
`canUse` (character.ts:329) ANDs class+race+level, so the race gate is passed, not deferred. `usabilityOf` (itemStyle.ts:30-33) returns 'unjudged' ONLY when context is absent or has no classes, so it returns 'usable'.

Instrument 1 — real Chromium, real production bundle, real payload (`e2e/AUDIT-race.spec.ts`, not a jsdom render test). Character CLR/DRU/SHM, race left at the "Unset" default; WAIST picker; searched "Large Banded Belt" (`ra:["BAR","TRL","OGR"]`, `cl` includes CLR). Hover ItemWindow, read via `getComputedStyle`:
```
{"name":"Large Banded Belt","reqs":[
  {"label":"Class","value":"WAR BRD CLR PAL RNG ROG SHD SHM","cls":""},
  {"label":"Race","value":"BAR TRL OGR","cls":""},          <- no iwin-bad
  {"label":"Weight","value":"3.1","cls":"iwin-gold"}],
 "verdict":"Usable by this loadout","verdictColor":"rgb(143, 174, 130)"}
```
`--item-usable` resolved at runtime = rgb(143,174,130). Same trio with race=HUM: the item is not in the WAIST picker at all (0 matches). So the panel prints "Race BAR TRL OGR" in normal colour directly above "Usable by this loadout", in green, in the default state. Every load-bearing element of the reported mechanism holds.

Instrument 2 — the app's own engine compiled to CJS and run under node (`web/audit/entry.ts` + `vite.audit.config.ts` -> `audit/out/engine.cjs`, `audit/scope.cjs`), no test runner:
```
Large Banded Belt ra=["BAR","TRL","OGR"]
  unset: usable  "Usable by this loadout"      var(--item-usable)
  HUM:   blocked "This loadout cannot equip it" var(--item-blocked)
```
Downstream claims verified by reading the lines, not by grep count: `selectors/gear.ts:384` filters candidates with `canUse(...)`; `totalsFor` (gear.ts:260-270) excludes only positions `usabilityOf` calls 'blocked' (gear.ts:242).

SEVERITY — TOO-HIGH. I would call it moderate, not serious. This is a judgement about consequence only; the mechanism is real and worth reporting regardless.

Three measured reasons to come down a notch:

(a) The decision point is barely moved. `e2e/AUDIT-rank1.spec.ts`, real browser, default ("balanced") weights, 6 trios x {unset, HUM, ELF, IKS} x 23 slots: **4 of 414 rank-1 recommendations change when race is set.** All 4 are PAL/RNG/DRU at IKS (Wind Etched Helm/Bracers of Ro, `ra:["ALL_EXCEPT","IKS"]`, plus two cascade shifts). For WAR/CLR/SHM, CLR/DRU/SHM, WAR/BRD/BER, MNK/ROG/BST and SHD/MAG/BRD the 23 top picks are byte-identical unset vs set. The HANDOFF-documented "Rune Etched Boots ranked #1 for a Human cleric" case does NOT reproduce at default weights — it needed the tank profile.

(b) The behaviour is declared, not silent. `NewCharacter.tsx:117-120` tells the player on the same screen as the dropdown: "Race is optional and only used to filter race-restricted items ... Leaving it unset does not narrow anything." `character.ts:234` carries the matching comment. HANDOFF.md:4274 already states the consequence in the project's own words and the fix shipped for it was the 15-race vocabulary (constants.ts `RACES`), i.e. the project ruled that unset means "don't narrow" and remediated by making every race selectable. The remedy is one dropdown on the creation screen.

(c) Two claims in the report's IMPACT prose do not survive measurement (see corrected_scope). Neither touches the mechanism.

Reasons it is not merely "minor": it IS the default state; the verdict is a positive assertion the app cannot support, which is exactly what this repository's §7 rule forbids printing; and `styles.css:920-935` justifies re-pointing `--item-usable` on the doll and pickers with the premise "pickers only ever offer items this loadout can equip", which race-unset makes false for 105-121 items.

SCOPE — AGREE. Every number in the report reproduced exactly through the compiled-engine instrument (see corrected_scope for the additions and the two prose corrections).

### 29. blockReason prints the ALL_EXCEPT sentinel as an inclusion list, producing a sentence that states the opposite of the truth

`web/src/lib/blockReason.ts:37` — severity claimed **serious**, scope claimed **Over the 3,663 shipped records: 255 items carry `ALL_EXCEPT` in `cl` and 59 in `ra` (union 313). Measured for one loadout (WIZ / Iksar): 211 of the 255 class-excluded items and 58 of the 59 race-excluded items are blocked and therefore produce a wrong sentence. Class-list shapes carrying it, top three: `ALL_EXCEPT ENC MAG NEC WIZ` 184, `ALL_EXCEPT CLR DRU MNK PAL SHM` 22, `ALL_EXCEPT ENC MAG MNK NEC WIZ` 12.**

**Mechanism.** `blockReasons` builds its clauses with `item.cl.join(', ')` and `item.ra.join(', ')` without stripping the `ALL_EXCEPT` sentinel that `matchesList` (character.ts:214) uses to invert the list. For an item stored as `cl: ['ALL_EXCEPT','ENC','MAG','NEC','WIZ']` the reason reads "it is restricted to ALL_EXCEPT, ENC, MAG, NEC, WIZ, and this loadout is WIZ" — naming WIZ as an allowed class in the sentence explaining why WIZ is refused. Same for races: "it is restricted to ALL_EXCEPT, TRL, OGR, IKS, and this character is IKS". These strings are shown in SlotCard's `title` and accessible name (SlotCard.tsx:98) and in ItemDetail's "Not offered for your set" hint (ItemDetail.tsx:90).

**Evidence the author ran.** `cd web && npx vitest run src/lib/AUDIT-elig.test.ts --disable-console-intercept` (test at web/src/lib/AUDIT-elig.test.ts), context `makeContext(['WIZ'],'IKS',{WIZ:50})`:
```
ALL_EXCEPT class items blocked for WIZ: 211
 > Barnacle-covered Pauldron | cl= ALL_EXCEPT ENC MAG MNK NEC WIZ | sentence: it is restricted to ALL_EXCEPT, ENC, MAG, MNK, NEC, WIZ, and this loadout is WIZ
 > Bear-hide Jerkin | cl= ALL_EXCEPT ENC MAG NEC WIZ | sentence: it is restricted to ALL_EXCEPT, ENC, MAG, NEC, WIZ, and this loadout is WIZ
ALL_EXCEPT race items blocked for IKS WIZ: 58
 > Black Chitin Leggings | ra= ALL_EXCEPT IKS | sentence: it is restricted to ALL_EXCEPT, IKS, and this character is IKS
```

**Player impact.** The module's own docstring says naming the wrong gate "is how a reader decides the tool is guessing". Here it names the right gate with the list inverted: the caster reading why their Bear-hide Jerkin was refused is told the item is restricted to Wizards. A screen-reader user on the paper doll gets this as the button's accessible name, with no colour to fall back on.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-HIGH**, scope **NARROWER**.

*Corrected scope.* Payload counts confirmed: 3,663 unique items; 255 carry ALL_EXCEPT in `cl`, 59 in `ra`, union 313. The WIZ class figure of 211 is confirmed exactly.

THE ONE WRONG NUMBER: race. The finding says "58 of the 59 race-excluded items are blocked" for an Iksar. Measured: 54. The 59 ra-ALL_EXCEPT items fall into 7 shapes, and only 54 of them name IKS ("ALL_EXCEPT IKS" 44, "ALL_EXCEPT BAR ELF TRL OGR IKS" 6, "ALL_EXCEPT BAR TRL OGR IKS" 3, "ALL_EXCEPT TRL OGR IKS" 1). The remaining 5 ("ALL_EXCEPT BAR TRL OGR" x3, "ALL_EXCEPT TRL OGR" x1, "ALL_EXCEPT BAR ELF" x1) do not exclude Iksar and are therefore not race-blocked for one. 58 looks like a count of items that carry ra-ALL_EXCEPT and are blocked *by any gate* (class included), not by the race gate whose clause is the one that prints.

WIDER in one respect the finding did not state: the defect is unconditional, not probabilistic. Because matchesList blocks an ALL_EXCEPT list only when *every* loadout class appears in it, the printed list necessarily contains the reader's own class whenever the clause prints at all. Measured over all 15 single-class loadouts x 3,663 items: 1,055 ALL_EXCEPT class clauses printed, 1,055 self-naming — 100%, no exceptions. And 255 of 255 ALL_EXCEPT items can print a bad class clause for at least one single-class loadout.

NARROWER in the respect that decides real exposure: it is entirely loadout-shaped, and this is a trio planner. Per single-class loadout the count of items that print a self-contradicting class clause is WAR 1, CLR 34, PAL 30, RNG 0, SHD 1, DRU 40, MNK 41, BRD 15, ROG 15, SHM 33, NEC 211, WIZ 211, MAG 211, ENC 211, BER 1 — 184 of the 255 are the single shape "ALL_EXCEPT ENC MAG NEC WIZ", so the whole thing is overwhelmingly a four-caster phenomenon. For trios it needs every member inside the exclusion list: WIZ/MAG/NEC 211, CLR/DRU/SHM 32, WAR/BRD/BER 0. For races, only 4 of 13 ever see it (IKS 54, TRL 14, OGR 14, BAR 13, ELF 7); the other 9 (HUM, ERU, HIE, DEF, HFL, DWF, HEF, GNM) see 0. So the finding's headline pairing (WIZ + Iksar) is close to the worst case available, not a representative one.

SEPARATE, WIDER, SAME ROOT — not part of this finding but measured in passing: web/src/components/ItemWindow.tsx:274-276 prints `item.cl` with the same raw join, so the item window's Requirements row reads "Class: ALL_EXCEPT Enchanter Magician Necromancer Wizard" (captured verbatim from the rendered ItemDetail DOM). That row renders for every reader on all 255 items regardless of loadout or of whether the item is blocked, i.e. a strictly larger surface than blockReason's 0-211.

*Refuter reasoning.* MECHANISM — CONFIRMED for the core claim, with one named sub-claim REFUTED.

Confirmed: blockReason.ts:34-42 joins `item.cl` and `item.ra` verbatim with no ALL_EXCEPT handling (I read the whole file; the string "ALL_EXCEPT" appears nowhere in it — grep over web/src/**/*.{ts,tsx} returns hits only in engine/character.ts, the test files, and pipeline/*.mjs), while engine/character.ts:213-215 inverts exactly that list. I reproduced the output through the rendered DOM rather than through the library, and the string is real. ItemDetail's visible prose reads: "Not offered for Main Set: it is restricted to ALL_EXCEPT, ENC, MAG, NEC, WIZ, and this loadout is WIZ." SlotCard's blocked marker and item-name tooltips both carry: "Bear-hide Jerkin: this loadout cannot equip it — it is restricted to ALL_EXCEPT, ENC, MAG, NEC, WIZ, and this loadout is WIZ."

REFUTED sub-claim: "These strings are shown in SlotCard's `title` and accessible name (SlotCard.tsx:98)". Title, yes. Accessible name, no. SlotCard.tsx:187-190 builds the button's aria-label from a completely different string, and jsdom returns it as: "Chest: Bear-hide Jerkin. This loadout cannot equip it. Change item." blockedNote reaches only the `title` attribute of two non-focusable inner `<span>`s (lines 145 and 157), which the button's own aria-label overrides for naming purposes. So the IMPACT paragraph's "A screen-reader user on the paper doll gets this as the button's accessible name, with no colour to fall back on" is false: that user gets the vague-but-true "This loadout cannot equip it". The wrong sentence on the paper doll is a mouse-hover tooltip only.

SEVERITY — TOO-HIGH by about one notch; I would call it moderate, not serious.

For: the sentence is not merely imprecise, it asserts the negation, and it does so 100% of the time it appears (1,055/1,055 measured). It leaks an internal sentinel token, "ALL_EXCEPT", into player-facing prose. And it lands on the one module whose own docstring makes naming the gate correctly its entire reason to exist.

Against: nothing computed is wrong. The gating itself is correct — canUseClass/canUseRace read the sentinel properly, no unwearable item becomes equippable, no score or ranking shifts. The defect is confined to the explanatory sentence, and the sentence is redundant with a correct verdict shown alongside it in both surfaces ("This loadout cannot equip it" in the item window and in the aria-label). The finding's strongest severity amplifier — the accessibility one — does not hold, and the second strongest, "the caster reading why their Bear-hide Jerkin was refused", is undercut by the fact that the same reader has already seen "ALL_EXCEPT Enchanter Magician Necromancer Wizard" three lines above in the Requirements row from an entirely different code path. Fixing blockReason alone would leave the identical inversion on screen.

SCOPE — NARROWER, with corrections in both directions; see corrected_scope. The one outright wrong figure is 58 race items, which is 54.

### 30. The item window's Class and Race requirement rows print the raw ALL_EXCEPT token, so an exclusion list reads as an inclusion list

`web/src/components/ItemWindow.tsx:276` — severity claimed **minor**, scope claimed **255 of 3,663 items render an `ALL_EXCEPT` token in the Class row, 59 in the Race row, 313 distinct items in total (counted over web/public/data/items-index.json via web/src/lib/AUDIT-scope.test.ts). It appears in all three surfaces that print the list: the wide dialog panel, the 330px hover card, and the browser's Classes column.**

**Mechanism.** The Requirements block renders `item.cl.map(c => CLASS_NAMES[c] ?? c).join(' ')` and `item.ra.join(' ')`. `CLASS_NAMES` has no `ALL_EXCEPT` key, so the sentinel falls through the `?? c` and is printed verbatim at the head of the list, followed by the excluded classes rendered with their friendly names. The reader sees "Class: ALL_EXCEPT Enchanter Magician Necromancer Wizard" — a token plus what looks like the allowed-class list. The same join appears unstripped in the item browser's "Classes" column (web/src/screens/ItemBrowser.tsx:701).

**Evidence the author ran.** `cd web && npx vitest run src/components/AUDIT-render2.test.tsx --disable-console-intercept` (test at web/src/components/AUDIT-render2.test.tsx), real `ItemWindow` render of Bear-hide Jerkin from the shipped payload:
```
WAR trio Class row: ClassALL_EXCEPT Enchanter Magician Necromancer WizardRaceALLWeight3.5
WAR trio verdict: Usable by this loadout
spans with iwin-bad: 0
hover Class row: ClassALL_EXCEPT ENC MAG NEC WIZRaceALLWeight3.5
ra: ALL_EXCEPT IKS cl: ALL
req row: ClassALLRaceALL_EXCEPT IKSWeight7.5
verdict: This loadout cannot equip it
```

**Player impact.** On the 44 usable-for-this-trio cases the verdict and the list disagree in the reader's eyes ("Class: ALL_EXCEPT … Wizard" + "Usable by this loadout" for a Warrior trio); on the blocked cases the list appears to name the reader's own class as permitted. Nothing on screen defines `ALL_EXCEPT`.

**Verdict** — mechanism **CONFIRMED**, severity **TOO-LOW**, scope **WIDER**.

*Corrected scope.* Item counts stand exactly as reported: 255 items carry ALL_EXCEPT in `cl`, 59 in `ra`, 1 in both, 313 distinct of 3,663 (8.5%) — reproduced with my own node one-liner over web/public/data/items-index.json. Additionally, 0 of the 313 carry a bare sentinel, so every one prints the token followed by at least one name that reads as an allowance.

Two corrections. (a) Surfaces are four, not three: the wide dialog panel, the 330px hover card, ItemBrowser's Classes column, AND the refusal sentence from web/src/lib/blockReason.ts:37, which reaches visible prose in ItemDetail.tsx:120 and the row title + accessible name in SlotCard.tsx:98. On that fourth surface the defect is stronger than a stray token — it reads "it is restricted to ALL_EXCEPT, ENC, MAG, NEC, WIZ, and this loadout is ENC, MAG, WIZ", naming the barred classes as the permitted ones inside a sentence that refuses them. (Note the browser table has no Race column, so the 59 race rows reach three of the four surfaces.)

(b) The impact figure "44 usable-for-this-trio cases" does not reproduce. Through the real engine: for a WAR/CLR/ROG trio all 255 class-ALL_EXCEPT items are usable and print the token next to "Usable by this loadout" (301 of the full 313 when the race rows are included; the 12 blocked are blocked by explicit class lists, not by the sentinel). Same 255 for WAR/BRD/BER. Exposure is class-dependent, heaviest for casters: NEC/WIZ/MAG/ENC are each named as excluded in 211 of the 255, and an ENC/MAG/WIZ trio gets 211 inverted block sentences (a WAR/CLR/ROG Iksar gets 54 from the race side).

*Refuter reasoning.* MECHANISM — CONFIRMED, with a different instrument than the one quoted (server-side `renderToStaticMarkup` in a node-env vitest file reading the shipped `web/public/data/items-index.json` off disk, rather than the previous lens's testing-library render), plus a real `App` mount at `#/items` for the browser column.

Code path, read at web/src/components/ItemWindow.tsx:274-283:
```
{item.cl.includes('ALL') ? 'ALL' : item.cl.map((c) => (wide ? (CLASS_NAMES[c as ClassCode] ?? c) : c)).join(' ') || 'ALL'}
{item.ra.includes('ALL') ? 'ALL' : item.ra.join(' ') || 'ALL'}
```
`CLASS_NAMES` (web/src/engine/constants.ts:17-23) is a `Record<ClassCode, string>` with exactly the 16 class codes and no `ALL_EXCEPT` key, so the sentinel falls through `?? c`. The `includes('ALL')` guard is an exact-string check and does not catch `ALL_EXCEPT`.

Rendered output (my file web/src/components/VERIFY-allexcept.test.tsx, tags stripped, `|` marks element boundaries):
- wide dialog, Bear-hide Jerkin (`cl: ["ALL_EXCEPT","ENC","MAG","NEC","WIZ"]`), WAR/CLR/ROG trio:
  `Class | ALL_EXCEPT Enchanter Magician Necromancer Wizard | Race | ALL | Weight | 3.5 | Usable by this loadout`, `iwin-bad` count 0.
- narrow hover card, same item: `Class | ALL_EXCEPT ENC MAG NEC WIZ | ... | Usable by this loadout`.
- race row, Basalt Carapace (`ra: ["ALL_EXCEPT","IKS"]`), Iksar trio: `Race | ALL_EXCEPT IKS | ... | This loadout cannot equip it`.
- browser column (real `App` mounted at `#/items`, web/src/screens/VERIFY-browser-column.test.tsx, cell index 2): `{"name":"Bear-hide Jerkin","classes":"ALL_EXCEPT ENC MAG NEC WIZ"}` — while the control row `Basalt Carapace` prints the ordinary `WAR BRD CLR PAL SHD`, so the column is not mangling every row.
The engine itself is correct — web/src/engine/character.ts:213-223 and :244-249 read `ALL_EXCEPT` as an exclusion list, and the verdict strings above are right. This is a display-only defect, exactly as the finding says.

Also confirmed the finding's "nothing on screen defines ALL_EXCEPT": `grep -rni "all except|everything but|except" web/src --include=*.tsx --include=*.css` minus test files returns five hits, all unrelated prose about visual exceptions (styles.css:9, styles.css:1318, Landing.tsx:155, Contamination.tsx:350, ItemBrowser.tsx:170). Nothing glosses the token.

SEVERITY — the stated "minor" is too low, and the reason is a fourth surface the finding did not name. web/src/lib/blockReason.ts:35-39 builds the refusal sentence as `it is restricted to ${item.cl.join(', ')}, and this loadout is ${context.classes.join(', ')}`. For an ALL_EXCEPT item that is not a bare token in a list — it is an inverted sentence that names the excluded classes as the permitted ones. Reproduced:
  `it is restricted to ALL_EXCEPT, ENC, MAG, NEC, WIZ, and this loadout is ENC, MAG, WIZ`
`blockSentence` is consumed at web/src/components/ItemDetail.tsx:90 and rendered as visible prose at ItemDetail.tsx:120 — "Not offered for your set: it is restricted to … ENC, MAG, WIZ, and this loadout is ENC, MAG, WIZ." — a sentence that contradicts itself in one clause; and at web/src/components/SlotCard.tsx:98, where it goes into the row's `title` and the button's accessible name, so a screen-reader user on the =Upgrades paper doll hears it as the whole explanation. That is not an undefined token the reader can shrug off; it is an explanation that states the opposite of the rule. Nothing miscomputes and no ranking moves, which keeps it below a correctness bug — moderate rather than minor is the right band.

SCOPE — the item counts are exactly right; the surface count is not, and the impact figure does not reproduce.
Counts I measured independently with a node one-liner over web/public/data/items-index.json: total 3663, `cl` contains ALL_EXCEPT 255, `ra` 59, both 1, either 313. Identical to the finding. Also: 0 items carry a bare `ALL_EXCEPT` with an empty exclusion list, so every one of the 313 prints the token followed by at least one class or race name that reads as an allowance.
Surfaces: four, not three — the wide dialog panel, the narrow hover card, ItemBrowser's Classes column, and the `blockReason` sentence in ItemDetail (visible) and SlotCard (title + accessible name). Note the browser table has no Race column, so the 59 race rows reach three of the four.
The finding's impact figure "44 usable-for-this-trio cases" does not reproduce under any reading I could construct. Running the real engine over the payload: for WAR/CLR/ROG, all 255 class-ALL_EXCEPT items are usable and print the token beside "Usable by this loadout"; over the full 313 set, 301 usable / 12 blocked (the 12 blocked by explicit class lists, not by the sentinel). Same 255/255 for a WAR/BRD/BER trio. The exposure is class-dependent and heaviest for casters: of the 255, NEC/WIZ/MAG/ENC are each named as excluded in 211, MNK 41, DRU 40, CLR 34, SHM 33, PAL 30, BRD 15, ROG 15, WAR/SHD/BER 1 each, RNG/BST 0; race exclusions are IKS 54, TRL 14, OGR 14, BAR 13, ELF 7. For an ENC/MAG/WIZ trio, 211 items produce the inverted block sentence; for a WAR/CLR/ROG Iksar, 54 do.

Files: /home/user/EQL50ups/web/src/components/ItemWindow.tsx:274-283, /home/user/EQL50ups/web/src/screens/ItemBrowser.tsx:701, /home/user/EQL50ups/web/src/lib/blockReason.ts:35-39, /home/user/EQL50ups/web/src/components/ItemDetail.tsx:90,120, /home/user/EQL50ups/web/src/components/SlotCard.tsx:98, /home/user/EQL50ups/web/src/engine/constants.ts:17, /home/user/EQL50ups/web/src/engine/character.ts:213.
Instruments I wrote (in the worktree): /home/user/EQL50ups/.claude/worktrees/wf_d2d73ce2-770-31/web/src/components/VERIFY-allexcept.test.tsx, .../web/src/lib/VERIFY-scope.test.ts, .../web/src/screens/VERIFY-browser-column.test.tsx. The worktree had no node_modules; I symlinked the main checkout's `web/node_modules` into it to run vitest, which is the only reason those commands work there.

### 31. items-index.json ships no required-level field, so the level gate and the Level requirement row are absent until the slot shard loads

`pipeline/build.mjs:2148` — severity claimed **minor**, scope claimed **3 of 3,663 items carry `rl` at all (counted across all 19 files in web/public/data/items/), and 0 of 3,663 carry it in items-index.json. The divergence is therefore live on exactly 3 items today, on the SHOULDERS, PRIMARY and WRIST slots, and only for a loadout whose qualifying class is below 49/15/46. It becomes catalog-wide the moment upstream populates `required_level` (build.mjs:1564 already reads it).**

**Mechanism.** `INDEX_FIELDS` lists `cl`, `ra`, `wt` and 20 others but not `rl`, so `indexRecord` (build.mjs:2225) strips it. The per-slot detail shards keep it. The record the app holds in `byName` therefore has no `rl` until that slot's shard is fetched (`ensureSlot`, called only when a picker for that slot opens — web/src/components/ItemPicker.tsx:192), so `levelCheck` reads `required: 0`, `usabilityOf` returns 'usable', and ItemWindow's `{item.rl ? …}` guard (ItemWindow.tsx:285) omits the Level row entirely. After the shard merges (`mergeItems`, catalog.ts:220, shard fields win), the same item under the same loadout renders a Level row and the opposite verdict. The comment directly above INDEX_FIELDS makes exactly this argument for `ra` — "omitting races made race-restricted items pass an eligibility check that had nothing to check against" — and catalog.ts:344 states "`rl` gates eligibility"; neither was applied to `rl` itself.

**Evidence the author ran.** Payload count:
```
$ node -e "..." # over web/public/data/
shard rows with rl: 3
[ 'Baton of the Sky rl=49 (PRIMARY.json)', 'Refugee Shroud rl=15 (SHOULDERS.json)', 'Azarack Skin Wristwraps rl=46 (WRIST.json)' ]
index rows with rl: 0 of 3663
```
Rendered both records through the real `ItemWindow` with `makeContext(['WAR'],'HUM',{WAR:10})` (web/src/components/AUDIT-render.test.tsx):
```
index rl: undefined shard rl: 15
usability from index record: usable
usability from shard record: blocked
INDEX panel req: ClassALLRaceALLWeight0.2
INDEX verdict: Usable by this loadout
SHARD panel req: ClassALLRaceALLLevel15 — your WAR is 10Weight0.2SizeSMALL
SHARD verdict: This loadout cannot equip it
```

**Player impact.** For those three items the app gives two different answers to the same question depending on which shards happen to have loaded: a set opened from a share link shows "Usable by this loadout" and no Level row, and the verdict flips to "This loadout cannot equip it — Level 15 — your WAR is 10" once the reader opens that slot's picker. The Level requirement is also simply invisible on the item browser's dialog for as long as `ensureAll`'s fetches are in flight.

**No verdict.** Dropped by the script's `.slice(0, 3)` cap before the verify stage.

