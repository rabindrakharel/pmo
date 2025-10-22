import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WikiDesigner } from '../../components/entity/wiki/WikiDesigner';
import { wikiApi } from '../../lib/api';

export function WikiEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing && id) {
      loadPage();
    } else {
      // Create new page object for new wiki pages
      setPage({
        name: '',
        slug: '',
        content: { type: 'blocks', blocks: [] },
        tags: [],
        metadata: {
          attr: {
            icon: '📄',
            cover: 'gradient-blue',
            path: '/wiki'
          }
        },
        publication_status: 'draft',
        visibility: 'internal',
        wiki_type: 'page',
        createdTs: new Date().toISOString(),
        updatedTs: new Date().toISOString(),
      });
      setLoading(false);
    }
  }, [editing, id]);

  const loadPage = async () => {
    try {
      setLoading(true);
      setError(null);
      const pageData = await wikiApi.get(id!);
      setPage(pageData);
    } catch (err) {
      console.error('Failed to load wiki page:', err);
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (pageData: any) => {
    try {
      if (editing && id) {
        await wikiApi.update(id, pageData);
        navigate(`/wiki/${id}`);
      } else {
        const created = await wikiApi.create(pageData);
        navigate(`/wiki/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to save wiki page:', err);
      alert(err instanceof Error ? err.message : 'Failed to save page');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Page not found'}</p>
          <button
            onClick={() => navigate('/wiki')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Wiki
          </button>
        </div>
      </div>
    );
  }

  return <WikiDesigner page={page} onSave={handleSave} />;
}
