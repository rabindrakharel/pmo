import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Menu, ChevronDown } from 'lucide-react';
import { EditorContent, ReactNodeViewRenderer, useEditor, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import { createLowlight } from 'lowlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import './editor.css';

// Configure common languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';

// Create lowlight instance and register languages
const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('python', python);
lowlight.register('css', css);
lowlight.register('html', html);
lowlight.register('json', json);
lowlight.register('sql', sql);
lowlight.register('bash', bash);

// Custom protected Metadata node component
function MetadataView(props: any) {
  const { node, updateAttributes } = props;
  const { author, createdDate, updatedDate, tags, slug, theme, path } = node.attrs as {
    author?: string;
    createdDate?: string;
    updatedDate?: string;
    tags?: string[];
    slug?: string;
    theme?: string;
    path?: string;
  };
  const [newTag, setNewTag] = useState('');
  const [slugValue, setSlugValue] = useState(slug || '');
  const [themeValue, setThemeValue] = useState(theme || 'gradient-blue');
  const [pathValue, setPathValue] = useState(path || '/wiki');

  useEffect(() => {
    setSlugValue(slug || '');
  }, [slug]);

  useEffect(() => {
    setThemeValue(theme || 'gradient-blue');
  }, [theme]);

  useEffect(() => {
    setPathValue(path || '/wiki');
  }, [path]);

  const normalizePath = (input: string) => {
    if (!input) return '/wiki';
    let next = input.trim();
    next = next.replace(/\s+/g, '-');
    if (!next.startsWith('/')) next = `/${next}`;
    // Collapse multiple slashes except leading double slash (unlikely for wiki paths)
    next = next.replace(/(?!^)\/{2,}/g, '/');
    if (next.length > 1 && next.endsWith('/')) next = next.slice(0, -1);
    return next;
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const now = Date.now();
    const date = new Date(dateString);
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const stopEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const focusField = (element: HTMLInputElement | HTMLSelectElement) => {
    if (!element) return;
    if (document.activeElement === element) return;
    requestAnimationFrame(() => {
      element.focus({ preventScroll: true });
    });
  };

  const handleFieldMouseDown = (
    event: React.MouseEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    focusField(event.currentTarget);
  };

  return (
    <NodeViewWrapper>
      <div
        className="metadata-block bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 my-4"
        style={{
          fontSize: '14px',
          color: '#6b7280',
        }}
        contentEditable={false}
        onClick={stopEvent}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>Author: {author || 'Current User'}</span>
          <span>Created: {createdDate ? new Date(createdDate).toLocaleDateString() : new Date().toLocaleDateString()}</span>
          <span>Updated: {updatedDate ? formatDate(updatedDate) : 'a few moments ago'}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span className="font-semibold text-gray-500">Path:</span>
          <input
            value={pathValue}
            onFocus={stopEvent}
            onMouseDown={handleFieldMouseDown}
            onClick={(e) => {
              stopEvent(e);
              focusField(e.currentTarget);
            }}
            onKeyDown={stopEvent}
            onKeyUp={stopEvent}
            onChange={(e) => {
              e.stopPropagation();
              const next = normalizePath(e.target.value);
              setPathValue(next);
              updateAttributes({ path: next });
              try {
                window.dispatchEvent(new CustomEvent('wiki:metadata:path', { detail: next }));
              } catch {}
            }}
            placeholder="/wiki"
            className="border-b border-gray-300 bg-transparent pb-0.5 text-sm font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
          />
          <span className="text-gray-400">/</span>
          <input
            value={slugValue}
            onFocus={stopEvent}
            onMouseDown={handleFieldMouseDown}
            onClick={(e) => {
              stopEvent(e);
              focusField(e.currentTarget);
            }}
            onKeyDown={stopEvent}
            onKeyUp={stopEvent}
            onChange={(e) => {
              e.stopPropagation();
              const next = e.target.value;
              setSlugValue(next);
              updateAttributes({ slug: next });
              try {
                window.dispatchEvent(new CustomEvent('wiki:metadata:slug', { detail: next }));
              } catch {}
            }}
            placeholder="page-slug"
            className="border-b border-gray-300 bg-transparent pb-0.5 text-sm font-normal text-gray-700 focus:border-blue-400 focus:outline-none"
          />
          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold uppercase tracking-[0.3em] text-gray-500">Theme</span>
            <select
              value={themeValue}
              onFocus={stopEvent}
              onMouseDown={handleFieldMouseDown}
              onClick={(e) => {
                stopEvent(e);
                focusField(e.currentTarget);
              }}
              onKeyDown={stopEvent}
              onKeyUp={stopEvent}
              onChange={(e) => {
                e.stopPropagation();
                const next = e.target.value;
                setThemeValue(next);
                updateAttributes({ theme: next });
                try {
                  window.dispatchEvent(new CustomEvent('wiki:metadata:theme', { detail: next }));
                } catch {}
              }}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs font-normal text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
            >
              <option value="gradient-blue">🔵 Blue</option>
              <option value="gradient-purple">🟣 Purple</option>
              <option value="emerald">🟢 Emerald</option>
              <option value="gray">⚪ Neutral</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span>Tags:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {Array.isArray(tags) && tags.length > 0 ? (
              tags.map((tag: string, i: number) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 border-0 rounded-full text-xs font-medium">
                  {tag}
                  <button
                    className="ml-1 text-blue-400 hover:text-red-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e as any).nativeEvent?.stopImmediatePropagation?.();
                      const next = (tags || []).filter((_, idx) => idx !== i);
                      updateAttributes({ tags: next });
                      try { window.dispatchEvent(new CustomEvent('wiki:metadata:tags', { detail: next })); } catch {}
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400 italic">No tags yet</span>
            )}
            <input
              type="text"
              value={newTag}
              onChange={(e) => {
                e.stopPropagation();
                setNewTag(e.target.value);
              }}
              onFocus={stopEvent}
              onMouseDown={handleFieldMouseDown}
              onClick={(e) => {
                stopEvent(e);
                focusField(e.currentTarget);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = newTag.trim();
                  if (!t) return;
                  const set = new Set<string>(Array.isArray(tags) ? tags : []);
                  set.add(t);
                  const next = Array.from(set);
                  updateAttributes({ tags: next });
                  setNewTag('');
                  try { window.dispatchEvent(new CustomEvent('wiki:metadata:tags', { detail: next })); } catch {}
                }
                e.stopPropagation();
              }}
              onKeyUp={stopEvent}
              placeholder="Add tag and press Enter"
              className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// Create the protected Metadata node extension
const MetadataNode = Node.create({
  name: 'metadata',
  group: 'block',
  content: '',
  atom: true,
  selectable: false,
  draggable: false,
  
  addAttributes() {
    return {
      author: { default: '' },
      createdDate: { default: '' },
      updatedDate: { default: '' },
      tags: { default: [] },
      slug: { default: '' },
      theme: { default: 'gradient-blue' },
      path: { default: '/wiki' }
    };
  },

  parseHTML() {
    return [{ 
      tag: 'div[data-type="metadata"]',
      getAttrs: (element) => {
        const el = element as HTMLElement;
        return {
          author: el.getAttribute('data-author') || 'Current User',
          createdDate: el.getAttribute('data-created-date') || new Date().toISOString(),
          updatedDate: el.getAttribute('data-updated-date') || new Date().toISOString(),
          tags: JSON.parse(el.getAttribute('data-tags') || '[]'),
          slug: el.getAttribute('data-slug') || '',
          theme: el.getAttribute('data-theme') || 'gradient-blue',
          path: el.getAttribute('data-path') || '/wiki'
        };
      }
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-type': 'metadata', ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MetadataView);
  },

  addKeyboardShortcuts() {
    return {
      'Backspace': ({ editor }) => {
        const { selection, doc } = editor.state;
        const { $from, $to, from, to } = selection;
        
        // Check if we're trying to delete the metadata node
        const before = $from.nodeBefore;
        if (before && before.type.name === 'metadata') {
          return true; // Prevent deletion
        }
        
        // Check if selection contains metadata node
        let hasMetadata = false;
        doc.nodesBetween(from, to, (node) => {
          if (node.type.name === 'metadata') {
            hasMetadata = true;
            return false;
          }
        });
        
        if (hasMetadata) {
          return true; // Prevent deletion
        }
        
        // Check if we're at the position right after metadata
        let pos = $from.pos;
        if (pos > 0) {
          const nodeBefore = doc.resolve(pos - 1).nodeBefore;
          if (nodeBefore && nodeBefore.type.name === 'metadata') {
            return true; // Prevent deletion
          }
        }
        
        return false;
      },
      'Delete': ({ editor }) => {
        const { selection, doc } = editor.state;
        const { $from, $to, from, to } = selection;
        
        // Check if we're trying to delete the metadata node
        const after = $from.nodeAfter;
        if (after && after.type.name === 'metadata') {
          return true; // Prevent deletion
        }
        
        // Check if selection contains metadata node
        let hasMetadata = false;
        doc.nodesBetween(from, to, (node) => {
          if (node.type.name === 'metadata') {
            hasMetadata = true;
            return false;
          }
        });
        
        if (hasMetadata) {
          return true; // Prevent deletion
        }
        
        return false;
      }
    };
  }
});

// Public API - keeping exact same interface for WikiEditorPage
export interface Block {
  id: string;
  type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'bulleted' | 'numbered' | 'quote' | 'code';
  text: string;
}

export interface BlockEditorProps {
  value: Block[];
  onChange: (blocks: Block[]) => void;
  onToolbarAction?: (action: string, value?: string) => void;
  author?: string;
  createdDate?: string;
  updatedDate?: string;
  tags?: string[];
  slug?: string;
  theme?: string;
  path?: string;
}

export interface BlockEditorRef {
  execCommand: (command: string, value?: string) => boolean;
  handleBlockFormat: (tag: string) => void;
  insertLink: () => void;
  insertImage: () => void;
  insertCodeBlock: () => void;
  isFormatActive: (command: string) => boolean;
}

// Convert blocks to HTML for saving - keeping exact same interface
export function renderBlocksToHtml(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const text = (block.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      switch (block.type) {
        case 'h1':
          return `<h1>${text}</h1>`;
        case 'h2':
          return `<h2>${text}</h2>`;
        case 'h3':
          return `<h3>${text}</h3>`;
        case 'h4':
          return `<h4>${text}</h4>`;
        case 'h5':
          return `<h5>${text}</h5>`;
        case 'h6':
          return `<h6>${text}</h6>`;
        case 'quote':
          return `<blockquote><p>${text}</p></blockquote>`;
        case 'code':
          return `<pre><code>${text}</code></pre>`;
        case 'bulleted':
          return `<ul><li>${text}</li></ul>`;
        case 'numbered':
          return `<ol><li>${text}</li></ol>`;
        default:
          return `<p>${text || '<br>'}</p>`;
      }
    })
    .join('\n');
}

// Custom React node view for code block with copy + resize functionality
function CodeBlockView(props: any) {
  const { node, updateAttributes, selected } = props;
  const lineHeight = 22.4; // 14px font * 1.6 line-height
  const minLines = 10;
  const maxLines = 20;
  const minHeight = minLines * lineHeight;
  const maxHeight = maxLines * lineHeight;
  
  const [height, setHeight] = useState<number>(minHeight);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const text = node.textContent || '';
  const language = node.attrs.language || 'plaintext';
  
  // Calculate current number of lines and adjust height accordingly
  const currentLines = Math.max(minLines, text.split('\n').length);
  const dynamicHeight = Math.min(maxHeight, Math.max(minHeight, currentLines * lineHeight));
  
  // Update height when content changes (up to max height)
  useEffect(() => {
    const contentBasedHeight = Math.min(maxHeight, Math.max(minHeight, currentLines * lineHeight));
    if (currentLines <= maxLines) {
      setHeight(contentBasedHeight);
    }
  }, [text, currentLines, maxHeight, minHeight, maxLines]);

  const onCopy = () => {
    if (text.trim()) {
      navigator.clipboard.writeText(text).then(() => {
        // Could add a toast notification here
      });
    }
  };

  const onLanguageChange = (newLanguage: string) => {
    updateAttributes({ language: newLanguage });
  };

  // Generate line numbers
  const lineNumbers = useMemo(() => {
    if (!showLineNumbers) return '';
    const lines = text.split('\n');
    return lines.map((_, i) => (i + 1).toString().padStart(3, ' ')).join('\n');
  }, [text, showLineNumbers]);

  return (
    <NodeViewWrapper 
      className="code-editor__area" 
      style={{ margin: '2rem 0', position: 'relative' }}
      data-selected={selected}
    >
      <div
        className="pre-code-wrapper"
        style={{
          background: '#383b40',
          border: '1px solid #4a5568',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          height: dynamicHeight + 44, // header ~44px
          maxHeight: maxHeight + 44,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header with controls */}
        <div
          className="code-header"
          contentEditable={false}
          style={{
            background: '#383b40',
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid #4a5568',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              style={{
                background: '#4a5568',
                color: '#e2e8f0',
                border: 'none',
                padding: '2px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12
              }}
              title="Toggle line numbers"
            >
              #
            </button>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              style={{
                background: '#4a5568',
                color: '#e2e8f0',
                border: 'none',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12
              }}
            >
              <option value="plaintext">Plain Text</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="sql">SQL</option>
              <option value="bash">Bash</option>
            </select>
          </div>
          <button
            onClick={onCopy}
            type="button"
            style={{
              background: '#4a5568',
              color: '#e2e8f0',
              border: 'none',
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12
            }}
            title="Copy code"
          >
            📋 Copy
          </button>
        </div>

        {/* Code content with optional line numbers */}
        <div className="code-content" style={{ 
          display: 'flex', 
          background: '#383b40', 
          flex: 1,
          overflow: 'hidden',
          minHeight: 0
        }}>
          {showLineNumbers && (
            <div
              className="line-numbers"
              contentEditable={false}
              style={{
                background: '#383b40',
                color: '#cbd5e1',
                padding: '1rem 0.75rem',
                fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
                fontSize: 14,
                lineHeight: 1.6,
                userSelect: 'none',
                minWidth: '3rem',
                textAlign: 'right',
                borderRight: '1px solid #4a5568',
                whiteSpace: 'pre'
              }}
            >
              {lineNumbers}
            </div>
          )}
          <NodeViewContent
            as="pre"
            style={{
              margin: 0,
              padding: '1rem 1.5rem',
              fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
              fontSize: 14,
              lineHeight: 1.6,
              overflow: currentLines > maxLines ? 'auto' : 'hidden',
              flex: 1,
              background: '#383b40',
              color: '#e2e8f0',
              border: 'none',
              outline: 'none',
              resize: 'none',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              boxSizing: 'border-box',
              minHeight: 0
            }}
            className="hljs dark-theme"
          />
        </div>

        {/* Resize handle */}
        <div
          contentEditable={false}
          title="Drag to resize"
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startH = height;
            const onMove = (ev: MouseEvent) => {
              const newHeight = Math.max(minHeight, Math.min(maxHeight, startH + (ev.clientY - startY)));
              setHeight(newHeight);
            };
            const onUp = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
          style={{ 
            position: 'absolute', 
            right: 8, 
            bottom: 6, 
            width: 14, 
            height: 14, 
            cursor: 'ns-resize', 
            color: '#cbd5e1',
            opacity: 0.7 
          }}
        >
          ▮
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// Map TipTap document to the legacy Block[] shape for compatibility
function docToBlocks(editor: any): Block[] {
  const blocks: Block[] = [];
  if (!editor) return blocks;
  
  const { doc } = editor.state;
  let blockId = 1;
  
  doc.descendants((node: any) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level || 1;
      const text = node.textContent || '';
      blocks.push({ id: `t${blockId++}`, type: (`h${level}` as any), text });
    } else if (node.type.name === 'paragraph') {
      const text = node.textContent || '';
      blocks.push({ id: `t${blockId++}`, type: 'paragraph', text });
    } else if (node.type.name === 'blockquote') {
      blocks.push({ id: `t${blockId++}`, type: 'quote', text: node.textContent || '' });
    } else if (node.type.name === 'codeBlock') {
      blocks.push({ id: `t${blockId++}`, type: 'code', text: node.textContent || '' });
    } else if (node.type.name === 'bulletList') {
      node.forEach((li: any) => {
        const t = li.textContent || '';
        blocks.push({ id: `t${blockId++}`, type: 'bulleted', text: t });
      });
    } else if (node.type.name === 'orderedList') {
      node.forEach((li: any) => {
        const t = li.textContent || '';
        blocks.push({ id: `t${blockId++}`, type: 'numbered', text: t });
      });
    }
    return true;
  });
  
  return blocks.length ? blocks : [{ id: 't1', type: 'paragraph', text: '' }];
}

// TOC generation from document schema instead of DOM querying
function useTableOfContents(editor: any) {
  const [toc, setToc] = useState<{ id: string; text: string; level: number; pos: number }[]>([]);
  
  useEffect(() => {
    if (!editor) return;
    
    const updateToc = () => {
      const tocItems: { id: string; text: string; level: number; pos: number }[] = [];
      let headingIndex = 0;
      
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'heading') {
          const level = node.attrs.level || 1;
          const text = node.textContent || '';
          const id = `heading-${headingIndex++}`;
          tocItems.push({ id, text, level, pos });
        }
        return true;
      });
      
      setToc(tocItems);
    };
    
    // Update on content changes
    updateToc();
    editor.on('update', updateToc);
    
    return () => {
      editor.off('update', updateToc);
    };
  }, [editor]);
  
  return toc;
}

// Smart Backspace extension for removing code blocks
const SmartBackspace = Extension.create({
  name: 'smartBackspace',
  
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, dispatch } = this.editor.view;
        const { selection } = state;
        const { $from } = selection as any;
        
        // Check if we're at start of empty paragraph
        const node = $from.parent;
        const isPara = node?.type?.name === 'paragraph';
        const isEmpty = node?.content?.size === 0;
        const atStart = $from.parentOffset === 0;
        
        if (isPara && isEmpty && atStart) {
          // Find the previous node
          const before = $from.before($from.depth);
          const resolved = state.doc.resolve(before);
          const nodeBefore = (selection as any).$from.nodeBefore;
          
          if (nodeBefore && nodeBefore.type && nodeBefore.type.name === 'codeBlock') {
            // Delete the previous code block node
            const tr = state.tr.deleteRange($from.pos - nodeBefore.nodeSize, $from.pos);
            dispatch(tr);
            return true;
          }
        }
        
        return false;
      }
    };
  }
});

// Keyboard exits: Escape / Mod-Enter to exit code/quote blocks
const ExitBlockKeys = Extension.create({
  name: 'exitBlockKeys',
  addKeyboardShortcuts() {
    const exit = () => {
      const { state } = this.editor;
      const { $from } = state.selection as any;
      for (let d = $from.depth; d >= 0; d--) {
        const n = $from.node(d);
        const name = n?.type?.name;
        if (name === 'codeBlock' || name === 'blockquote') {
          const posAfter = $from.after(d);
          const paragraph = state.schema.nodes.paragraph.create();
          const tr = state.tr.insert(posAfter, paragraph);
          this.editor.view.dispatch(tr);
          // Move caret into the new paragraph after render
          setTimeout(() => {
            this.editor.chain().focus().setTextSelection(posAfter + 1).run();
          }, 0);
          return true;
        }
      }
      return false;
    };
    return {
      Escape: exit,
      'Mod-Enter': exit,
    };
  },
});

export function BlockEditor({ value, onChange, author, createdDate, updatedDate, tags, slug, theme, path }: BlockEditorProps) {
  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const now = Date.now();
    const date = new Date(dateString);
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const initialContent = useMemo(() => {
    const blocks = value || [{ id: 't1', type: 'h1', text: '' }];
    const safe = (input: string | undefined, fallback = '') => (input ?? fallback).replace(/"/g, '&quot;');
    const safeTheme = safe(theme, 'gradient-blue');
    const safeSlug = safe(slug, '');
    const safePath = safe(path, '/wiki');
    
    // Structure: H1 title -> Metadata -> Rest of content
    let html = '';
    let hasH1 = false;
    let metadataInserted = false;
    
    blocks.forEach((block, index) => {
      const blockHtml = renderBlockToHtml(block);
      html += blockHtml;
      
      // Insert metadata after first H1
      if (block.type === 'h1' && !hasH1 && !metadataInserted) {
        html += `<div data-type="metadata" data-author="${author || 'Current User'}" data-created-date="${createdDate || new Date().toISOString()}" data-updated-date="${updatedDate || new Date().toISOString()}" data-tags="${JSON.stringify(tags || []).replace(/"/g, '&quot;')}" data-slug="${safeSlug}" data-theme="${safeTheme}" data-path="${safePath}"></div>`;
        metadataInserted = true;
        hasH1 = true;
      }
    });
    
    // If no H1 found, add default structure
    if (!hasH1) {
      html = '<h1><br></h1>' +
             `<div data-type="metadata" data-author="${author || 'Current User'}" data-created-date="${createdDate || new Date().toISOString()}" data-updated-date="${updatedDate || new Date().toISOString()}" data-tags="${JSON.stringify(tags || []).replace(/"/g, '&quot;')}" data-slug="${safeSlug}" data-theme="${safeTheme}" data-path="${safePath}"></div>` + 
             '<p><br></p>' + html;
    }

    return html || '<h1><br></h1><div data-type="metadata"></div><p><br></p>';
  }, [value, author, createdDate, updatedDate, tags, slug, theme, path]);

  function renderBlockToHtml(block: Block): string {
    const text = (block.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    switch (block.type) {
      case 'h1': return `<h1>${text}</h1>`;
      case 'h2': return `<h2>${text}</h2>`;
      case 'h3': return `<h3>${text}</h3>`;
      case 'h4': return `<h4>${text}</h4>`;
      case 'h5': return `<h5>${text}</h5>`;
      case 'h6': return `<h6>${text}</h6>`;
      case 'quote': return `<blockquote><p>${text}</p></blockquote>`;
      case 'code': return `<pre><code>${text}</code></pre>`;
      case 'bulleted': return `<ul><li>${text}</li></ul>`;
      case 'numbered': return `<ol><li>${text}</li></ol>`;
      default: return `<p>${text || '<br>'}</p>`;
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false // We'll use our custom code block
      }),
      SmartBackspace,
      ExitBlockKeys,
      MetadataNode, // Add our protected metadata node
      Underline,
      Link.configure({ openOnClick: false }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            style: { default: null },
            width: { default: null },
            height: { default: null },
          } as any;
        },
      }),
      Youtube.configure({ nocookie: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: 'Start writing your wiki page...' }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        }
      }).configure({ lowlight })
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(docToBlocks(editor));
    }
  });

  const [tocOpen, setTocOpen] = useState(true);
  const tableOfContents = useTableOfContents(editor);
  // Media modal state
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [insertPos, setInsertPos] = useState<number | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<null | { pos: number; kind: 'image' | 'youtube' | 'video' }>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorSrc, setImageEditorSrc] = useState('');
  const [imageEditorPos, setImageEditorPos] = useState<number | null>(null);
  const [imageNatural, setImageNatural] = useState<{w:number,h:number}>({w:0,h:0});
  const [previewSize, setPreviewSize] = useState<{w:number,h:number}>({w:0,h:0});
  const [crop, setCrop] = useState<{x:number,y:number,w:number,h:number} | null>(null);
  const [dragState, setDragState] = useState<null | {mode:'move'|'draw', sx:number, sy:number, start?:{x:number,y:number,w:number,h:number}}>(null);

  // Helper: ensure a paragraph exists at the end and place the cursor there
  const moveCaretToEndWithParagraph = () => {
    if (!editor) return;
    const { doc, schema } = editor.state;
    const last = doc.lastChild;
    const chain = editor.chain().focus();
    if (!last || last.type.name !== 'paragraph' || last.content.size !== 0) {
      chain.insertContent({ type: 'paragraph' });
    }
    chain.setTextSelection(editor.state.doc.content.size - 1).run();
  };

  // Background click below content should create/put caret in a paragraph after blocks
  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const rect = dom.getBoundingClientRect();
    // If clicking below the rendered editor content area
    if (e.clientY > rect.bottom - 2) {
      e.preventDefault();
      moveCaretToEndWithParagraph();
    }
  };

  // DEBUGGING: No DOM manipulation - test pure Tiptap behavior
  useEffect(() => {
    if (!editor) return;
    console.log('Editor initialized:', editor);
  }, [editor]);

  // Add drag and drop support for images
  useEffect(() => {
    if (!editor) return;

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const files = event.dataTransfer?.files;
      if (!files) return;

      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target?.result as string;
            editor.chain().focus().setImage({ src }).run();
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target?.result as string;
            editor.chain().focus().insertContent(`<video controls style="max-width: 100%; height: auto;"><source src="${src}" type="${file.type}">Your browser does not support the video tag.</video>`).run();
          };
          reader.readAsDataURL(file);
        }
      });
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('drop', handleDrop);
    editorElement.addEventListener('dragover', handleDragOver);

    return () => {
      editorElement.removeEventListener('drop', handleDrop);
      editorElement.removeEventListener('dragover', handleDragOver);
    };
  }, [editor]);

  // Click to replace image/video/youtube
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const mediaEl = target.closest('img, iframe, video') as HTMLElement | null;
      if (!mediaEl) return;
      // Determine kind
      const tag = mediaEl.tagName.toLowerCase();
      const kind: 'image' | 'youtube' | 'video' = tag === 'img' ? 'image' : tag === 'iframe' ? 'youtube' : 'video';
      // Try to obtain the pos of the node under the media element
      let pos: number | null = null;
      try {
        pos = editor.view.posAtDOM(mediaEl, 0);
      } catch {}
      if (pos == null) return;
      // Set a node selection at pos to anchor updates
      try {
        editor.chain().focus().setNodeSelection(pos).run();
      } catch {}
      setReplaceTarget({ pos, kind });
      setInsertPos(pos);
      setMediaType(kind === 'image' ? 'image' : 'video');
      setMediaUrl('');
      setMediaFile(null);
      setMediaError('');
      setMediaOpen(true);
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor]);

  // Double-click to open image editor (crop/resize)
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onDbl = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const img = target.closest('img') as HTMLImageElement | null;
      if (!img) return;
      e.preventDefault();
      let pos: number | null = null;
      try { pos = editor.view.posAtDOM(img, 0); } catch {}
      if (pos == null) return;
      setImageEditorPos(pos);
      setImageEditorSrc(img.src);
      const tmp = new window.Image();
      tmp.onload = () => {
        const nw = tmp.naturalWidth || tmp.width;
        const nh = tmp.naturalHeight || tmp.height;
        setImageNatural({ w: nw, h: nh });
        const maxW = Math.min(800, Math.floor(window.innerWidth * 0.9));
        const scale = Math.min(1, maxW / nw);
        const pw = Math.round(nw * scale);
        const ph = Math.round(nh * scale);
        setPreviewSize({ w: pw, h: ph });
        setCrop({ x: 0, y: 0, w: pw, h: ph });
        setImageEditorOpen(true);
      };
      tmp.src = img.src;
    };
    dom.addEventListener('dblclick', onDbl);
    return () => dom.removeEventListener('dblclick', onDbl);
  }, [editor]);

  // Expose editor functions for toolbar compatibility - exact same API as before
  useEffect(() => {
    if (!editor) return;
    
    (window as any).blockEditorActions = {
      execCommand: (cmd: string, value?: string) => {
        const chain = editor.chain().focus();
        switch (cmd) {
          case 'bold':
            return chain.toggleBold().run();
          case 'italic':
            return chain.toggleItalic().run();
          case 'underline':
            return chain.toggleUnderline().run();
          case 'strikeThrough':
            return chain.toggleStrike().run();
          case 'subscript':
            return chain.toggleSubscript().run();
          case 'superscript':
            return chain.toggleSuperscript().run();
          case 'justifyLeft':
            return chain.setTextAlign('left').run();
          case 'justifyCenter':
            return chain.setTextAlign('center').run();
          case 'justifyRight':
            return chain.setTextAlign('right').run();
          case 'justifyFull':
            return chain.setTextAlign('justify').run();
          case 'undo':
            return editor.commands.undo();
          case 'redo':
            return editor.commands.redo();
          case 'createLink':
            if (value) return chain.setLink({ href: value }).run();
            return false;
          default:
            return false;
        }
      },
      
      handleBlockFormat: (tag: string) => {
        const t = tag.toLowerCase();
        const chain = editor.chain().focus();
        if (t.startsWith('h')) {
          const level = parseInt(t.replace('h', ''), 10) || 1;
          return chain.toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
        }
        return false;
      },
      
      insertLink: () => {
        if (!editor.isFocused) editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
        const url = prompt('Enter URL:');
        if (!url) return false;
        return editor.chain().focus().setLink({ href: url }).run();
      },
      
      insertImage: () => {
        if (!editor.isFocused) editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
        const choice = prompt('Choose image source:\n1. Enter "url" for web URL\n2. Enter "upload" for local file\n3. Press Cancel to abort');
        
        if (choice?.toLowerCase() === 'url') {
          const src = prompt('Enter image URL:');
          if (!src) return false;
          return editor.chain().focus().setImage({ src }).run();
        } else if (choice?.toLowerCase() === 'upload') {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const src = event.target?.result as string;
                editor.chain().focus().setImage({ src }).run();
              };
              reader.readAsDataURL(file);
            }
          };
          input.click();
          return true;
        }
        return false;
      },
      
      insertCodeBlock: () => editor.chain().focus().setCodeBlock().run(),
      insertCodeBlockAdvanced: () => {
        if (!editor.isFocused) editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
        return editor.chain().focus().setCodeBlock().run();
      },
      
      insertImageAdvanced: () => {
        const pos = editor.state.selection.from;
        setInsertPos(pos);
        if (!editor.isFocused) editor.chain().focus().setTextSelection(pos).run();
        setMediaType('image');
        setMediaUrl('');
        setMediaFile(null);
        setMediaError('');
        setMediaOpen(true);
        return true;
      },
      
      insertVideoAdvanced: () => {
        const pos = editor.state.selection.from;
        setInsertPos(pos);
        if (!editor.isFocused) editor.chain().focus().setTextSelection(pos).run();
        setMediaType('video');
        setMediaUrl('');
        setMediaFile(null);
        setMediaError('');
        setMediaOpen(true);
        return true;
      },
      
      insertQuoteBlock: () => {
        if (!editor.isFocused) editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
        return editor.chain().focus().toggleBlockquote().run();
      },
      insertHorizontalRule: () => {
        if (!editor.isFocused) editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
        return editor.chain().focus().insertContent('<hr>').run();
      },
      insertSpacing: () => {
        if (!editor.isFocused) editor.chain().focus().setTextSelection(editor.state.doc.content.size - 1).run();
        return editor.chain().focus().insertContent('<p><br></p>').run();
      },
      
      indentContent: () => {
        // List indent if inside list
        const { state } = editor;
        const { selection } = state;
        const name = (selection as any).$from.parent.type.name;
        if (name === 'listItem') return editor.chain().focus().sinkListItem('listItem').run();
        return false;
      },
      
      outdentContent: () => {
        const { state } = editor;
        const { selection } = state;
        const name = (selection as any).$from.parent.type.name;
        if (name === 'listItem') return editor.chain().focus().liftListItem('listItem').run();
        return false;
      },
      
      isFormatActive: (cmd: string) => {
        switch (cmd) {
          case 'bold':
            return editor.isActive('bold');
          case 'italic':
            return editor.isActive('italic');
          case 'underline':
            return editor.isActive('underline');
          case 'strikeThrough':
            return editor.isActive('strike');
          default:
            return false;
        }
      },
      
      toggleList: (listType: 'ul' | 'ol') => {
        const chain = editor.chain().focus();
        if (listType === 'ul') return chain.toggleBulletList().run();
        return chain.toggleOrderedList().run();
      }
    };
  }, [editor]);

  return (
    <div className="w-full h-full flex">
      {/* Table of Contents Sidebar - exact same layout */}
      <div className={`${tocOpen ? 'w-64' : 'w-12'} flex-shrink-0 bg-white transition-all duration-300 flex flex-col relative`}>
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-300"></div>
        <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
            title={tocOpen ? 'Collapse TOC' : 'Expand TOC'}
          >
            {tocOpen ? <ChevronDown className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          {tocOpen && <span className="text-sm font-normal text-gray-700">Table of Contents</span>}
        </div>
        {tocOpen && (
          <div className="flex-1 overflow-y-auto p-3">
            {tableOfContents.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">Add headings to see table of contents</div>
            ) : (
              <div className="space-y-1">
                {tableOfContents.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      if (!editor) return;
                      editor.chain().setTextSelection(h.pos).run();
                      editor.commands.scrollIntoView();
                    }}
                    className={`w-full text-left text-xs p-2 rounded hover:bg-white transition-colors ${
                      h.level === 1
                        ? 'font-normal text-gray-800'
                        : h.level === 2
                        ? 'font-normal text-gray-700 ml-2'
                        : 'text-gray-600 ml-4'
                    }`}
                    style={{ paddingLeft: `${(h.level - 1) * 0.5 + 0.5}rem` }}
                  >
                    {h.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Editor Area - Free-flow editing with integrated metadata node */}
      <div className="flex-1 flex flex-col bg-white min-h-0">
        <div 
          className="flex-1 w-full p-8 outline-none border-0 overflow-y-auto editor-content focus:bg-white transition-all duration-300"
          onMouseDown={onBackgroundMouseDown}
        >
        <EditorContent
          editor={editor}
          className="min-h-full cursor-text"
          style={{
            fontSize: '16px',
            lineHeight: '1.7',
            fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
            minHeight: 'calc(100vh - 200px)',
          }}
        />
        {mediaOpen && createPortal(
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[10000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMediaOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-4 z-[10001]">
              <div className="mb-3">
                <h3 className="text-sm font-normal text-gray-800">Insert {mediaType === 'image' ? 'Image' : 'Video'}</h3>
                <p className="text-xs text-gray-500">Choose a file or paste a URL</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-normal text-gray-700">From device</label>
                  <input
                    type="file"
                    accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                    onChange={(e) => {
                      const f = (e.target as HTMLInputElement).files?.[0] || null;
                      setMediaFile(f);
                      if (f) setMediaUrl('');
                      setMediaError('');
                    }}
                    className="block w-full text-xs text-gray-700 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-normal text-gray-700">From URL</label>
                  <input
                    type="url"
                    placeholder={mediaType === 'image' ? 'https://example.com/image.png' : 'https://youtu.be/... or https://example.com/video.mp4'}
                    value={mediaUrl}
                    onChange={(e) => {
                      setMediaUrl(e.target.value);
                      if (e.target.value) setMediaFile(null);
                      setMediaError('');
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {mediaError && <div className="text-xs text-red-600">{mediaError}</div>}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button className="px-3 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => setMediaOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      if (!editor) return;
                      const getChainAtInsertPos = () => {
                        const chain = editor.chain().focus();
                        if (insertPos != null) return chain.setTextSelection(insertPos);
                        return chain.setTextSelection(editor.state.doc.content.size - 1);
                      };
                      const finish = () => {
                        setMediaOpen(false);
                        setMediaUrl('');
                        setMediaFile(null);
                        setMediaError('');
                        setReplaceTarget(null);
                        setInsertPos(null);
                      };
                      const doImage = (src: string) => {
                        if (replaceTarget && replaceTarget.kind === 'image') {
                          editor.chain().focus().setTextSelection(replaceTarget.pos).updateAttributes('image', { src }).run();
                        } else if (replaceTarget) {
                          // Replace different media node with image
                          const { state, view } = editor;
                          const node = state.doc.nodeAt(replaceTarget.pos);
                          if (node) {
                            const tr = state.tr.deleteRange(replaceTarget.pos, replaceTarget.pos + node.nodeSize);
                            view.dispatch(tr);
                          }
                          editor.chain().focus().setTextSelection(replaceTarget.pos).setImage({ src }).run();
                        } else {
                          getChainAtInsertPos().setImage({ src }).run();
                        }
                        finish();
                      };
                      const doVideoUrl = (url: string) => {
                        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
                        if (yt) {
                          if (replaceTarget && replaceTarget.kind === 'youtube') {
                            editor.chain().focus().setTextSelection(replaceTarget.pos).updateAttributes('youtube', { src: url }).run();
                          } else if (replaceTarget) {
                            const { state, view } = editor;
                            const node = state.doc.nodeAt(replaceTarget.pos);
                            if (node) {
                              const tr = state.tr.deleteRange(replaceTarget.pos, replaceTarget.pos + node.nodeSize);
                              view.dispatch(tr);
                            }
                            editor.chain().focus().setTextSelection(replaceTarget.pos).setYoutubeVideo({ src: url }).run();
                          } else {
                            getChainAtInsertPos().setYoutubeVideo({ src: url }).run();
                          }
                        } else {
                          const html = `<video controls style=\"max-width: 100%; height: auto;\"><source src=\"${url}\" type=\"video/mp4\">Your browser does not support the video tag.</video>`;
                          if (replaceTarget) {
                            const { state, view } = editor;
                            const node = state.doc.nodeAt(replaceTarget.pos);
                            if (node) {
                              const tr = state.tr.deleteRange(replaceTarget.pos, replaceTarget.pos + node.nodeSize);
                              view.dispatch(tr);
                            }
                            editor.chain().focus().setTextSelection(replaceTarget.pos).insertContent(html).run();
                          } else {
                            getChainAtInsertPos().insertContent(html).run();
                          }
                        }
                        finish();
                      };
                      if (mediaFile) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const src = event.target?.result as string;
                          if (mediaType === 'image') doImage(src);
                          else doVideoUrl(src);
                        };
                        reader.readAsDataURL(mediaFile);
                        return;
                      }
                      if (mediaUrl && mediaUrl.trim() !== '') {
                        if (mediaType === 'image') doImage(mediaUrl.trim());
                        else doVideoUrl(mediaUrl.trim());
                        return;
                      }
                      setMediaError('Please select a file or provide a valid URL.');
                    }}
                  >
                    Insert
                  </button>
                </div>
              </div>
            </div>
          </div>
        , document.body)}
        {imageEditorOpen && createPortal(
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[10000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setImageEditorOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl p-4 z-[10001]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-normal text-gray-800">Edit Image</h3>
                  <p className="text-xs text-gray-500">Drag to select crop area. Adjust width if needed.</p>
                </div>
              </div>
              <div
                className="relative bg-gray-50 border rounded"
                style={{ width: previewSize.w, height: previewSize.h, margin: '0 auto', userSelect: 'none' }}
                onMouseDown={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = Math.max(0, Math.min(previewSize.w, e.clientX - rect.left));
                  const y = Math.max(0, Math.min(previewSize.h, e.clientY - rect.top));
                  if (crop && x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h) {
                    setDragState({ mode: 'move', sx: x, sy: y, start: { ...crop } });
                  } else {
                    setCrop({ x, y, w: 0, h: 0 });
                    setDragState({ mode: 'draw', sx: x, sy: y });
                  }
                }}
                onMouseMove={(e) => {
                  if (!dragState) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = Math.max(0, Math.min(previewSize.w, e.clientX - rect.left));
                  const y = Math.max(0, Math.min(previewSize.h, e.clientY - rect.top));
                  if (dragState.mode === 'draw') {
                    const nx = Math.min(dragState.sx, x);
                    const ny = Math.min(dragState.sy, y);
                    const nw = Math.abs(x - dragState.sx);
                    const nh = Math.abs(y - dragState.sy);
                    setCrop({ x: nx, y: ny, w: nw, h: nh });
                  } else if (dragState.mode === 'move' && dragState.start && crop) {
                    const dx = x - dragState.sx;
                    const dy = y - dragState.sy;
                    const nx = Math.max(0, Math.min(previewSize.w - crop.w, dragState.start.x + dx));
                    const ny = Math.max(0, Math.min(previewSize.h - crop.h, dragState.start.y + dy));
                    setCrop({ ...crop, x: nx, y: ny });
                  }
                }}
                onMouseUp={() => setDragState(null)}
                onMouseLeave={() => setDragState(null)}
              >
                {/* Preview image */}
                <img src={imageEditorSrc} alt="preview" style={{ width: previewSize.w, height: previewSize.h, display: 'block' }} />
                {/* Crop overlay */}
                {crop && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500/10"
                    style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                  />
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-3">
                <button className="px-3 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => setImageEditorOpen(false)}>
                  Cancel
                </button>
                <button
                  className="px-3 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700"
                  onClick={() => {
                    if (!editor || !imageEditorPos || !crop) return;
                    // Render cropped image onto canvas at natural resolution
                    const scale = imageNatural.w / previewSize.w;
                    const sx = Math.round(crop.x * scale);
                    const sy = Math.round(crop.y * scale);
                    const sw = Math.round(crop.w * scale);
                    const sh = Math.round(crop.h * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, sw);
                    canvas.height = Math.max(1, sh);
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    const img = new window.Image();
                    img.onload = () => {
                      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
                      const dataUrl = canvas.toDataURL('image/png');
                      editor.chain().focus().setTextSelection(imageEditorPos).updateAttributes('image', { src: dataUrl }).run();
                      setImageEditorOpen(false);
                    };
                    img.crossOrigin = 'anonymous';
                    img.src = imageEditorSrc;
                  }}
                >
                  Apply Crop
                </button>
                <button
                  className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    if (!editor || !imageEditorPos) return;
                    // Simple resize to width via style (in px) based on preview width
                    const newWidthPx = previewSize.w; // as displayed
                    editor.chain().focus().setTextSelection(imageEditorPos).updateAttributes('image', { style: `width: ${newWidthPx}px` }).run();
                    setImageEditorOpen(false);
                  }}
                >
                  Apply Resize
                </button>
              </div>
            </div>
          </div>
        , document.body)}
      </div>
      </div>
    </div>
  );
}
