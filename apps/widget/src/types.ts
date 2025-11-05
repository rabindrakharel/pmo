/**
 * Type definitions for Chat Widget
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface WidgetConfig {
  apiUrl: string;
  theme?: 'light' | 'dark';
  position?: 'bottom-right' | 'bottom-left';
  autoOpen?: boolean;
  greeting?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  booking_created: boolean;
  booking_number?: string;
  tokens_used: number;
  timestamp: string;
}

export interface NewSessionResponse {
  session_id: string;
  greeting: string;
  timestamp: string;
}
