/**
 * Person Calendar Types
 * @module person-calendar/types
 */

export interface PersonCalendar {
  id: string;
  code: string;
  name: string;
  descr?: string;
  metadata?: Record<string, any>;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
  version: number;

  // Person identification
  person_entity_type: 'employee' | 'customer';
  person_id: string;

  // Time slot
  from_ts: string;
  to_ts: string;
  timezone: string;

  // Availability
  availability_flag: boolean;

  // Appointment details (when booked)
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;
  event_id?: string;

  // Notifications
  reminder_sent_flag?: boolean;
  reminder_sent_ts?: string;
  confirmation_sent_flag?: boolean;
  confirmation_sent_ts?: string;
}

export interface CreatePersonCalendarRequest {
  code: string;
  name: string;
  descr?: string;
  person_entity_type: 'employee' | 'customer';
  person_id: string;
  from_ts: string;
  to_ts: string;
  timezone?: string;
  availability_flag?: boolean;
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;
  event_id?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePersonCalendarRequest {
  name?: string;
  descr?: string;
  availability_flag?: boolean;
  title?: string;
  appointment_medium?: 'onsite' | 'virtual';
  appointment_addr?: string;
  instructions?: string;
  event_id?: string;
  metadata?: Record<string, any>;
  reminder_sent_flag?: boolean;
  confirmation_sent_flag?: boolean;
}
