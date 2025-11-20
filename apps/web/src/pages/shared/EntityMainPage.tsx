import React, { useState, useEffect, useMemo } from 'react';
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
import { useSidebar } from '../../contexts/SidebarContext';

/**
 * Universal EntityMainPage
 *
 * A single, reusable component that renders the main listing page for ANY entity.
 * Supports table, kanban, and grid views based on entity configuration.
 *
 * Usage via routing:
 * - /project -> EntityMainPage with entityCode="project"
 * - /task -> EntityMainPage with entityCode="task"
 * - /wiki -> EntityMainPage with entityCode="wiki"
 * etc.
 */

interface EntityMainPageProps {
  entityCode: string;
  defaultView?: ViewMode;
}

export function EntityMainPage({ entityCode, defaultView }: EntityMainPageProps) {
  const navigate = useNavigate();
  const config = getEntityConfig(entityCode);
  const [view, setView] = useViewMode(entityCode, defaultView);
  const [data, setData] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<EntityMetadata | null>(null);  // Backend metadata
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const { collapseSidebar } = useSidebar();

  // Check if this is a settings entity
  const isSettingsEntity = useMemo(() => {
    return config?.apiEndpoint?.includes('/api/v1/setting?datalabel=') || false;
  }, [config]);

  // Collapse sidebar when entering entity main page
  useEffect(() => {
    collapseSidebar();
  }, []);

  // Fetch data for kanban and grid views
  useEffect(() => {
    if (view !== 'table' && config) {
      loadData();
    }
  }, [view, entityCode]);

  const loadData = async (page: number = 1, append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityCode);

      // Use pageSize of 100 to align with API maximum limit
      const params: any = { page, pageSize: 100 };

      const response = await api.list(params);
      const newData = response.data || [];

      // Extract backend metadata (only on first load, not on append)
      if (!append && response.metadata) {
        setMetadata(response.metadata);
      }

      // Append to existing data for pagination, or replace for initial load
      setData(append ? [...data, ...newData] : newData);
      setTotalRecords(response.total || 0);
      setCurrentPage(page);
      setHasMore(newData.length === 100); // If we got 100 records, there might be more
    } catch (err) {
      console.error(`Failed to load ${entityCode}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      if (!append) {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item: any) => {
    // Use custom detail page ID field if specified, otherwise default to 'id'
    const idField = config.detailPageIdField || 'id';
    const id = item[idField];
    navigate(`/${entityCode}/${id}`);
  };

  const handleCreateClick = () => {
    navigate(`/${entityCode}/new`);
  };

  const handleLoadMore = () => {
    loadData(currentPage + 1, true);
  };

  const handleBulkShare = (selectedItems: any[]) => {
    console.log(`Bulk share ${entityCode}:`, selectedItems.map(i => i.id));
    alert(`Sharing ${selectedItems.length} ${config?.displayName || entityCode}${selectedItems.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedItems: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} ${config?.displayName || entityCode}${selectedItems.length !== 1 ? 's' : ''}?`)) {
      console.log(`Bulk delete ${entityCode}:`, selectedItems.map(i => i.id));
      alert(`Deleted ${selectedItems.length} ${config?.displayName || entityCode}${selectedItems.length !== 1 ? 's' : ''}`);

      // Reload data after delete
      if (view !== 'table') {
        loadData();
      }
    }
  };

  const handleCardMove = async (itemId: string, fromColumn: string, toColumn: string) => {
    if (!config?.kanban) return;

    console.log(`Moving ${entityCode} ${itemId} from ${fromColumn} to ${toColumn}`);

    // Optimistic update
    setData(prev => prev.map(item =>
      item.id === itemId ? { ...item, [config.kanban!.groupByField]: toColumn } : item
    ));

    // Type-safe API call to update
    try {
      const api = APIFactory.getAPI(entityCode);
      await api.update(itemId, { [config.kanban.groupByField]: toColumn });
    } catch (err) {
      console.error(`Failed to update ${entityCode}:`, err);
      // Revert optimistic update on error
      loadData();
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

  const renderContent = () => {
    // TABLE VIEW (uses FilteredDataTable)
    if (view === 'table') {
      return (
        <FilteredDataTable
          entityCode={entityCode}
          metadata={metadata}  // Pass backend metadata
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
            onClick={loadData}
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
 * <Route path="/project" element={<EntityMainPage entityCode="project" />} />
 * <Route path="/task" element={<EntityMainPage entityCode="task" />} />
 * <Route path="/wiki" element={<EntityMainPage entityCode="wiki" />} />
 * <Route path="/artifact" element={<EntityMainPage entityCode="artifact" />} />
 * <Route path="/form" element={<EntityMainPage entityCode="form" />} />
 * <Route path="/business" element={<EntityMainPage entityCode="business" />} />
 * <Route path="/office" element={<EntityMainPage entityCode="office" />} />
 * <Route path="/employee" element={<EntityMainPage entityCode="employee" />} />
 * <Route path="/role" element={<EntityMainPage entityCode="role" />} />
 */
