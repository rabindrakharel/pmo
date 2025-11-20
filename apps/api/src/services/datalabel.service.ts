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
 */
export async function fetchDatalabels(
  db: DrizzleDB,
  datalabelNames: string[]
): Promise<DatalabelData[]> {
  if (datalabelNames.length === 0) {
    return [];
  }

  try {
    const query = sql`
      SELECT
        datalabel,
        id,
        name,
        descr,
        parent_id,
        sort_order,
        color_code,
        active_flag
      FROM app.setting_datalabel
      WHERE datalabel = ANY(${datalabelNames}::text[])
        AND active_flag = true
      ORDER BY datalabel, sort_order
    `;

    const rows = await db.execute(query);

    // Group by datalabel
    const datalabelMap = new Map<string, DatalabelOption[]>();

    for (const row of rows as any[]) {
      const datalabelName = row.datalabel;
      if (!datalabelMap.has(datalabelName)) {
        datalabelMap.set(datalabelName, []);
      }

      datalabelMap.get(datalabelName)!.push({
        id: row.id,
        name: row.name,
        descr: row.descr,
        parent_id: row.parent_id,
        sort_order: row.sort_order,
        color_code: row.color_code,
        active_flag: row.active_flag
      });
    }

    // Convert to array format
    return Array.from(datalabelMap.entries()).map(([name, options]) => ({
      name,
      options
    }));
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
