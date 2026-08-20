# Auditing checks

A check nobody has ever seen fail is a claim, not a check.

This directory holds the method and a tool that runs it. Both came out of an audit
of this repository on 2026-08-20 that found two dead checks and a class of vacuous
pass. The method is worth more than the fixes were, which is why it is written
down here rather than left as a description of what somebody happened to do once.

Nothing in `audit.py` is specific to this repository. It shells out to whatever
command runs a check, so it works against vitest, pytest, playwright, a shell
script or a make target. Python 3.9+, standard library only, no VCS required.

---

## The method

> **Damage the thing a check guards. Run that check alone. See whether it goes
> red. Restore. Count what you examined, and treat zero examined as a failure.**

That is the whole of it. The rest of this file is what the four steps cost when
you actually do them.

### 1. Damage the thing it guards — not something near it

The unit of the experiment is *one check against one damage aimed at its own
subject*. Damage something the check does not claim to watch and a survivor tells
you nothing; damage the whole file and a kill tells you nothing either, because
you cannot say which assertion did the work.

Two kinds of damage, and you need both:

| | What it proves | When it lies |
|---|---|---|
| **Generic operators** — `===`→`!==`, `n`→`n+1`, `&&`→`||`, `true`→`false` | The check notices *something* about its subject | A check whose subject is a string, a colour or a data file survives every operator ever written, and is not thereby dead |
| **Planned damage** — a written `find`/`replace` aimed at the exact fault | The check notices *the thing it was written for* | Costs a human to write, and goes stale when the code moves |

Start generic because it is free. When a check survives every operator, that is
**UNPROVEN**, not dead — go and aim a planned damage at it. Only a check that
survives a damage aimed squarely at its own subject has earned the word dead.

The best planned damage is almost always **the regression the check's own comment
says it exists to prevent**. If a check has no such comment, that is its own
finding.

### 2. Run that check alone

Not the suite. A suite tells you *something* went red; you want to know that
*this* check did. Running one file also makes the campaign affordable — the
difference between a two-second vitest file and a forty-second suite run,
multiplied by every damage.

Check the check is green *before* you damage anything. A check that was already
failing cannot tell you what a damage proves, and the tool refuses to guess.

### 3. Restore, and be able to prove you did

Hold the original content in memory and write it back in a `finally`, then read it
back and compare hashes. Do not rely on `git checkout`: an audit gets run in a
tree with unstaged work in it — that is *when* people run audits — and a tool that
reaches for version control to clean up will one day discard something.

`audit.py` exits 2 and says so loudly if it cannot put a file back. That is the
one failure mode where continuing is worse than stopping.

### 4. Count what you examined — and fail on zero

An audit that runs nothing must not report green, for exactly the reason a test
that asserts nothing must not. `audit.py` exits non-zero when nothing was
examined, when anything is DEAD, and when anything is UNPROVEN — because
"I could not tell" is not a pass either.

---

## The vocabulary

| Verdict | Meaning | What to do |
|---|---|---|
| `ALIVE` | Damaged, and the check went red | Nothing |
| `UNPROVEN` | Survived every generic operator | Write a planned damage. Do not call it dead yet |
| `DEAD` | Survived a damage aimed at its own subject | Fix the check |
| `NO_SUBJECT` | Nothing matched to damage | The config is wrong, or the check guards something outside the tree |
| `STALE` | A planned damage's `find` string is gone | Re-aim it — the code moved |
| `ERROR` | The check was already failing | Fix that first |

`STALE` matters more than it looks. A planned damage that silently stopped
matching would make a dead check look alive, so the tool reports it rather than
counting it as an attempt. The first run of this repository's own config produced
two `STALE` results because `meta.json` ships minified and the damages had been
written with the spacing a pretty-printer would use.

---

## What mutation cannot see, and how to find it anyway

Some checks fail this audit's premise: they never reach their subject at all, so
damaging it changes nothing and they look merely uncovered.

This is the **vacuous pass**, and it is the more dangerous of the two failure
modes because it reports a green tick. Grep for the shapes:

- **`catch { return }`** — the check treats "could not reach it" as "nothing to
  report". A network check that returns HTTP 403 from a proxy is indistinguishable
  from a site being down, and both read as a pass. Two of this repository's drift
  checks had never once executed their live half.
- **`expect(xs.filter(...)).toEqual([])`** — "none of this collection is X" is
  satisfied by an empty collection. If the selector stops matching, the assertion
  passes having measured nothing. Pin the population first:
  `expect(xs.length).toBeGreaterThan(n)`.
- **assertions only inside a loop** — a loop over an empty collection asserts
  nothing.
- **absence assertions** — `expect(container.querySelector('.x')).toBeNull()`
  passes perfectly on a component that failed to render. Prove the container
  rendered before asserting what is not in it.
- **a check that reimplements its subject** — the worst of them, because it looks
  thorough. If the test defines a local helper that does what the production code
  does and then tests the helper, the production code is unguarded and the test
  will stay green forever. This is what one of the two dead checks turned out to
  be.

None of these are detectable by mutation. All of them are detectable by reading,
which means they need a person, which means write them down where the next person
will look.

---

## Running it

```sh
python3 tools/check-audit/audit.py tools/check-audit/checks.json
python3 tools/check-audit/audit.py tools/check-audit/checks.json --only "payload gate"
python3 tools/check-audit/audit.py tools/check-audit/checks.json --list
python3 tools/check-audit/audit.py tools/check-audit/checks.json --json out.json
```

`checks.json` in this directory is this repository's set: the gates, the checks
whose subject is a string constant no operator can reach, and the two that were
found dead. It is deliberately not every check in the repository — 60 vitest
files and 20 browser specs, with a build behind each browser spec, is a campaign
rather than something you run on a Tuesday.

### The routine set versus the campaign

Two different questions, and they want different tools:

- **"Is this particular check real?"** — `checks.json`, on demand, cheap. Add an
  entry whenever you write a check that would be embarrassing to discover was
  decorative.
- **"Is anything in here dead?"** — a full campaign: point the generic operators
  at every check in the repository and read the survivors. Expensive, occasional,
  and the only way to find the one you were not suspicious of. The 2026-08-20
  campaign examined 60 vitest files and 20 browser specs and found one dead check
  that nobody would have thought to list.

### Adding a check

```json
{
  "name": "short, and says what is guarded",
  "command": ["npx", "vitest", "run", "src/thing.test.ts", "--reporter=dot"],
  "cwd": "web",
  "subjects": ["web/src/thing.ts"],
  "damages": [
    { "label": "the regression this exists to prevent", "find": "...", "replace": "..." }
  ]
}
```

Omit `damages` to use the generic operators. Include it — and then *only* it is
tried — when the subject is a string, a colour, a data file, or when you want to
pin the specific fault rather than any fault.

### Checks that write instead of returning

A script that produces a report rather than an exit code has nothing for the
audit to read. Wrap it: re-run it to a temporary location and compare against the
committed artefact, exiting non-zero on disagreement.
`assert-scanner-sees.mjs` does this for the contamination scanner, and the wrapper
turned out to be worth having on its own — it fails both on a stale report and on
a scanner whose predicates quietly stopped matching.

---

## Two things this audit taught that are not about tooling

**The instrument needs auditing too.** The static scanner written to find vacuous
passes reported 133 assertion-less browser specs on its first run. It had mistaken
Playwright's `async ({ page }) =>` destructuring for the test body. It was itself
a check reporting a result it had not measured. Nothing caught it except the
number being implausible — so when a tool tells you something surprising, verify
the tool before you act on the finding.

**A green suite is evidence about the suite, not about the code.** The dead check
found here sat in a file whose header described a real correctness bug in careful
prose, in a repository with 900-odd passing tests. Reinstating that exact bug left
every one of them green. The prose was right, the intent was right, and the check
was pointed at a copy of the thing it was guarding.
