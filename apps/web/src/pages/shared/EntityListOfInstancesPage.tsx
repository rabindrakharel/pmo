import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Layout, ViewSwitcher, EntityDataTable } from '../../components/shared';
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
import { useFormattedEntityList, useEntityMutation } from '../../lib/hooks';
import { API_CONFIG } from '../../lib/config/api';
import type { RowAction } from '../../components/shared/ui/EntityDataTable';

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

// ============================================================================
// DEBUG: Render counter for tracking re-renders
// ============================================================================
let entityListRenderCount = 0;

export function EntityListOfInstancesPage({ entityCode, defaultView }: EntityListOfInstancesPageProps) {
  // DEBUG: Track renders
  entityListRenderCount++;
  const renderIdRef = React.useRef(entityListRenderCount);
  console.log(
    `%c[RENDER #${renderIdRef.current}] 🖼️ EntityListOfInstancesPage: ${entityCode}`,
    'color: #748ffc; font-weight: bold',
    { entityCode, defaultView, timestamp: new Date().toLocaleTimeString() }
  );

  const navigate = useNavigate();
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
  // v8.0.0: FORMAT AT READ PATTERN
  // ============================================================================
  // Raw data is cached in React Query, formatting happens on READ via select
  // Benefits: Smaller cache, fresh formatting with latest datalabel colors
  // ============================================================================

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize: 20000,
    view: view,
  }), [currentPage, view]);

  const {
    data: queryResult,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useFormattedEntityList(entityCode, queryParams, {
    enabled: !!config,
  });

  // ============================================================================
  // INLINE EDIT STATE MANAGEMENT
  // ============================================================================
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<any>({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [localData, setLocalData] = useState<any[]>([]);

  // ============================================================================
  // v8.0.0: DATA EXTRACTION - Format at Read
  // ============================================================================
  // queryResult.data = raw data (for editing, mutations)
  // queryResult.formattedData = formatted data (for display via select transform)
  // ============================================================================

  // Raw data for editing operations
  const rawData = useMemo(() => {
    if (!queryResult) return appendedData;
    if (currentPage > 1 && appendedData.length > 0) {
      return [...appendedData, ...queryResult.data];
    }
    return queryResult.data;
  }, [queryResult, appendedData, currentPage]);

  // Formatted data for display (from select transform)
  const formattedData = useMemo(() => {
    if (!queryResult?.formattedData) return [];
    return queryResult.formattedData;
  }, [queryResult]);

  // Use localData only when actively editing, otherwise use rawData
  const data = localData.length > 0 ? localData : rawData;

  // Reset localData when exiting edit mode or entity changes
  useEffect(() => {
    if (!editingRow && !isAddingRow) {
      setLocalData([]);
    }
  }, [editingRow, isAddingRow, entityCode]);

  const metadata = queryResult?.metadata || null;
  const totalRecords = queryResult?.total || 0;
  const hasMore = queryResult?.hasMore || false;
  const error = queryError?.message || null;

  // Client-side pagination for EntityDataTable rendering
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

  // Entity mutation for updates (kanban card moves, etc.)
  const { updateEntity } = useEntityMutation(entityCode);

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
    console.log(
      `%c[NAVIGATION] 🚀 Row clicked - navigating to detail page`,
      'color: #f783ac; font-weight: bold',
      { entityCode, id, itemName: rawItem.name || rawItem.code, from: 'EntityListOfInstancesPage' }
    );
    navigate(`/${entityCode}/${id}`);
  }, [config, entityCode, navigate]);

  const handleCreateClick = useCallback(() => {
    navigate(`/${entityCode}/new`);
  }, [entityCode, navigate]);

  const handleLoadMore = useCallback(() => {
    loadData(currentPage + 1, true);
  }, [currentPage, loadData]);

  // ============================================================================
  // OPTIMISTIC UPDATES WITH ZUSTAND MUTATION
  // ============================================================================
  // Kanban card moves use optimistic updates via useEntityMutation
  // On error, React Query automatically refetches to restore correct state
  // ============================================================================

  const handleCardMove = useCallback(async (itemId: string, fromColumn: string, toColumn: string) => {
    if (!config?.kanban) return;

    console.log(`Moving ${entityCode} ${itemId} from ${fromColumn} to ${toColumn}`);

    try {
      // Use mutation hook with automatic optimistic update and error rollback
      await updateEntity({
        id: itemId,
        data: { [config.kanban.groupByField]: toColumn }
      });
    } catch (err) {
      console.error(`Failed to update ${entityCode}:`, err);
      // React Query will automatically refetch on error
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

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const isNewRow = isAddingRow || record.id?.toString().startsWith('temp_') || record._isNew;
      const transformedData = transformForApi(editedData, record);

      // Remove temporary fields
      delete transformedData._isNew;
      if (isNewRow) {
        delete transformedData.id;
      }

      let response;
      if (isNewRow) {
        // POST - Create new entity
        console.log(`Creating new ${entityCode}:`, transformedData);
        response = await fetch(`${API_CONFIG.BASE_URL}${config.apiEndpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(transformedData)
        });

        if (response.ok) {
          console.log(`✅ Created ${entityCode}`);
          await refetch();
          setEditingRow(null);
          setEditedData({});
          setIsAddingRow(false);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to create ${entityCode}:`, response.statusText, errorText);
          alert(`Failed to create ${entityCode}: ${response.statusText}`);
        }
      } else {
        // PATCH - Update existing entity
        console.log(`Updating ${entityCode}:`, transformedData);
        response = await fetch(`${API_CONFIG.BASE_URL}${config.apiEndpoint}/${record.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(transformedData)
        });

        if (response.ok) {
          console.log(`✅ Updated ${entityCode}`);
          await refetch();
          setEditingRow(null);
          setEditedData({});
          setIsAddingRow(false);
        } else {
          const errorText = await response.text();
          console.error(`Failed to update record:`, response.statusText, errorText);
          alert(`Failed to update record: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error saving record:', error);
      alert('An error occurred while saving. Please try again.');
    }
  }, [config, entityCode, editedData, isAddingRow, refetch]);

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

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${config.apiEndpoint}/${rawRecord.id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        console.log('✅ Record deleted successfully');
        await refetch();
      } else {
        const errorText = await response.text();
        console.error('Failed to delete record:', response.statusText, errorText);
        alert(`Failed to delete record: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('An error occurred while deleting. Please try again.');
    }
  }, [config, refetch]);

  // Row actions for EntityDataTable
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
        setEditingRow(record.id);
        // Use raw record data for editing (handle both FormattedRow and raw)
        const rawRecord = record.raw || record;
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
    // TABLE VIEW (uses EntityDataTable directly - no FilteredDataTable wrapper)
    if (view === 'table') {
      if (loading) {
        return (
          <div className="flex items-center justify-center h-64">
            <EllipsisBounce size="lg" text="Processing" />
          </div>
        );
      }

      // v8.0.0: Format at Read - Use formattedData for display, raw data for editing
      // When editing: use localData (raw) for form inputs
      // When viewing: use formattedData (pre-formatted via select transform)
      const tableData = editingRow || isAddingRow
        ? data  // Raw data for editing
        : (formattedData.length > 0 ? formattedData : data);  // Formatted data for viewing

      return (
        <EntityDataTable
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
