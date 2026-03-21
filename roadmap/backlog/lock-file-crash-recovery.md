# Lock File & Crash Recovery

**Status:** Backlog

Add a lock file to Ralph's dispatch loop that prevents overlapping runs and enables crash detection/recovery when Ralph dies mid-Clancy-invocation.

## Motivation

Ralph's sleep-loop architecture makes overlapping dispatch ticks structurally impossible during normal operation — the next tick doesn't start until `dispatch()` resolves. But if Ralph crashes while Clancy is running (OOM kill on the Pi, manual SIGKILL, power loss), there's no record of what was in flight. The next startup has no way to know whether Clancy finished, and the ticket may be left in an inconsistent state.

Clancy uses a lock file with stale detection: if the lock is older than 2 hours, it's assumed stale (crashed) and the previous session is resumed. This is the right pattern for unattended daemon operation.

## Design

On `dispatch()` start:
1. Check for `$CWD/.clancy/ralph.lock`
2. If lock exists and is < 2 hours old → log a warning and exit (another instance running, shouldn't happen but safe)
3. If lock exists and is ≥ 2 hours old → log "Stale lock detected — previous run may have crashed" and continue
4. Write lock file: `{ pid, startedAt, action: null }` — action filled in once a stage claims it
5. On `dispatch()` completion (success or error) → delete lock file

The lock file lives in `.clancy/` (project root) so it's always next to Clancy's own state files.

## Crash Recovery

If Ralph starts and finds a stale lock with an `action` recorded (e.g. `{ action: "build", issueNumber: 42 }`), it can log a notice: "Previous run crashed during build on #42 — check ticket state before continuing." No automatic recovery — just visibility.

## Interaction with Systemd Restart

Systemd may restart Ralph on crash. The stale check window (2 hours) means Ralph won't get stuck in a restart loop — on restart it sees a fresh-ish lock, waits, then the lock ages out and normal operation resumes. The 2-hour threshold is intentionally conservative.

## Open Questions

- Should Ralph attempt to clean up the ticket state on crash recovery (e.g. remove `clancy:build` label if Clancy may not have finished)? No — too risky without knowing Clancy's actual progress. Visibility only.
- Should the lock file be in `.clancy/` or `logs/`? `.clancy/` keeps all runtime state in one place.
