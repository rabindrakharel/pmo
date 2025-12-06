import { useMemo, useState, useEffect } from 'react';
import type { KanbanColumn } from '../../components/shared/ui/KanbanBoard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Settings-driven Kanban column configuration
 *
 * v17.0.0: Updated to accept kanban config directly (database-driven)
 * NO FALLBACKS - Always loads from settings API
 * Follows DRY principle - single source of truth for stage configuration
 */

interface StageColor {
  [key: string]: string;
}

// Stage color mapping for visual consistency
const STAGE_COLORS: StageColor = {
  'Backlog': '#6B7280',      // Gray
  'To Do': '#3B82F6',        // Blue
  'In Progress': '#F59E0B',  // Orange
  'In Review': '#8B5CF6',    // Purple
  'Done': '#10B981',         // Green
  'Blocked': '#EF4444',      // Red
  'Cancelled': '#9CA3AF',    // Light Gray
  'Planning': '#8B5CF6',     // Purple
  'Execution': '#F59E0B',    // Orange
  'Monitoring': '#3B82F6',   // Blue
  'Closure': '#10B981',      // Green
  'On Hold': '#F59E0B',      // Orange
  'Completed': '#10B981'     // Green
};

interface KanbanSettings {
  value: string;
  label: string;
  order: number;
  color?: string;
}

/**
 * Kanban configuration from database component_views
 * v17.0.0: Now passed directly, not from EntityConfig
 */
export interface KanbanConfig {
  groupByField: string;
  metaTable?: string;
  cardFields: string[];
}

/**
 * Universal Kanban Columns Hook
 *
 * v17.0.0: Updated to accept kanban config directly (database-driven)
 * Loads stage configuration from settings API and creates Kanban columns
 * Works for ANY entity with kanban configuration
 *
 * @param kanbanConfig - Kanban configuration from database (groupByField, metaTable, cardFields)
 * @param data - Array of entity items to display
 * @returns Kanban columns with items grouped by stage
 */
export function useKanbanColumns(
  kanbanConfig: KanbanConfig | null | undefined,
  data: any[]
): {
  columns: KanbanColumn[];
  loading: boolean;
  error: string | null;
} {
  const [stageSettings, setStageSettings] = useState<KanbanSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine settings category from kanban config
  const settingsCategory = useMemo(() => {
    if (!kanbanConfig) return null;

    // Use metaTable directly (should already have dl__ prefix)
    // e.g., 'dl__task_stage'
    if (kanbanConfig.metaTable) {
      return kanbanConfig.metaTable;
    }

    // Fallback: use groupByField directly (should already have dl__ prefix)
    // e.g., 'dl__task_stage'
    return kanbanConfig.groupByField;
  }, [kanbanConfig]);

  // Load stage settings from API
  useEffect(() => {
    if (!settingsCategory) {
      setLoading(false);
      return;
    }

    async function fetchStageSettings() {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('auth_token');
        const response = await fetch(
          `${API_BASE_URL}/api/v1/datalabel?name=${settingsCategory}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load stage settings: ${settingsCategory}`);
        }

        const result = await response.json();

        // Map API response to KanbanSettings format
        const mapped: KanbanSettings[] = (result.data || []).map((item: any) => ({
          value: item.name,
          label: item.name,
          order: item.position ?? 0,
          color: item.color_code || STAGE_COLORS[item.name]
        }));

        // Sort by order from settings
        mapped.sort((a, b) => a.order - b.order);

        setStageSettings(mapped);
      } catch (err) {
        console.error(`Failed to load Kanban settings for ${settingsCategory}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load Kanban configuration');
      } finally {
        setLoading(false);
      }
    }

    fetchStageSettings();
  }, [settingsCategory]);

  // Build Kanban columns from settings and data
  const columns = useMemo<KanbanColumn[]>(() => {
    if (!kanbanConfig || stageSettings.length === 0) {
      return [];
    }

    const groupField = kanbanConfig.groupByField;

    // Create columns for ALL configured stages (even empty ones)
    return stageSettings.map(stage => ({
      id: stage.value,
      title: stage.label,
      color: stage.color,
      items: data.filter(item => item[groupField] === stage.value)
    }));
  }, [kanbanConfig, data, stageSettings]);

  return { columns, loading, error };
}
