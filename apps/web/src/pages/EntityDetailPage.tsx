import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../components/common/DynamicChildEntityTabs';
import { getEntityConfig } from '../lib/entityConfig';
import * as api from '../lib/api';

/**
 * Universal EntityDetailPage
 *
 * A single, reusable component that renders the detail page for ANY entity.
 * Integrates with DynamicChildEntityTabs for child entity navigation.
 *
 * Usage via routing:
 * - /project/:id -> EntityDetailPage with entityType="project"
 * - /task/:id -> EntityDetailPage with entityType="task"
 * - /wiki/:id -> EntityDetailPage with entityType="wiki"
 * etc.
 */

interface EntityDetailPageProps {
  entityType: string;
}

export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const config = getEntityConfig(entityType);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  // Fetch dynamic child entity tabs
  const { tabs, loading: tabsLoading } = useDynamicChildEntityTabs(entityType, id || '');

  // Determine current tab from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentChildEntity = pathParts.length > 2 ? pathParts[2] : null;
  const isOverviewTab = !currentChildEntity;

  // Prepare tabs with Overview as first tab - MUST be before any returns
  const allTabs = React.useMemo(() => {
    const overviewTab = {
      id: 'overview',
      label: 'Overview',
      path: `/${entityType}/${id}`,
      icon: undefined
    };

    // Filter out any "overview" tab that might come from the API to avoid duplicates
    const filteredTabs = (tabs || []).filter(tab =>
      tab.id !== 'overview' && tab.label?.toLowerCase() !== 'overview'
    );

    return [overviewTab, ...filteredTabs];
  }, [tabs, entityType, id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, entityType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Dynamic API call based on entity type
      const apiModule = (api as any)[`${entityType}Api`];
      if (!apiModule || !apiModule.get) {
        throw new Error(`API module for ${entityType} not found`);
      }

      const response = await apiModule.get(id);
      setData(response.data || response);
      setEditedData(response.data || response);
    } catch (err) {
      console.error(`Failed to load ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const apiModule = (api as any)[`${entityType}Api`];
      await apiModule.update(id, editedData);
      setData(editedData);
      setIsEditing(false);
      // Optionally show success toast
    } catch (err) {
      console.error(`Failed to update ${entityType}:`, err);
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleCancel = () => {
    setEditedData(data);
    setIsEditing(false);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  const handleBack = () => {
    navigate(`/${entityType}`);
  };

  const handleTabClick = (tabPath: string) => {
    if (tabPath === 'overview') {
      navigate(`/${entityType}/${id}`);
    } else {
      navigate(`/${entityType}/${id}/${tabPath}`);
    }
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">{error || 'Data not found'}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  // Render field based on configuration
  const renderField = (field: any) => {
    const value = isEditing ? editedData[field.key] : data[field.key];

    if (!isEditing) {
      // Display mode
      if (field.type === 'date' && value) {
        return new Date(value).toLocaleDateString();
      }
      if (field.type === 'select' && field.options) {
        const option = field.options.find((opt: any) => opt.value === value);
        return option?.label || value;
      }
      if (field.type === 'textarea' || field.type === 'richtext') {
        return <div className="whitespace-pre-wrap">{value || '-'}</div>;
      }
      if (field.type === 'array' && Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-2">
            {value.map((item, idx) => (
              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {item}
              </span>
            ))}
          </div>
        );
      }
      if (field.type === 'jsonb' && value) {
        return (
          <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }
      if (field.type === 'number' && field.prefix) {
        return `${field.prefix}${value || 0}`;
      }
      return value || '-';
    }

    // Edit mode
    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={field.disabled}
          />
        );
      case 'textarea':
      case 'richtext':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            rows={field.type === 'richtext' ? 6 : 4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={field.disabled}
          />
        );
      case 'array':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value.split(',').map(v => v.trim()).filter(Boolean))}
            placeholder="Enter comma-separated values"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={field.disabled}
          />
        );
      case 'jsonb':
        return (
          <textarea
            value={value ? JSON.stringify(value, null, 2) : ''}
            onChange={(e) => {
              try {
                handleFieldChange(field.key, JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, don't update
              }
            }}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            disabled={field.disabled}
          />
        );
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={field.disabled}
          >
            <option value="">Select...</option>
            {field.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={field.disabled}
          />
        );
      default:
        return <span>{value || '-'}</span>;
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">
                {data.name || data.title || `${config.displayName} Details`}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {config.displayName} · {id}
              </p>
            </div>
          </div>

          {/* Edit/Save/Cancel buttons */}
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Child Entity Tabs */}
        {allTabs && allTabs.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <DynamicChildEntityTabs
              title={data?.name || data?.title || config.displayName}
              parentType={entityType}
              parentId={id!}
              parentName={data?.name || data?.title}
              tabs={allTabs}
              showBackButton={false}
            />
          </div>
        )}

        {/* Content Area - Shows Overview or Child Entity Table */}
        {isOverviewTab ? (
          // Overview Tab - Entity Details
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {config.displayName} Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {config.fields.map((field) => (
                  <div key={field.key} className={field.type === 'textarea' || field.type === 'richtext' || field.type === 'jsonb' || field.type === 'array' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="text-gray-900">
                      {renderField(field)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Child Entity Tab - Filtered Data Table
          <Outlet />
        )}
      </div>
    </Layout>
  );
}

/**
 * Usage Examples:
 *
 * In routes:
 * <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
 *   <Route path="task" element={<EntityChildListPage entityType="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage entityType="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage entityType="artifact" />} />
 * </Route>
 *
 * <Route path="/task/:id" element={<EntityDetailPage entityType="task" />} />
 * <Route path="/wiki/:id" element={<EntityDetailPage entityType="wiki" />} />
 * <Route path="/artifact/:id" element={<EntityDetailPage entityType="artifact" />} />
 */
