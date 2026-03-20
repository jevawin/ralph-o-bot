/**
 * Classify a comment body.
 * @returns {'approved' | 'feedback'}
 */
export function classify(body) {
  return body?.trim().toLowerCase() === 'approved' ? 'approved' : 'feedback'
}
