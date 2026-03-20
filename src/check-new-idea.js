import { NEW_IDEA_LABEL } from './config.js'
import { listIssues, removeLabel, addLabel } from './github.js'

/**
 * Check for new-idea labelled issues — kick off a brief and remove the label.
 * No comment check needed: new-idea issues are always fresh.
 * @param {string} username  GitHub login of the assignee
 */
export async function checkNewIdea(username) {
  const issues = await listIssues(NEW_IDEA_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const issue = issues[0]
  await removeLabel(issue.number, NEW_IDEA_LABEL)
  await addLabel(issue.number, 'clancy')

  return { command: `/clancy:brief --afk #${issue.number}`, issue }
}
