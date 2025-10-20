import React from 'react';
import { List, Kanban, Grid, GitBranch } from 'lucide-react';
import { ViewMode } from '../../../lib/entityConfig';

interface ViewSwitcherProps {
  currentView: ViewMode;
  supportedViews: ViewMode[];
  onChange: (view: ViewMode) => void;
  className?: string;
}

const viewIcons: Record<ViewMode, React.ComponentType<any>> = {
  table: List,
  kanban: Kanban,
  grid: Grid,
  graph: GitBranch
};

const viewLabels: Record<ViewMode, string> = {
  table: 'Table',
  kanban: 'Kanban',
  grid: 'Grid',
  graph: 'Graph'
};

export function ViewSwitcher({
  currentView,
  supportedViews,
  onChange,
  className = ''
}: ViewSwitcherProps) {
  if (supportedViews.length <= 1) {
    // Don't show switcher if only one view is supported
    return null;
  }

  return (
    <div className={`inline-flex bg-white border border-gray-300 rounded-lg ${className}`}>
      {supportedViews.map((view) => {
        const Icon = viewIcons[view];
        const label = viewLabels[view];
        const isActive = currentView === view;

        return (
          <button
            key={view}
            onClick={() => onChange(view)}
            className={`
              flex items-center space-x-2 px-4 py-2 text-sm font-normal transition-colors
              ${isActive
                ? 'bg-blue-50 text-blue-700 border-r border-gray-300 last:border-r-0'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-r border-gray-300 last:border-r-0'
              }
              first:rounded-l-lg last:rounded-r-lg
            `}
            title={`Switch to ${label} view`}
          >
            <Icon className="h-4 w-4 stroke-[1.5]" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
