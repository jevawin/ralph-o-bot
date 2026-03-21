import { checkNewIdea } from '../check-new-idea.js'
import { runClancy } from '../clancy.js'

export async function newIdeaPhase(ctx) {
  const newIdea = await checkNewIdea(ctx.username)
  if (!newIdea) return true

  ctx.log(`New idea: issue #${newIdea.issue.number} → ${newIdea.command}`)
  await runClancy(newIdea.command, ctx.cwd)
  return false
}
