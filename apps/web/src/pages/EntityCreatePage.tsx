import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { getEntityConfig } from '../lib/entityConfig';
import { getEntityIcon } from '../lib/entityIcons';
import * as api from '../lib/api';

interface EntityCreatePageProps {
  entityType: string;
}

export function EntityCreatePage({ entityType }: EntityCreatePageProps) {
  const navigate = useNavigate();
  const config = getEntityConfig(entityType);
  const EntityIcon = getEntityIcon(entityType);

  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    descr: '',
    active_flag: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Get API module for this entity
      const apiModule = (api as any)[`${entityType}Api`];
      if (!apiModule || !apiModule.create) {
        throw new Error(`API module for ${entityType} not found`);
      }

      // Create the entity
      const created = await apiModule.create(formData);

      // Navigate to the detail page
      navigate(`/${entityType}/${created.id}`);
    } catch (err) {
      console.error(`Failed to create ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/${entityType}`);
  };

  if (!config) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Entity configuration not found for: {entityType}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                </button>
                <EntityIcon className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                <div>
                  <h1 className="text-sm font-normal text-gray-900">
                    Create {config.displayName}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Add a new {config.displayName.toLowerCase()} to the system
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-normal text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Enter ${config.displayName.toLowerCase()} name`}
                required
              />
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="descr" className="block text-sm font-normal text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="descr"
                value={formData.descr}
                onChange={(e) => handleChange('descr', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Enter ${config.displayName.toLowerCase()} description`}
              />
            </div>

            {/* Entity-specific fields can be added here based on entityType */}
            {entityType === 'task' && (
              <>
                <div>
                  <label htmlFor="priority_level" className="block text-sm font-normal text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    id="priority_level"
                    value={formData.priority_level || ''}
                    onChange={(e) => handleChange('priority_level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-normal text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status || ''}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </>
            )}

            {entityType === 'project' && (
              <>
                <div>
                  <label htmlFor="project_code" className="block text-sm font-normal text-gray-700 mb-2">
                    Project Code
                  </label>
                  <input
                    type="text"
                    id="project_code"
                    value={formData.project_code || ''}
                    onChange={(e) => handleChange('project_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., PROJ-2024-001"
                  />
                </div>
                <div>
                  <label htmlFor="stage" className="block text-sm font-normal text-gray-700 mb-2">
                    Stage
                  </label>
                  <select
                    id="stage"
                    value={formData.stage || ''}
                    onChange={(e) => handleChange('stage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select stage</option>
                    <option value="planning">Planning</option>
                    <option value="execution">Execution</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="closing">Closing</option>
                  </select>
                </div>
              </>
            )}

            {(entityType === 'employee' || entityType === 'client') && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-normal text-gray-700 mb-2">
                    Email {entityType === 'employee' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="email@example.com"
                    required={entityType === 'employee'}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-normal text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </>
            )}

            {/* Active Flag */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active_flag"
                checked={formData.active_flag}
                onChange={(e) => handleChange('active_flag', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="active_flag" className="ml-2 block text-sm text-gray-700">
                Active
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-normal text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-normal text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2 stroke-[1.5]" />
                    Create {config.displayName}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
