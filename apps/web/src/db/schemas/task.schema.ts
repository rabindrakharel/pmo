/**
 * Task Entity Schema
 *
 * Schema definition for the task collection.
 * Tasks are work items within projects.
 */
import {
  createEntitySchema,
  BaseEntityDoc,
  referenceFieldSchema,
  datalabelFieldSchema,
  currencyFieldSchema,
  dateFieldSchema,
  timestampFieldSchema,
} from './entity.schema';

/**
 * Task document interface
 */
export interface TaskDoc extends BaseEntityDoc {
  // References
  project_id?: string | null;
  parent_task_id?: string | null;
  assignee__employee_id?: string | null;
  reporter__employee_id?: string | null;

  // Datalabel fields
  dl__task_status?: string | null;
  dl__task_priority?: string | null;
  dl__task_type?: string | null;

  // Date fields
  due_date?: string | null;
  start_date?: string | null;
  completed_date?: string | null;

  // Time tracking
  estimated_hours?: number | null;
  actual_hours?: number | null;

  // Financial
  estimated_cost_amt?: number | null;
  actual_cost_amt?: number | null;

  // Progress
  task_percentage_complete?: number | null;

  // Additional fields
  sort_order?: number | null;
}

/**
 * Task collection schema
 */
export const taskSchema = createEntitySchema<TaskDoc>(
  'task',
  {
    // References
    project_id: referenceFieldSchema,
    parent_task_id: referenceFieldSchema,
    assignee__employee_id: referenceFieldSchema,
    reporter__employee_id: referenceFieldSchema,

    // Datalabel fields
    dl__task_status: datalabelFieldSchema,
    dl__task_priority: datalabelFieldSchema,
    dl__task_type: datalabelFieldSchema,

    // Date fields
    due_date: dateFieldSchema,
    start_date: dateFieldSchema,
    completed_date: dateFieldSchema,

    // Time tracking
    estimated_hours: { type: ['number', 'null'] },
    actual_hours: { type: ['number', 'null'] },

    // Financial
    estimated_cost_amt: currencyFieldSchema,
    actual_cost_amt: currencyFieldSchema,

    // Progress
    task_percentage_complete: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100
    },

    // Additional fields
    sort_order: { type: ['integer', 'null'] }
  },
  [
    // Entity-specific indexes
    'project_id',
    'parent_task_id',
    'assignee__employee_id',
    'dl__task_status',
    'due_date',
    ['active_flag', 'project_id'],
    ['active_flag', 'dl__task_status'],
    ['project_id', 'sort_order']
  ]
);
