import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CLAUDE_BIN } from './config.js'

const LOG_FILE = path.join(import.meta.dirname, '..', 'logs', 'ralph.log')

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

    child.stdout.on('data', d => fs.appendFileSync(LOG_FILE, d))
    child.stderr.on('data', d => fs.appendFileSync(LOG_FILE, d))

    child.on('close', code => {
      log(`← Finished: ${command} (exit ${code})`)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`clancy exited with code ${code}`))
      }
    })

    child.on('error', reject)
  })
}
