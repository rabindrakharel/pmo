/**
 * Data Transformation Utilities for API Routes
 *
 * Centralized utilities to transform request data before database operations.
 * Handles inline editing formats from frontend (strings) to database formats (arrays, etc.)
 *
 * Follows DRY principle - single source of truth for all API data transformations.
 */

/**
 * Transforms tags field from string to array
 * Handles inline editing where tags come as comma-separated strings
 *
 * @param tags - Can be array (passthrough) or string (transform)
 * @returns Array of trimmed non-empty tags
 */
export function transformTags(tags: any): string[] {
  // Already an array - passthrough
  if (Array.isArray(tags)) {
    return tags.filter((tag: any) => tag && typeof tag === 'string' && tag.trim() !== '');
  }

  // String - split by comma
  if (typeof tags === 'string') {
    if (tags.trim() === '') {
      return [];
    }
    return tags
      .split(',')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag !== '');
  }

  // Other types - return empty array
  return [];
}

/**
 * Transforms request body for entity updates
 * Handles:
 * - Tags: string → array
 * - Empty strings → null for optional fields
 *
 * @param data - Raw request body data
 * @returns Transformed data ready for database
 */
export function transformRequestBody(data: Record<string, any>): Record<string, any> {
  const transformed = { ...data };

  // Transform tags field
  if (transformed.tags !== undefined) {
    transformed.tags = transformTags(transformed.tags);
  }

  // Transform any field ending with _tags
  for (const key in transformed) {
    if (key.endsWith('_tags') && transformed[key] !== undefined) {
      transformed[key] = transformTags(transformed[key]);
    }
  }

  // Convert empty strings to null for optional fields
  for (const key in transformed) {
    if (transformed[key] === '') {
      transformed[key] = null;
    }
  }

  return transformed;
}
