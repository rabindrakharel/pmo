/**
 * Message Data Service
 * Handles database operations and message delivery for sent/scheduled messages
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { MessageDeliveryService } from './delivery.service.js';
import type {
  SendSMSRequest,
  SendEmailRequest,
  MessageRecord,
  DeliveryResult,
  MessageDeliveryMethod
} from './types.js';

export class MessageDataService {
  private deliveryService: MessageDeliveryService;

  constructor() {
    this.deliveryService = new MessageDeliveryService();
  }

  /**
   * Send message and create database record
   * This is the main entry point for sending messages
   */
  async sendMessage(params: {
    message_schema_id: string;
    content_data: any;
    recipient_email?: string;
    recipient_phone?: string;
    recipient_device_token?: string;
    recipient_name?: string;
    recipient_entity_id?: string;
    scheduled_ts?: string;
    metadata?: any;
    send_immediately?: boolean; // If false, just create record without sending
  }): Promise<{ message: any; delivery: DeliveryResult | null }> {

    // Fetch the message schema template
    const schemaResult = await db.execute(sql`
      SELECT * FROM app.d_message_schema
      WHERE id = ${params.message_schema_id}::uuid
        AND active_flag = true
    `);

    if (schemaResult.length === 0) {
      throw new Error('Message schema not found');
    }

    const schema = schemaResult[0] as any;
    const deliveryMethod: MessageDeliveryMethod = schema.message_delivery_method;

    // Determine recipient based on delivery method
    const recipient_email = deliveryMethod === 'EMAIL' ?
      (params.content_data.recipient || params.recipient_email) : params.recipient_email;
    const recipient_phone = deliveryMethod === 'SMS' ?
      (params.content_data.recipient || params.recipient_phone) : params.recipient_phone;
    const recipient_device_token = deliveryMethod === 'PUSH' ?
      (params.content_data.recipient || params.recipient_device_token) : params.recipient_device_token;

    // Determine if we should send immediately or schedule
    const isScheduled = Boolean(params.scheduled_ts);
    const shouldSendNow = params.send_immediately !== false && !isScheduled;

    let deliveryResult: DeliveryResult | null = null;
    let status = isScheduled ? 'scheduled' : 'pending';
    let sent_ts = null;
    let delivered_ts = null;
    let error_code = null;
    let error_message = null;

    // Send message immediately if not scheduled
    if (shouldSendNow) {
      try {
        deliveryResult = await this.deliverMessage({
          deliveryMethod,
          recipient_email,
          recipient_phone,
          recipient_device_token,
          schema,
          content_data: params.content_data
        });

        // Update status based on delivery result
        if (deliveryResult.success) {
          status = 'sent';
          sent_ts = deliveryResult.sent_ts?.toISOString() || new Date().toISOString();
          delivered_ts = deliveryResult.delivered_ts?.toISOString() || null;
        } else {
          status = 'failed';
          error_code = deliveryResult.error_code || null;
          error_message = deliveryResult.error || null;
        }
      } catch (error: any) {
        console.error('[MessageDataService] Delivery error:', error);
        status = 'failed';
        error_code = 'DELIVERY_ERROR';
        error_message = error.message;
      }
    }

    // Create database record
    const result = await db.execute(sql`
      INSERT INTO app.f_message_data (
        message_schema_id,
        code,
        name,
        subject,
        descr,
        message_delivery_method,
        status,
        template_schema,
        content_data,
        preview_text,
        from_name,
        from_email,
        reply_to_email,
        sms_sender_id,
        push_priority,
        push_ttl,
        recipient_email,
        recipient_phone,
        recipient_device_token,
        recipient_name,
        recipient_entity_id,
        scheduled_ts,
        sent_ts,
        delivered_ts,
        error_code,
        error_message,
        metadata
      ) VALUES (
        ${params.message_schema_id}::uuid,
        ${schema.code},
        ${schema.name},
        ${schema.subject},
        ${schema.descr},
        ${deliveryMethod},
        ${status},
        ${JSON.stringify(schema.template_schema)}::jsonb,
        ${JSON.stringify(params.content_data)}::jsonb,
        ${schema.preview_text},
        ${schema.from_name},
        ${schema.from_email},
        ${schema.reply_to_email},
        ${schema.sms_sender_id},
        ${schema.push_priority},
        ${schema.push_ttl},
        ${recipient_email || null},
        ${recipient_phone || null},
        ${recipient_device_token || null},
        ${params.recipient_name || params.content_data.recipientName || null},
        ${params.recipient_entity_id || null},
        ${params.scheduled_ts || null},
        ${sent_ts},
        ${delivered_ts},
        ${error_code},
        ${error_message},
        ${params.metadata ? JSON.stringify(params.metadata) : '{}'}::jsonb
      )
      RETURNING *
    `);

    const message = result[0];

    // Register in entity instance registry
    await db.execute(sql`
      INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
      VALUES ('message', ${message.id}::uuid, ${message.name}, ${message.code})
      ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET entity_name = EXCLUDED.entity_name,
          entity_code = EXCLUDED.entity_code,
          updated_ts = now()
    `);

    console.log(`[MessageDataService] Message created:`, {
      id: message.id,
      status,
      deliveryMethod,
      sent: shouldSendNow,
      success: deliveryResult?.success
    });

    return {
      message,
      delivery: deliveryResult
    };
  }

  /**
   * Deliver message via appropriate provider
   */
  private async deliverMessage(params: {
    deliveryMethod: MessageDeliveryMethod;
    recipient_email?: string;
    recipient_phone?: string;
    recipient_device_token?: string;
    schema: any;
    content_data: any;
  }): Promise<DeliveryResult> {
    const { deliveryMethod, recipient_email, recipient_phone, recipient_device_token, schema, content_data } = params;

    switch (deliveryMethod) {
      case 'SMS':
        if (!recipient_phone) {
          throw new Error('Recipient phone number required for SMS delivery');
        }

        // Interpolate variables in message template
        let smsMessage = schema.template_schema?.message || '';
        if (content_data.variables) {
          Object.entries(content_data.variables).forEach(([key, value]) => {
            smsMessage = smsMessage.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          });
        }

        const smsRequest: SendSMSRequest = {
          recipient_phone,
          message: smsMessage,
          sender_id: schema.sms_sender_id || undefined,
          metadata: content_data.metadata || {}
        };

        return await this.deliveryService.sendSMS(smsRequest);

      case 'EMAIL':
        if (!recipient_email) {
          throw new Error('Recipient email address required for EMAIL delivery');
        }

        // Interpolate variables in subject and body
        let emailSubject = schema.subject || '';
        let emailBody = this.renderEmailBody(schema.template_schema, content_data.variables);

        if (content_data.variables) {
          Object.entries(content_data.variables).forEach(([key, value]) => {
            emailSubject = emailSubject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          });
        }

        const emailRequest: SendEmailRequest = {
          recipient_email,
          subject: emailSubject,
          message_body: emailBody,
          from_email: schema.from_email || undefined,
          from_name: schema.from_name || undefined,
          reply_to: schema.reply_to_email || undefined,
          metadata: content_data.metadata || {}
        };

        return await this.deliveryService.sendEmail(emailRequest);

      case 'PUSH':
        if (!recipient_device_token) {
          throw new Error('Recipient device token required for PUSH delivery');
        }

        // TODO: Implement push notification delivery
        return {
          success: false,
          error: 'Push notifications not yet implemented',
          error_code: 'NOT_IMPLEMENTED'
        };

      default:
        throw new Error(`Unsupported delivery method: ${deliveryMethod}`);
    }
  }

  /**
   * Render email body from template schema
   * Handles rich block-based templates and plain text
   */
  private renderEmailBody(templateSchema: any, variables?: Record<string, any>): string {
    if (!templateSchema) {
      return '';
    }

    // If template has blocks (rich email)
    if (templateSchema.blocks && Array.isArray(templateSchema.blocks)) {
      let body = '';

      for (const block of templateSchema.blocks) {
        if (block.type === 'text') {
          let content = block.content || '';
          // Interpolate variables
          if (variables) {
            Object.entries(variables).forEach(([key, value]) => {
              content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            });
          }
          // Strip HTML tags for plain text email (for now)
          body += content.replace(/<[^>]*>/g, '') + '\n\n';
        }
        // TODO: Handle other block types (image, button, etc.)
      }

      return body.trim();
    }

    // Plain text template
    if (templateSchema.message) {
      let body = templateSchema.message;
      if (variables) {
        Object.entries(variables).forEach(([key, value]) => {
          body = body.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        });
      }
      return body;
    }

    return '';
  }

  /**
   * Retry failed message delivery
   */
  async retryMessage(messageId: string): Promise<{ success: boolean; delivery?: DeliveryResult; error?: string }> {
    // Fetch message record
    const result = await db.execute(sql`
      SELECT * FROM app.f_message_data
      WHERE id = ${messageId}::uuid
        AND active_flag = true
    `);

    if (result.length === 0) {
      return { success: false, error: 'Message not found' };
    }

    const message = result[0] as any;

    // Check if message can be retried
    if (message.status !== 'failed') {
      return { success: false, error: 'Only failed messages can be retried' };
    }

    if (message.retry_count >= message.max_retries) {
      return { success: false, error: 'Maximum retry attempts reached' };
    }

    // Fetch schema
    const schemaResult = await db.execute(sql`
      SELECT * FROM app.d_message_schema
      WHERE id = ${message.message_schema_id}::uuid
        AND active_flag = true
    `);

    if (schemaResult.length === 0) {
      return { success: false, error: 'Message schema not found' };
    }

    const schema = schemaResult[0] as any;

    // Attempt delivery
    try {
      const deliveryResult = await this.deliverMessage({
        deliveryMethod: message.message_delivery_method,
        recipient_email: message.recipient_email,
        recipient_phone: message.recipient_phone,
        recipient_device_token: message.recipient_device_token,
        schema,
        content_data: message.content_data
      });

      // Update message record
      const newStatus = deliveryResult.success ? 'sent' : 'failed';
      const newRetryCount = message.retry_count + 1;

      await db.execute(sql`
        UPDATE app.f_message_data
        SET
          status = ${newStatus},
          sent_ts = ${deliveryResult.success ? (deliveryResult.sent_ts?.toISOString() || new Date().toISOString()) : message.sent_ts},
          delivered_ts = ${deliveryResult.delivered_ts?.toISOString() || null},
          error_code = ${deliveryResult.error_code || null},
          error_message = ${deliveryResult.error || null},
          retry_count = ${newRetryCount},
          updated_ts = NOW()
        WHERE id = ${messageId}::uuid
      `);

      return { success: true, delivery: deliveryResult };

    } catch (error: any) {
      console.error('[MessageDataService] Retry error:', error);

      // Update retry count even on error
      await db.execute(sql`
        UPDATE app.f_message_data
        SET
          retry_count = retry_count + 1,
          error_message = ${error.message},
          updated_ts = NOW()
        WHERE id = ${messageId}::uuid
      `);

      return { success: false, error: error.message };
    }
  }
}
