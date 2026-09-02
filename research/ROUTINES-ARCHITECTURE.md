# Scheduled Routines — architecture, verbatim prompts, and what we learned

Written 2026-09-02 at the owner's instruction, immediately **before** deleting the two
EQL Source hourly Routines. Deleting a Routine destroys its stored prompt, so this file
exists so they can be rebuilt exactly rather than reinvented from memory.

> *"I do need for these timers to be removed or disabled for now. Remember their
> architecture though, because I will want reliable timers made again in the future."*

Nothing here is a recommendation to re-arm anything. It is a record.

---

## 1. What existed

| id | name | cron (UTC) | target | created | disposition |
|---|---|---|---|---|---|
| `trig_01HuoXMSw4ceDo5G88eKukHx` | EQLS clock — hourly check-in | `39 * * * *` | **self-bind**: `session_01WnLmGGChzfhnjX592G5iWq` (Session B) | 2026-08-31 06:39Z | **deleted 2026-09-02** |
| `trig_01Ggg5rESVs22cqUHhLHPQpY` | EQLS observation sweep (observe only) | `23 * * * *` | `session_01BMHC1Ax4gtRstMjFS4qn4c` | 2026-08-31 13:59Z | **STILL ARMED** — this session cannot touch it; see §6 |
| `trig_01D9GfBUx7LH7zc79s69PU4e` | Morning briefing — 9 a.m. ET | `0 13 * * *` | fresh session per fire | 2026-07-29 | **left alone** — personal, unrelated to this project |

The clock was `created_via: meta_mcp` — created by an agent through the
`claude-code-remote` MCP server — and so an agent could delete it. The sweep is
`created_via: http_api`, and **that difference is decisive**: see §6. Both ran in
environment `env_01W8HYP1sqEJEkEc6HHybvNZ`.

---

## 2. The two shapes, and when each is right

This is the part worth keeping, because the choice determines everything else.

**Self-bind** (`persistent_session_id` = the session that created it, `persist_session: true`).
The prompt arrives as a new user turn *in an existing conversation*, so the session keeps all
its context. Write the prompt assuming memory — "Hourly clock tick" is enough of a preamble.
The EQLS clock was this shape.

- Good for: a long-running worker that should periodically re-check something and carry on.
- Costs: the session never goes away, and **every firing spends tokens re-reading context even
  when there is nothing to do.** This is exactly why it was deleted — see §5.
- Note: completion notifications are rejected by the server for self-bind Routines. There is no
  "tell me when it finished", because it never finishes.

**Fresh session per fire** (`create_new_session_on_fire: true`).
Each firing starts from nothing. The prompt must be a complete standalone instruction — it
cannot say "as before". The observation sweep and the morning briefing are this shape.

- Good for: a periodic *job* with a defined output, where starting clean is a feature.
- Supports `notifications: {push, email}` so a run that produced something can say so.
- Costs: it re-derives context every time, so the prompt has to carry the orientation.

---

## 3. Design rules these two got right

Learned by running them for ~26 hours, not by reasoning about them.

1. **State that changes belongs in the repo, not in the prompt.** The clock's whole STEP 1 turns
   on `.director-tip`, a file in the working tree holding the last-read sha. The prompt says why
   in so many words: *"a sha hardcoded here goes stale the moment the Director pushes and then
   reports MOVED every tick forever."* A prompt is immutable; the tree is not. Any Routine that
   diffs against "what I saw last time" needs this.

2. **Give the no-op path an explicit instruction, and make it cheap.** Both prompts say, in
   different words, *do nothing and say so in one line* / *"IF NOTHING MOVED: write nothing,
   commit nothing, say 'no change' and stop. This is the correct and expected outcome most of the
   time. Do NOT manufacture an observation, an order, or a finding to justify having run."*
   Without that sentence a scheduled agent will invent work to justify the firing. With it, the
   sweep ran for a day and wrote nothing, correctly.

3. **Name the commands that will fail, and why.** The clock's prompt warns that `git fetch origin`
   cannot reach the Director repo because origin is a different repository; the sweep's warns that
   `SWEEP-LOG.md` lives only on `sweep/observations` so a plain `tail` in a fresh clone exits 1,
   and that the first push may 403 until `add_repo` is called. Each of those was a real failure
   that cost a run before it was written down. **A scheduled prompt is the only documentation a
   fresh session gets.**

4. **Bound the authority explicitly.** The sweep's "WHAT YOU MUST NOT DO" block is the model:
   one sanctioned capability grant, named, for one purpose, with *"Granting yourself access to
   anything else is out of bounds even if it would help."* A scheduled session has no human in the
   loop, so the prompt is the only place a limit can live.

5. **Never read a huge file whole.** Both prompts say so — `HANDOFF.md` is ~11,000 lines and
   `tail -120` or a `log -p | grep` is the instruction. A Routine that reads a growing file in
   full gets more expensive every day until it fails.

---

## 4. Verbatim prompts

Reproduced exactly as stored, so either can be rebuilt with `create_trigger`.

### 4.1 `trig_01HuoXMSw4ceDo5G88eKukHx` — EQLS clock, cron `39 * * * *`, self-bind

```
Hourly clock tick. Working directory /home/user/EQL50ups, branch claude/eql-gear-optimizer-tfzvh6.

STEP 1 — has the Director's record moved?

  LIVE=$(git ls-remote --heads https://github.com/samusmylove47-maker/Director | awk '/refs\/heads\/main/{print $1}')
  SEEN=$(head -1 .director-tip)
  [ "$LIVE" = "$SEEN" ] && echo "unchanged" || echo "MOVED $SEEN -> $LIVE"

`.director-tip` line 1 is the last tip I have READ; it lives in the tree, not in this prompt, because a sha hardcoded here goes stale the moment the Director pushes and then reports MOVED every tick forever. If unchanged: say so in one line and go to STEP 3.

Do NOT use `git fetch origin` for any of this — Director and eql-source are separate repositories from this one (origin here is EQL50ups) and fetching their branches by name against origin fails with "couldn't find remote ref". Both are public; anonymous ls-remote/clone work. Do NOT watch eql-source claude/eq-map-export-proposal-oe8m6l: frozen behind a redirect stub at 1af65a0e, it will never move again.

STEP 2 — only if MOVED. Read the newest commits' added lines (HANDOFF.md is ~11,000 lines; never read the whole file):

  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 40 https://github.com/samusmylove47-maker/Director /tmp/dt 2>/dev/null || git -C /tmp/dt fetch --depth 40 origin main
  git -C /tmp/dt log --oneline <SEEN>..<LIVE>
  git -C /tmp/dt log <SEEN>..<LIVE> -p -- HANDOFF.md | grep '^+' | grep -i "50ups\|50 Upgrades\|\bB\b"

Act on any order addressed to B / 50 Upgrades. Then write the new sha into line 1 of `.director-tip` and commit it alongside whatever the orders produced.

STEP 3 — if the queue is empty, work the top item of my own open list in HANDOFF.md under "## To the Director", declaring intent in a pushed commit BEFORE starting. Push before going idle. If nothing changed and nothing is open, do nothing and say so in one line.

METHOD RULES, learned the hard way today — each cost a published false claim:
- A/B a guard by damaging the source, running the WHOLE suite, then restoring and verifying the restore by SHA-256. Running one test file answers "does my test catch this", not "does this repository catch this".
- `grep -o "thing\.field"` counts MENTIONS and cannot tell a read from a write. To ask whether code READS something, probe the running artifact or read the lines.
- Running someone else's command verbatim is reproduction, not verification. Verify with a different instrument.
- Choose sentinels that cannot occur in prose; "gear" was a false positive against a refusal string.

Standing bound: measurements, gates, deleting unsourced values and proving a guard can fire are mine. New mechanism or feature work needs the Director's ruling. Never merge my own work; the owner merges.
```

### 4.2 `trig_01Ggg5rESVs22cqUHhLHPQpY` — EQLS observation sweep, cron `23 * * * *`

Bound to `session_01BMHC1Ax4gtRstMjFS4qn4c`. Allowed tools as stored:
`preset:default, Task, Bash, Glob, Grep, Read, Edit, MultiEdit, Write, NotebookEdit, WebFetch,
TodoWrite, WebSearch, BashOutput, KillBash, Skill, Monitor, SendUserFile`. MCP connections:
`Claude_Code_Remote`, `Google_Drive`.

```
You are an hourly observation sweep for the EQL Source project. You are a fresh
cloud session with no memory of any prior conversation. You OBSERVE and REPORT.
You do not direct, message, or decide.

READ THE RECORD FIRST — it tells you what was last seen, so you diff against it
rather than against anything hardcoded here:

  git clone https://github.com/samusmylove47-maker/Director /tmp/d && cd /tmp/d
  tail -120 HANDOFF.md
  git fetch -q origin sweep/observations
  git show origin/sweep/observations:SWEEP-LOG.md | tail -40

NOTE: SWEEP-LOG.md exists ONLY on branch sweep/observations, never on main. Read
it with `git show` as above — `tail -40 SWEEP-LOG.md` in a fresh clone fails with
exit 1, because the file is not on the default branch.

(The record moved here on 31 Aug 2026 from eql-source
claude/eq-map-export-proposal-oe8m6l. That branch is frozen and carries a stub.
Do not write to it.)

Then read the current head of each repo and compare:

  eql-source     origin/main
  EQL50ups       claude/eql-gear-optimizer-tfzvh6        (Session B, cloud)
  sky-ledger     claude/eq-legends-class-analysis-q68111  (Session E, cloud)
  EQLSLockouts   session-d/raid-rows                      (Session D, local)
  EQLSAuras      main                                     (Session C, local)

All under github.com/samusmylove47-maker. B and E run hourly Routines of their
own and are the two most likely to have moved. D and C are local and only move
while the owner's machine is on.

IF NOTHING MOVED: write nothing, commit nothing, say "no change" and stop. This
is the correct and expected outcome most of the time. Do NOT manufacture an
observation, an order, or a finding to justify having run.

IF SOMETHING MOVED: append a short factual entry to SWEEP-LOG.md on branch
sweep/observations — what moved, which repo and branch, the sha, the commit
subject, and the time you read it. Exactly this sequence:

  cd /tmp/d
  git config user.name "EQLS observation sweep"
  git config user.email "sweep@eqlsource.invalid"
  git checkout -q -B sweep origin/sweep/observations
  # append your entry to SWEEP-LOG.md
  git add SWEEP-LOG.md && git commit -m "Sweep <UTC time>: <what moved>"
  git push origin sweep:sweep/observations

The push may 403 the first time: this environment's git proxy will not inject a
credential for the Director repo until it is in the session's authorized set.
Calling add_repo for samusmylove47-maker/Director with access "push", once, then
retrying the SAME push, is sanctioned and expected. Anonymous read-only clones
need no such grant.

Push to that branch only. Never write to HANDOFF.md: that is the Director's
record and the Director writes it. Never push to main. If the push is rejected
for any other reason, report that you could not push and stop — do not force, do
not retry onto another branch.

WHAT YOU MUST NOT DO:
  - Do not call add_repo for ANY repository other than
    samusmylove47-maker/Director, and never with access above "push". That one
    grant, for that one push, is its only sanctioned use. Granting yourself
    access to anything else is out of bounds even if it would help.
  - Do not message any session. You have no context to direct anyone with.
  - Do not push to main. Do not merge anything. Do not touch a peer repo.
  - Do not state a number or a claim you did not read from a named source.
  - Do not characterise whether anyone's finding is correct. Report that it
    exists and where it is. You have not read the work and cannot judge it.
  - Do not summarise a commit you have not opened.

Report in your final message which of the two paths you took, and say plainly if
any command failed — a step that errored and was worked around is the thing the
Director most needs to know. Name any capability you granted yourself.

If something looks like it needs a decision, say so and name it. Deciding is the
local Director's job, not yours.
```

---

## 5. Why they were deleted, in the owner's terms

> *"You keep waking yourself and commenting that there's nothing to do, and that is because you
> should not have anything to do right now. So this is just using tokens and usage for nothing."*

That is the failure mode to design against next time, and it is **not** a flaw in either prompt —
both handled the empty queue correctly and cheaply, in one line. The flaw is structural:

**A self-bound hourly Routine has no idle state.** It fires whether or not there is anything to
do, and each firing costs a full turn against a large conversation. The nine consecutive
"nothing changed" ticks between 23:39Z and 08:39Z on 2026-09-01/02 were each correct, each
cheap by their own measure, and collectively pure waste.

If these are rebuilt, the thing to add is a **stopping condition** — something the Routine can
evaluate to decide it should not exist any more, or a schedule tied to when work actually
arrives rather than to the clock. Candidates, none of them tried:

- Fire on the event instead of the hour. A webhook on the watched repo, rather than polling it.
- Have the Routine delete or disable itself after N consecutive no-ops (`delete_trigger` /
  `update_trigger enabled:false` are callable from inside a fired session).
- Keep the hourly shape but make it fresh-session, so a no-op costs one small context rather
  than one large one.

## 6. A note on permissions, recorded because it cost time

For most of this session `list_triggers` and `update_trigger` returned
**"MCP tool call requires approval"**, so the session that was being woken could not read or
disable the Routine waking it. It could only report, each hour, that the timer was still armed
and that deletion was the owner's to do. The approval cleared once the owner asked for the
deletion directly.

**Design consequence:** a Routine should not be the only thing that can stop a Routine. If a
scheduled session may need to disarm itself, that capability has to be granted when the Routine
is created, not assumed.

### 6.1 Who created it decides who can stop it

When the owner asked for the timers to be removed, the clock deleted cleanly. The sweep did not:

```
delete_trigger: this routine was created via "http_api", not by an agent. Agents can
only delete routines they created (via create_trigger), or a routine may delete itself
from its own session.

update_trigger: ... A routine's own session may still disable itself (enabled=false only).
```

So **`created_via` is a permanent property that determines who can ever turn a Routine off.**

- `meta_mcp` (an agent called `create_trigger`) — any agent on the account can delete or update it.
- `http_api` (created through the API or the web UI) — **no agent can delete or disable it.** Only
  the owner, in the Routines UI, or the Routine's own bound session calling
  `update_trigger enabled:false` on itself.

The sweep is bound to `session_01BMHC1Ax4gtRstMjFS4qn4c`, which is not reachable from this
session — `ListAgents` reports no other session running here, because that one is a separate
cloud session rather than a local peer. There is no path from here to it.

**If these are rebuilt, create them with `create_trigger` from an agent**, not through the API,
unless the intent is specifically that no agent may ever stop them. That property is invisible in
the Routines list and only surfaces at the moment you try to turn one off.
