import React, { useState } from 'react';
import { Upload, X, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../button/Button';

interface DragDropFileUploadProps {
  entityCode: 'artifact' | 'cost' | 'revenue';
  selectedFile: File | null;
  uploadedObjectKey: string | null;
  isUploading: boolean;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onFileUpload: () => void;
  uploadError?: string;
  accept?: string;
  disabled?: boolean;
}

/**
 * DragDropFileUpload Component
 *
 * Reusable drag-and-drop file upload component with:
 * - Drag and drop support
 * - Click to browse
 * - File preview with metadata
 * - Upload progress indicator
 * - Context-aware labels
 *
 * Used in EntityCreatePage and EntitySpecificInstancePage for artifact, cost, and revenue uploads.
 */
export function DragDropFileUpload({
  entityCode,
  selectedFile,
  uploadedObjectKey,
  isUploading,
  onFileSelect,
  onFileRemove,
  onFileUpload,
  uploadError,
  accept,
  disabled = false
}: DragDropFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Get context-aware labels
  const getLabel = () => {
    if (entityCode === 'cost') return 'Invoice';
    if (entityCode === 'revenue') return 'Receipt';
    return 'File';
  };

  const getDescription = () => {
    if (entityCode === 'cost') return 'Upload invoice (PDF, PNG, JPG)';
    if (entityCode === 'revenue') return 'Upload sales receipt (PDF, PNG, JPG)';
    return 'Upload documents, images, videos, or any file type';
  };

  const getTitle = () => {
    if (entityCode === 'cost') return 'Invoice Upload';
    if (entityCode === 'revenue') return 'Sales Receipt Upload';
    return 'File Upload';
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
      onFileSelect(files[0]);
    }
  };

  // File input handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div className="bg-dark-100 rounded-md shadow p-6 space-y-4">
      <h2 className="text-sm font-medium text-dark-600">{getTitle()}</h2>

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-md p-8 text-center transition-all
            ${isDragging
              ? 'border-dark-3000 bg-dark-100 scale-[1.02]'
              : 'border-dark-400 bg-dark-100 hover:border-dark-400 hover:bg-dark-100'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <input
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
            id="entity-file-upload"
            accept={accept}
            disabled={disabled}
          />
          <label
            htmlFor="entity-file-upload"
            className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-dark-6000' : 'text-dark-600'}`} />
            <p className="text-sm font-medium text-dark-600">
              {isDragging ? `Drop ${getLabel().toLowerCase()} here` : `Drop ${getLabel().toLowerCase()} here or click to browse`}
            </p>
            <p className="text-xs text-dark-700 mt-2">
              {getDescription()}
            </p>
          </label>
        </div>
      ) : (
        <div className="border border-dark-300 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              {uploadedObjectKey ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : isUploading ? (
                <Loader2 className="h-5 w-5 text-dark-700 animate-spin" />
              ) : (
                <Upload className="h-5 w-5 text-dark-700" />
              )}
              <div>
                <p className="text-sm font-medium text-dark-600">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-dark-700">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={onFileRemove}
              className="p-1 hover:bg-dark-100 rounded transition-colors"
              disabled={isUploading}
              type="button"
            >
              <X className="h-4 w-4 text-dark-600" />
            </button>
          </div>

          {!uploadedObjectKey && !isUploading && (
            <Button
              variant="secondary"
              icon={Upload}
              onClick={onFileUpload}
              disabled={isUploading}
              size="sm"
              type="button"
            >
              Upload to S3
            </Button>
          )}

          {isUploading && (
            <div className="flex items-center space-x-2 text-sm text-dark-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Uploading...</span>
            </div>
          )}

          {uploadedObjectKey && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{getLabel()} uploaded successfully</span>
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-red-600 mt-2">{uploadError}</p>
          )}
        </div>
      )}
    </div>
  );
}
