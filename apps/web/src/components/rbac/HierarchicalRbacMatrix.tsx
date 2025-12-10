import React, { useState, useMemo, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import { PERMISSION_LEVELS, getPermissionLabel } from './PermissionLevelSelector';
import { InheritanceMode } from './InheritanceModeSelector';
import { PermissionCard, PermissionBar } from './PermissionCard';

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Types for hierarchical data
interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
}

interface HierarchicalPermission {
  id: string;
  entity_instance_id: string;
  entity_instance_name: string | null;
  permission: number;
  permission_label: string;
  inheritance_mode: InheritanceMode;
  child_permissions: Record<string, number>;
  is_deny: boolean;
  granted_ts?: string;
  expires_ts?: string | null;
}

interface HierarchicalEntity {
  entity_code: string;
  entity_label: string;
  entity_icon?: string;
  child_entity_codes: ChildEntityConfig[];
  permissions: HierarchicalPermission[];
}

interface HierarchicalPermissionsData {
  role_id: string;
  role_name: string;
  role_code?: string;
  entities: HierarchicalEntity[];
}

// Track pending changes
interface PendingChange {
  type: 'permission' | 'child_permission' | 'inheritance_mode';
  permissionId: string;
  originalValue: number | string;
  newValue: number | string;
  childEntityCode?: string;
}

interface HierarchicalRbacMatrixProps {
  roleId: string;
  roleName: string;
  onRevoke?: (permissionId: string) => void;
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
 * Hierarchical RBAC Matrix Component - Card-Based Layout
 *
 * Displays role permissions in a clean card-based interface:
 * - Entity Types (collapsible sections)
 *   - Permission Cards with visual permission bars
 *   - Mode selection (None/Cascade/Mapped)
 *   - Child permissions only shown for Mapped mode
 */
export function HierarchicalRbacMatrix({
  roleId,
  roleName,
  onRevoke
}: HierarchicalRbacMatrixProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Track expanded state for entity types
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  // Track pending changes
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});

  // Fetch hierarchical permissions data
  const { data: hierarchicalData, isLoading, error } = useQuery<HierarchicalPermissionsData>({
    queryKey: ['access-control', 'role', roleId, 'hierarchical-permissions'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/role/${roleId}/hierarchical-permissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch hierarchical permissions');
      return response.json();
    },
    enabled: !!roleId
  });

  // Check if there are unsaved changes
  const hasChanges = Object.keys(pendingChanges).length > 0;
  const changeCount = Object.keys(pendingChanges).length;

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async (changes: PendingChange[]) => {
      const token = localStorage.getItem('auth_token');

      const results = await Promise.all(
        changes.map(async (change) => {
          if (change.type === 'permission') {
            const response = await fetch(
              `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/permission/${change.permissionId}`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ permission: change.newValue })
              }
            );
            if (!response.ok) throw new Error('Failed to update permission');
            return response.json();
          } else if (change.type === 'inheritance_mode') {
            const response = await fetch(
              `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/permission/${change.permissionId}`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inheritance_mode: change.newValue })
              }
            );
            if (!response.ok) throw new Error('Failed to update inheritance mode');
            return response.json();
          } else {
            const response = await fetch(
              `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/permission/${change.permissionId}/child-permissions`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  child_entity_code: change.childEntityCode,
                  permission: change.newValue
                })
              }
            );
            if (!response.ok) throw new Error('Failed to update child permission');
            return response.json();
          }
        })
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId] });
      setPendingChanges({});
    }
  });

  // Toggle entity section expansion
  const toggleEntity = useCallback((entityCode: string) => {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      if (next.has(entityCode)) {
        next.delete(entityCode);
      } else {
        next.add(entityCode);
      }
      return next;
    });
  }, []);

  // Handle permission level change
  const handlePermissionChange = useCallback((permissionId: string, originalLevel: number, newLevel: number) => {
    const key = `${permissionId}:permission`;
    setPendingChanges(prev => {
      const updated = { ...prev };
      if (newLevel === originalLevel) {
        delete updated[key];
      } else {
        updated[key] = {
          type: 'permission',
          permissionId,
          originalValue: originalLevel,
          newValue: newLevel
        };
      }
      return updated;
    });
  }, []);

  // Handle inheritance mode change
  const handleModeChange = useCallback((permissionId: string, originalMode: InheritanceMode, newMode: InheritanceMode) => {
    const key = `${permissionId}:mode`;
    setPendingChanges(prev => {
      const updated = { ...prev };
      if (newMode === originalMode) {
        delete updated[key];
      } else {
        updated[key] = {
          type: 'inheritance_mode',
          permissionId,
          originalValue: originalMode,
          newValue: newMode
        };
      }
      return updated;
    });
  }, []);

  // Handle child permission change
  const handleChildPermissionChange = useCallback((
    permissionId: string,
    childEntityCode: string,
    originalLevel: number,
    newLevel: number
  ) => {
    const key = `${permissionId}:child:${childEntityCode}`;
    setPendingChanges(prev => {
      const updated = { ...prev };
      if (newLevel === originalLevel) {
        delete updated[key];
      } else {
        updated[key] = {
          type: 'child_permission',
          permissionId,
          childEntityCode,
          originalValue: originalLevel,
          newValue: newLevel
        };
      }
      return updated;
    });
  }, []);

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

  // Filter entities by search
  const filteredEntities = useMemo(() => {
    if (!hierarchicalData?.entities) return [];
    if (!searchQuery.trim()) return hierarchicalData.entities;

    const query = searchQuery.toLowerCase();
    return hierarchicalData.entities.filter(entity =>
      entity.entity_code.toLowerCase().includes(query) ||
      entity.entity_label.toLowerCase().includes(query) ||
      entity.permissions.some(p =>
        p.entity_instance_name?.toLowerCase().includes(query)
      )
    );
  }, [hierarchicalData, searchQuery]);

  // Get pending values for a permission
  const getPendingPermission = useCallback((permissionId: string): number | undefined => {
    const key = `${permissionId}:permission`;
    return pendingChanges[key]?.newValue as number | undefined;
  }, [pendingChanges]);

  const getPendingMode = useCallback((permissionId: string): InheritanceMode | undefined => {
    const key = `${permissionId}:mode`;
    return pendingChanges[key]?.newValue as InheritanceMode | undefined;
  }, [pendingChanges]);

  const getPendingChildPermissions = useCallback((permissionId: string): Record<string, number> => {
    const result: Record<string, number> = {};
    Object.entries(pendingChanges).forEach(([key, change]) => {
      if (key.startsWith(`${permissionId}:child:`) && change.childEntityCode) {
        result[change.childEntityCode] = change.newValue as number;
      }
    });
    return result;
  }, [pendingChanges]);

  const hasPermissionPendingChange = useCallback((permissionId: string): boolean => {
    return !!pendingChanges[`${permissionId}:permission`];
  }, [pendingChanges]);

  const hasModePendingChange = useCallback((permissionId: string): boolean => {
    return !!pendingChanges[`${permissionId}:mode`];
  }, [pendingChanges]);

  if (isLoading) {
    return <HierarchicalRbacMatrixSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <div className="flex items-center gap-2">
          <LucideIcons.AlertCircle className="h-5 w-5" />
          <span>Failed to load permissions</span>
        </div>
      </div>
    );
  }

  if (!hierarchicalData?.entities || hierarchicalData.entities.length === 0) {
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
          <span className="text-sm font-medium text-dark-700">Permission Overview</span>
          <span className="px-2 py-0.5 text-xs bg-dark-100 rounded text-dark-600">
            {hierarchicalData.entities.reduce((sum, e) => sum + e.permissions.length, 0)} permissions
          </span>
          {hasChanges && (
            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
              <LucideIcons.Circle className="h-2 w-2 fill-current" />
              {changeCount} unsaved
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
          placeholder="Filter by entity type or instance..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
        />
      </div>

      {/* Expand/Collapse All */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const allEntityCodes = filteredEntities.map(e => e.entity_code);
            setExpandedEntities(new Set(allEntityCodes));
          }}
          className="px-2 py-1 text-xs font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded transition-colors flex items-center gap-1"
        >
          <LucideIcons.ChevronsDownUp className="h-3 w-3" />
          Expand All
        </button>
        <button
          type="button"
          onClick={() => setExpandedEntities(new Set())}
          className="px-2 py-1 text-xs font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded transition-colors flex items-center gap-1"
        >
          <LucideIcons.ChevronsUpDown className="h-3 w-3" />
          Collapse All
        </button>
      </div>

      {/* Entity Sections */}
      <div className="space-y-3">
        {filteredEntities.map((entity) => {
          const isExpanded = expandedEntities.has(entity.entity_code);

          return (
            <div key={entity.entity_code} className="border border-dark-200 rounded-xl overflow-hidden bg-white">
              {/* Entity Header */}
              <button
                type="button"
                onClick={() => toggleEntity(entity.entity_code)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-dark-50 to-white hover:from-dark-100 hover:to-dark-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-200' : 'bg-dark-100'}`}>
                    {getIcon(entity.entity_icon)}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-dark-800">{entity.entity_label}</div>
                    <div className="text-xs text-dark-500">
                      {entity.permissions.length} permission{entity.permissions.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Quick preview of permissions */}
                  <div className="hidden sm:flex items-center gap-1">
                    {entity.permissions.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={`px-2 py-0.5 text-xs rounded ${
                          p.is_deny ? 'bg-red-100 text-red-600' :
                          p.entity_instance_id === ALL_ENTITIES_ID ? 'bg-slate-100 text-slate-600' :
                          'bg-dark-100 text-dark-600'
                        }`}
                      >
                        {p.entity_instance_id === ALL_ENTITIES_ID ? 'All' : (p.entity_instance_name?.slice(0, 12) || '...')}
                      </span>
                    ))}
                    {entity.permissions.length > 3 && (
                      <span className="text-xs text-dark-400">+{entity.permissions.length - 3}</span>
                    )}
                  </div>
                  {isExpanded ? (
                    <LucideIcons.ChevronUp className="h-5 w-5 text-dark-400" />
                  ) : (
                    <LucideIcons.ChevronDown className="h-5 w-5 text-dark-400" />
                  )}
                </div>
              </button>

              {/* Permission Cards */}
              {isExpanded && (
                <div className="p-4 bg-dark-50/50 border-t border-dark-100">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {entity.permissions.map((permission) => {
                      const isTypeLevel = permission.entity_instance_id === ALL_ENTITIES_ID;
                      const pendingChildPerms = getPendingChildPermissions(permission.id);

                      return (
                        <PermissionCard
                          key={permission.id}
                          id={permission.id}
                          entityInstanceId={permission.entity_instance_id}
                          entityInstanceName={permission.entity_instance_name}
                          entityLabel={entity.entity_label}
                          permission={permission.permission}
                          inheritanceMode={permission.inheritance_mode}
                          childPermissions={permission.child_permissions}
                          childEntityCodes={entity.child_entity_codes}
                          isDeny={permission.is_deny}
                          isTypeLevel={isTypeLevel}
                          hasPendingChange={hasPermissionPendingChange(permission.id)}
                          hasModePendingChange={hasModePendingChange(permission.id)}
                          pendingPermission={getPendingPermission(permission.id)}
                          pendingMode={getPendingMode(permission.id)}
                          pendingChildPermissions={Object.keys(pendingChildPerms).length > 0 ? pendingChildPerms : undefined}
                          onPermissionChange={(level) => handlePermissionChange(permission.id, permission.permission, level)}
                          onModeChange={(mode) => handleModeChange(permission.id, permission.inheritance_mode, mode)}
                          onChildPermissionChange={(childCode, level) => {
                            const originalLevel = permission.child_permissions[childCode] ?? -1;
                            handleChildPermissionChange(permission.id, childCode, originalLevel, level);
                          }}
                          onRevoke={() => onRevoke?.(permission.id)}
                          disabled={batchUpdateMutation.isPending}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-4 bg-dark-50 rounded-xl border border-dark-100">
        <div className="text-xs font-semibold text-dark-600 mb-3">Quick Reference</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-dark-500">
          <div>
            <div className="font-medium text-dark-600 mb-1">Permission Bar</div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 flex-1">
                {PERMISSION_LEVELS.slice(0, 4).map((p, i) => (
                  <div
                    key={p.value}
                    className={`h-3 flex-1 rounded-sm ${i < 3 ? p.color : 'bg-dark-100'} ${i < 3 ? '' : 'opacity-40'}`}
                  />
                ))}
              </div>
              <span>= EDIT</span>
            </div>
          </div>
          <div>
            <div className="font-medium text-dark-600 mb-1">Inheritance Modes</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-dark-200" />
                <span>None - stops here</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-violet-400" />
                <span>Cascade - same to all children</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-cyan-400" />
                <span>Mapped - customize per child</span>
              </div>
            </div>
          </div>
          <div>
            <div className="font-medium text-dark-600 mb-1">Status</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span>Modified (unsaved)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-400" />
                <span>Explicit DENY</span>
              </div>
            </div>
          </div>
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
 * Skeleton loader for HierarchicalRbacMatrix
 */
export function HierarchicalRbacMatrixSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-dark-100 rounded animate-pulse" />
      </div>
      <div className="h-10 bg-dark-100 rounded-lg animate-pulse" />
      <div className="h-6 w-32 bg-dark-100 rounded animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border border-dark-200 rounded-xl overflow-hidden">
          <div className="h-16 bg-dark-50 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
