import React from 'react';
import { Type, Image, MousePointerClick, FileText, Minus, Space } from 'lucide-react';

interface BlockToolbarProps {
  onAddBlock: (type: 'text' | 'image' | 'button' | 'form' | 'divider' | 'spacer') => void;
}

export function BlockToolbar({ onAddBlock }: BlockToolbarProps) {
  const blockTypes = [
    {
      type: 'text' as const,
      icon: Type,
      label: 'Text',
      description: 'Rich text with formatting',
      color: 'blue',
    },
    {
      type: 'image' as const,
      icon: Image,
      label: 'Image',
      description: 'Upload and crop images',
      color: 'green',
    },
    {
      type: 'button' as const,
      icon: MousePointerClick,
      label: 'Button',
      description: 'Call-to-action button',
      color: 'purple',
    },
    {
      type: 'form' as const,
      icon: FileText,
      label: 'Form',
      description: 'Embed a form',
      color: 'orange',
    },
    {
      type: 'divider' as const,
      icon: Minus,
      label: 'Divider',
      description: 'Horizontal line',
      color: 'gray',
    },
    {
      type: 'spacer' as const,
      icon: Space,
      label: 'Spacer',
      description: 'Vertical spacing',
      color: 'gray',
    },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Blocks</h3>
      <div className="space-y-2">
        {blockTypes.map((blockType) => {
          const Icon = blockType.icon;
          return (
            <button
              key={blockType.type}
              onClick={() => onAddBlock(blockType.type)}
              className="w-full flex items-start space-x-3 p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className={`p-2 rounded-md bg-${blockType.color}-100 group-hover:bg-${blockType.color}-200 transition-colors`}>
                <Icon className={`h-5 w-5 text-${blockType.color}-600`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-900">{blockType.label}</div>
                <div className="text-xs text-gray-500">{blockType.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tips</h4>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Drag blocks to reorder them</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Click a block to edit its content and styles</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Use Preview to see how it looks in email clients</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
