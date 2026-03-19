import { PLAN_LABEL } from './config.js'
import { listIssues, listIssueComments } from './github.js'
import { classify } from './sentiment.js'

const PLAN_MARKER = '## Clancy Implementation Plan'

/**
 * Find most recent Clancy plan comment and any jevawin reply after it.
 */
function analyseComments(comments, username) {
  let lastPlanIdx = -1

  for (let i = 0; i < comments.length; i++) {
    if (comments[i].body && comments[i].body.includes(PLAN_MARKER)) {
      lastPlanIdx = i
    }
  }

  if (lastPlanIdx === -1) {
    return { hasPlan: false, response: null }
  }

  let lastUserComment = null
  for (let i = lastPlanIdx + 1; i < comments.length; i++) {
    if (comments[i].user?.login === username) {
      lastUserComment = comments[i]
    }
  }

  return { hasPlan: true, response: lastUserComment }
}

/**
 * Check plan-labelled issues and return the Clancy command to run, or null.
 * @param {string} username  GitHub login of the assignee
 */
export async function checkPlan(username) {
  const issues = await listIssues(PLAN_LABEL, username)
  if (!issues.length) return null

  const issue = issues[0]
  const comments = await listIssueComments(issue.number)
  const { hasPlan, response } = analyseComments(comments, username)

  if (!hasPlan) {
    return { command: '/clancy:plan', issue }
  }

  const sentiment = classify(response?.body)

  if (sentiment === 'approved') {
    // /clancy:approve-plan picks the oldest unapproved plan itself
    return { command: '/clancy:approve-plan', issue }
  }

  if (sentiment === 'feedback') {
    return { command: '/clancy:plan --fresh', issue }
  }

  return null
}
