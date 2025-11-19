import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface SidebarContextType {
  isVisible: boolean;
  isCollapsed: boolean;
  showSidebar: () => void;
  hideSidebar: () => void;
  collapseSidebar: () => void;
  uncollapseSidebar: () => void;
  toggleCollapse: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

  const showSidebar = () => {
    setIsVisible(true);
  };

  const hideSidebar = () => {
    setIsVisible(false);
  };

  const collapseSidebar = () => {
    setIsCollapsed(true);
    setIsVisible(true); // Ensure sidebar is visible when collapsed
    setManualOverride(true); // User manually collapsed
  };

  const uncollapseSidebar = () => {
    setIsCollapsed(false);
    setIsVisible(true);
    setManualOverride(true); // User manually uncollapsed
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
    setIsVisible(true);
    setManualOverride(true); // User manually toggled
  };

  // Auto-collapse/uncollapse based on route pattern
  useEffect(() => {
    // Don't auto-adjust if user manually overrode
    if (manualOverride) {
      setManualOverride(false); // Reset override flag
      return;
    }

    const path = location.pathname;

    // Detect if this is a detail page (has an ID parameter)
    // Pattern: /{entityCode}/{id} where id is typically a UUID or slug
    // List page pattern: /{entityCode} (no trailing segments)
    const pathSegments = path.split('/').filter(segment => segment.length > 0);

    // If path has 2 or more segments and second segment looks like an ID
    // Examples:
    // - /project → list page (1 segment) → uncollapse
    // - /project/abc-123-uuid → detail page (2 segments) → collapse
    // - /project/abc-123/task → child list page (3 segments) → collapse
    const isDetailOrChildPage = pathSegments.length >= 2;

    if (isDetailOrChildPage) {
      // Detail or child page → collapse sidebar
      setIsCollapsed(true);
    } else {
      // List page → uncollapse sidebar
      setIsCollapsed(false);
    }
  }, [location.pathname, manualOverride]);

  const value: SidebarContextType = {
    isVisible,
    isCollapsed,
    showSidebar,
    hideSidebar,
    collapseSidebar,
    uncollapseSidebar,
    toggleCollapse};

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
