import React, { useState, useCallback, useEffect } from 'react';
import { Save, Eye, Type, Heading, MousePointerClick, Image as ImageIcon, Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import { produce } from 'immer';
import { CanvasElement } from './canvas/CanvasElement';
import { ElementToolbar } from './canvas/ElementToolbar';
import { PropertiesPanel } from './canvas/PropertiesPanel';

interface CanvasElementData {
  id: string;
  type: 'text' | 'heading' | 'button' | 'image' | 'form';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  styles: {
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderRadius?: string;
    padding?: string;
    [key: string]: any;
  };
  properties?: {
    href?: string;
    alt?: string;
    formId?: string;
    formName?: string;
    [key: string]: any;
  };
  zIndex: number;
}

interface CanvasEmailSchema {
  elements: CanvasElementData[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
}

interface CanvasEmailDesignerProps {
  template: {
    id: string;
    name: string;
    subject: string;
    template_schema: any;
    from_name?: string;
    from_email?: string;
    preview_text?: string;
  };
  onSave: (schema: any) => Promise<void>;
}

export function CanvasEmailDesigner({ template, onSave }: CanvasEmailDesignerProps) {
  const [schema, setSchema] = useState<CanvasEmailSchema>({
    elements: template.template_schema?.elements || [],
    canvasWidth: template.template_schema?.canvasWidth || 800,
    canvasHeight: template.template_schema?.canvasHeight || 1000,
    backgroundColor: template.template_schema?.backgroundColor || '#ffffff',
  });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'preview'>('design');
  const [isSaving, setIsSaving] = useState(false);
  const [nextZIndex, setNextZIndex] = useState(100);

  const selectedElement = schema.elements.find((el) => el.id === selectedElementId);

  // Auto-expand canvas height based on element positions
  useEffect(() => {
    if (schema.elements.length === 0) return;

    // Calculate the furthest bottom position of any element
    const maxBottom = Math.max(
      ...schema.elements.map((el) => el.y + el.height),
      0
    );

    // Add buffer space below the lowest element (300px)
    const desiredHeight = Math.max(maxBottom + 300, 1000); // Minimum 1000px

    // Update canvas height if needed
    if (desiredHeight > schema.canvasHeight) {
      setSchema(produce((draft) => {
        draft.canvasHeight = desiredHeight;
      }));
    }
  }, [schema.elements, schema.canvasHeight]);

  const handleAddElement = useCallback((type: CanvasElementData['type']) => {
    const baseStyles = {
      text: { fontSize: '16px', color: '#000000', fontWeight: '400', textAlign: 'left' as const },
      heading: { fontSize: '32px', color: '#000000', fontWeight: '700', textAlign: 'left' as const },
      button: { fontSize: '16px', color: '#ffffff', backgroundColor: '#007bff', borderRadius: '8px', padding: '12px 24px', textAlign: 'center' as const },
      image: { backgroundColor: 'transparent' },
      form: { fontSize: '14px', backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '20px', textAlign: 'center' as const },
    };

    const baseSizes = {
      text: { width: 300, height: 60 },
      heading: { width: 400, height: 80 },
      button: { width: 200, height: 50 },
      image: { width: 300, height: 200 },
      form: { width: 350, height: 180 },
    };

    // Calculate smart position for new element
    // Stack vertically below the last element, or start at top if empty
    let yPosition = 50;
    if (schema.elements.length > 0) {
      const maxBottom = Math.max(...schema.elements.map((el) => el.y + el.height));
      yPosition = maxBottom + 30; // 30px gap below previous element
    }

    const newElement: CanvasElementData = {
      id: `element-${Date.now()}`,
      type,
      x: 50,
      y: yPosition,
      width: baseSizes[type].width,
      height: baseSizes[type].height,
      content: type === 'text' ? 'Double-click to edit text' : type === 'heading' ? 'Your Heading Here' : type === 'button' ? 'Click Me' : '',
      styles: baseStyles[type],
      properties: type === 'button' ? { href: '#' } : type === 'image' ? { alt: 'Image' } : type === 'form' ? { formId: '', formName: 'Select a form' } : {},
      zIndex: nextZIndex,
    };

    setSchema(produce((draft) => {
      draft.elements.push(newElement);
    }));
    setNextZIndex(nextZIndex + 1);
    setSelectedElementId(newElement.id);
  }, [nextZIndex]);

  const handleUpdateElement = useCallback((id: string, updates: Partial<CanvasElementData>) => {
    setSchema(produce((draft) => {
      const element = draft.elements.find((el) => el.id === id);
      if (element) {
        Object.assign(element, updates);
      }
    }));
  }, []);

  const handleDeleteElement = useCallback((id: string) => {
    setSchema(produce((draft) => {
      draft.elements = draft.elements.filter((el) => el.id !== id);
    }));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  }, [selectedElementId]);

  const handleBringToFront = useCallback((id: string) => {
    setSchema(produce((draft) => {
      const element = draft.elements.find((el) => el.id === id);
      if (element) {
        element.zIndex = nextZIndex;
      }
    }));
    setNextZIndex(nextZIndex + 1);
  }, [nextZIndex]);

  const handleSendToBack = useCallback((id: string) => {
    setSchema(produce((draft) => {
      const element = draft.elements.find((el) => el.id === id);
      if (element) {
        element.zIndex = 0;
      }
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

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('design')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'design' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Design
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${
                viewMode === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </button>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        {viewMode === 'design' && (
          <ElementToolbar onAddElement={handleAddElement} />
        )}

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-gray-200 p-8">
          <div
            className="mx-auto bg-white shadow-2xl relative"
            style={{
              width: `${schema.canvasWidth}px`,
              height: `${schema.canvasHeight}px`,
              backgroundColor: schema.backgroundColor,
            }}
            onClick={handleCanvasClick}
          >
            {schema.elements.map((element) => (
              <CanvasElement
                key={element.id}
                element={element}
                isSelected={selectedElementId === element.id}
                onSelect={() => setSelectedElementId(element.id)}
                onUpdate={handleUpdateElement}
                onDelete={handleDeleteElement}
                onBringToFront={handleBringToFront}
                onSendToBack={handleSendToBack}
              />
            ))}

            {schema.elements.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">Your canvas is empty</p>
                  <p className="text-sm">Add elements from the toolbar on the left</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Properties Panel */}
        {viewMode === 'design' && selectedElement && (
          <PropertiesPanel
            element={selectedElement}
            onUpdate={(updates) => handleUpdateElement(selectedElement.id, updates)}
            onDelete={() => handleDeleteElement(selectedElement.id)}
            onBringToFront={() => handleBringToFront(selectedElement.id)}
            onSendToBack={() => handleSendToBack(selectedElement.id)}
          />
        )}
      </div>
    </div>
  );
}
