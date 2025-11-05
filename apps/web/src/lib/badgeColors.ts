import React from 'react';

/**
 * ============================================================================
 * CENTRALIZED BADGE COLOR SYSTEM (DRY)
 * ============================================================================
 *
 * IMPORTANT: This is a temporary solution until color_code is added to database.
 *
 * FUTURE: When database adds color_code column to settings tables:
 * - Colors will come from API response
 * - This file becomes unnecessary
 * - Remove all color mappings here
 * - Use color_code from SettingOption.metadata.color_code
 *
 * CURRENT: Centralized color mapping to avoid duplication across entity configs
 */

/**
 * Get badge color class for a given value based on semantic naming
 * Uses pattern matching to determine color based on status/stage type
 */
export function getBadgeColorClass(value: string | null | undefined): string {
  if (!value) return 'bg-dark-100 text-dark-600';

  const val = value.toLowerCase();

  // ========== PROJECT STAGES ==========
  if (val === 'initiation') return 'bg-dark-100 text-dark-600';
  if (val === 'planning') return 'bg-purple-100 text-purple-800';
  if (val === 'execution') return 'bg-yellow-100 text-yellow-800';
  if (val === 'monitoring') return 'bg-orange-100 text-orange-800';
  if (val === 'closure') return 'bg-green-100 text-green-800';

  // ========== TASK STAGES ==========
  if (val === 'backlog') return 'bg-dark-100 text-dark-600';
  if (val === 'to do') return 'bg-dark-100 text-dark-600';
  if (val === 'in progress') return 'bg-yellow-100 text-yellow-800';
  if (val === 'in review') return 'bg-purple-100 text-purple-800';
  if (val === 'done') return 'bg-green-100 text-green-800';
  if (val === 'blocked') return 'bg-red-100 text-red-800';

  // ========== PRIORITY LEVELS ==========
  if (val === 'critical' || val === 'urgent') return 'bg-red-200 text-red-900';
  if (val === 'high') return 'bg-red-100 text-red-800';
  if (val === 'medium') return 'bg-yellow-100 text-yellow-800';
  if (val === 'low') return 'bg-green-100 text-green-800';

  // ========== PUBLICATION STATUS (Wiki) ==========
  if (val === 'published') return 'bg-green-100 text-green-800';
  if (val === 'draft') return 'bg-yellow-100 text-yellow-800';
  if (val === 'review') return 'bg-dark-100 text-dark-600';
  if (val === 'archived') return 'bg-dark-100 text-dark-600';
  if (val === 'deprecated') return 'bg-red-100 text-red-800';
  if (val === 'private') return 'bg-purple-100 text-purple-800';

  // ========== WIKI TYPES ==========
  if (val === 'page') return 'bg-dark-100 text-dark-600';
  if (val === 'template') return 'bg-purple-100 text-purple-800';
  if (val === 'workflow') return 'bg-green-100 text-green-800';
  if (val === 'guide') return 'bg-yellow-100 text-yellow-800';
  if (val === 'policy') return 'bg-red-100 text-red-800';
  if (val === 'checklist') return 'bg-indigo-100 text-indigo-800';

  // ========== ARTIFACT TYPES ==========
  if (val === 'document') return 'bg-dark-100 text-dark-600';
  if (val === 'template') return 'bg-purple-100 text-purple-800';
  if (val === 'image') return 'bg-green-100 text-green-800';
  if (val === 'video') return 'bg-rose-100 text-rose-800';
  if (val === 'spreadsheet') return 'bg-emerald-100 text-emerald-800';
  if (val === 'presentation') return 'bg-orange-100 text-orange-800';

  // ========== VISIBILITY ==========
  if (val === 'public') return 'bg-green-100 text-green-800';
  if (val === 'internal') return 'bg-dark-100 text-dark-600';
  if (val === 'restricted') return 'bg-amber-100 text-amber-800';
  if (val === 'private') return 'bg-dark-100 text-dark-600';

  // ========== SECURITY CLASSIFICATION ==========
  if (val === 'general') return 'bg-dark-100 text-dark-600';
  if (val === 'confidential') return 'bg-orange-100 text-orange-800';
  if (val === 'restricted') return 'bg-red-100 text-red-800';

  // ========== STATUS TYPES (General) ==========
  if (val === 'active') return 'bg-green-100 text-green-800';
  if (val === 'inactive') return 'bg-red-100 text-red-800';
  if (val === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (val === 'completed') return 'bg-green-100 text-green-800';
  if (val === 'cancelled') return 'bg-red-100 text-red-800';

  // ========== ENTITY TYPE BADGES ==========
  if (val === 'project') return 'bg-indigo-100 text-indigo-800';
  if (val === 'task') return 'bg-cyan-100 text-cyan-800';
  if (val === 'office') return 'bg-violet-100 text-violet-800';
  if (val === 'business') return 'bg-fuchsia-100 text-fuchsia-800';

  // Default: gray
  return 'bg-dark-100 text-dark-600';
}

/**
 * Render a badge with automatic color selection
 * TO BE USED IN ENTITY CONFIGS INSTEAD OF HARDCODED COLOR MAPS
 */
export function renderBadgeAuto(value: string | null | undefined): React.ReactElement {
  if (!value) {
    return React.createElement(
      'span',
      { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600' },
      '-'
    );
  }

  const colorClass = getBadgeColorClass(value);

  return React.createElement(
    'span',
    { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}` },
    value
  );
}
