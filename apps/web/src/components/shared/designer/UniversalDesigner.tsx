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
  canvasBackground = 'bg-gray-50',
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
    <div className={`flex flex-col h-screen bg-white ${className}`}>
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        {/* Left: Title & View Modes */}
        <div className="flex items-center space-x-4 flex-1">
          {/* Icon & Title */}
          <div className="flex items-center space-x-3">
            {icon && <div className="text-gray-600">{icon}</div>}
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
                  className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                />
              ) : (
                <h1
                  className={`text-lg font-semibold text-gray-900 ${
                    titleEditable ? 'cursor-pointer hover:text-blue-600' : ''
                  }`}
                  onClick={() => titleEditable && setIsEditingTitle(true)}
                >
                  {title}
                </h1>
              )}
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>

          {/* View Mode Switcher */}
          {viewModes.length > 1 && (
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onViewModeChange?.(mode.id)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${
                    currentViewMode === mode.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                action.variant === 'primary'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  : action.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                  : 'text-gray-700 hover:bg-gray-100 disabled:opacity-50'
              }`}
            >
              {action.loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {primaryAction.loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
                action.variant === 'primary'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  : action.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                  : 'text-gray-700 hover:bg-gray-100 disabled:opacity-50'
              }`}
            >
              {action.loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                action.icon
              )}
              <span>{action.label}</span>
            </button>
          ))}

          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Toolbar */}
        {toolbar && (
          <div
            className={`bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 ${
              toolbarCollapsed ? 'w-12' : 'w-80'
            }`}
          >
            {/* Toolbar Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              {!toolbarCollapsed && (
                <div className="flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    {toolbarTitle}
                  </h3>
                </div>
              )}
              {toolbarCollapsible && (
                <button
                  onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                  title={toolbarCollapsed ? 'Expand' : 'Collapse'}
                >
                  {toolbarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* Toolbar Content */}
            {!toolbarCollapsed && <div className="p-4">{toolbar}</div>}
          </div>
        )}

        {/* Center Panel - Canvas */}
        <div className={`flex-1 overflow-y-auto ${canvasBackground} p-6`}>
          <div className={`${canvasMaxWidth} mx-auto`}>{canvas}</div>
        </div>

        {/* Right Panel - Properties */}
        {properties && (
          <div
            className={`bg-white border-l border-gray-200 overflow-y-auto transition-all duration-300 ${
              propertiesCollapsed ? 'w-12' : 'w-80'
            }`}
          >
            {/* Properties Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              {propertiesCollapsible && (
                <button
                  onClick={() => setPropertiesCollapsed(!propertiesCollapsed)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                  title={propertiesCollapsed ? 'Expand' : 'Collapse'}
                >
                  {propertiesCollapsed ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              {!propertiesCollapsed && (
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700">
                    {propertiesTitle}
                  </h3>
                </div>
              )}
            </div>

            {/* Properties Content */}
            {!propertiesCollapsed && <div className="p-4">{properties}</div>}
          </div>
        )}
      </div>

      {/* Footer */}
      {footer && (
        <div className="border-t border-gray-200 bg-white px-6 py-3 flex-shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}
