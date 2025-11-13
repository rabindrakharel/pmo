import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Save, BookOpen, Plus, LogOut } from 'lucide-react';
import { produce } from 'immer';
import { UniversalDesigner, DesignerAction } from '../../shared/designer';
import { WikiBlockToolbar } from './designer/WikiBlockToolbar';
import { WikiDraggableBlock } from './designer/WikiDraggableBlock';
import { WikiPropertiesPanel } from './designer/WikiPropertiesPanel';
import { WikiPreviewPanel } from './designer/WikiPreviewPanel';
import { WikiHeaderEditor } from './designer/WikiHeaderEditor';
import { CollaborativePresence, CollaborativeCursor } from './CollaborativePresence';
import { useCollaborativeWiki } from '../../../hooks/useCollaborativeWiki';

export interface WikiBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'image' | 'video' | 'callout' | 'divider' | 'table';
  content?: string;
  level?: number; // For headings (1-6) and lists (bulleted/numbered)
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

export interface WikiPage {
  id?: string;
  name: string;
  content?: {
    type: 'blocks';
    blocks: WikiBlock[];
  };
  metadata?: {
    attr?: {
      icon?: string;
      cover?: string;
      path?: string;
    };
  };
  publication_status?: string;
  visibility?: string;
  wiki_type?: string;
  createdTs?: string;
  updatedTs?: string;
}

export interface WikiDesignerProps {
  page: WikiPage;
  onSave: (pageData: Partial<WikiPage>) => Promise<void>;
  onExit?: () => void;
  actions?: DesignerAction[];
}

export function WikiDesigner({ page, onSave, onExit, actions = [] }: WikiDesignerProps) {
  // Page state
  const [blocks, setBlocks] = useState<WikiBlock[]>(page.content?.blocks || []);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'preview' | 'code'>('design');
  const [isSaving, setIsSaving] = useState(false);

  // Metadata state
  const [title, setTitle] = useState(page.name || '');
  const [pagePath, setPagePath] = useState<string>(page.metadata?.attr?.path || '/wiki');
  const [icon] = useState<string>(page.metadata?.attr?.icon || '📄');
  const [cover] = useState<string>(page.metadata?.attr?.cover || '');
  const [author] = useState<string>('Current User');
  const [createdDate] = useState<string>(page.createdTs || new Date().toISOString());
  const [updatedDate, setUpdatedDate] = useState<string>(page.updatedTs || new Date().toISOString());

  // Collaborative editing
  const token = localStorage.getItem('auth_token') || '';
  const collab = useCollaborativeWiki({
    wikiId: page.id || '',
    token,
    enabled: Boolean(page.id),
    onSyncStatusChange: (status) => {
      console.log('Collab sync status:', status);
    }});

  // Sync local blocks with collaborative blocks
  useEffect(() => {
    if (collab.isConnected && collab.blocks.length > 0) {
      setBlocks(collab.blocks);
    }
  }, [collab.blocks, collab.isConnected]);

  // Sync state when page prop changes (after save/reload)
  useEffect(() => {
    if (page.content?.blocks) {
      setBlocks(page.content.blocks);
    }
    if (page.name !== undefined) setTitle(page.name);
    if (page.metadata?.attr?.path !== undefined) setPagePath(page.metadata.attr.path);
    if (page.updatedTs !== undefined) setUpdatedDate(page.updatedTs);
  }, [page]);

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates})
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const updatedBlocks = produce(blocks, (draft) => {
        const oldIndex = draft.findIndex((b) => b.id === active.id);
        const newIndex = draft.findIndex((b) => b.id === over.id);
        return arrayMove(draft, oldIndex, newIndex);
      });
      setBlocks(updatedBlocks);

      // Sync with Y.js if connected
      if (collab.isConnected) {
        collab.updateBlocks(updatedBlocks);
      }

      setUpdatedDate(new Date().toISOString());
    }
  }, [blocks, collab]);

  // Block operations
  const handleAddBlock = useCallback((type: WikiBlock['type'], level?: number) => {
    const newBlock: WikiBlock = {
      id: `block-${Date.now()}`,
      type,
      content: type === 'heading' ? 'Heading' : type === 'paragraph' ? 'Start typing...' : type === 'quote' ? 'Quote' : type === 'code' ? '// Code' : type === 'callout' ? 'Important note' : type === 'list' ? '' : '',
      level: type === 'heading' ? (level || 1) : type === 'list' ? (level || 1) : undefined,
      styles: {},
      properties: type === 'image' ? { src: '', alt: '' } : type === 'video' ? { src: '' } : type === 'table' ? { rows: 3, cols: 3 } : type === 'list' ? { items: [''] } : {}};

    const updatedBlocks = [...blocks, newBlock];
    setBlocks(updatedBlocks);

    // Sync with Y.js if connected
    if (collab.isConnected) {
      collab.updateBlocks(updatedBlocks);
    }

    setSelectedBlockId(newBlock.id);
    setUpdatedDate(new Date().toISOString());
  }, [blocks, collab]);

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<WikiBlock>) => {
    const updatedBlocks = produce(blocks, (draft) => {
      const block = draft.find((b) => b.id === blockId);
      if (block) {
        Object.assign(block, updates);
      }
    });
    setBlocks(updatedBlocks);

    // Sync with Y.js if connected
    if (collab.isConnected) {
      collab.updateBlocks(updatedBlocks);
    }

    setUpdatedDate(new Date().toISOString());
  }, [blocks, collab]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    const updatedBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(updatedBlocks);

    // Sync with Y.js if connected
    if (collab.isConnected) {
      collab.updateBlocks(updatedBlocks);
    }

    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    setUpdatedDate(new Date().toISOString());
  }, [blocks, selectedBlockId, collab]);

  const handleDuplicateBlock = useCallback((blockId: string) => {
    const updatedBlocks = produce(blocks, (draft) => {
      const block = draft.find((b) => b.id === blockId);
      if (block) {
        const newBlock = { ...block, id: `block-${Date.now()}` };
        const index = draft.findIndex((b) => b.id === blockId);
        draft.splice(index + 1, 0, newBlock);
      }
    });
    setBlocks(updatedBlocks);

    // Sync with Y.js if connected
    if (collab.isConnected) {
      collab.updateBlocks(updatedBlocks);
    }

    setUpdatedDate(new Date().toISOString());
  }, [blocks, collab]);

  // Save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Generate HTML from blocks for preview/rendering
      const contentHtml = blocks.map(block => {
        switch (block.type) {
          case 'heading':
            return `<h${block.level || 1}>${block.content || ''}</h${block.level || 1}>`;
          case 'paragraph':
            return `<p>${block.content || ''}</p>`;
          case 'quote':
            return `<blockquote>${block.content || ''}</blockquote>`;
          case 'code':
            return `<pre><code>${block.content || ''}</code></pre>`;
          case 'list': {
            const tag = block.level === 1 ? 'ul' : 'ol';
            const items = block.properties?.items || [block.content || ''];
            const listItems = items.map(item => `<li>${item || ''}</li>`).join('');
            return `<${tag}>${listItems}</${tag}>`;
          }
          case 'image':
            return `<img src="${block.properties?.src || ''}" alt="${block.properties?.alt || ''}" />`;
          case 'video':
            return `<iframe src="${block.properties?.src || ''}" frameborder="0" allowfullscreen></iframe>`;
          case 'callout':
            return `<div class="callout">${block.content || ''}</div>`;
          case 'divider':
            return `<hr />`;
          case 'table':
            return `<table><tr><td>${block.content || ''}</td></tr></table>`;
          default:
            return `<p>${block.content || ''}</p>`;
        }
      }).join('\n');

      const pageData: Partial<WikiPage> = {
        name: title,
        content: { type: 'blocks', blocks },
        content_html: contentHtml,
        metadata: {
          attr: {
            path: pagePath
          }
        },
        publication_status: page.publication_status || 'draft',
        visibility: page.visibility || 'internal',
        wiki_type: page.wiki_type || 'page'};

      await onSave(pageData);
    } catch (error) {
      console.error('Failed to save wiki page:', error);
      alert('Failed to save wiki page. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  // Render canvas
  const renderCanvas = () => {
    if (viewMode === 'preview') {
      return (
        <WikiPreviewPanel
          blocks={blocks}
          title={title}
          metadata={{
            author,
            createdDate,
            updatedDate}}
        />
      );
    }

    if (viewMode === 'code') {
      return (
        <div className="space-y-4">
          <div className="bg-dark-900 text-gray-100 rounded-md p-6 overflow-x-auto">
            <div className="mb-4 text-sm text-dark-600 font-mono">Content Schema:</div>
            <pre className="text-sm">
              <code>{JSON.stringify({ blocks }, null, 2)}</code>
            </pre>
          </div>
          <div className="bg-dark-900 text-gray-100 rounded-md p-6 overflow-x-auto">
            <div className="mb-4 text-sm text-dark-600 font-mono">Page Metadata:</div>
            <pre className="text-sm">
              <code>
                {JSON.stringify(
                  {
                    title,
                    icon,
                    cover,
                    path: pagePath,
                    author,
                    createdDate,
                    updatedDate},
                  null,
                  2
                )}
              </code>
            </pre>
          </div>
        </div>
      );
    }

    // Design mode
    return (
      <div className="max-w-5xl mx-auto bg-dark-100 rounded-md shadow-sm overflow-hidden">
        {/* Simple Title Section */}
        <div className="px-16 pt-12 pb-6 border-b border-dark-300">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setUpdatedDate(new Date().toISOString());
            }}
            placeholder="Untitled Page"
            className="w-full text-4xl font-bold text-dark-600 bg-transparent border-none outline-none placeholder-gray-300"
          />
          <div className="flex items-center gap-4 mt-4 text-sm text-dark-700">
            <span>Author: {author}</span>
            <span>•</span>
            <span>Updated {new Date(updatedDate).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Content Blocks Section */}
        <div className="px-16 py-8 min-h-[400px]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.length === 0 ? (
                <div className="text-center py-20 text-dark-600">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Start building your wiki page</p>
                  <p className="text-sm mt-2">Add blocks from the left sidebar</p>
                </div>
              ) : (
                blocks.map((block) => (
                  <div key={block.id} className="relative">
                    <WikiDraggableBlock
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onDuplicate={() => handleDuplicateBlock(block.id)}
                    />
                    {/* Show collaborative cursors */}
                    {page.id && (
                      <CollaborativeCursor users={collab.users} blockId={block.id} />
                    )}
                  </div>
                ))
              )}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    );
  };

  return (
    <UniversalDesigner
      // Header
      title={title || 'Untitled Wiki Page'}
      subtitle={
        <div className="flex items-center gap-4">
          <span>{`Last updated ${new Date(updatedDate).toLocaleDateString()}`}</span>
          {page.id && (
            <CollaborativePresence
              users={collab.users}
              syncStatus={collab.syncStatus}
              currentUserId={localStorage.getItem('user_id') || undefined}
            />
          )}
        </div>
      }
      icon={<BookOpen className="h-6 w-6" />}
      titleEditable
      onTitleChange={setTitle}

      // View Modes
      currentViewMode={viewMode}
      onViewModeChange={(mode) => setViewMode(mode as 'design' | 'preview' | 'code')}

      // Layout Panels
      toolbar={viewMode === 'design' ? <WikiBlockToolbar onAddBlock={handleAddBlock} /> : undefined}
      toolbarTitle="Content Blocks"
      toolbarDefaultCollapsed={false}

      canvas={renderCanvas()}
      canvasBackground="bg-dark-100"
      canvasMaxWidth="max-w-full"

      properties={
        viewMode === 'design' ? (
          <WikiPropertiesPanel
            title={title}
            pagePath={pagePath}
            author={author}
            createdDate={createdDate}
            updatedDate={updatedDate}
            selectedBlock={selectedBlock}
            onUpdateTitle={setTitle}
            onUpdatePath={setPagePath}
            onUpdateBlock={(updates) => selectedBlock && handleUpdateBlock(selectedBlock.id, updates)}
          />
        ) : undefined
      }
      propertiesTitle={selectedBlock ? 'Block Properties' : 'Page Properties'}
      propertiesDefaultCollapsed={false}

      // Actions
      actions={actions}
      primaryAction={{
        id: 'save',
        label: isSaving ? 'Saving...' : 'Save Page',
        icon: <Save className="h-4 w-4" />,
        onClick: handleSave,
        disabled: isSaving || !title.trim(),
        loading: isSaving}}
      trailingActions={
        onExit
          ? [
              {
                id: 'exit',
                label: 'Exit',
                icon: <LogOut className="h-4 w-4" />,
                onClick: onExit,
                variant: 'secondary' as const}]
          : []
      }
    />
  );
}
