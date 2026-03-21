import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { execSync, execFileSync } from 'node:child_process'

// Load .clancy/.env from project root (label names, shared with Clancy)
dotenv.config({ path: path.join(process.cwd(), '.clancy/.env') })
// Load ralph's own .env (GITHUB_TOKEN, CLAUDE_BIN, scheduler settings)
dotenv.config({ path: path.join(process.cwd(), '.env') })

// Label names — read directly from Clancy's env vars, matching Clancy's own defaults
export const BRIEF_LABEL    = process.env.CLANCY_LABEL_BRIEF ?? 'clancy:brief'
export const PLAN_LABEL     = process.env.CLANCY_LABEL_PLAN  ?? 'clancy:plan'
export const BUILD_LABEL    = process.env.CLANCY_LABEL_BUILD ?? 'clancy:build'
export const NEW_IDEA_LABEL = 'new-idea'

// GitHub
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN
export const GITHUB_REPO  = process.env.GITHUB_REPO   // e.g. "jevawin/clumeral-game"

// Clancy runner — resolve claude binary
export const CLAUDE_BIN = process.env.CLAUDE_BIN || resolveClaude()

function resolveClaude() {
  const home = process.env.HOME || ''
  const candidates = [
    path.join(home, '.local/bin/claude'),                    // Linux pip/deb
    path.join(home, '.nvm/versions/node/current/bin/claude'), // nvm (current)
    '/usr/local/bin/claude',                                 // system-wide
    '/opt/homebrew/bin/claude',                              // macOS Homebrew
  ]

  // Also glob nvm versioned paths (e.g. ~/.nvm/versions/node/v24.x.x/bin/claude)
  const nvmBase = path.join(home, '.nvm/versions/node')
  if (fs.existsSync(nvmBase)) {
    for (const v of fs.readdirSync(nvmBase)) {
      candidates.push(path.join(nvmBase, v, 'bin/claude'))
    }
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }

  return 'claude' // last resort — rely on PATH
}

function envInt(name, def) {
  const v = parseInt(process.env[name], 10)
  return isNaN(v) || v <= 0 ? def : v
}

function envFloat(name, def) {
  const v = parseFloat(process.env[name])
  return isNaN(v) || v <= 0 ? def : v
}

// Auto-update
export const RALPH_UPDATE_CHECK_INTERVAL_HOURS = envFloat('RALPH_UPDATE_CHECK_INTERVAL_HOURS', 24)
export const RALPH_MOCK_LATEST_VERSION         = process.env.RALPH_MOCK_LATEST_VERSION || null

// Scheduler
export const RALPH_SLEEP_SECONDS     = envInt('RALPH_SLEEP_SECONDS', 30)
export const RALPH_QUIET_START       = process.env.RALPH_QUIET_START || '00:00'
export const RALPH_QUIET_END         = process.env.RALPH_QUIET_END   || '00:00'
export const RALPH_RESOURCE_CHECK    = process.env.RALPH_RESOURCE_CHECK !== 'false'
export const RALPH_MIN_FREE_MEM_MB   = envInt('RALPH_MIN_FREE_MEM_MB', 256)
export const RALPH_MAX_LOAD_PER_CORE = envFloat('RALPH_MAX_LOAD_PER_CORE', 0.8)

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer) }))
}

function validateEnv() {
  const errors = []

  // Required vars
  if (!process.env.GITHUB_TOKEN) {
    errors.push('GITHUB_TOKEN is missing — add it to your .env file')
  }
  if (!process.env.GITHUB_REPO) {
    errors.push('GITHUB_REPO is missing — add it to your .env file (e.g. owner/repo)')
  } else if (!/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPO)) {
    errors.push(`GITHUB_REPO is invalid: "${process.env.GITHUB_REPO}" — expected owner/repo format (e.g. jevawin/my-project)`)
  }

  if (errors.length) {
    console.error('Ralph-o-bot: configuration error' + (errors.length > 1 ? 's' : '') + ':\n  ' + errors.join('\n  '))
    process.exit(1)
  }

  // Optional vars — warn when set to bad values (exports already fall back to defaults)
  const rawSleep = process.env.RALPH_SLEEP_SECONDS
  if (rawSleep !== undefined && (isNaN(parseInt(rawSleep, 10)) || parseInt(rawSleep, 10) <= 0)) {
    console.warn(`Warning: RALPH_SLEEP_SECONDS="${rawSleep}" is invalid — using default 30s`)
  }
  const rawMem = process.env.RALPH_MIN_FREE_MEM_MB
  if (rawMem !== undefined && (isNaN(parseInt(rawMem, 10)) || parseInt(rawMem, 10) < 0)) {
    console.warn(`Warning: RALPH_MIN_FREE_MEM_MB="${rawMem}" is invalid — using default 256`)
  }
  const rawLoad = process.env.RALPH_MAX_LOAD_PER_CORE
  if (rawLoad !== undefined && (isNaN(parseFloat(rawLoad)) || parseFloat(rawLoad) <= 0)) {
    console.warn(`Warning: RALPH_MAX_LOAD_PER_CORE="${rawLoad}" is invalid — using default 0.8`)
  }

  const timeRe = /^\d{2}:\d{2}$/
  if (process.env.RALPH_QUIET_START && !timeRe.test(process.env.RALPH_QUIET_START)) {
    console.warn(`Warning: RALPH_QUIET_START="${process.env.RALPH_QUIET_START}" is invalid — expected HH:MM, quiet hours disabled`)
  }
  if (process.env.RALPH_QUIET_END && !timeRe.test(process.env.RALPH_QUIET_END)) {
    console.warn(`Warning: RALPH_QUIET_END="${process.env.RALPH_QUIET_END}" is invalid — expected HH:MM, quiet hours disabled`)
  }
}

export async function validateConfig({ isUpdate = false } = {}) {
  validateEnv()

  // Check the claude binary is accessible
  try {
    execSync(`which ${CLAUDE_BIN}`, { stdio: 'ignore' })
  } catch {
    console.error(`Ralph-o-bot: claude CLI not found at '${CLAUDE_BIN}'.

Install Claude Code: https://docs.anthropic.com/en/docs/claude-code
Or set CLAUDE_BIN in .env to the correct path.`)
    process.exit(1)
  }

  // Check Clancy is installed (.clancy/ directory in project root)
  const clancyDir = path.join(process.cwd(), '.clancy')
  if (!fs.existsSync(clancyDir)) {
    if (isUpdate) {
      console.error(`No .clancy/ directory found in ${process.cwd()}.

You're probably in the wrong directory — run ralph-o-bot from your project root (the folder that contains .clancy/).

To set up Ralph-o-bot fresh in this directory, run: ralph-o-bot init`)
      process.exit(1)
    }

    const answer = await prompt(
      `No .clancy/ directory found in ${process.cwd()}.

You may be in the wrong directory — ralph-o-bot should be run from your project root (the folder that contains .clancy/).

To set up Ralph-o-bot fresh in this directory instead, run: ralph-o-bot init

Install Clancy here now? y/n: `
    )
    if (answer.trim().toLowerCase() === 'y') {
      console.log('Installing Clancy...')
      execFileSync('npx', ['chief-clancy'], { stdio: 'inherit', cwd: process.cwd() })
      console.log()
    } else {
      console.log('Aborted. cd into your project root and try again, or run `ralph-o-bot init` to set up here.')
      process.exit(0)
    }
  }

  // Check Clancy is initialised (.clancy/.env exists)
  const clancyEnv = path.join(process.cwd(), '.clancy/.env')
  if (!fs.existsSync(clancyEnv)) {
    console.log('Clancy is installed but not initialised for this project. Running /clancy:init...\n')
    const { runClancy } = await import('./clancy.js')
    await runClancy('/clancy:init', process.cwd())
    console.log()
  }

}
