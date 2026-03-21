import { checkBrief } from '../check-brief.js'
import { runClancy } from '../clancy.js'

export async function briefPhase(ctx) {
  const brief = await checkBrief(ctx.username)
  if (!brief) return true

  ctx.log(`Brief: issue #${brief.issue.number} → ${brief.command}`)
  ctx.setAction('brief', brief.issue.number)
  await runClancy(brief.command, ctx.cwd)
  return false
}
