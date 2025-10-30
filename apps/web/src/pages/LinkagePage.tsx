import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  Plus,
  X,
  AlertCircle,
  Check,
  Database,
  Search,
  MapPin,        // office, worksite
  Building2,     // business
  Building,      // client
  FolderOpen,    // project
  CheckSquare,   // task
  Users,         // employee
  Shield,        // role
  BookOpen,      // wiki
  FileText       // artifact, form
} from 'lucide-react';
import { Layout } from '../components/shared/layout/Layout';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface EntityInstance {
  id: string;
  name: string;
  descr?: string;
  code?: string;
}

interface Linkage {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  parent_name?: string;
  parent_code?: string;
  parent_descr?: string;
  child_entity_type: string;
  child_entity_id: string;
  child_name?: string;
  child_code?: string;
  child_descr?: string;
  relationship_type: string;
  active_flag: boolean;
  created_ts: string;
}

export function LinkagePage() {
  // Helper function to map entity types to API endpoints
  const getApiEndpoint = (entityType: string): string => {
    if (entityType === 'business') return 'biz';
    if (entityType === 'client') return 'cust';
    return entityType;
  };

  // State for parent entity selection (left panel)
  const [selectedParentTypes, setSelectedParentTypes] = useState<string[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [parentInstances, setParentInstances] = useState<EntityInstance[]>([]);
  const [selectedParentInstance, setSelectedParentInstance] = useState<EntityInstance | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState<string>('');

  // State for child entity selection (right panel)
  const [validChildTypes, setValidChildTypes] = useState<string[]>([]);
  const [selectedChildType, setSelectedChildType] = useState<string>('');
  const [childInstances, setChildInstances] = useState<EntityInstance[]>([]);
  const [childSearchQuery, setChildSearchQuery] = useState<string>('');

  // State for current linkages table
  const [currentLinkages, setCurrentLinkages] = useState<Linkage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for entity type child management (tabs configuration)
  const [currentEntityTypeChildren, setCurrentEntityTypeChildren] = useState<Array<{entity: string; ui_label: string; ui_icon: string; order: number}>>([]);
  const [availableChildTypes, setAvailableChildTypes] = useState<string[]>([]);

  // State for inline child entity addition
  const [showInlineAddInput, setShowInlineAddInput] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [allEntityTypes, setAllEntityTypes] = useState<Array<{code: string; name: string; ui_label: string; ui_icon: string}>>([]);

  // State for remove mode
  const [isRemoveMode, setIsRemoveMode] = useState(false);

  // Entity types configuration - using Lucide React icons from entityConfig.ts
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

  // Only these entity types can be parents (can have children)
  const validParentTypes = [
    'office',    // Can have: business, worksite
    'business',  // Can have: project
    'client',    // Can have: project, worksite
    'project',   // Can have: task, wiki, artifact, form
    'task',      // Can have: wiki, artifact, form
    'worksite',  // Can have: task, form
    'role'       // Can have: employee (role assignments)
  ];

  // Filter entity types to show only valid parents
  const parentEntityTypes = entityTypes.filter(type => validParentTypes.includes(type.value));

  // Load valid child types when parent types are selected
  useEffect(() => {
    if (selectedParentTypes.length > 0) {
      loadValidChildTypes(selectedParentTypes[0]); // Use first selected parent type
    } else {
      setValidChildTypes([]);
      setSelectedChildType('');
    }
  }, [selectedParentTypes]);

  // Load parent instances when parent type is selected
  useEffect(() => {
    if (selectedParentTypes.length > 0) {
      loadParentInstances(selectedParentTypes[0]); // Load instances for first selected type
    } else {
      setParentInstances([]);
      setSelectedParentId('');
      setSelectedParentInstance(null);
    }
  }, [selectedParentTypes]);

  // Load child instances when child type is selected
  useEffect(() => {
    if (selectedChildType) {
      loadChildInstances(selectedChildType);
    } else {
      setChildInstances([]);
    }
  }, [selectedChildType]);

  // Load current linkages when parent and child are both selected
  useEffect(() => {
    if (selectedParentTypes.length > 0 && selectedChildType) {
      loadCurrentLinkages();
    } else {
      setCurrentLinkages([]);
    }
  }, [selectedParentTypes, selectedChildType, selectedParentId]);

  // Load entity type metadata when parent type is selected
  useEffect(() => {
    if (selectedParentTypes.length > 0) {
      loadEntityTypeMetadata(selectedParentTypes[0]);
    }
  }, [selectedParentTypes]);

  // Load all entity types on mount for autocomplete
  useEffect(() => {
    loadAllEntityTypes();
  }, []);

  const loadAllEntityTypes = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/entity/types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load all entity types');

      const data = await response.json();
      setAllEntityTypes(data);
    } catch (err: any) {
      console.error('Error loading all entity types:', err);
    }
  };

  const loadEntityTypeMetadata = async (entityType: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/entity/type/${entityType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load entity type metadata');

      const data = await response.json();

      // Sort child entities by order field
      const sortedChildren = (data.child_entities || []).sort((a: any, b: any) =>
        (a.order || 999) - (b.order || 999)
      );
      setCurrentEntityTypeChildren(sortedChildren);

      const childEntityCodes = sortedChildren.map((child: any) => child.entity);

      // Calculate available child types (all types except self and current children)
      const allTypes = entityTypes.map(t => t.value);
      const available = allTypes.filter(t =>
        t !== entityType && !childEntityCodes.includes(t)
      );
      setAvailableChildTypes(available);
    } catch (err: any) {
      console.error('Error loading entity type metadata:', err);
    }
  };

  const handleAddChildEntityType = async (childType: string) => {
    if (!selectedParentTypes.length) return;

    const parentType = selectedParentTypes[0];
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');

      // Fetch current entity type data to get existing children
      const getResponse = await fetch(`${API_BASE_URL}/api/v1/entity/type/${parentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!getResponse.ok) throw new Error('Failed to fetch current entity type');

      const currentData = await getResponse.json();
      const existingChildren = currentData.child_entities || [];

      // Find the child entity metadata
      const childEntityMeta = entityTypes.find(e => e.value === childType);
      if (!childEntityMeta) throw new Error('Child entity type not found');

      // Add new child with proper metadata
      const newChild = {
        entity: childType,
        ui_icon: childEntityMeta.IconComponent.name || 'Circle',
        ui_label: childEntityMeta.label + 's', // Pluralize
        order: existingChildren.length + 1
      };

      const updatedChildren = [...existingChildren, newChild];

      // Update the entity type
      const updateResponse = await fetch(`${API_BASE_URL}/api/v1/entity/${parentType}/children`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ child_entities: updatedChildren })
      });

      if (!updateResponse.ok) throw new Error('Failed to update entity children');

      setSuccess(`Added ${childEntityMeta.label} as child tab to ${getEntityLabel(parentType)}`);
      setTimeout(() => setSuccess(null), 3000);

      // Reload metadata
      await loadEntityTypeMetadata(parentType);
      await loadValidChildTypes(parentType);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to add child entity type');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveChildEntityType = async (childType: string) => {
    if (!selectedParentTypes.length) return;
    if (!confirm(`Remove ${getEntityLabel(childType)} tab from ${getEntityLabel(selectedParentTypes[0])}?`)) return;

    const parentType = selectedParentTypes[0];
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');

      // Fetch current entity type data
      const getResponse = await fetch(`${API_BASE_URL}/api/v1/entity/type/${parentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!getResponse.ok) throw new Error('Failed to fetch current entity type');

      const currentData = await getResponse.json();
      const existingChildren = currentData.child_entities || [];

      // Remove the child and reorder
      const updatedChildren = existingChildren
        .filter((child: any) => child.entity !== childType)
        .map((child: any, index: number) => ({ ...child, order: index + 1 }));

      // Update the entity type
      const updateResponse = await fetch(`${API_BASE_URL}/api/v1/entity/${parentType}/children`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ child_entities: updatedChildren })
      });

      if (!updateResponse.ok) throw new Error('Failed to update entity children');

      setSuccess(`Removed ${getEntityLabel(childType)} tab from ${getEntityLabel(parentType)}`);
      setTimeout(() => setSuccess(null), 3000);

      // Reload metadata
      await loadEntityTypeMetadata(parentType);
      await loadValidChildTypes(parentType);

      // Exit remove mode if no more children
      const remainingChildren = updatedChildren.length;
      if (remainingChildren === 0) {
        setIsRemoveMode(false);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to remove child entity type');
    } finally {
      setLoading(false);
    }
  };

  const loadValidChildTypes = async (parentType: string) => {
    try {
      const token = localStorage.getItem('auth_token');

      // Use the same entity type API to get child entities for consistency
      const response = await fetch(`${API_BASE_URL}/api/v1/entity/type/${parentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load entity type metadata');

      const data = await response.json();

      // Extract child entity codes from child_entities array and sort by order
      const sortedChildren = (data.child_entities || []).sort((a: any, b: any) =>
        (a.order || 999) - (b.order || 999)
      );
      const childTypes = sortedChildren.map((child: any) => child.entity);

      setValidChildTypes(childTypes);
    } catch (err: any) {
      console.error('Error loading valid child types:', err);
      setValidChildTypes([]);
    }
  };

  const loadParentInstances = async (entityType: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const endpoint = getApiEndpoint(entityType);
      const response = await fetch(`${API_BASE_URL}/api/v1/${endpoint}?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to load ${entityType} instances`);

      const data = await response.json();
      const instances = (data.data || data.results || []).map((e: any) => ({
        id: e.id,
        name: e.name || e.title || e.email || 'Unnamed',
        descr: e.descr || e.description,
        code: e.code
      }));
      setParentInstances(instances);
    } catch (err: any) {
      console.error(`Error loading ${entityType} instances:`, err);
      setParentInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChildInstances = async (entityType: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const endpoint = getApiEndpoint(entityType);
      const response = await fetch(`${API_BASE_URL}/api/v1/${endpoint}?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to load ${entityType} instances`);

      const data = await response.json();
      const instances = (data.data || data.results || []).map((e: any) => ({
        id: e.id,
        name: e.name || e.title || e.email || 'Unnamed',
        descr: e.descr || e.description,
        code: e.code
      }));
      setChildInstances(instances);
    } catch (err: any) {
      console.error(`Error loading ${entityType} instances:`, err);
      setChildInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentLinkages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      let url = `${API_BASE_URL}/api/v1/linkage?parent_entity_type=${selectedParentTypes[0]}&child_entity_type=${selectedChildType}`;
      if (selectedParentId) {
        url += `&parent_entity_id=${selectedParentId}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load linkages');

      const data = await response.json();

      // Enrich with entity names, codes, and descriptions
      const enrichedLinkages = await Promise.all((data.data || []).map(async (linkage: Linkage) => {
        try {
          const parentEndpoint = getApiEndpoint(linkage.parent_entity_type);
          const childEndpoint = getApiEndpoint(linkage.child_entity_type);

          const parentResponse = await fetch(
            `${API_BASE_URL}/api/v1/${parentEndpoint}/${linkage.parent_entity_id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          const childResponse = await fetch(
            `${API_BASE_URL}/api/v1/${childEndpoint}/${linkage.child_entity_id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          const parentData = parentResponse.ok ? await parentResponse.json() : null;
          const childData = childResponse.ok ? await childResponse.json() : null;

          const parent = parentData?.data || parentData || {};
          const child = childData?.data || childData || {};

          return {
            ...linkage,
            parent_name: parent.name || 'Unknown',
            parent_code: parent.code || '',
            parent_descr: parent.descr || parent.description || '',
            child_name: child.name || 'Unknown',
            child_code: child.code || '',
            child_descr: child.descr || child.description || ''
          };
        } catch {
          return linkage;
        }
      }));

      setCurrentLinkages(enrichedLinkages);
    } catch (err: any) {
      console.error('Error loading linkages:', err);
      setError(err.message);
      setCurrentLinkages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleParentTypeToggle = (type: string) => {
    if (selectedParentTypes.includes(type)) {
      setSelectedParentTypes(selectedParentTypes.filter(t => t !== type));
    } else {
      setSelectedParentTypes([type]); // Single selection for simplicity
    }
  };

  const handleParentInstanceSelect = (instance: EntityInstance) => {
    setSelectedParentId(instance.id);
    setSelectedParentInstance(instance);
  };

  // Create a single linkage (for + icon)
  const handleCreateSingleLinkage = async (childId: string) => {
    if (!selectedParentId) return;

    setError(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/linkage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent_entity_type: selectedParentTypes[0],
          parent_entity_id: selectedParentId,
          child_entity_type: selectedChildType,
          child_entity_id: childId,
          relationship_type: 'contains'
        })
      });

      if (!response.ok) throw new Error('Failed to create linkage');

      setSuccess('Linkage created successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadCurrentLinkages();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to create linkage');
    } finally {
      setLoading(false);
    }
  };

  // Delete a linkage by child ID (for X icon)
  const handleUnlinkChild = async (childId: string) => {
    if (!selectedParentId) return;

    // Find the linkage ID for this parent-child pair
    const linkage = currentLinkages.find(
      l => l.parent_entity_id === selectedParentId && l.child_entity_id === childId
    );

    if (!linkage) return;

    if (!confirm('Are you sure you want to unlink this entity?')) return;

    setError(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/linkage/${linkage.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete linkage');

      setSuccess('Linkage removed successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadCurrentLinkages();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to delete linkage');
    } finally {
      setLoading(false);
    }
  };

  const getEntityLabel = (type: string) => {
    const entity = entityTypes.find(e => e.value === type);
    return entity?.label || type;
  };

  const getEntityIconComponent = (type: string) => {
    const entity = entityTypes.find(e => e.value === type);
    return entity?.IconComponent || Database;
  };

  // Filter parent instances based on search query
  const filteredParentInstances = useMemo(() => {
    if (!parentSearchQuery.trim()) return parentInstances;
    const query = parentSearchQuery.toLowerCase();
    return parentInstances.filter(instance =>
      instance.name.toLowerCase().includes(query) ||
      instance.code?.toLowerCase().includes(query) ||
      instance.descr?.toLowerCase().includes(query)
    );
  }, [parentInstances, parentSearchQuery]);

  // Filter child instances based on search query
  const filteredChildInstances = useMemo(() => {
    if (!childSearchQuery.trim()) return childInstances;
    const query = childSearchQuery.toLowerCase();
    return childInstances.filter(instance =>
      instance.name.toLowerCase().includes(query) ||
      instance.code?.toLowerCase().includes(query) ||
      instance.descr?.toLowerCase().includes(query)
    );
  }, [childInstances, childSearchQuery]);

  return (
    <Layout>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-gray-600 stroke-[1.5]" />
              <div>
                <h1 className="text-sm font-normal text-gray-800">Entity Linkage Management</h1>
                <p className="text-sm text-gray-500">Manage relationships between parent and child entities</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        <div className="px-6 pt-3 space-y-2">
          {error && (
            <div className="bg-red-50 border border-red-300 rounded p-2 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-300 rounded p-2 flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700 flex-1">{success}</p>
              <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-700">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Main Content: Split View */}
        <div className="flex-1 px-6 py-4 overflow-hidden">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Left Panel: Parent Entity Selection */}
            <div className="bg-white rounded border border-gray-300 flex flex-col overflow-hidden shadow-sm">
              {/* Parent Entity Type Selection - Header */}
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-wrap gap-1.5">
                  {parentEntityTypes.map(type => {
                    const IconComponent = type.IconComponent;
                    return (
                      <button
                        key={type.value}
                        onClick={() => handleParentTypeToggle(type.value)}
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-normal transition-all ${
                          selectedParentTypes.includes(type.value)
                            ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <IconComponent className="h-3 w-3 stroke-[1.5]" />
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Search Bar */}
                <div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search parent entity by name..."
                      value={parentSearchQuery}
                      onChange={(e) => setParentSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-gray-300 focus:ring-0"
                    />
                  </div>
                </div>

                {/* Parent Entity Instance Selection - Data Table */}
                {selectedParentTypes.length > 0 && (
                  <div className="flex-1 flex flex-col min-h-0">
                    {loading ? (
                      <div className="text-xs text-gray-400 py-6 text-center">Loading...</div>
                    ) : filteredParentInstances.length === 0 ? (
                      <div className="text-xs text-gray-400 py-6 text-center">
                        {parentSearchQuery ? `No matches found for "${parentSearchQuery}"` : `No ${getEntityLabel(selectedParentTypes[0])} instances found`}
                      </div>
                    ) : (
                      <div className="overflow-y-auto border border-gray-200 rounded max-h-[600px]">
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
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredParentInstances.map(instance => (
                              <tr
                                key={instance.id}
                                onClick={() => handleParentInstanceSelect(instance)}
                                className={`cursor-pointer transition-colors ${
                                  selectedParentId === instance.id
                                    ? 'bg-blue-50'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-3 py-1.5 text-xs text-gray-900 font-normal">
                                  {instance.name}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-gray-500">
                                  {instance.code || '-'}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-xs">
                                  {instance.descr || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Child Entity Selection */}
            <div className="bg-white rounded border border-gray-300 flex flex-col overflow-hidden shadow-sm">
              {/* Tab Management Controls - Top of Pane */}
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                {selectedParentTypes.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                      Manage Child Tabs
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setShowInlineAddInput(!showInlineAddInput);
                          setInlineSearchQuery('');
                          setIsRemoveMode(false);
                        }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-300 text-[10px] font-normal text-gray-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-all"
                        title="Add new child entity type"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        Add+
                      </button>
                      <button
                        onClick={() => {
                          setIsRemoveMode(!isRemoveMode);
                          setShowInlineAddInput(false);
                        }}
                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-normal transition-all ${
                          isRemoveMode
                            ? 'bg-red-50 border-red-400 text-red-700'
                            : 'border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                        }`}
                        title={isRemoveMode ? "Exit remove mode" : "Remove child entity types"}
                      >
                        <X className="h-2.5 w-2.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Add Input with Autocomplete */}
              {showInlineAddInput && selectedParentTypes.length > 0 && (
                <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                  <div className="relative">
                    <input
                      type="text"
                      value={inlineSearchQuery}
                      onChange={(e) => setInlineSearchQuery(e.target.value)}
                      placeholder="Type to search entities..."
                      className="w-full px-2 py-1 text-[10px] border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                      autoFocus
                    />

                    {/* Autocomplete Dropdown */}
                    {inlineSearchQuery && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto">
                        {allEntityTypes
                          .filter(entity => {
                            // Filter out parent entity and current children
                            const parentType = selectedParentTypes[0];
                            const currentChildCodes = currentEntityTypeChildren.map(c => c.entity);

                            if (entity.code === parentType) return false;
                            if (currentChildCodes.includes(entity.code)) return false;

                            // Filter by search query
                            const query = inlineSearchQuery.toLowerCase();
                            return (
                              entity.name.toLowerCase().includes(query) ||
                              entity.code.toLowerCase().includes(query) ||
                              entity.ui_label.toLowerCase().includes(query)
                            );
                          })
                          .slice(0, 10)
                          .map(entity => {
                            const IconComponent = getEntityIconComponent(entity.code);
                            return (
                              <button
                                key={entity.code}
                                onClick={() => {
                                  handleAddChildEntityType(entity.code);
                                  setInlineSearchQuery('');
                                  setShowInlineAddInput(false);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-blue-50 transition-colors text-[11px]"
                              >
                                <IconComponent className="h-3 w-3 text-gray-600" />
                                <div>
                                  <div className="font-medium text-gray-900">{entity.name}</div>
                                  <div className="text-[9px] text-gray-500">{entity.ui_label}</div>
                                </div>
                              </button>
                            );
                          })
                        }
                        {allEntityTypes.filter(entity => {
                          const parentType = selectedParentTypes[0];
                          const currentChildCodes = currentEntityTypeChildren.map(c => c.entity);
                          if (entity.code === parentType) return false;
                          if (currentChildCodes.includes(entity.code)) return false;
                          const query = inlineSearchQuery.toLowerCase();
                          return (
                            entity.name.toLowerCase().includes(query) ||
                            entity.code.toLowerCase().includes(query) ||
                            entity.ui_label.toLowerCase().includes(query)
                          );
                        }).length === 0 && (
                          <div className="px-2 py-2 text-[10px] text-gray-500 text-center">
                            No entities found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Child Entity Type Selection - Morphing Tabs */}
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                {selectedParentTypes.length > 0 && (
                  <>
                    {validChildTypes.length === 0 ? (
                      <div className="text-xs text-gray-400 py-1 text-center">
                        No child entity types configured for {getEntityLabel(selectedParentTypes[0])}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {validChildTypes.map(type => {
                          const IconComponent = getEntityIconComponent(type);
                          return (
                            <div key={type} className="relative group">
                              <button
                                onClick={() => {
                                  if (!isRemoveMode) {
                                    setSelectedChildType(type);
                                  }
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-normal transition-all ${
                                  isRemoveMode
                                    ? 'bg-red-50 border-red-300 text-red-700 cursor-default'
                                    : selectedChildType === type
                                      ? 'bg-green-50 border-green-400 text-green-700 shadow-sm'
                                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <IconComponent className="h-3 w-3 stroke-[1.5]" />
                                <span>{getEntityLabel(type)}</span>
                              </button>
                              {isRemoveMode && (
                                <button
                                  onClick={() => handleRemoveChildEntityType(type)}
                                  className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                  title="Remove this tab"
                                >
                                  <X className="h-2.5 w-2.5 text-white stroke-[2.5]" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-4 space-y-4 flex flex-col h-full">
                {/* Search Bar */}
                <div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search child entity by name..."
                      value={childSearchQuery}
                      onChange={(e) => setChildSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:border-gray-300 focus:ring-0"
                    />
                  </div>
                </div>

                {/* Child Entity Instance Selection - Data Table */}
                {selectedChildType && (
                  <div className="flex-1 flex flex-col min-h-0">
                    {loading ? (
                      <div className="text-xs text-gray-400 py-6 text-center">Loading...</div>
                    ) : filteredChildInstances.length === 0 ? (
                      <div className="text-xs text-gray-400 py-6 text-center">
                        {childSearchQuery ? `No matches found for "${childSearchQuery}"` : `No ${getEntityLabel(selectedChildType)} instances found`}
                      </div>
                    ) : (
                      <div className="overflow-y-auto border border-gray-200 rounded max-h-[600px]">
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
                            {filteredChildInstances.map(instance => {
                              const isLinked = currentLinkages.some(
                                linkage => linkage.parent_entity_id === selectedParentId &&
                                          linkage.child_entity_id === instance.id
                              );
                              return (
                                <tr
                                  key={instance.id}
                                  className={`transition-colors ${
                                    isLinked ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <td className="px-3 py-1.5 text-xs text-gray-900 font-normal">
                                    {instance.name}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-gray-500">
                                    {instance.code || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-gray-500 truncate max-w-xs">
                                    {instance.descr || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {isLinked ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-normal bg-blue-100 text-blue-700">
                                        <Check className="h-2.5 w-2.5 mr-0.5" />
                                        Linked
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {isLinked ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnlinkChild(instance.id);
                                        }}
                                        disabled={loading}
                                        className="inline-flex items-center justify-center p-1 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Unlink this entity"
                                      >
                                        <X className="h-3.5 w-3.5 text-red-600 stroke-[2]" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCreateSingleLinkage(instance.id);
                                        }}
                                        disabled={loading}
                                        className="inline-flex items-center justify-center p-1 rounded hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Link this entity"
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
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
