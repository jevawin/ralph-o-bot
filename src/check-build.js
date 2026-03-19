import { BUILD_LABEL } from './config.js'
import { listIssues } from './github.js'

/**
 * Check for issues in the build queue.
 * @param {string} username  GitHub login of the assignee
 */
export async function checkBuild(username) {
  const issues = await listIssues(BUILD_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const issue = issues[0]
  return { command: `/clancy:once --afk #${issue.number}`, issue }
}
