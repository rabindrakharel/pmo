import React, { useState, ReactNode } from 'react';
import {
  Eye,
  Code,
  Settings,
  Save,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * Universal Designer Framework
 *
 * A unified design system for all content creation:
 * - Forms
 * - Wiki pages
 * - Emails
 * - Reports
 * - Any future entity types
 *
 * Provides consistent:
 * - 3-panel layout (Toolbar | Canvas | Properties)
 * - View modes (Design | Preview | Code)
 * - Save/Cancel actions
 * - Collapsible sidebars
 */

export interface DesignerViewMode {
  id: 'design' | 'preview' | 'code' | 'custom';
  label: string;
  icon?: ReactNode;
}

export interface DesignerAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

export interface UniversalDesignerProps {
  // Header
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onTitleChange?: (title: string) => void;
  titleEditable?: boolean;

  // View Modes
  viewModes?: DesignerViewMode[];
  currentViewMode?: string;
  onViewModeChange?: (mode: string) => void;

  // Actions
  actions?: DesignerAction[];
  primaryAction?: DesignerAction;
  trailingActions?: DesignerAction[];
  onCancel?: () => void;

  // Layout Panels
  toolbar?: ReactNode;
  toolbarTitle?: string;
  toolbarCollapsible?: boolean;
  toolbarDefaultCollapsed?: boolean;

  canvas: ReactNode;
  canvasBackground?: string;
  canvasMaxWidth?: string;

  properties?: ReactNode;
  propertiesTitle?: string;
  propertiesCollapsible?: boolean;
  propertiesDefaultCollapsed?: boolean;

  // Additional
  footer?: ReactNode;
  className?: string;
}

export function UniversalDesigner({
  title,
  subtitle,
  icon,
  onTitleChange,
  titleEditable = false,
  viewModes = [
    { id: 'design', label: 'Design' },
    { id: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" /> },
    { id: 'code', label: 'Code', icon: <Code className="h-4 w-4" /> },
  ],
  currentViewMode = 'design',
  onViewModeChange,
  actions = [],
  primaryAction,
  trailingActions = [],
  onCancel,
  toolbar,
  toolbarTitle = 'Components',
  toolbarCollapsible = true,
  toolbarDefaultCollapsed = false,
  canvas,
  canvasBackground = 'bg-dark-100',
  canvasMaxWidth = 'max-w-5xl',
  properties,
  propertiesTitle = 'Properties',
  propertiesCollapsible = true,
  propertiesDefaultCollapsed = false,
  footer,
  className = '',
}: UniversalDesignerProps) {
  const [toolbarCollapsed, setToolbarCollapsed] = useState(toolbarDefaultCollapsed);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(propertiesDefaultCollapsed);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (onTitleChange && titleValue !== title) {
      onTitleChange(titleValue);
    }
  };

  return (
    <div className={`flex flex-col h-screen bg-dark-50 ${className}`}>
      {/* Minimal Top Header Bar */}
      <div className="bg-white border-b border-dark-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        {/* Left: Title & View Modes */}
        <div className="flex items-center gap-4 flex-1">
          {/* Icon & Title - Compact */}
          <div className="flex items-center gap-2">
            {icon && <div className="text-dark-500">{icon}</div>}
            <div>
              {titleEditable && isEditingTitle ? (
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleBlur();
                    if (e.key === 'Escape') {
                      setTitleValue(title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-sm font-medium text-dark-800 border-b border-dark-300 outline-none bg-transparent"
                />
              ) : (
                <h1
                  className={`text-sm font-medium text-dark-800 ${
                    titleEditable ? 'cursor-pointer hover:text-dark-600' : ''
                  }`}
                  onClick={() => titleEditable && setIsEditingTitle(true)}
                >
                  {title}
                </h1>
              )}
              {subtitle && (
                typeof subtitle === 'string' ? (
                  <p className="text-xs text-dark-500">{subtitle}</p>
                ) : (
                  <div className="text-xs text-dark-500">{subtitle}</div>
                )
              )}
            </div>
          </div>

          {/* View Mode Switcher - Compact Segmented */}
          {viewModes.length > 1 && (
            <div className="flex items-center gap-0.5 p-0.5 bg-dark-100 rounded-lg">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onViewModeChange?.(mode.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    currentViewMode === mode.id
                      ? 'bg-white text-dark-800 shadow-sm'
                      : 'text-dark-500 hover:text-dark-700'
                  }`}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions - Compact */}
        <div className="flex items-center gap-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                action.variant === 'primary'
                  ? 'bg-dark-800 text-white hover:bg-dark-700 disabled:opacity-50'
                  : action.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50 disabled:opacity-50'
                  : 'text-dark-600 hover:bg-dark-100 disabled:opacity-50'
              }`}
            >
              {action.loading ? (
                <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                action.icon
              )}
              <span>{action.label}</span>
            </button>
          ))}

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className="px-3 py-1.5 bg-dark-800 text-white rounded text-xs font-medium hover:bg-dark-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {primaryAction.loading ? (
                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                primaryAction.icon
              )}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {trailingActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                action.variant === 'primary'
                  ? 'bg-dark-800 text-white hover:bg-dark-700 disabled:opacity-50'
                  : action.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50 disabled:opacity-50'
                  : 'text-dark-500 hover:bg-dark-100 disabled:opacity-50'
              }`}
            >
              {action.loading ? (
                <div className="h-3 w-3 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                action.icon
              )}
              <span>{action.label}</span>
            </button>
          ))}

          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-dark-400 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Toolbar */}
        {toolbar && (
          <div
            className={`bg-white border-r border-dark-200 overflow-y-auto transition-all duration-200 ${
              toolbarCollapsed ? 'w-10' : 'w-64'
            }`}
          >
            {/* Toolbar Header - Minimal */}
            <div className="sticky top-0 bg-white border-b border-dark-100 px-3 py-2 flex items-center justify-between z-10">
              {!toolbarCollapsed && (
                <span className="text-xs font-medium text-dark-500">{toolbarTitle}</span>
              )}
              {toolbarCollapsible && (
                <button
                  onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
                  className="p-1 hover:bg-dark-100 rounded text-dark-400 transition-colors"
                  title={toolbarCollapsed ? 'Expand' : 'Collapse'}
                >
                  {toolbarCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Toolbar Content */}
            {!toolbarCollapsed && <div className="p-3">{toolbar}</div>}
          </div>
        )}

        {/* Center Panel - Canvas */}
        <div className={`flex-1 overflow-y-auto ${canvasBackground} p-4`}>
          <div className={`${canvasMaxWidth} mx-auto`}>{canvas}</div>
        </div>

        {/* Right Panel - Properties */}
        {properties && (
          <div
            className={`bg-white border-l border-dark-200 overflow-y-auto transition-all duration-200 ${
              propertiesCollapsed ? 'w-10' : 'w-64'
            }`}
          >
            {/* Properties Header - Minimal */}
            <div className="sticky top-0 bg-white border-b border-dark-100 px-3 py-2 flex items-center justify-between z-10">
              {propertiesCollapsible && (
                <button
                  onClick={() => setPropertiesCollapsed(!propertiesCollapsed)}
                  className="p-1 hover:bg-dark-100 rounded text-dark-400 transition-colors"
                  title={propertiesCollapsed ? 'Expand' : 'Collapse'}
                >
                  {propertiesCollapsed ? (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {!propertiesCollapsed && (
                <span className="text-xs font-medium text-dark-500">{propertiesTitle}</span>
              )}
            </div>

            {/* Properties Content */}
            {!propertiesCollapsed && <div className="p-3">{properties}</div>}
          </div>
        )}
      </div>

      {/* Footer - Minimal */}
      {footer && (
        <div className="border-t border-dark-200 bg-white px-4 py-2 flex-shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}
