# Multi-Version Update Chain

**Status:** Backlog — planned, ready to build

The current update flow assumes one hop: installed version → latest. If multiple versions are published between checks, intermediate `migration.json` files are skipped entirely. This needs to be handled before `boardChanges` are used seriously.

## The Problem

Ralph installs `ralph-o-bot@latest` directly. If the installed version is `0.3.1` and latest is `0.3.3`, the `migration.json` from `0.3.2` is never seen — only `0.3.3`'s runs. Any board changes in `0.3.2` are silently missed.

## migration.json Schema Change

`notes` becomes a short plain string (used in the changelog line). Three optional arrays are added for categorised summary sections:

```json
{
  "version": "0.3.2",
  "notes": "One-line summary for the changelog",
  "breaking": ["You must now use `new-label` instead of `old-label` when approving briefs"],
  "features": ["Designer mode — plans requiring design automatically run a design cycle"],
  "fixes": ["Pre-alpha warning added to README"],
  "boardChanges": [],
  "requiresBoot": false,
  "requiresManual": false
}
```

All three arrays are optional. Omitting them is valid (older versions without them still work). `notes` remains a plain string for backwards compatibility.

## GitHub Issue Format

One issue covers the full version range. Sections only appear if they have content.

```
## Ralph-o-bot Update: v0.3.1 → v0.3.3

### Required changes

- You must now use `new-label` instead of `old-label` when approving briefs. (v0.3.2)

### New features

- Designer mode — plans requiring design automatically run a design cycle. (v0.8.2)

### Updates & fixes

- Pre-alpha warning added to README. (v0.3.3)

### Changelog

**v0.3.2** — One-line summary.
**v0.3.3** — Pre-alpha warning added to README.

---

### Board changes required

- Rename label `test-old-label` → `test-new-label` on all open issues

Reply `approved` to apply these changes and install the update.
```

Section order: required changes → new features → updates & fixes → changelog → action (board changes / manual steps).

## Implementation Plan

All changes are in `updater.js`. Nothing else needs touching.

### 1. `fetchAllVersionsBetween(current, latest)`

Hit `https://registry.npmjs.org/ralph-o-bot` (full metadata). Extract all version strings, filter to those semver-greater than `current` and semver-lte `latest`, sort ascending.

### 2. `fetchIntermediateMigrations(current, latest)`

Call `fetchAllVersionsBetween`, then `fetchMigration(v)` for each. Return array of `{ version, migration }` in order.

### 3. `mergeMigrations(versionedMigrations)`

Fold into a single aggregated object:

- `breaking` / `features` / `fixes` — collect all items across versions, append `(vX.Y.Z)` to each
- `boardChanges` — chain-collapse `labelRename` entries: if A→B exists and a new B→C arrives, replace with A→C
- `requiresBoot` / `requiresManual` — OR across all versions
- `notes` — array of `{ version, text }` for the changelog section
- `versions` — `[first, ..., latest]` for the issue header

### 4. `classifySituation()`

No change needed — already reads `requiresManual`, `requiresBoot`, `boardChanges` from the migration object. Works on the merged result as-is.

### 5. `buildIssueBody()`

Update to handle the new merged migration shape:
- Render `breaking`, `features`, `fixes` as sections (skip if empty)
- Render `notes` array as the changelog
- Existing board changes / action-required sections unchanged

### 6. `checkAndHandleUpdate()`

Swap `fetchMigration(latestVersion)` for `fetchIntermediateMigrations` + `mergeMigrations`.

### 7. `checkUpdateApproval()`

Same swap — currently re-fetches only latest migration on approval. Must fetch and merge all intermediate migrations before calling `applyUpdate`.

### 8. `applyUpdate()`

No changes needed — already iterates `migration.boardChanges`. Chain-collapse happens in merge step.

## Edge Cases

- **Chain-collapsed labelRename:** A→B then B→C resolves to A→C. Handled in `mergeMigrations`.
- **Version fetch failure:** if any intermediate tarball is unreachable, abort and surface `update:action-required` rather than silently skipping migrations.
- **>10 versions behind:** log a warning, continue applying — don't block.
- **Older versions without structured notes:** `breaking`/`features`/`fixes` arrays absent — sections simply don't appear for those versions. `notes` string still appears in changelog.
