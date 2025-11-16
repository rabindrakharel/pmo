/**
 * ============================================================================
 * ENTITY-TO-TABLE MAPPING - Single Source of Truth
 * ============================================================================
 *
 * Maps frontend entity types to database table names.
 * Used by schema-builder service and any code needing table resolution.
 *
 * NAMING CONVENTIONS:
 * - Most entities: d_{entity} (e.g., project → d_project)
 * - Exceptions handled explicitly in map below
 */

export const ENTITY_TABLE_MAP: Record<string, string> = {
  // Business entities
  'biz': 'd_business',
  'business': 'd_business',
  'office': 'd_office',
  'customer': 'd_cust',
  'cust': 'd_cust',

  // Project management
  'project': 'd_project',
  'task': 'd_task',

  // People
  'employee': 'd_employee',
  'role': 'd_role',
  'position': 'd_position',

  // Client management
  'client': 'd_client',
  'worksite': 'd_worksite',

  // Content
  'wiki': 'd_wiki',
  'artifact': 'd_artifact',
  'form': 'd_form_head',
  'report': 'd_reports',

  // Calendar & events
  'event': 'd_event',
  'calendar': 'd_calendar',
  'booking': 'd_booking',
  'interaction': 'd_interaction',

  // Products & services
  'product': 'd_product',
  'service': 'd_service',

  // Financial
  'cost': 'd_cost',
  'invoice': 'd_invoice',
  'order': 'd_order',

  // AI
  'chat': 'd_chat_session',

  // Settings tables (all use setting_datalabel_ prefix)
  'setting_office_level': 'setting_datalabel_office_level',
  'setting_business_level': 'setting_datalabel_business_level',
  'setting_project_stage': 'setting_datalabel_project_stage',
  'setting_task_stage': 'setting_datalabel_task_stage',
  'setting_task_priority': 'setting_datalabel_task_priority',
  'setting_position_level': 'setting_datalabel_position_level',
  'setting_client_level': 'setting_datalabel_client_level',
  'setting_client_status': 'setting_datalabel_client_status',
  'setting_customer_tier': 'setting_datalabel_customer_tier',
  'setting_industry_sector': 'setting_datalabel_industry_sector',
  'setting_acquisition_channel': 'setting_datalabel_acquisition_channel',
  'setting_opportunity_funnel_level': 'setting_datalabel_opportunity_funnel_level',
  'setting_task_update_type': 'setting_datalabel_task_update_type',
  'setting_wiki_publication_status': 'setting_datalabel_wiki_publication_status',
  'setting_form_approval_status': 'setting_datalabel_form_approval_status',
  'setting_form_submission_status': 'setting_datalabel_form_submission_status',
};

/**
 * Get database table name for entity type
 *
 * @param entityType - Frontend entity type (project, task, biz, etc.)
 * @returns Database table name (d_project, d_task, d_business, etc.)
 * @throws Error if entity type is unknown
 */
export function getTableName(entityType: string): string {
  const tableName = ENTITY_TABLE_MAP[entityType];

  if (!tableName) {
    // Try fallback pattern for unmapped entities
    const fallback = `d_${entityType}`;
    console.warn(`Unknown entity type "${entityType}", using fallback: ${fallback}`);
    return fallback;
  }

  return tableName;
}

/**
 * Get entity type from table name (reverse lookup)
 *
 * @param tableName - Database table name
 * @returns Entity type or null if not found
 */
export function getEntityTypeFromTable(tableName: string): string | null {
  const entry = Object.entries(ENTITY_TABLE_MAP).find(
    ([_, table]) => table === tableName
  );

  return entry ? entry[0] : null;
}

/**
 * Check if entity type is a settings entity
 *
 * @param entityType - Entity type to check
 * @returns True if entity is a settings table
 */
export function isSettingsEntity(entityType: string): boolean {
  return entityType.startsWith('setting_');
}

/**
 * Get all entity types
 *
 * @returns Array of all registered entity types
 */
export function getAllEntityTypes(): string[] {
  return Object.keys(ENTITY_TABLE_MAP);
}

/**
 * Get all core entity types (excludes settings)
 *
 * @returns Array of core entity types
 */
export function getCoreEntityTypes(): string[] {
  return Object.keys(ENTITY_TABLE_MAP).filter(
    type => !isSettingsEntity(type)
  );
}
