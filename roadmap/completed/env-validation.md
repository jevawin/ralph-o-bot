# Startup Env Validation

**Status:** Shipped

Validate required environment variables at startup with clear, actionable error messages — failing fast before Ralph attempts any GitHub or Clancy operations.

## Motivation

Ralph currently has no validation of its env vars. If `GITHUB_TOKEN` is missing you get a cryptic `fetch` error somewhere in `github.js`. If `GITHUB_REPO` is malformed you get a 404 with no context. Ralph is a daemon — it runs unattended, often on a Pi. A misconfiguration after an update or a `.env` edit shouldn't result in silent failures or confusing log output.

Clancy solves this with Zod schemas that validate all env at startup and bail with a clear message: "Missing required env var: GITHUB_TOKEN. See .env.example."

## Design

A `src/validate-env.js` module (keeping Ralph in plain JS — no TypeScript required) that runs before `dispatch()` on every `start`, `run`, and `boot` invocation:

```js
// src/validate-env.js
const required = {
  GITHUB_TOKEN: 'GitHub personal access token',
  GITHUB_REPO: 'Target repo in owner/repo format (e.g. jevawin/my-project)',
}

const formatChecks = {
  GITHUB_REPO: (v) => /^[\w.-]+\/[\w.-]+$/.test(v),
}

export function validateEnv() {
  const errors = []
  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) errors.push(`  ${key} — ${description}`)
    else if (formatChecks[key] && !formatChecks[key](process.env[key])) {
      errors.push(`  ${key} — invalid format (got: ${process.env[key]})`)
    }
  }
  if (errors.length) {
    console.error('Ralph-o-bot: missing or invalid config:\n' + errors.join('\n'))
    console.error('\nCheck your .env file. See .env.example for reference.')
    process.exit(1)
  }
}
```

No Zod needed — plain validation keeps the zero-dependency spirit of the project.

Optional vars (`CLAUDE_BIN`, scheduler settings) should warn but not exit if they look wrong (e.g. `RALPH_SLEEP_SECONDS=abc`).

## Open Questions

- Should format validation cover `RALPH_QUIET_START`/`RALPH_QUIET_END` (HH:MM format)? Yes, these are an easy misconfiguration.
- Should `CLAUDE_BIN` be validated to confirm the path exists and is executable? Yes — surface this at startup rather than failing silently when Clancy is invoked.
