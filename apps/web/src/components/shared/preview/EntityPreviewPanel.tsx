/**
 * ============================================================================
 * ENTITY PREVIEW PANEL - Slide-over panel for entity preview
 * ============================================================================
 *
 * Shows a quick preview of entity detail page in a slide-over panel
 * - Slides in from right side
 * - Shows full entity detail content
 * - Can be closed with X button or by clicking outside
 * - Smooth animations
 */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useEntityPreview } from '../../../contexts/EntityPreviewContext';
import { getEntityConfig } from '../../../lib/entityConfig';
import { fetchEntityData } from '../../../lib/api';

export function EntityPreviewPanel() {
  const { entityPreviewData, isEntityPreviewOpen, closeEntityPreview } = useEntityPreview();
  const [entityData, setEntityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entity data when preview opens
  useEffect(() => {
    if (!entityPreviewData || !isEntityPreviewOpen) {
      setEntityData(null);
      setError(null);
      return;
    }

    const loadEntityData = async () => {
      setLoading(true);
      setError(null);
      try {
        const config = getEntityConfig(entityPreviewData.entityType);
        const data = await fetchEntityData(entityPreviewData.entityType, entityPreviewData.entityId);
        setEntityData(data);
      } catch (err) {
        console.error('Error loading entity preview data:', err);
        setError('Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    loadEntityData();
  }, [entityPreviewData, isEntityPreviewOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEntityPreviewOpen) {
        closeEntityPreview();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isEntityPreviewOpen, closeEntityPreview]);

  if (!isEntityPreviewOpen || !entityPreviewData) {
    return null;
  }

  const config = getEntityConfig(entityPreviewData.entityType);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isEntityPreviewOpen ? 'opacity-30' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeEntityPreview}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isEntityPreviewOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-gray-400">
                {config.icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {entityPreviewData.label || config.name}
                </h2>
                <p className="text-sm text-gray-500">Quick Preview</p>
              </div>
            </div>
            <button
              onClick={closeEntityPreview}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close preview (ESC)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-20">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
              <span className="ml-3 text-gray-600">Loading preview...</span>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {entityData && !loading && !error && (
            <div className="p-6">
              {/* Render entity metadata fields */}
              <div className="space-y-6">
                {/* Overview section */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Overview
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {config.columns
                      .filter(col => col.key !== 'id' && entityData[col.key] !== null && entityData[col.key] !== undefined)
                      .slice(0, 8) // Show first 8 fields
                      .map(col => (
                        <div key={col.key} className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-600 min-w-[120px]">
                            {col.title}:
                          </span>
                          <span className="text-sm text-gray-900 text-right flex-1">
                            {typeof entityData[col.key] === 'object'
                              ? JSON.stringify(entityData[col.key])
                              : String(entityData[col.key])}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Raw data (for debugging) */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    View raw data
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded overflow-auto max-h-64">
                    {JSON.stringify(entityData, null, 2)}
                  </pre>
                </details>
              </div>

              {/* Action buttons */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <a
                  href={`/${entityPreviewData.entityType}/${entityPreviewData.entityId}`}
                  className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  onClick={closeEntityPreview}
                >
                  Open Full View
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
