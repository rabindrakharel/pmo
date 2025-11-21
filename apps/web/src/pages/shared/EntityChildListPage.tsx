import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { FilteredDataTable, ViewSwitcher } from '../../components/shared';
import { KanbanView } from '../../components/shared/ui/KanbanView';
import { GridView } from '../../components/shared/ui/GridView';
import { useViewMode } from '../../lib/hooks/useViewMode';
import { getEntityConfig } from '../../lib/entityConfig';
import { APIFactory } from '../../lib/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
  childType?: string; // Now optional, can be read from URL params
}

export function EntityChildListPage({ parentType, childType: propChildType }: EntityChildListPageProps) {
  const { id: parentId, childType: urlChildType } = useParams<{ id: string; childType?: string }>();
  const navigate = useNavigate();

  // Use childType from URL params if provided, otherwise fall back to prop
  const childType = urlChildType || propChildType;

  if (!childType) {
    throw new Error('childType must be provided either as prop or URL parameter');
  }

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
      // Type-safe API call using APIFactory
      const api = APIFactory.getAPI(parentType);
      const response = await api.get(parentId!);
      setParentData(response.data || response);
    } catch (err) {
      console.error(`Failed to load parent ${parentType}:`, err);
    }
  };

  const loadChildData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Type-safe API call using APIFactory
      const parentApi = APIFactory.getAPI(parentType);

      // Call parent-specific child endpoint (e.g., projectApi.getTasks(parentId))
      const methodName = `get${childType.charAt(0).toUpperCase() + childType.slice(1)}s`;
      if ((parentApi as any)[methodName]) {
        const response = await (parentApi as any)[methodName](parentId, { page: 1, pageSize: 100 });
        setData(response.data || []);
      } else {
        // Fallback: use generic child API with parent filter
        const childApi = APIFactory.getAPI(childType);
        const response = await childApi.list({
          page: 1,
          pageSize: 100,
          parentId,
          parentType
        });
        setData(response.data || []);
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

  /**
   * Create-then-link-then-redirect workflow (Using Existing APIs)
   *
   * Step 1: Create minimal child entity using existing universal create endpoint
   * Step 2: Create parent-child linkage using existing linkage API
   * Step 3: Redirect to entity edit page (special edit pages for form/wiki, detail page for others)
   */
  const handleCreateClick = async () => {
    // Entities that require file uploads should go to dedicated create page
    const requiresFullCreatePage = ['artifact', 'cost', 'revenue'];

    if (requiresFullCreatePage.includes(childType)) {
      // Navigate to full create page with parent context in state
      navigate(`/${childType}/new`, {
        state: {
          parentType,
          parentId,
          returnTo: `/${parentType}/${parentId}/${childType}`
        }
      });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      // STEP 1: Create child entity with minimal/empty data
      // User will fill in all fields on the edit page
      const timestamp = Date.now();

      let createPayload: any;

      // Entity-specific minimal payloads
      if (childType === 'form') {
        createPayload = {
          name: 'Untitled Form',
          descr: '',
          form_type: 'multi_step',
          form_schema: { steps: [] },
          approval_status: 'draft'
        };
      } else if (childType === 'wiki') {
        createPayload = {
          name: 'Untitled Wiki Page',
          descr: '',
          content_md: '',
          publication_status: 'draft'
        };
      } else {
        // Standard entities
        createPayload = {
          name: 'Untitled',  // Minimal placeholder - user will replace on edit page
          code: `${childType.toUpperCase()}-${timestamp}`,  // Auto-generated unique code
          descr: '',  // Empty - user will provide
          metadata: {}
        };
      }

      const createResponse = await fetch(
        `${API_BASE_URL}/api/v1/${childType}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(createPayload)
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create entity');
      }

      const newEntity = await createResponse.json();
      const newEntityId = newEntity.id;

      // STEP 2: Create parent-child linkage
      const linkageResponse = await fetch(
        `${API_BASE_URL}/api/v1/linkage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            parent_entity_type: parentType,
            parent_entity_id: parentId,
            child_entity_type: childType,
            child_entity_id: newEntityId,
            relationship_type: 'contains'
          })
        }
      );

      if (!linkageResponse.ok) {
        console.error('Linkage creation failed, but entity created');
        // Don't throw - entity is created, linkage can be fixed later
      } else {
        console.log(`✅ Created and linked ${childType} to ${parentType}`);
      }

      // STEP 3: Redirect to appropriate edit/detail page
      if (childType === 'form') {
        // Form: Navigate to form edit page (FormEditPage)
        navigate(`/form/${newEntityId}/edit`);
      } else if (childType === 'wiki') {
        // Wiki: Navigate to wiki edit page (WikiEditorPage)
        navigate(`/wiki/${newEntityId}/edit`);
      } else {
        // Standard entities: Navigate to detail page with auto-edit mode enabled
        navigate(`/${childType}/${newEntityId}`, { state: { autoEdit: true } });
      }

    } catch (err) {
      console.error(`Failed to create ${childType}:`, err);
      alert(err instanceof Error ? err.message : `Failed to create ${childType}`);
    } finally {
      setLoading(false);
    }
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

    // Type-safe API call to update
    try {
      const api = APIFactory.getAPI(childType);
      await api.update(itemId, { [config.kanban.groupByField]: toColumn });
    } catch (err) {
      console.error(`Failed to update ${childType}:`, err);
      // Revert optimistic update on error
      loadChildData();
    }
  };

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
          entityCode={childType}
          parentType={parentType}
          parentId={parentId}
          showActionButtons={false}
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
            onClick={loadChildData}
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
        <div className="bg-dark-100 rounded-md shadow p-6 h-full overflow-x-auto">
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
      );
    }

    return null;
  };

  return (
    <>
      <div className="h-full flex flex-col space-y-4">
        {/* Header with View Switcher and Create Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-sm font-normal text-dark-600">
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
              disabled={loading}
              className="inline-flex items-center px-3 py-1.5 border border-dark-400 text-sm font-normal rounded text-dark-600 bg-dark-100 hover:bg-dark-100 hover:border-dark-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 mr-2 stroke-[1.5]" />
              {loading ? 'Creating...' : `Create ${config.displayName}`}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </>
  );
}

/**
 * Usage Examples:
 *
 * In routes (nested under parent detail route):
 * <Route path="/project/:id" element={<EntitySpecificInstancePage entityCode="project" />}>
 *   <Route path="task" element={<EntityChildListPage parentType="project" childType="task" />} />
 *   <Route path="wiki" element={<EntityChildListPage parentType="project" childType="wiki" />} />
 *   <Route path="artifact" element={<EntityChildListPage parentType="project" childType="artifact" />} />
 *   <Route path="form" element={<EntityChildListPage parentType="project" childType="form" />} />
 * </Route>
 *
 * <Route path="/business/:id" element={<EntitySpecificInstancePage entityCode="business" />}>
 *   <Route path="project" element={<EntityChildListPage parentType="business" childType="project" />} />
 * </Route>
 */
