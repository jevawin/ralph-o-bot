import { checkReview } from '../check-review.js'
import { runClancy } from '../clancy.js'

export async function reviewPhase(ctx) {
  const review = await checkReview(ctx.username)
  if (!review) return true

  if (review.merged) {
    ctx.log(`Merged PR #${review.pr.number} for issue #${review.issue.number}`)
    return false
  }

  ctx.log(`Review feedback on PR #${review.pr.number} → ${review.command}`)
  await runClancy(review.command, ctx.cwd)
  return false
}
