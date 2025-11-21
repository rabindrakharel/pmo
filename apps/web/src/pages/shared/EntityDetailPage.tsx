import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { Edit2, Save, X, Palette, Download, Upload, CheckCircle, Copy, Check, Share2, Link as LinkIcon } from 'lucide-react';
import { Layout, DynamicChildEntityTabs, useDynamicChildEntityTabs, EntityFormContainer, FilePreview, DragDropFileUpload, MetadataField, MetadataRow, MetadataSeparator } from '../../components/shared';
import { ExitButton } from '../../components/shared/button/ExitButton';
import { ShareModal } from '../../components/shared/modal';
import { UnifiedLinkageModal } from '../../components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '../../hooks/useLinkageModal';
import { WikiContentRenderer } from '../../components/entity/wiki';
import { TaskDataContainer } from '../../components/entity/task';
import { FormDataTable, InteractiveForm, FormSubmissionEditor } from '../../components/entity/form';
import { EmailTemplateRenderer } from '../../components/entity/marketing';
import { getEntityConfig } from '../../lib/entityConfig';
import { APIFactory } from '../../lib/api';
import { formatRelativeTime, formatFriendlyDate, transformForApi, type DatalabelData } from '../../lib/frontEndFormatterService';
import { Button } from '../../components/shared/button/Button';
import { useS3Upload } from '../../lib/hooks/useS3Upload';
import { useSidebar } from '../../contexts/SidebarContext';
import { useNavigationHistory } from '../../contexts/NavigationHistoryContext';

/**
 * Universal EntityDetailPage
 *
 * A single, reusable component that renders the detail page for ANY entity.
 * Integrates with DynamicChildEntityTabs for child entity navigation.
 *
 * Usage via routing:
 * - /project/:id -> EntityDetailPage with entityCode="project"
 * - /task/:id -> EntityDetailPage with entityCode="task"
 * - /wiki/:id -> EntityDetailPage with entityCode="wiki"
 * etc.
 */

interface EntityDetailPageProps {
  entityCode: string;
}

export function EntityDetailPage({ entityCode }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const config = getEntityConfig(entityCode);
  const { hideSidebar } = useSidebar();
  const { pushEntity, updateCurrentEntityName, updateCurrentEntityActiveTab } = useNavigationHistory();

  const [data, setData] = useState<any>(null);
  const [backendMetadata, setBackendMetadata] = useState<any>(null);  // Backend field metadata
  const [datalabels, setDatalabels] = useState<DatalabelData[]>([]);  // ✅ Preloaded datalabel data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [formDataRefreshKey, setFormDataRefreshKey] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingShareUrl, setIsGeneratingShareUrl] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Hide sidebar when entering entity detail page
  useEffect(() => {
    hideSidebar();
  }, []);

  // Unified linkage modal
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch entity data and child tabs when linkage changes
      loadData();
    }
  });

  // File upload state (for artifact edit/new version)
  const { uploadToS3, uploadingFiles, errors: uploadErrors } = useS3Upload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Fetch dynamic child entity tabs from API
  const { tabs, loading: tabsLoading } = useDynamicChildEntityTabs(entityCode, id || '');

  // Check if this entity has child entities (based on API response)
  const hasChildEntities = tabs && tabs.length > 0;

  // Determine current tab from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const searchParams = new URLSearchParams(location.search);
  const selectedSubmissionId = searchParams.get('submissionId');
  const submissionFromState = (location.state as any)?.submission || null;
  const currentChildEntity = pathParts.length > 2 ? pathParts[2] : null;
  const isOverviewTab = !currentChildEntity;

  // Prepare tabs with Overview as first tab - MUST be before any returns
  const allTabs = React.useMemo(() => {
    // Special handling for form entity - always show tabs
    if (entityCode === 'form') {
      const overviewTab = {
        id: 'overview',
        label: 'Overview',
        path: `/${entityCode}/${id}`,
        icon: undefined
      };

      const formDataTab = {
        id: 'form-data',
        label: 'Form Data',
        path: `/${entityCode}/${id}/form-data`,
        icon: undefined
      };

      const editSubmissionTab = {
        id: 'edit-submission',
        label: 'Edit Form Submission',
        path: `/${entityCode}/${id}/edit-submission`,
        icon: undefined
      };

      return [overviewTab, formDataTab, editSubmissionTab];
    }

    // For leaf entities (no children), don't show tabs
    if (!hasChildEntities) {
      return [];
    }

    const overviewTab = {
      id: 'overview',
      label: 'Overview',
      path: `/${entityCode}/${id}`,
      icon: undefined
    };

    // Filter out any "overview" tab that might come from the API to avoid duplicates
    const filteredTabs = (tabs || []).filter(tab =>
      tab.id !== 'overview' && tab.label?.toLowerCase() !== 'overview'
    );

    return [overviewTab, ...filteredTabs];
  }, [tabs, entityCode, id, hasChildEntities]);

  // Load entity data - defined before useEffect to avoid TDZ error
  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityCode);
      // Request metadata for detail view and form container
      const response = await api.get(id!, { view: 'entityDetailView,entityFormContainer' });

      // Check if the request was aborted
      if (signal?.aborted) {
        return;
      }

      // ✅ Extract backend metadata from API response (v4.0 architecture)
      // Backend returns: { data: {...}, metadata: {...}, datalabels: [...] }
      let responseData = response.data || response;
      let backendFieldMetadata = null;
      let backendDatalabels: DatalabelData[] = [];

      // Check if response has backend metadata structure
      if (response && typeof response === 'object' && 'metadata' in response && 'data' in response) {
        // Backend metadata present
        backendFieldMetadata = response.metadata;
        responseData = response.data;

        // ✅ Extract preloaded datalabel data for DAG visualization
        if ('datalabels' in response && Array.isArray(response.datalabels)) {
          backendDatalabels = response.datalabels;
        }
      }

      // Special handling for form entity - parse schema if it's a string
      if (entityCode === 'form' && responseData.form_schema && typeof responseData.form_schema === 'string') {
        try {
          responseData = {
            ...responseData,
            form_schema: JSON.parse(responseData.form_schema)
          };
        } catch (e) {
          console.error('Failed to parse form schema:', e);
        }
      }

      // Parse metadata (or attr alias) if it's a string
      const metadataField = responseData.metadata || responseData.attr;
      if (metadataField && typeof metadataField === 'string') {
        try {
          const parsed = JSON.parse(metadataField);
          responseData.metadata = parsed;
          responseData.attr = parsed;
        } catch (e) {
          console.error('Failed to parse metadata:', e);
          responseData.metadata = {};
          responseData.attr = {};
        }
      }

      setData(responseData);
      setBackendMetadata(backendFieldMetadata);  // Set backend metadata
      setDatalabels(backendDatalabels);  // ✅ Set preloaded datalabel data
      setEditedData(responseData);
      // Preview URL will be fetched by useEffect
    } catch (err) {
      console.error(`Failed to load ${entityCode}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id, entityCode]);

  // Use a ref to track if data is currently being loaded to prevent double fetching
  const isLoadingRef = React.useRef(false);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      if (id && !isLoadingRef.current) {
        isLoadingRef.current = true;
        try {
          await loadData(abortController.signal);
        } finally {
          if (!abortController.signal.aborted) {
            isLoadingRef.current = false;
          }
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
      isLoadingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, entityCode]); // loadData excluded to prevent circular dependency

  // Auto-edit mode when navigating from child entity creation
  useEffect(() => {
    const locationState = location.state as any;
    if (locationState?.autoEdit && data && !loading) {
      setIsEditing(true);
      // Clear the state to prevent re-entering edit mode on subsequent navigations
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.state]); // data removed from deps - we only care if it exists, not its contents

  // Register entity in navigation history when data is loaded
  // Use a ref to track if we've already pushed this entity to prevent duplicates
  const hasPushedEntityRef = React.useRef(false);

  useEffect(() => {
    if (data && id && !hasPushedEntityRef.current) {
      hasPushedEntityRef.current = true;
      pushEntity({
        entityCode,
        entityId: id,
        entityName: data.name || data.title || 'Untitled',
        timestamp: Date.now()
      });
    }

    // Reset the flag when entity changes
    return () => {
      if (id !== data?.id) {
        hasPushedEntityRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, id, entityCode]); // Only re-run when entity ID changes, not entire data object

  // Update entity name in navigation history when it changes
  // Use a timeout to debounce rapid updates
  useEffect(() => {
    if (data) {
      const timeoutId = setTimeout(() => {
        const entityName = data.name || data.title || 'Untitled';
        updateCurrentEntityName(entityName);
      }, 100); // Small debounce to prevent rapid updates

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.name, data?.title]); // updateCurrentEntityName removed from deps

  // Update current entity's active tab when viewing a child entity tab
  // This ensures we return to the correct tab when going back
  useEffect(() => {
    if (currentChildEntity) {
      const timeoutId = setTimeout(() => {
        updateCurrentEntityActiveTab(currentChildEntity);
      }, 50); // Small debounce

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChildEntity]); // updateCurrentEntityActiveTab removed from deps

  const handleSave = async () => {
    try {
      // Special handling for artifact with new file upload (create new version)
      if (entityCode === 'artifact' && uploadedObjectKey && selectedFile) {
        const token = localStorage.getItem('auth_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

        const fileExtension = selectedFile.name.split('.').pop() || 'unknown';
        const response = await fetch(`${apiUrl}/api/v1/artifact/${id}/new-version`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type || 'application/octet-stream',
            fileSize: selectedFile.size,
            attachment_format: fileExtension,
            attachment_size_bytes: selectedFile.size,
            attachment_object_key: uploadedObjectKey, // Send the already-uploaded object key
            descr: editedData.descr || data.descr,
            // Include any updated metadata fields from editedData
            visibility: editedData.visibility,
            security_classification: editedData.security_classification,
            artifact_type: editedData.artifact_type
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create new version');
        }

        const result = await response.json();
        alert(`New version created: v${result.newArtifact.version}`);

        // Navigate to the new version
        navigate(`/artifact/${result.newArtifact.id}`);
        return;
      }

      // Special handling for cost/revenue with new file upload (replace attachment)
      if ((entityCode === 'cost' || entityCode === 'revenue') && uploadedObjectKey) {
        const attachmentField = entityCode === 'cost' ? 'invoice_attachment' : 'sales_receipt_attachment';
        editedData[attachmentField] = `s3://cohuron-attachments-prod-957207443425/${uploadedObjectKey}`;

        // Reset file upload state after adding to edited data
        setSelectedFile(null);
        setUploadedObjectKey(null);
      }

      // Normal update flow for all other entities (and artifacts without file upload)
      // Use centralized transformForApi function (same as inline table edit)
      // This handles: date normalization, empty strings → null, arrays, etc.
      const normalizedData = transformForApi(editedData, data);

      // Extract assignee_employee_ids if present (for task entity)
      const assigneeIds = normalizedData.assignee_employee_ids;
      const dataToUpdate = { ...normalizedData };
      delete dataToUpdate.assignee_employee_ids;
      delete dataToUpdate.assignee_employee_names; // Remove computed field

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityCode);
      const updateResponse = await api.update(id!, dataToUpdate);

      // Handle assignees separately via linkage API (only for task entity)
      if (entityCode === 'task' && assigneeIds !== undefined) {
        await updateTaskAssignees(id!, assigneeIds);
      }

      // ✅ OPTIMIZED: Check if PATCH returns just data or full response
      let updatedData = data; // Start with current data as fallback

      if (updateResponse) {
        // If PATCH returns data, use it
        if (updateResponse.data) {
          // Full response structure (for backward compatibility)
          updatedData = updateResponse.data;
        } else if (updateResponse.id) {
          // Just the updated entity data (optimized response)
          updatedData = updateResponse;
        }

        // Special handling for form entity - parse schema if it's a string
        if (entityCode === 'form' && updatedData.form_schema && typeof updatedData.form_schema === 'string') {
          try {
            updatedData = {
              ...updatedData,
              form_schema: JSON.parse(updatedData.form_schema)
            };
          } catch (e) {
            console.error('Failed to parse form schema:', e);
          }
        }

        // Parse metadata (or attr alias) if it's a string
        const metadataField = updatedData.metadata || updatedData.attr;
        if (metadataField && typeof metadataField === 'string') {
          try {
            const parsed = JSON.parse(metadataField);
            updatedData.metadata = parsed;
            updatedData.attr = parsed;
          } catch (e) {
            console.error('Failed to parse metadata:', e);
            updatedData.metadata = {};
            updatedData.attr = {};
          }
        }
      }

      // For task entity with assignees, we need to refetch to get updated assignee names
      if (entityCode === 'task' && assigneeIds !== undefined) {
        const response = await api.get(id!, { view: 'entityDetailView' });
        updatedData = response.data || response;
      }

      // ✅ OPTIMIZED: Reuse existing metadata and datalabels (they don't change on update)
      setData(updatedData);
      // Keep existing backendMetadata and datalabels - no need to update them
      setEditedData(updatedData);
      setIsEditing(false);
      // Optionally show success toast
    } catch (err) {
      console.error(`Failed to update ${entityCode}:`, err);
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Helper function to update task assignees via linkage API
  const updateTaskAssignees = async (taskId: string, newAssigneeIds: string[]) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      // 1. Get current assignees
      const currentResponse = await fetch(`${apiUrl}/api/v1/task/${taskId}/assignees`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!currentResponse.ok) {
        throw new Error(`Failed to fetch current assignees: ${currentResponse.statusText}`);
      }

      const { data: currentAssignees } = await currentResponse.json();

      // 2. Find assignees to remove
      const currentIds = currentAssignees.map((a: any) => a.id);
      const toRemove = currentAssignees.filter((a: any) => !newAssigneeIds.includes(a.id));

      // 3. Remove old assignees
      if (toRemove.length > 0) {
        const removeResults = await Promise.all(
          toRemove.map(async (assignee: any) => {
            const response = await fetch(`${apiUrl}/api/v1/linkage/${assignee.linkage_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
              console.error(`Failed to remove assignee ${assignee.id}:`, response.statusText);
            }
            return response.ok;
          })
        );
        console.log(`Removed ${removeResults.filter(Boolean).length} assignees`);
      }

      // 4. Find assignees to add
      const toAdd = newAssigneeIds.filter(id => !currentIds.includes(id));

      // 5. Add new assignees
      if (toAdd.length > 0) {
        const addResults = await Promise.all(
          toAdd.map(async (employeeId) => {
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
        console.log(`Added ${addResults.filter(Boolean).length}/${toAdd.length} assignees`);
      }

      console.log('Task assignees updated successfully');
    } catch (error) {
      console.error('Failed to update task assignees:', error);
      throw error;
    }
  };

  const handleCancel = () => {
    setEditedData(data);
    setIsEditing(false);
  };

  // Use refs to avoid re-renders on every field change
  const editedDataRef = React.useRef<any>({});
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync editedData when entering edit mode
  React.useEffect(() => {
    if (isEditing && data) {
      editedDataRef.current = { ...data };
      setEditedData({ ...data });
    }
  }, [data, isEditing]);

  const handleFieldChange = React.useCallback((fieldName: string, value: any) => {
    // Update the ref immediately (no re-render)
    editedDataRef.current = { ...editedDataRef.current, [fieldName]: value };

    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce the state update to reduce re-renders
    updateTimeoutRef.current = setTimeout(() => {
      setEditedData({ ...editedDataRef.current });
    }, 300); // 300ms debounce for typing
  }, []);

  const handleTabClick = (tabPath: string) => {
    if (tabPath === 'overview') {
      navigate(`/${entityCode}/${id}`);
    } else {
      navigate(`/${entityCode}/${id}/${tabPath}`);
    }
  };

  const handleDownload = async () => {
    if (entityCode !== 'artifact' || !data?.attachment_object_key) {
      alert('No file available for download');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/artifact/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to generate download URL');
      }

      const { url } = await response.json();

      // Open download URL in new tab
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file');
    }
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

    setIsUploadingFile(true);
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
        // Auto-populate file metadata immediately for the new version
        const fileExtension = selectedFile.name.split('.').pop() || 'unknown';
        setEditedData(prev => ({
          ...prev,
          attachment_format: fileExtension,
          attachment_size_bytes: selectedFile.size
        }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('File upload failed');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedObjectKey(null);
    // Restore original file metadata from current version
    setEditedData(prev => ({
      ...prev,
      attachment_format: data.attachment_format || '',
      attachment_size_bytes: data.attachment_size_bytes || 0
    }));
  };

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleGenerateShareUrl = async () => {
    if (!id) return;

    setIsGeneratingShareUrl(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const response = await fetch(`${apiUrl}/api/v1/${entityCode}/${id}/share-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate share URL');
      }

      const result = await response.json();
      const shareUrl = result.sharedUrl || result.shared_url;

      // Update local state
      setData({ ...data, shared_url: shareUrl });
      setEditedData({ ...editedData, shared_url: shareUrl });

      // Copy to clipboard
      await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
      setCopiedField('share');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to generate share URL:', err);
      alert('Failed to generate share URL');
    } finally {
      setIsGeneratingShareUrl(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!data?.shared_url) return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${data.shared_url}`);
      setCopiedField('share');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">{error || 'Data not found'}</p>
          <Button
            variant="primary"
            onClick={loadData}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  // DRY: Consistent metadata value styling (standardized to use Tailwind only)
  const metadataValueClass = "text-sm text-dark-600 leading-normal tracking-tight whitespace-nowrap";

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto">
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-20 bg-white pb-2">
          {/* Header */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Exit button on left */}
            <ExitButton entityCode={entityCode} isDetailPage={true} />

            <div className="flex-1 min-w-0 px-2">
              {/* Compact metadata row using DRY components */}
              <MetadataRow className="overflow-x-auto">
                {/* Name */}
                <MetadataField
                  label={`${config.displayName} name`}
                  value={isEditing ? (editedData.name || editedData.title || '') : (data.name || data.title || `${config.displayName} Details`)}
                  isEditing={isEditing}
                  fieldKey="name"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                  onChange={handleFieldChange}
                  placeholder="Enter name..."
                  inputWidth="16rem"
                />

                <MetadataSeparator show={!!(data.code || id)} />

                {/* Code */}
                {(data.code || isEditing) && (
                  <MetadataField
                    label="code"
                    value={isEditing ? (editedData.code || '') : data.code}
                    isEditing={isEditing}
                    fieldKey="code"
                    copiedField={copiedField}
                    onCopy={handleCopy}
                    onChange={handleFieldChange}
                    placeholder="CODE"
                    inputWidth="8rem"
                  />
                )}

                <MetadataSeparator show={!!(data.code && id)} />

                {/* ID */}
                {id && (
                  <MetadataField
                    label="id"
                    value={id}
                    isEditing={false}
                    fieldKey="id"
                    copiedField={copiedField}
                    onCopy={handleCopy}
                    className="text-dark-700"
                  />
                )}

                <MetadataSeparator show={!!(data.created_ts || data.updated_ts)} />

                {/* Created */}
                {data.created_ts && (
                  <>
                    <span className="text-gray-400 font-normal text-xs flex-shrink-0">created:</span>
                    <span
                      className="text-gray-700 font-medium text-sm"
                      title={formatFriendlyDate(data.created_ts)}
                    >
                      {formatRelativeTime(data.created_ts)}
                    </span>
                  </>
                )}

                <MetadataSeparator show={!!(data.created_ts && data.updated_ts)} />

                {/* Updated */}
                {data.updated_ts && (
                  <>
                    <span className="text-gray-400 font-normal text-xs flex-shrink-0">updated:</span>
                    <span
                      className="text-gray-700 font-medium text-sm"
                      title={formatFriendlyDate(data.updated_ts)}
                    >
                      {formatRelativeTime(data.updated_ts)}
                    </span>
                  </>
                )}

                <MetadataSeparator show={!!(entityCode === 'artifact' && data.version && id)} />

                {/* Version badge (for artifacts) */}
                {entityCode === 'artifact' && data.version && (
                  <MetadataField
                    label="version"
                    value={`v${data.version}`}
                    isEditing={false}
                    fieldKey="version"
                    canCopy={false}
                    badge={
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                        v{data.version}
                      </span>
                    }
                  />
                )}
              </MetadataRow>
            </div>
          </div>

          {/* Edit/Save/Cancel buttons */}
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <>
                {/* Special Design Email button for marketing entity */}
                {entityCode === 'marketing' && (
                  <Button
                    variant="primary"
                    icon={Palette}
                    onClick={() => navigate(`/marketing/${id}/design`)}
                  >
                    Design Email
                  </Button>
                )}
                {/* Download button for artifact entity with attachment_object_key */}
                {entityCode === 'artifact' && data?.attachment_object_key && (
                  <button
                    onClick={handleDownload}
                    className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                  </button>
                )}
                {/* Link button for managing entity relationships */}
                <button
                  onClick={() => linkageModal.openAssignParent({
                    childEntityType: entityCode,
                    childEntityId: id!,
                    childEntityName: data?.name || data?.title
                  })}
                  className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                  title="Manage links"
                >
                  <LinkIcon className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>

                {/* Share button - available for all entities */}
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                  title="Share"
                >
                  <Share2 className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>

                {/* Edit button */}
                <button
                  onClick={() => {
                    // Special handling for form entity - navigate to edit page
                    if (entityCode === 'form') {
                      navigate(`/form/${id}/edit`);
                    } else if (entityCode === 'marketing') {
                      navigate(`/marketing/${id}/design`);
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Cancel"
                >
                  <X className="h-4 w-4 stroke-[1.5]" />
                </button>
                <button
                  onClick={handleSave}
                  className="p-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md transition-colors"
                  title="Save"
                >
                  <Save className="h-4 w-4 stroke-[1.5]" />
                </button>
              </>
            )}
          </div>
          </div>

          {/* Sticky Tabs Section */}
          {allTabs && allTabs.length > 0 && (
            <div className="mt-4 border-b border-gray-100">
              <DynamicChildEntityTabs
                title={data?.name || data?.title || config.displayName}
                parentType={entityCode}
                parentId={id!}
                parentName={data?.name || data?.title}
                tabs={allTabs}
                showBackButton={false}
              />
            </div>
          )}
        </div>

        {/* Content Area - Shows Overview or Child Entity Table */}
        <div className="mt-6">
        {isOverviewTab ? (
          // Overview Tab - Entity Details
          <>
            {/* Entity-specific content - METADATA COMES FIRST */}
            {entityCode === 'wiki' ? (
            // Special Wiki Content Renderer
            <WikiContentRenderer
              data={data}
              onEdit={() => navigate(`/wiki/${id}/edit`)}
            />
          ) : entityCode === 'marketing' ? (
            // Special Email Template Renderer
            <div className="space-y-4">
              <EmailTemplateRenderer template={data} />
            </div>
          ) : entityCode === 'form' ? (
            // Special Interactive Form Renderer
            <div className="space-y-4 bg-dark-100 border border-dark-300 rounded-xl p-6 shadow-sm">
              {(() => {
                // Extract and prepare fields from schema
                // Parse form_schema if it's a string
                let schema = data.form_schema || {};
                if (typeof schema === 'string') {
                  try {
                    schema = JSON.parse(schema);
                    console.log('Parsed form_schema from string:', schema);
                  } catch (e) {
                    console.error('Failed to parse form_schema:', e);
                    schema = {};
                  }
                }

                const steps = schema.steps || [];
                const fields = steps.flatMap((step: any) =>
                  (step.fields || []).map((field: any) => ({
                    ...field,
                    id: field.id || field.name || crypto.randomUUID(),
                    stepId: step.id
                  }))
                );

                console.log('Interactive Form Debug:', {
                  formId: id,
                  rawSchema: data.form_schema,
                  schemaType: typeof data.form_schema,
                  parsedSchema: schema,
                  hasSchema: !!data.form_schema,
                  stepsCount: steps.length,
                  fieldsCount: fields.length,
                  steps: JSON.stringify(steps, null, 2),
                  fields: JSON.stringify(fields, null, 2)
                });

                return (
                  <InteractiveForm
                    formId={id!}
                    fields={fields}
                    steps={steps}
                    onSubmitSuccess={() => {
                      // Optionally reload data or show notification
                      console.log('Form submitted successfully!');
                    }}
                  />
                );
              })()}
            </div>
          ) : (
            // Standard Entity Details (Notion-style minimalistic design)
            <div className="space-y-3">
              {/* Metadata Block - EntityFormContainer */}
              <EntityFormContainer
                config={config}
                metadata={backendMetadata}  // ✅ Pass backend metadata (v4.0)
                datalabels={datalabels}  // ✅ Pass preloaded datalabel data
                data={isEditing ? editedData : data}
                isEditing={isEditing}
                onChange={handleFieldChange}
                mode="edit"
                autoGenerateFields={true}   // Fallback for non-integrated routes
              />

              {/* Task Data Container - Only show for task entity */}
              {entityCode === 'task' && (
                <TaskDataContainer
                  taskId={id!}
                  projectId={data.project_id || undefined}
                  onUpdatePosted={() => {
                    // Optionally refresh task data here
                    console.log('Task update posted');
                  }}
                />
              )}
            </div>
          )}

            {/* File Preview Section - For artifacts, cost, and revenue - BELOW METADATA */}
            {(entityCode === 'artifact' || entityCode === 'cost' || entityCode === 'revenue') && data && (
              <FilePreview
                entityCode={entityCode as 'artifact' | 'cost' | 'revenue'}
                entityId={id!}
                data={data}
                isEditing={isEditing}
              />
            )}

            {/* File Upload for Artifacts, Cost, Revenue - Only in Edit Mode */}
            {(entityCode === 'artifact' || entityCode === 'cost' || entityCode === 'revenue') && isEditing && (
              <DragDropFileUpload
                entityCode={entityCode as 'artifact' | 'cost' | 'revenue'}
                selectedFile={selectedFile}
                uploadedObjectKey={uploadedObjectKey}
                isUploading={isUploadingFile}
                onFileSelect={(file) => setSelectedFile(file)}
                onFileRemove={handleRemoveFile}
                onFileUpload={handleFileUpload}
                uploadError={uploadErrors.default}
                accept={entityCode === 'cost' || entityCode === 'revenue' ? '.pdf,.png,.jpg,.jpeg' : undefined}
              />
            )}
          </>
        ) : currentChildEntity === 'form-data' ? (
          // Form Data Tab - Show form submissions
          <FormDataTable formId={id!} formSchema={data.form_schema} refreshKey={formDataRefreshKey} />
        ) : currentChildEntity === 'edit-submission' ? (
          <div className="bg-dark-100 border border-dark-300 rounded-xl p-6 shadow-sm">
            <FormSubmissionEditor
              form={data}
              formId={id!}
              submissionId={selectedSubmissionId}
              submission={submissionFromState || undefined}
              onSubmissionUpdated={() => {
                setFormDataRefreshKey((prev) => prev + 1);
                loadData();
              }}
            />
          </div>
        ) : (
          // Child Entity Tab - Filtered Data Table
          <Outlet />
        )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        entityCode={entityCode}
        entityId={id!}
        entityName={data?.name || data?.title}
        currentSharedUrl={data?.shared_url}
        onShare={async (shareData) => {
          console.log('Sharing with:', shareData);
          // The modal handles URL generation for public shares
          // For user/role shares, implement RBAC API calls here
          if (shareData.shareType === 'users' && shareData.userIds) {
            // Grant permissions to users
            console.log('Grant permissions to users:', shareData.userIds);
          } else if (shareData.shareType === 'roles' && shareData.roleIds) {
            // Grant permissions to roles
            console.log('Grant permissions to roles:', shareData.roleIds);
          }
        }}
      />

      {/* Unified Linkage Modal */}
      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </Layout>
  );
}

/**
 * Usage Examples:
 *
 * In routes:
 * <Route path="/project/:id" element={<EntityDetailPage entityCode="project" />}>
 *   <Route path="task" element={<EntityChildListPage entityCode="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage entityCode="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage entityCode="artifact" />} />
 * </Route>
 *
 * <Route path="/task/:id" element={<EntityDetailPage entityCode="task" />} />
 * <Route path="/wiki/:id" element={<EntityDetailPage entityCode="wiki" />} />
 * <Route path="/artifact/:id" element={<EntityDetailPage entityCode="artifact" />} />
 */
