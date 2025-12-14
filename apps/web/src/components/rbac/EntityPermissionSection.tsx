import { useState, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import { PermissionMatrixTable } from './PermissionMatrixTable';
import type { InheritanceMode } from './InheritanceModeSelector';

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
  ownership_flag: boolean; // true=owned (cascade), false=lookup (COMMENT max)
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

interface EntityInstance {
  id: string;
  name: string;
  code?: string;
}

// Full permission config for a pending instance grant
interface PendingInstanceConfig {
  permission: number;
  inheritanceMode: InheritanceMode;
  childPermissions: Record<string, number>;
}

interface EntityPermissionSectionProps {
  entityCode: string;
  entityLabel: string;
  entityIcon?: string;
  rootLevelEntityFlag?: boolean; // true=traversal root (business, project, customer)
  childEntityCodes: ChildEntityConfig[];
  permissions: PermissionData[];
  roleId: string;
  // Pending changes tracking
  pendingPermissions: Record<string, number>;
  pendingModes: Record<string, InheritanceMode>;
  pendingChildPermissions: Record<string, Record<string, number>>;
  // Callbacks
  onPermissionChange: (permissionId: string, level: number) => void;
  onModeChange: (permissionId: string, mode: InheritanceMode) => void;
  onChildPermissionChange: (permissionId: string, childCode: string, level: number) => void;
  onRevoke: (permissionId: string) => void;
  onGrantPermission?: (entityCode: string, scope: 'all' | 'specific') => void;
  onPermissionsGranted?: () => void;
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
 * Entity Permission Section - v2.3.2
 *
 * Complete permission management section for a single entity type.
 * Features:
 * - Collapsible header with entity icon and change indicator
 * - UNIFIED permissions table: existing grants + pending grants in one cohesive view
 * - Instance picker to add new items (appears inline, adds to unified table)
 * - "All [Entity]s" type-level option merged into instance picker as first item
 * - Per-instance inheritance mode (None/Cascade/Mapped) via Settings icon
 * - Child entity permissions matrix (when Mapped mode selected)
 * - Save button appears when pending grants exist
 */
export function EntityPermissionSection({
  entityCode,
  entityLabel,
  entityIcon,
  rootLevelEntityFlag = false,
  childEntityCodes,
  permissions,
  roleId,
  pendingPermissions,
  pendingModes,
  pendingChildPermissions,
  onPermissionChange,
  onModeChange,
  onChildPermissionChange,
  onRevoke,
  onPermissionsGranted,
  disabled = false,
  defaultExpanded = false
}: EntityPermissionSectionProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Instance picker state
  const [showInstancePicker, setShowInstancePicker] = useState(false);
  const [instanceSearch, setInstanceSearch] = useState('');
  // Step 1: Checkbox selection (just IDs)
  const [checkedInstanceIds, setCheckedInstanceIds] = useState<Set<string>>(new Set());
  // Step 2: After "Select" is clicked, these become pending configs for RBAC setup
  const [selectedInstanceConfigs, setSelectedInstanceConfigs] = useState<Record<string, PendingInstanceConfig>>({});
  // Track which instance's inheritance config is expanded (for pending grants)
  const [expandedInstanceConfig, setExpandedInstanceConfig] = useState<string | null>(null);
  // Track which existing permission's inheritance config is expanded
  const [expandedExistingConfig, setExpandedExistingConfig] = useState<string | null>(null);

  // Fetch instances for this entity type
  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['entity-instances', entityCode],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/${entityCode}?limit=500&active_flag=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch instances');
      return response.json();
    },
    enabled: showInstancePicker
  });

  // Grant permissions mutation
  const grantPermissionsMutation = useMutation({
    mutationFn: async (configs: Record<string, PendingInstanceConfig>) => {
      const token = localStorage.getItem('auth_token');

      // Grant permission to each selected instance with its full config
      const results = await Promise.all(
        Object.entries(configs).map(async ([instanceId, config]) => {
          const response = await fetch(
            `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/grant-permission`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                role_id: roleId,
                entity_code: entityCode,
                entity_instance_id: instanceId,
                permission: config.permission,
                inheritance_mode: config.inheritanceMode,
                child_permissions: config.inheritanceMode === 'mapped' ? config.childPermissions : {},
                is_deny: false
              })
            }
          );
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to grant permission');
          }
          return response.json();
        })
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId] });
      setSelectedInstanceConfigs({});
      setCheckedInstanceIds(new Set());
      setExpandedInstanceConfig(null);
      setShowInstancePicker(false);
      setInstanceSearch('');
      onPermissionsGranted?.();
    }
  });

  // Separate type-level and instance-level permissions
  const typePermission = useMemo(() => {
    return permissions.find(p => p.entity_instance_id === ALL_ENTITIES_ID);
  }, [permissions]);

  const instancePermissions = useMemo(() => {
    return permissions.filter(p => p.entity_instance_id !== ALL_ENTITIES_ID);
  }, [permissions]);

  // Get IDs of instances that already have permissions (including ALL_ENTITIES_ID)
  const existingPermissionInstanceIds = useMemo(() => {
    return new Set(permissions.map(p => p.entity_instance_id));
  }, [permissions]);

  // Check if "All [Entity]s" already has permission
  const hasAllEntitiesPermission = useMemo(() => {
    return existingPermissionInstanceIds.has(ALL_ENTITIES_ID);
  }, [existingPermissionInstanceIds]);

  // Filter instances based on search and exclude already permitted ones
  const filteredInstances = useMemo(() => {
    const instances = instancesData?.data || [];
    return instances.filter((inst: EntityInstance) => {
      // Exclude instances that already have permissions
      if (existingPermissionInstanceIds.has(inst.id)) return false;

      // Filter by search
      if (!instanceSearch.trim()) return true;
      const query = instanceSearch.toLowerCase();
      return (
        inst.name?.toLowerCase().includes(query) ||
        inst.code?.toLowerCase().includes(query)
      );
    });
  }, [instancesData, instanceSearch, existingPermissionInstanceIds]);

  // Check if "All [Entity]s" matches search
  const allEntitiesMatchesSearch = useMemo(() => {
    if (!instanceSearch.trim()) return true;
    const query = instanceSearch.toLowerCase();
    const allLabel = `all ${entityLabel.toLowerCase()}s`;
    return allLabel.includes(query) || 'all'.includes(query);
  }, [instanceSearch, entityLabel]);

  // Get all instances data for lookup (including synthetic "All [Entity]s" entry)
  const instancesMap = useMemo(() => {
    const map = new Map<string, EntityInstance>();
    // Add "All [Entity]s" as a synthetic entry
    map.set(ALL_ENTITIES_ID, { id: ALL_ENTITIES_ID, name: `All ${entityLabel}s` });
    (instancesData?.data || []).forEach((inst: EntityInstance) => {
      map.set(inst.id, inst);
    });
    return map;
  }, [instancesData, entityLabel]);

  // Build rows for selected instances matrix (pending grants)
  // Sort so that "All [Entity]s" (type-level) appears first
  const selectedInstanceRows = useMemo(() => {
    const rows = Object.entries(selectedInstanceConfigs).map(([instanceId, config]) => {
      const isAllEntities = instanceId === ALL_ENTITIES_ID;
      const instance = instancesMap.get(instanceId);
      return {
        id: `pending:${instanceId}`,
        label: isAllEntities ? `All ${entityLabel}s` : (instance?.name || instanceId.slice(0, 8)),
        icon: isAllEntities ? 'Globe' : undefined,
        permission: config.permission,
        isDeny: false,
        isTypeLevel: isAllEntities,
        hasInheritanceConfig: childEntityCodes.length > 0
      };
    });
    // Sort: type-level first, then alphabetically by label
    return rows.sort((a, b) => {
      if (a.isTypeLevel && !b.isTypeLevel) return -1;
      if (!a.isTypeLevel && b.isTypeLevel) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [selectedInstanceConfigs, instancesMap, childEntityCodes, entityLabel]);

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
      icon: 'Globe',
      isTypeLevel: true,
      permission: typePermission.permission,
      isDeny: typePermission.is_deny,
      hasInheritanceConfig: childEntityCodes.length > 0
    }];
  }, [typePermission, entityLabel, childEntityCodes]);

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

  // Get pending changes for child rows (for any permission)
  const getChildPendingChanges = useCallback((permId: string) => {
    const perm = permissions.find(p => p.id === permId);
    if (!perm) return {};
    const changes: Record<string, number> = {};
    const pending = pendingChildPermissions[permId];
    if (pending) {
      Object.entries(pending).forEach(([childCode, level]) => {
        changes[`${permId}:child:${childCode}`] = level >= 0 ? level : (pendingPermissions[permId] ?? perm.permission);
      });
    }
    return changes;
  }, [permissions, pendingChildPermissions, pendingPermissions]);

  // Build child rows for any permission (by ID)
  const buildChildRowsForPermission = useCallback((permId: string) => {
    const perm = permissions.find(p => p.id === permId);
    if (!perm) return [];
    const effectiveMode = getEffectiveMode(permId, perm.inheritance_mode);
    if (effectiveMode !== 'mapped') return [];

    return childEntityCodes.map(child => {
      const originalLevel = perm.child_permissions[child.entity] ?? -1;
      const effectiveLevel = getEffectiveChildPermission(permId, child.entity, originalLevel);
      // For lookup children (ownership_flag=false), cap at COMMENT (1)
      const maxLevel = child.ownership_flag === false ? 1 : (pendingPermissions[permId] ?? perm.permission);
      const displayLevel = effectiveLevel >= 0
        ? Math.min(effectiveLevel, maxLevel)
        : maxLevel;

      return {
        id: `${permId}:child:${child.entity}`,
        label: child.ownership_flag === false ? `${child.ui_label} (lookup)` : child.ui_label,
        icon: child.ui_icon,
        permission: displayLevel,
        isDeny: false,
        isTypeLevel: false,
        hasInheritanceConfig: false,
        _childCode: child.entity,
        _inheritsParent: effectiveLevel < 0,
        _isLookup: child.ownership_flag === false,
        _maxLevel: maxLevel
      };
    });
  }, [permissions, childEntityCodes, getEffectiveMode, getEffectiveChildPermission, pendingPermissions]);

  // Get permission by ID
  const getPermissionById = useCallback((permId: string) => {
    return permissions.find(p => p.id === permId);
  }, [permissions]);

  // Toggle checkbox selection (Step 1 - just selecting, no config yet)
  const toggleInstanceCheckbox = useCallback((instanceId: string) => {
    setCheckedInstanceIds(prev => {
      const updated = new Set(prev);
      if (updated.has(instanceId)) {
        updated.delete(instanceId);
      } else {
        updated.add(instanceId);
      }
      return updated;
    });
  }, []);

  // Handle "Add" button click - add checked items to pending configs (unified table)
  const handleConfirmSelection = useCallback(() => {
    // Convert checked IDs to configs with default values, merge with existing
    setSelectedInstanceConfigs(prev => {
      const updated = { ...prev };
      checkedInstanceIds.forEach(id => {
        // Only add if not already in pending
        if (!updated[id]) {
          updated[id] = {
            permission: 3, // Default to EDIT
            inheritanceMode: 'none',
            childPermissions: {}
          };
        }
      });
      return updated;
    });
    setCheckedInstanceIds(new Set()); // Clear checkboxes
  }, [checkedInstanceIds]);

  // Handle permission level change for pending instance
  const handlePendingInstancePermissionChange = useCallback((rowId: string, level: number) => {
    // rowId format: "pending:{instanceId}"
    const instanceId = rowId.replace('pending:', '');
    setSelectedInstanceConfigs(prev => ({
      ...prev,
      [instanceId]: {
        ...prev[instanceId],
        permission: level
      }
    }));
  }, []);

  // Handle inheritance mode change for pending instance
  const handlePendingInstanceModeChange = useCallback((instanceId: string, mode: InheritanceMode) => {
    setSelectedInstanceConfigs(prev => ({
      ...prev,
      [instanceId]: {
        ...prev[instanceId],
        inheritanceMode: mode,
        // Clear child permissions if switching away from mapped
        childPermissions: mode === 'mapped' ? prev[instanceId]?.childPermissions || {} : {}
      }
    }));
  }, []);

  // Handle child permission change for pending instance
  const handlePendingInstanceChildPermissionChange = useCallback((instanceId: string, childCode: string, level: number) => {
    setSelectedInstanceConfigs(prev => ({
      ...prev,
      [instanceId]: {
        ...prev[instanceId],
        childPermissions: {
          ...prev[instanceId]?.childPermissions,
          [childCode]: level
        }
      }
    }));
  }, []);

  // Remove instance from selection (used as "revoke" in the matrix)
  const handleRemovePendingInstance = useCallback((rowId: string) => {
    const instanceId = rowId.replace('pending:', '');
    setSelectedInstanceConfigs(prev => {
      const updated = { ...prev };
      delete updated[instanceId];
      return updated;
    });
    if (expandedInstanceConfig === instanceId.replace('pending:', '')) {
      setExpandedInstanceConfig(null);
    }
  }, [expandedInstanceConfig]);

  // Handle grant permissions
  const handleGrantPermissions = useCallback(() => {
    if (Object.keys(selectedInstanceConfigs).length === 0) return;
    grantPermissionsMutation.mutate(selectedInstanceConfigs);
  }, [selectedInstanceConfigs, grantPermissionsMutation]);

  const totalPermissions = permissions.length;
  const checkedCount = checkedInstanceIds.size;
  const selectedCount = Object.keys(selectedInstanceConfigs).length;

  // Count available items in picker (All Entities + filtered instances)
  const availableItemsCount = (hasAllEntitiesPermission || !allEntitiesMatchesSearch ? 0 : 1) + filteredInstances.length;

  // Build child rows for a pending instance
  const buildPendingChildRows = useCallback((instanceId: string, config: PendingInstanceConfig) => {
    return childEntityCodes.map(child => {
      const level = config.childPermissions[child.entity] ?? -1;
      // For lookup children (ownership_flag=false), cap at COMMENT (1)
      const maxLevel = child.ownership_flag === false ? 1 : config.permission;
      // If -1, inherit from parent (but still capped for lookup)
      const displayLevel = level >= 0 ? Math.min(level, maxLevel) : maxLevel;

      return {
        id: `pending:${instanceId}:child:${child.entity}`,
        label: child.ownership_flag === false ? `${child.ui_label} (lookup)` : child.ui_label,
        icon: child.ui_icon,
        permission: displayLevel,
        isDeny: false,
        isTypeLevel: false,
        hasInheritanceConfig: false,
        _childCode: child.entity,
        _inheritsParent: level < 0,
        _isLookup: child.ownership_flag === false,
        _maxLevel: maxLevel
      };
    });
  }, [childEntityCodes]);

  return (
    <div className="bg-white rounded-lg border border-dark-200 overflow-hidden">
      {/* Entity Header - Minimal */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-dark-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-dark-500">
            {getIcon(entityIcon, 'h-4 w-4')}
          </div>
          <span className="text-sm font-medium text-dark-800">
            {entityLabel}
          </span>
          {rootLevelEntityFlag && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium bg-dark-100 text-dark-600 rounded"
              title="Root entity - traversal boundary for permission inheritance"
            >
              ROOT
            </span>
          )}
          <span className="text-xs text-dark-400">
            {totalPermissions}
          </span>
          {hasChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
          )}
        </div>
        <LucideIcons.ChevronRight className={`h-4 w-4 text-dark-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-dark-100">
          {/* UNIFIED PERMISSIONS VIEW - Existing grants + Pending grants in one table */}
          {(permissions.length > 0 || selectedCount > 0) && (
            <div className="rounded-lg border border-dark-200 overflow-hidden">
              {/* Minimal header - only show when pending */}
              {selectedCount > 0 && (
                <div className="px-3 py-2 bg-dark-50 border-b border-dark-100 flex items-center justify-between">
                  <span className="text-xs text-dark-500">
                    {selectedCount} pending
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedInstanceConfigs({});
                        setExpandedInstanceConfig(null);
                      }}
                      className="text-xs text-dark-500 hover:text-dark-700"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleGrantPermissions}
                      disabled={grantPermissionsMutation.isPending}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {grantPermissionsMutation.isPending ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                      ) : (
                        <LucideIcons.Check className="h-3 w-3" />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {grantPermissionsMutation.isError && (
                <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-center gap-2">
                  <LucideIcons.AlertCircle className="h-3.5 w-3.5" />
                  {(grantPermissionsMutation.error as Error).message}
                </div>
              )}

              {/* Unified matrix table - existing + pending rows together */}
              <div className="p-2">
                <PermissionMatrixTable
                  rows={[
                    // Existing type-level permissions first
                    ...typeLevelRows,
                    // Pending type-level permissions (if "All [Entity]s" is being added)
                    ...selectedInstanceRows.filter(r => r.isTypeLevel),
                    // Existing instance-level permissions
                    ...instanceRows,
                    // Pending instance-level permissions
                    ...selectedInstanceRows.filter(r => !r.isTypeLevel)
                  ]}
                  pendingChanges={pendingPermissions}
                  onPermissionChange={(rowId, level) => {
                    // Route to appropriate handler based on row ID
                    if (rowId.startsWith('pending:')) {
                      handlePendingInstancePermissionChange(rowId, level);
                    } else {
                      onPermissionChange(rowId, level);
                    }
                  }}
                  onRevoke={(rowId) => {
                    if (rowId.startsWith('pending:')) {
                      handleRemovePendingInstance(rowId);
                    } else {
                      onRevoke(rowId);
                    }
                  }}
                  onConfigureInheritance={childEntityCodes.length > 0 ? (id) => {
                    if (id.startsWith('pending:')) {
                      const instanceId = id.replace('pending:', '');
                      setExpandedInstanceConfig(prev => prev === instanceId ? null : instanceId);
                      setExpandedExistingConfig(null);
                    } else {
                      setExpandedExistingConfig(prev => prev === id ? null : id);
                      setExpandedInstanceConfig(null);
                    }
                  } : undefined}
                  expandedConfigId={expandedExistingConfig || (expandedInstanceConfig ? `pending:${expandedInstanceConfig}` : null)}
                  disabled={disabled || grantPermissionsMutation.isPending}
                />
              </div>

              {/* Inline Inheritance Config for EXISTING expanded permission - Compact */}
              {expandedExistingConfig && childEntityCodes.length > 0 && (() => {
                const perm = getPermissionById(expandedExistingConfig);
                if (!perm) return null;
                const effectiveMode = getEffectiveMode(perm.id, perm.inheritance_mode);
                const isModified = pendingModes[perm.id] !== undefined;

                return (
                  <div className="mx-2 mb-2 border border-dark-200 rounded-lg overflow-hidden bg-white">
                    <div className="px-3 py-2 border-b border-dark-100 flex items-center justify-between bg-dark-50/50">
                      <span className="text-xs font-medium text-dark-600">Inheritance Mode</span>
                      <button
                        type="button"
                        onClick={() => setExpandedExistingConfig(null)}
                        className="p-0.5 text-dark-400 hover:text-dark-600 rounded"
                      >
                        <LucideIcons.X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-2">
                      {/* Compact mode selector */}
                      <div className="flex gap-1 p-0.5 bg-dark-100 rounded-lg">
                        {(['none', 'cascade', 'mapped'] as InheritanceMode[]).map((mode) => {
                          const isSelected = effectiveMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => onModeChange(perm.id, mode)}
                              disabled={disabled || perm.is_deny}
                              className={`
                                flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all
                                ${isSelected
                                  ? 'bg-white text-dark-800 shadow-sm'
                                  : 'text-dark-500 hover:text-dark-700'
                                }
                                ${isModified && isSelected ? 'ring-1 ring-amber-400' : ''}
                              `}
                            >
                              {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Cascade Summary - Compact */}
                      {effectiveMode === 'cascade' && (
                        <div className="mt-2 px-2 py-1.5 bg-dark-50 rounded text-xs text-dark-600">
                          <span className="font-medium">Owned</span> children inherit full permission, <span className="font-medium">Lookup</span> children max COMMENT
                        </div>
                      )}

                      {/* Mapped Child Permissions - Compact */}
                      {effectiveMode === 'mapped' && (
                        <div className="mt-2">
                          <PermissionMatrixTable
                            rows={buildChildRowsForPermission(perm.id)}
                            pendingChanges={getChildPendingChanges(perm.id)}
                            onPermissionChange={handleChildPermissionChange}
                            onUndo={(rowId) => {
                              const parts = rowId.split(':child:');
                              if (parts.length === 2) {
                                onChildPermissionChange(parts[0], parts[1], -1);
                              }
                            }}
                            disabled={disabled}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Inline Inheritance Config for PENDING expanded instance - Compact */}
              {expandedInstanceConfig && selectedInstanceConfigs[expandedInstanceConfig] && childEntityCodes.length > 0 && (
                <div className="mx-2 mb-2 border border-dark-200 rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-2 border-b border-dark-100 flex items-center justify-between bg-dark-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark-600">Inheritance Mode</span>
                      <span className="px-1 py-0.5 text-[9px] font-medium bg-emerald-100 text-emerald-600 rounded">
                        pending
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedInstanceConfig(null)}
                      className="p-0.5 text-dark-400 hover:text-dark-600 rounded"
                    >
                      <LucideIcons.X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="p-2">
                    {/* Compact mode selector */}
                    <div className="flex gap-1 p-0.5 bg-dark-100 rounded-lg">
                      {(['none', 'cascade', 'mapped'] as InheritanceMode[]).map((mode) => {
                        const config = selectedInstanceConfigs[expandedInstanceConfig];
                        const isSelected = config?.inheritanceMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handlePendingInstanceModeChange(expandedInstanceConfig, mode)}
                            disabled={grantPermissionsMutation.isPending}
                            className={`
                              flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all
                              ${isSelected
                                ? 'bg-white text-dark-800 shadow-sm'
                                : 'text-dark-500 hover:text-dark-700'
                              }
                            `}
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Cascade Summary - Compact */}
                    {selectedInstanceConfigs[expandedInstanceConfig]?.inheritanceMode === 'cascade' && (
                      <div className="mt-2 px-2 py-1.5 bg-dark-50 rounded text-xs text-dark-600">
                        <span className="font-medium">Owned</span> children inherit full permission, <span className="font-medium">Lookup</span> children max COMMENT
                      </div>
                    )}

                    {/* Mapped Child Permissions - Compact */}
                    {selectedInstanceConfigs[expandedInstanceConfig]?.inheritanceMode === 'mapped' && (
                      <div className="mt-2">
                        <PermissionMatrixTable
                          rows={buildPendingChildRows(expandedInstanceConfig, selectedInstanceConfigs[expandedInstanceConfig])}
                          pendingChanges={{}}
                          onPermissionChange={(rowId, level) => {
                            const match = rowId.match(/^pending:([^:]+):child:(.+)$/);
                            if (match) {
                              handlePendingInstanceChildPermissionChange(match[1], match[2], level);
                            }
                          }}
                          disabled={grantPermissionsMutation.isPending}
                          compact
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GRANT PERMISSION - Compact Instance Picker */}
          {showInstancePicker ? (
            <div className="rounded-lg border border-dark-200 overflow-hidden">
              {/* Compact Header with Search */}
              <div className="px-3 py-2 bg-dark-50 border-b border-dark-100 flex items-center gap-2">
                <LucideIcons.Search className="h-3.5 w-3.5 text-dark-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={`Search ${entityLabel.toLowerCase()}s...`}
                  value={instanceSearch}
                  onChange={(e) => setInstanceSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm border-none focus:outline-none placeholder:text-dark-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowInstancePicker(false);
                    setCheckedInstanceIds(new Set());
                    setInstanceSearch('');
                  }}
                  className="p-1 text-dark-400 hover:text-dark-600 rounded"
                >
                  <LucideIcons.X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Instance List - Compact */}
              <div className="max-h-48 overflow-y-auto">
                {instancesLoading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-dark-400 mx-auto" />
                  </div>
                ) : availableItemsCount === 0 ? (
                  <div className="p-4 text-center text-xs text-dark-400">
                    {instanceSearch ? 'No matches' : 'No items available'}
                  </div>
                ) : (
                  <div className="divide-y divide-dark-100">
                    {/* "All [Entity]s" option */}
                    {!hasAllEntitiesPermission && allEntitiesMatchesSearch && (
                      <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        checkedInstanceIds.has(ALL_ENTITIES_ID) ? 'bg-slate-100' : 'hover:bg-dark-50'
                      }`}>
                        <input
                          type="checkbox"
                          checked={checkedInstanceIds.has(ALL_ENTITIES_ID)}
                          onChange={() => toggleInstanceCheckbox(ALL_ENTITIES_ID)}
                          className="w-3.5 h-3.5 text-slate-600 rounded border-dark-300"
                        />
                        <LucideIcons.Globe className="h-3.5 w-3.5 text-dark-500" />
                        <span className="text-xs font-medium text-dark-700">All {entityLabel}s</span>
                        <span className="text-[10px] text-dark-400 ml-auto">type-level</span>
                      </label>
                    )}

                    {/* Specific instances */}
                    {filteredInstances.map((instance: EntityInstance) => (
                      <label
                        key={instance.id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                          checkedInstanceIds.has(instance.id) ? 'bg-slate-100' : 'hover:bg-dark-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checkedInstanceIds.has(instance.id)}
                          onChange={() => toggleInstanceCheckbox(instance.id)}
                          className="w-3.5 h-3.5 text-slate-600 rounded border-dark-300"
                        />
                        <span className="text-xs text-dark-700 truncate flex-1">{instance.name}</span>
                        {instance.code && (
                          <span className="text-[10px] text-dark-400 font-mono">{instance.code}</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Compact Footer */}
              {checkedCount > 0 && (
                <div className="px-3 py-2 bg-dark-50 border-t border-dark-100 flex items-center justify-between">
                  <span className="text-xs text-dark-500">{checkedCount} selected</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleConfirmSelection();
                      setShowInstancePicker(false);
                      setInstanceSearch('');
                    }}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Grant Permission Button - Minimal */
            <button
              type="button"
              onClick={() => setShowInstancePicker(true)}
              className="w-full px-3 py-2 text-xs font-medium text-dark-500 hover:text-dark-700 hover:bg-dark-50 border border-dashed border-dark-200 hover:border-dark-300 rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <LucideIcons.Plus className="h-3.5 w-3.5" />
              Add Permission
            </button>
          )}
        </div>
      )}
    </div>
  );
}
