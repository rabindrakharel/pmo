import React, { useState, useEffect } from 'react';
import { X, Save, Eye, AlertCircle } from 'lucide-react';
import { ColumnEditor } from '../entity-builder/ColumnEditor';
import { IconDisplaySettings } from '../entity-builder/IconDisplaySettings';

interface ColumnDefinition {
  id: string;
  column_name: string;
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;
  required: boolean;
  order: number;
}

interface EntityConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityCode: string;
  entityName: string;
  onSave?: () => void;
}

interface EntityMetadata {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  display_order: number;
  child_entities: any[];
  columns?: ColumnDefinition[];
}

export function EntityConfigurationModal({
  isOpen,
  onClose,
  entityCode,
  entityName,
  onSave,
}: EntityConfigurationModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entityData, setEntityData] = useState<EntityMetadata>({
    code: entityCode,
    name: entityName,
    ui_label: entityName,
    ui_icon: 'FileText',
    display_order: 999,
    child_entities: [],
    columns: [],
  });
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'columns' | 'display'>('columns');
  const [error, setError] = useState<string | null>(null);

  // Fetch entity metadata
  useEffect(() => {
    if (!isOpen || !entityCode) return;

    const fetchEntityMetadata = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const response = await fetch(`${apiBaseUrl}/api/v1/entity/type/${entityCode}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setEntityData({
            code: data.code,
            name: data.name,
            ui_label: data.ui_label,
            ui_icon: data.ui_icon || 'FileText',
            display_order: data.display_order || 999,
            child_entities: data.child_entities || [],
            columns: data.columns || [],
          });

          // Set columns if they exist in metadata
          if (data.columns && Array.isArray(data.columns)) {
            setColumns(data.columns);
          }
        } else {
          setError('Failed to fetch entity metadata');
        }
      } catch (err) {
        console.error('Error fetching entity metadata:', err);
        setError('Failed to fetch entity metadata');
      } finally {
        setLoading(false);
      }
    };

    fetchEntityMetadata();
  }, [isOpen, entityCode]);

  const handleSave = async () => {
    // Validation
    if (columns.length === 0) {
      setError('Please add at least one column');
      return;
    }

    // Check for duplicate column names
    const columnNames = columns.map(c => c.column_name);
    const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate column names found: ${duplicates.join(', ')}`);
      return;
    }

    if (!confirm(`Update entity "${entityData.name}" configuration?\n\nThis will update the entity metadata with the new column definitions.\n\nContinue?`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const payload = {
        code: entityData.code,
        name: entityData.name,
        ui_label: entityData.ui_label,
        ui_icon: entityData.ui_icon,
        display_order: entityData.display_order,
        columns: columns,
      };

      const response = await fetch(`${apiBaseUrl}/api/v1/entity/type/${entityCode}/configure`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(`Success! Entity "${entityData.name}" configuration updated.`);
        onSave?.();
        onClose();
      } else {
        const error = await response.json();
        setError(`Failed to update entity: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating entity:', err);
      setError('Failed to update entity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-dark-300 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-dark-900">Configure Entity: {entityName}</h2>
            <p className="text-sm text-dark-600 mt-1">
              Code: <span className="font-mono text-dark-700">{entityCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-600 hover:text-dark-900"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-dark-300 px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('columns')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'columns'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-dark-600 hover:text-dark-900'
              }`}
            >
              Columns & Fields
            </button>
            <button
              onClick={() => setActiveTab('display')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'display'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-dark-600 hover:text-dark-900'
              }`}
            >
              Display Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'columns' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-dark-700 mb-2">
                      Entity Columns Configuration
                    </h3>
                    <p className="text-sm text-dark-600">
                      Define custom columns for this entity. Standard columns (id, code, name, etc.) are auto-included.
                    </p>
                  </div>
                  <ColumnEditor
                    columns={columns}
                    onChange={setColumns}
                    entityType="attribute"
                  />
                </div>
              )}

              {activeTab === 'display' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-dark-700 mb-2">
                      Display Settings
                    </h3>
                    <p className="text-sm text-dark-600">
                      Configure how this entity appears in the UI (icon, display order).
                    </p>
                  </div>
                  <IconDisplaySettings
                    icon={entityData.ui_icon}
                    displayOrder={entityData.display_order}
                    onIconChange={(icon) => setEntityData(prev => ({ ...prev, ui_icon: icon }))}
                    onDisplayOrderChange={(order) => setEntityData(prev => ({ ...prev, display_order: order }))}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-300 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-dark-300 rounded-md text-dark-700 hover:bg-dark-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || columns.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
