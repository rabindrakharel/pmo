/**
 * Universal Filter Builder - Zero-Config Query Filtering
 *
 * Automatically builds SQL filter conditions from query parameters based on
 * field naming conventions. No manual filterableFields mapping required.
 *
 * @example
 * // In routes.ts
 * const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
 * conditions.push(...autoFilters);
 *
 * // Supports auto-detection:
 * GET /api/v1/project?name=Kitchen&dl__project_stage=planning&active=true
 * GET /api/v1/task?project_id=uuid&dl__task_priority=high
 * GET /api/v1/employee?department=IT&remote_work_eligible_flag=true
 */

import { sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export type FilterType =
  | 'text'              // Regular text fields
  | 'uuid'              // UUID fields (*_id)
  | 'currency'          // Currency fields (*_amt)
  | 'date'              // Date fields (*_date, *_ts)
  | 'boolean'           // Boolean fields (*_flag)
  | 'settings'          // Settings dropdown (dl__*)
  | 'jsonb'             // JSONB metadata fields
  | 'numeric';          // Numeric fields (*_pct, counts, etc.)

export interface FilterConfig {
  column: string;
  type: FilterType;
  operator?: 'equals' | 'contains' | 'range' | 'in' | 'gte' | 'lte';
}

// ============================================================================
// AUTO-DETECTION
// ============================================================================

/**
 * Auto-detect filter type from column naming conventions
 *
 * Conventions:
 * - dl__* → Settings dropdown from setting_datalabel_* tables
 * - *_id → UUID reference to another entity
 * - *_amt → Currency amount (decimal)
 * - *_date, *_ts → Date/timestamp
 * - *_flag → Boolean flag
 * - *_pct → Percentage (numeric)
 * - metadata → JSONB field
 * - name, code, descr → Text fields
 */
export function detectFilterType(columnName: string): FilterType {
  if (columnName.startsWith('dl__')) return 'settings';
  if (columnName.endsWith('_id')) return 'uuid';
  if (columnName.endsWith('_amt')) return 'currency';
  if (columnName.endsWith('_date') || columnName.endsWith('_ts')) return 'date';
  if (columnName.endsWith('_flag')) return 'boolean';
  if (columnName.endsWith('_pct')) return 'numeric';
  if (columnName === 'metadata') return 'jsonb';
  if (columnName.match(/^(count|total|quantity|amount)$/i)) return 'numeric';
  return 'text';
}

// ============================================================================
// FILTER CONDITION BUILDER
// ============================================================================

/**
 * Build SQL condition for a single filter with type-aware casting
 *
 * @param tableAlias - SQL table alias (e.g., 'e', 'p', 't')
 * @param columnName - Column name to filter on
 * @param value - Filter value from query parameter
 * @returns SQL condition fragment
 */
export function buildFilterCondition(
  tableAlias: string,
  columnName: string,
  value: any
): any {
  const type = detectFilterType(columnName);

  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return sql`TRUE`;  // No-op condition
  }

  switch (type) {
    case 'uuid':
      // UUID fields need explicit casting to avoid type errors
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)}::uuid = ${value}::uuid`;

    case 'boolean':
      // Convert string 'true'/'false' to boolean
      const boolValue = value === 'true' || value === true || value === '1';
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)} = ${boolValue}`;

    case 'currency':
    case 'numeric':
      // Numeric fields - support exact match (can extend to ranges)
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)} = ${parseFloat(value)}`;

    case 'date':
      // Date/timestamp fields
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)} = ${value}`;

    case 'text':
    case 'settings':
      // Text and settings dropdown - exact match
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)} = ${value}`;

    case 'jsonb':
      // JSONB metadata filtering (metadata.key=value)
      // Not commonly used in query params, but supported
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)}::text ILIKE ${`%${value}%`}`;

    default:
      // Fallback to text equality
      return sql`${sql.raw(tableAlias)}.${sql.identifier(columnName)} = ${value}`;
  }
}

// ============================================================================
// SEARCH BUILDER
// ============================================================================

/**
 * Build multi-field search condition (name, code, descr)
 *
 * @param tableAlias - SQL table alias
 * @param searchTerm - Search string from ?search=term
 * @param searchFields - Fields to search across (default: name, code, descr)
 * @returns SQL OR condition for multi-field search
 */
export function buildSearchCondition(
  tableAlias: string,
  searchTerm: string,
  searchFields: string[] = ['name', 'code', 'descr']
): any {
  if (!searchTerm || searchTerm.trim() === '') {
    return sql`TRUE`;  // No-op condition
  }

  const searchPattern = `%${searchTerm}%`;
  const searchConditions = searchFields.map(field =>
    sql`COALESCE(${sql.raw(tableAlias)}.${sql.identifier(field)}, '') ILIKE ${searchPattern}`
  );

  return sql`(${sql.join(searchConditions, sql` OR `)})`;
}

// ============================================================================
// UNIVERSAL AUTO-FILTER BUILDER
// ============================================================================

/**
 * Build all filter conditions automatically from query parameters
 *
 * @param tableAlias - SQL table alias (e.g., 'e')
 * @param queryParams - Request query parameters object
 * @param options - Configuration options
 * @returns Array of SQL conditions ready to join with AND
 *
 * @example
 * const conditions = buildAutoFilters('e', request.query);
 * const query = sql`SELECT * FROM app.project e WHERE ${sql.join(conditions, sql` AND `)}`;
 */
export function buildAutoFilters(
  tableAlias: string,
  queryParams: Record<string, any>,
  options?: {
    /** Query params to exclude from filtering (pagination, sorting, etc.) */
    excludeParams?: string[];
    /** Custom field overrides for special cases */
    overrides?: Record<string, FilterConfig>;
    /** Fields to search across when ?search= is present */
    searchFields?: string[];
  }
): any[] {
  const conditions: any[] = [];

  // Default excluded parameters (pagination, sorting, search)
  const excludeParams = options?.excludeParams || [
    'limit',
    'offset',
    'page',        // Page number for pagination (converted to offset)
    'pageSize',    // Alternative pagination parameter (frontend compatibility)
    'search',
    'order_by',
    'order_dir',
    'parent_type',
    'parent_id',
    'view'         // Component view type for metadata generation (backend-formatter service)
  ];

  // Handle search separately (multi-field OR condition)
  if (queryParams.search) {
    const searchCondition = buildSearchCondition(
      tableAlias,
      queryParams.search,
      options?.searchFields
    );
    conditions.push(searchCondition);
  }

  // Auto-build filters for all other query parameters
  for (const [paramKey, paramValue] of Object.entries(queryParams)) {
    // Skip excluded params and empty values
    if (excludeParams.includes(paramKey)) continue;
    if (paramValue === undefined || paramValue === null || paramValue === '') continue;

    // Check for custom override
    if (options?.overrides?.[paramKey]) {
      const override = options.overrides[paramKey];
      conditions.push(buildFilterCondition(tableAlias, override.column, paramValue));
    } else {
      // Auto-detect and build condition
      conditions.push(buildFilterCondition(tableAlias, paramKey, paramValue));
    }
  }

  return conditions;
}

// ============================================================================
// JSONB METADATA FILTER BUILDER
// ============================================================================

/**
 * Build filter conditions for JSONB metadata fields
 *
 * Handles filtering on metadata.key = value patterns
 *
 * @param tableAlias - SQL table alias
 * @param metadataFilters - Map of metadata key -> filter value
 * @returns Array of SQL conditions for metadata filtering
 *
 * @example
 * const metadataConditions = buildMetadataFilters('e', {
 *   project_id: 'uuid-value',
 *   task_type: 'maintenance'
 * });
 */
export function buildMetadataFilters(
  tableAlias: string,
  metadataFilters: Record<string, any>
): any[] {
  const conditions: any[] = [];

  for (const [jsonKey, value] of Object.entries(metadataFilters)) {
    if (value === undefined || value === null || value === '') continue;

    // Detect if the key is a UUID field (needs casting)
    if (jsonKey.endsWith('_id')) {
      conditions.push(
        sql`(${sql.raw(tableAlias)}.metadata->>${jsonKey})::uuid = ${value}::uuid`
      );
    } else {
      conditions.push(
        sql`${sql.raw(tableAlias)}.metadata->>${jsonKey} = ${value}`
      );
    }
  }

  return conditions;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  detectFilterType,
  buildFilterCondition,
  buildSearchCondition,
  buildAutoFilters,
  buildMetadataFilters
};
