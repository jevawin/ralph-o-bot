#!/usr/bin/env node
import { execSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const args = process.argv.slice(2)
const [subcommand] = args
const autoUpdate = args.includes('--auto-update')

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
    case 'update':
      await runUpdate()
      break
    case 'restart':
      restart()
      break
    default:
      console.log(`ralph-o-bot v${pkg.version}

Usage:
  ralph-o-bot run              Single dispatch tick, then exit
  ralph-o-bot start            Start the daemon (run → sleep → run loop)
  ralph-o-bot start --auto-update  Start daemon with automatic update checks
  ralph-o-bot boot             Install and start as a systemd service
  ralph-o-bot boot --auto-update   Install service with automatic update checks
  ralph-o-bot restart          Restart Ralph-o-bot (via systemd if installed, otherwise re-exec)
  ralph-o-bot update           Check for updates, show plan, prompt to apply
  ralph-o-bot update -y        Check for updates and apply without prompting
`)
      process.exit(1)
  }
}

async function runOnce() {
  const { validateConfig } = await import('../src/config.js')
  await validateConfig()
  try {
    execSync('git pull --rebase', { stdio: 'inherit', cwd: process.cwd() })
  } catch {
    console.warn('Warning: git pull --rebase failed — continuing anyway')
  }
  const { dispatch } = await import('../src/dispatch.js')
  await dispatch()
}

async function startDaemon() {
  const { validateConfig, GITHUB_REPO, RALPH_SLEEP_SECONDS } = await import('../src/config.js')
  await validateConfig()

  const isSystemd = Boolean(process.env.INVOCATION_ID)
  console.log(`Ralph-o-bot v${pkg.version} — at your service.`)
  console.log(`Watching ${GITHUB_REPO} every ${RALPH_SLEEP_SECONDS}s. Ctrl+C to stop.`)
  if (autoUpdate) console.log('Auto-update: enabled.')
  if (!isSystemd) {
    console.log(`\nTip: run 'ralph-o-bot boot' to install as a system service that starts on boot.`)
  }
  console.log()

  const { runClancy } = await import('../src/clancy.js')
  await runClancy('/clancy:update-docs', process.cwd())

  const { startDaemon: runDaemon } = await import('../src/scheduler.js')
  await runDaemon({ autoUpdate })
}

async function runUpdate() {
  const { validateConfig } = await import('../src/config.js')
  await validateConfig()
  const skipConfirm = args.includes('-y')
  const { applyUpdateInteractive } = await import('../src/updater.js')
  await applyUpdateInteractive({ skipConfirm })
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
    const answer = await promptYN('ralph-o-bot boot requires administrator privileges. Re-run with sudo? [y/N] ')
    if (!answer) process.exit(1)
    const bootArgs = autoUpdate ? ['boot', '--auto-update'] : ['boot']
    execFileSync('sudo', ['env', `PATH=${process.env.PATH}`, ralphBin, ...bootArgs], { stdio: 'inherit' })
    process.exit(0)
  }

  // 4. Write unit file
  const user = process.env.SUDO_USER || os.userInfo().username
  const cwd = process.cwd()
  const unitFile = `/etc/systemd/system/ralph-o-bot.service`

  // Collect the bin dirs that contain our key binaries so the service can find
  // them even though systemd runs with a minimal PATH. Dedup, filter empties.
  const binDirs = [...new Set([
    path.dirname(ralphBin),               // wherever ralph-o-bot lives (nvm, /usr/local, etc.)
    path.dirname(process.execPath),        // the node that is running right now
    '/usr/local/bin', '/usr/bin', '/bin',  // baseline system paths
  ])].filter(Boolean)
  const envPath = `Environment="PATH=${binDirs.join(':')}"`

  const startArgs = autoUpdate ? 'start --auto-update' : 'start'
  const unit = `[Unit]
Description=Ralph-o-bot — Clancy automation runner
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${cwd}
ExecStart=${ralphBin} ${startArgs}
${envPath}
Restart=always
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

function restart() {
  const unitFile = '/etc/systemd/system/ralph-o-bot.service'
  if (fs.existsSync(unitFile)) {
    execFileSync('sudo', ['systemctl', 'restart', 'ralph-o-bot'], { stdio: 'inherit' })
  } else {
    execFileSync(process.execPath, [process.argv[1], 'start'], { stdio: 'inherit' })
    process.exit(0)
  }
}

function promptYN(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
