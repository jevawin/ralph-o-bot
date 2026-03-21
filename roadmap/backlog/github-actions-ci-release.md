# GitHub Actions: CI + Auto-Release

**Status:** Backlog — priority #3
**Depends on:** tests (CI is only meaningful once there's something to run; release auto-tagging half can land independently)

Add GitHub Actions workflows for CI (lint, test on PRs) and auto-release (tag + GitHub Release on version bump to main).

## Motivation

Ralph's release process is currently manual: pull, bump version in two files, `npm publish`. There's no CI running on PRs, no automated tagging, no GitHub Release with changelog. As Ralph is now a public npm package others may use, catching regressions before they ship matters — and a GitHub Release page gives users a clear changelog view.

Clancy automates this entirely: version bump detected on push to main → tag → GitHub Release with changelog extracted automatically.

## Design

### CI Workflow (`.github/workflows/ci.yml`)

Runs on push to any branch and on PRs to main:

```yaml
- Checkout
- Setup Node (lts)
- npm ci
- npm test  (once tests exist — see tests roadmap item)
```

Lightweight for now. Extend with lint/typecheck once those are added.

### Release Workflow (`.github/workflows/release.yml`)

Runs on push to main:

1. Compare `version` in `package.json` against existing git tags
2. If version is new:
   - Create git tag `v{version}`
   - Extract changelog entry for this version from `CHANGELOG.md` (or use `migration.json` notes as body)
   - Create GitHub Release

This mirrors Clancy's approach exactly. No npm publish in CI — the CLAUDE.md publish checklist and deploy-to-npm skill handle that with human oversight.

## CHANGELOG.md

A `CHANGELOG.md` should be created and kept alongside `migration.json`. Each release gets an entry. The release workflow extracts the relevant section as the GitHub Release body.

Alternatively: the release workflow can use `migration.json` notes/features/fixes arrays to auto-generate the release body without a separate CHANGELOG.

## Open Questions

- Should npm publish be added to the release workflow eventually? Only after the deploy-to-npm skill proves insufficient or too manual.
- Should the CI workflow cache `node_modules`? Yes, once the dependency count grows.
