import React, { useState, useEffect } from 'react';
import { Settings, Trash2, ArrowUp, ArrowDown, AlignLeft, AlignCenter, AlignRight, Bold, Type } from 'lucide-react';
import { uploadImage, fileToBase64 } from '../../../../lib/uploadImage';
import { APIFactory } from '../../../../lib/api';

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

interface PropertiesPanelProps {
  element: CanvasElementData;
  onUpdate: (updates: Partial<CanvasElementData>) => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export function PropertiesPanel({ element, onUpdate, onDelete, onBringToFront, onSendToBack }: PropertiesPanelProps) {
  const [forms, setForms] = useState<any[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);

  useEffect(() => {
    if (element.type === 'form') {
      loadForms();
    }
  }, [element.type]);

  const loadForms = async () => {
    try {
      setLoadingForms(true);
      const formApi = APIFactory.getAPI('form');
      const response = await formApi.list();
      setForms(response.data || []);
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoadingForms(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { url } = await uploadImage(file);
        onUpdate({ content: url });
      } catch (error) {
        console.warn('Upload failed, using base64:', error);
        const base64 = await fileToBase64(file);
        onUpdate({ content: base64 });
      }
    }
  };

  return (
    <div className="w-80 bg-dark-100 border-l border-dark-300 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5 text-dark-700" />
          <h3 className="text-sm font-semibold text-dark-600">Properties</h3>
        </div>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 rounded-md transition-colors"
          title="Delete element"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Element Type Badge */}
        <div className="bg-dark-100 border border-dark-400 rounded-md p-2 text-center">
          <span className="text-xs font-semibold text-dark-700 uppercase">{element.type}</span>
        </div>

        {/* Layer Controls */}
        <div>
          <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Layer</label>
          <div className="flex space-x-2">
            <button
              onClick={onBringToFront}
              className="flex-1 px-3 py-2 bg-dark-100 hover:bg-dark-200 rounded-md text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
            >
              <ArrowUp className="h-4 w-4" />
              <span>Front</span>
            </button>
            <button
              onClick={onSendToBack}
              className="flex-1 px-3 py-2 bg-dark-100 hover:bg-dark-200 rounded-md text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
            >
              <ArrowDown className="h-4 w-4" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Position & Size */}
        <div>
          <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Position & Size</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-dark-700 block mb-1">X</label>
              <input
                type="number"
                value={Math.round(element.x)}
                onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 border border-dark-400 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-dark-700 block mb-1">Y</label>
              <input
                type="number"
                value={Math.round(element.y)}
                onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 border border-dark-400 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-dark-700 block mb-1">Width</label>
              <input
                type="number"
                value={Math.round(element.width)}
                onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 border border-dark-400 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-dark-700 block mb-1">Height</label>
              <input
                type="number"
                value={Math.round(element.height)}
                onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 border border-dark-400 rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* Text Styling (for text, heading, button) */}
        {(element.type === 'text' || element.type === 'heading' || element.type === 'button') && (
          <>
            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Text Alignment</label>
              <div className="flex space-x-2">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => onUpdate({ styles: { ...element.styles, textAlign: align } })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      element.styles.textAlign === align
                        ? 'bg-dark-100 text-dark-700 border-2 border-dark-500'
                        : 'bg-dark-100 hover:bg-dark-200 border-2 border-transparent'
                    }`}
                  >
                    {align === 'left' && <AlignLeft className="h-4 w-4 mx-auto" />}
                    {align === 'center' && <AlignCenter className="h-4 w-4 mx-auto" />}
                    {align === 'right' && <AlignRight className="h-4 w-4 mx-auto" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Font Size</label>
              <input
                type="range"
                min="12"
                max="72"
                value={parseInt(element.styles.fontSize || '16')}
                onChange={(e) => onUpdate({ styles: { ...element.styles, fontSize: `${e.target.value}px` } })}
                className="w-full"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-dark-700">12px</span>
                <span className="text-sm font-medium text-dark-600">{element.styles.fontSize}</span>
                <span className="text-xs text-dark-700">72px</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Font Weight</label>
              <div className="flex space-x-2">
                {(['400', '700'] as const).map((weight) => (
                  <button
                    key={weight}
                    onClick={() => onUpdate({ styles: { ...element.styles, fontWeight: weight } })}
                    className={`flex-1 px-3 py-2 rounded-md text-sm transition-colors ${
                      element.styles.fontWeight === weight
                        ? 'bg-dark-100 text-dark-700 border-2 border-dark-500'
                        : 'bg-dark-100 hover:bg-dark-200 border-2 border-transparent'
                    }`}
                  >
                    {weight === '400' ? 'Regular' : 'Bold'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Text Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={element.styles.color || '#000000'}
                  onChange={(e) => onUpdate({ styles: { ...element.styles, color: e.target.value } })}
                  className="w-12 h-12 border-2 border-dark-400 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={element.styles.color || '#000000'}
                  onChange={(e) => onUpdate({ styles: { ...element.styles, color: e.target.value } })}
                  className="flex-1 px-3 py-2 border border-dark-400 rounded text-sm"
                />
              </div>
            </div>
          </>
        )}

        {/* Background Color (for button and text) */}
        {(element.type === 'button' || element.type === 'text') && (
          <div>
            <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Background Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={element.styles.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ styles: { ...element.styles, backgroundColor: e.target.value } })}
                className="w-12 h-12 border-2 border-dark-400 rounded cursor-pointer"
              />
              <input
                type="text"
                value={element.styles.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ styles: { ...element.styles, backgroundColor: e.target.value } })}
                className="flex-1 px-3 py-2 border border-dark-400 rounded text-sm"
              />
            </div>
          </div>
        )}

        {/* Border Radius (for button) */}
        {element.type === 'button' && (
          <div>
            <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Border Radius</label>
            <input
              type="range"
              min="0"
              max="50"
              value={parseInt(element.styles.borderRadius || '8')}
              onChange={(e) => onUpdate({ styles: { ...element.styles, borderRadius: `${e.target.value}px` } })}
              className="w-full"
            />
            <div className="text-center text-sm font-medium text-dark-600 mt-1">{element.styles.borderRadius}</div>
          </div>
        )}

        {/* Button Link */}
        {element.type === 'button' && (
          <div>
            <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Link URL</label>
            <input
              type="text"
              value={element.properties?.href || ''}
              onChange={(e) => onUpdate({ properties: { ...element.properties, href: e.target.value } })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-dark-400 rounded text-sm"
            />
          </div>
        )}

        {/* Image Upload */}
        {element.type === 'image' && (
          <div>
            <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Upload Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm"
            />
          </div>
        )}

        {/* Form Selection */}
        {element.type === 'form' && (
          <>
            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Select Form</label>
              {loadingForms ? (
                <div className="text-xs text-dark-700">Loading forms...</div>
              ) : (
                <select
                  value={element.properties?.formId || ''}
                  onChange={(e) => {
                    const selectedForm = forms.find((f) => f.id === e.target.value);
                    onUpdate({
                      properties: {
                        ...element.properties,
                        formId: e.target.value,
                        formName: selectedForm?.name || 'Select a form',
                      },
                    });
                  }}
                  className="w-full px-3 py-2 border border-dark-400 rounded text-sm"
                >
                  <option value="">-- Select a form --</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Background Color</label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={element.styles.backgroundColor || '#f8f9fa'}
                  onChange={(e) => onUpdate({ styles: { ...element.styles, backgroundColor: e.target.value } })}
                  className="w-12 h-12 border-2 border-dark-400 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={element.styles.backgroundColor || '#f8f9fa'}
                  onChange={(e) => onUpdate({ styles: { ...element.styles, backgroundColor: e.target.value } })}
                  className="flex-1 px-3 py-2 border border-dark-400 rounded text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-dark-600 uppercase mb-2 block">Border Radius</label>
              <input
                type="range"
                min="0"
                max="50"
                value={parseInt(element.styles.borderRadius || '8')}
                onChange={(e) => onUpdate({ styles: { ...element.styles, borderRadius: `${e.target.value}px` } })}
                className="w-full"
              />
              <div className="text-center text-sm font-medium text-dark-600 mt-1">{element.styles.borderRadius}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
