/**
 * Type definitions for AI Chat Widget Module
 * @module chat/types
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string; // For function calls
  timestamp: string;
}

export interface ChatSession {
  session_id: string;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  interaction_type: 'chat' | 'voice';
  conversation_history: ChatMessage[];
  model_used: string;
  total_tokens: number;
  total_cost_cents: number;
  booking_created_flag: boolean;
  booking_id?: string;
  created_ts: string;
  updated_ts: string;
}

export interface FunctionCallResult {
  function_name: string;
  arguments: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
}

export interface ChatMessageRequest {
  session_id: string;
  message: string;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  interaction_type?: 'chat' | 'voice';
}

export interface ChatMessageResponse {
  session_id: string;
  response: string;
  function_calls?: FunctionCallResult[];
  booking_created: boolean;
  booking_number?: string;
  tokens_used: number;
  timestamp: string;
}

export interface NewSessionRequest {
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  referrer_url?: string;
  metadata?: Record<string, any>;
}

export interface NewSessionResponse {
  session_id: string;
  greeting: string;
  timestamp: string;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  descr?: string;
  service_category: string;
  standard_rate_amt: number;
  estimated_hours: number;
  minimum_charge_amt: number;
  requires_certification_flag: boolean;
}

export interface EmployeeAvailability {
  employee_id: string;
  employee_name: string;
  title: string;
  department: string;
  available_slots: string[];
}

export interface TimeSlot {
  start_time: string; // HH:MM format
  end_time: string;
  available: boolean;
  employee_id: string;
  employee_name: string;
}

export interface BookingRequest {
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  customer_city?: string;
  customer_province?: string;
  customer_postal_code?: string;
  requested_date: string; // YYYY-MM-DD
  requested_time_start: string; // HH:MM
  requested_time_end?: string;
  assigned_employee_id?: string;
  special_instructions?: string;
  urgency_level?: 'low' | 'normal' | 'high' | 'emergency';
}

export interface BookingResponse {
  booking_id: string;
  booking_number: string;
  service_name: string;
  requested_date: string;
  requested_time: string;
  estimated_cost: number;
  status: string;
  assigned_employee_name?: string;
}

export interface OpenAIFunctionCall {
  name: string;
  arguments: string; // JSON string
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | null;
  name?: string;
  function_call?: OpenAIFunctionCall;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  functions?: OpenAIFunction[];
  function_call?: 'auto' | 'none' | { name: string };
  temperature?: number;
  max_tokens?: number;
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      function_call?: OpenAIFunctionCall;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
