import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate } from 'react-router-dom';
import { wikiApi } from '../lib/api';
import { DataTable, Column } from '../components/ui/DataTable';
import { Plus } from 'lucide-react';

type Wiki = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  tags?: string[];
  ownerName?: string;
  published?: boolean;
  updated: string;
};

export function WikiPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Wiki[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await wikiApi.list({ page: 1, pageSize: 50 });
        setData(res.data || []);
      } catch (e) {
        console.error('Failed to load wiki', e);
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns: Column<Wiki>[] = [
    { key: 'title', title: 'Title', sortable: true },
    { key: 'slug', title: 'Slug' },
    { key: 'ownerName', title: 'Owner' },
    { key: 'published', title: 'Published', render: (v) => v ? 'Yes' : 'No' },
    { key: 'updated', title: 'Updated' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Wiki</h1>
            <p className="mt-1 text-gray-600">Collaborate on documentation and share knowledge</p>
          </div>
          <button
            onClick={() => navigate('/wiki/new')}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" /> New Page
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{data.length}</div>
            <div className="text-sm text-gray-600">Total Pages</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{data.filter(d => d.published).length}</div>
            <div className="text-sm text-gray-600">Published</div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-2">
          <DataTable
            data={data}
            columns={columns}
            loading={loading}
            onRowClick={(row) => navigate(`/wiki/${row.id}`)}
            onView={(row) => navigate(`/wiki/${row.id}`)}
            onEdit={(row) => navigate(`/wiki/${row.id}/edit`)}
          />
        </div>
      </div>
    </Layout>
  );
}

