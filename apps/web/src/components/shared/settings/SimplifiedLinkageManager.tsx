import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Link as LinkIcon,
  AlertCircle,
  Check,
  X,
  Search,
  RefreshCw,
  GitBranch,
  Database,
  Layers,
  ArrowRight,
  Edit3,
  Save,
  ChevronDown
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TypeLinkage {
  id: string;
  parent_entity_type: string;
  child_entity_type: string;
  relationship_type: string;
  is_enabled: boolean;
  description: string | null;
  created_ts: string;
  updated_ts: string;
}

interface InstanceLinkage {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type: string;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}

interface EntityOption {
  id: string;
  name: string;
  code?: string;
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

const ENTITY_TYPES = [
  { value: 'office', label: 'Office', icon: '🏢' },
  { value: 'business', label: 'Business', icon: '🏪' },
  { value: 'client', label: 'Client', icon: '👤' },
  { value: 'project', label: 'Project', icon: '📋' },
  { value: 'task', label: 'Task', icon: '✓' },
  { value: 'worksite', label: 'Worksite', icon: '🏗️' },
  { value: 'wiki', label: 'Wiki', icon: '📚' },
  { value: 'artifact', label: 'Artifact', icon: '📎' },
  { value: 'form', label: 'Form', icon: '📝' },
  { value: 'employee', label: 'Employee', icon: '👨' },
  { value: 'role', label: 'Role', icon: '🎭' },
  { value: 'position', label: 'Position', icon: '💼' }
];

const RELATIONSHIP_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'owns', label: 'Owns' },
  { value: 'hosts', label: 'Hosts' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'manages', label: 'Manages' },
  { value: 'employs', label: 'Employs' },
  { value: 'documents', label: 'Documents' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface GroupedLinkage {
  entity_type: string;
  type_linkages: TypeLinkage[];
  instance_linkages: InstanceLinkage[];
  type_count: number;
  instance_count: number;
}

interface GroupedResponse {
  success: boolean;
  data: GroupedLinkage[];
  totals: {
    total_type_linkages: number;
    total_instance_linkages: number;
    entity_types: number;
  };
}

export function SimplifiedLinkageManager() {
  const [activeTab, setActiveTab] = useState<'types' | 'instances' | 'grouped'>('types');

  // Type linkages state
  const [typeLinkages, setTypeLinkages] = useState<TypeLinkage[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Instance linkages state
  const [instanceLinkages, setInstanceLinkages] = useState<InstanceLinkage[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  // Grouped linkages state
  const [groupedData, setGroupedData] = useState<GroupedLinkage[]>([]);
  const [groupedTotals, setGroupedTotals] = useState<any>(null);
  const [loadingGrouped, setLoadingGrouped] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for Type-to-Type mapping
  const [typeForm, setTypeForm] = useState({
    parent_entity_type: '',
    child_entity_type: '',
    relationship_type: 'contains',
    description: ''
  });

  // Form state for Instance-to-Instance mapping
  const [instanceForm, setInstanceForm] = useState({
    parent_entity_type: '',
    parent_entity_id: '',
    child_entity_type: '',
    child_entity_id: '',
    relationship_type: 'contains'
  });

  // Entity options for dropdowns
  const [parentOptions, setParentOptions] = useState<EntityOption[]>([]);
  const [childOptions, setChildOptions] = useState<EntityOption[]>([]);
  const [validChildTypes, setValidChildTypes] = useState<string[]>([]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (activeTab === 'types') {
      loadTypeLinkages();
    } else if (activeTab === 'instances') {
      loadInstanceLinkages();
    } else {
      loadGroupedLinkages();
    }
  }, [activeTab]);

  const loadTypeLinkages = async () => {
    try {
      setLoadingTypes(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage/types', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load type linkages');

      const data = await response.json();
      setTypeLinkages(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadInstanceLinkages = async () => {
    try {
      setLoadingInstances(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load instance linkages');

      const data = await response.json();
      setInstanceLinkages(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadGroupedLinkages = async () => {
    try {
      setLoadingGrouped(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage/grouped', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load grouped linkages');

      const data: GroupedResponse = await response.json();
      setGroupedData(data.data || []);
      setGroupedTotals(data.totals || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingGrouped(false);
    }
  };

  // Load valid child types when parent type changes (for instance mapping)
  useEffect(() => {
    if (instanceForm.parent_entity_type && activeTab === 'instances') {
      loadValidChildTypes(instanceForm.parent_entity_type);
    }
  }, [instanceForm.parent_entity_type, activeTab]);

  // Load entity options when types change
  useEffect(() => {
    if (instanceForm.parent_entity_type) {
      loadEntityOptions(instanceForm.parent_entity_type, setParentOptions);
    }
  }, [instanceForm.parent_entity_type]);

  useEffect(() => {
    if (instanceForm.child_entity_type) {
      loadEntityOptions(instanceForm.child_entity_type, setChildOptions);
    }
  }, [instanceForm.child_entity_type]);

  const loadValidChildTypes = async (parentType: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/linkage/types/valid-children/${parentType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return;

      const data = await response.json();
      const childTypes = data.data?.map((item: any) => item.child_entity_type) || [];
      setValidChildTypes(childTypes);
    } catch (err) {
      console.error('Error loading valid child types:', err);
    }
  };

  const loadEntityOptions = async (entityType: string, setter: React.Dispatch<React.SetStateAction<EntityOption[]>>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/${entityType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return;

      const data = await response.json();
      const entities = data.data || data.results || [];
      setter(entities.map((e: any) => ({
        id: e.id,
        name: e.name || e.title || e.email || 'Unnamed',
        code: e.code
      })));
    } catch (err) {
      console.error(`Error loading ${entityType} options:`, err);
    }
  };

  // ============================================================================
  // CREATE HANDLERS
  // ============================================================================

  const handleCreateTypeLinkage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage/types', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(typeForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create type linkage');
      }

      setSuccess('Type-to-Type mapping created successfully');
      setTimeout(() => setSuccess(null), 3000);
      setShowCreateForm(false);
      resetTypeForms();
      loadTypeLinkages();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateInstanceLinkage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(instanceForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create instance linkage');
      }

      setSuccess('Instance-to-Instance mapping created successfully');
      setTimeout(() => setSuccess(null), 3000);
      setShowCreateForm(false);
      resetInstanceForms();
      loadInstanceLinkages();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  // ============================================================================
  // DELETE HANDLERS
  // ============================================================================

  const handleDeleteTypeLinkage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this type-to-type mapping?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/linkage/types/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete type linkage');

      setSuccess('Type mapping deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadTypeLinkages();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteInstanceLinkage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this instance mapping?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/linkage/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete instance linkage');

      setSuccess('Instance mapping deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      loadInstanceLinkages();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const resetTypeForms = () => {
    setTypeForm({
      parent_entity_type: '',
      child_entity_type: '',
      relationship_type: 'contains',
      description: ''
    });
  };

  const resetInstanceForms = () => {
    setInstanceForm({
      parent_entity_type: '',
      parent_entity_id: '',
      child_entity_type: '',
      child_entity_id: '',
      relationship_type: 'contains'
    });
    setParentOptions([]);
    setChildOptions([]);
    setValidChildTypes([]);
  };

  const getEntityIcon = (type: string) => {
    return ENTITY_TYPES.find(e => e.value === type)?.icon || '📦';
  };

  const getEntityLabel = (type: string) => {
    return ENTITY_TYPES.find(e => e.value === type)?.label || type;
  };

  const filteredTypeLinkages = typeLinkages.filter(linkage =>
    searchTerm === '' ||
    linkage.parent_entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    linkage.child_entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    linkage.relationship_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInstanceLinkages = instanceLinkages.filter(linkage =>
    searchTerm === '' ||
    linkage.parent_entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    linkage.child_entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <LinkIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Entity Linkage Manager</h3>
            <p className="text-sm text-gray-600 mt-1">
              Manage entity relationships at type and instance levels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === 'types') loadTypeLinkages();
              else if (activeTab === 'instances') loadInstanceLinkages();
              else loadGroupedLinkages();
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              if (showCreateForm) {
                resetTypeForms();
                resetInstanceForms();
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? (
              <>
                <X className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                New Mapping
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => {
              setActiveTab('types');
              setShowCreateForm(false);
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'types'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Layers className="h-4 w-4" />
            Type-to-Type
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'types'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {typeLinkages.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('instances');
              setShowCreateForm(false);
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'instances'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Database className="h-4 w-4" />
            Instance-to-Instance
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'instances'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {instanceLinkages.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('grouped');
              setShowCreateForm(false);
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'grouped'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <GitBranch className="h-4 w-4" />
            By Entity Type
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'grouped'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {groupedData.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search mappings..."
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            {activeTab === 'types' ? 'Create Type-to-Type Mapping' : 'Create Instance-to-Instance Mapping'}
          </h4>

          {activeTab === 'types' ? (
            <form onSubmit={handleCreateTypeLinkage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Entity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={typeForm.parent_entity_type}
                    onChange={(e) => setTypeForm({ ...typeForm, parent_entity_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select parent type...</option>
                    {ENTITY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Child Entity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={typeForm.child_entity_type}
                    onChange={(e) => setTypeForm({ ...typeForm, child_entity_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select child type...</option>
                    {ENTITY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship Type
                  </label>
                  <select
                    value={typeForm.relationship_type}
                    onChange={(e) => setTypeForm({ ...typeForm, relationship_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {RELATIONSHIP_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={typeForm.description}
                    onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                    placeholder="Optional description..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetTypeForms();
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Create Type Mapping
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateInstanceLinkage} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Entity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={instanceForm.parent_entity_type}
                    onChange={(e) => {
                      setInstanceForm({
                        ...instanceForm,
                        parent_entity_type: e.target.value,
                        parent_entity_id: '',
                        child_entity_type: '',
                        child_entity_id: ''
                      });
                      setChildOptions([]);
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select parent type...</option>
                    {ENTITY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Parent Entity <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={instanceForm.parent_entity_id}
                    onChange={(e) => setInstanceForm({ ...instanceForm, parent_entity_id: e.target.value })}
                    required
                    disabled={!instanceForm.parent_entity_type || parentOptions.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select parent entity...</option>
                    {parentOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name} {option.code && `(${option.code})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Child Entity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={instanceForm.child_entity_type}
                    onChange={(e) => {
                      setInstanceForm({ ...instanceForm, child_entity_type: e.target.value, child_entity_id: '' });
                    }}
                    required
                    disabled={!instanceForm.parent_entity_type || validChildTypes.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select child type...</option>
                    {validChildTypes.map(type => {
                      const entityType = ENTITY_TYPES.find(et => et.value === type);
                      return (
                        <option key={type} value={type}>
                          {entityType?.icon} {entityType?.label || type}
                        </option>
                      );
                    })}
                  </select>
                  {instanceForm.parent_entity_type && validChildTypes.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      No valid child types found. Create a type-to-type mapping first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Child Entity <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={instanceForm.child_entity_id}
                    onChange={(e) => setInstanceForm({ ...instanceForm, child_entity_id: e.target.value })}
                    required
                    disabled={!instanceForm.child_entity_type || childOptions.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select child entity...</option>
                    {childOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name} {option.code && `(${option.code})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Relationship Type
                  </label>
                  <select
                    value={instanceForm.relationship_type}
                    onChange={(e) => setInstanceForm({ ...instanceForm, relationship_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {RELATIONSHIP_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetInstanceForms();
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Create Instance Mapping
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Content */}
      {activeTab === 'types' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent Type
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  →
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Child Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Relationship
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingTypes ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-sm">Loading type mappings...</p>
                  </td>
                </tr>
              ) : filteredTypeLinkages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <GitBranch className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium">No type mappings found</p>
                    <p className="text-xs mt-1">Create your first type-to-type mapping to get started</p>
                  </td>
                </tr>
              ) : (
                filteredTypeLinkages.map(linkage => (
                  <tr key={linkage.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getEntityIcon(linkage.parent_entity_type)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getEntityLabel(linkage.parent_entity_type)}
                          </div>
                          <div className="text-xs text-gray-500">{linkage.parent_entity_type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ArrowRight className="h-5 w-5 text-gray-400 mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getEntityIcon(linkage.child_entity_type)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getEntityLabel(linkage.child_entity_type)}
                          </div>
                          <div className="text-xs text-gray-500">{linkage.child_entity_type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {linkage.relationship_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {linkage.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {linkage.is_enabled ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <X className="h-3 w-3 mr-1" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteTypeLinkage(linkage.id)}
                        className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'instances' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source Entity
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  →
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Relationship
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingInstances ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-sm">Loading instance mappings...</p>
                  </td>
                </tr>
              ) : filteredInstanceLinkages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium">No instance mappings found</p>
                    <p className="text-xs mt-1">Create instance-to-instance mappings to link specific entities</p>
                  </td>
                </tr>
              ) : (
                filteredInstanceLinkages.map(linkage => (
                  <tr key={linkage.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getEntityIcon(linkage.parent_entity_type)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getEntityLabel(linkage.parent_entity_type)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {linkage.parent_entity_id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ArrowRight className="h-5 w-5 text-gray-400 mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getEntityIcon(linkage.child_entity_type)}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getEntityLabel(linkage.child_entity_type)}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {linkage.child_entity_id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                        {linkage.relationship_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {linkage.active_flag ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <X className="h-3 w-3 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteInstanceLinkage(linkage.id)}
                        className="text-red-600 hover:text-red-900 inline-flex items-center gap-1 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {loadingGrouped ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-gray-500">Loading grouped mappings...</p>
            </div>
          ) : groupedData.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <GitBranch className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">No mappings found</p>
              <p className="text-xs mt-1 text-gray-500">Create type-to-type and instance mappings to see them here</p>
            </div>
          ) : (
            <>
              {/* Totals Summary Card */}
              {groupedTotals && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Total Type Mappings:
                          <strong className="text-blue-700 ml-1">{groupedTotals.total_type_linkages}</strong>
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Total Instance Mappings:
                          <strong className="text-purple-700 ml-1">{groupedTotals.total_instance_linkages}</strong>
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Entity Types:
                          <strong className="text-green-700 ml-1">{groupedTotals.entity_types}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Entity Cards */}
              {groupedData.map(entity => (
                <div
                  key={entity.entity_type}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div
                    className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer"
                    onClick={() => {
                      const newExpanded = new Set(expandedEntities);
                      if (newExpanded.has(entity.entity_type)) {
                        newExpanded.delete(entity.entity_type);
                      } else {
                        newExpanded.add(entity.entity_type);
                      }
                      setExpandedEntities(newExpanded);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getEntityIcon(entity.entity_type)}</span>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {getEntityLabel(entity.entity_type)}
                          <span className="text-xs text-gray-500 font-mono">({entity.entity_type})</span>
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Layers className="h-3 w-3 mr-1" />
                            {entity.type_count} type{entity.type_count !== 1 ? 's' : ''}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            <Database className="h-3 w-3 mr-1" />
                            {entity.instance_count} instance{entity.instance_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        expandedEntities.has(entity.entity_type) ? 'transform rotate-180' : ''
                      }`}
                    />
                  </div>

                  {expandedEntities.has(entity.entity_type) && (
                    <div className="px-6 py-4 space-y-4">
                      {/* Type Linkages Section */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Layers className="h-4 w-4 text-blue-600" />
                          Type-to-Type Mappings ({entity.type_count})
                        </h5>
                        {entity.type_count === 0 ? (
                          <p className="text-xs text-gray-500 italic ml-6">No type mappings defined</p>
                        ) : (
                          <div className="ml-6 space-y-2">
                            {entity.type_linkages.map(linkage => (
                              <div
                                key={linkage.id}
                                className="flex items-center gap-2 text-sm bg-gray-50 rounded px-3 py-2"
                              >
                                <span className="text-lg">{getEntityIcon(linkage.parent_entity_type)}</span>
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                                <span className="text-lg">{getEntityIcon(linkage.child_entity_type)}</span>
                                <span className="font-medium text-gray-700">
                                  {getEntityLabel(linkage.child_entity_type)}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 capitalize">
                                  {linkage.relationship_type}
                                </span>
                                {linkage.description && (
                                  <span className="text-xs text-gray-500 truncate max-w-xs">
                                    {linkage.description}
                                  </span>
                                )}
                                {linkage.is_enabled ? (
                                  <Check className="h-4 w-4 text-green-600 ml-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-gray-400 ml-auto" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Instance Linkages Section */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Database className="h-4 w-4 text-purple-600" />
                          Instance-to-Instance Mappings ({entity.instance_count})
                        </h5>
                        {entity.instance_count === 0 ? (
                          <p className="text-xs text-gray-500 italic ml-6">No instance mappings defined</p>
                        ) : (
                          <div className="ml-6 space-y-2">
                            {entity.instance_linkages.map(linkage => (
                              <div
                                key={linkage.id}
                                className="flex items-center gap-2 text-sm bg-gray-50 rounded px-3 py-2"
                              >
                                <span className="text-lg">{getEntityIcon(linkage.parent_entity_type)}</span>
                                <span className="text-xs font-mono text-gray-500">
                                  {linkage.parent_entity_id.substring(0, 8)}
                                </span>
                                <ArrowRight className="h-4 w-4 text-gray-400" />
                                <span className="text-lg">{getEntityIcon(linkage.child_entity_type)}</span>
                                <span className="font-medium text-gray-700">
                                  {getEntityLabel(linkage.child_entity_type)}
                                </span>
                                <span className="text-xs font-mono text-gray-500">
                                  {linkage.child_entity_id.substring(0, 8)}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 capitalize">
                                  {linkage.relationship_type}
                                </span>
                                {linkage.active_flag ? (
                                  <Check className="h-4 w-4 text-green-600 ml-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-gray-400 ml-auto" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              Total {activeTab === 'types' ? 'Type' : 'Instance'} Mappings:
              <strong className="text-gray-900 ml-1">
                {activeTab === 'types' ? filteredTypeLinkages.length : filteredInstanceLinkages.length}
              </strong>
            </span>
            {activeTab === 'types' && (
              <span className="text-gray-600">
                Enabled:
                <strong className="text-green-600 ml-1">
                  {filteredTypeLinkages.filter(l => l.is_enabled).length}
                </strong>
              </span>
            )}
            {activeTab === 'instances' && (
              <span className="text-gray-600">
                Active:
                <strong className="text-green-600 ml-1">
                  {filteredInstanceLinkages.filter(l => l.active_flag).length}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
