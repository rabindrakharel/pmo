import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useNavigationHistory } from '../../../contexts/NavigationHistoryContext';
import { getEntityIcon } from '../../../lib/entityIcons';
import { getEntityConfig } from '../../../lib/entityConfig';

/**
 * NavigationBreadcrumb Component
 *
 * Displays a vertical navigation tree on the left side showing the current
 * entity hierarchy path (e.g., Business → Project → Task → Wiki)
 *
 * Features:
 * - Vertical nodes with connecting lines
 * - Click to navigate to any entity in the path
 * - Shows entity icons and names
 * - Compact design that doesn't take much space
 */

export function NavigationBreadcrumb() {
  const { history, popEntity } = useNavigationHistory();
  const navigate = useNavigate();

  // Don't show if history is empty
  if (history.length === 0) {
    return null;
  }

  const handleNodeClick = (index: number) => {
    const node = history[index];

    // Remove all nodes after this one from history
    const nodesToRemove = history.length - 1 - index;
    for (let i = 0; i < nodesToRemove; i++) {
      popEntity();
    }

    // Navigate to the clicked entity
    navigate(`/${node.entityType}/${node.entityId}`);
  };

  return (
    <div className="fixed left-0 top-16 bottom-0 w-48 bg-gradient-to-b from-gray-50 to-white border-r border-gray-200 z-30 shadow-sm">
      <div className="p-4 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
          <Home className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Navigation Path</span>
        </div>

        {/* Navigation Nodes */}
        <div className="space-y-0">
          {history.map((node, index) => {
            const isLast = index === history.length - 1;
            const isCurrent = isLast;
            const config = getEntityConfig(node.entityType);
            const EntityIcon = getEntityIcon(node.entityType);

            return (
              <div key={`${node.entityType}-${node.entityId}-${index}`} className="relative">
                {/* Connecting line to next node */}
                {!isLast && (
                  <div className="absolute left-[11px] top-8 w-[2px] h-[calc(100%+4px)] bg-gradient-to-b from-blue-300 to-blue-200" />
                )}

                {/* Node */}
                <button
                  onClick={() => handleNodeClick(index)}
                  disabled={isCurrent}
                  className={`
                    relative w-full flex items-start gap-2.5 py-2 px-2 rounded-lg transition-all text-left group
                    ${isCurrent
                      ? 'bg-blue-50 border border-blue-200 shadow-sm cursor-default'
                      : 'hover:bg-gray-100 hover:shadow-sm cursor-pointer border border-transparent'
                    }
                  `}
                >
                  {/* Icon Circle */}
                  <div className={`
                    relative flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all
                    ${isCurrent
                      ? 'bg-blue-500 border-blue-600 shadow-md'
                      : 'bg-white border-gray-300 group-hover:border-blue-400'
                    }
                  `}>
                    <EntityIcon className={`h-3.5 w-3.5 ${isCurrent ? 'text-white' : 'text-gray-600 group-hover:text-blue-600'}`} />
                  </div>

                  {/* Entity Info */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    {/* Entity Type Label */}
                    <div className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${
                      isCurrent ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                    }`}>
                      {config?.displayName || node.entityType}
                    </div>

                    {/* Entity Name */}
                    <div className={`text-xs font-normal truncate ${
                      isCurrent ? 'text-gray-900 font-medium' : 'text-gray-700 group-hover:text-gray-900'
                    }`}>
                      {node.entityName || 'Untitled'}
                    </div>
                  </div>

                  {/* Arrow indicator for current */}
                  {isCurrent && (
                    <ChevronRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 animate-pulse" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Depth indicator */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>Depth</span>
            <span className="font-medium text-gray-700">{history.length} level{history.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
