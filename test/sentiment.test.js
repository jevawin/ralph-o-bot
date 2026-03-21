import { describe, it, expect } from 'vitest'
import { classify } from '../src/sentiment.js'

describe('classify', () => {
  it('returns approved for exact "approved"', () => {
    expect(classify('approved')).toBe('approved')
  })

  it('is case-insensitive', () => {
    expect(classify('APPROVED')).toBe('approved')
    expect(classify('Approved')).toBe('approved')
  })

  it('trims whitespace', () => {
    expect(classify('  approved  ')).toBe('approved')
    expect(classify('\tapproved\n')).toBe('approved')
  })

  it('returns feedback for partial match', () => {
    expect(classify('approved!')).toBe('feedback')
    expect(classify('i approved this')).toBe('feedback')
  })

  it('returns feedback for other comment text', () => {
    expect(classify('looks good')).toBe('feedback')
    expect(classify('please fix the types')).toBe('feedback')
  })

  it('returns feedback for empty string', () => {
    expect(classify('')).toBe('feedback')
  })

  it('returns feedback for null', () => {
    expect(classify(null)).toBe('feedback')
  })

  it('returns feedback for undefined', () => {
    expect(classify(undefined)).toBe('feedback')
  })
})
