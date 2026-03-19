import { BUILD_LABEL, PLAN_LABEL } from './config.js'
import { listIssues, findPRForIssue } from './github.js'

/**
 * Check for issues in the build queue.
 * @param {string} username  GitHub login of the assignee
 */
export async function checkBuild(username) {
  const issues = await listIssues(BUILD_LABEL, username)
  if (!issues.length) return null

  // Skip issues still in the plan queue — they need planning before building
  const buildable = issues.filter(i => !i.labels.some(l => l.name === PLAN_LABEL))
  if (!buildable.length) return null

  // Earliest created = highest priority
  buildable.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  for (const issue of buildable) {
    // Skip issues with an open PR — they're in review, handled by checkReview
    const prs = await findPRForIssue(issue.number)
    if (prs.length) continue

    return { command: `/clancy:once --afk #${issue.number}`, issue }
  }

  return null
}
