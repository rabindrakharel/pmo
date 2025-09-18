import React, { useState, useEffect } from 'react';
import { DataTable } from './ui/DataTable';
import type { Column, RowAction } from './ui/DataTable';
import { entityService, ENTITY_TYPES, STANDARD_COLUMNS, EntityType } from '../services/entityService';
import { useNavigate } from 'react-router-dom';

export interface SimpleDataTableProps {
  entityType: EntityType;
  onRowClick?: (record: any) => void;
}

export const SimpleDataTable: React.FC<SimpleDataTableProps> = ({ 
  entityType, 
  onRowClick 
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  const entityMeta = entityService.getEntityMetadata(entityType);

  const columns: Column[] = STANDARD_COLUMNS.map(col => ({
    ...col,
    render: col.render || ((value: any) => value?.toString() || '—'),
  }));

  const rowActions: RowAction[] = [
    {
      key: 'edit',
      label: 'Edit',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      variant: 'default' as const,
      onClick: (record) => {
        console.log('Edit record:', record);
        // TODO: Navigate to edit page
      },
    },
    {
      key: 'view',
      label: 'View',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      variant: 'primary' as const,
      onClick: handleRowClick,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      variant: 'danger' as const,
      onClick: (record) => {
        if (window.confirm('Are you sure you want to delete this record?')) {
          handleDelete(record);
        }
      },
    },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const result = await entityService.listEntities(entityType, {
        active: true,
        limit: pageSize,
        offset,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      
      setData(result.data || []);
      setTotalRecords(result.total || 0);
    } catch (error) {
      console.error(`Error fetching ${entityType} data:`, error);
      setData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record: any) => {
    try {
      await entityService.deleteEntity(entityType, record.id);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error(`Error deleting ${entityType}:`, error);
      alert(`Failed to delete ${entityType}: ${error}`);
    }
  };

  function handleRowClick(record: any) {
    if (onRowClick) {
      onRowClick(record);
    } else {
      // Default navigation based on entity type
      const entityPath = entityType === 'biz' ? '/biz' : `/${entityType}`;
      navigate(`${entityPath}/${record.id}`);
    }
  }

  const handlePageChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, entityType]);

  const pagination = {
    current: currentPage,
    pageSize,
    total: totalRecords,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    onChange: handlePageChange,
  };

  return (
    <div className="flex-1 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {entityMeta.displayName} Management
        </h2>
        <p className="text-sm text-gray-600">
          Category: {entityMeta.category}
        </p>
      </div>
      
      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        pagination={pagination}
        searchable={true}
        filterable={true}
        columnSelection={true}
        rowActions={rowActions}
        onRowClick={handleRowClick}
        className="h-full"
      />
    </div>
  );
};

export default SimpleDataTable;