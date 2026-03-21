import { checkUpdateApproval, checkUpdateBlocked, applyUpdate } from '../updater.js'

export async function updatePhase(ctx) {
  const updateApproval = await checkUpdateApproval(ctx.username)
  if (updateApproval) {
    ctx.log(`Update:pending approved — applying v${updateApproval.latestVersion}`)
    await applyUpdate(updateApproval.latestVersion, updateApproval.migration, updateApproval.issue)
    return false
  }

  if (await checkUpdateBlocked()) {
    ctx.log('Dispatch paused — update pending or action required.')
    return false
  }

  return true
}
