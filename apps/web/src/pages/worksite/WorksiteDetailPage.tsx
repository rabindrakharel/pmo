import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/Button';

export function WorksiteDetailPage() {
  const { worksiteId } = useParams<{ worksiteId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useHeaderTabs('worksite', worksiteId!);

  // Mock worksite data - replace with actual API call
  const [worksiteData, setWorksiteData] = React.useState<any>(null);
  const [worksiteLoading, setWorksiteLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchWorksite = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/v1/worksite/${worksiteId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setWorksiteData(data);
        }
      } catch (error) {
        console.error('Error fetching worksite:', error);
      } finally {
        setWorksiteLoading(false);
      }
    };

    if (worksiteId) {
      fetchWorksite();
    }
  }, [worksiteId]);

  if (worksiteLoading || loading) {
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
        <HeaderTabNavigation
          title={worksiteData?.name || 'Worksite'}
          parentType="worksite"
          parentId={worksiteId!}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/')}
        />

        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit Worksite
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                View Location
              </button>
            </div>
          }
        />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Worksite Header with Name */}
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
                          {worksiteData?.name || 'Unnamed Worksite'}
                        </h1>
                        {canEdit && (
                          <button
                            onClick={() => handleEditField('name', worksiteData?.name || '')}
                            className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit worksite name"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {worksiteData?.worksite_code && (
                      <p className="text-sm text-gray-500 mt-1">Code: {worksiteData.worksite_code}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Worksite Information */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Worksite Information</h3>
              </div>
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InlineEditField
                    fieldName="worksite_code"
                    label="Worksite Code"
                    displayValue={worksiteData?.worksite_code || 'Not set'}
                    canEdit={canEdit}
                    isEditing={editingField === 'worksite_code'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="active"
                    label="Status"
                    displayValue={worksiteData?.active ? 'Active' : 'Inactive'}
                    canEdit={canEdit}
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
                    fieldName="location"
                    label="Location"
                    displayValue={worksiteData?.location || 'Not specified'}
                    canEdit={canEdit}
                    isEditing={editingField === 'location'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                  />
                  <InlineEditField
                    fieldName="worksite_type"
                    label="Worksite Type"
                    displayValue={worksiteData?.worksite_type || 'Not specified'}
                    canEdit={canEdit}
                    isEditing={editingField === 'worksite_type'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'select',
                      options: ['Office', 'Warehouse', 'Factory', 'Construction Site', 'Remote', 'Other']
                    }}
                  />
                  <InlineEditField
                    fieldName="description"
                    label="Description"
                    displayValue={worksiteData?.description || 'No description provided'}
                    canEdit={canEdit}
                    isEditing={editingField === 'description'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
                    options={{
                      type: 'textarea',
                      rawValue: worksiteData?.description || ''
                    }}
                  />
                  <InlineEditField
                    fieldName="contact_info"
                    label="Contact Information"
                    displayValue={worksiteData?.contact_info || 'Not provided'}
                    canEdit={canEdit}
                    isEditing={editingField === 'contact_info'}
                    editValue={editValue}
                    saving={saving}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                    onValueChange={setEditValue}
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