#!/usr/bin/env python3
"""
Break every check on purpose, and report the ones that do not notice.

A check nobody has ever seen fail is a claim, not a check. This runs the only
experiment that settles it: damage the thing a check guards, run that check
alone, and see whether it goes red. Restore, then move to the next one.

    damage -> run the check alone -> record -> restore

Nothing here is specific to this repository. It shells out to whatever command
a check is run by, so it works for vitest, pytest, playwright, a shell script,
or a Makefile target. Python 3.9+, standard library only, no VCS required.

Usage
-----
    python3 audit.py CONFIG [--only SUBSTRING] [--json OUT] [--list]

Exit status
-----------
    0  every check examined was killed by at least one damage
    1  at least one check survived every damage aimed at it
    2  nothing was examined, or the tree could not be restored

The second and third are the point. **Zero examined is a failure**, not a
vacuous success — an audit that runs nothing must never report green, for the
same reason a test that asserts nothing must not.

Config
------
JSON. See `checks.example.json`, and `README.md` for the method.

    {
      "root": ".",                        // everything below is relative to this
      "restore_command": null,            // optional; belt and braces after each
      "timeout_seconds": 900,
      "checks": [
        {
          "name": "unit: catalog",
          "command": ["npx", "vitest", "run", "src/data/catalog.test.ts"],
          "cwd": "web",                   // optional, relative to root
          "subjects": ["web/src/data/catalog.ts"],
          "damages": [                    // optional; explicit beats generic
            {"find": "a === b", "replace": "a !== b"}
          ]
        }
      ]
    }

`subjects` may be explicit paths or globs. When `damages` is absent the generic
operators below are tried in order until one kills the check. When `damages` is
present ONLY those are tried, which is what you want for a check whose subject
is a string constant, a colour, or a data file — no operator reaches those.

Why both modes
--------------
Generic operators are cheap and unbiased: they tell you the check notices
*something* about its subject. Planned damages are precise: they tell you the
check notices *the specific thing it was written for*. A drift check pinning a
label survives every operator ever written and is not thereby dead. Report a
generic survivor as UNPROVEN, not as dead, and aim a planned damage at it.
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable

# --------------------------------------------------------------------------
# generic damage operators
# --------------------------------------------------------------------------
#
# Each takes the whole file's text and returns a damaged copy, or None when it
# does not apply. They change ONE site — the first match — so a survivor is
# informative rather than "I rewrote the file and something broke".
#
# Deliberately textual and language-agnostic. A parser per language would be
# more precise and would stop this being a thing you can drop into any repo.

Operator = Callable[[str], "str | None"]


def _sub_once(pattern: str, repl: str) -> Operator:
    rx = re.compile(pattern)

    def op(text: str) -> str | None:
        new, n = rx.subn(repl, text, count=1)
        return new if n and new != text else None

    return op


def _bump_number(text: str) -> str | None:
    """First integer literal >= 2 becomes itself + 1.

    Skips 0 and 1: flipping those is usually a no-op or a type error rather
    than a behaviour change, and a no-op damage produces a false survivor.
    """
    m = re.search(r"(?<![\w.])([2-9]|[1-9]\d+)(?![\w.])", text)
    if not m:
        return None
    return text[: m.start()] + str(int(m.group(1)) + 1) + text[m.end() :]


OPERATORS: list[tuple[str, Operator]] = [
    ("eq->ne", _sub_once(r"===", "!==")),
    ("ne->eq", _sub_once(r"!==", "===")),
    ("eq->ne (loose)", _sub_once(r"(?<![=!<>])==(?!=)", "!=")),
    ("number+1", _bump_number),
    ("gte->gt", _sub_once(r">=", ">")),
    ("lte->lt", _sub_once(r"<=", "<")),
    ("and->or", _sub_once(r"&&", "||")),
    ("or->and", _sub_once(r"\|\|", "&&")),
    ("and->or (py)", _sub_once(r"\band\b", "or")),
    ("true->false", _sub_once(r"\btrue\b|\bTrue\b", "false")),
    ("false->true", _sub_once(r"\bfalse\b|\bFalse\b", "true")),
    ("gt->lt", _sub_once(r"(?<![>=<!])>(?![>=])", "<")),
    ("plus->minus", _sub_once(r"(?<![+\w])\+(?![+=])", "-")),
    ("not->identity", _sub_once(r"(?<![\w!=<>])!(?![=])", "")),
]


# --------------------------------------------------------------------------
# result vocabulary
# --------------------------------------------------------------------------

ALIVE = "ALIVE"            # damaged, and the check went red. Working.
UNPROVEN = "UNPROVEN"      # survived every generic operator. Aim a planned damage.
DEAD = "DEAD"              # survived a planned damage aimed at its own subject.
NO_SUBJECT = "NO_SUBJECT"  # nothing to damage — the config is wrong, or the check
                           # guards something outside the tree.
STALE = "STALE"            # a planned damage's `find` is no longer in the file.
ERROR = "ERROR"


@dataclass
class Result:
    name: str
    verdict: str
    attempts: int = 0
    subjects: list[str] = field(default_factory=list)
    log: list[str] = field(default_factory=list)
    detail: str = ""

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "verdict": self.verdict,
            "attempts": self.attempts,
            "subjects": self.subjects,
            "log": self.log,
            "detail": self.detail,
        }


# --------------------------------------------------------------------------
# the tree, and putting it back
# --------------------------------------------------------------------------


class Tree:
    """Damages files and guarantees they go back.

    Content is held in memory rather than trusted to version control, so this
    works in a repository with unstaged work in it — which is exactly when
    somebody runs an audit — and cannot discard anything.
    """

    def __init__(self, root: Path, restore_command: list[str] | None) -> None:
        self.root = root
        self.restore_command = restore_command
        self._saved: dict[Path, str] = {}

    def damage(self, path: Path, text: str) -> None:
        if path not in self._saved:
            self._saved[path] = path.read_text(encoding="utf-8")
        path.write_text(text, encoding="utf-8")

    def restore(self) -> bool:
        """Put everything back. Returns False if anything could not be restored."""
        ok = True
        for path, original in list(self._saved.items()):
            try:
                path.write_text(original, encoding="utf-8")
                if _digest(path.read_text(encoding="utf-8")) != _digest(original):
                    ok = False
            except OSError as exc:  # pragma: no cover - filesystem failure
                print(f"  !! could not restore {path}: {exc}", file=sys.stderr)
                ok = False
            else:
                self._saved.pop(path, None)
        if self.restore_command:
            subprocess.run(self.restore_command, cwd=self.root, capture_output=True)
        return ok


def _digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# running one check
# --------------------------------------------------------------------------


def resolve_subjects(root: Path, patterns: Iterable[str]) -> list[Path]:
    out: list[Path] = []
    for pattern in patterns:
        if any(ch in pattern for ch in "*?["):
            base = root
            for path in sorted(base.rglob("*")):
                if not path.is_file():
                    continue
                rel = path.relative_to(root).as_posix()
                if fnmatch.fnmatch(rel, pattern) and path not in out:
                    out.append(path)
        else:
            path = (root / pattern).resolve()
            if path.is_file() and path not in out:
                out.append(path)
    return out


def run_command(check: dict, root: Path, timeout: int) -> bool:
    """True when the check passes (exit 0)."""
    cwd = root / check["cwd"] if check.get("cwd") else root
    try:
        proc = subprocess.run(
            check["command"], cwd=cwd, capture_output=True, text=True, timeout=timeout
        )
    except subprocess.TimeoutExpired:
        # A damage that hangs the check is a damage the check noticed.
        return False
    except FileNotFoundError as exc:
        raise RuntimeError(f"cannot run {check['command'][0]!r}: {exc}") from exc
    return proc.returncode == 0


def audit_check(check: dict, tree: Tree, timeout: int) -> Result:
    name = check["name"]
    subjects = resolve_subjects(tree.root, check.get("subjects", []))
    planned = check.get("damages") or []

    if not subjects:
        return Result(name, NO_SUBJECT, detail="no subject file matched")

    result = Result(name, UNPROVEN, subjects=[p.relative_to(tree.root).as_posix() for p in subjects])

    # A check that is already red tells you nothing about what a damage proves.
    if not run_command(check, tree.root, timeout):
        result.verdict = ERROR
        result.detail = "the check is already failing before any damage"
        return result

    damages: list[tuple[Path, str, Callable[[str], str | None]]] = []
    if planned:
        for spec in planned:
            find, replace = spec["find"], spec["replace"]
            for path in subjects:
                damages.append(
                    (path, spec.get("label", f"{find[:40]} -> {replace[:40]}"),
                     lambda t, f=find, r=replace: t.replace(f, r, 1) if f in t else None)
                )
    else:
        for path in subjects[: check.get("max_subjects", 3)]:
            for label, op in OPERATORS:
                damages.append((path, label, op))

    applied_any = False
    for path, label, make in damages:
        original = path.read_text(encoding="utf-8")
        damaged = make(original)
        if damaged is None or damaged == original:
            continue
        applied_any = True
        result.attempts += 1
        tree.damage(path, damaged)
        try:
            passed = run_command(check, tree.root, timeout)
        finally:
            if not tree.restore():
                raise RuntimeError(f"could not restore the tree after damaging {path}")
        rel = path.relative_to(tree.root).as_posix()
        result.log.append(f"{rel}: {label} -> {'survived' if passed else 'KILLED'}")
        if not passed:
            result.verdict = ALIVE
            return result

    if not applied_any:
        result.verdict = STALE if planned else NO_SUBJECT
        result.detail = (
            "no planned damage matched its file" if planned else "no operator applied"
        )
        return result

    result.verdict = DEAD if planned else UNPROVEN
    result.detail = (
        "survived a damage aimed at its own subject"
        if planned
        else "survived every generic operator — aim a planned damage before calling it dead"
    )
    return result


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("config")
    parser.add_argument("--only", help="run checks whose name contains this")
    parser.add_argument("--json", dest="json_out", help="write full results here")
    parser.add_argument("--list", action="store_true", help="list checks and exit")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    root = (config_path.parent / config.get("root", ".")).resolve()
    timeout = int(config.get("timeout_seconds", 900))
    checks = config["checks"]
    if args.only:
        checks = [c for c in checks if args.only in c["name"]]

    if args.list:
        for c in checks:
            print(f"{c['name']}\n    {' '.join(c['command'])}")
        return 0

    if not checks:
        print("nothing to examine — zero examined is a failure, not a pass", file=sys.stderr)
        return 2

    tree = Tree(root, config.get("restore_command"))
    results: list[Result] = []
    try:
        for i, check in enumerate(checks, 1):
            print(f"[{i}/{len(checks)}] {check['name']} ... ", end="", flush=True)
            try:
                res = audit_check(check, tree, timeout)
            except RuntimeError as exc:
                tree.restore()
                print("ERROR")
                print(f"  {exc}", file=sys.stderr)
                return 2
            results.append(res)
            print(f"{res.verdict} after {res.attempts}")
            for line in res.log[-2:]:
                print(f"      {line}")
    finally:
        if not tree.restore():
            print("\n!! THE TREE COULD NOT BE FULLY RESTORED — inspect before committing",
                  file=sys.stderr)
            return 2

    tally = {v: sum(1 for r in results if r.verdict == v) for v in
             (ALIVE, UNPROVEN, DEAD, NO_SUBJECT, STALE, ERROR)}
    print("\n-- results --")
    print(f"  examined      {len(results)}")
    for verdict, count in tally.items():
        if count:
            print(f"  {verdict.lower():<13} {count}")

    for res in results:
        if res.verdict in (DEAD, UNPROVEN, NO_SUBJECT, STALE, ERROR):
            print(f"\n  {res.verdict}  {res.name}")
            if res.detail:
                print(f"      {res.detail}")
            for line in res.log[-3:]:
                print(f"      {line}")

    if args.json_out:
        Path(args.json_out).write_text(
            json.dumps([r.as_dict() for r in results], indent=2), encoding="utf-8"
        )

    if not results:
        print("\nZERO EXAMINED — that is a failure.")
        return 2
    if tally[DEAD] or tally[ERROR]:
        print(f"\nAUDIT FAILED — {tally[DEAD]} dead, {tally[ERROR]} unrunnable.")
        return 1
    if tally[UNPROVEN] or tally[NO_SUBJECT] or tally[STALE]:
        print(f"\nAUDIT INCOMPLETE — {tally[UNPROVEN] + tally[NO_SUBJECT] + tally[STALE]} "
              "check(s) not proven either way. Aim a planned damage at each.")
        return 1
    print(f"\nAUDIT PASSED — all {len(results)} examined checks noticed their damage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
