import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy } from 'lucide-react';
import type { WikiBlock } from '../WikiDesigner';

interface WikiDraggableBlockProps {
  block: WikiBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<WikiBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function WikiDraggableBlock({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
}: WikiDraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContentChange = (content: string) => {
    onUpdate({ content });
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case 'heading':
        const HeadingTag = `h${block.level || 1}` as keyof JSX.IntrinsicElements;
        const headingClasses = {
          1: 'text-4xl font-bold',
          2: 'text-3xl font-bold',
          3: 'text-2xl font-semibold',
          4: 'text-xl font-semibold',
          5: 'text-lg font-medium',
          6: 'text-base font-medium',
        }[block.level || 1];

        return (
          <input
            type="text"
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            onClick={onSelect}
            className={`w-full bg-transparent border-none outline-none ${headingClasses} text-gray-900 placeholder-gray-400`}
            placeholder="Heading"
          />
        );

      case 'paragraph':
        return (
          <textarea
            value={block.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            onClick={onSelect}
            className="w-full bg-transparent border-none outline-none resize-none text-gray-700 placeholder-gray-400 leading-relaxed"
            placeholder="Start typing..."
            rows={3}
          />
        );

      case 'quote':
        return (
          <blockquote className="border-l-4 border-blue-500 pl-4 italic">
            <textarea
              value={block.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              onClick={onSelect}
              className="w-full bg-transparent border-none outline-none resize-none text-gray-600 placeholder-gray-400"
              placeholder="Quote text..."
              rows={2}
            />
          </blockquote>
        );

      case 'code':
        return (
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm">
            <textarea
              value={block.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              onClick={onSelect}
              className="w-full bg-transparent border-none outline-none resize-none text-gray-100 placeholder-gray-500 font-mono"
              placeholder="// Code..."
              rows={4}
            />
          </div>
        );

      case 'list':
        const ListTag = block.level === 1 ? 'ul' : 'ol';
        const bulletStyle = block.level === 1 ? 'list-disc' : 'list-decimal';
        return (
          <ListTag className={`${bulletStyle} ml-6`}>
            <li>
              <input
                type="text"
                value={block.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
                onClick={onSelect}
                className="w-full bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
                placeholder="List item..."
              />
            </li>
          </ListTag>
        );

      case 'callout':
        return (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <textarea
              value={block.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              onClick={onSelect}
              className="w-full bg-transparent border-none outline-none resize-none text-blue-900 placeholder-blue-400 font-medium"
              placeholder="Important note..."
              rows={2}
            />
          </div>
        );

      case 'image':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center" onClick={onSelect}>
            {block.properties?.src ? (
              <img
                src={block.properties.src}
                alt={block.properties.alt || ''}
                className="max-w-full h-auto mx-auto"
              />
            ) : (
              <div className="text-gray-400">
                <p className="mb-2">Click to add image URL in properties panel →</p>
                <p className="text-sm">Or drag and drop (coming soon)</p>
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center" onClick={onSelect}>
            {block.properties?.src ? (
              <div className="aspect-video">
                <iframe
                  src={block.properties.src}
                  className="w-full h-full rounded"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="text-gray-400">
                <p>Click to add video URL in properties panel →</p>
                <p className="text-sm mt-1">Supports YouTube, Vimeo, etc.</p>
              </div>
            )}
          </div>
        );

      case 'divider':
        return <hr className="border-t-2 border-gray-300 my-4" />;

      case 'table':
        return (
          <div className="overflow-x-auto" onClick={onSelect}>
            <table className="min-w-full border border-gray-300">
              <tbody>
                {Array.from({ length: block.properties?.rows || 3 }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: block.properties?.cols || 3 }).map((_, colIndex) => (
                      <td key={colIndex} className="border border-gray-300 p-2">
                        <input
                          type="text"
                          className="w-full bg-transparent border-none outline-none text-sm"
                          placeholder="Cell"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return (
          <div className="text-gray-400">Unsupported block type: {block.type}</div>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50'
          : 'border-transparent hover:border-gray-200'
      }`}
    >
      {/* Controls */}
      <div
        className={`absolute -left-10 top-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity ${
          isSelected ? 'opacity-100' : ''
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-50 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <div
        className={`absolute -right-20 top-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ${
          isSelected ? 'opacity-100' : ''
        }`}
      >
        <button
          onClick={onDuplicate}
          className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50"
          title="Duplicate block"
        >
          <Copy className="h-4 w-4 text-gray-600" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 bg-white border border-red-200 rounded hover:bg-red-50"
          title="Delete block"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </button>
      </div>

      {/* Block Content */}
      <div className="p-4">{renderBlockContent()}</div>
    </div>
  );
}
