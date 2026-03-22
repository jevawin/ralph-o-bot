# Update Clancy

Update the bundled Clancy version in ralph-o-bot and prepare a release.

## Step 1 — Check versions

Read `package.json` to get the current `clancyVersion` and ralph-o-bot `version`.

Run: `npm show chief-clancy version`

If already on the latest: report "Already on chief-clancy@X.Y.Z — nothing to do." and stop.

## Step 2 — Fetch release notes

Run `npm show chief-clancy --json` to get the full package metadata.

Also fetch the changelog from unpkg (try in order until one works):
- `https://unpkg.com/chief-clancy@latest/CHANGELOG.md`
- `https://unpkg.com/chief-clancy@latest/migration.json`

Extract and clearly display:
- Current chief-clancy version → new chief-clancy version
- Breaking changes (if any) — flag these prominently
- New features
- Bug fixes / other changes

Ask: **"Update chief-clancy from vX.X.X → vX.X.X? [Y/n]"** — wait for confirmation before proceeding.

## Step 3 — Update package.json

Two changes:
1. `clancyVersion` → new chief-clancy version
2. `version` → patch-bump the ralph-o-bot version (e.g. 0.4.6 → 0.4.7)

## Step 4 — Update migration.json

Set all fields to match the new release:
- `version`: new ralph-o-bot version (matching package.json)
- `clancyVersion`: new chief-clancy version
- `notes`: one-line summary, e.g. `"Bump Clancy to X.Y.Z (brief description of what changed)."`
- `fixes`: array with one entry describing the Clancy update and what it fixes or adds
- `boardChanges`: `[]` unless Clancy introduces label or board structure changes
- `requiresBoot`: `false` (set `true` only if Clancy changes the service/install process)
- `requiresManual`: `false` (set `true` only if the user must manually update config)

If there are **breaking changes** in Clancy: add them to a `breaking` array in migration.json and consider whether `requiresManual` should be `true`.

Confirm the final migration.json looks correct before continuing.

## Step 5 — Commit

Stage only the manifest files and commit:

```
git add package.json migration.json
git commit -m "chore: bump Clancy to vX.Y.Z and ralph-o-bot to vA.B.C"
git push origin main
```

## Step 6 — Publish

Invoke the `/deploy-npm` skill to run safety checks and publish to npm.
