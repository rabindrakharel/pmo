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
    <div className={`flex items-center justify-between bg-white px-4 py-3 border-b border-gray-200 ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Selection info */}
        {hasSelection && (
          <span className="text-sm text-gray-600">
            {selectedCount} {entityType}{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}

        {/* Bulk actions - only show when items are selected */}
        {hasSelection && (
          <div className="flex items-center space-x-2">
            {onBulkShare && (
              <button
                onClick={onBulkShare}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <Share className="h-4 w-4 mr-2 stroke-[1.5]" />
                Share Selected
              </button>
            )}

            {onBulkDelete && (
              <button
                onClick={onBulkDelete}
                className="inline-flex items-center px-3 py-1.5 border border-red-600 text-sm font-normal rounded text-white bg-red-600 hover:bg-red-700 hover:border-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2 stroke-[1.5]" />
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
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2 stroke-[1.5]" />
            {createLabel || `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
          </button>
        )}
      </div>
    </div>
  );
}