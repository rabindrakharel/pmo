/**
 * Intent Graph Registry
 * Central registry of all available intent graphs
 * @module orchestrator/intent-graphs
 */

import type { IntentGraph } from '../types/intent-graph.types.js';
import { CalendarBookingGraph } from './calendar-booking.graph.js';

/**
 * Registry of all available intent graphs
 */
export const IntentGraphRegistry: Record<string, IntentGraph> = {
  CalendarBooking: CalendarBookingGraph,
  // Future intents:
  // ComplaintHandling: ComplaintHandlingGraph,
  // JobFollowUp: JobFollowUpGraph,
  // ServiceInquiry: ServiceInquiryGraph,
  // etc.
};

/**
 * Get an intent graph by name
 */
export function getIntentGraph(intentName: string): IntentGraph | null {
  return IntentGraphRegistry[intentName] || null;
}

/**
 * Get all available intent names
 */
export function getAvailableIntents(): string[] {
  return Object.keys(IntentGraphRegistry);
}

/**
 * Check if an intent exists
 */
export function hasIntent(intentName: string): boolean {
  return intentName in IntentGraphRegistry;
}
