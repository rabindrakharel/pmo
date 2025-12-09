import React, { useState, useMemo, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import { PERMISSION_LEVELS } from './PermissionLevelSelector';
import { InheritanceModeBadge, InheritanceMode } from './InheritanceModeSelector';

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

interface Permission {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  entity_display?: string;
  entity_name?: string;
  permission: number;
  permission_label?: string;
  inheritance_mode: InheritanceMode;
  child_permissions?: Record<string, number>;
  is_deny: boolean;
  granted_ts?: string;
  expires_ts?: string | null;
  granted_by_name?: string;
}

// Track pending changes
interface PendingChange {
  permissionId: string;
  originalLevel: number;
  newLevel: number;
}

interface RolePermissionsMatrixProps {
  roleId: string;
  roleName: string;
  permissions: Permission[];
  isLoading?: boolean;
  entityLabels?: Record<string, string>;
  entityIcons?: Record<string, string>;
  onRevoke?: (permissionId: string) => void;
}

/**
 * Role Permissions Matrix
 *
 * Displays role permissions as a matrix table with:
 * - Rotated column headers (45 degrees)
 * - Inline edit for permission levels (batch save)
 * - Checkmark indicators for each permission level
 * - Save button to persist all changes
 * - Revoke action
 */
export function RolePermissionsMatrix({
  roleId,
  roleName,
  permissions,
  isLoading = false,
  entityLabels = {},
  entityIcons = {},
  onRevoke
}: RolePermissionsMatrixProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Track pending changes (permissionId -> newLevel)
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});

  // Check if there are unsaved changes
  const hasChanges = Object.keys(pendingChanges).length > 0;
  const changeCount = Object.keys(pendingChanges).length;

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async (changes: PendingChange[]) => {
      const token = localStorage.getItem('auth_token');

      // Execute all updates in parallel
      const results = await Promise.all(
        changes.map(async (change) => {
          const response = await fetch(
            `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/permission/${change.permissionId}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ permission: change.newLevel })
            }
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Failed to update permission ${change.permissionId}`);
          }
          return response.json();
        })
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId, 'permissions'] });
      setPendingChanges({});
    }
  });

  // Get effective permission level (original or pending)
  const getEffectiveLevel = useCallback((perm: Permission): number => {
    if (pendingChanges[perm.id]) {
      return pendingChanges[perm.id].newLevel;
    }
    return perm.permission;
  }, [pendingChanges]);

  // Handle permission cell click
  const handlePermissionClick = useCallback((perm: Permission, clickedLevel: number) => {
    if (perm.is_deny) return; // Can't edit deny permissions

    const currentEffectiveLevel = getEffectiveLevel(perm);

    // Determine new level based on click
    let newLevel: number;
    if (currentEffectiveLevel === clickedLevel) {
      // Clicking current level reduces by 1 (minimum 0)
      newLevel = Math.max(0, clickedLevel - 1);
    } else {
      // Set to clicked level
      newLevel = clickedLevel;
    }

    // Update pending changes
    setPendingChanges(prev => {
      const updated = { ...prev };

      if (newLevel === perm.permission) {
        // Back to original - remove from pending
        delete updated[perm.id];
      } else {
        // Track the change
        updated[perm.id] = {
          permissionId: perm.id,
          originalLevel: perm.permission,
          newLevel
        };
      }

      return updated;
    });
  }, [getEffectiveLevel]);

  // Save all pending changes
  const handleSave = useCallback(() => {
    const changes = Object.values(pendingChanges);
    if (changes.length > 0) {
      batchUpdateMutation.mutate(changes);
    }
  }, [pendingChanges, batchUpdateMutation]);

  // Discard all pending changes
  const handleDiscard = useCallback(() => {
    setPendingChanges({});
  }, []);

  // Filter permissions
  const filteredPermissions = useMemo(() => {
    if (!searchQuery.trim()) return permissions;
    const query = searchQuery.toLowerCase();
    return permissions.filter(p =>
      p.entity_code.toLowerCase().includes(query) ||
      (entityLabels[p.entity_code]?.toLowerCase().includes(query)) ||
      (p.entity_name?.toLowerCase().includes(query))
    );
  }, [permissions, searchQuery, entityLabels]);

  // Group by entity code for better organization
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    filteredPermissions.forEach(p => {
      if (!groups[p.entity_code]) {
        groups[p.entity_code] = [];
      }
      groups[p.entity_code].push(p);
    });
    // Sort each group: type-level first, then by instance name
    Object.values(groups).forEach(group => {
      group.sort((a, b) => {
        if (a.entity_instance_id === ALL_ENTITIES_ID) return -1;
        if (b.entity_instance_id === ALL_ENTITIES_ID) return 1;
        return (a.entity_name || '').localeCompare(b.entity_name || '');
      });
    });
    return groups;
  }, [filteredPermissions]);

  const getIcon = (code: string) => {
    const iconName = entityIcons[code];
    if (iconName && (LucideIcons as any)[iconName]) {
      const Icon = (LucideIcons as any)[iconName];
      return <Icon className="h-4 w-4" />;
    }
    return <LucideIcons.Box className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-dark-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <div className="text-center py-12 text-dark-500">
        <div className="p-4 bg-dark-100 rounded-2xl inline-block mb-3">
          <LucideIcons.ShieldOff className="h-10 w-10 text-dark-300" />
        </div>
        <p className="text-sm font-medium">No permissions granted to this role</p>
        <p className="text-xs text-dark-400 mt-1">
          Use the Permissions tab to grant permissions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-dark-700">Permission Matrix</span>
          <span className="px-2 py-0.5 text-xs bg-dark-100 rounded text-dark-600">
            {permissions.length} rule{permissions.length !== 1 ? 's' : ''}
          </span>
          {hasChanges && (
            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
              <LucideIcons.Circle className="h-2 w-2 fill-current" />
              {changeCount} unsaved change{changeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Save/Discard Buttons */}
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={batchUpdateMutation.isPending}
              className="px-3 py-1.5 text-sm font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={batchUpdateMutation.isPending}
              className="px-4 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {batchUpdateMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                <>
                  <LucideIcons.Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
        <input
          type="text"
          placeholder="Filter by entity..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
        />
      </div>

      {/* Matrix Table */}
      <div className="border border-dark-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dark-50">
                {/* Entity column */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider w-40">
                  Entity
                </th>
                {/* Target column */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider w-48">
                  Target
                </th>
                {/* Permission columns - rotated headers */}
                {PERMISSION_LEVELS.map((level) => (
                  <th
                    key={level.value}
                    className="px-1 py-3 text-center w-10"
                    style={{ height: '80px', verticalAlign: 'bottom' }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        transform: 'rotate(-45deg)',
                        transformOrigin: 'center center',
                        whiteSpace: 'nowrap',
                        width: '24px',
                        height: '70px'
                      }}
                    >
                      <span
                        className={`text-xs font-semibold ${
                          level.value <= 2 ? 'text-slate-600' :
                          level.value <= 4 ? 'text-blue-600' :
                          level.value <= 5 ? 'text-orange-600' :
                          level.value === 6 ? 'text-emerald-600' :
                          'text-red-600'
                        }`}
                        title={level.description}
                      >
                        {level.label}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Actions column */}
                <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100">
              {Object.entries(groupedPermissions).map(([entityCode, perms]) => (
                perms.map((perm, idx) => {
                  const effectiveLevel = getEffectiveLevel(perm);
                  const hasPendingChange = !!pendingChanges[perm.id];
                  const isTypeLevel = perm.entity_instance_id === ALL_ENTITIES_ID;

                  return (
                    <tr
                      key={perm.id}
                      className={`
                        transition-colors
                        ${perm.is_deny ? 'bg-red-50 hover:bg-red-100' :
                          hasPendingChange ? 'bg-amber-50 hover:bg-amber-100' :
                          'hover:bg-dark-50'}
                      `}
                    >
                      {/* Entity - only show on first row of group */}
                      <td className="px-4 py-3">
                        {idx === 0 && (
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-md ${perm.is_deny ? 'bg-red-100 text-red-600' : 'bg-dark-100 text-dark-600'}`}>
                              {getIcon(entityCode)}
                            </div>
                            <span className="font-medium text-dark-800">
                              {entityLabels[entityCode] || entityCode}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isTypeLevel ? (
                            <span className="text-dark-500 italic flex items-center gap-1">
                              <LucideIcons.Layers className="h-3.5 w-3.5" />
                              All {entityLabels[entityCode] || entityCode}s
                            </span>
                          ) : (
                            <span className="text-dark-700">
                              {perm.entity_name || perm.entity_display || perm.entity_instance_id.slice(0, 8)}
                            </span>
                          )}
                          {perm.inheritance_mode !== 'none' && (
                            <InheritanceModeBadge mode={perm.inheritance_mode} size="sm" />
                          )}
                          {hasPendingChange && (
                            <span className="text-xs text-amber-600" title="Unsaved change">
                              (modified)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Permission checkmarks */}
                      {PERMISSION_LEVELS.map((level) => {
                        const hasPermission = !perm.is_deny && effectiveLevel >= level.value;
                        const isCurrentLevel = effectiveLevel === level.value;
                        const canClick = !perm.is_deny && !batchUpdateMutation.isPending;
                        const wasOriginalLevel = perm.permission === level.value;
                        const isModified = hasPendingChange && (isCurrentLevel || wasOriginalLevel);

                        return (
                          <td
                            key={level.value}
                            className="px-1 py-3 text-center"
                          >
                            <button
                              type="button"
                              onClick={() => canClick && handlePermissionClick(perm, level.value)}
                              disabled={!canClick}
                              className={`
                                w-6 h-6 rounded flex items-center justify-center transition-all
                                ${canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                                ${perm.is_deny ? 'bg-red-200 text-red-400' :
                                  hasPermission
                                    ? isCurrentLevel
                                      ? isModified
                                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                                        : `${level.color} text-white shadow-sm`
                                      : 'bg-green-100 text-green-600'
                                    : isModified && wasOriginalLevel
                                      ? 'bg-amber-100 text-amber-400 ring-1 ring-amber-300'
                                      : 'bg-dark-100 text-dark-300 hover:bg-dark-200'
                                }
                              `}
                              title={
                                perm.is_deny
                                  ? 'DENIED'
                                  : hasPermission
                                    ? `Has ${level.label}${isCurrentLevel ? ' (click to reduce)' : ''}`
                                    : `Grant ${level.label}`
                              }
                            >
                              {perm.is_deny ? (
                                <LucideIcons.X className="h-3.5 w-3.5" />
                              ) : hasPermission ? (
                                <LucideIcons.Check className="h-3.5 w-3.5" />
                              ) : (
                                <span className="text-xs">·</span>
                              )}
                            </button>
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasPendingChange && (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingChanges(prev => {
                                  const updated = { ...prev };
                                  delete updated[perm.id];
                                  return updated;
                                });
                              }}
                              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Undo change"
                            >
                              <LucideIcons.Undo2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onRevoke?.(perm.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Revoke Permission"
                          >
                            <LucideIcons.Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-dark-500 pt-2 border-t border-dark-100">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center">
            <LucideIcons.Check className="h-3 w-3 text-green-600" />
          </div>
          <span>Granted (inherited)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-500 flex items-center justify-center">
            <LucideIcons.Check className="h-3 w-3 text-white" />
          </div>
          <span>Current level</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-500 flex items-center justify-center">
            <LucideIcons.Check className="h-3 w-3 text-white" />
          </div>
          <span>Modified (unsaved)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-200 flex items-center justify-center">
            <LucideIcons.X className="h-3 w-3 text-red-400" />
          </div>
          <span>Explicit DENY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LucideIcons.Layers className="h-3.5 w-3.5 text-dark-400" />
          <span>Type-level (all instances)</span>
        </div>
      </div>

      {/* Error message */}
      {batchUpdateMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <LucideIcons.AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Failed to save changes: {(batchUpdateMutation.error as Error).message}</span>
          <button
            type="button"
            onClick={handleSave}
            className="ml-auto text-red-700 hover:text-red-900 underline text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Success message */}
      {batchUpdateMutation.isSuccess && !hasChanges && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
          <LucideIcons.CheckCircle className="h-4 w-4" />
          Changes saved successfully!
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton loader for RolePermissionsMatrix
 */
export function RolePermissionsMatrixSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-dark-100 rounded-lg animate-pulse w-64" />
      <div className="border border-dark-200 rounded-xl overflow-hidden">
        <div className="h-20 bg-dark-50" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 border-t border-dark-100 bg-white animate-pulse" />
        ))}
      </div>
    </div>
  );
}
