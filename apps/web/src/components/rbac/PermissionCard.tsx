import React, { useState, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { PERMISSION_LEVELS, getPermissionLabel } from './PermissionLevelSelector';
import { InheritanceMode } from './InheritanceModeSelector';

interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
}

interface PermissionCardProps {
  id: string;
  entityInstanceId: string;
  entityInstanceName: string | null;
  entityLabel: string;
  permission: number;
  inheritanceMode: InheritanceMode;
  childPermissions: Record<string, number>;
  childEntityCodes: ChildEntityConfig[];
  isDeny: boolean;
  isTypeLevel: boolean;
  // Pending changes
  hasPendingChange: boolean;
  hasModePendingChange: boolean;
  pendingPermission?: number;
  pendingMode?: InheritanceMode;
  pendingChildPermissions?: Record<string, number>;
  // Callbacks
  onPermissionChange: (level: number) => void;
  onModeChange: (mode: InheritanceMode) => void;
  onChildPermissionChange: (childEntityCode: string, level: number) => void;
  onRevoke: () => void;
  disabled?: boolean;
}

/**
 * Permission Bar Component
 * Visual bar showing permission level with clickable segments
 */
function PermissionBar({
  level,
  onChange,
  disabled = false,
  compact = false,
  showLabel = true,
  pendingLevel,
}: {
  level: number;
  onChange?: (level: number) => void;
  disabled?: boolean;
  compact?: boolean;
  showLabel?: boolean;
  pendingLevel?: number;
}) {
  const effectiveLevel = pendingLevel ?? level;
  const isModified = pendingLevel !== undefined && pendingLevel !== level;

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`}>
      <div className={`flex-1 flex items-center gap-0.5 ${compact ? 'max-w-48' : ''}`}>
        {PERMISSION_LEVELS.map((perm) => {
          const isActive = effectiveLevel >= perm.value;
          const isCurrentLevel = effectiveLevel === perm.value;
          const canClick = !disabled && onChange;

          return (
            <button
              key={perm.value}
              type="button"
              onClick={() => canClick && onChange(perm.value === effectiveLevel ? Math.max(0, perm.value - 1) : perm.value)}
              disabled={disabled || !onChange}
              className={`
                ${compact ? 'h-4 flex-1' : 'h-6 flex-1'}
                rounded-sm transition-all
                ${canClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                ${isActive
                  ? isCurrentLevel
                    ? isModified
                      ? 'bg-amber-500'
                      : perm.color
                    : `${perm.color} opacity-40`
                  : 'bg-dark-100'
                }
              `}
              title={`${perm.label}: ${perm.description}`}
            />
          );
        })}
      </div>
      {showLabel && (
        <span className={`
          font-medium whitespace-nowrap
          ${compact ? 'text-xs min-w-16' : 'text-sm min-w-20'}
          ${isModified ? 'text-amber-600' : 'text-dark-700'}
        `}>
          {getPermissionLabel(effectiveLevel)}
          {isModified && ' *'}
        </span>
      )}
    </div>
  );
}

/**
 * Get icon component by name
 */
function getIcon(iconName?: string, className = 'h-4 w-4') {
  if (iconName && (LucideIcons as any)[iconName]) {
    const Icon = (LucideIcons as any)[iconName];
    return <Icon className={className} />;
  }
  return <LucideIcons.Box className={className} />;
}

/**
 * Permission Card Component
 * Card-based visualization for a single permission with mode selection and child permissions
 */
export function PermissionCard({
  id,
  entityInstanceId,
  entityInstanceName,
  entityLabel,
  permission,
  inheritanceMode,
  childPermissions,
  childEntityCodes,
  isDeny,
  isTypeLevel,
  hasPendingChange,
  hasModePendingChange,
  pendingPermission,
  pendingMode,
  pendingChildPermissions,
  onPermissionChange,
  onModeChange,
  onChildPermissionChange,
  onRevoke,
  disabled = false,
}: PermissionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const effectiveMode = pendingMode ?? inheritanceMode;
  const effectivePermission = pendingPermission ?? permission;
  const hasChildren = childEntityCodes.length > 0 && !isTypeLevel;
  const canExpand = hasChildren && effectiveMode === 'mapped';
  const showCascadeSummary = hasChildren && effectiveMode === 'cascade';
  const isModified = hasPendingChange || hasModePendingChange || (pendingChildPermissions && Object.keys(pendingChildPermissions).length > 0);

  // Get effective child permission
  const getChildLevel = useCallback((childCode: string): number => {
    if (pendingChildPermissions?.[childCode] !== undefined) {
      return pendingChildPermissions[childCode];
    }
    if (childPermissions[childCode] !== undefined) {
      return childPermissions[childCode];
    }
    return -1; // Inherits from parent
  }, [childPermissions, pendingChildPermissions]);

  const isChildModified = useCallback((childCode: string): boolean => {
    return pendingChildPermissions?.[childCode] !== undefined &&
      pendingChildPermissions[childCode] !== (childPermissions[childCode] ?? -1);
  }, [childPermissions, pendingChildPermissions]);

  return (
    <div className={`
      border rounded-xl overflow-hidden transition-all
      ${isDeny ? 'border-red-300 bg-red-50' :
        isModified ? 'border-amber-300 bg-amber-50/30' :
        'border-dark-200 bg-white'}
    `}>
      {/* Card Header */}
      <div className="p-4">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isTypeLevel ? (
              <>
                <LucideIcons.Layers className="h-4 w-4 text-dark-400" />
                <span className="text-dark-500 italic text-sm">All {entityLabel}s</span>
              </>
            ) : (
              <>
                <LucideIcons.FileText className="h-4 w-4 text-dark-500" />
                <span className="font-medium text-dark-800">
                  {entityInstanceName || entityInstanceId.slice(0, 8)}
                </span>
              </>
            )}
            {isModified && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                Modified
              </span>
            )}
            {isDeny && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded flex items-center gap-1">
                <LucideIcons.Ban className="h-3 w-3" />
                DENIED
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onRevoke}
            className="p-1.5 text-dark-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Revoke Permission"
          >
            <LucideIcons.Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Permission Bar */}
        <div className="mb-4">
          <div className="text-xs text-dark-500 mb-1.5 font-medium">Permission Level</div>
          <PermissionBar
            level={permission}
            pendingLevel={pendingPermission}
            onChange={!isDeny ? onPermissionChange : undefined}
            disabled={disabled || isDeny}
          />
        </div>

        {/* Inheritance Mode (only for instances with children) */}
        {hasChildren && (
          <div>
            <div className="text-xs text-dark-500 mb-2 font-medium">Child Entity Inheritance</div>
            <div className="flex gap-2">
              {/* None */}
              <button
                type="button"
                onClick={() => onModeChange('none')}
                disabled={disabled || isDeny}
                className={`
                  flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                  ${effectiveMode === 'none'
                    ? 'border-dark-400 bg-dark-100'
                    : 'border-dark-200 hover:border-dark-300 hover:bg-dark-50'}
                  ${(disabled || isDeny) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <LucideIcons.Circle className={`h-5 w-5 ${effectiveMode === 'none' ? 'text-dark-600' : 'text-dark-400'}`} />
                <span className={`text-xs font-medium ${effectiveMode === 'none' ? 'text-dark-700' : 'text-dark-500'}`}>
                  None
                </span>
                <span className="text-[10px] text-dark-400 text-center leading-tight">
                  Stop here
                </span>
              </button>

              {/* Cascade */}
              <button
                type="button"
                onClick={() => onModeChange('cascade')}
                disabled={disabled || isDeny}
                className={`
                  flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                  ${effectiveMode === 'cascade'
                    ? 'border-violet-400 bg-violet-100'
                    : 'border-dark-200 hover:border-violet-300 hover:bg-violet-50'}
                  ${(disabled || isDeny) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <LucideIcons.ArrowDownCircle className={`h-5 w-5 ${effectiveMode === 'cascade' ? 'text-violet-600' : 'text-dark-400'}`} />
                <span className={`text-xs font-medium ${effectiveMode === 'cascade' ? 'text-violet-700' : 'text-dark-500'}`}>
                  Cascade
                </span>
                <span className="text-[10px] text-dark-400 text-center leading-tight">
                  Same to all
                </span>
              </button>

              {/* Mapped */}
              <button
                type="button"
                onClick={() => onModeChange('mapped')}
                disabled={disabled || isDeny}
                className={`
                  flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                  ${effectiveMode === 'mapped'
                    ? 'border-cyan-400 bg-cyan-100'
                    : 'border-dark-200 hover:border-cyan-300 hover:bg-cyan-50'}
                  ${(disabled || isDeny) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <LucideIcons.GitBranch className={`h-5 w-5 ${effectiveMode === 'mapped' ? 'text-cyan-600' : 'text-dark-400'}`} />
                <span className={`text-xs font-medium ${effectiveMode === 'mapped' ? 'text-cyan-700' : 'text-dark-500'}`}>
                  Mapped
                </span>
                <span className="text-[10px] text-dark-400 text-center leading-tight">
                  Customize
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cascade Summary */}
      {showCascadeSummary && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-violet-700">
              <LucideIcons.ArrowDownCircle className="h-4 w-4" />
              <span>
                All {childEntityCodes.length} child types inherit <strong>{getPermissionLabel(effectivePermission)}</strong>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {childEntityCodes.map(child => (
                <span
                  key={child.entity}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-600 text-xs rounded"
                >
                  {getIcon(child.ui_icon, 'h-3 w-3')}
                  {child.ui_label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mapped Children - Expandable */}
      {canExpand && (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-cyan-50 border-t border-cyan-200 hover:bg-cyan-100 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-cyan-700">
              <LucideIcons.GitBranch className="h-4 w-4" />
              Child Permissions ({childEntityCodes.length} types)
            </span>
            {isExpanded ? (
              <LucideIcons.ChevronUp className="h-4 w-4 text-cyan-500" />
            ) : (
              <LucideIcons.ChevronDown className="h-4 w-4 text-cyan-500" />
            )}
          </button>

          {isExpanded && (
            <div className="px-4 py-3 bg-cyan-50/50 border-t border-cyan-100 space-y-3">
              {childEntityCodes.map(child => {
                const childLevel = getChildLevel(child.entity);
                const displayLevel = childLevel >= 0 ? childLevel : effectivePermission;
                const inheritsParent = childLevel < 0;
                const modified = isChildModified(child.entity);

                return (
                  <div key={child.entity} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-32">
                      <div className="p-1.5 bg-cyan-100 rounded">
                        {getIcon(child.ui_icon, 'h-3.5 w-3.5 text-cyan-600')}
                      </div>
                      <span className="text-sm text-dark-700">{child.ui_label}</span>
                    </div>
                    <div className="flex-1">
                      <PermissionBar
                        level={inheritsParent ? effectivePermission : childLevel}
                        pendingLevel={modified ? pendingChildPermissions?.[child.entity] : undefined}
                        onChange={(level) => onChildPermissionChange(child.entity, level)}
                        disabled={disabled || isDeny}
                        compact
                      />
                    </div>
                    {inheritsParent && !modified && (
                      <span className="text-xs text-cyan-500 italic whitespace-nowrap">
                        (inherits)
                      </span>
                    )}
                    {modified && (
                      <button
                        type="button"
                        onClick={() => onChildPermissionChange(child.entity, -1)} // Reset to inherit
                        className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                        title="Reset to inherit from parent"
                      >
                        <LucideIcons.Undo2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { PermissionBar };
