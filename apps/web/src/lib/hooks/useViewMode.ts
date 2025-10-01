import { useState, useEffect } from 'react';
import { ViewMode, getDefaultView } from '../entityConfig';

/**
 * Hook to manage view mode state with localStorage persistence
 *
 * @param entityName - The entity type (e.g., 'project', 'task')
 * @param defaultView - Optional default view (falls back to entity config default)
 * @returns [currentView, setView] tuple
 */
export function useViewMode(
  entityName: string,
  defaultView?: ViewMode
): [ViewMode, (view: ViewMode) => void] {
  const storageKey = `viewMode_${entityName}`;
  const initialView = defaultView || getDefaultView(entityName);

  const [view, setViewState] = useState<ViewMode>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored && (stored === 'table' || stored === 'kanban' || stored === 'grid')) {
        return stored as ViewMode;
      }
    }
    return initialView;
  });

  const setView = (newView: ViewMode) => {
    setViewState(newView);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newView);
    }
  };

  return [view, setView];
}
