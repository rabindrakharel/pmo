import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { FilteredDataTable, ViewSwitcher } from '../../components/shared';
import { KanbanBoard, KanbanColumn } from '../../components/shared/ui/KanbanBoard';
import { GridView } from '../../components/shared/ui/GridView';
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig } from '../../lib/entityConfig';
import * as api from '../../lib/api';

/**
 * Universal EntityChildListPage
 *
 * A single, reusable component that renders child entity lists within a parent context.
 * Supports table, kanban, and grid views based on entity configuration.
 *
 * Usage via routing:
 * - /project/:projectId/task -> EntityChildListPage with parentType="project", childType="task"
 * - /project/:projectId/wiki -> EntityChildListPage with parentType="project", childType="wiki"
 * - /business/:bizId/project -> EntityChildListPage with parentType="business", childType="project"
 * etc.
 */

interface EntityChildListPageProps {
  parentType: string;
  childType: string;
}

export function EntityChildListPage({ parentType, childType }: EntityChildListPageProps) {
  const { id: parentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const config = getEntityConfig(childType);
  const parentConfig = getEntityConfig(parentType);
  const [view, setView] = useViewMode(`${parentType}_${childType}`);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentData, setParentData] = useState<any>(null);

  // Fetch parent data for breadcrumb/header
  useEffect(() => {
    if (parentId) {
      loadParentData();
    }
  }, [parentId, parentType]);

  // Fetch child data for kanban and grid views
  useEffect(() => {
    if (view !== 'table' && parentId) {
      loadChildData();
    }
  }, [view, parentId, childType]);

  const loadParentData = async () => {
    try {
      const apiModule = (api as any)[`${parentType}Api`];
      if (apiModule && apiModule.get) {
        const response = await apiModule.get(parentId);
        setParentData(response.data || response);
      }
    } catch (err) {
      console.error(`Failed to load parent ${parentType}:`, err);
    }
  };

  const loadChildData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Dynamic API call for child entities
      const apiModule = (api as any)[`${parentType}Api`];
      if (!apiModule) {
        throw new Error(`API module for ${parentType} not found`);
      }

      // Call parent-specific child endpoint (e.g., projectApi.getTasks(parentId))
      const methodName = `get${childType.charAt(0).toUpperCase() + childType.slice(1)}s`;
      if (apiModule[methodName]) {
        const response = await apiModule[methodName](parentId, { page: 1, pageSize: 100 });
        setData(response.data || []);
      } else {
        // Fallback: use generic child API with parent filter
        const childApiModule = (api as any)[`${childType}Api`];
        if (childApiModule && childApiModule.list) {
          const response = await childApiModule.list({
            page: 1,
            pageSize: 100,
            parentId,
            parentType
          });
          setData(response.data || []);
        }
      }
    } catch (err) {
      console.error(`Failed to load ${childType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item: any) => {
    navigate(`/${childType}/${item.id}`);
  };

  const handleCreateClick = () => {
    navigate(`/${parentType}/${parentId}/${childType}/new`);
  };

  const handleBack = () => {
    navigate(`/${parentType}/${parentId}`);
  };

  const handleBulkShare = (selectedItems: any[]) => {
    console.log(`Bulk share ${childType}:`, selectedItems.map(i => i.id));
    alert(`Sharing ${selectedItems.length} ${config?.displayName || childType}${selectedItems.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedItems: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} ${config?.displayName || childType}${selectedItems.length !== 1 ? 's' : ''}?`)) {
      console.log(`Bulk delete ${childType}:`, selectedItems.map(i => i.id));
      alert(`Deleted ${selectedItems.length} ${config?.displayName || childType}${selectedItems.length !== 1 ? 's' : ''}`);

      // Reload data after delete
      if (view !== 'table') {
        loadChildData();
      }
    }
  };

  const handleCardMove = async (itemId: string, fromColumn: string, toColumn: string) => {
    if (!config?.kanban) return;

    console.log(`Moving ${childType} ${itemId} from ${fromColumn} to ${toColumn}`);

    // Optimistic update
    setData(prev => prev.map(item =>
      item.id === itemId ? { ...item, [config.kanban!.groupByField]: toColumn } : item
    ));

    // TODO: Call API to update
    // const apiModule = (api as any)[`${childType}Api`];
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
      <div className="text-center py-12">
        <p className="text-red-600">Entity configuration not found for: {childType}</p>
      </div>
    );
  }

  const renderContent = () => {
    // TABLE VIEW (uses FilteredDataTable with parent filtering)
    if (view === 'table') {
      return (
        <FilteredDataTable
          entityType={childType}
          parentType={parentType}
          parentId={parentId}
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
            onClick={loadChildData}
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
    <div className="h-full flex flex-col space-y-4">
      {/* Header with View Switcher and Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-sm font-normal text-gray-800">
            {config.pluralName}
          </h2>
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
  );
}

/**
 * Usage Examples:
 *
 * In routes (nested under parent detail route):
 * <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
 *   <Route path="task" element={<EntityChildListPage parentType="project" childType="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage parentType="project" childType="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage parentType="project" childType="artifact" />} />
 *   <Route path="form" element={<EntityChildListPage parentType="project" childType="form" />} />
 * </Route>
 *
 * <Route path="/business/:id" element={<EntityDetailPage entityType="business" />}>
 *   <Route path="project" element={<EntityChildListPage parentType="business" childType="project" />} />
 * </Route>
 */
