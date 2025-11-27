/**
 * Employee Entity Schema
 *
 * Schema definition for the employee collection.
 * Employees are people who work on projects and tasks.
 */
import {
  createEntitySchema,
  BaseEntityDoc,
  referenceFieldSchema,
  datalabelFieldSchema,
  dateFieldSchema,
} from './entity.schema';

/**
 * Employee document interface
 */
export interface EmployeeDoc extends BaseEntityDoc {
  // Personal info
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;

  // References
  manager__employee_id?: string | null;
  department_id?: string | null;
  office_id?: string | null;
  role_id?: string | null;
  user_id?: string | null;

  // Datalabel fields
  dl__employment_status?: string | null;
  dl__employment_type?: string | null;

  // Date fields
  hire_date?: string | null;
  termination_date?: string | null;

  // Additional fields
  job_title?: string | null;
  profile_image_url?: string | null;
}

/**
 * Employee collection schema
 */
export const employeeSchema = createEntitySchema<EmployeeDoc>(
  'employee',
  {
    // Personal info
    first_name: { type: ['string', 'null'], maxLength: 100 },
    last_name: { type: ['string', 'null'], maxLength: 100 },
    email: { type: ['string', 'null'], maxLength: 255 },
    phone: { type: ['string', 'null'], maxLength: 50 },

    // References
    manager__employee_id: referenceFieldSchema,
    department_id: referenceFieldSchema,
    office_id: referenceFieldSchema,
    role_id: referenceFieldSchema,
    user_id: referenceFieldSchema,

    // Datalabel fields
    dl__employment_status: datalabelFieldSchema,
    dl__employment_type: datalabelFieldSchema,

    // Date fields
    hire_date: dateFieldSchema,
    termination_date: dateFieldSchema,

    // Additional fields
    job_title: { type: ['string', 'null'], maxLength: 200 },
    profile_image_url: { type: ['string', 'null'], maxLength: 500 }
  },
  [
    // Entity-specific indexes
    'email',
    'manager__employee_id',
    'department_id',
    'office_id',
    'role_id',
    'dl__employment_status',
    ['active_flag', 'office_id'],
    ['active_flag', 'department_id']
  ]
);
