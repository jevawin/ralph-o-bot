import { checkBuild } from '../check-build.js'
import { runClancy } from '../clancy.js'

export async function buildPhase(ctx) {
  const build = await checkBuild(ctx.username)
  if (!build) return true

  ctx.log(`Build: issue #${build.issue.number} → ${build.command}`)
  ctx.setAction('build', build.issue.number)
  await runClancy(build.command, ctx.cwd)
  ctx.log('Build complete — updating docs')
  await runClancy('/clancy:update-docs', ctx.cwd)
  return false
}
