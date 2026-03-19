import { getCurrentUser } from './github.js'
import { checkReview } from './check-review.js'
import { checkBuild } from './check-build.js'
import { checkPlan } from './check-plan.js'
import { checkBrief } from './check-brief.js'
import { runClancy } from './clancy.js'

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

/**
 * One tick of the dispatch loop.
 * Priority: review → build → plan → brief
 */
export async function dispatch() {
  const username = await getCurrentUser()
  const cwd = process.cwd()

  // 1. review
  const review = await checkReview(username)
  if (review) {
    if (review.merged) {
      log(`Merged PR #${review.pr.number} for issue #${review.issue.number}`)
      return
    }
    log(`Review feedback on PR #${review.pr.number} → ${review.command}`)
    await runClancy(review.command, cwd)
    return
  }

  // 2. build
  const build = await checkBuild(username)
  if (build) {
    log(`Build: issue #${build.issue.number} → ${build.command}`)
    await runClancy(build.command, cwd)
    return
  }

  // 3. plan
  const plan = await checkPlan(username)
  if (plan) {
    log(`Plan: issue #${plan.issue.number} → ${plan.command}`)
    await runClancy(plan.command, cwd)
    return
  }

  // 4. brief
  const brief = await checkBrief(username)
  if (brief) {
    log(`Brief: issue #${brief.issue.number} → ${brief.command}`)
    await runClancy(brief.command, cwd)
    return
  }

  log('Nothing to do.')
}
