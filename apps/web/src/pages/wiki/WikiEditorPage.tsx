import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Share2, Link as LinkIcon } from 'lucide-react';
import { WikiDesigner } from '../../components/entity/wiki/WikiDesigner';
import { ShareModal } from '../../components/shared/modal';
import { UnifiedLinkageModal } from '../../components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '../../hooks/useLinkageModal';
import { wikiApi } from '../../lib/api';
import { useSidebar } from '../../contexts/SidebarContext';
import { useNavigationHistory } from '../../contexts/NavigationHistoryContext';

export function WikiEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const { hideSidebar } = useSidebar();
  const { history, goBack, pushEntity, updateCurrentEntityName } = useNavigationHistory();

  // Unified linkage modal
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Optionally refetch wiki data
      console.log('Wiki linkage changed');
    }
  });

  // Hide sidebar when entering wiki editor
  useEffect(() => {
    hideSidebar();
  }, []);

  useEffect(() => {
    if (editing && id) {
      loadPage();
    } else {
      // Create new page object for new wiki pages
      setPage({
        name: '',
        content: { type: 'blocks', blocks: [] },
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
        updatedTs: new Date().toISOString()});
      setLoading(false);
    }
  }, [editing, id]);

  // Register wiki in navigation history when editing
  useEffect(() => {
    if (page && id) {
      pushEntity({
        entityCode: 'wiki',
        entityId: id,
        entityName: page.name || 'Untitled Wiki',
        timestamp: Date.now()
      });
    }
  }, [page, id, pushEntity]);

  // Update entity name in navigation history when it changes
  useEffect(() => {
    if (page && page.name) {
      updateCurrentEntityName(page.name);
    }
  }, [page?.name, updateCurrentEntityName]);

  const loadPage = async () => {
    try {
      setLoading(true);
      setError(null);
      const pageData = await wikiApi.get(id!);

      // Parse content if it's a string
      if (typeof pageData.content === 'string') {
        try {
          pageData.content = JSON.parse(pageData.content);
        } catch (e) {
          console.error('Failed to parse wiki content:', e);
          pageData.content = { type: 'blocks', blocks: [] };
        }
      }

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
        // Update existing page
        const updated = await wikiApi.update(id, pageData);
        // Reload the page data to refresh the preview
        const refreshed = await wikiApi.get(id);

        // Parse content if it's a string
        if (typeof refreshed.content === 'string') {
          try {
            refreshed.content = JSON.parse(refreshed.content);
          } catch (e) {
            console.error('Failed to parse wiki content:', e);
            refreshed.content = { type: 'blocks', blocks: [] };
          }
        }

        setPage(refreshed);
        // Show success toast
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        // Create new page
        const created = await wikiApi.create(pageData);
        // Update URL to edit mode without full navigation
        window.history.replaceState(null, '', `/wiki/${created.id}/edit`);
        // Load the created page data
        const refreshed = await wikiApi.get(created.id);

        // Parse content if it's a string
        if (typeof refreshed.content === 'string') {
          try {
            refreshed.content = JSON.parse(refreshed.content);
          } catch (e) {
            console.error('Failed to parse wiki content:', e);
            refreshed.content = { type: 'blocks', blocks: [] };
          }
        }

        setPage(refreshed);
        // Show success toast
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save wiki page:', err);
      alert(err instanceof Error ? err.message : 'Failed to save page');
      throw err;
    }
  };

  const handleExit = () => {
    setShowExitConfirm(true);
  };

  const handleExitWithoutSaving = () => {
    setShowExitConfirm(false);
    // Use smart back navigation if history exists
    if (history.length > 0) {
      goBack();
    } else {
      navigate('/wiki');
    }
  };

  const handleExitWithSave = async () => {
    try {
      // Get the current page data from WikiDesigner
      // Since we don't have direct access, we'll just navigate back
      // The user can manually save before clicking exit if needed
      setShowExitConfirm(false);
      // Use smart back navigation if history exists
      if (history.length > 0) {
        goBack();
      } else {
        navigate('/wiki');
      }
    } catch (err) {
      console.error('Failed to save and exit:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-700" />
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
            className="px-4 py-2 bg-dark-700 text-white rounded-md hover:bg-dark-800"
          >
            Back to Wiki
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <WikiDesigner
        page={page}
        onSave={handleSave}
        onExit={handleExit}
        actions={id ? [
          {
            id: 'link',
            label: '',
            icon: <LinkIcon className="h-4 w-4" />,
            onClick: () => linkageModal.openAssignParent({
              childEntityType: 'wiki',
              childEntityId: id!,
              childEntityName: page?.name
            }),
            variant: 'secondary' as const},
          {
            id: 'share',
            label: '',
            icon: <Share2 className="h-4 w-4" />,
            onClick: () => setIsShareModalOpen(true),
            variant: 'secondary' as const}] : []}
      />

      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-md shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Wiki page saved successfully!</span>
        </div>
      )}

      {/* Share Modal */}
      {id && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          entityCode="wiki"
          entityId={id}
          entityName={page?.name}
          currentSharedUrl={page?.shared_url}
          onShare={async (shareData) => {
            console.log('Sharing wiki:', shareData);
            // Handle sharing logic
          }}
        />
      )}

      {/* Unified Linkage Modal */}
      <UnifiedLinkageModal {...linkageModal.modalProps} />

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-100 rounded-md shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dark-600 mb-2">
                Exit Wiki Editor?
              </h3>
              <p className="text-sm text-dark-700 mb-6">
                You have unsaved changes. What would you like to do?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleExitWithoutSaving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  Exit Without Saving
                </button>
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 px-4 py-2 bg-dark-200 text-dark-600 rounded-md hover:bg-dark-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
