# Deploy to npm

Run a pre-publish safety checklist for ralph-o-bot before publishing to npm. Work through each check in order. Stop and report clearly if any check fails — do NOT proceed to publish until all checks pass and the user explicitly confirms.

## Step 1 — Git state

Run:
- `git status` — working tree must be clean (no uncommitted changes)
- `git branch --show-current` — must be on `main`
- `git log origin/main..HEAD --oneline` — must be empty (no unpushed commits)
- `git log HEAD..origin/main --oneline` — must be empty (not behind remote)

If anything is wrong: stop, describe the issue, tell the user to fix it before publishing.

## Step 2 — Version consistency

Read `package.json` and `migration.json`. Confirm:
- `version` fields match exactly in both files
- `migration.json` has non-empty `notes` field
- At least one of `breaking`, `features`, or `fixes` arrays is present in `migration.json`

Report the version being published and the migration notes summary.

## Step 3 — Files that will be published

Run `npm pack --dry-run 2>&1` to list what will be included in the package.

Scan the list for anything that looks sensitive or wrong:
- `.env` files of any kind
- Files with `secret`, `token`, `key`, `password`, `credential` in the name (case-insensitive)
- Config files not in the `files` array in `package.json` that snuck in via `.npmignore` absence
- Large files that clearly don't belong (binaries, `node_modules` subdirs, etc.)

Report the full file list and flag any concerns.

## Step 4 — Dependency audit

Run `npm audit 2>&1`.

- **High or critical vulnerabilities** → stop, report, do not publish
- **Moderate vulnerabilities** → report them clearly, ask the user whether to proceed
- **Low or info only** → report briefly, continue

## Step 5 — Sanity check the source files

Read the `files` array from `package.json` to know what's included, then for each source file in `bin/` and `src/`:
- Check for hardcoded tokens, API keys, or passwords (look for patterns like long hex strings, `ghp_`, `sk-`, `Bearer ` literals, base64-looking strings)
- Check for `console.log` statements left in that could expose user data
- Check for any `TODO` or `FIXME` comments that mention security or auth

Report any findings. Minor TODOs are fine to note and continue; anything that looks like a credential is a hard stop.

## Step 6 — Confirm and publish

Summarise the checklist result:
- Version being published
- Migration notes
- File count in package
- Audit result
- Any warnings from steps above

Then ask: **"All checks passed. Run `npm publish --access public`? (yes/no)"**

Wait for explicit confirmation. If the user says yes, run:
```
npm publish --access public
```

Report the result. If publish succeeds, remind the user to:
1. `git tag v<version> && git push origin v<version>` (if they tag releases)
2. Check the npm page to confirm the new version is live
