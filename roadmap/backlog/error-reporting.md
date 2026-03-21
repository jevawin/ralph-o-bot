# Error Reporting via GitHub Issues

**Status:** Backlog — priority #4
**Depends on:** github-actions-ci-release (deploy tooling)

When Ralph encounters an unhandled error during a dispatch tick, it should open a GitHub issue so the problem is visible without needing to SSH in and tail logs.

## Motivation

Ralph runs unattended on a Pi. Errors currently go to `logs/ralph.log` — invisible unless you're looking. A GitHub issue surfaces the failure where the board already lives, and can be closed once resolved.

## Behaviour

- On any unhandled exception or rejected promise during `dispatch()`, Ralph opens a GitHub issue titled `Ralph error: <error message>` with the label `ralph:error`
- Issue body includes: error message, stack trace, timestamp, Ralph version
- If an identical open issue already exists (same title), Ralph comments on it rather than opening a duplicate
- Ralph continues running after reporting — a single tick failure should not kill the daemon

## What Counts as Reportable

- Unhandled exceptions in `dispatch()` or any checker module
- GitHub API errors (non-2xx responses) that Ralph cannot recover from
- Clancy subprocess failures (non-zero exit, timeout)

Not reportable (too noisy):
- Expected skips (no comments, waiting states)
- Quiet hours / resource check blocks

## Label

`ralph:error` — created by Ralph on first use if it doesn't exist.

## Open Questions

- Should resolved issues auto-close when the same tick succeeds? Probably not — leave that to the human.
- Rate-limit: if Ralph is crash-looping, cap issue creation to 1 per hour per error type.
