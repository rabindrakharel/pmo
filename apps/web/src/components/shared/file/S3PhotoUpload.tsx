// ============================================================================
// S3 PHOTO UPLOAD COMPONENT
// ============================================================================
// Version: 1.0.0
//
// Reusable component for uploading profile photos to S3 with:
// - Drag and drop support
// - Image cropping (circular avatar style)
// - Preview before upload
// - S3 presigned URL upload flow
// - JSONB storage format: { s3_bucket, s3_key }
//
// Uses existing useS3Upload hook and S3AttachmentService backend.
// ============================================================================

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Camera, Trash2, User } from 'lucide-react';
import { useS3Upload } from '@/lib/hooks/useS3Upload';
import { Button } from '../button/Button';

// ============================================================================
// Types
// ============================================================================

export interface S3PhotoData {
  s3_bucket: string;
  s3_key: string;
}

export interface S3PhotoUploadProps {
  /** Current value (JSONB with s3_bucket and s3_key) */
  value: S3PhotoData | null;
  /** Entity code for S3 path */
  entityCode: string;
  /** Entity instance ID for S3 path */
  entityInstanceId: string;
  /** Callback when photo is uploaded or removed */
  onChange: (value: S3PhotoData | null) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether the component is readonly */
  readonly?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional className */
  className?: string;
}

// ============================================================================
// Size Configuration
// ============================================================================

const SIZE_CONFIG = {
  sm: { avatar: 'w-16 h-16', icon: 'w-6 h-6', text: 'text-xs' },
  md: { avatar: 'w-24 h-24', icon: 'w-8 h-8', text: 'text-sm' },
  lg: { avatar: 'w-32 h-32', icon: 'w-10 h-10', text: 'text-base' },
};

// ============================================================================
// S3PhotoUpload Component
// ============================================================================

export function S3PhotoUpload({
  value,
  entityCode,
  entityInstanceId,
  onChange,
  disabled = false,
  readonly = false,
  size = 'lg',
  className = '',
}: S3PhotoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadToS3, getDownloadUrl, uploadingFiles, errors } = useS3Upload();
  const isUploading = uploadingFiles['profile_photo'] || false;
  const uploadError = errors['profile_photo'];

  const sizeConfig = SIZE_CONFIG[size];

  // ========================================================================
  // Load existing photo from S3
  // ========================================================================

  React.useEffect(() => {
    const loadExistingPhoto = async () => {
      if (value?.s3_key) {
        const url = await getDownloadUrl(value.s3_key);
        setPhotoUrl(url);
      } else {
        setPhotoUrl(null);
      }
    };
    loadExistingPhoto();
  }, [value?.s3_key, getDownloadUrl]);

  // ========================================================================
  // File Selection Handler
  // ========================================================================

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select an image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // ========================================================================
  // Drag and Drop Handlers
  // ========================================================================

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !readonly) {
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

    if (disabled || readonly) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // ========================================================================
  // Upload Handler
  // ========================================================================

  const handleUpload = async () => {
    if (!selectedFile || !entityInstanceId) return;

    const objectKey = await uploadToS3({
      entityCode,
      entityInstanceId,
      file: selectedFile,
      fileName: selectedFile.name,
      contentType: selectedFile.type,
      uploadType: 'file',
      fieldName: 'profile_photo',
    });

    if (objectKey) {
      // Extract bucket from objectKey (format: tenant_id=demo/entity=employee/...)
      // The bucket is configured in backend, so we use a placeholder
      const s3Data: S3PhotoData = {
        s3_bucket: 'pmo-attachments', // This is resolved by backend config
        s3_key: objectKey,
      };

      onChange(s3Data);
      setSelectedFile(null);
      setPreviewUrl(null);

      // Load the new photo URL
      const url = await getDownloadUrl(objectKey);
      setPhotoUrl(url);
    }
  };

  // ========================================================================
  // Remove Handler
  // ========================================================================

  const handleRemove = () => {
    onChange(null);
    setPhotoUrl(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // ========================================================================
  // Cancel Selection Handler
  // ========================================================================

  const handleCancelSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // ========================================================================
  // Render
  // ========================================================================

  const isDisabled = disabled || readonly;
  const displayUrl = previewUrl || photoUrl;
  const hasPhoto = !!displayUrl;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Avatar Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-full overflow-hidden
          ${sizeConfig.avatar}
          ${isDragging ? 'ring-4 ring-blue-400 ring-opacity-50' : ''}
          ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          ${!hasPhoto ? 'bg-dark-200 border-2 border-dashed border-dark-400' : ''}
          transition-all duration-200
        `}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
      >
        {/* Photo or Placeholder */}
        {hasPhoto ? (
          <img
            src={displayUrl}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className={`${sizeConfig.icon} text-dark-500`} />
          </div>
        )}

        {/* Upload Overlay (shown on hover when not disabled) */}
        {!isDisabled && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            {isUploading ? (
              <Loader2 className={`${sizeConfig.icon} text-white animate-spin`} />
            ) : (
              <Camera className={`${sizeConfig.icon} text-white`} />
            )}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = ''; // Reset to allow re-selecting same file
        }}
        className="hidden"
        disabled={isDisabled}
      />

      {/* Action Buttons */}
      {!isDisabled && (
        <div className="flex items-center gap-2">
          {selectedFile ? (
            <>
              {/* Upload Button */}
              <Button
                variant="primary"
                size="sm"
                icon={isUploading ? Loader2 : Upload}
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Save Photo'}
              </Button>

              {/* Cancel Button */}
              <Button
                variant="secondary"
                size="sm"
                icon={X}
                onClick={handleCancelSelection}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {/* Change/Upload Button */}
              <Button
                variant="secondary"
                size="sm"
                icon={Camera}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasPhoto ? 'Change' : 'Upload'}
              </Button>

              {/* Remove Button (only if photo exists) */}
              {hasPhoto && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Trash2}
                  onClick={handleRemove}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <p className={`text-red-600 ${sizeConfig.text}`}>{uploadError}</p>
      )}

      {/* Help Text */}
      {!isDisabled && !hasPhoto && !selectedFile && (
        <p className={`text-dark-500 ${sizeConfig.text} text-center`}>
          Drag and drop or click to upload<br />
          JPEG, PNG, GIF, WebP (max 5MB)
        </p>
      )}
    </div>
  );
}

export default S3PhotoUpload;
