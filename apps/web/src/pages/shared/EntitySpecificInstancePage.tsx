import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Edit2, Save, X, Palette, Download, Share2, Link as LinkIcon, Undo2, Redo2, Edit, Trash2 } from 'lucide-react';
import { Layout, DynamicChildEntityTabs, useDynamicChildEntityTabs, EntityInstanceFormContainer, EntityListOfInstancesTable, FilePreview, DragDropFileUpload, EntityMetadataField, EntityMetadataRow, EntityMetadataSeparator } from '../../components/shared';
import { ExitButton } from '../../components/shared/button/ExitButton';
import { ShareModal } from '../../components/shared/modal';
import { UnifiedLinkageModal } from '../../components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '../../hooks/useLinkageModal';
import { WikiContentRenderer } from '../../components/entity/wiki';
import { TaskDataContainer } from '../../components/entity/task';
import { FormDataTable, InteractiveForm, FormSubmissionEditor } from '../../components/entity/form';
import { EmailTemplateRenderer } from '../../components/entity/marketing';
import { getEntityConfig } from '../../lib/entityConfig';
import { formatRelativeTime, formatFriendlyDate, transformForApi, transformFromApi } from '../../lib/frontEndFormatterService';
import { Button } from '../../components/shared/button/Button';
import { useS3Upload } from '../../lib/hooks/useS3Upload';
import { useSidebar } from '../../contexts/SidebarContext';
// v9.1.0: Use canonical hooks from @/db/tanstack-index (no wrapper layer)
// v9.5.0: Added useOptimisticMutation for instant UI feedback
// v9.6.0: Added useEntityInstanceMetadata for form metadata (content=metadata API)
import {
  useEntity,
  useEntityInstanceData,
  useEntityInstanceMetadata,
  useDraft,
  useOptimisticMutation,
  invalidateEntityQueries,
} from '../../db/tanstack-index';
import { formatRow, formatDataset, type ComponentMetadata } from '../../lib/formatters';
import { useKeyboardShortcuts, useShortcutHints } from '../../lib/hooks/useKeyboardShortcuts';
import { API_CONFIG } from '../../lib/config/api';
import { EllipsisBounce, InlineSpinner } from '../../components/shared/ui/EllipsisBounce';
import type { RowAction } from '../../components/shared/ui/EntityListOfInstancesTable';

/**
 * Universal EntitySpecificInstancePage
 *
 * A single, reusable component that renders the detail page for ANY entity.
 * Integrates with DynamicChildEntityTabs for child entity navigation.
 *
 * Usage via routing:
 * - /project/:id -> EntitySpecificInstancePage with entityCode="project"
 * - /task/:id -> EntitySpecificInstancePage with entityCode="task"
 * - /wiki/:id -> EntitySpecificInstancePage with entityCode="wiki"
 * etc.
 */

interface EntitySpecificInstancePageProps {
  entityCode: string;
}

export function EntitySpecificInstancePage({ entityCode }: EntitySpecificInstancePageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const config = getEntityConfig(entityCode);
  const { hideSidebar } = useSidebar();

  // ============================================================================
  // DEXIE DRAFT + REACT QUERY INTEGRATION (v9.0.0)
  // ============================================================================
  // Use React Query for data fetching with automatic caching (5 min TTL)
  // Use Dexie draft for field-level change tracking with undo/redo (persistent)
  // Keyboard shortcuts integrated for save/undo/redo
  // ============================================================================

  // ============================================================================
  // v9.1.0: CANONICAL HOOKS + FORMAT AT READ
  // ============================================================================
  // useEntity returns raw data; formatting happens in useMemo (format-at-read)
  // ============================================================================
  const {
    data: rawData,
    refData,
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useEntity(entityCode, id);

  // ============================================================================
  // v9.6.0: METADATA FETCHED SEPARATELY (content=metadata API)
  // ============================================================================
  // Backend returns data + ref_data in normal mode, metadata fetched separately
  // This enables 30-min metadata caching independent of data freshness
  const {
    viewType: formViewType,
    editType: formEditType,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');

  // Construct metadata object from separate viewType/editType
  // v11.1.0: Use flat { viewType, editType } format - same as EntityListOfInstancesTable
  // Both components now support flat format for consistency
  const formMetadata = useMemo(() => {
    if (!formViewType || Object.keys(formViewType).length === 0) return null;
    return { viewType: formViewType, editType: formEditType };
  }, [formViewType, formEditType]);

  // Format data on read (memoized) - formatting happens HERE, not in hook
  const formattedData = useMemo(() => {
    if (!rawData) return null;
    return formatRow(rawData, formMetadata, refData);
  }, [rawData, formMetadata, refData]);

  // Extract data for editing (raw) and display (formatted)
  const data = rawData || null;
  const error = queryError?.message || null;

  // ============================================================================
  // v9.5.0: OPTIMISTIC MUTATIONS - Instant UI feedback with automatic rollback
  // ============================================================================
  const { updateEntity: optimisticUpdateEntity } = useOptimisticMutation(entityCode, {
    onError: (error) => {
      setSaveError(error.message);
      alert(`Operation failed: ${error.message}`);
    },
  });

  // Cache invalidation helper
  const invalidateEntity = useCallback(async (code: string, entityId?: string) => {
    await invalidateEntityQueries(code, entityId);
  }, []);

  // Dexie draft for field-level tracking (v9.0.0)
  // Drafts persist across page refresh and browser restart
  const {
    hasDraft: isEditing,
    currentData: editedData,
    dirtyFields,
    hasChanges,
    startEdit: startDraft,
    updateField: updateDraftField,
    updateMultipleFields: updateDraftMultipleFields,
    discardDraft,
    getChanges,
    undo,
    redo,
    canUndo,
    canRedo,
    isLoading: isDraftLoading,
  } = useDraft(entityCode, id);

  // Local state for save operations (Dexie draft doesn't handle API calls)
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  // v9.5.0: Updated to use optimistic updates for instant UI feedback
  const handleCustomSave = useCallback(async () => {
    if (!hasChanges || !id) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const changes = getChanges();
      if (Object.keys(changes).length === 0) {
        await discardDraft();
        return;
      }

      // v9.5.0: Use optimistic update - UI updates immediately
      await optimisticUpdateEntity(id, changes);

      // Success - discard draft (cache already updated by optimistic mutation)
      await discardDraft();
    } catch (err: any) {
      // Error handling done by useOptimisticMutation onError callback
      setSaveError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, getChanges, discardDraft, id, optimisticUpdateEntity]);

  const handleCustomCancel = useCallback(async () => {
    await discardDraft();
  }, [discardDraft]);

  useKeyboardShortcuts({
    enableUndo: true,
    enableRedo: true,
    enableSave: true,
    enableEscape: true,
    onSave: handleCustomSave,
    onCancel: handleCustomCancel,
    onUndo: undo,
    onRedo: redo,
    isEditing,
    canUndo,
    canRedo,
    hasChanges,
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

  // ============================================================================
  // CHILD ENTITY DATA & STATE (Direct EntityListOfInstancesTable - no FilteredDataTable)
  // ============================================================================
  const childConfig = currentChildEntity ? getEntityConfig(currentChildEntity) : null;

  // ============================================================================
  // EXPLICIT ENABLEMENT: Query only runs when ALL conditions are met
  // ============================================================================
  // This follows the industry-standard pattern for conditional data fetching:
  // 1. We're on a child tab (not overview)
  // 2. We have a valid child entity code
  // 3. We have a valid parent entity ID
  // The hook also has internal fail-safe validation for empty entityCode.
  const shouldFetchChildData = Boolean(
    currentChildEntity &&
    id &&
    !isOverviewTab
  );

  // Fetch child entity data when on a child tab
  // NOTE: Use snake_case matching entity_instance_link DDL convention
  const childQueryParams = useMemo(() => ({
    limit: 100,
    offset: 0,
    parent_entity_code: entityCode,
    parent_entity_instance_id: id,
  }), [entityCode, id]);

  // v9.6.0: Use canonical useEntityInstanceData hook with EXPLICIT enabled flag
  // The hook returns a stable frozen empty state when disabled, preventing infinite loops
  const {
    data: childData,  // Use directly - no intermediate state needed
    refData: childRefData,
    total: childTotal,
    isLoading: childLoading,
    refetch: refetchChild,
  } = useEntityInstanceData(
    currentChildEntity || '',
    childQueryParams,
    { enabled: shouldFetchChildData }  // EXPLICIT: Query only runs when on child tab
  );

  // v9.7.0: Fetch child entity metadata separately (two-query architecture)
  // Metadata is entity-type level (same for all tasks), cached 30-min
  // This fixes the "empty columns" issue where metadata wasn't returned in data response
  const {
    viewType: childViewType,
    editType: childEditType,
    isLoading: childMetadataLoading,
  } = useEntityInstanceMetadata(
    currentChildEntity || '',
    'entityListOfInstancesTable'
  );

  // Construct child metadata in expected format for EntityListOfInstancesTable
  const childMetadata = useMemo(() => {
    if (!childViewType || Object.keys(childViewType).length === 0) return undefined;
    return { viewType: childViewType, editType: childEditType };
  }, [childViewType, childEditType]);

  // ============================================================================
  // CHILD ENTITY INLINE EDIT STATE
  // ============================================================================
  // Local state for inline editing operations ONLY (not for sync)
  // The problematic useEffect sync pattern was REMOVED - it caused infinite loops
  const [childEditingRow, setChildEditingRow] = useState<string | null>(null);
  const [childEditedData, setChildEditedData] = useState<any>({});
  const [childIsAddingRow, setChildIsAddingRow] = useState(false);
  // Local data for optimistic add row (temp rows before API save)
  const [childLocalAdditions, setChildLocalAdditions] = useState<any[]>([]);

  // Clear local additions when switching tabs or when child entity changes
  useEffect(() => {
    setChildLocalAdditions([]);
    setChildEditingRow(null);
    setChildEditedData({});
    setChildIsAddingRow(false);
  }, [currentChildEntity]);

  // Combine server data with local additions for display
  // Note: childData is stable (frozen empty array when disabled)
  const childRawData = useMemo(() => {
    if (childLocalAdditions.length === 0) return childData;
    return [...childData, ...childLocalAdditions];
  }, [childData, childLocalAdditions]);

  // v12.3.0: Format child data for display (same as EntityListOfInstancesPage)
  // This transforms raw API data into FormattedRow structure with display/styles
  // Required for badge rendering and other styled view modes
  const childDisplayData = useMemo(() => {
    if (!childRawData || childRawData.length === 0) return [];
    return formatDataset(childRawData, childMetadata as ComponentMetadata | undefined);
  }, [childRawData, childMetadata]);

  // Child pagination
  const childPagination = useMemo(() => ({
    current: 1,
    pageSize: 100,
    total: childTotal,
    showSizeChanger: false,
  }), [childTotal]);

  // Child inline edit handlers
  const handleChildInlineEdit = useCallback((_rowId: string, field: string, value: any) => {
    setChildEditedData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const handleChildSaveInlineEdit = useCallback(async (record: any) => {
    if (!childConfig || !currentChildEntity) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const isNewRow = childIsAddingRow || record.id?.toString().startsWith('temp_') || record._isNew;
      const transformedData = transformForApi(childEditedData, record);

      delete transformedData._isNew;
      if (isNewRow) delete transformedData.id;

      let response;
      if (isNewRow) {
        // Create child entity and link to parent
        response = await fetch(`${API_CONFIG.BASE_URL}${childConfig.apiEndpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(transformedData)
        });

        if (response.ok) {
          const result = await response.json();
          // Create linkage to parent
          await fetch(`${API_CONFIG.BASE_URL}/api/v1/linkage`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              parent_entity_type: entityCode,
              parent_entity_id: id,
              child_entity_type: currentChildEntity,
              child_entity_id: result.id,
              relationship_type: 'contains'
            })
          });
          await refetchChild();
          // Clear local additions after successful save - server data now includes the new row
          setChildLocalAdditions([]);
          setChildEditingRow(null);
          setChildEditedData({});
          setChildIsAddingRow(false);
        } else {
          alert(`Failed to create ${currentChildEntity}`);
        }
      } else {
        response = await fetch(`${API_CONFIG.BASE_URL}${childConfig.apiEndpoint}/${record.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(transformedData)
        });

        if (response.ok) {
          await refetchChild();
          setChildEditingRow(null);
          setChildEditedData({});
        } else {
          alert(`Failed to update ${currentChildEntity}`);
        }
      }
    } catch (error) {
      console.error('Error saving child record:', error);
      alert('An error occurred while saving.');
    }
  }, [childConfig, currentChildEntity, childEditedData, childIsAddingRow, entityCode, id, refetchChild]);

  const handleChildCancelInlineEdit = useCallback(() => {
    if (childIsAddingRow && childEditingRow) {
      // Remove the temp row from local additions
      setChildLocalAdditions(prev => prev.filter(row => row.id !== childEditingRow));
      setChildIsAddingRow(false);
    }
    setChildEditingRow(null);
    setChildEditedData({});
  }, [childIsAddingRow, childEditingRow]);

  const handleChildAddRow = useCallback((newRow: any) => {
    // Add temp row to local additions (will be cleared on successful save + refetch)
    setChildLocalAdditions(prev => [...prev, newRow]);
    setChildEditingRow(newRow.id);
    setChildEditedData(newRow);
    setChildIsAddingRow(true);
  }, []);

  const handleChildDelete = useCallback(async (record: any) => {
    if (!childConfig || !currentChildEntity) return;
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_CONFIG.BASE_URL}${childConfig.apiEndpoint}/${record.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        await refetchChild();
      } else {
        alert(`Failed to delete ${currentChildEntity}`);
      }
    } catch (error) {
      console.error('Error deleting child record:', error);
      alert('An error occurred while deleting.');
    }
  }, [childConfig, currentChildEntity, refetchChild]);

  const handleChildRowClick = useCallback((item: any) => {
    if (!currentChildEntity) return;
    // Handle FormattedRow objects (raw data is inside item.raw)
    const rawItem = item.raw || item;
    const id = rawItem.id;
    // Guard against undefined id to prevent /entity/undefined URLs
    if (!id) {
      console.warn(`[handleChildRowClick] Missing id in ${currentChildEntity} record:`, rawItem);
      return;
    }
    navigate(`/${currentChildEntity}/${id}`);
  }, [currentChildEntity, navigate]);

  // Child row actions
  const childRowActions: RowAction[] = useMemo(() => [
    {
      key: 'edit',
      label: 'Edit',
      icon: <Edit className="h-4 w-4" />,
      variant: 'default' as const,
      onClick: (record: any) => {
        setChildEditingRow(record.id);
        setChildEditedData(transformFromApi({ ...record }));
      }
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'danger' as const,
      onClick: handleChildDelete
    }
  ], [handleChildDelete]);

  // Prepare tabs with Overview as first tab - MUST be before any returns
  const allTabs = React.useMemo(() => {
    // Guard against undefined or invalid id to prevent /entity/undefined URLs
    if (!id || id === 'undefined') {
      return [];
    }

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
      // Start edit mode using Dexie draft (v9.0.0)
      startDraft(data);
      // Clear the state to prevent re-entering edit mode on subsequent navigations
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.state, data]); // data added to ensure we have data before starting edit

  // ============================================================================
  // DEXIE DRAFT SAVE HANDLER (v9.0.0)
  // ============================================================================
  // Uses Dexie draft for save with automatic cache invalidation
  // Special handling preserved for artifact versioning and task assignees
  // ============================================================================

  // ============================================================================
  // v9.5.0: OPTIMISTIC SAVE HANDLER - UI updates instantly, API syncs in background
  // ============================================================================
  const handleSave = async () => {
    if (!id) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Special handling for artifact with new file upload (create new version)
      // NOTE: Artifact versioning requires POST to create new record, not optimistic update
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
        await discardDraft();
        navigate(`/artifact/${result.newArtifact.id}`);
        return;
      }

      // Special handling for cost/revenue with new file upload (replace attachment)
      if ((entityCode === 'cost' || entityCode === 'revenue') && uploadedObjectKey) {
        const attachmentField = entityCode === 'cost' ? 'invoice_attachment' : 'sales_receipt_attachment';
        await updateDraftField(attachmentField, `s3://cohuron-attachments-prod-957207443425/${uploadedObjectKey}`);
        setSelectedFile(null);
        setUploadedObjectKey(null);
      }

      // Get changed fields from Dexie draft
      const changes = getChanges();

      if (Object.keys(changes).length === 0) {
        // No changes to save
        await discardDraft();
        return;
      }

      // v9.5.0: Use optimistic update - UI updates immediately, API syncs in background
      await optimisticUpdateEntity(id, changes);

      // Handle task assignees separately (special case - linkage API)
      if (entityCode === 'task' && editedData?.assignee_employee_ids !== undefined) {
        const assigneeIds = editedData.assignee_employee_ids;
        await updateTaskAssignees(id, assigneeIds);
      }

      // Success - discard draft (cache already updated by optimistic mutation)
      await discardDraft();
    } catch (err) {
      // Error handling done by useOptimisticMutation onError callback
      const errorMessage = err instanceof Error ? err.message : 'Failed to update';
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
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
  // DEXIE DRAFT INTEGRATION FOR EDITING (v9.0.0)
  // ============================================================================
  // handleCancel and handleFieldChange now use Dexie draft
  // This enables field-level change tracking, undo/redo, and persistent drafts
  // ============================================================================

  const handleCancel = useCallback(async () => {
    await discardDraft();
  }, [discardDraft]);

  // ============================================================================
  // DEBOUNCING STRATEGY FOR FIELD UPDATES
  // ============================================================================
  // Pattern: docs/design_pattern/update_edit_statemanagement.md (Debouncing Strategy section)
  //
  // BLACKLIST approach (not whitelist) - only these primitive text-entry fields are debounced:
  // - text, textarea, number, currency: User is typing multiple characters
  //
  // ALL OTHER inputTypes update immediately:
  // - Component inputTypes (PascalCase like EntityInstanceNameSelect, BadgeDropdownSelect)
  // - Selection inputs (select, checkbox, date, toggle)
  //
  // This is future-proof: any new component inputType will default to immediate updates.
  // ============================================================================
  const updateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCED_INPUT_TYPES = ['text', 'textarea', 'number', 'currency'];

  const handleFieldChange = useCallback((fieldName: string, value: any, inputType?: string) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    const isDebounced = inputType && DEBOUNCED_INPUT_TYPES.includes(inputType);

    if (isDebounced) {
      updateTimeoutRef.current = setTimeout(() => {
        updateDraftField(fieldName, value);
      }, 1000);
    } else {
      updateDraftField(fieldName, value);
    }
  }, [updateDraftField]);

  // ============================================================================
  // v12.3.0: INLINE SAVE HANDLER - Optimistic update for single field edits
  // ============================================================================
  // Called when user completes inline edit (click outside, Enter key)
  // Triggers optimistic update: TanStack + Dexie updated immediately, API in background
  // ============================================================================
  const handleInlineSave = useCallback(async (fieldKey: string, value: any) => {
    if (!id) return;

    try {
      // Optimistic update: UI updates instantly, API syncs in background
      await optimisticUpdateEntity(id, { [fieldKey]: value });
    } catch (err) {
      // Error is handled by useOptimisticMutation's onError callback
      console.error('Inline save failed:', err);
    }
  }, [id, optimisticUpdateEntity]);

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
        // Use Dexie draft for field updates (v9.0.0)
        await updateDraftMultipleFields({
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

  const handleRemoveFile = async () => {
    setSelectedFile(null);
    setUploadedObjectKey(null);
    // Restore original file metadata from current version using Dexie draft (v9.0.0)
    await updateDraftMultipleFields({
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

      // Update Dexie draft with new share URL (v9.0.0)
      await updateDraftField('shared_url', shareUrl);

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

  // Guard against undefined or invalid id in URL
  if (!id || id === 'undefined') {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Invalid or missing {entityCode} ID</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <EllipsisBounce size="lg" text="Processing" />
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
        {/* Sticky Header Section - Full width, compensates for Layout's p-4 padding */}
        {/* top-[-1rem] matches -mt-4 to prevent content showing above sticky header when scrolling */}
        <div className="sticky top-[-1rem] z-20 bg-gray-100 shadow-sm border-b border-gray-200 -mx-4 -mt-4 px-4 pb-2 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-6 after:h-6 after:bg-gradient-to-b after:from-white after:to-transparent after:pointer-events-none">
          <div className="w-[97%] max-w-[1536px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* Exit button on left */}
            <ExitButton entityCode={entityCode} isDetailPage={true} />

            <div className="flex-1 min-w-0 px-2">
              {/* Compact metadata row using DRY components */}
              <EntityMetadataRow className="overflow-x-auto">
                {/* Name - v12.3.0: Supports inline editing via long-press */}
                <EntityMetadataField
                  label={`${config.displayName} name`}
                  value={isEditing ? (editedData.name || editedData.title || '') : (data.name || data.title || `${config.displayName} Details`)}
                  isEditing={isEditing}
                  fieldKey="name"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                  onChange={handleFieldChange}
                  placeholder="Enter name..."
                  inputWidth="16rem"
                  // v12.3.0: Inline editing support
                  inlineEditable={!isEditing}
                  onInlineSave={handleInlineSave}
                  editable={formEditType?.name?.editable !== false}
                />

                <EntityMetadataSeparator show={!!(data.code || id)} />

                {/* Code - v12.3.0: Supports inline editing via long-press */}
                {(data.code || isEditing) && (
                  <EntityMetadataField
                    label="code"
                    value={isEditing ? (editedData.code || '') : data.code}
                    isEditing={isEditing}
                    fieldKey="code"
                    copiedField={copiedField}
                    onCopy={handleCopy}
                    onChange={handleFieldChange}
                    placeholder="CODE"
                    inputWidth="8rem"
                    // v12.3.0: Inline editing support
                    inlineEditable={!isEditing}
                    onInlineSave={handleInlineSave}
                    editable={formEditType?.code?.editable !== false}
                  />
                )}

                <EntityMetadataSeparator show={!!(data.code && id)} />

                {/* ID - always readonly (system field) */}
                {id && (
                  <EntityMetadataField
                    label="id"
                    value={id}
                    isEditing={false}
                    fieldKey="id"
                    copiedField={copiedField}
                    onCopy={handleCopy}
                    className="text-dark-700"
                    editable={false}
                  />
                )}

                {/* Created - metadata-aware: respects formViewType?.created_ts?.visible */}
                {data.created_ts && formViewType?.created_ts?.visible !== false && (
                  <>
                    <EntityMetadataSeparator show={true} />
                    <span className="text-gray-400 font-normal text-xs flex-shrink-0">created:</span>
                    <span
                      className="text-gray-600 font-normal text-sm"
                      title={formatFriendlyDate(data.created_ts)}
                    >
                      {formatRelativeTime(data.created_ts)}
                    </span>
                  </>
                )}

                {/* Updated - metadata-aware: respects formViewType?.updated_ts?.visible */}
                {data.updated_ts && formViewType?.updated_ts?.visible !== false && (
                  <>
                    <EntityMetadataSeparator show={true} />
                    <span className="text-gray-400 font-normal text-xs flex-shrink-0">updated:</span>
                    <span
                      className="text-gray-600 font-normal text-sm"
                      title={formatFriendlyDate(data.updated_ts)}
                    >
                      {formatRelativeTime(data.updated_ts)}
                    </span>
                  </>
                )}

                <EntityMetadataSeparator show={!!(entityCode === 'artifact' && data.version && id)} />

                {/* Version badge (for artifacts) */}
                {entityCode === 'artifact' && data.version && (
                  <EntityMetadataField
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
              </EntityMetadataRow>
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
                      // Start edit mode using Dexie draft (v9.0.0)
                      startDraft(data);
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
                  disabled={!canUndo}
                  className={`p-2 rounded-md transition-colors ${
                    canUndo
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
                  disabled={!canRedo}
                  className={`p-2 rounded-md transition-colors ${
                    canRedo
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
                  disabled={isSaving || !hasChanges}
                  className={`p-2 rounded-md transition-colors ${
                    hasChanges
                      ? 'bg-gray-900 hover:bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title={`Save (${shortcuts.save})`}
                >
                  {isSaving ? (
                    <InlineSpinner className="text-white" />
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
            <DynamicChildEntityTabs
              title={data?.name || data?.title || config.displayName}
              parentType={entityCode}
              parentId={id!}
              parentName={data?.name || data?.title}
              tabs={allTabs}
              showBackButton={false}
              className="mt-3"
            />
          )}
          </div>
        </div>

        {/* Content Area - Shows Overview or Child Entity Table */}
        <div className="w-[97%] max-w-[1536px] mx-auto mt-6">
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
              {/* Metadata Block - EntityInstanceFormContainer */}
              <EntityInstanceFormContainer
                config={config}
                metadata={formMetadata}  // v11.1.0: Flat { viewType, editType } - same as EntityListOfInstancesTable
                data={isEditing ? editedData : data}
                formattedData={isEditing ? undefined : formattedData}  // v7.0.0: Pre-formatted for view mode
                isEditing={isEditing}
                onChange={handleFieldChange}
                mode="edit"
                // v12.3.0: Inline editing support (slow click-and-hold like EntityListOfInstancesTable)
                inlineEditable={!isEditing}  // Enable when NOT in full edit mode
                onInlineSave={handleInlineSave}
                entityId={id}
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
          // Child Entity Tab - Direct EntityListOfInstancesTable (no FilteredDataTable/Outlet)
          // v9.7.0: Check both data loading AND metadata loading (two-query architecture)
          (childLoading || childMetadataLoading) ? (
            <div className="flex items-center justify-center h-64">
              <EllipsisBounce size="lg" text="Processing" />
            </div>
          ) : (
            <EntityListOfInstancesTable
              data={childDisplayData}
              metadata={childMetadata}
              ref_data_entityInstance={childRefData}
              loading={childLoading || childMetadataLoading}
              pagination={childPagination}
              onRowClick={handleChildRowClick}
              searchable={true}
              filterable={true}
              columnSelection={true}
              rowActions={childRowActions}
              selectable={true}
              inlineEditable={true}
              editingRow={childEditingRow}
              editedData={childEditedData}
              onInlineEdit={handleChildInlineEdit}
              onSaveInlineEdit={handleChildSaveInlineEdit}
              onCancelInlineEdit={handleChildCancelInlineEdit}
              allowAddRow={true}
              onAddRow={handleChildAddRow}
            />
          )
        )}
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
 * <Route path="/project/:id" element={<EntitySpecificInstancePage entityCode="project" />}>
 *   <Route path="task" element={<EntityChildListPage entityCode="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage entityCode="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage entityCode="artifact" />} />
 * </Route>
 *
 * <Route path="/task/:id" element={<EntitySpecificInstancePage entityCode="task" />} />
 * <Route path="/wiki/:id" element={<EntitySpecificInstancePage entityCode="wiki" />} />
 * <Route path="/artifact/:id" element={<EntitySpecificInstancePage entityCode="artifact" />} />
 */
