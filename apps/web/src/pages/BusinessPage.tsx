import React, { useState, useEffect } from 'react';
import { Building2, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { businessApi } from '../lib/api';

interface BusinessUnit {
  id: string;
  name: string;
  descr?: string;
  levelId: number;
  levelName?: string;
  parentId?: string;
  active?: boolean;
  fromTs?: string;
  toTs?: string;
  created?: string;
  updated?: string;
}

export function BusinessPage() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadBusinessUnits();
  }, [pagination.current, pagination.pageSize]);

  const loadBusinessUnits = async () => {
    try {
      setLoading(true);
      const response = await businessApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setBusinessUnits(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load business units:', error);
      setBusinessUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const getStatusBadge = (active?: boolean) => {
    const isActive = active !== false;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getLevelBadge = (level?: string) => {
    if (!level) return null;
    
    const levelColors: Record<string, string> = {
      'Corporation': 'bg-blue-100 text-blue-800',
      'Division': 'bg-purple-100 text-purple-800',
      'Department': 'bg-green-100 text-green-800',
      'Team': 'bg-yellow-100 text-yellow-800',
    };
    
    const colorClass = levelColors[level] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {level}
      </span>
    );
  };

  const tableColumns: Column<BusinessUnit>[] = [
    {
      key: 'name',
      title: 'Business Unit Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.descr && (
            <div className="text-sm text-gray-500 truncate max-w-xs" title={record.descr}>
              {record.descr.substring(0, 60)}...
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'levelName',
      title: 'Level',
      sortable: true,
      filterable: true,
      render: (value) => getLevelBadge(value),
    },
    {
      key: 'descr',
      title: 'Description',
      sortable: true,
      filterable: true,
      render: (value) => value ? (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      ) : '-',
    },
    {
      key: 'active',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'levelId',
      title: 'Level ID',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {value}
        </span>
      ),
    },
    {
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
  ];

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Units</h1>
              <p className="mt-1 text-gray-600">Manage organizational structure and business hierarchies</p>
            </div>
          </div>
          
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            New Business Unit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{businessUnits.length}</div>
            <div className="text-sm text-gray-600">Total Units</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {businessUnits.filter(u => u.active !== false).length}
            </div>
            <div className="text-sm text-gray-600">Active Units</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(businessUnits.map(u => u.levelName).filter(Boolean)).size}
            </div>
            <div className="text-sm text-gray-600">Hierarchy Levels</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {Math.max(...businessUnits.map(u => u.levelId), 0)}
            </div>
            <div className="text-sm text-gray-600">Max Level Depth</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={businessUnits}
            columns={tableColumns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(unit) => console.log('Navigate to unit:', unit.id)}
            onView={(unit) => console.log('View unit:', unit.id)}
            onEdit={(unit) => console.log('Edit unit:', unit.id)}
            onShare={(unit) => console.log('Share unit:', unit.id)}
            onDelete={(unit) => console.log('Delete unit:', unit.id)}
          />
        </div>
      </div>
    </Layout>
  );
}