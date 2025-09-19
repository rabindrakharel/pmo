import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Layout } from '../../components/layout/Layout';
import { projectApi } from '../../lib/api';

interface ProjectFormData {
  name: string;
  descr?: string;
  project_code?: string;
  project_type?: string;
  priority_level?: string;
  budget_allocated?: number;
  budget_currency?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_hours?: number;
  project_stage?: string;
  project_status?: string;
  business_id?: string;
}

export function ProjectEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    descr: '',
    project_code: '',
    project_type: 'Standard',
    priority_level: 'Medium',
    budget_allocated: 0,
    budget_currency: 'CAD',
    planned_start_date: '',
    planned_end_date: '',
    estimated_hours: 0,
    project_stage: 'Planning',
    project_status: 'Active',
    business_id: '',
  });

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return;

      try {
        setLoading(true);
        const response = await projectApi.get(projectId);
        if (response) {
          setFormData({
            name: response.name || '',
            descr: response.descr || '',
            project_code: response.project_code || '',
            project_type: response.project_type || 'Standard',
            priority_level: response.priority_level || 'Medium',
            budget_allocated: response.budget_allocated || 0,
            budget_currency: response.budget_currency || 'CAD',
            planned_start_date: response.planned_start_date ? response.planned_start_date.split('T')[0] : '',
            planned_end_date: response.planned_end_date ? response.planned_end_date.split('T')[0] : '',
            estimated_hours: response.estimated_hours || 0,
            project_stage: response.project_stage || 'Planning',
            project_status: response.project_status || 'Active',
            business_id: response.business_id || '',
          });
        }
      } catch (error) {
        console.error('Failed to load project:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId]);

  const handleInputChange = (field: keyof ProjectFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!projectId || !formData.name.trim()) return;

    try {
      setSaving(true);
      await projectApi.update(projectId, formData);
      navigate(`/project/${projectId}`);
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('Failed to update project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/project/${projectId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="h-10 w-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50"
              title="Back to Project Detail"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
              <p className="mt-1 text-gray-600">Update project information and settings</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Code</label>
                <input
                  type="text"
                  value={formData.project_code}
                  onChange={(e) => handleInputChange('project_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., PROJ-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.descr}
                  onChange={(e) => handleInputChange('descr', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe the project..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
                <select
                  value={formData.project_type}
                  onChange={(e) => handleInputChange('project_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Standard">Standard</option>
                  <option value="Research">Research</option>
                  <option value="Development">Development</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
                <select
                  value={formData.priority_level}
                  onChange={(e) => handleInputChange('priority_level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Status and Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Status & Timeline</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Status</label>
                <select
                  value={formData.project_status}
                  onChange={(e) => handleInputChange('project_status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Stage</label>
                <select
                  value={formData.project_stage}
                  onChange={(e) => handleInputChange('project_stage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Planning">Planning</option>
                  <option value="Design">Design</option>
                  <option value="Development">Development</option>
                  <option value="Testing">Testing</option>
                  <option value="Deployment">Deployment</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start Date</label>
                <input
                  type="date"
                  value={formData.planned_start_date}
                  onChange={(e) => handleInputChange('planned_start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planned End Date</label>
                <input
                  type="date"
                  value={formData.planned_end_date}
                  onChange={(e) => handleInputChange('planned_end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                <input
                  type="number"
                  value={formData.estimated_hours}
                  onChange={(e) => handleInputChange('estimated_hours', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Budget Information */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="text-lg font-medium text-gray-900">Budget Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget Allocated</label>
                  <input
                    type="number"
                    value={formData.budget_allocated}
                    onChange={(e) => handleInputChange('budget_allocated', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.budget_currency}
                    onChange={(e) => handleInputChange('budget_currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}