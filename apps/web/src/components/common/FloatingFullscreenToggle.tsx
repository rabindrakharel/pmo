import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useFullscreen } from '../../contexts/FullscreenContext';

interface FloatingFullscreenToggleProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function FloatingFullscreenToggle({
  position = 'bottom-right'
}: FloatingFullscreenToggleProps) {
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  return (
    <button
      onClick={toggleFullscreen}
      className={`fixed ${positionClasses[position]} z-50 p-2 bg-white border border-gray-200 rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 group`}
      title={isFullscreen ? "Exit Fullscreen (F11 or Esc)" : "Enter Fullscreen (F11)"}
    >
      {isFullscreen ? (
        <Minimize className="h-4 w-4 text-gray-600 group-hover:text-blue-600 transition-colors" />
      ) : (
        <Maximize className="h-4 w-4 text-gray-600 group-hover:text-blue-600 transition-colors" />
      )}
    </button>
  );
}