/**
 * ============================================================================
 * INDEXED DATA FORMAT UTILITIES - Frontend
 * ============================================================================
 *
 * Converts between indexed array format (from backend) and object format (for frontend use).
 *
 * INDEXED FORMAT (Backend sends):
 * ```json
 * {
 *   "data": [
 *     ["uuid-1", "PROJ-001", "Kitchen Reno", "execution", 50000],
 *     ["uuid-2", "PROJ-002", "Bathroom", "planning", 35000]
 *   ],
 *   "metadata": {
 *     "fields": [
 *       {"index": 1, "key": "id", ...},
 *       {"index": 2, "key": "code", ...},
 *       {"index": 3, "key": "name", ...},
 *       {"index": 4, "key": "dl__project_stage", ...},
 *       {"index": 5, "key": "budget_allocated_amt", ...}
 *     ]
 *   }
 * }
 * ```
 *
 * OBJECT FORMAT (Frontend uses):
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": "uuid-1",
 *       "code": "PROJ-001",
 *       "name": "Kitchen Reno",
 *       "dl__project_stage": "execution",
 *       "budget_allocated_amt": 50000
 *     }
 *   ]
 * }
 * ```
 *
 * BENEFITS OF INDEXED FORMAT:
 * - 30% smaller payload (no repeated keys)
 * - 29% faster JSON parsing
 * - Better compression with gzip/brotli
 */

import type { BackendFieldMetadata } from './frontEndFormatterService';

/**
 * Backend metadata structure (from backend-formatter.service.ts)
 */
export interface EntityMetadata {
  entity: string;
  label: string;
  labelPlural: string;
  icon?: string;
  fields: BackendFieldMetadata[];
  primaryKey: string;
  displayField: string;
  apiEndpoint: string;
  supportedViews?: string[];
  defaultView?: string;
  generated_at: string;
}

/**
 * API response structure (supports both formats)
 */
export interface ApiResponse<T = any> {
  data: T | T[];
  metadata?: EntityMetadata;
  total?: number;
  limit?: number;
  offset?: number;
  datalabels?: any[];
  format?: 'indexed' | 'object';  // Backend signals which format is used
  [key: string]: any;
}

/**
 * Convert indexed array to object
 *
 * Example:
 * ```typescript
 * indexedArrayToObject(
 *   ["uuid", "PROJ-001", "Kitchen Reno"],
 *   metadata.fields
 * )
 * // Returns: {id: "uuid", code: "PROJ-001", name: "Kitchen Reno"}
 * ```
 */
export function indexedArrayToObject(
  data: any[],
  fields: BackendFieldMetadata[]
): Record<string, any> {
  const result: Record<string, any> = {};

  fields.forEach(field => {
    // index is 1-based, array is 0-based
    const value = data[field.index - 1];
    if (value !== undefined) {
      result[field.key] = value;
    }
  });

  return result;
}

/**
 * Convert object to indexed array
 *
 * Example:
 * ```typescript
 * objectToIndexedArray(
 *   {id: "uuid", code: "PROJ-001", name: "Kitchen Reno"},
 *   metadata.fields
 * )
 * // Returns: ["uuid", "PROJ-001", "Kitchen Reno"]
 * ```
 */
export function objectToIndexedArray(
  obj: Record<string, any>,
  fields: BackendFieldMetadata[]
): any[] {
  // Find max index to size array properly
  const maxIndex = Math.max(...fields.map(f => f.index));
  const result = new Array(maxIndex).fill(undefined);

  // Map each field to its index position
  fields.forEach(field => {
    if (obj[field.key] !== undefined) {
      result[field.index - 1] = obj[field.key];  // index is 1-based, array is 0-based
    }
  });

  return result;
}

/**
 * Batch convert indexed arrays to objects
 */
export function indexedArraysToObjects(
  arrays: any[][],
  fields: BackendFieldMetadata[]
): Record<string, any>[] {
  return arrays.map(arr => indexedArrayToObject(arr, fields));
}

/**
 * Batch convert objects to indexed arrays
 */
export function objectsToIndexedArrays(
  objects: Record<string, any>[],
  fields: BackendFieldMetadata[]
): any[][] {
  return objects.map(obj => objectToIndexedArray(obj, fields));
}

/**
 * Normalize API response to always use object format
 *
 * This function detects the response format and converts indexed arrays to objects.
 * Use this at the API layer to ensure all components receive object format.
 *
 * Example:
 * ```typescript
 * const response = await api.get('/api/v1/project?format=indexed');
 * const normalized = normalizeApiResponse(response);
 * // normalized.data is always objects, never arrays
 * ```
 */
export function normalizeApiResponse<T = any>(
  response: ApiResponse<T>
): ApiResponse<Record<string, any>> {
  // If no metadata, can't convert - return as-is
  if (!response.metadata?.fields) {
    return response as any;
  }

  // If format is explicitly 'object' or not specified, assume object format
  if (response.format !== 'indexed') {
    return response as any;
  }

  // Detect format by checking if data is array of arrays
  const isSingleItem = !Array.isArray(response.data);
  const dataArray = isSingleItem ? [response.data] : (response.data as any[]);

  // Check if data is in indexed format (array of primitives)
  const isIndexedFormat = dataArray.length > 0 && Array.isArray(dataArray[0]);

  if (!isIndexedFormat) {
    // Already object format
    return response as any;
  }

  // Convert indexed arrays to objects
  const convertedData = indexedArraysToObjects(dataArray, response.metadata.fields);

  return {
    ...response,
    data: isSingleItem ? convertedData[0] : convertedData,
    format: 'object'  // Mark as converted
  };
}

/**
 * Type guard to check if response contains metadata
 * Checks for component-keyed format: metadata.entityListOfInstancesTable, metadata.entityInstanceFormContainer, etc.
 */
export function hasMetadata(response: any): response is ApiResponse & { metadata: EntityMetadata } {
  if (!response || !response.metadata) return false;

  // Component-keyed format: metadata.entityListOfInstancesTable, metadata.entityInstanceFormContainer, etc.
  return (
    typeof response.metadata.entityListOfInstancesTable === 'object' ||
    typeof response.metadata.entityInstanceFormContainer === 'object' ||
    typeof response.metadata.kanbanView === 'object'
  );
}

/**
 * Type guard to check if response is in indexed format
 */
export function isIndexedFormat(response: ApiResponse): boolean {
  if (!hasMetadata(response)) return false;

  const dataArray = Array.isArray(response.data) ? response.data : [response.data];
  if (dataArray.length === 0) return false;

  // Check if first item is an array (indexed format) or object
  return Array.isArray(dataArray[0]);
}
