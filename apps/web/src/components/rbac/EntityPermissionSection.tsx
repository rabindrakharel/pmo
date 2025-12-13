import React, { useState, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';
import { PermissionMatrixTable } from './PermissionMatrixTable';
import { InheritanceMode } from './InheritanceModeSelector';
import { getPermissionLabel, PERMISSION_LEVELS } from './PermissionLevelSelector';

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
  onGrantPermission: (entityCode: string, scope: 'all' | 'specific') => void;
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
  onGrantPermission,
  onPermissionsGranted,
  disabled = false,
  defaultExpanded = true
}: EntityPermissionSectionProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [specificExpanded, setSpecificExpanded] = useState(true);

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
  // Track if we're in "configure" mode (after Select button clicked)
  const [isConfiguringPermissions, setIsConfiguringPermissions] = useState(false);

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
      setIsConfiguringPermissions(false);
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

  // Toggle inheritance config expansion for an instance
  const handleConfigureInheritance = useCallback((rowId: string) => {
    const instanceId = rowId.replace('pending:', '');
    setExpandedInstanceConfig(prev => prev === instanceId ? null : instanceId);
  }, []);

  // Select/deselect all visible instances (Step 1 - checkboxes) - includes "All [Entity]s"
  const toggleAllVisibleCheckboxes = useCallback(() => {
    // Build list of all visible IDs (including ALL_ENTITIES_ID if shown)
    const visibleIds: string[] = [];
    if (!hasAllEntitiesPermission && allEntitiesMatchesSearch) {
      visibleIds.push(ALL_ENTITIES_ID);
    }
    filteredInstances.forEach((i: EntityInstance) => visibleIds.push(i.id));

    const allChecked = visibleIds.length > 0 && visibleIds.every((id: string) => checkedInstanceIds.has(id));

    if (allChecked) {
      // Deselect all visible
      setCheckedInstanceIds(prev => {
        const updated = new Set(prev);
        visibleIds.forEach((id: string) => updated.delete(id));
        return updated;
      });
    } else {
      // Select all visible
      setCheckedInstanceIds(prev => {
        const updated = new Set(prev);
        visibleIds.forEach((id: string) => updated.add(id));
        return updated;
      });
    }
  }, [filteredInstances, checkedInstanceIds, hasAllEntitiesPermission, allEntitiesMatchesSearch]);

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
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {entityLabel} Access
              </span>
              {rootLevelEntityFlag && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1"
                  title="Root entity - traversal boundary for permission inheritance"
                >
                  <LucideIcons.Anchor className="h-3 w-3" />
                  ROOT
                </span>
              )}
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
          {/* UNIFIED PERMISSIONS VIEW - Existing grants + Pending grants in one table */}
          {(permissions.length > 0 || selectedCount > 0) && (
            <div className="bg-white rounded-lg border border-dark-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-dark-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LucideIcons.Shield className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-semibold text-slate-700">Permissions</span>
                    <span className="text-xs text-dark-400">
                      ({permissions.length} granted{selectedCount > 0 ? `, ${selectedCount} pending` : ''})
                    </span>
                  </div>
                  {selectedCount > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInstanceConfigs({});
                          setExpandedInstanceConfig(null);
                          setIsConfiguringPermissions(false);
                        }}
                        className="px-2 py-1 text-xs text-dark-500 hover:text-dark-700 hover:bg-dark-100 rounded transition-colors"
                      >
                        Clear Pending
                      </button>
                      <button
                        type="button"
                        onClick={handleGrantPermissions}
                        disabled={grantPermissionsMutation.isPending}
                        className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {grantPermissionsMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <LucideIcons.Save className="h-3 w-3" />
                            Save ({selectedCount})
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {grantPermissionsMutation.isError && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 flex items-center gap-2">
                  <LucideIcons.AlertCircle className="h-4 w-4" />
                  {(grantPermissionsMutation.error as Error).message}
                </div>
              )}

              {/* Unified matrix table - existing + pending rows together */}
              <div className="p-3">
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

              {/* Inline Inheritance Config for EXISTING expanded permission */}
              {expandedExistingConfig && childEntityCodes.length > 0 && (() => {
                const perm = getPermissionById(expandedExistingConfig);
                if (!perm) return null;
                const effectiveMode = getEffectiveMode(perm.id, perm.inheritance_mode);
                const isModified = pendingModes[perm.id] !== undefined;
                const isTypeLevel = perm.entity_instance_id === ALL_ENTITIES_ID;
                const permLabel = isTypeLevel ? `All ${entityLabel}s` : (perm.entity_instance_name || perm.entity_instance_id.slice(0, 8));

                return (
                  <div className="mx-3 mb-3 bg-dark-50 border border-dark-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-dark-100 border-b border-dark-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LucideIcons.Settings className="h-4 w-4 text-dark-600" />
                        <span className="text-sm font-semibold text-dark-700">
                          Inheritance: {permLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedExistingConfig(null)}
                        className="p-1 text-dark-400 hover:text-dark-600 rounded"
                      >
                        <LucideIcons.X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-3">
                      <div className="text-xs font-medium text-dark-600 mb-2">
                        Inheritance to Child Entities:
                      </div>
                      <div className="flex gap-2">
                        {(['none', 'cascade', 'mapped'] as InheritanceMode[]).map((mode) => {
                          const isSelected = effectiveMode === mode;

                          const modeConfig = {
                            none: { icon: LucideIcons.Circle, label: 'None' },
                            cascade: { icon: LucideIcons.ArrowDownCircle, label: 'Cascade' },
                            mapped: { icon: LucideIcons.GitBranch, label: 'Mapped' }
                          }[mode];

                          const Icon = modeConfig.icon;

                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => onModeChange(perm.id, mode)}
                              disabled={disabled || perm.is_deny}
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
                                ${(disabled || perm.is_deny) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
                      {effectiveMode === 'cascade' && (
                        <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-violet-700">
                            <LucideIcons.ArrowDownCircle className="h-4 w-4" />
                            <span>
                              Child types inherit based on ownership
                            </span>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {/* Owned children (full cascade) */}
                            {childEntityCodes.filter(c => c.ownership_flag !== false).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-xs text-violet-600 font-medium w-16">Owned:</span>
                                {childEntityCodes.filter(c => c.ownership_flag !== false).map(child => (
                                  <span
                                    key={child.entity}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-600 text-xs rounded"
                                    title={`Inherits full ${getPermissionLabel(pendingPermissions[perm.id] ?? perm.permission)} permission`}
                                  >
                                    {getIcon(child.ui_icon, 'h-3 w-3')}
                                    {child.ui_label}
                                    <span className="text-violet-400">→ {getPermissionLabel(pendingPermissions[perm.id] ?? perm.permission)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Lookup children (COMMENT max) */}
                            {childEntityCodes.filter(c => c.ownership_flag === false).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-xs text-amber-600 font-medium w-16">Lookup:</span>
                                {childEntityCodes.filter(c => c.ownership_flag === false).map(child => (
                                  <span
                                    key={child.entity}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded"
                                    title="Lookup relationship - max COMMENT permission (traversal stops)"
                                  >
                                    {getIcon(child.ui_icon, 'h-3 w-3')}
                                    {child.ui_label}
                                    <span className="text-amber-400">→ Comment</span>
                                    <LucideIcons.Link2 className="h-3 w-3 text-amber-400" />
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Mapped Child Permissions Table */}
                      {effectiveMode === 'mapped' && (
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Inline Inheritance Config for PENDING expanded instance */}
              {expandedInstanceConfig && selectedInstanceConfigs[expandedInstanceConfig] && childEntityCodes.length > 0 && (
                <div className="mx-3 mb-3 bg-emerald-50 border border-emerald-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-emerald-100 border-b border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LucideIcons.Settings className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-700">
                        Inheritance: {instancesMap.get(expandedInstanceConfig)?.name || expandedInstanceConfig}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-200 text-emerald-700 rounded">
                        pending
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedInstanceConfig(null)}
                      className="p-1 text-emerald-500 hover:text-emerald-700 rounded"
                    >
                      <LucideIcons.X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-3">
                    <div className="text-xs font-medium text-emerald-700 mb-2">
                      Inheritance to Child Entities:
                    </div>
                    <div className="flex gap-2">
                      {(['none', 'cascade', 'mapped'] as InheritanceMode[]).map((mode) => {
                        const config = selectedInstanceConfigs[expandedInstanceConfig];
                        const isSelected = config?.inheritanceMode === mode;

                        const modeConfig = {
                          none: { icon: LucideIcons.Circle, label: 'None' },
                          cascade: { icon: LucideIcons.ArrowDownCircle, label: 'Cascade' },
                          mapped: { icon: LucideIcons.GitBranch, label: 'Mapped' }
                        }[mode];

                        const Icon = modeConfig.icon;

                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handlePendingInstanceModeChange(expandedInstanceConfig, mode)}
                            disabled={grantPermissionsMutation.isPending}
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
                            `}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="font-medium">{modeConfig.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Cascade Summary for pending instance */}
                    {selectedInstanceConfigs[expandedInstanceConfig]?.inheritanceMode === 'cascade' && (
                      <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-violet-700">
                          <LucideIcons.ArrowDownCircle className="h-4 w-4" />
                          <span>
                            Child types inherit based on ownership
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {/* Owned children (full cascade) */}
                          {childEntityCodes.filter(c => c.ownership_flag !== false).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs text-violet-600 font-medium w-16">Owned:</span>
                              {childEntityCodes.filter(c => c.ownership_flag !== false).map(child => (
                                <span
                                  key={child.entity}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-600 text-xs rounded"
                                  title={`Inherits full ${getPermissionLabel(selectedInstanceConfigs[expandedInstanceConfig]?.permission || 0)} permission`}
                                >
                                  {getIcon(child.ui_icon, 'h-3 w-3')}
                                  {child.ui_label}
                                  <span className="text-violet-400">→ {getPermissionLabel(selectedInstanceConfigs[expandedInstanceConfig]?.permission || 0)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Lookup children (COMMENT max) */}
                          {childEntityCodes.filter(c => c.ownership_flag === false).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs text-amber-600 font-medium w-16">Lookup:</span>
                              {childEntityCodes.filter(c => c.ownership_flag === false).map(child => (
                                <span
                                  key={child.entity}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded"
                                  title="Lookup relationship - max COMMENT permission (traversal stops)"
                                >
                                  {getIcon(child.ui_icon, 'h-3 w-3')}
                                  {child.ui_label}
                                  <span className="text-amber-400">→ Comment</span>
                                  <LucideIcons.Link2 className="h-3 w-3 text-amber-400" />
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mapped Child Permissions for pending instance */}
                    {selectedInstanceConfigs[expandedInstanceConfig]?.inheritanceMode === 'mapped' && (
                      <div className="mt-3 bg-cyan-50 border border-cyan-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-cyan-200 bg-cyan-100/50">
                          <div className="flex items-center gap-2 text-sm font-medium text-cyan-700">
                            <LucideIcons.GitBranch className="h-4 w-4" />
                            <span>Child Entity Permissions</span>
                          </div>
                        </div>
                        <div className="p-2">
                          <PermissionMatrixTable
                            rows={buildPendingChildRows(expandedInstanceConfig, selectedInstanceConfigs[expandedInstanceConfig])}
                            pendingChanges={{}}
                            onPermissionChange={(rowId, level) => {
                              // rowId format: "pending:{instanceId}:child:{childCode}"
                              const match = rowId.match(/^pending:([^:]+):child:(.+)$/);
                              if (match) {
                                handlePendingInstanceChildPermissionChange(match[1], match[2], level);
                              }
                            }}
                            disabled={grantPermissionsMutation.isPending}
                            compact
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GRANT PERMISSION FLOW - Instance Selection Only (Step 1) */}
          {showInstancePicker ? (
            <div className="bg-white rounded-lg border border-blue-300 overflow-hidden shadow-sm">
              {/* STEP 1: Instance Selection (when NOT configuring) */}
              {!isConfiguringPermissions ? (
                <>
                  {/* Picker Header */}
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LucideIcons.ListChecks className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-700">
                        Step 1: Select {entityLabel}s
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInstancePicker(false);
                        setCheckedInstanceIds(new Set());
                        setInstanceSearch('');
                      }}
                      className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <LucideIcons.X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="p-3 border-b border-dark-100">
                    <div className="relative">
                      <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                      <input
                        type="text"
                        placeholder={`Search ${entityLabel.toLowerCase()}s...`}
                        value={instanceSearch}
                        onChange={(e) => setInstanceSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Instance List with Checkboxes */}
                  <div className="max-h-64 overflow-y-auto">
                    {instancesLoading ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                        <p className="text-sm text-dark-500 mt-2">Loading {entityLabel.toLowerCase()}s...</p>
                      </div>
                    ) : availableItemsCount === 0 ? (
                      <div className="p-6 text-center text-dark-500">
                        <LucideIcons.SearchX className="h-6 w-6 mx-auto text-dark-300 mb-2" />
                        <p className="text-sm">
                          {instanceSearch ? `No ${entityLabel.toLowerCase()}s match your search` : `No ${entityLabel.toLowerCase()}s available`}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Select All Header */}
                        <div className="px-4 py-2 bg-dark-50 border-b border-dark-100 sticky top-0">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={availableItemsCount > 0 && (() => {
                                const allIds: string[] = [];
                                if (!hasAllEntitiesPermission && allEntitiesMatchesSearch) allIds.push(ALL_ENTITIES_ID);
                                filteredInstances.forEach((i: EntityInstance) => allIds.push(i.id));
                                return allIds.every(id => checkedInstanceIds.has(id));
                              })()}
                              onChange={toggleAllVisibleCheckboxes}
                              className="w-4 h-4 text-blue-600 rounded border-dark-300 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-dark-600">
                              Select all ({availableItemsCount})
                            </span>
                          </label>
                        </div>

                        {/* Instance Items - "All [Entity]s" first, then specific instances */}
                        <div className="divide-y divide-dark-100">
                          {/* "All [Entity]s" option - shown first if no permission exists */}
                          {!hasAllEntitiesPermission && allEntitiesMatchesSearch && (
                            <label
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                checkedInstanceIds.has(ALL_ENTITIES_ID) ? 'bg-emerald-50' : 'hover:bg-dark-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checkedInstanceIds.has(ALL_ENTITIES_ID)}
                                onChange={() => toggleInstanceCheckbox(ALL_ENTITIES_ID)}
                                className="w-4 h-4 text-emerald-600 rounded border-dark-300 focus:ring-emerald-500"
                              />
                              <div className="p-1.5 bg-emerald-100 rounded">
                                <LucideIcons.Globe className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-emerald-700">
                                  All {entityLabel}s
                                </div>
                                <div className="text-xs text-emerald-500">
                                  Type-level permission
                                </div>
                              </div>
                            </label>
                          )}

                          {/* Specific instance items */}
                          {filteredInstances.map((instance: EntityInstance) => (
                            <label
                              key={instance.id}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                                checkedInstanceIds.has(instance.id) ? 'bg-blue-50' : 'hover:bg-dark-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checkedInstanceIds.has(instance.id)}
                                onChange={() => toggleInstanceCheckbox(instance.id)}
                                className="w-4 h-4 text-blue-600 rounded border-dark-300 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-dark-800 truncate">
                                  {instance.name}
                                </div>
                                {instance.code && (
                                  <div className="text-xs text-dark-500 truncate">
                                    {instance.code}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer with Add Button - adds to unified table above */}
                  <div className="px-4 py-3 bg-dark-50 border-t border-dark-100 flex items-center justify-between">
                    <span className="text-xs text-dark-500">
                      {checkedCount > 0
                        ? `${checkedCount} item${checkedCount !== 1 ? 's' : ''} selected`
                        : 'Select items to add to permissions'
                      }
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInstancePicker(false);
                          setCheckedInstanceIds(new Set());
                          setInstanceSearch('');
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Add checked items to pending configs and close picker
                          handleConfirmSelection();
                          setShowInstancePicker(false);
                          setInstanceSearch('');
                        }}
                        disabled={checkedCount === 0}
                        className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <LucideIcons.Plus className="h-4 w-4" />
                        Add ({checkedCount})
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            /* Grant Permission Button */
            <button
              type="button"
              onClick={() => setShowInstancePicker(true)}
              className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <LucideIcons.Plus className="h-4 w-4" />
              Grant Permission to {entityLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
