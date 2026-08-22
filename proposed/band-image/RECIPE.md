# The 50 Upgrades band image

**For Session A. A recipe, not an asset — and section 5 says why shipping an
asset would have been the wrong deliverable.** Written 2026-08-22.

> **The subject changed under us while this was being designed, and the change
> has shipped.** The brief said "the ranked upgrade list with its per-row source
> badges". That screen had no per-row stat-standing badge: `sourceStanding` was
> imported by `ItemWindow`, `PlanarGear` and `Sources`, and not by `Upgrades`.
> The proposal described a screen this project does not draw — which is the
> fault it keeps catching in other people's work.
>
> It was a real gap, older than the image and independent of it: the row named
> the item's *existence* evidence and said nothing about where its *stats* came
> from, while `SOURCING-STANDARD.md` rule 5 says a reader looking at a number is
> entitled to know. The EP is the number that screen exists to give. The chip
> now ships (`.upg-standing`, band and wording from the shared `sourceStanding`),
> so the recipe below describes a screen that exists.

---

# 50 Upgrades band — image recipe

## 0. One thing to flag first
**The Upgrades screen ships no per-row stat-standing badge.** `sourceStanding` is imported by `ItemWindow.tsx`, `PlanarGear.tsx`, `Sources.tsx` — not by `Upgrades.tsx` or `ItemPicker.tsx`. `.tier.t5` exists (`web/src/styles.css:4168`) but is bound only to the haste caveat. So a `TIER 5` chip on a candidate row depicts UI we do not draw. Land `StandingChip` (`web/src/screens/PlanarGear.tsx:167`) on the candidate line first, or the band is a claim about a screen that doesn't exist. `TIER M · SEEN DROPPING IN GAME` **is** real on this surface (`Upgrades.tsx:782`).

## 1. Slot and candidates
**Chest**, Avenrae WAR/BRD/BER 50, real `/outputfile inventory` import, Chest baseline set to `Brigandine Tunic +6` so every delta is a gain. All figures read off the running app (`vite preview :4399`, picker `94 matches`):

| # | Candidate | EP @+6 | vs worn | stats | existence |
|---|---|---|---|---|---|
| 1 | Indicolite Breastplate | 92.0 | **+53.5** | **tier-5** | measured-drop, 9 sightings / 4 mobs |
| 2 | Ethereal Mist Chestplate | 84.0 | +45.5 | tier-2 | measured-drop, 2 sightings |
| 3 | Lustrous Russet Breastplate | 77.0 | +38.5 | tier-2 | measured-drop, 3 sightings |
| 4 | Valorium Chestplate | 73.0 | +34.5 | **tier-5** | measured-drop, 2 sightings |

Worn: `Brigandine Tunic +6` = 38.5 EP. Row 1 carries **both** marks — Tier M existence, Tier 5 numbers — which is the argument.

## 2. Frame, top to bottom
1. 1px `--line` box on `--bg-panel`; **no** top accent (mixed standings).
2. Eyebrow 10px mono `--text-dim`: `CHEST · 94 CANDIDATES · RANKED BY EP, CAP-AWARE`
3. Baseline 11px mono `--text-faint`: `WEARING BRIGANDINE TUNIC +6 · 38.5 EP`
4. Four rows. Each: 2px left rule in its standing colour; name 13px Public Sans `--text-strong` + gold `+6` chip; below it the standing chip (10px mono — `--source-trusted-t` / `-corroborating-t` / `-distrust-t`) and `9 SIGHTINGS / 4 MOBS` in `--text-faint`; right column EP 13px mono, delta 20px mono 800 `--gain`.
5. Footer 10px mono: `A COUNT, NEVER A RATE · PARSED COMBAT LOGS, 12–16 AUG 2026`

## 3. Dimensions and crop
Author **1:1 with the 390px viewport** and only ever scale up. `--gut` clamps to 18px there, so content width is **354px** (measured). `viewBox="0 0 354 246"`, `width:100%`.
Row height **44px** (name 20 + badge 16 + 8). Type sizes are the app's own at 390px, measured: name 13, delta 20, sub 11, chips 10. Right column 78px (`.upg-gainvalue` measures 72px wide); names get 244px — the generator must **fail the build** on overrun, never truncate.
Crop: drop from the bottom. 4 rows at 246px, 3 at 202px, 2 at 158px. Rows 1–2 must always survive. Below 2 rows, don't use it.
Do **not** screenshot the real mobile layout: `.upg-main` stacks to **237px** at 390px and a whole row is 376–740px.

## 4. Must not show
Any rate, percentage or drop chance. The paper doll. `Equip`/`Open` buttons. Browser chrome or cursor. Tier 1/3/4 (absent from this catalogue by design). `--item-caution` amber. Green/red usability tint on names — `.results` re-points `--item-usable` to `--text-strong` (`styles.css:934`). A light theme. Any invented mob, zone, date or item.

## 5. The hard constraint — recommendation
**Generate the band as inline SVG at build time, from `web/public/data/`, through the app's own engine.** SVG keeps every figure as a `<text>` node, so our checks *can* read it; a PNG hides them.

Cost, plainly: the generator must import `rankSlotItems`/`scoreItem` rather than re-derive EP (a second EP implementation is exactly the defect class CLAUDE.md §7 names) — new coupling, new caller to keep compiling. CI does not run the pipeline (§4), so the guard is a **vitest unit**: recompute the four rows from the payload and assert the committed SVG's text nodes match. And it must be *inlined*, not `<img src>` — an `<img>` won't load the self-hosted faces.

Rejected: PNG + sidecar JSON (nothing ties sidecar to pixels; CI can't re-render). Shape without figures (cheapest, never stale — but the band's whole claim is that a *sourced number* reaches the screen).

## Screenshots
- `/tmp/claude-0/-home-user-EQL50ups/b71726cd-1814-503f-880d-c245d5982023/scratchpad/band/row-chest-1440.png` — the Chest row, the subject
- `.../band/row-measured-1440.png` — Tier M card at desktop
- `.../band/picker-chest-1440.png` — one slot's candidates with the delta column
- `.../band/row-01-390.png`, `.../band/upgrades-390-full.png` — why 390px can't be screenshotted
- `.../band/upgrades-1440-imported.png`, `.../band/upgrades-1440-full.png`, `.../band/row-01-1440.png`, `.../band/row-measured-390.png`, `.../band/picker-primary-1440.png`