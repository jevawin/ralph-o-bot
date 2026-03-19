import { REVIEW_LABEL } from './config.js'
import { listIssues, findPRForIssue, listPRComments, mergePR, deleteBranch } from './github.js'
import { classify } from './sentiment.js'
import { getLastActioned, setLastActioned } from './state.js'

/**
 * Check for issues in review state — find linked PR, inspect latest comment.
 * @param {string} username  GitHub login of the assignee
 * @returns {{ command: string, issue: object } | { merged: true, pr: object } | null}
 */
export async function checkReview(username) {
  const issues = await listIssues(REVIEW_LABEL, username)
  if (!issues.length) return null

  for (const issue of issues) {
    const prs = await findPRForIssue(issue.number)
    if (!prs.length) continue

    const pr = prs[0]
    const comments = await listPRComments(pr.number)

    // Find most recent comment from jevawin
    let lastUserComment = null
    for (let i = comments.length - 1; i >= 0; i--) {
      if (comments[i].user?.login === username) {
        lastUserComment = comments[i]
        break
      }
    }

    if (!lastUserComment) continue  // No jevawin comment yet — still waiting

    const lastActioned = getLastActioned(`pr-${pr.number}`)

    if (lastActioned && lastActioned >= lastUserComment.id) {
      // Already acted on this comment — skip
      continue
    }

    const sentiment = classify(lastUserComment.body)

    if (sentiment === 'approved') {
      // Squash merge
      const commitTitle = `${pr.title} (#${pr.number})`
      await mergePR(pr.number, commitTitle)
      try {
        await deleteBranch(pr.head.ref)
      } catch {
        // Branch delete is best-effort
      }
      setLastActioned(`pr-${pr.number}`, lastUserComment.id)
      return { merged: true, pr, issue }
    }

    // Feedback (or any non-approval substantive comment) — run /clancy:once
    setLastActioned(`pr-${pr.number}`, lastUserComment.id)
    return { command: '/clancy:once', issue, pr }
  }

  return null
}
