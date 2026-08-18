# Patch day

**Written to be read at speed, possibly tired, possibly at 2am.** Sections 01–04 are the
whole job. Everything after 05 is for when something looks wrong.

The game patches. A dungeon is revamped. Items drop that no wiki has a page for. The whole
point of the path below is that **shipping a brand-new item is not a code change**.

---

## 00 The one-minute version

```bash
cd /path/to/EQL50ups

node pipeline/refresh.mjs                       # 1. what changed upstream? writes nothing
node pipeline/refresh.mjs --apply               # 2. vendor it
node pipeline/build.mjs && node pipeline/verify.mjs   # 3. rebuild, and check it
cd web && npx tsc --noEmit && npx vitest run && npm run build
```

Step 1 is read-only and safe to run at any time, including before you have decided anything.
If step 3 or 4 fails, **nothing has shipped** — the payload is on disk and not deployed, so
you can stop and read.

---

## 01 First, look. Do not apply yet.

```bash
node pipeline/refresh.mjs
```

This fetches all four datasets from `https://eqlsource.com/data/`, compares them against
what is vendored in `pipeline/sources/eqlsource/`, and prints a report. **It writes
nothing.** Read it in this order:

| Section | What you are looking for |
|---|---|
| **01 What was fetched** | Did all four come back? Did any `hash` or `version` move? |
| **02 Items** | New names, and — much more important — any **ID that changed**. |
| **03 Sightings** | New items measured dropping, new mobs, new zones, counts that moved. |
| **04 Zones** | A **NEW ZONE** line, and coverage facets that changed grade. |
| **05 Sky** | Vendored and diffed. Nothing reads it yet. |
| **06 What a rebuild would newly admit** | **The one that answers "what does the patch add".** |

Section 06 lists, by name, every item that will ship as an **existence-only record** — an
item the game demonstrably has and that no catalog anywhere describes. That list is the
patch, as far as this planner is concerned.

If the owner handed you files rather than publishing them:

```bash
node pipeline/refresh.mjs --from ~/Downloads/eqlsource-drop
```

Same report, same rules, reading a directory instead of the site.

---

## 02 Apply it

```bash
node pipeline/refresh.mjs --apply
```

Writes the validated files into `pipeline/sources/eqlsource/` and updates
`manifest.json`, which records for each dataset: the publisher's own `hash`, its `version`,
the byte length, our SHA-256 over the exact bytes, and when it was vendored.

**It will refuse** if a file is not the dataset it claims to be, or if a file lost more than
40% of its rows since the vendored copy. That second one is a guard, not a rule — a real
upstream restructure will trip it. Read the number it prints, and if it is expected:

```bash
node pipeline/refresh.mjs --apply --force
```

`--force` overrides the shrink guard. It does **not** override a validation failure, and
there is no flag that does.

---

## 03 Rebuild

```bash
node pipeline/build.mjs && node pipeline/verify.mjs
```

In the build report, read these three blocks:

- **`-- Tier M existence with no catalog record (admitted automatically) --`**
  Every new item, with the evidence class that admitted it (`measured-drop`, `live-export`,
  `eqlsource-id`). This should match section 06 of the refresh report, item for item.
- **`resolved to an existing record instead of admitted`**
  Names upstream spells differently from the catalog — `Executioner's Axe` is the catalog's
  `An Executioners Axe`, and both are #5407. No new record; the evidence is attached to the
  existing one. If a genuinely new item appears in this list, see 07.
- **`-- zone surveys behind measured drops --`**
  Every surveyed zone, its survey grade, and — last line — the zones a session names that
  no survey covers.

`verify.mjs` must end **`VERIFY PASSED`**. It re-derives everything from the shipped payload
and the source files rather than trusting the build, so a passing verify is a real check and
not a restatement.

---

## 04 Check the app, then ship

```bash
cd web && npx tsc --noEmit && npx vitest run && npm run build
```

Some unit tests assert **exact** catalog counts — that is deliberate, they are there to make
a silent drift impossible. A patch will break them, and the fix is to update the number and
say why in the comment beside it. `src/data/source-standing.test.ts` and
`src/data/patch-day.test.ts` are the two that pin counts.

**Never** change an assertion to make a test pass without knowing which fact moved.

---

## 05 What a new item looks like when it lands

Say `Mistmoore Cudgel` drops tomorrow and no wiki has heard of it. After the four commands
it is in the catalog as:

```json
{
  "id": 900001,
  "n": "Mistmoore Cudgel",
  "av": true,
  "eraUnknown": true,
  "statsUnknown": true,
  "xo": true,
  "ex": "measured-drop",
  "sd": "unattributed",
  "evidence": "Confirmed to exist: measured dropping from Mayong Mistmoore in EQL Source's
               parsed combat logs (data/sightings.v1.json v1.0.0, hash …), seen 2 time(s).
               No catalog record exists for it in any wiki source, so its stats, slot,
               class and era are all unknown — stated as unknown rather than guessed."
}
```

**No slot. No class. No era. No stats.** That is not an oversight, it is the whole design:

- `statsUnknown` means *nothing measured this*, which is different from an item that
  genuinely has no stats. It is never ranked, never scored, never auto-filled, and never
  shown as a row of zeroes beside items whose zeroes were actually measured.
- `xo` means *nothing describes this at all*. The name of a cudgel makes its slot obvious.
  Obvious is not observed, and this pipeline has been wrong before by treating one as the
  other.
- `evidence` names the file the proof is in, with the dataset version and hash, so a reader
  can go and check.

**When the stats arrive** — from the owner's client window, or from a wiki page appearing
upstream — the item stops being existence-only on its own. A wiki page makes it an ordinary
catalog record; a client-verified stat block goes in `TIER0_STATS_VERIFIED` in
`pipeline/build.mjs`, which is checked field-for-field against what ships.

---

## 06 A number looks wrong

**Work out which of the two facts is wrong before touching anything.** They are separate on
purpose:

| Field | Question | Where it comes from |
|---|---|---|
| `ex` | Is this item in the game? | the export, the ID table, a measured drop |
| `sd` | Where did the numbers on this row come from? | the wiki scrape, the era gate, a client capture |

Then:

**"This item should not exist."** Check its `evidence` string. If it names
`sightings.v1.json`, a log said the game produced it — that outranks every wiki page and it
stays. If you believe the log is wrong, that is a conversation with upstream, not a local
edit.

**"This item's stats are wrong."** Look at `sd`. `tier-5` means the wiki numbers could not be
placed in this game and the app already marks them distrusted. `tier-2` means the era placed
them. `tier-M` means a client window confirmed them field for field, and if that one is
wrong the entry in `TIER0_STATS_VERIFIED` is wrong — fix it there and the build will fail
loudly if the catalog then disagrees.

**"This item is ranked and it should not be."** It is missing `statsUnknown`. Anything with
that marker is refused by `rankSlotItems` in `web/src/selectors/gear.ts`, which every
surface goes through.

**"The drop count looks too low."** It is a **count, never a rate.** A drop seen once is
seen once. A dry streak is a ceiling, not a zero. Nothing in this repository divides `seen`
by anything, and nothing should start.

**"The zone says partial and I know that zone."** `survey` is derived from the coverage
facets and is never hand-set. `verify_level` is a *sourcing hygiene* check — the publisher's
own note is that "verified means checked against source; it does not mean complete." A zone
can be fully verified and still only partly surveyed. That is the state the badge exists to
show.

**"Two rows for one item."** The catalog got both spellings. Check the build report's
`resolved to an existing record` block: if the name is not in it, the alias rule did not
match. Nothing is auto-merged — see 07.

---

## 07 When to stop and ask

Stop, do not apply, and raise it:

- **An item ID changed.** The ID is the join key across the `+N` tiers and the
  `(Exaltation)` form. An ID moving means either a re-issued item or a bad read upstream,
  and both need a human.
- **Sightings disappeared.** Measured evidence does not normally get withdrawn.
- **The published `hash` is unchanged but the bytes differ.** Something between the
  publisher and here rewrote the file.
- **The version moved (`v1` → `v2`).** Upstream's own rule is that a breaking change gets a
  new URL and the old one stays up. The refresh script still points at the v1 URLs, so a
  version bump on the same URL is not what upstream said it would do.
- **A build-report line starts with `!!`.** They are all rare and all mean a human should
  look.

---

## 08 Rolling back

Nothing here deploys on its own. To go back to the last good state:

1. Restore the four files under `pipeline/sources/eqlsource/` from git.
2. `node pipeline/build.mjs && node pipeline/verify.mjs`.
3. `node pipeline/refresh.mjs` to confirm the manifest and the files agree again.

`manifest.json` records our SHA-256 of each vendored file, and `refresh.mjs` prints
**`VENDORED FILES DIFFER FROM THE MANIFEST`** when one has been edited since. That warning
is how you find out a file on disk is not the file upstream published — which is also
exactly what it says during a deliberate simulation, so it is information, not an alarm.

---

## 09 The commands, once more

```bash
node pipeline/refresh.mjs                     # look
node pipeline/refresh.mjs --from DIR          # look, at a directory the owner sent
node pipeline/refresh.mjs --check             # exit 1 if anything upstream moved (for cron)
node pipeline/refresh.mjs --json              # the same diff, machine-readable
node pipeline/refresh.mjs --only zones        # one dataset
node pipeline/refresh.mjs --apply             # vendor it
node pipeline/refresh.mjs --apply --force     # ... past the shrink guard, knowingly

node pipeline/build.mjs                       # rebuild web/public/data/
node pipeline/verify.mjs                      # 55 checks, re-derived from the payload
node pipeline/contamination.mjs               # rebuild the contamination scan

cd web && npx tsc --noEmit && npx vitest run && npm run build
cd web && npx playwright test                 # browser checks
```
