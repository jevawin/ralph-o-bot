import { BUILD_LABEL, BASE_BRANCH } from './config.js'
import { listIssues, findPRForIssue, listPRComments, listPRCommits, mergePR, deleteBranch, closeIssue } from './github.js'
import { classify } from './sentiment.js'
import { appendPRInstructions } from './instructions.js'

/**
 * Check for issues in review state — find linked PR, inspect latest comment.
 * @param {string} username  GitHub login of the assignee
 * @returns {{ command: string, issue: object } | { merged: true, pr: object } | null}
 */
export async function checkReview(username) {
  // Review state = open PR linked to a build-labelled issue (no review label needed)
  const issues = await listIssues(BUILD_LABEL, username)
  if (!issues.length) return null

  // Earliest created = highest priority
  issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  for (const issue of issues) {
    const prs = await findPRForIssue(issue.number)
    if (!prs.length) continue

    const pr = prs[0]
    const comments = await listPRComments(pr.number)

    await appendPRInstructions(pr, comments)

    // Find most recent comment from jevawin, excluding Ralph's own instructions comment
    let lastUserComment = null
    for (let i = comments.length - 1; i >= 0; i--) {
      const c = comments[i]
      if (c.user?.login === username && !c.body.includes('<!-- ralph-pr-instructions -->')) {
        lastUserComment = c
        break
      }
    }

    if (!lastUserComment) continue  // No jevawin comment yet — still waiting

    if (classify(lastUserComment.body) === 'approved') {
      const commitTitle = `${pr.title} (#${pr.number})`
      await mergePR(pr.number, commitTitle)
      try {
        await deleteBranch(pr.head.ref)
      } catch {
        // Branch delete is best-effort
      }
      // GitHub only auto-closes issues via "Closes #N" when merging to the default branch.
      // For epic-branch PRs, close the issue explicitly so Ralph doesn't re-trigger a build.
      if (pr.base.ref !== BASE_BRANCH) {
        await closeIssue(issue.number)
      }
      return { merged: true, pr, issue }
    }

    // Anything else — only act if no commit has landed since the comment
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
