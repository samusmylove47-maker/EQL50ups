# The ten open findings, independently verified

Every open finding in `AUDIT-UPGRADES-SURFACE.md` was re-checked on 1 Sep 2026 by one agent
each, read-only, against the shipped payload and the repository's own inventory fixture. The
raw journal is committed beside this file at
`raw/open-findings-verification.journal.jsonl` so these verdicts can be re-derived rather than
trusted.

```
  verdicts returned   10
    HOLDS              6
    PARTIAL            4
    REFUTED            0
    CANNOT_DETERMINE   0
  all at confidence   ['measured']
```

**Nine of the ten corrected the finding they verified** — wrong line numbers, wrong mechanisms,
missing or overstated scope. Four of the ten had never been judged by the original run at all,
having been dropped by its `.slice(0, 3)` cap.

| id | verdict | where the finding was wrong |
|---|---|---|
| `F04` | PARTIAL | The defect is real but the finding mis-states both its location and its mechanism.  LOCATION: not Upgrades.tsx:1015 (that line is inside `zoneTallies` |
| `F05` | HOLDS | Two corrections, neither of which rescues the code.  1. "forever" is too strong. store.ts:485 ("A position that now holds a real item is no longer wit |
| `F07` | PARTIAL | Two of the finding's three named causes are wrong, and its scope is narrower than stated.  Accurate version: a position lands in the `nothing` bucket  |
| `F08` | HOLDS | The mechanism is exactly as stated, but the finding's LOCATION is wrong. `web/src/screens/Upgrades.tsx:1781` is inside the `if (!gearSet)` "No set to  |
| `F12` | HOLDS | Two corrections, neither fatal to the finding.  (1) The line number is stale. web/src/screens/Upgrades.tsx:572 is inside the ranking pass ("? 'worn-un |
| `F19` | PARTIAL | The drift is real but it is not in the stat values. Every number in the product shot matches the shipped record exactly — DMG 74, DLY 70, RATIO 1.057, |
| `F22` | HOLDS | Accurate as written, but it understates the defect in two ways and names the affected slots too vaguely.  (a) It is not only that "the delta is wrong" |
| `F27` | HOLDS | Accurate as written, with two additions the finding omits. (1) It is not only a failed fetch: `status: 'missing'` (items-index.json 404 / not yet publ |
| `F28` | PARTIAL | Accurate: with ctx.race null, canUseRace returns true for every race-narrowing list, and a rendered ItemWindow prints "Usable by this loadout" over an |
| `F31` | HOLDS | Accurate as written; it simply states no scale. Worth attaching the scale: 3 of 3,663 records, all clearing the default level 50, so the gate itself d |

## F04 — PARTIAL

**What a reader sees.** A reader does see it. Rendering the unmodified WRIST.json entry for Midnight Clad Wristbands through the real Upgrades screen prints "11 sightings across 7 mobs" for an item measured on 5 mobs, and the visible list under that header shows "A fetid fiend" and "a fetid fiend" as two separate rows with their own seen/session counts — so the duplicate is on screen twice over, in the header number and in the list. 17 items are affected; 9 of them sit in wearable-slot shards (ARMS, HANDS, HEAD, WRIST) and so can appear as ranked upgrade rows. No ranking, EP number, sighting total, zone tally or "Where to go" figure changes: mob name is not a sort key anywhere, and `zoneTallies` keys on zone strings, which are not affected.

**Where the finding was wrong.** The defect is real but the finding mis-states both its location and its mechanism.

LOCATION: not Upgrades.tsx:1015 (that line is inside `zoneTallies`, which tallies zones and is unaffected). The header is `MeasuredDrops` at Upgrades.tsx:1153.

MECHANISM: the header does not "count distinct mobs" — it prints `pluralize(rows.length, 'mob')`, the raw length of the item's `ms` array, with no de-duplication of any kind. So the double count is not a case-folding miss in the counter; it is that the counter never dedupes, and the payload happens to supply two rows for one mob.

SCOPE: the differing capitalisation is not "in different shards". Both spellings sit in the SAME item's `ms` array inside one shard (e.g. "A fetid fiend" and "a fetid fiend", same zone, adjacent dates, in WRIST.json's Midnight Clad Wristbands). 14 mobs are spelled two ways payload-wide; 17 of the 309 items carrying measured drops repeat a mob case-insensitively; 0 items repeat a mob with identical spelling.

MAGNITUDE: 17 items overstate by 1 to 3 mobs; the largest single error is Drop of Mercury, "across 13 mobs" for 10. The `sightings` figure beside it is correct in every case (`seen` is summed per event, so splitting one mob across two rows does not change it).

**Smallest fix.** Narrowest correction that touches neither ranking nor any persisted shape: at Upgrades.tsx:1153 count distinct mobs instead of rows — `new Set(rows.map((r) => r.mob.toLowerCase())).size` — leaving `sightings`, the list, `MEASURED_SHOWN`, the "further measured sources" line and every sort order untouched. Caveat worth putting to the Director: that makes the header say "5 mobs" above a list still printing two spellings of one mob, so the honest fix is upstream in the pipeline, folding the two `ms` rows into one before the shard is written. That one DOES touch a persisted shape (`ms` in web/public/data/items/*.json, requiring a rebuild and a re-commit of the payload) and it forces a decision this file has already refused once: merging the rows means summing `sessions`, which `totalSightings` explicitly declines to do because it "would print a sample size larger than the sample". Neither option changes ranking behaviour.

<details><summary>Commands run, and what they returned</summary>

```
1. Read the claimed location and the real header:
   sed -n '960,1060p' web/src/screens/Upgrades.tsx        # line 1015 is inside zoneTallies (zones, not mobs)
   grep -n "measuredDrops\|mob" web/src/screens/Upgrades.tsx
   sed -n '835,900p;1125,1180p' web/src/screens/Upgrades.tsx   # measuredDrops, totalSightings, MeasuredDrops header at :1153

2. Payload scan (node /tmp/f04probe.mjs over web/public/data/items/*.json): per item, group ms[].mob by toLowerCase(), count case variants payload-wide and repeats within one item.

3. Per-item inflation table (node /tmp/f04all.mjs): rows.length vs distinct mobs case-insensitively.

4. Exact- vs case-duplicate check (node /tmp/f04exact.mjs).

5. Rendered the REAL payload item through the real screen. Temporary probe test copied from src/screens/upgrades-screen.test.tsx's harness, seeding the catalog with the verbatim WRIST.json entry for "Midnight Clad Wristbands" (character classes MNK/ROG/WIZ so the item is wearable), then reading .upg-measuredsum / .upg-dropmob / .upg-dropmore out of the DOM:
   cd web && npx vitest run src/screens/zz-f04-probe.test.tsx --silent=false --reporter=verbose
   Probe file deleted afterwards; git status --porcelain shows no file of mine left (only another session's zz-probe-f05.test.ts, untouched). No tracked file was edited.
---
CODE (Upgrades.tsx:1143-1155):
  function MeasuredDrops({ rows }: { rows: readonly MeasuredDrop[] }) {
    const shown = rows.slice(0, MEASURED_SHOWN);
    const sightings = totalSightings(rows);
    ...
    {pluralize(sightings, 'sighting')} across {pluralize(rows.length, 'mob')}
measuredDrops() (:851) filters and sorts only — no dedup anywhere.

PAYLOAD SCAN:
  shard files: 19
  items total: 4004
  items with ms rows: 309
  ms rows total: 677
  distinct mob spellings: 224
  distinct mobs case-insensitively: 210
  mobs with >1 capitalisation ANYWHERE in payload: 14
     a haunted chest -> ["A haunted chest","a haunted chest"]
     phoboplasm -> ["Phoboplasm","phoboplasm"]
     a fetid fiend -> ["A fetid fiend","a fetid fiend"]   (+11 more)
  items repeating a mob with IDENTICAL spelling: 0
  items repeating a mob case-insensitively: 17

PER-ITEM INFLATION (17 items):
  ARMS.json  Ethereal Mist Vambraces    header "across 4 mobs", distinct mobs 3
  HANDS.json Lustrous Russet Gauntlets  header "across 3 mobs", distinct mobs 2
  HANDS.json Midnight Clad Fistwraps    header "across 5 mobs", distinct mobs 4
  HANDS.json Rune Etched Gauntlets      header "across 5 mobs", distinct mobs 3
  HANDS.json Shiverback-hide Gloves     header "across 3 mobs", distinct mobs 2
  HANDS.json Thorny Vine Gauntlets      header "across 3 mobs", distinct mobs 2
  HEAD.json  Elemental Binder           header "across 5 mobs", distinct mobs 4
  OTHER.json Blackburrow Gnoll Pelt     header "across 8 mobs", distinct mobs 7
  OTHER.json Drop of Mercury            header "across 13 mobs", distinct mobs 10
  OTHER.json Froglok Meat                header "across 7 mobs", distinct mobs 6
  OTHER.json Gnoll Fang                  header "across 14 mobs", distinct mobs 13
  OTHER.json Holy Dirt of Brell          header "across 9 mobs", distinct mobs 7
  OTHER.json Rat Whiskers                header "across 3 mobs", distinct mobs 2
  OTHER.json Undead Froglok Tongue       header "across 17 mobs", distinct mobs 16
  WRIST.json Indicolite Bracer           header "across 6 mobs", distinct mobs 5
  WRIST.json Midnight Clad Wristbands    header "across 7 mobs", distinct mobs 5
  WRIST.json Rune Etched Bracer          header "across 4 mobs", distinct mobs 3

RENDERED (real payload item, real screen):
  PROBE rows on screen: 23  found target row: true
  PROBE header: "11 sightings across 7 mobs · 12 Aug 2026 – 13 Aug 2026"
  PROBE listed mobs: ["A fetid fiendoff roster","Phoboplasmoff roster","a fetid fiendoff roster","A loathling lichoff roster"]
  PROBE more line: "3 further measured sources, sm
```

</details>

## F05 — HOLDS

**What a reader sees.** A reader reaches it: import an inventory whose HEAD the catalog cannot score (the repo's own fixture, Avenrae's Shadow Rage Helm), then fill that position — by hand from the paper doll, or simply by pressing Auto-fill, which Probe E shows assigns HEAD. From then on the Upgrades screen prints, under "Not compared", a card reading "Head · Dreadful Cap +0 · Unsourced · stats withheld" followed by "No catalog carries this item's stats, so nothing can be measured against it" — about an item whose stats the shipped payload does carry (AC 2, MANA 10, STA 5) and which the same card then offers a candidate against. In the C case a real 17.00 EP upgrade is withheld from the ranking, the headline total is 293.01 instead of 310.01, and "N already best" is off by one in the B case. It survives reload.

**Where the finding was wrong.** Two corrections, neither of which rescues the code.

1. "forever" is too strong. store.ts:485 ("A position that now holds a real item is no longer withheld") clears the entry, but only inside applySlots — the whole-set writer. Probe G confirms a later inventory re-import clears it (withheld = undefined). Every other mutator leaves it: equip (probe A), unequip + re-equip + setAllUpgrades (probe D), Auto-fill, which loops state.equip per assigned position at SetEditor.tsx:179-181 (probe E). It also survives saveState/loadState (probe F), so it persists across reloads. Accurate wording: sticky until the whole set is re-imported, not permanent.

2. The stale entry does not always cost a ranked row. Precedence is what matters: Upgrades.tsx:561-571 reaches `withheldName ? 'worn-unstatted'` only after view.unresolved and statsAreUnknown(view.item) are both false — i.e. the real, fully-statted worn item is checked first and passes, and the stale name then withholds the slot anyway. wornName at line 586 is `view.equipped?.itemName ?? withheldName`, so the card names the NEW item while printing the OLD item's excuse. Whether a gain is lost depends on the new item: equip HEAD's own best candidate (Indicolite Helm) and only the "already best" count is wrong (settled 11 vs 12, probe B); equip a mid-ranked statted helm (Dreadful Cap, AC 2 / MANA 10 / STA 5, worn EP 6.50) and a genuine +17.00 EP row disappears — rows 10 vs 11, totalGain 293.01 vs 310.01 (probe C).

Location: the read is Upgrades.tsx:522, the precedence that makes it win is 561-571, the mislabelling is 586. Line 517 is inside the same block but is not itself the defect.

**Smallest fix.** Read-side, one condition, no persisted-shape change and no store change: at Upgrades.tsx:522 gate the lookup on the position being empty — `const withheldName = view.equipped ? undefined : options.withheldSlots?.[position.id];`. That touches ranking behaviour (a position that was withheld starts ranking again, which is the point) and nothing else; the imported-withheld case still works because the importer never equips those positions. It leaves the stale key in localStorage, so SetEditor.tsx:507-518's "1 position will not travel: Shadow Rage Helm" share warning would still name a garment no longer worn — that half is a code read, not measured. The complementary store-side fix is to copy applySlots's line 485 into equip (`delete withheld[position]` when it becomes non-empty); that rewrites persisted GearSet.withheld contents, though not its shape. Doing both fixes both surfaces.

<details><summary>Commands run, and what they returned</summary>

```
Static reads:
  sed -n '360,400p' web/src/state/store.ts            (equip/unequip/setUpgrade)
  sed -n '440,495p' web/src/state/store.ts            (applySlots)
  sed -n '480,600p;556,710p' web/src/screens/Upgrades.tsx   (withheldName read + reason chain + emit)
  sed -n '2058,2095p' web/src/screens/Upgrades.tsx    (withheld card render)
  grep -rn "withheld" web/src/state/store.ts web/src/screens/SetEditor.tsx web/src/lib/inventoryImport.ts web/src/state/persistence.ts

Dynamic probe (untracked file, run then deleted; copy kept at /tmp/claude-0/-home-user-EQL50ups/b71726cd-1814-503f-880d-c245d5982023/scratchpad/zz-probe-f05.test.ts). It uses the real shipped payload (web/public/data/items-index.json + shards) and the real fixture research/validation/tier0-inventory-Avenrae.txt, with the same harness as web/src/screens/upgrades-avenrae.test.ts:
  cd /home/user/EQL50ups/web && cp <probe> src/screens/zz-probe-f05.test.ts \
    && npx vitest run src/screens/zz-probe-f05.test.ts --reporter=verbose --disable-console-intercept
Cases: A store.equip after an import; B ranking with the stale map vs the same map cleared; C same with a mid-ranked statted helm; D unequip/re-equip/setAllUpgrades; E Auto-fill's per-entry state.equip; F saveState/loadState round trip; G a later applySlots.
Cleanup: rm src/screens/zz-probe-f05.test.ts && git status --short  ->  (empty)
---
Summary line: "Test Files  1 passed (1) / Tests  7 passed (7)"

A  AFTER IMPORT   withheld = {"HEAD":"Shadow Rage Helm"} slots.HEAD = undefined
A  AFTER equip()  withheld = {"HEAD":"Shadow Rage Helm"} slots.HEAD = {"itemName":"Crown of King Tranix","upgrade":{"full":5,"fraction":0}}
B  IMPORTED  HEAD withheld reason = worn-unstatted | wornName = Shadow Rage Helm | best candidate = Indicolite Helm | candidate statsUnknown = false | candidate stats = {"AC":20,"CHA":5,"INT":5}
B  STALE     HEAD in withheld = true | reason = worn-unstatted | wornName = Indicolite Helm | ranked row = false
B  STALE     badge = Unsourced · stats withheld
B  STALE     body  = No catalog carries this item's stats, so nothing can be measured against it. A gain here would be arithmetic against a zero nobody recorded.
B  CLEARED   HEAD in withheld = false | ranked row = false | gain = undefined
B  COUNTS    stale: rows 10 withheld 2 settled 11 | cleared: rows 10 withheld 1 settled 12
C  WEAK helm = Dreadful Cap | stats = {"AC":2,"MANA":10,"STA":5} | ep@+0 = 6.50
C  STALE  HEAD: withheld = true reason = worn-unstatted wornName = Dreadful Cap wornUpgrade = {"full":0,"fraction":0} ranked = false
C  CLEAR  HEAD: ranked = true candidate = Indicolite Helm gain = 17.00 wornEp = 6.50
C  TOTALS stale rows/withheld/settled/totalGain = 10 2 11 293.01 | clear = 11 1 11 310.01
D  AFTER unequip/equip/setAllUpgrades  withheld = {"HEAD":"Shadow Rage Helm"} slots.HEAD = {"itemName":"Indicolite Helm","upgrade":{"full":10,"fraction":0}}
E  AUTOFILL assigned HEAD = {"position":"HEAD","itemName":"Indicolite Helm"}
E  AUTOFILL after: slots.HEAD = {"itemName":"Indicolite Helm","upgrade":{"full":0,"fraction":0}} | withheld = {"HEAD":"Shadow Rage Helm"}
F  SAVE status = ok
F  RELOADED withheld = {"HEAD":"Shadow Rage Helm"} | slots.HEAD = {"itemName":"Indicolite Helm","upgrade":{"full":5,"fraction":0}}
G  AFTER re-import  withheld = undefined | slots.HEAD = {"itemName":"Indicolite Helm","upgrade":{"full":5,"fraction":0}}
```

</details>

## F07 — PARTIAL

**What a reader sees.** Real, but only once the reader narrows the set's filters. With Balanced + era=Hate (both are ordinary <select> controls in SetConfigDialog.tsx:347-368), the footer at Upgrades.tsx:2105-2106 prints "Nothing scored for ... Any Slot 1, Any Slot 2" while the Ashenbone Axe scored 10.500 for each of those positions and was handed to Primary as the page's only row. The KPI hint at Upgrades.tsx:1925 counts the same positions as "with nothing to offer". Both statements are false for those positions: something scored, and it went elsewhere.

Partial mitigation already on screen: the sentence immediately preceding the footer claim says "Items already worn elsewhere in this set are not offered again, a Lore item is offered for one position only". A reader who joins those two sentences can infer the cause, but the page never says which positions were affected, and "Nothing scored for X" is a direct contradiction of what happened at X.

At the shipped default (no filters), nothing=0 across all five profiles on the Avenrae fixture, so a reader who never opens the set-config dialog sees none of this.

**Where the finding was wrong.** Two of the finding's three named causes are wrong, and its scope is narrower than stated.

Accurate version: a position lands in the `nothing` bucket when every candidate scoring above zero was skipped by one of take()'s two pre-accept `continue`s — `claimed.has(key)` (a Lore item already handed to another position) or `wornAt` (the item is worn at another position). MIN_GAIN is NOT one of them: MIN_GAIN is rejected inside `accept`, whose first statement sets `consideredAny = true`, so such a position is counted as `settled` ("already best"), never `nothing`. Offhand netting likewise cannot reach `nothing` — `blockedOnOffhand` routes to its own `offhand-unpriceable` withheld row.

Measured over 400 reader-reachable configurations of the real fixture, the Lore arm fires 28 times and the worn-elsewhere arm fires zero times. The worn-elsewhere arm is mechanically live (the `wornAt` continue does precede `accept`) but I could not produce a case of it; treat it as unmeasured, not confirmed.

At default filters — the state a reader lands in — `nothing` is empty on all five profiles, so the flagship path shows no reader-visible error.

**Smallest fix.** Give take() a third out-parameter recording that it skipped a positive-scoring candidate because of `claimed`/`wornAt` (a boolean set in the two `continue` branches at Upgrades.tsx:618-619), and at 700-702 route those positions to a distinct label — e.g. a `takenElsewhere: string[]` on UpgradeReport rendered as "Everything that scored for X was taken elsewhere" — instead of pushing them into `nothing`.

Does NOT touch ranking behaviour: no score, no ordering, no Lore hand-out order changes; the same item still goes to the same position. Does NOT touch any persisted or published shape: web/public/data/ is untouched, and GearSet/localStorage/the share codec carry no report bucket.

It does change the in-memory `UpgradeReport` interface (Upgrades.tsx:205-217) and the two render strings, so upgrades-avenrae.test.ts's "accounts for all 23 positions exactly once" sum (rows + withheld + settled + nothing === 23) must gain the new bucket or it will fail.

<details><summary>Commands run, and what they returned</summary>

```
1) Read the mechanism directly:
  sed -n '520,760p' web/src/screens/Upgrades.tsx      (take() at 611-631, accept() at 654-670)
  grep -n "MIN_GAIN" web/src/screens/Upgrades.tsx
  sed -n '1915,1935p;2095,2115p' web/src/screens/Upgrades.tsx   (the two reader strings)
  grep -n "era\|hideNoDrop\|source" web/src/components/SetConfigDialog.tsx   (the filters are real UI controls)

2) Wrote a throwaway probe at web/src/screens/zz-probe-f07.test.ts (since deleted; `git status --porcelain` now shows only the pre-existing `?? web/e2e/_acc.spec.ts`). It reuses the harness of web/src/screens/upgrades-avenrae.test.ts verbatim — shipped payload web/public/data/, real fixture research/validation/tier0-inventory-Avenrae.txt through readInventory/toSlotMap/withheldMap — calls computeUpgrades, then for every label in report.nothing re-derives that position's ranked list with the same rankSlotItems(slot, CONTEXT, weights, wornUpgrade, existing) call pass one makes, applies matchesFilters, and counts candidates with score > 0.

  cd web && npx vitest run src/screens/zz-probe-f07.test.ts --reporter=verbose

  Run A: five profiles, default filters.
  Run B: 400 combinations — 5 profiles x 8 eras x 5 sources x hideNoDrop {false,true}.
  Run C: one combination reproduced end to end (Balanced, era=Hate).
---
Run A (default filters, worn basis) — verbatim stdout:
[balanced] rows=10 withheld=2 settled=11 nothing=0 :: []
[melee-dps] rows=16 withheld=2 settled=5 nothing=0 :: []
[tank] rows=6 withheld=3 settled=14 nothing=0 :: []
[caster] rows=15 withheld=3 settled=5 nothing=0 :: []
[healer] rows=15 withheld=3 settled=5 nothing=0 :: []
Test Files 1 passed (1) / Tests 5 passed (5)

Run B (400 combos) — verbatim tail plus a sample of the 28 hits:
BITE balanced/Hate/any/noDrop=false :: Any Slot 1 [ANY_1] worn=Nautilus Shield positive=1 wornElsewhere=0 lore=1 top=Ashenbone Axe@10.500
BITE balanced/Hate/any/noDrop=false :: Any Slot 2 [ANY_2] worn=Bladestopper positive=1 wornElsewhere=0 lore=1 top=Ashenbone Axe@10.500
BITE melee-dps/Hate/any/noDrop=false :: Any Slot 1 [ANY_1] ... lore=1 top=Ashenbone Axe@17.000
BITE tank/Temple/any/noDrop=false :: Chest [CHEST] worn=Indicolite Breastplate positive=1 wornElsewhere=0 lore=1 top=Lambent Breastplate@97.200
BITE caster/Sky/any/noDrop=true :: Neck [NECK] worn=Talisman of Kejaar Kerrath positive=1 wornElsewhere=0 lore=1 top=Ivory Pendant@15.400
BITE healer/Sky/drop/noDrop=false :: Chest [CHEST] worn=Indicolite Breastplate positive=1 wornElsewhere=0 lore=1 top=Golden Efreeti Chestplate@27.200
combos=400 combosWithNonEmptyNothing=380 nothingPositionsWithAPositiveCandidate=28
Test Files 1 passed (1) / Tests 1 passed (1)
=> 28 positions land in `nothing` while holding a candidate that scored above zero. In ALL 28, wornElsewhere=0 and lore=1: the cause is the Lore claim, never "worn at another position".

Run C (Balanced, era=Hate) — verbatim:
balanced/Hate: rows=1 withheld=2 settled=0 nothing=20
ROWS: ["Primary <- Ashenbone Axe +0.214"]
NOTHING: ["Ear 1","Ear 2","Face","Neck","Shoulders","Arms","Back","Wrist 1","Wrist 2","Range","Hands","Fingers 1","Fingers 2","Chest","Legs","Feet","Waist","Ammo","Any Slot 1","Any Slot 2"]
Ashenbone Axe lore=true slots=["PRIMARY"]
FOOTER WOULD READ: Nothing scored for Ear 1, Ear 2, Face, Neck, Shoulders, Arms, Back, Wrist 1, Wrist 2, Range, Hands, Fingers 1, Fingers 2, Chest, Legs, Feet, Waist, Ammo, Any Slot 1, Any Slot 2.

Source evidence for the MIN_GAIN correction, Upgrades.tsx 611-631 and 654-668:
  const take = (entry, accept = () => true) => {
    for (const scored of entry.ranked) {
      if (scored.score <= 0) break;
      const key = scored.item.n.toLowerCase();
      const owner = wornAt.get(key);
      if (owner !== undefined && owner !== entry.position.id) continue;   // no accept() call
      if (claimed.has(key)) continue;                                     // no accept() call
   
```

</details>

## F08 — HOLDS

**What a reader sees.** A reader with an entirely empty gear set and a narrowed filter sees, over 23 empty slots, the heading "Nothing outranks what you are wearing" and the body "Every position this set can score is already carrying the best item the catalog offers it". Both sentences are false: nothing is worn and nothing was scored. This reaches the reader — measured on the mounted real <App/> against the shipped 3,663-item payload, not inferred.

Bounding it honestly, because two correct statements sit on the same page: the KPI directly above reads "0/23 · 0 already best · 0 not comparable · 23 with nothing to offer", and the footnote below ends "Nothing scored for any position." So the screen contradicts itself rather than lying uniformly, and the true reading is adjacent. Combined with 0/112 reachability at default filters, the reader impact is real but narrow — a contradictory headline behind a filter the player set, not something a fresh set can land on.

**Where the finding was wrong.** The mechanism is exactly as stated, but the finding's LOCATION is wrong. `web/src/screens/Upgrades.tsx:1781` is inside the `if (!gearSet)` "No set to rank" empty state — a different block, and a correct one. The defect is the ternary at `Upgrades.tsx:2049` and the heading at `:2051`.

Two quantifications the finding did not carry, both measured here: it fires in 16 of the 40 era x source states the set-config dialog offers (35 of 80 once hideNoDrop is counted as a third axis), all of them settled=0 / nothing=23; and it is unreachable at default filters — 0 of 112 class x level states with an empty set and `DEFAULT_SET_FILTERS` produce a zero-row report. A player must have narrowed a filter (or imported a set that carries one in `defaultFilters`) to see it.

**Smallest fix.** Widen the branch at `Upgrades.tsx:2049` from `rows.length ? … : <empty-state>` to consult the distinction the engine already computed at `:701-702`: when `report.settled === 0 && report.nothing.length > 0`, render a heading that says the candidate pool was empty (e.g. "Nothing scored under these filters") with a body naming the active filters, and keep the existing "Nothing outranks what you are wearing" copy for `settled > 0`. `report` is already in scope at that point; no new data is needed.

> **Closed.** Fixed one layer out from the suggestion: the branch table is a pure function of `settled` / `nothing` / `withheld` in `web/src/lib/emptyRanking.ts`, so it can be enumerated, and `Upgrades.tsx` only renders its result. The `settled > 0` copy is unchanged; the new copy names the active filters, which answers the imported-`defaultFilters` case this record raised. See the CLOSED note under F08 in `AUDIT-UPGRADES-SURFACE.md`.

Scope of the change: render-side only. It touches no ranking behaviour — `computeUpgrades`, `settled` and `nothing` are unchanged — and no persisted or published shape: nothing in `web/public/data/`, `state/persistence.ts` or `share/codec.ts` is involved. It is one JSX ternary plus one string.

<details><summary>Commands run, and what they returned</summary>

```
1. Located the string (repo-wide grep; the shell `grep -rn` hangs on web/public/data, used the indexed search instead):
   Grep "Nothing outranks" over /home/user/EQL50ups
   -> web/src/screens/Upgrades.tsx:2051 (the only render-side occurrence)

2. Read the branch and its inputs:
   cd /home/user/EQL50ups/web && awk 'NR>=1773 && NR<=1782 {printf "%d\t%s\n", NR, $0}' src/screens/Upgrades.tsx
   cd /home/user/EQL50ups/web && awk 'NR>=2026 && NR<=2027 || NR>=2046 && NR<=2056 {printf "%d\t%s\n", NR, $0}' src/screens/Upgrades.tsx
   cd /home/user/EQL50ups/web && awk 'NR>=680 && NR<=705 {printf "%d\t%s\n", NR, $0}' src/screens/Upgrades.tsx
   Grep "settled|nothing" over web/src/screens/Upgrades.tsx  (to find every render-side use)

3. Wrote two throwaway probes (since deleted; tree confirmed clean of them):
   web/src/screens/__f08probe.test.tsx  — merges web/public/data/items-index.json with every
     web/public/data/items/<SLOT>.json shard exactly as upgrades-avenrae.test.ts does, then
     (A) runs computeUpgrades over all 40 era x source states with a WAR/BRD/BER-50 context and a
     gear set whose `slots` is {} (asserted empty), and (B) mounts the real <App/> at
     #/set/<id>/upgrades with that empty set and defaultFilters {era:'Paineel',source:'any'}.
   web/src/screens/__f08probe2.test.ts  — reachability: default filters across 16 classes x 7 levels,
     and an 80-state era x source x hideNoDrop sweep.

   cd /home/user/EQL50ups/web && npx vitest run src/screens/__f08probe.test.tsx --silent=false --reporter=verbose
   cd /home/user/EQL50ups/web && npx vitest run src/screens/__f08probe2.test.ts --silent=false --reporter=verbose

4. cd /home/user/EQL50ups/web && rm -f src/screens/__f08probe.test.tsx src/screens/__f08probe2.test.ts
---
READ — the branch consults rows.length and nothing else:

  2049          ) : (
  2050            <div className="empty-state">
  2051              <h2>Nothing outranks what you are wearing</h2>
  2052              <p>
  2053                Every position this set can score is already carrying the best item the catalog
  2054                offers it, {basisText}. Change the comparison tier, widen this set's filters, or

  The engine has already separated the two facts, under a comment saying so:
  686       * Two different facts, and they were one branch. `settled` says the pool
  687       * was searched and nothing in it beats what you wear; `nothing` says the
  688       * pool held no usable candidate at all.
  701      } else if (consideredAny) settled += 1;
  702      else nothing.push(entry.position);

  Every render-side use of `settled` / `report.nothing` (grep, whole file): 1924-1925 (KPI sub-hint)
  and 2105-2106 (footnote). Neither appears in the ternary or its body.

  The finding's cited line 1781 is a DIFFERENT empty state:
  1773  if (!gearSet) {
  1776        <h2>No set to rank</h2>
  1781        <div className="empty-actions">

PROBE A — vitest summary line: "Test Files 1 passed (1) / Tests 2 passed (2)"

  --- payload items merged: 3663
  --- eras: ["any","Classic","Temple","Paineel","Sky","Fear","Hate","Kunark"]
  --- total states: 40
  --- zero-row (headline) states: 16
      Temple/vendor rows=0 settled=0 nothing=23 withheld=0
      Temple/crafted rows=0 settled=0 nothing=23 withheld=0
      Paineel/any rows=0 settled=0 nothing=23 withheld=0
      Paineel/drop rows=0 settled=0 nothing=23 withheld=0
      Paineel/quest rows=0 settled=0 nothing=23 withheld=0
      Paineel/vendor rows=0 settled=0 nothing=23 withheld=0
      Paineel/crafted rows=0 settled=0 nothing=23 withheld=0
      Sky/vendor rows=0 settled=0 nothing=23 withheld=0
      Sky/crafted rows=0 settled=0 nothing=23 withheld=0
      Fear/vendor rows=0 settled=0 nothing=23 withheld=0
      Fear/crafted rows=0 settled=0 nothing=23 withheld=0
      Hate/quest rows=0 settled=0 nothing=23 withheld=0
      Hate/vendor rows=0 settled=0 nothing=23 withheld=0
      Hate/crafted rows=0 settled=0 nothing=23 withheld=0
      Kunark/vendor rows=0 settled=0 nothing=23 withheld=0
      Kunark/crafted rows=0 settled=0 nothing=23 withheld=0

PROBE B — the mounted screen, empty set (slots asserted to have 0 keys), Paineel/any:

  --- .upg-row count: 0
  --- empty-state h2: Nothing outranks what you are wearing
  --- empty-state p: Every position this set can score is already carrying the be
```

</details>

## F12 — HOLDS

**What a reader sees.** On any set with an occupied Secondary whose Primary ranking is topped by a two-hander, the Primary row names a worse item and understates the gain — up to 16.410 EP in the sweep (row reads "Fangol +8.5 EP, TWO-HANDED −25.60 EP giving up Orb of Tishan" when Dagas, available to that same slot in that same run, nets +24.952). It is a double error on a page whose stated purpose (Upgrades.tsx:4) is "where is my biggest gain": the row recommends the wrong item, and because rows.sort at Upgrades.tsx:771 orders by that understated gain, the Primary row also sits too low in a list the reader is told is "biggest first".

Nothing reaches a reader on the repo's own fixture: Avenrae's offhand is empty, offhandEp 0.000, no inversion on any preset. So a check against the shipped fixture alone would refute this — wrongly. The payload in web/public/data/ is not implicated; this is client-side ranking only.

**Where the finding was wrong.** Two corrections, neither fatal to the finding.

(1) The line number is stale. web/src/screens/Upgrades.tsx:572 is inside the ranking pass ("? 'worn-unstatted' : null;"), not the acceptance test. The live code is the accept callback passed to take() at Upgrades.tsx:654-668, and the specific line is 664: `if (netGain < MIN_GAIN) return false;` followed by `return true;` at 668, which ends the walk.

(2) "the first two-hander" is right but the reason is narrower than the wording suggests: take() accepts the first candidate of ANY kind that clears MIN_GAIN, but the ranked list is sorted by raw EP, so for one-handers netGain = ep - wornEp is monotone and first-clearing IS max. Only the two-handed offhand subtraction breaks monotonicity, so only a two-hander can ever be the wrong pick. The inversion condition is exactly: offhandEp > (ep_2H - ep_1H) while ep_2H - wornEp - offhandEp >= 0.05.

Scope correction the finding does not state and a refuter could have relied on: the defect does NOT appear for the repository's own validation character. Avenrae wields Earthshaker, a two-hander, so her Secondary is empty, offhandEp is 0.000 under all five presets, and first-accepted equals best-net in every one. It needs a sword-and-board loadout — an ordinary thing to build in the planner for a WAR/BER — and then it fires in 264 of 620 real configurations.

**Smallest fix.** In the accept callback at web/src/screens/Upgrades.tsx:654-668, stop returning true on the first clearing candidate. Because only two-handers break the ordering, the narrowest correct fix is: when a candidate clears MIN_GAIN and is two-handed, remember it as provisional-best and return false to keep walking, capturing the running max of netGain; accept immediately only for a one-hander (which is guaranteed maximal from there down, since remaining scores are lower and pay no offhand cost). Then award the recorded max.

One coupling to preserve: take() calls claimed.add(key) at the moment it returns a Lore item, and its docstring is explicit that accept must run before the Lore claim so a rejected candidate does not consume the single copy. A max-net walk must therefore claim only the finally chosen item, not every two-hander it passed over.

This touches ranking behaviour — which item each Primary row recommends, its printed gain, and its position in the gain-sorted list — and can cascade into the Lore hand-out (in the focused case Dagas would go to PRIMARY, and SECONDARY would fall to its next best). It touches no persisted or published shape: web/public/data/ is not regenerated, and UpgradeRow's fields are unchanged. The existing pin at upgrades.test.ts:1014 (the below-floor case) still passes under this change; there is no test pinning first-accepted semantics that a fix would have to break.

<details><summary>Commands run, and what they returned</summary>

```
1. Located the real code (the finding's line 572 is stale):
   grep -rn "MIN_GAIN" --include=*.ts --include=*.tsx --include=*.mjs . | grep -v node_modules
   sed -n 649,670p web/src/screens/Upgrades.tsx
   sed -n 570,574p web/src/screens/Upgrades.tsx
   sed -n 765,782p web/src/screens/Upgrades.tsx
   sed -n 975,1020p web/src/screens/upgrades.test.ts

2. Wrote throwaway vitest probes under /tmp/f12probe (config + test, now deleted; tree left clean, verified with `git status --porcelain` -> empty). Probes imported the real modules by absolute path and loaded the SHIPPED payload (web/public/data/items-index.json + every per-slot shard) and the real fixture research/validation/tier0-inventory-Avenrae.txt through the app's own importer, then called the real computeUpgrades. Run from web/ with:
   cd /home/user/EQL50ups/web && npx vitest run --config /tmp/f12probe/vitest.config.ts
   (config: {test:{root:'/home/user/EQL50ups/web', environment:'node', include:['/tmp/f12probe/*.test.ts']}} — console.log is swallowed by this reporter, so probes appended to /tmp/f12probe/out*.txt, which I then cat'd.)

   Probe A: Avenrae as imported, PRIMARY walk dumped for all 5 presets.
   Probe B/C: sweep of real catalogue offhands with a one-handed worn Primary.
   Probe D: reconstructed the hand-out queue key (provisional = ranked[0].score - wornEp) to prove whether the better candidate was still unclaimed at PRIMARY's turn.
   Probe E: 25 worn primaries x 25 offhands (all real, non-Lore, drawn from rankSlotItems so class/race/level restrictions are applied), comparing the shipped PRIMARY row against the best net gain still available to it.
---
SUMMARY LINES, every probe run: "Test Files  1 passed (1) / Tests  1 passed (1)".

(A) Avenrae exactly as the importer builds her — no inversion, all 5 presets:
  [melee-dps] worn=Earthshaker wornEp=67.886 2H=true offhand=(empty) offEp=0.000 ranked=352
    firstAccepted={"i":0,"n":"Fangol","two":true,"ep":107.286,"net":39.400}
    bestNet      ={"i":0,"n":"Fangol","two":true,"ep":107.286,"net":39.400}
    SHIPPED ROW  =Fangol gain=39.400 twoHanded=null
  [balanced] offhand=(empty) offEp=0.000 -> firstAccepted=bestNet=Dagas net=76.310; SHIPPED ROW=Dagas gain=76.310 twoHanded=null
  [tank]/[caster]/[healer]: PRIMARY withheld=profile-blind-to-weapons.
  She wields Earthshaker (2H), so SECONDARY is empty and offhandEp is 0.000 — the netting term that causes the defect is zero.

(E) 620 sword-and-board configurations, melee-dps, real items:
  worn primaries=25 offhands=25
  cases=620 inversions=264 nonLoreInversions=0
  worn=Brass Knuckles (ep 16.00) offhand=Orb of Tishan (ep 25.60) :: SHOWN Fangol 2H +8.543 [empties Orb of Tishan -25.60] | AVAILABLE Dagas 1H +24.952 (delta +16.410)
  worn=Brass Knuckles (ep 16.00) offhand=Enchanted Fine Steel Long Sword (ep 16.00) :: SHOWN Fangol 2H +18.143 | AVAILABLE Dagas 1H +24.952 (delta +6.810)
  worn=Shimmering Ruby Stiletto (ep 14.93) offhand=Orb of Tishan (ep 25.60) :: SHOWN Fangol 2H +9.610 | AVAILABLE Dagas 1H +26.019 (delta +16.410)
  ... 264 such cases; the smallest surviving delta was +0.040.

(D) Focused end-to-end proof that the better candidate really was unclaimed:
  FOCUSED CASE: PRIMARY=Brass Knuckles, SECONDARY=Orb of Tishan, preset melee-dps
    PRIMARY: worn=Brass Knuckles wornEp=16.000 provisional=34.143 topRanked=Fangol
      shipped row: Fangol +8.543 [empties Orb of Tishan -25.60]
      ranked top5: 2H Fangol 50.14* | 2H Monsoon, Sword of the Swiftwind 42.07* | 1H Dagas 40.95* | 2H Cudgel of the Fool 34.62* | 1H Spear of Harmony 31.86*
    SECONDARY: worn=Orb of Tishan wornEp=25.600 provisional=15.352 topRanked=Dagas
      shipped row: Dagas +15.352
    Dagas awarded to: SECONDARY
    Dagas slots=["PRIMARY","SECONDARY"] lore=true 2H=false
  PRIMARY's provisional (34.143) exceeds SECONDARY's (15.352), so PRIMARY is served FIRST; Dagas fits only PRIMARY and SECONDARY, so nothing had claimed it. The walk accepted Fangol at rank #0 (50.143 - 16.000 - 25.600 = 8.543 >= 0.05) and returned, never reaching Dagas at rank #2 (40.952 - 16.000 = 24.952).

Counter-case that is NOT a defect (Secondary served first): with PRIMARY=Spear of Harmony / SECONDARY=Nautilus Shield, SECONDARY provisional=22.952 > PRIMARY
```

</details>

## F19 — PARTIAL

**What a reader sees.** Three things reach the front page wrong, all inside the product-shot window:
1. The existence eyebrow reads "Tier M · held in a live inventory" where the shipped record renders "Tier M · seen dropping in game". This is a sourcing claim, printed unconditionally (ItemWindow.tsx:114), and it understates evidence the payload holds — `ex` is `measured-drop` with an `ms` block recording Master Yael, seen 4 times over 4 sessions, 10-11 Aug 2026. A reader who hovers Earthshaker anywhere else in the app sees a different provenance line for the same item.
2. The whole Effects group is missing: the shipped record carries `fx` proc Earthquake and the real window prints "Effects / proc Earthquake — Combat, Casting Time: Instant". The front-page shot of the app's flagship item omits it, so the shot shows a strictly poorer window than the app draws.
3. The flag line reads "Magic Lore" where the shipped record renders "Lore Magic" (displayFlags preserves input order) — cosmetic, but it sits in the one line the surrounding prose singles out as the client-contradicted field.
Not reaching a reader: the `sdc` divergence ("Seven of seven" vs "Nine of nine"), because Landing passes no `wide` and ItemWindow.tsx:245 gates the Provenance block on it; likewise ic, an, es, src, ms, sv. The "seven of seven" prose beside the window is separately derived-and-guarded against TIER0-VALIDATION.md and is not itself stale.

**Where the finding was wrong.** The drift is real but it is not in the stat values. Every number in the product shot matches the shipped record exactly — DMG 74, DLY 70, RATIO 1.057, Strength +16, Stamina +16, Void Resist +10, Weight 1.6, and st/wp differ only in JSON key order. What has drifted is the provenance and effects half of the record, which is precisely the half the comment above the constant claims is the reason it exists ("This is the shipped `Earthshaker` record, field for field — including the provenance fields, which is the whole reason it is the exemplar"). Eight fields differ; three of them change what the front page prints.

**Smallest fix.** Display-only, and it touches neither ranking nor any persisted or published shape: SAMPLE is a module-local constant in web/src/screens/Landing.tsx read by one JSX element, never by the engine, the pipeline or the payload. Narrowest correction is three edits to that literal — `ex: 'measured-drop'`, `fl: ['LORE', 'MAGIC']`, and add `fx: [{ k: 'proc', n: 'Earthquake', d: 'Combat, Casting Time: Instant', lv: 45 }]` — which makes the rendered wide=false text identical to the shipped record's. The `sdc` string should be reconciled too (it disagrees with the shipped record in both the field list and the count), but nothing renders it here. The durable fix, and the one this repo's own habit argues for, is to stop hardcoding: load Earthshaker from the catalogue the page already fetches, or failing that add the check that does not exist — a test that reads web/public/data/items/PRIMARY.json id 5667 and asserts the literal equals it — since the existing four Landing guards check the prose against the validation document and nothing checks the record against the payload.

<details><summary>Commands run, and what they returned</summary>

```
1) Field-by-field diff of the hardcoded literal against the shipped shard (literal extracted from the file by brace-matching, not retyped):

node -e "
const fs=require('fs');
const src=fs.readFileSync('web/src/screens/Landing.tsx','utf8');
const start=src.indexOf('const SAMPLE: Item = {');
const open=src.indexOf('{',start);
let d=0,i=open,end=-1;
for(;i<src.length;i++){const c=src[i]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){end=i;break;}}}
const SAMPLE=eval('('+src.slice(open,end+1)+')');
const ship=JSON.parse(fs.readFileSync('web/public/data/items/PRIMARY.json','utf8')).items.find(x=>x.id===5667);
const keys=[...new Set([...Object.keys(SAMPLE),...Object.keys(ship)])].sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
for(const k of keys){console.log((eq(SAMPLE[k],ship[k])?'SAME  ':'DIFF  ')+k.padEnd(5)+' landing='+JSON.stringify(SAMPLE[k])+'  shipped='+JSON.stringify(ship[k]));}
"

2) Rendered both records through the real ItemWindow at the exact props Landing.tsx uses (throwaway probe web/src/zzf19probe.test.tsx, since deleted; it re-extracted the literal the same way, ran the shipped row through src/data/normalize.ts normalizeItem, rendered with createRoot/act at upgrade tier(10), context makeContext(['BRD','WAR','BER'],null,{50,50,50}), slot="PRIMARY", wide false and true, and appended container.textContent to /tmp/f19.txt):

cd /home/user/EQL50ups/web && npx vitest run src/zzf19probe.test.tsx   ->  Test Files 1 passed (1) / Tests 1 passed (1)
cat /tmp/f19.txt

3) Checked what the page actually passes and what guards exist:
grep -rn "<ItemWindow" web/src --include=*.tsx | grep -v "\.test\."
sed -n 89,120p web/src/components/ItemWindow.tsx  (existence label render site)
sed -n 240,265p web/src/components/ItemWindow.tsx (Provenance block, gated on `wide`)
sed -n 325,395p web/src/screens/sources.test.tsx  (the four Landing tests)
sed -n 1,100p web/src/screens/prose-vs-record.test.ts

4) git status --porcelain before and after: identical (4 pre-existing modifications, none mine). Probe removed.
---
Diff (verbatim, trimmed to the DIFF lines plus the stat lines):

SAME  st    landing={"STR":6,"STA":6,"DEX":-5}  shipped={"DEX":-5,"STA":6,"STR":6}   (key order only)
SAME  wp    landing={"dmg":37,"dly":70,"skill":"2H Slashing"}  shipped={"dly":70,"dmg":37,"skill":"2H Slashing"}   (key order only)
SAME  wt=16, sz="GIANT", era="Classic", av=true, cl, ra, sl, id, n, sd="tier-M", vf=["DLY","DMG","STA","STR"]
DIFF  ex    landing="live-export"  shipped="measured-drop"
DIFF  fx    landing=undefined  shipped=[{"k":"proc","n":"Earthquake","d":"Combat, Casting Time: Instant","lv":45}]
DIFF  fl    landing=["MAGIC","LORE"]  shipped=["LORE","MAGIC"]
DIFF  sdc   landing="...Ratio 1.057, Dmg Bon 50, Strength 16, Stamina 16, SV Void 10. Seven of seven predictions exact."  shipped="...Ratio 1.057, Strength 16, Stamina 16, SV Void 10. Nine of nine predictions exact."
DIFF  ic    landing=undefined  shipped=519
DIFF  an    landing=undefined  shipped=1
DIFF  es    landing=undefined  shipped="eqlwiki.available_from"
DIFF  src   landing=undefined  shipped={"z":["The Hole"],"m":["Master Yael"]}
DIFF  ms    landing=undefined  shipped=[{"mob":"Master Yael","seen":4,"sessions":4,"zones":["The Ruins of Old Paineel - Group"],"first":"10 Aug 2026","last":"11 Aug 2026"}]
DIFF  sv    landing={}  shipped=undefined

Rendered text (/tmp/f19.txt). Landing.tsx:174 passes no `wide`, so wide=false is the front page:

### LANDING wide=false
EarthshakerTier M · held in a live inventoryTier M · stats read off the clientPRIMARYMagic LoreClassicDMG 74 DLY 70 RATIO 1.057Stats at +10Strength+16Stamina+16Void Resist+10RequirementsClassWAR PAL RNG SHD BERRaceALLWeight1.6SizeGIANTUsable by this loadout

### SHIPPED wide=false
EarthshakerTier M · seen dropping in gameTier M · stats read off the clientPRIMARYLore MagicClassicDMG 74 DLY 70 RATIO 1.057Stats at +10Strength+16Stamina+16Void Resist+10Effectsproc Earthquake — Combat, Casting Time: InstantRequirementsClassWAR PAL RNG SHD BERRaceALLWeight1.6SizeGIANTUsable by this loadout

### LANDING wide=true (not what the page renders; shown to locate the sdc drift)
...Void Resist+10ProvenanceTIER0-VALIDATION.md §1: ... Dmg Bon 50, Strength 16, Stamina 16, SV Void 10. Seven of seven predictions exact.Checked field by field: DLY, DMG, STA, STR....

### SHIPPED wide=true
...Void Resist+10Effectsproc Earthquake — Combat, Casting Time: InstantProvenanceTIER0-VALIDATION.md §1: ... Strength 16, Stamina 16, SV Void 10. Nine of nine predictions exact....

Call site: web/src/screens/Landing.tsx:174
  <ItemWindow item={SAMPLE} upgrade={tier(10)} context={AVENRAE} slot
```

</details>

## F22 — HOLDS

**What a reader sees.** A player wearing a bow, a throwing weapon, an arrow, Fang of the Wolf, or any weapon in an Any Slot, on a melee-dps or balanced weight profile, opens that slot's picker and sees every candidate labelled a downgrade in red — including candidates the picker's own EP column simultaneously ranks above the worn item. Measured on the shipped payload: worn Bow of the Underfoot prints 7.2 EP, the top candidate prints 12.3 EP, and the chip beside it reads "-16.9 vs worn" in the `bad` class. Nothing is mis-ranked (row order comes from rankSlotItems, which gates correctly) and nothing wrong is persisted or shared — but the one number the picker exists to show, "is this better than what I have", is wrong by RATIO_weight x worn_ratio + DMG_weight x worn_damage on every row, and points the wrong way.

**Where the finding was wrong.** Accurate as written, but it understates the defect in two ways and names the affected slots too vaguely.

(a) It is not only that "the delta is wrong". The picker shows the worn item's own EP twice, from two different scorers, and the two disagree in the same frame: the worn row prints 7.2 EP (rankSlotItems, weaponCounts=false) while every other row's "vs worn" is measured against 29.2 EP (scoreItem, weaponCounts defaulted true). A reader can subtract the two visible EP numbers, get +5.1, and read "-16.9" next to it.

(b) The sign and the colour flip, not just the magnitude. "Soldier's Brooch of the Stalwart" is a genuine +5.1 EP upgrade over the equipped bow by the picker's own ranking, and it renders as `class="d bad"` with a minus sign — the picker actively tells the player their real best-in-slot RANGE upgrade is a downgrade.

(c) "non-hand slots" should be named: RANGE (94 wp items), AMMO (56), EAR (1, Fang of the Wolf), and both ANY positions — `itemsForSlot` returns `state.items.filter(i => i.sl.length > 0)` for 'ANY', so all 560 wp-bearing items can be worn in an Any Slot, and weaponCountsAt('ANY') is false. Ceiling of the error is 41.14 EP (Throwing Boulder, ratio 1.0286, RATIO weight 40).

Two of the five shipped PRESET_PROFILES carry a RATIO weight (melee-dps 40, balanced 20), so this is the default path for a melee set, not an exotic hand-tuned profile. Under tank/caster/healer the weight is 0 and the bug is inert.

**Smallest fix.** One argument at web/src/components/ItemPicker.tsx:241 — pass the gate the rest of the app already computes:

  scoreItem(currentItem, currentUpgrade, weights, { existing, weaponCounts: weaponCountsAt(position.type) })

with `weaponCountsAt` added to the existing `../engine/constants` import. This is verbatim what screens/Upgrades.tsx:575 already does for its own worn baseline, and what selectors/gear.ts:366 does for candidates — ItemPicker is the one worn-side caller that never got it.

Blast radius: display only. `wornScore` at ItemPicker.tsx:240 has exactly one consumer, the "vs worn" chip at lines 651-652; it feeds no sort, no cache key, and no equip. Ranking behaviour is untouched (candidate scores come from rankSlotItems, already gated). No persisted or published shape changes — nothing in web/public/data/, the share codec, or set state is involved, so no pipeline re-run and no payload commit.

Worth pairing with a regression test: the existing "vs worn" coverage in web/src/components/picker-rerank.test.tsx:294-339 uses HEAD helms with no `wp`, so it cannot see this. A RANGE case with a wp-bearing worn item and a RATIO weight is what would have caught it.

<details><summary>Commands run, and what they returned</summary>

```
1. Read the two call sites:
   sed -n 180,300p web/src/components/ItemPicker.tsx      # line 241: scoreItem(currentItem, currentUpgrade, weights, { existing }) — no weaponCounts
   sed -n 340,400p web/src/selectors/gear.ts              # line 366-369: const weaponCounts = weaponCountsAt(slot); rankScorer(weights, { weaponCounts, ... })
   sed -n 130,170p web/src/engine/constants.ts            # weaponCountsAt(slot) => slot !== 'ANY' && WEAPON_POSITIONS.has(slot); WEAPON_POSITIONS = {PRIMARY, SECONDARY}
   sed -n 120,260p web/src/engine/ep.ts                   # ep.ts:148 `if (resolved.weapon && (ctx.weaponCounts ?? true))` — the default is TRUE
   grep -n "wornScore" web/src/components/ItemPicker.tsx  # 240 (definition), 651-652 (the only consumer: the "vs worn" chip)
   grep -n "itemsForSlot" -A 25 web/src/data/catalog.ts   # ANY pools every item with sl.length > 0

2. Counted the exposure in the SHIPPED payload (web/public/data/items-index.json, 3663 items):
   node -e "... items.filter(i=>i.wp) grouped by i.sl ..."
   node -e "... rows with wp reachable in a non-hand slot, ratio = dmg/dly, ep at RATIO weight 40 ..."

3. Rendered the REAL picker in jsdom against the REAL shard and the REAL preset.
   Throwaway probe at web/src/components/f22probe.test.tsx (created, run, then `rm`ed; `git status --porcelain` afterwards is empty).
   It seeds useCatalog from web/public/data/items/RANGE.json (110 items, fl/st/sv defaulted as the real loader does), creates the WAR/BRD/BER trio with PRESET_PROFILES 'melee-dps' weights, equips "Bow of the Underfoot" at +0 in RANGE, renders <App/>, clicks the Range paper-doll button, and prints each row's .result-score .n, the delta node's text and its className.
   cd web && npx vitest run src/components/f22probe.test.tsx --silent=false --reporter=verbose

4. An earlier minimal-fixture run of the same probe printed scoreItem both ways for the same worn item.
---
Slot distribution of `wp`-bearing items in the shipped index (560 total):
  PRIMARY 425 | RANGE 94 | SECONDARY 212 | AMMO 56 | EAR 1 ("Fang of the Wolf", 5/26 = 0.1923)
  items with wp reachable in a non-hand slot: 140
  of those, NOT equippable in a hand at all: 129
  worst offenders at RATIO weight 40: Throwing Boulder (RANGE/AMMO) 36/35 = 1.0286 -> 41.14 EP of phantom worn credit; Windstriker 45/60 = 0.75 -> 30.00; Shuriken of the Tranquil 12/20 -> 24.00; Bow of the Underfoot 33/60 = 0.55 -> 22.00

Real payload / real preset / real trio, RANGE picker, worn = Bow of the Underfoot +0:
  melee weights = {"RATIO":40,"STR":1,"DEX":0.8,"AGI":0.5,"STA":0.6,"HP":0.1,"AC":0.3,"HASTE":2}
  ROW  Soldier's Brooch of the Stalwart      ||  12.3 EP  ||  delta="-16.9 vs worn" class="d bad"
  ROW  Bow of the Underfoot                  ||   7.2 EP  ||  delta="" class=""
  ROW  Idol of the Underking                 ||   5.0 EP  ||  delta="-24.2 vs worn" class="d bad"
  ROW  Kerran Toy                            ||   1.9 EP  ||  delta="-27.3 vs worn" class="d bad"
  ROW  Ball of Everliving Golem              ||   1.5 EP  ||  delta="-27.7 vs worn" class="d bad"
  ROW  Deteriorated Ancient Faydark Longbow  ||   0.5 EP  ||  delta="-28.7 vs worn" class="d bad"
  ROW  Stormguard Battle Hammer of Brell     ||   0.5 EP  ||  delta="-28.7 vs worn" class="d bad"
  ROW  A Vile Substance                      ||   0.0 EP  ||  delta="-29.2 vs worn" class="d bad"

  Every delta is short by exactly 22.0 = RATIO 40 x 0.55. The worn row is printed at 7.2 EP (rankSlotItems, weaponCounts=false) while the deltas are taken against 29.2 (scoreItem, weaponCounts defaulted true). Two numbers for the same item, both on screen at once.

Minimal-fixture run, same code path, isolating the arithmetic:
  EQUIPPED RANGE = {"RANGE":{"itemName":"[Fixture] Worn Bow","upgrade":{"full":0,"fraction":0}}}
  ROWS = ["[Fixture] Plain Quiver ... 12.0 EP -38 vs worn", "[Fixture] Worn Bow ... Equipped ... 10.0 EP"]
  weaponCountsAt(RANGE) = false
  worn scored WITHOUT weaponCounts (what ItemPicker does) = 50
  worn scored WITH weaponCounts:false (what rankSlotItems uses) = 10
  candidate score = 12
  (weights {STR:1, RATIO:40, DMG:1}; bow 20/40 -> 0.5*40 + 20*1 = 40 of phantom credit; true delta +2, shown -38)

Tree left clean: `rm web/src/components/f22probe.test.tsx` then `git status --porcelain` -> no output.
```

</details>

## F27 — HOLDS

**What a reader sees.** A reader who opens a perfectly good share link while data/items-index.json is unreachable (offline, 5xx, or not yet published) is told the link was built against a different catalog build and to "Ask for a fresh link" — advice that cannot help, since a freshly minted link fails identically. Measured: the same payload that renders the full shared set when the index loads (probe E) renders "That link could not be read … Ask for a fresh link." under fetch-reject, 500, and 404 (probes B, C, D). Mitigation, also measured: the DataBanner directly above names the real cause ("Item data failed to load. Failed to fetch"), so an attentive reader has the contradiction in front of them; the screen offers no retry, only "Go to the planner" and the banner's "Load fixture items" (which would swap in fixture names and still not resolve the link).

**Where the finding was wrong.** Accurate as written, with two additions the finding omits. (1) It is not only a failed fetch: `status: 'missing'` (items-index.json 404 / not yet published, catalog.ts:329) produces the identical wrong message — SharedSet.tsx:47 treats only 'idle' and 'loading' as not-yet-loaded, so both 'error' and 'missing' fall through to the catalog-mismatch prose at :71. (2) The message does not stand alone: App.tsx:141 renders DataBanner above it, so in the failed-fetch cases the reader also sees "Item data failed to load. Failed to fetch" — the true cause is on screen, contradicting the paragraph below it. In the 404 case the banner is actively worse, asserting "share links — works now" directly above a refused share link.

**Smallest fix.** In web/src/screens/SharedSet.tsx only: when `result.failure === 'catalog-mismatch'` and `catalog.status` is 'error' or 'missing', say the item catalog could not be loaded and that the link has not been read yet (offer a reload), instead of blaming the link's provenance. That is a branch on state SharedSet already reads at line 47 — one component, prose plus a condition. It touches no ranking behaviour, no share wire format, no persisted state, and nothing in web/public/data/.

> **Closed, but not by this fix.** Branching on `catalog.status` is wrong in the other direction: `loadFixture()` leaves `status: 'ready'` holding fixture names, which is a real different-build mismatch and must keep saying so, and `status` cannot tell whether the link interned any names at all. The decoder is the only place that knows both, so it carries the reason forward instead — a new `catalog-unavailable` failure, distinct from `catalog-mismatch`. See the CLOSED note under F27 in `AUDIT-UPGRADES-SURFACE.md`.

<details><summary>Commands run, and what they returned</summary>

```
Wrote a throwaway probe + standalone vitest config under the scratchpad (both deleted afterwards):

/tmp/.../scratchpad/f27.test.tsx — builds the share dictionary from the 3,663 names in web/public/data/items-index.json, encodes a plan (PRIMARY = "10 Dose Adrenaline Tap", tier 5) with encodePlan(plan, dict), then mounts the real <App/> at `#/share/<payload>` in jsdom with globalThis.fetch stubbed per case, settles 25ms inside act(), and reads `.empty-state` textContent plus the first `.notice`.
/tmp/.../scratchpad/vitest.f27.config.ts — { plugins:[react()], root:'/home/user/EQL50ups/web', test:{ root:'.../web', environment:'jsdom', include:['/tmp/.../f27.test.tsx'] } }

cd /home/user/EQL50ups/web && npx vitest run --config /tmp/.../scratchpad/vitest.f27.config.ts
  -> summary line: "Test Files  1 passed (1) / Tests  5 passed (5)"

Cases: A = decode with the real dictionary (control on the codec); B = fetch rejects with TypeError('Failed to fetch'); C = items-index.json -> 500; D = items-index.json -> 404; E = items-index.json served verbatim from web/public/data/items-index.json.

Also read: web/src/screens/SharedSet.tsx:23,47,71; web/src/data/shareDictionary.ts:16-22; web/src/data/catalog.ts:317-370 (load(): status 'missing' at :329, 'error' at :365); web/src/share/codec.ts:310-315 (readItemRef), :338-348 (decodeV2 dict-key check), :418 (unresolved>0 -> 'catalog-mismatch'); web/src/components/DataBanner.tsx:33-60; web/src/App.tsx:44-46,141.

cd /home/user/EQL50ups && git status --porcelain  (after deleting the probes)
---
PROBE A names.length = 3663
PROBE A itemName = "10 Dose Adrenaline Tap"
PROBE A payload = AwGTtGcHQXZlbnJhZQMAMgcyDzIBCUxvYWRvdXQgMQMHAA8AAAhNYWluIFNldAEMBQAAAAEBAADQD4gT
PROBE A failure = undefined
PROBE A plan PRIMARY = {"itemName":"10 Dose Adrenaline Tap","upgrade":{"full":5,"fraction":0}}
   [banner] = "Item data failed to load. Failed to fetchLoad fixture items"
PROBE B catalog.status = error
PROBE B catalog.error = Failed to fetch
PROBE B indexNames.length = 0
PROBE B screen = "That link could not be readThis link was made against a different build of the item catalog, so its item references no longer line up. Ask for a fresh link.Go to the planner"
   [banner] = "Item data failed to load. 500 Internal Server ErrorLoad fixture items"
PROBE C catalog.status = error
PROBE C catalog.error = 500 Internal Server Error
PROBE C screen = "That link could not be readThis link was made against a different build of the item catalog, so its item references no longer line up. Ask for a fresh link.Go to the planner"
   [banner] = "No item catalog published yet. The planner expects data/items-index.json and per-slot shards under data/items/. Until the data pipeline publishes them, slots will have nothing to offer. Everything else — characters, sets, upgrade levels, weights, share links — works now.Load fixture items"
PROBE D catalog.status = missing
PROBE D screen = "That link could not be readThis link was made against a different build of the item catalog, so its item references no longer line up. Ask for a fresh link.Go to the planner"
   [banner] = "Shared set. This is someone else's plan, opened read-only. Save a copy to edit it in your own library.Save a copy"
PROBE E catalog.status = ready
PROBE E indexNames.length = 3663
PROBE E screen (first 300) = "EQL SourceSurveyMenuDungeonsRaidsTools=IndexLearnAccuracySearchEQL Source / ​Tools / ​=Upgrades / ​Shared setHomeCharactersUpgradesPlanarItemsShared set. This is someone else's plan, opened read-only. Save a copy to edit it in your own library.Save a copyAAvenrae50 BRD/WAR/BER◆Main SetGearExaltation"

git status --porcelain -> (no output; tree clean, probes removed)
```

</details>

## F28 — PARTIAL

**What a reader sees.** A reader who has set a race sees nothing wrong — the gate flips correctly (usable→blocked, "This loadout cannot equip it", verified by render). A reader who leaves race unset — the default for a new character — is shown up to 124 race-narrowed items as usable and rankable, which HANDOFF.md already calls "a wrong recommendation"; but that reader has been told, in the same dialog where they declined to pick a race, that unset narrows nothing, and the item window prints the item's race list two lines above the verdict. So the false-feeling sentence reaches only a reader who chose not to supply the field, on a rule the app discloses. The one undisclosed surface is the set/upgrades side: SetWorkspace prints the race only when it is set, so there is no "race unset" reminder next to "Usable by this loadout" there the way PlanarGear has one.

**Where the finding was wrong.** Accurate: with ctx.race null, canUseRace returns true for every race-narrowing list, and a rendered ItemWindow prints "Usable by this loadout" over an item whose own Requirements block reads "Race BAR TRL OGR" (measured). Wrong in three respects: (a) the location — character.ts:234 is inside readRestriction; the null branch is line 268 of canUseRace; (b) "skips the race gate entirely" is false — the NONE branch is checked before the null check, so 84 shipped records with ra ["NONE"] are still refused with race unset; (c) "items the character's race cannot wear" presumes a race the model does not hold. Unset is an explicit user choice ("Unset" is the option text) and the app states the rule at the point of choice ("Leaving it unset does not narrow anything") and again on PlanarGear ("race unset, so race does not narrow anything"). Scale, deduped over the shipped payload: 164 of 3,663 items are race-narrowing; for a WAR/BRD/BER 50 loadout 124 of those read usable with race unset and blocked for at least one of the 15 races. This is the behaviour a shipped unit test pins and HANDOFF.md records a ruling on.

**Smallest fix.** Do not touch character.ts:268. Making unset refuse race-narrowed items would flip 124 items to blocked for every raceless character — a ranking-behaviour change that contradicts the shipped test "does not narrow on race when the character has not set one" and the Director's standing rule in HANDOFF.md. The narrow fix is presentational and touches no ranking behaviour and no persisted or published shape: carry PlanarGear.tsx:550's existing sentence ("race unset, so race does not narrow anything") onto the surfaces that print the verdict for a raceless context — ItemWindow's verdict line (ItemWindow.tsx:313) and/or the SetWorkspace header (SetWorkspace.tsx:124, which today shows race only when set).

> **Closed.** Eligibility is untouched — narrowing on a field the player declined to fill in would have hidden ~150 items from 12 of 15 races for nothing. `raceUnjudged` (beside `canUseRace`, same `readRestriction` ladder) answers the opposite question, and `usabilityOf` gained a `race-unknown` state that only the claim-making surfaces honour: neutral tint, and a note naming the check that did not run. This record's "one undisclosed surface … the set/upgrades side" is covered by that, since the tint and the item window reach it. See the CLOSED note under F28 in `AUDIT-UPGRADES-SURFACE.md`.

<details><summary>Commands run, and what they returned</summary>

```
1. sed -n '258,272p' (via grep -n) /home/user/EQL50ups/web/src/engine/character.ts   # read canUseRace
2. grep -n "" /home/user/EQL50ups/web/src/engine/character.ts | sed -n '230,240p'   # what is actually at the claimed line 234
3. node -e "<walk web/public/data/**/*.json, dedupe items, classify each item.ra as unrestricted / NONE / ALL_EXCEPT / explicit list>"   (run from /home/user/EQL50ups)
4. Throwaway vitest probe (written to /tmp scratchpad, run from web/, deleted after):
   cd /home/user/EQL50ups/web && npx vitest run --config /tmp/.../f28.config.ts f28.probe
   - loads every shard in web/public/data/items through the app's own normalizeItem
   - calls canUseRace / usabilityOf / usabilityNote with race null vs concrete races
   - mounts <ItemWindow .../> with createRoot+act in jsdom and reads document text
   cd /home/user/EQL50ups/web && npx vitest run --config /tmp/.../f28.config.ts f28b.probe   # deduped corpus counts
5. cd /home/user/EQL50ups/web && npx vitest run src/engine/character.test.ts
6. sed -n '95,135p' /home/user/EQL50ups/web/src/screens/NewCharacter.tsx ; sed -n '540,595p' .../PlanarGear.tsx ; sed -n '4258,4300p' /home/user/EQL50ups/HANDOFF.md
7. git status --porcelain   # empty: no tracked file touched, probes deleted
---
(2) character.ts:234 is `return { kind: 'except', codes: list.filter((v) => v !== 'ALL_EXCEPT') };` — inside readRestriction, not canUseRace. canUseRace is 261-270; the null branch is line 268: `if (!ctx.race) return true; // race unset: don't narrow on it`, preceded by line 267 `if (reading.kind === 'none') return false;`.

(3)+(4b) unique items across shards: 3663
ra kinds: {"unrestricted":3415,"none":84,"except":59,"only":105} | race-narrowing (except+only): 164

(4a) ONLY Large Banded Sleeves ra= ["BAR","TRL","OGR"] cl= ["WAR","BRD",...]
  canUseRace unset/HUM/OGR = true false true
  usabilityOf unset/HUM/OGR = usable blocked usable
  usabilityNote unset = "Usable by this loadout" | HUM = "This loadout cannot equip it"
EXCEPT Fiery Vambraces ra= ["ALL_EXCEPT","IKS"]
  canUseRace unset/IKS/HUM = true false true
RENDER unset: usable-note = true | cannot-equip = false
RENDER unset: Race field snippet = "RaceBAR TRL OGRWeight"
RENDER HUM: usable-note = false | cannot-equip = true

(4b) unique items reading USABLE with race unset but BLOCKED for >=1 race (WAR/BRD/BER 50): 124
per race: {"HUM":85,"ERU":85,"ELF":83,"HIE":85,"DEF":85,"HEF":85,"DWF":85,"HFL":85,"GNM":85,"KER":85,"FRG":85,"IKS":88,"TRL":2,"OGR":2,"BAR":2}

(5) Test Files 1 passed (1) / Tests 37 passed (37) — including "does not narrow on race when the character has not set one" and "refuses a NONE race list whether or not the race is known".

(6) NewCharacter.tsx:119 `<option value="">Unset</option>`, hint at :131 "Race is optional ... Leaving it unset does not narrow anything." PlanarGear.tsx:550 prints "· race unset, so race does not narrow anything". HANDOFF.md:4274 "Race left unset narrows nothing. So a Gnome, Human, ... had no way to say so, and was then shown Barbarian/Troll/Ogre-only armour as an upgrade" — and the ruling recorded there is that the fix was the pinned 15-race vocabulary (RACES in constants.ts), not a change to the gate.

(7) git status --porcelain: (no output)
```

</details>

## F31 — HOLDS

**What a reader sees.** Real, but bounded to three items and a short window. Measured: a level-10 character is offered "Refugee Shroud" (required level 15) in the Shoulders picker, and its detail dialog prints "USABLE BY THIS LOADOUT" with no Level row, until SHOULDERS.json lands — after which the item drops to "0 matches". The Level row's absence is level-independent (`{item.rl ? …}` reads only item.rl), so for these three items every reader sees an item window missing its Level line pre-shard, at any level. Blast radius: exactly 3 of 3,663 index records carry rl in their shard — Baton of the Sky (PRIMARY, 49), Refugee Shroud (SHOULDERS, 15), Azarack Skin Wristwraps (WRIST, 46). The app's default new-character level is LEVEL_CAP = 50 (constants.ts:391), which clears all three, so the *gate* diverges only for a reader who has deliberately set a class below 49/46/15. The window is ~41 ms in the picker on a warm local preview (ensureSlot fetches one ~60 KB shard); it is materially longer on the ensureAll screens (Upgrades, Item Browser, Compare, Planar), where 1.6 MB of shards are in flight while the ranking has already painted — Upgrades.tsx:1676-1690 documents that same pre-shard paint for `src`.

**Where the finding was wrong.** Accurate as written; it simply states no scale. Worth attaching the scale: 3 of 3,663 records, all clearing the default level 50, so the gate itself diverges only for a deliberately under-levelled loadout; the missing Level row shows for every reader on those 3 items. Note also that build.mjs's own comment at 2144-2147 states the governing rule — "the picker ranks straight off the index before any shard has loaded" — as the reason wt, ra, statsUnknown, evidence and xo ride the index; rl gates eligibility in exactly the same code path (canUse → meetsLevel) and is the one field that rule was not applied to.

**Smallest fix.** Add 'rl' to INDEX_FIELDS in pipeline/build.mjs (the array at 2148-2160), then `node pipeline/build.mjs && node pipeline/verify.mjs` and commit the regenerated web/public/data/ — CI does not run the pipeline, so an uncommitted payload ships unchanged. This touches BOTH sensitive surfaces: it changes ranking behaviour (canUse's level gate fires during the pre-shard window, removing candidates that are currently offered) and it changes the published payload shape (items-index.json gains one field on 3 of 3,663 records; ~30 bytes on a 693 KB index). No web/ change is needed — normalize.ts:296 already reads raw.rl, mergeItems already lets the shard re-enrich, and ItemWindow's row is already conditional on the field.

<details><summary>Commands run, and what they returned</summary>

```
1) awk 'NR>=2141 && NR<=2166 {printf "%d\t%s\n", NR, $0}' pipeline/build.mjs
2) grep -n "'rl'\|\brl\b" pipeline/build.mjs
3) node -e "const j=require('./web/public/data/items-index.json'); const keys=new Set(); for(const it of j.items) for(const k of Object.keys(it)) keys.add(k); console.log('count',j.count); console.log([...keys].sort().join(' ')); console.log('items with rl in index:', j.items.filter(i=>i.rl!==undefined).length);"
4) node -e "const fs=require('fs');const p='web/public/data/items';let tot=0,withRl=0;const s=fs.readdirSync(p);for(const f of s){const a=JSON.parse(fs.readFileSync(p+'/'+f));const arr=Array.isArray(a)?a:(a.items||[]);for(const it of arr){tot++;if(it.rl!==undefined)withRl++;}}console.log('shards',s.length,'records',tot,'with rl',withRl);"
5) node -e "... same walk, printing each rl record's file/name/rl/sl and whether its id is in items-index.json ..."
6) sed -n 280,292p web/src/components/ItemWindow.tsx   (the `{item.rl ? (` Level row)
7) grep -n "export function canUse" -A 3 web/src/engine/character.ts
8) cd web && npm run build ; npx vite preview --port 4391 --host 127.0.0.1 --strictPort &
9) Four throwaway Playwright probes under /tmp/f31 (own config, testDir /tmp/f31, the repo's pinned Chromium, baseURL http://127.0.0.1:4391), run as:
   cd /home/user/EQL50ups/web && npx playwright test --config=/tmp/f31/pw.config.ts
   probe A: page.route('**/data/items/SHOULDERS.json') delayed 12s; create character level 10, class chip 0; open Shoulders picker (position index 5); search "Refugee Shroud"; dump rows, meta and the item-detail text.
   probe B (control): same character, no route delay, 4s wait for the shard, same search.
   probe C (control): level 50 character, shard loaded, equip the item, hover the Shoulders slot, dump the .iwin hover window.
   probe D (timing): level 10, unthrottled, measure ms from picker open to first row painted and to the ineligible row disappearing.
10) git status --porcelain | wc -l  (before and after; /tmp/f31 removed, preview killed)
---
(2) one hit only: pipeline/build.mjs:1564  `...(int(n?.required_level) != null ? { rl: int(n.required_level) } : {}),` — inside the DETAIL record builder. `rl` appears nowhere in INDEX_FIELDS.
(1) lines 2148-2160 = INDEX_FIELDS: id n ic sl cl ra st sv wp wt fl era av eraUnknown statsUnknown evidence an xo ex sd sdc vf — no `rl`.
(3) count 3663; index item keys: an av cl era eraUnknown evidence ex fl ic id n ra sd sdc sl st statsUnknown sv vf wp wt xo; items with rl in index: 0
(4) shards 19 records 4004 with rl 3
(5) PRIMARY.json null Baton of the Sky rl=49 sl=["PRIMARY"] inIndex=true
    SHOULDERS.json 177823 Refugee Shroud rl=15 sl=["SHOULDERS"] inIndex=true
    WRIST.json null Azarack Skin Wristwraps rl=46 sl=["WRIST"] inIndex=true
(6) ItemWindow.tsx:284 `{item.rl ? (` … `<i>Level</i>` — the row is conditional on item.rl alone.
(7) character.ts:369 `canUse = canUseClass && canUseRace && meetsLevel`.

probe A (SHOULDERS shard held 12s, character = level 10 Warrior, item requires 15):
  PRE-SHARD rows: ["Refugee Shroud\nCLASSIC\nATTUNEABLE\nLORE\nAC +2 · MANA +10 · CHA +4 · MR +3\n4.8 EP"]
  PRE-SHARD meta: Loading item data…
  PRE-SHARD detail text:
    Refugee Shroud … REQUIREMENTS
    Class ALL
    Race ALL
    Weight 0.2
    USABLE BY THIS LOADOUT
  (no Level row; the dialog states the item is usable)

probe B (same level-10 character, shard loaded):
  POST-SHARD meta: 0 matches
  POST-SHARD rows: []
  LVL50 rows: ["Refugee Shroud … Blackburrow · Refugee Splitpaw (Monk)\n4.8 EP"]

probe C (level 50, shard loaded, hover window):
  … REQUIREMENTS
  Class ALL
  Race ALL
  Level 15
  Weight 0.2
  Size SMALL
  USABLE BY THIS LOADOUT

probe D (unthrottled, local preview, warm payload):
  rows painted at 97 ms after picker open; ineligible row vanished at 138 ms   → a ~41 ms pre-shard window locally

(10) git status --porcelain | wc -l → 0 (before and after)
```

</details>

