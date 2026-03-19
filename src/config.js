import dotenv from 'dotenv'
import path from 'node:path'

// Load .clancy/.env from project root (label names, shared with Clancy)
dotenv.config({ path: path.join(process.cwd(), '.clancy/.env') })
// Load ralph's own .env (GITHUB_TOKEN, CLAUDE_BIN, scheduler settings)
dotenv.config({ path: path.join(process.cwd(), '.env') })

// Label names — sourced from Clancy's config
export const BRIEF_LABEL  = process.env.CLANCY_BRIEF_LABEL
export const PLAN_LABEL   = process.env.CLANCY_PLAN_LABEL
export const BUILD_LABEL  = process.env.CLANCY_LABEL
export const REVIEW_LABEL = process.env.CLANCY_STATUS_DONE

// GitHub
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN
export const GITHUB_REPO  = process.env.GITHUB_REPO   // e.g. "jevawin/clumeral-game"

// Clancy runner
export const CLAUDE_BIN   = process.env.CLAUDE_BIN || 'claude'

// Scheduler
export const RALPH_SLEEP_SECONDS    = parseInt(process.env.RALPH_SLEEP_SECONDS || '30', 10)
export const RALPH_QUIET_START      = process.env.RALPH_QUIET_START || '00:00'
export const RALPH_QUIET_END        = process.env.RALPH_QUIET_END   || '00:00'
export const RALPH_RESOURCE_CHECK   = process.env.RALPH_RESOURCE_CHECK !== 'false'
export const RALPH_MIN_FREE_MEM_MB  = parseInt(process.env.RALPH_MIN_FREE_MEM_MB || '256', 10)
export const RALPH_MAX_LOAD_PER_CORE = parseFloat(process.env.RALPH_MAX_LOAD_PER_CORE || '0.8')

export function validateConfig() {
  const missing = []
  if (!BRIEF_LABEL)  missing.push('CLANCY_BRIEF_LABEL (from .clancy/.env)')
  if (!PLAN_LABEL)   missing.push('CLANCY_PLAN_LABEL (from .clancy/.env)')
  if (!BUILD_LABEL)  missing.push('CLANCY_LABEL (from .clancy/.env)')
  if (!REVIEW_LABEL) missing.push('CLANCY_STATUS_DONE (from .clancy/.env)')
  if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN (from .env)')
  if (!GITHUB_REPO)  missing.push('GITHUB_REPO (from .env or .clancy/.env)')
  if (missing.length) {
    console.error('Ralph-o-bot: missing required config:\n  ' + missing.join('\n  '))
    process.exit(1)
  }
}
