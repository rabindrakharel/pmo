import React from 'react';
import { KanbanBoard, KanbanColumn } from './KanbanBoard';
import type { EntityConfig } from '../../../lib/entityConfig';
import { useKanbanColumns } from '../../../lib/hooks/useKanbanColumns';

/**
 * Standardized Kanban View Component
 *
 * Universal, reusable Kanban view that works for ANY entity with kanban configuration.
 * Follows DRY principle - single implementation for all Kanban views.
 *
 * Features:
 * - Settings-driven columns (NO hardcoded fallbacks)
 * - Drag-and-drop support
 * - Empty state handling
 * - Loading states
 * - Error handling
 *
 * Usage:
 * ```tsx
 * <KanbanView
 *   config={taskConfig}
 *   data={tasks}
 *   onCardClick={(task) => navigate(`/task/${task.id}`)}
 *   onCardMove={(taskId, fromStage, toStage) => updateTask(taskId, { stage: toStage })}
 * />
 * ```
 */

interface KanbanViewProps {
  /** Entity configuration with kanban settings */
  config: EntityConfig;

  /** Array of entity items to display */
  data: any[];

  /** Callback when card is clicked */
  onCardClick?: (item: any) => void;

  /** Callback when card is moved between columns */
  onCardMove?: (itemId: string, fromColumn: string, toColumn: string) => void;

  /** Custom card renderer (optional) */
  renderCard?: (item: any) => React.ReactNode;

  /** Custom empty message */
  emptyMessage?: string;
}

export function KanbanView({
  config,
  data,
  onCardClick,
  onCardMove,
  renderCard,
  emptyMessage
}: KanbanViewProps) {
  // Load Kanban columns from settings API
  const { columns, loading, error } = useKanbanColumns(config, data);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p
            className="text-gray-600"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px'
            }}
          >
            Loading Kanban configuration...
          </p>
        </div>
      </div>
    );
  }

  // Error state - NO FALLBACK, show error message
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p
              className="text-red-800 mb-2"
              style={{
                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Failed to load Kanban configuration
            </p>
            <p
              className="text-red-600"
              style={{
                fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '13px'
              }}
            >
              {error}
            </p>
          </div>
          <p
            className="text-gray-600"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px'
            }}
          >
            Please ensure stage settings are configured for this entity.
            <br />
            Contact your system administrator if the problem persists.
          </p>
        </div>
      </div>
    );
  }

  // No columns configured
  if (columns.length === 0) {
    return (
      <div className="text-center py-12">
        <p
          className="text-gray-600 mb-2"
          style={{
            fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          No Kanban stages configured
        </p>
        <p
          className="text-gray-500"
          style={{
            fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
            fontSize: '13px'
          }}
        >
          Configure stage settings to enable Kanban view for {config.displayName}.
        </p>
      </div>
    );
  }

  // Render Kanban board
  return (
    <KanbanBoard
      columns={columns}
      onCardClick={onCardClick}
      onCardMove={onCardMove}
      renderCard={renderCard}
      emptyMessage={emptyMessage || `No ${config.pluralName.toLowerCase()} to display`}
    />
  );
}
