# Visual language: matching eqlsource.com

Transcribed from a screenshot of `eqlsource.com/sources` supplied by the owner on
2026-08-17. This project will eventually be absorbed into that site, so it should already
look like it belongs there.

I have **not** been able to load the site itself — this container's egress proxy refuses
`eqlsource.com` — so everything below is read off one full-page screenshot of a single
page. Colours are eyeballed from that image and are starting values, not sampled truth.
Anything marked *(unverified)* needs a second look once more of the site is visible.

---

## The character of it

Editorial, not gamer. Dark, warm, and quiet, with a magazine's sense of hierarchy: a
high-contrast display serif for section titles, a heavy condensed sans for card headings,
monospace for labels and navigation, and a humanist sans for reading text. Generous
whitespace, wide gutters, and a strict two-column grid. Nothing glows, nothing gradients,
nothing is rounded more than slightly.

The restraint is the point. It reads like a reference work that expects to be trusted,
which is exactly the claim the sourcing hierarchy makes.

---

## Colour

Everything is warm-shifted — the blacks are brown-black, not blue-black. This is the single
biggest departure from our current palette, which is cool grey.

| Role | Value *(eyeballed)* | Notes |
|---|---|---|
| Page background | `#0a0908` | Near-black, warm |
| Card / panel | `#131110` | Barely lifted off the page |
| Border | `#2a2622` | Warm, low contrast |
| Display + heading text | `#f4eee3` | Warm cream, not white |
| Body text | `#b3aa9d` | Warm grey |
| Emphasis inside body | `#d9d0c2` | Bold runs read brighter, not heavier |
| Muted / eyebrow / nav | `#8a8378` | |

### Tier accents

Each card carries a **2px accent line along its top edge only**, colour-coded by tier
standing. This is the one place colour is allowed to carry meaning.

| Tier | Accent *(eyeballed)* |
|---|---|
| M, 1, 2 — trusted | sage green `#8fae82` |
| 3, 4 — corroborating | steel blue `#7595b8` |
| 5 — marked on sight | brick red `#c1584a` |

The red is used exactly once, for the tier the standard says to distrust. That discipline —
one warning colour, spent deliberately — is worth copying directly.

---

## Type

| Role | Face | Treatment |
|---|---|---|
| Wordmark `EQL SOURCE` | display serif | uppercase, wide tracking |
| Section title `THE HIERARCHY` | display serif, high contrast | uppercase, large, slight tracking |
| Section number `01` | mono | small, muted, sits to the left of the title |
| Nav `DUNGEONS RAIDS TOOLS…` | mono | uppercase, wide tracking, muted |
| Card eyebrow `TIER M · STRONGEST` | mono | uppercase, wide tracking, `·` as separator |
| Card title `OUR OWN COMBAT LOGS` | heavy condensed sans | uppercase, tight, cream |
| Body | humanist sans | ~1.65 line height, generous measure |

Exact families are *(unverified)* — I am reading shapes off a screenshot. The closest
widely-available matches, and what the implementation should target:

- display serif → **Playfair Display** (fallback: `Georgia, 'Times New Roman', serif`)
- condensed sans → **Oswald** 600/700 (fallback: `'Arial Narrow', system-ui, sans-serif`)
- body → **Lato** (fallback: `system-ui, -apple-system, sans-serif`)
- mono → **JetBrains Mono** (fallback: `ui-monospace, 'SF Mono', Menlo, monospace`)

Every one of these needs a real fallback stack that still reads correctly, because I cannot
load a font in this container to check it, and a webfont that fails to arrive must not
collapse the design.

---

## Layout

- Two-column card grid, roughly equal columns, wide gutter (~24px).
- Cards: ~28px internal padding, ~2px radius, 1px border, 2px top accent.
- Section title sits above the grid with its number outdented to the left.
- A closing callout below the grid: left vertical rule, no box, body text with a bold lead-in.
- Nav is centred, wraps to a second line rather than compressing.

---

## What to carry into this project

1. **Rewarm the whole palette.** Our tokens are cool grey; theirs are brown-black and cream.
2. **Adopt the four-role type system** — display serif, condensed sans, humanist sans, mono —
   in place of the current single system-ui stack.
3. **Steal the tier accent bar outright.** We already need to show data provenance per
   `SOURCING-STANDARD.md`, and they have solved exactly that problem: a coloured top edge
   plus a mono eyebrow naming the tier. Our item cards and stat rows should use the same
   vocabulary, so a Tier M number and a Tier 5 number are distinguishable at a glance.
4. **Spend red once.** Reserve it for untrusted or unverified data, nothing else.
5. **Keep it token-driven.** Every value above lives in `web/src/styles/tokens.css` so that
   correcting my eyeballed colours later is a token edit, not a refactor.
