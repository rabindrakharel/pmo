/**
 * ============================================================================
 * TABLE LOADING FOOTER - Progressive Loading States
 * ============================================================================
 * Version: 1.0.0 (v10.0.0)
 *
 * PURPOSE:
 * Displays contextual loading states for infinite scroll tables.
 * Provides clear feedback for loading, error, and end-of-list states.
 *
 * STATES:
 * - Loading more: Spinner with "Loading more..."
 * - Error: Error message with retry button
 * - End of list: "You've reached the end" or total count
 * - Idle: "Load more" button (fallback)
 *
 * USAGE:
 * ```tsx
 * <TableLoadingFooter
 *   status={{
 *     isLoadingMore: true,
 *     hasMore: true,
 *     isError: false
 *   }}
 *   total={8231}
 *   loaded={100}
 *   onRetry={() => refetch()}
 *   onLoadMore={() => fetchNextPage()}
 * />
 * ```
 *
 * ============================================================================
 */

import React from 'react';
import { AlertCircle, CheckCircle, Loader2, ChevronDown } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TableLoadingFooterStatus {
  /** Currently loading more data */
  isLoadingMore: boolean;
  /** More data available */
  hasMore: boolean;
  /** Error occurred */
  isError: boolean;
  /** Error message (optional) */
  errorMessage?: string;
}

export interface TableLoadingFooterProps {
  /** Loading status */
  status: TableLoadingFooterStatus;
  /** Total records (optional - may be unknown) */
  total?: number;
  /** Currently loaded records */
  loaded: number;
  /** Retry failed load */
  onRetry: () => void;
  /** Manual load more trigger */
  onLoadMore: () => void;
  /** Custom class name */
  className?: string;
  /** Show compact version */
  compact?: boolean;
}

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

export function TableLoadingFooter({
  status,
  total,
  loaded,
  onRetry,
  onLoadMore,
  className = '',
  compact = false,
}: TableLoadingFooterProps) {
  const baseClasses = compact
    ? 'flex items-center justify-center py-2 text-sm'
    : 'flex items-center justify-center py-4 text-sm';

  // Error state - show retry
  if (status.isError) {
    return (
      <div className={`${baseClasses} text-red-500 dark:text-red-400 ${className}`}>
        <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
        <span>{status.errorMessage || 'Failed to load more'}</span>
        <button
          onClick={onRetry}
          className="ml-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading more state
  if (status.isLoadingMore) {
    return (
      <div className={`${baseClasses} text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
        <span>Loading more...</span>
        {total !== undefined && (
          <span className="ml-1 text-xs opacity-70">
            ({loaded.toLocaleString()} of {total.toLocaleString()})
          </span>
        )}
      </div>
    );
  }

  // End of list - no more data
  if (!status.hasMore) {
    return (
      <div className={`${baseClasses} text-muted-foreground ${className}`}>
        <CheckCircle className="h-4 w-4 mr-2 text-green-500 dark:text-green-400 flex-shrink-0" />
        <span>
          {total !== undefined
            ? `All ${total.toLocaleString()} items loaded`
            : "You've reached the end"}
        </span>
      </div>
    );
  }

  // Idle state with load more button (fallback for manual loading)
  return (
    <div className={`${baseClasses} ${className}`}>
      <button
        onClick={onLoadMore}
        className="flex items-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium"
      >
        <ChevronDown className="h-4 w-4 mr-1" />
        Load more
        <span className="ml-1 font-normal text-muted-foreground">
          ({loaded.toLocaleString()} loaded
          {total !== undefined && ` of ${total.toLocaleString()}`})
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// SENTINEL COMPONENT
// ============================================================================

/**
 * Invisible sentinel element for intersection observer
 * Place at the bottom of the table to trigger auto-loading
 */
export interface LoadMoreSentinelProps {
  /** Ref for intersection observer */
  sentinelRef: React.RefObject<HTMLDivElement>;
  /** Additional classes */
  className?: string;
}

export function LoadMoreSentinel({ sentinelRef, className = '' }: LoadMoreSentinelProps) {
  return (
    <div
      ref={sentinelRef}
      className={`h-1 w-full ${className}`}
      aria-hidden="true"
      data-testid="load-more-sentinel"
    />
  );
}

// ============================================================================
// SCROLL PROGRESS INDICATOR
// ============================================================================

export interface ScrollProgressProps {
  /** Number of loaded items */
  loaded: number;
  /** Total items (optional) */
  total?: number;
  /** Whether more items exist */
  hasMore: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Shows scroll progress as a bar or text
 */
export function ScrollProgressIndicator({
  loaded,
  total,
  hasMore,
  compact = false,
}: ScrollProgressProps) {
  if (total === undefined) {
    return (
      <span className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
        {loaded.toLocaleString()} items{hasMore ? '+' : ''}
      </span>
    );
  }

  const percentage = Math.min(100, (loaded / total) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-muted-foreground whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
        {loaded.toLocaleString()} / {total.toLocaleString()}
      </span>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TableLoadingFooter;
