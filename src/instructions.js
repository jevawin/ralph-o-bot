import { updateIssueBody } from './github.js'

const MARKER = '<!-- ralph-instructions -->'

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
    `_Reply **"approved"** to move to the next stage: **${nextStage}**. Reply with answers or further questions to continue the discussion with Claude._`
  ].join('\n')

  await updateIssueBody(issue.number, (issue.body || '') + instructions)
}
