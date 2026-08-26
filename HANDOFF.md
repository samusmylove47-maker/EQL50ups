# Handoff — Session B (50 Upgrades) ⇄ Director

Session B works this repository. Session A works `eql-source` (the website). The two
sessions cannot see each other; everything that crosses between the repos comes through
the Director, and **nothing in this file may assert anything about `eql-source` that the
Director did not say.** The live site at `eqlsource.com` is public and may be observed —
observing what it serves is not the same as knowing what is in its repository, and this
file keeps those apart.

**The exchange is transient; decisions graduate.** When a ruling is applied it moves into
*Standing* and is deleted from the exchange, so what is left below is only ever live.

---

## Standing

Applied rulings and durable rules. These are settled — do not reopen them, and do not
"finish" anything recorded here as deliberate.

### Working rules

- **Cross-repo architecture decisions go to the Director first.** Two sessions that cannot
  see each other will otherwise solve the same problem twice, differently.
- **Everything known about `eql-source` comes through the Director.** Never assert
  something about that repository that was not stated here.
- **One push at a time.** `deploy.yml` sets `concurrency: {group: pages,
  cancel-in-progress: true}`, so a second push inside the build window cancels the first;
  if that second push fails `tsc` or `vitest`, neither deploys and the live site is older
  than both. No second push until the etag moves.
- **Verify against the live deploy, not the suite.** Pages serves HTML with
  `max-age=600` and the edge ignores cache-busters — poll the etag before asserting
  anything. Every verification `curl` reads `%{http_code}`: the SPA fallback returns the
  full landing page with HTTP 404 for any missing path, so `curl | grep` will happily
  match against a 404 body.
- **Grep the bundle, not the shell.** User-visible strings live in `assets/index-*.js`;
  `index.html` is scaffolding. Any check that greps the shell for content is unsound.
- **Fan out reading, never writing.** If outputs must agree with each other, one session
  writes them all. Never fan out anything that regenerates `web/public/data` — one writer,
  one pipeline run, then `git diff --stat web/public/data` before committing.
- **Before any push that touches rendering:** `VITE_BASE=/EQL50ups/ npm run build && npx
  vite preview`, browse the sub-path, watch for zero `pageerror`.
- **Report with evidence, not conclusions** — path, line, quoted text — and give the
  command that produced every number.

### Design decisions

- **The display ceilings sit below the site's, permanently.** `--fs-title` stops at 56px
  and `--fs-hero` at 84px against the site's 90px and 104px. The site's hero type is doing
  brand work; this tool's is doing wayfinding inside a working surface, and matching them
  would make the planner shout where a reader has come to concentrate. A tool frame a step
  below the site's display scale is correct rather than incomplete. Recorded at the tokens
  themselves so no future session "completes" it. *(Director, 2026-08-18.)*
- **The four −0.5px reading rungs stay as they are.** `--fs-small`, `--fs-body`,
  `--fs-mid` are half a pixel under the site's ladder. Half a pixel is below what a reader
  perceives, and moving four tokens reflows every screen for no perceptible gain.
  *(Director, 2026-08-18.)*
- **`--fs-heading` stays at 17px until a layout change pays for it.** Closing it to the
  site's 18.5px pushes the paper doll's `-webkit-line-clamp` onto a vertically cut line at
  1100px. The measurement is recorded at the token so nobody retries it blind. A ruling
  that breaks the paper doll is a wrong ruling. *(Director, 2026-08-18: revert accepted.)*

### Type scale and wayfinding

- **`--fs-mark` is the wordmark's rung, at the site's 18.5px; item names stay at 17px.**
  One token sizing both was a second source of truth in CSS form, and its two consumers
  are width-critical in opposite directions — which is why closing the shared rung cut the
  paper doll. Splitting it closes the mark to the site's size and moves `SURVEY` 11.59px
  right (measured at 1440, not the 13px first reported), with the doll's clip probe still
  passing. 18.5px is listed in `TYPE_SCALE_FIXED`, so it is a step rather than an
  exception. *(Director, 2026-08-18: approved post-drop; applied.)*
- **The breadcrumb carries the current screen**, three segments on the landing and four
  below it, and the tool's name becomes a link once it is no longer where you are.
  `screenName` has no `default` case, so a route added to `Route` fails `tsc` rather than
  arriving one level short. *(Director, 2026-08-18: approved post-drop; applied.)*

### Theme

- **The planner stays dark. eqlsource's light/dark theme is not being followed.** Mine to
  call; called 2026-08-20 and **re-examined the same day** against the prover Session A
  built. Unchanged, with one reason withdrawn rather than quietly kept.
  - *Retired:* "a theme I cannot prove is AA in both modes publishes a contrast failure
    quietly." The prover exists now. Checked our own AA walk against its four lessons —
    alpha compositing and zero-examined were already done (the second reached
    independently), the `background-image` lesson does not arise here (0 gradient or image
    declarations across 13 stylesheets, measured), and only "set the ground before the
    document exists" was a real gap, and only in a world where we theme.
  - *What carries it:* eqlsource keeps its own imported tools dark and says so, making
    dark the site's convention for a tool rather than an exception — following would make
    the planner the odd one out *among tools*. And it is a working surface kept open beside
    a fullscreen client, usually at night, which is about use rather than branding.
  - *Cost, unchanged:* 49 of 95 custom properties are colours; **20.0s** of contrast
    walking across two checks, all of it doubling; 3 test files assert literal colours; the
    focus-ring checks read drawn pixels and need both grounds.
  - The extraction is already complete — 0 colour literals in any declaration — so the
    door costs nothing to leave open and nobody should prepare for it. Recorded at
    `tokens.css` so no future session "completes" it.
- **The theme landing changes the drift check, not the rendering.** Nothing here loads
  `site.css`; the chrome is our own CSS and self-hosted fonts. When
  `site-foot-drift.test.ts` goes red on the merge, that is the check working: wait, re-copy
  once, re-pin. Do not disable it and do not pre-copy. *(Director, 2026-08-20.)*

### Auditing checks

- **`tools/check-audit/` is the method, and it is portable.** Damage the subject, run the
  check alone, restore, count what was examined; zero examined exits non-zero. Generic
  operators cannot reach a string constant, so a generic survivor is `UNPROVEN` and needs a
  written damage before anyone calls it `DEAD`. Restoration is by in-memory content and a
  hash comparison, never `git checkout` — an audit runs in a dirty tree by definition.
  `README.md` also carries the five shapes of *vacuous pass*, which mutation cannot find at
  all. *(Director, 2026-08-20: write it up so another repository can run it.)*

### The catalogue's own provenance

- **`pipeline/catalogue-audit.mjs` verifies that the sourcing standard is actually
  applied**, and is a check rather than a report: a figure whose source cannot be named
  fails it. In CI beside the payload gate. Of 2,176 records printing numbers, 0 carry no
  standing. Rule 6 was being broken — four of five inputs were undated — and the date is
  now derived from git rather than typed, because a hand-written date is the first thing
  to go stale. *(Director, 2026-08-20: nobody had run this audit on either side.)*
- **The two limits are printed beside the green tick, deliberately.** A vendoring date is
  not a currency date; and 84.5% of records carry no Tier M existence evidence, shipping
  on a wiki's era placement. Both are rule 2 working as written, and both belong on screen
  rather than in a drawer.

### Auditing another repository

- **A verdict about a command that runs no code is not a finding.** `gate.py` has no
  `__main__`; `python3 scripts/gate.py` is silent and exits 0. It survived every damage and
  was reported UNPROVEN — a verdict that meant nothing, and was published. Every check now
  carries a `probe` that damages the checker's own source and requires red; a check that
  stays green while its implementation is broken reports `NOT_EXERCISED` and produces no
  other verdict. *(2026-08-21.)*
- **A checker with severities hides half its assertions from an exit code.** `check.py`
  prints `WARN` and exits 0. `failure_signal: "output"` makes the message the signal.
  *(2026-08-21.)*
- **Damages do not travel; the runner does.** Four wrong verdicts came from the damage, not
  the tool: a superstring replacement, a first-occurrence replacement, a damage that broke
  the build, and a damage judged on the wrong channel. Budget for the damages.

### The row says where its number came from

- **The Upgrades row carries the stat standing, not only the existence mark.** It named
  the sighting count and said nothing about where the EP came from — two independent facts,
  one of them missing, on the screen whose whole output is that number. Rule 5. Band and
  wording come from the shared `sourceStanding`; tier-5 tints, tier-2 does not, because
  2,045 of 2,176 records that print numbers are tier-2 and a colour every row shares is a
  wash. *(2026-08-22, found while designing the band image.)*

### Environment

- **A test that fetches must opt out of `jsdom`, or it is not fetching.** jsdom supplies
  its own `fetch` and it ignores this container's proxy; the call returns HTTP 403, which a
  reachability check cannot tell apart from the site being down. Both drift checks were
  skipping on that and reporting passes. The two files carry
  `// @vitest-environment node` and `vitest.config.ts` names the variable Node's `fetch`
  needs before it will honour a proxy. Anything new that reaches the network needs the same
  pragma. *(2026-08-18.)*
- **No headless browser in this toolchain reaches an external host; only `curl` does.**
  Three sessions hit this independently. Geometry and type are checkable against a local
  build; the network hop is not; a local mirror of the far side is the accepted substitute,
  and the substitution is stated when reporting. Recorded once, in `CLAUDE.md` §5, so the
  next session does not rediscover it. *(Director, 2026-08-18.)*

### Design decisions — the map

- **The equipment map reproduces the game's Equipment tab, cell for cell.** Six columns,
  four rows, 23 positions, row 1 indented by one, the three doubled slots mirrored to the
  outside. It was a 5x7 anatomical silhouette with a decorative SVG body behind it —
  invented, not observed. The silhouette is removed rather than adapted: the panel's job is
  to be recognised by someone who has just alt-tabbed out of the client. Recorded as
  capture 8 in `research/validation/TIER0-VALIDATION.md`. *(Director, 2026-08-18.)*

### Payload contract

- **`slots.positions.total` is the field a reader-facing slot count comes from.** It is 23.
  `slots.worn` is a list of 18 slot *types* and answers a different question; 18 + 2 = 20 is
  the arithmetic presumption gives, because three types are worn twice. Published
  2026-08-18 with `worn`, `any`, `types`, `doubled` and a note, so the number never has to
  be derived again. `verify.mjs` asserts the arithmetic closes and a vitest asserts the
  payload agrees with the app's own `TOTAL_POSITIONS`. *(Director, 2026-08-18.)*

- **`slots.types` holds the 18 type codes.** The key was `worn` while a character wears 21
  — the field name described a different quantity from its contents. `positions.worn` is
  the 21. **BREAKING for anyone reading `slots.worn`.** *(Director, 2026-08-18.)*

### The site's tool index

- **The footer copies the site's six-tool state, and a test holds it there.**
  `SITE_TOOLS` is the `Tools` column of the footer `eqlsource.com/tools/` serves, in its
  order, and `site-foot-drift.test.ts` checks the copy against the original the same way
  `site-nav-drift.test.ts` checks the masthead. Three withdrawn URLs are pinned by name
  because they 301 rather than 404, so nothing else here would notice one typed back in.
  *(Director, 2026-08-18: item 1, applied.)*
- **This tool lists itself, marked `aria-current="true"`.** `/tools/50-upgrades` is a real
  200 and a different document from the planner — the site's page *about* it — so the link
  goes somewhere the reader is not. `"true"` and not `"page"`: the current item of a set,
  not a claim that the href's target is the document being read.
- **The prose references went with the links.** A withdrawn page named in a comment or an
  eyebrow is invisible to every link checker there is. The exception is the dated citation
  in `planarSets.ts`, which keeps its URL on purpose: a read of a page that existed on the
  date given is the record, and deleting it would leave the eighteen set names looking
  unsourced.

### Sourcing

- **No content licence is asserted.** `eqlwiki` publishes none — checked 2026-08-18;
  `siteinfo` `rightsinfo` empty, `Project:Copyrights` absent. Credit and the trademark
  disclaimer stay; the terms go, and their absence is stated rather than left blank.
  `verify.mjs` asserts `license.content === null` plus the date and method, so the
  correction cannot be reinstated by accident.
- The full standard lives in `research/SOURCING-STANDARD.md` and governs every number the
  planner puts on screen.

---

## From the Director

### Live — orders of 18 Aug

1. **The footer.** Copy once from the final six-tool state and add the drift check in the
   same commit. *Applied; graduated to Standing.*
2. **Split `--fs-heading`,** so the wordmark and item names stop sharing a size, and make
   the breadcrumb carry the current screen. Serial if the files are not disjoint.
   *Applied; not disjoint, so done serially by one. Graduated to Standing.*
3. **Deploy discipline.** Pushes serialize; never assert done until the live etag moves;
   grep the served bundle, not the shell. *In force; recorded in Standing → Working rules.*
4. **Licence: proposal only, adopt nothing.** *Applied — `research/LICENSING-PROPOSAL.md`,
   unsigned, no `LICENSE` file, no existing file changed.*

**Parked, not started:** `upgrades.eqlsource.com` and the `VITE_BASE` change it implies;
the `=50Upgrades` mark. A slot is left for the mark and nothing has been drawn.

## To the Director

## 26 Aug — you asked if one is sitting unexamined in the planner. Yes. Five.

Ranked by how closely each matches the shape you named: *a number everyone repeated that
nobody read off the game.* Every figure below was computed here; the command is named beside
it. Nothing in this section is taken on a subagent's word — where a helper's count and mine
disagreed, mine is printed and the disagreement is stated at the end.

### 1. Exaltations do not stack — and it is the lockout timer almost exactly

`web/src/engine/exaltation.ts:114-136`. `dedupeByFamily` collapses a set's effects to the
highest rank in each family, so `Improved Healing I` next to `III` is struck out on screen.

Its entire provenance is one parenthesis, `research/github-data-inventory.md:86`:

> "**Exaltations do not stack** — only the highest rank in a family counts … *(This no-stack
> claim is sourced to Thiole's reading of the wiki; jmoyers does not restate it.)*"

Three things make this the one I would examine first:

- **It is classic EverQuest's focus-effect rule, down to the family names.** `Improved
  Damage`, `Mana Preservation`, `Reagent Conservation` are original-EQ focus families, and
  "same type does not stack, one applies" is original-EQ behaviour. `SOURCING-STANDARD.md`
  says of that wiki that large parts are *"a Project 1999 import, sometimes word for word."*
- **The same file that supplies the rule disowns the source.** `github-data-inventory.md:66`
  ends: *"**Use jmoyers. Do not use Thiole's math.**"* — written after documenting that this
  author's scaling model was wrong in three ways and had negative stats backwards. We ruled
  the source unreliable for arithmetic and then took its stacking rule without a word.
- **Nothing has ever read it off the client.** No capture in `TIER0-VALIDATION.md` shows two
  same-family effects on one character. It is Tier 5, single-source, uncorroborated.

**And the code contradicts itself on the same rule.** Rank is parsed as a trailing Roman
numeral (`exaltation.ts:122`). The client prints both notations — `TIER0-VALIDATION.md:143-144`
shows `Focus Effect: String Resonance 11` beside `Click Effect: Rune IV` — and the payload
carries 29 arabic-suffixed effect names, 14 of them the bard resonances. Run against the
shipped regex (`node scratchpad/rank.mjs`):

```
Improved Healing I/II/III                                -> 1 survivor   (collapsed)
Wind Resonance 0 / 10 / 11 / 12 / 14                     -> 5 survivors  (five "families")
```

So the planner strikes out the Roman ranks and keeps five ranks of one bard focus side by
side — and the bard instrument modifier is the case `TIER0-VALIDATION.md:149` calls *"the
user's stated requirement."* Whichever way the stacking rule resolves, one of these two
screens is wrong today.

**What it costs if wrong:** the whole "Effects on this set" panel, every *"does not count"*
line, and the tab's central advice — spread families rather than double up. That advice
reverses.

### 2. A rule graded Tier M whose own evidence file holds nine counterexamples

`EXALTATION_LADDER` (`exaltation.ts:32-38`) says sockets are a function of `+N` and nothing
else — Focus at +1, Click at +2, Worn at +3, Proc at +4. `TIER0-VALIDATION.md` grades it
**"Sockets are derived from item level — confirmed. Nothing per-item to look up."**

I parsed the raw export against the coded ladder rather than reading the summary
(`python3` over `research/validation/tier0-inventory-Avenrae.txt`, grouping `<parent>-SlotN`
rows and filtering sub-slot sets to ⊆ {1,2,7,8,9,10} to exclude bags):

```
exaltable (+N) items parsed from the export        : 115
sockets the ladder predicts, absent in the export  :   9
sockets present EARLIER than the ladder predicts   :   0

  +4  no Slot8   Chipped Bone Rod +4        shows [7, 9, 10]
  +5  no Slot8   Nightmare Hide +5          shows [7, 9, 10]
  +5  no Slot8   Wand of Allure +5          shows [7, 9, 10]
  +2  no Slot8   Wand of Conflagration +2   shows [7]
  +4  no Slot8   Wand of Darkness +4        shows [7, 9, 10]
  +5  no Slot8   Wand of Lava +5            shows [7, 9, 10]
  +4  no Slot8   Wand of Souls +4           shows [7, 9, 10]
  +4  no Slot8   Wand of Swiftness +4       shows [7, 9, 10]   (x2)
```

Nine items, all wands and rods, all missing the **Click** socket at a tier that predicts it.
Zero counterexamples in the other direction, so the ladder is a solid *floor* — it is the
"and nothing else" half that the evidence does not carry.

**A correction, against my own interest:** the player's ruling at `TIER0-VALIDATION.md:152-157`
— *"do not model this … makes no claim about exact per-item socket counts"* — does cover the
modelling decision. So this is not an un-taken ruling. What it does not cover is the grade:
the file still prints **confirmed** two pages earlier, and `exaltation.ts:25-26` still says
*"confirmed against … sub-slot numbering in an inventory export"* — the same export. The
defect is that a Tier M grade was awarded without the nine rows being read. That is the
lockout failure in miniature: the reading existed and nobody finished it.

Also unmeasured: **44 of those 115 items show no ornamentation sub-slot at all**, while the
ladder gives every item one from +0. `functionalSocketsFor` hides it, so the blast radius is
small — but it is another row of the same table that the export does not support.

### 3. The haste cap our own source names, that no line of code applies

You already have the haste *stacking* assumption — `stats.ts:81` declares itself, which is
the standard I would want everywhere. The unexamined one is next to it. `research/eql-itemization.md`:

> **[SINGLE-SOURCE (eqltools/eqlwiki Haste Guide)]** … Total haste capped **~50% below L30,
> ~75% at L50**; only the highest worn-haste item counts; item/spell/song haste of different
> types stack …

We took the middle clause and left the first and third. `stats.ts:58` quotes the cap back at
the reader — *"flat attack-speed values under a level-scaled cap"* — inside a constant whose
whole job is to say what is unknown. Then nothing caps it: `grep -rn "HASTE_CAP\|hasteCap"
web/src` returns no cap anywhere, and `withCap` is wired to `ATTRIBUTE_CAP`, `RESIST_CAP`, the
heroic mods and the skill-damage mods — every capped stat on the client's panel except this one.

Measured over the shipped payload (`node` over `web/public/data/items/*.json`, deduped on
`(name,id)` to the 3,663 records):

```
items carrying HASTE : 23   values 9,10,15,16,21,26,31,36,41
positions            : WAIST 18 · HANDS 2 · PRIMARY 2 · BACK 1
top haste at +10     : Belt of the Four Winds 41 -> 51, x HASTE 2 = 102.0 EP
best PRIMARY at +10  : Cudgel of the Fool 1.731 ratio, x RATIO 40 = 69.2 EP
```

Under the shipped Melee DPS preset a haste belt is the largest single EP any item can earn —
larger than the best weapon in the game. **And this planner plans trios.** If the cited source
is right that item, spell and song haste stack toward one ceiling, a trio holding a Bard,
Shaman or Enchanter is at or near that ceiling before it equips anything, and 23 items are
ranked at the top of the list for a gain that partly or wholly does not land. The sampled
character in `TIER0-VALIDATION.md` §6 is Bard/Warrior/Berserker.

The cap's absence is recorded nowhere — not in `KNOWN-DATA-ISSUES.md`, not here, not in a
comment. It is the only combat stat on the panel with no denominator.

### 4. `ARMOR_TIER` — sixteen hand-typed numbers, no source, refuted by our own catalogue

`web/src/engine/constants.ts:26-35` places `BRD: 3` (chain) and `BER: 4` (plate). Tallying
plate-named records that carry an explicit class list (n=83, `node` over the payload):

```
SHD:64  BRD:63  WAR:60  PAL:59  CLR:55  RNG:22  SHM:18  ROG:17  BER:2
plate-named and BRD-only: 8   (Imbrued Platemail Vambraces / Breastplate / Boots /
                               Gauntlets / Helm, Lambent Breastplate, …)
```

Bards appear on more plate-named records than Paladins or Clerics; Berserkers appear on two.
The table says the reverse of both. And the Tier M export closes it — the character wears
**Imbrued Platemail Boots**, `cl: ["BRD"]`, plate restricted to Bards alone.

**Blast radius today is zero, and that is the only thing saving it.** `grep -rn
"armorTier\|ARMOR_TIER" web/src` returns `constants.ts`, `character.ts` and
`character.test.ts` — no screen, no selector. It is dead code kept alive by its own unit
tests. It is a trap for two reasons: `character.ts:267` already cites it as precedent to
justify finding 5 below, so a wrong rule is load-bearing as an *argument*; and it is exported
beside `ATTRIBUTE_CAP` and `RESIST_CAP`, which are genuinely Tier M, in a neighbourhood that
lends it credibility it has not earned. My recommendation is to delete it — there is no
evidence Legends has a proficiency gate separate from the per-item class lists `canUseClass`
already enforces.

### 5. `levelCheck` takes the highest class level; our research says the effective level is the lowest

`character.ts:261-294` checks an item's requirement against the **highest** qualifying class,
and its comment derives that from *"the same 'best of the trio' rule armour proficiency
already follows"* — i.e. from finding 4, which has no source. Meanwhile
`research/eql-game-systems.md:279`:

> **Confirmed:** your **effective level is the lowest of the three class levels**.

The corpus has a two-part rule — caps take the highest, level runs at the lowest — and the
engine applied the "highest" half to a level check. Neither branch has been read off the
client. Original EQ has one level, so this rule was not inherited; it was *invented* to fill a
hole EQ left, which is the same failure one step removed.

Today it moves **3 rows**: `node` over the payload finds exactly three records carrying `rl` —
Baton of the Sky (49), Refugee Shroud (15), Azarack Skin Wristwraps (46). `levelCheck` sits
inside `canUse`, which gates every ranking, auto-fill, the item browser and the planar sets.
**A patch that populates required levels turns a dormant assumption into a wrong answer on
every list at once**, which is the property that makes it worth settling before it matters
rather than after.

---

### Two code defects found on the way — neither is a sourcing question

**(a) `setDiff` credits weapon ratio in slots that cannot swing.** `gear.ts:366` and
`Upgrades.tsx:337` read `slot === 'PRIMARY' || slot === 'SECONDARY'`, matching
`computeTotals`. `setDiff.ts:181` and `:363` read `view.position.type !== 'ANY'`, which admits
all eighteen slot types — RANGE and AMMO included. The doc comment three lines above states
the correct rule in prose. `gear.ts:355-363` records that this exact bug already shipped once
and was fixed *on the ranking side only*.

Measured: 94 RANGE and 11 AMMO records carry `wp.dmg` + `wp.dly`. **Throwing Boulder is
36/35 = 1.029 — a higher ratio than any primary weapon in the game** (best PRIMARY: Cudgel of
the Fool, 0.865). Under Melee DPS that is **41.1 phantom EP at +0 and 82.3 at +10**, credited
into the Compare screen's per-slot column and its headline set total, for a contribution the
stat panel on the same screen refuses to show and the Upgrades screen scores at zero. No test
covers it — `setDiff.test.ts` mentions neither RANGE nor AMMO.

**(b) `FLAT_KEYS` scales two stats the cited rule table calls unchanged.** `upgrade.ts:1-6`
says the module is reimplemented from `github-data-inventory.md` §2.1. That table, line 56:

> `| **unchanged** | heroic stats, Attack, Dmg Bon, Backstab, Range, Size, … | untouched |`

`stats.ts:190` puts `'ATTACK'` in `FLAT_KEYS`, and `stats.ts:283-287` runs every skill-damage
mod through `scaleFlat`. `scaleFlat`'s own docstring still says *"the three regens and worn
haste"*; the reference implementation we are told to follow agrees —
`research/mechanics/jmoyers-itemUpgrade.ts:160` has no ATTACK. Measured: **0 items carry
ATTACK** (inert), **4 carry BACKSTAB**, the largest Serpent's Tooth at 13, which this engine
prints as **23 at +10** against a Tier M cap of 125. Small today; it will not announce itself
when `build.mjs` starts picking Attack up from a source, which it already parses.

I have written neither fix. Both are in your gift; (a) is one word with a measured 82.3 EP
consequence and needs no new source.

---

### The cap-aware claim — and a number of my own I have to withdraw

`ep.ts:5-8` advertises *"Unlike the tool this is modelled on, scoring is **cap-aware**"*, and
`setDiff.ts:10` calls it *"the one idea that is this product's own."* There is a structural
mismatch under it, and I read it wrong the first time.

**The mismatch is real and is plain in the code.** `already` reaches the scorer as
`scoreContextFrom(totalsFor(...))` — `computeTotals`, which sums **gear only**. It is compared
against `ATTRIBUTE_CAP = 510`, which `constants.ts:88-96` documents as read off the client's
Stats window (`Strength 304/510`) — a **whole-character** ceiling that includes race and class
base attributes. Gear-only totals are being measured against a bar that gear alone does not
have to clear.

**Corrected measurement** (scratch vitest importing the engine's own `resolveItem`, one pass
per position over all 23 so doubled slots count twice and the two Any Slots take the
catalogue best; file removed after the run):

```
ATTRIBUTE_CAP 510 · RESIST_CAP 1000
  STR  gear-only max 511   REACHES CAP (by 1)
  WIS  gear-only max 541   REACHES CAP (by 31)
  DEX  487 · INT 475 · CHA 473 · AGI 453 · STA 442      short by 23-68
  SV_COLD 682 · DISEASE 661 · FIRE 634 · MAGIC 600 · POISON 585 · VOID 229   cap 1000
  AC 934 · HP 2670   (no cap is passed to `creditable` for either)
```

So: the **save** branch cannot fire at all — the best conceivable set reaches 682 of 1000.
Five of seven attributes cannot reach 510 either. STR and WIS can, but only at an upper bound
that wears the single best-for-that-stat item in all 23 positions at +10, and STR clears it by
one point. The honest verdict is not "it never fires" — it is **"it is unreachable for all six
saves and five of seven attributes, and reachable for the other two only in a corner no real
set occupies."** The feature the product names as its own idea is, in practice, the haste rule
plus dead code.

**The withdrawal.** I measured this once before and told myself STR 376 / WIS 405, *nothing
reaches 510*. That was wrong. It took the best item per **slot type** (18) instead of per
**position** (23), so it silently dropped the second ear, the second wrist, the second finger
and both Any Slots — five positions, and the reason the number moved by 135 on STR. The
direction of the finding survives; the figure did not, and the figure is what I would have
been quoting. I also flagged a `SAVE_CAP` that resolved `undefined`: there is no such
constant, saves use `RESIST_CAP`, and the corrected run above uses it.

---

### On the four helpers I sent reading

Read-only, no writes, and I checked every headline before printing it. Their **counts did not
reproduce**: haste 46 against my 23, secondary weapons 424 against 212, AMMO 22 against 11,
BACKSTAB 8 against 4 — several of them exactly double. There is a byte-identical second copy
of the payload at `web/dist/data/items` (gitignored build output, verified identical: 3,663
records, 23 haste, 94 RANGE-with-`wp` in both), which would double a scan run from the repo
root — though it does not explain every figure, so I am naming the discrepancy rather than
diagnosing it. Two substantive claims of theirs I checked and dropped: that `git log -S"RATIO:
40"` returns one commit (it returns five), and that the player's "do not model this" ruling
does not cover the nine wands (it covers the modelling; it does not cover the grade). **Every
number in this report is mine.**

One thing they raised that I am *not* calling a finding: `RATIO` is `40` in Melee DPS
(`ep.ts:325`), `20` in Balanced (`ep.ts:351`) and `30` in `DEFAULT_IMPORTANCE`
(`gear.ts:54`) — three values, no citation, and a twelve-line defence of `HASTE: 2` sitting
directly above the largest of them saying nothing about it. But a weight profile is a
*preference*, and the app says so (`ep.ts:301`, and every weight is user-editable). I do not
think preferences are held to the sourcing standard, so I am recording it as a question for
you rather than as an unexamined game rule.

---

### 22 Aug — orders 1-3, delivered before your 25 Aug message arrived

All three were landed and pushed on 22 Aug, in commits `7d73118`, `9efbd52`, `7c29f90`,
`6678cbb`, `8221d92`. Nothing was waiting. In one line each, with the detail below:

- **Order 1** — reach measured at **23/42 = 54.8%**, ceiling **28/42 = 66.7%** after I
  withdrew my own 30/42. Patch, five constructible cases and two written refusals in
  `proposed/gate-selftest-reach/`; the meter ships with the number.
- **Order 2** — `research/LICENSING-PROPOSAL.md`, 377 lines to **200**, **three** questions.
- **Order 3** — `proposed/band-image/RECIPE.md`; **do not ship a PNG**, inline SVG generated
  at build time from the payload so every figure stays a `<text>` node our checks can read.
  The stat-standing chip that proposal was missing now ships.

### Order 1 — reach is 23 of 42, and the number changes the plan

Measured, not counted. `check.py` passes its own `fail`/`warn` into `gate.run`, so wrapping
those and recording the **caller's line inside gate.py** says exactly which assertions
fired. Denominator parsed from gate.py's AST — grep counts the string, the parse counts the
call. Runs on a copy; that tree is never written to. The meter ships with the number:
`proposed/gate-selftest-reach/measure-reach.py`.

```
gate.py assertion call sites : 42   (35 fail, 7 warn)   your counts, exact
cases run                    : 31   (29 CASES + 2 SPECIAL)
REACHED                      : 23   (23 fail, 0 warn)
NOT reached                  : 19   (12 fail, 7 warn)
reach                        : 23/42 = 54.8%
```

**Fixing `failures()` raises reach by zero.** Reach measures what fires, and no case makes
a warn fire. The patch changes what is *possible*; every point of gain comes from the new
cases.

**The severity filter is 7 of the 19 gaps.** Twelve `fail` assertions are unreached too and
the patch does nothing for them — including `L908`/`L939`, the `:root` and daylight token
blocks, which is the theme work in flight, and `L771`/`L774` on the TOOLS registry.

**A fairness measurement, because I would otherwise have misjudged the 31 cases.** 23 fire
a gate.py assertion; **8 fire none** — those cover `check.py`'s own assertions, a different
surface. Counting them as gaps would have been wrong.

**Two corrections to your brief, both small.** The filter is `gate_selftest.py:82` (76 is
the `def`, 77–81 the docstring). And "19 cases" is stale rather than wrong: `main` has
17 + 2 = 19, this branch has 29 + 2 = **31**.

### And a correction to myself, which I published before checking

I told you the patch plus seven warn cases reaches **30/42 = 71.4%**. It does not. **Two of
the seven warns cannot be proven at all**, so the ceiling is **28/42 = 66.7%**, and full
coverage of what is reachable is 40/42 rather than 42/42. Both verified here:

- **`gate.py:859`** — *index-data.json is missing*. `gate.py:245`, the second statement of
  `run()` and 611 lines earlier, does `IX = json.load(open(...))` with **no `try`**. Remove
  the file and `run()` raises there. Malform it and `json.load` raises `ValueError`, which
  the guard at 856 would not catch either — it is `except OSError`. Line 859 cannot execute
  under any damage to that file.
- **`gate.py:904`** — *site.css is missing*. `check.py:135` reads it at **module scope,
  unindented, no `try`**, 366 lines before `import gate`. Absent, `check.py` dies before the
  gate is imported: no FAIL, no WARN, and a case written for it reports `MISSED` — which
  reads as "the check is dead" when the harness never got that far.

Each is one small change from reachable, and the proposal names which. Neither is fixed by
the `failures()` patch. **The proposal declares them un-constructible rather than inventing
damages for them**, which is the standard I would want applied to my own work.

The patch, the five constructible cases and the two refusals are in
`proposed/gate-selftest-reach/PATCH-AND-CASES.md`. It also notes that **`check.py` has nine
`warn(` call sites of its own** which the same mechanism would make testable — the one at
621, *node is not on PATH*, being the only thing between "the tools were smoke-tested" and
"they were not and nobody said so."

### Order 3 — the band image, and a gap it found in the product

**My own proposal to you described a screen we do not draw.** I proposed "the ranked upgrade
list with its per-row source badges". `sourceStanding` was imported by `ItemWindow`,
`PlanarGear` and `Sources` — **not by `Upgrades`**. There was no per-row stat-standing
badge. That is the fault this project keeps catching in other people's work, committed in a
proposal for the band that leads the site.

The gap was real, older than the image, and independent of it: the row named the item's
*existence* evidence and said nothing about where its *stats* came from. Rule 5 says a
reader looking at a number is entitled to know, and the EP is the number that screen exists
to give. **The chip now ships.** Band and wording from the shared `sourceStanding`, so the
row cannot say something the item window does not; tier-5 tints and tier-2 does not, because
2,045 of the 2,176 records that print numbers are tier-2 and a colour every row shares is a
wash — the same argument the paper doll's tint already settled. Three tests pin it.

**On the constraint you asked me to answer plainly: do not ship a PNG.** A raster carrying
`+53.5 EP` is a typed number in a picture, and it is the one artefact `gate.py`, `verify.mjs`
and the catalogue audit are all blind to. The recommendation is **inline SVG generated at
build time from the payload, through the app's own engine** — every figure stays a `<text>`
node our checks can read, and a vitest recomputes the rows and compares. It must be inlined
rather than `<img src>`, or the self-hosted faces do not load.

Rejected, with reasons: PNG plus a sidecar JSON (nothing ties the sidecar to the pixels, and
CI cannot re-render); shape without figures (cheapest and never stale, but the band's whole
claim is that a *sourced number* reaches the screen).

That is why this is a recipe and not an asset: shooting the PNG would have been producing
the wrong artefact carefully. Full recipe — slot, four named candidates, frame order,
354px/44px geometry, crop rules, and what it must not show — in
`proposed/band-image/RECIPE.md`.

### Order 2 — three questions, 377 lines to 200

  Q1  the CODE                        permissive / AGPL / nothing
  Q2  the data that is OURS           CC BY / CC0 / no
  Q3  how "not ours" is communicated  machine-readable / prose only / withhold

Each option carries what follows from it in two lines. The compilation-and-database-right
discussion is gone rather than shortened, because it required the owner to be a lawyer.
Three buckets do the work: OURS, WIKI-DERIVED (not ours at any price), CLIENT-MINED. The
old fourth stratum — eqlsource's own datasets, already licensed to us on stated terms — is
settled rather than a decision, so it is now the appendix's precedent.

The silence is stated once, above the questions: eqlwiki publishes no terms, which is
neither permissive nor forbidden, and re-asserting a licence over wiki-derived material
stays off the table, CC0 included.

**Two stale figures dropped rather than carried.** The old draft's 31,240 and 6,079 line
counts do not reproduce; measured today, 84 non-test files / **31,586** lines under
`web/src` and **6,453** lines of `pipeline/*.mjs`. The scrape-intersection figures would
need re-indexing four raw scrapes, which was not run, so the appendix says they were not
recomputed instead of restating them. Zero tracked `LICENSE`, `COPYING` or `NOTICE`,
confirmed with `git ls-files`.

### State

Re-run 26 Aug, after this audit: `tsc` clean · vitest **910 / 60 files** · `verify.mjs`
**PASSED**, Tier 0 100.0% · catalogue audit **PASSED** · catalogue frozen, `git status
web/public/data` returns **0 files**. The 26 Aug section changed no code and no payload —
it is a reading, and the one file it touches is this one. The scratch vitest that produced
the cap ceilings was deleted after the run.

Previously, 22 Aug: `tsc` clean · vitest **910 / 60 files** · playwright **150** ·
`verify.mjs` **PASSED**, Tier 0 100.0% · catalogue audit **PASSED** · catalogue frozen,
**0 files** across every push. `eql-source` restored after every damage — `git status`
there is **0**, and nothing was written into it.

Still parked, not started: `upgrades.eqlsource.com` and its `VITE_BASE` change; the
`=50Upgrades` mark, slot left, nothing drawn.
