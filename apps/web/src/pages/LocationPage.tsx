import React, { useState, useEffect } from 'react';
import { MapPin, TrendingUp, Building2 } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatsGrid } from '../components/common/StatsGrid';
import { locationApi } from '../lib/api';

interface Location {
  id: string;
  name: string;
  descr?: string;
  addr?: string;
  levelId: number;
  levelName?: string;
  parentId?: string;
  active?: boolean;
  fromTs?: string;
  toTs?: string;
  created?: string;
  updated?: string;
}

export function LocationPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadLocations();
  }, [pagination.current, pagination.pageSize]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await locationApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setLocations(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load locations:', error);
      setLocations([]);
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
      'Country': 'bg-blue-100 text-blue-800',
      'Province': 'bg-purple-100 text-purple-800',
      'City': 'bg-green-100 text-green-800',
      'District': 'bg-yellow-100 text-yellow-800',
    };
    
    const colorClass = levelColors[level] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {level}
      </span>
    );
  };

  const tableColumns: Column<Location>[] = [
    {
      key: 'name',
      title: 'Location Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.addr && (
            <div className="text-sm text-gray-500 truncate max-w-xs" title={record.addr}>
              {record.addr}
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
      key: 'active',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'worksite_count',
      title: 'Worksites',
      sortable: true,
      align: 'right',
      render: (value) => value ? value.toString() : '0',
    },
    {
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
  ];

  return (
    <Layout createButton={{ label: "Create Location", href: "/location/new" }}>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Locations</h1>
            <p className="mt-1 text-gray-600">Manage geographic locations and regional hierarchies</p>
          </div>
        </div>

        <StatsGrid 
          stats={[
            {
              value: locations.length,
              label: "Total Locations",
              color: "blue",
              icon: MapPin
            },
            {
              value: locations.filter(l => l.active !== false).length,
              label: "Active Locations",
              color: "green",
              icon: TrendingUp
            },
            {
              value: locations.filter(l => l.levelName === 'City').length,
              label: "Cities",
              color: "purple",
              icon: Building2
            }
          ]}
        />

        <div className="flex-1 min-h-0">
          <DataTable
            data={locations}
            columns={tableColumns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(location) => console.log('Navigate to location:', location.id)}
            onView={(location) => console.log('View location:', location.id)}
            onEdit={(location) => console.log('Edit location:', location.id)}
            onShare={(location) => console.log('Share location:', location.id)}
            onDelete={(location) => console.log('Delete location:', location.id)}
          />
        </div>
      </div>
    </Layout>
  );
}