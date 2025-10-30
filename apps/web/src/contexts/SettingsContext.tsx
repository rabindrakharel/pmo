import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SettingsContextType {
  isSettingsMode: boolean;
  enterSettingsMode: () => void;
  exitSettingsMode: () => void;
  previousRoute: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isSettingsMode, setIsSettingsMode] = useState(false);
  const [previousRoute, setPreviousRoute] = useState('/');
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-detect settings mode based on route
  useEffect(() => {
    const isSettingsRoute =
      location.pathname === '/settings' ||
      location.pathname.startsWith('/setting/') ||
      location.pathname === '/labels' ||
      location.pathname === '/linkage' ||
      location.pathname === '/workflow-automation' ||
      location.pathname === '/integrations';

    if (isSettingsRoute && !isSettingsMode) {
      // Store previous route before entering settings
      if (!isSettingsRoute) {
        setPreviousRoute(location.pathname);
      }
      setIsSettingsMode(true);
    } else if (!isSettingsRoute && isSettingsMode) {
      setIsSettingsMode(false);
    }
  }, [location.pathname]);

  const enterSettingsMode = () => {
    setPreviousRoute(location.pathname);
    setIsSettingsMode(true);
    navigate('/settings'); // Navigate to centralized settings page
  };

  const exitSettingsMode = () => {
    setIsSettingsMode(false);
    navigate(previousRoute || '/'); // Return to previous route
  };

  return (
    <SettingsContext.Provider
      value={{
        isSettingsMode,
        enterSettingsMode,
        exitSettingsMode,
        previousRoute,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
