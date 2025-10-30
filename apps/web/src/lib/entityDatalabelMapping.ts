/**
 * Entity to Datalabel Mapping Configuration
 *
 * Maps data labels (settings) to their corresponding entities.
 * Used for organizing settings sidebar by entity grouping.
 */

export interface EntityDatalabelGroup {
  entityCode: string;
  entityName: string;
  entityIcon: string;
  datalabels: string[];
}

/**
 * Mapping of datalabels to their parent entities
 * Key: datalabel_name (with double underscores from database)
 * Value: entity code
 */
export const DATALABEL_TO_ENTITY_MAP: Record<string, string> = {
  // Project-related labels
  'project__stage': 'project',

  // Task-related labels
  'task__stage': 'task',
  'task__priority': 'task',
  'task__update_type': 'task',

  // Business-related labels
  'business__level': 'business',

  // Office-related labels
  'office__level': 'office',

  // Position-related labels
  'position__level': 'position',

  // Client/Customer-related labels
  'customer__tier': 'cust',
  'client__status': 'cust',
  'client__service': 'cust',
  'industry__sector': 'cust',
  'acquisition__channel': 'cust',
  'opportunity__funnel_stage': 'cust',

  // Form-related labels
  'form__approval_status': 'form',
  'form__submission_status': 'form',

  // Wiki-related labels
  'wiki__publication_status': 'wiki',
};

/**
 * Convert datalabel name from database format (double underscore) to URL format (single underscore)
 * Example: project__stage → project_stage
 */
export function convertDatalabelToUrlFormat(datalabelName: string): string {
  return datalabelName.replace(/__/g, '_');
}

/**
 * Convert datalabel name to camelCase for URL routing
 * Example: project__stage → projectStage
 */
export function convertDatalabelToCamelCase(datalabelName: string): string {
  const parts = datalabelName.replace(/__/g, '_').split('_');
  return parts[0] + parts.slice(1).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join('');
}

/**
 * Group datalabels by their parent entity
 */
export function groupDatalabelsByEntity(datalabels: Array<{
  datalabel_name: string;
  ui_label: string;
  ui_icon: string;
}>): Record<string, Array<{
  datalabel_name: string;
  ui_label: string;
  ui_icon: string;
  urlFormat: string;
}>> {
  const grouped: Record<string, Array<any>> = {};

  for (const datalabel of datalabels) {
    const entityCode = DATALABEL_TO_ENTITY_MAP[datalabel.datalabel_name];

    if (entityCode) {
      if (!grouped[entityCode]) {
        grouped[entityCode] = [];
      }

      grouped[entityCode].push({
        ...datalabel,
        urlFormat: convertDatalabelToCamelCase(datalabel.datalabel_name)
      });
    }
  }

  return grouped;
}

/**
 * Entity metadata for display
 */
export const ENTITY_METADATA: Record<string, { name: string; icon: string; order: number }> = {
  'project': { name: 'Project', icon: 'FolderOpen', order: 1 },
  'task': { name: 'Task', icon: 'CheckSquare', order: 2 },
  'cust': { name: 'Customer', icon: 'Users', order: 3 },
  'business': { name: 'Business', icon: 'Building2', order: 4 },
  'office': { name: 'Office', icon: 'MapPin', order: 5 },
  'position': { name: 'Position', icon: 'Briefcase', order: 6 },
  'form': { name: 'Form', icon: 'FileText', order: 7 },
  'wiki': { name: 'Wiki', icon: 'BookOpen', order: 8 },
};
