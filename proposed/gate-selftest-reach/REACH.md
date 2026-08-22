# The reach of `gate_selftest.py`, measured

**For Session A. Nothing here has been applied to `eql-source`; this repository has
no business in that tree.** Written 2026-08-22 against
`claude/eq-map-export-proposal-oe8m6l` at `55832900`.

---

## Why this exists

"19 hand-written cases" has been quoted as if it were coverage. It is a count of
cases. **Reach** is a different quantity — how many of `gate.py`'s assertions does
running that harness actually make fire — and nobody had measured it.

The two numbers can move in opposite directions. A case can be added that proves
nothing new; an assertion can be unreachable however many cases exist.

## How it is measured

`check.py` passes its own `fail` and `warn` into `gate.run(pages, fail, warn)`.
Wrapping those two and recording the **caller's line number inside `gate.py`**
says exactly which assertions fired. No reading, no inference, no guessing at
what a case "probably covers".

The denominator is parsed, not grepped: `measure-reach.py` walks `gate.py`'s AST
for `fail(...)` / `warn(...)` **calls**. `grep -c` counts the string, and the two
agree today — but only the parse keeps agreeing the day somebody writes `fail(`
inside a docstring.

Everything runs on a copy. The real repository is never written to.

```
python3 measure-reach.py /path/to/a/scratch/copy-of-eql-source out.json
```

It is the same rule this project keeps relearning, pointed at a harness rather
than a check: **before believing what an experiment says about its subject,
prove the experiment touched the subject.**

---

## The numbers

```
gate.py assertion call sites : 42   (35 fail, 7 warn)
cases run                    : 31   (29 CASES + 2 SPECIAL)

REACHED by the harness       : 23   (23 fail, 0 warn)
NOT reached                  : 19   (12 fail, 7 warn)
reach                        : 23/42 = 54.8%
```

**"19 cases" is stale rather than wrong.** `main` at `2aeac48b` has 17 `CASES` +
2 `SPECIAL` = 19. This branch has 29 + 2 = **31**.

**A fair split of the 31 cases**, measured the same way — 8 of them fire no
`gate.py` assertion at all, and that is not a gap: `gate_selftest.py` covers
`check.py`'s own assertions too, which are a different surface.

```
cases that fire a gate.py assertion : 23
cases that fire none (check.py only) :  8
```

So 23 gate-targeting cases reach 23 assertions — very close to one case per
assertion, which is what a hand-written table produces.

---

## The finding that changes the plan

**Fixing `failures()` raises reach by zero.**

Reach measures what *fires*. No current case damages anything that makes a `warn`
fire, so the severity fix takes 23/42 to 23/42. What it changes is what is
*possible*: today a case proving a warn cannot be written, because the harness
cannot see the result. The entire gain comes from the seven new cases, not from
the patch.

| state | reach |
|---|---|
| today | 23/42 — 54.8% |
| after the `failures()` patch alone | 23/42 — **unchanged** |
| after the patch **and** 7 warn cases | 30/42 — 71.4% |
| after cases for all 19 gaps | 42/42 — 100% |

**And the severity filter is only 7 of the 19 gaps.** Twelve `fail` assertions
are unreached as well, and the patch does nothing for those — they simply have no
case. Several guard work being shipped right now:

- `L908` / `L939` — the `:root` block and the daylight token block, which is the
  theme work in flight
- `L771` / `L774` — the TOOLS registry, both directions
- `L603` — `no og:image — it will share as a bare link`
- `L684` — plotted positions disagreeing with their floor plan

So the honest headline is not "seven assertions cannot be proven". It is:
**31 cases reach 23 of 42 assertions, and the severity filter accounts for seven
of the nineteen gaps.**

---

## Every assertion the harness never makes fire

| gate.py line | severity | assertion |
|---|---|---|
| 366 | `fail` | fail(f"{p} says that is out of {m.group(2)} surveys; the ledger " |
| 425 | `fail` | fail(f"{src} types {m.group(0)!r} beside an experience figure. " |
| 476 | `warn` | warn("_build/withheld.py could not be imported — withholding is unchecked") |
| 485 | `warn` | warn(f"{path}: no roster row found for withheld mob {name!r} — cannot verify") |
| 506 | `fail` | fail(f"{path} prints {hit.group(0)!r} beside {name!r}, whose coordinate is " |
| 590 | `fail` | fail(f"{page} says a respawn of {got[0]}:{got[1]:02d} while the ledger " |
| 603 | `fail` | fail(f"{p} has no og:image - it will share as a bare link") |
| 608 | `fail` | fail(f"{p} points at share card {name}, which does not exist. " |
| 684 | `fail` | fail(f"{off} plotted positions disagree with their floor plan in total") |
| 736 | `warn` | warn("assets/prose-budget.json is missing — prose growth is unchecked") |
| 766 | `warn` | warn("_build/_partials.py has no TOOLS registry — tool nav is unchecked") |
| 771 | `fail` | fail(f"public/tools/{missing}.html exists but is not in the TOOLS registry, " |
| 774 | `fail` | fail(f"TOOLS lists {ghost!r} but public/tools/{ghost}.html does not exist") |
| 828 | `warn` | warn("public/sitemap.xml is missing — sitemap/canonical agreement is unchecked") |
| 859 | `warn` | warn("assets/index-data.json is missing — truncation safety is unchecked") |
| 882 | `fail` | fail("the truncation check examined 0 fields — an empty collection " |
| 904 | `warn` | warn("public/assets/site.css is missing — theme block order is unchecked") |
| 908 | `fail` | fail("public/assets/site.css has no :root block — build3.py copies " |
| 939 | `fail` | fail("site.css defines no daylight token block at all — the theme " |

---

## What this measure does not say

- **Reach is not correctness.** An assertion that fires is an assertion the
  harness can see; whether the case that fired it damages the *right* thing is a
  separate question this does not ask.
- **It measures one branch at one commit.** Re-run it rather than quoting this
  table — that is the whole point of shipping the meter rather than the number.
- **`check.py`'s own assertions are out of scope here.** The 8 cases that fire no
  `gate.py` rule are covering them, and a reach number for `check.py` would need
  the same instrument pointed at a different denominator.
