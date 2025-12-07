import React from 'react';
import { List, Kanban, Grid, Calendar, GitBranch } from 'lucide-react';
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
  calendar: Calendar,
  graph: GitBranch
};

const viewLabels: Record<ViewMode, string> = {
  table: 'Table',
  kanban: 'Kanban',
  grid: 'Grid',
  calendar: 'Calendar',
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
    <div className={`inline-flex bg-white border border-dark-200 rounded-md shadow-sm ${className}`}>
      {supportedViews.map((view) => {
        const Icon = viewIcons[view];
        const label = viewLabels[view];
        const isActive = currentView === view;

        return (
          <button
            key={view}
            onClick={() => onChange(view)}
            className={`
              flex items-center space-x-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none
              ${isActive
                ? 'bg-slate-100 text-slate-700 border-r border-dark-200 last:border-r-0'
                : 'text-dark-600 hover:bg-dark-50 hover:text-dark-800 border-r border-dark-200 last:border-r-0'
              }
              first:rounded-l-md last:rounded-r-md
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
