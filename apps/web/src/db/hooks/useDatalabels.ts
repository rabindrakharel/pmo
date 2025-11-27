/**
 * useDatalabels - Datalabel Options State
 *
 * REPLACES: datalabelMetadataStore.ts (Zustand)
 *
 * Migration Notes:
 * - Before: Zustand store with localStorage persistence, manual TTL
 * - After: RxDB collection with replication sync
 * - Benefit: Real-time sync, offline support, no manual cache invalidation
 */
import { useMemo, useCallback } from 'react';
import { useRxQuery } from './useRxQuery';
import { useDatabase } from './useDatabase';
import type { DatalabelDoc } from '../schemas/datalabel.schema';
import { createDatalabelId } from '../schemas/datalabel.schema';

// ============================================================================
// Types
// ============================================================================

export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string | null;
  color_code?: string | null;
  sort_order: number;
  parent_ids?: number[];
  active_flag: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Get all options for a specific datalabel key
 *
 * @param datalabelKey - Datalabel key (e.g., 'project_stage', 'task_status')
 * @returns Options array sorted by sort_order
 *
 * @example
 * const { options, isLoading, error } = useDatalabel('project_stage');
 * // options = [{ id: 1, name: 'Planning', color_code: 'blue', ... }, ...]
 */
export function useDatalabel(datalabelKey: string) {
  const { data, isLoading, error } = useRxQuery<'datalabel', DatalabelDoc>('datalabel', {
    selector: {
      datalabel_key: datalabelKey,
      active_flag: true,
      _deleted: false
    },
    sort: [{ sort_order: 'asc' }]
  });

  const options = useMemo<DatalabelOption[]>(() => {
    return data.map(doc => ({
      id: doc.option_id,
      name: doc.name,
      descr: doc.descr,
      color_code: doc.color_code,
      sort_order: doc.sort_order,
      parent_ids: doc.parent_ids,
      active_flag: doc.active_flag
    }));
  }, [data]);

  // Get option by ID
  const getOptionById = useCallback((optionId: number): DatalabelOption | undefined => {
    return options.find(opt => opt.id === optionId);
  }, [options]);

  // Get option by name
  const getOptionByName = useCallback((name: string): DatalabelOption | undefined => {
    return options.find(opt => opt.name.toLowerCase() === name.toLowerCase());
  }, [options]);

  return {
    options,
    isLoading,
    error,
    getOptionById,
    getOptionByName,
    isEmpty: options.length === 0
  };
}

/**
 * Get all datalabels grouped by key
 *
 * @example
 * const { datalabels, isLoading, getDatalabel } = useAllDatalabels();
 * const projectStages = getDatalabel('project_stage');
 */
export function useAllDatalabels() {
  const { data, isLoading, error } = useRxQuery<'datalabel', DatalabelDoc>('datalabel', {
    selector: {
      active_flag: true,
      _deleted: false
    }
  });

  const datalabels = useMemo(() => {
    const grouped: Record<string, DatalabelOption[]> = {};

    data.forEach(doc => {
      if (!grouped[doc.datalabel_key]) {
        grouped[doc.datalabel_key] = [];
      }
      grouped[doc.datalabel_key].push({
        id: doc.option_id,
        name: doc.name,
        descr: doc.descr,
        color_code: doc.color_code,
        sort_order: doc.sort_order,
        parent_ids: doc.parent_ids,
        active_flag: doc.active_flag
      });
    });

    // Sort each group by sort_order
    Object.values(grouped).forEach(options => {
      options.sort((a, b) => a.sort_order - b.sort_order);
    });

    return grouped;
  }, [data]);

  // Get datalabel by key
  const getDatalabel = useCallback((key: string): DatalabelOption[] => {
    return datalabels[key] || [];
  }, [datalabels]);

  // Get all keys
  const keys = useMemo(() => Object.keys(datalabels).sort(), [datalabels]);

  return {
    datalabels,
    isLoading,
    error,
    getDatalabel,
    keys,
    isEmpty: keys.length === 0
  };
}

/**
 * Bulk insert datalabels (for initial sync)
 *
 * @example
 * const { insertDatalabels } = useDatalabelMutations();
 * await insertDatalabels('project_stage', [
 *   { id: 1, name: 'Planning', sort_order: 1 },
 *   { id: 2, name: 'In Progress', sort_order: 2 }
 * ]);
 */
export function useDatalabelMutations() {
  const db = useDatabase();

  const insertDatalabels = useCallback(async (
    datalabelKey: string,
    options: DatalabelOption[]
  ) => {
    const collection = db.datalabel;

    const docs = options.map(opt => ({
      id: createDatalabelId(datalabelKey, opt.id),
      datalabel_key: datalabelKey,
      option_id: opt.id,
      name: opt.name,
      descr: opt.descr ?? null,
      color_code: opt.color_code ?? null,
      sort_order: opt.sort_order,
      parent_ids: opt.parent_ids || [],
      active_flag: opt.active_flag !== false,
      _deleted: false
    }));

    await collection.bulkUpsert(docs);
  }, [db]);

  const clearDatalabels = useCallback(async (datalabelKey?: string) => {
    const collection = db.datalabel;

    if (datalabelKey) {
      const docs = await collection.find({
        selector: { datalabel_key: datalabelKey }
      }).exec();

      for (const doc of docs) {
        await doc.remove();
      }
    } else {
      await collection.remove();
    }
  }, [db]);

  return {
    insertDatalabels,
    clearDatalabels
  };
}
