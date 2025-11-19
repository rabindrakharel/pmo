/**
 * ============================================================================
 * SCHEMA BUILDER SERVICE - Database Introspection & Schema Generation
 * ============================================================================
 *
 * Generates entity schemas by introspecting database tables and applying
 * convention-based formatting rules. Schemas are independent of data and
 * enable UI to render correctly even when entity tables are empty.
 *
 * USAGE:
 * ```typescript
 * import { buildEntitySchema } from '@/lib/schema-builder.service.js';
 *
 * const schema = await buildEntitySchema(db, 'project', 'project');
 * // Returns complete schema with columns, format specs, editability
 * ```
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface SchemaColumn {
  key: string;
  title: string;
  dataType: string;
  visible: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format: FormatSpecification;
  editable: boolean;
  editType: 'text' | 'number' | 'date' | 'select' | 'tags' | 'boolean' | 'readonly';
  sortable: boolean;
  filterable: boolean;

  // Data source configuration for dropdowns
  dataSource?: {
    type: 'settings';
    datalabel: string;
  };
}

export interface FormatSpecification {
  type: 'text' | 'currency' | 'number' | 'percentage'
      | 'date' | 'datetime' | 'relative-time'
      | 'badge' | 'tags' | 'reference' | 'boolean';

  // Optional config - only include what's needed
  settingsDatalabel?: string;   // For badge type
  entityCode?: string;          // For reference type
  dateFormat?: string;          // For date type
}

export interface EntitySchema {
  entityCode: string;
  tableName: string;
  columns: SchemaColumn[];
}

interface DbColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

// ============================================================================
// SYSTEM FIELDS (Hidden from UI)
// ============================================================================

const SYSTEM_FIELDS = new Set([
  'id',
  'created_ts',
  'updated_ts',
  'created_by',
  'updated_by',
  'from_ts',
  'to_ts',
  'active_flag',
  'version'
]);

const READONLY_FIELDS = new Set([
  'id',
  'created_ts',
  'updated_ts',
  'created_by',
  'updated_by',
  'from_ts',
  'to_ts',
  'parent_id',
  'parent_type',
  'parent_name',
  'child_count'
]);

// ============================================================================
// DYNAMIC TABLE NAME RESOLUTION FROM d_entity
// ============================================================================

/**
 * Get database table name for entity from entity.db_table (FULLY DYNAMIC!)
 *
 * @param db - Drizzle database instance
 * @param entityCode - Entity type code (project, task, calendar, message, etc.)
 * @returns Database table name or null if not found
 */
export async function getTableNameFromEntity(
  db: NodePgDatabase<any>,
  entityCode: string
): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT db_table FROM app.entity WHERE code = ${entityCode} AND active_flag = true LIMIT 1`
    );

    // Drizzle returns results directly as an array, not in a .rows property
    const rows = Array.isArray(result) ? result : (result as any).rows || [];

    if (rows.length === 0) {
      console.warn(`Entity type "${entityCode}" not found in entity table`);
      return null;
    }

    const dbTable = rows[0].db_table as string | null;

    if (!dbTable) {
      console.warn(`Entity type "${entityCode}" exists but db_table is NULL - update entity table!`);
      return null;
    }

    console.log(`✅ Resolved table for "${entityCode}": ${dbTable}`);
    return dbTable;
  } catch (error) {
    console.error(`Failed to fetch table name for entity "${entityCode}":`, error);
    return null;
  }
}

// ============================================================================
// MAIN SCHEMA BUILDER
// ============================================================================

/**
 * Build entity schema by introspecting database table
 *
 * ✨ FULLY DYNAMIC: tableName is now OPTIONAL - auto-fetched from entity.db_table!
 *
 * @param db - Drizzle database instance
 * @param entityCode - Entity type (e.g., 'project', 'task', 'calendar', 'message')
 * @param tableName - (Optional) Database table name - if omitted, fetched from entity.db_table
 * @returns Entity schema with column metadata
 */
export async function buildEntitySchema(
  db: NodePgDatabase<any>,
  entityCode: string,
  tableName?: string
): Promise<EntitySchema> {
  // ✨ DYNAMIC: Fetch table name from entity.db_table if not provided
  let resolvedTableName = tableName;

  if (!resolvedTableName) {
    resolvedTableName = await getTableNameFromEntity(db, entityCode);

    if (!resolvedTableName) {
      // Return empty schema if table not found
      console.error(`Cannot build schema for "${entityCode}" - no table mapping in entity table.db_table`);
      return {
        entityCode,
        tableName: `app.d_${entityCode}`, // Fallback for error reporting
        columns: []
      };
    }
  }

  // Ensure table name has schema prefix
  const fullTableName = resolvedTableName.includes('.') ? resolvedTableName : `app.${resolvedTableName}`;

  // Fetch columns from information_schema
  const dbColumns = await fetchTableColumns(db, fullTableName);

  // Build schema columns with format specifications
  const columns: SchemaColumn[] = dbColumns
    .filter(col => !SYSTEM_FIELDS.has(col.column_name))
    .map(col => buildSchemaColumn(col));

  return {
    entityCode,
    tableName: fullTableName,
    columns
  };
}

/**
 * Fetch table columns from PostgreSQL information_schema
 */
async function fetchTableColumns(
  db: NodePgDatabase<any>,
  tableName: string
): Promise<DbColumn[]> {
  // Extract schema and table name
  const [schema, table] = tableName.includes('.')
    ? tableName.split('.')
    : ['app', tableName];

  const result = await db.execute(sql`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = ${schema}
      AND table_name = ${table}
    ORDER BY ordinal_position
  `);

  return result as unknown as DbColumn[];
}

// ============================================================================
// COLUMN BUILDER
// ============================================================================

/**
 * Build schema column from database column metadata
 */
function buildSchemaColumn(dbCol: DbColumn): SchemaColumn {
  const columnName = dbCol.column_name;

  return {
    key: columnName,
    title: generateFieldTitle(columnName),
    dataType: dbCol.data_type,
    visible: !isInvisibleField(columnName),
    width: getColumnWidth(columnName, dbCol.data_type),
    align: getColumnAlignment(columnName, dbCol.data_type),
    format: buildFormatSpecification(dbCol),
    editable: isEditableField(columnName),
    editType: getEditType(columnName, dbCol.data_type),
    sortable: isSortableField(columnName),
    filterable: isFilterableField(columnName),
    dataSource: getDataSource(columnName)
  };
}

// ============================================================================
// FORMAT SPECIFICATION BUILDER
// ============================================================================

/**
 * Build format specification - simplified to map to existing formatters
 */
function buildFormatSpecification(dbCol: DbColumn): FormatSpecification {
  const columnName = dbCol.column_name;
  const dataType = dbCol.data_type;

  // ⭐ CURRENCY FIELDS → formatCurrency()
  if (/_amt$|_amount$|_price$|_cost$|^budget_|^revenue_|^expense_/.test(columnName)) {
    return { type: 'currency' };
  }

  // ⭐ PERCENTAGE FIELDS → formatPercentage()
  if (/_pct$|_percentage$|_rate$/.test(columnName)) {
    return { type: 'percentage' };
  }

  // ⭐ NUMERIC FIELDS → formatNumber()
  if (['integer', 'bigint', 'numeric', 'decimal', 'double precision', 'real'].includes(dataType)) {
    return { type: 'number' };
  }

  // ⭐ DATE FIELDS → formatDate()
  if (dataType === 'date') {
    return {
      type: 'date',
      dateFormat: 'MMM DD, YYYY'
    };
  }

  // ⭐ TIMESTAMP FIELDS → formatRelativeTime() (exists!)
  if ((dataType === 'timestamp with time zone' || dataType === 'timestamp without time zone') &&
      /_ts$|_at$/.test(columnName)) {
    return { type: 'relative-time' };
  }

  // ⭐ DATETIME FIELDS → formatDateTime()
  if (dataType === 'timestamp with time zone' || dataType === 'timestamp without time zone') {
    return { type: 'datetime' };
  }

  // ⭐ SETTINGS FIELDS (dl__*) → renderSettingBadge() (exists!)
  if (columnName.startsWith('dl__')) {
    return {
      type: 'badge',
      settingsDatalabel: columnName  // Keep full dl__* name for API lookup
    };
  }

  // ⭐ BOOLEAN FIELDS → Custom renderer
  if (dataType === 'boolean') {
    return { type: 'boolean' };
  }

  // ⭐ ARRAY/TAGS FIELDS → renderTags()
  if (dataType === 'ARRAY' || dataType.startsWith('_') || columnName === 'tags') {
    return { type: 'tags' };
  }

  // ⭐ REFERENCE FIELDS (*_id) → renderReference()
  if (columnName.endsWith('_id') && dataType === 'uuid') {
    const match = columnName.match(/^(.+?)_?(employee|project|task|business|office|customer|role|cust|event|calendar)_id$/);
    if (match) {
      return {
        type: 'reference',
        entityCode: match[2] === 'cust' ? 'customer' : match[2]
      };
    }
  }

  // ⭐ DEFAULT: Plain text
  return { type: 'text' };
}

// ============================================================================
// FIELD PROPERTY DETECTORS
// ============================================================================

/**
 * Generate human-readable title from column name
 */
function generateFieldTitle(columnName: string): string {
  // Remove common suffixes
  let title = columnName
    .replace(/^dl__/, '')    // Remove dl__ prefix
    .replace(/_ts$/, '')     // Remove _ts suffix
    .replace(/_amt$/, '')    // Remove _amt suffix
    .replace(/_id$/, '');    // Remove _id suffix

  // Convert snake_case to Title Case
  title = title
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return title;
}

/**
 * Determine if field should be invisible by default
 */
function isInvisibleField(columnName: string): boolean {
  // Hide ID fields (used for joins/references)
  if (columnName.endsWith('_id') && columnName !== 'id') {
    return true;
  }

  // Hide metadata fields
  if (columnName === 'metadata') {
    return true;
  }

  return false;
}

/**
 * Determine if field is editable
 */
function isEditableField(columnName: string): boolean {
  return !READONLY_FIELDS.has(columnName);
}

/**
 * Determine edit type for field
 */
function getEditType(columnName: string, dataType: string): SchemaColumn['editType'] {
  if (READONLY_FIELDS.has(columnName)) {
    return 'readonly';
  }

  if (columnName.startsWith('dl__')) {
    return 'select';
  }

  if (dataType === 'boolean') {
    return 'boolean';
  }

  if (dataType === 'date' || dataType.includes('timestamp')) {
    return 'date';
  }

  if (['integer', 'bigint', 'numeric', 'decimal', 'double precision', 'real'].includes(dataType)) {
    return 'number';
  }

  if (dataType === 'ARRAY' || dataType.startsWith('_') || columnName === 'tags') {
    return 'tags';
  }

  return 'text';
}

/**
 * Determine if field is sortable
 */
function isSortableField(columnName: string): boolean {
  // Most fields are sortable except arrays and metadata
  if (columnName === 'tags' || columnName === 'metadata') {
    return false;
  }
  return true;
}

/**
 * Determine if field is filterable
 */
function isFilterableField(columnName: string): boolean {
  // Most fields are filterable
  return true;
}

/**
 * Get data source configuration for dropdown fields
 */
function getDataSource(columnName: string): SchemaColumn['dataSource'] | undefined {
  if (columnName.startsWith('dl__')) {
    return {
      type: 'settings',
      datalabel: columnName  // Keep full dl__* name for API lookup
    };
  }
  return undefined;
}

/**
 * Get column width based on field type
 */
function getColumnWidth(columnName: string, dataType: string): string {
  // Currency/amount fields
  if (/_amt$|_amount$|_price$|_cost$/.test(columnName)) {
    return '120px';
  }

  // Date fields
  if (dataType === 'date') {
    return '120px';
  }

  // Timestamp fields
  if (dataType.includes('timestamp')) {
    return '150px';
  }

  // Boolean fields
  if (dataType === 'boolean') {
    return '100px';
  }

  // Code fields
  if (columnName === 'code') {
    return '120px';
  }

  // Name fields
  if (columnName === 'name') {
    return '200px';
  }

  // Default
  return '150px';
}

/**
 * Get column alignment based on field type
 */
function getColumnAlignment(columnName: string, dataType: string): 'left' | 'center' | 'right' {
  // Right-align numeric fields
  if (['integer', 'bigint', 'numeric', 'decimal', 'double precision', 'real'].includes(dataType)) {
    return 'right';
  }

  // Center-align booleans and badges
  if (dataType === 'boolean' || columnName.startsWith('dl__')) {
    return 'center';
  }

  // Default left alignment
  return 'left';
}
