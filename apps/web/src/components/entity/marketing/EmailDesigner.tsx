import React, { useState, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Eye, Code, Settings, Save } from 'lucide-react';
import { produce } from 'immer';
import { BlockToolbar } from './designer/BlockToolbar';
import { DraggableBlock } from './designer/DraggableBlock';
import { StylePanel } from './designer/StylePanel';
import { EmailPreviewPanel } from './designer/EmailPreviewPanel';

interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'form' | 'button' | 'divider' | 'spacer';
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface EmailTemplateSchema {
  blocks: EmailBlock[];
  globalStyles?: {
    backgroundColor?: string;
    fontFamily?: string;
    maxWidth?: string;
    margin?: string;
    [key: string]: any;
  };
}

interface EmailDesignerProps {
  template: {
    id: string;
    name: string;
    subject: string;
    template_schema: EmailTemplateSchema;
    from_name?: string;
    from_email?: string;
    preview_text?: string;
  };
  onSave: (schema: EmailTemplateSchema) => Promise<void>;
}

export function EmailDesigner({ template, onSave }: EmailDesignerProps) {
  const [schema, setSchema] = useState<EmailTemplateSchema>(template.template_schema || { blocks: [], globalStyles: {} });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'preview' | 'code'>('design');
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSchema(produce((draft) => {
        const oldIndex = draft.blocks.findIndex((b) => b.id === active.id);
        const newIndex = draft.blocks.findIndex((b) => b.id === over.id);
        draft.blocks = arrayMove(draft.blocks, oldIndex, newIndex);
      }));
    }
  }, []);

  const handleAddBlock = useCallback((type: EmailBlock['type']) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      type,
      content: type === 'text' ? '<p>Edit this text...</p>' : type === 'image' ? '' : type === 'button' ? 'Click Here' : '',
      styles: type === 'text' ? { padding: '20px', fontSize: '16px' } : type === 'image' ? { padding: '0' } : type === 'button' ? { padding: '12px 24px', backgroundColor: '#007bff', color: '#ffffff' } : type === 'spacer' ? { height: '20px' } : { padding: '20px' },
      properties: type === 'button' ? { href: '#', target: '_self' } : type === 'image' ? { alt: 'Image' } : type === 'form' ? { formId: '', formName: '' } : {},
    };

    setSchema(produce((draft) => {
      draft.blocks.push(newBlock);
    }));
    setSelectedBlockId(newBlock.id);
  }, []);

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<EmailBlock>) => {
    setSchema(produce((draft) => {
      const block = draft.blocks.find((b) => b.id === blockId);
      if (block) {
        Object.assign(block, updates);
      }
    }));
  }, []);

  const handleDeleteBlock = useCallback((blockId: string) => {
    setSchema(produce((draft) => {
      draft.blocks = draft.blocks.filter((b) => b.id !== blockId);
    }));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  }, [selectedBlockId]);

  const handleUpdateGlobalStyles = useCallback((styles: Record<string, any>) => {
    setSchema(produce((draft) => {
      draft.globalStyles = { ...draft.globalStyles, ...styles };
    }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(schema);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBlock = schema.blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="flex flex-col h-screen bg-dark-100">
      {/* Top Toolbar */}
      <div className="bg-dark-100 border-b border-dark-300 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-dark-600">{template.name}</h2>
          <div className="flex items-center space-x-1 bg-dark-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('design')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'design' ? 'bg-dark-100 text-dark-600 shadow-sm' : 'text-dark-700 hover:text-dark-600'}`}
            >
              Design
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${viewMode === 'preview' ? 'bg-dark-100 text-dark-600 shadow-sm' : 'text-dark-700 hover:text-dark-600'}`}
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${viewMode === 'code' ? 'bg-dark-100 text-dark-600 shadow-sm' : 'text-dark-700 hover:text-dark-600'}`}
            >
              <Code className="h-4 w-4" />
              <span>Code</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowStylePanel(!showStylePanel)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${showStylePanel ? 'bg-dark-100 text-dark-700' : 'text-dark-600 hover:bg-dark-100'}`}
          >
            <Settings className="h-4 w-4" />
            <span>Global Styles</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-2 bg-slate-600 text-white rounded-md text-sm font-medium hover:bg-slate-700 transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Block Toolbar */}
        {viewMode === 'design' && (
          <div className="w-64 bg-dark-100 border-r border-dark-300 overflow-y-auto">
            <BlockToolbar onAddBlock={handleAddBlock} />
          </div>
        )}

        {/* Center Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'design' ? (
            <div className="max-w-3xl mx-auto bg-dark-100 rounded-md shadow-sm">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={schema.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {schema.blocks.length === 0 ? (
                    <div className="text-center py-20 text-dark-600">
                      <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Add blocks to start designing your email</p>
                    </div>
                  ) : (
                    schema.blocks.map((block) => (
                      <DraggableBlock
                        key={block.id}
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                        onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                        onDelete={() => handleDeleteBlock(block.id)}
                      />
                    ))
                  )}
                </SortableContext>
              </DndContext>
            </div>
          ) : viewMode === 'preview' ? (
            <EmailPreviewPanel template={{ ...template, template_schema: schema }} />
          ) : (
            <div className="max-w-4xl mx-auto">
              <pre className="bg-dark-900 text-gray-100 rounded-md p-6 overflow-x-auto">
                <code>{JSON.stringify(schema, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Right Sidebar - Style Panel */}
        {showStylePanel && viewMode === 'design' && (
          <div className="w-80 bg-dark-100 border-l border-dark-300 overflow-y-auto">
            <StylePanel
              globalStyles={schema.globalStyles || {}}
              selectedBlock={selectedBlock}
              onUpdateGlobalStyles={handleUpdateGlobalStyles}
              onUpdateBlock={(updates) => selectedBlock && handleUpdateBlock(selectedBlock.id, updates)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
