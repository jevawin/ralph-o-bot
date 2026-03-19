import { REVIEW_LABEL } from './config.js'
import { listIssues, findPRForIssue, listPRComments, listPRCommits, mergePR, deleteBranch } from './github.js'
import { classify } from './sentiment.js'

/**
 * Check for issues in review state — find linked PR, inspect latest comment.
 * @param {string} username  GitHub login of the assignee
 * @returns {{ command: string, issue: object } | { merged: true, pr: object } | null}
 */
export async function checkReview(username) {
  const issues = await listIssues(REVIEW_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

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

    const sentiment = classify(lastUserComment.body)

    if (sentiment === 'approved') {
      const commitTitle = `${pr.title} (#${pr.number})`
      await mergePR(pr.number, commitTitle)
      try {
        await deleteBranch(pr.head.ref)
      } catch {
        // Branch delete is best-effort
      }
      return { merged: true, pr, issue }
    }

    // Feedback — only act if no commit has landed since the comment
    const commits = await listPRCommits(pr.number)
    const lastCommitDate = commits.length
      ? new Date(commits[commits.length - 1].commit.committer.date)
      : new Date(0)
    const commentDate = new Date(lastUserComment.created_at)

    if (lastCommitDate > commentDate) {
      // Clancy already acted on this feedback — skip
      continue
    }

    return { command: `/clancy:once --afk #${issue.number}`, issue, pr }
  }

  return null
}
