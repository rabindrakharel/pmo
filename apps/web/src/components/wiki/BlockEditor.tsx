import React, { useRef, useCallback, useState, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Code,
  Minus,
  Link,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Type,
  Image,
  Video,
  Youtube,
  Menu,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import './editor.css';

// Block type definition to match your existing WikiEditorPage
export interface Block {
  id: string;
  type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'bulleted' | 'numbered' | 'quote' | 'code';
  text: string;
}

export interface BlockEditorProps {
  value: Block[];
  onChange: (blocks: Block[]) => void;
  onToolbarAction?: (action: string, value?: string) => void;
}

export interface BlockEditorRef {
  execCommand: (command: string, value?: string) => boolean;
  handleBlockFormat: (tag: string) => void;
  insertLink: () => void;
  insertImage: () => void;
  insertCodeBlock: () => void;
  isFormatActive: (command: string) => boolean;
}

// Convert blocks to HTML for saving
export function renderBlocksToHtml(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'h1': return `<h1>${block.text}</h1>`;
      case 'h2': return `<h2>${block.text}</h2>`;
      case 'h3': return `<h3>${block.text}</h3>`;
      case 'h4': return `<h4>${block.text}</h4>`;
      case 'h5': return `<h5>${block.text}</h5>`;
      case 'h6': return `<h6>${block.text}</h6>`;
      case 'quote': return `<blockquote>${block.text}</blockquote>`;
      case 'code': return `<pre><code>${block.text}</code></pre>`;
      case 'bulleted': return `<ul><li>${block.text}</li></ul>`;
      case 'numbered': return `<ol><li>${block.text}</li></ol>`;
      default: return `<p>${block.text}</p>`;
    }
  }).join('\n');
}

// Convert HTML to blocks (for loading)
function htmlToBlocks(html: string): Block[] {
  if (!html || html.trim() === '<p>Start writing your wiki page...</p>') {
    return [{ id: 't1', type: 'paragraph', text: '' }];
  }
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const blocks: Block[] = [];
  const elements = tempDiv.children;
  
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent || '';
    
    let blockType: Block['type'] = 'paragraph';
    
    switch (tagName) {
      case 'h1': blockType = 'h1'; break;
      case 'h2': blockType = 'h2'; break;
      case 'h3': blockType = 'h3'; break;
      case 'h4': blockType = 'h4'; break;
      case 'h5': blockType = 'h5'; break;
      case 'h6': blockType = 'h6'; break;
      case 'blockquote': blockType = 'quote'; break;
      case 'pre': blockType = 'code'; break;
      case 'ul': blockType = 'bulleted'; break;
      case 'ol': blockType = 'numbered'; break;
      default: blockType = 'paragraph';
    }
    
    // Handle list items
    if (tagName === 'ul' || tagName === 'ol') {
      const listItems = element.querySelectorAll('li');
      listItems.forEach((li, index) => {
        blocks.push({
          id: `t${blocks.length + 1}`,
          type: tagName === 'ul' ? 'bulleted' : 'numbered',
          text: li.textContent || ''
        });
      });
    } else {
      blocks.push({
        id: `t${blocks.length + 1}`,
        type: blockType,
        text: text
      });
    }
  }
  
  return blocks.length > 0 ? blocks : [{ id: 't1', type: 'paragraph', text: '' }];
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ 
  onClick, 
  isActive = false, 
  disabled = false, 
  title, 
  children 
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-2 rounded-md border transition-all duration-200 text-sm font-medium
      ${isActive 
        ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm' 
        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    {children}
  </button>
);

const ToolbarDivider: React.FC = () => (
  <div className="w-px h-6 bg-gray-300 mx-1" />
);

export function BlockEditor({ value, onChange, onToolbarAction }: BlockEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const [tableOfContents, setTableOfContents] = useState<{id: string, text: string, level: number}[]>([]);

  // Ensure editor has proper content structure
  const ensureValidContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    // If editor is empty, add a paragraph
    if (!editor.innerHTML.trim() || editor.innerHTML === '<br>') {
      editor.innerHTML = '<p><br></p>';
    }
    
    // Ensure all empty paragraphs have <br> tags
    const emptyPs = editor.querySelectorAll('p:empty');
    emptyPs.forEach(p => {
      p.innerHTML = '<br>';
    });
  }, []);

  // Get current selection
  const getCurrentSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const editor = editorRef.current;
    if (!editor || !editor.contains(range.commonAncestorContainer)) return null;
    
    return { selection, range };
  }, []);

  // Initialize editor with blocks content
  useEffect(() => {
    if (!editorRef.current || isInitialized) return;
    
    const html = renderBlocksToHtml(value);
    if (html.trim()) {
      editorRef.current.innerHTML = html;
    } else {
      editorRef.current.innerHTML = '<p><br></p>';
      // Set cursor focus to start typing immediately
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          const range = document.createRange();
          const selection = window.getSelection();
          const firstP = editorRef.current.querySelector('p');
          if (firstP) {
            range.setStart(firstP, 0);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }, 100);
    }
    
    ensureValidContent();
    setIsInitialized(true);
  }, [value, isInitialized, ensureValidContent]);

  // Update table of contents
  const updateTableOfContents = useCallback(() => {
    if (!editorRef.current) return;
    
    const headings = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const toc = Array.from(headings).map((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      const text = heading.textContent || '';
      const id = `heading-${index}`;
      heading.id = id; // Add ID for navigation
      return { id, text, level };
    });
    setTableOfContents(toc);
  }, []);

  // Handle content changes and convert back to blocks
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    
    ensureValidContent();
    updateTableOfContents();
    
    const html = editorRef.current.innerHTML;
    const newBlocks = htmlToBlocks(html);
    onChange(newBlocks);
  }, [onChange, ensureValidContent, updateTableOfContents]);

  // Execute formatting commands
  const execCommand = useCallback((command: string, value?: string) => {
    // Focus editor first
    editorRef.current?.focus();
    
    // Execute the command
    const success = document.execCommand(command, false, value);
    
    // Force update and maintain focus
    setTimeout(() => {
      handleInput();
      editorRef.current?.focus();
    }, 10);
    
    return success;
  }, [handleInput]);

  // Check if a format is active
  const isFormatActive = useCallback((command: string): boolean => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }, []);

  // Handle block format changes
  const handleBlockFormat = useCallback((tag: string) => {
    // Focus the editor first
    editorRef.current?.focus();
    
    // Use formatBlock with proper tag format
    const formattedTag = tag.startsWith('<') ? tag : `<${tag}>`;
    document.execCommand('formatBlock', false, formattedTag);
    
    // Force update
    setTimeout(() => {
      handleInput();
      editorRef.current?.focus();
    }, 10);
  }, [handleInput]);

  // Insert special elements
  const insertElement = useCallback((html: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    while (div.firstChild) {
      range.insertNode(div.firstChild);
    }
    
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    handleInput();
    editorRef.current?.focus();
  }, [handleInput]);

  const insertHorizontalRule = useCallback(() => {
    insertElement('<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">');
  }, [insertElement]);

  const insertCodeBlock = useCallback(() => {
    const code = prompt('Enter your code:');
    if (!code) return;
    
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const codeHtml = `
      <pre style="
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #3b82f6;
        border-radius: 6px;
        padding: 16px;
        margin: 16px 0;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 14px;
        line-height: 1.5;
        overflow-x: auto;
        white-space: pre-wrap;
      "><code>${escapedCode}</code></pre>
    `;
    
    insertElement(codeHtml);
  }, [insertElement]);

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (!url) return;
    execCommand('createLink', url);
  }, [execCommand]);

  // Insert image with alignment options
  const insertImage = useCallback(() => {
    const imageUrl = prompt('Enter image URL:');
    if (!imageUrl) return;
    
    const alignment = prompt('Choose alignment (left/center/right):', 'center')?.toLowerCase() || 'center';
    const altText = prompt('Enter alt text (optional):') || 'Image';
    
    const editor = editorRef.current;
    if (!editor) return;
    
    editor.focus();
    const selection = getCurrentSelection();
    if (!selection) return;
    
    // Create image container
    const container = document.createElement('div');
    container.className = 'image-container';
    container.style.cssText = `
      margin: 1.5rem 0;
      text-align: ${alignment};
    `;
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = altText;
    img.style.cssText = `
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: inline-block;
    `;
    
    container.appendChild(img);
    
    selection.range.deleteContents();
    selection.range.insertNode(container);
    
    // Add paragraph after image
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    container.parentNode?.insertBefore(p, container.nextSibling);
    
    handleInput();
  }, [getCurrentSelection, handleInput]);

  // Insert video
  const insertVideo = useCallback(() => {
    const videoUrl = prompt('Enter video URL (mp4, webm, etc.):');
    if (!videoUrl) return;
    
    const alignment = prompt('Choose alignment (left/center/right):', 'center')?.toLowerCase() || 'center';
    
    const editor = editorRef.current;
    if (!editor) return;
    
    editor.focus();
    const selection = getCurrentSelection();
    if (!selection) return;
    
    const container = document.createElement('div');
    container.className = 'video-container';
    container.style.cssText = `
      margin: 1.5rem 0;
      text-align: ${alignment};
    `;
    
    const video = document.createElement('video');
    video.src = videoUrl;
    video.controls = true;
    video.style.cssText = `
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: inline-block;
    `;
    
    container.appendChild(video);
    
    selection.range.deleteContents();
    selection.range.insertNode(container);
    
    // Add paragraph after video
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    container.parentNode?.insertBefore(p, container.nextSibling);
    
    handleInput();
  }, [getCurrentSelection, handleInput]);

  // Insert YouTube video
  const insertYouTube = useCallback(() => {
    const youtubeUrl = prompt('Enter YouTube URL:');
    if (!youtubeUrl) return;
    
    const alignment = prompt('Choose alignment (left/center/right):', 'center')?.toLowerCase() || 'center';
    
    // Extract video ID from YouTube URL
    const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (!videoId) {
      alert('Invalid YouTube URL. Please use a valid YouTube link.');
      return;
    }
    
    const editor = editorRef.current;
    if (!editor) return;
    
    editor.focus();
    const selection = getCurrentSelection();
    if (!selection) return;
    
    const container = document.createElement('div');
    container.className = 'youtube-container';
    container.style.cssText = `
      margin: 1.5rem 0;
      text-align: ${alignment};
    `;
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId[1]}`;
    iframe.width = '560';
    iframe.height = '315';
    iframe.frameBorder = '0';
    iframe.allowFullscreen = true;
    iframe.style.cssText = `
      max-width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: inline-block;
    `;
    
    container.appendChild(iframe);
    
    selection.range.deleteContents();
    selection.range.insertNode(container);
    
    // Add paragraph after video
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    container.parentNode?.insertBefore(p, container.nextSibling);
    
    handleInput();
  }, [getCurrentSelection, handleInput]);

  // Modern list handling with proper functionality
  const toggleList = useCallback((listType: 'ul' | 'ol') => {
    const editor = editorRef.current;
    if (!editor) return;
    
    editor.focus();
    
    // First try the standard execCommand approach
    const command = listType === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
    
    try {
      const success = document.execCommand(command, false);
      if (success) {
        setTimeout(() => handleInput(), 10);
        return;
      }
    } catch (e) {
      console.warn('execCommand failed for list, using fallback');
    }
    
    // Fallback: Manual list creation with proper DOM manipulation
    const selection = getCurrentSelection();
    if (!selection) return;
    
    // Create new list
    const listElement = document.createElement(listType);
    const listItem = document.createElement('li');
    
    const selectedText = selection.range.toString();
    if (selectedText) {
      listItem.textContent = selectedText;
    } else {
      listItem.innerHTML = '<br>';
    }
    
    listElement.appendChild(listItem);
    
    selection.range.deleteContents();
    selection.range.insertNode(listElement);
    
    // Place cursor at end of list item
    const newRange = document.createRange();
    newRange.setStart(listItem, listItem.childNodes.length);
    newRange.collapse(true);
    selection.selection.removeAllRanges();
    selection.selection.addRange(newRange);
    
    handleInput();
  }, [getCurrentSelection, handleInput]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      execCommand('bold');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      execCommand('italic');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      execCommand('underline');
    }
  }, [execCommand]);

  // Expose editor functions to parent component
  React.useEffect(() => {
    if (onToolbarAction) {
      // Set up a global reference for toolbar actions
      (window as any).blockEditorActions = {
        execCommand,
        handleBlockFormat,
        insertLink,
        insertImage,
        insertCodeBlock,
        isFormatActive,
        toggleList
      };
    }
  }, [onToolbarAction, execCommand, handleBlockFormat, insertLink, insertImage, insertCodeBlock, isFormatActive, toggleList]);

  return (
    <div className="w-full h-full flex">
      {/* Table of Contents Sidebar */}
      <div className={`${tocOpen ? 'w-64' : 'w-12'} flex-shrink-0 bg-gradient-to-b from-gray-50 to-gray-100/50 transition-all duration-300 flex flex-col relative`}>
        {/* Elegant vertical separator */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
        {/* TOC Header */}
        <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
            title={tocOpen ? 'Collapse TOC' : 'Expand TOC'}
          >
            {tocOpen ? <ChevronDown className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          {tocOpen && (
            <span className="text-sm font-semibold text-gray-700">Table of Contents</span>
          )}
        </div>
        
        {/* TOC Content */}
        {tocOpen && (
          <div className="flex-1 overflow-y-auto p-3">
            {tableOfContents.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">
                Add headings to see table of contents
              </div>
            ) : (
              <div className="space-y-1">
                {tableOfContents.map((heading) => (
                  <button
                    key={heading.id}
                    onClick={() => {
                      const element = document.getElementById(heading.id);
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`w-full text-left text-xs p-2 rounded hover:bg-white transition-colors ${
                      heading.level === 1 ? 'font-semibold text-gray-800' :
                      heading.level === 2 ? 'font-medium text-gray-700 ml-2' :
                      'text-gray-600 ml-4'
                    }`}
                    style={{ paddingLeft: `${(heading.level - 1) * 0.5 + 0.5}rem` }}
                  >
                    {heading.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Toolbar - Fixed height */}
        <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
          {/* Block Formats */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => handleBlockFormat('H1')}
              title="Heading 1"
            >
              <span className="text-xs font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleBlockFormat('H2')}
              title="Heading 2"
            >
              <span className="text-xs font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleBlockFormat('H3')}
              title="Heading 3"
            >
              <span className="text-xs font-bold">H3</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => handleBlockFormat('P')}
              title="Paragraph"
            >
              <span className="text-xs">P</span>
            </ToolbarButton>
          </div>

          <ToolbarDivider />

          {/* Text Formatting */}
          <ToolbarButton
            onClick={() => execCommand('bold')}
            isActive={isFormatActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => execCommand('italic')}
            isActive={isFormatActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => execCommand('underline')}
            isActive={isFormatActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton
            onClick={() => toggleList('ul')}
            isActive={isFormatActive('insertUnorderedList')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => toggleList('ol')}
            isActive={isFormatActive('insertOrderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Alignment */}
          <ToolbarButton
            onClick={() => execCommand('justifyLeft')}
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => execCommand('justifyCenter')}
            title="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => execCommand('justifyRight')}
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Special Elements */}
          <ToolbarButton
            onClick={() => handleBlockFormat('BLOCKQUOTE')}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={insertCodeBlock}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={insertHorizontalRule}
            title="Horizontal Line"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Links */}
          <ToolbarButton
            onClick={insertLink}
            title="Insert Link"
          >
            <Link className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => execCommand('unlink')}
            title="Remove Link"
          >
            <Unlink className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarDivider />
          
          {/* Media */}
          <ToolbarButton
            onClick={insertImage}
            title="Insert Image"
          >
            <Image className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={insertVideo}
            title="Insert Video"
          >
            <Video className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={insertYouTube}
            title="Insert YouTube Video"
          >
            <Youtube className="h-4 w-4" />
          </ToolbarButton>
          </div>
        </div>

      {/* Editor Content - Takes remaining space */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="flex-1 w-full p-8 outline-none border-0 overflow-y-auto editor-content focus:bg-white transition-all duration-300"
          style={{
            fontSize: '16px',
            lineHeight: '1.7',
            fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
            minHeight: 'calc(100vh - 200px)',
            boxShadow: 'none'
          }}
          data-placeholder="Start writing your wiki page..."
        />
        
        {/* Help Text - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          💡 Use keyboard shortcuts: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline) • Click H1/H2/H3 to format text • All formatting tools are working
        </div>
      </div>
      </div>
    </div>
  );
}