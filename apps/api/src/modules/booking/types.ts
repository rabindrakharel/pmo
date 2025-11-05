/**
 * Booking Entity Type Definitions
 * @module booking/types
 */

export interface Booking {
  id: string;
  code: string;
  name: string;
  descr?: string;
  metadata?: Record<string, any>;
  active_flag: boolean;
  from_ts: string;
  to_ts?: string;
  created_ts: string;
  updated_ts: string;
  version: number;

  // Booking identification
  booking_number: string;
  booking_source: string; // 'ai_widget', 'phone', 'email', 'web_form'

  // Customer information
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_address?: string;
  customer_city?: string;
  customer_province?: string;
  customer_postal_code?: string;

  // Service details
  service_id: string;
  service_name: string;
  service_category?: string; // References dl__service_category settings (HVAC, Plumbing, Electrical, Landscaping, General Contracting)

  // Scheduling
  requested_date: string;
  requested_time_start?: string;
  requested_time_end?: string;
  scheduled_ts?: string;
  actual_start_ts?: string;
  actual_end_ts?: string;

  // Assignment
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  assigned_team_id?: string;

  // Status
  booking_status: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

  // Pricing
  estimated_cost_amt?: number;
  quoted_cost_amt?: number;
  final_cost_amt?: number;
  deposit_amt?: number;
  deposit_paid_flag: boolean;

  // Additional details
  special_instructions?: string;
  urgency_level: 'low' | 'normal' | 'high' | 'emergency';
  property_access_instructions?: string;
  parking_instructions?: string;
  pet_information?: string;

  // Lifecycle
  confirmed_ts?: string;
  confirmed_by_employee_id?: string;
  assigned_ts?: string;
  assigned_by_employee_id?: string;
  started_ts?: string;
  completed_ts?: string;
  cancelled_ts?: string;
  cancellation_reason?: string;
  cancelled_by_employee_id?: string;

  // Related entities
  calendar_event_id?: string;
  interaction_session_id?: string;
  project_id?: string;

  // Notifications
  confirmation_email_sent_flag: boolean;
  confirmation_email_sent_ts?: string;
  confirmation_sms_sent_flag: boolean;
  confirmation_sms_sent_ts?: string;
  reminder_sent_flag: boolean;
  reminder_sent_ts?: string;

  // Follow-up
  follow_up_required_flag: boolean;
  follow_up_completed_flag: boolean;
  follow_up_notes?: string;
  customer_rating?: number;
  customer_feedback?: string;
  would_recommend_flag?: boolean;

  // Weather & rescheduling
  weather_conditions?: string;
  weather_impact_flag: boolean;
  rescheduled_flag: boolean;
  rescheduled_from_date?: string;
  reschedule_reason?: string;
}

export interface CreateBookingRequest {
  code: string;
  name: string;
  descr?: string;
  booking_number: string;
  booking_source?: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  customer_address?: string;
  customer_city?: string;
  customer_province?: string;
  customer_postal_code?: string;
  service_id: string;
  service_name: string;
  service_category?: string; // References dl__service_category settings (HVAC, Plumbing, Electrical, Landscaping, General Contracting)
  requested_date: string;
  requested_time_start?: string;
  requested_time_end?: string;
  assigned_employee_id?: string;
  special_instructions?: string;
  urgency_level?: 'low' | 'normal' | 'high' | 'emergency';
  property_access_instructions?: string;
  parking_instructions?: string;
  pet_information?: string;
  estimated_cost_amt?: number;
}

export interface UpdateBookingRequest {
  name?: string;
  descr?: string;
  booking_status?: 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  scheduled_ts?: string;
  confirmed_ts?: string;
  special_instructions?: string;
  customer_rating?: number;
  customer_feedback?: string;
  cancellation_reason?: string;
}
