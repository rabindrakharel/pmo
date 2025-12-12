import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Layout, ViewSwitcher, EntityListOfInstancesTable } from '../../components/shared';
import { EllipsisBounce } from '../../components/shared/ui/EllipsisBounce';
import { KanbanView } from '../../components/shared/ui/KanbanView';
import { GridView } from '../../components/shared/ui/GridView';
import { CalendarView } from '../../components/shared/ui/CalendarView';
import { DAGVisualizer } from '../../components/workflow/DAGVisualizer';
import { HierarchyGraphView } from '../../components/hierarchy/HierarchyGraphView';
import { DeleteOrUnlinkModal } from '../../components/shared/modal/DeleteOrUnlinkModal';
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig, type ViewMode } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { transformForApi, transformFromApi } from '../../lib/frontEndFormatterService';
import { useSidebar } from '../../contexts/SidebarContext';
import { useEntityInstanceData, useEntityInstanceMetadata, useOptimisticMutation, QUERY_KEYS } from '@/db/tanstack-index';
import { type ComponentMetadata } from '../../lib/formatters';
import { useFormattedEntityData } from '../../lib/hooks';
import type { RowAction } from '../../components/shared/ui/EntityListOfInstancesTable';

// ============================================================================
// DEBUG LOGGING - Cache & Data Flow Diagnostics
// ============================================================================
// Set to true to enable detailed cache debugging
const DEBUG_CACHE = false;  // v11.3.1: Toggle for inline add row debugging

const debugCache = (message: string, data?: Record<string, unknown>) => {
  if (DEBUG_CACHE) {
    console.log(`%c[CACHE] ${message}`, 'color: #f59e0b; font-weight: bold', data || '');
  }
};

/**
 * Universal EntityListOfInstancesPage
 *
 * A single, reusable component that renders the main listing page for ANY entity.
 * Supports table, kanban, and grid views based on entity configuration.
 *
 * Usage via routing:
 * - /project -> EntityListOfInstancesPage with entityCode="project"
 * - /task -> EntityListOfInstancesPage with entityCode="task"
 * - /wiki -> EntityListOfInstancesPage with entityCode="wiki"
 * etc.
 */

interface EntityListOfInstancesPageProps {
  entityCode: string;
  defaultView?: ViewMode;
}

export function EntityListOfInstancesPage({ entityCode, defaultView }: EntityListOfInstancesPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Track previous rawData reference for cache debugging
  const prevRawDataRef = useRef<unknown[] | null>(null);
  const config = getEntityConfig(entityCode);
  const [view, setView] = useViewMode(entityCode, defaultView);
  const [currentPage, setCurrentPage] = useState(1);
  const [appendedData, setAppendedData] = useState<any[]>([]); // For pagination append
  const { collapseSidebar } = useSidebar();

  // Check if this is a settings entity
  const isSettingsEntity = useMemo(() => {
    return config?.apiEndpoint?.includes('/api/v1/datalabel?name=') || false;
  }, [config]);

  // Collapse sidebar when entering entity main page
  useEffect(() => {
    collapseSidebar();
  }, []);

  // Reset appended data when view or entity changes
  useEffect(() => {
    setAppendedData([]);
    setCurrentPage(1);
  }, [view, entityCode]);

  // ============================================================================
  // v9.4.0: TWO-QUERY ARCHITECTURE - Metadata first, then Data
  // ============================================================================
  // 1. useEntityInstanceMetadata - fetches metadata (30-min cache) → renders columns
  // 2. useEntityInstanceData - fetches data (5-min cache) → populates rows
  // Render sequence: metadata loading → columns render → data loading → rows render
  // ============================================================================

  // Map view mode to component name for backend metadata filtering
  const viewComponentMap: Record<string, string> = {
    table: 'entityListOfInstancesTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };
  const mappedView = view ? viewComponentMap[view] || view : 'entityListOfInstancesTable';

  // ============================================================================
  // QUERY 1: METADATA (30-min cache) - renders table columns first
  // ============================================================================
  const {
    viewType,
    editType,
    fields: metadataFields,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata(entityCode, mappedView);

  // Combine viewType and editType into metadata structure for EntityListOfInstancesTable
  // v13.1.1: Include fields array to ensure correct column ordering
  const metadata = useMemo((): ComponentMetadata | null => {
    if (!viewType || Object.keys(viewType).length === 0) return null;
    return { fields: metadataFields, viewType, editType } as ComponentMetadata;
  }, [metadataFields, viewType, editType]);

  // ============================================================================
  // QUERY 2: DATA (5-min cache) - populates rows after metadata ready
  // v9.4.1: API fetches 1000 records, client paginates 500 at a time
  // ============================================================================
  // API pagination: fetch 1000 records per API page
  const API_FETCH_LIMIT = 1000;
  // Client pagination: render 500 at a time within the fetched data
  const CLIENT_RENDER_LIMIT = 500;

  // Calculate which API page we need based on client page
  const apiPage = Math.ceil((currentPage * CLIENT_RENDER_LIMIT) / API_FETCH_LIMIT);
  const queryParams = useMemo(() => ({
    limit: API_FETCH_LIMIT,
    offset: (apiPage - 1) * API_FETCH_LIMIT,
  }), [apiPage]);

  // v11.0.0: refData removed - using TanStack Query cache via getEntityInstanceNameSync()
  const {
    data: rawData,
    total: totalRecords,
    isLoading: dataLoading,
    isFetching,  // v13.1.0: Track background fetching for loading indicators
    isError,
    error: queryError,
    refetch,
  } = useEntityInstanceData(entityCode, queryParams, {
    enabled: !!config,
  });

  // ============================================================================
  // CACHE DEBUG: Detect when rawData reference changes (indicates fresh fetch)
  // ============================================================================
  useEffect(() => {
    if (rawData && rawData !== prevRawDataRef.current) {
      const isNewReference = prevRawDataRef.current !== null;
      debugCache(isNewReference ? 'Data reference changed (refetch occurred)' : 'Initial data load', {
        entityCode,
        rowCount: rawData.length,
        firstRowId: rawData[0]?.id,
        firstRowUpdatedTs: rawData[0]?.updated_ts,
      });
      prevRawDataRef.current = rawData;
    }
  }, [rawData, entityCode]);

  // Combined loading state: show skeleton until metadata is ready
  const loading = metadataLoading;

  // ============================================================================
  // v12.6.0: REACTIVE FORMATTING - Datalabel cache subscription pattern
  // ============================================================================
  // Uses useFormattedEntityData hook with cache subscription to fix badge color bug
  // Automatically re-formats when datalabel cache updates (fixes gray badges)
  // Pattern: TanStack Query Dependent Queries with enabled: false
  // ============================================================================
  const { data: formattedData } = useFormattedEntityData(rawData, metadata, entityCode);

  // ============================================================================
  // v11.3.0: INLINE EDIT STATE MANAGEMENT - TanStack Query Single Source of Truth
  // ============================================================================
  // Pattern: Cache is the ONLY data source. No localData copying.
  // - handleAddRow: adds temp row directly to cache via queryClient.setQueryData
  // - handleCancelInlineEdit: removes temp row from cache
  // - handleSaveInlineEdit: passes existingTempId to createEntity (no duplicate)
  // ============================================================================
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<any>({});
  const [isAddingRow, setIsAddingRow] = useState(false);

  // v9.5.1: Delete confirmation modal state (replaces window.confirm)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalRecord, setDeleteModalRecord] = useState<any>(null);

  // Combine raw data with any appended data from pagination
  // v11.3.0: No more localData - cache is single source of truth
  const data = useMemo(() => {
    if (currentPage > 1 && appendedData.length > 0) {
      return [...appendedData, ...(rawData || [])];
    }
    return rawData || [];
  }, [rawData, appendedData, currentPage]);

  // Clear edit state when entity changes
  useEffect(() => {
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }, [entityCode]);

  const hasMore = (rawData?.length || 0) === API_FETCH_LIMIT;
  const error = queryError?.message || null;

  // ============================================================================
  // v9.4.1: Client-side pagination - table renders 500 at a time from 1000 fetched
  // Search/filter works against all 1000 records, pagination slices for display
  // ============================================================================
  const [clientPageSize, setClientPageSize] = useState(CLIENT_RENDER_LIMIT);

  // Pagination config for EntityListOfInstancesTable
  // Table internally slices data based on current page and pageSize
  const pagination = useMemo(() => ({
    current: currentPage,
    pageSize: clientPageSize,
    total: totalRecords,
    showSizeChanger: true,
    pageSizeOptions: [50, 100, 200, 500],
    onChange: (page: number, newPageSize: number) => {
      setCurrentPage(page);
      if (newPageSize !== clientPageSize) {
        setClientPageSize(newPageSize);
        setCurrentPage(1);  // Reset to page 1 when changing page size
      }
    }
  }), [currentPage, totalRecords, clientPageSize]);

  // ============================================================================
  // v9.5.0: OPTIMISTIC MUTATIONS - Instant UI feedback with automatic rollback
  // ============================================================================
  // Pattern: Update TanStack + Dexie immediately → Background API call
  // On success: cache already correct
  // On error: automatic rollback to previous state
  // ============================================================================
  const {
    updateEntity,
    createEntity,
    deleteEntity,
  } = useOptimisticMutation(entityCode, {
    listQueryParams: queryParams,
    // v11.4.2: Disabled refetchOnSuccess for better performance
    // The optimistic update already has the correct data from API response.
    // Refetch was causing unnecessary re-renders and lag after cell edits.
    // Entity names are updated via setEntityInstance() in the mutation's onSuccess.
    refetchOnSuccess: false,
    onSuccess: () => {
      debugCache('Optimistic mutation: Success', { entityCode });
    },
    onError: (error) => {
      debugCache('Optimistic mutation: FAILED - rollback triggered', { entityCode, error: error.message });
      alert(`Operation failed: ${error.message}`);
    },
  });

  // Legacy loadData function for compatibility (now just triggers refetch)
  const loadData = useCallback(async (page: number = 1, append: boolean = false) => {
    if (append && page > 1) {
      // Store current data for appending
      setAppendedData(data);
      setCurrentPage(page);
    } else {
      setCurrentPage(page);
      setAppendedData([]);
    }
    // React Query will automatically refetch due to queryParams change
  }, [data]);

  const handleRowClick = useCallback((item: any) => {
    if (!config) return;

    const rawItem = item.raw || item;
    const idField = config.detailPageIdField || 'id';
    const id = rawItem[idField];

    // v11.3.0: Block navigation for temp rows (they don't exist on server yet)
    if (id?.toString().startsWith('temp_')) return;

    // v11.4.1: If there's an empty temp row being edited and user clicks a different row,
    // remove the empty temp row from cache before navigating
    if (isAddingRow && editingRow?.toString().startsWith('temp_')) {
      // Check if editedData has any meaningful content
      const hasContent = Object.entries(editedData).some(([key, value]) => {
        if (key === 'id' || key === '_isNew' || key === '_isOptimistic') return false;
        return value !== null && value !== undefined && value !== '';
      });

      if (!hasContent) {
        // Remove empty temp row from cache
        const queryCache = queryClient.getQueryCache();
        const matchingQueries = queryCache.findAll({
          queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
        });

        for (const query of matchingQueries) {
          queryClient.setQueryData(query.queryKey, (oldData: any) => {
            if (!oldData?.data) return oldData;
            return {
              ...oldData,
              data: oldData.data.filter((row: any) => row.id !== editingRow),
              total: Math.max(0, (oldData.total || 1) - 1),
            };
          });
        }
      }

      // Clear editing state
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    }

    navigate(`/${entityCode}/${id}`);
  }, [config, entityCode, navigate, isAddingRow, editingRow, editedData, queryClient]);

  const handleCreateClick = useCallback(() => {
    navigate(`/${entityCode}/new`);
  }, [entityCode, navigate]);

  const handleLoadMore = useCallback(() => {
    loadData(currentPage + 1, true);
  }, [currentPage, loadData]);

  // ============================================================================
  // v9.5.0: OPTIMISTIC KANBAN CARD MOVE
  // ============================================================================
  // Card moves update cache immediately, API syncs in background
  // On error: automatic rollback to previous column
  // ============================================================================

  const handleCardMove = useCallback(async (itemId: string, fromColumn: string, toColumn: string) => {
    if (!config?.kanban) return;

    debugCache('Optimistic card move: Starting', { entityCode, itemId, fromColumn, toColumn });

    try {
      await updateEntity(itemId, { [config.kanban.groupByField]: toColumn });
      debugCache('Optimistic card move: Completed', { entityCode, itemId });
    } catch (err) {
      // Error handling and rollback handled by useOptimisticMutation onError callback
      debugCache('Optimistic card move: Failed', { entityCode, itemId, error: String(err) });
    }
  }, [config, entityCode, updateEntity]);

  // ============================================================================
  // INLINE EDIT HANDLERS (Migrated from FilteredDataTable)
  // ============================================================================

  const handleInlineEdit = useCallback((_rowId: string, field: string, value: any) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // ============================================================================
  // v12.5.0: CELL-LEVEL SAVE (Pattern-Compliant)
  // ============================================================================
  // Uses onCellSave callback instead of _changedField markers.
  // Value is passed directly, avoiding React async state batching issues.
  // ============================================================================
  const handleCellSave = useCallback(async (rowId: string, columnKey: string, value: any, record: any) => {
    if (!config) return;

    // Handle both FormattedRow and raw data
    const rawRecord = record.raw || record;
    const isNewRow = isAddingRow || rowId?.toString().startsWith('temp_') || rawRecord._isNew;

    // v11.4.0: Guard - Don't save temp rows with empty/null values
    // This prevents 400 errors when user clicks into a temp row but doesn't enter data
    if (isNewRow && (value === null || value === undefined || value === '')) {
      return;
    }

    // Build change data directly from parameters (no stale state issues)
    const changeData = { [columnKey]: value };
    const transformedData = transformForApi(changeData, rawRecord);

    // Remove temporary fields
    delete transformedData._isNew;
    delete transformedData._isOptimistic;
    if (isNewRow) {
      delete transformedData.id;
    }

    try {
      if (isNewRow) {
        await createEntity(transformedData, { existingTempId: rowId });
      } else {
        await updateEntity(rowId, transformedData);
      }

      // Clear edit state after successful mutation
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    } catch (error) {
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    }
  }, [config, isAddingRow, createEntity, updateEntity]);

  // Row-level save (for explicit Save button clicks, not cell-level auto-save)
  const handleSaveInlineEdit = useCallback(async (record: any) => {
    if (!config) return;

    // Handle both FormattedRow and raw data
    const rawRecord = record.raw || record;
    const recordId = rawRecord.id;

    const isNewRow = isAddingRow || recordId?.toString().startsWith('temp_') || rawRecord._isNew;

    const transformedData = transformForApi(editedData, rawRecord);

    // Remove temporary fields
    delete transformedData._isNew;
    delete transformedData._isOptimistic;
    if (isNewRow) {
      delete transformedData.id;
    }

    try {
      if (isNewRow) {
        await createEntity(transformedData, { existingTempId: recordId });
      } else {
        await updateEntity(recordId, transformedData);
      }

      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    } catch (error) {
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    }
  }, [config, editedData, isAddingRow, createEntity, updateEntity]);

  const handleCancelInlineEdit = useCallback(() => {
    if (isAddingRow && editingRow) {
      // v11.3.0: Remove temp row from cache (single source of truth)
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      for (const query of matchingQueries) {
        queryClient.setQueryData(query.queryKey, (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.filter((item: any) => item.id !== editingRow),
            total: Math.max(0, (oldData.total || 1) - 1),
          };
        });
      }
    }

    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }, [isAddingRow, editingRow, queryClient, entityCode]);

  const handleAddRow = useCallback((newRow: any) => {
    // v11.3.0: Add temp row DIRECTLY to TanStack Query cache
    const queryCache = queryClient.getQueryCache();
    const matchingQueries = queryCache.findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    for (const query of matchingQueries) {
      queryClient.setQueryData(query.queryKey, (oldData: any) => {
        if (!oldData?.data) return oldData;
        return {
          ...oldData,
          data: [newRow, ...oldData.data],
          total: (oldData.total || 0) + 1,
        };
      });
    }

    setEditingRow(newRow.id);
    setEditedData(newRow);
    setIsAddingRow(true);
  }, [queryClient, entityCode]);

  // v9.5.1: Open delete confirmation modal instead of window.confirm
  const handleDeleteClick = useCallback((record: any) => {
    if (!config) return;
    setDeleteModalRecord(record);
    setDeleteModalOpen(true);
  }, [config]);

  // v9.5.1: Actual delete handler called from modal
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModalRecord) return;

    const rawRecord = deleteModalRecord.raw || deleteModalRecord;
    const recordId = rawRecord.id?.toString();

    // v11.4.1: TEMP ROW DELETE - Remove from cache only, no API call needed
    if (recordId?.startsWith('temp_') || rawRecord._isNew) {
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      for (const query of matchingQueries) {
        queryClient.setQueryData(query.queryKey, (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.filter((item: any) => item.id !== recordId),
            total: Math.max(0, (oldData.total || 1) - 1),
          };
        });
      }

      if (editingRow === recordId) {
        setEditingRow(null);
        setEditedData({});
        setIsAddingRow(false);
      }
      return;
    }

    // ============================================================================
    // v9.5.0: OPTIMISTIC DELETE - Row removed immediately, API syncs in background
    // ============================================================================
    debugCache('Optimistic delete: Starting', { entityCode, recordId: rawRecord.id });
    try {
      await deleteEntity(rawRecord.id);
      debugCache('Optimistic delete: Completed', { entityCode, recordId: rawRecord.id });
    } catch (error) {
      // Error handling and rollback handled by useOptimisticMutation onError callback
      debugCache('Optimistic delete: Failed', { entityCode, recordId: rawRecord.id });
      throw error; // Re-throw so modal can display error
    }
  }, [deleteModalRecord, entityCode, deleteEntity, queryClient, editingRow]);

  // Row actions for EntityListOfInstancesTable
  const rowActions: RowAction[] = useMemo(() => {
    const actions: RowAction[] = [];

    actions.push({
      key: 'edit',
      label: 'Edit',
      icon: <Edit className="h-4 w-4" />,
      variant: 'default',
      onClick: (record) => {
        // v11.3.0: No localData sync needed - cache is source of truth
        const rawRecord = record.raw || record;
        const recordId = rawRecord.id;
        setEditingRow(recordId);
        setEditedData(transformFromApi({ ...rawRecord }));
      }
    });

    actions.push({
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'danger',
      onClick: handleDeleteClick
    });

    return actions;
  }, [handleDeleteClick]);

  if (!config) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Entity configuration not found for: {entityCode}</p>
        </div>
      </Layout>
    );
  }

  const renderContent = () => {
    // TABLE VIEW (uses EntityListOfInstancesTable directly - no FilteredDataTable wrapper)
    if (view === 'table') {
      if (loading) {
        return (
          <div className="flex items-center justify-center h-64">
            <EllipsisBounce size="lg" text="Processing" />
          </div>
        );
      }

      // v9.4.1: Pass ALL fetched data (1000 records) to table for search/filter
      // Table's internal pagination will slice to 500 at a time for rendering
      // This ensures search works against all fetched records, not just displayed slice
      const tableData = formattedData.length > 0 ? formattedData : data;

      // v11.0.0: ref_data_entityInstance removed - table uses TanStack Query cache
      return (
        <EntityListOfInstancesTable
          data={tableData}
          metadata={metadata}
          loading={loading}
          pagination={pagination}
          onRowClick={handleRowClick}
          searchable={true}
          filterable={true}
          columnSelection={true}
          rowActions={rowActions}
          selectable={true}
          inlineEditable={true}
          editingRow={editingRow}
          editedData={editedData}
          onInlineEdit={handleInlineEdit}
          onCellSave={handleCellSave}
          onSaveInlineEdit={handleSaveInlineEdit}
          onCancelInlineEdit={handleCancelInlineEdit}
          allowAddRow={true}
          onAddRow={handleAddRow}
          // v13.1.0: Loading indicators for pagination/fetching
          isFetchingNextPage={isFetching && !dataLoading}
          hasNextPage={hasMore}
          // v11.0.0: Entity code for dynamic button label (no parentContext = standalone mode)
          entityCode={entityCode}
        />
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <EllipsisBounce size="lg" text="Processing" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-dark-accent text-white text-sm font-medium rounded-md hover:bg-dark-accent-hover focus-visible:ring-2 focus-visible:ring-dark-accent-ring/50 focus-visible:outline-none shadow-sm transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    // KANBAN VIEW - Settings-driven, no fallbacks
    if (view === 'kanban' && config.kanban) {
      return (
        <div className="space-y-4">
          <div className="bg-dark-surface border border-dark-border-subtle rounded-lg shadow-sm p-6 h-full overflow-x-auto">
            <KanbanView
              config={config}
              data={data}
              onCardClick={handleRowClick}
              onCardMove={handleCardMove}
              emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
            />
          </div>
          {hasMore && !loading && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 bg-dark-accent text-white text-sm font-medium rounded-md hover:bg-dark-accent-hover focus-visible:ring-2 focus-visible:ring-dark-accent-ring/50 focus-visible:outline-none shadow-sm transition-colors"
              >
                Load More ({data.length} of {totalRecords})
              </button>
            </div>
          )}
        </div>
      );
    }

    // GRID VIEW
    if (view === 'grid' && config.grid) {
      return (
        <div className="space-y-4">
          <div className="bg-dark-surface border border-dark-border-subtle rounded-lg shadow-sm p-6">
            <GridView
              items={data}
              onItemClick={handleRowClick}
              columns={3}
              emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
              titleField={config.grid.cardFields[0] || 'name'}
              descriptionField={config.grid.cardFields[1] || 'descr'}
              badgeFields={config.grid.cardFields.slice(2) || []}
              imageField={config.grid.imageField}
            />
          </div>
          {hasMore && !loading && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 bg-dark-accent text-white text-sm font-medium rounded-md hover:bg-dark-accent-hover focus-visible:ring-2 focus-visible:ring-dark-accent-ring/50 focus-visible:outline-none shadow-sm transition-colors"
              >
                Load More ({data.length} of {totalRecords})
              </button>
            </div>
          )}
        </div>
      );
    }

    // CALENDAR VIEW - Person-filterable calendar grid showing all slots (available + booked)
    if (view === 'calendar') {
      return (
        <div className="space-y-4">
          <div className="bg-dark-surface border border-dark-border-subtle rounded-lg shadow-sm p-6">
            <CalendarView
              config={config}
              data={data}
              onSlotClick={handleRowClick}
              emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
            />
          </div>
          {hasMore && !loading && (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 bg-dark-accent text-white text-sm font-medium rounded-md hover:bg-dark-accent-hover focus-visible:ring-2 focus-visible:ring-dark-accent-ring/50 focus-visible:outline-none shadow-sm transition-colors"
              >
                Load More ({data.length} of {totalRecords})
              </button>
            </div>
          )}
        </div>
      );
    }

    // GRAPH VIEW - Hierarchies vs Workflows
    if (view === 'graph') {
      // Check if this is a hierarchy entity (has parent_id field)
      const isHierarchyEntity = entityCode.includes('hierarchy') ||
                               (data.length > 0 && 'parent_id' in data[0]);

      if (isHierarchyEntity) {
        // Use HierarchyGraphView for parent_id-based hierarchies
        return (
          <HierarchyGraphView
            data={data}
            onNodeClick={handleRowClick}
            emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
          />
        );
      } else {
        // Use DAGVisualizer for workflow/stage visualizations
        const dagNodes = data.map((item: any) => ({
          id: item.stage_id ?? item.level_id ?? item.id ?? 0,
          node_name: item.stage_name || item.level_name || item.name || String(item.id),
          parent_ids: item.parent_ids ? (Array.isArray(item.parent_ids) ? item.parent_ids : [item.parent_id].filter(Boolean)) : []
        }));

        return (
          <div className="bg-dark-surface border border-dark-border-subtle rounded-lg shadow-sm p-6">
            <DAGVisualizer
              nodes={dagNodes}
            />
          </div>
        );
      }
    }

    return null;
  };

  // Get entity icon from centralized icon system
  const EntityIcon = getEntityIcon(entityCode);

  // v14.2.0: Canvas background inherited from Layout
  return (
    <Layout>
      <div className="h-full flex flex-col w-[97%] max-w-[1536px] mx-auto">
        {/* v14.2.0: Sticky Header - transparent to show canvas background */}
        <div className="sticky top-0 z-10 pb-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Back button for settings entities */}
              {isSettingsEntity && (
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 rounded-md text-dark-500 hover:text-dark-700 hover:bg-dark-100 focus-visible:ring-2 focus-visible:ring-dark-accent-ring/30 focus-visible:outline-none transition-all"
                  title="Back to Settings"
                >
                  <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
                </button>
              )}
              <EntityIcon className="h-5 w-5 text-dark-700 stroke-[1.5]" />
              <div>
                <h1 className="text-lg font-semibold text-dark-800 tracking-tight">{config.pluralName}</h1>
                <p className="text-sm text-dark-500">
                  Manage and track {config.pluralName.toLowerCase()}
                </p>
              </div>
            </div>

            {/* View Switcher and Create Button */}
            <div className="flex items-center space-x-3">
              {config.supportedViews.length > 1 && (
                <ViewSwitcher
                  currentView={view}
                  supportedViews={config.supportedViews}
                  onChange={setView}
                />
              )}
              <button
                onClick={handleCreateClick}
                className="inline-flex items-center px-4 py-2 bg-dark-accent text-white text-sm font-medium rounded-md hover:bg-dark-accent-hover active:bg-dark-700 focus-visible:ring-2 focus-visible:ring-dark-accent-ring/50 focus-visible:outline-none shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4 mr-2 stroke-[2]" />
                Create {config.displayName}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>

      {/* v9.5.1: Delete confirmation modal (replaces window.confirm) */}
      <DeleteOrUnlinkModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteModalRecord(null);
        }}
        entityCode={entityCode}
        entityLabel={config?.displayName}
        entityName={
          deleteModalRecord?.raw?.name ||
          deleteModalRecord?.name ||
          deleteModalRecord?.raw?.code ||
          deleteModalRecord?.code ||
          'this record'
        }
        // No parentContext = standalone mode (delete confirmation only)
        onDelete={handleDeleteConfirm}
      />
    </Layout>
  );
}

/**
 * Usage Examples:
 *
 * In routes:
 * <Route path="/project" element={<EntityListOfInstancesPage entityCode="project" />} />
 * <Route path="/task" element={<EntityListOfInstancesPage entityCode="task" />} />
 * <Route path="/wiki" element={<EntityListOfInstancesPage entityCode="wiki" />} />
 * <Route path="/artifact" element={<EntityListOfInstancesPage entityCode="artifact" />} />
 * <Route path="/form" element={<EntityListOfInstancesPage entityCode="form" />} />
 * <Route path="/business" element={<EntityListOfInstancesPage entityCode="business" />} />
 * <Route path="/office" element={<EntityListOfInstancesPage entityCode="office" />} />
 * <Route path="/employee" element={<EntityListOfInstancesPage entityCode="employee" />} />
 * <Route path="/role" element={<EntityListOfInstancesPage entityCode="role" />} />
 */
