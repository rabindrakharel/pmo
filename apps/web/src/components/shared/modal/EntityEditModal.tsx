import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { EntityFormContainer } from '../entity/EntityFormContainer';
import { getEntityConfig } from '../../../lib/entityConfig';
import { APIFactory } from '../../../lib/api';

/**
 * EntityEditModal
 *
 * A reusable modal that displays the entity edit form for any entity type.
 * Uses the same EntityFormContainer as EntityDetailPage for consistency.
 * Matches EntityDetailPage styling exactly for consistency.
 *
 * Usage:
 * <EntityEditModal
 *   entityType="task"
 *   entityId="123-456-789"
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   onSave={() => { refreshList(); setIsOpen(false); }}
 * />
 */

interface EntityEditModalProps {
  entityType: string;
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function EntityEditModal({
  entityType,
  entityId,
  isOpen,
  onClose,
  onSave
}: EntityEditModalProps) {
  const config = getEntityConfig(entityType);
  const [data, setData] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && entityId) {
      loadData();
    }
  }, [isOpen, entityId, entityType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const api = APIFactory.getAPI(entityType);
      const response = await api.get(entityId);
      const responseData = response.data || response;

      setData(responseData);
      setEditedData(responseData);
    } catch (err) {
      console.error(`Failed to load ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Normalize date fields to YYYY-MM-DD format for API validation (matching EntityDetailPage)
      const normalizedData = { ...editedData };

      // Find all date fields from config and normalize them
      config.fields.forEach(field => {
        if (field.type === 'date' && normalizedData[field.key]) {
          const value = normalizedData[field.key];
          if (value && typeof value === 'string' && value.includes('T')) {
            // Already ISO format, extract date part
            normalizedData[field.key] = value.split('T')[0];
          } else if (value instanceof Date) {
            // Date object, convert to YYYY-MM-DD
            normalizedData[field.key] = value.toISOString().split('T')[0];
          }
        }
      });

      const api = APIFactory.getAPI(entityType);
      await api.update(entityId, normalizedData);

      if (onSave) {
        onSave();
      }
      onClose();
    } catch (err) {
      console.error(`Failed to save ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original data
    setEditedData(data);
    setError(null);
    onClose();
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setEditedData((prev: any) => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Matches EntityDetailPage header styling */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-normal text-gray-500">
                {editedData?.name || editedData?.title || `${config.displayName} Details`}
                <span className="text-xs font-light text-gray-500 ml-3">
                  {config.displayName} · {entityId?.slice(0, 8)}...
                </span>
              </h2>
            </div>

            {/* Action Buttons - Matches EntityDetailPage button styling exactly */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4 mr-2 stroke-[1.5]" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-normal rounded text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2 stroke-[1.5]" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Content - Matches EntityDetailPage content area */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <EntityFormContainer
                  config={config}
                  data={editedData}
                  isEditing={true}
                  onChange={handleFieldChange}
                  mode="edit"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
