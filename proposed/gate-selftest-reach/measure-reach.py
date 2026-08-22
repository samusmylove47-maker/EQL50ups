#!/usr/bin/env python3
"""
Measure the REACH of eql-source's gate_selftest.py, rather than counting its cases.

"19 hand-written cases" is a count of cases. Reach is a different quantity: how
many of gate.py's assertions does running that harness actually make fire?

The method is the same rule this project keeps relearning — prove the experiment
touched the subject. `check.py` passes its own `fail`/`warn` into `gate.run`, so
wrapping those two functions and recording the CALLER's line number inside
gate.py says exactly which assertions fired, with no guessing and no reading.

Everything happens in a scratch copy. The real repository is never written to.

    python3 measure-reach.py <scratch-repo> [--fixed]
"""
import ast
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(sys.argv[1]).resolve()
GATE = ROOT / "scripts" / "gate.py"
CHECK = ROOT / "scripts" / "check.py"
HITS = pathlib.Path("/tmp/reach-hits.jsonl")
SHIM = "/tmp/claude-0/-home-user-EQL50ups/b71726cd-1814-503f-880d-c245d5982023/scratchpad/shim"


def assertion_sites() -> dict[int, dict]:
    """Every `fail(...)` / `warn(...)` call site in gate.py, by line number.

    Parsed rather than grepped: a grep counts the string, and what is wanted is
    the call. The two agree here (35 + 7) but only one of them would keep
    agreeing after somebody writes the word `fail(` in a docstring.
    """
    tree = ast.parse(GATE.read_text(encoding="utf-8"))
    lines = GATE.read_text(encoding="utf-8").splitlines()
    sites = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        fn = node.func
        name = fn.id if isinstance(fn, ast.Name) else None
        if name not in ("fail", "warn"):
            continue
        sites[node.lineno] = {
            "line": node.lineno,
            "severity": name,
            "source": lines[node.lineno - 1].strip()[:120],
        }
    return sites


INSTRUMENT = '''
# --- reach instrumentation, injected for measurement only -------------------
import inspect as _inspect, json as _json, os as _os
_REACH = _os.environ.get("REACH_HITS")


def _record(kind):
    if not _REACH:
        return
    frame = _inspect.currentframe().f_back.f_back
    path = frame.f_code.co_filename
    if not path.endswith("gate.py"):
        return
    with open(_REACH, "a", encoding="utf-8") as handle:
        handle.write(_json.dumps({"line": frame.f_lineno, "kind": kind}) + "\\n")


def fail(m):
    _record("fail")
    fails.append(m)


def warn(m):
    _record("warn")
    warns.append(m)
# --- end instrumentation -----------------------------------------------------
'''


def instrument():
    text = CHECK.read_text(encoding="utf-8")
    original = "def fail(m): fails.append(m)\ndef warn(m): warns.append(m)"
    if original not in text:
        sys.exit("check.py's fail/warn definitions are not where this expected them")
    CHECK.write_text(text.replace(original, INSTRUMENT, 1), encoding="utf-8")


def run_selftest():
    env = dict(os.environ)
    env["REACH_HITS"] = str(HITS)
    env["PATH"] = SHIM + ":" + env.get("PATH", "")
    proc = subprocess.run([sys.executable, "scripts/gate_selftest.py"],
                          cwd=ROOT, capture_output=True, text=True, env=env, timeout=3600)
    return proc


def main():
    HITS.unlink(missing_ok=True)
    sites = assertion_sites()
    instrument()
    proc = run_selftest()

    hit_lines = set()
    if HITS.exists():
        for raw in HITS.read_text(encoding="utf-8").splitlines():
            hit_lines.add(json.loads(raw)["line"])

    reached = {ln: s for ln, s in sites.items() if ln in hit_lines}
    missed = {ln: s for ln, s in sites.items() if ln not in hit_lines}

    by_sev = lambda d, s: sum(1 for v in d.values() if v["severity"] == s)
    total_fail, total_warn = by_sev(sites, "fail"), by_sev(sites, "warn")

    print(f"gate.py assertion call sites : {len(sites)}  ({total_fail} fail, {total_warn} warn)")
    print(f"selftest exit                : {proc.returncode}")
    print(f"cases in the table           : "
          f"{len(re.findall(r'^    [(]', (ROOT / 'scripts/gate_selftest.py').read_text(), re.M))}")
    print()
    print(f"REACHED by the harness       : {len(reached)}"
          f"  ({by_sev(reached,'fail')} fail, {by_sev(reached,'warn')} warn)")
    print(f"NOT reached                  : {len(missed)}"
          f"  ({by_sev(missed,'fail')} fail, {by_sev(missed,'warn')} warn)")
    print(f"reach                        : {len(reached)}/{len(sites)}"
          f" = {100 * len(reached) / len(sites):.1f}%")
    print()
    print("-- assertions the harness never makes fire --")
    for ln in sorted(missed):
        s = missed[ln]
        print(f"  L{ln:<5} {s['severity']:<5} {s['source']}")

    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/reach.json")
    out.write_text(json.dumps({
        "sites": len(sites), "fail": total_fail, "warn": total_warn,
        "reached": sorted(reached), "missed": sorted(missed),
        "reached_fail": by_sev(reached, "fail"), "reached_warn": by_sev(reached, "warn"),
        "selftest_exit": proc.returncode,
        "selftest_tail": proc.stdout[-1500:],
    }, indent=2))
    print(f"\nwritten: {out}")


main()
