# Multi-Version Update Chain

**Status:** Backlog

The current update flow assumes one hop: installed version → latest. If multiple versions are published between checks, intermediate `migration.json` files are skipped entirely. This needs to be handled before `boardChanges` are used seriously.

## The Problem

Ralph installs `ralph-o-bot@latest` directly. If the installed version is `0.3.1` and latest is `0.3.3`, the `migration.json` from `0.3.2` is never seen — only `0.3.3`'s runs. Any board changes in `0.3.2` are silently missed.

## Proposed Fix

When an update is detected, fetch the full npm version list and walk every intermediate version in order:

1. Get all published versions between `installedVersion` (exclusive) and `latest` (inclusive)
2. Fetch `migration.json` from each version's npm tarball in order
3. Merge all `boardChanges` arrays (deduplicating where safe)
4. Determine the highest situation classification across all migrations:
   - Any `requiresManual: true` → Situation 3 overall
   - Any `requiresBoot: true` → Situation 3 overall
   - Any `boardChanges` → at minimum Situation 2
   - Otherwise → Situation 1
5. Apply all migrations in version order after approval

## GitHub Issue Content

The issue body should list each intermediate version's `notes` so the user sees the full changelog, not just the latest.

## Edge Cases

- **Conflicting migrations:** e.g. `0.3.2` renames label A→B, `0.3.3` renames B→C. Should resolve to A→C, not two separate renames. Requires simple chain-collapse logic on `labelRename` entries.
- **Skipped manual step:** if `0.3.2` was `requiresManual: true` and the user never actioned it, `0.3.3` should still surface the unmet requirement.
- **Version fetch failure:** if a tarball is unreachable, abort and surface an `update:action-required` issue rather than silently skipping migrations.

## Open Questions

- Should Ralph cap the chain length? (e.g. warn if >5 versions behind)
- Is chain-collapse worth it, or just apply each migration independently in sequence?
