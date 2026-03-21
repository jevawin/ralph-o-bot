import { checkPlan } from '../check-plan.js'
import { runClancy } from '../clancy.js'

export async function planPhase(ctx) {
  const plan = await checkPlan(ctx.username)
  if (!plan) return true

  ctx.log(`Plan: issue #${plan.issue.number} → ${plan.command}`)
  await runClancy(plan.command, ctx.cwd)
  return false
}
