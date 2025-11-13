import React from 'react';
import { Plus, Share, Trash2 } from 'lucide-react';

interface ActionButtonsBarProps {
  // Create button props
  createLabel?: string;
  onCreateClick?: () => void;
  createHref?: string;

  // Selection and bulk actions
  selectedCount?: number;
  onBulkShare?: () => void;
  onBulkDelete?: () => void;

  // Entity type for proper labeling
  entityType?: string;

  // Additional custom actions
  additionalActions?: React.ReactNode;

  className?: string;
}

export function ActionButtonsBar({
  createLabel,
  onCreateClick,
  createHref,
  selectedCount = 0,
  onBulkShare,
  onBulkDelete,
  entityType = 'item',
  additionalActions,
  className = '',
}: ActionButtonsBarProps) {
  const handleCreateClick = () => {
    if (createHref) {
      window.location.href = createHref;
    } else if (onCreateClick) {
      onCreateClick();
    }
  };

  const hasSelection = selectedCount > 0;

  return (
    <div className={`flex items-center justify-between bg-dark-100 px-4 py-3 border-b border-dark-300 ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Selection info */}
        {hasSelection && (
          <span className="text-sm text-dark-700">
            {selectedCount} {entityType}{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}

        {/* Bulk actions - only show when items are selected */}
        {hasSelection && (
          <div className="flex items-center space-x-2">
            {onBulkShare && (
              <button
                onClick={onBulkShare}
                className="inline-flex items-center gap-2 px-3 py-2 border border-dark-300 text-sm font-medium rounded-md text-dark-700 bg-white hover:border-dark-400 focus:outline-none focus:ring-2 focus:ring-slate-500/30 transition-all"
              >
                <Share className="h-3.5 w-3.5" />
                Share Selected
              </button>
            )}

            {onBulkDelete && (
              <button
                onClick={onBulkDelete}
                className="inline-flex items-center gap-2 px-3 py-2 border border-red-600 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 hover:border-red-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {/* Additional actions */}
        {additionalActions}

        {/* Create button */}
        {(createLabel || onCreateClick || createHref) && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-600 text-sm font-medium rounded-md text-white bg-slate-600 hover:bg-slate-700 hover:border-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/50 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            {createLabel || `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
          </button>
        )}
      </div>
    </div>
  );
}