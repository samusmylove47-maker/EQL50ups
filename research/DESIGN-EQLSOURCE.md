# Visual language: matching eqlsource.com

**Read off eqlsource.com's own stylesheet on 2026-08-17**, after the site became
reachable from this container. Everything below is measured. The earlier version of this
document was transcribed by eye from a single screenshot and got almost every specific
value wrong; what it got wrong, and why, is recorded at the end because the failures are
more instructive than the numbers.

Source: `https://eqlsource.com/assets/site.css`.

---

## Type

Four faces, one job each.

| Role | Face | Where |
|---|---|---|
| display | **Cinzel** 500/600/700 | wordmark, `h1.display`, `h2.sec` — the top two levels only |
| heading | **Saira Condensed** 600/700 | display below those: card titles, panel headings |
| data | **IBM Plex Mono** 400/500/600 | nav, eyebrows, labels, tags, numerals |
| prose | **Public Sans** 400/600 | running text |

Their own note on Cinzel: *"an inscriptional Roman capital — the letterform of things
carved."* It replaces Saira Condensed at the top two levels only.

Stacks as declared: `"Cinzel",Georgia,serif` · `"Saira Condensed",sans-serif` ·
`"IBM Plex Mono",monospace` · `"Public Sans",system-ui,-apple-system,sans-serif`.

---

## Colour

### Surfaces — three levels, and only three

| Token | Value | Role |
|---|---|---|
| `--surface-0` | `#0B0704` | the page |
| `--surface-1` | `#191309` | a panel resting on it |
| `--surface-2` | `#282013` | a panel lifted off it — hover, input wells, table heads |

**These are measured, not chosen.** Their build reads the DXT1 endpoint colours out of
every zone texture in the game's own `.s3d` archives; Norrath's grounds come back at hue
15–30 — a warm umber-black — across 2.6 million samples, and 62% of all saturated colour
in the game art is warm. Their comment: the site had been a cool slate, *"the wrong
temperature, provably, and that is most of why it read as a developer tool rather than as
a reference for this game."*

### Rules

| Token | Value | Contrast vs page |
|---|---|---|
| `--rule` | `#544833` | 2.25:1 |
| `--rule2` | `#6B5C46` | 3.10:1 — the WCAG 1.4.11 bar for a boundary that carries meaning |

An audit on their side found their entire structural vocabulary living in a 1.04–1.31:1
band, with `--rule` appearing 48 times without ever reaching a reader's eye: *"A page whose
every boundary is mathematically invisible reads as a wall of text no matter how good the
palette is."*

### Text ramp — every step clears AA on the darkest surface it is drawn on

`--bone #F2EADA` · `--txt #DFD6C4` · `--mut #B5AA95` · `--dim #9A8F7C` · `--faint #978C7C`

### Signal

`--ok #5FA37E` · `--warn #C9453A` / `--warn-t #D46C64` · `--ember #C4482E` /
`--ember-t #D76C55` · `--instr #7FB2C7` · `--brass #C9922E` / `--brass-t #D9A63F`.

The `-t` suffix is worth stealing outright: the plain token is for rules, borders and bars;
the `-t` variant is the same hue lifted to 4.5:1 for text. Ten zone accents `--z01`–`--z10`
sit outside this system.

---

## Scale

- **Type**: 10 / 11.5 / 13.5 / 15.5 / 18.5 / 22 / 29 / 42px, plus `clamp()` steps for
  lede, h2, h1 and hero.
- **Space**: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px.
- **Radius**: `--r: 4px`. One value, everywhere.
- **Tracking**: `.16em` / `.2em` / `.24em` for uppercase, `-.018em` tight.
- **Measure**: 66ch, 78ch wide. Shell `--max: 1240px`.
- **Line height**: `.9` / `1.05` / `1.3` / `1.6`.

---

## The card, which is the device worth copying

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--rule);
  border-top: 2px solid var(--c, var(--rule2));   /* the standing accent */
  border-radius: var(--r);
  box-shadow: var(--shadow-1);
  padding: 20px 21px 18px;
}
.card:hover { background: var(--surface-2); transform: translateY(-2px); }
```

`--c` is set per card and defaults to `--rule2`, so an unattributed card still has a top
edge. The eyebrow is tinted from the same variable but **blended toward `--bone`** —
`color-mix(in srgb, var(--c, var(--dim)) 68%, var(--bone))` — because, in their words, the
accent *"is chosen as a chrome accent, not a text colour, and several fall short of 4.5:1
at this size."*

Their tier chip is separate: mono, uppercase, `border: 1px solid currentColor`, with a 5px
square `::before` in the same colour.

---

## What the eyeballed version got wrong

Recorded because this project's whole discipline is that an inference is not evidence, and
a screenshot read by eye is an inference.

- **All four typefaces.** Playfair Display for Cinzel is the instructive miss: right
  category — a high-contrast serif — but Playfair is a Didone, a printer's face from the
  age of steel nibs, where Cinzel is carved Roman capital. Also Oswald for Saira Condensed,
  Lato for Public Sans, JetBrains Mono for IBM Plex Mono.
- **The rules, badly.** Guessed `#2a2622`, which measured **1.33:1** — within a whisker of
  the 1.31:1 they had already audited and fixed as invisible. The same bug was reproduced
  independently, on a screen far denser with tables than theirs.
- **The surfaces**, each about a step too cool and too dark.
- **The radius**: "≤2px" against their actual 4px.
- **The eyebrow**: assumed neutral, actually blended from the accent toward bone.
