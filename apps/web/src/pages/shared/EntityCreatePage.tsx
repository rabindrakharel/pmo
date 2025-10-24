import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, CheckCircle, X } from 'lucide-react';
import { Layout, EntityFormContainer } from '../../components/shared';
import { getEntityConfig } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { APIFactory } from '../../lib/api';
import { Button } from '../../components/shared/button/Button';
import { useS3Upload } from '../../lib/hooks/useS3Upload';

/**
 * EntityCreatePage
 *
 * Universal "new" entity creation page that uses EntityFormContainer
 * to render all fields from entityConfig, matching the look and feel
 * of EntityDetailPage.
 *
 * Features:
 * - Dynamically renders all fields based on entityConfig
 * - Loads dropdown options from settings tables
 * - Consistent styling with EntityDetailPage
 * - Handles form submission and navigation
 */

interface EntityCreatePageProps {
  entityType: string;
}

export function EntityCreatePage({ entityType }: EntityCreatePageProps) {
  const navigate = useNavigate();
  const config = getEntityConfig(entityType);
  const EntityIcon = getEntityIcon(entityType);

  // Initialize formData with default values based on field types
  const getDefaultFormData = () => {
    const defaults: Record<string, any> = {
      active_flag: true,
      tags: []
    };

    // Set defaults for required fields based on entity type
    config?.fields.forEach(field => {
      if (field.type === 'array') {
        defaults[field.key] = [];
      } else if (field.type === 'jsonb') {
        defaults[field.key] = {};
      } else if (field.type === 'select' && field.options) {
        // Don't set a default value for select fields - let user choose
        defaults[field.key] = '';
      }
    });

    return defaults;
  };

  const [formData, setFormData] = useState<Record<string, any>>(getDefaultFormData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state (for artifacts)
  const { uploadToS3, uploadingFiles, errors: uploadErrors } = useS3Upload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadedObjectKey(null); // Reset uploaded state
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const tempId = `temp-${Date.now()}`;
      const objectKey = await uploadToS3({
        entityType: 'artifact',
        entityId: tempId,
        file: selectedFile,
        fileName: selectedFile.name,
        contentType: selectedFile.type || 'application/octet-stream',
        uploadType: 'artifact',
        tenantId: 'demo'
      });

      if (objectKey) {
        setUploadedObjectKey(objectKey);
        // Auto-populate form fields
        if (!formData.name) {
          setFormData(prev => ({
            ...prev,
            name: selectedFile.name.replace(/\.[^/.]+$/, '') // Remove extension
          }));
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setError('File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedObjectKey(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      const requiredFields = config?.fields.filter(f => f.required) || [];
      for (const field of requiredFields) {
        if (!formData[field.key] || formData[field.key] === '') {
          throw new Error(`${field.label} is required`);
        }
      }

      // Extract assignee_employee_ids if present (for task entity)
      const assigneeIds = formData.assignee_employee_ids;
      const dataToCreate = { ...formData };
      delete dataToCreate.assignee_employee_ids;

      // Add artifact-specific fields if uploading a file
      if (entityType === 'artifact' && uploadedObjectKey && selectedFile) {
        dataToCreate.object_key = uploadedObjectKey;
        dataToCreate.bucket_name = 'cohuron-attachments-prod-957207443425';
        dataToCreate.file_size_bytes = selectedFile.size;
        dataToCreate.file_format = selectedFile.name.split('.').pop() || 'unknown';
      }

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);
      const created = await api.create(dataToCreate);

      const createdId = created.id || created.data?.id;

      // Handle assignees separately via linkage API (only for task entity)
      if (entityType === 'task' && createdId && assigneeIds && assigneeIds.length > 0) {
        await createTaskAssignees(createdId, assigneeIds);
      }

      // Navigate to the detail page
      if (createdId) {
        navigate(`/${entityType}/${createdId}`);
      } else {
        navigate(`/${entityType}`);
      }
    } catch (err) {
      console.error(`Failed to create ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to create entity');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to create task assignees via linkage API
  const createTaskAssignees = async (taskId: string, assigneeIds: string[]) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      // Add assignees via linkage API
      const results = await Promise.all(
        assigneeIds.map(async (employeeId) => {
          const response = await fetch(`${apiUrl}/api/v1/linkage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              parent_entity_type: 'task',
              parent_entity_id: taskId,
              child_entity_type: 'employee',
              child_entity_id: employeeId,
              relationship_type: 'assigned_to'
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to add assignee ${employeeId}:`, response.status, errorText);
            return false;
          }

          const result = await response.json();
          console.log('Assignee added:', result);
          return true;
        })
      );

      const successCount = results.filter(Boolean).length;
      console.log(`Added ${successCount}/${assigneeIds.length} assignees to task ${taskId}`);

      if (successCount < assigneeIds.length) {
        console.warn('Some assignees failed to be added');
      }
    } catch (error) {
      console.error('Failed to create task assignees:', error);
      throw error;
    }
  };

  const handleCancel = () => {
    navigate(`/${entityType}`);
  };

  if (!config) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Entity configuration not found for: {entityType}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            </button>
            <div>
              <h1 className="text-sm font-normal text-gray-500">
                Create {config.displayName}
                <span className="text-xs font-light text-gray-500 ml-3">
                  New {config.displayName}
                </span>
              </h1>
            </div>
          </div>

          {/* Save/Cancel buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              icon={ArrowLeft}
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSubmit}
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Creating...' : `Create ${config.displayName}`}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* File Upload Section (Artifacts Only) */}
        {entityType === 'artifact' && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-sm font-medium text-gray-900">File Upload</h2>

            {!selectedFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="artifact-file-upload"
                />
                <label htmlFor="artifact-file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to select a file
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Upload documents, images, videos, or any file type
                  </p>
                </label>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {uploadedObjectKey ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Upload className="h-5 w-5 text-blue-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {!uploadedObjectKey && (
                  <Button
                    variant="secondary"
                    icon={Upload}
                    onClick={handleFileUpload}
                    disabled={isUploading}
                    loading={isUploading}
                    size="sm"
                  >
                    {isUploading ? 'Uploading...' : 'Upload to S3'}
                  </Button>
                )}

                {uploadedObjectKey && (
                  <div className="flex items-center space-x-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>File uploaded successfully</span>
                  </div>
                )}
              </div>
            )}

            {uploadErrors.default && (
              <p className="text-sm text-red-600">{uploadErrors.default}</p>
            )}
          </div>
        )}

        {/* Form Container - Uses same component as EntityDetailPage */}
        <EntityFormContainer
          config={config}
          data={formData}
          isEditing={true}
          onChange={handleChange}
          mode="create"
        />
      </div>
    </Layout>
  );
}
