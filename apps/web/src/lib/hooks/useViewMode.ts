import { useState } from 'react';
import type { ViewMode } from './useComponentViews';

/**
 * Hook to manage view mode state with localStorage persistence
 *
 * v17.0.0: ViewMode type now from useComponentViews (database-driven)
 *
 * @param entityName - The entity type (e.g., 'project', 'task')
 * @param defaultView - Default view (from useComponentViews.defaultView)
 * @returns [currentView, setView] tuple
 */
export function useViewMode(
  entityName: string,
  defaultView: ViewMode = 'table'
): [ViewMode, (view: ViewMode) => void] {
  const storageKey = `viewMode_${entityName}`;

  const [view, setViewState] = useState<ViewMode>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      // v17.0.0: Added 'calendar' and 'graph' to valid view modes
      if (stored && ['table', 'kanban', 'grid', 'calendar', 'graph'].includes(stored)) {
        return stored as ViewMode;
      }
    }
    return defaultView;
  });

  const setView = (newView: ViewMode) => {
    setViewState(newView);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newView);
    }
  };

  return [view, setView];
}
