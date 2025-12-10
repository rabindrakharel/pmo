import React, { useState, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { PermissionMatrixTable } from './PermissionMatrixTable';
import { InheritanceMode } from './InheritanceModeSelector';
import { getPermissionLabel } from './PermissionLevelSelector';

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
}

interface PermissionData {
  id: string;
  entity_instance_id: string;
  entity_instance_name: string | null;
  permission: number;
  inheritance_mode: InheritanceMode;
  child_permissions: Record<string, number>;
  is_deny: boolean;
}

interface EntityPermissionSectionProps {
  entityCode: string;
  entityLabel: string;
  entityIcon?: string;
  childEntityCodes: ChildEntityConfig[];
  permissions: PermissionData[];
  // Pending changes tracking
  pendingPermissions: Record<string, number>;
  pendingModes: Record<string, InheritanceMode>;
  pendingChildPermissions: Record<string, Record<string, number>>;
  // Callbacks
  onPermissionChange: (permissionId: string, level: number) => void;
  onModeChange: (permissionId: string, mode: InheritanceMode) => void;
  onChildPermissionChange: (permissionId: string, childCode: string, level: number) => void;
  onRevoke: (permissionId: string) => void;
  onGrantPermission: (entityCode: string, scope: 'all' | 'specific') => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
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
 * Entity Permission Section
 *
 * Complete permission management section for a single entity type.
 * Includes:
 * - Collapsible header
 * - Type-level permission (All [Entity]s) with matrix
 * - Inheritance mode selector (None/Cascade/Mapped)
 * - Child entity permissions matrix (when Mapped)
 * - Specific instance permissions with matrix
 * - Grant permission button
 */
export function EntityPermissionSection({
  entityCode,
  entityLabel,
  entityIcon,
  childEntityCodes,
  permissions,
  pendingPermissions,
  pendingModes,
  pendingChildPermissions,
  onPermissionChange,
  onModeChange,
  onChildPermissionChange,
  onRevoke,
  onGrantPermission,
  disabled = false,
  defaultExpanded = true
}: EntityPermissionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [specificExpanded, setSpecificExpanded] = useState(true);

  // Separate type-level and instance-level permissions
  const typePermission = useMemo(() => {
    return permissions.find(p => p.entity_instance_id === ALL_ENTITIES_ID);
  }, [permissions]);

  const instancePermissions = useMemo(() => {
    return permissions.filter(p => p.entity_instance_id !== ALL_ENTITIES_ID);
  }, [permissions]);

  // Get effective values (pending or original)
  const getEffectiveMode = useCallback((permId: string, original: InheritanceMode): InheritanceMode => {
    return pendingModes[permId] ?? original;
  }, [pendingModes]);

  const getEffectiveChildPermission = useCallback((permId: string, childCode: string, original: number): number => {
    return pendingChildPermissions[permId]?.[childCode] ?? original;
  }, [pendingChildPermissions]);

  // Check if there are any pending changes for this entity
  const hasChanges = useMemo(() => {
    const permIds = permissions.map(p => p.id);
    const hasPermChange = permIds.some(id => pendingPermissions[id] !== undefined);
    const hasModeChange = permIds.some(id => pendingModes[id] !== undefined);
    const hasChildChange = permIds.some(id => pendingChildPermissions[id] && Object.keys(pendingChildPermissions[id]).length > 0);
    return hasPermChange || hasModeChange || hasChildChange;
  }, [permissions, pendingPermissions, pendingModes, pendingChildPermissions]);

  // Build rows for type-level table
  const typeLevelRows = useMemo(() => {
    if (!typePermission) return [];
    return [{
      id: typePermission.id,
      label: `All ${entityLabel}s`,
      isTypeLevel: true,
      permission: typePermission.permission,
      isDeny: typePermission.is_deny,
      hasInheritanceConfig: false
    }];
  }, [typePermission, entityLabel]);

  // Build rows for child entity permissions
  const childRows = useMemo(() => {
    if (!typePermission) return [];
    const effectiveMode = getEffectiveMode(typePermission.id, typePermission.inheritance_mode);
    if (effectiveMode !== 'mapped') return [];

    return childEntityCodes.map(child => {
      const originalLevel = typePermission.child_permissions[child.entity] ?? -1;
      const effectiveLevel = getEffectiveChildPermission(typePermission.id, child.entity, originalLevel);
      // If -1, inherit from parent
      const displayLevel = effectiveLevel >= 0 ? effectiveLevel : (pendingPermissions[typePermission.id] ?? typePermission.permission);

      return {
        id: `${typePermission.id}:child:${child.entity}`,
        label: child.ui_label,
        icon: child.ui_icon,
        permission: displayLevel,
        isDeny: false,
        isTypeLevel: false,
        hasInheritanceConfig: false,
        _childCode: child.entity,
        _inheritsParent: effectiveLevel < 0
      };
    });
  }, [typePermission, childEntityCodes, getEffectiveMode, getEffectiveChildPermission, pendingPermissions]);

  // Build rows for instance-level table
  const instanceRows = useMemo(() => {
    return instancePermissions.map(p => ({
      id: p.id,
      label: p.entity_instance_name || p.entity_instance_id.slice(0, 8),
      isTypeLevel: false,
      permission: p.permission,
      isDeny: p.is_deny,
      hasInheritanceConfig: childEntityCodes.length > 0
    }));
  }, [instancePermissions, childEntityCodes]);

  // Handle child permission change (need to extract child code from row id)
  const handleChildPermissionChange = useCallback((rowId: string, level: number) => {
    // rowId format: "{permissionId}:child:{childCode}"
    const parts = rowId.split(':child:');
    if (parts.length === 2) {
      onChildPermissionChange(parts[0], parts[1], level);
    }
  }, [onChildPermissionChange]);

  // Get pending changes for child rows
  const childPendingChanges = useMemo(() => {
    if (!typePermission) return {};
    const changes: Record<string, number> = {};
    const pending = pendingChildPermissions[typePermission.id];
    if (pending) {
      Object.entries(pending).forEach(([childCode, level]) => {
        changes[`${typePermission.id}:child:${childCode}`] = level >= 0 ? level : (pendingPermissions[typePermission.id] ?? typePermission.permission);
      });
    }
    return changes;
  }, [typePermission, pendingChildPermissions, pendingPermissions]);

  const totalPermissions = permissions.length;

  return (
    <div className="border border-dark-200 rounded-xl overflow-hidden bg-white">
      {/* Entity Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-100 to-white hover:from-slate-200 hover:to-slate-50 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-300' : 'bg-slate-200'}`}>
            {getIcon(entityIcon, 'h-5 w-5 text-slate-700')}
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              {entityLabel} Access
            </div>
            <div className="text-xs text-dark-500">
              {totalPermissions} permission{totalPermissions !== 1 ? 's' : ''}
              {hasChanges && (
                <span className="ml-2 text-amber-600">• unsaved changes</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <LucideIcons.ChevronUp className="h-5 w-5 text-dark-400" />
          ) : (
            <LucideIcons.ChevronDown className="h-5 w-5 text-dark-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-dark-50/30">
          {/* TYPE-LEVEL SECTION: All [Entity]s */}
          {typePermission ? (
            <div className="bg-white rounded-lg border border-dark-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-dark-100">
                <div className="flex items-center gap-2">
                  <LucideIcons.Globe className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-700">All {entityLabel}s</span>
                  <span className="text-xs text-dark-400">(Type-Level Permission)</span>
                </div>
              </div>

              {/* Type-level matrix table */}
              <div className="p-3">
                <PermissionMatrixTable
                  rows={typeLevelRows}
                  pendingChanges={pendingPermissions}
                  onPermissionChange={onPermissionChange}
                  onRevoke={onRevoke}
                  disabled={disabled}
                />
              </div>

              {/* Inheritance Mode Selector */}
              {childEntityCodes.length > 0 && (
                <div className="px-4 py-3 border-t border-dark-100 bg-dark-50/50">
                  <div className="text-xs font-medium text-dark-600 mb-2">
                    Inheritance to Child Entities:
                  </div>
                  <div className="flex gap-2">
                    {(['none', 'cascade', 'mapped'] as InheritanceMode[]).map((mode) => {
                      const effectiveMode = getEffectiveMode(typePermission.id, typePermission.inheritance_mode);
                      const isSelected = effectiveMode === mode;
                      const isModified = pendingModes[typePermission.id] !== undefined;

                      const modeConfig = {
                        none: { icon: LucideIcons.Circle, label: 'None', desc: 'Stops here', color: 'dark' },
                        cascade: { icon: LucideIcons.ArrowDownCircle, label: 'Cascade', desc: 'Same to all', color: 'violet' },
                        mapped: { icon: LucideIcons.GitBranch, label: 'Mapped', desc: 'Customize', color: 'cyan' }
                      }[mode];

                      const Icon = modeConfig.icon;

                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onModeChange(typePermission.id, mode)}
                          disabled={disabled || typePermission.is_deny}
                          className={`
                            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm
                            ${isSelected
                              ? mode === 'none'
                                ? 'border-dark-400 bg-dark-100 text-dark-700'
                                : mode === 'cascade'
                                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                                  : 'border-cyan-400 bg-cyan-50 text-cyan-700'
                              : 'border-dark-200 hover:border-dark-300 text-dark-500 hover:text-dark-700'
                            }
                            ${(disabled || typePermission.is_deny) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${isSelected && isModified ? 'ring-2 ring-amber-300' : ''}
                          `}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{modeConfig.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cascade Summary */}
                  {getEffectiveMode(typePermission.id, typePermission.inheritance_mode) === 'cascade' && (
                    <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-violet-700">
                        <LucideIcons.ArrowDownCircle className="h-4 w-4" />
                        <span>
                          All {childEntityCodes.length} child types inherit{' '}
                          <strong>{getPermissionLabel(pendingPermissions[typePermission.id] ?? typePermission.permission)}</strong>
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
                  )}

                  {/* Mapped Child Permissions Table */}
                  {getEffectiveMode(typePermission.id, typePermission.inheritance_mode) === 'mapped' && (
                    <div className="mt-3 bg-cyan-50 border border-cyan-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 border-b border-cyan-200 bg-cyan-100/50">
                        <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
                          <LucideIcons.GitBranch className="h-4 w-4" />
                          <span>Child Entity Permissions</span>
                          <span className="text-xs text-cyan-500 font-normal">
                            ({childEntityCodes.length} types)
                          </span>
                        </div>
                      </div>
                      <div className="p-2">
                        <PermissionMatrixTable
                          rows={childRows}
                          pendingChanges={childPendingChanges}
                          onPermissionChange={handleChildPermissionChange}
                          onUndo={(rowId) => {
                            const parts = rowId.split(':child:');
                            if (parts.length === 2) {
                              onChildPermissionChange(parts[0], parts[1], -1); // Reset to inherit
                            }
                          }}
                          disabled={disabled}
                          compact
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-dashed border-dark-300 p-4 text-center">
              <div className="text-sm text-dark-500">
                No type-level permission set for all {entityLabel}s
              </div>
              <button
                type="button"
                onClick={() => onGrantPermission(entityCode, 'all')}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                + Add type-level permission
              </button>
            </div>
          )}

          {/* INSTANCE-LEVEL SECTION: Specific [Entity]s */}
          {instancePermissions.length > 0 && (
            <div className="bg-white rounded-lg border border-dark-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setSpecificExpanded(!specificExpanded)}
                className="w-full px-4 py-2 bg-blue-50 border-b border-dark-100 flex items-center justify-between hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LucideIcons.Target className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">Specific {entityLabel}s</span>
                  <span className="text-xs text-blue-400">
                    ({instancePermissions.length} instance{instancePermissions.length !== 1 ? 's' : ''})
                  </span>
                </div>
                {specificExpanded ? (
                  <LucideIcons.ChevronUp className="h-4 w-4 text-blue-400" />
                ) : (
                  <LucideIcons.ChevronDown className="h-4 w-4 text-blue-400" />
                )}
              </button>

              {specificExpanded && (
                <div className="p-3">
                  <PermissionMatrixTable
                    rows={instanceRows}
                    pendingChanges={pendingPermissions}
                    onPermissionChange={onPermissionChange}
                    onRevoke={onRevoke}
                    onConfigureInheritance={(id) => {
                      // TODO: Open inheritance config modal for specific instance
                      console.log('Configure inheritance for:', id);
                    }}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}

          {/* Grant Permission Button */}
          <button
            type="button"
            onClick={() => onGrantPermission(entityCode, 'specific')}
            className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <LucideIcons.Plus className="h-4 w-4" />
            Grant Permission to {entityLabel}
          </button>
        </div>
      )}
    </div>
  );
}
