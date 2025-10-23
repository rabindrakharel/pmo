import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Layout, FilteredDataTable, ViewSwitcher } from '../../components/shared';
import { KanbanView } from '../../components/shared/ui/KanbanView';
import { GridView } from '../../components/shared/ui/GridView';
import { SequentialStateVisualizer } from '../../components/shared/entity/SequentialStateVisualizer';
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig, ViewMode } from '../../lib/entityConfig';
import { getEntityIcon } from '../../lib/entityIcons';
import { APIFactory } from '../../lib/api';

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
      const response = await api.list({ page: 1, pageSize: 100 });
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
    navigate(`/${entityType}/${item.id}`);
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
          onBulkShare={handleBulkShare}
          onBulkDelete={handleBulkDelete}
          onRowClick={handleRowClick}
        />
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      );
    }

    // KANBAN VIEW - Settings-driven, no fallbacks
    if (view === 'kanban' && config.kanban) {
      return (
        <div className="bg-white rounded-lg shadow p-6 h-full overflow-x-auto">
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
        <div className="bg-white rounded-lg shadow p-6">
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

    // GRAPH VIEW (RAG timeline visualization)
    if (view === 'graph') {
      // Transform data to StateOption format for SequentialStateVisualizer
      const states = data.map((item: any) => ({
        value: item.stage_name || item.level_name || item.name || String(item.stage_id || item.level_id || item.id),
        label: item.stage_name || item.level_name || item.name || String(item.stage_id || item.level_id || item.id),
        sort_order: item.sort_order,
        metadata: {
          level_id: item.stage_id ?? item.level_id ?? item.id,
          descr: item.stage_descr || item.level_descr || item.descr,
          sort_order: item.sort_order,
          color_code: item.color_code,
          active_flag: item.active_flag,
          parent_id: item.parent_id
        }
      }));

      return (
        <div className="bg-white rounded-lg shadow p-6">
          <SequentialStateVisualizer
            states={states}
            currentState={null}
            mode="horizontal"
            editable={false}
            className="w-full"
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
      <div className="h-full flex flex-col space-y-4 w-[97%] max-w-[1536px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <EntityIcon className="h-5 w-5 text-gray-600 stroke-[1.5]" />
            <div>
              <h1 className="text-sm font-normal text-gray-800">{config.pluralName}</h1>
              <p className="mt-1 text-sm text-gray-500">
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
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2 stroke-[1.5]" />
              Create {config.displayName}
            </button>
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
