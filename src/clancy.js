import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CLAUDE_BIN } from './config.js'

const LOG_FILE = path.join(process.cwd(), 'logs', 'ralph.log')
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  fs.appendFileSync(LOG_FILE, line)
}

/**
 * Shell out to claude with a Clancy command.
 * @param {string} command  e.g. '/clancy:once' or '/clancy:brief --afk'
 * @param {string} cwd      project root (where .clancy/ lives)
 */
export async function runClancy(command, cwd) {
  return new Promise((resolve, reject) => {
    log(`→ Running: echo "${command}" | ${CLAUDE_BIN} --dangerously-skip-permissions`)
    log(`  cwd: ${cwd}`)

    const child = execFile(
      CLAUDE_BIN,
      ['--dangerously-skip-permissions'],
      {
        cwd,
        env: process.env,
        maxBuffer: 10 * 1024 * 1024 // 10 MB
      }
    )

    // Write the command to stdin
    child.stdin.write(command + '\n')
    child.stdin.end()

    const chunks = { stdout: [], stderr: [] }

    child.stdout.on('data', d => { fs.appendFileSync(LOG_FILE, d); chunks.stdout.push(d) })
    child.stderr.on('data', d => { fs.appendFileSync(LOG_FILE, d); chunks.stderr.push(d) })

    child.on('close', code => {
      log(`← Finished: ${command} (exit ${code})`)
      if (code === 0) {
        resolve()
      } else {
        const output = Buffer.concat(chunks.stderr).toString().trim()
          || Buffer.concat(chunks.stdout).toString().trim()
        const lastLine = output.split('\n').filter(Boolean).pop() || ''
        const summary = lastLine.slice(0, 200)
        const err = new Error(summary || `clancy exited with code ${code}`)
        err.exitCode = code
        err.clancyOutput = output.slice(-2000) // last 2 KB for the issue body
        reject(err)
      }
    })

    child.on('error', reject)
  })
}
