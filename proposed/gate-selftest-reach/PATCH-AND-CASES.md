## Proposal — teach `gate_selftest.py` to prove a WARN

**Provenance of every number below.** Counts came from `grep`, run in `/workspace/samusmylove47-maker/eql-source`:

```
grep -c 'fail(' scripts/gate.py   -> 35      grep -o 'fail(' scripts/gate.py | wc -l -> 35
grep -c 'warn(' scripts/gate.py   -> 7       grep -o 'warn(' scripts/gate.py | wc -l -> 7
grep -c 'warn(' scripts/check.py  -> 10      (9 call sites; line 14 is `def warn(m)`)
grep -c 'class="nmob">Rathyl<' public/dungeons/najena.html -> 1
grep -rl sitemap.xml public/      -> public/robots.txt   (only)
```

I could not execute the harness: I was told to write no file, and the repository is read-only to me, so no mutation could be applied and no case could be run. Two claims were checked by executing code that touches nothing on disk — an in-memory `exec` of `_build/_partials.py` and `_build/withheld.py` with the module-level binding renamed, which confirmed **both modules still import cleanly and the renamed name is absent from the namespace** (so `from X import NAME` raises `ImportError`, which is what the two `except ImportError` arms need). Everything else below is read off the source and is marked as such where it matters.

---

### The seven `warn(` call sites in `scripts/gate.py`

| # | Line | Message (verbatim) | What it guards |
|---|---|---|---|
| 1 | 476 | `"_build/withheld.py could not be imported — withholding is unchecked"` | Rule 4. `WITHHELD` falls back to `set()`, so the loop at 477 iterates nothing: "no withheld coordinate reached a page" becomes vacuously true. |
| 2 | 485 | `f"{path}: no roster row found for withheld mob {name!r} — cannot verify"` | Rule 4, per mob. The roster-row regex found no `<td class="nmob">NAME</td><td class="loc">…</td>`, so that mob is `continue`d past — neither its roster cell nor the page-wide coordinate scan runs for it. |
| 3 | 736 | `"assets/prose-budget.json is missing — prose growth is unchecked"` | Rule 6 in full. `budget = None` skips the ratchet **and** the no-ceiling enrolment failure, for every page at once. Note the `except` is `(OSError, ValueError)` — two arms, one message. |
| 4 | 766 | `"_build/_partials.py has no TOOLS registry — tool nav is unchecked"` | Rules 6 and 6b together: footer linkage, registry/disk agreement in both directions, and the hub's cards. Five `fail()` sites at 771, 774, 783, 805, 808 all sit under `if listed is not None`. |
| 5 | 828 | `"public/sitemap.xml is missing — sitemap/canonical agreement is unchecked"` | Rule 7: the `.html`-suffix check and the canonical-vs-`<loc>` comparison, both under `if sm is not None`. |
| 6 | 859 | `"assets/index-data.json is missing — truncation safety is unchecked"` | The truncation rule, *including* its own `seen == 0` vacuity guard. |
| 7 | 904 | `"public/assets/site.css is missing — theme block order is unchecked"` | First-`:root`-is-dark, the daylight-block drift comparison, and the "no daylight block at all" failure. |

`check.py` receives these through `gate.run(pages, fail, warn)` (check.py:501-502) — the gate has no `fail`/`warn` of its own; it is handed check.py's closures at check.py:13-14. They land in `warns`, print at check.py:638 as `  WARN  {w}`, and **do not enter the exit-code decision**: check.py:640 exits 1 on `if fails:` only, and its last line prints `All checks passed with N warning(s).`

---

## 1. The patch

Unified diff against `scripts/gate_selftest.py`.

```diff
--- a/scripts/gate_selftest.py
+++ b/scripts/gate_selftest.py
@@ -35,11 +35,29 @@
 Both checks turned out to be alive. Nothing here had shown that, which is this
 file's only job.
 
 So each case carries `expect`: a distinctive fragment of the message its check
-prints. A case passes only when some failure line contains that fragment. Other
-failures alongside it are fine and ignored — the staleness one above cannot be
-avoided, because proving that check requires changing a build input. What is no
-longer possible is a case passing on someone else's failure.
+prints, and the severity it expects to see that message at. A case passes only
+when a line of that severity contains that fragment. Other failures alongside
+it are fine and ignored — the staleness one above cannot be avoided, because
+proving that check requires changing a build input. What is no longer possible
+is a case passing on someone else's failure.
+
+WHY EVERY CASE NAMES ITS SEVERITY AS WELL
+-----------------------------------------
+gate.py has 35 lines calling fail() and 7 calling warn() (grep -c). check.py
+prints a warn as "  WARN  " and exits 0 anyway, so `failures()` — which read
+FAIL lines and nothing else — could not see a warn at all. Seven of the gate's
+assertions therefore had no case here and could not have had one: a warn that
+fires correctly and a warn that is dead print the same nothing to this file.
+That is the backspace regex again, one severity down, and it lands on exactly
+the branches that report an input as absent — the moment at which a check is
+least able to speak for itself.
+
+Severity is part of what a case asserts, not a detail of how the message is
+printed. A case that took either would pass whether the gate blocked the commit
+or merely mentioned it, and would read a check downgraded from fail to warn as
+caught. So a case names one. The fifth element carries it; a case written
+before this has four and means FAIL, which is what it was written to mean.
 
 `expect` is matched against check.py's output rather than gate.py being made to
 tag each failure with a check id, because half these cases exercise checks that
@@ -73,31 +91,55 @@
 def check():
     r = subprocess.run([sys.executable, "scripts/check.py"], capture_output=True, text=True)
     return r.returncode, r.stdout
 
 
-def failures(out):
-    """Every blocker check.py printed, in order, stripped of the FAIL prefix.
+def reported(out, sev):
+    """Every line check.py printed at `sev`, in order, stripped of the prefix.
 
     All of them, not the first. Reading only the first is how two cases came to
     be proved by the staleness check and the link checker.
+
+    WARN as well as FAIL. check.py prints both and exits 0 for a warn, so the
+    FAIL-only version of this could not see the gate's seven warn branches at
+    all. Both prefixes are four characters and two spaces, so one slice serves
+    both.
     """
-    return [l.strip()[6:].strip() for l in out.splitlines() if l.strip().startswith("FAIL")]
+    return [l.strip()[6:].strip() for l in out.splitlines()
+            if l.strip().startswith(sev)]
+
+
+def failures(out):
+    """The blockers alone — what main() prints when the tree is already dirty."""
+    return reported(out, "FAIL")
 
 
-def judge(expect, rc, out):
-    """Did the check this case is about fire? Not: did anything fire.
+def judge(sev, expect, out):
+    """Did the check this case is about fire, at the severity it claims?
 
     `expect` is kept ASCII on purpose. check.py's messages carry em dashes, and
     a pipe on Windows round-trips through cp1252 — a fragment that spans one
     would match or not depending on the console encoding, which is a worse
     failure than the one this file exists to prevent.
+
+    rc is gone from the signature. It was how "nothing fired" was told from
+    "something else fired", and it cannot say that any more: a run whose only
+    event is the warn a case is proving exits 0 exactly like a clean one. An
+    empty list at the severity asked for says it instead, and for a FAIL case
+    it says the same thing rc == 0 used to say.
     """
-    got = failures(out)
+    got = reported(out, sev)
     for line in got:
         if expect in line:
             return "caught", line
-    if rc == 0:
-        return "MISSED", f"nothing failed at all; expected {expect!r}"
-    return "WRONG CHECK", (f"expected {expect!r}, but what failed was: "
-                           + " | ".join(got))
+    other = "WARN" if sev == "FAIL" else "FAIL"
+    rest = reported(out, other)
+    for line in rest:
+        if expect in line:
+            return "WRONG SEVERITY", (f"expected {expect!r} as a {sev}, but "
+                                      f"check.py printed it as a {other}")
+    if not got:
+        return "MISSED", (f"no {sev} line at all; expected one containing "
+                          f"{expect!r}. {other}: " + (" | ".join(rest) or "none"))
+    return "WRONG CHECK", (f"expected {expect!r} as a {sev}, but what fired was: "
+                           + " | ".join(got))
 
 
 def _sub_first_number(text, placeholder):
@@ -511,11 +553,36 @@
     return p, orig
 
 
+def mutate_missing_sitemap():
+    """The sitemap gone, so rule 7 has nothing to check the canonicals against.
+
+    A CASE cannot reach this one. gate.py catches OSError around the open, and
+    no edit to the bytes of a file makes reading it raise OSError — the file has
+    to be absent. Same shape as the missing item page above, and restored the
+    same way.
+
+    Nothing else reads it: check.py guards its own sitemap comparison with
+    os.path.exists, and the only reference to the file anywhere under public/ is
+    in robots.txt, which is not one of the *.html pages the link checker walks.
+    So this case runs clean apart from the warn — which is the point. A run with
+    no FAIL in it at all is precisely what the old harness read as nothing
+    happening.
+    """
+    p = "public/sitemap.xml"
+    orig = open(p, encoding="utf-8").read()
+    os.remove(p)
+    return p, orig
+
+
 SPECIAL = [
     ("a full zone still naming an open gate",
      "is marked full but its verify_gate still names an open gate",
      mutate_zone_gate),
     ("an item page The Index links but that is not on disk",
      "items page(s) that do not exist: journeymans-boots",
      mutate_missing_item_page),
+    # The one warn a CASE cannot reach: it needs the file gone, not changed.
+    ("the sitemap missing, so the canonicals have nothing to agree with",
+     "public/sitemap.xml is missing",
+     mutate_missing_sitemap, "WARN"),
 ]
@@ -531,27 +598,29 @@
         return 1
 
     results = []
-    for name, expect, path, fn in CASES:
+    for name, expect, path, fn, *severity in CASES:
+        sev = severity[0] if severity else "FAIL"
         orig = open(path, encoding="utf-8").read()
         try:
             new = fn(orig)
             if new == orig:
                 results.append((name, "TEST BROKEN", "the mutation did not apply — "
                                 "the markup it targets has changed"))
                 continue
             open(path, "w", encoding="utf-8", newline="\n").write(new)
-            rc, out = check()
-            results.append((name,) + judge(expect, rc, out))
+            _, out = check()
+            results.append((name,) + judge(sev, expect, out))
         finally:
             open(path, "w", encoding="utf-8", newline="\n").write(orig)
 
-    for label, expect, fn in SPECIAL:
+    for label, expect, fn, *severity in SPECIAL:
+        sev = severity[0] if severity else "FAIL"
         path, orig = fn()
         try:
-            rc, out = check()
-            results.append((label,) + judge(expect, rc, out))
+            _, out = check()
+            results.append((label,) + judge(sev, expect, out))
         finally:
             open(path, "w", encoding="utf-8", newline="\n").write(orig)
 
     bad = 0
     for name, status, detail in results:
@@ -566,9 +635,10 @@
         print("\nThe tree does not pass after restoring. Something was left mutated.")
         return 1
     if bad:
-        print(f"\n{bad} case(s) did not see the check they were written for fail. "
+        print(f"\n{bad} case(s) did not see the check they were written for fire "
+              f"at the severity they name. "
               f"Either that check is dead, or this file is now testing something "
               f"else — both are blockers.")
         return 1
-    print(f"\nAll {len(results)} cases saw the check they were written for fail, "
-          f"and the tree is clean.")
+    print(f"\nAll {len(results)} cases saw the check they were written for fire at "
+          f"the severity they name, and the tree is clean.")
```

### Why it is shaped this way

**Every case names exactly one severity; none accepts either.** `judge` searches only the severity the case declared. If the message turns up at the other severity, the verdict is a new `WRONG SEVERITY` rather than `caught` — which is what catches the failure mode you'd otherwise be blind to: a `fail(` demoted to a `warn(` in gate.py, which stops blocking commits while every existing case still reports green.

**The existing 28 cases keep their exact meaning.** For `sev == "FAIL"`, `not got` is true iff check.py printed no FAIL line, which is true iff `rc == 0` (check.py:640 exits 1 iff `fails` is non-empty). So the `MISSED` / `WRONG CHECK` boundary is unmoved. Only the *detail strings* change, and only to say more: `MISSED` now also prints the other severity's lines, so a WARN case that misses because the gate crashed shows you `the propagation gate did not run: …` instead of an unexplained blank.

**`rc` had to leave `judge`.** A run whose only event is the warn under test exits 0, identically to a clean run. Keeping `rc == 0` as the definition of "nothing fired" would have made every WARN case report `MISSED` on success.

**The fifth element is optional and defaults to `"FAIL"`** rather than being typed into all 28 existing tuples. That is the one concession to diff size. If you would rather every case say it out loud — and this file's own doctrine argues for that — make it mandatory by unpacking `for name, expect, path, fn, sev in CASES:` and adding `"FAIL"` to each of the 28 (and to the two SPECIAL entries). Either way, a misspelled severity (`"warn"`, `"WARNING"`) matches nothing and reports `MISSED`, which is a blocker — so no validation guard is needed to keep a typo from passing silently.

---

## 2. A CASE for each of the seven

Four go in `CASES`. One goes in `SPECIAL` (its diff hunk is above). Two cannot be constructed, and I have not invented a damage for them.

### Warn 1 — `_build/withheld.py could not be imported` — CASE

Append to `CASES`:

```python
    # ---- the gate's warn branches -------------------------------------------
    #
    # Seven of them, and until now not one was proved. Each fires when an input
    # a check needs is not there, which is the state in which a check is most
    # likely to be silently doing nothing and least able to say so.

    # WITHHELD is what rule 4 iterates. A failed import leaves it set(), and
    # "no withheld coordinate reached a page" is then satisfied by there being
    # no withheld coordinates — the vacuous pass the truncation check grew its
    # own seen == 0 guard against. This warn is the only thing separating that
    # from a clean run.
    #
    # The binding is renamed rather than the file removed: `from withheld import
    # WITHHELD` raises ImportError either way, the module still imports, and it
    # stays a CASE instead of needing a SPECIAL. Mutating _build/*.py also makes
    # public/ stale, because stamp.py fingerprints that glob — collateral, and
    # ignored, the same as the open-gate case.
    ("the withheld set unimportable, so rule 4 iterates nothing",
     "_build/withheld.py could not be imported",
     "_build/withheld.py",
     lambda t: t.replace("WITHHELD = {", "WITHHELD_UNUSED = {", 1),
     "WARN"),
```

`WITHHELD = {` occurs once, at `_build/withheld.py:23` (`grep -n`). The in-memory `exec` probe confirmed the module executes to completion after the rename and does not bind `WITHHELD`.

### Warn 2 — `no roster row found for withheld mob` — CASE

```python
    # The other half of rule 4, and the half that goes quiet by itself. The
    # coordinate check finds each withheld mob's roster row by name; rename a
    # mob on the plate, or change the cell markup in build3.py, and the lookup
    # returns None, the mob is `continue`d past, and neither its roster cell nor
    # the page-wide scan below runs for it. The warn is the only record that a
    # mob was skipped — and a skipped mob is the one whose coordinate is most
    # likely to have escaped, because the rename is what let it escape.
    ("a withheld mob with no roster row left to read",
     "no roster row found for withheld mob 'Rathyl'",
     "public/dungeons/najena.html",
     lambda t: t.replace('<td class="nmob">Rathyl</td>',
                         '<td class="nmob">Rathyl the Bound</td>', 1),
     "WARN"),
```

`class="nmob">Rathyl<` occurs exactly once in that file (`grep -c` → 1). All six entries in `WITHHELD` are Najena, so this is the only page that can carry the case.

### Warn 3 — `assets/prose-budget.json is missing` — CASE

```python
    # Rule 6's entire enforcement hangs on this file parsing. gate.py catches
    # OSError and ValueError together and skips the rule, so an unreadable
    # budget turns off the ceiling on every page at once AND the enrolment
    # failure that catches a page with no ceiling — the ungoverned state that
    # took fourteen pages in July, but all of them, in one commit.
    #
    # Broken rather than removed, because ValueError is the arm a hand-edit
    # reaches. Nobody deletes this file; people edit it, and prose_budget.py
    # rewrites it.
    #
    # prose-budget.json is the one assets/*.json that stamp.py skips, so this
    # case does not even trip the staleness failure: the run is clean apart from
    # the warn, which is exactly the shape the old harness read as nothing
    # having happened.
    ("the prose budget unreadable, so no page has a ceiling",
     "assets/prose-budget.json is missing",
     "assets/prose-budget.json",
     lambda t: "this is not JSON\n" + t,
     "WARN"),
```

`stamp.py`'s `fingerprint()` explicitly `continue`s on `prose-budget.json`, so no staleness collateral. The message says "is missing" while the file is present but malformed — see the note in §3; that is a defect in gate.py's wording, not in the case, and `expect` must match what is actually printed.

### Warn 4 — `_build/_partials.py has no TOOLS registry` — CASE

```python
    # Rules 6 and 6b both hang off this one import. Lose it and nothing checks
    # that a tool is in every footer, that a footer names a tool that exists,
    # that a registered tool is on disk, or that the hub has a card for it —
    # five fail() sites, three of them written from faults that actually
    # shipped, all switched off by one ImportError.
    #
    # gate.py imports TOOLS twice. The earlier one, for the "tools listed"
    # count, is under `except Exception` and only drops that truth, so it does
    # not mask this. _partials.py reads TOOLS itself only inside foot(), which
    # nothing check.py runs ever calls, so the module still imports.
    ("the TOOLS registry unimportable, so tool nav is unchecked",
     "_build/_partials.py has no TOOLS registry",
     "_build/_partials.py",
     lambda t: t.replace("TOOLS = [", "TOOLS_UNUSED = [", 1),
     "WARN"),
```

`TOOLS = [` occurs once, at `_build/_partials.py:63`. The `_foot_links(TOOLS, "tools", rel)` reference is at line 275, inside `def foot(rel="")` (line 257) — evaluated on call, not on import. Confirmed by the in-memory `exec` probe. Same staleness collateral as warn 1.

### Warn 5 — `public/sitemap.xml is missing` — SPECIAL

In the diff above: `mutate_missing_sitemap()` plus the `SPECIAL` entry `("the sitemap missing, so the canonicals have nothing to agree with", "public/sitemap.xml is missing", mutate_missing_sitemap, "WARN")`.

**It cannot be a CASE.** gate.py:826-828 is `try: sm = open(…).read() / except OSError:` — no edit to the file's *bytes* makes reading it raise `OSError`. The file has to be absent, which the CASES mechanism (read text → transform → write text) structurally cannot do. `mutate_missing_item_page` is the existing precedent for exactly this.

### Warn 6 — `assets/index-data.json is missing` — **NO DAMAGE CAN BE CONSTRUCTED**

This warn is unreachable through `check.py`, which is the only thing that calls `gate.run`. `gate.py:245` — the *second statement of `run()`*, 611 lines above the warn — is:

```python
IX = json.load(open("assets/index-data.json", encoding="utf-8"))
```

with no `try`. Remove the file and `run()` raises `FileNotFoundError` there; check.py:503-504 catches it and prints `FAIL  the propagation gate did not run: FileNotFoundError: …`. Malform it instead and `json.load` raises `ValueError` at the same line — and gate.py:856's `except` is `OSError` only, so it would not have caught that even if execution had reached it. Line 859 cannot execute under any damage to that file.

I have not written a case for it. Any mutation I could offer would be proved by a different message on a different line, which is the precise fault this file was rewritten on 11 August to stop.

**What would make it constructible** (a change to gate.py, out of scope for this patch — pick one):
- move the line-245 load under the same guard, so `IX = None` and the counts rule skips like the others; or
- delete the warn at 856-859 and let `IX` at line 245 be the single unguarded read, since the gate genuinely cannot run without that file. Then the truth is "the gate requires index-data.json", stated once.

Either way the case can be added the moment the branch is reachable.

### Warn 7 — `public/assets/site.css is missing` — **NO DAMAGE CAN BE CONSTRUCTED**

Unreachable for a different reason, one level further out. `check.py:135`, at module scope with no `try`:

```python
css = open("public/assets/site.css", encoding="utf-8").read()
```

That is 366 lines above `import gate` at check.py:501. With the file absent, check.py dies of an uncaught `FileNotFoundError` before the gate is imported at all: it prints no `FAIL` and no `WARN` lines, `check()` returns a non-zero rc with a stdout ending at `vendored script references checked: N`, and `reported()` finds nothing to read. The gate's warn at 904 cannot fire, and — worse — a case written for it would report `MISSED`, which reads as "the check is dead" when the real cause is that the harness never got that far.

Again, no case, and no invented damage.

**What would make it constructible:** wrap check.py:135 the way gate.py already wraps its own read, e.g. `try: css = open(…).read() / except OSError: css = ""; fail("public/assets/site.css is missing — …")`. That is a change to `check.py`, and it deserves its own FAIL case here once made.

**Net effect of the patch: 5 of the gate's 7 warns become provable; the remaining 2 are demonstrably unreachable, which is itself the finding.**

---

## 3. What the patch does not fix

1. **`check.py`'s own nine `warn(` call sites are now testable and still untested.** Lines 74, 151, 171, 182, 194, 284, 299, 301, 621 (from `grep -n 'warn(' scripts/check.py`; the tenth hit is the `def` at line 14). The mechanism this patch adds covers them — `judge` reads check.py's stdout and does not care which file raised the message, exactly as the file's existing docstring says of `expect`. Nine more cases would close the whole surface. The one at 621 ("node is not on PATH") is worth a case in particular: it is the only thing standing between "the tools were smoke-tested" and "the tools were not tested and nobody said so."

2. **Nothing asserts the *absence* of a warn.** Every verdict here is "did this fire". A warn that starts firing on every clean build is invisible to this file — and gate.py:943-945 explicitly worries about that state: *"one is not a fault and must not warn on every build, because a standing warning is one people learn to scroll past."* A companion assertion in `main()` — that the pre-mutation run prints an expected, enumerated set of warns and no others — would close it, and would have to be enumerated rather than counted, or it becomes the same untestable number.

3. **Nothing asserts that the warn count is still seven.** The blind spot returns in full the first time an eighth `warn(` is added to gate.py with no case beside it. A cheap guard belongs in `main()`: read `scripts/gate.py`, count the `fail(` and `warn(` call sites, and fail when either moves off the figure the case table covers. That is a number computed rather than typed, which is the standard this repository holds everything else to, and this patch does not add it.

4. **`SPECIAL` still has no `TEST BROKEN` guard.** `CASES` catches a no-op mutation with `if new == orig`. The three `SPECIAL` mutators — including the new sitemap one — never check that they changed anything. If `public/sitemap.xml` is already absent, or `Z[0]` already names an open gate, or the item page has moved, the mutator succeeds, the case reports `MISSED`, and the operator is told a live check is dead. Giving each mutator a way to say "I could not apply" would fix it; I left it out to keep the patch to the severity change.

5. **The two `_build/*.py` cases (warns 1 and 4) trip the staleness `FAIL`,** because `stamp.py`'s `INPUTS` includes `_build/*.py`. That is the precedent the open-gate and catalogue-fixes cases already set, and `judge` ignores it — but it means those two cases cannot be run on a tree where staleness is itself under investigation.

6. **Cost.** `main()` runs the full `check.py` — node smoke test included — once per case. The table goes from 28 cases to 33, so the run gets about 18% longer. Nothing here batches or reuses a run.

7. **A message split across lines still parses as one.** `reported()` keeps the existing behaviour: only lines starting with the prefix are collected, so a `fail()`/`warn()` message containing a literal newline would have its continuation dropped. Not a regression, and no message currently does that — but `expect` fragments must stay inside a single printed line.

8. **gate.py:736's message is wrong for the arm this patch now proves.** The `except` is `(OSError, ValueError)` and the message says only *"assets/prose-budget.json is missing"*. Warn 3's case exercises the `ValueError` arm, so the harness will be proving a branch that reports the wrong cause. Widening the message — *"is missing or unreadable"* — is a one-word gate.py change; the case's `expect` would then need to shorten to `"assets/prose-budget.json is missing"`'s surviving prefix, or to `"prose growth is unchecked"`, which is unique to that line and ASCII throughout.