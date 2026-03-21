import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/check-brief.js', () => ({ checkBrief: vi.fn() }))
vi.mock('../../src/clancy.js', () => ({ runClancy: vi.fn() }))

import { checkBrief } from '../../src/check-brief.js'
import { runClancy } from '../../src/clancy.js'
import { briefPhase } from '../../src/phases/brief.js'

function makeCtx() {
  return { username: 'testuser', cwd: '/test', log: vi.fn(), setAction: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

describe('briefPhase', () => {
  it('returns true and does nothing when no brief work', async () => {
    checkBrief.mockResolvedValue(null)
    expect(await briefPhase(makeCtx())).toBe(true)
    expect(runClancy).not.toHaveBeenCalled()
  })

  it('returns false and runs the brief command', async () => {
    checkBrief.mockResolvedValue({ command: '/clancy:brief --afk #2', issue: { number: 2 } })
    const ctx = makeCtx()
    expect(await briefPhase(ctx)).toBe(false)
    expect(runClancy).toHaveBeenCalledWith('/clancy:brief --afk #2', '/test')
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('#2'))
  })

  it('passes the approve-brief command through unchanged', async () => {
    checkBrief.mockResolvedValue({ command: '/clancy:approve-brief --afk #2', issue: { number: 2 } })
    const ctx = makeCtx()
    await briefPhase(ctx)
    expect(runClancy).toHaveBeenCalledWith('/clancy:approve-brief --afk #2', '/test')
  })
})
