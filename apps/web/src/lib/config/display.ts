/**
 * ============================================================================
 * DISPLAY CONFIGURATION - UI Display Constants
 * ============================================================================
 *
 * Centralized configuration for UI display behavior.
 * Eliminates magic numbers scattered across components.
 */

export const DISPLAY_CONFIG = {
  /**
   * Maximum number of tags to display before showing "+N more"
   */
  MAX_TAGS_DISPLAY: 3,

  /**
   * Maximum number of reference items to display in lists
   */
  MAX_REFERENCE_DISPLAY: 5,

  /**
   * Default page size for paginated tables
   */
  PAGE_SIZE_DEFAULT: 50,

  /**
   * Available page size options (v9.4.0: max 500 for sliding window)
   */
  PAGE_SIZE_OPTIONS: [50, 100, 200, 500] as const,

  /**
   * Table height limits
   */
  TABLE_HEIGHT: {
    MIN: '200px',
    MAX: '600px',
    DEFAULT: '400px'
  },

  /**
   * Animation durations (ms)
   */
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  }
} as const;
