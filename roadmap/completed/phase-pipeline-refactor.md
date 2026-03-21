# Phase Pipeline Refactor

**Status:** Shipped

Refactor `dispatch.js` from a monolithic priority chain into composable phase functions — one per dispatch stage — inspired by Clancy's once orchestrator pattern.

## Motivation

`dispatch.js` currently does everything inline in a single function: review, build, plan, brief, new-idea. Each stage has its own logic, side effects, and early-exit conditions, but they're all entangled in one flow. This makes it hard to test stages in isolation, hard to add new stages cleanly, and hard to debug which stage failed when something goes wrong.

Clancy splits its run logic into 13 phase functions, each with the signature `(ctx) => Promise<boolean>` — returning `false` exits the pipeline early. The orchestrator is 30 lines. Each phase is independently testable.

## Design

Each dispatch stage becomes a module exporting a single async function:

```js
// src/phases/review.js
export async function review(ctx) { ... return true/false }

// src/phases/build.js
export async function build(ctx) { ... return true/false }
// etc.
```

A shared `RunContext` object carries state between phases (GitHub client, config, current tick metadata). The dispatcher becomes a pipeline runner:

```js
const phases = [checkUpdate, review, build, plan, brief, newIdea]
for (const phase of phases) {
  const shouldContinue = await phase(ctx)
  if (!shouldContinue) break
}
```

## Benefits

- Each phase is unit-testable in isolation (no need to mock the whole dispatch chain)
- Adding or removing a stage is one line in the pipeline array
- Crash logs pinpoint exactly which phase failed
- Consistent early-exit pattern replaces ad-hoc `return` scattered through one big function

## Open Questions

- Does RunContext replace the current implicit state (labels fetched, issues found) or supplement it?
- Should phases be allowed to mutate ctx, or return a new ctx? (Mutation is simpler; immutability is safer)
- Does this change the one-action-per-tick guarantee? (No — pipeline exits after first action, same as now)
