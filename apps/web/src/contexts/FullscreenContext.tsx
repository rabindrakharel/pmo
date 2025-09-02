import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FullscreenContextType {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
  enterFullscreen: () => void;
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

interface FullscreenProviderProps {
  children: ReactNode;
}

export function FullscreenProvider({ children }: FullscreenProviderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = () => {
    setIsFullscreen(true);
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 for fullscreen toggle
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      // Escape to exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        exitFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const value: FullscreenContextType = {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    enterFullscreen,
  };

  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  const context = useContext(FullscreenContext);
  if (context === undefined) {
    throw new Error('useFullscreen must be used within a FullscreenProvider');
  }
  return context;
}