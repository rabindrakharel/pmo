import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/Button';
import { Edit3, Check, X } from 'lucide-react';
import { roleApi } from '../../lib/api';
import { InlineEditField } from '../../components/common/InlineEditField';

export function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useHeaderTabs('role', roleId!);
  // Permission checking removed - handled at API level via RBAC joins

  const [roleData, setRoleData] = React.useState<any>(null);
  const [roleLoading, setRoleLoading] = React.useState(true);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchRole = async () => {
      if (!roleId) return;

      try {
        setRoleLoading(true);
        const response = await roleApi.get(roleId);
        if (response) {
          console.log('Role data received:', response);
          setRoleData(response);
        }
      } catch (error) {
        console.error('Error fetching role:', error);
      } finally {
        setRoleLoading(false);
      }
    };

    fetchRole();
  }, [roleId]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!roleId) return;

    try {
      setSaving(true);
      const updateData = { [fieldName]: editValue };

      await roleApi.update(roleId, updateData);

      // Update local state
      setRoleData(prev => ({ ...prev, [fieldName]: editValue }));
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (roleLoading || loading) {
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
          title={roleData?.name || 'Role'}
          parentType="role"
          parentId={roleId!}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/')}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Manage Permissions
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Assign Employees
              </button>
            </div>
          }
        />

        {/* Role Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl">
            {/* Role Header with Name */}
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
                          {roleData?.name || 'Unnamed Role'}
                        </h1>
                        <button
                          onClick={() => handleEditField('name', roleData?.name || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit role name"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {roleData?.role_code && (
                      <p className="text-sm text-gray-500 mt-1">Code: {roleData.role_code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Role Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {roleData?.employee_count || 0}
                </div>
                <div className="text-sm text-gray-500">Assigned Employees</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {roleData?.permission_count || 0}
                </div>
                <div className="text-sm text-gray-500">Permissions</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {roleData?.access_level || 'Standard'}
                </div>
                <div className="text-sm text-gray-500">Access Level</div>
              </div>
            </div>

            {/* Comprehensive Role Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <InlineEditField
                    fieldName="role_code"
                    label="Role Code"
                    displayValue={roleData?.role_code || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'role_code'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="role_type"
                    label="Role Type"
                    displayValue={roleData?.role_type || 'Standard'}
                    canEdit={true}
                    isEditing={editingField === 'role_type'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Administrative', 'Manager', 'Supervisor', 'Analyst', 'Specialist', 'Coordinator', 'Standard']
                    }}
                  />
                  <InlineEditField
                    fieldName="department"
                    label="Department"
                    displayValue={roleData?.department || 'All Departments'}
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
                    fieldName="access_level"
                    label="Access Level"
                    displayValue={roleData?.access_level || 'Standard'}
                    canEdit={true}
                    isEditing={editingField === 'access_level'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Basic', 'Standard', 'Advanced', 'Admin', 'Super Admin']
                    }}
                  />
                </div>
              </div>

              {/* Status & Dates */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Status & Dates</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <InlineEditField
                    fieldName="active"
                    label="Status"
                    displayValue={roleData?.active ? 'Active' : 'Inactive'}
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
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Created Date</dt>
                    <dd className="text-sm text-gray-900">
                      {roleData?.created ? new Date(roleData.created).toLocaleDateString() : 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Last Modified</dt>
                    <dd className="text-sm text-gray-900">
                      {roleData?.updated ? new Date(roleData.updated).toLocaleDateString() : 'Unknown'}
                    </dd>
                  </div>
                </div>
              </div>

              {/* Role Description */}
              <div className="bg-white rounded-lg shadow lg:col-span-2">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Role Description</h3>
                </div>
                <div className="px-6 py-4">
                  <InlineEditField
                    fieldName="description"
                    label="Role Description"
                    displayValue={roleData?.description || 'No description provided'}
                    canEdit={true}
                    isEditing={editingField === 'description'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'textarea',
                      rawValue: roleData?.description || ''
                    }}
                  />
                </div>
              </div>

              {/* Permissions Overview */}
              {roleData?.permissions && roleData.permissions.length > 0 && (
                <div className="bg-white rounded-lg shadow lg:col-span-2">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Key Permissions</h3>
                  </div>
                  <div className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {roleData.permissions.slice(0, 10).map((permission: string, index: number) => (
                        <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {permission}
                        </span>
                      ))}
                      {roleData.permissions.length > 10 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          +{roleData.permissions.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}