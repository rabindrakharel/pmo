import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import { Layout, FilteredDataTable, ViewSwitcher } from '../../components/shared';
import { KanbanView } from '../../components/shared/ui/KanbanView';
import { GridView } from '../../components/shared/ui/GridView';
import { CalendarView } from '../../components/shared/ui/CalendarView';
import { DAGVisualizer } from '../../components/workflow/DAGVisualizer';
import { HierarchyGraphView } from '../../components/hierarchy/HierarchyGraphView';
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig, ViewMode } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { APIFactory, type EntityMetadata } from '../../lib/api';
import { type DatalabelData } from '../../lib/frontEndFormatterService';
import { useSidebar } from '../../contexts/SidebarContext';
import { useEntityInstanceList, useEntityMutation, usePrefetch } from '../../lib/hooks';

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
  const config = getEntityConfig(entityCode);
  const [view, setView] = useViewMode(entityCode, defaultView);
  const [currentPage, setCurrentPage] = useState(1);
  const [appendedData, setAppendedData] = useState<any[]>([]); // For pagination append
  const { collapseSidebar } = useSidebar();
  const { prefetchEntity } = usePrefetch();

  // Check if this is a settings entity
  const isSettingsEntity = useMemo(() => {
    return config?.apiEndpoint?.includes('/api/v1/setting?datalabel=') || false;
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
  // ZUSTAND + REACT QUERY INTEGRATION
  // ============================================================================
  // Use React Query for data fetching with automatic caching
  // Data is cached for 2 minutes (CACHE_TTL.ENTITY_LIST)
  // Metadata and datalabels are cached in Zustand store for cross-component reuse
  // ============================================================================

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize: 100,
    view: view,
  }), [currentPage, view]);

  const {
    data: queryResult,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useEntityInstanceList(entityCode, queryParams, {
    // Only fetch for non-table views, table uses FilteredDataTable's own fetching
    enabled: view !== 'table' && !!config,
  });

  // Extract data from React Query result
  const data = useMemo(() => {
    if (!queryResult) return appendedData;
    // For pagination, combine appended data with new data
    if (currentPage > 1 && appendedData.length > 0) {
      return [...appendedData, ...queryResult.data];
    }
    return queryResult.data;
  }, [queryResult, appendedData, currentPage]);

  const metadata = queryResult?.metadata || null;
  const datalabels = queryResult?.datalabels || [];
  const totalRecords = queryResult?.total || 0;
  const hasMore = queryResult?.hasMore || false;
  const error = queryError?.message || null;

  // Entity mutation for updates (kanban card moves, etc.)
  const { updateEntity, isUpdating } = useEntityMutation(entityCode);

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
    // Use custom detail page ID field if specified, otherwise default to 'id'
    const idField = config.detailPageIdField || 'id';
    const id = item[idField];
    navigate(`/${entityCode}/${id}`);
  }, [config, entityCode, navigate]);

  // Prefetch entity data on hover for faster navigation
  const handleRowHover = useCallback((item: any) => {
    const idField = config.detailPageIdField || 'id';
    const id = item[idField];
    // Prefetch entity detail data in background
    prefetchEntity(entityCode, id);
  }, [config, entityCode, prefetchEntity]);

  const handleCreateClick = useCallback(() => {
    navigate(`/${entityCode}/new`);
  }, [entityCode, navigate]);

  const handleLoadMore = useCallback(() => {
    loadData(currentPage + 1, true);
  }, [currentPage, loadData]);

  const handleBulkShare = useCallback((selectedItems: any[]) => {
    console.log(`Bulk share ${entityCode}:`, selectedItems.map(i => i.id));
    alert(`Sharing ${selectedItems.length} ${config?.displayName || entityCode}${selectedItems.length !== 1 ? 's' : ''}`);
  }, [config, entityCode]);

  const handleBulkDelete = useCallback(async (selectedItems: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} ${config?.displayName || entityCode}${selectedItems.length !== 1 ? 's' : ''}?`)) {
      console.log(`Bulk delete ${entityCode}:`, selectedItems.map(i => i.id));
      alert(`Deleted ${selectedItems.length} ${config?.displayName || entityCode}${selectedItems.length !== 1 ? 's' : ''}`);

      // Refetch data after delete
      if (view !== 'table') {
        refetch();
      }
    }
  }, [config, entityCode, view, refetch]);

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
    // TABLE VIEW (uses FilteredDataTable)
    if (view === 'table') {
      return (
        <FilteredDataTable
          entityCode={entityCode}
          metadata={metadata}  // Pass backend metadata
          datalabels={datalabels}  // ✅ Pass preloaded datalabel data
          showActionButtons={false}
          showActionIcons={true}
          showEditIcon={true}
          inlineEditable={true}
          allowAddRow={true}
          onBulkShare={handleBulkShare}
          onBulkDelete={handleBulkDelete}
          onRowClick={handleRowClick}
        />
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700" />
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
