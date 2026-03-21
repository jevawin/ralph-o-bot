# Decision Doc Status Headers

**Status:** Backlog — housekeeping, do opportunistically not as a dedicated piece of work

Add a `**Status:**` header to all roadmap files so it's clear where each idea sits in its lifecycle.

## Motivation

Clancy tracks every brief/design/plan with a status line: `Draft | DA reviewed | Approved | Shipped`. Ralph's roadmap files already function as decision records, but have no status beyond their folder location (`backlog/`, `in-progress/`, `completed/`). The folder is coarse — it doesn't capture whether something is fully spec'd, has open questions, is blocked, etc.

## Convention

All roadmap files should lead with:

```markdown
**Status:** Backlog | In Progress | Shipped | Blocked — <reason>
```

Optionally add a `**Depends on:**` line for items with prerequisites:

```markdown
**Depends on:** phase-pipeline-refactor
```

## Implementation

Update all existing backlog files (including this one) to use the convention. Already partially done — most files written after March 2026 have a status line. Audit and standardise.

This is a 10-minute task, not a feature — do it opportunistically when touching any roadmap file.
