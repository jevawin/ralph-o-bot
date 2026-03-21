# Test Suite

**Status:** Backlog — priority #2
**Depends on:** phase-pipeline-refactor (dispatch stages need to be split before they're testable in isolation; sentiment.js and scheduler.js can be tested now)

Add a unit test suite for Ralph's core logic modules — dispatch stages, sentiment classifier, scheduler conditions, and env validation.

## Motivation

Ralph currently has no tests. The dispatch logic, sentiment classifier, quiet hours check, and resource check all contain meaningful branching logic that's been debugged manually. As Ralph grows (more dispatch stages, more edge cases) and becomes a public npm package used by others, regressions become more costly.

Clancy runs 1285 tests across unit and integration configs with ~80% coverage. Ralph doesn't need that scale, but the core logic modules are straightforward to test without hitting GitHub or spawning Clancy.

## What to Test

**`src/sentiment.js`** — pure function, easiest to test first:
- `"approved"` (exact, any case, with whitespace) → `approved`
- anything else → `feedback`
- empty string → `feedback`

**`src/scheduler.js`** — quiet hours and resource check logic:
- Quiet hours: overnight window, same-day window, disabled (`00:00`/`00:00`)
- Resource check: low memory, high load, both, neither
- These can be tested by injecting fake `os` module returns

**`src/dispatch.js`** — once phases are refactored (see phase-pipeline-refactor roadmap item), each phase is independently testable with a mock context object and mocked GitHub responses.

**`src/validate-env.js`** — once written, test all required/optional/format paths.

## Setup

Vitest is the natural choice (same as Clancy, ESM-native, no config overhead). Unit tests only to start — no integration tests hitting GitHub.

```
npm install --save-dev vitest
```

Test files co-located with source: `src/sentiment.test.js`, `src/scheduler.test.js`, etc.

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run"
}
```

## Open Questions

- Should tests be added before or after the phase pipeline refactor? After — the refactor makes dispatch stages independently testable.
- Integration tests (real GitHub API calls) — worth adding later under a separate `test:integration` script, gated by `GITHUB_TOKEN` presence.
