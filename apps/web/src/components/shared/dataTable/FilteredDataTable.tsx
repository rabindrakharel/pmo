import React, { useState, useEffect, useMemo } from 'react';
import { EntityDataTable } from '../ui/EntityDataTable';
import { SettingsDataTable } from '../ui/SettingsDataTable';
import type { Column, RowAction } from '../ui/EntityDataTable';
import { useNavigate } from 'react-router-dom';
import { ActionButtonsBar } from '../button/ActionButtonsBar';
import { getEntityConfig, type EntityConfig } from '../../../lib/entityConfig';
import { transformForApi, transformFromApi } from '../../../lib/data_transform_render';
import { COLOR_OPTIONS } from '../../../lib/settingsConfig';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

  // Check if this is a settings entity
  const isSettingsEntity = useMemo(() => {
    return config?.apiEndpoint?.includes('/api/v1/setting?datalabel=') || false;
  }, [config]);

  // Use columns directly from config, and add parent ID column if applicable
  const columns: Column[] = useMemo(() => {
    if (!config) return [];

    const baseColumns = config.columns as Column[];

    // Add parent ID column when viewing child entities
    if (parentType && parentId) {
      const parentDisplayName = parentType.charAt(0).toUpperCase() + parentType.slice(1);

      const parentIdColumn: Column = {
        key: 'parent_id',
        title: `Parent (${parentDisplayName})`,
        sortable: false,
        filterable: false,
        align: 'left',
        width: '200px',
        render: () => (
          <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {parentId.substring(0, 8)}...
          </span>
        )
      };

      // Add parent ID column as the first column
      return [parentIdColumn, ...baseColumns];
    }

    return baseColumns;
  }, [config, parentType, parentId]);

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
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Build the API endpoint based on filtering
      let endpoint: string;

      if (parentType && parentId) {
        // Use filtered endpoint for parent-child relationships
        endpoint = `/api/v1/${parentType}/${parentId}/${entityType}`;
      } else {
        // Use regular list endpoint
        endpoint = config.apiEndpoint;
      }

      // Properly handle query parameters
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await fetch(
        `${API_BASE_URL}${endpoint}${separator}page=${currentPage}&limit=${pageSize}`,
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
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Check if this is a new row (temporary ID or _isNew flag)
      const isNewRow = isAddingRow || record.id.toString().startsWith('temp_') || record._isNew;

      // Transform edited data for API (tags string → array, etc.)
      const transformedData = transformForApi(editedData, record);

      // Add parent entity relationship if viewing child entities
      if (parentType && parentId && isNewRow) {
        transformedData.parent_type = parentType;
        transformedData.parent_id = parentId;
      }

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

        response = await fetch(`${API_BASE_URL}${createEndpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(transformedData)
        });
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

        response = await fetch(`${API_BASE_URL}${updateEndpoint}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(transformedData)
        });
      }

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${isNewRow ? 'Created' : 'Updated'} ${entityType}:`, result);

        // Reload data
        await fetchData();

        // Clear edit state
        setEditingRow(null);
        setEditedData({});
        setIsAddingRow(false);
      } else {
        const errorText = await response.text();
        console.error(`Failed to ${isNewRow ? 'create' : 'update'} record:`, response.statusText, errorText);
        alert(`Failed to ${isNewRow ? 'create' : 'update'} record: ${response.statusText}`);
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
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

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
        `${API_BASE_URL}${deleteEndpoint}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (response.ok) {
        await fetchData();
      } else {
        console.error('Failed to delete record:', response.statusText);
        alert('Failed to delete record. Please try again.');
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
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      const updateEndpoint = `/api/v1/setting/${datalabel}/${id}`;

      const response = await fetch(`${API_BASE_URL}${updateEndpoint}`, {
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
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      const deleteEndpoint = `/api/v1/setting/${datalabel}/${id}`;

      const response = await fetch(`${API_BASE_URL}${deleteEndpoint}`, {
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
        'Content-Type': 'application/json',
      };

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

        const response = await fetch(`${API_BASE_URL}${updateEndpoint}`, {
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
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Extract datalabel from endpoint
      const datalabelMatch = config.apiEndpoint.match(/datalabel=([^&]+)/);
      const datalabel = datalabelMatch ? datalabelMatch[1] : entityType;

      const createEndpoint = `/api/v1/setting/${datalabel}`;

      const response = await fetch(`${API_BASE_URL}${createEndpoint}`, {
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
    if (isAddingRow) {
      await handleSaveNewRow();
    } else {
      await handleSaveInlineEdit(record);
    }
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
    onChange: handlePageChange,
  };

  // Handle missing config
  if (!config) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-sm font-normal text-gray-900 mb-2">Configuration Error</h3>
          <p className="text-sm text-gray-600 mb-4">Entity configuration not found for: {entityType}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full">
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
            selectable={showActionButtons && (!!onBulkDelete || !!onBulkShare)}
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