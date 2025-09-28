import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, Users } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { FilteredDataTable } from '../components/FilteredDataTable';
import { StatsGrid } from '../components/common/StatsGrid';
import { businessApi } from '../lib/api';

interface BusinessUnit {
  id: string;
  name: string;
  descr?: string;
  level_id: number;
  level_name?: string;
  parent_id?: string;
  active?: boolean;
  from_ts?: string;
  to_ts?: string;
  created?: string;
  updated?: string;
}

export function BusinessPage() {
  const navigate = useNavigate();
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
      key: 'level_name',
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
      key: 'level_id',
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

  // Navigation handlers
  const handleRowClick = (unit: BusinessUnit) => {
    navigate(`/biz/${unit.id}`);
  };

  const handleView = (unit: BusinessUnit) => {
    navigate(`/biz/${unit.id}`);
  };

  const handleEdit = (unit: BusinessUnit) => {
    navigate(`/biz/${unit.id}/edit`);
  };

  const handleShare = (unit: BusinessUnit) => {
    console.log('Share business unit:', unit.id);
    // TODO: Implement share functionality
  };

  const handleDelete = async (unit: BusinessUnit) => {
    if (window.confirm(`Are you sure you want to delete "${unit.name}"?`)) {
      try {
        await businessApi.delete(unit.id);
        loadBusinessUnits(); // Reload the list
      } catch (error) {
        console.error('Failed to delete business unit:', error);
        alert('Failed to delete business unit. Please try again.');
      }
    }
  };

  // Bulk action handlers
  const handleBulkShare = (selectedUnits: BusinessUnit[]) => {
    console.log('Bulk share business units:', selectedUnits.map(u => u.id));
    alert(`Sharing ${selectedUnits.length} business unit${selectedUnits.length !== 1 ? 's' : ''}`);
    // TODO: Implement bulk share functionality
  };

  const handleBulkDelete = async (selectedUnits: BusinessUnit[]) => {
    try {
      // Delete business units in parallel
      await Promise.all(selectedUnits.map(unit => businessApi.delete(unit.id)));
      loadBusinessUnits(); // Reload the list
      alert(`Successfully deleted ${selectedUnits.length} business unit${selectedUnits.length !== 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to delete business units:', error);
      alert('Failed to delete some business units. Please try again.');
    }
  };

  const handleCreateClick = () => {
    navigate('/business/new');
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Business Units</h1>
            <p className="mt-1 text-gray-600">Manage organizational structure and business hierarchies</p>
          </div>
        </div>

        <StatsGrid
          stats={[
            {
              value: businessUnits.length,
              label: "Total Units",
              color: "blue",
              icon: Building2
            },
            {
              value: businessUnits.filter(u => u.active !== false).length,
              label: "Active Units",
              color: "green",
              icon: TrendingUp
            },
            {
              value: new Set(businessUnits.map(u => u.level_name).filter(Boolean)).size,
              label: "Hierarchy Levels",
              color: "purple",
              icon: Users
            }
          ]}
        />

        <div className="flex-1 min-h-0">
          <FilteredDataTable
            entityType="biz"
            showActionButtons={true}
            createLabel="Create Business Unit"
            onCreateClick={handleCreateClick}
            onBulkShare={handleBulkShare}
            onBulkDelete={handleBulkDelete}
            onRowClick={handleRowClick}
            // Permission checking removed - handled at API level via RBAC joins
          />
        </div>
      </div>
    </Layout>
  );
}