/**
 * Message Delivery Types
 * Defines interfaces for message delivery service and providers
 */

export type MessageDeliveryMethod = 'EMAIL' | 'SMS' | 'PUSH';
export type MessageDeliveryStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';

/**
 * SMS Delivery Request
 */
export interface SendSMSRequest {
  recipient_phone: string;
  message: string;
  sender_id?: string;
  metadata?: MessageMetadata;
}

/**
 * Email Delivery Request
 */
export interface SendEmailRequest {
  recipient_email: string;
  subject: string;
  message_body: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  metadata?: MessageMetadata;
}

/**
 * Push Notification Request (Future)
 */
export interface SendPushRequest {
  recipient_device_token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
  ttl?: number;
  metadata?: MessageMetadata;
}

/**
 * Email Attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  contentType: string;
}

/**
 * Message Metadata
 */
export interface MessageMetadata {
  event_id?: string;
  booking_id?: string;
  priority?: 'standard' | 'high';
  template_id?: string;
  [key: string]: any;
}

/**
 * Delivery Result
 */
export interface DeliveryResult {
  success: boolean;
  provider_message_id?: string;
  provider_response?: any;
  error?: string;
  error_code?: string;
  sent_ts?: Date;
  delivered_ts?: Date;
}

/**
 * Provider Interface
 * All delivery providers (SNS, SES, FCM) must implement this interface
 */
export interface IMessageProvider {
  send(request: any): Promise<DeliveryResult>;
  validateRecipient(recipient: string): boolean;
  getProviderName(): string;
}

/**
 * Message Record (Database)
 */
export interface MessageRecord {
  id: string;
  code: string;
  name: string;
  message_delivery_method: MessageDeliveryMethod;
  message_schema_id?: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_device_token?: string;
  recipient_name?: string;
  subject?: string;
  template_schema?: any;
  content_data?: any;
  status: MessageDeliveryStatus;
  scheduled_ts?: string;
  sent_ts?: string;
  delivered_ts?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  metadata?: any;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}
