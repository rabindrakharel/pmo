import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, File, CheckCircle, X, Loader2 } from 'lucide-react';
import { Layout } from '../../components/shared';
import { Button } from '../../components/shared/button/Button';
import { useS3Upload } from '../../lib/hooks/useS3Upload';
import { APIFactory } from '../../lib/api';

/**
 * ArtifactUploadPage
 *
 * Custom page for uploading files to S3 with metadata.
 * Follows DRY principle by using the reusable useS3Upload hook.
 *
 * Features:
 * - Multiple file upload with drag-and-drop
 * - Per-file metadata (name, description, type, tags)
 * - Real-time upload progress
 * - S3 cloud storage integration
 * - Automatic file format and size detection
 */

interface FileWithMetadata {
  file: File;
  id: string;
  name: string;
  descr: string;
  artifact_type: string;
  tags: string[];
  objectKey?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  errorMessage?: string;
}

const ARTIFACT_TYPES = [
  { value: 'blueprint', label: 'Blueprint' },
  { value: 'contract', label: 'Contract' },
  { value: 'photo', label: 'Photo' },
  { value: 'document', label: 'Document' },
  { value: 'report', label: 'Report' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' }
];

export function ArtifactUploadPage() {
  const navigate = useNavigate();
  const { uploadToS3, uploadingFiles, uploadProgress, errors } = useS3Upload();

  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreatingArtifacts, setIsCreatingArtifacts] = useState(false);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: FileWithMetadata[] = Array.from(selectedFiles).map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
      descr: '',
      artifact_type: 'document',
      tags: [],
      uploadStatus: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleMetadataChange = (fileId: string, field: keyof FileWithMetadata, value: any) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId ? { ...f, [field]: value } : f
      )
    );
  };

  const uploadFile = async (fileData: FileWithMetadata): Promise<string | null> => {
    // Update status to uploading
    setFiles(prev =>
      prev.map(f =>
        f.id === fileData.id ? { ...f, uploadStatus: 'uploading' } : f
      )
    );

    try {
      // Use the reusable S3 upload hook (DRY principle)
      const objectKey = await uploadToS3({
        entityType: 'artifact',
        entityId: fileData.id, // Temporary ID, will be replaced when artifact is created
        file: fileData.file,
        fileName: fileData.file.name,
        contentType: fileData.file.type || 'application/octet-stream',
        uploadType: 'artifact',
        fieldName: fileData.id
      });

      if (objectKey) {
        // Update file with object key and mark as uploaded
        setFiles(prev =>
          prev.map(f =>
            f.id === fileData.id
              ? { ...f, objectKey, uploadStatus: 'uploaded' }
              : f
          )
        );
        return objectKey;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles(prev =>
        prev.map(f =>
          f.id === fileData.id
            ? { ...f, uploadStatus: 'error', errorMessage }
            : f
        )
      );
      return null;
    }
  };

  const handleUploadAll = async () => {
    const pendingFiles = files.filter(f => f.uploadStatus === 'pending');

    // Upload all files in parallel
    await Promise.all(pendingFiles.map(file => uploadFile(file)));
  };

  const handleCreateArtifacts = async () => {
    try {
      setIsCreatingArtifacts(true);

      const uploadedFiles = files.filter(f => f.uploadStatus === 'uploaded' && f.objectKey);

      if (uploadedFiles.length === 0) {
        alert('Please upload at least one file before creating artifacts');
        return;
      }

      // Validate required fields
      for (const file of uploadedFiles) {
        if (!file.name.trim()) {
          alert(`Please provide a name for ${file.file.name}`);
          return;
        }
      }

      const artifactApi = APIFactory.getAPI('artifact');

      // Create artifacts in database
      const results = await Promise.all(
        uploadedFiles.map(async (file) => {
          try {
            const artifactData = {
              name: file.name,
              descr: file.descr || null,
              artifact_type: file.artifact_type,
              source_type: 'upload',
              bucket_name: 'huron-pmo-attachments', // Default bucket
              object_key: file.objectKey,
              file_size_bytes: file.file.size,
              file_format: file.file.name.split('.').pop() || 'unknown',
              tags: file.tags.length > 0 ? file.tags : null,
              active_flag: true
            };

            const response = await artifactApi.create(artifactData);
            console.log(`✅ Artifact created:`, response);
            return response;
          } catch (error) {
            console.error(`❌ Failed to create artifact for ${file.name}:`, error);
            throw error;
          }
        })
      );

      console.log(`✅ Created ${results.length} artifacts`);

      // Navigate to artifacts list
      navigate('/artifact');
    } catch (error) {
      console.error('Failed to create artifacts:', error);
      alert('Failed to create artifacts. Please try again.');
    } finally {
      setIsCreatingArtifacts(false);
    }
  };

  const allFilesUploaded = files.length > 0 && files.every(f => f.uploadStatus === 'uploaded');
  const hasUploadedFiles = files.some(f => f.uploadStatus === 'uploaded');
  const hasPendingFiles = files.some(f => f.uploadStatus === 'pending');

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/artifact')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            </button>
            <div>
              <h1 className="text-sm font-normal text-gray-500">
                Upload Artifacts
                <span className="text-xs font-light text-gray-500 ml-3">
                  Upload files to cloud storage with metadata
                </span>
              </h1>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => navigate('/artifact')}
              disabled={isCreatingArtifacts}
            >
              Cancel
            </Button>
            {hasPendingFiles && (
              <Button
                variant="secondary"
                icon={Upload}
                onClick={handleUploadAll}
                disabled={isCreatingArtifacts}
              >
                Upload All
              </Button>
            )}
            {hasUploadedFiles && (
              <Button
                variant="primary"
                icon={CheckCircle}
                onClick={handleCreateArtifacts}
                disabled={isCreatingArtifacts}
                loading={isCreatingArtifacts}
              >
                {isCreatingArtifacts ? 'Creating...' : `Create ${files.filter(f => f.uploadStatus === 'uploaded').length} Artifact(s)`}
              </Button>
            )}
          </div>
        </div>

        {/* File Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <input
            type="file"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Upload documents, photos, contracts, blueprints, and more
            </p>
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-700">
              Files ({files.length})
            </h2>

            {files.map((fileData) => (
              <div
                key={fileData.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <File className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {fileData.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(fileData.file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Upload Status */}
                    {fileData.uploadStatus === 'pending' && (
                      <span className="text-xs text-gray-500">Pending</span>
                    )}
                    {fileData.uploadStatus === 'uploading' && (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                        <span className="text-xs text-blue-600">
                          Uploading... {uploadProgress[fileData.id] || 0}%
                        </span>
                      </div>
                    )}
                    {fileData.uploadStatus === 'uploaded' && (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">Uploaded</span>
                      </div>
                    )}
                    {fileData.uploadStatus === 'error' && (
                      <span className="text-xs text-red-600">
                        Error: {fileData.errorMessage}
                      </span>
                    )}

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveFile(fileData.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      disabled={fileData.uploadStatus === 'uploading'}
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Metadata Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fileData.name}
                      onChange={(e) =>
                        handleMetadataChange(fileData.id, 'name', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter artifact name"
                      disabled={fileData.uploadStatus === 'uploaded'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={fileData.artifact_type}
                      onChange={(e) =>
                        handleMetadataChange(fileData.id, 'artifact_type', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={fileData.uploadStatus === 'uploaded'}
                    >
                      {ARTIFACT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={fileData.descr}
                      onChange={(e) =>
                        handleMetadataChange(fileData.id, 'descr', e.target.value)
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter description (optional)"
                      disabled={fileData.uploadStatus === 'uploaded'}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={fileData.tags.join(', ')}
                      onChange={(e) =>
                        handleMetadataChange(
                          fileData.id,
                          'tags',
                          e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., contract, legal, 2024"
                      disabled={fileData.uploadStatus === 'uploaded'}
                    />
                  </div>
                </div>

                {/* Upload Button for Individual File */}
                {fileData.uploadStatus === 'pending' && (
                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      icon={Upload}
                      onClick={() => uploadFile(fileData)}
                      size="sm"
                    >
                      Upload to S3
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              No files selected. Drop files above or click to browse.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
