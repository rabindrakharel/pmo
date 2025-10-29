import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  Plus,
  X,
  Check,
  Search,
  AlertCircle,
  MapPin,
  Building2,
  Building,
  FolderOpen,
  CheckSquare,
  Users,
  Shield,
  BookOpen,
  FileText,
  Database
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../button/Button';

// ============================================================================
// TYPES & CONFIGURATION
// ============================================================================

type LinkageMode = 'assign-parent' | 'manage-children';

// Entity types with their display labels and icons
const entityTypes = [
  { value: 'office', label: 'Office', IconComponent: MapPin },
  { value: 'business', label: 'Business', IconComponent: Building2 },
  { value: 'client', label: 'Client', IconComponent: Building },
  { value: 'project', label: 'Project', IconComponent: FolderOpen },
  { value: 'task', label: 'Task', IconComponent: CheckSquare },
  { value: 'worksite', label: 'Worksite', IconComponent: MapPin },
  { value: 'employee', label: 'Employee', IconComponent: Users },
  { value: 'role', label: 'Role', IconComponent: Shield },
  { value: 'wiki', label: 'Wiki', IconComponent: BookOpen },
  { value: 'artifact', label: 'Artifact', IconComponent: FileText },
  { value: 'form', label: 'Form', IconComponent: FileText }
];

// Helper to get entity label from value
const getEntityLabel = (type: string) => {
  const entity = entityTypes.find(e => e.value === type);
  return entity?.label || type.charAt(0).toUpperCase() + type.slice(1);
};

// Helper to get entity icon component
const getEntityIconComponent = (type: string) => {
  const entity = entityTypes.find(e => e.value === type);
  return entity?.IconComponent || Database;
};

// Helper to map entity types to API endpoints
const getApiEndpoint = (entityType: string): string => {
  if (entityType === 'business') return 'biz';
  if (entityType === 'client') return 'cust';
  return entityType;
};

interface UnifiedLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: LinkageMode;

  // For "assign-parent" mode: specify the child entity
  childEntityType?: string;
  childEntityId?: string;
  childEntityName?: string;

  // For "manage-children" mode: specify the parent entity
  parentEntityType?: string;
  parentEntityId?: string;
  parentEntityName?: string;

  // Optional: restrict which entity types can be linked
  allowedEntityTypes?: string[];

  // Callback when linkage changes
  onLinkageChange?: () => void;
}

interface EntityInstance {
  id: string;
  name: string;
  code?: string;
  descr?: string;
}

interface Linkage {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type: string;
  active_flag: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const UnifiedLinkageModal: React.FC<UnifiedLinkageModalProps> = ({
  isOpen,
  onClose,
  mode,
  childEntityType,
  childEntityId,
  childEntityName,
  parentEntityType,
  parentEntityId,
  parentEntityName,
  allowedEntityTypes,
  onLinkageChange
}) => {
  // State
  const [availableEntities, setAvailableEntities] = useState<EntityInstance[]>([]);
  const [existingLinkages, setExistingLinkages] = useState<Linkage[]>([]);
  const [validEntityTypes, setValidEntityTypes] = useState<string[]>([]);
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('auth_token');

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (isOpen) {
      initializeModal();
    } else {
      resetState();
    }
  }, [isOpen, mode, childEntityId, parentEntityId]);

  useEffect(() => {
    if (selectedEntityType) {
      loadAvailableEntities();
    }
  }, [selectedEntityType]);

  const initializeModal = async () => {
    setError(null);
    setSuccess(null);
    await loadValidEntityTypes();
    await loadExistingLinkages();
  };

  const resetState = () => {
    setAvailableEntities([]);
    setExistingLinkages([]);
    setValidEntityTypes([]);
    setSelectedEntityType('');
    setSearchQuery('');
    setError(null);
    setSuccess(null);
  };

  // ============================================================================
  // LOAD VALID ENTITY TYPES
  // ============================================================================

  const loadValidEntityTypes = async () => {
    try {
      if (mode === 'assign-parent' && childEntityType) {
        // Get valid parent types for this child
        const response = await fetch(
          `${apiUrl}/api/v1/linkage/parents/${childEntityType}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          const types = data.data || [];
          const filtered = allowedEntityTypes
            ? types.filter((t: string) => allowedEntityTypes.includes(t))
            : types;
          setValidEntityTypes(filtered);
          if (filtered.length > 0) setSelectedEntityType(filtered[0]);
        }
      } else if (mode === 'manage-children' && parentEntityType) {
        // Get valid child types for this parent
        const response = await fetch(
          `${apiUrl}/api/v1/linkage/children/${parentEntityType}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          const types = data.data || [];
          const filtered = allowedEntityTypes
            ? types.filter((t: string) => allowedEntityTypes.includes(t))
            : types;
          setValidEntityTypes(filtered);
          if (filtered.length > 0) setSelectedEntityType(filtered[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load valid entity types:', err);
      setError('Failed to load valid entity types');
    }
  };

  // ============================================================================
  // LOAD EXISTING LINKAGES
  // ============================================================================

  const loadExistingLinkages = async () => {
    try {
      let url = `${apiUrl}/api/v1/linkage?`;

      if (mode === 'assign-parent' && childEntityType && childEntityId) {
        // Get all linkages where this entity is the child
        url += `child_entity_type=${childEntityType}&child_entity_id=${childEntityId}`;
      } else if (mode === 'manage-children' && parentEntityType && parentEntityId) {
        // Get all linkages where this entity is the parent
        url += `parent_entity_type=${parentEntityType}&parent_entity_id=${parentEntityId}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setExistingLinkages(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load existing linkages:', err);
    }
  };

  // ============================================================================
  // LOAD AVAILABLE ENTITIES
  // ============================================================================

  const loadAvailableEntities = async () => {
    setLoading(true);
    try {
      const endpoint = getApiEndpoint(selectedEntityType);
      const response = await fetch(
        `${apiUrl}/api/v1/${endpoint}?limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const entities = (data.data || data.results || []).map((e: any) => ({
          id: e.id,
          name: e.name || e.title || e.email || 'Unnamed',
          code: e.code,
          descr: e.descr || e.description
        }));
        setAvailableEntities(entities);
      }
    } catch (err) {
      console.error('Failed to load entities:', err);
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // LINK/UNLINK ACTIONS
  // ============================================================================

  const handleLink = async (entityId: string) => {
    setError(null);
    setSuccess(null);

    try {
      const linkData = mode === 'assign-parent'
        ? {
            parent_entity_type: selectedEntityType,
            parent_entity_id: entityId,
            child_entity_type: childEntityType!,
            child_entity_id: childEntityId!,
            relationship_type: 'contains'
          }
        : {
            parent_entity_type: parentEntityType!,
            parent_entity_id: parentEntityId!,
            child_entity_type: selectedEntityType,
            child_entity_id: entityId,
            relationship_type: 'contains'
          };

      const response = await fetch(`${apiUrl}/api/v1/linkage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(linkData)
      });

      if (response.ok) {
        setSuccess('Linkage created successfully');
        await loadExistingLinkages();
        onLinkageChange?.();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create linkage');
      }
    } catch (err) {
      console.error('Failed to create linkage:', err);
      setError('Failed to create linkage');
    }
  };

  const handleUnlink = async (entityId: string) => {
    setError(null);
    setSuccess(null);

    try {
      // Find the linkage to delete
      const linkage = mode === 'assign-parent'
        ? existingLinkages.find(l => l.parent_entity_id === entityId && l.child_entity_id === childEntityId)
        : existingLinkages.find(l => l.child_entity_id === entityId && l.parent_entity_id === parentEntityId);

      if (!linkage) {
        setError('Linkage not found');
        return;
      }

      const response = await fetch(`${apiUrl}/api/v1/linkage/${linkage.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSuccess('Linkage removed successfully');
        await loadExistingLinkages();
        onLinkageChange?.();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to remove linkage');
      }
    } catch (err) {
      console.error('Failed to remove linkage:', err);
      setError('Failed to remove linkage');
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isLinked = (entityId: string): boolean => {
    if (mode === 'assign-parent') {
      return existingLinkages.some(l =>
        l.parent_entity_id === entityId &&
        l.child_entity_id === childEntityId &&
        l.parent_entity_type === selectedEntityType
      );
    } else {
      return existingLinkages.some(l =>
        l.child_entity_id === entityId &&
        l.parent_entity_id === parentEntityId &&
        l.child_entity_type === selectedEntityType
      );
    }
  };

  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return availableEntities;
    const query = searchQuery.toLowerCase();
    return availableEntities.filter(entity =>
      entity.name.toLowerCase().includes(query) ||
      entity.code?.toLowerCase().includes(query) ||
      entity.descr?.toLowerCase().includes(query)
    );
  }, [availableEntities, searchQuery]);

  const entityLabel = mode === 'assign-parent' ? 'Assign to' : 'Child Type';

  // Generate dynamic hover text for link action
  const getLinkActionTitle = (): string => {
    if (mode === 'assign-parent' && selectedEntityType) {
      const entityName = getEntityLabel(selectedEntityType).toLowerCase();
      return `Assign this ${entityName}`;
    } else if (mode === 'manage-children' && selectedEntityType) {
      const entityName = getEntityLabel(selectedEntityType).toLowerCase();
      return `Link this ${entityName}`;
    }
    return 'Link this entity';
  };

  // Generate the info text with all entity types
  const getInfoText = (): string => {
    const entityNames = validEntityTypes.map(type => getEntityLabel(type).toLowerCase());

    let entityTypesList = '';
    if (entityNames.length === 0) {
      entityTypesList = '';
    } else if (entityNames.length === 1) {
      entityTypesList = entityNames[0];
    } else if (entityNames.length === 2) {
      entityTypesList = `${entityNames[0]} and ${entityNames[1]}`;
    } else {
      // 3 or more: use Oxford comma
      const allButLast = entityNames.slice(0, -1).join(', ');
      const last = entityNames[entityNames.length - 1];
      entityTypesList = `${allButLast}, and ${last}`;
    }

    if (mode === 'assign-parent') {
      return entityTypesList ? `Assigning ${entityTypesList} for:` : 'Assigning parents for:';
    } else {
      return entityTypesList ? `Managing ${entityTypesList} for:` : 'Managing children of:';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Entity Info */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-0.5">
            {getInfoText()}
          </p>
          <p className="text-sm font-medium text-gray-900">
            {mode === 'assign-parent' ? childEntityName : parentEntityName}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 flex-1">{success}</p>
            <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Entity Type Buttons - Match LinkagePage UI */}
        {validEntityTypes.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <label className="text-xs font-medium text-gray-700 mb-2 block">
              {entityLabel}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {validEntityTypes.map(type => {
                const IconComponent = getEntityIconComponent(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedEntityType(type);
                      setSearchQuery('');
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-normal transition-all ${
                      selectedEntityType === type
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <IconComponent className="h-3 w-3 stroke-[1.5]" />
                    <span>{getEntityLabel(type)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {validEntityTypes.length === 0 && (
          <div className="text-center py-8 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700">
              No valid {mode === 'assign-parent' ? 'parent' : 'child'} types available
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Check the entity relationship configuration in d_entity_map
            </p>
          </div>
        )}

        {/* Search - Match LinkagePage UI */}
        {selectedEntityType && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedEntityType} by name...`}
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-gray-300 focus:ring-0"
            />
          </div>
        )}

        {/* Table of Available Entities */}
        {selectedEntityType && (
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : filteredEntities.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery ? `No results for "${searchQuery}"` : `No ${selectedEntityType} entities found`}
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[400px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 bg-gray-50">
                        Name
                      </th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 bg-gray-50">
                        Code
                      </th>
                      <th className="px-3 py-1.5 text-left text-[11px] font-normal text-gray-600 bg-gray-50">
                        Description
                      </th>
                      <th className="px-3 py-1.5 text-center text-[11px] font-normal text-gray-600 bg-gray-50">
                        Status
                      </th>
                      <th className="px-3 py-1.5 text-center text-[11px] font-normal text-gray-600 bg-gray-50">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEntities.map((entity) => {
                      const linked = isLinked(entity.id);
                      return (
                        <tr
                          key={entity.id}
                          className={`transition-colors ${
                            linked ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-1.5 text-xs text-gray-900 font-normal">
                            {entity.name}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">
                            {entity.code || '-'}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-xs">
                            {entity.descr || '-'}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {linked ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-normal bg-blue-100 text-blue-700">
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                                Linked
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {linked ? (
                              <button
                                onClick={() => handleUnlink(entity.id)}
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-red-100 transition-colors"
                                title="Unlink this entity"
                              >
                                <X className="h-3.5 w-3.5 text-red-600 stroke-[2]" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLink(entity.id)}
                                className="inline-flex items-center justify-center p-1 rounded hover:bg-green-100 transition-colors"
                                title={getLinkActionTitle()}
                              >
                                <Plus className="h-3.5 w-3.5 text-green-600 stroke-[2]" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {selectedEntityType && !loading && (
          <div className="text-xs text-gray-500 text-center">
            Showing {filteredEntities.length} {selectedEntityType} entities
            {existingLinkages.length > 0 && ` • ${existingLinkages.length} linked`}
          </div>
        )}
      </div>
    </Modal>
  );
};
