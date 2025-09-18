import React, { useState, useEffect } from 'react';
import { FileText, Eye, Edit } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatsGrid } from '../components/common/StatsGrid';
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

export function FormPage() {
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
    <Layout createButton={{ label: "Create Form", href: "/form/new" }}>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Forms</h1>
            <p className="mt-1 text-gray-600">Manage dynamic forms and data collection templates</p>
          </div>
        </div>

        <StatsGrid 
          stats={[
            {
              value: forms.length,
              label: "Total Forms",
              color: "blue",
              icon: FileText
            },
            {
              value: forms.filter(f => f.active !== false).length,
              label: "Active Forms",
              color: "green",
              icon: Eye
            },
            {
              value: forms.filter(f => f.formGlobalLink).length,
              label: "Public Forms",
              color: "purple",
              icon: Edit
            }
          ]}
        />

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
            onRowClick={(form) => navigate(`/form/${form.id}`)}
            onView={(form) => navigate(`/form/${form.id}`)}
            onEdit={(form) => navigate(`/form/${form.id}/edit`)}
            onShare={(form) => console.log('Share form:', form.id)}
            onDelete={(form) => console.log('Delete form:', form.id)}
          />
        </div>
      </div>
    </Layout>
  );
}
