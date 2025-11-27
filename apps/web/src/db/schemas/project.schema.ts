/**
 * Project Entity Schema
 *
 * Schema definition for the project collection.
 * Projects are the primary work containers in the PMO system.
 */
import {
  createEntitySchema,
  BaseEntityDoc,
  referenceFieldSchema,
  datalabelFieldSchema,
  currencyFieldSchema,
  dateFieldSchema,
} from './entity.schema';

/**
 * Project document interface
 */
export interface ProjectDoc extends BaseEntityDoc {
  // Financial fields
  budget_allocated_amt?: number | null;
  budget_spent_amt?: number | null;
  budget_remaining_amt?: number | null;

  // References
  manager__employee_id?: string | null;
  business_id?: string | null;
  office_id?: string | null;

  // Datalabel fields (dl__*)
  dl__project_stage?: string | null;
  dl__project_type?: string | null;
  dl__project_priority?: string | null;

  // Date fields
  start_date?: string | null;
  end_date?: string | null;
  target_completion_date?: string | null;

  // Additional fields
  project_percentage_complete?: number | null;
}

/**
 * Project collection schema
 */
export const projectSchema = createEntitySchema<ProjectDoc>(
  'project',
  {
    // Financial fields
    budget_allocated_amt: currencyFieldSchema,
    budget_spent_amt: currencyFieldSchema,
    budget_remaining_amt: currencyFieldSchema,

    // References
    manager__employee_id: referenceFieldSchema,
    business_id: referenceFieldSchema,
    office_id: referenceFieldSchema,

    // Datalabel fields
    dl__project_stage: datalabelFieldSchema,
    dl__project_type: datalabelFieldSchema,
    dl__project_priority: datalabelFieldSchema,

    // Date fields
    start_date: dateFieldSchema,
    end_date: dateFieldSchema,
    target_completion_date: dateFieldSchema,

    // Additional fields
    project_percentage_complete: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100
    }
  },
  [
    // Entity-specific indexes
    'manager__employee_id',
    'business_id',
    'office_id',
    'dl__project_stage',
    ['active_flag', 'dl__project_stage'],
    ['active_flag', 'manager__employee_id']
  ]
);
