import React, { useState, useEffect } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { formApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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

  const tableColumns: Column<Form>[] = [
    {
      key: 'id',
      title: 'Form ID',
      sortable: false,
      filterable: false,
      render: (value) => (
        <code className="text-xs text-gray-600">{String(value).slice(0, 8)}…</code>
      ),
    },
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
      key: 'creator',
      title: 'Creator',
      sortable: false,
      filterable: false,
      render: (_, record) => {
        const creator = (record as any)?.attr?.createdByName || (record as any)?.attr?.createdBy || '-';
        return <span className="text-gray-700">{creator}</span>;
      },
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
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Forms</h1>
              <p className="mt-1 text-gray-600">Manage dynamic forms and data collection templates</p>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/forms/new')}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
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
            onRowClick={(form) => navigate(`/forms/${form.id}`)}
            onView={(form) => navigate(`/forms/${form.id}`)}
            onEdit={(form) => navigate(`/forms/${form.id}/edit`)}
            onShare={(form) => console.log('Share form:', form.id)}
            onDelete={(form) => console.log('Delete form:', form.id)}
          />
        </div>
      </div>
    </Layout>
  );
}
