import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Upload, CheckCircle, X } from 'lucide-react';
import { Layout, EntityInstanceFormContainer, DragDropFileUpload } from '../../components/shared';
import { getEntityConfig } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { APIFactory } from '../../lib/api';
import { Button } from '../../components/shared/button/Button';
import { useS3Upload } from '../../lib/hooks/useS3Upload';
import { useSidebar } from '../../contexts/SidebarContext';

/**
 * EntityCreatePage
 *
 * Universal "new" entity creation page that uses EntityInstanceFormContainer
 * to render all fields from entityConfig, matching the look and feel
 * of EntitySpecificInstancePage.
 *
 * Features:
 * - Dynamically renders all fields based on entityConfig
 * - Loads dropdown options from settings tables
 * - Consistent styling with EntitySpecificInstancePage
 * - Handles form submission and navigation
 */

interface EntityCreatePageProps {
  entityCode: string;
}

export function EntityCreatePage({ entityCode }: EntityCreatePageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = getEntityConfig(entityCode);
  const EntityIcon = getEntityIcon(entityCode);
  const { hideSidebar } = useSidebar();

  // Get parent context from navigation state (if creating from child list page)
  const parentContext = location.state as { parentType?: string; parentId?: string; returnTo?: string } | undefined;

  // Hide sidebar when entering entity create page
  useEffect(() => {
    hideSidebar();
  }, []);

  // Initialize formData with default values based on field types
  const getDefaultFormData = () => {
    const defaults: Record<string, any> = {
      active_flag: true
    };

    // Set defaults for required fields based on entity type
    config?.fields.forEach(field => {
      if (field.type === 'array') {
        defaults[field.key] = [];
      } else if (field.type === 'jsonb') {
        defaults[field.key] = {};
      } else if (field.type === 'select' && field.defaultValue) {
        // Use defaultValue from field config if specified
        defaults[field.key] = field.defaultValue;
      } else if (field.type === 'select' && field.options) {
        // Don't set a default value for select fields without defaultValue
        defaults[field.key] = '';
      }
    });

    // Entity-specific defaults
    if (entityCode === 'artifact') {
      const timestamp = Date.now();
      defaults.code = defaults.code || `ART-${timestamp}`;
    } else if (entityCode === 'cost') {
      const timestamp = Date.now();
      defaults.code = defaults.code || `CST-${timestamp}`;
      defaults.cost_code = defaults.cost_code || `COST-${timestamp}`;
      defaults.invoice_currency = defaults.invoice_currency || 'CAD';
      defaults.exch_rate = defaults.exch_rate || 1.0;
    } else if (entityCode === 'revenue') {
      const timestamp = Date.now();
      defaults.code = defaults.code || `REV-${timestamp}`;
      defaults.revenue_code = defaults.revenue_code || `REV-${timestamp}`;
      defaults.invoice_currency = defaults.invoice_currency || 'CAD';
      defaults.exch_rate = defaults.exch_rate || 1.0;
    }

    return defaults;
  };

  const [formData, setFormData] = useState<Record<string, any>>(getDefaultFormData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backend metadata (v4.0 architecture) - currently unused in create mode
  // Future: Can fetch entity type metadata from backend for consistent field rendering
  const [backendMetadata, setBackendMetadata] = useState<any>(null);

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
      const uploadType = entityCode === 'cost' ? 'invoice' : entityCode === 'revenue' ? 'receipt' : 'artifact';

      const objectKey = await uploadToS3({
        entityCode: entityCode === 'cost' || entityCode === 'revenue' ? entityCode : 'artifact',
        entityId: tempId,
        file: selectedFile,
        fileName: selectedFile.name,
        contentType: selectedFile.type || 'application/octet-stream',
        uploadType,
        tenantId: 'demo'
      });

      if (objectKey) {
        setUploadedObjectKey(objectKey);

        // Auto-populate form fields based on entity type
        const fileExtension = selectedFile.name.split('.').pop() || 'unknown';

        if (entityCode === 'artifact') {
          setFormData(prev => ({
            ...prev,
            name: selectedFile.name, // Always auto-populate name from filename
            attachment_format: fileExtension,
            attachment_size_bytes: selectedFile.size
          }));
        } else if (entityCode === 'cost') {
          setFormData(prev => ({
            ...prev,
            name: !prev.name ? selectedFile.name.replace(/\.[^/.]+$/, '') : prev.name
          }));
        } else if (entityCode === 'revenue') {
          setFormData(prev => ({
            ...prev,
            name: !prev.name ? selectedFile.name.replace(/\.[^/.]+$/, '') : prev.name
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
    // Clear auto-populated file fields
    if (entityCode === 'artifact') {
      setFormData(prev => ({
        ...prev,
        name: '',
        attachment_format: '',
        attachment_size_bytes: 0
      }));
    }
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

      // Add attachment fields based on entity type
      if (uploadedObjectKey) {
        if (entityCode === 'artifact') {
          dataToCreate.attachment_object_key = uploadedObjectKey;
          dataToCreate.attachment_object_bucket = 'cohuron-attachments-prod-957207443425';
          // attachment_format and attachment_size_bytes are already in formData from handleFileUpload
        } else if (entityCode === 'cost') {
          // Store full S3 URI for cost invoice attachment
          dataToCreate.invoice_attachment = `s3://cohuron-attachments-prod-957207443425/${uploadedObjectKey}`;
        } else if (entityCode === 'revenue') {
          // Store full S3 URI for revenue receipt attachment
          dataToCreate.sales_receipt_attachment = `s3://cohuron-attachments-prod-957207443425/${uploadedObjectKey}`;
        }
      }

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityCode);
      const created = await api.create(dataToCreate);

      const createdId = created.id || created.data?.id;

      // Handle assignees separately via linkage API (only for task entity)
      if (entityCode === 'task' && createdId && assigneeIds && assigneeIds.length > 0) {
        await createTaskAssignees(createdId, assigneeIds);
      }

      // Create parent-child linkage if created from child list page
      if (createdId && parentContext?.parentType && parentContext?.parentId) {
        await createParentChildLinkage(
          parentContext.parentType,
          parentContext.parentId,
          entityCode,
          createdId
        );
      }

      // Navigate to appropriate page
      if (createdId) {
        // If created from child list page, return to that page
        if (parentContext?.returnTo) {
          navigate(parentContext.returnTo);
        } else {
          navigate(`/${entityCode}/${createdId}`);
        }
      } else {
        navigate(`/${entityCode}`);
      }
    } catch (err) {
      console.error(`Failed to create ${entityCode}:`, err);
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

  // Helper function to create parent-child linkage via linkage API
  const createParentChildLinkage = async (
    parentType: string,
    parentId: string,
    childType: string,
    childId: string
  ) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/linkage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          parent_entity_type: parentType,
          parent_entity_id: parentId,
          child_entity_type: childType,
          child_entity_id: childId,
          relationship_type: 'contains'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create linkage:`, response.status, errorText);
        console.warn('Entity created but linkage failed - can be fixed later');
        return;
      }

      const result = await response.json();
      console.log(`✅ Created linkage: ${parentType}/${parentId} → ${childType}/${childId}`);
      return result;
    } catch (error) {
      console.error('Failed to create parent-child linkage:', error);
      // Don't throw - entity is created, linkage can be fixed later
    }
  };

  const handleCancel = () => {
    // If created from child list page, return to that page
    if (parentContext?.returnTo) {
      navigate(parentContext.returnTo);
    } else {
      navigate(`/${entityCode}`);
    }
  };

  if (!config) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Entity configuration not found for: {entityCode}</p>
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
              className="p-2 hover:bg-dark-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-dark-700 stroke-[1.5]" />
            </button>
            <div>
              <h1 className="text-sm font-normal text-dark-700">
                Create {config.displayName}
                <span className="text-xs font-light text-dark-700 ml-3">
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
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* File Upload Section (Artifacts, Cost, Revenue) */}
        {(entityCode === 'artifact' || entityCode === 'cost' || entityCode === 'revenue') && (
          <DragDropFileUpload
            entityCode={entityCode as 'artifact' | 'cost' | 'revenue'}
            selectedFile={selectedFile}
            uploadedObjectKey={uploadedObjectKey}
            isUploading={isUploading}
            onFileSelect={(file) => setSelectedFile(file)}
            onFileRemove={handleRemoveFile}
            onFileUpload={handleFileUpload}
            uploadError={uploadErrors.default}
            accept={entityCode === 'cost' || entityCode === 'revenue' ? '.pdf,.png,.jpg,.jpeg' : undefined}
          />
        )}

        {/* Form Container - Uses same component as EntitySpecificInstancePage */}
        <EntityInstanceFormContainer
          config={config}
          metadata={backendMetadata}  // v4.0 architecture - currently uses config fallback
          datalabels={[]}             // Empty - EntityInstanceFormContainer will use API fallback for DAG fields
          data={formData}
          isEditing={true}
          onChange={handleChange}
          mode="create"
        />
      </div>
    </Layout>
  );
}
