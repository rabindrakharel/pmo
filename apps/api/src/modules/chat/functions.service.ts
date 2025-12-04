/**
 * Function Tools for OpenAI Agent
 * Implements all 7 function tools that the AI agent can call
 * @module chat/functions.service
 */

import { client, db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Service,
  EmployeeAvailability,
  TimeSlot,
  BookingRequest,
  BookingResponse
} from './types.js';

/**
 * Function 1: Get Available Services
 * Lists all active services, optionally filtered by category
 */
export async function getAvailableServices(args: {
  service_category?: string;
}): Promise<Service[]> {
  try {
    let query;

    if (args.service_category) {
      query = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          service_category,
          standard_rate_amt,
          estimated_hours,
          minimum_charge_amt,
          requires_certification_flag
        FROM app.service
        WHERE active_flag = true
          AND service_category = ${args.service_category}
        ORDER BY standard_rate_amt ASC
      `;
    } else {
      query = client`
        SELECT
          id::text,
          code,
          name,
          descr,
          service_category,
          standard_rate_amt,
          estimated_hours,
          minimum_charge_amt,
          requires_certification_flag
        FROM app.service
        WHERE active_flag = true
        ORDER BY service_category, standard_rate_amt ASC
      `;
    }

    const result = await query;
    return result as Service[];
  } catch (error) {
    console.error('Error in getAvailableServices:', error);
    throw new Error('Failed to fetch services');
  }
}

/**
 * Function 2: Get Service Details
 * Returns detailed information about a specific service
 */
export async function getServiceDetails(args: {
  service_id: string;
}): Promise<Service | null> {
  try {
    const query = client`
      SELECT
        id::text,
        code,
        name,
        descr,
        service_category,
        standard_rate_amt,
        estimated_hours,
        minimum_charge_amt,
        requires_certification_flag,
        metadata
      FROM app.service
      WHERE id = ${args.service_id}::uuid
        AND active_flag = true
    `;

    const result = await query;
    return result.length > 0 ? (result[0] as Service) : null;
  } catch (error) {
    console.error('Error in getServiceDetails:', error);
    throw new Error('Failed to fetch service details');
  }
}

/**
 * Function 3: Get Employee Availability
 * Checks which employees are available to perform a service on a specific date
 */
export async function getEmployeeAvailability(args: {
  service_category: string;
  requested_date: string;
}): Promise<EmployeeAvailability[]> {
  try {
    // Step 1: Find employees in the department matching service category
    const employeesQuery = client`
      SELECT
        id::text,
        name,
        email,
        title,
        department
      FROM app.employee
      WHERE active_flag = true
        AND department = ${args.service_category}
        AND employee_type = 'full-time'
      ORDER BY name
      LIMIT 10
    `;

    const employees = await employeesQuery;

    if (employees.length === 0) {
      return [];
    }

    // Step 2: Check calendar conflicts for each employee on the requested date
    const availability: EmployeeAvailability[] = [];

    for (const emp of employees) {
      const conflictsQuery = client`
        SELECT COUNT(*) as conflict_count
        FROM app.d_employee_calendar ec
        INNER JOIN app.d_calendar c ON c.id = ec.calendar_event_id
        WHERE ec.employee_id = ${emp.id}::uuid
          AND ec.active_flag = true
          AND c.active_flag = true
          AND DATE(c.start_ts) = ${args.requested_date}::date
          AND ec.response_status IN ('accepted', 'tentative')
          AND EXTRACT(HOUR FROM c.start_ts) BETWEEN 8 AND 17
      `;

      const conflictsResult = await conflictsQuery;
      const conflictCount = parseInt(conflictsResult[0].conflict_count);

      // If employee has fewer than 6 conflicts (allowing some availability)
      if (conflictCount < 6) {
        availability.push({
          employee_id: emp.id,
          employee_name: emp.name,
          title: emp.title || 'Technician',
          department: emp.department,
          available_slots: generateTimeSlots(conflictCount)
        });
      }
    }

    return availability;
  } catch (error) {
    console.error('Error in getEmployeeAvailability:', error);
    throw new Error('Failed to check employee availability');
  }
}

/**
 * Helper function to generate available time slots
 * Based on typical business hours (9 AM - 5 PM)
 */
function generateTimeSlots(conflictCount: number): string[] {
  const businessHours = [
    '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'
  ];

  // Remove slots based on conflict count (simulate real conflicts)
  const availableSlots = businessHours.slice(0, Math.max(3, 7 - conflictCount));
  return availableSlots;
}

/**
 * Function 4: Get Available Time Slots
 * Returns specific available time slots for an employee on a date
 */
export async function getAvailableTimeSlots(args: {
  employee_id: string;
  date: string;
}): Promise<TimeSlot[]> {
  try {
    // Get employee details
    const empQuery = client`
      SELECT name FROM app.employee
      WHERE id = ${args.employee_id}::uuid AND active_flag = true
    `;
    const empResult = await empQuery;

    if (empResult.length === 0) {
      throw new Error('Employee not found');
    }

    const employeeName = empResult[0].name;

    // Get calendar events for this employee on this date
    const eventsQuery = client`
      SELECT
        c.start_ts,
        c.end_ts
      FROM app.d_employee_calendar ec
      INNER JOIN app.d_calendar c ON c.id = ec.calendar_event_id
      WHERE ec.employee_id = ${args.employee_id}::uuid
        AND ec.active_flag = true
        AND c.active_flag = true
        AND DATE(c.start_ts) = ${args.date}::date
        AND ec.response_status IN ('accepted', 'tentative')
      ORDER BY c.start_ts
    `;

    const eventsResult = await eventsQuery;
    const busySlots = eventsResult.map(row => ({
      start: new Date(row.start_ts).getHours(),
      end: new Date(row.end_ts).getHours()
    }));

    // Generate time slots for business hours (9 AM - 5 PM)
    const slots: TimeSlot[] = [];
    const businessHours = [9, 10, 11, 13, 14, 15, 16];

    for (const hour of businessHours) {
      const isBusy = busySlots.some(
        slot => hour >= slot.start && hour < slot.end
      );

      slots.push({
        start_time: `${hour.toString().padStart(2, '0')}:00`,
        end_time: `${(hour + 1).toString().padStart(2, '0')}:00`,
        available: !isBusy,
        employee_id: args.employee_id,
        employee_name: employeeName
      });
    }

    return slots.filter(slot => slot.available);
  } catch (error) {
    console.error('Error in getAvailableTimeSlots:', error);
    throw new Error('Failed to get time slots');
  }
}

/**
 * Function 5: Search Customer
 * Find customer by phone number or address
 */
export async function searchCustomer(args: {
  phone?: string;
  address?: string;
  email?: string;
}): Promise<any> {
  try {
    let query;

    if (args.phone) {
      query = client`
        SELECT id::text, code, name, primary_email, primary_phone, primary_address, city, province
        FROM app.customer
        WHERE primary_phone = ${args.phone} AND active_flag = true
        LIMIT 1
      `;
    } else if (args.email) {
      query = client`
        SELECT id::text, code, name, primary_email, primary_phone, primary_address, city, province
        FROM app.customer
        WHERE primary_email = ${args.email} AND active_flag = true
        LIMIT 1
      `;
    } else if (args.address) {
      query = client`
        SELECT id::text, code, name, primary_email, primary_phone, primary_address, city, province
        FROM app.customer
        WHERE primary_address ILIKE ${`%${args.address}%`} AND active_flag = true
        LIMIT 1
      `;
    } else {
      throw new Error('Must provide phone, email, or address');
    }

    const result = await query;
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error in searchCustomer:', error);
    throw new Error('Failed to search customer');
  }
}

/**
 * Function 9: Create Customer
 * Create a new customer record
 */
export async function createCustomer(args: {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
}): Promise<any> {
  try {
    const customerId = uuidv4();
    const customerCode = await generateCustomerCode();
    const custNumber = await generateCustomerCode(); // cust_number required

    const query = client`
      INSERT INTO app.customer (
        id, code, name, cust_number, cust_type, cust_status,
        primary_email, primary_phone, primary_contact_name,
        primary_address, city, province,
        active_flag
      ) VALUES (
        ${customerId}::uuid,
        ${customerCode},
        ${args.name},
        ${custNumber},
        'residential',
        'active',
        ${args.email || null},
        ${args.phone},
        ${args.name},
        ${args.address || null},
        ${args.city || null},
        ${args.province || 'ON'},
        true
      )
      RETURNING id::text, code, name, primary_email, primary_phone, primary_address
    `;

    const result = await query;

    // Register in entity_instance registry (using correct column names)
    await client`
      INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
      VALUES ('customer', ${customerId}::uuid, ${args.name}, ${customerCode})
    `;

    console.log(`✅ Created customer: ${customerCode}`);
    return result[0];
  } catch (error) {
    console.error('Error in createCustomer:', error);
    throw new Error('Failed to create customer');
  }
}

/**
 * Function 10: Update Customer
 * Update existing customer information - supports ANY field dynamically
 */
export async function updateCustomer(args: {
  customer_id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  // Support any additional field
  [key: string]: any;
}): Promise<any> {
  try {
    const updates: any = { updated_ts: client`now()` };

    // Map common fields to database column names
    if (args.name !== undefined) {
      updates.name = args.name;
      updates.primary_contact_name = args.name;
    }
    if (args.phone !== undefined) updates.primary_phone = args.phone;
    if (args.email !== undefined) updates.primary_email = args.email;
    if (args.address !== undefined) updates.primary_address = args.address;
    if (args.city !== undefined) updates.city = args.city;
    if (args.province !== undefined) updates.province = args.province;
    if (args.postal_code !== undefined) updates.postal_code = args.postal_code;

    // Handle any other fields dynamically (for future extensibility)
    const knownFields = ['customer_id', 'name', 'phone', 'email', 'address', 'city', 'province', 'postal_code'];
    for (const [key, value] of Object.entries(args)) {
      if (!knownFields.includes(key) && value !== undefined) {
        // Map to actual column name if needed
        const columnName = key.startsWith('primary_') ? key : `primary_${key}`;
        updates[columnName] = value;
      }
    }

    if (Object.keys(updates).length === 1) {
      // Only updated_ts, no actual changes
      console.log(`⚠️ No fields to update for customer: ${args.customer_id}`);
      return await client`
        SELECT id::text, code, name, primary_email, primary_phone, primary_address, city, province
        FROM app.customer
        WHERE id = ${args.customer_id}::uuid AND active_flag = true
      `.then(r => r[0]);
    }

    const query = client`
      UPDATE app.cust
      SET ${client(updates)}
      WHERE id = ${args.customer_id}::uuid AND active_flag = true
      RETURNING id::text, code, name, primary_email, primary_phone, primary_address, city, province, postal_code
    `;

    const result = await query;
    console.log(`✅ Updated customer: ${args.customer_id} with fields: ${Object.keys(updates).join(', ')}`);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error in updateCustomer:', error);
    throw new Error('Failed to update customer');
  }
}

/**
 * Function 11: Create Task
 * Create a service task for customer issue
 */
export async function createTask(args: {
  customer_id: string;
  title: string;
  description: string;
  service_category: string;
  priority?: string;
  scheduled_date?: string;
  assigned_employee_id?: string;
}): Promise<any> {
  try {
    const taskId = uuidv4();
    const taskCode = await generateTaskCode();

    const query = client`
      INSERT INTO app.task (
        id, code, name, descr,
        task_stage, task_priority,
        scheduled_start_date,
        assigned_employee_id,
        active_flag
      ) VALUES (
        ${taskId}::uuid,
        ${taskCode},
        ${args.title},
        ${args.description},
        'backlog',
        ${args.priority || 'medium'},
        ${args.scheduled_date ? client`${args.scheduled_date}::date` : client`NULL`},
        ${args.assigned_employee_id ? client`${args.assigned_employee_id}::uuid` : client`NULL`},
        true
      )
      RETURNING id::text, code, name, descr, task_stage, task_priority
    `;

    const result = await query;

    // Register in entity_instance registry (using correct column names)
    await client`
      INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
      VALUES ('task', ${taskId}::uuid, ${args.title}, ${taskCode})
    `;

    // Link task to customer (using correct column names)
    await client`
      INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id)
      VALUES ('customer', ${args.customer_id}::uuid, 'task', ${taskId}::uuid)
    `;

    console.log(`✅ Created task: ${taskCode} for customer`);
    return result[0];
  } catch (error) {
    console.error('Error in createTask:', error);
    throw new Error('Failed to create task');
  }
}

/**
 * Helper: Generate customer code
 */
async function generateCustomerCode(): Promise<string> {
  const query = client`
    SELECT code FROM app.customer
    WHERE code LIKE 'CL-%'
    ORDER BY code DESC
    LIMIT 1
  `;
  const result = await query;

  let nextNumber = 1;
  if (result.length > 0) {
    const match = result[0].code.match(/CL-(\d+)/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }

  return `CL-${nextNumber.toString().padStart(6, '0')}`;
}

/**
 * Helper: Generate task code
 */
async function generateTaskCode(): Promise<string> {
  const year = new Date().getFullYear();
  const query = client`
    SELECT code FROM app.task
    WHERE code LIKE ${`TSK-${year}-%`}
    ORDER BY code DESC
    LIMIT 1
  `;
  const result = await query;

  let nextNumber = 1;
  if (result.length > 0) {
    const match = result[0].code.match(/TSK-\d{4}-(\d{5})/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }

  return `TSK-${year}-${nextNumber.toString().padStart(5, '0')}`;
}

/**
 * Export all function tools
 */
export const functionTools = {
  search_customer: searchCustomer,
  create_customer: createCustomer,
  update_customer: updateCustomer,
  create_task: createTask,
  get_available_services: getAvailableServices,
  get_service_details: getServiceDetails,
  get_employee_availability: getEmployeeAvailability,
  get_available_time_slots: getAvailableTimeSlots
};
