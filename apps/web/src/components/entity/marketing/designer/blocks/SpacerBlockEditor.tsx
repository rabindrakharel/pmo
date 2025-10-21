import React from 'react';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface SpacerBlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
}

export function SpacerBlockEditor({ block, onUpdate }: SpacerBlockEditorProps) {
  return (
    <div className="border-b border-gray-200">
      {/* Spacer Preview */}
      <div className="p-4 bg-gray-50">
        <div
          style={{
            height: block.styles?.height || '20px',
            backgroundColor: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          {block.styles?.height || '20px'} spacing
        </div>
      </div>

      {/* Spacer Settings */}
      <div className="bg-gray-50 px-3 py-2 text-xs">
        <div>
          <label className="text-gray-600 block mb-1">Height</label>
          <input
            type="range"
            min="10"
            max="200"
            step="10"
            value={parseInt(block.styles?.height || '20')}
            onChange={(e) => onUpdate({ styles: { ...block.styles, height: `${e.target.value}px` } })}
            className="w-full"
          />
          <div className="flex items-center space-x-2 mt-2">
            <input
              type="text"
              value={block.styles?.height || '20px'}
              onChange={(e) => onUpdate({ styles: { ...block.styles, height: e.target.value } })}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="20px"
            />
            <span className="text-gray-500">Vertical spacing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
