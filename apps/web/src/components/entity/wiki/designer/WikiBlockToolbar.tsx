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
      category: 'Basic',
      items: [
        { type: 'heading' as const, level: 1, icon: Heading1, label: 'H1' },
        { type: 'heading' as const, level: 2, icon: Heading2, label: 'H2' },
        { type: 'heading' as const, level: 3, icon: Heading3, label: 'H3' },
        { type: 'paragraph' as const, icon: Type, label: 'Text' },
      ],
    },
    {
      category: 'Lists',
      items: [
        { type: 'list' as const, level: 1, icon: List, label: 'Bullets' },
        { type: 'list' as const, level: 2, icon: ListOrdered, label: 'Numbers' },
      ],
    },
    {
      category: 'Content',
      items: [
        { type: 'quote' as const, icon: Quote, label: 'Quote' },
        { type: 'code' as const, icon: Code, label: 'Code' },
        { type: 'callout' as const, icon: AlertCircle, label: 'Callout' },
      ],
    },
    {
      category: 'Media',
      items: [
        { type: 'image' as const, icon: Image, label: 'Image' },
        { type: 'video' as const, icon: Video, label: 'Video' },
      ],
    },
    {
      category: 'Other',
      items: [
        { type: 'table' as const, icon: Table, label: 'Table' },
        { type: 'divider' as const, icon: Minus, label: 'Divider' },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {blockTypes.map((category) => (
        <div key={category.category}>
          <div className="text-[10px] font-medium text-dark-400 uppercase tracking-wider mb-1.5 px-1">
            {category.category}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {category.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${item.type}-${item.level || 0}`}
                  onClick={() => onAddBlock(item.type, item.level)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-dark-100 transition-colors text-left group"
                >
                  <Icon className="h-3.5 w-3.5 text-dark-400 group-hover:text-dark-600" />
                  <span className="text-xs text-dark-600">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
