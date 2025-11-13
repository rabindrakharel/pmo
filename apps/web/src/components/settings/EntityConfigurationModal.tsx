import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Database, Eye, Tag } from 'lucide-react';
import { ColumnMetadataEditor, ColumnMetadata } from '../entity-builder/ColumnMetadataEditor';
import { IconDisplaySettings } from '../entity-builder/IconDisplaySettings';
import { SettingsDataTable } from '../shared/ui/SettingsDataTable';

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
  dl_entity_domain: string | null;
  child_entities: any[];
  column_metadata: ColumnMetadata[];
  data_labels: string[];
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
    dl_entity_domain: null,
    child_entities: [],
    column_metadata: [],
    data_labels: [],
  });
  const [availableDataLabels, setAvailableDataLabels] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'metadata' | 'datalabels' | 'uiux'>('metadata');
  const [activeDataLabel, setActiveDataLabel] = useState<string | null>(null);
  const [activeDatalabelData, setActiveDatalabelData] = useState<any[]>([]);
  const [loadingDatalabel, setLoadingDatalabel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entity metadata including column_metadata
  useEffect(() => {
    if (!isOpen || !entityCode) return;

    const fetchEntityMetadata = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        // Fetch from domains API to get column_metadata
        const response = await fetch(`${apiBaseUrl}/api/v1/entity/domains`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Find the entity in the domains response
          let foundEntity = null;
          for (const domain of data.domains) {
            const entity = domain.entities.find((e: any) => e.code === entityCode);
            if (entity) {
              foundEntity = entity;
              break;
            }
          }

          if (foundEntity) {
            setEntityData({
              code: foundEntity.code,
              name: foundEntity.name,
              ui_label: foundEntity.ui_label,
              ui_icon: foundEntity.ui_icon || 'FileText',
              display_order: foundEntity.display_order || 999,
              dl_entity_domain: foundEntity.dl_entity_domain || null,
              child_entities: foundEntity.child_entities || [],
              column_metadata: foundEntity.column_metadata || [],
              data_labels: foundEntity.data_labels || [],
            });
          } else {
            setError(`Entity "${entityCode}" not found`);
          }
        } else {
          setError('Failed to fetch entity metadata');
        }

        // Fetch all available data labels for this entity
        const dataLabelsResponse = await fetch(`${apiBaseUrl}/api/v1/setting/datalabels`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (dataLabelsResponse.ok) {
          const allDataLabels = await dataLabelsResponse.json();
          // Filter to only show data labels that match the entity code
          const entityDataLabels = allDataLabels
            .filter((label: any) => {
              const match = label.datalabel_name.match(/^dl__([^_]+)_/);
              return match && match[1] === entityCode;
            })
            .map((label: any) => label.datalabel_name);

          setAvailableDataLabels(entityDataLabels);
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

  // Fetch datalabel data when activeDataLabel changes
  useEffect(() => {
    if (!activeDataLabel) {
      setActiveDatalabelData([]);
      return;
    }

    const fetchDatalabelData = async () => {
      setLoadingDatalabel(true);
      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const response = await fetch(`${apiBaseUrl}/api/v1/setting?datalabel=${activeDataLabel}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          setActiveDatalabelData(result.data || []);
        } else {
          console.error('Failed to fetch datalabel data:', response.statusText);
          setActiveDatalabelData([]);
        }
      } catch (err) {
        console.error('Error fetching datalabel data:', err);
        setActiveDatalabelData([]);
      } finally {
        setLoadingDatalabel(false);
      }
    };

    fetchDatalabelData();
  }, [activeDataLabel]);

  const handleSave = async () => {
    // Validation
    if (entityData.column_metadata.length === 0) {
      setError('Please add at least one column');
      return;
    }

    // Check for duplicate column names
    const columnNames = entityData.column_metadata.map(c => c.name.toLowerCase());
    const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate column names found: ${duplicates.join(', ')}`);
      return;
    }

    if (!confirm(
      `Update "${entityData.name}" configuration?\n\n` +
      `This will update the entity metadata with ${entityData.column_metadata.length} columns.\n\n` +
      `Continue?`
    )) {
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
        dl_entity_domain: entityData.dl_entity_domain,
        column_metadata: entityData.column_metadata,
        data_labels: entityData.data_labels,
      };

      const response = await fetch(`${apiBaseUrl}/api/v1/entity/${entityCode}/configure`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(
          `Success! Entity "${entityData.name}" updated.\n\n` +
          `Columns: ${entityData.column_metadata.length}\n` +
          `Display Order: ${entityData.display_order}\n` +
          `Icon: ${entityData.ui_icon}`
        );
        onSave?.();
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(`Failed to update entity: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating entity:', err);
      setError('Failed to update entity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleColumnMetadataChange = (newColumns: ColumnMetadata[]) => {
    setEntityData(prev => ({
      ...prev,
      column_metadata: newColumns,
    }));
  };

  // Helper function to format data label names for display
  const formatDataLabelName = (datalabelName: string) => {
    return datalabelName.replace(/^dl__/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Set first data label as active when switching to datalabels tab
  useEffect(() => {
    if (activeTab === 'datalabels' && availableDataLabels.length > 0) {
      if (!activeDataLabel || !availableDataLabels.includes(activeDataLabel)) {
        setActiveDataLabel(availableDataLabels[0]);
      }
    }
  }, [activeTab, availableDataLabels, activeDataLabel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-dark-300 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-dark-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-600" />
              Configure Entity: {entityName}
            </h2>
            <p className="text-sm text-dark-600 mt-1">
              Code: <span className="font-mono text-dark-700 bg-dark-100 px-2 py-0.5 rounded">{entityCode}</span>
              {entityData.dl_entity_domain && (
                <>
                  {' • '}
                  Domain: <span className="font-medium text-dark-700">{entityData.dl_entity_domain}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-dark-600 hover:text-dark-900 p-2 hover:bg-dark-100 rounded-lg transition-colors"
            title="Close"
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

        {/* Main Tabs (First Level) */}
        <div className="px-6 py-4 bg-dark-50 border-b border-dark-300">
          <div className="flex flex-wrap gap-2">
            {/* Metadata Tab */}
            <button
              onClick={() => setActiveTab('metadata')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'metadata'
                  ? 'bg-slate-600 text-white shadow-md'
                  : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Database className="h-4 w-4" />
              Metadata
            </button>

            {/* Data Labels Tab */}
            <button
              onClick={() => setActiveTab('datalabels')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'datalabels'
                  ? 'bg-slate-600 text-white shadow-md'
                  : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Tag className="h-4 w-4" />
              Data Labels
              {availableDataLabels.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === 'datalabels'
                    ? 'bg-white/20 text-white'
                    : 'bg-dark-300 text-dark-700'
                }`}>
                  {availableDataLabels.length}
                </span>
              )}
            </button>

            {/* UI/UX Tab */}
            <button
              onClick={() => setActiveTab('uiux')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'uiux'
                  ? 'bg-slate-600 text-white shadow-md'
                  : 'bg-dark-100 text-dark-700 border border-dark-300 hover:border-dark-400'
              }`}
            >
              <Eye className="h-4 w-4" />
              UI/UX
            </button>
          </div>
        </div>

        {/* Sub-Tabs (Second Level) - Only shown when Data Labels tab is active */}
        {activeTab === 'datalabels' && availableDataLabels.length > 0 && (
          <div className="px-6 py-3 bg-blue-50/50 border-b border-dark-200">
            <div className="flex flex-wrap gap-2">
              {availableDataLabels.map((datalabelName) => (
                <button
                  key={datalabelName}
                  onClick={() => setActiveDataLabel(datalabelName)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    activeDataLabel === datalabelName
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-dark-600 border border-dark-300 hover:border-dark-400'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {formatDataLabelName(datalabelName)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-dark-50 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-dark-600">Loading entity configuration...</p>
            </div>
          ) : (
            <>
              {/* Metadata Tab Content */}
              {activeTab === 'metadata' && (
                <div className="bg-white rounded-lg border border-dark-300 p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-dark-900 mb-2">
                      Metadata
                    </h3>
                    <p className="text-sm text-dark-600">
                      Configure the database schema for <strong>{entityData.name}</strong>.
                      Add, edit, reorder, or delete columns. Changes will update the d_entity.column_metadata field.
                    </p>
                  </div>
                  <ColumnMetadataEditor
                    columns={entityData.column_metadata}
                    onChange={handleColumnMetadataChange}
                    entityCode={entityCode}
                  />
                </div>
              )}

              {/* Data Labels Tab Content - shows SettingsDataTable for active data label */}
              {activeTab === 'datalabels' && (
                <div className="bg-white rounded-lg border border-dark-300 p-6">
                  {activeDataLabel ? (
                    loadingDatalabel ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-sm text-dark-600">Loading {formatDataLabelName(activeDataLabel)} data...</p>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-4">
                          <h3 className="text-lg font-medium text-dark-900">
                            {formatDataLabelName(activeDataLabel)}
                          </h3>
                          <p className="text-sm text-dark-600">
                            Manage values for this data label. Add, edit, or reorder items as needed.
                          </p>
                        </div>
                        <SettingsDataTable
                          data={activeDatalabelData}
                          onRowUpdate={async (id, updates) => {
                            // Update the local data optimistically
                            setActiveDatalabelData(prev =>
                              prev.map(item => item.id === id ? { ...item, ...updates } : item)
                            );

                            // Make API call to update the setting
                            try {
                              const token = localStorage.getItem('auth_token');
                              const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

                              const response = await fetch(`${apiBaseUrl}/api/v1/setting/${id}`, {
                                method: 'PUT',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  ...updates,
                                  datalabel: activeDataLabel
                                }),
                              });

                              if (!response.ok) {
                                console.error('Failed to update setting:', response.statusText);
                                // Revert the optimistic update on error
                                const fetchDatalabelData = async () => {
                                  const res = await fetch(`${apiBaseUrl}/api/v1/setting?datalabel=${activeDataLabel}`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`,
                                      'Content-Type': 'application/json',
                                    },
                                  });
                                  if (res.ok) {
                                    const result = await res.json();
                                    setActiveDatalabelData(result.data || []);
                                  }
                                };
                                fetchDatalabelData();
                              }
                            } catch (err) {
                              console.error('Error updating setting:', err);
                            }
                          }}
                          onAddRow={async (newRecord) => {
                            // Make API call to add new setting
                            try {
                              const token = localStorage.getItem('auth_token');
                              const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

                              const response = await fetch(`${apiBaseUrl}/api/v1/setting`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  ...newRecord,
                                  datalabel: activeDataLabel
                                }),
                              });

                              if (response.ok) {
                                const result = await response.json();
                                // Refresh the data to get the new record with ID
                                const fetchDatalabelData = async () => {
                                  const res = await fetch(`${apiBaseUrl}/api/v1/setting?datalabel=${activeDataLabel}`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`,
                                      'Content-Type': 'application/json',
                                    },
                                  });
                                  if (res.ok) {
                                    const result = await res.json();
                                    setActiveDatalabelData(result.data || []);
                                  }
                                };
                                fetchDatalabelData();
                              } else {
                                console.error('Failed to add setting:', response.statusText);
                              }
                            } catch (err) {
                              console.error('Error adding setting:', err);
                            }
                          }}
                          onDeleteRow={async (id) => {
                            // Make API call to delete setting
                            if (!confirm('Are you sure you want to delete this setting?')) {
                              return;
                            }

                            try {
                              const token = localStorage.getItem('auth_token');
                              const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

                              const response = await fetch(`${apiBaseUrl}/api/v1/setting/${id}`, {
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json',
                                },
                              });

                              if (response.ok) {
                                // Remove from local data
                                setActiveDatalabelData(prev => prev.filter(item => item.id !== id));
                              } else {
                                console.error('Failed to delete setting:', response.statusText);
                              }
                            } catch (err) {
                              console.error('Error deleting setting:', err);
                            }
                          }}
                          allowAddRow={true}
                          allowEdit={true}
                          allowDelete={true}
                          allowReorder={true}
                        />
                      </div>
                    )
                  ) : availableDataLabels.length === 0 ? (
                    <div className="text-center py-12">
                      <Tag className="h-12 w-12 text-dark-300 mx-auto mb-4" />
                      <p className="text-dark-600 mb-2">No data labels found for this entity</p>
                      <p className="text-sm text-dark-500">
                        Data labels must be named <span className="font-mono">dl__{entityCode}_*</span>
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-sm text-dark-600">Loading data labels...</p>
                    </div>
                  )}
                </div>
              )}

              {/* UI/UX Tab Content */}
              {activeTab === 'uiux' && (
                <div className="bg-white rounded-lg border border-dark-300 p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-dark-900 mb-2">
                      Display Settings
                    </h3>
                    <p className="text-sm text-dark-600">
                      Configure how <strong>{entityData.name}</strong> appears in the UI (icon, display order, label).
                    </p>
                  </div>
                  <IconDisplaySettings
                    icon={entityData.ui_icon}
                    displayOrder={entityData.display_order}
                    onIconChange={(icon) => setEntityData(prev => ({ ...prev, ui_icon: icon }))}
                    onDisplayOrderChange={(order) => setEntityData(prev => ({ ...prev, display_order: order }))}
                  />

                  {/* Additional settings */}
                  <div className="mt-6 space-y-4 border-t border-dark-300 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-dark-700 mb-2">
                        UI Label (Plural)
                      </label>
                      <input
                        type="text"
                        value={entityData.ui_label}
                        onChange={(e) => setEntityData(prev => ({ ...prev, ui_label: e.target.value }))}
                        className="w-full px-3 py-2 border border-dark-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Projects, Tasks, Employees"
                      />
                      <p className="text-xs text-dark-500 mt-1">
                        Used in navigation menus and list headers
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 mb-2">
                        Display Name (Singular)
                      </label>
                      <input
                        type="text"
                        value={entityData.name}
                        onChange={(e) => setEntityData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-dark-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Project, Task, Employee"
                      />
                      <p className="text-xs text-dark-500 mt-1">
                        Used in forms and detail pages
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 mb-2">
                        Domain
                      </label>
                      <select
                        value={entityData.dl_entity_domain || ''}
                        onChange={(e) => setEntityData(prev => ({ ...prev, dl_entity_domain: e.target.value || null }))}
                        className="w-full px-3 py-2 border border-dark-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Select Domain --</option>
                        <option value="Core Management">Core Management</option>
                        <option value="Organization">Organization</option>
                        <option value="Business">Business</option>
                        <option value="Operations">Operations</option>
                        <option value="Customers">Customers</option>
                        <option value="Retail">Retail</option>
                        <option value="Sales & Finance">Sales & Finance</option>
                        <option value="Content & Docs">Content & Docs</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                      <p className="text-xs text-dark-500 mt-1">
                        Business domain for organizational purposes
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-300 flex items-center justify-between bg-white">
          <div className="text-sm text-dark-600">
            {entityData.column_metadata.length} columns configured • {availableDataLabels.length} data labels available
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-dark-300 rounded-md text-dark-700 hover:bg-dark-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || entityData.column_metadata.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
