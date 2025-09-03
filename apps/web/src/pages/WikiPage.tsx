import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate } from 'react-router-dom';
import { wikiApi } from '../lib/api';
import { DataTable, Column } from '../components/ui/DataTable';
import { Plus, BookOpen, Users, FileText, Eye, Calendar } from 'lucide-react';

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
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadWikiPages();
  }, [pagination.current, pagination.pageSize]);

  const loadWikiPages = async () => {
    try {
      setLoading(true);
      const res = await wikiApi.list({ 
        page: pagination.current, 
        pageSize: pagination.pageSize 
      });
      setData(res.data || []);
      setPagination(prev => ({ ...prev, total: res.total || 0 }));
    } catch (e) {
      console.error('Failed to load wiki', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPublishedBadge = (published?: boolean) => {
    if (published === undefined) return null;
    
    return published ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Eye className="h-3 w-3 mr-1" />
        Published
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Draft
      </span>
    );
  };

  const getTagsBadges = (tags?: string[]) => {
    if (!tags || tags.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 2).map((tag, index) => (
          <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {tag}
          </span>
        ))}
        {tags.length > 2 && (
          <span className="text-xs text-gray-500">+{tags.length - 2} more</span>
        )}
      </div>
    );
  };

  const columns: Column<Wiki>[] = [
    {
      key: 'title',
      title: 'Page Title',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.summary && (
            <div className="text-sm text-gray-500 truncate max-w-xs">{record.summary}</div>
          )}
        </div>
      ),
    },
    {
      key: 'published',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getPublishedBadge(value),
    },
    {
      key: 'tags',
      title: 'Tags',
      render: (value) => getTagsBadges(value),
    },
    {
      key: 'ownerName',
      title: 'Author',
      sortable: true,
      filterable: true,
      render: (value) => (
        <div className="flex items-center">
          <Users className="h-4 w-4 text-gray-400 mr-2" />
          {value || 'Unknown'}
        </div>
      ),
    },
    {
      key: 'updated',
      title: 'Last Updated',
      sortable: true,
      render: (value) => (
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-1" />
          {formatDate(value)}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Wiki</h1>
              <p className="mt-1 text-gray-600">Collaborate on documentation and share knowledge</p>
            </div>
          </div>
          
          <button 
            onClick={() => navigate('/wiki/new')}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{data.length}</div>
            <div className="text-sm text-gray-600">Total Pages</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.filter(d => d.published).length}
            </div>
            <div className="text-sm text-gray-600">Published Pages</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {data.filter(d => !d.published).length}
            </div>
            <div className="text-sm text-gray-600">Draft Pages</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {data.reduce((acc, d) => acc + (d.tags?.length || 0), 0)}
            </div>
            <div className="text-sm text-gray-600">Total Tags</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={data}
            columns={columns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            onRowClick={(row) => navigate(`/wiki/${row.id}`)}
            onView={(row) => navigate(`/wiki/${row.id}`)}
            onEdit={(row) => navigate(`/wiki/${row.id}/edit`)}
            onShare={(row) => console.log('Share wiki page:', row.id)}
            onDelete={(row) => console.log('Delete wiki page:', row.id)}
          />
        </div>
      </div>
    </Layout>
  );
}

