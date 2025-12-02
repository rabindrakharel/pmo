import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useEntityInstanceData, useEntityInstanceMetadata, useOptimisticMutation } from '@/db/tanstack-index';
import { formatDataset, type ComponentMetadata } from '../../lib/formatters';
import type { RowAction } from '../../components/shared/ui/EntityListOfInstancesTable';

// ============================================================================
// DEBUG LOGGING - Cache & Data Flow Diagnostics
// ============================================================================
// Set to true to enable detailed cache debugging
const DEBUG_CACHE = true;

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
  const metadata = useMemo(() => {
    if (!viewType || Object.keys(viewType).length === 0) return undefined;
    return { viewType, editType };
  }, [viewType, editType]);

  // ============================================================================
  // QUERY 2: DATA (5-min cache) - populates rows after metadata ready
  // ============================================================================
  const queryParams = useMemo(() => ({
    limit: 20000,
    offset: (currentPage - 1) * 20000,
  }), [currentPage]);

  // v10.0.0: refData removed from destructuring - using centralized entityInstanceNames sync store
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
  // v10.0.0: refData no longer passed - formatDataset uses centralized entityInstanceNames sync store
  const formattedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    debugCache('🎨 formatDataset called', {
      entityCode,
      rowCount: rawData.length,
      firstRowManagerId: (rawData[0] as any)?.manager__employee_id,
    });
    return formatDataset(rawData, metadata as ComponentMetadata | undefined);
  }, [rawData, metadata, entityCode]);

  // ============================================================================
  // INLINE EDIT STATE MANAGEMENT
  // ============================================================================
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<any>({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [localData, setLocalData] = useState<any[]>([]);

  // Combine raw data with any appended data from pagination
  const combinedRawData = useMemo(() => {
    if (currentPage > 1 && appendedData.length > 0) {
      return [...appendedData, ...(rawData || [])];
    }
    return rawData || [];
  }, [rawData, appendedData, currentPage]);

  // Use localData only when actively editing, otherwise use raw data
  const data = localData.length > 0 ? localData : combinedRawData;

  // Reset localData when exiting edit mode or entity changes
  useEffect(() => {
    if (!editingRow && !isAddingRow) {
      setLocalData([]);
    }
  }, [editingRow, isAddingRow, entityCode]);

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
    if (!config) return;
    // v8.0.0: Handle FormattedRow objects (raw data is inside item.raw)
    const rawItem = item.raw || item;
    const idField = config.detailPageIdField || 'id';
    const id = rawItem[idField];
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
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSaveInlineEdit = useCallback(async (record: any) => {
    if (!config) return;

    // Handle both FormattedRow and raw data
    const rawRecord = record.raw || record;
    const recordId = rawRecord.id;

    const isNewRow = isAddingRow || recordId?.toString().startsWith('temp_') || rawRecord._isNew;
    const transformedData = transformForApi(editedData, rawRecord);

    // Remove temporary fields
    delete transformedData._isNew;
    if (isNewRow) {
      delete transformedData.id;
    }

    try {
      if (isNewRow) {
        // ============================================================================
        // v9.5.0: OPTIMISTIC CREATE - UI updates immediately, API syncs in background
        // ============================================================================
        debugCache('Optimistic create: Starting', { entityCode, data: transformedData });
        await createEntity(transformedData);
        debugCache('Optimistic create: Completed', { entityCode });
      } else {
        // ============================================================================
        // v9.5.0: OPTIMISTIC UPDATE - UI updates immediately, API syncs in background
        // ============================================================================
        debugCache('Optimistic update: Starting', { entityCode, recordId, data: transformedData });
        await updateEntity(recordId, transformedData);
        debugCache('Optimistic update: Completed', { entityCode, recordId });
      }

      // Clear edit state after successful mutation
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
      setLocalData([]);
    } catch (error) {
      // Error handling is done in onError callback of useOptimisticMutation
      // Rollback happens automatically - just clear edit state
      setEditingRow(null);
      setEditedData({});
      setIsAddingRow(false);
      setLocalData([]);
    }
  }, [config, entityCode, editedData, isAddingRow, createEntity, updateEntity]);

  const handleCancelInlineEdit = useCallback(() => {
    if (isAddingRow && editingRow) {
      setLocalData(prev => prev.filter(row => row.id !== editingRow));
      setIsAddingRow(false);
    }
    setEditingRow(null);
    setEditedData({});
  }, [isAddingRow, editingRow]);

  const handleAddRow = useCallback((newRow: any) => {
    setLocalData(prev => [...prev, newRow]);
    setEditingRow(newRow.id);
    setEditedData(newRow);
    setIsAddingRow(true);
  }, []);

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
        // v8.0.0: Sync localData with raw data when entering edit mode
        if (localData.length === 0 && rawData) {
          setLocalData(rawData);
        }
        // Handle both FormattedRow and raw data
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
      onClick: handleDelete
    });

    return actions;
  }, [handleDelete, localData.length, rawData]);

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

      // v10.0.0: ref_data_entityInstance removed - table uses centralized entityInstanceNames sync store
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
