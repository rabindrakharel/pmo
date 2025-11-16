import React, { useState, useEffect, useMemo } from 'react';
import { EntityDataTable } from '../ui/EntityDataTable';
import { SettingsDataTable } from '../ui/SettingsDataTable';
import type { Column, RowAction } from '../ui/EntityDataTable';
import { useNavigate } from 'react-router-dom';
import { ActionButtonsBar } from '../button/ActionButtonsBar';
import { getEntityConfig, type EntityConfig } from '../../../lib/entityConfig';
import { transformForApi, transformFromApi, formatFieldValue, renderFieldDisplay } from '../../../lib/universalFormatterService';
import { useColumnVisibility } from '../../../lib/hooks/useColumnVisibility';
import { useEntitySchema } from '../../../lib/hooks/useEntitySchema';
import type { SchemaColumn } from '../../../lib/types/table';
import { SchemaErrorFallback } from '../error/SchemaErrorBoundary';
import { TableSkeleton } from '../ui/TableSkeleton';
import { API_CONFIG, API_ENDPOINTS } from '../../../lib/config/api';

export interface FilteredDataTableProps {
  entityType: string;
  parentType?: string;
  parentId?: string;
  onRowClick?: (record: any) => void;

  // Action buttons functionality
  showActionButtons?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  createHref?: string;
  onBulkShare?: (selectedItems: any[]) => void;
  onBulkDelete?: (selectedItems: any[]) => void;

  // Inline editing and action icon controls
  inlineEditable?: boolean;
  showEditIcon?: boolean;
  showDeleteIcon?: boolean;
  showActionIcons?: boolean;

  // Inline row addition support
  allowAddRow?: boolean;
}

export const FilteredDataTable: React.FC<FilteredDataTableProps> = ({
  entityType,
  parentType,
  parentId,
  onRowClick,
  showActionButtons = false,
  createLabel,
  onCreateClick,
  createHref,
  onBulkShare,
  onBulkDelete,
  inlineEditable = false,
  showEditIcon = true,
  showDeleteIcon = true,
  showActionIcons = true,
  allowAddRow = true
}) => {
  const navigate = useNavigate();
  const config = getEntityConfig(entityType);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<any>({});
  const [isAddingRow, setIsAddingRow] = useState(false);

  // Fetch schema from API (independent of data)
  const { schema, loading: schemaLoading, error: schemaError } = useEntitySchema(entityType);

  // Check if this is a settings entity
  const isSettingsEntity = useMemo(() => {
    return config?.apiEndpoint?.includes('/api/v1/setting?datalabel=') || false;
  }, [config]);

  // Get columns from schema or config
  const configuredColumns: Column[] = useMemo(() => {
    if (!config) return [];

    // Priority 1: Explicit config columns (for custom overrides)
    if (config.columns && config.columns.length > 0) {
      return config.columns as Column[];
    }

    // Priority 2: API schema (default - database-driven, works with empty tables)
    if (schema && schema.columns) {
      return schema.columns.map((col: SchemaColumn) => ({
        key: col.key,
        title: col.title,
        visible: col.visible,
        sortable: col.sortable,
        filterable: col.filterable,
        width: col.width,
        align: col.align,
        editable: col.editable,
        editType: col.editType as any,
        loadOptionsFromSettings: col.dataSource?.type === 'settings',

        // Schema-driven formatting - use renderFieldDisplay for React elements (badges, etc.)
        render: (value: any) => renderFieldDisplay(value, col.format)
      })) as Column[];
    }

    return [];
  }, [config, schema]);

  // Use column visibility hook for dynamic column management
  const {
    visibleColumns,
    allColumns,
    toggleColumn,
    showAllColumns,
    hideAllColumns,
    isColumnVisible,
    resetToDefault
  } = useColumnVisibility(entityType, configuredColumns, data);

  // Use visible columns for rendering
  const columns: Column[] = visibleColumns;

  // Define row actions based on props
  const rowActions: RowAction[] = useMemo(() => {
    if (!config || !showActionIcons) return [];

    const actions: RowAction[] = [];

    // NOTE: View icon removed - row clicks already navigate to detail view

    // Show edit icon based on prop
    if (showEditIcon) {
      actions.push({
        key: 'edit',
        label: 'Edit',
        icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        variant: 'default',
        onClick: (record) => handleAction('edit', record)
      });
    }

    // Show delete icon based on prop
    if (showDeleteIcon) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
        variant: 'danger',
        onClick: (record) => {
          if (window.confirm('Are you sure you want to delete this record?')) {
            handleDelete(record);
          }
        }
      });
    }

    return actions;
  }, [config, showActionIcons, showEditIcon, showDeleteIcon, inlineEditable, isSettingsEntity]);

  const fetchData = async () => {
    if (!config) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Build the API endpoint - always use main entity endpoint (create-link-edit pattern)
      const endpoint = config.apiEndpoint;

      // Properly handle query parameters
      const separator = endpoint.includes('?') ? '&' : '?';

      // Build query params with parent filtering support
      let queryParams = `page=${currentPage}&limit=${pageSize}`;

      // Add parent filtering via query params (create-link-edit pattern)
      if (parentType && parentId) {
        queryParams += `&parent_type=${parentType}&parent_id=${parentId}`;
      }

      // For person-calendar, only show booked events (availability_flag = false)
      if (entityType === 'person-calendar') {
        queryParams += '&availability_flag=false';
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}${endpoint}${separator}${queryParams}`,
        { headers }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result.data || result || []);
        setTotalRecords(result.total || result.length || 0);
      } else {
        console.error('Failed to fetch data:', response.statusText);
        setData([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (actionType: string, record: any) => {
    switch (actionType) {
      case 'edit':
        if (inlineEditable) {
          // Enable inline editing mode
          setEditingRow(record.id);
          // Transform data from API format for editing (arrays → comma-separated strings)
          setEditedData(transformFromApi({ ...record }));
        } else {
          // Navigate to edit page
          navigate(`/${entityType}/${record.id}/edit`);
        }
        break;
      case 'delete':
        // This is already handled in rowActions onClick
        break;
      case 'view':
        handleRowClick(record);
        break;
      default:
        console.log(`Action ${actionType} clicked for record:`, record);
    }
  };

  const handleInlineEdit = (rowId: string, field: string, value: any) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveInlineEdit = async (record: any) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Check if this is a new row (temporary ID or _isNew flag)
      const isNewRow = isAddingRow || record.id.toString().startsWith('temp_') || record._isNew;

      // Transform edited data for API (tags string → array, etc.)
      const transformedData = transformForApi(editedData, record);

      // Don't send parent fields in entity creation payload
      // We'll create linkage separately for proper architecture
      delete transformedData.parent_type;
      delete transformedData.parent_id;

      // Remove temporary fields
      delete transformedData._isNew;
      if (isNewRow) {
        delete transformedData.id; // Let backend generate real ID
      }

      let response;

      if (isNewRow) {
        // POST - Create new entity
        console.log(`Creating new ${entityType}:`, transformedData);

        let createEndpoint = '';
        if (isSettingsEntity) {
          // Extract the datalabel from the apiEndpoint
          const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
          const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;
          createEndpoint = `/api/v1/setting/${datalabel}`;
        } else {
          createEndpoint = config.apiEndpoint;
        }

        response = await fetch(`${API_CONFIG.BASE_URL}${createEndpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(transformedData)
        });

        if (response.ok) {
          const result = await response.json();
          const newEntityId = result.id;
          console.log(`✅ Created ${entityType}:`, result);

          // STEP 2: Create parent-child linkage if in child context
          if (parentType && parentId && newEntityId) {
            console.log(`🔗 Creating linkage: ${parentType}/${parentId} → ${entityType}/${newEntityId}`);

            const linkageResponse = await fetch(`${API_BASE_URL}/api/v1/linkage`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                parent_entity_type: parentType,
                parent_entity_id: parentId,
                child_entity_type: entityType,
                child_entity_id: newEntityId,
                relationship_type: 'contains'
              })
            });

            if (linkageResponse.ok) {
              const linkageResult = await linkageResponse.json();
              console.log(`✅ Created linkage in d_entity_id_map:`, linkageResult.data);

              // Verify linkage was created
              if (!linkageResult.data || !linkageResult.data.id) {
                console.error('⚠️ Linkage response missing data!');
                alert(`Warning: ${entityType} created but linkage may have failed. Please check the relationship manually.`);
              }
            } else {
              const errorText = await linkageResponse.text();
              console.error('❌ Failed to create linkage:', linkageResponse.statusText, errorText);

              // Alert user but don't fail - entity is created
              alert(`Warning: ${entityType} created successfully, but failed to link to ${parentType}.\n\nYou may need to manually link this ${entityType} or contact support.\n\nError: ${linkageResponse.statusText}`);
            }
          }

          // Reload data to show the newly created entity
          await fetchData();

          // Clear edit state
          setEditingRow(null);
          setEditedData({});
          setIsAddingRow(false);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to create ${entityType}:`, response.statusText, errorText);
          alert(`Failed to create ${entityType}: ${response.statusText}`);
        }
      } else {
        // PUT - Update existing entity
        console.log(`Updating ${entityType}:`, transformedData);

        let updateEndpoint = '';
        if (isSettingsEntity) {
          const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
          const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;
          updateEndpoint = `/api/v1/setting/${datalabel}/${record.id}`;
        } else {
          updateEndpoint = `${config.apiEndpoint}/${record.id}`;
        }

        response = await fetch(`${API_CONFIG.BASE_URL}${updateEndpoint}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(transformedData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Updated ${entityType}:`, result);

          // Reload data
          await fetchData();

          // Clear edit state
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
  };

  const handleCancelInlineEdit = () => {
    // If canceling a new row, remove it from data
    if (isAddingRow && editingRow) {
      setData(data.filter(row => row.id !== editingRow));
      setIsAddingRow(false);
    }

    setEditingRow(null);
    setEditedData({});
  };

  const handleDelete = async (record: any) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Note: DELETE requests don't have a body, so no Content-Type header needed

      // Build the correct API endpoint
      let deleteEndpoint = '';

      // Check if this is a settings entity with datalabel query parameter
      if (config.apiEndpoint.includes('/api/v1/setting?datalabel=')) {
        // Extract the datalabel from the apiEndpoint
        const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
        const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

        // Settings API uses: DELETE /api/v1/setting/{datalabel}/{id}
        deleteEndpoint = `/api/v1/setting/${datalabel}/${record.id}`;
      } else {
        // Regular entities use: DELETE /api/v1/{entity}/{id}
        deleteEndpoint = `${config.apiEndpoint}/${record.id}`;
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}${deleteEndpoint}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (response.ok) {
        // Force reload data after successful delete
        await fetchData();
        console.log('✅ Record deleted successfully');
      } else {
        const errorText = await response.text();
        console.error('Failed to delete record:', response.statusText, errorText);
        alert(`Failed to delete record: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('An error occurred while deleting. Please try again.');
    }
  };

  const handleRowClick = (record: any) => {
    if (onRowClick) {
      onRowClick(record);
    } else {
      // Default navigation based on entity type
      const entityPath = entityType === 'biz' ? '/biz' : `/${entityType}`;
      const targetPath = `${entityPath}/${record.id}`;
      navigate(targetPath);
    }
  };

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleBulkShare = () => {
    if (onBulkShare) {
      const selectedItems = data.filter((item) =>
        selectedRows.includes(item.id)
      );
      onBulkShare(selectedItems);
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) {
      const selectedItems = data.filter((item) =>
        selectedRows.includes(item.id)
      );
      onBulkDelete(selectedItems);
      setSelectedRows([]); // Clear selection after delete
    }
  };

  // Handle adding a new row for settings entities
  const handleAddRow = () => {
    if (!isSettingsEntity) return;

    // Find the next available ID
    const maxId = data.length > 0 ? Math.max(...data.map((d: any) => parseInt(d.id) || 0)) : -1;
    const newId = (maxId + 1).toString();

    // Create a new empty row
    const newRow = {
      id: newId,
      name: '',
      descr: '',
      parent_id: null,
      color_code: 'gray' // Default color
    };

    // Add to data and start editing
    setData([...data, newRow]);
    setEditingRow(newId);
    setEditedData(newRow);
    setIsAddingRow(true);
  };

  // Handle add row - adds empty row inline and enters edit mode
  const handleAddEntityRow = (newRow: any) => {
    // Add to data array
    setData([...data, newRow]);

    // Enter edit mode for this row immediately
    setEditingRow(newRow.id);
    setEditedData(newRow);
    setIsAddingRow(true);
  };

  // ========================================================================
  // SETTINGS DATA TABLE HANDLERS
  // ========================================================================

  // Handle settings row update (bulk update for all fields)
  const handleSettingsRowUpdate = async (id: string | number, updates: Partial<any>) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      const updateEndpoint = `/api/v1/setting/${datalabel}/${id}`;

      const response = await fetch(`${API_CONFIG.BASE_URL}${updateEndpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update setting:', errorText);
        throw new Error(`Failed to update: ${errorText}`);
      }

      // Refresh data from server
      await fetchData();
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('An error occurred while saving. Please try again.');
    }
  };

  // Handle settings add row
  const handleSettingsAddRow = (newRow: any) => {
    // Add to data array immediately for optimistic UI
    setData([...data, newRow]);
  };

  // Handle settings delete row
  const handleSettingsDeleteRow = async (id: string | number) => {
    if (!config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      const deleteEndpoint = `/api/v1/setting/${datalabel}/${id}`;

      const response = await fetch(`${API_CONFIG.BASE_URL}${deleteEndpoint}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to delete setting:', errorText);
        throw new Error(`Failed to delete: ${errorText}`);
      }

      // Refresh data from server
      await fetchData();
    } catch (error) {
      console.error('Error deleting setting:', error);
      alert('An error occurred while deleting. Please try again.');
    }
  };

  // Handle row reordering for settings entities
  const handleReorder = async (newData: any[]) => {
    if (!isSettingsEntity || !config) return;

    // Recalculate IDs based on new positions
    const reorderedData = newData.map((item, index) => ({
      ...item,
      id: index.toString()
    }));

    // Update local state immediately
    setData(reorderedData);

    // Send updates to API for each changed item
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      // CRITICAL: Update sequentially (not parallel) to avoid race conditions
      for (let newIndex = 0; newIndex < reorderedData.length; newIndex++) {
        const item = reorderedData[newIndex];
        const updateEndpoint = `/api/v1/setting/${datalabel}/${newIndex}`;

        const response = await fetch(`${API_CONFIG.BASE_URL}${updateEndpoint}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(item)  // item already has the correct new id from the map above
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to update setting at position ${newIndex}:`, errorText);
          throw new Error(`Failed to update item at position ${newIndex}: ${errorText}`);
        }
      }

      // Refresh data from server
      await fetchData();
    } catch (error) {
      console.error('Error reordering rows:', error);
      alert('An error occurred while reordering. Please try again.');
      // Revert to original data
      await fetchData();
    }
  };

  // Save new row to API
  const handleSaveNewRow = async () => {
    if (!isSettingsEntity || !config) return;

    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      const createEndpoint = `/api/v1/setting/${datalabel}`;

      const response = await fetch(`${API_CONFIG.BASE_URL}${createEndpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(editedData)
      });

      if (response.ok) {
        await fetchData();
        setEditingRow(null);
        setEditedData({});
        setIsAddingRow(false);
      } else {
        const errorText = await response.text();
        console.error('Failed to create record:', response.statusText, errorText);
        alert(`Failed to create record: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating record:', error);
      alert('An error occurred while creating. Please try again.');
    }
  };

  // Override save handler for new rows
  const handleSaveInlineEditWrapper = async (record: any) => {
    // handleSaveInlineEdit already handles both new and existing rows
    // It detects new rows via isAddingRow, temp_ prefix, or _isNew flag
    await handleSaveInlineEdit(record);
  };

  // Override cancel handler for new rows
  const handleCancelInlineEditWrapper = () => {
    if (isAddingRow) {
      // Remove the new row from data
      setData(data.filter((item: any) => item.id !== editingRow));
      setIsAddingRow(false);
    }
    handleCancelInlineEdit();
  };

  useEffect(() => {
    if (config) {
      fetchData();
    }
  }, [currentPage, pageSize, config, parentType, parentId]);

  const pagination = {
    current: currentPage,
    pageSize,
    total: totalRecords,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    onChange: handlePageChange};

  // Handle missing config
  if (!config) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-sm font-normal text-dark-600 mb-2">Configuration Error</h3>
          <p className="text-sm text-dark-700 mb-4">Entity configuration not found for: {entityType}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (schemaError) {
    return (
      <SchemaErrorFallback
        error={schemaError}
        entityType={entityType}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Show loading skeleton while schema is loading
  if (schemaLoading && !schema) {
    return <TableSkeleton rows={5} columns={6} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with action buttons and column selector */}
      <div className="flex items-center justify-between px-6 pt-4">
        {/* Action buttons bar - only show if action buttons are enabled */}
        {showActionButtons && (
          <ActionButtonsBar
            createLabel={createLabel}
            onCreateClick={onCreateClick}
            createHref={createHref}
            selectedCount={selectedRows.length}
            onBulkShare={onBulkShare ? handleBulkShare : undefined}
            onBulkDelete={onBulkDelete ? handleBulkDelete : undefined}
            entityType={entityType}
          />
        )}
      </div>

      {/* Data table wrapper - provides padding and flex-1 to fill available space */}
      <div className="flex-1 p-6">
        {/* Render specialized SettingsDataTable for settings entities */}
        {isSettingsEntity ? (
          <SettingsDataTable
            data={data}
            onRowUpdate={handleSettingsRowUpdate}
            onAddRow={handleSettingsAddRow}
            onDeleteRow={handleSettingsDeleteRow}
            onReorder={handleReorder}
            allowAddRow={true}
            allowEdit={true}
            allowDelete={true}
            allowReorder={true}
          />
        ) : (
          /* Render regular EntityDataTable for regular entities */
          <EntityDataTable
            data={data}
            columns={columns}
            loading={loading}
            pagination={pagination}
            searchable={true}
            filterable={true}
            columnSelection={true}
            rowActions={rowActions}
            onRowClick={handleRowClick}
            className=""
            selectable={!!(onBulkDelete || onBulkShare)}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            inlineEditable={inlineEditable}
            editingRow={editingRow}
            editedData={editedData}
            onInlineEdit={handleInlineEdit}
            onSaveInlineEdit={handleSaveInlineEditWrapper}
            onCancelInlineEdit={handleCancelInlineEditWrapper}
            allowAddRow={allowAddRow}
            onAddRow={handleAddEntityRow}
          />
        )}
      </div>
    </div>
  );
};

export default FilteredDataTable;