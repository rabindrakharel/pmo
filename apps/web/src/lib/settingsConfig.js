/**
 * ============================================================================
 * UNIFIED SETTINGS CONFIGURATION
 * ============================================================================
 *
 * DRY approach: All settings entities share the same structure.
 * Instead of repeating 12 times, we define once and generate.
 *
 * V3.0 UPDATE: Now uses centralized badge rendering from frontEndFormatterService.ts
 * All badge rendering logic moved to single source of truth.
 */
import React from 'react';
import { colorCodeToTailwindClass } from './formatters/valueFormatters';
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Render a colored badge using direct badge rendering
 */
function renderColorBadge(color, value) {
    const tailwindClass = colorCodeToTailwindClass(color);
    return (React.createElement("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tailwindClass}` }, value));
}
/**
 * Extract settings datalabel from column key
 * Examples: 'project_stage' -> 'project_stage', 'dl__task_priority' -> 'task_priority'
 */
function extractSettingsDatalabel(columnKey) {
    if (columnKey.startsWith('dl__')) {
        return columnKey.substring(4); // Remove 'dl__' prefix
    }
    return columnKey;
}
/**
 * Create a badge renderer function for a specific datalabel
 */
function createSettingBadgeRenderer(datalabel) {
    return (value, record) => {
        const color = record?.color_code || 'gray';
        return renderColorBadge(color, value);
    };
}
// ============================================================================
// COLOR SYSTEM
// ============================================================================
/**
 * Color options for dropdowns
 * Used in settings table color_code field
 * Each option includes metadata with Tailwind color classes for badge rendering
 * v8.3.2: BadgeDropdownSelect expects Tailwind classes in metadata.color_code
 */
export const COLOR_OPTIONS = [
    { value: 'blue', label: 'Blue', metadata: { color_code: 'bg-blue-100 text-blue-700' } },
    { value: 'purple', label: 'Purple', metadata: { color_code: 'bg-purple-100 text-purple-800' } },
    { value: 'green', label: 'Green', metadata: { color_code: 'bg-green-100 text-green-800' } },
    { value: 'red', label: 'Red', metadata: { color_code: 'bg-red-100 text-red-700' } },
    { value: 'yellow', label: 'Yellow', metadata: { color_code: 'bg-yellow-100 text-yellow-800' } },
    { value: 'orange', label: 'Orange', metadata: { color_code: 'bg-orange-100 text-orange-700' } },
    { value: 'gray', label: 'Gray', metadata: { color_code: 'bg-gray-100 text-gray-600' } },
    { value: 'cyan', label: 'Cyan', metadata: { color_code: 'bg-cyan-100 text-cyan-700' } },
    { value: 'pink', label: 'Pink', metadata: { color_code: 'bg-pink-100 text-pink-700' } },
    { value: 'amber', label: 'Amber', metadata: { color_code: 'bg-amber-100 text-amber-700' } },
];
// ============================================================================
// BADGE RENDERING
// ============================================================================
// All badge rendering uses direct inline rendering with colorCodeToTailwindClass()
// ============================================================================
/**
 * DRY ENHANCEMENT: Automatically apply badge renderer to datalabel columns
 *
 * This function processes column definitions and automatically adds:
 * - Database-driven badge rendering for settings fields
 * - Sorted dropdown options based on database sort_order
 *
 * Usage:
 * ```typescript
 * const columns = applySettingsBadgeRenderers([
 *   { key: 'project_stage', title: 'Stage', lookupSourceTable: 'datalabel' }
 * ]);
 * // Automatically adds: render: createSettingBadgeRenderer('project_stage')
 * ```
 */
// v12.0.0: Renamed lookupSource → lookupSourceTable, datalabelKey → lookupField
export function applySettingsBadgeRenderers(columns) {
    return columns.map(col => {
        // If lookupSourceTable is datalabel and no custom render function exists
        if ((col.lookupSourceTable === 'datalabel' || col.lookupField) && !col.render) {
            const datalabel = col.lookupField || extractSettingsDatalabel(col.key);
            return {
                ...col,
                render: createSettingBadgeRenderer(datalabel)
            };
        }
        return col;
    });
}
/**
 * Central registry of all settings entities
 * DRY: Define metadata once, generate everything else
 * Note: datalabel uses dl__ prefix for consistency with database naming
 */
export const SETTINGS_REGISTRY = [
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
    { key: 'industrySector', datalabel: 'dl__customer_industry_sector', displayName: 'Industry Sector', pluralName: 'Industry Sectors' },
    { key: 'acquisitionChannel', datalabel: 'dl__customer_acquisition_channel', displayName: 'Acquisition Channel', pluralName: 'Acquisition Channels' },
    { key: 'customerTier', datalabel: 'dl__customer_tier', displayName: 'Customer Tier', pluralName: 'Customer Tiers' },
    { key: 'expenseCategory', datalabel: 'dl__expense_category', displayName: 'Expense Category', pluralName: 'Expense Categories' },
    { key: 'expenseSubcategory', datalabel: 'dl__expense_subcategory', displayName: 'Expense Subcategory', pluralName: 'Expense Subcategories' },
    { key: 'revenueCategory', datalabel: 'dl__revenue_category', displayName: 'Revenue Category', pluralName: 'Revenue Categories' },
    { key: 'revenueSubcategory', datalabel: 'dl__revenue_subcategory', displayName: 'Revenue Subcategory', pluralName: 'Revenue Subcategories' },
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
        { key: 'id', title: 'ID', sortable: true, align: 'center', width: '80px' },
        {
            key: 'name',
            title: 'Name',
            sortable: true,
            filterable: true,
            render: (value, record) => renderColorBadge(record.color_code, value)
        },
        { key: 'descr', title: 'Description', sortable: true },
        { key: 'parent_id', title: 'Parent ID', sortable: true, align: 'center', width: '100px' },
        {
            key: 'color_code',
            title: 'Color',
            sortable: true,
            align: 'center',
            width: '120px',
            inlineEditable: true,
            options: COLOR_OPTIONS,
            render: (value) => {
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
        { key: 'id', label: 'ID', type: 'number', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'descr', label: 'Description', type: 'textarea' },
        { key: 'parent_id', label: 'Parent ID', type: 'number' },
        {
            key: 'color_code',
            label: 'Color',
            type: 'select',
            required: true,
            options: COLOR_OPTIONS
        }
    ];
}
/**
 * Generate complete entity config from definition
 * DRY: Factory pattern - one function generates all configs
 */
export function createSettingsEntityConfig(definition) {
    return {
        name: definition.key,
        displayName: definition.displayName,
        pluralName: definition.pluralName,
        apiEndpoint: `/api/v1/datalabel?name=${definition.datalabel}`,
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
export function getSettingDefinition(key) {
    return SETTINGS_REGISTRY.find(s => s.key === key);
}
/**
 * Get setting definition by datalabel
 */
export function getSettingByDatalabel(datalabel) {
    return SETTINGS_REGISTRY.find(s => s.datalabel === datalabel);
}
/**
 * Get API endpoint for a datalabel
 */
export function getSettingEndpoint(datalabel) {
    return `/api/v1/datalabel?name=${datalabel}`;
}
/**
 * Check if an entity key is a settings entity
 */
export function isSettingsEntity(key) {
    return SETTINGS_REGISTRY.some(s => s.key === key);
}
/**
 * Get all setting datalabels
 */
export function getAllDatalabels() {
    return SETTINGS_REGISTRY.map(s => s.datalabel);
}
