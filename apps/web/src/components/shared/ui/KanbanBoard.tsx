import React, { useState, useCallback, useRef } from 'react';
import { MoreHorizontal, Plus, ChevronDown, ChevronRight, GripVertical, Calendar, Clock, User } from 'lucide-react';

// ============================================================================
// KANBAN BOARD v15.0.0 - Industry Standard Design
// ============================================================================
// Inspired by: Linear, Notion, Jira, Monday.com
// Features:
// - Sticky headers with color bars
// - Collapsible columns
// - Avatar chips for assignees
// - Due date indicators
// - Modern card design with elevation
// - Smooth drag & drop with visual feedback
// ============================================================================

import { loadFieldOptions } from '../../../lib/formatters/labelMetadataLoader';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  items: any[];
}

export interface KanbanBoardProps {
  data?: any[];
  columns?: KanbanColumn[];
  groupByField?: string;
  onCardClick?: (item: any) => void;
  onCardMove?: (itemId: string, fromColumn: string, toColumn: string) => void;
  onAddCard?: (columnId: string) => void;
  renderCard?: (item: any) => React.ReactNode;
  emptyMessage?: string;
}

// ============================================================================
// KANBAN CARD - Modern Design with Metadata
// ============================================================================

function KanbanCard({
  item,
  onClick,
  renderContent,
  isDragging = false,
}: {
  item: any;
  onClick?: () => void;
  renderContent?: (item: any) => React.ReactNode;
  isDragging?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Priority color mapping
  const getPriorityStyle = (priority: string) => {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      urgent: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
      medium: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
      low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    };
    return styles[priority?.toLowerCase()] || styles.medium;
  };

  // Due date formatting and urgency
  const formatDueDate = (date: string) => {
    if (!date) return null;
    const dueDate = new Date(date);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let color = 'text-gray-500';
    if (diffDays < 0) color = 'text-red-600';
    else if (diffDays <= 2) color = 'text-orange-600';
    else if (diffDays <= 7) color = 'text-yellow-600';

    return {
      text: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color,
      isOverdue: diffDays < 0,
    };
  };

  const dueInfo = formatDueDate(item.due_date || item.end_date);
  const priority = item.priority_level || item.dl__priority;

  const defaultContent = (
    <div className="space-y-3">
      {/* Card Title */}
      <h4 className="text-[13px] font-medium text-gray-900 leading-snug line-clamp-2">
        {item.name || item.title || item.code}
      </h4>

      {/* Description Preview */}
      {item.descr && (
        <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
          {item.descr}
        </p>
      )}

      {/* Metadata Row */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Priority Badge */}
          {priority && (
            <span className={`
              inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border
              ${getPriorityStyle(priority).bg}
              ${getPriorityStyle(priority).text}
              ${getPriorityStyle(priority).border}
            `}>
              {priority}
            </span>
          )}

          {/* Estimated Hours */}
          {item.estimated_hours && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Clock className="w-3 h-3" />
              {item.estimated_hours}h
            </span>
          )}
        </div>

        {/* Due Date */}
        {dueInfo && (
          <span className={`inline-flex items-center gap-1 text-[11px] ${dueInfo.color}`}>
            <Calendar className="w-3 h-3" />
            {dueInfo.text}
          </span>
        )}
      </div>

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag: string, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]"
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">
              +{item.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Assignee Avatar */}
      {(item.assignee_name || item.owner_name) && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <span className="text-[10px] font-medium text-white">
              {(item.assignee_name || item.owner_name)?.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-[11px] text-gray-500 truncate">
            {item.assignee_name || item.owner_name}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`
        group relative bg-white rounded-lg border transition-all duration-200 cursor-pointer
        ${isDragging
          ? 'shadow-lg ring-2 ring-blue-500 ring-opacity-50 opacity-90 rotate-2'
          : isHovered
            ? 'shadow-md border-gray-200 -translate-y-0.5'
            : 'shadow-sm border-gray-100 hover:border-gray-200'
        }
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {/* Drag Handle */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center
        opacity-0 group-hover:opacity-100 transition-opacity cursor-grab
      `}>
        <GripVertical className="w-3 h-3 text-gray-300" />
      </div>

      {/* Card Content */}
      <div className="p-3 pl-5">
        {renderContent ? renderContent(item) : defaultContent}
      </div>

      {/* Card Menu */}
      <button
        className={`
          absolute top-2 right-2 p-1 rounded hover:bg-gray-100
          opacity-0 group-hover:opacity-100 transition-opacity
        `}
        onClick={(e) => {
          e.stopPropagation();
          // Menu handler
        }}
      >
        <MoreHorizontal className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}

// ============================================================================
// KANBAN COLUMN - Sticky Header with Color Bar
// ============================================================================

function KanbanColumnComponent({
  column,
  onCardClick,
  onCardMove,
  onAddCard,
  renderCard,
  isCollapsed,
  onToggleCollapse,
}: {
  column: KanbanColumn;
  onCardClick?: (item: any) => void;
  onCardMove?: (itemId: string, toColumn: string) => void;
  onAddCard?: () => void;
  renderCard?: (item: any) => React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const itemId = e.dataTransfer.getData('itemId');
    if (itemId && onCardMove) {
      onCardMove(itemId, column.id);
    }
  }, [column.id, onCardMove]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false if leaving the column entirely
    if (!columnRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  // Generate color from column color or default
  const headerColor = column.color || '#6366f1';
  const headerColorLight = `${headerColor}15`;

  if (isCollapsed) {
    return (
      <div
        className="flex flex-col h-full min-w-[48px] max-w-[48px] cursor-pointer group"
        onClick={onToggleCollapse}
      >
        {/* Collapsed Header */}
        <div
          className="flex flex-col items-center py-3 rounded-lg transition-colors"
          style={{ backgroundColor: headerColorLight }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full mb-2"
            style={{ backgroundColor: headerColor }}
          />
          <span className="text-[11px] font-medium text-gray-600 writing-mode-vertical transform rotate-180"
            style={{ writingMode: 'vertical-rl' }}>
            {column.title}
          </span>
          <span className="mt-2 text-[10px] text-gray-400">
            {column.items.length}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={columnRef}
      className="flex flex-col min-w-[300px] max-w-[300px] h-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Column Header - Sticky */}
      <div
        className="sticky top-0 z-10 rounded-t-xl overflow-hidden"
        style={{ backgroundColor: headerColorLight }}
      >
        {/* Color Bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: headerColor }}
        />

        {/* Header Content */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onToggleCollapse}
              className="p-0.5 rounded hover:bg-black/5 transition-colors"
            >
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            <h3 className="text-[13px] font-semibold text-gray-800 truncate">
              {column.title}
            </h3>
            <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/60 text-[11px] font-medium text-gray-600">
              {column.items.length}
            </span>
          </div>

          {/* Add Card Button */}
          {onAddCard && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddCard();
              }}
              className="p-1 rounded hover:bg-white/60 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Column Content */}
      <div
        className={`
          flex-1 px-2 py-2 rounded-b-xl overflow-y-auto transition-colors duration-200
          ${isDragOver
            ? 'bg-blue-50 ring-2 ring-blue-200 ring-inset'
            : 'bg-gray-50/50'
          }
        `}
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
        <div className="space-y-2">
          {column.items.length === 0 ? (
            <div className={`
              flex flex-col items-center justify-center py-8 px-4
              border-2 border-dashed rounded-lg transition-colors
              ${isDragOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
            `}>
              <p className="text-[12px] text-gray-400 text-center">
                {isDragOver ? 'Drop here' : 'No items'}
              </p>
              {onAddCard && !isDragOver && (
                <button
                  onClick={onAddCard}
                  className="mt-2 text-[12px] text-blue-500 hover:text-blue-600 font-medium"
                >
                  + Add item
                </button>
              )}
            </div>
          ) : (
            column.items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onClick={() => onCardClick?.(item)}
                renderContent={renderCard}
              />
            ))
          )}
        </div>

        {/* Add Card at Bottom */}
        {column.items.length > 0 && onAddCard && (
          <button
            onClick={onAddCard}
            className="w-full mt-2 py-2 text-[12px] text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add item
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KANBAN BOARD - Main Container
// ============================================================================

export function KanbanBoard({
  data,
  columns: providedColumns,
  groupByField: explicitGroupByField,
  onCardClick,
  onCardMove,
  onAddCard,
  renderCard,
  emptyMessage = 'No columns to display',
}: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>(providedColumns || []);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // Toggle column collapse
  const toggleColumnCollapse = useCallback((columnId: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  // Load settings options and generate columns
  React.useEffect(() => {
    if (providedColumns) {
      setColumns(providedColumns);
      return;
    }

    const generateColumns = async () => {
      if (!data || data.length === 0) {
        setColumns([]);
        return;
      }

      setIsGenerating(true);
      try {
        const groupField = explicitGroupByField;

        if (!groupField) {
          console.error('[KanbanBoard] groupByField prop is REQUIRED');
          setColumns([]);
          return;
        }

        const options = await loadFieldOptions(groupField);

        if (options.length === 0) {
          console.warn(`[KanbanBoard] No options found for: ${groupField}`);
          setColumns([]);
          return;
        }

        const groupedItems: Record<string, any[]> = {};
        options.forEach(opt => {
          groupedItems[opt.value] = [];
        });

        data.forEach(item => {
          const groupValue = item[groupField];
          if (groupValue && groupedItems[groupValue]) {
            groupedItems[groupValue].push(item);
          }
        });

        const generatedColumns: KanbanColumn[] = options.map(opt => ({
          id: opt.value,
          title: opt.label,
          color: opt.metadata?.color_code,
          items: groupedItems[opt.value] || [],
        }));

        setColumns(generatedColumns);
      } catch (error) {
        console.error('[KanbanBoard] Error generating columns:', error);
        setColumns([]);
      } finally {
        setIsGenerating(false);
      }
    };

    if (!providedColumns) {
      generateColumns();
    }
  }, [data, explicitGroupByField, providedColumns]);

  const handleCardMove = useCallback((itemId: string, toColumnId: string) => {
    if (!onCardMove) return;

    const fromColumn = columns.find(col =>
      col.items.some(item => item.id === itemId)
    );

    if (fromColumn && fromColumn.id !== toColumnId) {
      onCardMove(itemId, fromColumn.id, toColumnId);
    }
  }, [columns, onCardMove]);

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-gray-500">Loading board...</span>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
          <ChevronRight className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-[13px] text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      {/* Horizontal Scroll Container */}
      <div
        className="flex gap-3 h-full overflow-x-auto pb-4 px-1"
        style={{
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
        }}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            style={{ scrollSnapAlign: 'start' }}
          >
            <KanbanColumnComponent
              column={column}
              onCardClick={onCardClick}
              onCardMove={(itemId, toColumn) => handleCardMove(itemId, toColumn)}
              onAddCard={onAddCard ? () => onAddCard(column.id) : undefined}
              renderCard={renderCard}
              isCollapsed={collapsedColumns.has(column.id)}
              onToggleCollapse={() => toggleColumnCollapse(column.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
