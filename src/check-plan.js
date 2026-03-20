import { PLAN_LABEL } from './config.js'
import { listIssues, listIssueComments } from './github.js'
import { classify } from './sentiment.js'
import { appendInstructions } from './instructions.js'

const PLAN_MARKER = '## Clancy Implementation Plan'

/**
 * Classify the latest comment on an issue:
 * - 'clancy'   → latest comment is a Clancy plan (wait for user)
 * - 'approved' → user said "approved"
 * - 'feedback' → user left other feedback
 * - 'none'     → no comments / no plan posted yet
 */
function classifyLatest(comments) {
  if (!comments.length) return 'none'
  if (!comments.some(c => c.body?.includes(PLAN_MARKER))) return 'none'

  const latest = comments[comments.length - 1]
  if (latest.body?.includes(PLAN_MARKER)) return 'clancy'
  if (classify(latest.body) === 'approved') return 'approved'
  return 'feedback'
}

/**
 * Check plan-labelled issues and return the Clancy command to run, or null.
 * @param {string} username  GitHub login of the assignee — used to scope issues, not comment detection
 */
export async function checkPlan(username) {
  const issues = await listIssues(PLAN_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  for (const issue of issues) {
    const comments = await listIssueComments(issue.number)
    const state = classifyLatest(comments)

    if (state === 'clancy') continue  // Clancy posted — waiting for user

    await appendInstructions(issue, 'build')

    if (state === 'none') {
      return { command: `/clancy:plan --afk #${issue.number}`, issue }
    }

    if (state === 'approved') {
      return { command: `/clancy:approve-plan --afk #${issue.number}`, issue }
    }

    // 'feedback'
    return { command: `/clancy:plan --fresh --afk #${issue.number}`, issue }
  }

  return null
}
