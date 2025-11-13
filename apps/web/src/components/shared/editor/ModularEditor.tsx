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
  Type
} from 'lucide-react';

export interface ModularEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  height?: number;
  disabled?: boolean;
  className?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

interface ToolbarSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

// Modular Toolbar Components
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
        ? 'bg-dark-100 border-dark-500 text-dark-700 shadow-sm' 
        : 'bg-dark-100 border-dark-400 text-dark-600 hover:bg-dark-100 hover:border-dark-400'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    {children}
  </button>
);

const ToolbarSelect: React.FC<ToolbarSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  disabled = false 
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className="px-3 py-2.5 border border-dark-300 rounded-md text-sm bg-dark-100 text-dark-600 hover:border-dark-400 focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500"
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const ToolbarDivider: React.FC = () => (
  <div className="w-px h-6 bg-dark-300 mx-1" />
);

// Main Modular Editor Component
export const ModularEditor: React.FC<ModularEditorProps> = ({
  value,
  onChange,
  placeholder = "Start writing...",
  height = 400,
  disabled = false,
  className = ""
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [currentTag, setCurrentTag] = useState('P');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize editor content
  useEffect(() => {
    if (!editorRef.current || isInitialized) return;
    
    if (value) {
      editorRef.current.innerHTML = value;
    } else {
      editorRef.current.innerHTML = `<p>${placeholder}</p>`;
    }
    setIsInitialized(true);
  }, [value, placeholder, isInitialized]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (!editorRef.current || disabled) return;
    
    const content = editorRef.current.innerHTML;
    onChange(content);
  }, [onChange, disabled]);

  // Execute formatting commands
  const execCommand = useCallback((command: string, value?: string) => {
    if (disabled) return;
    
    document.execCommand(command, false, value);
    handleInput();
    editorRef.current?.focus();
  }, [disabled, handleInput]);

  // Check if a format is active
  const isFormatActive = useCallback((command: string): boolean => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }, []);

  // Handle heading/paragraph changes
  const handleBlockFormat = useCallback((tag: string) => {
    execCommand('formatBlock', tag);
    setCurrentTag(tag);
  }, [execCommand]);

  // Insert custom elements
  const insertElement = useCallback((html: string) => {
    if (disabled) return;
    
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    while (div.firstChild) {
      range.insertNode(div.firstChild);
    }
    
    // Move cursor after inserted element
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    handleInput();
    editorRef.current?.focus();
  }, [disabled, handleInput]);

  // Insert horizontal rule
  const insertHorizontalRule = useCallback(() => {
    insertElement('<hr style="margin: 20px 0; border: none; border-top: 2px solid #e5e7eb;">');
  }, [insertElement]);

  // Insert code block
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

  // Insert blockquote
  const insertBlockquote = useCallback(() => {
    execCommand('formatBlock', 'BLOCKQUOTE');
  }, [execCommand]);

  // Insert link
  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (!url) return;
    execCommand('createLink', url);
  }, [execCommand]);

  // Handle key shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    // Cmd/Ctrl + B for bold
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      execCommand('bold');
    }
    // Cmd/Ctrl + I for italic
    else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      execCommand('italic');
    }
    // Cmd/Ctrl + U for underline
    else if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      execCommand('underline');
    }
  }, [disabled, execCommand]);

  // Track selection changes for toolbar state
  const handleSelectionChange = useCallback(() => {
    if (disabled) return;
    
    try {
      const selection = window.getSelection();
      if (selection?.anchorNode) {
        const parentElement = selection.anchorNode.parentElement;
        if (parentElement) {
          const tagName = parentElement.tagName || 'P';
          setCurrentTag(tagName);
        }
      }
    } catch {
      // Ignore selection errors
    }
  }, [disabled]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const blockFormatOptions = [
    { value: 'P', label: 'Paragraph' },
    { value: 'H1', label: 'Heading 1' },
    { value: 'H2', label: 'Heading 2' },
    { value: 'H3', label: 'Heading 3' },
    { value: 'H4', label: 'Heading 4' },
    { value: 'H5', label: 'Heading 5' },
    { value: 'H6', label: 'Heading 6' },
  ];

  return (
    <div className={`border border-dark-400 rounded-md bg-dark-100 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-dark-100 border-b border-dark-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Type className="h-4 w-4 text-dark-700" />
          <span className="text-sm font-normal text-dark-600">Rich Text Editor</span>
        </div>
        <div className="text-xs text-dark-700">
          {disabled ? 'Read-only' : 'Modular Editor'}
        </div>
      </div>

      {/* Modular Toolbar */}
      {!disabled && (
        <div className="bg-dark-100 border-b border-dark-300 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Block Format */}
            <ToolbarSelect
              value={currentTag}
              onChange={handleBlockFormat}
              options={blockFormatOptions}
              disabled={disabled}
            />
            
            <ToolbarDivider />

            {/* Text Formatting */}
            <ToolbarButton
              onClick={() => execCommand('bold')}
              isActive={isFormatActive('bold')}
              disabled={disabled}
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => execCommand('italic')}
              isActive={isFormatActive('italic')}
              disabled={disabled}
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => execCommand('underline')}
              isActive={isFormatActive('underline')}
              disabled={disabled}
              title="Underline (Ctrl+U)"
            >
              <Underline className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Lists */}
            <ToolbarButton
              onClick={() => execCommand('insertUnorderedList')}
              isActive={isFormatActive('insertUnorderedList')}
              disabled={disabled}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => execCommand('insertOrderedList')}
              isActive={isFormatActive('insertOrderedList')}
              disabled={disabled}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Alignment */}
            <ToolbarButton
              onClick={() => execCommand('justifyLeft')}
              disabled={disabled}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => execCommand('justifyCenter')}
              disabled={disabled}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => execCommand('justifyRight')}
              disabled={disabled}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Special Elements */}
            <ToolbarButton
              onClick={insertBlockquote}
              disabled={disabled}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertCodeBlock}
              disabled={disabled}
              title="Code Block"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={insertHorizontalRule}
              disabled={disabled}
              title="Horizontal Line"
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarDivider />

            {/* Links */}
            <ToolbarButton
              onClick={insertLink}
              disabled={disabled}
              title="Insert Link"
            >
              <Link className="h-4 w-4" />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => execCommand('unlink')}
              disabled={disabled}
              title="Remove Link"
            >
              <Unlink className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={`
            w-full p-6 outline-none focus:ring-2 focus:ring-dark-7000 focus:ring-inset
            ${disabled ? 'cursor-default bg-dark-100' : 'cursor-text bg-dark-100'}
          `}
          style={{
            minHeight: `${height}px`,
            maxHeight: `${height}px`,
            overflowY: 'auto',
            fontSize: '16px',
            lineHeight: '1.6',
            fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif'
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="bg-dark-100 border-t border-dark-300 px-4 py-2">
        <div className="flex justify-between items-center text-xs text-dark-700">
          <span>
            {disabled ? '📖 Read-only content' : '✏️ Rich text editor with keyboard shortcuts'}
          </span>
          <span>
            Current: {blockFormatOptions.find(opt => opt.value === currentTag)?.label || 'Paragraph'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModularEditor;