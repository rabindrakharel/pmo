import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import { Layout, FilteredDataTable, ViewSwitcher } from '../../components/shared';
import { KanbanView } from '../../components/shared/ui/KanbanView';
import { GridView } from '../../components/shared/ui/GridView';
import { CalendarView } from '../../components/shared/ui/CalendarView';
import { DAGVisualizer } from '../../components/workflow/DAGVisualizer';
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig, ViewMode } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { APIFactory } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';

/**
 * Universal EntityMainPage
 *
 * A single, reusable component that renders the main listing page for ANY entity.
 * Supports table, kanban, and grid views based on entity configuration.
 *
 * Usage via routing:
 * - /project -> EntityMainPage with entityType="project"
 * - /task -> EntityMainPage with entityType="task"
 * - /wiki -> EntityMainPage with entityType="wiki"
 * etc.
 */

interface EntityMainPageProps {
  entityType: string;
}

export function EntityMainPage({ entityType }: EntityMainPageProps) {
  const navigate = useNavigate();
  const config = getEntityConfig(entityType);
  const [view, setView] = useViewMode(entityType);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  }, [view, entityType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(entityType);

      // Load all calendar slots (both available and booked) - filtering by person happens client-side
      const params: any = { page: 1, pageSize: 1000 };

      const response = await api.list(params);
      setData(response.data || []);
    } catch (err) {
      console.error(`Failed to load ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item: any) => {
    // Use custom detail page ID field if specified, otherwise default to 'id'
    const idField = config.detailPageIdField || 'id';
    const id = item[idField];
    navigate(`/${entityType}/${id}`);
  };

  const handleCreateClick = () => {
    navigate(`/${entityType}/new`);
  };

  const handleBulkShare = (selectedItems: any[]) => {
    console.log(`Bulk share ${entityType}:`, selectedItems.map(i => i.id));
    alert(`Sharing ${selectedItems.length} ${config?.displayName || entityType}${selectedItems.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedItems: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} ${config?.displayName || entityType}${selectedItems.length !== 1 ? 's' : ''}?`)) {
      console.log(`Bulk delete ${entityType}:`, selectedItems.map(i => i.id));
      alert(`Deleted ${selectedItems.length} ${config?.displayName || entityType}${selectedItems.length !== 1 ? 's' : ''}`);

      // Reload data after delete
      if (view !== 'table') {
        loadData();
      }
    }
  };

  const handleCardMove = async (itemId: string, fromColumn: string, toColumn: string) => {
    if (!config?.kanban) return;

    console.log(`Moving ${entityType} ${itemId} from ${fromColumn} to ${toColumn}`);

    // Optimistic update
    setData(prev => prev.map(item =>
      item.id === itemId ? { ...item, [config.kanban!.groupByField]: toColumn } : item
    ));

    // Type-safe API call to update
    try {
      const api = APIFactory.getAPI(entityType);
      await api.update(itemId, { [config.kanban.groupByField]: toColumn });
    } catch (err) {
      console.error(`Failed to update ${entityType}:`, err);
      // Revert optimistic update on error
      loadData();
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

  const renderContent = () => {
    // TABLE VIEW (uses FilteredDataTable)
    if (view === 'table') {
      return (
        <FilteredDataTable
          entityType={entityType}
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
            className="mt-4 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-800"
          >
            Retry
          </button>
        </div>
      );
    }

    // KANBAN VIEW - Settings-driven, no fallbacks
    if (view === 'kanban' && config.kanban) {
      return (
        <div className="bg-dark-100 rounded-lg shadow p-6 h-full overflow-x-auto">
          <KanbanView
            config={config}
            data={data}
            onCardClick={handleRowClick}
            onCardMove={handleCardMove}
            emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
          />
        </div>
      );
    }

    // GRID VIEW
    if (view === 'grid' && config.grid) {
      return (
        <div className="bg-dark-100 rounded-lg shadow p-6">
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
      );
    }

    // CALENDAR VIEW - Person-filterable calendar grid showing all slots (available + booked)
    if (view === 'calendar') {
      return (
        <div className="bg-dark-100 rounded-lg shadow p-6">
          <CalendarView
            config={config}
            data={data}
            onSlotClick={handleRowClick}
            emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
          />
        </div>
      );
    }

    // GRAPH VIEW (DAG visualization for stages/workflows)
    if (view === 'graph') {
      // Transform data to DAGNode format for DAGVisualizer
      const dagNodes = data.map((item: any) => ({
        id: item.stage_id ?? item.level_id ?? item.id ?? 0,
        name: item.stage_name || item.level_name || item.name || String(item.id),
        descr: item.stage_descr || item.level_descr || item.descr,
        entity_name: entityType,
        parent_ids: item.parent_ids ? (Array.isArray(item.parent_ids) ? item.parent_ids : [item.parent_id].filter(Boolean)) : [],
        terminal_flag: item.terminal_flag ?? false
      }));

      return (
        <div className="bg-dark-100 rounded-lg shadow p-6">
          <DAGVisualizer
            nodes={dagNodes}
          />
        </div>
      );
    }

    return null;
  };

  // Get entity icon from centralized icon system
  const EntityIcon = getEntityIcon(entityType);

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
                  className="p-2 rounded-lg text-dark-600 hover:text-dark-600 hover:bg-dark-100 transition-all"
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
 * <Route path="/project" element={<EntityMainPage entityType="project" />} />
 * <Route path="/task" element={<EntityMainPage entityType="task" />} />
 * <Route path="/wiki" element={<EntityMainPage entityType="wiki" />} />
 * <Route path="/artifact" element={<EntityMainPage entityType="artifact" />} />
 * <Route path="/form" element={<EntityMainPage entityType="form" />} />
 * <Route path="/business" element={<EntityMainPage entityType="business" />} />
 * <Route path="/office" element={<EntityMainPage entityType="office" />} />
 * <Route path="/employee" element={<EntityMainPage entityType="employee" />} />
 * <Route path="/role" element={<EntityMainPage entityType="role" />} />
 */
