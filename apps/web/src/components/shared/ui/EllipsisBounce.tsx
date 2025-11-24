/**
 * EllipsisBounce Spinner Component
 *
 * A minimalistic loading spinner with bouncing dots.
 * Uses slate-600 to match the primary button color from the design system.
 *
 * @example
 * // Basic usage
 * <EllipsisBounce />
 *
 * // With custom size
 * <EllipsisBounce size="lg" />
 *
 * // With loading text
 * <EllipsisBounce text="Loading data" />
 *
 * // Full page loading
 * <EllipsisBounce fullPage text="Loading..." />
 */

import React from 'react';

export interface EllipsisBounceProps {
  /** Size variant: sm (small), md (medium), lg (large) */
  size?: 'sm' | 'md' | 'lg';
  /** Optional loading text to display below the dots */
  text?: string;
  /** If true, centers the spinner in the full viewport */
  fullPage?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeConfig = {
  sm: {
    dot: 'w-1.5 h-1.5',
    gap: 'gap-1',
    text: 'text-xs',
  },
  md: {
    dot: 'w-2 h-2',
    gap: 'gap-1.5',
    text: 'text-sm',
  },
  lg: {
    dot: 'w-2.5 h-2.5',
    gap: 'gap-2',
    text: 'text-base',
  },
};

export function EllipsisBounce({
  size = 'md',
  text,
  fullPage = false,
  className = '',
}: EllipsisBounceProps) {
  const config = sizeConfig[size];

  const dots = (
    <div className={`flex items-center ${config.gap}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${config.dot} bg-slate-600 rounded-full animate-bounce`}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {dots}
      {text && (
        <span className={`mt-2 ${config.text} text-dark-600 font-medium`}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-dark-50/80 backdrop-blur-sm z-50">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * Loading wrapper component for conditional rendering
 *
 * @example
 * <LoadingState isLoading={isLoading} text="Loading projects">
 *   <ProjectList data={data} />
 * </LoadingState>
 */
export interface LoadingStateProps {
  /** Whether content is loading */
  isLoading: boolean;
  /** Content to render when not loading */
  children: React.ReactNode;
  /** Optional loading text */
  text?: string;
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg';
  /** Minimum height for the loading container */
  minHeight?: string;
  /** Additional CSS classes for the loading container */
  className?: string;
}

export function LoadingState({
  isLoading,
  children,
  text,
  size = 'md',
  minHeight = 'min-h-[200px]',
  className = '',
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${minHeight} ${className}`}>
        <EllipsisBounce size={size} text={text} />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Inline loading spinner for buttons and small spaces
 *
 * @example
 * <button disabled={isSubmitting}>
 *   {isSubmitting ? <InlineSpinner /> : 'Save'}
 * </button>
 */
export function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 bg-current rounded-full animate-bounce"
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </span>
  );
}

/**
 * Table loading skeleton
 * Shows placeholder rows while data is loading
 */
export interface TableLoadingProps {
  /** Number of skeleton rows to show */
  rows?: number;
  /** Number of columns */
  columns?: number;
}

export function TableLoading({ rows = 5, columns = 4 }: TableLoadingProps) {
  return (
    <div className="bg-dark-100 rounded-lg border border-dark-300 overflow-hidden">
      {/* Header skeleton */}
      <div className="bg-dark-50 px-3 py-2 border-b border-dark-300">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-dark-200 rounded animate-pulse flex-1" />
          ))}
        </div>
      </div>
      {/* Row skeletons */}
      <div className="divide-y divide-dark-300">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-3 py-2 flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 bg-dark-200 rounded animate-pulse flex-1"
                style={{ animationDelay: `${(rowIdx * columns + colIdx) * 0.05}s` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EllipsisBounce;
