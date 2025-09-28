import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { Edit3, Check, X } from 'lucide-react';
import { orgApi } from '../../lib/api';
import { InlineEditField } from '../../components/common/InlineEditField';

export function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('org', orgId!);
  // Permission checking removed - handled at API level via RBAC joins

  const [orgData, setOrgData] = React.useState<any>(null);
  const [orgLoading, setOrgLoading] = React.useState(true);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchOrganization = async () => {
      if (!orgId) return;

      try {
        setOrgLoading(true);
        const response = await orgApi.get(orgId);
        if (response) {
          console.log('Organization data received:', response);
          setOrgData(response);
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      } finally {
        setOrgLoading(false);
      }
    };

    fetchOrganization();
  }, [orgId]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!orgId) return;

    try {
      setSaving(true);
      const updateData = { [fieldName]: editValue };

      await orgApi.update(orgId, updateData);

      // Update local state
      setOrgData(prev => ({ ...prev, [fieldName]: editValue }));
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating organization:', error);
      alert('Failed to update organization. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || loading) {
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
          title={orgData?.name || 'Organization Details'}
          parentType="org"
          parentId={orgId!}
          parentName={orgData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/org')}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                View Territory Map
              </button>
            </div>
          }
        />

        {/* Organization Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl">
            {/* Organization Header with Name */}
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
                          {orgData?.name || 'Unnamed Organization'}
                        </h1>
                        <button
                          onClick={() => handleEditField('name', orgData?.name || '')}
                          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit organization name"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {orgData?.org_code && (
                      <p className="text-sm text-gray-500 mt-1">Code: {orgData.org_code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Organization Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.worksite_count || 0}
                </div>
                <div className="text-sm text-gray-500">Worksites</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.employee_count || 0}
                </div>
                <div className="text-sm text-gray-500">Employees</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.territory_size || 0}
                </div>
                <div className="text-sm text-gray-500">Territory (km²)</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.active_projects || 0}
                </div>
                <div className="text-sm text-gray-500">Active Projects</div>
              </div>
            </div>

            {/* Comprehensive Organization Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <InlineEditField
                    fieldName="org_code"
                    label="Organization Code"
                    displayValue={orgData?.org_code || 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'org_code'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="org_type"
                    label="Organization Type"
                    displayValue={orgData?.org_type || 'Not specified'}
                    canEdit={true}
                    isEditing={editingField === 'org_type'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Department', 'Division', 'Branch', 'Subsidiary', 'Office', 'Region']
                    }}
                  />
                  <InlineEditField
                    fieldName="location"
                    label="Location"
                    displayValue={orgData?.location || 'Not specified'}
                    canEdit={true}
                    isEditing={editingField === 'location'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="parent_org_name"
                    label="Parent Organization"
                    displayValue={orgData?.parent_org_name || 'Root organization'}
                    canEdit={true}
                    isEditing={editingField === 'parent_org_name'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                </div>
              </div>

              {/* Status & Contact Information */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Status & Contact</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <InlineEditField
                    fieldName="active"
                    label="Status"
                    displayValue={orgData?.active ? 'Active' : 'Inactive'}
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
                    fieldName="established_date"
                    label="Established Date"
                    displayValue={orgData?.established_date ? new Date(orgData.established_date).toLocaleDateString() : 'Not specified'}
                    canEdit={true}
                    isEditing={editingField === 'established_date'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'date',
                      rawValue: orgData?.established_date?.split('T')[0] || ''
                    }}
                  />
                  <InlineEditField
                    fieldName="contact_info"
                    label="Contact Information"
                    displayValue={orgData?.contact_info || 'Not provided'}
                    canEdit={true}
                    isEditing={editingField === 'contact_info'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="territory_size"
                    label="Territory Size (km²)"
                    displayValue={orgData?.territory_size ? `${orgData.territory_size} km²` : 'Not set'}
                    canEdit={true}
                    isEditing={editingField === 'territory_size'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'number',
                      rawValue: orgData?.territory_size || 0
                    }}
                  />
                </div>
              </div>

              {/* Organization Description */}
              <div className="bg-white rounded-lg shadow lg:col-span-2">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Description</h3>
                </div>
                <div className="px-6 py-4">
                  <InlineEditField
                    fieldName="description"
                    label="Organization Description"
                    displayValue={orgData?.description || 'No description provided'}
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
                      rawValue: orgData?.description || ''
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