/**
 * ============================================================================
 * DATALABEL SERVICE
 * ============================================================================
 *
 * Simple helper to fetch datalabel data for frontend DAG visualization.
 * Eliminates N+1 API calls by preloading datalabel options.
 */

import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string | null;
  parent_id: number | null;
  sort_order: number;
  color_code: string;
  active_flag: boolean;
}

export interface DatalabelData {
  name: string;
  options: DatalabelOption[];
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Fetch datalabel options for given datalabel names
 * Data is stored in app.setting_datalabel table with metadata as JSONB
 */
export async function fetchDatalabels(
  db: DrizzleDB,
  datalabelNames: string[]
): Promise<DatalabelData[]> {
  if (datalabelNames.length === 0) {
    return [];
  }

  try {
    // Build WHERE clause for multiple datalabel names
    const conditions = datalabelNames.map(name => `datalabel_name = '${name}'`).join(' OR ');

    // Query the setting_datalabel table which stores options in metadata JSONB
    const query = sql.raw(`
      SELECT
        datalabel_name,
        entity_code,
        ui_label,
        ui_icon,
        metadata
      FROM app.setting_datalabel
      WHERE ${conditions}
    `);

    const rows = await db.execute(query);

    // Transform results to expected format
    const result: DatalabelData[] = [];

    for (const row of rows as any[]) {
      const datalabelName = row.datalabel_name;
      const metadata = row.metadata;

      // metadata contains an array of options
      if (metadata && Array.isArray(metadata)) {
        const options: DatalabelOption[] = metadata.map((item: any) => ({
          id: item.id,
          name: item.name,
          descr: item.descr || '',
          parent_id: Array.isArray(item.parent_ids) && item.parent_ids.length > 0
            ? item.parent_ids[0]  // Take first parent for backward compatibility
            : null,
          sort_order: item.sort_order || item.id,  // Use id as sort order if not specified
          color_code: item.color_code || '',
          active_flag: item.active_flag !== false  // Default to true if not specified
        }));

        result.push({
          name: datalabelName,
          options
        });
      }
    }

    return result;
  } catch (error) {
    console.error('[fetchDatalabels] Error:', error);
    return [];
  }
}

/**
 * Extract DAG field datalabel names from a data record
 * Looks for dl__*_stage, dl__*_status, dl__*_funnel fields
 */
export function extractDagDatalabels(record: Record<string, any>): string[] {
  if (!record) return [];

  const datalabels: string[] = [];

  for (const key of Object.keys(record)) {
    if (key.startsWith('dl__') &&
        (key.includes('stage') || key.includes('status') || key.includes('funnel'))) {
      datalabels.push(key);
    }
  }

  return datalabels;
}
