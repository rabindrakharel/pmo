/**
 * Universal Schema Inference
 *
 * Infers UI/behavioral metadata for any table based on column names and sample values.
 * Removes the need for per-table SCHEMA_METADATA definitions.
 */

export interface ColumnMetadata {
  'api:restrict'?: boolean;
  'api:pii_masking'?: boolean;
  'api:financial_masking'?: boolean;
  'api:auth_field'?: boolean;
  'ui:invisible'?: boolean;
  'ui:search'?: boolean;
  'ui:sort'?: boolean;
  'ui:color_field'?: boolean;
  'ui:geographic'?: boolean;
  'ui:timeline'?: boolean; // dates/timestamp
  'ui:progress'?: boolean; // numeric percentage/hours/points
  'ui:stakeholders'?: boolean; // arrays of stakeholders
  'ui:hierarchy'?: boolean; // parent_id / level_id
  'ui:assignment'?: boolean; // assignee/reporter
  'ui:code'?: boolean; // code/slug-like
  'ui:json'?: boolean; // display JSON
  'ui:tags'?: boolean; // array of strings
  'ui:type'?:
    | 'string'
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'json'
    | 'array'
    | 'badge'
    | 'reference';
  flexible?: boolean; // generic JSON
}

export type TableMetadata = {
  tableName: string;
  columns: Record<string, ColumnMetadata>;
  defaultBehavior: ColumnMetadata;
};

// Helpers
const isISODate = (v: any) =>
  typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v));
const isISOTimestamp = (v: any) =>
  typeof v === 'string' && /T\d{2}:\d{2}/.test(v) && !isNaN(Date.parse(v));

const lower = (s: string) => s.toLowerCase();

// Column name keyword sets
const PII_FIELDS = new Set([
  'email',
  'addr',
  'address',
  'postal_code',
  'phone',
  'mobile',
  'birth_date',
  'sin',
  'ssn',
]);

const AUDIT_FIELDS = new Set(['created', 'updated', 'from_ts', 'to_ts', 'active']);

const CODE_FIELDS = new Set([
  'project_code',
  'task_code',
  'position_code',
  'worksite_code',
  'cost_center_code',
  'code',
  'slug',
]);

const FINANCIAL_FIELDS = new Set([
  'budget_allocated',
  'approval_limit',
  'salary_band_min',
  'salary_band_max',
]);

const TIMELINE_FIELDS = new Set([
  'planned_start_date',
  'planned_end_date',
  'actual_start_date',
  'actual_end_date',
  'due_date',
  'start_date',
  'completion_date',
]);

const PROGRESS_FIELDS = new Set([
  'estimated_hours',
  'actual_hours',
  'story_points',
  'completion_percentage',
  'percent_complete',
  'time_spent',
]);

const STAKEHOLDER_FIELDS = ['project_managers', 'project_sponsors', 'project_leads', 'reviewers', 'approvers', 'collaborators', 'watchers'];

const ASSIGNMENT_FIELDS = new Set(['assignee_id', 'reporter_id']);

const STATUS_STAGE_PRIORITY = new Set(['status', 'current_status', 'status_name', 'stage', 'current_stage', 'stage_name', 'priority', 'priority_level', 'security_classification']);

const HIERARCHY_FIELDS = new Set(['parent_id', 'level_id']);

const TAG_LIKE_FIELDS = new Set(['tags']);

function isIdColumn(name: string) {
  return name === 'id' || name.endsWith('_id');
}

function inferUiType(name: string, value: any): ColumnMetadata['ui:type'] {
  const n = lower(name);
  if (AUDIT_FIELDS.has(n)) return n === 'active' ? 'boolean' : 'datetime';
  if (n.endsWith('_date')) return 'date';
  if (n.endsWith('_ts') || n.includes('timestamp')) return 'datetime';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'json';
  if (isISODate(value)) return 'date';
  if (isISOTimestamp(value)) return 'datetime';
  if (STATUS_STAGE_PRIORITY.has(n)) return 'badge';
  return 'string';
}

export function inferColumnMetadata(
  tableName: string,
  columnName: string,
  sampleValue?: any
): ColumnMetadata {
  const n = lower(columnName);
  const meta: ColumnMetadata = {};

  // Invisibility & restrictions
  if (isIdColumn(n)) meta['ui:invisible'] = true;
  if (AUDIT_FIELDS.has(n)) meta['api:restrict'] = true;

  // PII & financial
  if (PII_FIELDS.has(n)) meta['api:pii_masking'] = true;
  if (FINANCIAL_FIELDS.has(n)) meta['api:financial_masking'] = true;

  // Search/sort defaults
  if (['name', 'title', 'descr', 'description'].includes(n)) meta['ui:search'] = true;
  if (['name', 'title'].includes(n)) meta['ui:sort'] = true;
  if (CODE_FIELDS.has(n)) {
    meta['ui:search'] = true;
    meta['ui:code'] = true;
  }

  // Timeline
  if (TIMELINE_FIELDS.has(n) || n.endsWith('_date')) meta['ui:timeline'] = true;

  // Progress
  if (PROGRESS_FIELDS.has(n)) meta['ui:progress'] = true;

  // Stakeholders & assignment
  if (STAKEHOLDER_FIELDS.includes(n)) meta['ui:stakeholders'] = true;
  if (ASSIGNMENT_FIELDS.has(n)) meta['ui:assignment'] = true;

  // Status / Stage / Priority
  if (STATUS_STAGE_PRIORITY.has(n)) meta['ui:color_field'] = true;
  if (n.endsWith('_status') || n.endsWith('status_id') || n.endsWith('_stage') || n.endsWith('stage_id') || n === 'priority') {
    meta['ui:color_field'] = true;
  }

  // Hierarchy
  if (HIERARCHY_FIELDS.has(n)) meta['ui:hierarchy'] = true;

  // Geography
  if (n === 'geom' || n.includes('time_zone') || n.includes('timezone')) meta['ui:geographic'] = true;

  // JSON / flexible
  if (n === 'tags') {
    meta['ui:tags'] = true;
    meta.flexible = true;
  }
  if (n === 'attr' || n === 'milestones' || n === 'deliverables' || n.includes('log') || n.includes('metadata') || n === 'clients' || n === 'compliance_requirements' || n === 'risk_assessment' || n === 'work_log' || n === 'attachments' || n === 'acceptance_criteria' || n === 'quality_check_results' || n === 'approval_history' || n === 'collaboration_log' || n === 'external_references' || n === 'deliverables_status' || n === 'risk_updates' || n === 'resource_usage' || n === 'schema') {
    meta.flexible = true;
    meta['ui:json'] = true;
  }

  // Type
  meta['ui:type'] = inferUiType(n, sampleValue);

  return meta;
}

export function inferTableMetadataFromSample(
  tableName: string,
  sampleRows: Record<string, any>[]
): TableMetadata {
  const columns = new Set<string>();
  for (const row of sampleRows) {
    Object.keys(row || {}).forEach((k) => columns.add(k));
  }
  const colMeta: Record<string, ColumnMetadata> = {};
  for (const col of columns) {
    // pick first non-undefined value as sample
    const sample = sampleRows.find((r) => r && r[col] !== undefined)?.[col];
    colMeta[col] = inferColumnMetadata(tableName, col, sample);
  }
  return { tableName, columns: colMeta, defaultBehavior: {} };
}

export function inferSearchableColumns(meta: TableMetadata): string[] {
  const cols = Object.entries(meta.columns)
    .filter(([_, m]) => m['ui:search'])
    .map(([k]) => k);
  // Fallbacks
  if (cols.length === 0) {
    ['name', 'title', 'descr', 'description', 'slug', 'project_code', 'task_code'].forEach((k) => {
      if (meta.columns[k]) cols.push(k);
    });
  }
  return [...new Set(cols)];
}

export function inferVisibleColumns(meta: TableMetadata): string[] {
  // Hide invisible/restricted by default
  const visible = Object.entries(meta.columns)
    .filter(([k, m]) => !m['ui:invisible'] && !m['api:auth_field'])
    .map(([k]) => k);
  return visible;
}

export function orderColumns(meta: TableMetadata, columns: string[]): string[] {
  const priority = (c: string) => {
    const n = c.toLowerCase();
    if (n === 'name' || n === 'title') return 0;
    if (STATUS_STAGE_PRIORITY.has(n)) return 1;
    if (n === 'assignee_id' || n === 'reporter_id') return 2;
    if (n === 'due_date' || n.endsWith('_date')) return 3;
    if (TAG_LIKE_FIELDS.has(n)) return 4;
    if (CODE_FIELDS.has(n)) return 5;
    if (AUDIT_FIELDS.has(n)) return 99;
    if (isIdColumn(n)) return 100;
    return 50;
  };
  return [...columns].sort((a, b) => priority(a) - priority(b));
}

export function isTextual(m: ColumnMetadata): boolean {
  return m['ui:type'] === 'string' || m['ui:type'] === 'text';
}

