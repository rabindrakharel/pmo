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
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig, type ViewMode } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { transformForApi, transformFromApi } from '../../lib/frontEndFormatterService';
import { useSidebar } from '../../contexts/SidebarContext';
import { useEntityInstanceData, useEntityInstanceMetadata, useOptimisticMutation, QUERY_KEYS } from '@/db/tanstack-index';
import { formatDataset, type ComponentMetadata } from '../../lib/formatters';
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
  const metadata = useMemo((): ComponentMetadata | null => {
    if (!viewType || Object.keys(viewType).length === 0) return null;
    return { viewType, editType } as ComponentMetadata;
  }, [viewType, editType]);

  // ============================================================================
  // QUERY 2: DATA (5-min cache) - populates rows after metadata ready
  // ============================================================================
  const queryParams = useMemo(() => ({
    limit: 20000,
    offset: (currentPage - 1) * 20000,
  }), [currentPage]);

  // v11.0.0: refData removed - using TanStack Query cache via getEntityInstanceNameSync()
  const {
    data: rawData,
    total: totalRecords,
    isLoading: dataLoading,
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

  // Format data on read (memoized) - formatting happens HERE, not in hook
  // v11.0.0: refData no longer passed - formatDataset uses TanStack Query cache
  const formattedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    debugCache('🎨 formatDataset called', {
      entityCode,
      rowCount: rawData.length,
      firstRowManagerId: (rawData[0] as any)?.manager__employee_id,
    });
    return formatDataset(rawData, metadata ?? null);
  }, [rawData, metadata, entityCode]);

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

  const hasMore = (rawData?.length || 0) === 20000;
  const error = queryError?.message || null;

  // Client-side pagination for EntityListOfInstancesTable rendering
  // v8.1.0: Page size controls how many rows render at once
  const [clientPageSize, setClientPageSize] = useState(1000);
  const pagination = useMemo(() => ({
    current: currentPage,
    pageSize: clientPageSize,
    total: totalRecords,
    showSizeChanger: true,
    pageSizeOptions: [100, 500, 1000, 2000],
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
    // v9.5.2: Refetch on success to update ref_data_entityInstance with new entity names
    // Without this, optimistic update shows raw UUID until page refresh
    refetchOnSuccess: true,
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
    console.log('%c[ROW CLICK] handleRowClick called', 'color: #8b5cf6; font-weight: bold', { item });

    if (!config) return;
    // v8.0.0: Handle FormattedRow objects (raw data is inside item.raw)
    const rawItem = item.raw || item;
    const idField = config.detailPageIdField || 'id';
    const id = rawItem[idField];

    console.log('%c[ROW CLICK] Row ID extracted', 'color: #8b5cf6; font-weight: bold', {
      id,
      isTemp: id?.toString().startsWith('temp_')
    });

    // v11.3.0: Block navigation for temp rows (they don't exist on server yet)
    if (id?.toString().startsWith('temp_')) {
      console.log('%c[ROW CLICK] BLOCKED - temp row cannot navigate', 'color: #ef4444; font-weight: bold');
      return;  // Do nothing - row is still being created
    }

    console.log('%c[ROW CLICK] Navigating to detail page', 'color: #8b5cf6; font-weight: bold', {
      path: `/${entityCode}/${id}`
    });
    navigate(`/${entityCode}/${id}`);
  }, [config, entityCode, navigate]);

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
    console.log('%c[INLINE EDIT] Field changed', 'color: #06b6d4; font-weight: bold', {
      field,
      value,
      rowId: _rowId
    });
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
    console.log('%c[CELL SAVE] handleCellSave called', 'color: #3b82f6; font-weight: bold', {
      rowId,
      columnKey,
      value,
      record
    });

    if (!config) return;

    // Handle both FormattedRow and raw data
    const rawRecord = record.raw || record;
    const isNewRow = isAddingRow || rowId?.toString().startsWith('temp_') || rawRecord._isNew;

    // Build change data directly from parameters (no stale state issues)
    const changeData = { [columnKey]: value };
    const transformedData = transformForApi(changeData, rawRecord);

    console.log('%c[CELL SAVE] Transformed data', 'color: #3b82f6; font-weight: bold', {
      changeData,
      transformedData,
      isNewRow
    });

    // Remove temporary fields
    delete transformedData._isNew;
    delete transformedData._isOptimistic;
    if (isNewRow) {
      delete transformedData.id;
    }

    try {
      if (isNewRow) {
        console.log('%c[CELL SAVE] Creating new entity', 'color: #3b82f6; font-weight: bold');
        await createEntity(transformedData, { existingTempId: rowId });
      } else {
        console.log('%c[CELL SAVE] Updating entity', 'color: #3b82f6; font-weight: bold');
        await updateEntity(rowId, transformedData);
      }

      console.log('%c[CELL SAVE] SUCCESS', 'color: #10b981; font-weight: bold');

      // Clear edit state after successful mutation
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    } catch (error) {
      console.log('%c[CELL SAVE] FAILED', 'color: #ef4444; font-weight: bold', { error });
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    }
  }, [config, isAddingRow, createEntity, updateEntity]);

  // Row-level save (for explicit Save button clicks, not cell-level auto-save)
  const handleSaveInlineEdit = useCallback(async (record: any) => {
    console.log('%c[SAVE] handleSaveInlineEdit called', 'color: #3b82f6; font-weight: bold', {
      record,
      editedData,
      isAddingRow
    });

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

      console.log('%c[SAVE] SUCCESS', 'color: #10b981; font-weight: bold');
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    } catch (error) {
      console.log('%c[SAVE] FAILED', 'color: #ef4444; font-weight: bold', { error });
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
    }
  }, [config, editedData, isAddingRow, createEntity, updateEntity]);

  const handleCancelInlineEdit = useCallback(() => {
    console.log('%c[CANCEL] Step 1: handleCancelInlineEdit called', 'color: #ef4444; font-weight: bold', {
      isAddingRow,
      editingRow
    });

    if (isAddingRow && editingRow) {
      console.log('%c[CANCEL] Step 2: Removing temp row from cache', 'color: #ef4444; font-weight: bold', {
        tempRowId: editingRow
      });

      // v11.3.0: Remove temp row from cache (single source of truth)
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      console.log('%c[CANCEL] Step 3: Found matching queries', 'color: #ef4444; font-weight: bold', {
        queryCount: matchingQueries.length
      });

      for (const query of matchingQueries) {
        queryClient.setQueryData(query.queryKey, (oldData: any) => {
          if (!oldData?.data) return oldData;
          const newData = oldData.data.filter((item: any) => item.id !== editingRow);
          console.log('%c[CANCEL] Step 4: Filtered cache data', 'color: #ef4444; font-weight: bold', {
            oldCount: oldData.data.length,
            newCount: newData.length
          });
          return {
            ...oldData,
            data: newData,
            total: Math.max(0, (oldData.total || 1) - 1),
          };
        });
      }
    }

    // Clear edit state
    console.log('%c[CANCEL] Step 5: Clearing edit state', 'color: #ef4444; font-weight: bold');
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }, [isAddingRow, editingRow, queryClient, entityCode]);

  const handleAddRow = useCallback((newRow: any) => {
    console.log('%c[ADD ROW] Step 1: handleAddRow called', 'color: #10b981; font-weight: bold', {
      newRowId: newRow.id,
      newRow
    });

    // v11.3.0: Add temp row DIRECTLY to TanStack Query cache
    // This is the industry standard pattern - cache is single source of truth
    const queryCache = queryClient.getQueryCache();
    const matchingQueries = queryCache.findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    console.log('%c[ADD ROW] Step 2: Found matching queries', 'color: #10b981; font-weight: bold', {
      queryCount: matchingQueries.length,
      queryKeys: matchingQueries.map(q => JSON.stringify(q.queryKey))
    });

    for (const query of matchingQueries) {
      queryClient.setQueryData(query.queryKey, (oldData: any) => {
        if (!oldData?.data) {
          console.log('%c[ADD ROW] Step 3: No oldData, returning unchanged', 'color: #ef4444; font-weight: bold');
          return oldData;
        }
        console.log('%c[ADD ROW] Step 3: Adding temp row to cache', 'color: #10b981; font-weight: bold', {
          oldDataCount: oldData.data.length,
          newDataCount: oldData.data.length + 1
        });
        return {
          ...oldData,
          data: [...oldData.data, newRow],  // Add temp row to END
          total: (oldData.total || 0) + 1,
        };
      });
    }

    // Enter edit mode for the new row
    console.log('%c[ADD ROW] Step 4: Setting edit state', 'color: #10b981; font-weight: bold', {
      editingRow: newRow.id,
      isAddingRow: true
    });
    setEditingRow(newRow.id);
    setEditedData(newRow);
    setIsAddingRow(true);
  }, [queryClient, entityCode]);

  const handleDelete = useCallback(async (record: any) => {
    if (!config) return;
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    // v8.0.0: Handle FormattedRow objects
    const rawRecord = record.raw || record;

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
    }
  }, [config, entityCode, deleteEntity]);

  // Row actions for EntityListOfInstancesTable
  const rowActions: RowAction[] = useMemo(() => {
    const actions: RowAction[] = [];

    actions.push({
      key: 'edit',
      label: 'Edit',
      icon: <Edit className="h-4 w-4" />,
      variant: 'default',
      onClick: (record) => {
        console.log('%c[EDIT ACTION] Edit button clicked', 'color: #f59e0b; font-weight: bold', { record });
        // v11.3.0: No localData sync needed - cache is source of truth
        const rawRecord = record.raw || record;
        const recordId = rawRecord.id;
        console.log('%c[EDIT ACTION] Setting edit state', 'color: #f59e0b; font-weight: bold', {
          recordId,
          rawRecord
        });
        setEditingRow(recordId);
        setEditedData(transformFromApi({ ...rawRecord }));
      }
    });

    actions.push({
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'danger',
      onClick: handleDelete
    });

    return actions;
  }, [handleDelete]);

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

      // v9.5.1: ALWAYS use formattedData for display
      // The table internally extracts raw values for editing cells via FormattedRow.raw
      // This fixes the bug where entire table showed UUIDs instead of names during edit mode
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
            className="mt-4 px-4 py-2 bg-dark-700 text-white rounded-md hover:bg-dark-800"
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
          <div className="bg-dark-100 rounded-md shadow p-6 h-full overflow-x-auto">
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
                className="px-4 py-2 bg-dark-700 text-white rounded-md hover:bg-dark-800 transition-colors"
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
          <div className="bg-dark-100 rounded-md shadow p-6">
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
                className="px-4 py-2 bg-dark-700 text-white rounded-md hover:bg-dark-800 transition-colors"
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
          <div className="bg-dark-100 rounded-md shadow p-6">
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
                className="px-4 py-2 bg-dark-700 text-white rounded-md hover:bg-dark-800 transition-colors"
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
          <div className="bg-dark-100 rounded-md shadow p-6">
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

  return (
    <Layout>
      <div className="h-full flex flex-col w-[97%] max-w-[1536px] mx-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-dark-100 pb-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Back button for settings entities */}
              {isSettingsEntity && (
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 rounded-md text-dark-600 hover:text-dark-600 hover:bg-dark-100 transition-all"
                  title="Back to Settings"
                >
                  <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
                </button>
              )}
              <EntityIcon className="h-5 w-5 text-dark-700 stroke-[1.5]" />
              <div>
                <h1 className="text-sm font-normal text-dark-600">{config.pluralName}</h1>
                <p className="mt-1 text-sm text-dark-700">
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
                className="inline-flex items-center px-3 py-1.5 border border-dark-400 text-sm font-normal rounded text-dark-600 bg-dark-100 hover:bg-dark-100 hover:border-dark-400 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2 stroke-[1.5]" />
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
