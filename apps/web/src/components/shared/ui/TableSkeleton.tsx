/**
 * ============================================================================
 * TABLE SKELETON - Loading Placeholder
 * ============================================================================
 *
 * Skeleton loader for tables while schema/data is loading.
 * Improves perceived performance.
 */

import React from 'react';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

/**
 * Skeleton loader for table
 */
export function TableSkeleton({
  rows = 5,
  columns = 6,
  showHeader = true
}: TableSkeletonProps) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      {showHeader && (
        <div className="flex gap-2 mb-4 bg-dark-100 rounded p-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={`header-${i}`}
              className="h-4 bg-dark-300 rounded flex-1"
              style={{ width: i === 0 ? '80px' : undefined }}
            />
          ))}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-2 bg-dark-50 rounded p-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-8 bg-dark-200 rounded flex-1"
                style={{
                  width: colIndex === 0 ? '80px' : undefined,
                  opacity: 0.7 + (Math.random() * 0.3) // Varied opacity for visual interest
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact skeleton for small tables
 */
export function CompactTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-dark-100 rounded" />
      ))}
    </div>
  );
}
