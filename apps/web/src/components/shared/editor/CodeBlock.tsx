import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface CodeBlockProps {
  initialContent?: string;
  language?: string;
  showHeader?: boolean;
  showLineNumbers?: boolean;
  onContentChange?: (content: string) => void;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  initialContent = '# Type your code here...',
  language = 'python',
  showHeader = true,
  showLineNumbers = false,
  onContentChange,
  className = ''
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const [content, setContent] = useState(initialContent);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [lineNumbersVisible, setLineNumbersVisible] = useState(showLineNumbers);
  const blockId = useRef(`code_${Date.now()}_${Math.random()}`);

  // Available languages
  const languages = [
    'javascript', 'python', 'html', 'css', 'typescript', 
    'json', 'sql', 'bash', 'php', 'java', 'cpp', 'csharp'
  ];

  // Update line numbers
  const updateLineNumbers = useCallback(() => {
    const lineNumbersEl = document.querySelector(`[data-block-id="${blockId.current}"] .line-numbers`);
    if (lineNumbersEl && codeRef.current) {
      const codeContent = codeRef.current.textContent || '';
      const lines = codeContent === initialContent || codeContent === '' ? 1 : codeContent.split('\n').length;
      const lineNumbersArray = Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1);
      lineNumbersEl.innerHTML = lineNumbersArray.join('\n');
    }
  }, [initialContent]);

  // Apply syntax highlighting
  const applySyntaxHighlighting = useCallback((element: HTMLElement) => {
    const textContent = element.textContent || '';
    if (textContent === initialContent || textContent.trim() === '') return;
    
    // Save cursor position
    const selection = window.getSelection();
    let cursorOffset = 0;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (element.contains(range.startContainer)) {
        cursorOffset = range.startOffset;
      }
    }
    
    // Apply syntax highlighting
    let highlighted = textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(^|\n)(#.*$)/gm, '$1<span class="hljs-comment">$2</span>')
      .replace(/(['"])((?:[^\\]|\\.)*?)\1/g, '<span class="hljs-string">$1$2$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="hljs-number">$1</span>')
      .replace(/\b(def|class|if|else|elif|for|while|in|return|import|from|as|try|except|with|pass|break|continue|print|len|range|str|int|float|bool|list|dict|set|tuple|None|True|False|and|or|not|is|lambda|yield|global|nonlocal|assert|del|raise|async|await)\b/g, '<span class="hljs-keyword">$1</span>')
      .replace(/(\w+)(\s*\()/g, '<span class="hljs-built_in">$1</span>$2')
      .replace(/\n/g, '<br>');
    
    if (highlighted !== textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) {
      element.innerHTML = highlighted;
      
      // Restore cursor position
      if (cursorOffset > 0) {
        try {
          const range = document.createRange();
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
          let charCount = 0;
          let node;
          while (node = walker.nextNode()) {
            const nodeLength = node.textContent?.length || 0;
            if (charCount + nodeLength >= cursorOffset) {
              range.setStart(node, Math.min(cursorOffset - charCount, nodeLength));
              range.collapse(true);
              selection?.removeAllRanges();
              selection?.addRange(range);
              break;
            }
            charCount += nodeLength;
          }
        } catch (e) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }
  }, [initialContent]);

  // Handle input changes
  const handleInput = useCallback(() => {
    if (!codeRef.current) return;
    
    const newContent = codeRef.current.textContent || '';
    setContent(newContent);
    updateLineNumbers();
    applySyntaxHighlighting(codeRef.current);
    onContentChange?.(newContent);
  }, [updateLineNumbers, applySyntaxHighlighting, onContentChange]);

  // Handle focus
  const handleFocus = useCallback(() => {
    if (codeRef.current && codeRef.current.textContent === initialContent) {
      codeRef.current.innerHTML = '';
    }
  }, [initialContent]);

  // Handle blur
  const handleBlur = useCallback(() => {
    if (codeRef.current) {
      if (codeRef.current.textContent?.trim() === '') {
        codeRef.current.innerHTML = initialContent;
        codeRef.current.style.color = '#718096';
      } else {
        codeRef.current.style.color = '#e2e8f0';
      }
    }
  }, [initialContent]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!codeRef.current) return;

    if (codeRef.current.textContent === initialContent) {
      codeRef.current.innerHTML = '';
    }
    
    // Prevent backspace from deleting the code block structure
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textContent = codeRef.current.textContent || '';
        
        if ((textContent === '' || textContent === initialContent) && range.startOffset === 0) {
          e.preventDefault();
          codeRef.current.innerHTML = initialContent;
          codeRef.current.style.color = '#718096';
          const newRange = document.createRange();
          newRange.setStart(codeRef.current.firstChild || codeRef.current, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          return;
        }
      }
    }
    
    setTimeout(() => updateLineNumbers(), 10);
  }, [initialContent, updateLineNumbers]);

  // Toggle line numbers
  const toggleLineNumbers = useCallback(() => {
    setLineNumbersVisible(!lineNumbersVisible);
  }, [lineNumbersVisible]);

  // Copy code content
  const copyCode = useCallback(() => {
    if (!codeRef.current) return;
    
    const textContent = codeRef.current.textContent || '';
    if (textContent && textContent !== initialContent && textContent.trim() !== '') {
      navigator.clipboard.writeText(textContent).then(() => {
        // Visual feedback could be added here
        console.log('Code copied to clipboard');
      });
    }
  }, [initialContent]);

  // Initialize content
  useEffect(() => {
    if (codeRef.current && !content) {
      codeRef.current.innerHTML = initialContent;
      codeRef.current.style.color = '#718096';
    }
  }, [initialContent, content]);

  return (
    <div 
      className={`code-editor__area ${className}`}
      style={{ margin: '2rem 0', position: 'relative' }}
      data-block-id={blockId.current}
    >
      <div 
        className="pre-code-wrapper"
        style={{
          background: '#383b40',
          border: '1px solid #4a5568',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        {/* Header */}
        {showHeader && (
          <div
            style={{
              background: '#2d3748',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #4a5568',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={toggleLineNumbers}
                style={{
                  background: '#4a5568',
                  color: '#e2e8f0',
                  border: 'none',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
                title="Toggle line numbers"
              >
                #
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={currentLanguage}
                onChange={(e) => setCurrentLanguage(e.target.value)}
                style={{
                  background: '#4a5568',
                  color: '#e2e8f0',
                  border: 'none',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
              >
                {languages.map(lang => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
              <button
                onClick={copyCode}
                style={{
                  background: '#4a5568',
                  color: '#e2e8f0',
                  border: 'none',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
                title="Copy code"
              >
                📋 Copy
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ display: 'flex' }}>
          {/* Line Numbers */}
          <div
            className="line-numbers"
            style={{
              background: '#2d3748',
              color: '#718096',
              padding: '1rem 0.75rem',
              fontFamily: "'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace",
              fontSize: '14px',
              lineHeight: '1.6',
              userSelect: 'none',
              display: lineNumbersVisible ? 'block' : 'none',
              minWidth: '3rem',
              textAlign: 'right',
              borderRight: '1px solid #4a5568',
              whiteSpace: 'pre'
            }}
          >
            1
          </div>

          {/* Code Area */}
          <pre
            style={{
              margin: 0,
              padding: '1rem 1.5rem',
              fontFamily: "'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace",
              fontSize: '14px',
              lineHeight: '1.6',
              overflowX: 'auto',
              flex: 1,
              background: '#383b40',
              maxHeight: '600px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          >
            <code
              ref={codeRef}
              className="python hljs dark-theme"
              contentEditable
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              style={{
                outline: 'none',
                color: '#e2e8f0',
                background: 'transparent',
                display: 'block',
                minHeight: '1.6em'
              }}
              suppressContentEditableWarning
            >
              {initialContent}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeBlock;