import { execFileSync } from 'node:child_process'
import readline from 'node:readline'
import { createRequire } from 'node:module'
import { RALPH_MOCK_LATEST_VERSION } from './config.js'
import {
  listIssuesByLabel,
  createIssue,
  closeIssue,
  listIssueComments,
  removeLabel,
  addLabel,
} from './github.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

function log(msg) {
  console.log(`[${new Date().toISOString()}] [update] ${msg}`)
}

// --- Semver helpers ---------------------------------------------------------

function isNewer(a, b) {
  const [aM, am, ap] = a.split('.').map(Number)
  const [bM, bm, bp] = b.split('.').map(Number)
  if (aM !== bM) return aM > bM
  if (am !== bm) return am > bm
  return ap > bp
}

function getMajor(v) {
  return parseInt(v.split('.')[0], 10)
}

// --- npm / unpkg helpers ----------------------------------------------------

async function fetchLatestVersion() {
  const res = await fetch('https://registry.npmjs.org/ralph-o-bot/latest')
  if (!res.ok) throw new Error(`npm registry check failed: ${res.status}`)
  const data = await res.json()
  return data.version
}

async function fetchMigration(version) {
  try {
    const res = await fetch(`https://unpkg.com/ralph-o-bot@${version}/migration.json`)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

// --- Situation classification -----------------------------------------------

function classifySituation(currentVersion, latestVersion, migration) {
  if (getMajor(latestVersion) > getMajor(currentVersion)) return 'action-required'
  if (migration.requiresManual || migration.requiresBoot) return 'action-required'
  if (migration.boardChanges?.length > 0) return 'pending'
  return 'complete'
}

// --- Issue body builder -----------------------------------------------------

function buildIssueBody(situation, currentVersion, latestVersion, migration) {
  const lines = [
    `## Ralph-o-bot Update: v${currentVersion} → v${latestVersion}`,
    '',
  ]

  if (migration.notes) {
    lines.push('### What changed', '', migration.notes, '')
  }

  if (situation === 'complete') {
    lines.push('No board changes required. Update has been applied automatically.')
  }

  if (situation === 'pending') {
    lines.push('### Board changes required', '')
    for (const change of (migration.boardChanges || [])) {
      if (change.type === 'labelRename') {
        lines.push(`- Rename label \`${change.from}\` → \`${change.to}\` on all open issues`)
      }
    }
    lines.push('', 'Reply `approved` to apply these changes and install the update.')
  }

  if (situation === 'action-required') {
    lines.push('### Manual steps required', '')
    if (getMajor(latestVersion) > getMajor(currentVersion)) {
      lines.push('- This is a **major version bump** — manual review required before updating.')
    }
    if (migration.requiresBoot) {
      lines.push('- After updating, run `sudo ralph-o-bot boot` to reinstall the systemd service.')
    }
    if (migration.requiresManual) {
      lines.push('- See changelog for required manual steps (new `.env` vars or other config changes).')
    }
    lines.push('', 'Once ready, run `ralph-o-bot update` to install.')
  }

  return lines.join('\n')
}

// --- Dedup helper -----------------------------------------------------------

async function findExistingUpdateIssue(label, latestVersion) {
  const issues = await listIssuesByLabel(label)
  return issues.find(i => i.title.includes(`v${latestVersion}`)) || null
}

// --- Public API -------------------------------------------------------------

/**
 * Check npm registry for a newer version. If found:
 * - Situation 'complete' → installs immediately and restarts (no return)
 * - Situation 'pending'/'action-required' → creates GitHub issue, returns result
 * Returns null if already up to date.
 */
export async function checkAndHandleUpdate() {
  const currentVersion = pkg.version
  let latestVersion

  if (RALPH_MOCK_LATEST_VERSION) {
    latestVersion = RALPH_MOCK_LATEST_VERSION
    log(`Using mock latest version: ${latestVersion}`)
  } else {
    try {
      latestVersion = await fetchLatestVersion()
    } catch (err) {
      log(`Registry check failed: ${err.message}`)
      return null
    }
  }

  if (!isNewer(latestVersion, currentVersion)) {
    log(`Already up to date (v${currentVersion})`)
    return null
  }

  log(`New version available: v${currentVersion} → v${latestVersion}`)

  const migration = await fetchMigration(latestVersion)
  const situation = classifySituation(currentVersion, latestVersion, migration)
  log(`Situation: ${situation}`)

  if (situation === 'complete') {
    await applyUpdate(latestVersion, migration, null)
    // applyUpdate restarts — execution does not reach here
    return
  }

  // pending or action-required — create issue if not already present
  const label = `update:${situation}`
  const existing = await findExistingUpdateIssue(label, latestVersion)
  if (existing) {
    log(`Issue already exists for v${latestVersion} (${label}) — skipping`)
    return { situation, latestVersion, migration, issueNumber: existing.number }
  }

  const title = `Ralph update available: v${currentVersion} → v${latestVersion}`
  const body = buildIssueBody(situation, currentVersion, latestVersion, migration)
  const issue = await createIssue(title, body, [label])
  log(`Created issue #${issue.number} (${label})`)

  return { situation, latestVersion, migration, issueNumber: issue.number }
}

/**
 * Returns true if dispatch should be paused (open update:pending or
 * update:action-required issue exists).
 */
export async function checkUpdateBlocked() {
  const pending = await listIssuesByLabel('update:pending')
  if (pending.length > 0) return true
  const actionRequired = await listIssuesByLabel('update:action-required')
  return actionRequired.length > 0
}

/**
 * Check if any update:pending issue has been approved by the user.
 * Returns { issue, latestVersion, migration } or null.
 */
export async function checkUpdateApproval(username) {
  const pendingIssues = await listIssuesByLabel('update:pending')
  if (!pendingIssues.length) return null

  for (const issue of pendingIssues) {
    const comments = await listIssueComments(issue.number)

    let lastUserComment = null
    for (let i = comments.length - 1; i >= 0; i--) {
      if (comments[i].user?.login === username) {
        lastUserComment = comments[i]
        break
      }
    }

    if (!lastUserComment) continue
    if (lastUserComment.body?.trim().toLowerCase() !== 'approved') continue

    // Parse target version from title: "Ralph update available: vX.Y.Z → vA.B.C"
    const match = issue.title.match(/→ v([\d.]+)/)
    if (!match) continue

    const latestVersion = match[1]
    const migration = await fetchMigration(latestVersion)
    return { issue, latestVersion, migration }
  }

  return null
}

/**
 * Apply an update: board changes → npm install → Clancy install → close
 * pending issue → open update:complete issue → restart.
 *
 * @param {string} latestVersion
 * @param {object} migration
 * @param {object|null} pendingIssue  Issue to close (null for auto/manual updates)
 */
export async function applyUpdate(latestVersion, migration, pendingIssue) {
  const currentVersion = pkg.version

  // 1. Board changes
  for (const change of (migration.boardChanges || [])) {
    if (change.type === 'labelRename') {
      log(`Renaming label '${change.from}' → '${change.to}'`)
      const issues = await listIssuesByLabel(change.from)
      for (const issue of issues) {
        await removeLabel(issue.number, change.from)
        await addLabel(issue.number, change.to)
      }
    }
  }

  // 2. Install ralph-o-bot
  log(`Installing ralph-o-bot@${latestVersion}...`)
  execFileSync('npm', ['install', '-g', `ralph-o-bot@${latestVersion}`], { stdio: 'inherit' })

  // 3. Install pinned Clancy version if specified
  if (migration.clancyVersion) {
    log(`Installing chief-clancy@${migration.clancyVersion}...`)
    execFileSync('npx', [`chief-clancy@${migration.clancyVersion}`], {
      stdio: 'inherit',
      cwd: process.cwd()
    })
  }

  // 4. Close pending issue if any
  if (pendingIssue) {
    await closeIssue(pendingIssue.number)
    log(`Closed update:pending issue #${pendingIssue.number}`)
  }

  // 5. Create update:complete issue (dedup)
  const existing = await findExistingUpdateIssue('update:complete', latestVersion)
  if (!existing) {
    const title = `Ralph updated: v${currentVersion} → v${latestVersion}`
    const body = buildIssueBody('complete', currentVersion, latestVersion, migration)
    const issue = await createIssue(title, body, ['update:complete'])
    log(`Created update:complete issue #${issue.number}`)
  }

  // 6. Restart
  log('Restarting...')
  restart()
}

/**
 * Interactive update for `ralph-o-bot update [-y]`.
 * Prints the migration plan, optionally prompts, then applies.
 */
export async function applyUpdateInteractive({ skipConfirm = false } = {}) {
  const currentVersion = pkg.version
  let latestVersion

  if (RALPH_MOCK_LATEST_VERSION) {
    latestVersion = RALPH_MOCK_LATEST_VERSION
  } else {
    try {
      latestVersion = await fetchLatestVersion()
    } catch (err) {
      console.error(`Update check failed: ${err.message}`)
      process.exit(1)
    }
  }

  if (!isNewer(latestVersion, currentVersion)) {
    console.log(`Already up to date (v${currentVersion}).`)
    return
  }

  const migration = await fetchMigration(latestVersion)
  const situation = classifySituation(currentVersion, latestVersion, migration)
  const body = buildIssueBody(situation, currentVersion, latestVersion, migration)

  console.log(body)
  console.log()

  if (!skipConfirm) {
    const go = await promptYN('Proceed with update? [y/N] ')
    if (!go) {
      console.log('Aborted.')
      return
    }
  }

  await applyUpdate(latestVersion, migration, null)
}

// --- Internal helpers -------------------------------------------------------

function promptYN(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

function restart() {
  if (process.env.INVOCATION_ID) {
    // Under systemd — exit 0, Restart=always brings up the new binary
    process.exit(0)
  }
  // Manual start — exec new binary in-place (blocks until child exits)
  execFileSync(process.execPath, [process.argv[1], 'start'], { stdio: 'inherit' })
  process.exit(0)
}
