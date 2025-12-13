import React, { useState, useMemo, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import { InheritanceMode } from './InheritanceModeSelector';
import { EntityPermissionSection } from './EntityPermissionSection';

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Types for hierarchical data
interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
  ownership_flag: boolean; // true=owned (cascade), false=lookup (COMMENT max)
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
  root_level_entity_flag: boolean; // true=traversal root (business, project, customer)
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
  onGrantPermission?: (entityCode: string, scope: 'all' | 'specific') => void;
}

/**
 * Hierarchical RBAC Matrix Component - v2.3.0
 *
 * Displays role permissions organized by entity type with:
 * - Entity sections (collapsible)
 * - Type-level permission with matrix table
 * - Inheritance mode tabs (None/Cascade/Mapped)
 * - Child entity permissions matrix (for Mapped mode)
 * - Specific instance permissions matrix
 * - Batch save functionality
 */
export function HierarchicalRbacMatrix({
  roleId,
  roleName,
  onRevoke,
  onGrantPermission
}: HierarchicalRbacMatrixProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Handle permission level change
  const handlePermissionChange = useCallback((permissionId: string, newLevel: number) => {
    // Find original permission level
    let originalLevel = 0;
    for (const entity of hierarchicalData?.entities || []) {
      const perm = entity.permissions.find(p => p.id === permissionId);
      if (perm) {
        originalLevel = perm.permission;
        break;
      }
    }

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
  }, [hierarchicalData]);

  // Handle inheritance mode change
  const handleModeChange = useCallback((permissionId: string, newMode: InheritanceMode) => {
    // Find original mode
    let originalMode: InheritanceMode = 'none';
    for (const entity of hierarchicalData?.entities || []) {
      const perm = entity.permissions.find(p => p.id === permissionId);
      if (perm) {
        originalMode = perm.inheritance_mode;
        break;
      }
    }

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
  }, [hierarchicalData]);

  // Handle child permission change
  const handleChildPermissionChange = useCallback((
    permissionId: string,
    childEntityCode: string,
    newLevel: number
  ) => {
    // Find original child permission level
    let originalLevel = -1;
    for (const entity of hierarchicalData?.entities || []) {
      const perm = entity.permissions.find(p => p.id === permissionId);
      if (perm) {
        originalLevel = perm.child_permissions[childEntityCode] ?? -1;
        break;
      }
    }

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
  }, [hierarchicalData]);

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

  // Extract pending values organized by type
  const pendingPermissions = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(pendingChanges).forEach(([key, change]) => {
      if (change.type === 'permission') {
        result[change.permissionId] = change.newValue as number;
      }
    });
    return result;
  }, [pendingChanges]);

  const pendingModes = useMemo(() => {
    const result: Record<string, InheritanceMode> = {};
    Object.entries(pendingChanges).forEach(([key, change]) => {
      if (change.type === 'inheritance_mode') {
        result[change.permissionId] = change.newValue as InheritanceMode;
      }
    });
    return result;
  }, [pendingChanges]);

  const pendingChildPermissions = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    Object.entries(pendingChanges).forEach(([key, change]) => {
      if (change.type === 'child_permission' && change.childEntityCode) {
        if (!result[change.permissionId]) {
          result[change.permissionId] = {};
        }
        result[change.permissionId][change.childEntityCode] = change.newValue as number;
      }
    });
    return result;
  }, [pendingChanges]);

  // Handle grant permission
  const handleGrantPermission = useCallback((entityCode: string, scope: 'all' | 'specific') => {
    if (onGrantPermission) {
      onGrantPermission(entityCode, scope);
    }
  }, [onGrantPermission]);

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
          Grant permissions by expanding an entity section below
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

      {/* Entity Sections */}
      <div className="space-y-4">
        {filteredEntities.map((entity) => (
          <EntityPermissionSection
            key={entity.entity_code}
            entityCode={entity.entity_code}
            entityLabel={entity.entity_label}
            entityIcon={entity.entity_icon}
            rootLevelEntityFlag={entity.root_level_entity_flag}
            childEntityCodes={entity.child_entity_codes}
            permissions={entity.permissions}
            roleId={roleId}
            pendingPermissions={pendingPermissions}
            pendingModes={pendingModes}
            pendingChildPermissions={pendingChildPermissions}
            onPermissionChange={handlePermissionChange}
            onModeChange={handleModeChange}
            onChildPermissionChange={handleChildPermissionChange}
            onRevoke={(id) => onRevoke?.(id)}
            onGrantPermission={handleGrantPermission}
            onPermissionsGranted={() => queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId, 'hierarchical-permissions'] })}
            disabled={batchUpdateMutation.isPending}
          />
        ))}
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
      {[...Array(2)].map((_, i) => (
        <div key={i} className="border border-dark-200 rounded-xl overflow-hidden">
          <div className="h-14 bg-slate-100 animate-pulse" />
          <div className="p-4 bg-dark-50/30 space-y-3">
            <div className="h-32 bg-white rounded-lg border border-dark-200 animate-pulse" />
            <div className="h-24 bg-white rounded-lg border border-dark-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
