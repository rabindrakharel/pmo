import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { ArrowLeft, Eye, Save, X } from 'lucide-react';
import { EntityTypeSelector } from '../../components/entity-builder/EntityTypeSelector';
import { ColumnEditor } from '../../components/entity-builder/ColumnEditor';
import { EntityLinkageEditor } from '../../components/entity-builder/EntityLinkageEditor';
import { IconDisplaySettings } from '../../components/entity-builder/IconDisplaySettings';
import { DDLPreviewModal } from '../../components/entity-builder/DDLPreviewModal';

interface ColumnDefinition {
  id: string;
  column_name: string;
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;
  required: boolean;
  order: number;
}

interface EntityDesignerData {
  entity_code: string;
  entity_name: string;
  entity_ui_label: string;
  entity_type: 'attribute' | 'transactional';
  columns: ColumnDefinition[];
  parent_entities: string[];
  child_entities: string[];
  ui_icon: string;
  display_order: number;
}

export function EntityDesignerPage() {
  const navigate = useNavigate();
  const { entityCode } = useParams<{ entityCode: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entityData, setEntityData] = useState<EntityDesignerData>({
    entity_code: entityCode || '',
    entity_name: '',
    entity_ui_label: '',
    entity_type: 'attribute',
    columns: [],
    parent_entities: [],
    child_entities: [],
    ui_icon: 'FileText',
    display_order: 999,
  });
  const [showDDLPreview, setShowDDLPreview] = useState(false);
  const [generatedDDL, setGeneratedDDL] = useState('');

  // Fetch entity metadata if it exists
  useEffect(() => {
    const fetchEntityMetadata = async () => {
      if (!entityCode) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const response = await fetch(`${apiBaseUrl}/api/v1/entity/codes/${entityCode}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setEntityData(prev => ({
            ...prev,
            entity_code: data.code,
            entity_name: data.name,
            entity_ui_label: data.ui_label,
            ui_icon: data.ui_icon || 'FileText',
            display_order: data.display_order || 999,
            child_entities: data.child_entities?.map((c: any) => c.entity) || [],
          }));
        }
      } catch (error) {
        console.error('Error fetching entity metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntityMetadata();
  }, [entityCode]);

  const handleEntityTypeChange = (type: 'attribute' | 'transactional') => {
    setEntityData(prev => ({ ...prev, entity_type: type }));
  };

  const handleColumnsChange = (columns: ColumnDefinition[]) => {
    setEntityData(prev => ({ ...prev, columns }));
  };

  const handleParentEntitiesChange = (parents: string[]) => {
    setEntityData(prev => ({ ...prev, parent_entities: parents }));
  };

  const handleChildEntitiesChange = (children: string[]) => {
    setEntityData(prev => ({ ...prev, child_entities: children }));
  };

  const handleIconChange = (icon: string) => {
    setEntityData(prev => ({ ...prev, ui_icon: icon }));
  };

  const handleDisplayOrderChange = (order: number) => {
    setEntityData(prev => ({ ...prev, display_order: order }));
  };

  const handlePreviewDDL = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/entity-builder/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entityData),
      });

      if (response.ok) {
        const result = await response.json();
        setGeneratedDDL(result.ddl);
        setShowDDLPreview(true);
      } else {
        const error = await response.json();
        alert(`Failed to generate DDL: ${error.error}`);
      }
    } catch (error) {
      console.error('Error generating DDL preview:', error);
      alert('Failed to generate DDL preview');
    }
  };

  const handleCreateEntity = async () => {
    // Validation
    if (!entityData.entity_code || !entityData.entity_name) {
      alert('Entity code and name are required');
      return;
    }

    if (entityData.columns.length === 0) {
      alert('Please add at least one column');
      return;
    }

    // Check for duplicate column names
    const columnNames = entityData.columns.map(c => c.column_name);
    const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      alert(`Duplicate column names found: ${duplicates.join(', ')}`);
      return;
    }

    if (!confirm(`Create entity "${entityData.entity_name}"?\n\nThis will:\n- Create database table\n- Generate API endpoints\n- Add to sidebar navigation\n\nContinue?`)) {
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const response = await fetch(`${apiBaseUrl}/api/v1/entity-builder/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entityData),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Success! Entity "${entityData.entity_name}" created.\n\nTable: ${result.data.table_name}\nAPI endpoints: ${result.data.api_endpoints.length} routes`);

        // Reload the page to refresh sidebar
        window.location.href = '/settings';
      } else {
        const error = await response.json();
        alert(`Failed to create entity: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating entity:', error);
      alert('Failed to create entity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (entityData.columns.length > 0) {
      if (!confirm('Discard changes and return to settings?')) {
        return;
      }
    }
    navigate('/settings');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-700"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-dark-600 hover:text-dark-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </button>

          <h1 className="text-2xl font-bold text-dark-900">Entity Database Designer</h1>
          <p className="text-dark-600 mt-1">
            Design your custom entity: <strong>{entityData.entity_name || entityData.entity_code}</strong>
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Section 1: Entity Type Selector */}
          <div className="bg-white rounded-md border border-dark-300 p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-4">1. Entity Type</h2>
            <p className="text-sm text-dark-600 mb-4">
              Choose what type of information this entity will store
            </p>
            <EntityTypeSelector
              value={entityData.entity_type}
              onChange={handleEntityTypeChange}
            />
          </div>

          {/* Section 2: Column Designer */}
          <div className="bg-white rounded-md border border-dark-300 p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-4">2. Define Columns</h2>
            <p className="text-sm text-dark-600 mb-4">
              Standard columns (id, code, name, created_ts, etc.) are included automatically.
              Add your custom columns below.
            </p>
            <ColumnEditor
              columns={entityData.columns}
              onChange={handleColumnsChange}
              entityCode={entityData.entity_type}
            />
          </div>

          {/* Section 3: Entity Linkage Editor */}
          <div className="bg-white rounded-md border border-dark-300 p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-4">3. Entity Relationships</h2>
            <p className="text-sm text-dark-600 mb-4">
              Define which entities this entity can be linked to
            </p>
            <EntityLinkageEditor
              parentEntities={entityData.parent_entities}
              childEntities={entityData.child_entities}
              onParentChange={handleParentEntitiesChange}
              onChildChange={handleChildEntitiesChange}
            />
          </div>

          {/* Section 4: Icon & Display Settings */}
          <div className="bg-white rounded-md border border-dark-300 p-6">
            <h2 className="text-lg font-semibold text-dark-900 mb-4">4. Display Settings</h2>
            <p className="text-sm text-dark-600 mb-4">
              Choose how this entity appears in the UI
            </p>
            <IconDisplaySettings
              icon={entityData.ui_icon}
              displayOrder={entityData.display_order}
              onIconChange={handleIconChange}
              onDisplayOrderChange={handleDisplayOrderChange}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-end gap-3 pb-8">
          <button
            onClick={handlePreviewDDL}
            className="flex items-center gap-2 px-4 py-2 border border-dark-300 rounded-md text-dark-700 hover:bg-dark-50"
          >
            <Eye className="h-4 w-4" />
            Preview SQL
          </button>

          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 border border-dark-300 rounded-md text-dark-700 hover:bg-dark-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>

          <button
            onClick={handleCreateEntity}
            disabled={saving || entityData.columns.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Creating...' : 'Create Entity'}
          </button>
        </div>
      </div>

      {/* DDL Preview Modal */}
      {showDDLPreview && (
        <DDLPreviewModal
          ddl={generatedDDL}
          entityName={entityData.entity_name}
          onClose={() => setShowDDLPreview(false)}
        />
      )}
    </Layout>
  );
}
