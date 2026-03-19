import { BUILD_LABEL } from './config.js'
import { listIssues } from './github.js'

/**
 * Check for issues in the build queue.
 * @param {string} username  GitHub login of the assignee
 */
export async function checkBuild(username) {
  const issues = await listIssues(BUILD_LABEL, username)
  if (!issues.length) return null

  return { command: '/clancy:once', issue: issues[0] }
}
