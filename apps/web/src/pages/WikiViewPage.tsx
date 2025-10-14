import React, { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { wikiApi } from '../lib/api';

export function WikiViewPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!id) return;
        const res = await wikiApi.get(id);
        setPage(res);
      } catch (e) {
        console.error('Failed to load page', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="p-8">Loading...</div>
      </Layout>
    );
  }

  if (!page) {
    return (
      <Layout>
        <div className="p-8">Page not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Cover */}
        <div className={`h-40 rounded-xl ${
          page.attr?.cover === 'gradient-purple' ? 'bg-gradient-to-r from-purple-600 to-pink-600' :
          page.attr?.cover === 'emerald' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' :
          page.attr?.cover === 'gray' ? 'bg-gray-200' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`} />

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 text-3xl flex items-center justify-center bg-white rounded-lg border">{page.attr?.icon || '📄'}</div>
              <h1 className="text-sm font-normal text-gray-800">{page.name}</h1>
            </div>
            <p className="text-gray-500 text-sm">Updated {new Date(page.updatedTs || page.updated_ts).toLocaleString()}</p>
          </div>
          <div className="space-x-2">
            <button onClick={() => navigate(`/wiki/${id}/edit`)} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-normal rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Edit</button>
            <button onClick={() => navigate('/wiki')} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-normal rounded-lg text-gray-700 bg-white hover:bg-gray-50">Back</button>
          </div>
        </div>

        <article className="bg-white border rounded-lg p-6 prose max-w-none">
          <div dangerouslySetInnerHTML={{ __html: page.content_html || page.contentHtml || '' }} />
        </article>
      </div>
    </Layout>
  );
}
