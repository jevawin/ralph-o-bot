import fs from 'node:fs'
import path from 'node:path'

const STATE_FILE = path.join(process.cwd(), '.state.json')

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function save(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

/** Get the last comment ID Ralph acted on for a given issue/PR number */
export function getLastActioned(id) {
  const state = load()
  return state[String(id)] ?? null
}

/** Record that Ralph acted on a comment */
export function setLastActioned(id, commentId) {
  const state = load()
  state[String(id)] = commentId
  save(state)
}
