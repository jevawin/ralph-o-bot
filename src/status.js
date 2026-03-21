import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  RALPH_SLEEP_SECONDS,
  RALPH_QUIET_START,
  RALPH_QUIET_END,
  RALPH_RESOURCE_CHECK,
  RALPH_MIN_FREE_MEM_MB,
  RALPH_MAX_LOAD_PER_CORE,
} from './config.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const UNIT_FILE = '/etc/systemd/system/ralph-o-bot.service'
const LOG_FILE = path.join(process.cwd(), 'logs/ralph.log')

// Lines that are scheduler/updater noise — not dispatch actions
const NOISE = [
  /Nothing to do\./,
  /Quiet hours/,
  /Skipping — /,
  /Update check error/,
  /Error during dispatch/,
  /Dispatch paused/,
  /Build complete — updating docs/,
  /\[update\]/,
]

function isAction(line) {
  return NOISE.every(p => !p.test(line))
}

function parseLogLine(line) {
  const match = line.match(/^\[([^\]]+)\] (.+)$/)
  if (!match) return null
  const time = new Date(match[1])
  return isNaN(time) ? null : { time, message: match[2] }
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function readLogLines() {
  if (!fs.existsSync(LOG_FILE)) return []
  const content = fs.readFileSync(LOG_FILE, 'utf8')
  return content.split('\n').filter(Boolean)
}

function getLastTick(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = parseLogLine(lines[i])
    if (parsed && !/\[update\]/.test(lines[i])) return parsed
  }
  return null
}

function getLastAction(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = parseLogLine(lines[i])
    if (parsed && isAction(lines[i])) return parsed
  }
  return null
}

function getServiceStatus() {
  if (!fs.existsSync(UNIT_FILE)) return { installed: false }
  try {
    const active = execSync('systemctl is-active ralph-o-bot', { encoding: 'utf8' }).trim()
    let since = null
    try {
      const ts = execSync('systemctl show ralph-o-bot --property=ActiveEnterTimestamp --value', { encoding: 'utf8' }).trim()
      const date = new Date(ts)
      if (!isNaN(date)) since = formatTime(date)
    } catch {}
    return { installed: true, active, since }
  } catch {
    // systemctl is-active exits non-zero when inactive
    return { installed: true, active: 'inactive', since: null }
  }
}

async function getLatestVersion() {
  try {
    const res = await fetch('https://registry.npmjs.org/ralph-o-bot/latest')
    if (!res.ok) return null
    const data = await res.json()
    return data.version
  } catch {
    return null
  }
}

function isNewer(a, b) {
  const [aM, am, ap] = a.split('.').map(Number)
  const [bM, bm, bp] = b.split('.').map(Number)
  if (aM !== bM) return aM > bM
  if (am !== bm) return am > bm
  return ap > bp
}

export async function printStatus() {
  const [lines, latestVersion] = await Promise.all([
    Promise.resolve(readLogLines()),
    getLatestVersion(),
  ])

  const lastTick   = getLastTick(lines)
  const lastAction = getLastAction(lines)
  const service    = getServiceStatus()
  const freeMB     = Math.round(os.freemem() / 1024 / 1024)
  const loadPerCore = (os.loadavg()[0] / Math.max(os.cpus().length, 1)).toFixed(2)
  const quietDisabled = RALPH_QUIET_START === RALPH_QUIET_END

  const updateLine = !latestVersion
    ? 'unknown (registry unreachable)'
    : isNewer(latestVersion, pkg.version)
      ? `v${latestVersion} available — run ralph-o-bot update`
      : 'up to date'

  const serviceStatus = !service.installed
    ? 'not installed as service'
    : service.active === 'active'
      ? `running (systemd)${service.since ? ` · up since ${service.since}` : ''}`
      : `${service.active} (systemd)`

  const lastTickStr = lastTick
    ? `${formatTime(lastTick.time)} · ${lastTick.message}`
    : 'no log entries'

  const lastActionStr = lastAction
    ? `${formatTime(lastAction.time)} · ${lastAction.message}`
    : 'none recorded'

  const memOk  = freeMB >= RALPH_MIN_FREE_MEM_MB
  const loadOk = parseFloat(loadPerCore) <= RALPH_MAX_LOAD_PER_CORE

  const desiredClancy = pkg.clancyVersion || 'unknown'
  let actualClancy = null
  try {
    const clancyPkg = require(path.join(process.cwd(), 'node_modules/chief-clancy/package.json'))
    actualClancy = clancyPkg.version
  } catch {}

  const clancyMismatch = desiredClancy !== 'latest' && actualClancy && actualClancy !== desiredClancy

  console.log(`Ralph-o-bot v${pkg.version}`)
  console.log(`Update:  ${updateLine}`)
  console.log()
  console.log('CLANCY')
  console.log(`  Desired:  ${desiredClancy}`)
  console.log(`  Actual:   ${actualClancy ? `v${actualClancy}` : 'not found'}`)
  if (clancyMismatch) {
    console.log()
    console.log(`  Warning: Clancy version mismatch. Ralph-o-bot may misbehave.`)
    console.log(`  Run \`ralph-o-bot reinstall-clancy\` to install the correct version.`)
  }
  console.log()
  console.log('SERVICE')
  console.log(`  Status:       ${serviceStatus}`)
  console.log()
  console.log('ACTIVITY')
  console.log(`  Last tick:    ${lastTickStr}`)
  console.log(`  Last action:  ${lastActionStr}`)
  console.log()
  console.log('SCHEDULE')
  console.log(`  Poll:         every ${RALPH_SLEEP_SECONDS}s`)
  console.log(`  Quiet hours:  ${quietDisabled ? 'disabled' : `${RALPH_QUIET_START}–${RALPH_QUIET_END}`}`)
  console.log()
  console.log('RESOURCES')
  if (RALPH_RESOURCE_CHECK) {
    console.log(`  Free memory:  ${freeMB} MB ${memOk ? '✓' : '✗'}  (min ${RALPH_MIN_FREE_MEM_MB} MB)`)
    console.log(`  Load/core:    ${loadPerCore} ${loadOk ? '✓' : '✗'}  (max ${RALPH_MAX_LOAD_PER_CORE})`)
  } else {
    console.log('  Check:        disabled')
  }
}
