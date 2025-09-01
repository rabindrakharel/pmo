import React, { useState, useEffect } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { formApi } from '../lib/api';

interface Form {
  id: string;
  name: string;
  descr?: string;
  formGlobalLink?: string;
  projectSpecific?: boolean;
  taskSpecific?: boolean;
  locationSpecific?: boolean;
  businessSpecific?: boolean;
  hrSpecific?: boolean;
  worksiteSpecific?: boolean;
  version?: number;
  active?: boolean;
  fromTs?: string;
  toTs?: string;
  created?: string;
  updated?: string;
  tags?: string[];
  schema?: any;
  attr?: any;
}

export function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadForms();
  }, [pagination.current, pagination.pageSize]);

  const loadForms = async () => {
    try {
      setLoading(true);
      const response = await formApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setForms(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load forms:', error);
      setForms([]);
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

  const getScopeChips = (form: Form) => {
    const scopes = [];
    if (form.projectSpecific) scopes.push('Project');
    if (form.taskSpecific) scopes.push('Task');
    if (form.locationSpecific) scopes.push('Location');
    if (form.businessSpecific) scopes.push('Business');
    if (form.hrSpecific) scopes.push('HR');
    if (form.worksiteSpecific) scopes.push('Worksite');

    if (scopes.length === 0) return <span className="text-gray-400">Global</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {scopes.slice(0, 2).map(scope => (
          <span
            key={scope}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
          >
            {scope}
          </span>
        ))}
        {scopes.length > 2 && (
          <span className="text-xs text-gray-500">+{scopes.length - 2} more</span>
        )}
      </div>
    );
  };

  const getVersionBadge = (version?: number) => {
    if (!version) return null;
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        v{version}
      </span>
    );
  };

  const tableColumns: Column<Form>[] = [
    {
      key: 'name',
      title: 'Form Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.descr && (
            <div className="text-sm text-gray-500 truncate max-w-xs" title={record.descr}>
              {record.descr}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'version',
      title: 'Version',
      sortable: true,
      align: 'center',
      render: (value) => getVersionBadge(value),
    },
    {
      key: 'scope',
      title: 'Scope',
      sortable: false,
      filterable: false,
      render: (_, record) => getScopeChips(record),
    },
    {
      key: 'formGlobalLink',
      title: 'Public Link',
      sortable: false,
      filterable: false,
      render: (value) => value ? (
        <div className="flex items-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Available
          </span>
        </div>
      ) : (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Private
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
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
    {
      key: 'updated',
      title: 'Updated',
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
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Forms</h1>
              <p className="mt-1 text-gray-600">Manage dynamic forms and data collection templates</p>
            </div>
          </div>
          
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            New Form
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{forms.length}</div>
            <div className="text-sm text-gray-600">Total Forms</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {forms.filter(f => f.active !== false).length}
            </div>
            <div className="text-sm text-gray-600">Active Forms</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {forms.filter(f => f.formGlobalLink).length}
            </div>
            <div className="text-sm text-gray-600">Public Forms</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {forms.filter(f => f.projectSpecific || f.taskSpecific).length}
            </div>
            <div className="text-sm text-gray-600">Project/Task Forms</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={forms}
            columns={tableColumns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(form) => console.log('Navigate to form:', form.id)}
            onView={(form) => console.log('View form:', form.id)}
            onEdit={(form) => console.log('Edit form:', form.id)}
            onShare={(form) => console.log('Share form:', form.id)}
            onDelete={(form) => console.log('Delete form:', form.id)}
          />
        </div>
      </div>
    </Layout>
  );
}