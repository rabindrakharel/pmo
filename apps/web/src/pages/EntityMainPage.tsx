import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';
import { KanbanBoard, KanbanColumn } from '../components/ui/KanbanBoard';
import { GridView } from '../components/ui/GridView';
import { ViewSwitcher } from '../components/common/ViewSwitcher';
import { useViewMode } from '../lib/hooks/useViewMode';
import { getEntityConfig, ViewMode } from '../lib/entityConfig';
import * as api from '../lib/api';

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

      // Dynamic API call based on entity type
      const apiModule = (api as any)[`${entityType}Api`];
      if (!apiModule || !apiModule.list) {
        throw new Error(`API module for ${entityType} not found`);
      }

      const response = await apiModule.list({ page: 1, pageSize: 100 });
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

    // TODO: Call API to update
    // const apiModule = (api as any)[`${entityType}Api`];
    // await apiModule.update(itemId, { [config.kanban.groupByField]: toColumn });
  };

  // Prepare Kanban columns (if kanban view is supported)
  const kanbanColumns: KanbanColumn[] = React.useMemo(() => {
    if (!config?.kanban) return [];

    const groupField = config.kanban.groupByField;

    // Get unique values for the group field
    const uniqueValues = [...new Set(data.map(item => item[groupField]))].filter(Boolean);

    // Define common kanban stages if not in data
    const commonStages = [
      { id: 'Backlog', title: 'Backlog', color: '#6B7280' },
      { id: 'To Do', title: 'To Do', color: '#3B82F6' },
      { id: 'In Progress', title: 'In Progress', color: '#F59E0B' },
      { id: 'In Review', title: 'In Review', color: '#8B5CF6' },
      { id: 'Done', title: 'Done', color: '#10B981' },
      { id: 'Blocked', title: 'Blocked', color: '#EF4444' }
    ];

    // Use data values or fall back to common stages
    const stages = uniqueValues.length > 0
      ? uniqueValues.map(val => ({ id: val as string, title: val as string }))
      : commonStages;

    return stages.map(stage => ({
      id: stage.id,
      title: stage.title,
      color: (stage as any).color,
      items: data.filter(item => item[groupField] === stage.id)
    }));
  }, [data, config]);

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

    // KANBAN VIEW
    if (view === 'kanban' && config.kanban) {
      return (
        <div className="bg-white rounded-lg shadow p-6 h-full overflow-x-auto">
          <KanbanBoard
            columns={kanbanColumns}
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

    return null;
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 w-[97%] max-w-[1536px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-normal">
                {config.displayName.charAt(0)}
              </span>
            </div>
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
