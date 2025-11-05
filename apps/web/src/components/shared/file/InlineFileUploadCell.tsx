/**
 * Inline File Upload Cell Component
 *
 * Compact drag-and-drop file upload for inline table editing
 * Shows current file, allows drag-drop replacement, uploads to S3
 */

import React, { useState, useRef } from 'react';
import { Upload, FileIcon, CheckCircle, Loader2, X } from 'lucide-react';

interface InlineFileUploadCellProps {
  value: string | null; // Current file URL/path
  entityType: 'artifact' | 'cost' | 'revenue' | string;
  entityId: string;
  fieldName: string;
  accept?: string;
  onUploadComplete: (fileUrl: string) => void;
  disabled?: boolean;
}

/**
 * Compact inline file upload cell
 * - Shows current file status
 * - Drag-drop to replace
 * - Auto-uploads to S3
 * - Updates field on complete
 */
export function InlineFileUploadCell({
  value,
  entityType,
  entityId,
  fieldName,
  accept = '*',
  onUploadComplete,
  disabled = false
}: InlineFileUploadCellProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  // Get file extension from current value
  const getFileExtension = (url: string | null): string => {
    if (!url) return '';
    const ext = url.split('.').pop()?.split('?')[0]?.toUpperCase();
    return ext || 'FILE';
  };

  // Upload file to S3 via presigned URL
  const uploadToS3 = async (file: File): Promise<string> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');

      // Step 1: Get presigned URL from API
      const presignedResponse = await fetch(
        `${API_BASE_URL}/api/v1/${entityType}/presigned-upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type
          })
        }
      );

      if (!presignedResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, objectKey } = await presignedResponse.json();

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Return S3 object key
      return objectKey;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setUploadError(null);

    // Auto-upload
    try {
      setIsUploading(true);
      const objectKey = await uploadToS3(file);

      // Notify parent component
      onUploadComplete(objectKey);

      setSelectedFile(null);
      setIsUploading(false);
    } catch (error) {
      setUploadError('Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // File input handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Render current file status
  const renderCurrentFile = () => {
    if (isUploading) {
      return (
        <div className="flex items-center space-x-2 text-dark-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Uploading...</span>
        </div>
      );
    }

    if (selectedFile) {
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-xs">{selectedFile.name}</span>
        </div>
      );
    }

    if (value) {
      const ext = getFileExtension(value);
      return (
        <div className="flex items-center space-x-2 text-dark-600">
          <FileIcon className="h-4 w-4" />
          <span className="text-xs font-medium">{ext}</span>
          <CheckCircle className="h-3 w-3 text-green-500" />
        </div>
      );
    }

    return (
      <span className="text-xs text-dark-600">No file</span>
    );
  };

  return (
    <div
      className={`
        relative min-h-[40px] px-2 py-1 rounded border-2 border-dashed
        transition-all cursor-pointer
        ${isDragging ? 'border-dark-3000 bg-dark-100' : 'border-dark-400 hover:border-dark-400'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${uploadError ? 'border-red-300 bg-red-50' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInputChange}
        className="hidden"
        accept={accept}
        disabled={disabled}
      />

      <div className="flex items-center justify-between">
        <div className="flex-1">
          {renderCurrentFile()}
        </div>

        {!isUploading && (
          <Upload className={`h-4 w-4 flex-shrink-0 ml-2 ${isDragging ? 'text-dark-6000' : 'text-dark-600'}`} />
        )}
      </div>

      {uploadError && (
        <div className="text-xs text-red-600 mt-1">{uploadError}</div>
      )}

      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-100 bg-opacity-90 rounded">
          <span className="text-xs font-medium text-dark-700">Drop file here</span>
        </div>
      )}
    </div>
  );
}
