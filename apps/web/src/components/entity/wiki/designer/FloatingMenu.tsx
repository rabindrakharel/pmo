import React, { useEffect, useState } from 'react';
import { BubbleMenu, Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Highlighter,
  Type,
} from 'lucide-react';

interface FloatingMenuProps {
  editor: Editor | null;
}

export function FloatingMenu({ editor }: FloatingMenuProps) {
  if (!editor) return null;

  const MenuButton = ({
    onClick,
    isActive = false,
    icon: Icon,
    label
  }: {
    onClick: () => void;
    isActive?: boolean;
    icon: any;
    label: string;
  }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-100'
      }`}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        maxWidth: 'none',
      }}
      className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg shadow-lg p-1"
    >
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={Bold}
        label="Bold (Ctrl+B)"
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={Italic}
        label="Italic (Ctrl+I)"
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        icon={Underline}
        label="Underline (Ctrl+U)"
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        icon={Strikethrough}
        label="Strikethrough"
      />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <MenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        icon={Code}
        label="Inline Code"
      />
      <MenuButton
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
        isActive={editor.isActive('link')}
        icon={LinkIcon}
        label="Add Link"
      />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <div className="relative group">
        <button
          className="p-2 rounded bg-white text-gray-700 hover:bg-gray-100 transition-colors"
          title="Text Style"
        >
          <Type className="h-4 w-4" />
        </button>
        <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-gray-300 rounded-lg shadow-lg p-1 min-w-[120px] z-50">
          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded"
          >
            Paragraph
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded font-bold"
          >
            Heading 1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded font-semibold"
          >
            Heading 2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded font-medium"
          >
            Heading 3
          </button>
        </div>
      </div>
    </BubbleMenu>
  );
}
