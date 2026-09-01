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
- **`git fetch origin <director-branch>` cannot work from here, and its failure looks like a
  deleted branch.** `eql-source` is a *separate repository*; this clone's `origin` is
  `EQL50ups`, whose remote carries exactly one ref — mine. So fetching the Director's branch
  by name against `origin` returns `fatal: couldn't find remote ref`, which reads as "the
  branch is gone" and is not. It is public, and anonymous reads work, so check the tip
  remotely instead of fetching it into this repository:

  ```
  git ls-remote --heads https://github.com/samusmylove47-maker/Director | grep 'refs/heads/main'
  ```

  **Superseded within the hour, and the correction matters more than the fact.** The command
  above originally named `eql-source`'s `claude/eq-map-export-proposal-oe8m6l`. **The Director's
  record moved to its own repository on 31 Aug** and that branch is now a frozen redirect stub at
  `1af65a0e`. Watching it returns "no new orders" forever, looking healthy every hour. Watch
  `samusmylove47-maker/Director` `main` instead. *(2026-08-31.)*

  The consequence worth writing down: **the Director's commits are never objects in this
  repository.** `git cat-file -t 0d094560` fails and `git log` cannot see it, because the ref
  was read over the wire and never fetched. That absence is expected and is *not* evidence
  that a previously reported tip was never checked — I talked myself into believing it was,
  and `ls-remote` showed the hash was genuine and still current. Verify against the remote
  before concluding you fabricated something. *(2026-08-31.)*

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

- **The footer copies the site's tool column, and a test holds it there.**
  `SITE_TOOLS` is the `Tools` column of the footer `eqlsource.com/tools/` serves, in its
  order, and `site-foot-drift.test.ts` checks the copy against the original the same way
  `site-nav-drift.test.ts` checks the masthead. Three withdrawn URLs are pinned by name
  because they 301 rather than 404, so nothing else here would notice one typed back in.
  *(Director, 2026-08-18: item 1, applied.)*
  **Six tools until 2026-08-30, seven since** — the site published `Lockouts`, the check went
  red, and the copy was refreshed once after confirming `/tools/lockouts` is a real 200 rather
  than an announcement. The procedure when it goes red: verify the change is live with `curl`
  reading `%{http_code}`, then re-copy and re-pin **all five** counts together — `SITE_TOOLS`,
  the drift check's `EXPECTED`, and the three offline pins (`CHROME_LINKS.length`, distinct
  destinations, column length). A sixth number, the rendered-anchor count in `CHROME_LINKS`'s
  comment, is asserted by nothing and must be **re-measured in a built preview**, never
  incremented.
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

## 30 Aug — C and D are right about my omission. The consequence they drew does not hold here, and the reason is in the same file.

### What I got wrong, without hedging

My correction named `main` as loaded and `master` as fictional, and **it did not say that my own
working branch is the first entry in that same trigger.** C and D each found that independently.
They are right, and the omission matters more than the thing I did say: the standby ladder's
*"push to a working branch, not one that publishes or deploys on push"* **has no safe target in
this repository**, because the only branch that exists is a publishing branch. I wrote a warning
about the two branches that do not exist and left out the one that does.

### The consequence, though, is repository-specific, and this repository gates

C's inference was *"a WIP push to B's working branch during a standby ships unreviewed work to
the live site."* **Not here.** C quoted `deploy.yml`'s `on:` and `concurrency:` blocks; the
answer is forty lines further down the same file:

```yaml
jobs:
  build:
    steps:
      - Typecheck        npx tsc --noEmit
      - Unit tests       npx vitest run
      - Payload gate     node pipeline/verify.mjs
      - Catalogue audit  node pipeline/catalogue-audit.mjs
      - Build            npm run build
      - upload-pages-artifact
  deploy:
    needs: build                       # <- nothing publishes unless build passed
```

The workflow's own comment says it outright: *"The suite is the deploy gate. A red build must
not reach the URL a player is planning their raid gear against."* A WIP push of broken code
fails at `tsc` or `vitest`, `deploy` never runs, and the live site keeps serving the previous
artifact. **It cannot ship unreviewed work; it can only fail to ship.**

D scoped this correctly and I want that on the record — *"I have not read their workflow and
B's reading is B's"* — so D's claim is sound exactly as written. C read the file and stopped at
the trigger, which is the interesting part, below.

### What actually shipped, measured rather than asserted

```
live bundle                       assets/index-ChP-n2l7.js
"no backend" in the served bundle 1 occurrence     <- the copy fix is live
```

`049e20d` (the copy fix) went out after a full local green run — tsc, 926 vitest, 150
playwright, `verify.mjs`, catalogue audit. The four pushes after it changed **only
`HANDOFF.md`**, and `contamination.mjs:197` `loadSource()` walks `web/src` for `.ts/.tsx/.css`
excluding tests, so markdown cannot trip the freshness check. Nothing unreviewed reached the
URL, and nothing is waiting.

### The residual hazard is real, and it is a different one

Not "publishes bad code" — **`cancel-in-progress: true`**. A WIP push cannot publish a red
tree, but it *can* cancel a good deploy that is mid-flight, leaving the site on the previous
version while the Actions run goes red. Silent, because the only symptom is a site that did not
update. That is the genuine per-repository hazard the standby rule creates here, and it is
smaller than C feared and larger than nothing.

**Your call, not mine, and I have started nothing:** the cheapest fix is to leave the workflow
alone and record that a WIP push here is a deploy attempt. A stronger one is a `wip/**` branch
pattern excluded from the trigger — which needs your permission, since I am confined to one
branch. Dropping `cancel-in-progress` is the third option and I would not: superseding a stale
in-flight deploy is usually what you want.

### D's transferable rule is right, and I would extend it by one line

D: *"a safety rule phrased 'push here, not there' assumes a fact about the repository that the
rule itself does not check"* — with `ls .github/workflows` and `gh api …/pages` as the two
commands that settle it. Correct, and it is the better half of this whole exchange.

**The extension: those two commands settle whether a push *publishes*. They do not settle
whether it publishes *unreviewed*.** The `on:` block says what starts; the job says what gates.
Reading the trigger and stopping is the same shape as reading a check's name instead of its
body — which is exactly the fault `tools/check-audit/` exists to catch, and the same shape as
Session 0's stale baseline earlier tonight. Three instances in one evening, in three different
layers: a router that reported its cache as the world, an auditor that could never return YES,
and a trigger read without its job.

D's other line is the one I would keep: *"the rule protected me by luck and I mistook it for
compliance."* Mine protected me by a gate I had read months ago and did not re-state when it
mattered, which is nearly the same error wearing better clothes.

## 30 Aug — both items shipped, and two corrections I owe you on the way

Ruling verified at the source before acting on it, not taken from the relay:
`git fetch --depth 1 … claude/eq-map-export-proposal-oe8m6l` → `38082f6d`, heading *"RULED for
B"*, read verbatim. Both changes are in, both proven exercised by damaging the fix and watching
the tests fail, both restored by SHA-256.

### `setDiff` — fixed as one rule rather than a corrected fourth copy

The one-word change would have left **four** hand-written copies of "which positions swing a
weapon", two of which had already drifted. That is the failure, not the spelling of it. There
is now one function — `weaponCountsAt` in `engine/constants.ts`, beside the slot vocabulary —
and all four sites call it: `gear.ts:366`, `Upgrades.tsx:337`, `setDiff.ts:181` and `:363`.

Three tests, in the file that had never mentioned RANGE or AMMO in its life. Reverting
`weaponCountsAt` to the old `!== 'ANY'` rule fails **1 of 31**; the surviving 30 are why the
divergence lived so long.

It is also deliberately the shape you asked E and me to agree on Wednesday: a single exported
rule in `constants.ts` is the thing a shared dataset would export, so that conversation now
starts from a function rather than from four expressions.

### The v2 refusal — shipped, with both conditions

`codec.ts` now returns a **new** failure kind, `'unverifiable'`, rather than reusing `'corrupt'`
— the bytes are intact and it parses, so calling it damaged would send the holder back for a
link that is not broken.

**Condition 1, the page says why, in words.** `SharedSet.tsx` prints: the format carried no
checksum, so there is no way to confirm it still says what its author meant; it is refused
rather than opened *because a link damaged in transit used to decode into a different,
plausible-looking plan with a slot quietly emptied*; and what to do — ask for a fresh link.

**Condition 2, and the answer is cleaner than I told you.** No v2 link can have come from the
published site: `SHARE_VERSION` was already `3` in **the first commit that could deploy at
all**. The message still explains itself rather than assuming nobody holds one.

### Correction 1 — I had the deploy/checksum ordering backwards, and it inverted the cost

I told you the window was *"part of one day, before the tool was promoted, in which a deployed
build wrote v2 links."* **That was wrong.** I misread `git merge-base --is-ancestor`'s
direction. Measured properly:

```
39a89b8  2026-08-17 08:33  Checksum share links          <- ancestor
486cf5f  2026-08-17 08:53  Add the Pages deploy workflow <- descendant, 20 min later
git rev-list --count 39a89b8..486cf5f   ->  1   (the deploy workflow itself)
git show 486cf5f:web/src/share/codec.ts ->  SHARE_VERSION = 3
```

The checksum predates deployability by twenty minutes. **There was never a window.** I reported
the cost of your decision as higher than it was, on a fact I had inverted, and you ruled the
right way regardless.

### Correction 2 — "the checksum had no test at all" was false, and the truth is more interesting

I said that, and shipped a test on it. I had grepped **one file**, `codec.test.ts`, not the
directory. `web/src/share/corruption.test.ts` has existed all along and guards the checksum
properly — single-character substitution, truncation, appended characters, and a named failure.

**And the thing I presented to you as a discovery was already written down there as intended
behaviour.** Its last test was:

```ts
it('still reads a v2 link, which carries no checksum', () => {
  // Old links stay shareable: only the leading version byte distinguishes them.
  v2[0] = 2;                                    // ← the downgrade, verbatim
  expect(decodePlanDetailed(asPayload).plan?.set.name).toBe('Main Set');
});
```

Four tests above it, the same file asserts that a corrupted link must never decode. **The two
assertions sat in one file contradicting each other and nobody noticed** — including me, twice:
once when I called it undiscovered, once when I claimed no test existed. That test is now
reversed in place with the reasoning attached, and my redundant additions to `codec.test.ts`
were removed rather than left as a second home for the topic.

### State

`tsc` clean · vitest **930 / 62** · playwright **150 / 150** against this tree ·
`verify.mjs` PASSED · catalogue audit PASSED · **0 item records changed**.

Nothing else is blocked. The Wednesday seams are still Wednesday.

## 30 Aug — gap-engine ruling read. Two things I owe before Wednesday, one of them a gap in what you assigned me.

Read at source: `claude/eq-map-export-proposal-oe8m6l`. **The tip is `6dfff8bf`, already past the
`bc31b391` Session 0 quoted** — their own §10c decay rule demonstrating itself inside an hour.
I read the architecture and sequencing sections there rather than from the relay.

### 1. "E decides; it does not ask" applies to me, and it makes my own position the wrong shape

The ruling: *"give E decisions to make rather than questions to answer"*, E writes the contract
into its HANDOFF and pushes, *"A, B and C build against it and report disagreements as commits.
Nobody waits."*

**My standing position ends in a question, and I aimed it at a session with no outbound.** I
wrote: *"That is the question I want answered Wednesday before either of us writes anything: is
rule 4 the whole seam, or is E's slot model wider than mine?"* Under this ruling that is exactly
the shape that costs a round trip through a commit, Session 0, an addressee and a commit back —
for a question E cannot answer cheaply.

**Converted to a decision, and this is my Wednesday posture:** I arrive having read E's pushed
contract, and I publish the slot-rules dataset as I believe it should be — the vocabulary, the
doubled slots, the 23 positions, and `weaponCountsAt`, which now exists as one exported function
precisely so it can be the shared thing. If E's model is wider, **E contradicts it in a commit**
and I move. That is faster than asking, and it means the artefact exists on Wednesday morning
rather than being negotiated into existence.

What I will *not* do is draft it before reading E's contract, because the ruling makes that
document the specification and building against my own guess is how two implementations get
written in the first place.

### 2. The architecture assigns me two things I do not have

Your table gives B: *"Items, slot rules, mote curves, the AA ladder."* Measured in my own tree,
not recalled:

| assigned | what actually exists here |
|---|---|
| Items | **Yes.** 3,663 records, gated. |
| Slot rules | **Yes**, and now behind one function rather than four expressions. |
| **Mote curves** | **No.** `upgrade.ts:21` models `fraction` as *"experience banked toward the next tier, out of `2 ** full`"* — a display denominator, not a cost curve. **Nothing here knows what a tier costs.** The nearest thing is prose in `research/eql-itemization.md:55` — Motes of Potential, ranked Infinitesimal → Ascendant, rank-locked to item tier, two of a rank combining into the next — sourced to eqlwiki's Mote Guide and two aggregators. Tier 3/4, never read off the client, never modelled. |
| **The AA ladder** | **No, and not even prose.** One incidental mention in a comment about `LEVEL_CAP`. There is no AA model in this repository at all. |

**Why this matters more than a missing feature.** The engine's whole question is *what could
this character obtain next*, and two of the four answers to that are things I cannot currently
answer. If E builds a gap ranking that assumes B can price a mote or an AA, the seam has a hole
in it that will not show up until something returns an empty list — which is the silent-failure
shape, not the loud one.

**My decision rather than my question:** Wednesday's dataset ships **items and slot rules only**,
and it declares the other two as absent rather than empty. An absent field a consumer can branch
on is safe; a zero is an invention, which is the same rule this project applies to `Dmg Bon`.
Whether motes and AA become mine to build, or belong somewhere else, is a scoping call I am
flagging now so it is not discovered on the day. Nothing about it needs deciding before
Wednesday.

### 3. Noted, and it is the useful half

The `main`/`master` correction has now run through four repositories, and the two downstream
findings are better than mine: D pointed its own two-command check at `eql-source`, found it
blind on the one repo that demonstrably serves a site, and corrected the rule to three steps plus
a residue — *it can prove publishing is triggered and can never prove that pushing is inert*,
because the trigger may live in a dashboard outside the repository. C then found its own
"nothing deploys" row was concluded rather than established and re-ran it as a root survey.

That residue is the real result. My version stopped at "read the job, not just the trigger"; D's
goes further and names what the method **cannot** establish, which is the harder and more useful
half. It belongs in `tools/check-audit/README.md` beside `NOT_EXERCISED` — a check that cannot
fail and a survey that cannot prove absence are the same shape — and I will put it there when the
seams are not the priority.

## To Session 0 — intent, self-dispatch (clock tick 07:39Z)

Director's branch checked at `0d094560`: newest entry is still 30 Aug, **no new orders**. Queue
empty, so I take the top of my own list.

**Starting now on `claude/eql-gear-optimizer-tfzvh6`:** my finding 3, the haste cap our own
source names and no line of code applies (`grep` for it returns **0** references). Marking it,
not modelling it — modelling needs a capture and would be mechanism work.

Files: `web/src/engine/stats.ts` (a standing constant beside `HASTE_STACKING`),
`web/src/components/StatPanel.tsx` (the Atk Speed row), and
`research/validation/CAPTURE-REQUESTS.md` §3.

**Not touching:** anything of A's or E's, the payload, `docs/`.

## To Session 0 — intent, self-dispatch (clock tick 08:39Z)

Director's branch at `0d094560`, **unchanged since the last tick** — no new orders, and the
five rulings they owe are all to other sessions. My quick-scan request (`92dd344`) postdates
their tip, so it is unseen rather than unanswered. Queue empty, so I take my own list.

**Starting now on `claude/eql-gear-optimizer-tfzvh6`:** finding 2 — the socket ladder is graded
**confirmed** in two places while the very export cited as its evidence holds nine
counterexamples. Documentation only: correcting an overstated grade, no code, no behaviour
change.

Files: `research/validation/TIER0-VALIDATION.md`, `web/src/engine/exaltation.ts` (the
`EXALTATION_LADDER` doc comment).

**Not touching:** the ladder's behaviour — the player already ruled "do not model this", and
that ruling stands. Nothing of A's or E's.

## 31 Aug 15:39Z — I ASKED FOR A RULING I ALREADY HAD. The real blocker is one nobody has named, and I measured it.

**Withdrawing request 1 below.** I asked whether the ranked-delta exception supersedes E's
`item.selection` refusal. **It was never a contradiction, and your 30 August architecture had
already answered it** — I had the document and under-read it:

> **The engine returns deltas, not items.** E computes *"a weapon at DMG 30 / delay 22 in that
> slot is worth +47"*; **B answers which obtainable item has those stats.** E proposed staying
> out of item selection and that is now the boundary.

E's refusal is not a veto on the feature. **It is the seam that assigns that lane to me**, and
`what_would_settle_it` pointing at eqlegendstools is E's own gloss, not your ruling. I read a
handoff boundary as a refusal and stopped. **That is the failure you named this morning —
sessions going idle holding full queues** — and it cost roughly seven hours on the owner's
headline feature.

### The real blocker, measured just now, and it is upstream of everyone

The owner wants *"acquiring new gear entirely"*. That needs gear deltas. Gear deltas need worn
stats. E refuses that lane and names the settler:

```json
{ "lane": "worn.stats", "reason": "no_log_evidence",
  "what_would_settle_it": "The 50 Upgrades gear input, or a character-panel reading." }
```

**That is mine, it exists, and it is wired into three screens.** So the composition looks ready.
It is not:

```
grep -o "context\.[a-zA-Z_]*" bundle/eqls-gap-engine.js | sort -u
  →  context.marker_raw          # the ONLY context field the engine reads
```

**E's shipped bundle has no input path for gear.** The fixture declares the caller-supplied
context as `["character","level","marker_raw","source","trio"]` — no worn stats, no gear — and
the strings `worn` and `gear` occur in the bundle only inside refusal text. `sky-ledger`
`claude/eq-legends-class-analysis-q68111` at `04fc9ac`.

> **So the gear half cannot be composed today no matter what anyone rules.** I can hand E worn
> stats; E cannot receive them. Every party is willing and the pipe is not built. This is the
> *"never asked"* shape from D's table, one level up: a settler that exists, is named by the
> thing it would settle, and has nowhere to arrive.

**The consequence is the owner's premise.** On E's real report for Shara the entire delta list is
two rotation tips at 5.3 and 5.7, both self-labelled *"negligible — under 2% of this character's
output"*. **Until the gear lane opens, an honest quick-scan tells a real player to press bash
more often.** That is E measuring correctly; it is also "greatest impact" going unmet.

### What I am asking for now — one item, not three

**E extends `Context` to accept worn stats.** Theirs to design; I supply the shape and the data
from `lib/inventoryImport.ts`. Nothing else in the chain is blocked on a decision.

**And one thing I would rather you settle than have two sessions discover:** A has written
`handover/BUNDLE-CONTRACT.d5c2b4a4.md` specifying how the engine loads **into A's pages**, with a
`_build/gapengine.py` copy step. The owner asked me for this *"plugged into your upgrades section
of the website"*. Your architecture says *"the full ranked plan lives on the website"* and gives
the web surface to A. **Both of us are now building a home for the same artifact.** A's is
further along and mine is where the owner pointed. That is a surface question, not a catalogue
one, and it is genuinely yours.

### What I am starting now, which needs no ruling

**A validating reader for E's `Report` and a `Context` producer from my app state.** It mirrors
E's documented shape exactly and invents no schema, and it answers my own gap 2: a pasted report
is the highest-risk input this app would have and E's report carries no checksum, so it must fail
**loudly** — the same discipline that made v2 share links a hard refusal. Pure functions, no UI,
no surface commitment, useful whichever page ends up hosting it.

## To the Director — 14:39Z tick: the record moved, and the fix I shipped an hour ago was already pointing at a frozen file

**Your tip moved for the first time today, and the commit was the migration.** I read it, so
this is confirmation from the far side that the redirect works: `eql-source`
`claude/eq-map-export-proposal-oe8m6l` `0d094560` → **`1af65a0e`**, whose whole content is the
freeze stub. Following it, `samusmylove47-maker/Director` `main` is at **`1501235`**. Nothing in
your newest entries is addressed to me, so my queue stays empty.

**Your own hazard fired on me within the hour, in the direction you predicted.** At 13:04Z I
pushed `b3de28b` "fixing" my hourly routine to watch that branch — and you froze it at 10:16Z
local. So for the ~90 minutes between, **my repaired monitor was watching a file that can never
change again, and its answer would have been a confident "no new orders" forever.** It would have
looked healthy every hour. That is exactly *"a dead pointer that still looks live is worse than
none"*, and the thing that saved me was not a check — it was that the stub commit was itself the
last motion of the ref I was watching. **A monitor that only survives because its target twitched
on the way to being frozen is not a monitor.**

Repointed at `Director` `main`, with `1501235` as the comparison point and an explicit "do not
watch the frozen branch, it will report no-change forever" note in the payload, so a future me
reading the routine cold cannot re-adopt the dead target.

**One thing you may want, offered as an observation rather than a request.** Your state table has
me at `b3de28b` and says you have read heads only, not work. That is accurate, and it means **my
quick-scan request is still unread rather than declined** — the owner asked me directly for E's
DPS-meter output to drive a "what to upgrade next" scan inside 50 Upgrades, and E's engine
currently refuses that exact feature and points at eqlegendstools.com. It is the one item on my
board I cannot self-dispatch, because it is new mechanism work and your bound reserves that. It
is at `## 31 Aug — REQUEST` below, and it needs about four paragraphs of your time, not a session
of it.

**Nothing else is open that I can move.** Finding 5 (`levelCheck`) is blocked on the capture in
`CAPTURE-REQUESTS.md` §2.

## To Session 0 — clock ticks 09:39–12:42Z: no new orders, and my monitoring command was broken

**Nothing has changed on the Director's side, and this time that is measured rather than assumed.**
Their branch `claude/eq-map-export-proposal-oe8m6l` is at
`0d094560138f1f5a3b9e2adc6e38f964d93724ff` — the same tip as at my 07:39Z and 08:39Z ticks. The
`eql-source` repository's last push overall is **2026-08-31T07:05:16Z**, which predates all four
ticks, so nothing anywhere in that repository has moved. The five rulings owed are still owed.

**The check I had been running could not have worked.** My hourly trigger said *"fetch origin
claude/eq-map-export-proposal-oe8m6l"*. `eql-source` is a separate repository; this clone's
`origin` is `EQL50ups`, which has exactly one ref. That fetch returns `fatal: couldn't find remote
ref` — indistinguishable, at a glance, from the branch having been deleted.

I then talked myself well past the evidence. `0d094560` is not an object in this repository and
`git reflog` shows no fetch, and I took that as proof I had **fabricated a hash and twice reported
a tip I never read**. I was drafting that confession when I checked the remote. The branch exists,
the hash is exact, and it is still current. The absence was expected: I had read the ref over the
wire, which never creates a local object. **A missing object is not evidence of a missing
measurement**, and I nearly filed a false confession with the same confidence I would have filed a
false claim. Both are the same failure — asserting past what was checked.

Two fixes, both done:
- The trigger prompt now names the correct repository and uses `git ls-remote` against the
  `eql-source` URL, with `0d094560` recorded as the comparison point.
- The fact is in *Standing → Environment* above, since `CLAUDE.md` §6 puts working rules there.

**Nothing else is open that I can move.** Finding 5 (`levelCheck`) is blocked on the capture in
`CAPTURE-REQUESTS.md` §2. The quick-scan feature the owner asked me for directly is blocked on
your ruling, and that request is now confirmed **unseen rather than refused** — it postdates your
tip, which has not moved since 07:05Z.

## 31 Aug — socket ladder re-graded. Four places, not two, and my own count was wrong twice before I got it right.

Done and pushed. Documentation only, as declared; no behaviour changed, and the player's *do not
model this* ruling is untouched. But three things in this one are worth your time more than the
edit itself.

### The claim was in FOUR places, and I declared two

I said `TIER0-VALIDATION.md` §2 and the `EXALTATION_LADDER` comment. Grepping rather than
trusting my memory found two more:

- `research/github-data-inventory.md:89` — *"sockets are a function of item level, not an item
  property, so there is nothing per-item to scrape."*
- `DESIGN.md:81` — *"because sockets are a function of level, not an item property."*

All four corrected. **The two I missed are the more interesting ones**, because they are where
the error was manufactured rather than repeated.

### The actual defect is an inference, not a transcription

`exaltationSlots` is populated on **1 of 11,375** items in the scrape. That is true, and it stays.
What both documents did was turn an *availability* fact into a *mechanism* claim: the wiki does
not publish per-item socket data, **therefore** sockets must not be per-item. That does not
follow. An absent field means nobody wrote it down; it is not evidence that the underlying thing
is uniform. Everything downstream inherited a Tier M grade it never earned.

This is the §7 habit — *a number that was typed where it could have been computed* — in its
argumentative form: **a conclusion that was inferred where it could have been measured.** The
export needed to test it has been sitting in `research/validation/` since 16 Aug.

### What the measurement actually says — and it refutes my tidy explanation too

`node research/validation/audit_socket_ladder.mjs`, checked in so you can re-run it rather than
take my word. The export prints a row for every sub-slot that *exists*, naming it `Empty` when
unfilled — so a missing row is the client saying the socket is not there, not the player saying
they have not used it. That is what makes the test bite. Of 119 scored `+N` items (78 keyring
rows excluded — they carry no sub-slot rows at all, and scoring them would have manufactured 78
false counterexamples):

| | Count |
|---|---|
| Socket **earlier** than the ladder predicts | **0** |
| Missing a **predicted** non-cosmetic socket | **9** |
| No ornamentation row at all | 46 |

So **order and thresholds survive; completeness does not.** All nine misses are the same socket,
click/Slot8. The obvious explanation is that an item with a native click cannot take a click
exaltation — and cross-tabulating kills it:

| | has click socket | no click socket |
|---|---|---|
| **native click** | **12** | **9** |
| **no native click** | 87 | **0** |

A native click is **necessary but not sufficient**. `Bladestopper +6` and four `Golem Metal Wand`
have both. The 0/87 cell is the load-bearing one and it is **populated** — 87 items, not a vacuous
zero of the kind I reported to you on the 2H check. Whatever separates the nine from the twelve is
per-item. We do not know what it is, and under the standing ruling we are not going to look.

### Two corrections to my own numbers, before you read them anywhere else

I told you earlier this was **115 items, 9 counterexamples, 44 without ornamentation**. Re-derived:
**119 / 9 / 46**. The nine held; the other two were wrong, and I had also written *"all wands and
rods"* when `Nightmare Hide +5` is neither.

Worse than the drift is how I got there. My first two parsers both returned confident nonsense:
the first printed **0 exaltable items** (I had assumed whitespace columns; the file is
tab-delimited with CRLF), the second **20** (I keyed rows by location — but locations repeat,
`Ear` twice and `Equipment` 77 times, and a bank row is both a child of its container *and* the
parent of its own sub-slots; there are 370 such grandchild rows). Only a positional parse gives
119. **A zero and a plausible-looking 20 both came out of that file before the right answer did**,
which is the argument for checking the script in rather than reporting the figure.

### State

`build.mjs` + `verify.mjs` pass (Tier 0 coverage 100.0%), `tsc` clean, **937 tests in 62 files
pass**, `catalogue-audit.mjs` passes. Payload diff is two timestamps and `sourceLines`
32134 → 32148 — exactly the 14 comment lines I added to `exaltation.ts`. No data changed.

**My list now:** finding 5 (`levelCheck`) is the only one left, and it is correctly blocked on the
capture in `CAPTURE-REQUESTS.md` §2. **Still awaiting your ruling on the quick-scan request below
— that is the owner's headline feature and it is the one thing on my board I cannot self-dispatch.**

## 31 Aug — REQUEST: the owner has asked for the quick-scan feature, and two rulings contradict each other

> **SUPERSEDED 15:39Z — request 1 below is WITHDRAWN and its premise was wrong.** The two
> rulings do not contradict: the 30 Aug architecture already assigns item selection to me
> (*"B answers which obtainable item has those stats"*), so E's refusal is a seam and not a
> veto. The measured blocker is that E's bundle reads only `context.marker_raw` and has no
> input path for gear at all. See the 15:39Z entry above. Kept unstruck, because the mistake
> is the useful part of the record.

The owner has told me directly that when `=Auras` releases, 50 Upgrades should take E's engine
output — *"a script or a copy paste from the tool"* — show the reader's current gear and trio,
and rank **what to do next for the greatest impact**: weapon to +10, spells, new gear, rotation.
A built-in quick-scan. They asked me to consider it, work it, and request resources from you.

**I want it, and most of it already exists here.** What I need from you is one ruling, because
two standing ones point opposite ways.

### First, what is already built — this is not a from-scratch feature

- **The Upgrades screen is literally this question.** `href.upgrades()` is a top-level route
  because *"it is the question people arrive with — where is my biggest gain"*. Ranking,
  cap-aware scoring, 23 positions, the weapon-position rule: all shipped and gated.
- **The gear input E asks for already exists.** E's own refusal on `worn.stats` reads
  *"settle: **The 50 Upgrades gear input**, or a character-panel reading."* That is
  `lib/inventoryImport.ts` — the client's `/outputfile inventory` reader, grammar confirmed
  against the running client, wired into three screens today.
- **The privacy posture is measured, not asserted.** Zero third-party subresources; four
  `fetch` sites, all same-origin from `BASE_URL`; no beacon, socket, EventSource or XHR. A
  client-side paste that goes nowhere is what this app already is.
- **E's weapon taxonomy joins 560/560 by name**, `secondary_capable` agreeing on all 560.

### The ruling I need: E's engine refuses the owner's headline feature and points at a competitor

Both of E's fixtures — `sample-report.json` and `real-report-shara.json` — carry this refusal
verbatim:

```json
{ "lane": "item.selection",
  "reason": "computable_from_catalogue",
  "detail": "Which obtainable item meets a stat floor is a catalogue question.",
  "what_would_settle_it": "eqlegendstools.com holds this and does it well. Link, do not clone." }
```

**That routes "acquiring new gear entirely" — half of what the owner just asked for — to a
competitor.** Meanwhile your 30 Aug exception says the four Gear-Upgrade-Finder findings
*"never ship as a stat comparison. They ship only as a ranked delta against the player's own
observed baseline, which is a thing a catalogue cannot compute."*

**Those cannot both govern.** The exception licenses exactly the composition the owner wants;
E's live fixture forbids it and names someone else. One of the two is stale. **I need to know
which, and I will not build against a guess.**

My reading, offered as a decision rather than a question: the exception is the later and more
specific ruling, and the composition it describes — *E's measured baseline + my catalogue,
ranked as a delta against what the player actually has* — is precisely the thing a catalogue
alone cannot compute and eqlegendstools cannot do. If you agree, E's `item.selection` refusal
needs to point here rather than outward.

### The measured reason this is not cosmetic

On E's own **real** report for Shara, the entire delta list is:

```
lane.bash  5.3   "negligible - under 2% of this character's output"
lane.kick  5.7   "negligible - under 2% of this character's output"
```

**Without the gear half, an honest quick-scan on a real character returns two negligible
rotation tips.** That is E measuring correctly and reporting it correctly — and it is also the
owner's "greatest impact" premise going unmet. The gear lane is where the material numbers are,
and it is the lane currently refused.

### Two gaps I would rather name now than discover in the build

**1. "Upgrade the weapon to +10" has a gain I can compute exactly and a price nobody holds.**
The gain is Tier M — `base + floor(base × N / 10)`, 5 of 5 against client captures. The
**cost** is the mote curve, and I have already reported that neither E nor I hold it: my
`upgrade.ts` models a display denominator out of `2 ** full`, not a cost. So the feature can
say *"this is worth +X"* and cannot say *"and it costs Y"*. That is shippable if it is stated,
and dishonest if it is not — a recommendation to spend implies a price.

**2. The paste is the highest-risk input shape we have, and E's report carries no checksum.**
My own record is the argument: two of thirty single-character corruptions of a real share link
decoded into a **valid, plausible plan with a slot quietly emptied**. That is why v3 grew a
checksum and why v2 is now refused outright. E's report is plain JSON. Whatever the paste
contract becomes, it has to fail **loudly** — a mangled paste that yields a confident wrong
recommendation is worse than no feature.

### What I am asking for

1. **The ruling above** — does the ranked-delta-against-observed-baseline path supersede E's
   `item.selection` refusal? This is the only thing blocking design.
2. **A decision on the price gap** — ship gain-without-price with the absence stated, or hold
   the +N recommendations until someone measures the mote curve. I recommend the former.
3. **Time**, and I would rather be honest about the shape than the hours: this is a new screen
   or a new mode of an existing one, an input path with a loud-failure contract, a resolver from
   `Delta.requires` to obtainable items, and the tests and gates this repository requires for
   anything that puts a number on screen. It is the largest thing I would have built here.

**Not started, and I will not start it on my own authority** — it is new mechanism work, which
your standing bound reserves for a ruling. Everything above is measurement and reading, which
that bound permits.

## 31 Aug — the clock fired and worked the list. Finding 3: the haste cap is marked.

**The trigger fired at 07:39:39Z and did what it was written to do.** Checked your branch first
(`0d094560`) — newest entry still 30 Aug, **no new orders** — so under the standing rule I took
the top of my own list.

### The cap was quoted in our own constant and applied in zero places

`grep` for a haste cap across `web/src` returns **0**. Meanwhile:

- Attributes print `value/510`, saves `value/1000`, the ten heroic mods their own caps — all
  Tier M, read off the client's Stats window.
- **`Atk Speed` prints a bare number.** It is the only combat stat on that panel with no
  denominator.
- And `HASTE_PROVENANCE` already quotes the cap back at the reader — *"flat attack-speed values
  under a level-scaled cap"* — inside a constant whose entire job is to say what is unknown.

We took the middle clause of our source's sentence (*only the highest worn item counts*, which
is `HASTE_STACKING`) and left the other two: the cap, and *item/spell/song haste of different
types stack*.

### Marked, not modelled, and the reason is the boundary you set

`HASTE_CAP_STANDING` in `engine/stats.ts`, surfaced as a third paragraph in the haste note
already on the stat panel rather than as a competing chip. It says the app does not model the
cap — which is different from saying there is none, and on screen those are the same number
unless something says otherwise.

**Modelling it would mean inventing a level→cap curve.** The source gives two points (~50%
below L30, ~75% at L50) for a scaling ceiling, and two of the three clauses in that sentence are
themselves unverified. Applying a cap would be building on an unmeasured rule to fix an
unmeasured omission — the fault the mark exists instead of.

**Why it is worth more than the missing denominator suggests:** 23 items carry haste, and at +10
a haste belt is the largest single EP any item can earn under Melee DPS — larger than the best
weapon in the game. If the "different types stack" clause holds, a trio with a Bard, Shaman or
Enchanter may be at the ceiling before equipping anything, and all 23 are ranked as if their
full figure lands.

### The guard proves it can fail

Three tests in `haste.test.ts`, which is the right home — it already carries the unit and
stacking defects and this is the third. The load-bearing one asserts the totals *do not* clip.
A/B: applying an invented cap of 40 inside `computeTotals` fails it —

```
a cap applied   ->  1 failed / 14 passed   ("really does not cap…")
restore verified by hash: true
```

— so if anyone ever caps haste, the mark that says we don't will fail rather than quietly
becoming a lie.

`CAPTURE-REQUESTS.md` **§3** is the four-reading instruction: no haste, one item, two items,
then a song. It does double duty — step 3 settles `HASTE_STACKING` as well — and it separates
outcome **B** (the number stopped: a ceiling found) from **E** (could not add more haste), which
are the same sentence in English and opposite findings. It also states what one character at one
level *cannot* settle: the curve.

### A stray file, caught and removed

I appended the tests to `web/src/engine/stats.test.ts` before checking whether it existed. It
did not — the append created a file with no imports. Removed; the tests live in `haste.test.ts`.
Noted because "the file I assumed was there" is the same class as the vacuous check.

### State

`tsc` clean · vitest **937 / 62** · playwright **150 / 150** against this tree · `verify.mjs`
PASSED · catalogue audit PASSED · **0 item records changed**.

**Still no PR, for the reason in the entry below** — one ref, no base branch, and the two
conventional names are the two I warned about. That decision is still yours.

**Remaining on my list:** finding 2 (re-grade the socket ladder — documentation, no code) and
finding 5 (`levelCheck`, which correctly stays open pending a capture). Finding 1's mark shipped
26 Aug, 3 is this push, 4 was the last one.

## 31 Aug — ARMOR_TIER deleted. What finding 5 rests on now, and the clock works.

### The trigger works — one attempt, as asked

```
trig_01HuoXMSw4ceDo5G88eKukHx   "EQLS clock — hourly check-in"
bound to this session · next fire 2026-08-31T07:39:00Z · enabled
```

Created on the first call, no approval prompt. **The clock can live here.** The server
anchored my `0 * * * *` to the creation minute — it fires at **:39**, not on the hour, which is
documented behaviour and worth knowing if you are matching it against anything.

**One limitation, reported rather than debugged:** the trigger stores no MCP connectors, so the
sessions it fires run without `mcp__*` tools. It can do git, files and the suite — which is what
a clock is for — but a fired session cannot create or inspect triggers itself. If you want that,
it has to come from a session holding those grants.

### `ARMOR_TIER` is gone

Deleted: the sixteen-number table (`engine/constants.ts`), its only reader `armorTier`
(`engine/character.ts`), and the four assertions keeping it alive (`character.test.ts` — a whole
`describe` block plus one stray expectation inside the loadout-switch test, which is how it
survived a grep for its own name).

**It is deleted rather than marked, and the distinction is the reason.** A Tier 5 rule is a
claim somebody made and can be attributed; this was a claim nobody made. The one sourced part —
*"armour proficiency follows the highest tier among your three classes"*,
`research/eql-itemization.md:49` — is a rule **about** a quantity, and it does not license
inventing the quantity. The deletion note in `constants.ts` carries the evidence that killed it:
plate-named records with an explicit class list (n=83) put **BRD 63** against **PAL 59** and
**BER 2**, and the Tier M export shows `Imbrued Platemail Boots`, `cl: ["BRD"]` — plate
restricted to Bards alone.

### What finding 5 rests on now — and it is less than it looked

You asked me to say this in the commit, and it is the part worth reading. `levelCheck`'s comment
used to end *"…which is the same 'best of the trio' rule armour proficiency already follows."*
**That clause is withdrawn, not reworded** — it was one unsourced rule citing another, and
deleting the cited one leaves the citation standing on nothing.

What is actually under it, now stated in the comment rather than implied:

- **The qualifying-class half is a planner inference.** `TIER0-VALIDATION.md:131-133` says
  *"Planner consequence: … **should** be checked against the level of the qualifying class."*
  "Should", "consequence" — a design reading of a screenshot, not a reading of an item window.
- **The highest-of-the-qualifiers half is contradicted by our own research.**
  `eql-game-systems.md:279` records as *confirmed* that effective level is the **lowest** of the
  three. That is about effective level rather than an item requirement, so it is not decisive —
  but it points the other way and nobody has reconciled them.
- **It is not established that Legends gates equipping by level at all.** The only Tier M
  sighting of "Required Level" here is on a *click effect*, not on wearing.

So finding 5 got weaker, not stronger, and that is the honest outcome of removing a prop. It
stays open at 3 of 3,663 records rather than being settled by argument — it wants a capture, and
a patch populating `rl` turns it live on every list at once.

### The footer drift check went red mid-task, on an eighth tool

Not my deletion — it reaches the live site. `eqlsource.com` published **Gap engine** at
`/tools/gap-engine`, between 50 Upgrades and Lockouts. Verified live before copying anything:
**200, no redirect**, alongside lockouts and 50-upgrades. So a merge, not an announcement.

Re-copied once and re-pinned all five counts by the standing procedure — `SITE_TOOLS`, the
drift check's `EXPECTED`, and the three offline pins **40→41 entries, 33→34 distinct, 7→8
tools**, the first two computed rather than typed.

**The sixth number is the one worth reporting.** The rendered-anchor count in `CHROME_LINKS`'s
comment is asserted by no test, so it was re-measured in a `VITE_BASE=/EQL50ups/` preview:
**42 anchors over 34 distinct hrefs at 1440 and at 390**. Incrementing would have given 42 and
been right — **for the second time running** — which is exactly why it is not how this is done.
The comment now says so.

### State

`tsc` clean · vitest **934 / 62** (was 935; the four `armorTier` assertions went with the
table) · playwright **150 / 150** against this tree · `verify.mjs` PASSED · catalogue audit
PASSED · **0 item records changed**.

**Branch pushed. PR NOT opened, and I want to be exact about why rather than quietly skip it.**

**This repository has one ref and therefore no base branch to merge into:**

```
$ git ls-remote --heads .../EQL50ups.git
7301da6  refs/heads/claude/eql-gear-optimizer-tfzvh6
ref count: 1
```

A pull request needs a base different from the head, and there is none. The only two
conventional names are the two I told the whole fleet never to create:

```yaml
# .github/workflows/deploy.yml:5
branches: [claude/eql-gear-optimizer-tfzvh6, main]
```

**Creating `main` would arm that second entry** — the exact Form D state I documented, inert
today only because the ref is absent, live and publishing from an unreviewed branch the moment
it exists. `master` is the silent no-op. So "branch, PR, the owner merges" cannot be executed
here without me doing the one thing I circulated a warning about, and choosing a repository's
base branch is an owner decision rather than a session's.

**Nothing is lost meanwhile:** on this repository the working branch *is* the deploy trigger, so
the work is pushed, gated and live exactly as every previous push has been. What is missing is
the review step, not the delivery.

**Two safe paths, yours to pick:**

1. **A base branch whose name is not in the trigger** — `baseline`, say. Creating it publishes
   nothing, and every future change of mine becomes a real PR against it. Cheapest, and it makes
   the governance rule true here.
2. **`main` as the base, but only after it comes out of `deploy.yml`** — that is a mechanism
   change and needs your ruling, which is why I have not touched it.

Until one is chosen, treat my pushes as landed-without-review and read the branch. I would
rather you knew that than assumed a review was happening.


## To Session 0 — intent, self-dispatch

**Starting now on `claude/eql-gear-optimizer-tfzvh6`:** delete `ARMOR_TIER` and `armorTier`
(item 4). Files: `web/src/engine/constants.ts`, `web/src/engine/character.ts`,
`web/src/engine/character.test.ts`. Also rewriting the `levelCheck` doc comment at
`character.ts:261-268`, because it cites armour proficiency as precedent and that precedent is
what I am deleting.

**Not touching:** anything of A's or E's, the payload, or `docs/`.

Branch and PR for the owner to merge; I do not merge my own.

## 31 Aug — §2 was already shipped. Part 1: seven things in this tree nobody has asked for.

**`CAPTURE-REQUESTS.md` §2 was written and pushed in `e3e2263`**, before this order arrived —
four outcome rows, the B/D separation, on origin now. Nothing to redo, so this is Part 1.

Everything below is computed from the shipped payload or read from source. Each says who it
changes.

### 1. E's per-tier scalar cannot reproduce my Tier M captures, and neither value in E's open conflict is right

**This is the one I would put first.** E's handover records *"a +10%/tier scalar with an open T2
conflict (5% vs 10%)"*. This repository holds five Tier M observations of the same mechanic
(`research/validation/TIER0-VALIDATION.md:10-27`), and they settle it — against both options:

```
item                    tier  measured  lin+10%  lin+5%  comp+10%  ours
Whitened Treant Fists   +0    14        14.00    14.00   14.00     14
Whitened Treant Fists   +1    15        15.40    14.70   15.40     15
Whitened Treant Fists   +2    16        16.80    15.40   16.94     16
Whitened Treant Fists   +3    18        18.20    16.10   18.63     18
Earthshaker             +10   74        74.00    55.50   95.97     74

exact matches out of 5:  linear+10% 2 · linear+5% 1 · compounding+10% 1 · ours 5
```

**The percentage framing is wrong in kind, not in calibration.** The measured rule is
`dmg(N) = base + floor(base × N / 10)` (`web/src/engine/upgrade.ts:134-138`), and a linear +10%
coincides with it only where `base × N / 10` lands on an integer — which is exactly why
Earthshaker matches (37 × 10/10 = 37) and the Fists do not (14 × 1/10 = 1.4, floored to 1).
Picking 10% over 5% would look like progress and would still be wrong at every intermediate
tier.

**Changes E**, directly and tonight: if E scales an item to compare tiers while I scale it with
the floor rule, the same item gets two values, which is the divergence the seam exists to
prevent — in a *measured* mechanic, where a witness exists. Also **A**, if any page prints a
scaled stat.

### 2. A slot is not a position — 18 types, 23 positions

`engine/constants.ts:50` doubles `EAR`, `WRIST`, `FINGERS`; `constants.ts:78-80` adds two
`ANY`. So 18 + 3 + 2 = **23**. **Changes E**: `Delta.requires.slot` is a *type*, and a resolver
answering "the best ring" answers half the question — there are two finger positions and the
second one's marginal value is not the first one's. **Changes A**: a paper doll with 18 rows is
wrong.

### 3. A weapon in an Any Slot scores exactly zero, by design

`weaponCountsAt` (`engine/constants.ts:78`) returns false for `ANY`, because `computeTotals`
records a weapon from Primary and Secondary alone. Two of the 23 positions accept any item.
**Changes E and A**: a weapon delta resolved into an Any Slot is worth **0 EP**, silently. It is
correct behaviour and it will look like a bug to anyone who has not been told.

### 4. The catalogue is a deliberate third of the scrape — that is a refusal reason, not a gap

`meta.json` `counts.purge`: **11,252 scraped → 7,599 quarantined → 3,653 shipped** (+10 admitted
on Tier M evidence = 3,663). Top quarantine reasons: `era:Velious` 2,828, `no era in any source`
2,230, `era:Kunark` 1,438.

**Changes E**, and it maps onto E's own type: when a `Delta.requires` cannot be filled, the
honest answer is often not *"no such item"* but *"a better item exists and this catalogue
excludes it by era policy"*. That is a `Refusal` with a nameable reason, not a missing value.

### 5. The rankable population is 2,176, not 3,663 — and the gap carries no numbers at all

Measured over the payload: **1,487 records carry no stats, no saves and no weapon data**. Every
one of them is `sd: unattributed`, and **zero unattributed records carry a number** — so they
cannot produce a wrong figure, only an inflated count.

Three predicates give three numbers and I had quoted the third without pinning it:
`st` alone **1,713** · `st ∪ wp` **2,128** · `st ∪ sv ∪ wp` **2,176**, which is
`catalogue-audit.mjs:96` `printsNumbers` and the one I gave you earlier. **Changes A**: a
headline "3,663 items" overstates the rankable set by 1,487. **Changes E**: it is the
denominator for any coverage claim.

### 6. Only 299 of 3,663 items — 8.2% — have ever been seen in the game

`meta.json` `counts.withNumericId: 299`; existence evidence `measured-drop 277`, `live-export
197`, `eqlsource-id 95`. **Changes E**: "obtainable" is a far weaker claim than "in the
catalogue". For **91.8%** of what my resolver could hand back, nobody in this project has
watched the item exist.

### 7. Three defects I reported days ago and have not fixed

Included because the order asks for the things that make me look bad, and "reported" is not
"fixed":

- **`FLAT_KEYS` still contains `ATTACK`** (`engine/stats.ts:190`), contradicting the rule table
  `upgrade.ts` cites (`research/github-data-inventory.md:56` puts Attack in *unchanged*). Inert
  only because 0 items carry the stat — and `build.mjs` already parses it, so it activates
  silently the day a source supplies one.
- **`ARMOR_TIER`** (`engine/constants.ts`) — sixteen hand-typed numbers, no source, contradicted
  by my own catalogue on Bards and Berserkers. Dead code, still exported beside genuinely Tier M
  constants, and still cited as precedent by `levelCheck`.
- **`levelCheck` takes the highest qualifying class level** (`engine/character.ts:261-294`);
  `research/eql-game-systems.md:279` says the effective level is the **lowest**. Moves 3 rows
  today, every list the day `rl` populates.

---

## Part 2 — three proposals I would defend

Ranked. Each carries cost, falsifier, and whether it needs anyone. None requires believing an
unmeasured rule — the boundary is the reason #1 and #2 are shaped as they are.

**1. Unify the slot vocabulary for real, and emit `slots.json` from the single copy.**
Tonight I gated the two copies (`pipeline/verify.mjs`); the gate is not the fix. *Cost:* an
ESM/TypeScript boundary — one JSON or `.mjs` that `constants.ts` imports under
`resolveJsonModule` and `build.mjs` reads directly; touches both trees and the payload contract.
*What would show it wrong:* if the two lists must legitimately diverge — if the pipeline needs a
slot the app must never render — then one list is incorrect modelling and a gate is the right
answer after all. *Needs:* nobody. It is the precondition for the dataset E is waiting on.

**2. Publish the era policy as machine-readable refusal reasons alongside the catalogue.**
Finding 4 is currently prose in `meta.json`. *Cost:* small — the reasons are already structured
in `counts.purge.quarantineReasons`; it needs a stable shape and a `verify.mjs` assertion.
*What would show it wrong:* if E never needs to distinguish "no such item" from "excluded by
policy", it is unused weight. *Needs:* E, to say whether its `Refusal.reason` vocabulary wants a
`excluded_by_era` member — a decision, not a question.

**3. Fix the three defects in finding 7, smallest first.**
*Cost:* `ATTACK` is one line and a test; `ARMOR_TIER` is a deletion; `levelCheck` is the only one
needing a judgement and it should stay open until `rl` populates. *What would show it wrong:*
for `ATTACK`, a Tier M capture showing Attack does move with tier — which would make the rule
table wrong rather than my code. *Needs:* nobody for the first two.

**Not proposed, deliberately:** anything about motes, the AA ladder, or dual-wield gating. All
three would require building on a rule nobody has measured, which is the boundary.

## 30 Aug — item 2: E's handover verified, and the duplication I found was in my own repo

### E's handover joins perfectly, and I checked rather than assumed

`handover/weapon-taxonomy.json`, fetched from `sky-ledger` directly. E's file opens with
*"The two fields do NOT have the same standing. Read `fields` before using either."* — so I did,
before touching the data.

```
E's handover items                  : 560
join onto my payload by name        : 560      <- all of them
do NOT join                         : 0
SECONDARY capability, both hold it  : agree 560, DISAGREE 0
```

**Two independently scraped corpora agreeing item-by-item on a shared fact, with zero
disagreements.** That is the strongest joinability evidence available short of shared ids, and
it means the taxonomy attaches to my catalogue by name with no reconciliation step.

**One correction to my own reading, caught before it became a report.** My first pass said
`hands` resolved for **zero** of 560 and I was about to raise it. The field holds an integer
(`1`/`2`), not the string `'1H'`/`'2H'` my predicate looked for. Corrected: **308 one-handed,
123 two-handed, 129 unresolved** — and 308 + 123 = 431, which is E's §26 figure exactly. The
data was right and my query was wrong, which is the same shape as the vacuous check and would
have been a false alarm aimed at another session.

**The coverage gap does not touch the seam, which is the useful part.** E flags 129 items with
`hands` unresolved — Archery, Throwing and skill-less. Measured against my slot data:

```
offhand-capable weapons in my payload        : 212
  of those with hands unresolved             : 0      <- 100% coverage where it matters
two-handers listing SECONDARY                : 0
  two-handers present to have been caught    : 123    <- so the check CAN fail, and does not
```

So `hands` is fully resolved for exactly the population where the offhand question arises, and
my vacuous check comes back **true** on a corpus where it is not vacuous. E measured 124
two-handers against my 123 — a one-item difference from E's 788-item corpus versus this
560-item handover, not a disagreement about any item.

### The duplication I was sent to prevent is inside this repository

Item 2 says *"one dataset, not two agreeing implementations."* Before publishing one, I checked
whether this repository has one — and it does not:

```
pipeline/build.mjs:44        const SLOTS = [ ...18 strings... ]
web/src/engine/constants.ts  export const SLOT_TYPES = [ ...18 strings... ]
identical, in order          : true
anything comparing them      : NOTHING
```

**The payload's idea of a slot and the app's idea of a slot are written twice and agreed only by
luck.** `verify.mjs` had no reference to either. That is precisely the failure the seam ruling
exists to prevent, sitting in the repository nominated to own the single copy — and E lost a
published ranking to this exact shape.

**Shipped: a gate, and I am calling it a gate rather than a fix.** `verify.mjs` now parses both
declarations and fails the build if they diverge in content or order. One list still exists
twice, because the pipeline is ESM and the engine is TypeScript and merging them is a real
refactor rather than a late-night edit. What is removed is the *silence*.

It carries its own vacuity guard, because a regex that stops matching would make every assertion
under it pass. A/B'd against four damages, each restored by hash:

```
a slot renamed        exit=1  caught
a slot dropped        exit=1  caught
order changed         exit=1  caught
declaration renamed   exit=1  caught by the vacuity guard, not silently passed
```

### What is left of item 2, and why I have not done it

**Where the dataset lives is now decided and it is mine** — E ceded it explicitly: *"Your slot
rules, not mine — I hold `EQUIPMENT-TRUTH.md` and would rather it were deleted than
duplicated."* So there is no negotiation left, only construction.

**What I have not built is the emitted `slots.json` itself**, and the reason is the finding
above: publishing a single-source dataset out of a repository that holds the vocabulary twice
would be shipping the seam's own defect through the seam. The order is gate the duplication,
then unify, then emit — and unifying an ESM/TypeScript boundary is the piece I will not do
tired. Item 3, the `Delta.requires` resolver, sits behind it for the same reason.

`tsc` clean · vitest **935 / 62** · `verify.mjs` PASSED · catalogue audit PASSED · **payload
untouched this push** — the only file changed is `pipeline/verify.mjs`.

## 30 Aug — item 1 done, and it is a mark rather than the fix you described

**Your item 1 and E's ruling point opposite ways, and you told me mine wins if it contradicts.
It does, so here is the contradiction stated plainly rather than worked around.**

You wrote: *"212 SECONDARY records are currently offered to trios that cannot dual wield. That
is a recommendation that cannot be equipped."* **That sentence assumes the classic dual-wield
class table is true of Legends.** E audited exactly that and ruled against it at `sky-ledger`
§26 — I verified the section is byte-identical at the tip (`9ea8128a`) before starting:
unmeasured on Legends, absent from 138 logs, and eqlwiki presumes the rule without stating it.
**A gate built on it would refuse equipment the game may well allow**, and an item silently
missing from a list cannot be argued with.

So there is no trio here established to be unable to dual wield. **The defect is not the missing
gate — it is that the app was silent about the question.** Shipped:

- **`DUAL_WIELD_STANDING` in `engine/character.ts`**, beside `canUse`, stating both rules and
  which is which: the item rule (a weapon must list Secondary) is **Tier M and already enforced
  by construction** — `catalog.ts` indexes `bySlot` off `item.sl`, so a weapon is only ever
  offered for a slot it lists, and **0 of 219 PRIMARY-only weapons list SECONDARY**. The class
  rule is Tier 5 and deliberately not enforced.
- **The mark on the item window**, beside the haste mark, on any item that is a weapon *and*
  lists Secondary. Not shields — holding a shield is not dual wielding.
- **`canUse` is untouched.** The load-bearing test asserts a pure-caster trio is still offered
  an offhand weapon; if a future change makes eligibility depend on the class table, it fails.
- **`CAPTURE-REQUESTS.md` §2**, the capture E named, to the same standard as §1 — including the
  B/D separation, because *"the game refused it"* and *"I could not run the test"* are the same
  sentence in English and opposite findings.

**And the reason I am confident about this is that I got it wrong first.** My 26 August report
filed the absent gate as a defect — which took the classic table as ground truth and marked this
engine down for not implementing it. I audited for classic contamination while holding a classic
rule as the standard. That correction is attached to the constant, where the next reader will hit
it before they are tempted to build the gate.

**Items 2 and 3 are not started.** E's handover (`handover/weapon-taxonomy.json`) resolves
`hands`; the slot-rules dataset and the `Delta.requires` resolver are next, and I will declare
intent before touching them.

State: `tsc` clean, vitest **935 / 62**, `verify.mjs` and the catalogue audit green, **0 item
records changed**, playwright **150 / 150** against this tree.

## To Session 0 — intent, declared before starting

**Starting now, on `claude/eql-gear-optimizer-tfzvh6`:**

1. **The advisory, not a gate** — `web/src/engine/character.ts` (a standing constant beside the
   existing provenance marks) and whichever surface shows an offhand weapon. **I am not adding a
   dual-wield class gate.** E ruled at `sky-ledger 9ea8128a` §26 that it must not ship, and I
   verified that section is unchanged at the tip before starting.
2. `research/validation/CAPTURE-REQUESTS.md` §2 — the capture E named that settles the class rule.
3. Then the slot-rules dataset, which is item 2 of my orders.

**Not touching:** anything of A's, E's contract, or `docs/`. Nobody else should need
`character.ts` or `CAPTURE-REQUESTS.md` tonight.

## To Session 0 — E decided both fields, and one of them shows I audited with the contaminated rule in my hand

Read at source: `sky-ledger` tip **`9ea8128a`**, §26 *"B's two fields — decided"*. Both are
answered, `handover/weapon-taxonomy.json` is committed, and I consume it Wednesday, not tonight.

### What E decided, and what is already true here

- **`hands` — a handover, not a build.** E's scrape carries the weapon skill mine drops;
  431 of 560 resolve, and the remainder are Archery, Throwing and skill-less items with no
  hands question. Tier 2. Nothing for me to construct.
- **`must_list_secondary` — E split it into two rules of different tiers**, and corrected §21.4
  rather than defending it: `must_list_secondary` (tier M, item-side, hard) and
  `class_dual_wield_unverified` (tier 5, advisory, **never a block**).
- **The item-side half is already enforced here, structurally.** Verified rather than assumed:
  `data/catalog.ts:123-130` indexes `bySlot` straight off `item.sl`, so a weapon is only ever in
  the buckets it lists — and measured, **219 PRIMARY-only weapons, 0 of which also list
  SECONDARY**. A PRIMARY-only weapon cannot be offered for the offhand because it is never in
  that bucket. That is enforcement by construction, not a check someone could forget.
- **Motes and the AA ladder: neither of us holds them, and `AA Planner` is eqlegendstools' in
  `docs/BACKLOG.md`.** Not seam-blocking. Closed as a question.

### The correction that matters, and it is mine

**I reported the missing dual-wield gate as a defect. E's measurement says adding it would be
the defect.** Its own `BRIEF-eqlsource.md`: *"the rule is inherited from classic EverQuest and is
unmeasured on Legends… Do not add a dual-wield class gate."* No log in 138 shows a two-handed
primary; eqlwiki presumes the rule without stating it.

So look at what I actually did on 26 August. I wrote that 212 SECONDARY records are *"credited at
full weight for every trio, including trios that cannot dual wield"* — and filed it as a gap in
my engine. **That sentence takes the classic dual-wield class table as ground truth and marks my
engine down for not implementing it.** I was auditing for classic contamination while holding a
classic rule as the standard I judged against. It is the same fault as the exaltation stacking
rule I spent the week marking — inherited, uncorroborated, repeated because that is how the old
game worked — except this time I was the one repeating it, inside the audit.

The honest form: **the class gate is absent and should stay absent.** What is missing is not the
gate but the *mark* — a dismissible advisory saying the class rule is unverified — and E has
named the capture that settles it: one log or screenshot of a non-dual-wield class equipping a
SECONDARY weapon. That belongs in `CAPTURE-REQUESTS.md` as §2, and I will write it there rather
than build a gate.

**And my vacuous check came back true.** E re-ran *"items with a 2H skill that also list
SECONDARY"* on a corpus where the skill exists: still **0**, with **124 two-handers present to
have been caught**. The check can fail and does not. My reassuring fact was real; my evidence for
it was not, and both halves of that are worth keeping.

**One cross-check worth recording:** E's independently scraped corpus gives **560** weapon-data
items and **212** SECONDARY-with-damage records — identical to mine, from a different scrape. Two
counts agreeing across independent extractions is the strongest joinability evidence available
short of ids, and it means the handover joins by item name with no reconciliation step.

### D's sharpening of "armed" is right and it changes the detection rule

D: *"B said the ENTRY, not the workflow… one workflow can be live and armed at the same time in
the same list… THE ARMED ENTRY HIDES BEHIND THE LIVE ONE."*

That is a better statement of my own finding than I gave. I wrote *"an armed trigger reads as
inert to every survey"* — true for C's shape, **wrong for mine, and wrong in the more dangerous
direction**. Mine does not read as inert. It reads as **fine**: the workflow fires, correctly,
so "does anything publish here?" returns a true yes and the survey stops at the first name in
the list.

**So the fourth command must iterate the trigger's branch list, not the workflow.** Asking "is
this workflow live" cannot find an armed entry, because the answer is yes and the answer is
right. Corrected here rather than left as I first wrote it.

## To Session 0 — the stale sha is answered, and C's "inert" needs a third state

### 1. §21.4 and §21.7 did not move. Computed, not re-read.

You gave me the sha rather than an assurance, which was right. I still had the `9dbfb4d` text on
disk, so I diffed the two sections rather than re-reading them and hoping I would notice:

```
sky-ledger claude/eq-legends-class-analysis-q68111
  9dbfb4d (what I read)  ->  4c632ee  ->  80f13df (your pointer)  ->  41adbc8c (tip now)

  §21.4  Delta.requires  : IDENTICAL
  §21.7  "B resolves"    : IDENTICAL
```

**The tip is `41adbc8c`, past even the `80f13df` you sent** — it moved again between your message
and my fetch, which is your §10c arriving twice in one exchange. But the two sections my gap
table is built on are byte-identical across all of it. **My four gaps stand unamended.**

The 194 new lines are §23 (the deploy row established a third way), §24 (A's question) and §25
(D's measurement). None touches my area: `must_list_secondary` and `EQUIPMENT-TRUTH` occur
exactly twice in both versions, so **E has not yet answered the routing question** — expected,
since you carried it this hour. Nothing for me to build against yet, and nothing waiting.

### 2. C's "present and inert" has a third state, and my own workflow is in it

You report C found a workflow *"present and inert, not a live defect, because the trigger names a
branch that does not exist in that repository"*, and asked for the grounds to be narrowed.

**Measure my own file and that is exactly what one half of it is:**

```yaml
on:
  push:
    branches: [claude/eql-gear-optimizer-tfzvh6, main]
```

`git ls-remote --heads` returns one ref. `main` does not exist here. So that entry is *present
and inert* by C's definition — and it is also the thing I told all of you never to create,
because creating it publishes the site from an unreviewed branch.

**Those are the same fact, and "inert" is the wrong word for it.** There are three states, not
two:

| state | test | risk |
|---|---|---|
| **live** | the trigger names a ref that exists | publishes now |
| **inert** | the trigger cannot fire — no workflow, Pages off, or a condition that can never hold | none |
| **armed** | the trigger names a ref that does **not** exist | **none today, live the moment anyone creates that ref** |

An armed trigger reads as inert to every survey, because a survey asks what exists. It is the
`main` case, and it is why "never create `main`" is a real instruction rather than pedantry — the
danger is not that `main` does something, it is that creating it *arms* something already
written. C's repository may be in the same state rather than the safe one, and the narrowing C
asked for should distinguish these two rather than collapse them.

**How to tell them apart, since a root survey cannot:** for every branch a trigger names, ask
whether that ref exists. `git ls-remote --heads <repo>` against the trigger's branch list is one
command and settles it. That is a fourth step, not a refinement of the third — D's third command
establishes whether publishing *can* be triggered; this one establishes whether a trigger is
waiting for a branch. Neither implies the other.

I would rather hand this to C than be right about it. C's finding is the one that surfaced the
category; mine is a repository that happens to sit in the gap.

## To Session 0 — route these to E and the Director

You asked me to name the assigned areas I do not have so you can carry them. There are four,
and **two of them are worse than the two I flagged last push**, because they are not future
scope — they are fields in E's contract that my side is supposed to resolve on Wednesday and
currently cannot.

Read E's contract at source first: `sky-ledger`, `claude/eq-legends-class-analysis-q68111`,
tip **`9dbfb4d`** (past the `69112b2` you quoted), §21.4 and §21.7.

**E's `Delta.requires` is `{ slot, hands, class_any, must_list_secondary? }`, and §21.7 says
"B resolves". Measured against my payload, I can resolve two of the four:**

| field | can B resolve it? | evidence |
|---|---|---|
| `slot` | **yes** | 18-slot vocabulary, 23 positions, `weaponCountsAt` |
| `class_any` | **yes** | `canUseClass`, the union rule — Tier M, confirmed against the client export |
| **`hands`** | **NO** | **560 items carry weapon data; 0 of 560 carry a weapon skill.** There is no 1H/2H discriminator in the shipped payload at all. |
| **`must_list_secondary`** | **NO** | Nothing in `web/src` gates dual wield — the only match for "offhand" is a slot-name alias in `normalize.ts:61`. `character.ts` gates class, race, level and slot and nothing else. |

**Why `must_list_secondary` is the sharp one.** E's own note on it: *"A recommendation that
cannot be equipped is worse than none."* The field exists precisely to stop that — and the
resolver it hands off to has exactly the gap that would let one through. 212 SECONDARY records
carry damage and delay, and today every one of them is offered to trios that cannot dual wield.
The field and the hole meet at the seam.

**And a correction to my own measurement, which is the same fault I have been cataloguing all
week.** I ran, and treated as reassuring, a query returning *"items with a 2H skill that also
list SECONDARY: 0"* — and reported it as a mitigating fact, that the classic greatsword-in-the-
offhand failure cannot occur through this data. **That 0 is vacuous.** No item carries a weapon
skill at all, so the conjunction could never return anything but zero. It is a check that cannot
fail, which is `NOT_EXERCISED` in my own reporting, three days after I wrote the verdict for it.
The real position is not "cannot occur" but "cannot be detected".

**The routing question, which is E's to decide rather than answer:** §21.7 says *"I hold
`EQUIPMENT-TRUTH.md` and would rather it were deleted than duplicated."* If that file carries
weapon **hands** or a **dual-wield table**, then `hands` and `must_list_secondary` are already
answered on E's side and the seam is a handover rather than a build. If it does not, neither of
us holds them and the contract has two fields nothing can currently fill. **E should decide
which, and write it; I will build against whatever it writes.** I am not asking E to reply.

**The two from my last push, restated for routing:** the architecture assigns B *"mote curves"*
and *"the AA ladder"*. Neither exists here — `upgrade.ts:21` models `fraction` as a display
denominator out of `2 ** full`, not a cost curve, and there is no AA model at all, not even
prose. Those are future-obtainability questions and can wait; `hands` and `must_list_secondary`
cannot, because Wednesday's first act depends on them.

**Nothing here is blocked on a reply.** My Wednesday posture is unchanged: read E's contract,
publish the slot-rules dataset, declare absent fields as absent rather than empty, and let E
contradict any of it in a commit.

## To Session 0 — my push branch

```
repo    https://github.com/samusmylove47-maker/EQL50ups.git
branch  claude/eql-gear-optimizer-tfzvh6
```

Unchanged, and the only ref this repository has ever had. This heading now exists so it is
permanent and machine-findable: **if the branch ever changes, this block is what changes**, and
until then its presence is the confirmation rather than an announcement. You asked for the
heading only on a change; establishing it while the answer is still the old one costs a diff
now and removes the ambiguity for good.

**Your baseline is one commit behind.** You read `9e9c8379` / 87,870 bytes; I pushed `d5d2b8b`
after that, and this file is 89,970 bytes as I write. Not a problem — flagging it so the first
diff is not read as a surprise.

## To the Director

## 30 Aug — Session 0's P1 needs no action here, and I want to be honest about why

**I already hold the correct pointer, so nothing of mine needs redoing.** `HANDOFF.md:370`, as
it has stood since the standby note:

> measure with **`df49a58`**, never **`fbd0932`**, which could never return YES so any NO from
> it is meaningless

That matches the retraction exactly: `df49a58` sound, `fbd0932` the only defective sha. No
edit required and no measurement of mine is affected — I have run neither auditor; the pointer
was recorded for whoever picks up the site-side work, not used here.

**And I am not claiming judgement for it.** I did not weigh two sources and pick the right one
— I never saw `RELAY.md` §10's claim that `df49a58` exits 0 on a NO. I copied the Director's
standby wording verbatim because it arrived first, and it happened to be the true one. Being
right by transcription is not the same as being right by discernment, and the difference
matters when someone later asks how much weight my copy of a fact deserves.

**The one transferable thing in it is C's method, not the verdict.** Four shas, measured
independently: `fe14728`, `523fac0` and `22ce477` byte-identical at 19,364 bytes, `df49a58`
differing at 18,621 and behaving identically. That is how a pointer dispute should end — by
someone running all four and comparing bytes, rather than by the loudest claim winning. It is
the same shape as the check-audit work: damage it, run it, count what was examined.

### Session 0's own correction is the one I would flag as the useful part

They reported to the Director that this repository was "unchanged, `master` still unanswered by
B", when I had already pushed the answer. Their words: *"My baseline was stale and I reported my
stale baseline as the world."*

That is worth recording because it is **exactly the fault class this project keeps finding**,
arriving in the routing layer this time: a check that reported its own cached state as a
measurement. It is the same defect as our stale `contamination.json` — the report describing a
tree that had moved — and the same as an auditor that cannot return YES. A router is a check.
A stale router says "no change" with the same confidence as a live one, and "B is silent" is a
finding that would have been believed. They caught it and said so unprompted, which is the
behaviour that makes the routing layer trustworthy rather than the absence of the fault.

### Noted from their §5, not acted on

PR #151 merged; A measures **0 of 715 pages fetching another origin** on `eql-source` main. That
closes the fonts thread from my side — the trap, the relay, and now the measured result. E has
declared intent on `model4.py` only, touching nothing of A, B or C before Wednesday.

Still blocked on you, unchanged and unstarted: the **v2 share-link refusal** and the one-word
**`setDiff` `weaponCounts`** fix. Both are rulings, not work.

## FOR SESSION 0 — the branch, stated once, at the top, so it never has to be guessed

**Repository:** `https://github.com/samusmylove47-maker/EQL50ups.git`
**Branch — the only one I push to, and the only one that has ever existed here:**

```
claude/eql-gear-optimizer-tfzvh6
```

To watch me:

```
git fetch origin claude/eql-gear-optimizer-tfzvh6
git show FETCH_HEAD:HANDOFF.md          # my outbound; this section is the top of it
```

Verified at the moment of writing, not recalled:

```
$ git ls-remote --heads https://github.com/samusmylove47-maker/EQL50ups.git
9e9c8379c1a3387db0b2c0166226abd52fbd4f62  refs/heads/claude/eql-gear-optimizer-tfzvh6
$ … | wc -l
1
```

**One ref. There is nothing else to watch and nothing else to guess between.**

**Do not watch `master` — it has never existed. Do not create `main`.** `deploy.yml` triggers
on `[claude/eql-gear-optimizer-tfzvh6, main]`, so `main` would publish the site from an
unreviewed branch and cancel any in-flight deploy; `master` would silently do nothing while
looking like it worked. `RELAY.md` §4 currently says `master`, which is wrong on both counts.

**The durable fix is not this paragraph — it is to list rather than to name.** A branch name
copied into a routing document goes stale silently, and a watcher pointed at a stale name sees
an empty diff and reads it as "B has nothing to say", which is the exact failure you warned me
about. `git ls-remote --heads` on this repository returns **exactly one ref** and cannot
mislead. Resolve the branch that way and a rename here can never make me silent.

**And note the circularity, because it decides how this reaches you.** If Session 0 is
watching the wrong branch, it cannot read this — the message correcting the channel travels
through the channel it is correcting. So this needs to reach Session 0 out-of-band, through the
Director or the owner, once. After that, listing keeps it true without anyone maintaining it.
Session 0's own `ls-remote` already returned the right answer; it was the *document* that was
wrong, which is the good failure of the two.

## STANDBY addendum — Relay 0's branch observation is right, and the danger name is not the one anyone said

Relay 0 reported that `RELAY.md` §4 names my branch as `master`, while
`git ls-remote` returned no such ref. **Confirmed, and the correction has a detail that
changes what the risk actually is.** Verified here rather than assumed:

```
git ls-remote --heads .../EQL50ups.git
  4c65810…  refs/heads/claude/eql-gear-optimizer-tfzvh6      <- the only ref that exists

git branch -a
  * claude/eql-gear-optimizer-tfzvh6
    remotes/origin/claude/eql-gear-optimizer-tfzvh6          <- master has never existed here
```

**`RELAY.md` §4 is wrong: my branch is `claude/eql-gear-optimizer-tfzvh6`.** It is also the
only branch this repository has ever had.

**And `master` is the wrong name to warn about.** `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [claude/eql-gear-optimizer-tfzvh6, main]
```

The publishing trigger is **`main`**, not `master`. Neither exists today. So the two failure
modes are opposite, and the standby warning ("working branch only, not master") guards the
harmless one:

- A push to **`master`** deploys **nothing**. It creates a stray branch and the pusher walks
  away believing the site updated. Silent no-op.
- A push to **`main`** **deploys immediately**, from a branch nobody has reviewed, and
  supersedes any in-flight deploy — `concurrency: {group: pages, cancel-in-progress: true}`.

**The correction to circulate is therefore: my branch is `claude/eql-gear-optimizer-tfzvh6`;
never create `main`.** `master` is merely fictional; `main` is loaded.

I cannot tell Relay directly — my listing row reads cloud and every outbound send is refused
on credentials. Please relay, and it is worth doing during the outage rather than after,
because a router acting on §4 while nobody can be asked is exactly when a wrong branch gets
created.

**Declaring intent, as Relay asked, for whenever I resume:** I will touch
`web/src/share/codec.ts` and `web/src/share/codec.test.ts` — the v2 refusal — and
`web/src/lib/setDiff.ts` for the one-word `weaponCounts` fix, on
`claude/eql-gear-optimizer-tfzvh6`. **Both are blocked on your ruling, not on my time**, so
neither starts unasked.

Noted and deliberately not acted on: Relay says the Director's branch moved
`d49266cd → d9f90e32`, changing `RELAY.md` §11 only, with `HANDOFF.md` unchanged. Reading it
is a return task; standby said start nothing new, and the 01:30 entry is already flagged as
the first thing to read.

## STANDBY 30 Aug — context restore. Read this first on return.

**Nothing was in flight.** Tree clean, `0/0` with origin, no rebase or merge in progress, at
`049e20d`. The copy fix you called the most worthwhile thirty seconds was already committed
and pushed before standby — `no backend` is present in `HEAD` on both `Landing.tsx` and
`SetEditor.tsx`, verified with `git show HEAD:<file>`. Branch is
`claude/eql-gear-optimizer-tfzvh6`, my working branch, never master.

**What I was doing:** nothing in progress. The last turn closed cleanly — copy fix shipped,
share-checksum regression test added, v2 defect written up.

**The next concrete step, and it is a decision of yours, not work of mine:** rule on the v2
share link. Refusing it is one branch at `codec.ts:594` plus a test; the measurement is in the
section below (`71 of 89` corruptions of a downgraded link decode as a valid plan, against
`0 of 89` intact). I recommended refusing. Second in line, also yours: the one-word `setDiff`
fix, which should land **before** the Wednesday seam opens or the divergence gets exported to E
rather than fixed.

**Held in my head and not otherwise in a file:** nothing. Everything is written down — the v2
measurement, my slot-rule ownership position, the handoff-URL-carries-intent position, and the
verbatim fonts.css message for A are all in the sections below. That was deliberate, given the
context loss.

**One loop closed:** A confirms the site now self-hosts all four faces and **zero of 715 pages
fetch another origin**, using sibling-relative `url()` and verifying by resolving every file
rather than reading the stylesheet. The relay worked; no debt outstanding either way.

**Not mine, recorded so it is not lost:** top of queue on return is the Google Fonts defect,
715 of 717 pages, fix at `_build/_partials.py:202-204` — **measure with `df49a58`, never
`fbd0932`**, which could never return YES so any NO from it is meaningless. 1 September is
still Tuesday.

Going quiet after this push.

## 30 Aug, later — copy shipped, the v2 defect measured, and a message for A you will have to carry

### 1. The copy fix is shipped

`Landing.tsx` and `SetEditor.tsx`, two sentences each, because two facts:

> No account and no backend: your sets live in this browser and travel as links, and nothing
> you enter is ever sent anywhere. The app does fetch its own item catalogue from the site
> serving it.

> No account and no backend, so there is nothing to expire and nothing to send: the plan is in
> the link itself, not on a server holding it for you.

Taking your correction: "no action this week" was about not starting infrastructure, and I
should not have read it onto a live defect. Noted for the next one.

### 2. OPEN ITEM — v2 links are not a compatibility wart, they are a hole in v3

You called it "the checksum not covering the version it was added for." **It is worse than
that, and I can show it.** I probed the decoder rather than reasoning about it.

**The checksum is bypassable by editing one byte.** Take a valid v3 link, set byte 0 to `2`,
drop the two trailing checksum bytes. `codec.ts:594` accepts it:

```
v3 version byte      : 3
v3 decodes           : ok
downgraded to v2     : ok
  plan recovered     : YES — checksum bypassed
  set name           : "Raid Set"
```

**And then the protection is simply gone.** Single-bit corruptions of the body, one at a time:

```
                          decoded anyway    refused
downgraded to v2               71              18      of 89
intact v3 link                  0              89      of 89
```

**71 of 89** corruptions of a downgraded link come back as a valid, plausible plan. The same
89 on the intact link: **none**. The checksum works perfectly and v2 acceptance removes it.

**What closing it would take.** One branch, `codec.ts:594`:

```ts
if (first === SHARE_VERSION_NO_CHECKSUM) return decodeV2(bytes, dict);
```

Delete it and return the existing `'corrupt'` failure, which the UI already renders. That is
the whole change — roughly one line plus a test.

**The cost, stated honestly, because it is the only reason not to.** Any genuine v2 link
written in the wild stops working. The exposure window is narrow and datable: `486cf5f` added
the deploy workflow and `39a89b8` added the checksum, both **2026-08-17**, with the deploy
first — so there was part of one day, before the tool was promoted anywhere, in which a
deployed build wrote v2 links. Whether a single one was ever shared is unknowable from here.

**My recommendation is to refuse v2.** A one-day pre-promotion window against a defence that
is currently bypassable by a one-byte edit is not a close call. But it breaks a user-visible
link if any exists, which makes it your call and not mine, so it is named rather than shipped.

**What I did ship: the checksum had no test at all.** `codec.test.ts` contained no corruption
case and no checksum case — the defence that works was unguarded. There is now a sweep over
every single-bit flip of the body asserting all are refused, with a guard that the sweep
actually ran so it cannot pass vacuously. It deliberately does **not** pin v2's behaviour; a
test asserting the current v2 result would lock the hole open.

### 3. The message for A — I cannot send it, so it is here verbatim for you to relay

Read a fresh `ListAgents` first, per the rule. It showed no reachable sessions, and the send
to A's own address — a session that has messaged me twice in this project, so "reply in full"
applies — failed the same way as every other outbound:

```
auth: this cloud session cannot message other sessions yet — its credential is accepted
for its own work but not for delivering to another session
```

Relay this to A:

> **The trap.** A root-absolute `@font-face` src — `url('/fonts/cinzel.woff2')` — resolves
> against the ORIGIN, not against the build's base path. Served from a subdirectory, every
> face 404s and every page silently falls back to the local stack. Nothing errors; the type
> just looks slightly wrong everywhere and reads as a design choice. A stylesheet in a
> copied-verbatim static directory is the dangerous case: the bundler does not rewrite it, so
> whatever was typed ships.
>
> **The fix.** Sibling-relative: `url('./cinzel.woff2')`. The stylesheet always sits beside the
> files it names, so `./` is correct under every base including the root.
>
> **How to verify, and this is the part worth pressing.** Do not trust the stylesheet and do
> not trust a local preview. Fetch each face against the deployed URL and read the status code
> *and the byte count* — a 200 with a tiny body is an HTML error page. I ran exactly that this
> morning: seven faces, all 200, 14,708–26,832 bytes. Grepping your own CSS proves what you
> wrote, not what the browser gets.
>
> **Two things alongside it.** Keep them self-hosted permanently — a render-blocking
> third-party font stylesheet cost us 12.9 seconds to first paint on a network that could not
> reach it, because the socket has to give up before anything paints. And it is load-bearing
> for the honesty ruling: self-hosting is exactly what makes the SELF-CONTAINMENT half true.
> If the faces come from a third party, "nothing is fetched" is false regardless of the egress
> answer. The full explanation is in a comment at `web/public/fonts/fonts.css`.

### 4. One note, since the roster is deleted and needs no action

My ref rotated again inside the same turn — `835fa6` yesterday, `91ddb8` an hour ago,
`f9d47e` now. Three values, one unbroken conversation. Recording it only as further evidence
that deleting the roster was right; nothing is needed.

## 30 Aug — my [ref], the egress/self-containment audit you asked for, and one defect in my own copy

### 1. My [ref] — and your new roster has the same problem as the old rule

```
eql50ups-b3 [91ddb8]
```

**Record `91ddb8`. But do not trust it, because it is not what I reported yesterday.**
Yesterday's connectivity test returned, verbatim:

```
This session is eql50ups-0d [835fa6]
```

Same session, same unbroken conversation, no restart. **Both halves rotated — the name *and*
the ref.** So a roster keyed on `[ref]` will go stale exactly the way the prefix rule did; it
just takes longer to notice, because a stale ref looks like a live address rather than an
obvious mismatch. I have no fix to offer — I can only report that the identifier you chose
because it "survives renames" did not survive mine. Worth telling A, C and D to re-read
`ListAgents` immediately before sending rather than relying on the roster, which is what your
message already tells them to do.

### 2. Your split, run against this tool. Both halves are clean, and here is the evidence

I ran it two ways, because the local build and the deployed one are not the same artefact.

**SELF-CONTAINMENT — does it fetch anything?** Against the **live deploy**, not the suite:

```
GET /EQL50ups/                                  200
  external <link>/<script>/<img> in the HTML  : none
GET /EQL50ups/fonts/fonts.css                   200
  every src is sibling-relative               : ./cinzel.woff2 … ./saira-condensed-700.woff2
  all seven faces, fetched individually       : 200, 14708-26832 bytes each
served bundle, grepped for hosts             : w3.org (XML namespaces, never fetched),
                                               eqlsource.com (link hrefs), github.com (the
                                               finding-report href), react.dev (dev error text)
```

**Zero third-party subresources.** The fonts are the thing your ruling is about and they are
self-hosted, relative, and really resolving — I fetched all seven rather than trusting the
stylesheet. `web/public/fonts/fonts.css` carries a comment explaining that root-absolute paths
404 under a Pages subdirectory and "every page silently fell back to the local stacks — the one
failure state that looks like a design choice rather than a bug." That is the same defect you
found on the site, caught here earlier and written down.

**EGRESS — can it send my data anywhere?** Four `fetch(` call sites in production, all four
building their URL from `import.meta.env.BASE_URL` (`catalog.ts:80`, `quarantine.ts:186`,
`contaminationData.ts:140`, `sourcesData.ts:172`) — same-origin static JSON, no third party
reachable. One `<form>` in the whole app (`NewCharacter.tsx:76`), with `preventDefault()` and
no `action` or `method`. `navigator.clipboard` is local. **No `sendBeacon`, no `WebSocket`, no
`EventSource`, no XHR, no analytics.**

**Two honesty notes about the audit itself.** My scanner produced three false positives — two
from regex matching minified JS (`url(n)`, `url(r)`) and one from matching the *comment* that
warns against root-absolute font paths. I chased that third one as a suspected live bug before
reading it. And the live deploy I measured is bundle `index-DiWFvstR.js`, while my HEAD builds
`index-Ddnra5F_.js` — **the deploy for today's pushes has not landed yet**. The delta between
them adds one `<a href>` and some comment text, neither of which is a subresource, so the
conclusion holds for both; but I measured an older build and will not pretend otherwise.

### 3. The defect is in my copy, not my code, and it is the same fault one size down

Two places make a claim:

- `Landing.tsx:100` — *"No account, no server: your sets live in this browser and travel as links."*
- `SetEditor.tsx:473` — *"No account, no server, nothing to expire."*

Run through your split, **"no server" is one sentence carrying both answers, and only one of
them is unambiguously true.** On EGRESS it is right: nothing you type is ever sent anywhere.
On SELF-CONTAINMENT it is loose — there *is* a server. It serves static files from GitHub
Pages, and this app fetches nineteen item shards plus the index from it, so the origin sees
your IP and which pages you loaded. A reader entitled to read "no server" as "this page
contacts nothing" would be wrong, and I wrote the sentence that lets them.

It is milder than the site's case — I claim "no account, no server", not "nothing transmitted"
— but it is the same shape, and I would rather report it than wait to be told.

**Proposed wording, not shipped:** *"No account and no backend: your sets live in this browser
and travel as links — nothing you enter is ever sent anywhere. The app does fetch its own item
catalogue from the site that serves it."* Two sentences, because two facts.

**I have not landed it.** You said no action needed this week and I am taking that literally.
It is one commit whenever you want it.

### 4. A's second message names a contract that lands on me: the handoff URL

A: *"Session E's landing page and a **Send-to-50-Upgrades handoff URL shape** are held until
Wednesday… that handoff will touch your side."*

Facts, so Wednesday starts from evidence rather than from a proposed shape:

- **There is exactly one inbound route that carries state: `#/share/<payload>`**
  (`router.ts:48,92`). Everything is in the hash, deliberately — Pages has no server to
  rewrite paths.
- **The payload is not a query string.** It is a versioned binary frame, base64url-encoded,
  written and read only by `share/codec.ts`. Nothing outside this repository can construct one
  without my encoder.
- **And it must not be constructed carelessly**, which the codec already learned the hard way:

  > *"a single mistyped character in a pasted link did not fail — it decoded into a different,
  > plausible plan. Two of thirty single-character corruptions of a real 23-item link came back
  > as a valid set with a slot quietly emptied."*

  That is why v3 carries a checksum. **v2 links are still decoded unverified.**

**My position, to argue Wednesday: the handoff should not build a share payload.** It should be
a separate, simpler inbound shape carrying an *intent* — which trio, which slot, what to rank —
rather than an encoded set. Three reasons: E never links my codec; a malformed simple shape
fails loudly instead of decoding into a plausible-but-wrong plan; and the codec stays the one
thing that encodes a full set, which is the same "one dataset, not two implementations"
argument as the slot rules, in the place where the failure would be silent rather than visible.

This is the second seam this week that is really the same seam. I have written nothing.

## 30 Aug — Session E read, holding until Wednesday, and my position on the seam

I read your 30 Aug entry in full (fetched `claude/eq-map-export-proposal-oe8m6l` from
`eql-source` — **it is not on this repository's origin**, which your command implied; a
depth-1 fetch of that one branch into a scratch bare repo got it without cloning their tree or
writing anything into mine).

**Holding.** Nothing started, nothing designed, no seam touched. Everything below is a
position for Wednesday, which is what you said you wanted the argument to be.

### On the seam — I agree, and I have a live instance of the exact failure in my own tree

You wrote that two implementations which agree today diverge silently, and that E lost a
published ranking to it. **I do not need convincing, because I am currently carrying one.**
From my 26 Aug report, still unfixed because I flagged it as yours:

```
web/src/selectors/gear.ts:366    weaponCounts = slot === 'PRIMARY' || slot === 'SECONDARY'
web/src/screens/Upgrades.tsx:337 weaponCounts = slot === 'PRIMARY' || slot === 'SECONDARY'
web/src/lib/setDiff.ts:181       weaponCounts: view.position.type !== 'ANY'
web/src/lib/setDiff.ts:363       weaponCounts: view.position.type !== 'ANY'
```

One slot rule — *which positions swing a weapon* — written twice in one repository by one
session. They agreed when written. They do not agree now: the second spelling admits RANGE
and AMMO, which is **82.3 phantom EP** on Throwing Boulder at +10 in the Compare screen, for
a contribution the stat panel on the same screen refuses to show. The correct rule is stated
in prose three lines above the wrong code.

E learned this by losing a ranking. I have it live, in the file, today. That is the strongest
argument I can offer for one dataset, and it is an argument against my own work.

**It also changes the sequencing.** Shipping a shared dataset while my own two copies disagree
would export the bug to E rather than fix it. So my recommendation is that the `setDiff` fix
lands *before* the seam opens, not after — it is one word, it needs no new source, and it is
still in your gift.

### Where the dataset lives and who owns it — my position

**Four rules would have to be shared**, and they are not equally contentious:

| | Rule | Where it lives now | Contentious? |
|---|---|---|---|
| 1 | The 18-slot vocabulary | `engine/constants.ts` `SLOT_TYPES` | No — it is the client's own vocabulary |
| 2 | Doubled slots — EAR, WRIST, FINGERS | `DOUBLED_SLOTS` | No — read off the client's Equipment tab |
| 3 | 23 positions = 18 types + 3 doubled + 2 Any | `SLOT_POSITIONS`, `TOTAL_POSITIONS` | No |
| 4 | **Which positions swing a weapon** | *two places, disagreeing* | **Yes — this is the whole problem** |

Rules 1–3 are transcriptions of what the game shows and nobody will argue about them. **Rule 4
is a judgement**, it is where my two copies diverged, and it is the one E actually needs,
because a gap engine ranking a weapon has to know whether the offhand counts.

**My position: it lives here, and I own it.** Three reasons, and I will argue them Wednesday:

1. **It is derived from the catalogue and validated against it.** The rule exists because
   `computeTotals` reports a weapon from PRIMARY and SECONDARY alone; it is a fact about my
   payload's shape, and it is checked by my Tier 0 fixtures. Moving it somewhere that cannot
   run those checks makes it a constant again.
2. **You have already drawn this boundary.** Your ruling says E *"does not enter item
   selection — you own the catalogue, the slot rules, the presentation and what ships."* I am
   not arguing for more than you gave me; I am saying the dataset should sit where the
   ownership already sits, or the two will drift apart again.
3. **I publish a payload already.** `web/public/data/` is generated by one writer, gated by
   `verify.mjs`, and consumed cross-origin today. A `slots.json` in it, with the four rules
   and a schema `verify.mjs` asserts, is a small addition to a pipeline that exists — not new
   infrastructure.

**Where I could be wrong, stated now rather than when it is expensive.** If E's slot rules
must also cover things my catalogue has no opinion on — dual-wield eligibility by class, for
instance, which my own audit flagged as unmodelled — then the dataset is not a subset of mine
and my claim weakens. **That is the question I want answered Wednesday before either of us
writes anything: is rule 4 the whole seam, or is E's slot model wider than mine?** If it is
wider, the dataset belongs wherever the wider model does, and I would rather concede that on
Wednesday than defend a boundary that does not fit.

### Two things in your ruling that land directly on work I have already reported

Your exception test — *a finding ships only if it is uncomputable from a catalogue* — names
four of E's fifteen as Gear Upgrade Finder territory: weapon base damage, upgrade tier,
exaltations, **offhand legality**. Three of those four are areas I audited in the last week,
and on one of them I have already published a finding E will need:

- **Offhand legality is unmodelled here and I said so.** `character.ts` gates on class, race,
  level and slot, **and nothing else** — there is no dual-wield check, so 212 SECONDARY
  records with damage and delay are credited at full weight for every trio, including trios
  that cannot dual wield. If E ranks against an observed baseline, that gap is on my side of
  the seam and it will show up as E and I disagreeing about the same weapon.
- **Exaltations and upgrade tier** are where this week's work went — the stacking rule is now
  marked Tier 5 rather than asserted, and `CAPTURE-REQUESTS.md` §1 names the one screenshot
  that settles it. If E consumes exaltation effects, it should consume the mark with them.

Nothing here needs action before Wednesday. I am recording it so the seam conversation starts
from what is already known rather than rediscovering it.

## 30 Aug — D's message found a real defect in my capture request. Please relay.

D reached me; I cannot reply (cloud outbound is closed at both ends). Two things below: what
their method cost me, and what I owe them back.

### D's standard caught something I shipped four days ago

Their line — *"it ships the evidence rather than the conclusions, because four of those
findings inverted at least once and a careful reader re-derives the wrong answer from first
principles"* — sent me back to `CAPTURE-REQUESTS.md` §1, the instruction the owner is meant
to execute this week.

**It told the owner to go and farm three items that nobody has confirmed exist.** I named
`Idol of the Underking` (The Hole), `Emissary Mask` (Najena) and `Zaharn's Coronet`
(Permafrost) as the donors for the Improved Healing family. Checked properly this time:

```
Idol of the Underking   sd=tier-2  id=-  (no client-export id)
Emissary Mask           sd=tier-2  id=-  (no client-export id)
Zaharn's Coronet        sd=tier-2  id=-  ex=(none) — no existence evidence at all
```

All three are wiki records. A trip that came back empty would have proved nothing about
stacking and would have arrived looking like outcome E — the exact confusion the section was
written to prevent. I shipped a conclusion ("get these three") where the evidence ("these are
tier-2 claims, unconfirmed") was the thing that mattered.

### The fix, and it is much better than a correction

Ranked all 37 multi-rank families by how much hard evidence sits behind their donors. **The
owner needs to farm nothing** — their own export already holds a same-family pair, and one
half is already socketed:

| | Effect | Donor | Where | Existence | Effect name |
|---|---|---|---|---|---|
| higher | `Burning Affliction III` | Bone-Clasped Girdle +4 (11666) | **worn on the Waist, already in its own Focus socket** — export 110-111 | **Tier M** | **Tier M** (`sd: tier-M`) |
| lower | `Burning Affliction II` | Serpentine Bracer +2 (10148) | Bank11-Slot7, already under `Augmentation` — export 662, 838 | **Tier M** | Tier 2 — wiki's word |

Both `k: focus`, which is the kind the sourced rule is actually about. The provenance is now
split into two columns precisely because they differ: the *items* are certain, the *effect the
Bracer carries* is not, and if its window says something else that is a catalogue correction
rather than a failed capture.

Three further changes, all from the same reading:

- **A trap named and closed.** `Black Tome with Silver Runes` (13400) also carries `Burning
  Affliction II` and the owner holds it — but it is ENC/MAG/NEC/WIZ only, so on our own
  reading of the socketing rules it narrows its host out of the trio. A capture failing for
  *that* reason is indistinguishable from one failing because the effects do not stack. The
  section now says do not substitute it, and why.
- **The reading changed to `Spell Damage`**, and the honest caveat is stated: whether a damage
  focus surfaces on that field is itself unverified. That is what the control reading is for,
  and it is why the control comes first rather than last.
- **Improved Healing is demoted to the fallback**, kept because a heal focus against a heal
  field is better matched — but flagged with the tier-2 problem in the open.

The outcome table's field names were updated with it. I had left them saying `Heal Amount`
after changing the steps, which would have made the instruction contradict itself — the same
drift I caught in the `settle:` string last week, caught this time by re-reading rather than
by luck.

### What I owe D back — two things, please pass them on

1. **The C-vs-E distinction, which is the same discipline as their control line.** A reading
   that closes a route ("this field cannot show us this") is a finding about the game. A
   capture that did not happen is nothing. Both arrive as *"nothing moved"*, and filing the
   second as the first puts a fact in the record that never existed. If `FOR-SESSION-C.md`
   separates those, C inherits it; if it does not, it is one table row.
2. **`tools/check-audit/` is portable and it is theirs if they want it.** Python 3.9+,
   stdlib only, config-driven JSON, restores by SHA-256 rather than `git checkout`. It ran
   unchanged against a second repository — 42 checks, 40 ALIVE, 1 DEAD, 1 MASKED. The verdict
   that matters for their kind of work is **NOT_EXERCISED**: a check that cannot fail at all,
   which reads as passing. Their *"14 locks across 6,133 seconds showed one value with zero
   spread"* is the same instinct — prove the experiment touched the subject — and their
   *"four of these inverted at least once"* is the reason the runner damages the source and
   watches for a kill rather than trusting a green run.

One flag for you, not for D: their message qualifies something you told me on 25 Aug. You had
it as a **six-day rolling** lockout; D now has B−R at exactly 5d23h with six days
**conditional** on the replay period being one hour. Nothing in my queue depends on it. I am
noting it only because the six-day figure is the sort of number that travels between sessions
faster than its condition does.

### The footer drift check went red, and this time it was not the theme

Not caused by my edits — it reaches the live site. `eqlsource.com` published a **seventh
tool**, `Lockouts` at `/tools/lockouts`, between `50 Upgrades` and `Race unlock tracker`.
That is D's tracker, reaching the site's index ahead of C's 1 September integration.

Your 20 Aug rule is *"do not pre-copy; wait for the merge, re-copy once, re-pin."* I checked
whether this was a merge or an anticipation before touching anything, against the live deploy
rather than the suite:

```
https://eqlsource.com/tools/lockouts        200  final=https://eqlsource.com/tools/lockouts
https://eqlsource.com/tools/50-upgrades     200  final=https://eqlsource.com/tools/50-upgrades
https://eqlsource.com/tools/race-unlocks    200  final=https://eqlsource.com/tools/race-unlocks
```

Real 200, no redirect. So the merge has happened and copying it is mirroring published state,
not anticipating one. **Re-copied once and re-pinned**, in the site's own position.

**It moved five numbers, and the fifth is the one worth reporting.** `SITE_TOOLS` and the
drift check's `EXPECTED` are the obvious two. Three more were pinned offline against exactly
this: `CHROME_LINKS.length` 39 → **40**, distinct destinations 32 → **33**, and tools in the
column 6 → **7**. The first two I computed rather than typed.

The fifth is a count in prose that no test asserts — *"40 matching anchors in the built
page"*. Its own comment names the method, so I ran it instead of adding one:

```
VITE_BASE=/EQL50ups/ preview, document.querySelectorAll('a[href^="https://eqlsource.com"]')
  1440px : anchors=41  distinct=33
   390px : anchors=41  distinct=33
```

**41, and I would have written 41 by inference anyway** — which is precisely why measuring it
mattered. Adding one to a number is how a count stops being a measurement, and the next drift
will not necessarily be a clean single addition. The comment now says it was re-measured and
at what widths.

Nothing here was a judgement call I made on your behalf: the site published it, the page is
live, and the rule said re-copy once after the merge. If you would rather the footer wait for
C's 1 September integration before it lists Lockouts, say so and I will revert the copy —
but the check will stay red until one of the two happens, which is the check working.

**A messaged me mid-run and independently confirmed it** — *"the lockout tracker is live as
the seventh tool… 50 Upgrades is unchanged and still first of the four bands."* That is the
same fact from the other side of the fence, arrived at without either of us being able to ask
the other. Reassuring rather than load-bearing: I had already verified it with `curl`.

### A named a coupling between us that I cannot see, and it is the stale-number problem again

Their words: *"the band and the tool page interpolate every figure from
`assets/50-upgrades.json` by field path, so a renamed field breaks the build rather than
printing a wrong number."* They asked to be told if the snapshot changes shape.

Two things I checked before answering, and the answer is not what they may assume:

1. **This repository does not produce that file.** `git ls-files | grep 50-upgrades.json`
   returns nothing, and no generator under `pipeline/` or `web/src` mentions it. Whatever
   feeds their band, it is not something I emit.
2. **The path is a 404 publicly** — `curl -o /dev/null -w '%{http_code}' -L
   https://eqlsource.com/assets/50-upgrades.json` returns **404**, while
   `/tools/50-upgrades` returns **200**. If it is a build-time asset in their tree rather
   than a served one, that is expected; I note it only because it means **I cannot read the
   field paths they depend on**, so I cannot warn them about a break I cannot see.

**So the guarantee A believes they have is weaker than they think.** "A renamed field breaks
the build" holds only if the file is generated from my payload. If it is transcribed — and
from here it looks transcribed, because nothing on my side writes it — then a figure that
goes stale does not break anything. It just prints an old number on the site's landing band,
under my tool's name, where no check of mine or theirs can see it. That is precisely the
fault my band-image recipe refuses to ship a PNG over, one layer further out.

**The offer, for you to relay or decline.** I can emit that snapshot from `build.mjs` as a
published artefact with pinned field names, so A interpolates from a generated file instead of
a copied one, and `verify.mjs` gates its shape the way it gates the rest of the payload. It is
a contract between two repositories, which makes it yours rather than mine to agree — and it
is exactly the kind of two-sessions-in-one-surface coupling you have been keeping us out of.
I have written nothing.

Also from A, noted and not acted on: PR #149 *"corrects a figure in `gate.py` from four to
six"* — that is the file I audited; the correction is theirs and my proposal does not touch
that line.

## 26 Aug, second report — the rank parser is fixed, the rule is marked, the capture is written

Orders 1-3 are done and pushed. Order 4 is judgement, and it is at the end.

### Order 1 — the rank parser, fixed and proven to be exercised

`parseEffectRank` read a trailing Roman numeral and nothing else, so `Wind Resonance 11`
became a family of its own at rank 1. You are right that this is wrong under either stacking
rule: it is a reading of the client's own notation, not a claim about the game, and the
client prints both notations four lines apart in the one capture we have.

**The fix, and a regression I caught in it.** My first version read any trailing integer as a
rank. Measured against the shipped payload before committing to it — `node` over
`web/public/data/items/*.json`, 401 distinct effect names — it changed 15 parses. Fourteen
were the bard resonances and correct. The fifteenth was **`Allure of Death req. level 20`**,
which became family *"Allure of Death req. level"* at rank 20. A second name shape,
`Complete Healing as Level 20` (14 of them), has the same problem.

One rule covers both rather than two special cases: **the word `level` before the number
means the number is a level.** A cast level and a requirement level are not rungs of a
ladder, and reading them as ranks would have asserted that two clickies of one spell
supersede each other — which is not even what the stacking rule is about.

```
Improved Healing I / II / III                    -> 1 survivor   (unchanged)
Wind Resonance 0 / 10 / 11 / 12 / 14             -> 1 survivor   (was 5)
Complete Healing as Level 20 / as Level 30       -> 2 survivors  (not ranks)
```

**A third defect, same class, found while fixing the first.** Two sockets holding the *same*
effect reach the family collapse as one family at one rank, so one is struck out — and the
tab resolved the winner's name back out of the family and printed **"Complete Healing as
Level 20 does not count — Complete Healing as Level 20 is the higher rank in the same
family"**. A row named as its own superior. The selector now carries a `supersededAs`
discriminator and the tab says *"… is socketed twice"* instead. Equal rank inside a family
can only be the identical string — the family is the stem and the rank is the suffix — so the
discriminator is exact rather than heuristic.

**Proven exercised, not merely written.** `parseEffectRank` and `dedupeByFamily` had **no
direct tests at all**; the only coverage drove them through gear sets built from Roman
fixtures, so the half the client also prints was never touched. 15 new tests — 10 on the
parser, 2 in the selector suite, 3 mounting the tab — and 910 → 925 in the run. Each fix was
A/B'd by restoring the pre-fix source, running, and restoring by SHA-256 — never
`git checkout`:

```
pre-fix parser restored          -> 2 failed / 8 passed   (both arabic cases)
supersededAs collapsed to 'rank' -> 1 failed / 16 passed  (the duplicate case)
chip removed from the tab        -> 2 failed
duplicate wording reverted       -> 1 failed
restore verified by hash         -> true, all four
```

Worth saying plainly: only 2 of the 10 engine tests fail against the old parser. The other 8
guard behaviour that did not change. A count of tests is not a measure of reach, which is the
same thing I told you about `gate_selftest`.

### Order 2 — downgraded, not deleted, and the planner now says so

`EXALTATION_STACKING` in `web/src/engine/exaltation.ts`, built the way `HASTE_STACKING` is
built next door — chip, rule, standing, and the capture that would end it. The doc comment
above it states all three problems with the provenance: one community author's reading of a
wiki the standard calls a partial P99 import; uncorroborated, since the second tool covering
the same ground does not restate it; and identical to classic EverQuest's focus rule, which
is corroboration by inheritance. It also names the file's own **"Use jmoyers. Do not use
Thiole's math."**

**On screen.** The struck-out lines were a bare `hint` paragraph. They are now a block headed
**Not counted**, carrying the `.tier t5` chip — the same device as the haste figure on the
stat panel and the standing labels in the item window — whose hover carries the standing and
the capture request. One sentence of plain English sits under it. Both struck-row sentences
now end *"on this rule a family only counts once"* rather than stating it flatly.

**Nothing rendered that block before.** No test, unit or browser, had ever painted a
superseded row, so the sentence a player actually reads was unexamined. `exaltations-tab.test.tsx`
mounts the tab and pins the chip, its title, the duplicate wording, and that no chip appears
when nothing is struck out.

I also recorded, in the same comment, what is applied **beyond** what is even claimed: the
sourced sentence is about *focus* effects, and the selector pools all four socket kinds into
one family check, so a worn effect and a focus effect of one family compete. No source says
they do. It is not separately marked because it cannot be separately settled — the same
capture answers both, and §1 says so.

### Order 3 — `research/validation/CAPTURE-REQUESTS.md`

One request, written to be executed without interpretation, naming the three real donor items
that carry the family (`Idol of the Underking` at rank III; `Emissary Mask` and `Zaharn's
Coronet` at rank I) and the exact reading: **`Heal Amount`, under Spell Mods, on the Stats
window** — baseline, one socketed, both socketed.

**I picked that reading because it is a window we have documented at Tier M**
(`UI-REFERENCE.md` §B3). I have never seen a character-side "active focus effects" list in
this client and did not want to write an instruction that presumes one exists.

Five outcomes, separated on purpose:

| | What it means |
|---|---|
| **A** Heal Amount moves again on the third reading | They stack. **Our rule is wrong** and `dedupeByFamily` comes out of the effects path. |
| **B** Moves on the second reading, not the third | They do not stack. The rule becomes Tier M and the chip comes off. |
| **C** Does not move even with **one** socketed | Not an answer and **not a failed capture** — this field does not surface focus effects, so no number of screenshots of it will ever settle this. Close the route, keep the mark, design another. |
| **D** The game refuses the second socket | A different question answered. **There is not one refused socketing on record anywhere in this repository**, and `canSocket` has the same Tier 5 provenance. First observation of that rule. |
| **E** Could not get the items or the window | Nothing learned, nothing recorded. |

**C and E are why the section is written out at all.** Both arrive as "nothing moved", and
filing E as C would put a finding in the record that never happened.

### A correction — one of my own commits claims something it did not do

`d18a10a`, 17 Aug, is titled *"Stop tracking a vitest cache file, and ignore node_modules at
the root"*. It added the `.gitignore`. It did not untrack the file — `.gitignore` has no
effect on something already in the index, and `git ls-files` still returned it today, nine
days and every test run later. Fixed here with `git rm --cached`; `git ls-files node_modules`
now returns 0. A commit message that asserts a state nobody checked is the same fault as a
number typed where it could have been computed, and it was mine.

---

## Order 4 — the other four, ranked, and the one I would fix next

Your two tests, applied. They separate the four more sharply than I expected: **only one of
the four is actually the lockout shape**, and it is not the one with the biggest blast radius.

| | Finding | "Everyone repeated it, nobody read it" | Code contradicts itself | Moves the screen today |
|---|---|---|---|---|
| **A** | `ARMOR_TIER` — 16 hand-typed class→armour numbers | **Exact match.** No source names them; classic-EQ-shaped; nobody read one off the game. | **Yes, twice over.** Refuted by our own catalogue (BRD on 63 plate-named records vs PAL 59; BER on 2), and cited as precedent by finding D. | **No — dead code.** 0 screens, 0 selectors. |
| **B** | The haste cap our source names | **Half.** The repeated part is "only the highest counts" (classic, inherited). The cap itself is a number nobody applied rather than one everybody repeated. | **Yes, sharply.** `stats.ts:58` quotes the cap inside a constant whose job is to say what is unknown, then no line caps anything. | **Yes, at the top of the list.** 23 items; a haste belt at +10 is 102.0 EP, the largest single EP any item can earn — against 69.2 for the best weapon in the game. |
| **C** | The socket ladder's nine counterexamples | **No — the opposite failure.** Nobody repeated this from elsewhere. Somebody read it off the game and **stopped reading before the end**. | **Yes.** Our Tier M grade is contradicted by our own Tier M evidence file, nine rows. | **No.** The player already ruled "do not model per-item socket counts". The defect is the grade, not the behaviour. |
| **D** | `levelCheck` takes the highest class level | **No — invented, not inherited.** Original EQ has one level, so nobody could have repeated this. We derived it from A, which has no source. | **Yes.** `eql-game-systems.md:279` says the effective level is the **lowest**; the code takes the highest. | **3 rows.** Unbounded the moment `rl` populates. |

### The one I would fix next: **B, the haste cap.**

Not because it matches your shape best — **A does**, and I want to be straight that I am
ranking on consequence rather than on shape. Four reasons:

1. **It is the only one of the four changing what a player sees right now**, and it changes
   it at the top of the ranked list — the screen the landing band points at. A haste belt
   outscores the best weapon in the game by a factor of one and a half, and every one of the
   23 items is ranked as if its full figure lands.
2. **This planner plans trios**, which is precisely the configuration the cited source says
   binds: if item, spell and song haste share one ceiling, a trio holding a Bard, Shaman or
   Enchanter is at or near it before equipping anything. The sampled character in our own
   Tier M capture is Bard/Warrior/Berserker.
3. **The correct sentence is already in the file.** Marking it costs nothing and needs no
   evidence — it is the `stats.ts:58` case, where the comment and the code already disagree.
   Modelling it needs the capture, and the mark can ship first.
4. **It rides the trip the owner is already making.** `HASTE_STACKING.settle` and
   `HASTE_PROVENANCE.settle` are one screenshot each and already written as sentences; the
   cap needs a third. Three marks, one session, and I have the file to put them in now.

**A is the cheap second, and it is a deletion rather than a fix.** `ARMOR_TIER` has no
source, is refuted by our own data on two classes, and is consumed by nothing — it survives
only because four lines of its own unit test assert it. The reason it is not first is that it
is inert; the reason it is not last is that it is already load-bearing as an *argument* for
D, and it sits in `constants.ts` beside `ATTRIBUTE_CAP` and `RESIST_CAP`, which are genuinely
Tier M. That neighbourhood lends it a credibility it has not earned. Deleting a rule rather
than marking it is your call, not mine, which is why I have not.

**C I would not fix; I would re-grade it.** The behaviour is right — nine counterexamples in
115 items, zero in the other direction, so the ladder is a solid floor and the player has
already ruled the exceptions out of scope. What is wrong is that `TIER0-VALIDATION.md` still
prints **confirmed** and `exaltation.ts` still says *"confirmed against sub-slot numbering in
an inventory export"* — the same export. One paragraph, no code.

**D I would leave alone until `rl` populates**, and watch for the patch that populates it.
Three rows do not justify choosing between two unsourced answers today, and choosing badly
now bakes in a rule that would then be wrong on every list at once.

### What I did not do, and why

- **No contamination signature for exaltation stacking.** It would put this on the
  Contamination screen, which is where this project publishes exactly this kind of thing, and
  the `haste-stacking` signature is the precedent. I did not add one because your order was
  to mark it *where the planner strikes an effect out*, and that is the tab. Say the word and
  it is a self-contained addition.
- **The two code defects from my last report are still unfixed** and still in your gift:
  `setDiff`'s `!== 'ANY'` (Throwing Boulder, 82.3 phantom EP at +10) and `FLAT_KEYS` carrying
  `ATTACK`. Neither is a sourcing question; the first is one word.

### Still open, from your list — all three landed 22 Aug and are pushed

Nothing is waiting on me. Commits `7d73118`, `9efbd52`, `7c29f90`, `6678cbb`, `8221d92`.

- **gate_selftest** — `proposed/gate-selftest-reach/`: the patch, five constructible cases,
  two written refusals, and the meter that produced the number. Reach **23/42 = 54.8%**,
  ceiling **28/42 = 66.7%** after I withdrew my own 30/42. Session A can take it as it sits.
- **Licence** — `research/LICENSING-PROPOSAL.md`, 200 lines, **three** questions.
- **Band image** — `proposed/band-image/RECIPE.md`. **Do not ship a PNG**: inline SVG
  generated at build time from the payload, so every figure stays a `<text>` node our checks
  can read and a vitest can recompute.

### State, this push

`tsc` clean · vitest **926 / 62 files** · playwright **150 / 150** ·
`verify.mjs` **PASSED**, Tier 0 100.0% · catalogue audit **PASSED**.

**The payload moved, and it moved because a check I added caught me.** `verify.mjs` failed
after the code changes — *"sourceLines: report says 31725, tree has 31877"* — which is the
contamination freshness check working as designed. Regenerated with `build.mjs`. The diff is
`builtAt`, `scannedAt` and `sourceLines` only: **0 item records changed**, confirmed with
`git status --porcelain web/public/data/items`.

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

## To the Director — intent, self-dispatch (16:1xZ, first item under the new post)

Read your message. **Standing down from the gear seam** — I had declared a validating reader and
a `Context` producer, which is exactly the mechanism you just reserved. No code was written; only
the declaration, and it is withdrawn here.

**Starting now on `claude/eql-gear-optimizer-tfzvh6`:** finding 7's first defect — `FLAT_KEYS`
contains `ATTACK` while the only rule table we cite puts Attack in **unchanged**. Deleting an
unsourced value, which your bound reserves to me.

**Measuring it first turned up something bigger, and it is live.** Counted over the shipped
payload, 4,004 records:

| key | items carrying it |
|---|---|
| `ATTACK` | **0** — inert, as I reported |
| `BACKSTAB` | **8** — live |
| `HASTE` | 23 |
| every other skill mod (`BASH`, `KICK`, `FRENZY`, …) | 0 |

`stats.ts:328-331` runs **every** `SKILL_DAMAGE_MODS` key through `scaleFlat`, and
`research/github-data-inventory.md:56` — the only source in this tree that speaks to scaling at
all — lists **Backstab** in the *unchanged* row beside Attack. I grepped `research/` for any
source saying otherwise and there is none. So the scaling is unsourced, and unlike `ATTACK` it
**fires on 8 shipped items**. `ep.ts:224` pushes skill mods into the scoring plan, so it is not
display-only: it moves rankings.

**Scope:** remove `ATTACK` from `FLAT_KEYS`; stop scaling `SKILL_DAMAGE_MODS`; prove the guard
fires by A/B rather than asserting it; quantify how far the 8 items move and publish that number.

**Not touching:** the skill-mod *caps* (`UI-REFERENCE.md:97` sources those and they are unrelated
to scaling), the haste rule, or anything of A's or E's. **No new mechanism** — this removes an
unsourced rule, it does not add one.

**Your §4 correction is noted and it changes how I will verify this.** I will not rest the fix on
a printed count; the check reads the payload and the computed output, never a rendered figure.

### Done — the unsourced skill-damage scaling is deleted, and the guard I wrote first did not work

**Shipped.** `ATTACK` out of `FLAT_KEYS`; `SKILL_DAMAGE_MODS` no longer scaled in either engine.
The rule table's *unchanged* row is now honoured by `stats.ts` and by `rankScorer` alike.

**What actually moved.** Four distinct items carry `BACKSTAB` — Serpent's Tooth 13, Gold Plated
Koshigatana 9, Rib-bone Stiletto 7, Stiletto of the Bloodclaw 6. At +10 each read `base + 10`,
so **Serpent's Tooth showed Backstab 23 for a 13 item, a 77% overstatement**, and `ep.ts:224`
fed that inflation into the ranking. `ATTACK` moved nothing: 0 of 4,004 records carry it.

**The eight-versus-four discrepancy from 30 Aug is resolved and neither count was wrong.** Eight
*payload records*, four *distinct items* — each is `PRIMARY`/`SECONDARY` and so ships in both
shards. Two correct numbers over different denominators.

#### The part worth your time: my first guard was NOT_EXERCISED and A/B is the only reason I know

I wrote a test called *"agrees with computeTotals at every tier"*, described it in its own
docstring as **the load-bearing one**, and it was worthless. Five mutations:

| # | mutation | first guard | after fix |
|---|---|---|---|
| 1 | `stats.ts` re-scales skill mods | 3 failed ✓ | 3 failed ✓ |
| 2 | **`rankScorer` scores them `flat`, `stats.ts` correct** | **7 passed ✗** | 1 failed ✓ |
| 3 | `stats.ts` re-scales `ATTACK` | 2 failed ✓ | 2 failed ✓ |
| 4 | `ATTACK` deleted outright | 3 failed ✓ | 3 failed ✓ |
| 5 | `rankScorer` scores `ATTACK` `flat` | *(not yet written)* | 1 failed ✓ |

**There are two scorers and I tested the one that cannot fail.** `scoreItem` reads
`resolveItem`'s output, so it inherits `stats.ts` and is structurally incapable of disagreeing
with it. `rankScorer` compiles its own `PlanEntry[]` and re-implements the arithmetic — that is
the copy that drifts, and it is the one the "keeps the two sums identical" comment is about. My
assertion pointed at the wrong one, and **the docstring claiming it was load-bearing made it
worse, because it would have stopped the next reader looking.**

Row 2 is your §4 correction arriving from a different direction: a guard can be correct, be
described accurately in every respect except reachability, and still never touch the thing it
names. **I only know because I damaged the source rather than reviewed the test.**

Mutation 4 is also worth naming — deleting `ATTACK` from `FLAT_KEYS` outright makes
`totals.attack` silently zero, because it reads `flat.ATTACK`. That is stopping the scaling by
stopping the reporting: a different bug wearing the fix's clothes. `UNCHANGED_KEYS` exists so
the key still reports while never scaling.

**Gate:** `tsc` clean; **944 tests in 63 files pass** (was 937/62); `verify.mjs` passes at Tier 0
coverage 100.0% after regenerating the payload — my edits shifted `ep.ts` line numbers and
`verify.mjs` caught both the stale quoted line and the stale `sourceLines`, which is that gate
doing exactly its job; `catalogue-audit.mjs` passes; bundle builds. Sources restored
byte-identical after every mutation, checked by SHA-256.

### CORRECTION to the entry above — I published a suite-level claim from a file-level experiment

**`3eb739e` says the divergence mutation was "NOT CAUGHT". That is wrong about this repository,
and I am correcting it within the hour rather than leaving it to be discovered.**

My A/B ran a single file — `npx vitest run src/engine/skillmods.test.ts`. So it measured **my
test's** reach and I reported it as **the repository's**. `ep-scorer.test.ts` already existed, and
it catches the divergence comprehensively: every shipped item, every tier, profiles that include
skill damage mods, with a `compared > 100_000` vacuity guard. Re-run with the same mutation:

```
mutation 2 (rankScorer scores skill mods as flat)
  vitest run src/engine/skillmods.test.ts   ->  7 passed   ← what I reported
  vitest run src/engine/ep-scorer.test.ts   ->  2 failed   ← the truth
```

**I damaged the source, ran the wrong surface, and drew a conclusion about a surface I never
touched.** That is the shape Session 0 named as *"the survey of the wrong surface"*, and it is
the same error as your struck §4 — the check ran, it was accurate about what it looked at, and
what it looked at was not the thing.

#### What survives the correction, measured across both files

| mutation | `ep-scorer.test.ts` | `skillmods.test.ts` |
|---|---|---|
| 1 `stats.ts` re-scales skill mods | **2 failed** ✓ | ✓ |
| 2 `rankScorer` scores them `flat` | **2 failed** ✓ | ✓ (after the rewrite) |
| 3 `stats.ts` re-scales `ATTACK` | **1 failed** ✓ | ✓ |
| 4 **`ATTACK` deleted outright** | **3 passed** ✗ | ✓ |

**`ep-scorer.test.ts` is an AGREEMENT test, not a CORRECTNESS test**, and the distinction is not
pedantic: it asserts the two scorers return the same double, so **both engines being wrong in the
same direction passes it cleanly**. Mutation 4 is exactly that — deleting `ATTACK` makes both
scorers stop seeing the key, they agree perfectly on zero, and `totals.attack` silently becomes 0
on every item carrying the stat. **450,000 comparisons and it sails through.**

That is what my file adds and it is the only thing it adds: it pins the **value**, not the
agreement. The two are complementary and neither is redundant. My original framing — that I had
found an unguarded divergence — was false; the real finding is narrower and, I think, more
useful.

**Two corrections to the earlier entry, then:** the "NOT CAUGHT" row was an artefact of my
method, and the value of the new file is value-pinning rather than divergence-catching. The
NOT_EXERCISED verdict on my *own* first assertion stands unchanged — it did target `scoreItem`,
which cannot disagree with `stats.ts`, and 7 passing tests said so.

**The method rule I am adopting and would offer to anyone running A/B here: damage the source,
run the WHOLE suite, restore.** Running one file answers "does my test catch this", which is a
different question from "does this repository catch this", and only the second one licenses a
sentence in a report.

**State unchanged and re-verified after every restore:** `tsc` clean, 944 tests in 63 files pass,
`verify.mjs` at Tier 0 coverage 100.0%, `catalogue-audit.mjs` passes. Both sources byte-identical
to their pre-mutation SHA-256.

## 31 Aug 17:2xZ — MY GAP-ENGINE CLAIM WAS FALSE. Verified the Director's retraction rather than accepting it, and it holds.

**I published "E's shipped bundle reads exactly one context field" in `4491fc8`, to the Director
and to the owner. It is wrong. The engine reads NOTHING from context.** The corrected finding is
stronger than mine, not weaker.

**My instrument could not return one of its two answers.**

```
grep -o "context\.[a-zA-Z_]*" bundle/eqls-gap-engine.js | sort -u   ->  context.marker_raw
```

That returns **mentions**. `context.marker_raw` matches identically on the left and right of an
assignment, so the grep cannot distinguish a read from a write — and the single hit it returned is
a *write*, guarded by a presence test. I read "one field is named here" as "one field is read".

**I did not take the retraction on authority, because the Director's own message is that running
someone else's command is reproduction rather than verification.** So I used an instrument that
does not inspect the source at all — a sentinel probe against the running bundle at `dbd5b62`,
engine `1.1.0`:

| probe | result |
|---|---|
| gear-shaped sentinels visible outside `report.context` | **none** |
| `measured` / `deltas` / `refusals` / `coverage` with vs without gear in context | **identical, all four** |
| `report.context` echoed | **verbatim, byte-identical to what I passed** |
| `marker_raw` omitted by caller → written; supplied by caller → **preserved** | consistent with `setdefault` |
| `worn.stats` refusal after being handed worn stats | **still fires**, `no_log_evidence` |

The last row is the one I would not have got from reading lines: **the refusal does not stand down
even when handed exactly what `what_would_settle_it` names.** There is no code path that could
notice. That is "never scoped" demonstrated rather than inferred.

**And my probe had the same class of flaw one level down.** I used `gear` as a sentinel string and
it came back PRESENT — because the refusal's own prose contains *"The 50 Upgrades gear input"*. A
common English word is a bad sentinel. It was a false positive from my instrument, chased down
rather than reported, and it is the third time today an instrument has been the thing that was
wrong.

**What survives, and I am not overstating it either:** `what_would_settle_it` names something that
cannot arrive — not descoped, **never scoped**. The refusal itself is correct: a log does not show
worn stats.

**Withdrawn:** the "missing seam" framing, and with it the mechanism ruling I said was owed. There
is no seam to adjudicate. **I am not blocked on the Director.** If gear must reach the engine that
is new scope and the owner's call.

**Noted for when I next vendor the engine:** ~~`eqls-gap-engine.76bd7386.js`~~ — **superseded
18:1xZ; the hash is now `8c777b96`.** `76bd7386`, `85425fdb` and `e7b0234e` are all stale: four
hashes in about two hours. **Do not copy a hash out of this file — re-read the directory.** A
pinned identifier in prose is a dead pointer waiting to happen, which is the failure this project
has now paid for twice. And read E's HANDOFF
§38.4 first: the fixture's `_why` promises the *shape* is what the engine emits, which does not
cover `context`, so a consumer building against the fixture would reasonably treat
`character`/`trio`/`level`/`marker_raw` as guaranteed when they are caller-supplied.

**Back to my own four items, which is where the Director says my time should go and I agree.**

## To the Director — intent, self-dispatch (17:4xZ)

Read `af082dc`. Nothing addressed to me; R12 is withdrawn with the seam. Queue empty, so my own
list — with one correction to it before I start.

**My Part 2 proposal 1 said "*Needs: nobody*". That was wrong and I am withdrawing the estimate,
not the proposal.** Unifying `SLOTS` (`build.mjs:44`) with `SLOT_TYPES` (`constants.ts:57`) into
one source has a decision inside it that I should not take alone: TypeScript does **not** preserve
literal types through a JSON import, so a shared `slots.json` costs the `SlotType` literal union
that the app's type safety rests on. The alternatives are a codegen step in the pipeline — new
mechanism — or accepting `string` where a union stands today. **My gate already prevents the
divergence; unification would make it unrepresentable, at a price I had not counted.** Yours when
you want it; not something I will improvise.

**Starting instead on `claude/eql-gear-optimizer-tfzvh6`: a vacuity audit of `pipeline/verify.mjs`.**

`verify.mjs` carries **67 `assert(...)` calls** and it is the deploy gate — `deploy.yml`'s
`deploy` job has `needs: build`, and `build` runs it. Three times today an instrument of mine
returned a confident answer it was structurally incapable of getting wrong:

- `grep -o "context\.[a-z]*"` counted mentions and could not see a write;
- an A/B over one test file answered a question about the whole suite;
- `ep-scorer.test.ts` asserts two engines *agree* and passes when both are wrong together.

**The same shape is what a vacuously-true assertion is**, and I have shipped one before — the 2H
check I reported to you as reassuring, which could never have returned anything else because no
item carried the field. A gate of 67 assertions that has never been audited for subjects is the
place that defect would be sitting.

**Method — the instrument, stated first because the instrument is what keeps being wrong.** An
**empty-payload probe**: damage the payload rather than the source, run the whole gate, and record
which item-level assertions still PASS. Anything that passes when there are zero items to check is
vacuity-capable, and the ones that are not deliberately metadata checks are defects. Payload
restored and verified by SHA-256, as with source.

**Falsifier:** if every item-level assertion fails on an empty payload, the gate has no vacuity
problem and I will report that as the finding — a clean result is a result.

**Not touching:** the assertions' logic, unless a vacuity is found; anything of A's or E's; the
payload's committed state.

### Done — the gate is clean on vacuity, which is the finding, and the cleanliness is now monitored

**The falsifier I declared fired the honest way: I looked for vacuous assertions in the deploy
gate and did not find any.** Reporting that rather than manufacturing something.

**Probe 1 — the empty payload.** Backed up `web/public/data`, replaced it with a coherent
zero-item payload, ran the whole gate, restored, verified all 23 files by SHA-256.

| | |
|---|---|
| assertions passing on the real payload | **65** |
| assertions still passing with **zero items** | **56** |

Fifty-six sounds alarming and is not, because of the one that fails: **`index is a non-empty
array`**. The gate cannot pass on an empty catalogue, so every per-item assertion is guaranteed a
subject. **The top-level guard is real and it is doing the work.**

**Probe 2 — the sub-population census.** The residual risk is not an empty catalogue; it is a
*filtered* assertion whose subset empties while the catalogue stays full. That is exactly the 2H
check I reported to you as reassuring when no item carried the field. Counted every filtered
subset the gate quantifies over:

```
   788  weapons carry both dmg and dly        634  every existence mark is in the vocabulary
   750  weapon skills use the client vocab    503  stat/save keys are in the vocabulary
   621  effects, sizes and weights            336  no numeric id assigned to two items
   198  items with no era are flagged          22  skillRaw is only present when it differs
    16  statsUnknown records carry evidence    10  every existence-only record is statsUnknown
```

**Zero empty populations.** The gate has no vacuity defect today.

#### What I changed, and it is deliberately a warning rather than an assertion

**"Today" is the whole problem.** `xo` is 10 records. At 0 — one build away — *"every
existence-only record is also statsUnknown"* passes forever while reporting a guarantee it no
longer provides, and nothing says so. So `verify.mjs` now runs a **subject census** and warns
when a filtered assertion's population reaches zero.

**It warns; it does not fail.** A population reaching zero can be *good news* — every
existence-only record acquiring real stats is an improvement, and a hard assertion there would
block it. The census makes an invisible vacuity into a visible line and leaves the judgement to a
reader. It also prints the full census under `--verbose`, so the numbers above are re-derivable
rather than quoted from here.

**A/B, whole gate, per the rule I adopted this afternoon:** stripped every `xo` flag from the
payload (10 → 0) and re-ran.

```
WARN  assertions with no subject: 1 filtered assertion(s) quantify over an empty set
      and cannot fail — they pass vacuously
        every existence-only record is also statsUnknown — 0 records match its filter
```

Fires, names the assertion, and correctly does **not** fail the build. Silent on the real payload
— `grep -c "no subject"` returns 0. Payload restored byte-identical, all 23 files by SHA-256.

**Gate:** `tsc` clean, 944 tests in 63 files pass, `verify.mjs` passes at Tier 0 coverage 100.0%
with 65 checks, `catalogue-audit.mjs` passes. Payload regenerated; the diff is two timestamps and
nothing else — `sourceLines` did not move because this edit is in `pipeline/`, not `web/src`.

## 31 Aug 18:2xZ — "READS NOTHING" WAS WRONG TOO, AND MY OWN TABLE SAID SO

**`ab89bdf` is corrected. The engine does not read *nothing* from context.** Verified with my own
instrument rather than taking the Director's second correction on authority — same rule as the
first time — using a log that actually carries a marker, so the write path is live:

| probe (engine 1.1.0) | result |
|---|---|
| caller omits `marker_raw`, log carries one | engine writes `"WAR MNK SHM"` |
| caller supplies one **and** the log carries a different one | **the caller's value is honoured, suppressing the log-derived one** |
| whole `Report` identical across the two contexts | **false** |
| `measured` / `deltas` / `refusals` / `coverage` identical | **true, all four** |
| caller's own dict after the call | unmutated — the deep copy holds |

**The accurate sentence is E's and I adopt it verbatim:** the engine consumes no context *value* —
no branch, rate, denominator or refusal depends on anything a caller supplies — **but it
deep-copies the object and does read `marker_raw`, its presence to guard a write and its value,
which it honours.**

"Reads nothing" implies context is inert. It is not, and the difference is operational: **there
is existing behaviour to collide with.** Anyone deciding whether adding a field is safe would, on
my sentence, assume there is nothing in the way. There is a deep copy and one caller-honoured key.

### The row that refuted my own heading was sitting in my own table

Row four of the evidence I published in `ab89bdf` reads *"marker_raw omitted by caller → written;
supplied by caller → **PRESERVED**"*. **A value the caller supplies, which the engine honours and
returns, is a read by any definition that matters to a caller.** My heading said the opposite of
my own row, and I did not see it.

E named the shape and I am adopting it as a working rule, because it is exactly what happened:

> **A table can carry the row that refutes its own heading, because the heading is written once
> from the conclusion and the rows are written from the data. When they disagree, the rows are
> right.**

**Three parties published "reads nothing" — E first, then the Director, then me — and none of us
had measured it.** Mine came from the Director's retraction, which is why the correction arrived
from them; a correction inherits the reach of the claim it corrects.

### What my probe did establish, and it now carries a ruling

The Director reports that the sentinel probe's fifth row — **the `worn.stats` refusal still fires
after being handed worn stats** — is the evidence behind their ruling that E's settler text will
stop naming *"The 50 Upgrades gear input"*, a product that does not exist and was never scoped,
and name a **kind of source** instead. That row is behaviour, not inference: the engine cannot
notice the thing its own prose names as the settler. **I found it while being wrong about the
headline above it**, which is worth recording as its own lesson about where useful findings come
from.

**Not blocked on anything.** The gear seam does not exist, was never scoped, and if gear must ever
reach the engine that is new scope and the owner's call.

## To the Director — intent, self-dispatch (18:4xZ)

Read `0093c70`. The settler-text ruling is E's to execute; the correction addressed to me I
handled in `6c1c4ee`. `.director-tip` advanced to `0093c70`. Queue empty.

**Starting on `claude/eql-gear-optimizer-tfzvh6`: the same audit I ran on `verify.mjs`, applied to
`pipeline/catalogue-audit.mjs`.** It is the other hard gate in CI — `deploy.yml`'s `build` job runs
it — and it makes the strongest claim in this repository: *"every number on screen names where it
came from."* It has **five** failure checks and has never been audited for whether any of them can
fire.

**One is already thin.** Measured over the 4,004 shard records:

```
sd distribution:  tier-2 2321 · unattributed 1536 · tier-5 141 · tier-M 6
```

Check 2 — *"every tier-M stat block cites the capture it was read from"* — quantifies over
**6 records**. Not vacuous, but the thinnest subject in the gate, and tier-M is precisely the
standing that matters most: it means a stat block was read off a live client window. At 0 that
check passes forever while asserting our strongest provenance guarantee.

**Method:** subject census for all five, then A/B each one — damage the payload so the check
*must* fire, run the whole gate, restore, verify by SHA-256. Per today's rule, the whole gate, not
the one check.

**Falsifier:** if all five fire on their matched damage and no subject is empty, the gate is
sound and I report that, as with `verify.mjs`.

**A counting note, so it does not become another 8-versus-4.** I get 2,468 records with numbers
using `st ∪ sv ∪ wp` over the 4,004 **shard** records; I reported **2,176** on 31 Aug using
`catalogue-audit.mjs:96` over the 3,663 **index** entries. Different populations, not a
contradiction — shards double-count items that ship in two slots. I will name the denominator
every time.

**Not touching:** the checks' logic unless one cannot fire; anything of A's or E's.

### Done — all five `catalogue-audit.mjs` checks fire. Three looked dead and every one of those was my mutation, not the gate.

**Result: the gate is sound.** Every one of the five failure checks fires under damage aimed at
exactly what it exists to catch, and no subject population is empty.

| # | check | subject | fires under matched damage |
|---|---|---|---|
| 1 | every record printing a number states where it came from | 2,468 numeric | **yes** — `A Crude Stein` |
| 2 | every tier-M stat block cites its capture | **6** tier-M | **yes** — `Bladestopper` |
| 3 | nothing marked statsUnknown also ships stats | 16 | **yes** — `Backpack*` |
| 4 | rule 6 — every input carries a snapshot date | provenance inputs | **yes** — `jmoyers` |
| 5 | `meta.counts.items` matches records shipped | scalar | **yes** |

#### The first run said 3 of 5 were dead, and publishing that would have been a false alarm about the deploy gate

I stopped and diagnosed instead, and **all three silences were defects in my damage**:

1. **The merge undid my deletions.** `shippedRecords()` folds index under shards with
   `{...indexItem, ...shardItem}` keyed by lowercased name. **Spread overrides only keys that are
   PRESENT**, so deleting `sd` from a shard leaves the index's `sd` standing and the merged record
   is untouched. Checks 1 and 2 were reading undamaged data. *An addition needs one copy; a
   deletion needs every copy* — and nothing about the code says so at the point you write the
   mutation.
2. **I mirrored the audit's predicate wrongly.** `printsNumbers` is `NUMERIC_FIELDS` **minus**
   entries whose `feeds` is `'nothing — displayed only'`. I included `wt`, which is exactly that,
   so my "record printing numbers" was a weight-only potion the check correctly ignores.
3. **I damaged a field the audit never reads.** `sourcesLastRead.scraped` is parsed from the
   *filename* and `vendored` is `gitDate(...)` — **both derived, neither stored**. Editing
   `meta.provenance.inputs[*].scraped` changes nothing. The matched damage is pointing an input at
   a dateless, untracked path, and then it fires.

**Three misses, three different mechanisms, and each one produced a confident silent PASS that
looks exactly like a dead check.** That is the day's lesson arriving from a fourth direction: the
instrument was wrong three more times, and the only thing separating "the gate is broken" from
"the gate is fine" was refusing to publish the first result.

**A matched pair is not enough on its own.** The pair has to be aimed at the surface the check
actually reads — merged records rather than shard records, the audit's predicate rather than my
paraphrase of it, derived fields rather than stored ones. **A silent check under damage is
evidence about the damage until you have shown the damage landed.**

#### The thin one, recorded rather than fixed

**Check 2 quantifies over 6 records.** `tier-M` means a stat block read off a live client window —
our strongest provenance claim — and at 0 that check would pass forever while asserting it. It is
not vacuous today and I am not adding a guard on my own initiative, but it is the thinnest subject
in either gate and the one I would watch. `verify.mjs`'s subject census (`35afbd2`) covers
`verify.mjs` only; extending it to this gate is a small, obvious follow-up if you want it.

**Gate:** `catalogue-audit.mjs` passes, `verify.mjs` passes at Tier 0 coverage 100.0%. Payload
restored byte-identical after all seven mutations, 23 files by SHA-256.

## To the Director — P1 ANSWERED: the 3,663 were NOT verified to the standard of the 435. Five were.

**The audit's fork resolves to its second branch, and the number is 5.**

Population is the **index**, 3,663 records — what `meta.counts.items` counts and what the site
reads. The shards hold 4,004 rows only because an item shipping in two slots appears in two
shards. Naming the denominator every time. **Nothing changed: `3663` and `1713` are as published.**

### The one number that answers it

```
items whose stat block is backed by a per-item citation:  5 of 3663   (0.1%)
```

`sd = tier-M` is the only standing that means *somebody checked this item*. It is 5 records, and
all 5 carry both `sdc` (the capture) and `vf` (the fields actually checked). Of the 1,713 rows
printing stat values, **4** are verified that way.

### Why the other 3,658 are not verifications — `sd` is DERIVED, and from era, not from provenance

`pipeline/build.mjs:2054-2065`, the whole assignment:

```js
const verified = statsVerifiedByKey.get(rec.key);
if (verified) { rec.sd = 'tier-M'; rec.vf = verified.fields; rec.sdc = verified.cite; }
else if (!hasSourcedNumbers(rec)) { rec.sd = 'unattributed'; }
else { const rank = rec.era == null ? null : ERA_RANK.get(rec.era);
       rec.sd = rank == null || rank > CURRENT_ERA_RANK ? 'tier-5' : 'tier-2'; }
```

> **`tier-2` is not a claim that anyone read this item. It is a claim that the item's ERA passes a
> filter.** All 2,045 tier-2 records got that label from one rule about era rank applied in bulk to
> a single wiki scrape — not from 2,045 readings.

**This is your predicted bucket that does not fit a tier**, and I would put it more sharply than
"does not fit": **`tier-2` is a bulk-derived era verdict wearing a tier name.** `unattributed`
(1,487) is not a tier either — it is the absence of one, meaning the row prints no sourced numbers.

**The published contract is honest and never claimed otherwise.** `meta.sourceStanding` defines
tier-2 as *"structured wiki data for an item whose era places it inside this game"* — which is
exactly what the code does. **The defect is not in the payload. It is in reading "3,663 items" as
the same kind of thing as "435 verified items."** They are not comparable units, and our own
metadata already says so for anyone who opens it.

### The full breakdown

**Existence — is the item itself attested in the game?** (`ex`, all Tier M codes)

```
  277   7.6%  measured-drop   a mob was measured dropping it in parsed combat logs
  197   5.4%  live-export     resolves to a line in the /outputfile inventory export
   95   2.6%  eqlsource-id    named in the published item-name-to-game-ID table
 3094  84.5%  NONE            ships on era placement alone
                    first-hand from the game:  569 of 3663  (15.5%)
```

**Stat provenance** (`sd`) — 2,045 tier-2 · 1,487 unattributed · 126 tier-5 · **5 tier-M**

**Per-item provenance pointer of any kind** (`sdc`, `vf`, `evidence` or `ex`):

```
  569  15.5%  carry at least one
 3094  84.5%  carry NONE — `sd` is the only provenance and it is a bucket label
```

**The cross-tab, which is the fork in one table:**

```
  sd \ ex        Tier M evidence   no evidence     total
  tier-2                  266          1779       2045
  tier-5                  126             0        126
  tier-M                    5             0          5
  unattributed            172          1315       1487
```

**1,779 records — 48.6% of the catalogue — carry a tier-2 stat standing and no evidence the item
exists in this game at all.** Both facts are derived from the same wiki row and the same era table.

### What follows for your four waiting decisions — findings, not recommendations

1. **The unit.** "3,663 items" is *catalogue size*, and the honest unit beside it is **"3,663
   catalogued, 569 attested in-game, 5 stat-verified"**. Those are three different questions and
   the payload already separates them.
2. **The coverage finding.** Our side of the comparison is now a real datum: against a *verified*
   denominator we hold **5**; against *attested-in-game*, **569**; against *catalogued*, 3,663.
   Which one is comparable to a rival's 9,360 depends entirely on what they counted.
3. **Client-mined tables.** They would land as Tier M existence and, where they carry stat blocks,
   as the first material growth in the tier-M stat population since it has been 5. That is a
   licensing question I am not answering.
4. **Plumbing or re-grade.** On this evidence it is a **re-grade**, not plumbing — but only in the
   sense that the *labels on the counts* need to change. No number moves.

**Falsifier discharged:** provenance IS recorded per item, so the "not recorded" answer does not
apply. What is recorded for 3,094 of 3,663 is a bulk-derived bucket label rather than a source
identifier, and I have reported that as what it is rather than reconstructing a provenance I
cannot read.

**Fixed nothing, per the bound.** No field, count or file was changed by this work.

## To the Director — intent, self-dispatch (19:4xZ)

Read `619be98`. The only item addressed to me is the P1 I answered in `30791c7`, which postdates
your tip. `.director-tip` advanced.

**Starting: extend the subject census to `pipeline/catalogue-audit.mjs`** — the follow-up I named
in `7473aa6` and left for you. **The P1 measurement has made it materially more important than
when I offered it.** Check 2 — *every tier-M stat block cites the capture it was read from* —
quantifies over the `sd = tier-M` population, and P1 established that population **is the entire
verified corpus of this catalogue: 5 records.** If it ever reaches 0, the only check guarding our
only real verification passes forever while asserting it.

A warning, not an assertion, exactly as in `verify.mjs` (`35afbd2`): a population reaching zero can
be legitimate, and a hard failure would block a genuine change.

**Not touching:** any check's logic, any count, or the payload.

### Done — the census is on both gates, and the first version of it would have failed the build

**Shipped.** `catalogue-audit.mjs` now reports the subject count for each of its four
population-based checks and warns when one reaches zero. Check 5 is deliberately absent: it
compares two scalars and has no population.

```
-- subjects --
    2176  every record printing a number states where the number came from
       5  every tier-M stat block cites the capture it was read from
      16  nothing marked statsUnknown also ships stats
       5  rule 6 — every input carries a snapshot date
```

**A/B, whole gate:** demoted all 5 `tier-M` records to `tier-2` across index and shards (11 copies).

```
       0  every tier-M stat block cites the capture it was read from
  WARN  a failure check no longer has anything to check
        "…cites the capture it was read from" quantifies over 0 records — it cannot fail,
        and passes vacuously
AUDIT PASSED   exit code: 0
```

Fires, names the check, and correctly does not block. Payload restored byte-identical.

#### The version I wrote first would have failed the build, and the flag that was supposed to prevent that did nothing

I pushed the census result into `failures` with `warning: true` on it. **`failures.length` drives
`process.exit(1)` at the bottom of the file and nothing reads `warning`.** So an empty population
— which I had just finished arguing can be *good news* — would have failed CI and blocked the
deploy, under a flag whose whole purpose was to stop that.

**It is the same shape as everything else today: a field that looks like it does something,
carried by an object whose consumer never asks.** I caught it by reading the exit logic before
running, rather than after, which is the only reason it is a paragraph here instead of a red
build. `subjectWarnings` is now its own channel and cannot reach the exit code.

**Gate:** `catalogue-audit.mjs` passes, `verify.mjs` passes at Tier 0 coverage 100.0%, `tsc`
clean, 944 tests in 63 files pass.

**My open list is now: `levelCheck` (blocked on the `CAPTURE-REQUESTS.md` §2 capture) and the two
Part 2 proposals — proposal 1 parked with you on the type/codegen decision, proposal 2 materially
devalued now that the resolver it was for has no consumer.** If nothing lands by the next tick I
will say so rather than invent work.

## To the Director — P0: the seam is shippable, and the player-facing half already existed

**Two artifacts, loadable with no website change and no access to this repo:**

```
web/public/bis/eqls-50upgrades.656d77f6.js   13,248 bytes, global EQLS50Upgrades
web/public/bis/bis-catalog.json              1.44 MB, 3,663 records already merged
web/public/bis/manifest.json                 hashes, counts, and the caveat
```

Built to E's own convention deliberately — one file, no imports, classic script, content hash in
the name — because E's bundle contract argues for it and a second convention is a second thing to
go wrong. **Verified end-to-end from the manifest alone**, the way a consumer with none of my
source would: manifest → bundle → catalogue → 2,066 candidates over 3,663 records in 36 ms,
**0 ineligible, 0 non-null difficulty**, 485 carrying a surveyed `zoneLevels`.

**The catalogue is shipped merged, and that is the point.** The payload is an index plus 23
shards and a record's real shape is `{...index, ...shard}` keyed by lowercased name. That merge
is easy to get wrong invisibly — **it is what made three of five checks look dead in my
`catalogue-audit` A/B this evening**, when my mutation hit shards only and the index quietly
restored the field. No consumer should have to rediscover it.

### The finding that matters more than the artifact: I nearly built a duplicate

**"Make me BIS" as a player-facing screen substantially exists already.** Before adding a panel I
checked `web/src/screens/Upgrades.tsx` against its code rather than its doc comment:

| the brief asks for | already shipped |
|---|---|
| ordered list of what to do next | `rankSlotItems` per position, sorted by gain |
| eligibility, trio-aware | `activeContext` + the same `canUse` gate the picker uses |
| where to go and get it | `acquisitionLines()` at `:702` — zones, drops-from, quests |
| never a fabricated number | `withheld` band; unmeasured items are never ranked |

**So the gap tonight was never the screen. It was that E runs a separate bundle in a separate
repository and could not import a TypeScript module.** That is what shipped.

What genuinely does not exist yet, and none of it is mine alone: **actions beyond gear** (spells,
weapon to +10, rotation) which need E's model, and **spendability** under R35 which needs D's cap.
I have not built either and will not guess at them.

### R35 read, and it changes nothing on my side

The ranked list being spendable rather than merely ordered is E's ranking and D's cap. My output
already carries what a spendable answer needs — `obtainable` names the content, `actionability` is
three-way and never inferred here. **No change required, which I would rather say than manufacture
one.**

**Gate:** `tsc` clean, 967 tests in 64 files, `verify.mjs` at Tier 0 coverage 100.0%,
`catalogue-audit.mjs` passes.

## To the Director — both 21:0x findings REPRODUCE. F1 fixed; your figures were exact.

**Verified before acting, as asked. Both reproduce, and F1 is worse than you stated.**

### F1 — CONFIRMED. Three of five profiles are blind to weapons

Measured by behaviour, not by reading the source: the same item with and without a weapon block,
scored under each preset.

| profile | RATIO | stat-stick | same + weapon | sees a weapon? |
|---|---|---|---|---|
| melee-dps | 40 | 3 | 83 | yes |
| **tank** | — | 20 | **20** | **NO** |
| **caster** | — | 2 | **2** | **NO** |
| **healer** | — | 2.5 | **2.5** | **NO** |
| balanced | 20 | 10 | 50 | yes |

**Your concrete case, run:** a 1-damage baton (`AC 30, STA 10`) against a 40-damage greatsword
(`AC 2`).

| profile | baton | greatsword | winner |
|---|---|---|---|
| melee-dps | 16 | 80.6 | greatsword |
| **tank** | **72** | 4 | **the baton, by 18×** |
| **caster** | **11** | 0.4 | **the baton** |
| **healer** | **13.5** | 0.5 | **the baton** |
| balanced | 35.5 | 42 | greatsword |

**Fixed as ruled: PRIMARY and SECONDARY go to `withheld`, no default RATIO invented.** The row
says why, names the two profiles that do weight a weapon, and the withholding fires whether or not
anything is equipped — the defect is in the scoring, not in the item, so an empty hand is
withheld too and `wornName` became nullable rather than being given a fabricated name.

**And the first version of the guard did not guard.** With the fix reverted the whole suite was
**973 green**: my new tests exercised the `scoresWeapons` predicate and the scorer, not the
screen. A guard on the predicate is not a guard on the screen. Added a `computeUpgrades`-level
test; with the fix disabled the suite now goes **1 failed / 975 passed**, restored byte-identical
by SHA-256.

### F2 — CONFIRMED, with one refinement to the denominator

```
shard rows 4,004 · carrying wp 788 · two-handed 124
2H Slashing 63 · 2H Blunt 59 · 2H Piercing 2
```

**Every figure you gave is exact.** The refinement: 124 is *shard rows*; **123 distinct items** —
one two-hander ships in two shards. Same 8-versus-4 shape as before, so I am naming the
denominator rather than correcting you.

**One thing you did not say, and it constrains the fix:** *zero* two-handers list `SECONDARY` in
their slot list. The payload does not record that a two-hander occupies both hands at all — the
only marker is `wp.skill` starting `2H`. So the subtraction has to key on the skill string, which
is a Tier 2 wiki field, and that dependency should be visible in the `basis` rather than implied.

**F2 is not yet fixed.** It is arithmetic across two positions inside `upgradeSteps`' allocation
pass, and I would rather land it correctly next than land it fast beside a fix that is already
shipping. Next commit.

**Gate:** `tsc` clean, **976 tests in 65 files**, `verify.mjs` at Tier 0 coverage 100.0%,
`catalogue-audit.mjs` passes, BIS artifacts republished.

## To the Director — F2 shipped. The netting refuses a bad trade, and my first test data proved it by accident.

**Both 21:0x findings are now closed.** The Primary row's value subtracts the worn Secondary's EP
when the winner is two-handed, and the subtraction is **printed** rather than inferred — the
Secondary row is not suppressed, so the evidence stays visible as you ruled.

**Keyed on `wp.skill`, with the dependency in the row.** Every netted row prints:

> Two-handed, so the offhand empties: 220 EP for *[weapon]* less 40 EP for the *[offhand]* it
> replaces. That this weapon takes both hands is read from `2H Slashing — a wiki field, not a
> payload fact`.

That last clause is there because zero of the 124 two-handed rows list `SECONDARY` in their slot
list: the payload records nothing about a weapon occupying both hands, so the whole netting rests
on a Tier 2 wiki string. If it goes stale the subtraction goes with it, and a reader should not
have to discover that from a wrong answer.

### My first test data made the row vanish, and that was the fix working

I built a 60 EP greatsword and equipped a 100 EP offhand. The Primary row disappeared and three
assertions failed. **The code was right:** netted, that trade loses 40 EP, so the recommendation
was correctly refused. My data was wrong, not the engine.

That case is now its own test — *"REFUSES a two-hander that loses the trade, which is the whole
point"* — because it is the actual defect being fixed, and I would not have written it if my first
numbers had been better chosen. It also asserts the row is **dropped as settled rather than
withheld**: a priced refusal is a different thing from an unmeasurable one.

**A/B over the whole suite, three mutations:**

| mutation | result |
|---|---|
| netting removed from the gain (the original defect) | **2 failed** / 981 |
| netted but not printed (the ruling's other half) | **2 failed** / 981 |
| keyed on `sl` including SECONDARY instead of `wp.skill` | **3 failed** / 980 |

Source restored byte-identical by SHA-256 after each.

**Gate:** `tsc` clean, **983 tests in 65 files**, `verify.mjs` at Tier 0 coverage 100.0%,
`catalogue-audit.mjs` passes, BIS artifacts republished.

**My board is empty of assigned work.** F1 and F2 are closed, the fixture is published, the
manifest names its record path. Remaining and not mine to move: `levelCheck` (blocked on the
`CAPTURE-REQUESTS.md` §2 capture) and Part 2 proposal 1 (parked with you on the type-vs-codegen
decision).

## To the Director — vendored at d6e17bec, degradation path shipped, and TWO ANSWERS for C and E

### The re-vendor: I had nothing to replace, and the fix is verified by my own instrument

**No bundle was vendored before now** — no `web/public/vendor/`, no reference to `EQLSGapEngine`
anywhere in `web/src` or `web/public`. I deferred vendoring to close F1 and F2, so nothing of mine
was exposed to the month-boundary defect.

Vendored now, **pinned to a commit rather than a branch**:
`sky-ledger@6c9fc313358635cdba7676e839eaef5d0df19ba5`, `sha256[:8] d6e17bec`, 20,337 bytes,
declaring `1.2.0`. Provenance beside it in `eqls-gap-engine.provenance.json`.

**I verified your three claims with my own instrument rather than accepting them** — a synthetic
log of one continuous fight spanning 31 Aug 23:59:40 into 1 Sep 00:00:58:

```
engagements     1     (the fix; the defect split it in two)
engaged_seconds 78    matches E's "after" figure exactly
months_seen     2     type number — the int, not the list
```

All three hold.

### The degradation path, built and tested before the happy path

`web/src/engine/gapEngine.ts`. It asserts `version === '1.2.0'` **exactly** and refuses a *newer*
engine as readily as an older one — 1.2.0 moved `months_seen` from `["Aug"]` to `2` inside an
hour, so "newer" is not "compatible". On any failure it returns
`{ available: false, why }` and the app ships, with the lane saying it *"cannot tell 'you never
learned it' from 'you never pressed it'"*.

It also **type-checks `months_seen`** at the seam. That is the defect my fixture caught, and the
check is what stops a future build reintroducing it silently. **14 tests, and A/B over the whole
suite:**

| mutation | result |
|---|---|
| version assertion loosened to a `1.` prefix | 2 failed / 995 |
| `months_seen` type check dropped | 1 failed / 996 |
| zero landings treated as usable | 1 failed / 996 |

### ANSWER 1 — SPELLS: WE HOLD NONE. Nothing in any of my three trees.

Measured, not searched-and-shrugged:

- `Character` is `{ id, name, race, levels, loadouts, activeLoadoutId }`. `Loadout` is
  `{ id, name, classes, race? }`. **No spell, ability or AA field on either.**
- The payload ships `meta`, `items-index`, 23 item shards, `contamination`, `focus-effects`.
  **No spell data.** `meta.effectKinds` is `click / effect / focus / proc / worn` — all *item*
  effect kinds.
- The one `AA` occurrence in `web/src` is a comment about an XP display, not data.

**The one thing that will look like a spell list and is not:** `focus-effects.json`, 66 entries
like *"Affliction Efficiency I — reduces the mana cost of long term detrimental spells…"*. Those
describe **what an item's focus effect does**, not what a character can cast. Anyone joining a
spellbook to it will get item modifiers back. Naming it because it is exactly the trap I would
have fallen into.

### ANSWER 2 — THE CHARACTER MODEL IS STABLE, WITH ONE WARNING THAT MATTERS MORE THAN THE SHAPE

`web/src/engine/character.ts`. `LoadoutContext { classes, race, levels }` is what every predicate
takes; `canUseClass`, `canUseRace`, `meetsLevel`, `canUse` and `levelCheck` are the surface. C and
E should build against those rather than a second copy.

> **BUT: you have twice described the rule as "the active trio uses the LOWEST level", and my code
> takes the HIGHEST.** `levelCheck` (`character.ts:261-294`) returns the highest qualifying class
> level; `research/eql-game-systems.md:279` says the effective level is the lowest. **Nobody has
> measured which is right** — it is finding 5, blocked on `CAPTURE-REQUESTS.md` §2.

**If C and E build against my model believing it implements "lowest", they inherit a contradiction
from a session that told them it was settled.** My own `bis.ts` sidesteps it by taking the gate as
a caller-supplied input rather than deriving it.

I A/B'd it rather than asserting: flipping `levelCheck` to LOWEST fails exactly **2** tests, both
in `character.test.ts` and both named for the rule — *"takes the best of several qualifying
classes"* and *"judges an unrestricted item against the best class in the loadout"*. So the
behaviour is pinned deliberately, not incidentally. **It is pinned to HIGHEST.** One capture
settles it and until then two more tools are about to encode a guess.

### On your blind-spot challenge, which I took seriously

You asked whether my fixtures are single-trio the way E's were single-day. Measured: 16
`makeContext` sites, **11 uniform-level, 3 mixed, 2 with no levels**. The uniformity is real. But
the thing that matters is whether anything can *discriminate*, and the A/B above says yes — 2
tests fail when the rule flips. **My suite is not blind here.** Reporting the clean result rather
than manufacturing a concern.

**Gate:** `tsc` clean, **997 tests in 66 files**, `verify.mjs` at Tier 0 coverage 100.0%,
`catalogue-audit.mjs` passes, artifacts republished.

## To the Director — the live drift check caught the `=` rename, and your R55 citation is wrong

### The site renamed every tool and only a word-comparison could see it

`site-nav-drift` and `site-foot-drift` went red against the live site. Not a flake — **A renamed
all eight tools to the `=` convention in one release**, and this tool's chrome still showed the
old names:

```
The Index                    -> =Index          Gap engine                    -> =Gaps
Sky Ledger                   -> =Sky            Lockouts                      -> =Lockouts
50 Upgrades                  -> =Upgrades       Race unlock tracker           -> =Races
Race and primary calculator  -> =Combos         Faction impact checker        -> =Faction
```

**Every URL is unchanged.** Nothing else in this repository could have caught it — not `tsc`, not
the link sweep, not a status probe, not a redirect check. They all pass on a page whose words are
wrong. Only a check that compares the *labels* sees a rename.

Fixed: `SITE_NAV`, `SITE_TOOLS` and both pinned `EXPECTED` copies re-transcribed from the live
footer today, with the date moved from 18 Aug to 31 Aug.

**`TOOL_NAME` changed too, and that is the half worth reading.** It names both my footer entry and
my breadcrumb, so leaving it would have shown a reader `=Upgrades` in the site's footer and
`50 Upgrades` in the breadcrumb one click later — two names for one thing, which is precisely what
this app's shared chrome exists to prevent. It now reads `=Upgrades`.

### R55 is right and its citation is wrong

**`CLAUDE.md` contains no occurrence of "lowest", "highest" or "effective level" — none.** The
lines you cite, 122-124, are §6's working rules and §7's habit. Correcting it because a right
retraction resting on a wrong citation is one check away from being dismissed by the next reader.

**The claim actually lives at `research/eql-game-systems.md:279`, and its neighbours are the
finding:**

```
- **Confirmed (T1-adjacent):** at level 11 the primary class, race and deity lock…
- **Confirmed:** your effective level is the lowest of the three class levels…
- **Level 50 perk (T2, eqlwiki Newbie Guide):** reaching 50 grants…
```

Every bullet around it carries a tier or a named source. **That one carries a bare "Confirmed:"
with neither.** An unsourced assertion sitting in a list of sourced ones inherits their authority
visually, which is why it has read as settled for a week and why three sessions repeated it. That
is the §7 shape — typed where it could have been computed — and marking it is inside my bound.

### And a failure of mine, in how I ran the fan-out

I launched an eight-lens audit whose guard-vacuity lens damages source, runs the suite, and
restores — **in my own working tree, without `isolation: 'worktree'`.** I had just told the owner
I would not edit files while it ran, and did not apply the same reasoning to the agents.

Consequences, both caught: a stop-hook fired on a deliberately-damaged `bis.ts` and I nearly
committed it; and a full-suite run I took mid-flight reported **5 failures** that were an artifact
of the mutation, not a regression. I discarded that result rather than reporting it. The agent did
restore correctly at the end — all four audited sources are byte-identical to `f9928e3` by
SHA-256, verified before this commit.

**Rule I am adopting: any fan-out lens that writes gets `isolation: 'worktree'`, or it is
restructured to measure without writing.**

**Gate:** `tsc` clean, **997 tests in 66 files**, `verify.mjs` at Tier 0 coverage 100.0%,
`catalogue-audit.mjs` passes.

## To the Director — MY REFUTATION WAS WRONG. I greped the right lines in the wrong repository.

**Withdrawn: "CLAUDE.md contains no occurrence of lowest — none."** Verified your citation with my
own instrument rather than accepting the correction, and it is exact:

```
eql-source/CLAUDE.md @ de6ffd62   851 lines   lowest x2   highest x1   "effective level" x0
  :122  - **Multiclass.** Characters run three classes at once. Two at creation, third
  :123    at level 10, primary and race lock permanently at 11. The active trio uses the
  :124    level of the *lowest* class in it.

EQL50ups/CLAUDE.md                137 lines   lowest x0
  :118-128  §7 "The habit this repository is built around"
```

Positive control run first — `grep -ic provenance` returns 4 on that blob, so the grep fires.

### The failure mode, named precisely, because it is a new one

**My grep succeeded and returned a true answer about the wrong file.** Every instrument failure I
have logged today was a wrong *instrument* — a grep that counts mentions, an A/B over one file, an
oracle written as a paraphrase. This is a wrong *subject*, and it is nastier: a zero-result grep
looks identical whether you searched the right thing or not. There is no error, no empty output to
notice, nothing to make you look twice. **Both files are rules documents with numbered sections,
so even the surrounding context read as confirmation.**

And I had this exact lesson in hand. **This morning I established that `eql-source` is a separate
repository and that `git fetch origin` cannot see it** — I wrote it into *Standing → Environment*.
Eight hours later I read a bare `CLAUDE.md` path as mine without asking whose it was.

**Rule I am taking from it: a zero result is only evidence once you have named the subject you
searched.** `grep -c X file` answers a question about `file`, never about "the codebase".

### Your substance stands, and :285-288 may dissolve the dispute rather than settle it

Verified in my tree. `:279` is the only bare `**Confirmed:**` in its list — `:275` is
`(T1-adjacent)`, `:282` is `(T2, eqlwiki Newbie Guide)`, `:285` is `(T4, eqltools.com)`, `:289` is
`(confirmed, dev video Apr 2026)`. The mechanism holds.

And `:285-288` is real:

> *"caps take the **highest** of the three classes; spell/ability access runs at the **lowest** of
> the three levels."* — T4, single-source aggregator, *"the most detailed mechanical claim not yet
> corroborated"*.

**So there are at least three quantities — effective level, stat caps, spell access — and the
binary framing was wrong.** But the sharper point is a fourth question none of the four sites
answers: **which quantity does an item's `rl` read?** `levelCheck` answers item usability, and no
source in this tree addresses item requirements at all. The dispute is not highest-versus-lowest;
it is that nobody has said which number the item is gated on.

**R71 accepted: `levelCheck` stays on highest, documented, and the BIS gate stays caller-supplied.**
Not flipping it.

## To the Director — your false-`no` cannot have reached my ranking, and looking for it found a collision that is mine

### Answer to your direct question, measured not remembered

**My code never branches on `actionability` at all.** Not once:

```
grep -rnE "actionability\s*===|=== *'(yes|no)'" web/src   ->  no match anywhere
```

It is a pass-through field: `bis.ts` writes it at two sites and never reads it. **So a false `no`
from `actionability()` could not have shortened my list** — I never consumed D's answer. Your
grep finding nothing was right, and the reason is structural rather than lucky: I was ruled at
20:5x not to infer actionability, so I never built a consumer for it.

**And my union cannot express D's answer:** `Actionability` was `'unknown' | 'no-source'`. `'yes'`
and `'no'` are unrepresentable in my type.

### But looking for it found a real defect, and it is mine

**Two fields named `actionability`, in two repos, sharing a value that means different things.**

| | value | means |
|---|---|---|
| `EQLSLockouts:src/lockoutCore.js` | `'unknown'` | **asked, and cannot answer** — qualified by `unknownKind` |
| `EQL50ups:bis-contract.ts` | `'unknown'` | **nobody has asked** |

A consumer joining the two reads *"not yet asked"* as *"D says unknown"*. My contract already said
so in prose — and prose is a convention. **Your own R75 corollary is the judgement here: a ruling
that can be satisfied by remembering to do something has not been satisfied.**

**Fixed structurally: the value is now `'not-yet-asked'`, and no value my field can hold is a value
`actionability()` can return.** Field name unchanged, so nothing E has written breaks on access —
only the string moved, and no consumer can have branched on the old one meaningfully because I
never emit D's vocabulary.

Guarded by a test that encodes D's vocabulary as data and asserts disjointness, so the collision
cannot come back by someone adding a plausible-looking value:

```js
const D_VOCABULARY = ['yes', 'no', 'unknown'];
for (const v of emitted) expect(D_VOCABULARY).not.toContain(v);
```

### R73 applied to my own scripts, and the first result

Three of my file-set readers report no file count: `catalogue-audit.mjs` (a deploy gate),
`publish-bis.mjs`, `audit_socket_ladder.mjs`. A read-only sweep across all seven readers plus CI is
running now; I will report survivors and killed findings together.

**Practising it immediately** — the `rl` blast radius, restated R73-compliant: **19 shard files
opened**, 3,663 merged records, **3** carrying `rl` (Azarack Skin Wristwraps 46, Baton of the Sky
49, Refugee Shroud 15). 19 is 18 slot types plus the no-slot shard.

### R74: `docs/UNREPORTED-FINDINGS.md` created, with one entry

Adopted per-repo. **One entry, deliberately** — a list padded to look thorough is the same failure
as a count typed instead of computed. It is the `levelCheck` note, and it carries something
sharper than the trio-level dispute we have been having:

> **It is not established that this game gates *equipping* by level at all.** The only Tier M
> sighting of "Required Level" in this repository is on a **click effect**, not on wearing an item.

The dispute asks *which* level gates an item. That note asks whether item equipping is level-gated
**at all**, and no source in this tree answers it. It has been sitting in a doc comment since
before tonight.

**Gate:** `tsc` clean, **998 tests in 66 files**, `verify.mjs` at Tier 0 coverage 100.0%,
`catalogue-audit.mjs` passes, artifacts republished at `36de3a47`.
