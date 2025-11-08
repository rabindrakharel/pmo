/**
 * Greeting Service
 * Simple utility for generating chat session greetings
 * @module chat/greeting
 */

/**
 * Generate greeting message for new session
 * Note: Uses simple hardcoded greeting for session initialization
 * Actual conversation flow is handled by agent orchestrator
 */
export function generateGreeting(): string {
  return `Hi! I'm the assistant for Huron Home Services. How can I help you today?`;
}

/**
 * Calculate API cost (deprecated - use agent cost tracking instead)
 * Kept for backwards compatibility
 */
export function calculateCost(tokensUsed: number): number {
  const costPerToken = 0.00004; // $0.04 per 1K tokens (rough estimate)
  return Math.round(tokensUsed * costPerToken * 100); // Return in cents
}
