import React, { useState, useEffect } from 'react';
import { Database, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { metaApi } from '../lib/api';

interface MetaItem {
  id: string;
  name: string;
  code?: string;
  category: string;
  description?: string;
  sort_order?: number;
  active?: boolean;
  created?: string;
  updated?: string;
}

type MetaCategory = 'task_status' | 'task_stage' | 'project_status' | 'project_stage' | 'biz_level' | 'loc_level' | 'hr_level';

export function MetaPage() {
  const [metaItems, setMetaItems] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MetaCategory>('project_status');

  const categories = [
    { value: 'project_status' as MetaCategory, label: 'Project Status', description: 'Project lifecycle statuses' },
    { value: 'project_stage' as MetaCategory, label: 'Project Stages', description: 'Project workflow stages' },
    { value: 'task_status' as MetaCategory, label: 'Task Status', description: 'Task lifecycle statuses' },
    { value: 'task_stage' as MetaCategory, label: 'Task Stages', description: 'Task workflow stages' },
    { value: 'biz_level' as MetaCategory, label: 'Business Levels', description: 'Organizational hierarchy levels' },
    { value: 'loc_level' as MetaCategory, label: 'Location Levels', description: 'Geographic hierarchy levels' },
    { value: 'hr_level' as MetaCategory, label: 'HR Levels', description: 'Human resources hierarchy levels' },
  ];

  useEffect(() => {
    loadMetaItems();
  }, [selectedCategory]);

  const loadMetaItems = async () => {
    try {
      setLoading(true);
      const response = await metaApi.get(selectedCategory);
      setMetaItems(response.data || []);
    } catch (error) {
      console.error('Failed to load meta items:', error);
      setMetaItems([]);
    } finally {
      setLoading(false);
    }
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

  const getCategoryBadge = (category: string) => {
    const categoryColors: Record<string, string> = {
      'project_status': 'bg-blue-100 text-blue-800',
      'project_stage': 'bg-purple-100 text-purple-800',
      'task_status': 'bg-green-100 text-green-800',
      'task_stage': 'bg-yellow-100 text-yellow-800',
      'biz_level': 'bg-indigo-100 text-indigo-800',
      'loc_level': 'bg-pink-100 text-pink-800',
      'hr_level': 'bg-orange-100 text-orange-800',
    };
    
    const colorClass = categoryColors[category] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {categories.find(c => c.value === category)?.label || category}
      </span>
    );
  };

  const tableColumns: Column<MetaItem>[] = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.code && (
            <div className="text-sm text-gray-500">{record.code}</div>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      title: 'Description',
      sortable: true,
      filterable: true,
      render: (value) => value || '-',
    },
    {
      key: 'category',
      title: 'Category',
      sortable: true,
      filterable: true,
      render: (value) => getCategoryBadge(value),
    },
    {
      key: 'sort_order',
      title: 'Sort Order',
      sortable: true,
      align: 'right',
      render: (value) => value ? value.toString() : '-',
    },
    {
      key: 'active',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
  ];

  const selectedCategoryInfo = categories.find(c => c.value === selectedCategory);

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meta Configuration</h1>
              <p className="mt-1 text-gray-600">Manage system metadata and configuration settings</p>
            </div>
          </div>
          
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Category Selection</h3>
              <p className="text-sm text-gray-600 mt-1">{selectedCategoryInfo?.description}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCategory === category.value
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{metaItems.length}</div>
            <div className="text-sm text-gray-600">Total Items</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {metaItems.filter(item => item.active !== false).length}
            </div>
            <div className="text-sm text-gray-600">Active Items</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {selectedCategoryInfo?.label}
            </div>
            <div className="text-sm text-gray-600">Current Category</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {categories.length}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={metaItems}
            columns={tableColumns}
            loading={loading}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(item) => console.log('Navigate to item:', item.id)}
            onView={(item) => console.log('View item:', item.id)}
            onEdit={(item) => console.log('Edit item:', item.id)}
            onShare={(item) => console.log('Share item:', item.id)}
            onDelete={(item) => console.log('Delete item:', item.id)}
          />
        </div>
      </div>
    </Layout>
  );
}