import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:os', () => ({
  default: {
    freemem: vi.fn(),
    loadavg: vi.fn(),
    cpus: vi.fn(),
  },
}))

import os from 'node:os'
import { isInQuietHours, resourcesOk } from '../src/scheduler.js'

describe('isInQuietHours', () => {
  it('returns false when disabled (start === end)', () => {
    expect(isInQuietHours(0, 0, 0)).toBe(false)
    expect(isInQuietHours(720, 0, 0)).toBe(false)
  })

  describe('same-day window (09:00–17:00)', () => {
    const start = 9 * 60, end = 17 * 60

    it('inside window', () => {
      expect(isInQuietHours(12 * 60, start, end)).toBe(true)
      expect(isInQuietHours(9 * 60, start, end)).toBe(true)   // inclusive start
    })

    it('before window', () => {
      expect(isInQuietHours(8 * 60 + 59, start, end)).toBe(false)
    })

    it('after window', () => {
      expect(isInQuietHours(17 * 60, start, end)).toBe(false)  // exclusive end
      expect(isInQuietHours(20 * 60, start, end)).toBe(false)
    })
  })

  describe('overnight window (23:00–07:00)', () => {
    const start = 23 * 60, end = 7 * 60

    it('inside window (late night)', () => {
      expect(isInQuietHours(23 * 60 + 30, start, end)).toBe(true)
    })

    it('inside window (early morning)', () => {
      expect(isInQuietHours(6 * 60, start, end)).toBe(true)
      expect(isInQuietHours(0, start, end)).toBe(true)          // midnight
    })

    it('outside window (midday)', () => {
      expect(isInQuietHours(12 * 60, start, end)).toBe(false)
    })

    it('boundary: exactly at end is outside', () => {
      expect(isInQuietHours(7 * 60, start, end)).toBe(false)
    })
  })
})

describe('resourcesOk', () => {
  beforeEach(() => {
    os.cpus.mockReturnValue([{}, {}, {}, {}])  // 4 cores
  })

  it('returns true when memory and load are fine', () => {
    os.freemem.mockReturnValue(512 * 1024 * 1024)  // 512MB > 256MB default
    os.loadavg.mockReturnValue([1.6, 0, 0])         // 0.4/core < 0.8 default
    expect(resourcesOk()).toBe(true)
  })

  it('returns false when free memory is below threshold', () => {
    os.freemem.mockReturnValue(100 * 1024 * 1024)  // 100MB < 256MB default
    os.loadavg.mockReturnValue([0, 0, 0])
    expect(resourcesOk()).toBe(false)
  })

  it('returns false when load per core exceeds threshold', () => {
    os.freemem.mockReturnValue(512 * 1024 * 1024)
    os.loadavg.mockReturnValue([4.0, 0, 0])         // 1.0/core > 0.8 default
    expect(resourcesOk()).toBe(false)
  })

  it('returns false when both memory and load are bad', () => {
    os.freemem.mockReturnValue(50 * 1024 * 1024)
    os.loadavg.mockReturnValue([4.0, 0, 0])
    expect(resourcesOk()).toBe(false)
  })

  it('handles single-core (no division by zero)', () => {
    os.cpus.mockReturnValue([{}])                   // 1 core
    os.freemem.mockReturnValue(512 * 1024 * 1024)
    os.loadavg.mockReturnValue([0.5, 0, 0])         // 0.5/core < 0.8
    expect(resourcesOk()).toBe(true)
  })
})
