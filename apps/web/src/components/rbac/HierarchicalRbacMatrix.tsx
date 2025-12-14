import { useState, useMemo, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import type { InheritanceMode } from './InheritanceModeSelector';
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
      <div className="text-center py-8 text-dark-400">
        <LucideIcons.ShieldOff className="h-6 w-6 mx-auto mb-2 text-dark-300" />
        <p className="text-xs">No permissions granted</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Minimal Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">
            {hierarchicalData.entities.reduce((sum, e) => sum + e.permissions.length, 0)} permissions
          </span>
          {hasChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${changeCount} unsaved changes`} />
          )}
        </div>

        {/* Compact Search */}
        <div className="relative flex-1 max-w-xs ml-4">
          <LucideIcons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dark-400" />
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-dark-300 focus:border-dark-300"
          />
        </div>
      </div>

      {/* Entity Sections */}
      <div className="space-y-2">
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

      {/* Floating Save Bar - Fixed at bottom when changes exist */}
      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-800 text-white rounded-full shadow-lg">
            <span className="text-xs text-dark-300">{changeCount} unsaved</span>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={batchUpdateMutation.isPending}
              className="px-2.5 py-1 text-xs font-medium text-dark-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={batchUpdateMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white text-dark-800 rounded-full hover:bg-dark-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {batchUpdateMutation.isPending ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-dark-800" />
              ) : (
                <LucideIcons.Check className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Error message - compact */}
      {batchUpdateMutation.isError && (
        <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-center gap-2">
          <LucideIcons.AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Failed to save</span>
          <button
            type="button"
            onClick={handleSave}
            className="ml-auto text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
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
    <div className="space-y-2">
      <div className="h-8 bg-dark-100 rounded-lg animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-10 bg-dark-50 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
