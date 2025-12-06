// ============================================================================
// useComponentViews Hook
// ============================================================================
// v17.0.0: Database-driven ONLY - no static fallback
// View configuration comes exclusively from entity.component_views JSONB column
// Fetched via /api/v1/entity/codes and cached via TanStack Query (30-min TTL)
// ============================================================================

import { useMemo } from 'react';
import { useEntityCodes } from '@/db/tanstack-index';
import type { ComponentViews, ComponentViewConfig } from '@/db/cache/types';

/**
 * View mode type - supported view modes for entity listing pages
 * v17.0.0: Moved here from entityConfig.ts (now database-driven only)
 */
export type ViewMode = 'table' | 'kanban' | 'grid' | 'calendar' | 'graph';

/**
 * View configuration returned by hook - database-driven only (v17.0.0)
 */
export interface DynamicViewConfig {
  /** Supported views for this entity (derived from component_views) */
  supportedViews: ViewMode[];

  /** Default view (first view with default: true, or first enabled view) */
  defaultView: ViewMode;

  /** Kanban configuration (from KanbanView component_views) */
  kanban?: {
    groupByField: string;
    metaTable?: string;
    cardFields: string[];
  };

  /** Grid configuration (from GridView component_views) */
  grid?: {
    cardFields: string[];
    imageField?: string;
  };

  /** Calendar configuration (from CalendarView component_views) */
  calendar?: {
    dateField?: string;
    endDateField?: string;
    titleField?: string;
  };

  /** Whether entity codes are still loading */
  isLoading: boolean;
}

/**
 * Map component view names to ViewMode
 */
const COMPONENT_TO_VIEW_MODE: Record<string, ViewMode> = {
  EntityListOfInstancesTable: 'table',
  KanbanView: 'kanban',
  GridView: 'grid',
  CalendarView: 'calendar',
  GraphView: 'graph',
};

/**
 * Extract supported views from component_views configuration
 */
function extractSupportedViews(componentViews: ComponentViews | undefined): ViewMode[] {
  if (!componentViews) return ['table'];

  const views: ViewMode[] = [];

  // Iterate through component views and extract enabled ones
  for (const [componentName, config] of Object.entries(componentViews)) {
    const viewConfig = config as ComponentViewConfig;
    if (viewConfig?.enabled) {
      const viewMode = COMPONENT_TO_VIEW_MODE[componentName];
      if (viewMode) {
        views.push(viewMode);
      }
    }
  }

  // Always have at least table view
  if (views.length === 0) {
    views.push('table');
  }

  return views;
}

/**
 * Extract default view from component_views configuration
 */
function extractDefaultView(componentViews: ComponentViews | undefined): ViewMode {
  if (!componentViews) return 'table';

  // Find the view with default: true
  for (const [componentName, config] of Object.entries(componentViews)) {
    const viewConfig = config as ComponentViewConfig;
    if (viewConfig?.enabled && viewConfig?.default) {
      const viewMode = COMPONENT_TO_VIEW_MODE[componentName];
      if (viewMode) {
        return viewMode;
      }
    }
  }

  // Fall back to first enabled view
  return extractSupportedViews(componentViews)[0];
}

/**
 * Hook to get dynamic component views configuration from database
 *
 * v17.0.0: Database-driven ONLY - no static fallback
 * All view configuration comes exclusively from entity.component_views JSONB column
 *
 * @param entityCode - Entity type code (e.g., 'task', 'project')
 * @returns Dynamic view configuration from database
 *
 * @example
 * ```tsx
 * const { supportedViews, defaultView, kanban, isLoading } = useComponentViews('task');
 *
 * // Use in ViewSwitcher
 * <ViewSwitcher
 *   currentView={view}
 *   supportedViews={supportedViews}
 *   onChange={setView}
 * />
 *
 * // Use kanban config
 * if (view === 'kanban' && kanban) {
 *   <KanbanView groupByField={kanban.groupByField} ... />
 * }
 * ```
 */
export function useComponentViews(entityCode: string): DynamicViewConfig {
  const { getByCode, isLoading } = useEntityCodes();

  const config = useMemo(() => {
    const entity = getByCode(entityCode);
    const componentViews = entity?.component_views;

    // v17.0.0: No static fallback - table view as default when no database config
    if (!componentViews || Object.keys(componentViews).length === 0) {
      return {
        supportedViews: ['table'] as ViewMode[],
        defaultView: 'table' as ViewMode,
        kanban: undefined,
        grid: undefined,
        calendar: undefined,
        isLoading,
      };
    }

    // Extract views from database config
    const supportedViews = extractSupportedViews(componentViews);
    const defaultView = extractDefaultView(componentViews);

    // Extract kanban config
    const kanbanConfig = componentViews.KanbanView;
    const kanban = kanbanConfig?.enabled ? {
      groupByField: kanbanConfig.groupByField || 'dl__stage',
      metaTable: kanbanConfig.groupByField, // Usually same as groupByField for datalabel tables
      cardFields: kanbanConfig.cardFields || ['name'],
    } : undefined;

    // Extract grid config
    const gridConfig = componentViews.GridView;
    const grid = gridConfig?.enabled ? {
      cardFields: gridConfig.cardFields || ['name', 'descr'],
      imageField: undefined, // Can be extended if needed
    } : undefined;

    // Extract calendar config
    const calendarConfig = componentViews.CalendarView;
    const calendar = calendarConfig?.enabled ? {
      dateField: calendarConfig.dateField,
      endDateField: calendarConfig.endDateField,
      titleField: calendarConfig.titleField,
    } : undefined;

    return {
      supportedViews,
      defaultView,
      kanban,
      grid,
      calendar,
      isLoading,
    };
  }, [entityCode, getByCode, isLoading]);

  return config;
}

// v17.0.0: useMergedEntityConfig REMOVED
// Static entityConfig fallback pattern eliminated
// Use useComponentViews() directly - all view config is database-driven only
//
// MIGRATION:
//   Before: const viewConfig = useMergedEntityConfig(entityCode, config);
//   After:  const viewConfig = useComponentViews(entityCode);
