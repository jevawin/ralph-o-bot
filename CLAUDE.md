# Ralph-o-bot — Claude Instructions

## What This Is

**Ralph-o-bot** is the automation layer that sits on top of Clancy. Where Clancy is the execution engine (plans, builds, reviews code), Ralph is the state machine that watches the GitHub Issues board and decides *when* to call which Clancy command.

Named after Ralph Wiggum — Chief Clancy Wiggum's son.

**Design principle: Ralph is the developer. Clancy is the developer's brain.** Ralph observes board/PR state and dispatches the command a developer would run next. It never replicates Clancy's internal logic. If Ralph is tempted to inspect something Clancy already inspects, that's a sign Ralph is doing too much.

## Roadmap

Future ideas and proposals live in `roadmap/` — one file per idea. Each file contains the full proposal including rationale, design decisions, and open questions. When an idea is ready to implement, it becomes a GitHub issue and the roadmap file becomes the brief/plan source of truth.

## Project Files

| File | Purpose |
|------|---------|
| `bin/ralph.js` | CLI entry — subcommands: `start`, `run`, `boot` |
| `src/config.js` | Loads `.clancy/.env` + `.env`, exports label names and settings |
| `src/dispatch.js` | Priority chain: review → build → plan → brief. One action per tick. |
| `src/scheduler.js` | Sleep-loop daemon, quiet hours, resource check |
| `src/github.js` | GitHub REST API wrapper (native fetch, no library) |
| `src/clancy.js` | Shells out to `claude --dangerously-skip-permissions` with a command |
| `src/state.js` | Read/write `.state.json` — seen-comments cursor per issue/PR |
| `src/check-review.js` | PR comment logic → merge or re-run Clancy |
| `src/check-build.js` | Build-label detection → `/clancy:once` |
| `src/check-plan.js` | Plan-label issue comment logic → `/clancy:plan` variants |
| `src/check-brief.js` | Brief-label issue comment logic → `/clancy:brief` variants |
| `src/sentiment.js` | Keyword classifier — `approved` / `feedback` / `none` |
| `.env` | gitignored — `GITHUB_TOKEN`, `GITHUB_REPO`, `CLAUDE_BIN`, scheduler settings |
| `.state.json` | gitignored — last actioned comment ID per issue/PR number |
| `logs/ralph.log` | Clancy stdout/stderr output |

## Kanban Flow

```
new-idea → [clancy:brief → questions → replies → re-brief] → approve-brief → clancy:plan → [approve] → clancy:build → review → done
```

`done` = GitHub auto-closes issue on PR merge (Clancy puts `Closes #N` in PR body).

### Labels and env vars

Label names are read directly from Clancy's env vars with Clancy's own defaults. No local overrides.

| Stage | Env var | Default |
|-------|---------|---------|
| brief | `CLANCY_LABEL_BRIEF` | `clancy:brief` |
| plan | `CLANCY_LABEL_PLAN` | `clancy:plan` |
| build | `CLANCY_LABEL_BUILD` | `clancy:build` |

In `config.js`:
```js
export const BRIEF_LABEL = process.env.CLANCY_LABEL_BRIEF ?? 'clancy:brief'
export const PLAN_LABEL  = process.env.CLANCY_LABEL_PLAN  ?? 'clancy:plan'
export const BUILD_LABEL = process.env.CLANCY_LABEL_BUILD ?? 'clancy:build'
```

## Labels

| Label | Source | Meaning |
|-------|--------|---------|
| `new-idea` | Human | New idea to be briefed — Ralph kicks off `/clancy:brief` and removes this label |
| `clancy:brief` | Clancy | Brief posted, awaiting human approval or feedback |
| `clancy:plan` | Clancy | Tickets created, awaiting implementation plan |
| `clancy:build` | Clancy | Plan approved, ready to build |

`new-idea` is hardcoded in Ralph. `clancy:*` labels are Clancy's defaults — override via `CLANCY_LABEL_BRIEF/PLAN/BUILD` in `.clancy/.env`.

## Dispatch Logic (one action per tick, highest priority first)

### 1. review
List `BUILD_LABEL` issues assigned to current user. For each, find its open PR. Find most recent PR comment from `jevawin`:
- No comment → skip (waiting)
- exactly `"approved"` (case-insensitive) → squash merge, delete branch (best-effort), GitHub auto-closes issue
- anything else → check if a commit landed after the comment; if yes skip (already acted), if no → `/clancy:once --afk #N`

PR may target `main` or an epic branch (`epic/{key}`) — Ralph merges to whatever `pr.base.ref` is. Cloudflare only deploys when target is `main`.

### 2. build
List `BUILD_LABEL` issues. Filter out any that also have `PLAN_LABEL` (still need planning). Skip issues with open PRs (in review). Pick earliest created → `/clancy:once --afk #N`. After Clancy finishes, run `/clancy:update-docs`.

`/clancy:once` is also the rework command — if the ticket already has an open PR with unaddressed feedback, Clancy detects this and reworks rather than starting fresh. Ralph always calls the same command.

### 3. plan
List `PLAN_LABEL` issues. For each (earliest created first), fetch comments. Find last comment containing `## Clancy Implementation Plan` marker:
- No marker → append instructions (next stage: build) + `/clancy:plan --afk #N` (first run)
- No `jevawin` comment after marker → skip to next (waiting)
- `jevawin` comment = exactly `"approved"` → `/clancy:approve-plan --afk #N`
- `jevawin` comment = anything else → `/clancy:plan --fresh --afk #N`

`/clancy:approve-plan` picks the oldest unapproved plan itself — no issue number needed.

### 4. brief
List `BRIEF_LABEL` (`clancy:brief`) issues. By the time an issue has this label, Clancy has already posted a brief. For each (earliest created first), fetch comments:
- `## Clancy — Approved Tickets` marker present → epic already decomposed, skip
- Append instructions to issue body (once, guarded by marker)
- No user comment after brief → skip to next (waiting)
- User comment = exactly `"approved"` → `/clancy:approve-brief --afk #N`
- User comment = anything else → `/clancy:brief --afk #N` (re-brief)

### 5. new idea
List `new-idea` issues. For each (earliest created first):
- Remove `new-idea` label → `/clancy:brief --afk #N`
- No comment check — these are always fresh tickets

Check if issue also has `afk` label alongside `brief` → use `--afk` flag. After approve-brief, Clancy creates child tickets labelled for the plan queue — Ralph picks them up on the next tick automatically.

**HITL vs AFK child tickets:** Ralph ignores this distinction. `/clancy:once` handles both.

**Epic completion:** When all child tickets merge into `epic/{key}`, the next `/clancy:once` auto-creates a final PR from `epic/{key}` → `main`. It flows through review like any other PR.

## Sentiment Detection (`src/sentiment.js`)

Exact match only — no keywords, no heuristics.

- `approved`: body is exactly `"approved"` (case-insensitive, trimmed)
- `feedback`: anything else

`check-brief` and `check-plan` skip the issue if there is no user response yet (null response). They do not call `classify` in that case.

## How Ralph Calls Clancy

```js
// src/clancy.js
echo "/clancy:once --afk #123" | claude --dangerously-skip-permissions
```

`execFile` with stdin piped. stdout/stderr appended to `logs/ralph.log`. Working directory = project root (where `.clancy/` lives). 10 MB maxBuffer.

## Seen-Comments Cursor (`.state.json`)

Prevents infinite loop where Clancy finds a comment unactionable but Ralph keeps re-firing. Ralph records the last comment ID it acted on per issue/PR. It only fires on comments with IDs it hasn't seen. `src/state.js` exports `getLastActioned(id)` and `setLastActioned(id, commentId)`.

## Configuration

Two `.env` files loaded at startup via `dotenv`:
1. `.clancy/.env` (from project root) — Clancy label names, shared with Clancy
2. `.env` (from Ralph's own dir) — `GITHUB_TOKEN`, `GITHUB_REPO`, `CLAUDE_BIN`, scheduler settings

```
GITHUB_TOKEN=...
GITHUB_REPO=jevawin/clumeral-game
CLAUDE_BIN=/custom/path/claude  # optional — only needed if auto-discovery fails

RALPH_SLEEP_SECONDS=30
RALPH_QUIET_START=00:00    # 00:00 = disabled
RALPH_QUIET_END=00:00

RALPH_RESOURCE_CHECK=true
RALPH_MIN_FREE_MEM_MB=256
RALPH_MAX_LOAD_PER_CORE=0.8
```

## CLI Subcommands

| Command | What it does |
|---------|-------------|
| `ralph-o-bot run` | Single dispatch tick, then exit — main dev tool |
| `ralph-o-bot start` | Daemon: run → sleep → run indefinitely |
| `ralph-o-bot boot` | Install as systemd service (requires global install + root) |

`ralph-o-bot run` is the primary tool for testing — single tick, inspectable output.

## Daemon (scheduler.js)

Sleep-loop architecture — no cron, overlap impossible by design. `dispatch()` is the same function used by `ralph-o-bot run`.

Quiet hours: if `RALPH_QUIET_START === RALPH_QUIET_END` (default `00:00`/`00:00`), quiet hours are disabled. When set, handles overnight windows (e.g. `23:00`–`07:00`).

Resource check uses Node's `os` module — `os.freemem()` + `os.loadavg()`. On Windows, `loadavg()` returns `[0,0,0]` so only memory check applies there.

## Systemd Service (`ralph-o-bot boot`)

Writes to `/etc/systemd/system/ralph-o-bot.service`. `WorkingDirectory` = project root at boot time. Requires global install and root. `INVOCATION_ID` env var (set by systemd) suppresses the startup tip.

**PATH embedding:** systemd runs with a minimal PATH that won't include nvm directories or `~/.local/bin`. `boot()` resolves this at install time by capturing the bin directories of `ralph-o-bot` (via `which ralph-o-bot`) and `node` (via `process.execPath`) and embedding them as an `Environment="PATH=..."` line in the unit file. This means the service file is machine-specific by design — it encodes the correct paths for whoever ran `boot`. Never hardcode paths in the template; always derive them at `boot()` time so the fix works for any user regardless of how they installed Node or Claude.

**Claude binary resolution:** `config.js` auto-discovers the `claude` CLI by checking common install locations (`~/.local/bin`, all nvm-versioned paths under `~/.nvm/versions/node/`, `/usr/local/bin`, `/opt/homebrew/bin`) before falling back to bare `claude`. `CLAUDE_BIN` in `.env` is an override for non-standard installs, not a requirement. Do not change this to a simple `which claude` — that fails under systemd for the same PATH reason above.

## Key Decisions

- **Sleep loop over webhooks** — no public endpoint, overlap impossible
- **One ticket per tick** — Pi memory pressure, no concurrent Clancy runs
- **Keyword sentiment, not LLM** — cheap, fast, no API cost per poll
- **Merge in Ralph, not Clancy** — squash merge via GitHub API, delete branch, triggers Cloudflare Pages deploy
- **Seen-comments cursor** — prevents infinite re-fire when Clancy finds comment unactionable
- **Label names from `.clancy/.env`** — single source of truth, no duplication
- **`/clancy:review` is manual only** — confidence scorer for humans, not in Ralph's dispatch loop
- **`afk` mode throughout** — all Clancy commands Ralph fires use `--afk` to avoid interactive prompts
