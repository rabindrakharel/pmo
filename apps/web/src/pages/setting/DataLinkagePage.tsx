import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Link as LinkIcon, AlertCircle, Check, X } from 'lucide-react';
import { Layout } from '../../components/shared';

interface Linkage {
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

export function DataLinkagePage() {
  const [linkages, setLinkages] = useState<Linkage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for creating new linkage
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [parentEntityType, setParentEntityType] = useState('');
  const [parentEntityId, setParentEntityId] = useState('');
  const [childEntityType, setChildEntityType] = useState('');
  const [childEntityId, setChildEntityId] = useState('');
  const [relationshipType, setRelationshipType] = useState('contains');

  // Entity options for dropdowns
  const [parentOptions, setParentOptions] = useState<EntityOption[]>([]);
  const [childOptions, setChildOptions] = useState<EntityOption[]>([]);
  const [validChildTypes, setValidChildTypes] = useState<string[]>([]);

  // Entity types available
  const entityTypes = [
    { value: 'office', label: 'Office' },
    { value: 'business', label: 'Business' },
    { value: 'client', label: 'Client' },
    { value: 'project', label: 'Project' },
    { value: 'task', label: 'Task' },
    { value: 'worksite', label: 'Worksite' },
    { value: 'wiki', label: 'Wiki' },
    { value: 'artifact', label: 'Artifact' },
    { value: 'form', label: 'Form' }
  ];

  const relationshipTypes = [
    { value: 'contains', label: 'Contains' },
    { value: 'owns', label: 'Owns' },
    { value: 'hosts', label: 'Hosts' },
    { value: 'assigned_to', label: 'Assigned To' }
  ];

  // Load linkages on mount
  useEffect(() => {
    loadLinkages();
  }, []);

  // Load valid child types when parent entity type changes
  useEffect(() => {
    if (parentEntityType) {
      loadValidChildTypes(parentEntityType);
    }
  }, [parentEntityType]);

  // Load parent entity options when parent entity type changes
  useEffect(() => {
    if (parentEntityType) {
      loadEntityOptions(parentEntityType, setParentOptions);
    }
  }, [parentEntityType]);

  // Load child entity options when child entity type changes
  useEffect(() => {
    if (childEntityType) {
      loadEntityOptions(childEntityType, setChildOptions);
    }
  }, [childEntityType]);

  const loadLinkages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load linkages');

      const data = await response.json();
      setLinkages(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadValidChildTypes = async (parentType: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/linkage/children/${parentType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load valid child types');

      const data = await response.json();
      setValidChildTypes(data.data || []);
    } catch (err: any) {
      console.error('Error loading valid child types:', err);
    }
  };

  const loadEntityOptions = async (entityType: string, setter: React.Dispatch<React.SetStateAction<EntityOption[]>>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/${entityType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(`Failed to load ${entityType} options`);

      const data = await response.json();
      const entities = data.data || data.results || [];
      setter(entities.map((e: any) => ({
        id: e.id,
        name: e.name,
        code: e.code
      })));
    } catch (err: any) {
      console.error(`Error loading ${entityType} options:`, err);
    }
  };

  const handleCreateLinkage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/linkage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent_entity_type: parentEntityType,
          parent_entity_id: parentEntityId,
          child_entity_type: childEntityType,
          child_entity_id: childEntityId,
          relationship_type: relationshipType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create linkage');
      }

      setSuccess('Linkage created successfully');
      setShowCreateForm(false);
      resetForm();
      loadLinkages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteLinkage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this linkage?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/linkage/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete linkage');

      setSuccess('Linkage deleted successfully');
      loadLinkages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setParentEntityType('');
    setParentEntityId('');
    setChildEntityType('');
    setChildEntityId('');
    setRelationshipType('contains');
    setParentOptions([]);
    setChildOptions([]);
    setValidChildTypes([]);
  };

  const getEntityLabel = (type: string) => {
    const entity = entityTypes.find(e => e.value === type);
    return entity?.label || type;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading linkages...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <LinkIcon className="h-5 w-5 text-gray-600 stroke-[1.5] mr-3" />
                <div>
                  <h1 className="text-sm font-normal text-gray-900">Data Linkage</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage relationships between entities (projects, tasks, wikis, artifacts, forms, etc.)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
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
                    New Linkage
                  </>
                )}
              </button>
            </div>

            {/* Alert Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-900">Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">Success</h4>
                  <p className="text-sm text-green-700 mt-1">{success}</p>
                </div>
                <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Create Linkage Form */}
            {showCreateForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Create New Linkage</h4>
                <form onSubmit={handleCreateLinkage} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Parent Entity Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Parent Entity Type
                      </label>
                      <select
                        value={parentEntityType}
                        onChange={(e) => {
                          setParentEntityType(e.target.value);
                          setChildEntityType('');
                          setParentEntityId('');
                          setChildEntityId('');
                        }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select parent type...</option>
                        {entityTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Parent Entity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Parent Entity
                      </label>
                      <select
                        value={parentEntityId}
                        onChange={(e) => setParentEntityId(e.target.value)}
                        required
                        disabled={!parentEntityType || parentOptions.length === 0}
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

                    {/* Child Entity Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Child Entity Type
                      </label>
                      <select
                        value={childEntityType}
                        onChange={(e) => {
                          setChildEntityType(e.target.value);
                          setChildEntityId('');
                        }}
                        required
                        disabled={!parentEntityType || validChildTypes.length === 0}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      >
                        <option value="">Select child type...</option>
                        {validChildTypes.map(type => (
                          <option key={type} value={type}>{getEntityLabel(type)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Child Entity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Child Entity
                      </label>
                      <select
                        value={childEntityId}
                        onChange={(e) => setChildEntityId(e.target.value)}
                        required
                        disabled={!childEntityType || childOptions.length === 0}
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

                    {/* Relationship Type */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Relationship Type
                      </label>
                      <select
                        value={relationshipType}
                        onChange={(e) => setRelationshipType(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {relationshipTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        resetForm();
                      }}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Linkage
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Linkages Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parent Entity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Relationship
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Child Entity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {linkages.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <LinkIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm font-medium">No linkages found</p>
                          <p className="text-sm">Create a new linkage to get started</p>
                        </td>
                      </tr>
                    ) : (
                      linkages.map(linkage => (
                        <tr key={linkage.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {getEntityLabel(linkage.parent_entity_type)}
                                </div>
                                <div className="text-sm text-gray-500 font-mono">
                                  {linkage.parent_entity_id.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                              {linkage.relationship_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {getEntityLabel(linkage.child_entity_type)}
                                </div>
                                <div className="text-sm text-gray-500 font-mono">
                                  {linkage.child_entity_id.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {linkage.active_flag ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteLinkage(linkage.id)}
                              className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Stats */}
            {linkages.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Total Linkages: <strong className="text-gray-900">{linkages.length}</strong></span>
                  <span>Active: <strong className="text-gray-900">{linkages.filter(l => l.active_flag).length}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
