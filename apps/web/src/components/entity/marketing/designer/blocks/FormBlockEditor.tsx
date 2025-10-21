import React, { useState, useEffect } from 'react';
import { APIFactory } from '../../../../../lib/api';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface FormBlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
}

export function FormBlockEditor({ block, onUpdate }: FormBlockEditorProps) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const formApi = APIFactory.getAPI('form');
      const response = await formApi.list();
      setForms(response.data || []);
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-gray-200">
      {/* Form Embed Preview */}
      <div
        className="p-8"
        style={{
          backgroundColor: block.styles?.backgroundColor || '#f8f9fa',
          borderRadius: block.styles?.borderRadius || '8px',
          textAlign: 'center',
          margin: '16px',
        }}
      >
        <div style={{ marginBottom: '12px', fontWeight: '600', color: '#495057' }}>
          {block.properties?.formName || 'Select a form to embed'}
        </div>
        <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '16px' }}>
          This email contains an interactive form
        </div>
        <a
          href={`/public/form/${block.properties?.formId || ''}`}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '14px',
          }}
          onClick={(e) => e.preventDefault()}
        >
          Open Form
        </a>
      </div>

      {/* Form Selection */}
      <div className="bg-gray-50 px-3 py-2 space-y-3 text-xs">
        <div>
          <label className="text-gray-600 block mb-1">Select Form</label>
          {loading ? (
            <div className="text-gray-500">Loading forms...</div>
          ) : (
            <select
              value={block.properties?.formId || ''}
              onChange={(e) => {
                const selectedForm = forms.find((f) => f.id === e.target.value);
                onUpdate({
                  properties: {
                    ...block.properties,
                    formId: e.target.value,
                    formName: selectedForm?.name || '',
                  },
                });
              }}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-gray-600 block mb-1">Background Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={block.styles?.backgroundColor || '#f8f9fa'}
                onChange={(e) => onUpdate({ styles: { ...block.styles, backgroundColor: e.target.value } })}
                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={block.styles?.backgroundColor || '#f8f9fa'}
                onChange={(e) => onUpdate({ styles: { ...block.styles, backgroundColor: e.target.value } })}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-gray-600 block mb-1">Border Radius</label>
            <input
              type="text"
              value={block.styles?.borderRadius || '8px'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, borderRadius: e.target.value } })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="8px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
