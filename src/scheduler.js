import os from 'node:os'
import { dispatch } from './dispatch.js'
import {
  RALPH_SLEEP_SECONDS,
  RALPH_QUIET_START,
  RALPH_QUIET_END,
  RALPH_RESOURCE_CHECK,
  RALPH_MIN_FREE_MEM_MB,
  RALPH_MAX_LOAD_PER_CORE,
  RALPH_UPDATE_CHECK_INTERVAL_HOURS,
} from './config.js'

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseHHMM(str) {
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
}

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

async function waitForQuietHoursEnd() {
  const start = parseHHMM(RALPH_QUIET_START)
  const end = parseHHMM(RALPH_QUIET_END)

  // 00:00–00:00 means disabled
  if (start === end) return

  const now = nowMinutes()

  // Determine if we're inside the quiet window
  let inQuiet
  if (start < end) {
    // Same-day window e.g. 09:00–17:00
    inQuiet = now >= start && now < end
  } else {
    // Overnight window e.g. 23:00–07:00
    inQuiet = now >= start || now < end
  }

  if (!inQuiet) return

  // Sleep until end of quiet window
  const msUntilEnd = (() => {
    const endMins = end
    let minutesUntil = endMins - now
    if (minutesUntil <= 0) minutesUntil += 24 * 60
    return minutesUntil * 60 * 1000
  })()

  log(`Quiet hours — sleeping until ${RALPH_QUIET_END} (${Math.round(msUntilEnd / 60000)}m)`)
  await sleep(msUntilEnd)
}

function resourcesOk() {
  if (!RALPH_RESOURCE_CHECK) return true

  const freeMB = os.freemem() / 1024 / 1024
  // loadavg returns [0,0,0] on Windows — load check always passes there
  const loadPerCore = os.loadavg()[0] / Math.max(os.cpus().length, 1)

  if (freeMB < RALPH_MIN_FREE_MEM_MB) {
    log(`Skipping — free memory ${Math.round(freeMB)}MB < ${RALPH_MIN_FREE_MEM_MB}MB`)
    return false
  }
  if (loadPerCore > RALPH_MAX_LOAD_PER_CORE) {
    log(`Skipping — load/core ${loadPerCore.toFixed(2)} > ${RALPH_MAX_LOAD_PER_CORE}`)
    return false
  }
  return true
}

export async function startDaemon({ autoUpdate = false } = {}) {
  // 0 = check immediately on first tick; Infinity = never check
  let lastUpdateCheck = autoUpdate ? 0 : Infinity

  while (true) {
    await waitForQuietHoursEnd()

    // Periodic update check (only when --auto-update is active)
    if (autoUpdate) {
      const now = Date.now()
      const intervalMs = RALPH_UPDATE_CHECK_INTERVAL_HOURS * 3600 * 1000
      if (now - lastUpdateCheck >= intervalMs) {
        try {
          const { checkAndHandleUpdate } = await import('./updater.js')
          await checkAndHandleUpdate()
        } catch (err) {
          log(`Update check error: ${err.message}`)
        }
        lastUpdateCheck = Date.now()
      }
    }

    if (resourcesOk()) {
      try {
        await dispatch()
      } catch (err) {
        log(`Error during dispatch: ${err.message}`)
      }
    }

    await sleep(RALPH_SLEEP_SECONDS * 1000)
  }
}
