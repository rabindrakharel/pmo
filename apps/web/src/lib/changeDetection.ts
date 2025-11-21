/**
 * Change Detection Utilities
 *
 * Optimizes PATCH requests by detecting only changed fields
 * Reduces payload size and improves performance
 */

/**
 * Detects fields that have changed between original and edited data
 * Returns only the fields that have been modified
 *
 * @param original - Original data object
 * @param edited - Edited data object
 * @returns Object containing only changed fields
 */
export function getChangedFields(
  original: Record<string, any>,
  edited: Record<string, any>
): Record<string, any> {
  const changes: Record<string, any> = {};

  // Check each field in edited data
  Object.keys(edited).forEach(key => {
    const originalValue = original[key];
    const editedValue = edited[key];

    // Skip system fields that shouldn't be sent in updates
    const skipFields = [
      'id',
      'created_ts',
      'updated_ts',
      'created_at',
      'updated_at',
      'from_ts',
      'to_ts',
      'version',
      'deleted_ts',
      'deleted_at'
    ];

    if (skipFields.includes(key)) {
      return;
    }

    // Handle different data types appropriately
    if (isValueChanged(originalValue, editedValue)) {
      changes[key] = editedValue;
    }
  });

  return changes;
}

/**
 * Deep comparison to check if a value has changed
 * Handles nulls, undefined, arrays, objects, and primitives
 */
function isValueChanged(original: any, edited: any): boolean {
  // Handle null/undefined cases
  if (original === edited) return false;
  if (original == null || edited == null) return true;

  // Handle arrays
  if (Array.isArray(original) && Array.isArray(edited)) {
    if (original.length !== edited.length) return true;
    return original.some((item, index) => isValueChanged(item, edited[index]));
  }

  // Handle dates
  if (original instanceof Date && edited instanceof Date) {
    return original.getTime() !== edited.getTime();
  }

  // Handle objects (but not arrays or dates)
  if (typeof original === 'object' && typeof edited === 'object') {
    // For JSONB fields, do a deep comparison
    return JSON.stringify(original) !== JSON.stringify(edited);
  }

  // Handle empty string vs null (common in forms)
  // Treat empty string and null as equivalent for comparison
  if ((original === '' && edited == null) || (original == null && edited === '')) {
    return false;
  }

  // Primitive values
  return original !== edited;
}

/**
 * Prepares data for PATCH request by:
 * 1. Detecting only changed fields
 * 2. Normalizing values (empty strings to null, etc.)
 * 3. Removing computed/readonly fields
 */
export function preparePatchData(
  original: Record<string, any>,
  edited: Record<string, any>
): Record<string, any> {
  // Get only changed fields
  const changes = getChangedFields(original, edited);

  // If no changes, return empty object
  if (Object.keys(changes).length === 0) {
    return {};
  }

  // Normalize the changed fields
  const normalized: Record<string, any> = {};

  Object.keys(changes).forEach(key => {
    let value = changes[key];

    // Convert empty strings to null
    if (value === '') {
      value = null;
    }

    // Handle special field types
    if (key.endsWith('_date') || key.endsWith('_at') || key.endsWith('_ts')) {
      // Ensure dates are in ISO format
      if (value && !(value instanceof Date) && typeof value === 'string') {
        // Keep as string if already ISO format
        normalized[key] = value;
      } else if (value instanceof Date) {
        normalized[key] = value.toISOString();
      } else {
        normalized[key] = value;
      }
    } else {
      normalized[key] = value;
    }
  });

  return normalized;
}

/**
 * Checks if any fields have been changed
 */
export function hasChanges(
  original: Record<string, any>,
  edited: Record<string, any>
): boolean {
  const changes = getChangedFields(original, edited);
  return Object.keys(changes).length > 0;
}

/**
 * Gets a summary of what fields changed (for logging/debugging)
 */
export function getChangeSummary(
  original: Record<string, any>,
  edited: Record<string, any>
): string[] {
  const changes = getChangedFields(original, edited);
  return Object.keys(changes).map(key => {
    const oldVal = original[key];
    const newVal = changes[key];
    return `${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`;
  });
}