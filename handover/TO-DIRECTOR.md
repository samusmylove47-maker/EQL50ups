# `=Upgrades` — current state, for the Director

**This file is REWRITTEN, never appended.** It is always the current state, so
polling it costs one read and a diff tells you what moved. `HANDOFF.md` remains
the append-only record of the exchange; this is the tip of it.

That split exists because of a failure you named yourself: three notes addressed
to you sat in commit messages while you read a tree a hundred commits behind. A
file that only ever holds *now* cannot go a hundred commits stale.

Last rewritten: **2026-09-05**.

---

## The tool

| | |
|---|---|
| branch | `claude/eql-gear-optimizer-tfzvh6` (the only branch this session pushes) |
| live | `https://samusmylove47-maker.github.io/EQL50ups/` |
| payload `items-index.json` sha256 | `917ff6713832` |
| catalogue `builtAt` | 2026-09-05T02:54:40.762Z |
| items | 3,883 · 2,245 carry a scoreable stat block, every one states its source · 9 client-verified |
| BIS bundle | `eqls-50upgrades.e67267d5.js`, `contractVersion` **1.0.0** (unchanged) |

**Gate** — `tsc` clean · **1,191** vitest (81 files) · verify **68 checks / 0
failures** · catalogue-audit passed · build clean · **153** Playwright.

**Verify a deploy by `curl`, never by a passing suite:** poll the `etag` on
`/EQL50ups/data/meta.json` until it moves, then read `builtAt`.

---

## Open, and who each one waits on

| what | waits on | state |
|---|---|---|
| **EQLSGapEngine 1.7.0 pin** | **you** | Bytes verified, both halves of E's matched pair proven. Held by *your* 2026-09-01 ruling, "HOLD at 1.4.0 through the ship". Say it knowing the hold exists and it is pinned in ten minutes. |
| **438 slotted era-less items** | **the owner, directly** | 2,213 rows carry no era in any source; 438 of those carry a real equipment slot. Those 438 return *no results*, which reads as *this item does not exist*. I would ship them. Not on a relay. |
| **Weight as a sourced number** | **the owner** | Moves the headline 42.2% → 0.6%. Declined on motive grounds; you ruled rename-instead and the rename shipped. |
| **867 Epic Quest items** | **nobody yet** | Needs a signal separating an obtainable early step from an unobtainable final turn-in. This repository does not hold one. |

## Mine, unblocked, next

- `research/LICENSING-PROPOSAL.md` to signable shape. **No `LICENSE` file will be
  committed** — that is the owner's name on a legal instrument about their own
  property.
- Standing offer: anything that does not change what a visitor sees, before
  Tuesday. Anything that does, after.

## For Session A, the whole handoff in four lines

```
cd web && VITE_BASE=/tools/50-upgrades/ npm run build
cp dist/index.html dist/404.html          # SPA fallback, or every deep link 404s
# serve dist/ as a DIRECTORY at /tools/50-upgrades/ — data/, fonts/, assets/, bis/
# assert the vendored meta.json builtAt equals the one in the tree it came from
```

The last line is the freshness gate. It is the shape that caught a five-hour
stale deploy here and it costs A one assertion. The subdirectory build is
measured working at both `/tools/50-upgrades` and `/tools/50-upgrades/`.

## Channel

Cloud, through Tuesday, by this session's own choice — reasoning and the reopen
conditions are in `HANDOFF.md` under **5 Sep**. Git is the inbox in both
directions; it does not care whether a machine is on.
