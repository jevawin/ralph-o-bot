import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/check-plan.js', () => ({ checkPlan: vi.fn() }))
vi.mock('../../src/clancy.js', () => ({ runClancy: vi.fn() }))

import { checkPlan } from '../../src/check-plan.js'
import { runClancy } from '../../src/clancy.js'
import { planPhase } from '../../src/phases/plan.js'

function makeCtx() {
  return { username: 'testuser', cwd: '/test', log: vi.fn(), setAction: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

describe('planPhase', () => {
  it('returns true and does nothing when no plan work', async () => {
    checkPlan.mockResolvedValue(null)
    expect(await planPhase(makeCtx())).toBe(true)
    expect(runClancy).not.toHaveBeenCalled()
  })

  it('returns false and runs the plan command', async () => {
    checkPlan.mockResolvedValue({ command: '/clancy:plan --afk #5', issue: { number: 5 } })
    const ctx = makeCtx()
    expect(await planPhase(ctx)).toBe(false)
    expect(runClancy).toHaveBeenCalledWith('/clancy:plan --afk #5', '/test')
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('#5'))
  })

  it('passes the approve-plan command through unchanged', async () => {
    checkPlan.mockResolvedValue({ command: '/clancy:approve-plan --afk #5', issue: { number: 5 } })
    const ctx = makeCtx()
    await planPhase(ctx)
    expect(runClancy).toHaveBeenCalledWith('/clancy:approve-plan --afk #5', '/test')
  })
})
