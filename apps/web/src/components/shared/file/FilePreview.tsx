import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';

interface FilePreviewProps {
  entityType: 'artifact' | 'cost' | 'revenue';
  entityId: string;
  data: any;
  isEditing: boolean;
}

/**
 * FilePreview Component
 *
 * Reusable component for previewing files attached to entities.
 * Supports artifacts (object_key), cost entities (invoice_attachment), and revenue entities (sales_receipt_attachment).
 *
 * Features:
 * - Fetches presigned URLs for S3 objects
 * - Displays previews for PDF, images, and videos
 * - Shows file metadata (format, size)
 * - Handles loading and error states
 */
export function FilePreview({ entityType, entityId, data, isEditing }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const lastObjectKeyRef = useRef<string | null>(null);

  // Determine which field contains the file reference
  const getFileReference = () => {
    if (entityType === 'artifact') {
      return data?.attachment_object_key;
    } else if (entityType === 'cost') {
      return data?.invoice_attachment;
    } else if (entityType === 'revenue') {
      return data?.sales_receipt_attachment;
    }
    return null;
  };

  // Extract file format from different sources
  const getFileFormat = () => {
    if (entityType === 'artifact') {
      return data?.attachment_format?.toLowerCase();
    }

    // For cost/revenue, extract from S3 URI
    const fileRef = getFileReference();
    if (fileRef && typeof fileRef === 'string') {
      const parts = fileRef.split('.');
      return parts[parts.length - 1]?.toLowerCase();
    }
    return null;
  };

  // Get file size
  const getFileSize = () => {
    if (entityType === 'artifact' && data?.attachment_size_bytes) {
      return (data.attachment_size_bytes / 1024).toFixed(2);
    }
    return null;
  };

  // Get display label
  const getLabel = () => {
    if (entityType === 'cost') return 'Invoice Preview';
    if (entityType === 'revenue') return 'Receipt Preview';
    return 'File Preview';
  };

  // Get empty state message
  const getEmptyMessage = () => {
    if (entityType === 'cost') return 'No invoice uploaded';
    if (entityType === 'revenue') return 'No receipt uploaded';
    return 'No file uploaded';
  };

  // Get empty state description
  const getEmptyDescription = () => {
    if (entityType === 'cost') {
      return `This cost entry has no invoice attached.${!isEditing ? ' Click Edit to upload an invoice.' : ''}`;
    }
    if (entityType === 'revenue') {
      return `This revenue entry has no receipt attached.${!isEditing ? ' Click Edit to upload a receipt.' : ''}`;
    }
    return `This artifact has metadata but no associated file.${!isEditing ? ' Click Edit to upload a file.' : ''}`;
  };

  // Fetch preview URL
  const fetchPreviewUrl = useCallback(async () => {
    const fileRef = getFileReference();
    if (!fileRef) {
      console.log('Preview fetch skipped: no file reference');
      return;
    }

    console.log('Fetching preview URL:', { entityType, entityId, fileRef });
    setLoadingPreview(true);

    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      let url: string;

      if (entityType === 'artifact') {
        // Artifact uses object_key - call download endpoint
        const response = await fetch(`${apiUrl}/api/v1/artifact/${entityId}/download`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch preview URL');
        }

        const result = await response.json();
        url = result.url;
      } else {
        // Cost/Revenue use S3 URI in attachment fields
        // Extract object key from S3 URI (s3://bucket/key)
        const objectKey = fileRef.replace(/^s3:\/\/[^/]+\//, '');

        const response = await fetch(`${apiUrl}/api/v1/artifact/preview-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ objectKey })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch preview URL');
        }

        const result = await response.json();
        url = result.url;
      }

      console.log('Preview URL fetched:', url);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Failed to fetch preview URL:', error);
      setPreviewUrl(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [entityType, entityId, data]);

  // Fetch preview when file reference changes
  useEffect(() => {
    const fileRef = getFileReference();
    if (fileRef && fileRef !== lastObjectKeyRef.current) {
      console.log('File reference changed, fetching preview:', { old: lastObjectKeyRef.current, new: fileRef });
      lastObjectKeyRef.current = fileRef;
      setPreviewUrl(null);
      fetchPreviewUrl();
    } else if (fileRef && !previewUrl && !loadingPreview) {
      console.log('No preview URL yet, fetching:', fileRef);
      fetchPreviewUrl();
    }
  }, [data, fetchPreviewUrl]);

  const fileRef = getFileReference();
  const fileFormat = getFileFormat();
  const fileSize = getFileSize();

  return (
    <div className="bg-dark-100 rounded-md shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-dark-600">{getLabel()}</h2>
        {fileRef && fileFormat && (
          <span className="text-xs text-dark-700">
            Format: {fileFormat.toUpperCase()}
            {fileSize && ` · Size: ${fileSize} KB`}
          </span>
        )}
      </div>

      {!fileRef ? (
        <div className="bg-amber-50 border border-amber-200 p-6 text-center rounded-md">
          <Upload className="h-10 w-10 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-900">{getEmptyMessage()}</p>
          <p className="text-xs text-amber-700 mt-1">{getEmptyDescription()}</p>
        </div>
      ) : loadingPreview ? (
        <div className="flex items-center justify-center h-48 bg-dark-100 rounded-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700 mx-auto mb-2" />
            <p className="text-sm text-dark-700">Loading preview...</p>
          </div>
        </div>
      ) : previewUrl ? (
        <>
          {(() => {
            const format = fileFormat || '';
            console.log('Rendering preview for format:', format);

            // PDF Preview
            if (format === 'pdf') {
              return (
                <div className="rounded-md overflow-hidden border border-dark-300">
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px]"
                    title={`${getLabel()}`}
                  />
                </div>
              );
            }

            // Image Preview
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(format)) {
              return (
                <div className="rounded-md overflow-hidden border border-dark-300 bg-dark-100 p-4">
                  <div className="flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt={data.name || 'Preview'}
                      className="max-w-full max-h-[500px] object-contain"
                      onError={(e) => {
                        console.error('Image failed to load');
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              );
            }

            // Video Preview
            if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(format)) {
              return (
                <div className="rounded-md overflow-hidden border border-dark-300">
                  <video
                    src={previewUrl}
                    controls
                    className="w-full max-h-[500px]"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              );
            }

            // Unsupported format
            return (
              <div className="bg-dark-100 p-6 text-center rounded-md border border-dark-300">
                <p className="text-sm text-dark-700">
                  Preview not available for {format.toUpperCase() || 'this'} file type.
                </p>
                <p className="text-xs text-dark-700 mt-1.5">
                  Use the Download button to view this file.
                </p>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="bg-dark-100 p-6 text-center rounded-md border border-dark-300">
          <p className="text-sm text-dark-700">Preview URL not available</p>
          <p className="text-xs text-dark-700 mt-1.5">Click Download to view the file</p>
        </div>
      )}
    </div>
  );
}
