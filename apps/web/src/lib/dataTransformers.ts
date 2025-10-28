/**
 * Data Transformers for API Communication
 *
 * Centralized utilities to transform frontend form/edit data
 * into the correct format expected by API endpoints.
 *
 * Follows DRY principle - single source of truth for all data transformations.
 */

/**
 * Transforms edited data before sending to API
 * Handles:
 * - Tags: string → array conversion
 * - Arrays: comma-separated strings → array
 * - Date fields: ISO timestamp → yyyy-MM-dd format
 * - File uploads: File objects → URLs/metadata
 */
export function transformForApi(data: Record<string, any>, originalRecord?: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = { ...data };

  // Process each field
  for (const [key, value] of Object.entries(transformed)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // 1. Tags field transformation (string → array)
    if (key === 'tags' || key.toLowerCase().endsWith('_tags')) {
      transformed[key] = transformTagsField(value);
    }

    // 2. Date field transformation (ISO timestamp → yyyy-MM-dd)
    else if (isDateField(key) && typeof value === 'string') {
      transformed[key] = transformDateField(value);
    }

    // 3. Array field transformation (comma-separated string → array)
    else if (Array.isArray(originalRecord?.[key])) {
      transformed[key] = transformArrayField(value);
    }

    // 4. File upload field transformation
    else if (isFileField(key, value)) {
      // File uploads are handled separately via presigned URLs
      // Remove from payload if it's a File object (not yet uploaded)
      if (value instanceof File || value instanceof FileList) {
        delete transformed[key];
      }
    }

    // 5. Empty string handling - convert to null for optional fields
    else if (value === '') {
      transformed[key] = null;
    }
  }

  return transformed;
}

/**
 * Transforms tags field from various input formats to API array format
 * Supports:
 * - Array: ["tag1", "tag2"] → ["tag1", "tag2"]
 * - String: "tag1, tag2" → ["tag1", "tag2"]
 * - String: "tag1,tag2" → ["tag1", "tag2"]
 * - Empty: "" → []
 */
export function transformTagsField(value: any): string[] {
  // Already an array
  if (Array.isArray(value)) {
    return value.filter(v => v && typeof v === 'string' && v.trim() !== '');
  }

  // String - split by comma
  if (typeof value === 'string') {
    if (value.trim() === '') {
      return [];
    }
    return value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '');
  }

  // Other types - return empty array
  return [];
}

/**
 * Transforms array fields from string to array
 */
export function transformArrayField(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return [];
    }
    return value
      .split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
  }

  return [];
}

/**
 * Checks if a field is a date field based on naming convention
 * Matches fields ending with _date or _ts, or starting with date_
 * Examples: actual_start_date, created_ts, date_modified
 */
function isDateField(key: string): boolean {
  return /_(date|ts)$|^date_/i.test(key);
}

/**
 * Transforms date field from various formats to yyyy-MM-dd format
 * Handles:
 * - ISO timestamps: "2024-11-30T00:00:00.000Z" → "2024-11-30"
 * - Already formatted: "2024-11-30" → "2024-11-30"
 * - Date objects: new Date() → "2024-11-30"
 */
export function transformDateField(value: any): string | null {
  if (!value) {
    return null;
  }

  try {
    // If already in yyyy-MM-dd format, return as-is
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // Parse date and format to yyyy-MM-dd
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return null;
    }

    // Format as yyyy-MM-dd
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error transforming date field:', error);
    return null;
  }
}

/**
 * Checks if a field is a file upload field
 */
function isFileField(key: string, value: any): boolean {
  const fileFieldPatterns = [
    'file', 'attachment', 'document', 'upload', 'image', 'photo', 'avatar'
  ];

  const isFileKey = fileFieldPatterns.some(pattern =>
    key.toLowerCase().includes(pattern)
  );

  const isFileValue = value instanceof File || value instanceof FileList;

  return isFileKey || isFileValue;
}

/**
 * Transforms display data from API for form editing
 * Handles:
 * - Tags: array → comma-separated string for input
 * - Arrays: array → comma-separated string
 */
export function transformFromApi(data: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = { ...data };

  for (const [key, value] of Object.entries(transformed)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // Tags array → comma-separated string for editing
    if ((key === 'tags' || key.toLowerCase().endsWith('_tags')) && Array.isArray(value)) {
      transformed[key] = value.join(', ');
    }

    // Other arrays → comma-separated string
    else if (Array.isArray(value) && typeof value[0] === 'string') {
      transformed[key] = value.join(', ');
    }
  }

  return transformed;
}

// ============================================================================
// Display Transformers (for UI rendering)
// ============================================================================

/**
 * Format a timestamp as relative time (e.g., "20 seconds ago", "3 days ago")
 * Used for created_ts, updated_ts, and other timestamp fields
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears === 1) return '1 year ago';
  return `${diffYears} years ago`;
}

/**
 * Format date in a friendly format (e.g., "Oct 31, 2024")
 */
export function formatFriendlyDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Date range progress metadata
 */
export interface DateRangeProgress {
  startDate: Date;
  endDate: Date;
  today: Date;
  totalDays: number;
  daysPassed: number;
  daysRemaining: number;
  progressPercent: number;
  isBeforeStart: boolean;
  isAfterEnd: boolean;
  isActive: boolean;
}

/**
 * Calculate date range progress for visualization
 * Used for project/task timelines showing days passed, remaining, and progress
 */
export function calculateDateRangeProgress(
  startDateString: string | Date | null | undefined,
  endDateString: string | Date | null | undefined
): DateRangeProgress | null {
  if (!startDateString || !endDateString) return null;

  const startDate = typeof startDateString === 'string' ? new Date(startDateString) : startDateString;
  const endDate = typeof endDateString === 'string' ? new Date(endDateString) : endDateString;
  const today = new Date();

  // Set all dates to midnight for consistent day counting
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const progressPercent = totalDays > 0 ? Math.max(0, Math.min(100, (daysPassed / totalDays) * 100)) : 0;

  const isBeforeStart = today < startDate;
  const isAfterEnd = today > endDate;
  const isActive = !isBeforeStart && !isAfterEnd;

  return {
    startDate,
    endDate,
    today,
    totalDays,
    daysPassed: Math.max(0, daysPassed),
    daysRemaining: Math.max(0, daysRemaining),
    progressPercent,
    isBeforeStart,
    isAfterEnd,
    isActive
  };
}
