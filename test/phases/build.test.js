import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/check-build.js', () => ({ checkBuild: vi.fn() }))
vi.mock('../../src/clancy.js', () => ({ runClancy: vi.fn() }))

import { checkBuild } from '../../src/check-build.js'
import { runClancy } from '../../src/clancy.js'
import { buildPhase } from '../../src/phases/build.js'

function makeCtx() {
  return { username: 'testuser', cwd: '/test', log: vi.fn(), setAction: vi.fn() }
}

beforeEach(() => vi.clearAllMocks())

describe('buildPhase', () => {
  it('returns true and does nothing when no build work', async () => {
    checkBuild.mockResolvedValue(null)
    expect(await buildPhase(makeCtx())).toBe(true)
    expect(runClancy).not.toHaveBeenCalled()
  })

  it('returns false, runs clancy, then updates docs', async () => {
    checkBuild.mockResolvedValue({ command: '/clancy:once --afk #3', issue: { number: 3 } })
    const ctx = makeCtx()
    expect(await buildPhase(ctx)).toBe(false)
    expect(runClancy).toHaveBeenNthCalledWith(1, '/clancy:once --afk #3', '/test')
    expect(runClancy).toHaveBeenNthCalledWith(2, '/clancy:update-docs', '/test')
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining('#3'))
  })
})
