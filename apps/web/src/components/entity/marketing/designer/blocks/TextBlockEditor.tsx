import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Palette } from 'lucide-react';

interface EmailBlock {
  id: string;
  type: string;
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface TextBlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
}

export function TextBlockEditor({ block, onUpdate }: TextBlockEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-dark-700 underline',
        },
      }),
      TextStyle,
      Color,
    ],
    content: block.content || '<p>Edit this text...</p>',
    onUpdate: ({ editor }) => {
      onUpdate({ content: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (editor && block.content && editor.getHTML() !== block.content) {
      editor.commands.setContent(block.content);
    }
  }, [block.content, editor]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const setColor = () => {
    const color = window.prompt('Enter color (hex or name):', '#000000');
    if (color) {
      editor.chain().focus().setColor(color).run();
    }
  };

  return (
    <div className="border-b border-dark-300">
      {/* Formatting Toolbar */}
      <div className="bg-dark-100 border-b border-dark-300 px-3 py-2 flex items-center space-x-1 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-dark-200 transition-colors ${editor.isActive('bold') ? 'bg-dark-300' : ''}`}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-dark-200 transition-colors ${editor.isActive('italic') ? 'bg-dark-300' : ''}`}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-dark-300 mx-2"></div>

        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded hover:bg-dark-200 transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-dark-300' : ''}`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded hover:bg-dark-200 transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-dark-300' : ''}`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded hover:bg-dark-200 transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-dark-300' : ''}`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-dark-300 mx-2"></div>

        <button
          onClick={addLink}
          className={`p-2 rounded hover:bg-dark-200 transition-colors ${editor.isActive('link') ? 'bg-dark-300' : ''}`}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>

        <button
          onClick={setColor}
          className="p-2 rounded hover:bg-dark-200 transition-colors"
          title="Text Color"
        >
          <Palette className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-dark-300 mx-2"></div>

        <select
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'p') {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level: parseInt(value) as 1 | 2 | 3 }).run();
            }
          }}
          className="text-sm border border-dark-400 rounded px-2 py-1"
          value={
            editor.isActive('heading', { level: 1 })
              ? '1'
              : editor.isActive('heading', { level: 2 })
              ? '2'
              : editor.isActive('heading', { level: 3 })
              ? '3'
              : 'p'
          }
        >
          <option value="p">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>
      </div>

      {/* Editor Content */}
      <div className="p-4 min-h-[100px]">
        <div className="prose max-w-none">
          <EditorContent editor={editor} />
        </div>
        <style>{`
          .ProseMirror {
            outline: none;
            min-height: 100px;
          }
          .ProseMirror p {
            margin: 0.5em 0;
          }
          .ProseMirror h1 {
            font-size: 2em;
            font-weight: bold;
            margin: 0.5em 0;
          }
          .ProseMirror h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.5em 0;
          }
          .ProseMirror h3 {
            font-size: 1.25em;
            font-weight: bold;
            margin: 0.5em 0;
          }
          .ProseMirror strong {
            font-weight: bold;
          }
          .ProseMirror em {
            font-style: italic;
          }
          .ProseMirror a {
            color: #2563eb;
            text-decoration: underline;
          }
        `}</style>
      </div>

      {/* Styling Options */}
      <div className="bg-dark-100 px-3 py-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <label className="text-dark-700 block mb-1">Padding</label>
          <input
            type="text"
            value={block.styles?.padding || '20px'}
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
          <label className="text-dark-700 block mb-1">Background</label>
          <input
            type="text"
            value={block.styles?.backgroundColor || 'transparent'}
            onChange={(e) => onUpdate({ styles: { ...block.styles, backgroundColor: e.target.value } })}
            className="w-full px-2 py-1 border border-dark-400 rounded text-xs"
          />
        </div>
      </div>
    </div>
  );
}
