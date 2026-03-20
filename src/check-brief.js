import { BRIEF_LABEL } from './config.js'
import { listIssues, listIssueComments } from './github.js'
import { classify } from './sentiment.js'
import { appendInstructions } from './instructions.js'

const BRIEF_MARKER = '# Clancy Strategic Brief'
const APPROVED_TICKETS_MARKER = '## Clancy — Approved Tickets'

/**
 * Classify the latest comment on an issue:
 * - 'clancy'   → latest comment is a Clancy brief (wait for user)
 * - 'approved' → user said "approved"
 * - 'feedback' → user left other feedback
 * - 'none'     → no comments yet
 */
function classifyLatest(comments) {
  if (!comments.length) return 'none'

  // Epic already decomposed — detected anywhere in comments
  if (comments.some(c => c.body?.includes(APPROVED_TICKETS_MARKER))) return 'epic'

  const latest = comments[comments.length - 1]
  if (latest.body?.includes(BRIEF_MARKER)) return 'clancy'
  if (classify(latest.body) === 'approved') return 'approved'
  return 'feedback'
}

/**
 * Check clancy:brief labelled issues for approved/feedback comments.
 * New ideas are handled upstream by checkNewIdea — by the time an issue
 * reaches this stage Clancy has already posted a brief.
 * @param {string} username  GitHub login of the assignee — used to scope issues, not comment detection
 */
export async function checkBrief(username) {
  const issues = await listIssues(BRIEF_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  for (const issue of issues) {
    const comments = await listIssueComments(issue.number)
    const state = classifyLatest(comments)

    if (state === 'epic') continue  // Child tickets already in flight — epic stays as anchor, skip
    if (state === 'clancy') continue  // Clancy posted — waiting for user

    // Append instructions on first pickup (guarded by marker — runs once)
    await appendInstructions(issue, 'plan')

    if (state === 'approved') {
      return { command: `/clancy:approve-brief --afk #${issue.number}`, issue }
    }

    // 'none' or 'feedback'
    return { command: `/clancy:brief --afk #${issue.number}`, issue }
  }

  return null
}
