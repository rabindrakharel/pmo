/**
 * ============================================================================
 * UNIFIED SETTINGS CONFIGURATION
 * ============================================================================
 *
 * DRY approach: All settings entities share the same structure.
 * Instead of repeating 12 times, we define once and generate.
 *
 * V3.0 UPDATE: Now uses centralized badge rendering from data_transform_render.tsx
 * All badge rendering logic moved to single source of truth.
 */

import React from 'react';
import {
  renderSettingBadge,
  loadSettingsColors,
  COLOR_MAP
} from './data_transform_render';

// ============================================================================
// COLOR SYSTEM - Re-exports from centralized source
// ============================================================================

/**
 * Color options for dropdowns
 * Used in settings table color_code field
 */
export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'gray', label: 'Gray' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'pink', label: 'Pink' },
  { value: 'amber', label: 'Amber' },
] as const;

// Re-export COLOR_MAP from centralized source
export { COLOR_MAP };

// ============================================================================
// BADGE RENDERERS - Wrappers for centralized functions
// ============================================================================

/**
 * Universal Badge Renderer for Settings Tables
 *
 * USE CASE: Settings Tables (project_stage, task_priority, etc.)
 * - Pass color_code directly from record
 * - Example: renderColorBadge(record.color_code, value)
 *
 * @deprecated Use renderSettingBadge from data_transform_render.tsx directly
 */
export function renderColorBadge(colorCode: string, label?: string): React.ReactElement {
  return renderSettingBadge(colorCode, label);
}

/**
 * Create a badge renderer that fetches colors from settings database
 *
 * DRY SOLUTION for entity tables (project, task, client, etc.)
 *
 * Usage in entityConfig.ts:
 * ```typescript
 * {
 *   key: 'project_stage',
 *   title: 'Stage',
 *   render: createSettingBadgeRenderer('project_stage')
 * }
 * ```
 *
 * This replaces hardcoded color maps with database-driven colors.
 */
export function createSettingBadgeRenderer(category: string) {
  // Preload colors for this category
  loadSettingsColors(category);

  // Return renderer function
  return (value: string | null | undefined): React.ReactElement => {
    return renderSettingBadge(value, { category });
  };
}

/**
 * Extract settings category from field key
 *
 * Examples:
 * - project_stage → project_stage
 * - opportunity_funnel_stage_name → opportunity_funnel_stage
 * - customer_tier_name → customer_tier
 * - stage → task_stage (special case for task.stage)
 * - priority_level → task_priority (special case)
 */
function extractSettingsCategory(fieldKey: string): string {
  // Remove common suffixes
  let category = fieldKey
    .replace(/_name$/, '')
    .replace(/_id$/, '')
    .replace(/_level_id$/, '');

  // Special mappings for short field names
  const specialMappings: Record<string, string> = {
    'stage': 'task_stage',
    'priority_level': 'task_priority',
    'status': 'task_stage'
  };

  return specialMappings[category] || category;
}

/**
 * DRY ENHANCEMENT: Automatically apply badge renderer to columns with loadOptionsFromSettings
 *
 * This function processes column definitions and automatically adds:
 * - Database-driven badge rendering for settings fields
 * - Sorted dropdown options based on database sort_order
 *
 * Usage:
 * ```typescript
 * const columns = applySettingsBadgeRenderers([
 *   { key: 'project_stage', title: 'Stage', loadOptionsFromSettings: true }
 * ]);
 * // Automatically adds: render: renderSettingBadge('project_stage')
 * ```
 */
export function applySettingsBadgeRenderers<T extends { key: string; loadOptionsFromSettings?: boolean; render?: any }>(
  columns: T[]
): T[] {
  return columns.map(col => {
    // If loadOptionsFromSettings is true and no custom render function exists
    if (col.loadOptionsFromSettings && !col.render) {
      const category = extractSettingsCategory(col.key);
      return {
        ...col,
        render: createSettingBadgeRenderer(category)
      };
    }
    return col;
  });
}

// ============================================================================
// SETTINGS REGISTRY - Configuration over Repetition
// ============================================================================

export interface SettingDefinition {
  key: string;                    // e.g., 'projectStage'
  datalabel: string;              // e.g., 'project_stage' (snake_case)
  displayName: string;            // e.g., 'Project Stage'
  pluralName: string;             // e.g., 'Project Stages'
  supportedViews?: ('table' | 'kanban' | 'grid' | 'graph')[];
  defaultView?: 'table' | 'kanban' | 'grid' | 'graph';
}

/**
 * Central registry of all settings entities
 * DRY: Define metadata once, generate everything else
 */
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  { key: 'projectStage', datalabel: 'project_stage', displayName: 'Project Stage', pluralName: 'Project Stages', supportedViews: ['table', 'graph'], defaultView: 'table' },
  { key: 'projectStatus', datalabel: 'project_status', displayName: 'Project Status', pluralName: 'Project Statuses' },
  { key: 'taskStage', datalabel: 'task_stage', displayName: 'Task Stage', pluralName: 'Task Stages', supportedViews: ['table', 'graph'], defaultView: 'table' },
  { key: 'taskPriority', datalabel: 'task_priority', displayName: 'Task Priority', pluralName: 'Task Priorities' },
  { key: 'businessLevel', datalabel: 'business_level', displayName: 'Business Level', pluralName: 'Business Levels' },
  { key: 'orgLevel', datalabel: 'office_level', displayName: 'Office Level', pluralName: 'Office Levels' },
  { key: 'hrLevel', datalabel: 'hr_level', displayName: 'HR Level', pluralName: 'HR Levels' },
  { key: 'clientLevel', datalabel: 'client_level', displayName: 'Client Level', pluralName: 'Client Levels' },
  { key: 'positionLevel', datalabel: 'position_level', displayName: 'Position Level', pluralName: 'Position Levels' },
  { key: 'opportunityFunnelLevel', datalabel: 'opportunity_funnel_stage', displayName: 'Opportunity Funnel Stage', pluralName: 'Opportunity Funnel Stages' },
  { key: 'industrySector', datalabel: 'industry_sector', displayName: 'Industry Sector', pluralName: 'Industry Sectors' },
  { key: 'acquisitionChannel', datalabel: 'acquisition_channel', displayName: 'Acquisition Channel', pluralName: 'Acquisition Channels' },
  { key: 'customerTier', datalabel: 'customer_tier', displayName: 'Customer Tier', pluralName: 'Customer Tiers' },
];

// ============================================================================
// FACTORY FUNCTIONS - Generate Entities from Configuration
// ============================================================================

/**
 * Generate standard columns for any settings entity
 * DRY: Same structure for all settings, no repetition
 */
export function createSettingsColumns() {
  return [
    { key: 'id', title: 'ID', sortable: true, align: 'center' as const, width: '80px' },
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      filterable: true,
      render: (value: any, record: any) => renderColorBadge(record.color_code, value)
    },
    { key: 'descr', title: 'Description', sortable: true },
    { key: 'parent_id', title: 'Parent ID', sortable: true, align: 'center' as const, width: '100px' },
    {
      key: 'color_code',
      title: 'Color',
      sortable: true,
      align: 'center' as const,
      width: '120px',
      inlineEditable: true
    }
  ];
}

/**
 * Generate standard fields for any settings entity
 * DRY: Same fields for all settings, no repetition
 */
export function createSettingsFields() {
  return [
    { key: 'id', label: 'ID', type: 'number' as const, required: true },
    { key: 'name', label: 'Name', type: 'text' as const, required: true },
    { key: 'descr', label: 'Description', type: 'textarea' as const },
    { key: 'parent_id', label: 'Parent ID', type: 'number' as const },
    {
      key: 'color_code',
      label: 'Color',
      type: 'select' as const,
      required: true,
      options: COLOR_OPTIONS.map(c => ({ value: c.value, label: c.label }))
    }
  ];
}

/**
 * Generate complete entity config from definition
 * DRY: Factory pattern - one function generates all configs
 */
export function createSettingsEntityConfig(definition: SettingDefinition) {
  return {
    name: definition.key,
    displayName: definition.displayName,
    pluralName: definition.pluralName,
    apiEndpoint: `/api/v1/setting?datalabel=${definition.datalabel}`,
    columns: createSettingsColumns(),
    fields: createSettingsFields(),
    supportedViews: definition.supportedViews || ['table'],
    defaultView: definition.defaultView || 'table'
  };
}

// ============================================================================
// HELPERS - Utility Functions
// ============================================================================

/**
 * Get setting definition by key
 */
export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return SETTINGS_REGISTRY.find(s => s.key === key);
}

/**
 * Get setting definition by datalabel
 */
export function getSettingByDatalabel(datalabel: string): SettingDefinition | undefined {
  return SETTINGS_REGISTRY.find(s => s.datalabel === datalabel);
}

/**
 * Get API endpoint for a datalabel
 */
export function getSettingEndpoint(datalabel: string): string {
  return `/api/v1/setting?datalabel=${datalabel}`;
}

/**
 * Check if an entity key is a settings entity
 */
export function isSettingsEntity(key: string): boolean {
  return SETTINGS_REGISTRY.some(s => s.key === key);
}

/**
 * Get all setting datalabels
 */
export function getAllDatalabels(): string[] {
  return SETTINGS_REGISTRY.map(s => s.datalabel);
}
