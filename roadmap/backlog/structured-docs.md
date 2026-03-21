# Structured Documentation

**Status:** Backlog

Split the monolithic `CLAUDE.md` into a `docs/` folder with separate files per topic, once Ralph's surface area justifies it.

## Motivation

`CLAUDE.md` currently covers everything: kanban flow, dispatch logic, config, CLI commands, daemon behaviour, systemd, publishing, labels, sentiment, Clancy integration. It's thorough but increasingly long. Finding specific information requires scanning the whole file.

Clancy maintains 17 doc files organised by type (conceptual, technical, process, guides, decisions) — each focused, cross-referenced. The CLAUDE.md becomes a short index pointing to the docs.

## When to Do This

Not now. CLAUDE.md works fine at its current size. This becomes worthwhile when:
- Docs regularly conflict or go stale because they're buried
- New contributors need onboarding docs separate from implementation detail
- Ralph adds enough features that topic-based navigation is genuinely needed

Rough threshold: when CLAUDE.md exceeds ~400 lines consistently.

## Proposed Structure

```
docs/
├── ARCHITECTURE.md     — module map, data flow, key decisions
├── DISPATCH.md         — phase pipeline, priority chain, one-action-per-tick
├── CONFIGURATION.md    — all env vars, .env files, defaults, examples
├── KANBAN.md           — labels, flow, board setup
├── DAEMON.md           — scheduler, quiet hours, resource check, systemd
├── PUBLISHING.md       — release checklist, migration.json schema, versioning
├── decisions/          — one file per significant design decision
│   └── v0.4-sleep-loop-over-webhooks.md
```

`CLAUDE.md` becomes a short index: what the project is, file map, and links to `docs/`.

## Decision Docs

Worth adopting Clancy's status header pattern for significant decisions regardless of the full docs split:

```markdown
**Status:** Draft | Reviewed | Approved | Shipped
```

Add to roadmap files too — they already function as decision records.

## Open Questions

- Should the doc split happen before or after a significant feature wave? After — docs should reflect stable structure, not track work in progress.
