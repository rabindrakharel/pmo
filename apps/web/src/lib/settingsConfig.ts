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
 * Each option includes metadata with color_code for badge rendering
 */
export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', metadata: { color_code: 'blue' } },
  { value: 'purple', label: 'Purple', metadata: { color_code: 'purple' } },
  { value: 'green', label: 'Green', metadata: { color_code: 'green' } },
  { value: 'red', label: 'Red', metadata: { color_code: 'red' } },
  { value: 'yellow', label: 'Yellow', metadata: { color_code: 'yellow' } },
  { value: 'orange', label: 'Orange', metadata: { color_code: 'orange' } },
  { value: 'gray', label: 'Gray', metadata: { color_code: 'gray' } },
  { value: 'cyan', label: 'Cyan', metadata: { color_code: 'cyan' } },
  { value: 'pink', label: 'Pink', metadata: { color_code: 'pink' } },
  { value: 'amber', label: 'Amber', metadata: { color_code: 'amber' } },
];

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
export function createSettingBadgeRenderer(datalabel: string) {
  // Preload colors for this datalabel
  loadSettingsColors(datalabel);

  // Return renderer function
  return (value: string | null | undefined): React.ReactElement => {
    return renderSettingBadge(value, { datalabel });
  };
}

/**
 * Extract settings datalabel from field key
 *
 * Examples:
 * - dl__project_stage → dl__project_stage
 * - dl__customer_opportunity_funnel → dl__customer_opportunity_funnel
 * - project_stage → dl__project_stage (legacy support)
 * - stage → dl__task_stage (special case)
 * - priority_level → dl__task_priority (special case)
 */
function extractSettingsDatalabel(fieldKey: string): string {
  // If already has dl__ prefix, return as-is
  if (fieldKey.startsWith('dl__')) {
    return fieldKey;
  }

  // Remove common suffixes
  let datalabel = fieldKey
    .replace(/_name$/, '')
    .replace(/_id$/, '')
    .replace(/_level_id$/, '');

  // Special mappings for short field names
  const specialMappings: Record<string, string> = {
    'stage': 'dl__task_stage',
    'priority_level': 'dl__task_priority',
    'status': 'dl__task_stage'
  };

  // Return with dl__ prefix
  return specialMappings[datalabel] || `dl__${datalabel}`;
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
      const datalabel = extractSettingsDatalabel(col.key);
      return {
        ...col,
        render: createSettingBadgeRenderer(datalabel)
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
  datalabel: string;              // e.g., 'dl__project_stage' (with dl__ prefix)
  displayName: string;            // e.g., 'Project Stage'
  pluralName: string;             // e.g., 'Project Stages'
  supportedViews?: ('table' | 'kanban' | 'grid' | 'graph')[];
  defaultView?: 'table' | 'kanban' | 'grid' | 'graph';
}

/**
 * Central registry of all settings entities
 * DRY: Define metadata once, generate everything else
 * Note: datalabel uses dl__ prefix for consistency with database naming
 */
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  { key: 'projectStage', datalabel: 'dl__project_stage', displayName: 'Project Stage', pluralName: 'Project Stages', supportedViews: ['table', 'graph'], defaultView: 'table' },
  { key: 'projectStatus', datalabel: 'dl__project_status', displayName: 'Project Status', pluralName: 'Project Statuses' },
  { key: 'taskStage', datalabel: 'dl__task_stage', displayName: 'Task Stage', pluralName: 'Task Stages', supportedViews: ['table', 'graph'], defaultView: 'table' },
  { key: 'taskPriority', datalabel: 'dl__task_priority', displayName: 'Task Priority', pluralName: 'Task Priorities' },
  { key: 'businessLevel', datalabel: 'dl__business_level', displayName: 'Business Level', pluralName: 'Business Levels' },
  { key: 'orgLevel', datalabel: 'dl__office_level', displayName: 'Office Level', pluralName: 'Office Levels' },
  { key: 'hrLevel', datalabel: 'dl__hr_level', displayName: 'HR Level', pluralName: 'HR Levels' },
  { key: 'clientLevel', datalabel: 'dl__client_level', displayName: 'Client Level', pluralName: 'Client Levels' },
  { key: 'positionLevel', datalabel: 'dl__position_level', displayName: 'Position Level', pluralName: 'Position Levels' },
  { key: 'opportunityFunnelLevel', datalabel: 'dl__customer_opportunity_funnel', displayName: 'Customer Opportunity Funnel', pluralName: 'Customer Opportunity Funnels' },
  { key: 'industrySector', datalabel: 'dl__industry_sector', displayName: 'Industry Sector', pluralName: 'Industry Sectors' },
  { key: 'acquisitionChannel', datalabel: 'dl__acquisition_channel', displayName: 'Acquisition Channel', pluralName: 'Acquisition Channels' },
  { key: 'customerTier', datalabel: 'dl__customer_tier', displayName: 'Customer Tier', pluralName: 'Customer Tiers' },
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
      inlineEditable: true,
      options: COLOR_OPTIONS,
      render: (value: any) => {
        // Capitalize first letter for display
        const displayValue = value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
        return renderColorBadge(value, displayValue);
      }
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
      options: COLOR_OPTIONS
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
