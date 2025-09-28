import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/Button';
import { ShareButton } from '../../components/common/ActionButtons';
import { Edit3, Check, X } from 'lucide-react';
import { businessApi } from '../../lib/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function BusinessDetailPage() {
  const { bizId } = useParams<{ bizId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useHeaderTabs('biz', bizId!);

  const [businessData, setBusinessData] = React.useState<any>(null);
  const [businessLoading, setBusinessLoading] = React.useState(true);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);

  // Check if user can edit this business as an action entity under any parent
  const [canEdit, setCanEdit] = React.useState<boolean>(false);
  const [permissionLoading, setPermissionLoading] = React.useState(true);

  React.useEffect(() => {
    const checkActionEntityPermission = async () => {
      if (!bizId) return;

      try {
        setPermissionLoading(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setCanEdit(false);
          return;
        }

        // Check if user has edit permission on this business
        console.log('Checking edit permission for business:', bizId);
        const response = await fetch(`${API_BASE_URL}/api/v1/rbac/check-permission-of-entity`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entityType: 'biz',
            entityId: bizId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Action entity permission response:', data);

          if (data.permissions && Array.isArray(data.permissions)) {
            // Find permissions for the specific business
            const entityPerm = data.permissions.find((p: any) => p.actionEntityId === bizId);
            const hasEditAction = entityPerm?.actions?.includes('edit') || false;
            setCanEdit(hasEditAction);
          } else {
            setCanEdit(false);
          }
        } else {
          console.log('Permission check failed:', response.status, response.statusText);
          setCanEdit(false);
        }
      } catch (error) {
        console.error('Permission check error:', error);
        setCanEdit(false);
      } finally {
        setPermissionLoading(false);
      }
    };

    checkActionEntityPermission();
  }, [bizId]);

  // Log when permission state changes
  React.useEffect(() => {
    if (!permissionLoading) {
      console.log('Final canEdit permission for business', bizId, ':', canEdit);
    }
  }, [permissionLoading, canEdit, bizId]);


  React.useEffect(() => {
    const fetchBusiness = async () => {
      if (!bizId) return;

      try {
        setBusinessLoading(true);
        const response = await businessApi.get(bizId);
        if (response) {
          console.log('Business data received:', response);
          setBusinessData(response);
        }
      } catch (error) {
        console.error('Error fetching business:', error);
      } finally {
        setBusinessLoading(false);
      }
    };

    fetchBusiness();
  }, [bizId]);

  const handleEditField = (fieldName: string, currentValue: string) => {
    if (!canEdit) return;
    setEditingField(fieldName);
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSaveField = async (fieldName: string) => {
    if (!bizId) return;

    try {
      setSaving(true);
      const updateData = { [fieldName]: editValue };

      await businessApi.update(bizId, updateData);

      // Update local state
      setBusinessData(prev => ({ ...prev, [fieldName]: editValue }));
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating business:', error);
      alert('Failed to update business. Please try again.');
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
              {canEdit && (
                <button
                  onClick={() => handleEditField(fieldName, rawValue !== undefined ? String(rawValue) : displayValue)}
                  className="ml-2 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Edit ${label.toLowerCase()}`}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </dd>
      </div>
    );
  };

  if (businessLoading || loading || permissionLoading) {
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
          title={businessData?.name || 'Business Unit'}
          parentType="biz"
          parentId={bizId!}
          parentName={businessData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/biz')}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <ShareButton
                onClick={() => console.log('Share business')}
                variant="secondary"
              />
            </div>
          }
        />

        {/* Business Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-6xl">
            {/* Business Header with Name */}
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
                          {businessData?.name || 'Unnamed Business'}
                        </h1>
                        {canEdit && (
                          <button
                            onClick={() => handleEditField('name', businessData?.name || '')}
                            className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit business name"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {businessData?.business_code && (
                      <p className="text-sm text-gray-500 mt-1">Code: {businessData.business_code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {businessData?.project_count || 0}
                </div>
                <div className="text-sm text-gray-500">Projects</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {businessData?.task_count || 0}
                </div>
                <div className="text-sm text-gray-500">Tasks</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {businessData?.artifact_count || 0}
                </div>
                <div className="text-sm text-gray-500">Artifacts</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {businessData?.wiki_count || 0}
                </div>
                <div className="text-sm text-gray-500">Wiki Pages</div>
              </div>
            </div>

            {/* Comprehensive Business Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {renderEditableField('business_code', 'Business Code', businessData?.business_code || 'Not set')}
                  {renderEditableField('business_type', 'Business Type', businessData?.business_type || 'Standard', {
                    type: 'select',
                    options: ['Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Non-Profit']
                  })}
                  {renderEditableField('industry', 'Industry', businessData?.industry || 'Not specified')}
                  {renderEditableField('parent_business_name', 'Parent Business', businessData?.parent_business_name || 'Not assigned')}
                </div>
              </div>

              {/* Status & Operational Info */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Status & Operations</h3>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {renderEditableField('status', 'Status', businessData?.status || 'Active', {
                    type: 'select',
                    options: ['Active', 'Inactive', 'Pending', 'Suspended'],
                    renderValue: (value) => (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        value === 'Active' ? 'bg-green-100 text-green-800' :
                        value === 'Inactive' ? 'bg-red-100 text-red-800' :
                        value === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        value === 'Suspended' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {value}
                      </span>
                    )
                  })}
                  {renderEditableField('established_date', 'Established Date',
                    businessData?.established_date ? new Date(businessData.established_date).toLocaleDateString() : 'Not set',
                    { type: 'date', rawValue: businessData?.established_date?.split('T')[0] || '' }
                  )}
                  {renderEditableField('primary_location', 'Primary Location', businessData?.primary_location || 'Not set')}
                  {renderEditableField('website', 'Website', businessData?.website || 'Not set')}
                </div>
              </div>

              {/* Business Description */}
              <div className="bg-white rounded-lg shadow lg:col-span-2">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Description</h3>
                </div>
                <div className="px-6 py-4">
                  {editingField === 'description' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={4}
                        placeholder="Enter business description..."
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSaveField('description')}
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
                          {businessData?.description || 'No description provided'}
                        </p>
                        {canEdit && (
                          <button
                            onClick={() => handleEditField('description', businessData?.description || '')}
                            className="ml-2 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit description"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}