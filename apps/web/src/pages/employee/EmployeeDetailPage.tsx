import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { Edit3, Check, X } from 'lucide-react';
import { InlineEditField } from '../../components/common/InlineEditField';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('employee', employeeId!);
  // Permission checking removed - handled at API level via RBAC joins

  const [employeeData, setEmployeeData] = React.useState<any>(null);
  const [employeeLoading, setEmployeeLoading] = React.useState(true);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchEmployee = async () => {
      if (!employeeId) return;

      try {
        setEmployeeLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/v1/employee/${employeeId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Employee data received:', data);
          setEmployeeData(data);
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
      } finally {
        setEmployeeLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!employeeId) return;

    try {
      setSaving(true);
      const updateData = { [fieldName]: editValue };

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/employee/${employeeId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setEmployeeData(prev => ({ ...prev, [fieldName]: editValue }));
        setEditingField(null);
        setEditValue('');
      } else {
        console.error('Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Failed to update employee. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (employeeLoading || loading) {
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
          title={employeeData?.name || 'Employee'}
          parentType="employee"
          parentId={employeeId!}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/')}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit Profile
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                View Performance
              </button>
            </div>
          }
        />

        {/* Employee Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Employee Information */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {employeeData?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                    </span>
                  </div>
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
                        <h3 className="text-xl font-semibold text-gray-900">{employeeData?.name || 'Employee'}</h3>
                        <button
                          onClick={() => handleEditField('name', employeeData?.name || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit employee name"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-gray-600">{employeeData?.email}</p>
                    <p className="text-sm text-gray-500">{employeeData?.job_title || 'Position not set'}</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Employee ID</dt>
                    <dd className="text-sm text-gray-900">{employeeData?.employee_id || employeeData?.id}</dd>
                  </div>
                  <InlineEditField
                    fieldName="active"
                    label="Status"
                    displayValue={employeeData?.active ? 'Active' : 'Inactive'}
                    canEdit={true}
                    isEditing={editingField === 'active'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Active', 'Inactive'],
                      renderValue: (value) => (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          value === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {value}
                        </span>
                      )
                    }}
                  />
                  <InlineEditField
                    fieldName="department"
                    label="Department"
                    displayValue={employeeData?.department || 'Not assigned'}
                    canEdit={true}
                    isEditing={editingField === 'department'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="manager_name"
                    label="Manager"
                    displayValue={employeeData?.manager_name || 'Not assigned'}
                    canEdit={true}
                    isEditing={editingField === 'manager_name'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="start_date"
                    label="Start Date"
                    displayValue={employeeData?.start_date ? new Date(employeeData.start_date).toLocaleDateString() : 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'start_date'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'date',
                      rawValue: employeeData?.start_date?.split('T')[0] || ''
                    }}
                  />
                  <InlineEditField
                    fieldName="phone"
                    label="Phone"
                    displayValue={employeeData?.phone || 'Not provided'}
                    canEdit={true}
                    isEditing={editingField === 'phone'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="job_title"
                    label="Job Title"
                    displayValue={employeeData?.job_title || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'job_title'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="email"
                    label="Email"
                    displayValue={employeeData?.email || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'email'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'text'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}