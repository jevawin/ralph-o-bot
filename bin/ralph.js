#!/usr/bin/env node
import { execSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const [,, subcommand] = process.argv

async function main() {
  switch (subcommand) {
    case 'run':
      await runOnce()
      break
    case 'start':
      await startDaemon()
      break
    case 'boot':
      await boot()
      break
    default:
      console.log(`ralph-o-bot v${pkg.version}

Usage:
  ralph-o-bot run    Single dispatch tick, then exit
  ralph-o-bot start  Start the daemon (run → sleep → run loop)
  ralph-o-bot boot   Install and start as a systemd service
`)
      process.exit(1)
  }
}

async function runOnce() {
  const { validateConfig } = await import('../src/config.js')
  await validateConfig()
  const { dispatch } = await import('../src/dispatch.js')
  await dispatch()
}

async function startDaemon() {
  const { validateConfig, GITHUB_REPO, RALPH_SLEEP_SECONDS } = await import('../src/config.js')
  await validateConfig()

  const isSystemd = Boolean(process.env.INVOCATION_ID)
  console.log(`Ralph-o-bot v${pkg.version} — at your service.`)
  console.log(`Watching ${GITHUB_REPO} every ${RALPH_SLEEP_SECONDS}s. Ctrl+C to stop.`)
  if (!isSystemd) {
    console.log(`\nTip: run 'ralph-o-bot boot' to install as a system service that starts on boot.`)
  }
  console.log()

  const { startDaemon } = await import('../src/scheduler.js')
  await startDaemon()
}

async function boot() {
  // 1. Check systemd
  try {
    execSync('which systemctl', { stdio: 'ignore' })
  } catch {
    console.log(`systemd not found. To run Ralph-o-bot on startup, add this to your crontab or init system:

  ralph-o-bot start

Or create a service file manually for your init system.`)
    process.exit(1)
  }

  // 2. Check global install
  let ralphBin
  try {
    ralphBin = execSync('which ralph-o-bot', { encoding: 'utf8' }).trim()
  } catch {
    console.log(`ralph-o-bot is not globally installed.
Run 'npm install -g ralph-o-bot' first, then re-run 'ralph-o-bot boot'.`)
    process.exit(1)
  }

  // 3. Check root
  if (process.getuid() !== 0) {
    console.log(`Installing a systemd service requires root.
Re-run with sudo: 'sudo ralph-o-bot boot'`)
    process.exit(1)
  }

  // 4. Write unit file
  const user = process.env.SUDO_USER || os.userInfo().username
  const cwd = process.cwd()
  const unitFile = `/etc/systemd/system/ralph-o-bot.service`

  const unit = `[Unit]
Description=Ralph-o-bot — Clancy automation runner
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${cwd}
ExecStart=${ralphBin} start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
`

  fs.writeFileSync(unitFile, unit)

  // 5. Enable and start
  execFileSync('systemctl', ['daemon-reload'])
  execFileSync('systemctl', ['enable', 'ralph-o-bot'])
  execFileSync('systemctl', ['start', 'ralph-o-bot'])

  console.log(`Ralph-o-bot is installed and running.
Check status with: systemctl status ralph-o-bot`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
