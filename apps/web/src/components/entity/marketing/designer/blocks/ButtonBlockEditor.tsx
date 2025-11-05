import React from 'react';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface ButtonBlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
}

export function ButtonBlockEditor({ block, onUpdate }: ButtonBlockEditorProps) {
  return (
    <div className="border-b border-dark-300">
      {/* Button Preview */}
      <div className="p-8 flex justify-center" style={{ textAlign: block.styles?.textAlign || 'center' }}>
        <a
          href={block.properties?.href || '#'}
          style={{
            display: 'inline-block',
            padding: block.styles?.padding || '12px 24px',
            backgroundColor: block.styles?.backgroundColor || '#007bff',
            color: block.styles?.color || '#ffffff',
            textDecoration: 'none',
            borderRadius: block.styles?.borderRadius || '4px',
            fontWeight: block.styles?.fontWeight || '500',
            fontSize: block.styles?.fontSize || '16px',
          }}
          onClick={(e) => e.preventDefault()}
        >
          {block.content || 'Click Here'}
        </a>
      </div>

      {/* Button Settings */}
      <div className="bg-dark-100 px-3 py-2 space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-dark-700 block mb-1">Button Text</label>
            <input
              type="text"
              value={block.content || ''}
              onChange={(e) => onUpdate({ content: e.target.value })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
              placeholder="Click Here"
            />
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Link URL</label>
            <input
              type="text"
              value={block.properties?.href || ''}
              onChange={(e) => onUpdate({ properties: { ...block.properties, href: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-dark-700 block mb-1">Background Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={block.styles?.backgroundColor || '#007bff'}
                onChange={(e) => onUpdate({ styles: { ...block.styles, backgroundColor: e.target.value } })}
                className="w-8 h-8 border border-dark-400 rounded cursor-pointer"
              />
              <input
                type="text"
                value={block.styles?.backgroundColor || '#007bff'}
                onChange={(e) => onUpdate({ styles: { ...block.styles, backgroundColor: e.target.value } })}
                className="flex-1 px-2 py-1 border border-dark-400 rounded text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Text Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={block.styles?.color || '#ffffff'}
                onChange={(e) => onUpdate({ styles: { ...block.styles, color: e.target.value } })}
                className="w-8 h-8 border border-dark-400 rounded cursor-pointer"
              />
              <input
                type="text"
                value={block.styles?.color || '#ffffff'}
                onChange={(e) => onUpdate({ styles: { ...block.styles, color: e.target.value } })}
                className="flex-1 px-2 py-1 border border-dark-400 rounded text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Border Radius</label>
            <input
              type="text"
              value={block.styles?.borderRadius || '4px'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, borderRadius: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
              placeholder="4px"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-dark-700 block mb-1">Padding</label>
            <input
              type="text"
              value={block.styles?.padding || '12px 24px'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, padding: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
            />
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Font Size</label>
            <input
              type="text"
              value={block.styles?.fontSize || '16px'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, fontSize: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
            />
          </div>
          <div>
            <label className="text-dark-700 block mb-1">Alignment</label>
            <select
              value={block.styles?.textAlign || 'center'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, textAlign: e.target.value } })}
              className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
