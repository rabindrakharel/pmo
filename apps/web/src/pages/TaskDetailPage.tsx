import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../components/common/HeaderTabNavigation';
import { ActionBar } from '../components/common/Button';
import { FileText, MessageSquare, Activity, Users, Clock, Edit3, Check, X } from 'lucide-react';
import { InlineEditField } from '../components/common/InlineEditField';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { tabs, loading: tabsLoading } = useHeaderTabs('task', taskId!);
  // Permission checking removed - handled at API level via RBAC joins
  const [taskData, setTaskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTaskData = async () => {
      if (!taskId) return;

      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Task data received:', data);
          setTaskData(data);
        }
      } catch (error) {
        console.error('Error fetching task:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskData();
  }, [taskId]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!taskId) return;

    try {
      setSaving(true);
      const updateData = { [fieldName]: editValue };

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setTaskData(prev => ({ ...prev, [fieldName]: editValue }));
        setEditingField(null);
        setEditValue('');
      } else {
        console.error('Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || tabsLoading) {
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
        <HeaderTabNavigation
          title={taskData?.name || 'Task'}
          parentType="task"
          parentId={taskId!}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/')}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Share
              </button>
            </div>
          }
        />

        {/* Task Details Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Task Status */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 group">
                    {editingField === 'name' ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="text-xl font-semibold text-gray-900 bg-transparent border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <div className="flex items-center space-x-2">
                        <h2 className="text-xl font-semibold text-gray-900">{taskData?.name}</h2>
                        <button
                          onClick={() => handleEditField('name', taskData?.name || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit task name"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      taskData?.task_status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : taskData?.task_status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : taskData?.task_status === 'blocked'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {taskData?.task_status || 'Open'}
                    </span>
                    {taskData?.priority_level && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        taskData.priority_level === 'high'
                          ? 'bg-red-100 text-red-800'
                          : taskData.priority_level === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {taskData.priority_level} priority
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InlineEditField
                    fieldName="assigned_to_employee_name"
                    label="Assignment"
                    displayValue={taskData?.assigned_to_employee_name || 'Unassigned'}
                    canEdit={true}
                    isEditing={editingField === 'assigned_to_employee_name'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="planned_end_date"
                    label="Due Date"
                    displayValue={taskData?.planned_end_date ? new Date(taskData.planned_end_date).toLocaleDateString() : 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'planned_end_date'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'date',
                      rawValue: taskData?.planned_end_date?.split('T')[0] || ''
                    }}
                  />
                  <InlineEditField
                    fieldName="completion_percentage"
                    label="Progress (%)"
                    displayValue={`${taskData?.completion_percentage || 0}%`}
                    canEdit={true}
                    isEditing={editingField === 'completion_percentage'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'number',
                      rawValue: taskData?.completion_percentage || 0
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Task Description */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Description</h3>
              </div>
              <div className="px-6 py-4">
                <InlineEditField
                  fieldName="descr"
                  label="Task Description"
                  displayValue={taskData?.descr || 'No description provided'}
                  canEdit={canEdit}
                  isEditing={editingField === 'descr'}
                  editValue={editValue}
                  saving={saving}
                  onEdit={handleEditField}
                  onSave={handleSaveField}
                  onCancel={handleCancelEdit}
                  onValueChange={setEditValue}
                  options={{
                    type: 'textarea',
                    rawValue: taskData?.descr || ''
                  }}
                />
              </div>
            </div>

            {/* Task Details */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Task Details</h3>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Task Number</dt>
                    <dd className="text-sm text-gray-900">{taskData?.task_number || 'N/A'}</dd>
                  </div>
                  <InlineEditField
                    fieldName="task_status"
                    label="Status"
                    displayValue={taskData?.task_status || 'Open'}
                    canEdit={true}
                    isEditing={editingField === 'task_status'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Open', 'in_progress', 'completed', 'blocked', 'cancelled']
                    }}
                  />
                  <InlineEditField
                    fieldName="task_type"
                    label="Task Type"
                    displayValue={taskData?.task_type || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'task_type'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Development', 'Testing', 'Research', 'Design', 'Documentation', 'Review', 'Other']
                    }}
                  />
                  <InlineEditField
                    fieldName="task_category"
                    label="Category"
                    displayValue={taskData?.task_category || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'task_category'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="priority_level"
                    label="Priority"
                    displayValue={taskData?.priority_level || 'medium'}
                    canEdit={true}
                    isEditing={editingField === 'priority_level'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['low', 'medium', 'high', 'urgent']
                    }}
                  />
                  <InlineEditField
                    fieldName="estimated_hours"
                    label="Estimated Hours"
                    displayValue={taskData?.estimated_hours || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'estimated_hours'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'number',
                      rawValue: taskData?.estimated_hours || 0
                    }}
                  />
                  <InlineEditField
                    fieldName="actual_hours"
                    label="Actual Hours"
                    displayValue={taskData?.actual_hours || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'actual_hours'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'number',
                      rawValue: taskData?.actual_hours || 0
                    }}
                  />
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Project</dt>
                    <dd className="text-sm text-gray-900">{taskData?.project_name || 'N/A'}</dd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}