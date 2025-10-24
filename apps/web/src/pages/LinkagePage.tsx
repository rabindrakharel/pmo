import React, { useState, useEffect } from 'react';
import { Layout } from '../components/shared/layout/Layout';
import { UnifiedLinkageModal } from '../components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '../hooks/useLinkageModal';
import {
  Link2,
  Search,
  Database,
  MapPin,
  Building2,
  Building,
  FolderOpen,
  CheckSquare,
  Users,
  Shield,
  BookOpen,
  FileText,
  Settings
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface EntityInstance {
  id: string;
  name: string;
  descr?: string;
  code?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ============================================================================
// ENTITY TYPES CONFIGURATION
// ============================================================================

const entityTypes = [
  { value: 'office', label: 'Office', IconComponent: MapPin, canHaveChildren: true },
  { value: 'business', label: 'Business', IconComponent: Building2, canHaveChildren: true },
  { value: 'client', label: 'Client', IconComponent: Building, canHaveChildren: true },
  { value: 'project', label: 'Project', IconComponent: FolderOpen, canHaveChildren: true },
  { value: 'task', label: 'Task', IconComponent: CheckSquare, canHaveChildren: true },
  { value: 'worksite', label: 'Worksite', IconComponent: MapPin, canHaveChildren: true },
  { value: 'role', label: 'Role', IconComponent: Shield, canHaveChildren: true },
  { value: 'wiki', label: 'Wiki', IconComponent: BookOpen, canHaveChildren: false },
  { value: 'artifact', label: 'Artifact', IconComponent: FileText, canHaveChildren: false },
  { value: 'form', label: 'Form', IconComponent: FileText, canHaveChildren: false },
  { value: 'employee', label: 'Employee', IconComponent: Users, canHaveChildren: false }
];

// Entity types that can be parents (can have children)
const parentEntityTypes = entityTypes.filter(type => type.canHaveChildren);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LinkagePage() {
  // State
  const [selectedParentType, setSelectedParentType] = useState<string>('');
  const [parentInstances, setParentInstances] = useState<EntityInstance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkageCounts, setLinkageCounts] = useState<Record<string, number>>({});

  // Linkage modal
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refresh linkage counts when changes are made
      if (selectedParentType) {
        loadLinkageCounts();
      }
    }
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (selectedParentType) {
      loadParentInstances();
      loadLinkageCounts();
    } else {
      setParentInstances([]);
      setLinkageCounts({});
    }
  }, [selectedParentType]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadParentInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = selectedParentType === 'business' ? 'biz' : selectedParentType;
      const response = await fetch(`${API_BASE_URL}/api/v1/${endpoint}?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to load ${selectedParentType} instances`);

      const data = await response.json();
      const instances = (data.data || data.results || []).map((e: any) => ({
        id: e.id,
        name: e.name || e.title || e.email || 'Unnamed',
        descr: e.descr || e.description,
        code: e.code
      }));
      setParentInstances(instances);
    } catch (err: any) {
      console.error(`Error loading ${selectedParentType} instances:`, err);
      setError(err.message);
      setParentInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLinkageCounts = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      // Load all linkages for this parent type
      const response = await fetch(
        `${API_BASE_URL}/api/v1/linkage?parent_entity_type=${selectedParentType}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const linkages = data.data || [];

        // Count linkages by parent ID
        const counts: Record<string, number> = {};
        linkages.forEach((linkage: any) => {
          const parentId = linkage.parent_entity_id;
          counts[parentId] = (counts[parentId] || 0) + 1;
        });

        setLinkageCounts(counts);
      }
    } catch (err) {
      console.error('Error loading linkage counts:', err);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleManageChildren = (instance: EntityInstance) => {
    linkageModal.openManageChildren({
      parentEntityType: selectedParentType,
      parentEntityId: instance.id,
      parentEntityName: instance.name
    });
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredInstances = searchQuery.trim()
    ? parentInstances.filter(instance => {
        const query = searchQuery.toLowerCase();
        return (
          instance.name.toLowerCase().includes(query) ||
          instance.code?.toLowerCase().includes(query) ||
          instance.descr?.toLowerCase().includes(query)
        );
      })
    : parentInstances;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Entity Linkage Manager</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage parent-child relationships between entities
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How to use</h3>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>Select a parent entity type (e.g., Project, Office, Business)</li>
            <li>Browse or search for a specific entity instance</li>
            <li>Click "Manage Children" to link/unlink child entities</li>
            <li>Use the Plus (+) icon to link and X icon to unlink</li>
          </ol>
        </div>

        {/* Entity Type Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Step 1: Select Parent Entity Type
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {parentEntityTypes.map(type => {
              const IconComponent = type.IconComponent;
              const isSelected = selectedParentType === type.value;

              return (
                <button
                  key={type.value}
                  onClick={() => setSelectedParentType(type.value)}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Entity Instances Table */}
        {selectedParentType && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Step 2: Select {selectedParentType.charAt(0).toUpperCase() + selectedParentType.slice(1)} Instance
              </h2>

              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                <p className="text-sm text-gray-600 mt-2">Loading {selectedParentType} instances...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && parentInstances.length === 0 && !error && (
              <div className="text-center py-12 text-gray-500">
                <Database className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm">No {selectedParentType} instances found</p>
              </div>
            )}

            {/* Table */}
            {!loading && filteredInstances.length > 0 && (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Children
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInstances.map((instance) => {
                      const childCount = linkageCounts[instance.id] || 0;

                      return (
                        <tr key={instance.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {instance.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                            {instance.code || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                            {instance.descr || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {childCount > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {childCount} linked
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleManageChildren(instance)}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1.5" />
                              Manage Children
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {!loading && filteredInstances.length > 0 && (
              <div className="mt-4 text-xs text-gray-500 text-center">
                Showing {filteredInstances.length} of {parentInstances.length} {selectedParentType} instances
                {searchQuery && ` matching "${searchQuery}"`}
              </div>
            )}

            {/* No Results */}
            {!loading && parentInstances.length > 0 && filteredInstances.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No results found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unified Linkage Modal */}
        <UnifiedLinkageModal {...linkageModal.modalProps} />
      </div>
    </Layout>
  );
}
