# Credential Guard Hook

**Status:** Backlog

Add a PreToolUse Claude Code hook that blocks Write/Edit operations if the file content contains credential patterns — preventing accidental secret commits from Clancy runs that Ralph orchestrates.

## Motivation

Ralph runs `claude --dangerously-skip-permissions` unattended. If Clancy writes a file containing a hardcoded token (its own or a scraped one), Ralph has no visibility and no safety net. The repo is public. A credential guard hook intercepts at the Claude Code layer before anything touches disk.

This is the same pattern Clancy uses internally — a PreToolUse hook scanning 30+ credential patterns before any Write/Edit/MultiEdit.

## Behaviour

The hook scans the content being written for:
- GitHub PATs (`ghp_`, `github_pat_`)
- AWS access/secret keys
- Stripe keys (`sk_live_`, `pk_live_`)
- Private key blocks (`-----BEGIN RSA PRIVATE KEY-----`)
- Generic patterns: long hex strings, `Bearer <token>`, `password=`, `secret=`

If a match is found:
- Block the write operation
- Output a clear message naming the pattern matched
- Never log the actual credential value

Whitelisted paths (writes allowed regardless):
- `.env`, `.env.*`, `.clancy/.env` — these are the intended home for secrets
- `.env.example` — safe by design

## Implementation

A Node.js hook file at `.claude/hooks/credential-guard.js` registered as PreToolUse for `Write|Edit|MultiEdit` in `.claude/settings.json`. CommonJS (same as Clancy's hooks), no external dependencies.

## Open Questions

- Should this live in `.claude/settings.json` (project hook) or `~/.claude/settings.json` (global)? Project makes more sense — it's specific to how Ralph operates.
- Does the whitelist need to cover `logs/` as well? (Log content may include redacted error messages that look like patterns)
