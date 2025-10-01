import React, { useState } from 'react';
import { MoreVertical } from 'lucide-react';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  items: any[];
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  onCardClick?: (item: any) => void;
  onCardMove?: (itemId: string, fromColumn: string, toColumn: string) => void;
  renderCard?: (item: any) => React.ReactNode;
  emptyMessage?: string;
}

function KanbanCard({
  item,
  onClick,
  renderContent
}: {
  item: any;
  onClick?: () => void;
  renderContent?: (item: any) => React.ReactNode;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const defaultContent = (
    <>
      <h4 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
        {item.name || item.title}
      </h4>
      {item.descr && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{item.descr}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {item.priority_level && (
          <span className={`
            inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
            ${item.priority_level === 'High'
              ? 'bg-red-100 text-red-800'
              : item.priority_level === 'Medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
            }
          `}>
            {item.priority_level}
          </span>
        )}
        {item.estimated_hours && (
          <span className="text-xs text-gray-500">{item.estimated_hours}h</span>
        )}
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.tags.slice(0, 2).map((tag: string, idx: number) => (
            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span className="text-xs text-gray-400">+{item.tags.length - 2}</span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', item.id);
      }}
    >
      {renderContent ? renderContent(item) : defaultContent}

      <button
        className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  );
}

function KanbanColumnComponent({
  column,
  onCardClick,
  onCardMove,
  renderCard
}: {
  column: KanbanColumn;
  onCardClick?: (item: any) => void;
  onCardMove?: (itemId: string, toColumn: string) => void;
  renderCard?: (item: any) => React.ReactNode;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const itemId = e.dataTransfer.getData('itemId');
    if (itemId && onCardMove) {
      onCardMove(itemId, column.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {column.color && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.color }}
            />
          )}
          <h3 className="font-semibold text-gray-900 text-sm">{column.title}</h3>
        </div>
        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">
          {column.items.length}
        </span>
      </div>

      {/* Column Content */}
      <div
        className={`
          flex-1 p-3 bg-gray-50 border border-t-0 rounded-b-lg overflow-y-auto
          ${isDragOver ? 'bg-blue-50 border-blue-300' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{ minHeight: '400px', maxHeight: 'calc(100vh - 300px)' }}
      >
        <div className="space-y-3">
          {column.items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No items</p>
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
      </div>
    </div>
  );
}

export function KanbanBoard({
  columns,
  onCardClick,
  onCardMove,
  renderCard,
  emptyMessage = 'No columns to display'
}: KanbanBoardProps) {
  const handleCardMove = (itemId: string, toColumnId: string) => {
    if (!onCardMove) return;

    // Find which column the item came from
    const fromColumn = columns.find(col =>
      col.items.some(item => item.id === itemId)
    );

    if (fromColumn && fromColumn.id !== toColumnId) {
      onCardMove(itemId, fromColumn.id, toColumnId);
    }
  };

  if (columns.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex space-x-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <KanbanColumnComponent
          key={column.id}
          column={column}
          onCardClick={onCardClick}
          onCardMove={(itemId, toColumn) => handleCardMove(itemId, toColumn)}
          renderCard={renderCard}
        />
      ))}
    </div>
  );
}
