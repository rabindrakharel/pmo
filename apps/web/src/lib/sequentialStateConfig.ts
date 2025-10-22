/**
 * Sequential State Configuration
 *
 * Central configuration for fields that represent sequential states/stages/funnels
 * These fields get special visualization treatment with the SequentialStateVisualizer
 */

/**
 * Field name patterns that indicate a sequential state field
 * These patterns are matched against field keys (case-insensitive)
 * IMPORTANT: Only use 'stage' and 'funnel' to avoid matching non-sequential fields
 */
export const SEQUENTIAL_STATE_PATTERNS = [
  'stage',      // project_stage, task_stage
  'funnel'      // opportunity_funnel_stage, sales_funnel
] as const;

/**
 * Specific field keys to exclude from sequential state visualization
 * Even if they match a pattern, these fields should use regular dropdowns
 */
export const SEQUENTIAL_STATE_EXCLUSIONS = [
  'active_flag',           // Boolean flag, not a workflow state
  'level_id',              // Foreign key reference, not a workflow
  'office_level_id',       // Hierarchical level, not sequential workflow
  'business_level_id',     // Hierarchical level, not sequential workflow
  'position_level_id',     // Hierarchical level, not sequential workflow
  'client_level_id',       // Hierarchical level, not sequential workflow
  'hr_level_id',           // Hierarchical level, not sequential workflow
  'priority_level',        // Priority level, not a sequential workflow
  'priority',              // Priority field, not a sequential workflow
  'status',                // Generic status, not a sequential workflow
  'project_status',        // Project status, not a sequential workflow
  'client_status'          // Client status, not a sequential workflow
] as const;

/**
 * Explicit field keys that should ALWAYS use sequential state visualization
 * This overrides pattern matching for fields we know are sequential
 */
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'project_stage',                    // Project workflow stages
  'task_stage',                       // Task workflow stages
  'stage',                            // Generic workflow stage
  'opportunity_funnel_stage_name',    // Client opportunity funnel
  'publication_status',               // Wiki publication workflow
  'submission_status',                // Form submission workflow
  'approval_status'                   // Form approval workflow
] as const;

/**
 * Configuration for specific sequential state fields
 * Allows customization of visualization per field type
 */
export interface SequentialStateFieldConfig {
  /** Field key */
  fieldKey: string;
  /** Optional: Custom label for the visualizer */
  label?: string;
  /** Optional: Show past states as completed (default: true) */
  showPastAsCompleted?: boolean;
  /** Optional: Allow clicking on any state to jump (default: true) */
  allowJumping?: boolean;
}

/**
 * Field-specific configurations (optional, for advanced customization)
 */
export const SEQUENTIAL_STATE_FIELD_CONFIGS: Record<string, SequentialStateFieldConfig> = {
  'project_stage': {
    fieldKey: 'project_stage',
    label: 'Project Stage',
    showPastAsCompleted: true,
    allowJumping: true
  },
  'task_stage': {
    fieldKey: 'task_stage',
    label: 'Task Stage',
    showPastAsCompleted: true,
    allowJumping: true
  },
  'stage': {
    fieldKey: 'stage',
    label: 'Stage',
    showPastAsCompleted: true,
    allowJumping: true
  },
  'opportunity_funnel_stage_name': {
    fieldKey: 'opportunity_funnel_stage_name',
    label: 'Sales Funnel',
    showPastAsCompleted: true,
    allowJumping: true
  }
};

/**
 * Check if a field should use sequential state visualization
 *
 * @param fieldKey - The field key to check
 * @param hasOptionsFromSettings - Whether the field loads options from settings
 * @returns true if the field should use sequential state visualization
 */
export function isSequentialStateField(
  fieldKey: string,
  hasOptionsFromSettings: boolean = true
): boolean {
  // Must load options from settings to be considered sequential
  if (!hasOptionsFromSettings) {
    return false;
  }

  const lowerKey = fieldKey.toLowerCase();

  // Check explicit exclusions first
  if (SEQUENTIAL_STATE_EXCLUSIONS.some(excluded =>
    lowerKey === excluded.toLowerCase()
  )) {
    return false;
  }

  // Check explicit inclusions
  if (SEQUENTIAL_STATE_EXPLICIT_INCLUDES.some(included =>
    lowerKey === included.toLowerCase()
  )) {
    return true;
  }

  // Check pattern matching
  return SEQUENTIAL_STATE_PATTERNS.some(pattern =>
    lowerKey.includes(pattern.toLowerCase())
  );
}

/**
 * Get configuration for a specific sequential state field
 *
 * @param fieldKey - The field key
 * @returns Field configuration or default config
 */
export function getSequentialStateFieldConfig(
  fieldKey: string
): SequentialStateFieldConfig {
  return SEQUENTIAL_STATE_FIELD_CONFIGS[fieldKey] || {
    fieldKey,
    showPastAsCompleted: true,
    allowJumping: true
  };
}

/**
 * Add a custom sequential state pattern
 * Useful for plugins or dynamic field types
 *
 * @param pattern - Pattern to add
 */
const customPatterns: string[] = [];

export function addSequentialStatePattern(pattern: string): void {
  if (!customPatterns.includes(pattern.toLowerCase())) {
    customPatterns.push(pattern.toLowerCase());
  }
}

/**
 * Get all sequential state patterns (built-in + custom)
 *
 * @returns Array of all patterns
 */
export function getAllSequentialStatePatterns(): string[] {
  return [...SEQUENTIAL_STATE_PATTERNS, ...customPatterns];
}
