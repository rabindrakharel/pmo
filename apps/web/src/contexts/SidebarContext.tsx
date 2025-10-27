import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  const [isVisible, setIsVisible] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const showSidebar = () => {
    setIsVisible(true);
  };

  const hideSidebar = () => {
    setIsVisible(false);
  };

  const collapseSidebar = () => {
    setIsCollapsed(true);
    setIsVisible(true); // Ensure sidebar is visible when collapsed
  };

  const uncollapseSidebar = () => {
    setIsCollapsed(false);
    setIsVisible(true);
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
    setIsVisible(true);
  };

  const value: SidebarContextType = {
    isVisible,
    isCollapsed,
    showSidebar,
    hideSidebar,
    collapseSidebar,
    uncollapseSidebar,
    toggleCollapse,
  };

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
