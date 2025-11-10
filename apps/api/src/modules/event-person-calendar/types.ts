/**
 * Event-Person-Calendar Types
 * @module event-person-calendar/types
 */

export interface EventPersonCalendar {
  id: string;
  code: string;
  name: string | null;
  descr: string | null;
  person_entity_type: 'employee' | 'client' | 'customer';
  person_entity_id: string;
  event_id: string;
  event_rsvp_status: 'pending' | 'accepted' | 'declined';
  from_ts: string;
  to_ts: string;
  timezone: string;
  metadata?: Record<string, any>;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
  version: number;
}

export interface CreateEventPersonCalendarRequest {
  code: string;
  name?: string;
  descr?: string;
  person_entity_type: 'employee' | 'client' | 'customer';
  person_entity_id: string;
  event_id: string;
  event_rsvp_status?: 'pending' | 'accepted' | 'declined';
  from_ts: string;
  to_ts: string;
  timezone?: string;
  metadata?: Record<string, any>;
}

export interface UpdateEventPersonCalendarRequest {
  name?: string;
  descr?: string;
  event_rsvp_status?: 'pending' | 'accepted' | 'declined';
  from_ts?: string;
  to_ts?: string;
  timezone?: string;
  metadata?: Record<string, any>;
}
