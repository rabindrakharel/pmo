import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/shared';
import { Link as LinkIcon, Plus, Trash2, Eye, AlertCircle, Save, X } from 'lucide-react';

interface EntityType {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string | null;
  child_entities: ChildEntity[];
  display_order: number;
  active_flag: boolean;
}

interface ChildEntity {
  entity: string;
  ui_icon: string;
  ui_label: string;
  order: number;
}

interface EntityPreviewProps {
  entityType: EntityType;
  onClose: () => void;
}

/**
 * Entity Preview Modal
 * Shows a preview of how the entity detail page will look with current child tabs
 */
function EntityPreviewModal({ entityType, onClose }: EntityPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-dark-100 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-dark-700" />
            <h2 className="text-lg font-semibold text-dark-600">
              Entity Preview: {entityType.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-700 hover:text-dark-600 hover:bg-dark-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Entity Header Mockup */}
          <div className="mb-6 p-6 bg-dark-100 rounded-lg border border-dark-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-dark-600">{entityType.ui_label}</h3>
              <span className="px-3 py-1 text-xs font-medium bg-dark-100 text-dark-600 rounded-full">
                Sample Entity
              </span>
            </div>
            <div className="text-sm text-dark-700">
              This is a preview of how the entity detail page will appear with the configured child tabs.
            </div>
          </div>

          {/* Tabs Preview */}
          <div className="border border-dark-300 rounded-lg overflow-hidden">
            {/* Tab Headers */}
            <div className="flex items-center border-b border-dark-300 bg-dark-100 overflow-x-auto">
              {/* Overview Tab */}
              <button className="px-4 py-3 text-sm font-medium text-dark-700 border-b-2 border-dark-700 whitespace-nowrap">
                Overview
              </button>

              {/* Child Entity Tabs */}
              {entityType.child_entities.length > 0 ? (
                entityType.child_entities.map((child, index) => (
                  <button
                    key={child.entity}
                    className="px-4 py-3 text-sm font-medium text-dark-700 hover:text-dark-600 hover:bg-dark-100 whitespace-nowrap"
                  >
                    {child.ui_label}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-dark-700 italic">
                  No child entities configured
                </div>
              )}
            </div>

            {/* Tab Content Preview */}
            <div className="p-6 bg-dark-100">
              <div className="text-sm text-dark-700 mb-4">
                <strong>Overview Tab Content:</strong> Entity fields will be displayed here in a Notion-style layout.
              </div>

              {entityType.child_entities.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-dark-600">Child Entity Tabs:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-dark-700">
                    {entityType.child_entities.map(child => (
                      <li key={child.entity}>
                        <strong>{child.ui_label}</strong> - Filtered list of {child.entity} entities related to this {entityType.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-300 bg-dark-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-dark-600 bg-dark-100 border border-dark-400 rounded-lg hover:bg-dark-100 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Entity Linkage Page
 * Manages parent-child relationships between entity types
 * Updates d_entity table's child_entities JSONB field
 */
export function EntityLinkagePage() {
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [allEntities, setAllEntities] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [previewEntity, setPreviewEntity] = useState<EntityType | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: 'saving' | 'saved' | 'error' }>({});

  useEffect(() => {
    fetchEntityTypes();
  }, []);

  async function fetchEntityTypes() {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:4000/api/v1/entity/types', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entity types');
      }

      const data = await response.json();
      setEntityTypes(data);
      setAllEntities(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching entity types:', error);
      setLoading(false);
    }
  }

  async function updateEntityChildren(entityCode: string, childEntities: ChildEntity[]) {
    setSaveStatus(prev => ({ ...prev, [entityCode]: 'saving' }));

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:4000/api/v1/entity/${entityCode}/children`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ child_entities: childEntities })
      });

      if (!response.ok) {
        throw new Error('Failed to update entity children');
      }

      const result = await response.json();

      // Update local state
      setEntityTypes(prev =>
        prev.map(entity =>
          entity.code === entityCode ? result.data : entity
        )
      );

      setSaveStatus(prev => ({ ...prev, [entityCode]: 'saved' }));

      // Clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[entityCode];
          return newStatus;
        });
      }, 2000);
    } catch (error) {
      console.error('Error updating entity children:', error);
      setSaveStatus(prev => ({ ...prev, [entityCode]: 'error' }));

      setTimeout(() => {
        setSaveStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[entityCode];
          return newStatus;
        });
      }, 3000);
    }
  }

  function addChildEntity(parentCode: string, childEntity: ChildEntity) {
    setEntityTypes(prev =>
      prev.map(entity => {
        if (entity.code === parentCode) {
          const maxOrder = entity.child_entities.length > 0
            ? Math.max(...entity.child_entities.map(c => c.order))
            : 0;

          const updatedChildren = [
            ...entity.child_entities,
            { ...childEntity, order: maxOrder + 1 }
          ];

          // Auto-save after adding
          updateEntityChildren(parentCode, updatedChildren);

          return { ...entity, child_entities: updatedChildren };
        }
        return entity;
      })
    );
  }

  function removeChildEntity(parentCode: string, childEntityCode: string) {
    setEntityTypes(prev =>
      prev.map(entity => {
        if (entity.code === parentCode) {
          const updatedChildren = entity.child_entities
            .filter(c => c.entity !== childEntityCode)
            .map((c, index) => ({ ...c, order: index + 1 })); // Reorder

          // Auto-save after removing
          updateEntityChildren(parentCode, updatedChildren);

          return { ...entity, child_entities: updatedChildren };
        }
        return entity;
      })
    );
  }

  function getAvailableChildEntities(parentCode: string): EntityType[] {
    const parent = entityTypes.find(e => e.code === parentCode);
    if (!parent) return [];

    const existingChildCodes = parent.child_entities.map(c => c.entity);
    return allEntities.filter(e =>
      e.code !== parentCode && !existingChildCodes.includes(e.code)
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-dark-700">Loading entity types...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <LinkIcon className="h-6 w-6 text-dark-700" />
            <h1 className="text-2xl font-bold text-dark-600">Entity Mapping</h1>
          </div>
          <p className="text-sm text-dark-700">
            Configure parent-child relationships between entity types. Child entities will appear as tabs on the parent entity's detail page.
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-dark-100 border border-dark-400 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-dark-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-dark-600">
            <strong>How it works:</strong> When you add a child entity to a parent (e.g., "Task" to "Project"),
            a new tab will appear on the project detail page showing all tasks related to that project.
            Changes are saved automatically.
          </div>
        </div>

        {/* Entity Mapping Cards */}
        <div className="space-y-4">
          {entityTypes.map(entity => {
            const availableChildren = getAvailableChildEntities(entity.code);
            const isEditing = editingEntity === entity.code;
            const status = saveStatus[entity.code];

            return (
              <div
                key={entity.code}
                className="bg-dark-100 border border-dark-300 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Entity Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-dark-100 border-b border-dark-300">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold text-dark-600">{entity.name}</div>
                    <span className="text-sm text-dark-700">({entity.code})</span>
                    {status === 'saved' && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                        <Save className="h-3 w-3" />
                        Saved
                      </span>
                    )}
                    {status === 'saving' && (
                      <span className="px-2 py-1 text-xs font-medium bg-dark-100 text-dark-600 rounded-full">
                        Saving...
                      </span>
                    )}
                    {status === 'error' && (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                        Error
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewEntity(entity)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </div>

                {/* Child Entities Section */}
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-dark-600 mb-2">
                      Child Entities ({entity.child_entities.length})
                    </h3>
                    <p className="text-xs text-dark-700">
                      These entities will appear as tabs on the {entity.name} detail page
                    </p>
                  </div>

                  {/* Current Child Entities */}
                  <div className="space-y-2 mb-4">
                    {entity.child_entities.length > 0 ? (
                      entity.child_entities.map(child => (
                        <div
                          key={child.entity}
                          className="flex items-center justify-between p-3 bg-dark-100 rounded-lg border border-dark-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium text-dark-600">{child.ui_label}</div>
                            <span className="text-xs text-dark-700">({child.entity})</span>
                            <span className="px-2 py-0.5 text-xs bg-dark-200 text-dark-600 rounded">
                              Order: {child.order}
                            </span>
                          </div>
                          <button
                            onClick={() => removeChildEntity(entity.code, child.entity)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove child entity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-dark-700 text-center border border-dashed border-dark-400 rounded-lg">
                        No child entities configured
                      </div>
                    )}
                  </div>

                  {/* Add Child Entity */}
                  {availableChildren.length > 0 && (
                    <div>
                      <button
                        onClick={() => setEditingEntity(isEditing ? null : entity.code)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-lg border border-dark-400 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Child Entity
                      </button>

                      {isEditing && (
                        <div className="mt-3 p-4 bg-dark-100 border border-dark-400 rounded-lg">
                          <div className="text-sm font-medium text-dark-600 mb-2">
                            Select child entity to add:
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {availableChildren.map(childEntityType => (
                              <button
                                key={childEntityType.code}
                                onClick={() => {
                                  addChildEntity(entity.code, {
                                    entity: childEntityType.code,
                                    ui_icon: childEntityType.ui_icon || 'Circle',
                                    ui_label: childEntityType.ui_label,
                                    order: entity.child_entities.length + 1
                                  });
                                  setEditingEntity(null);
                                }}
                                className="p-3 text-sm text-left bg-dark-100 border border-dark-400 rounded-lg hover:border-dark-600 hover:bg-dark-100 transition-colors"
                              >
                                <div className="font-medium text-dark-600">{childEntityType.name}</div>
                                <div className="text-xs text-dark-700">{childEntityType.ui_label}</div>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setEditingEntity(null)}
                            className="mt-3 text-sm text-dark-700 hover:text-dark-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      {previewEntity && (
        <EntityPreviewModal
          entityType={previewEntity}
          onClose={() => setPreviewEntity(null)}
        />
      )}
    </Layout>
  );
}
