import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { TextBlockEditor } from './blocks/TextBlockEditor';
import { ImageBlockEditor } from './blocks/ImageBlockEditor';
import { ButtonBlockEditor } from './blocks/ButtonBlockEditor';
import { FormBlockEditor } from './blocks/FormBlockEditor';
import { DividerBlockEditor } from './blocks/DividerBlockEditor';
import { SpacerBlockEditor } from './blocks/SpacerBlockEditor';

interface EmailBlock {
  id: string;
  type: 'text' | 'image' | 'form' | 'button' | 'divider' | 'spacer';
  content?: string;
  styles?: Record<string, any>;
  properties?: Record<string, any>;
}

interface DraggableBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<EmailBlock>) => void;
  onDelete: () => void;
}

export function DraggableBlock({ block, isSelected, onSelect, onUpdate, onDelete }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderBlockEditor = () => {
    switch (block.type) {
      case 'text':
        return <TextBlockEditor block={block} onUpdate={onUpdate} />;
      case 'image':
        return <ImageBlockEditor block={block} onUpdate={onUpdate} />;
      case 'button':
        return <ButtonBlockEditor block={block} onUpdate={onUpdate} />;
      case 'form':
        return <FormBlockEditor block={block} onUpdate={onUpdate} />;
      case 'divider':
        return <DividerBlockEditor block={block} onUpdate={onUpdate} />;
      case 'spacer':
        return <SpacerBlockEditor block={block} onUpdate={onUpdate} />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 transition-all ${
        isSelected ? 'border-dark-3000 bg-dark-100/30' : 'border-transparent hover:border-dark-400'
      }`}
      onClick={onSelect}
    >
      {/* Drag Handle & Delete Button */}
      <div className={`absolute -left-12 top-0 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : ''}`}>
        <button
          {...attributes}
          {...listeners}
          className="p-2 bg-dark-100 border border-dark-400 rounded hover:bg-dark-100 cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-dark-700" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 bg-dark-100 border border-red-300 rounded hover:bg-red-50"
          aria-label="Delete block"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>

      {/* Block Content */}
      <div className="relative">{renderBlockEditor()}</div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-0 right-0 px-2 py-1 bg-dark-1000 text-white text-xs font-medium rounded-bl">
          Selected
        </div>
      )}
    </div>
  );
}
