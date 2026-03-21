import { updateIssueBody, createIssueComment } from './github.js'

const MARKER = '<!-- ralph-instructions -->'
const PR_MARKER = '<!-- ralph-pr-instructions -->'

/**
 * Append interaction instructions to an issue body on first pickup.
 * No-ops if instructions are already present.
 * @param {object} issue     GitHub issue object (must include .number and .body)
 * @param {string} nextStage Human-readable name of the next pipeline stage
 */
export async function appendInstructions(issue, nextStage) {
  if ((issue.body || '').includes(MARKER)) return

  const instructions = [
    '',
    '',
    MARKER,
    '---',
    `_Reply **"approved"** to move to the next stage: **${nextStage}**. Any other reply is treated as feedback and will re-run Claude._`
  ].join('\n')

  await updateIssueBody(issue.number, (issue.body || '') + instructions)
}

/**
 * Post a one-time instructions comment on a PR on first pickup.
 * No-ops if the comment has already been posted.
 * @param {object} pr        GitHub PR object (must include .number)
 * @param {Array}  comments  Existing comments on the PR
 */
export async function appendPRInstructions(pr, comments) {
  if (comments.some(c => (c.body || '').includes(PR_MARKER))) return

  const body = [
    `_Reply **\`approved\`** to merge this PR, or **\`rework: your feedback\`** to request changes._`,
    PR_MARKER
  ].join('\n')

  await createIssueComment(pr.number, body)
}
