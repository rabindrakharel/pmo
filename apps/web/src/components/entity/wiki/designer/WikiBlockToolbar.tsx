import React from 'react';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Image,
  Video,
  AlertCircle,
  Minus,
  Table,
} from 'lucide-react';
import type { WikiBlock } from '../WikiDesigner';

interface WikiBlockToolbarProps {
  onAddBlock: (type: WikiBlock['type'], level?: number) => void;
}

export function WikiBlockToolbar({ onAddBlock }: WikiBlockToolbarProps) {
  const blockTypes = [
    {
      category: 'Basic Blocks',
      items: [
        { type: 'heading' as const, level: 1, icon: Heading1, label: 'Heading 1', description: 'Large section heading' },
        { type: 'heading' as const, level: 2, icon: Heading2, label: 'Heading 2', description: 'Medium section heading' },
        { type: 'heading' as const, level: 3, icon: Heading3, label: 'Heading 3', description: 'Small section heading' },
        { type: 'paragraph' as const, icon: Type, label: 'Paragraph', description: 'Just start writing plain text' },
      ],
    },
    {
      category: 'Lists',
      items: [
        { type: 'list' as const, level: 1, icon: List, label: 'Bulleted List', description: 'Create a simple bulleted list' },
        { type: 'list' as const, level: 2, icon: ListOrdered, label: 'Numbered List', description: 'Create a list with numbering' },
      ],
    },
    {
      category: 'Content',
      items: [
        { type: 'quote' as const, icon: Quote, label: 'Quote', description: 'Capture a quote' },
        { type: 'code' as const, icon: Code, label: 'Code', description: 'Capture a code snippet' },
        { type: 'callout' as const, icon: AlertCircle, label: 'Callout', description: 'Make text stand out' },
      ],
    },
    {
      category: 'Media',
      items: [
        { type: 'image' as const, icon: Image, label: 'Image', description: 'Upload or embed image' },
        { type: 'video' as const, icon: Video, label: 'Video', description: 'Embed YouTube or Vimeo' },
      ],
    },
    {
      category: 'Advanced',
      items: [
        { type: 'table' as const, icon: Table, label: 'Table', description: 'Add a simple table' },
        { type: 'divider' as const, icon: Minus, label: 'Divider', description: 'Visually divide blocks' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {blockTypes.map((category) => (
        <div key={category.category}>
          <h4 className="text-xs font-semibold text-dark-700 uppercase tracking-wider mb-3">
            {category.category}
          </h4>
          <div className="space-y-1">
            {category.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${item.type}-${item.level || 0}`}
                  onClick={() => onAddBlock(item.type, item.level)}
                  className="w-full flex items-start space-x-3 p-3 rounded-md hover:bg-dark-100 transition-colors text-left group"
                >
                  <div className="flex-shrink-0 p-2 bg-dark-100 border border-dark-300 rounded-md group-hover:border-dark-500 group-hover:bg-dark-100 transition-colors">
                    <Icon className="h-4 w-4 text-dark-700 group-hover:text-dark-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-600">{item.label}</div>
                    <div className="text-xs text-dark-700 mt-0.5">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
