import { useState } from 'react';

/**
 * Reusable S3 Upload Hook (DRY Principle)
 *
 * Provides generic S3 upload functionality that can be used across the application
 * for uploading files, signatures, initials, or any blob data.
 *
 * @example
 * ```typescript
 * const { uploadToS3, uploadingFiles, errors } = useS3Upload();
 *
 * const handleFileUpload = async (file: File) => {
 *   const objectKey = await uploadToS3({
 *     entityCode: 'artifact',
 *     entityInstanceId: artifactId,
 *     file,
 *     fileName: file.name,
 *     contentType: file.type,
 *     uploadType: 'file'
 *   });
 *
 *   if (objectKey) {
 *     // Save objectKey to database
 *   }
 * };
 * ```
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface UploadToS3Options {
  entityCode: string;
  entityInstanceId: string;
  file: Blob | File;
  fileName: string;
  contentType: string;
  uploadType: 'file' | 'signature' | 'artifact';
  tenantId?: string;
  fieldName?: string; // Optional field name for tracking individual uploads
}

export interface S3UploadResult {
  objectKey: string;
  url?: string; // Optional presigned download URL
}

export function useS3Upload() {
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  /**
   * Generic S3 upload function (DRY principle)
   * Handles presigned URL generation and upload for any blob/file
   */
  const uploadToS3 = async (options: UploadToS3Options): Promise<string | null> => {
    const {
      entityCode,
      entityInstanceId,
      file,
      fileName,
      contentType,
      uploadType,
      tenantId = 'demo',
      fieldName = 'default'
    } = options;

    try {
      // Set loading state
      setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));

      // Get presigned upload URL from backend
      const token = localStorage.getItem('auth_token');
      const presignedResponse = await fetch(`${API_BASE_URL}/api/v1/s3-backend/presigned-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          tenantId,
          entityCode,
          entityInstanceId,
          fileName,
          contentType
        })
      });

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        throw new Error(`Failed to get presigned upload URL: ${errorText}`);
      }

      const { url, objectKey } = await presignedResponse.json();

      setUploadProgress(prev => ({ ...prev, [fieldName]: 50 }));

      // Upload to S3 using presigned URL
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload ${uploadType} to S3: ${uploadResponse.statusText}`);
      }

      setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
      console.log(`✅ ${uploadType} uploaded to S3: ${objectKey}`);

      // Clear error if there was one
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });

      return objectKey;
    } catch (error) {
      console.error(`Error uploading ${uploadType} to S3:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to upload ${uploadType}`;
      setErrors(prev => ({ ...prev, [fieldName]: errorMessage }));
      return null;
    } finally {
      // Clear loading state after a short delay
      setTimeout(() => {
        setUploadingFiles(prev => {
          const newState = { ...prev };
          delete newState[fieldName];
          return newState;
        });
        setUploadProgress(prev => {
          const newState = { ...prev };
          delete newState[fieldName];
          return newState;
        });
      }, 1000);
    }
  };

  /**
   * Get presigned download URL for an S3 object
   */
  const getDownloadUrl = async (objectKey: string): Promise<string | null> => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/s3-backend/presigned-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ objectKey })
      });

      if (!response.ok) {
        throw new Error('Failed to get presigned download URL');
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Error fetching S3 download URL:', error);
      return null;
    }
  };

  /**
   * Clear error for a specific field
   */
  const clearError = (fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  };

  /**
   * Clear all errors
   */
  const clearAllErrors = () => {
    setErrors({});
  };

  return {
    uploadToS3,
    getDownloadUrl,
    uploadingFiles,
    uploadProgress,
    errors,
    clearError,
    clearAllErrors,
    isUploading: Object.keys(uploadingFiles).length > 0
  };
}
