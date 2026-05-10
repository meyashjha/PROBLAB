/**
 * Parse market outcome for display
 * 
 * Jupiter markets:
 * - Market title: The specific outcome (e.g., "Sean Strickland", "Satan666", "Up")
 * - YES = This outcome happens
 * - NO = This outcome doesn't happen
 * 
 * We use the TITLE directly, not the description, because the title IS the outcome.
 */
export function parseOutcomeDescription(
  description: string,
  outcome: 'YES' | 'NO',
  title: string
): string {
  // Simply use the title - it's already the correct outcome
  if (outcome === 'YES') {
    return `${title} (YES)`;
  } else {
    return `NOT ${title} (NO)`;
  }
}

