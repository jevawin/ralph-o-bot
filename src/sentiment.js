const APPROVED_KEYWORDS = [
  'approved', 'approve', 'lgtm', 'looks good', 'ship it', 'merge',
  'yes', 'go ahead', 'go'
]

/**
 * Classify a comment body.
 * @returns {'approved' | 'feedback' | 'none'}
 */
export function classify(body) {
  if (!body || !body.trim()) return 'none'

  const lower = body.toLowerCase()

  for (const kw of APPROVED_KEYWORDS) {
    // Match whole word / phrase
    const re = new RegExp(`(?<![a-z])${kw.replace(' ', '\\s+')}(?![a-z])`)
    if (re.test(lower)) return 'approved'
  }

  // Feedback heuristics
  if (
    lower.includes('?') ||
    lower.includes('instead') ||
    lower.includes('can you') ||
    lower.includes('could you') ||
    lower.includes('please') ||
    lower.includes('change') ||
    lower.includes('fix') ||
    lower.includes('update') ||
    lower.includes('rework') ||
    lower.includes('not quite') ||
    lower.includes('wrong') ||
    lower.includes('incorrect') ||
    lower.includes('but')
  ) {
    return 'feedback'
  }

  return 'none'
}
