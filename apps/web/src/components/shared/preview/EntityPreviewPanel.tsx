/**
 * ============================================================================
 * ENTITY PREVIEW PANEL - Slide-over panel for entity preview
 * ============================================================================
 *
 * Shows exact entity detail page content in a slide-over panel
 * - Slides in from right side
 * - Renders the full EntityDetailPage in an iframe
 * - Can be closed with X button, ESC key, or by clicking outside
 * - Smooth animations
 */

import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useEntityPreview } from '../../../contexts/EntityPreviewContext';
import { getEntityConfig } from '../../../lib/entityConfig';

export function EntityPreviewPanel() {
  const { entityPreviewData, isEntityPreviewOpen, closeEntityPreview } = useEntityPreview();

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
  const detailPageUrl = `/${entityPreviewData.entityType}/${entityPreviewData.entityId}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isEntityPreviewOpen ? 'opacity-40' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeEntityPreview}
      />

      {/* Centered Modal Popup - Large and Wide */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
          isEntityPreviewOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`bg-dark-100 rounded-xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col transform transition-transform duration-300 ${
            isEntityPreviewOpen ? 'scale-100' : 'scale-95'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-dark-100 border-b border-dark-300 px-6 py-3 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-dark-600">
                  {config.icon}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-dark-600">
                    {entityPreviewData.label || config.name}
                  </h2>
                  <p className="text-xs text-dark-700">Quick Preview</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={detailPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-dark-600 hover:text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={closeEntityPreview}
                  className="p-2 text-dark-600 hover:text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
                  title="Close preview (ESC)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content - iframe embedding the actual entity detail page (read-only preview) */}
          <div className="flex-1 bg-dark-100 rounded-b-xl overflow-hidden">
            <iframe
              src={detailPageUrl}
              className="w-full h-full border-0 pointer-events-none"
              title={`Preview: ${entityPreviewData.label || config.name}`}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </div>
    </>
  );
}
