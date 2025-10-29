import React, { useState, useEffect } from 'react';
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
import { formatRelativeTime, formatFriendlyDate } from '../../lib/data_transform_render';
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
 * - /project/:id -> EntityDetailPage with entityType="project"
 * - /task/:id -> EntityDetailPage with entityType="task"
 * - /wiki/:id -> EntityDetailPage with entityType="wiki"
 * etc.
 */

interface EntityDetailPageProps {
  entityType: string;
}

export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const config = getEntityConfig(entityType);
  const { hideSidebar } = useSidebar();
  const { pushEntity, updateCurrentEntityName, updateCurrentEntityActiveTab } = useNavigationHistory();

  const [data, setData] = useState<any>(null);
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
      fetchData();
    }
  });

  // File upload state (for artifact edit/new version)
  const { uploadToS3, uploadingFiles, errors: uploadErrors } = useS3Upload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Fetch dynamic child entity tabs from API
  const { tabs, loading: tabsLoading } = useDynamicChildEntityTabs(entityType, id || '');

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
    if (entityType === 'form') {
      const overviewTab = {
        id: 'overview',
        label: 'Overview',
        path: `/${entityType}/${id}`,
        icon: undefined
      };

      const formDataTab = {
        id: 'form-data',
        label: 'Form Data',
        path: `/${entityType}/${id}/form-data`,
        icon: undefined
      };

      const editSubmissionTab = {
        id: 'edit-submission',
        label: 'Edit Form Submission',
        path: `/${entityType}/${id}/edit-submission`,
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
      path: `/${entityType}/${id}`,
      icon: undefined
    };

    // Filter out any "overview" tab that might come from the API to avoid duplicates
    const filteredTabs = (tabs || []).filter(tab =>
      tab.id !== 'overview' && tab.label?.toLowerCase() !== 'overview'
    );

    return [overviewTab, ...filteredTabs];
  }, [tabs, entityType, id, hasChildEntities]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, entityType]);

  // Auto-edit mode when navigating from child entity creation
  useEffect(() => {
    const locationState = location.state as any;
    if (locationState?.autoEdit && data && !loading) {
      setIsEditing(true);
      // Clear the state to prevent re-entering edit mode on subsequent navigations
      window.history.replaceState({}, document.title);
    }
  }, [data, loading, location.state]);

  // Register entity in navigation history when data is loaded
  useEffect(() => {
    if (data && id) {
      pushEntity({
        entityType,
        entityId: id,
        entityName: data.name || data.title || 'Untitled',
        timestamp: Date.now()
      });
    }
  }, [data, id, entityType, pushEntity]);

  // Update entity name in navigation history when it changes
  useEffect(() => {
    if (data) {
      const entityName = data.name || data.title || 'Untitled';
      updateCurrentEntityName(entityName);
    }
  }, [data?.name, data?.title, updateCurrentEntityName]);

  // Update current entity's active tab when viewing a child entity tab
  // This ensures we return to the correct tab when going back
  useEffect(() => {
    if (currentChildEntity) {
      updateCurrentEntityActiveTab(currentChildEntity);
    }
  }, [currentChildEntity, updateCurrentEntityActiveTab]);


  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);
      const response = await api.get(id!);
      let responseData = response.data || response;

      // Special handling for form entity - parse schema if it's a string
      if (entityType === 'form' && responseData.form_schema && typeof responseData.form_schema === 'string') {
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
      setEditedData(responseData);
      // Preview URL will be fetched by useEffect
    } catch (err) {
      console.error(`Failed to load ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Special handling for artifact with new file upload (create new version)
      if (entityType === 'artifact' && uploadedObjectKey && selectedFile) {
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
            file_format: fileExtension,
            file_size_bytes: selectedFile.size,
            object_key: uploadedObjectKey, // Send the already-uploaded object key
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
      if ((entityType === 'cost' || entityType === 'revenue') && uploadedObjectKey) {
        const attachmentField = entityType === 'cost' ? 'invoice_attachment' : 'sales_receipt_attachment';
        editedData[attachmentField] = `s3://cohuron-attachments-prod-957207443425/${uploadedObjectKey}`;

        // Reset file upload state after adding to edited data
        setSelectedFile(null);
        setUploadedObjectKey(null);
      }

      // Normal update flow for all other entities (and artifacts without file upload)
      // Normalize date fields to YYYY-MM-DD format for API validation
      const normalizedData = { ...editedData };

      // Find all date fields from config and normalize them
      config.fields.forEach(field => {
        if (field.type === 'date' && normalizedData[field.key]) {
          const value = normalizedData[field.key];
          // If value is a string with timestamp, extract just the date part
          if (typeof value === 'string' && value.includes('T')) {
            normalizedData[field.key] = value.split('T')[0];
          } else if (value instanceof Date) {
            // If it's a Date object, convert to YYYY-MM-DD
            normalizedData[field.key] = value.toISOString().split('T')[0];
          }
        }
      });

      // Extract assignee_employee_ids if present (for task entity)
      const assigneeIds = normalizedData.assignee_employee_ids;
      const dataToUpdate = { ...normalizedData };
      delete dataToUpdate.assignee_employee_ids;
      delete dataToUpdate.assignee_employee_names; // Remove computed field

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);
      await api.update(id!, dataToUpdate);

      // Handle assignees separately via linkage API (only for task entity)
      if (entityType === 'task' && assigneeIds !== undefined) {
        await updateTaskAssignees(id!, assigneeIds);
      }

      // Refetch data to get updated assignee info
      const updatedData = await api.get(id!);
      setData(updatedData);
      setEditedData(updatedData);
      setIsEditing(false);
      // Optionally show success toast
    } catch (err) {
      console.error(`Failed to update ${entityType}:`, err);
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

  const handleFieldChange = (fieldName: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [fieldName]: value }));
  };

  const handleTabClick = (tabPath: string) => {
    if (tabPath === 'overview') {
      navigate(`/${entityType}/${id}`);
    } else {
      navigate(`/${entityType}/${id}/${tabPath}`);
    }
  };

  const handleDownload = async () => {
    if (entityType !== 'artifact' || !data?.object_key) {
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
      const uploadType = entityType === 'cost' ? 'invoice' : entityType === 'revenue' ? 'receipt' : 'artifact';

      const objectKey = await uploadToS3({
        entityType: entityType === 'cost' || entityType === 'revenue' ? entityType : 'artifact',
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
          file_format: fileExtension,
          file_size_bytes: selectedFile.size
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
      file_format: data.file_format || '',
      file_size_bytes: data.file_size_bytes || 0
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

      const response = await fetch(`${apiUrl}/api/v1/${entityType}/${id}/share-url`, {
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
          <p className="text-red-600">Entity configuration not found for: {entityType}</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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

  // DRY: Consistent metadata value styling
  const metadataValueClass = "text-[13px] text-gray-800 leading-[1.4] whitespace-nowrap";
  const metadataValueStyle: React.CSSProperties = {
    fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
    letterSpacing: '-0.01em'
  };

  return (
    <Layout>
      <div className="w-[97%] max-w-[1536px] mx-auto">
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-20 bg-gray-50 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between py-2">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
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
                    className="text-gray-500"
                  />
                )}

                <MetadataSeparator show={!!(data.created_ts || data.updated_ts)} />

                {/* Created */}
                {data.created_ts && (
                  <>
                    <span className="text-gray-400 font-medium text-[10px] flex-shrink-0 tracking-wide uppercase">created:</span>
                    <span
                      className="text-gray-800 font-normal text-xs"
                      style={{
                        fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                        letterSpacing: '-0.01em',
                        fontWeight: '500'
                      }}
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
                    <span className="text-gray-400 font-medium text-[10px] flex-shrink-0 tracking-wide uppercase">updated:</span>
                    <span
                      className="text-gray-800 font-normal text-xs"
                      style={{
                        fontFamily: "Inter, 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                        letterSpacing: '-0.01em',
                        fontWeight: '500'
                      }}
                      title={formatFriendlyDate(data.updated_ts)}
                    >
                      {formatRelativeTime(data.updated_ts)}
                    </span>
                  </>
                )}

                <MetadataSeparator show={!!(entityType === 'artifact' && data.version && id)} />

                {/* Version badge (for artifacts) */}
                {entityType === 'artifact' && data.version && (
                  <MetadataField
                    label="version"
                    value={`v${data.version}`}
                    isEditing={false}
                    fieldKey="version"
                    canCopy={false}
                    badge={
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-200">
                        v{data.version}
                      </span>
                    }
                  />
                )}
              </MetadataRow>
            </div>
          </div>

          {/* Edit/Save/Cancel buttons */}
          <div className="flex items-center space-x-1.5">
            {!isEditing ? (
              <>
                {/* Special Design Email button for marketing entity */}
                {entityType === 'marketing' && (
                  <Button
                    variant="primary"
                    icon={Palette}
                    onClick={() => navigate(`/marketing/${id}/design`)}
                  >
                    Design Email
                  </Button>
                )}
                {/* Download button for artifact entity with object_key */}
                {entityType === 'artifact' && data?.object_key && (
                  <button
                    onClick={handleDownload}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                  </button>
                )}
                {/* Link button for managing entity relationships */}
                <button
                  onClick={() => linkageModal.openAssignParent({
                    childEntityType: entityType,
                    childEntityId: id!,
                    childEntityName: data?.name || data?.title
                  })}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Manage links"
                >
                  <LinkIcon className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>

                {/* Share button - available for all entities */}
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Share"
                >
                  <Share2 className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>

                {/* Edit button */}
                <button
                  onClick={() => {
                    // Special handling for form entity - navigate to edit page
                    if (entityType === 'form') {
                      navigate(`/form/${id}/edit`);
                    } else if (entityType === 'marketing') {
                      navigate(`/marketing/${id}/design`);
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>

                {/* Exit button */}
                <ExitButton entityType={entityType} isDetailPage={true} />
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Cancel"
                >
                  <X className="h-5 w-5 text-gray-600 stroke-[1.5]" />
                </button>
                <button
                  onClick={handleSave}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Save"
                >
                  <Save className="h-4 w-4 text-blue-600 stroke-[1.5]" />
                </button>

                {/* Exit button */}
                <ExitButton entityType={entityType} isDetailPage={true} />
              </>
            )}
          </div>
          </div>

          {/* Sticky Tabs Section */}
          {allTabs && allTabs.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm mt-2 overflow-hidden">
              <DynamicChildEntityTabs
                title={data?.name || data?.title || config.displayName}
                parentType={entityType}
                parentId={id!}
                parentName={data?.name || data?.title}
                tabs={allTabs}
                showBackButton={false}
              />
            </div>
          )}
        </div>

        {/* Content Area - Shows Overview or Child Entity Table */}
        <div className="mt-2">
        {isOverviewTab ? (
          // Overview Tab - Entity Details
          <>
            {/* Entity-specific content - METADATA COMES FIRST */}
            {entityType === 'wiki' ? (
            // Special Wiki Content Renderer
            <WikiContentRenderer
              data={data}
              onEdit={() => navigate(`/wiki/${id}/edit`)}
            />
          ) : entityType === 'marketing' ? (
            // Special Email Template Renderer
            <div className="space-y-4">
              <EmailTemplateRenderer template={data} />
            </div>
          ) : entityType === 'form' ? (
            // Special Interactive Form Renderer
            <div className="space-y-4 bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
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
                data={isEditing ? editedData : data}
                isEditing={isEditing}
                onChange={handleFieldChange}
                mode="edit"
              />

              {/* Task Data Container - Only show for task entity */}
              {entityType === 'task' && (
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
            {(entityType === 'artifact' || entityType === 'cost' || entityType === 'revenue') && data && (
              <FilePreview
                entityType={entityType as 'artifact' | 'cost' | 'revenue'}
                entityId={id!}
                data={data}
                isEditing={isEditing}
              />
            )}

            {/* File Upload for Artifacts, Cost, Revenue - Only in Edit Mode */}
            {(entityType === 'artifact' || entityType === 'cost' || entityType === 'revenue') && isEditing && (
              <DragDropFileUpload
                entityType={entityType as 'artifact' | 'cost' | 'revenue'}
                selectedFile={selectedFile}
                uploadedObjectKey={uploadedObjectKey}
                isUploading={isUploadingFile}
                onFileSelect={(file) => setSelectedFile(file)}
                onFileRemove={handleRemoveFile}
                onFileUpload={handleFileUpload}
                uploadError={uploadErrors.default}
                accept={entityType === 'cost' || entityType === 'revenue' ? '.pdf,.png,.jpg,.jpeg' : undefined}
              />
            )}
          </>
        ) : currentChildEntity === 'form-data' ? (
          // Form Data Tab - Show form submissions
          <FormDataTable formId={id!} formSchema={data.form_schema} refreshKey={formDataRefreshKey} />
        ) : currentChildEntity === 'edit-submission' ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
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
        entityType={entityType}
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
 * <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
 *   <Route path="task" element={<EntityChildListPage entityType="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage entityType="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage entityType="artifact" />} />
 * </Route>
 *
 * <Route path="/task/:id" element={<EntityDetailPage entityType="task" />} />
 * <Route path="/wiki/:id" element={<EntityDetailPage entityType="wiki" />} />
 * <Route path="/artifact/:id" element={<EntityDetailPage entityType="artifact" />} />
 */
