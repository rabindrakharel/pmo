import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Layers, FolderOpen } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { StatsGrid } from '../components/common/StatsGrid';
import { DataTable, Column } from '../components/ui/DataTable';
import { artifactApi } from '../lib/api';

interface Artifact {
  id: string;
  name: string;
  descr?: string;
  artifact_type: string;
  model_type?: string;
  business_id?: string;
  business_name?: string;
  project_id?: string;
  project_name?: string;
  project_stage?: string | null;
  source_type: string;
  uri?: string;
  attachments?: any[];
  tags?: string[];
  created?: string;
  updated?: string;
  active?: boolean;
}

export function ArtifactsPage() {
  const [rows, setRows] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    loadArtifacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, typeFilter]);

  const loadArtifacts = async () => {
    try {
      setLoading(true);
      const response = await artifactApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
        search: search || undefined,
        artifact_type: typeFilter || undefined,
      });
      setRows(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (e) {
      console.error('Failed to load artifacts:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const byType = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.artifact_type] = (acc[r.artifact_type] || 0) + 1;
      return acc;
    }, {});
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const byStage = rows.reduce<Record<string, number>>((acc, r) => {
      const key = r.project_stage || 'All Stages';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const stages = Object.keys(byStage).length;
    return { total, topType, stages };
  }, [rows]);

  const columns: Column<Artifact>[] = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.descr && (
            <div className="text-sm text-gray-500 truncate max-w-md" title={record.descr}>
              {record.descr}
            </div>
          )}
        </div>
      ),
    },
    { key: 'artifact_type', title: 'Type', sortable: true, filterable: true },
    {
      key: 'project_name',
      title: 'Project',
      sortable: true,
      render: (value, record) => value || '—',
    },
    {
      key: 'business_name',
      title: 'Business',
      sortable: true,
      render: (value) => value || '—',
    },
    {
      key: 'project_stage',
      title: 'Stage',
      sortable: true,
      render: (value) => value || 'All Stages',
    },
    {
      key: 'updated',
      title: 'Updated',
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleString('en-CA') : '—'),
      width: 160,
    },
  ];

  return (
    <Layout createButton={{ label: 'Create Artifact', href: '/artifacts/new' }}>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Artifacts</h1>
            <p className="mt-1 text-gray-600">Project and business knowledge: RFPs, proposals, SOWs, designs, onboarding guides, and models</p>
          </div>
        </div>

        <StatsGrid
          stats={[
            { value: stats.total, label: 'Total Artifacts', color: 'blue', icon: FileText },
            { value: stats.stages, label: 'Project Stages', color: 'purple', icon: Layers },
            { value: rows.filter(r => !!r.project_id).length, label: 'Project-Scoped', color: 'green', icon: FolderOpen },
          ]}
        />

        {/* Simple toolbar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPagination(p => ({ ...p, current: 1 })); void loadArtifacts(); } }}
            placeholder="Search by name or description..."
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="design">Design</option>
            <option value="rfp">RFP</option>
            <option value="proposal">Proposal</option>
            <option value="sow">SOW</option>
            <option value="onboarding">Onboarding</option>
            <option value="model">Model</option>
          </select>
          <button
            onClick={() => { setPagination(p => ({ ...p, current: 1 })); void loadArtifacts(); }}
            className="ml-2 inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Apply
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={rows}
            columns={columns}
            loading={loading}
            pagination={{ ...pagination, onChange: handlePaginationChange }}
            rowKey="id"
            searchable={true}
            filterable={true}
            columnSelection={true}
            onRowClick={(row) => console.log('Open artifact', row.id)}
            onView={(row) => console.log('View artifact', row.id)}
            onEdit={(row) => console.log('Edit artifact', row.id)}
            onShare={(row) => console.log('Share artifact', row.id)}
            onDelete={async (row) => { try { await artifactApi.delete(row.id); await loadArtifacts(); } catch (e) { console.error(e); } }}
          />
        </div>
      </div>
    </Layout>
  );
}

export default ArtifactsPage;

