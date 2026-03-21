import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/check-review.js', () => ({ checkReview: vi.fn() }))
vi.mock('../../src/clancy.js', () => ({ runClancy: vi.fn() }))

import { checkReview } from '../../src/check-review.js'
import { runClancy } from '../../src/clancy.js'
import { reviewPhase } from '../../src/phases/review.js'

function makeCtx() {
  return { username: 'testuser', cwd: '/test', log: vi.fn(), setAction: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

describe('reviewPhase', () => {
  it('returns true and does nothing when no review', async () => {
    checkReview.mockResolvedValue(null)
    expect(await reviewPhase(makeCtx())).toBe(true)
    expect(runClancy).not.toHaveBeenCalled()
  })

  it('returns false and logs when PR is merged', async () => {
    checkReview.mockResolvedValue({ merged: true, pr: { number: 42 }, issue: { number: 7 } })
    const ctx = makeCtx()
    expect(await reviewPhase(ctx)).toBe(false)
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('Merged PR #42'))
    expect(runClancy).not.toHaveBeenCalled()
  })

  it('returns false and runs clancy when there is review feedback', async () => {
    checkReview.mockResolvedValue({ command: '/clancy:once --afk #7', pr: { number: 42 }, issue: { number: 7 } })
    const ctx = makeCtx()
    expect(await reviewPhase(ctx)).toBe(false)
    expect(runClancy).toHaveBeenCalledWith('/clancy:once --afk #7', '/test')
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('PR #42'))
  })
})
