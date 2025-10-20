/**
 * Helper functions for handling denormalized setting fields
 *
 * When updating *_id fields (like opportunity_funnel_stage_id, level_id, etc.),
 * we need to also update the corresponding *_name fields by looking up the
 * level_name from the settings table.
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Mapping of ID field names to their corresponding settings tables
 */
export const DENORMALIZED_FIELD_MAPPINGS: Record<string, {
  nameField: string;
  settingTable: string;
}> = {
  // Client fields
  'opportunity_funnel_stage_id': {
    nameField: 'opportunity_funnel_stage_name',
    settingTable: 'app.setting_opportunity_funnel_stage'
  },
  'industry_sector_id': {
    nameField: 'industry_sector_name',
    settingTable: 'app.setting_industry_sector'
  },
  'acquisition_channel_id': {
    nameField: 'acquisition_channel_name',
    settingTable: 'app.setting_acquisition_channel'
  },
  'customer_tier_id': {
    nameField: 'customer_tier_name',
    settingTable: 'app.setting_customer_tier'
  },

  // Business and Office fields
  'level_id': {
    nameField: 'level_name',
    settingTable: 'app.setting_business_level' // Note: This will be context-dependent
  },
  'office_level_id': {
    nameField: 'level_name',
    settingTable: 'app.setting_office_level'
  },

  // Project fields
  'project_stage_id': {
    nameField: 'project_stage',
    settingTable: 'app.setting_project_stage'
  },

  // Task fields
  'stage_id': {
    nameField: 'stage',
    settingTable: 'app.setting_task_stage'
  }
};

/**
 * Given a data object with *_id fields, fetch the corresponding *_name values
 * and add them to the updateFields array for SQL update
 *
 * @param data - The incoming request data
 * @param updateFields - The array of SQL fragments to update
 * @param entityType - Optional entity type for context-dependent mappings (e.g., 'business' or 'office' for level_id)
 */
export async function addDenormalizedFieldUpdates(
  data: Record<string, any>,
  updateFields: any[],
  entityType?: string
): Promise<void> {
  for (const [idField, value] of Object.entries(data)) {
    // Check if this is a denormalized ID field that we need to handle
    let mapping = DENORMALIZED_FIELD_MAPPINGS[idField];

    // Handle context-dependent level_id field
    if (idField === 'level_id' && entityType) {
      if (entityType === 'business') {
        mapping = {
          nameField: 'level_name',
          settingTable: 'app.setting_business_level'
        };
      } else if (entityType === 'office') {
        mapping = {
          nameField: 'level_name',
          settingTable: 'app.setting_office_level'
        };
      }
    }

    if (!mapping || value === undefined || value === null) {
      continue;
    }

    try {
      // Fetch the level_name from the settings table
      const result = await db.execute(sql.raw(`
        SELECT level_name
        FROM ${mapping.settingTable}
        WHERE level_id = ${value}
        AND active_flag = true
        LIMIT 1
      `));

      if (result.length > 0 && result[0].level_name) {
        const levelName = result[0].level_name as string;

        // Add both the ID and name fields to the update
        updateFields.push(sql`${sql.raw(idField)} = ${value}`);
        updateFields.push(sql`${sql.raw(mapping.nameField)} = ${levelName}`);
      } else {
        // If no matching setting found, just update the ID field
        updateFields.push(sql`${sql.raw(idField)} = ${value}`);
      }
    } catch (error) {
      console.error(`Error fetching denormalized field for ${idField}:`, error);
      // On error, just update the ID field
      updateFields.push(sql`${sql.raw(idField)} = ${value}`);
    }
  }
}

/**
 * Check if a field is a denormalized ID field
 */
export function isDenormalizedIdField(fieldName: string, entityType?: string): boolean {
  if (fieldName === 'level_id' && entityType) {
    return entityType === 'business' || entityType === 'office';
  }
  return fieldName in DENORMALIZED_FIELD_MAPPINGS;
}

/**
 * Get the name field corresponding to an ID field
 */
export function getNameFieldForIdField(idField: string, entityType?: string): string | null {
  if (idField === 'level_id' && entityType) {
    return 'level_name';
  }
  return DENORMALIZED_FIELD_MAPPINGS[idField]?.nameField || null;
}
