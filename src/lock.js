import fs from 'node:fs'
import path from 'node:path'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

function lockPath() {
  return path.join(process.cwd(), '.clancy', 'ralph.lock')
}

/**
 * Attempt to acquire the dispatch lock.
 * Returns false if a fresh lock exists (another instance running) — caller should skip tick.
 * Logs a warning and continues if the lock is stale (likely a crash).
 */
export function acquireLock(log) {
  const p = lockPath()

  if (fs.existsSync(p)) {
    let lock
    try {
      lock = JSON.parse(fs.readFileSync(p, 'utf8'))
    } catch {
      // Corrupt lock file — treat as stale
      lock = { startedAt: new Date(0).toISOString() }
    }

    const age = Date.now() - new Date(lock.startedAt).getTime()

    if (age < TWO_HOURS_MS) {
      log(`Lock held by PID ${lock.pid} since ${lock.startedAt} — skipping tick`)
      return false
    }

    const where = lock.action
      ? ` during ${lock.action}${lock.issueNumber ? ` on #${lock.issueNumber}` : ''}`
      : ''
    log(`Stale lock detected — previous run may have crashed${where}. Continuing.`)
  }

  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    action: null,
    issueNumber: null,
  }))
  return true
}

/**
 * Record which action is currently in flight.
 * Called by a phase before it invokes Clancy so a crash leaves a useful trace.
 */
export function setLockAction(action, issueNumber = null) {
  const p = lockPath()
  if (!fs.existsSync(p)) return
  try {
    const lock = JSON.parse(fs.readFileSync(p, 'utf8'))
    lock.action = action
    lock.issueNumber = issueNumber
    fs.writeFileSync(p, JSON.stringify(lock))
  } catch {
    // Non-fatal — lock annotation is best-effort
  }
}

/**
 * Delete the lock file on clean dispatch completion.
 */
export function releaseLock() {
  try {
    fs.unlinkSync(lockPath())
  } catch {
    // Already gone — fine
  }
}
