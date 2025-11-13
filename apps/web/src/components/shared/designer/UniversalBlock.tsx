import React, { ReactNode, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  MoreVertical,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';

/**
 * Universal Block System
 *
 * A unified block component that works across:
 * - Wiki content blocks
 * - Email template blocks
 * - Form field blocks
 * - Report section blocks
 * - Any future block-based content
 *
 * Features:
 * - Drag & drop reordering
 * - Hover actions (duplicate, delete, move)
 * - Visual feedback
 * - Consistent styling
 */

export interface UniversalBlockProps {
  id: string;
  type: string;
  children: ReactNode;

  // State
  isSelected?: boolean;
  isHovered?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;

  // Actions
  onSelect?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleVisibility?: () => void;
  onToggleLock?: () => void;

  // Customization
  showDragHandle?: boolean;
  showActions?: boolean;
  className?: string;
  style?: React.CSSProperties;

  // Accessibility
  label?: string;
}

export function UniversalBlock({
  id,
  type,
  children,
  isSelected = false,
  isLocked = false,
  isHidden = false,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onToggleLock,
  showDragHandle = true,
  showActions = true,
  className = '',
  style = {},
  label,
}: UniversalBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isLocked });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...dragStyle, ...style }}
      className={`
        universal-block group relative
        ${isSelected ? 'ring-2 ring-dark-7000 ring-offset-2' : ''}
        ${isHidden ? 'opacity-50' : ''}
        ${isHovered ? 'bg-dark-100/30' : ''}
        ${className}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowContextMenu(false);
      }}
      onClick={onSelect}
      aria-label={label || `${type} block`}
      role="article"
    >
      {/* Drag Handle & Actions - Left Side */}
      {!isLocked && (isHovered || isSelected) && (
        <div className="absolute -left-12 top-0 bottom-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Drag Handle */}
          {showDragHandle && (
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded bg-dark-100 border border-dark-400 shadow-sm hover:bg-dark-100 cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to reorder"
              aria-label="Drag handle"
            >
              <GripVertical className="h-4 w-4 text-dark-600" />
            </button>
          )}

          {/* More Actions */}
          {showActions && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContextMenu(!showContextMenu);
                }}
                className="p-1 rounded bg-dark-100 border border-dark-400 shadow-sm hover:bg-dark-100 transition-colors"
                title="More actions"
                aria-label="Block actions menu"
              >
                <MoreVertical className="h-4 w-4 text-dark-600" />
              </button>

              {/* Context Menu */}
              {showContextMenu && (
                <div className="absolute left-full ml-2 top-0 bg-dark-100 border border-dark-400 rounded-md shadow-sm z-50 min-w-[180px] py-1">
                  {onMoveUp && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveUp();
                        setShowContextMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-dark-100 flex items-center gap-2"
                    >
                      <ChevronUp className="h-4 w-4" />
                      Move Up
                    </button>
                  )}
                  {onMoveDown && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveDown();
                        setShowContextMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-dark-100 flex items-center gap-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Move Down
                    </button>
                  )}
                  {onDuplicate && (
                    <>
                      <div className="h-px bg-dark-200 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate();
                          setShowContextMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-dark-100 flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </button>
                    </>
                  )}
                  {onToggleVisibility && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility();
                        setShowContextMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-dark-100 flex items-center gap-2"
                    >
                      {isHidden ? (
                        <>
                          <Eye className="h-4 w-4" />
                          Show
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4" />
                          Hide
                        </>
                      )}
                    </button>
                  )}
                  {onToggleLock && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock();
                        setShowContextMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-dark-100 flex items-center gap-2"
                    >
                      {isLocked ? (
                        <>
                          <Unlock className="h-4 w-4" />
                          Unlock
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Lock
                        </>
                      )}
                    </button>
                  )}
                  {onDelete && (
                    <>
                      <div className="h-px bg-dark-200 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                          setShowContextMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Block Content */}
      <div className="relative">
        {/* Selection/Locked Indicator */}
        {isLocked && (
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full shadow-sm z-10">
            <Lock className="h-3 w-3" />
          </div>
        )}

        {children}
      </div>

      {/* Hover Border Indicator */}
      {(isHovered || isSelected) && !isLocked && (
        <div className="absolute inset-0 border-2 border-dark-600/30 rounded pointer-events-none" />
      )}
    </div>
  );
}

/**
 * Block Container
 *
 * Container for sortable blocks with drag-and-drop
 */
export interface UniversalBlockContainerProps {
  children: ReactNode;
  className?: string;
  emptyState?: ReactNode;
}

export function UniversalBlockContainer({
  children,
  className = '',
  emptyState,
}: UniversalBlockContainerProps) {
  const hasChildren = React.Children.count(children) > 0;

  if (!hasChildren && emptyState) {
    return <div className={`universal-block-container ${className}`}>{emptyState}</div>;
  }

  return (
    <div className={`universal-block-container space-y-4 ${className}`}>
      {children}
    </div>
  );
}
