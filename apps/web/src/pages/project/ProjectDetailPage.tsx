import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { ShareButton } from '../../components/common/ActionButtons';
import { EntityAssignmentDataTable } from '../../components/common/EntityAssignmentDataTable';
import { Edit3, Check, X } from 'lucide-react';
import { projectApi } from '../../lib/api';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('project', projectId!);

  const [projectData, setProjectData] = React.useState<any>(null);
  const [projectLoading, setProjectLoading] = React.useState(true);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  // Permission checking removed - handled at API level via RBAC joins

  React.useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      try {
        setProjectLoading(true);
        const response = await projectApi.get(projectId);
        if (response) {
          console.log('Project data received:', response);
          setProjectData(response);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setProjectLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!projectId) return;

    try {
      setSaving(true);
      const updateData = { [fieldName]: editValue };

      await projectApi.update(projectId, updateData);

      // Update local state
      setProjectData(prev => ({ ...prev, [fieldName]: editValue }));
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderEditableField = (
    fieldName: string,
    label: string,
    displayValue: string,
    options?: {
      type?: 'text' | 'select' | 'date' | 'number';
      options?: string[];
      rawValue?: any;
      renderValue?: (value: string) => React.ReactNode;
    }
  ) => {
    const { type = 'text', options: selectOptions, rawValue, renderValue } = options || {};
    const isEditing = editingField === fieldName;

    return (
      <div className="group">
        <dt className="text-sm font-medium text-gray-500 mb-1">{label}</dt>
        <dd className="flex items-center justify-between">
          {isEditing ? (
            <div className="flex items-center space-x-2 flex-1">
              {type === 'select' ? (
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                >
                  {selectOptions?.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : type === 'date' ? (
                <input
                  type="date"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              ) : type === 'number' ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveField(fieldName);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  autoFocus
                />
              )}
              <button
                onClick={() => handleSaveField(fieldName)}
                disabled={saving}
                className="p-1 text-green-600 hover:text-green-700"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-900 flex-1">
                {renderValue ? renderValue(displayValue) : displayValue}
              </div>
              <button
                onClick={() => handleEditField(fieldName, rawValue !== undefined ? String(rawValue) : displayValue)}
                className="ml-2 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Edit ${label.toLowerCase()}`}
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </>
          )}
        </dd>
      </div>
    );
  };

  if (projectLoading || loading) {
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
      <div className="h-full flex flex-col">
        {/* Header Tab Navigation */}
        <DynamicChildEntityTabs
          title={projectData?.name || 'Digital Transformation Initiative'}
          parentType="project"
          parentId={projectId!}
          parentName={projectData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/')}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <ShareButton
                onClick={() => console.log('Share project')}
                variant="secondary"
              />
            </div>
          }
        />

        {/* Project Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl">
            {/* Project Header with Name */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 group">
                    {editingField === 'name' ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-2xl font-bold text-gray-900 bg-transparent border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveField('name');
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveField('name')}
                          disabled={saving}
                          className="p-1 text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold text-gray-900">
                          {projectData?.name || 'Unnamed Project'}
                        </h1>
                        <button
                          onClick={() => handleEditField('name', projectData?.name || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit project name"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {projectData?.project_code && (
                      <p className="text-sm text-gray-500 mt-1">Code: {projectData.project_code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Project Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.task_count || 0}
                </div>
                <div className="text-sm text-gray-500">Tasks</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.artifact_count || 0}
                </div>
                <div className="text-sm text-gray-500">Artifacts</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.completion_percentage || 0}%
                </div>
                <div className="text-sm text-gray-500">Complete</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {projectData?.team_size || 0}
                </div>
                <div className="text-sm text-gray-500">Team Members</div>
              </div>
            </div>

            {/* Comprehensive Project Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {renderEditableField('project_code', 'Project Code', projectData?.project_code || 'Not set')}
                  {renderEditableField('project_type', 'Project Type', projectData?.project_type || 'Standard', {
                    type: 'select',
                    options: ['Standard', 'Research', 'Development', 'Maintenance', 'Emergency']
                  })}
                  {renderEditableField('priority_level', 'Priority Level', projectData?.priority_level || 'Medium', {
                    type: 'select',
                    options: ['Low', 'Medium', 'High', 'Critical']
                  })}
                  {renderEditableField('business_name', 'Business Unit', projectData?.business_name || 'Not assigned')}
                </div>
              </div>

              {/* Status & Timeline */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Status & Timeline</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {renderEditableField('project_status', 'Status', projectData?.project_status || 'Planning', {
                    type: 'select',
                    options: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'],
                    renderValue: (value) => (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        value === 'Active' ? 'bg-green-100 text-green-800' :
                        value === 'Planning' ? 'bg-blue-100 text-blue-800' :
                        value === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                        value === 'Completed' ? 'bg-gray-100 text-gray-800' :
                        value === 'Cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {value}
                      </span>
                    )
                  })}
                  {renderEditableField('project_stage', 'Stage', projectData?.project_stage || 'Planning', {
                    type: 'select',
                    options: ['Planning', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance']
                  })}
                  {renderEditableField('planned_start_date', 'Start Date',
                    projectData?.planned_start_date ? new Date(projectData.planned_start_date).toLocaleDateString() : 'Not set',
                    { type: 'date', rawValue: projectData?.planned_start_date?.split('T')[0] || '' }
                  )}
                  {renderEditableField('planned_end_date', 'End Date',
                    projectData?.planned_end_date ? new Date(projectData.planned_end_date).toLocaleDateString() : 'Not set',
                    { type: 'date', rawValue: projectData?.planned_end_date?.split('T')[0] || '' }
                  )}
                  {renderEditableField('estimated_hours', 'Estimated Hours',
                    projectData?.estimated_hours ? `${projectData.estimated_hours} hours` : 'Not set',
                    { type: 'number', rawValue: projectData?.estimated_hours || 0 }
                  )}
                </div>
              </div>

              {/* Budget Information */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Budget Information</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {renderEditableField('budget_allocated', 'Budget Allocated',
                    projectData?.budget_allocated ? `$${projectData.budget_allocated.toLocaleString()}` : 'Not set',
                    { type: 'number', rawValue: projectData?.budget_allocated || 0 }
                  )}
                  {renderEditableField('budget_currency', 'Currency', projectData?.budget_currency || 'CAD', {
                    type: 'select',
                    options: ['CAD', 'USD', 'EUR', 'GBP']
                  })}
                </div>
              </div>

              {/* Project Description */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Description</h3>
                </div>
                <div className="px-6 py-4">
                  {editingField === 'descr' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        placeholder="Enter project description..."
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSaveField('descr')}
                          disabled={saving}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group">
                      <div className="flex items-start justify-between">
                        <p className="text-gray-700 whitespace-pre-wrap flex-1">
                          {projectData?.descr || 'No description provided'}
                        </p>
                        <button
                          onClick={() => handleEditField('descr', projectData?.descr || '')}
                          className="ml-2 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit description"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Entity Assignment Data Table - Show parent entity assignments */}
            <div className="mt-6">
              <EntityAssignmentDataTable
                actionEntityId={projectId!}
                actionEntityType="project"
                actionEntityName={projectData?.name || 'Unnamed Project'}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}