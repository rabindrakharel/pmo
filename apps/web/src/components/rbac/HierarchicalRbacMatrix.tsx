import React, { useState, useMemo, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import { PERMISSION_LEVELS } from './PermissionLevelSelector';
import { InheritanceModeBadge, InheritanceMode } from './InheritanceModeSelector';

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
  type: 'permission' | 'child_permission';
  permissionId: string;
  originalLevel: number;
  newLevel: number;
  childEntityCode?: string; // For child permission changes
}

interface HierarchicalRbacMatrixProps {
  roleId: string;
  roleName: string;
  onRevoke?: (permissionId: string) => void;
}

/**
 * Hierarchical RBAC Matrix Component
 *
 * Displays role permissions in a hierarchical tree structure:
 * - Entity Types (collapsible)
 *   - All [Entity] (type-level permission)
 *   - Specific Instance (collapsible)
 *     - Child Entity Type permissions
 */
export function HierarchicalRbacMatrix({
  roleId,
  roleName,
  onRevoke
}: HierarchicalRbacMatrixProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Track expanded state
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());

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

  // Batch update mutation for permission level changes
  const batchUpdateMutation = useMutation({
    mutationFn: async (changes: PendingChange[]) => {
      const token = localStorage.getItem('auth_token');

      const results = await Promise.all(
        changes.map(async (change) => {
          if (change.type === 'permission') {
            // Update main permission level
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
            if (!response.ok) throw new Error('Failed to update permission');
            return response.json();
          } else {
            // Update child permission
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
                  permission: change.newLevel
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

  // Toggle entity expansion
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

  // Toggle instance expansion
  const toggleInstance = useCallback((instanceKey: string) => {
    setExpandedInstances(prev => {
      const next = new Set(prev);
      if (next.has(instanceKey)) {
        next.delete(instanceKey);
      } else {
        next.add(instanceKey);
      }
      return next;
    });
  }, []);

  // Get effective permission level (original or pending)
  const getEffectiveLevel = useCallback((permissionId: string, isChild: boolean, childCode?: string): number | undefined => {
    const key = isChild ? `${permissionId}:${childCode}` : permissionId;
    const pending = pendingChanges[key];
    return pending?.newLevel;
  }, [pendingChanges]);

  // Handle permission cell click
  const handlePermissionClick = useCallback((
    permission: HierarchicalPermission,
    clickedLevel: number,
    isChildPermission: boolean = false,
    childEntityCode?: string,
    currentLevel?: number
  ) => {
    if (permission.is_deny) return;

    const key = isChildPermission ? `${permission.id}:${childEntityCode}` : permission.id;
    const originalLevel = currentLevel !== undefined ? currentLevel : permission.permission;
    const effectivePending = pendingChanges[key];
    const currentEffectiveLevel = effectivePending?.newLevel ?? originalLevel;

    // Determine new level
    let newLevel: number;
    if (currentEffectiveLevel === clickedLevel) {
      newLevel = Math.max(0, clickedLevel - 1);
    } else {
      newLevel = clickedLevel;
    }

    setPendingChanges(prev => {
      const updated = { ...prev };

      if (newLevel === originalLevel) {
        delete updated[key];
      } else {
        updated[key] = {
          type: isChildPermission ? 'child_permission' : 'permission',
          permissionId: permission.id,
          originalLevel,
          newLevel,
          childEntityCode: isChildPermission ? childEntityCode : undefined
        };
      }

      return updated;
    });
  }, [pendingChanges]);

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

  // Get icon component
  const getIcon = (iconName?: string) => {
    if (iconName && (LucideIcons as any)[iconName]) {
      const Icon = (LucideIcons as any)[iconName];
      return <Icon className="h-4 w-4" />;
    }
    return <LucideIcons.Box className="h-4 w-4" />;
  };

  // Render permission cells
  const renderPermissionCells = (
    permission: HierarchicalPermission,
    currentLevel: number,
    isChildPermission: boolean = false,
    childEntityCode?: string
  ) => {
    const key = isChildPermission ? `${permission.id}:${childEntityCode}` : permission.id;
    const hasPendingChange = !!pendingChanges[key];
    const effectiveLevel = hasPendingChange
      ? pendingChanges[key].newLevel
      : currentLevel;
    const originalLevel = currentLevel;

    return PERMISSION_LEVELS.map((level) => {
      // Skip CREATE (6) for child permissions as it only applies at type-level
      if (isChildPermission && level.value === 6) {
        return (
          <td key={level.value} className="px-1 py-2 text-center">
            <span className="text-xs text-dark-300">-</span>
          </td>
        );
      }

      const hasPermission = !permission.is_deny && effectiveLevel >= level.value;
      const isCurrentLevel = effectiveLevel === level.value;
      const canClick = !permission.is_deny && !batchUpdateMutation.isPending;
      const wasOriginalLevel = originalLevel === level.value;
      const isModified = hasPendingChange && (isCurrentLevel || wasOriginalLevel);

      return (
        <td key={level.value} className="px-1 py-2 text-center">
          <button
            type="button"
            onClick={() => canClick && handlePermissionClick(
              permission,
              level.value,
              isChildPermission,
              childEntityCode,
              currentLevel
            )}
            disabled={!canClick}
            className={`
              w-5 h-5 rounded flex items-center justify-center transition-all text-xs
              ${canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
              ${permission.is_deny ? 'bg-red-200 text-red-400' :
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
              permission.is_deny
                ? 'DENIED'
                : hasPermission
                  ? `Has ${level.label}${isCurrentLevel ? ' (click to reduce)' : ''}`
                  : `Grant ${level.label}`
            }
          >
            {permission.is_deny ? (
              <LucideIcons.X className="h-3 w-3" />
            ) : hasPermission ? (
              <LucideIcons.Check className="h-3 w-3" />
            ) : (
              <span>·</span>
            )}
          </button>
        </td>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-dark-100 rounded-lg animate-pulse w-64" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-dark-200 rounded-xl overflow-hidden">
            <div className="h-14 bg-dark-50" />
            {[...Array(2)].map((_, j) => (
              <div key={j} className="h-12 border-t border-dark-100 bg-white animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
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
          <span className="text-sm font-medium text-dark-700">Hierarchical Permission Matrix</span>
          <span className="px-2 py-0.5 text-xs bg-dark-100 rounded text-dark-600">
            {hierarchicalData.entities.length} entity type{hierarchicalData.entities.length !== 1 ? 's' : ''}
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
            const allInstanceKeys = filteredEntities.flatMap(e =>
              e.permissions
                .filter(p => p.entity_instance_id !== ALL_ENTITIES_ID)
                .map(p => `${e.entity_code}:${p.entity_instance_id}`)
            );
            setExpandedEntities(new Set(allEntityCodes));
            setExpandedInstances(new Set(allInstanceKeys));
          }}
          className="px-2 py-1 text-xs font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded transition-colors flex items-center gap-1"
        >
          <LucideIcons.ChevronsDownUp className="h-3 w-3" />
          Expand All
        </button>
        <button
          type="button"
          onClick={() => {
            setExpandedEntities(new Set());
            setExpandedInstances(new Set());
          }}
          className="px-2 py-1 text-xs font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded transition-colors flex items-center gap-1"
        >
          <LucideIcons.ChevronsUpDown className="h-3 w-3" />
          Collapse All
        </button>
      </div>

      {/* Entity Groups */}
      <div className="space-y-3">
        {filteredEntities.map((entity) => {
          const isEntityExpanded = expandedEntities.has(entity.entity_code);

          return (
            <div key={entity.entity_code} className="border border-dark-200 rounded-xl overflow-hidden">
              {/* Entity Header */}
              <button
                type="button"
                onClick={() => toggleEntity(entity.entity_code)}
                className="w-full flex items-center justify-between px-4 py-3 bg-dark-50 hover:bg-dark-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isEntityExpanded ? 'bg-slate-200' : 'bg-dark-100'}`}>
                    {getIcon(entity.entity_icon)}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-dark-800">{entity.entity_label}</div>
                    <div className="text-xs text-dark-500">
                      {entity.permissions.length} permission{entity.permissions.length !== 1 ? 's' : ''}
                      {entity.child_entity_codes.length > 0 && (
                        <span className="ml-2 text-dark-400">
                          ({entity.child_entity_codes.length} child types)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEntityExpanded ? (
                    <LucideIcons.ChevronDown className="h-5 w-5 text-dark-400" />
                  ) : (
                    <LucideIcons.ChevronRight className="h-5 w-5 text-dark-400" />
                  )}
                </div>
              </button>

              {/* Entity Content */}
              {isEntityExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white border-b border-dark-100">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider w-72">
                          Target
                        </th>
                        {/* Permission columns - rotated headers */}
                        {PERMISSION_LEVELS.map((level) => (
                          <th
                            key={level.value}
                            className="px-1 py-2 text-center w-8"
                            style={{ height: '60px', verticalAlign: 'bottom' }}
                          >
                            <div
                              className="flex items-center justify-center"
                              style={{
                                transform: 'rotate(-45deg)',
                                transformOrigin: 'center center',
                                whiteSpace: 'nowrap',
                                width: '20px',
                                height: '50px'
                              }}
                            >
                              <span
                                className={`text-[10px] font-semibold ${
                                  level.value <= 2 ? 'text-slate-600' :
                                  level.value <= 4 ? 'text-blue-600' :
                                  level.value <= 5 ? 'text-orange-600' :
                                  level.value === 6 ? 'text-emerald-600' :
                                  'text-red-600'
                                }`}
                                title={level.description}
                              >
                                {level.label.slice(0, 3)}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider w-16">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-100">
                      {entity.permissions.map((permission) => {
                        const isTypeLevel = permission.entity_instance_id === ALL_ENTITIES_ID;
                        const instanceKey = `${entity.entity_code}:${permission.entity_instance_id}`;
                        const isInstanceExpanded = expandedInstances.has(instanceKey);
                        const hasChildEntities = entity.child_entity_codes.length > 0 && !isTypeLevel;
                        const hasPendingChange = !!pendingChanges[permission.id];

                        return (
                          <React.Fragment key={permission.id}>
                            {/* Permission Row */}
                            <tr className={`
                              transition-colors
                              ${permission.is_deny ? 'bg-red-50 hover:bg-red-100' :
                                hasPendingChange ? 'bg-amber-50 hover:bg-amber-100' :
                                'hover:bg-dark-50'}
                            `}>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  {/* Expand/Collapse for instances with child entities */}
                                  {hasChildEntities ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleInstance(instanceKey);
                                      }}
                                      className="p-1 rounded hover:bg-dark-100 transition-colors"
                                    >
                                      {isInstanceExpanded ? (
                                        <LucideIcons.ChevronDown className="h-4 w-4 text-dark-500" />
                                      ) : (
                                        <LucideIcons.ChevronRight className="h-4 w-4 text-dark-500" />
                                      )}
                                    </button>
                                  ) : (
                                    <div className="w-6" /> /* Spacer */
                                  )}

                                  {isTypeLevel ? (
                                    <span className="text-dark-500 italic flex items-center gap-1">
                                      <LucideIcons.Layers className="h-3.5 w-3.5" />
                                      All {entity.entity_label}s
                                    </span>
                                  ) : (
                                    <span className="text-dark-700 font-medium">
                                      {permission.entity_instance_name || permission.entity_instance_id.slice(0, 8)}
                                    </span>
                                  )}

                                  {permission.inheritance_mode !== 'none' && (
                                    <InheritanceModeBadge mode={permission.inheritance_mode} size="sm" />
                                  )}

                                  {hasPendingChange && (
                                    <span className="text-xs text-amber-600">(modified)</span>
                                  )}
                                </div>
                              </td>

                              {/* Permission cells */}
                              {renderPermissionCells(permission, permission.permission)}

                              {/* Actions */}
                              <td className="px-2 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {hasPendingChange && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPendingChanges(prev => {
                                          const updated = { ...prev };
                                          delete updated[permission.id];
                                          return updated;
                                        });
                                      }}
                                      className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                      title="Undo change"
                                    >
                                      <LucideIcons.Undo2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onRevoke?.(permission.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                    title="Revoke Permission"
                                  >
                                    <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Child Entity Rows (when expanded) */}
                            {isInstanceExpanded && entity.child_entity_codes.map((childConfig) => {
                              const childKey = `${permission.id}:${childConfig.entity}`;
                              const childLevel = permission.child_permissions[childConfig.entity];
                              const hasChildLevel = childLevel !== undefined;
                              const hasChildPendingChange = !!pendingChanges[childKey];
                              const effectiveChildLevel = hasChildPendingChange
                                ? pendingChanges[childKey].newLevel
                                : (childLevel ?? -1);

                              return (
                                <tr
                                  key={childKey}
                                  className={`
                                    bg-slate-50/50 transition-colors
                                    ${hasChildPendingChange ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-slate-100/50'}
                                  `}
                                >
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2 pl-10">
                                      <div className="w-4 h-4 border-l-2 border-b-2 border-dark-200 rounded-bl" />
                                      <div className="p-1 bg-dark-100 rounded">
                                        {getIcon(childConfig.ui_icon)}
                                      </div>
                                      <span className="text-dark-600 text-xs">
                                        {childConfig.ui_label}
                                      </span>
                                      {!hasChildLevel && effectiveChildLevel < 0 && (
                                        <span className="text-xs text-dark-400 italic">
                                          (inherits from parent)
                                        </span>
                                      )}
                                      {hasChildPendingChange && (
                                        <span className="text-xs text-amber-600">(modified)</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Child permission cells */}
                                  {PERMISSION_LEVELS.map((level) => {
                                    // Skip CREATE for child permissions
                                    if (level.value === 6) {
                                      return (
                                        <td key={level.value} className="px-1 py-2 text-center">
                                          <span className="text-xs text-dark-300">-</span>
                                        </td>
                                      );
                                    }

                                    const displayLevel = effectiveChildLevel >= 0 ? effectiveChildLevel : permission.permission;
                                    const hasPermission = displayLevel >= level.value;
                                    const isCurrentLevel = displayLevel === level.value;
                                    const canClick = !permission.is_deny && !batchUpdateMutation.isPending;
                                    const wasOriginalLevel = (childLevel ?? -1) === level.value;
                                    const isModified = hasChildPendingChange && (isCurrentLevel || wasOriginalLevel);
                                    const isInherited = !hasChildLevel && effectiveChildLevel < 0;

                                    return (
                                      <td key={level.value} className="px-1 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => canClick && handlePermissionClick(
                                            permission,
                                            level.value,
                                            true,
                                            childConfig.entity,
                                            childLevel ?? 0
                                          )}
                                          disabled={!canClick}
                                          className={`
                                            w-5 h-5 rounded flex items-center justify-center transition-all text-xs
                                            ${canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                                            ${permission.is_deny ? 'bg-red-200 text-red-400' :
                                              hasPermission
                                                ? isCurrentLevel
                                                  ? isModified
                                                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                                                    : isInherited
                                                      ? 'bg-slate-400 text-white shadow-sm opacity-60'
                                                      : `${level.color} text-white shadow-sm`
                                                  : isInherited
                                                    ? 'bg-slate-100 text-slate-400'
                                                    : 'bg-green-100 text-green-600'
                                                : isModified && wasOriginalLevel
                                                  ? 'bg-amber-100 text-amber-400 ring-1 ring-amber-300'
                                                  : 'bg-dark-100 text-dark-300 hover:bg-dark-200'
                                            }
                                          `}
                                          title={
                                            permission.is_deny
                                              ? 'DENIED'
                                              : isInherited
                                                ? `Inheriting ${level.label} from parent (click to override)`
                                                : hasPermission
                                                  ? `Has ${level.label}${isCurrentLevel ? ' (click to reduce)' : ''}`
                                                  : `Grant ${level.label}`
                                          }
                                        >
                                          {permission.is_deny ? (
                                            <LucideIcons.X className="h-3 w-3" />
                                          ) : hasPermission ? (
                                            <LucideIcons.Check className="h-3 w-3" />
                                          ) : (
                                            <span>·</span>
                                          )}
                                        </button>
                                      </td>
                                    );
                                  })}

                                  {/* Actions */}
                                  <td className="px-2 py-2 text-center">
                                    {hasChildPendingChange && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPendingChanges(prev => {
                                            const updated = { ...prev };
                                            delete updated[childKey];
                                            return updated;
                                          });
                                        }}
                                        className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                        title="Undo change"
                                      >
                                        <LucideIcons.Undo2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
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
          <div className="w-4 h-4 rounded bg-slate-400 opacity-60 flex items-center justify-center">
            <LucideIcons.Check className="h-3 w-3 text-white" />
          </div>
          <span>Inheriting from parent</span>
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
      <div className="h-10 bg-dark-100 rounded-lg animate-pulse w-64" />
      <div className="h-10 bg-dark-100 rounded-lg animate-pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border border-dark-200 rounded-xl overflow-hidden">
          <div className="h-14 bg-dark-50 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
