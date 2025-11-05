import React from 'react';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface DividerBlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
}

export function DividerBlockEditor({ block, onUpdate }: DividerBlockEditorProps) {
  return (
    <div className="border-b border-dark-300">
      {/* Divider Preview */}
      <div className="p-8">
        <hr
          style={{
            border: 'none',
            borderTop: `${block.styles?.borderWidth || '1px'} ${block.styles?.borderStyle || 'solid'} ${
              block.styles?.borderColor || '#dee2e6'
            }`,
            margin: block.styles?.margin || '20px 0',
          }}
        />
      </div>

      {/* Divider Settings */}
      <div className="bg-dark-100 px-3 py-2 grid grid-cols-4 gap-2 text-xs">
        <div>
          <label className="text-dark-700 block mb-1">Width</label>
          <input
            type="text"
            value={block.styles?.borderWidth || '1px'}
            onChange={(e) => onUpdate({ styles: { ...block.styles, borderWidth: e.target.value } })}
            className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
            placeholder="1px"
          />
        </div>
        <div>
          <label className="text-dark-700 block mb-1">Style</label>
          <select
            value={block.styles?.borderStyle || 'solid'}
            onChange={(e) => onUpdate({ styles: { ...block.styles, borderStyle: e.target.value } })}
            className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div>
          <label className="text-dark-700 block mb-1">Color</label>
          <div className="flex items-center space-x-1">
            <input
              type="color"
              value={block.styles?.borderColor || '#dee2e6'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, borderColor: e.target.value } })}
              className="w-8 h-8 border border-dark-400 rounded cursor-pointer"
            />
            <input
              type="text"
              value={block.styles?.borderColor || '#dee2e6'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, borderColor: e.target.value } })}
              className="flex-1 px-2 py-1 border border-dark-400 rounded text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-dark-700 block mb-1">Margin</label>
          <input
            type="text"
            value={block.styles?.margin || '20px 0'}
            onChange={(e) => onUpdate({ styles: { ...block.styles, margin: e.target.value } })}
            className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
            placeholder="20px 0"
          />
        </div>
      </div>
    </div>
  );
}
