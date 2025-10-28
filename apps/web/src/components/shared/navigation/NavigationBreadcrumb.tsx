import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useNavigationHistory } from '../../../contexts/NavigationHistoryContext';
import { getEntityIcon } from '../../../lib/entityIcons';
import { getEntityConfig } from '../../../lib/entityConfig';

/**
 * NavigationBreadcrumb Component
 *
 * Displays a horizontal navigation breadcrumb in the header showing the current
 * entity hierarchy path (e.g., [Business] → [Project] → [Task] → [Wiki])
 *
 * Features:
 * - Horizontal layout with chevron separators
 * - Click to navigate to any entity in the path
 * - Shows entity icons and types only (names not displayed)
 * - Compact design for header
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
    <div className="flex items-center gap-1 overflow-x-auto">
      {history.map((node, index) => {
        const isLast = index === history.length - 1;
        const isCurrent = isLast;
        const config = getEntityConfig(node.entityType);
        const EntityIcon = getEntityIcon(node.entityType);

        return (
          <React.Fragment key={`${node.entityType}-${node.entityId}-${index}`}>
            {/* Separator */}
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            )}

            {/* Node */}
            <button
              onClick={() => handleNodeClick(index)}
              disabled={isCurrent}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded-md transition-all group flex-shrink-0
                ${isCurrent
                  ? 'bg-blue-50 cursor-default'
                  : 'hover:bg-gray-100 cursor-pointer'
                }
              `}
            >
              {/* Icon */}
              <div className={`
                flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border transition-all
                ${isCurrent
                  ? 'bg-blue-500 border-blue-600'
                  : 'bg-white border-gray-300 group-hover:border-blue-400'
                }
              `}>
                <EntityIcon className={`h-3 w-3 ${isCurrent ? 'text-white' : 'text-gray-600 group-hover:text-blue-600'}`} />
              </div>

              {/* Entity Type Only */}
              <span className={`text-xs font-medium whitespace-nowrap ${
                isCurrent ? 'text-blue-600' : 'text-gray-700 group-hover:text-gray-900'
              }`}>
                [{config?.displayName || node.entityType}]
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
