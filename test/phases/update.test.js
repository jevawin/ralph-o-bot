import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/updater.js', () => ({
  checkUpdateApproval: vi.fn(),
  checkUpdateBlocked: vi.fn(),
  applyUpdate: vi.fn(),
}))

import { checkUpdateApproval, checkUpdateBlocked, applyUpdate } from '../../src/updater.js'
import { updatePhase } from '../../src/phases/update.js'

function makeCtx() {
  return { username: 'testuser', cwd: '/test', log: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

describe('updatePhase', () => {
  it('returns true when no update is pending or blocked', async () => {
    checkUpdateApproval.mockResolvedValue(null)
    checkUpdateBlocked.mockResolvedValue(false)
    expect(await updatePhase(makeCtx())).toBe(true)
    expect(applyUpdate).not.toHaveBeenCalled()
  })

  it('applies update and returns false when approval is found', async () => {
    const approval = { latestVersion: '2.0.0', migration: {}, issue: { number: 5 } }
    checkUpdateApproval.mockResolvedValue(approval)
    const ctx = makeCtx()
    expect(await updatePhase(ctx)).toBe(false)
    expect(applyUpdate).toHaveBeenCalledWith('2.0.0', {}, { number: 5 })
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('2.0.0'))
  })

  it('returns false and does not apply when dispatch is blocked', async () => {
    checkUpdateApproval.mockResolvedValue(null)
    checkUpdateBlocked.mockResolvedValue(true)
    const ctx = makeCtx()
    expect(await updatePhase(ctx)).toBe(false)
    expect(applyUpdate).not.toHaveBeenCalled()
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('paused'))
  })
})
