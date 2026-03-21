import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/check-new-idea.js', () => ({ checkNewIdea: vi.fn() }))
vi.mock('../../src/clancy.js', () => ({ runClancy: vi.fn() }))

import { checkNewIdea } from '../../src/check-new-idea.js'
import { runClancy } from '../../src/clancy.js'
import { newIdeaPhase } from '../../src/phases/new-idea.js'

function makeCtx() {
  return { username: 'testuser', cwd: '/test', log: vi.fn(), setAction: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

describe('newIdeaPhase', () => {
  it('returns true and does nothing when no new ideas', async () => {
    checkNewIdea.mockResolvedValue(null)
    expect(await newIdeaPhase(makeCtx())).toBe(true)
    expect(runClancy).not.toHaveBeenCalled()
  })

  it('returns false and kicks off a brief', async () => {
    checkNewIdea.mockResolvedValue({ command: '/clancy:brief --afk #1', issue: { number: 1 } })
    const ctx = makeCtx()
    expect(await newIdeaPhase(ctx)).toBe(false)
    expect(runClancy).toHaveBeenCalledWith('/clancy:brief --afk #1', '/test')
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('#1'))
  })
})
