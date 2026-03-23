import { readFileSync } from 'node:fs'
import { createIssue, createIssueComment, listIssuesByLabel, ensureLabel } from './github.js'

const ERROR_LABEL = 'ralph:error'
const RATE_LIMIT_MS = 60 * 60 * 1000  // 1 issue per error type per hour

// In-memory rate limiter — resets on restart, which is acceptable
const lastReported = new Map()

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    return pkg.version
  } catch {
    return 'unknown'
  }
}

function errorKey(err) {
  // Use first line of message as the stable key — avoids issue numbers or timestamps
  return (err?.message || String(err)).split('\n')[0].trim().slice(0, 100)
}

function formatBody(err) {
  const lines = [
    `**Time:** ${new Date().toISOString()}`,
    `**Ralph version:** ${getVersion()}`,
    '',
    '**Error:**',
    '```',
    err?.message || String(err),
    '```',
  ]

  if (err?.clancyOutput) {
    lines.push('', '**Clancy output:**', '```', err.clancyOutput, '```')
  }

  return lines.join('\n')
}

/**
 * Report an error to GitHub Issues.
 * - Creates the ralph:error label on first use
 * - Comments on an existing open issue if the same error recurs
 * - Rate-limited to 1 report per error type per hour
 */
export async function reportError(err) {
  const key = errorKey(err)
  const now = Date.now()

  if (lastReported.has(key) && now - lastReported.get(key) < RATE_LIMIT_MS) return
  lastReported.set(key, now)

  const title = `Ralph error: ${key}`
  const body = formatBody(err)

  try {
    await ensureLabel(ERROR_LABEL, 'b91c1c', 'Unhandled error during Ralph dispatch')

    const open = await listIssuesByLabel(ERROR_LABEL)
    const existing = open.find(i => i.title === title)

    if (existing) {
      await createIssueComment(existing.number, body)
    } else {
      await createIssue(title, body, [ERROR_LABEL])
    }
  } catch (reportErr) {
    // Never throw from the error reporter — log and move on
    console.error(`[ralph] Failed to report error to GitHub: ${reportErr.message}`)
  }
}
