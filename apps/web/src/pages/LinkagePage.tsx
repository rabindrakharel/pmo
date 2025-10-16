import React, { useState, useEffect, useMemo } from 'react';
import {
  Link2,
  Plus,
  X,
  AlertCircle,
  Check,
  ChevronRight,
  Database,
  Search,
  // Entity icons (from rules.md and entityConfig.ts)
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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
  child_entity_type: string;
  child_entity_id: string;
  child_name?: string;
  relationship_type: string;
  active_flag: boolean;
  created_ts: string;
}

interface RBACMapping {
  id: string;
  empid: string;
  entity: string;
  entity_id: string;
  permission: number[];
  active_flag: boolean;
  employee_name?: string;
}

export function LinkagePage() {
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
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [childSearchQuery, setChildSearchQuery] = useState<string>('');

  // State for current linkages table
  const [currentLinkages, setCurrentLinkages] = useState<Linkage[]>([]);
  const [rbacMappings, setRbacMappings] = useState<RBACMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const permissionLabels: Record<number, string> = {
    0: 'View',
    1: 'Edit',
    2: 'Share',
    3: 'Delete',
    4: 'Create'
  };

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
      setSelectedChildIds([]);
    }
  }, [selectedChildType]);

  // Load current linkages and RBAC when parent and child are both selected
  useEffect(() => {
    if (selectedParentTypes.length > 0 && selectedChildType) {
      loadCurrentLinkages();
      loadRBACMappings();
    } else {
      setCurrentLinkages([]);
      setRbacMappings([]);
    }
  }, [selectedParentTypes, selectedChildType, selectedParentId]);

  // Pre-check existing linkages when child instances load
  useEffect(() => {
    if (selectedParentId && currentLinkages.length > 0) {
      // Find all child IDs that are already linked to this parent
      const linkedChildIds = currentLinkages
        .filter(linkage => linkage.parent_entity_id === selectedParentId)
        .map(linkage => linkage.child_entity_id);

      // Don't override user selections, only set if nothing is selected
      if (selectedChildIds.length === 0 && linkedChildIds.length > 0) {
        setSelectedChildIds(linkedChildIds);
      }
    }
  }, [currentLinkages, selectedParentId]);

  const loadValidChildTypes = async (parentType: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/linkage/children/${parentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load valid child types');

      const data = await response.json();
      setValidChildTypes(data.data || []);
    } catch (err: any) {
      console.error('Error loading valid child types:', err);
      setValidChildTypes([]);
    }
  };

  const loadParentInstances = async (entityType: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const endpoint = entityType === 'business' ? 'biz' : entityType;
      const response = await fetch(`${API_BASE_URL}/api/v1/${endpoint}?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to load ${entityType} instances`);

      const data = await response.json();
      const instances = (data.data || data.results || []).map((e: any) => ({
        id: e.id,
        name: e.name,
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
      const response = await fetch(`${API_BASE_URL}/api/v1/${entityType}?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to load ${entityType} instances`);

      const data = await response.json();
      const instances = (data.data || data.results || []).map((e: any) => ({
        id: e.id,
        name: e.name,
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

      // Enrich with entity names from d_entity
      const enrichedLinkages = await Promise.all((data.data || []).map(async (linkage: Linkage) => {
        try {
          const parentResponse = await fetch(
            `${API_BASE_URL}/api/v1/${linkage.parent_entity_type === 'business' ? 'biz' : linkage.parent_entity_type}/${linkage.parent_entity_id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          const childResponse = await fetch(
            `${API_BASE_URL}/api/v1/${linkage.child_entity_type}/${linkage.child_entity_id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          const parentData = parentResponse.ok ? await parentResponse.json() : null;
          const childData = childResponse.ok ? await childResponse.json() : null;

          return {
            ...linkage,
            parent_name: parentData?.data?.name || parentData?.name || 'Unknown',
            child_name: childData?.data?.name || childData?.name || 'Unknown'
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

  const loadRBACMappings = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      // Get RBAC mappings for the selected parent-child pair
      // This would require a custom endpoint or filtering logic
      // For now, we'll load all RBAC mappings and filter client-side

      // Load employee data for enrichment
      const employeeResponse = await fetch(`${API_BASE_URL}/api/v1/employee?limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!employeeResponse.ok) return;

      const employeeData = await employeeResponse.json();
      const employees = employeeData.data || employeeData.results || [];
      const employeeMap = new Map(employees.map((e: any) => [e.id, e.name]));

      // For demo, we'll create a synthetic RBAC view
      // In production, you'd have a dedicated endpoint for this
      setRbacMappings([]);
    } catch (err: any) {
      console.error('Error loading RBAC mappings:', err);
      setRbacMappings([]);
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

  const handleChildToggle = (childId: string) => {
    if (selectedChildIds.includes(childId)) {
      setSelectedChildIds(selectedChildIds.filter(id => id !== childId));
    } else {
      setSelectedChildIds([...selectedChildIds, childId]);
    }
  };

  const handleCreateLinkages = async () => {
    if (!selectedParentId || selectedChildIds.length === 0) {
      setError('Please select a parent entity and at least one child entity');
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      let successCount = 0;
      let errorCount = 0;

      for (const childId of selectedChildIds) {
        try {
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

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(`Successfully created ${successCount} linkage(s)`);
        setSelectedChildIds([]);
        loadCurrentLinkages();
      }
      if (errorCount > 0) {
        setError(`Failed to create ${errorCount} linkage(s)`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLinkage = async (linkageId: string) => {
    if (!confirm('Are you sure you want to delete this linkage?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/linkage/${linkageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete linkage');

      setSuccess('Linkage deleted successfully');
      loadCurrentLinkages();
    } catch (err: any) {
      setError(err.message);
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

  return (
    <Layout>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue-600" />
            <h1 className="text-sm font-normal text-gray-900">Entity Linkage Management</h1>
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
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xs font-normal text-gray-700">1. Select Parent Entity</h2>
              </div>

              <div className="p-4 space-y-4">
                {/* Parent Entity Type Selection - Single Row */}
                <div>
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
                              : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          <IconComponent className="h-3 w-3 stroke-[1.5]" />
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Parent Entity Instance Selection - Scrollable */}
                {selectedParentTypes.length > 0 && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <label className="block text-xs font-normal text-gray-600 mb-2">
                      Select Specific {getEntityLabel(selectedParentTypes[0])}
                    </label>
                    {loading ? (
                      <div className="text-xs text-gray-400 py-6 text-center">Loading...</div>
                    ) : parentInstances.length === 0 ? (
                      <div className="text-xs text-gray-400 py-6 text-center">
                        No {getEntityLabel(selectedParentTypes[0])} instances found
                      </div>
                    ) : (
                      <div className="overflow-y-auto space-y-1.5 pr-2" style={{ maxHeight: '280px' }}>
                        {parentInstances.map(instance => (
                          <button
                            key={instance.id}
                            onClick={() => handleParentInstanceSelect(instance)}
                            className={`w-full text-left px-2.5 py-2 rounded border transition-all ${
                              selectedParentId === instance.id
                                ? 'bg-blue-50 border-blue-400 shadow-sm'
                                : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-normal text-xs text-gray-900">{instance.name}</div>
                            {instance.code && (
                              <div className="text-[11px] text-gray-500 mt-0.5">Code: {instance.code}</div>
                            )}
                            {instance.descr && (
                              <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{instance.descr}</div>
                            )}
                            <div className="text-[10px] text-gray-400 mt-0.5 font-mono">ID: {instance.id.substring(0, 8)}...</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Child Entity Selection */}
            <div className="bg-white rounded border border-gray-300 flex flex-col overflow-hidden shadow-sm">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xs font-normal text-gray-700">2. Select Child Entities</h2>
              </div>

              <div className="p-4 space-y-4 flex flex-col h-full">
                {/* Child Entity Type Selection - Single Row */}
                {selectedParentTypes.length > 0 && (
                  <div>
                    {validChildTypes.length === 0 ? (
                      <div className="text-xs text-gray-400 py-4 text-center">
                        No valid child types for {getEntityLabel(selectedParentTypes[0])}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {validChildTypes.map(type => {
                          const IconComponent = getEntityIconComponent(type);
                          return (
                            <button
                              key={type}
                              onClick={() => setSelectedChildType(type)}
                              className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-normal transition-all ${
                                selectedChildType === type
                                  ? 'bg-green-50 border-green-400 text-green-700 shadow-sm'
                                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                              }`}
                            >
                              <IconComponent className="h-3 w-3 stroke-[1.5]" />
                              <span>{getEntityLabel(type)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Child Entity Instance Selection - Scrollable */}
                {selectedChildType && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-normal text-gray-600">
                        Select {getEntityLabel(selectedChildType)} Instances to Link
                      </label>
                      {selectedChildIds.length > 0 && (
                        <span className="text-xs text-blue-600 font-normal">
                          {selectedChildIds.length} selected
                        </span>
                      )}
                    </div>
                    {loading ? (
                      <div className="text-xs text-gray-400 py-6 text-center">Loading...</div>
                    ) : childInstances.length === 0 ? (
                      <div className="text-xs text-gray-400 py-6 text-center">
                        No {getEntityLabel(selectedChildType)} instances found
                      </div>
                    ) : (
                      <div className="overflow-y-auto space-y-1.5 pr-2" style={{ maxHeight: '280px' }}>
                        {childInstances.map(instance => {
                          const isLinked = currentLinkages.some(
                            linkage => linkage.parent_entity_id === selectedParentId &&
                                      linkage.child_entity_id === instance.id
                          );
                          return (
                            <label
                              key={instance.id}
                              className={`flex items-start gap-2 px-2.5 py-2 rounded border cursor-pointer transition-all ${
                                selectedChildIds.includes(instance.id)
                                  ? 'bg-green-50 border-green-400 shadow-sm'
                                  : isLinked
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedChildIds.includes(instance.id)}
                                onChange={() => handleChildToggle(instance.id)}
                                className="mt-0.5 w-3.5 h-3.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="font-normal text-xs text-gray-900">{instance.name}</div>
                                  {isLinked && (
                                    <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-normal bg-blue-100 text-blue-700">
                                      <Check className="h-2.5 w-2.5 mr-0.5" />
                                      Linked
                                    </span>
                                  )}
                                </div>
                                {instance.code && (
                                  <div className="text-[11px] text-gray-500 mt-0.5">Code: {instance.code}</div>
                                )}
                                {instance.descr && (
                                  <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{instance.descr}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Link Button */}
                    {selectedParentId && selectedChildIds.length > 0 && (
                      <div className="pt-3 border-t border-gray-200 mt-3">
                        <button
                          onClick={handleCreateLinkages}
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded border border-blue-700 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-normal shadow-sm transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create {selectedChildIds.length} Linkage{selectedChildIds.length > 1 ? 's' : ''}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Current Linkages Table */}
        {selectedParentTypes.length > 0 && selectedChildType && (
          <div className="px-6 pb-6">
            <div className="bg-white rounded border border-gray-300 overflow-hidden shadow-sm">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-gray-600" />
                  <h2 className="text-xs font-normal text-gray-700">
                    Current Linkages: {getEntityLabel(selectedParentTypes[0])} → {getEntityLabel(selectedChildType)}
                  </h2>
                </div>
                <span className="text-[11px] text-gray-500">
                  {currentLinkages.length} linkage{currentLinkages.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="py-8 text-center text-xs text-gray-400">Loading linkages...</div>
                ) : currentLinkages.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No linkages found for this parent-child combination
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-normal text-gray-600">
                          <div className="flex items-center gap-1">
                            {React.createElement(getEntityIconComponent(selectedParentTypes[0]), {
                              className: 'h-3 w-3 stroke-[1.5]'
                            })}
                            <span>{getEntityLabel(selectedParentTypes[0])}</span>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-center text-[11px] font-normal text-gray-600">Relation</th>
                        <th className="px-3 py-2 text-left text-[11px] font-normal text-gray-600">
                          <div className="flex items-center gap-1">
                            {React.createElement(getEntityIconComponent(selectedChildType), {
                              className: 'h-3 w-3 stroke-[1.5]'
                            })}
                            <span>{getEntityLabel(selectedChildType)}</span>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-center text-[11px] font-normal text-gray-600">Status</th>
                        <th className="px-3 py-2 text-center text-[11px] font-normal text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentLinkages.map(linkage => (
                        <tr key={linkage.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs">
                            <div className="font-normal text-gray-900">{linkage.parent_name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{linkage.parent_entity_id.substring(0, 8)}...</div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <ChevronRight className="h-3 w-3 text-gray-400 mx-auto" />
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="font-normal text-gray-900">{linkage.child_name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{linkage.child_entity_id.substring(0, 8)}...</div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {linkage.active_flag ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-normal bg-green-100 text-green-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-normal bg-gray-100 text-gray-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteLinkage(linkage.id)}
                              className="text-red-600 hover:text-red-700 text-[11px] font-normal"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
