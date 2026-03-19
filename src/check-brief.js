import { BRIEF_LABEL } from './config.js'
import { listIssues, listIssueComments } from './github.js'
import { classify } from './sentiment.js'

const BRIEF_MARKER = '# Clancy Strategic Brief'

/**
 * Find most recent Clancy brief comment and any jevawin reply after it.
 */
function analyseComments(comments, username) {
  let lastBriefIdx = -1

  for (let i = 0; i < comments.length; i++) {
    if (comments[i].body && comments[i].body.includes(BRIEF_MARKER)) {
      lastBriefIdx = i
    }
  }

  if (lastBriefIdx === -1) {
    // No brief posted yet
    return { hasBrief: false, response: null }
  }

  // Find most recent jevawin comment AFTER the brief
  let lastUserComment = null
  for (let i = lastBriefIdx + 1; i < comments.length; i++) {
    if (comments[i].user?.login === username) {
      lastUserComment = comments[i]
    }
  }

  return { hasBrief: true, response: lastUserComment }
}

/**
 * Check brief-labelled issues and return the Clancy command to run, or null.
 * @param {string} username  GitHub login of the assignee
 */
export async function checkBrief(username) {
  const issues = await listIssues(BRIEF_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  for (const issue of issues) {
    const comments = await listIssueComments(issue.number)
    const { hasBrief, response } = analyseComments(comments, username)

    if (!hasBrief) {
      return { command: `/clancy:brief --afk #${issue.number}`, issue }
    }

    const sentiment = classify(response?.body)

    if (sentiment === 'approved') {
      return { command: `/clancy:approve-brief --afk #${issue.number}`, issue }
    }

    if (sentiment === 'feedback') {
      return { command: `/clancy:brief --afk #${issue.number}`, issue }
    }

    // Latest comment is Clancy's — skip to next ticket
  }

  return null
}
