import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  List,
  ListOrdered,
  Quote,
  Code,
  Image,
  Video,
  Minus,
  CheckSquare,
} from 'lucide-react';

interface SlashCommandMenuProps {
  editor: Editor | null;
}

interface CommandItem {
  title: string;
  description: string;
  icon: any;
  command: () => void;
  keywords: string[];
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const commands: CommandItem[] = [
    {
      title: 'Heading 1',
      description: 'Big section heading',
      icon: Heading1,
      command: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      keywords: ['h1', 'heading', 'title'],
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: Heading2,
      command: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      keywords: ['h2', 'heading', 'subtitle'],
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      icon: Heading3,
      command: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      keywords: ['h3', 'heading'],
    },
    {
      title: 'Paragraph',
      description: 'Plain text paragraph',
      icon: Type,
      command: () => editor?.chain().focus().setParagraph().run(),
      keywords: ['p', 'paragraph', 'text'],
    },
    {
      title: 'Bullet List',
      description: 'Create a bullet list',
      icon: List,
      command: () => editor?.chain().focus().toggleBulletList().run(),
      keywords: ['ul', 'list', 'bullet'],
    },
    {
      title: 'Numbered List',
      description: 'Create a numbered list',
      icon: ListOrdered,
      command: () => editor?.chain().focus().toggleOrderedList().run(),
      keywords: ['ol', 'list', 'numbered'],
    },
    {
      title: 'Quote',
      description: 'Insert a quote block',
      icon: Quote,
      command: () => editor?.chain().focus().toggleBlockquote().run(),
      keywords: ['quote', 'blockquote'],
    },
    {
      title: 'Code Block',
      description: 'Insert a code block',
      icon: Code,
      command: () => editor?.chain().focus().setCodeBlock().run(),
      keywords: ['code', 'pre'],
    },
    {
      title: 'Image',
      description: 'Upload or embed an image',
      icon: Image,
      command: () => {
        const url = window.prompt('Enter image URL:');
        if (url) {
          editor?.chain().focus().setImage({ src: url }).run();
        }
      },
      keywords: ['image', 'img', 'picture', 'photo'],
    },
    {
      title: 'Video',
      description: 'Embed a YouTube video',
      icon: Video,
      command: () => {
        const url = window.prompt('Enter YouTube URL:');
        if (url) {
          editor?.chain().focus().setYoutubeVideo({ src: url }).run();
        }
      },
      keywords: ['video', 'youtube'],
    },
    {
      title: 'Divider',
      description: 'Insert a horizontal line',
      icon: Minus,
      command: () => editor?.chain().focus().setHorizontalRule().run(),
      keywords: ['divider', 'hr', 'line'],
    },
  ];

  const filteredCommands = commands.filter((command) => {
    const searchLower = search.toLowerCase();
    return (
      command.title.toLowerCase().includes(searchLower) ||
      command.description.toLowerCase().includes(searchLower) ||
      command.keywords.some((keyword) => keyword.includes(searchLower))
    );
  });

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;

      // Get text before cursor
      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 20),
        $from.parentOffset,
        null,
        '\ufffc'
      );

      // Check if we just typed "/"
      const slashMatch = textBefore.match(/\/(\w*)$/);

      if (slashMatch) {
        setSearch(slashMatch[1]);
        setIsOpen(true);
        setSelectedIndex(0);

        // Calculate position
        const coords = editor.view.coordsAtPos(selection.from);
        setPosition({
          top: coords.top + 24,
          left: coords.left,
        });
      } else {
        setIsOpen(false);
        setSearch('');
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!isOpen || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? filteredCommands.length - 1 : prev - 1
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        setSearch('');
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, editor]);

  const executeCommand = (command: CommandItem) => {
    if (!editor) return;

    // Delete the "/" and search text
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;

    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 20),
      $from.parentOffset,
      null,
      '\ufffc'
    );

    const slashMatch = textBefore.match(/\/(\w*)$/);
    if (slashMatch) {
      const from = selection.from - slashMatch[0].length;
      const to = selection.from;
      editor.chain().deleteRange({ from, to }).run();
    }

    // Execute the command
    command.command();

    setIsOpen(false);
    setSearch('');
  };

  if (!isOpen || filteredCommands.length === 0) return null;

  return (
    <div
      className="fixed bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden z-50 w-80"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="max-h-80 overflow-y-auto">
        {filteredCommands.map((command, index) => (
          <button
            key={command.title}
            onClick={() => executeCommand(command)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50 border-l-2 border-blue-500'
                : 'hover:bg-gray-50'
            }`}
          >
            <div
              className={`p-2 rounded ${
                index === selectedIndex
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <command.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {command.title}
              </div>
              <div className="text-xs text-gray-500">{command.description}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Use ↑↓ to navigate, Enter to select, Esc to dismiss
      </div>
    </div>
  );
}
