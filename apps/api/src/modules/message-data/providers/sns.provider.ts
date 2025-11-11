/**
 * AWS SNS Provider for SMS Delivery
 * Handles SMS message delivery via Amazon Simple Notification Service
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { IMessageProvider, SendSMSRequest, DeliveryResult } from '../types.js';

export class SNSProvider implements IMessageProvider {
  private client: SNSClient;
  private defaultSenderId: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.defaultSenderId = process.env.AWS_SNS_SENDER_ID || 'Cohuron';

    // Initialize SNS client - will use IAM role credentials from EC2 instance
    this.client = new SNSClient({ region });
  }

  /**
   * Send SMS message via AWS SNS
   */
  async send(request: SendSMSRequest): Promise<DeliveryResult> {
    try {
      // Validate phone number
      if (!this.validateRecipient(request.recipient_phone)) {
        return {
          success: false,
          error: 'Invalid phone number format. Use E.164 format (e.g., +14165551234)',
          error_code: 'INVALID_PHONE_FORMAT'
        };
      }

      // Determine message priority
      const priority = request.metadata?.priority === 'high' ? 'Transactional' : 'Promotional';

      // Send via AWS SNS
      const command = new PublishCommand({
        PhoneNumber: request.recipient_phone,
        Message: request.message,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: request.sender_id || this.defaultSenderId
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: priority
          }
        }
      });

      const sent_ts = new Date();
      const response = await this.client.send(command);

      console.log(`[SNSProvider] SMS sent successfully to ${request.recipient_phone}`, {
        messageId: response.MessageId,
        senderId: request.sender_id || this.defaultSenderId
      });

      return {
        success: true,
        provider_message_id: response.MessageId,
        provider_response: response,
        sent_ts,
        // SNS doesn't provide delivery confirmation immediately
        delivered_ts: undefined
      };

    } catch (error: any) {
      console.error('[SNSProvider] SMS send error:', error);
      return {
        success: false,
        error: error.message || 'Unknown SNS error',
        error_code: error.name || 'SNS_ERROR',
        provider_response: error
      };
    }
  }

  /**
   * Validate phone number (E.164 format)
   * Format: +[country code][subscriber number]
   * Example: +14165551234 (Canada/US)
   */
  validateRecipient(phone: string): boolean {
    // E.164 format: +[1-9]\d{1,14}
    return /^\+[1-9]\d{1,14}$/.test(phone);
  }

  /**
   * Get provider name for logging and tracking
   */
  getProviderName(): string {
    return 'aws_sns';
  }
}
