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
  Minus,
  FileText,
  Bold,
  Italic,
  Underline,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

interface WikiToolbarProps {
  onAddBlock: (type: string) => void;
  editor: any;
}

export function WikiToolbar({ onAddBlock, editor }: WikiToolbarProps) {
  const blockTypes = [
    {
      category: 'Headings',
      blocks: [
        { type: 'heading1', icon: Heading1, label: 'Heading 1', description: 'Big section heading' },
        { type: 'heading2', icon: Heading2, label: 'Heading 2', description: 'Medium section heading' },
        { type: 'heading3', icon: Heading3, label: 'Heading 3', description: 'Small section heading' },
      ],
    },
    {
      category: 'Basic Blocks',
      blocks: [
        { type: 'paragraph', icon: Type, label: 'Paragraph', description: 'Plain text block' },
        { type: 'quote', icon: Quote, label: 'Quote', description: 'Blockquote citation' },
        { type: 'code', icon: Code, label: 'Code Block', description: 'Code with syntax highlighting' },
        { type: 'divider', icon: Minus, label: 'Divider', description: 'Horizontal line separator' },
      ],
    },
    {
      category: 'Lists',
      blocks: [
        { type: 'bulletList', icon: List, label: 'Bullet List', description: 'Unordered list' },
        { type: 'orderedList', icon: ListOrdered, label: 'Numbered List', description: 'Ordered list' },
      ],
    },
    {
      category: 'Media',
      blocks: [
        { type: 'image', icon: Image, label: 'Image', description: 'Embed an image' },
        { type: 'video', icon: Video, label: 'Video', description: 'Embed YouTube video' },
      ],
    },
  ];

  const formatButtons = [
    {
      category: 'Text Formatting',
      buttons: [
        {
          action: () => editor?.chain().focus().toggleBold().run(),
          icon: Bold,
          label: 'Bold',
          isActive: () => editor?.isActive('bold'),
        },
        {
          action: () => editor?.chain().focus().toggleItalic().run(),
          icon: Italic,
          label: 'Italic',
          isActive: () => editor?.isActive('italic'),
        },
        {
          action: () => editor?.chain().focus().toggleUnderline().run(),
          icon: Underline,
          label: 'Underline',
          isActive: () => editor?.isActive('underline'),
        },
        {
          action: () => {
            const url = prompt('Enter link URL:');
            if (url) {
              editor?.chain().focus().setLink({ href: url }).run();
            }
          },
          icon: Link,
          label: 'Link',
          isActive: () => editor?.isActive('link'),
        },
      ],
    },
    {
      category: 'Alignment',
      buttons: [
        {
          action: () => editor?.chain().focus().setTextAlign('left').run(),
          icon: AlignLeft,
          label: 'Align Left',
          isActive: () => editor?.isActive({ textAlign: 'left' }),
        },
        {
          action: () => editor?.chain().focus().setTextAlign('center').run(),
          icon: AlignCenter,
          label: 'Align Center',
          isActive: () => editor?.isActive({ textAlign: 'center' }),
        },
        {
          action: () => editor?.chain().focus().setTextAlign('right').run(),
          icon: AlignRight,
          label: 'Align Right',
          isActive: () => editor?.isActive({ textAlign: 'right' }),
        },
      ],
    },
  ];

  return (
    <div className="p-4">
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-dark-700 uppercase tracking-wider mb-3">
          Content Blocks
        </h3>
        {blockTypes.map((category) => (
          <div key={category.category} className="mb-4">
            <h4 className="text-xs font-medium text-dark-600 mb-2">{category.category}</h4>
            <div className="space-y-1">
              {category.blocks.map((block) => (
                <button
                  key={block.type}
                  onClick={() => onAddBlock(block.type)}
                  className="w-full flex items-start space-x-3 px-3 py-2 rounded-lg hover:bg-dark-100 transition-colors text-left group"
                >
                  <block.icon className="h-5 w-5 text-dark-600 group-hover:text-dark-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-600 group-hover:text-dark-600">
                      {block.label}
                    </div>
                    <div className="text-xs text-dark-700">{block.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dark-300 pt-6">
        <h3 className="text-xs font-semibold text-dark-700 uppercase tracking-wider mb-3">
          Formatting
        </h3>
        {formatButtons.map((category) => (
          <div key={category.category} className="mb-4">
            <h4 className="text-xs font-medium text-dark-600 mb-2">{category.category}</h4>
            <div className="grid grid-cols-2 gap-2">
              {category.buttons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.action}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-colors ${
                    button.isActive?.()
                      ? 'bg-dark-100 border-dark-400 text-dark-700'
                      : 'bg-dark-100 border-dark-300 text-dark-700 hover:bg-dark-100 hover:border-dark-400'
                  }`}
                >
                  <button.icon className="h-4 w-4 mb-1" />
                  <span className="text-xs">{button.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
