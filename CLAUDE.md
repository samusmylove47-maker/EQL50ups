# CLAUDE.md — orientation for a session working this repository

Read this first, then the two documents in §2. Everything here is meant to save a session
from rediscovering something the hard way; nothing here is duplicated from elsewhere,
because a second copy of a fact is a second thing to go stale.

---

## 1. What this is

**EQL Source 50 Upgrades** — a gear planner for EverQuest Legends trios. It ranks every
one of 23 slots by what an upgrade actually gains, at any tier from +0 to +10, with the
source tier of every number visible on screen. No account, no server: sets live in the
browser and travel as links.

It is one of three flagship tools of **eqlsource.com**, alongside Sky Ledger and a
forthcoming overlay. It is not a standalone site. It ships its own copy of that site's
chrome so that a reader crossing into it goes one level deeper rather than leaving.

---

## 2. The documents that govern the work

Read both before changing anything that puts a number on screen.

| File | What it governs |
|---|---|
| `research/SOURCING-STANDARD.md` | The tier hierarchy, and the seven rules every shipped number obeys. This is the constitution. |
| `research/DESIGN-EQLSOURCE.md` | The visual language, measured off the live site's own stylesheet rather than guessed. |
| `HANDOFF.md` | The exchange with the Director, and — in its *Standing* section — every working rule and applied ruling currently in force. |
| `research/PATCH-DAY.md` | What to run when the game patches and new loot arrives. |

`HANDOFF.md` is the live one. If this file and it ever disagree, it wins.

---

## 3. Layout

```
pipeline/        build.mjs -> web/public/data/**   (the payload the app loads)
                 verify.mjs      asserts the payload's invariants; the gate
                 contamination.mjs  self-audit; run by build.mjs, not separately
                 refresh.mjs     re-fetch and diff the upstream datasets
research/        sources, validation captures, standards, patch-day runbook
web/             React + TypeScript + Vite
web/public/data/ generated — one writer, one pipeline run, never hand-edited
```

---

## 4. Commands

```
node pipeline/build.mjs && node pipeline/verify.mjs     # payload + gate
cd web && npx tsc --noEmit && npx vitest run            # types + units
cd web && npm run build                                 # bundle
cd web && npx playwright test                           # browser suite
```

CI runs `tsc`, `vitest` and `npm run build` only. **It does not run the pipeline** — it
ships the committed `web/public/data/`. So a payload regenerated locally must be committed,
and a payload that was never regenerated will deploy exactly as it sits.

---

## 5. Environment and toolchain

### No headless browser here reaches an external host. Only `curl` does.

This is a structural fact about how this project is built, not a transient outage, and it
has now cost three separate sessions an hour each — this one, the session working the
website, and the Director. Record consulted before you spend the fourth.

Chromium returns `net::ERR_CONNECTION_RESET` for **every** external origin, including our
own live deploy on `github.io` and including `eqlsource.com`. It fails identically with
`proxy: { server: process.env.HTTPS_PROXY }` passed explicitly. `curl` works, because it
trusts the proxy's CA bundle at `/root/.ccr/ca-bundle.crt`; Chromium does not, and the
failure surfaces as a connection reset rather than as a certificate error, which is what
makes it look like a network problem worth retrying. It is not. Do not retry it, and **do
not disable TLS verification to force it** — that is prohibited, and it would trade a
known limitation for an unknown one.

**What this means in practice:**

- **Geometry and type are checkable. The network hop is not.** Anything you need to know
  about layout, fonts, contrast, clipping or overflow can be measured in a local browser
  against a local build. Anything about redirects, headers, caching or a real cross-origin
  navigation must be measured with `curl`, reading `%{http_code}`.
- **The mirror is the accepted substitute** for a journey that crosses origins. Fetch the
  far side with `curl`, serve it beside a local build of this app, rewrite its asset and
  outbound links to the local copies, and substitute this repository's self-hosted faces
  for any webfont link — the browser cannot fetch those either, and without the swap you
  will be comparing type that is not the type either side ships. Then walk it. State the
  substitution when you report; the geometry is real, the hop is simulated.
- **Verifying a deploy** is a `curl` job: poll the `etag` until it moves off the value you
  recorded before pushing, then read the bundle and the payload directly. Never assert a
  deploy landed because a suite passed.

### Other environment facts

- Chromium lives at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
  `playwright.config.ts` already points at it. Never run `playwright install`.
- Vite's `base` comes from `VITE_BASE`, and `deploy.yml` sets it to the repository name so
  Pages serves the app from a subdirectory. Build and preview with it set before any push
  that touches rendering — `public/` is copied verbatim, so a root-absolute URL in a static
  file there survives into the build and resolves against the origin instead of the base.
- Fonts are self-hosted under `web/public/fonts/`. They must stay self-hosted: loading them
  from a third party once cost 12.9 seconds to first paint on a network that could not
  reach it, because a render-blocking stylesheet waits for the socket to give up.

---

## 6. Working rules

They live in `HANDOFF.md` → *Standing*, because they are the Director's and they change.
Read them there rather than trusting a copy here. The short version: one push at a time,
verify against the live deploy, grep the bundle rather than the shell, fan out reading and
never writing, and report with the command that produced every number.

---

## 7. The habit this repository is built around

Every serious defect found here has been the same one: **a number that was typed where it
could have been computed.** A licence assumed rather than checked. A tier ladder
transcribed by hand. A clamp comparison read off someone else's stylesheet by eye. A
self-audit that asserted its own verdict instead of measuring it. A test count in a README.

The rule that follows is short, and it applies to prose, comments, commit messages and
reports to the Director exactly as much as to code:

> **Compute it, or check it, or don't print it.**

When a comment states a measurement, it should name the command that produces it. When a
report gives a figure, it should say where the figure came from. When something cannot be
verified from here — see §5 — say so plainly rather than reporting the nearest thing you
could measure as though it were the thing asked for.
