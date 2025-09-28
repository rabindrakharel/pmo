import React, { useState, useEffect, useMemo } from 'react';
import { DataTable } from './ui/DataTable';
import type { Column, RowAction } from './ui/DataTable';
import type { FrontendEntityConfig } from '../types/config';
import { configService } from '../services/configService';
import { useNavigate } from 'react-router-dom';
import { ActionButtonsBar } from './common/ActionButtonsBar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface FilteredDataTableProps {
  entityType: string;
  parentEntity?: string;
  parentEntityId?: string;
  onRowClick?: (record: any) => void;

  // Action buttons functionality
  showActionButtons?: boolean;
  createLabel?: string;
  onCreateClick?: () => void;
  createHref?: string;
  onBulkShare?: (selectedItems: any[]) => void;
  onBulkDelete?: (selectedItems: any[]) => void;
}

export const FilteredDataTable: React.FC<FilteredDataTableProps> = ({
  entityType,
  parentEntity,
  parentEntityId,
  onRowClick,
  showActionButtons = false,
  createLabel,
  onCreateClick,
  createHref,
  onBulkShare,
  onBulkDelete
}) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<FrontendEntityConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Load entity configuration
  useEffect(() => {
    let isMounted = true;

    const loadConfig = async () => {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const entityConfig = await configService.getEntityConfig(entityType);
        
        if (isMounted) {
          setConfig(entityConfig);
          setPageSize(entityConfig.ui.table.defaultPageSize || 20);
        }
      } catch (error) {
        if (isMounted) {
          setConfigError(error instanceof Error ? error.message : 'Failed to load configuration');
        }
      } finally {
        if (isMounted) {
          setConfigLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [entityType]);

  const columns: Column[] = useMemo(() => {
    if (!config) return [];
    
    return Object.entries(config.fields)
      .filter(([_, fieldConfig]) => fieldConfig.uiBehavior.visible)
      .sort((a, b) => (a[1].uiBehavior.priority || 999) - (b[1].uiBehavior.priority || 999))
      .map(([_, fieldConfig]) => {
        const column: Column = {
          key: fieldConfig.apiField,
          title: fieldConfig.label,
          sortable: fieldConfig.uiBehavior.sort || false,
          filterable: fieldConfig.uiBehavior.filter || false,
          width: fieldConfig.uiBehavior.width,
          align: (fieldConfig.uiBehavior.align as 'left' | 'center' | 'right') || 'left',
        };

        if (fieldConfig.uiBehavior.renderAs) {
          column.render = (value: any) => {
            switch (fieldConfig.uiBehavior.renderAs) {
              case 'boolean':
                return (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {value ? 'Active' : 'Inactive'}
                  </span>
                );
              case 'currency':
                return new Intl.NumberFormat('en-CA', {
                  style: 'currency',
                  currency: 'CAD'
                }).format(value || 0);
              case 'badge':
                if (fieldConfig.apiField === 'color') {
                  return (
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: value || '#gray' }}
                      />
                      <span className="text-sm">{value}</span>
                    </div>
                  );
                }
                return (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {value}
                  </span>
                );
              default:
                return value?.toString() || '—';
            }
          };
        }

        return column;
      });
  }, [config]);

  const rowActions: RowAction[] = useMemo(() => {
    if (!config) return [];
    
    const actions: RowAction[] = [];
    
    if (config.actions.row) {
      config.actions.row.forEach(action => {
        let icon: React.ReactNode;
        
        switch (action.icon) {
          case 'edit':
            icon = <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
            break;
          case 'trash':
            icon = <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
            break;
          case 'eye':
            icon = <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
            break;
          default:
            icon = <span>•</span>;
        }

        actions.push({
          key: action.key,
          label: action.label,
          icon,
          variant: action.style === 'danger' ? 'danger' : action.style === 'primary' ? 'primary' : 'default',
          onClick: (record) => handleAction(action.action, record),
        });
      });
    }
    
    return actions;
  }, [config]);

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
      
      if (parentEntity && parentEntityId) {
        // Use filtered endpoint for parent-child relationships
        endpoint = `/api/v1/${parentEntity}/${parentEntityId}/${entityType}`;
      } else {
        // Use regular list endpoint
        const listEndpoint = config.api.endpoints.list.replace(/^GET\s+/, '');
        endpoint = listEndpoint;
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
        console.log('Edit record:', record);
        break;
      case 'delete':
        if (window.confirm('Are you sure you want to delete this record?')) {
          handleDelete(record);
        }
        break;
      case 'view':
        handleRowClick(record);
        break;
      default:
        console.log(`Action ${actionType} clicked for record:`, record);
    }
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

      const deleteEndpoint = config.api.endpoints.delete.replace(/^DELETE\s+/, '');
      const response = await fetch(
        `${API_BASE_URL}${deleteEndpoint.replace(':id', record.id)}`,
        {
          method: 'DELETE',
          headers
        }
      );
      
      if (response.ok) {
        await fetchData();
      } else {
        console.error('Failed to delete record:', response.statusText);
      }
    } catch (error) {
      console.error('Error deleting record:', error);
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
        selectedRows.includes(item.id || item[config?.primaryKey || 'id'])
      );
      onBulkShare(selectedItems);
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) {
      const selectedItems = data.filter((item) =>
        selectedRows.includes(item.id || item[config?.primaryKey || 'id'])
      );
      onBulkDelete(selectedItems);
      setSelectedRows([]); // Clear selection after delete
    }
  };

  useEffect(() => {
    if (config && !configLoading) {
      fetchData();
    }
  }, [currentPage, pageSize, config, parentEntity, parentEntityId]);

  const pagination = {
    current: currentPage,
    pageSize,
    total: totalRecords,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    onChange: handlePageChange,
  };

  // Handle loading state
  if (configLoading) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (configError) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration Error</h3>
          <p className="text-gray-600 mb-4">{configError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Handle missing config
  if (!config) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">📄</div>
          <p className="text-gray-600">No configuration available</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col bg-white rounded-lg shadow">
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

      {/* Data table */}
      <div className="flex-1 p-6">
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          pagination={pagination}
          searchable={config.ui.table.enableSearch}
          filterable={config.ui.table.enableFilters}
          columnSelection={true}
          rowActions={rowActions}
          onRowClick={handleRowClick}
          className="h-full"
          selectable={showActionButtons}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          // Permission checking removed - handled at API level via RBAC joins
        />
      </div>
    </div>
  );
};

export default FilteredDataTable;