import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';

interface CanvasElementData {
  id: string;
  type: 'text' | 'heading' | 'button' | 'image' | 'form';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  styles: {
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderRadius?: string;
    padding?: string;
    [key: string]: any;
  };
  properties?: {
    href?: string;
    alt?: string;
    formId?: string;
    formName?: string;
    [key: string]: any;
  };
  zIndex: number;
}

interface CanvasElementProps {
  element: CanvasElementData;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<CanvasElementData>) => void;
  onDelete: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

export function CanvasElement({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onBringToFront,
  onSendToBack,
}: CanvasElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type !== 'image' && element.type !== 'form') {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    if (contentRef.current) {
      const newContent = contentRef.current.innerText;
      if (newContent !== element.content) {
        onUpdate(element.id, { content: newContent });
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && element.type !== 'text') {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      handleBlur();
    }
  };

  const renderContent = () => {
    const baseStyles: React.CSSProperties = {
      width: '100%',
      height: '100%',
      outline: 'none',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: element.styles.textAlign === 'center' ? 'center' : element.styles.textAlign === 'right' ? 'flex-end' : 'flex-start',
      fontSize: element.styles.fontSize,
      fontWeight: element.styles.fontWeight,
      color: element.styles.color,
      backgroundColor: element.styles.backgroundColor,
      borderRadius: element.styles.borderRadius,
      padding: element.styles.padding || '8px',
      textAlign: element.styles.textAlign,
      whiteSpace: element.type === 'text' ? 'pre-wrap' : 'nowrap',
      wordBreak: 'break-word',
      cursor: isEditing ? 'text' : 'move',
      userSelect: isEditing ? 'text' : 'none',
    };

    if (element.type === 'form') {
      return (
        <div style={baseStyles}>
          <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <div className="text-sm font-semibold mb-2" style={{ color: element.styles.color || '#495057' }}>
              {element.properties?.formName || 'Select a form'}
            </div>
            <div className="text-xs mb-3" style={{ color: '#6c757d' }}>
              Interactive form embedded in email
            </div>
            <div
              className="px-4 py-2 rounded text-white text-xs font-medium"
              style={{ backgroundColor: '#28a745' }}
            >
              Fill Out Form
            </div>
          </div>
        </div>
      );
    }

    if (element.type === 'image') {
      return (
        <div style={baseStyles}>
          {element.content ? (
            <img
              src={element.content}
              alt={element.properties?.alt || 'Image'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-dark-100 text-dark-600">
              No image
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        ref={contentRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={baseStyles}
      >
        {element.content || 'Double-click to edit'}
      </div>
    );
  };

  return (
    <Rnd
      position={{ x: element.x, y: element.y }}
      size={{ width: element.width, height: element.height }}
      onDragStop={(e, d) => {
        onUpdate(element.id, { x: d.x, y: d.y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(element.id, {
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          x: position.x,
          y: position.y,
        });
      }}
      bounds="parent"
      style={{
        zIndex: element.zIndex,
        border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
        transition: 'border-color 0.15s ease',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={handleDoubleClick}
      disableDragging={isEditing}
      enableResizing={!isEditing && isSelected}
      resizeHandleStyles={{
        bottomRight: {
          width: '12px',
          height: '12px',
          backgroundColor: '#3b82f6',
          border: '2px solid white',
          borderRadius: '50%',
          right: '-6px',
          bottom: '-6px',
        },
        bottomLeft: {
          width: '12px',
          height: '12px',
          backgroundColor: '#3b82f6',
          border: '2px solid white',
          borderRadius: '50%',
          left: '-6px',
          bottom: '-6px',
        },
        topRight: {
          width: '12px',
          height: '12px',
          backgroundColor: '#3b82f6',
          border: '2px solid white',
          borderRadius: '50%',
          right: '-6px',
          top: '-6px',
        },
        topLeft: {
          width: '12px',
          height: '12px',
          backgroundColor: '#3b82f6',
          border: '2px solid white',
          borderRadius: '50%',
          left: '-6px',
          top: '-6px',
        },
      }}
    >
      {renderContent()}

      {/* Action Buttons (visible when selected) */}
      {isSelected && !isEditing && (
        <div className="absolute -top-10 right-0 flex items-center space-x-1 bg-dark-100 rounded-lg shadow-lg p-1 border border-dark-300">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBringToFront(element.id);
            }}
            className="p-1.5 hover:bg-dark-100 rounded transition-colors"
            title="Bring to front"
          >
            <ArrowUp className="h-4 w-4 text-dark-700" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendToBack(element.id);
            }}
            className="p-1.5 hover:bg-dark-100 rounded transition-colors"
            title="Send to back"
          >
            <ArrowDown className="h-4 w-4 text-dark-700" />
          </button>
          <div className="w-px h-4 bg-dark-300" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
            className="p-1.5 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Editing indicator */}
      {isEditing && (
        <div className="absolute -top-8 left-0 bg-dark-700 text-white text-xs px-2 py-1 rounded shadow-lg">
          Press Enter or click outside to save
        </div>
      )}
    </Rnd>
  );
}
