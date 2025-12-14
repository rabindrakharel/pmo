import { useEffect, useState } from 'react';
import { Layout } from '../../components/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { wikiApi } from '../../lib/api';
import { ArrowLeft, Pencil } from 'lucide-react';

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
        <div className="p-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dark-400" />
        </div>
      </Layout>
    );
  }

  if (!page) {
    return (
      <Layout>
        <div className="p-8 text-center text-dark-400 text-sm">Page not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-6 px-4">
        {/* Minimal Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/wiki')}
            className="flex items-center gap-1.5 text-xs text-dark-500 hover:text-dark-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            onClick={() => navigate(`/wiki/${id}/edit`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-dark-600 hover:bg-dark-100 rounded transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>

        {/* Page Content */}
        <article className="bg-white rounded-lg border border-dark-200 overflow-hidden">
          {/* Title Section */}
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{page.attr?.icon || '📄'}</span>
              <h1 className="text-xl font-semibold text-dark-800">{page.name}</h1>
            </div>
            <p className="text-xs text-dark-400">
              Updated {new Date(page.updatedTs || page.updated_ts).toLocaleDateString()}
            </p>
          </div>

          {/* Content */}
          <div className="px-8 pb-8 prose prose-sm max-w-none prose-headings:text-dark-800 prose-p:text-dark-600 prose-a:text-slate-600">
            <div dangerouslySetInnerHTML={{ __html: page.content_html || page.contentHtml || '' }} />
          </div>
        </article>
      </div>
    </Layout>
  );
}
