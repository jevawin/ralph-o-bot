# Safe Updates

**Status:** Backlog

When Ralph applies an update to itself (via `ralph-o-bot update`), it should wait for any in-flight dispatch work to complete before restarting, rather than interrupting mid-task.

## Motivation

Ralph's auto-update path calls `npm install` and then restarts the process. If an update is triggered while Clancy is actively running (e.g. mid-build), the restart kills Clancy mid-execution and leaves the ticket in an inconsistent state — label still set, PR potentially half-written, no record of what happened.

The update check runs on a timer independent of the dispatch loop, so there's a real window where the two can collide.

## Design

Before applying an update, Ralph should check whether a dispatch is currently in flight:

1. Check the dispatch lock file (`.clancy/ralph.lock`) — if it exists and is fresh, a Clancy invocation is active
2. If in flight: defer the update, log "Update available — waiting for current task to finish before applying"
3. On the next tick after the lock clears: apply the update and restart

If the lock file feature isn't implemented yet, a simpler flag (`updatePending: true`) set on the scheduler state would achieve the same result — checked at the top of each sleep loop iteration after dispatch completes.

## Interaction with Auto-Update

The `--auto-update` flag on `ralph-o-bot start` triggers the update check on a timer. The safe-update logic intercepts at the point of *applying* the update, not at the point of *detecting* it — detection can happen at any time, application only happens when the board is idle.

## Open Questions

- Should there be a maximum deferral window? If a task is stuck and Ralph would never be idle, the update would never apply. A cap (e.g. defer at most 3 ticks, then force-update between ticks) may be needed.
- Does this interact with `ralph-o-bot update` (manual)? Probably yes — show a warning if a task is in flight and prompt the user to confirm or wait.
