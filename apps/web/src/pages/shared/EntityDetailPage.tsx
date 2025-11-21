import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import { Edit2, Save, X, Palette, Download, Upload, CheckCircle, Copy, Check, Share2, Link as LinkIcon, Undo2, Redo2 } from 'lucide-react';
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
import { useEntityInstance, useEntityMutation, useCacheInvalidation } from '../../lib/hooks';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import { useKeyboardShortcuts, useShortcutHints } from '../../lib/hooks/useKeyboardShortcuts';

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

  // ============================================================================
  // ZUSTAND + REACT QUERY INTEGRATION
  // ============================================================================
  // Use React Query for data fetching with automatic caching (5 min TTL)
  // Use Zustand edit store for field-level change tracking with undo/redo
  // Keyboard shortcuts integrated for save/undo/redo
  // ============================================================================

  const {
    data: queryResult,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useEntityInstance(entityCode, id);

  // Extract data from React Query result
  const data = queryResult?.data || null;
  const backendMetadata = queryResult?.metadata || null;
  const datalabels = queryResult?.datalabels || [];
  const error = queryError?.message || null;

  // Entity mutation for updates
  const { updateEntity, isUpdating } = useEntityMutation(entityCode);
  const { invalidateEntity } = useCacheInvalidation();

  // Zustand edit store for field-level tracking
  const editStore = useEntityEditStore();
  const {
    isEditing,
    currentData: editedData,
    isSaving,
    saveError,
    dirtyFields,
    startEdit,
    updateField,
    updateMultipleFields,
    saveChanges: storesSaveChanges,
    cancelEdit,
    hasChanges,
    undo,
    redo,
    canUndo,
    canRedo,
  } = editStore;

  // Local UI state
  const [formDataRefreshKey, setFormDataRefreshKey] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingShareUrl, setIsGeneratingShareUrl] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Keyboard shortcut hints
  const { shortcuts } = useShortcutHints();

  // Hide sidebar when entering entity detail page
  useEffect(() => {
    hideSidebar();
  }, []);

  // Unified linkage modal
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch entity data and child tabs when linkage changes
      refetch();
      invalidateEntity(entityCode, id);
    }
  });

  // ============================================================================
  // KEYBOARD SHORTCUTS (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Escape)
  // ============================================================================
  const handleCustomSave = useCallback(async () => {
    if (!hasChanges()) return;
    const success = await storesSaveChanges();
    if (success) {
      // Invalidate cache to refetch fresh data
      invalidateEntity(entityCode, id);
      refetch();
    }
  }, [hasChanges, storesSaveChanges, invalidateEntity, entityCode, id, refetch]);

  const handleCustomCancel = useCallback(() => {
    cancelEdit();
  }, [cancelEdit]);

  useKeyboardShortcuts({
    enableUndo: true,
    enableRedo: true,
    enableSave: true,
    enableEscape: true,
    onSave: handleCustomSave,
    onCancel: handleCustomCancel,
    activeWhenEditing: true,
  });

  // Legacy loadData function - now just refetches via React Query
  const loadData = useCallback(async () => {
    refetch();
  }, [refetch]);

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

  // NOTE: Data fetching is now handled by useEntityInstance hook via React Query
  // The loadData function above is just a wrapper around refetch() for legacy compatibility

  // Auto-edit mode when navigating from child entity creation
  useEffect(() => {
    const locationState = location.state as any;
    if (locationState?.autoEdit && data && !loading && !isEditing) {
      // Start edit mode using Zustand store
      startEdit(entityCode, id!, data);
      // Clear the state to prevent re-entering edit mode on subsequent navigations
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.state, data]); // data added to ensure we have data before starting edit

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

  // ============================================================================
  // ZUSTAND STORE SAVE HANDLER
  // ============================================================================
  // Uses Zustand edit store for save with automatic cache invalidation
  // Special handling preserved for artifact versioning and task assignees
  // ============================================================================

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
            attachment_object_key: uploadedObjectKey,
            descr: editedData?.descr || data?.descr,
            visibility: editedData?.visibility,
            security_classification: editedData?.security_classification,
            artifact_type: editedData?.artifact_type
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
        updateField(attachmentField, `s3://cohuron-attachments-prod-957207443425/${uploadedObjectKey}`);
        setSelectedFile(null);
        setUploadedObjectKey(null);
      }

      // Use Zustand store to save changes
      // The store handles: field-level change tracking, PATCH optimization
      const success = await storesSaveChanges();

      if (success) {
        // Handle task assignees separately (special case)
        if (entityCode === 'task' && editedData?.assignee_employee_ids !== undefined) {
          const assigneeIds = editedData.assignee_employee_ids;
          await updateTaskAssignees(id!, assigneeIds);
        }

        // Invalidate cache and refetch to ensure fresh data
        invalidateEntity(entityCode, id);
        refetch();
      }
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

  // ============================================================================
  // ZUSTAND STORE INTEGRATION FOR EDITING
  // ============================================================================
  // handleCancel and handleFieldChange now use the Zustand edit store
  // This enables field-level change tracking, undo/redo, and optimistic updates
  // ============================================================================

  const handleCancel = useCallback(() => {
    cancelEdit();
  }, [cancelEdit]);

  // Use refs for debouncing field updates (Zustand store handles state)
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    // Clear any pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // For immediate-feedback fields (select, checkbox), update immediately
    const immediateFields = ['select', 'checkbox', 'boolean', 'date'];
    // Most fields benefit from debouncing to reduce re-renders during typing

    // Debounce text field updates
    updateTimeoutRef.current = setTimeout(() => {
      updateField(fieldName, value);
    }, 150); // 150ms debounce for typing
  }, [updateField]);

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
        // Use Zustand store for field updates
        updateMultipleFields({
          attachment_format: fileExtension,
          attachment_size_bytes: selectedFile.size
        });
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
    // Restore original file metadata from current version using Zustand store
    updateMultipleFields({
      attachment_format: data?.attachment_format || '',
      attachment_size_bytes: data?.attachment_size_bytes || 0
    });
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

      // Update Zustand store with new share URL
      updateField('shared_url', shareUrl);

      // Invalidate cache to ensure fresh data on next load
      invalidateEntity(entityCode, id);

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
                      // Start edit mode using Zustand store
                      startEdit(entityCode, id!, data);
                    }
                  }}
                  className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                  title={`Edit (${shortcuts.save} to save)`}
                >
                  <Edit2 className="h-4 w-4 text-gray-600 stroke-[1.5]" />
                </button>
              </>
            ) : (
              <>
                {/* Undo button */}
                <button
                  onClick={undo}
                  disabled={!canUndo()}
                  className={`p-2 rounded-md transition-colors ${
                    canUndo()
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={`Undo (${shortcuts.undo})`}
                >
                  <Undo2 className="h-4 w-4 stroke-[1.5]" />
                </button>

                {/* Redo button */}
                <button
                  onClick={redo}
                  disabled={!canRedo()}
                  className={`p-2 rounded-md transition-colors ${
                    canRedo()
                      ? 'text-gray-600 hover:bg-gray-50'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title={`Redo (${shortcuts.redo})`}
                >
                  <Redo2 className="h-4 w-4 stroke-[1.5]" />
                </button>

                <div className="w-px h-4 bg-gray-200 mx-1" />

                {/* Cancel button */}
                <button
                  onClick={handleCancel}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title={`Cancel (${shortcuts.cancel})`}
                >
                  <X className="h-4 w-4 stroke-[1.5]" />
                </button>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges()}
                  className={`p-2 rounded-md transition-colors ${
                    hasChanges()
                      ? 'bg-gray-900 hover:bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title={`Save (${shortcuts.save})`}
                >
                  {isSaving ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Save className="h-4 w-4 stroke-[1.5]" />
                  )}
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
