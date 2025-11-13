import React, { useState, useMemo } from 'react';
import { MoreVertical } from 'lucide-react';

// ============================================================================
// NEW: Universal Field Detector Integration
// ============================================================================
import { generateKanbanConfig } from '../../../lib/viewConfigGenerator';
import { loadFieldOptions } from '../../../lib/settingsLoader';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  items: any[];
}

export interface KanbanBoardProps {
  // ============================================================================
  // NEW ARCHITECTURE: Auto-Generation ONLY (Universal Field Detector)
  // ============================================================================
  /**
   * Data array - REQUIRED when columns not provided
   * Board automatically detects grouping field and generates columns
   */
  data?: any[];

  /**
   * Pre-built columns - when provided, skips auto-generation
   */
  columns?: KanbanColumn[];

  /**
   * Optional: Explicitly specify grouping field (overrides auto-detection)
   * If not provided, auto-detects: dl__*_stage > dl__*_status > status
   * @example
   * groupByField="dl__task_stage"
   */
  groupByField?: string;

  /**
   * Optional data types for JSONB/array detection
   * @example
   * dataTypes={{ metadata: 'jsonb'}}
   */
  dataTypes?: Record<string, string>;

  // UI handlers
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
      <h4
        className="text-dark-600 mb-2 line-clamp-2"
        style={{
          fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
          fontSize: '13px',
          fontWeight: 400,
          color: '#333'
        }}
      >
        {item.name || item.title}
      </h4>
      {item.descr && (
        <p
          className="text-dark-700 mb-2 line-clamp-2"
          style={{
            fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
            fontSize: '12px',
            color: '#666'
          }}
        >
          {item.descr}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        {item.priority_level && (
          <span
            className={`
              inline-flex items-center px-2 py-0.5 rounded-full
              ${item.priority_level === 'High'
                ? 'bg-red-100 text-red-800'
                : item.priority_level === 'Medium'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
              }
            `}
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '11px',
              fontWeight: 400
            }}
          >
            {item.priority_level}
          </span>
        )}
        {item.estimated_hours && (
          <span
            className="text-dark-700"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '11px'
            }}
          >
            {item.estimated_hours}h
          </span>
        )}
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.tags.slice(0, 2).map((tag: string, idx: number) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-dark-100 text-dark-700"
              style={{
                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '11px',
                fontWeight: 400
              }}
            >
              {tag}
            </span>
          ))}
          {item.tags.length > 2 && (
            <span
              className="text-dark-600"
              style={{
                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '11px'
              }}
            >
              +{item.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <div
      className="bg-dark-100 p-3 rounded-md border border-dark-300 shadow-sm hover:shadow-sm transition-shadow cursor-pointer relative group"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', item.id);
      }}
    >
      {renderContent ? renderContent(item) : defaultContent}

      <button
        className="absolute top-2 right-2 p-1 rounded hover:bg-dark-100 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical className="h-4 w-4 text-dark-600" />
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
      <div className="flex items-center justify-between p-3 bg-dark-100 rounded-t-lg border-b border-dark-300">
        <div className="flex items-center space-x-2">
          {column.color && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.color }}
            />
          )}
          <h3
            className="text-dark-600"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              fontWeight: 400,
              color: '#333'
            }}
          >
            {column.title}
          </h3>
        </div>
        <span
          className="bg-dark-200 text-dark-600 px-2 py-0.5 rounded-full"
          style={{
            fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
            fontSize: '11px',
            fontWeight: 400
          }}
        >
          {column.items.length}
        </span>
      </div>

      {/* Column Content */}
      <div
        className={`
          flex-1 p-3 bg-dark-100 border border-t-0 rounded-b-lg overflow-y-auto
          ${isDragOver ? 'bg-dark-100 border-dark-500' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{ minHeight: '400px', maxHeight: 'calc(100vh - 300px)' }}
      >
        <div className="space-y-3">
          {column.items.length === 0 ? (
            <div className="text-center py-8">
              <p
                className="text-dark-600"
                style={{
                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                  fontSize: '13px',
                  fontWeight: 400
                }}
              >
                No items
              </p>
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
  data,
  columns: providedColumns,
  groupByField: explicitGroupByField,
  dataTypes,
  onCardClick,
  onCardMove,
  renderCard,
  emptyMessage = 'No columns to display'}: KanbanBoardProps) {
  // ============================================================================
  // NEW ARCHITECTURE: Auto-Generation ONLY (when columns not provided)
  // ============================================================================
  const [columns, setColumns] = useState<KanbanColumn[]>(providedColumns || []);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-detect grouping field using universal field detector (only when columns not provided)
  const detectedConfig = useMemo(() => {
    if (providedColumns || !data || data.length === 0) return null;

    const fieldKeys = Object.keys(data[0]);
    return generateKanbanConfig(fieldKeys, dataTypes);
  }, [data, dataTypes]);

  // Load settings options and generate columns (only when columns not provided)
  React.useEffect(() => {
    // Skip auto-generation if columns are provided
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
        // Use explicit groupByField if provided, otherwise use detected field
        const groupField = explicitGroupByField || detectedConfig?.groupByField;

        if (!groupField) {
          console.warn('[KanbanBoard] No grouping field found');
          setColumns([]);
          return;
        }

        // Load options from settings for the grouping field
        const options = await loadFieldOptions(groupField);

        if (options.length === 0) {
          console.warn(`[KanbanBoard] No options found for grouping field: ${groupField}`);
          setColumns([]);
          return;
        }

        // Group items by the grouping field
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

        // Generate KanbanColumn array
        const generatedColumns: KanbanColumn[] = options.map(opt => ({
          id: opt.value,
          title: opt.label,
          color: opt.metadata?.color_code,
          items: groupedItems[opt.value] || []
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
  }, [data, detectedConfig, explicitGroupByField, providedColumns]);

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

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-dark-600">Generating Kanban board...</p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-center py-12">
        <p
          className="text-dark-700"
          style={{
            fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
            fontSize: '13px',
            fontWeight: 400
          }}
        >
          {emptyMessage}
        </p>
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
