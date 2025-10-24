import React, { useState, useEffect, useMemo } from 'react';
import { Link2, Plus, X, Check, Search, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from '../button/Button';

// ============================================================================
// TYPES
// ============================================================================

type LinkageMode = 'assign-parent' | 'manage-children';

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
      const endpoint = selectedEntityType === 'business' ? 'biz' : selectedEntityType;
      const response = await fetch(
        `${apiUrl}/api/v1/${endpoint}?limit=200`,
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

  const modalTitle = mode === 'assign-parent'
    ? `Assign Parent to ${childEntityName || childEntityType || 'Entity'}`
    : `Manage Children for ${parentEntityName || parentEntityType || 'Entity'}`;

  const entityLabel = mode === 'assign-parent' ? 'Parent Type' : 'Child Type';

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
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
            {mode === 'assign-parent' ? 'Managing parents for:' : 'Managing children of:'}
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

        {/* Entity Type Selector */}
        {validEntityTypes.length > 1 && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">
              {entityLabel}
            </label>
            <select
              value={selectedEntityType}
              onChange={(e) => {
                setSelectedEntityType(e.target.value);
                setSearchQuery('');
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {validEntityTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
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

        {/* Search */}
        {selectedEntityType && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedEntityType}...`}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                        Name
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                        Code
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">
                        Description
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-600">
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
                          <td className="px-4 py-2.5 text-sm text-gray-900 font-medium">
                            {entity.name}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-500 font-mono">
                            {entity.code || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-500 truncate max-w-xs">
                            {entity.descr || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {linked ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                <Check className="h-3 w-3 mr-1" />
                                Linked
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {linked ? (
                              <button
                                onClick={() => handleUnlink(entity.id)}
                                className="inline-flex items-center justify-center p-1.5 rounded hover:bg-red-100 transition-colors group"
                                title="Unlink"
                              >
                                <X className="h-4 w-4 text-red-600 stroke-[2]" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLink(entity.id)}
                                className="inline-flex items-center justify-center p-1.5 rounded hover:bg-green-100 transition-colors group"
                                title="Link"
                              >
                                <Plus className="h-4 w-4 text-green-600 stroke-[2]" />
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
