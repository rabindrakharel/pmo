import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useFullscreen } from '../../contexts/FullscreenContext';

interface FullscreenToggleProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon';
}

export function FullscreenToggle({ 
  className = '', 
  showText = true, 
  size = 'md',
  variant = 'button'
}: FullscreenToggleProps) {
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const paddingClasses = {
    sm: 'px-2 py-1',
    md: 'px-3 py-2',
    lg: 'px-4 py-2'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleFullscreen}
        className={`p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors ${className}`}
        title={isFullscreen ? "Exit Fullscreen (F11 or Esc)" : "Enter Fullscreen (F11)"}
      >
        {isFullscreen ? (
          <Minimize className={sizeClasses[size]} />
        ) : (
          <Maximize className={sizeClasses[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleFullscreen}
      className={`inline-flex items-center ${paddingClasses[size]} bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors ${textSizes[size]} ${className}`}
      title={isFullscreen ? "Exit Fullscreen (F11 or Esc)" : "Enter Fullscreen (F11)"}
    >
      {isFullscreen ? (
        <>
          <Minimize className={`${sizeClasses[size]} ${showText ? 'mr-2' : ''}`} />
          {showText && 'Exit Fullscreen'}
        </>
      ) : (
        <>
          <Maximize className={`${sizeClasses[size]} ${showText ? 'mr-2' : ''}`} />
          {showText && 'Fullscreen'}
        </>
      )}
    </button>
  );
}