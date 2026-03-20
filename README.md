# Ralph-o-bot

> **Pre-alpha — active development and testing.** Expect breaking changes, rough edges, and incomplete features. Not recommended for production use yet.

Automation layer for [Chief Clancy](https://github.com/Pushedskydiver/clancy). Watches a GitHub Issues board and dispatches Clancy commands based on ticket state — so you can approve work from GitHub comments and let the pipeline run itself.

Named after Ralph Wiggum — Chief Clancy Wiggum's son.

## Requirements

- [Claude Code](https://claude.ai/code) installed and authenticated
- [Chief Clancy](https://github.com/Pushedskydiver/clancy) installed and initialised in your project (`npx chief-clancy`)
- Node.js 18+
- A GitHub repo with Issues enabled

## Installation

```bash
npm install -g ralph-o-bot
```

Then run from your project root (the directory containing `.clancy/`):

```bash
ralph-o-bot run     # single tick — useful for testing
ralph-o-bot start   # daemon — runs continuously
ralph-o-bot boot    # install as a systemd service (requires root)
```

## Configuration

Ralph reads two `.env` files from the project root:

| File | Purpose |
|------|---------|
| `.clancy/.env` | Shared with Clancy — label names, GitHub credentials |
| `.env` | Ralph-specific — scheduler settings, claude binary path |

### Required

| Variable | File | Description |
|----------|------|-------------|
| `GITHUB_TOKEN` | `.clancy/.env` or `.env` | GitHub personal access token (needs `repo` scope) |
| `GITHUB_REPO` | `.clancy/.env` or `.env` | Repo in `owner/name` format, e.g. `jevawin/clumeral-game` |

### Labels

Ralph uses two types of labels:

**`new-idea` (hardcoded)** — the entry point. Add this label to any issue you want Ralph to pick up and brief. Ralph removes it after dispatching `/clancy:brief`, so your backlog of unlabelled ideas is never touched.

**Clancy pipeline labels** — applied by Clancy as work moves through the pipeline. Ralph reads these using the same env vars as Clancy, with the same defaults:

| Variable | Default | Applied by | Meaning |
|----------|---------|------------|---------|
| `CLANCY_LABEL_BRIEF` | `clancy:brief` | Clancy | Brief posted, awaiting your response |
| `CLANCY_LABEL_PLAN` | `clancy:plan` | Clancy | Plan posted, awaiting your response |
| `CLANCY_LABEL_BUILD` | `clancy:build` | Clancy | Ready to build |

If you use Clancy's default labels you don't need to set anything. To override, add to `.clancy/.env`:

```bash
# .clancy/.env
CLANCY_LABEL_BRIEF=clancy:brief
CLANCY_LABEL_PLAN=clancy:plan
CLANCY_LABEL_BUILD=clancy:build
```

### Scheduler (optional)

Set these in `.env` in the project root:

```bash
RALPH_SLEEP_SECONDS=30       # how long to wait between ticks (default: 30)
RALPH_QUIET_START=00:00      # quiet hours start — 00:00 disables (default: 00:00)
RALPH_QUIET_END=00:00        # quiet hours end   — 00:00 disables (default: 00:00)
RALPH_RESOURCE_CHECK=true    # skip tick if memory/CPU is under pressure (default: true)
RALPH_MIN_FREE_MEM_MB=256    # minimum free memory in MB (default: 256)
RALPH_MAX_LOAD_PER_CORE=0.8  # maximum load average per CPU core (default: 0.8)
```

### Claude binary

Ralph auto-discovers the `claude` CLI by checking common install locations (`~/.local/bin`, nvm paths, `/usr/local/bin`, Homebrew). You only need to set `CLAUDE_BIN` if your install is somewhere non-standard:

```bash
# .env
CLAUDE_BIN=/custom/path/to/claude
```

## Issue labels

Ralph uses labels to track where each issue is in the pipeline. This is the full label lifecycle:

| Label(s) | Meaning |
|----------|---------|
| *(none)* | Holding ground — Ralph ignores it |
| `new-idea` | Ready for Clancy — Ralph will pick it up next tick |
| `clancy` + `clancy:brief` | Ralph has dispatched a brief; Clancy is waiting for your response |
| `clancy` | Brief approved; child tickets are now in flight |
| `clancy:plan` | Plan stage — Clancy has posted a plan, waiting for your response |
| `clancy:build` | Build stage — ready to implement |

`new-idea` is hardcoded in Ralph. The `clancy:brief`, `clancy:plan`, and `clancy:build` label names are read from `.clancy/.env` — if you change them there (via `CLANCY_LABEL_BRIEF`, `CLANCY_LABEL_PLAN`, `CLANCY_LABEL_BUILD`), Ralph picks up the new names automatically but the table above will reflect whatever you've configured.

## How it works

Each tick Ralph runs one action in priority order:

| Priority | Stage | Label | Latest comment | Action |
|----------|-------|-------|----------------|--------|
| 1 | Review | `clancy:build` + open PR | None | Wait |
| 1 | Review | `clancy:build` + open PR | Exactly `approved` | Squash merge, delete branch |
| 1 | Review | `clancy:build` + open PR | Anything else, no commit since | `/clancy:once --afk #N` (rework) |
| 1 | Review | `clancy:build` + open PR | Anything else, commit exists after | Skip (Clancy already actioned) |
| 2 | Build | `clancy:build`, no open PR | — | `/clancy:once --afk #N` |
| 3 | Plan | `clancy:plan` | None, or Clancy plan marker | Wait (or fire if no plan posted yet) |
| 3 | Plan | `clancy:plan` | Exactly `approved` | `/clancy:approve-plan --afk #N` |
| 3 | Plan | `clancy:plan` | Anything else | `/clancy:plan --fresh --afk #N` |
| 4 | Brief | `clancy:brief` | None, or Clancy brief marker | Wait |
| 4 | Brief | `clancy:brief` | Exactly `approved` | `/clancy:approve-brief --afk #N` |
| 4 | Brief | `clancy:brief` | Anything else | `/clancy:brief --afk #N` |
| 5 | New idea | `new-idea` | — | Swap to `clancy` label, `/clancy:brief --afk #N` |

Clancy's comments are detected by their titles (`# Clancy Strategic Brief`, `## Clancy Implementation Plan`) — not by username, since Clancy commits and comments as the local git user.

One action per tick. After a build completes, Ralph also runs `/clancy:update-docs`.

## Approving work

Reply to any Clancy comment on GitHub with exactly:

```
approved
```

(case-insensitive) to move to the next stage. Any other reply is treated as feedback and Clancy will revise.

On first pickup of a ticket, Ralph appends a reminder to the issue description:

> _Reply **"approved"** to move to the next stage: **[stage]**. Reply with answers or further questions to continue the discussion with Claude._
