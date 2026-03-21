import { getCurrentUser } from './github.js'
import { acquireLock, releaseLock, setLockAction } from './lock.js'
import { updatePhase } from './phases/update.js'
import { reviewPhase } from './phases/review.js'
import { buildPhase } from './phases/build.js'
import { planPhase } from './phases/plan.js'
import { briefPhase } from './phases/brief.js'
import { newIdeaPhase } from './phases/new-idea.js'

const PHASES = [updatePhase, reviewPhase, buildPhase, planPhase, briefPhase, newIdeaPhase]

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

/**
 * One tick of the dispatch loop.
 * Priority: update → review → build → plan → brief → new idea
 * Each phase returns false to stop the pipeline (action taken) or true to continue.
 */
export async function dispatch() {
  if (!acquireLock(log)) return

  const ctx = {
    username: await getCurrentUser(),
    cwd: process.cwd(),
    log,
    setAction: setLockAction,
  }

  try {
    for (const phase of PHASES) {
      if (!await phase(ctx)) return
    }
    log('Nothing to do.')
  } finally {
    releaseLock()
  }
}
