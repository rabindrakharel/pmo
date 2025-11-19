import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NavigationHistory Context
 *
 * Tracks the hierarchical navigation path through entities.
 * Example path: Business → Project → Task → Wiki
 *
 * Features:
 * - Maintains stack of visited entities with their IDs and names
 * - Provides smart "back" navigation
 * - Displays visual breadcrumb tree on the left side
 */

export interface NavigationNode {
  entityCode: string;
  entityId: string;
  entityName: string;
  timestamp: number;
  // Optional: which tab to return to when going back
  activeChildTab?: string;
}

interface NavigationHistoryContextType {
  history: NavigationNode[];
  pushEntity: (node: NavigationNode) => void;
  popEntity: () => NavigationNode | undefined;
  clearHistory: () => void;
  goBack: () => void;
  getCurrentEntity: () => NavigationNode | undefined;
  getParentEntity: () => NavigationNode | undefined;
  updateCurrentEntityName: (name: string) => void;
  updateParentActiveTab: (childType: string) => void;
  updateCurrentEntityActiveTab: (childType: string) => void;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<NavigationNode[]>([]);
  const navigate = useNavigate();

  /**
   * Add a new entity to the navigation history
   * Prevents duplicates by checking if the same entity is already at the top
   */
  const pushEntity = useCallback((node: NavigationNode) => {
    setHistory(prev => {
      // Check if the same entity is already at the top (prevent duplicate)
      const current = prev[prev.length - 1];
      if (current?.entityCode === node.entityCode && current?.entityId === node.entityId) {
        // Just update the timestamp and name
        return [
          ...prev.slice(0, -1),
          { ...node, timestamp: Date.now() }
        ];
      }
      // Add new entity to history
      return [...prev, { ...node, timestamp: Date.now() }];
    });
  }, []);

  /**
   * Remove the most recent entity from history
   */
  const popEntity = useCallback(() => {
    let poppedNode: NavigationNode | undefined;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      poppedNode = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return poppedNode;
  }, []);

  /**
   * Clear all navigation history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /**
   * Get current entity (top of stack)
   */
  const getCurrentEntity = useCallback(() => {
    return history[history.length - 1];
  }, [history]);

  /**
   * Get parent entity (second from top)
   */
  const getParentEntity = useCallback(() => {
    if (history.length < 2) return undefined;
    return history[history.length - 2];
  }, [history]);

  /**
   * Update the name of the current entity
   */
  const updateCurrentEntityName = useCallback((name: string) => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        entityName: name
      };
      return updated;
    });
  }, []);

  /**
   * Update which tab should be active when returning to parent
   * DEPRECATED: Use updateCurrentEntityActiveTab instead
   */
  const updateParentActiveTab = useCallback((childType: string) => {
    setHistory(prev => {
      if (prev.length < 2) return prev;
      const updated = [...prev];
      updated[updated.length - 2] = {
        ...updated[updated.length - 2],
        activeChildTab: childType
      };
      return updated;
    });
  }, []);

  /**
   * Update which tab should be active on the current entity
   * This is used when navigating to a child entity from a tab
   */
  const updateCurrentEntityActiveTab = useCallback((childType: string) => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        activeChildTab: childType
      };
      return updated;
    });
  }, []);

  /**
   * Navigate back to the previous entity in the history
   */
  const goBack = useCallback(() => {
    if (history.length === 0) {
      // No history, go to default page
      navigate('/project');
      return;
    }

    if (history.length === 1) {
      // At top level, go to the entity list page
      const current = history[0];
      popEntity();
      navigate(`/${current.entityCode}`);
      return;
    }

    // Pop current entity and navigate to parent
    const current = popEntity();
    const parent = history[history.length - 2]; // Get parent before pop

    if (parent) {
      // Navigate to parent detail page with optional child tab
      if (parent.activeChildTab) {
        navigate(`/${parent.entityCode}/${parent.entityId}/${parent.activeChildTab}`);
      } else {
        navigate(`/${parent.entityCode}/${parent.entityId}`);
      }
    }
  }, [history, navigate, popEntity]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({
      history,
      pushEntity,
      popEntity,
      clearHistory,
      goBack,
      getCurrentEntity,
      getParentEntity,
      updateCurrentEntityName,
      updateParentActiveTab,
      updateCurrentEntityActiveTab
    }),
    [
      history,
      pushEntity,
      popEntity,
      clearHistory,
      goBack,
      getCurrentEntity,
      getParentEntity,
      updateCurrentEntityName,
      updateParentActiveTab,
      updateCurrentEntityActiveTab
    ]
  );

  return (
    <NavigationHistoryContext.Provider value={contextValue}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

/**
 * Hook to use navigation history
 */
export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within NavigationHistoryProvider');
  }
  return context;
}
