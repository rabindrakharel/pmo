/**
 * Message Delivery Service
 * Central service for delivering messages via multiple providers (SNS, SES, FCM)
 *
 * This service:
 * - Routes messages to appropriate provider based on delivery method
 * - Handles retry logic
 * - Updates message status in database
 * - Provides unified interface for message delivery
 */

import { SNSProvider } from './providers/sns.provider.js';
import { SESProvider } from './providers/ses.provider.js';
import type {
  SendSMSRequest,
  SendEmailRequest,
  SendPushRequest,
  DeliveryResult,
  MessageDeliveryMethod
} from './types.js';

export class MessageDeliveryService {
  private snsProvider: SNSProvider;
  private sesProvider: SESProvider;
  // private fcmProvider: FCMProvider; // Future implementation

  constructor() {
    this.snsProvider = new SNSProvider();
    this.sesProvider = new SESProvider();
  }

  /**
   * Send SMS message via AWS SNS
   */
  async sendSMS(request: SendSMSRequest): Promise<DeliveryResult> {
    console.log('[MessageDeliveryService] Sending SMS:', {
      recipient: request.recipient_phone,
      messageLength: request.message.length
    });

    return await this.snsProvider.send(request);
  }

  /**
   * Send Email message via AWS SES
   */
  async sendEmail(request: SendEmailRequest): Promise<DeliveryResult> {
    console.log('[MessageDeliveryService] Sending Email:', {
      recipient: request.recipient_email,
      subject: request.subject
    });

    return await this.sesProvider.send(request);
  }

  /**
   * Send Push notification (Future implementation)
   */
  async sendPush(request: SendPushRequest): Promise<DeliveryResult> {
    console.log('[MessageDeliveryService] Push notifications not yet implemented');

    return {
      success: false,
      error: 'Push notifications not yet implemented',
      error_code: 'NOT_IMPLEMENTED'
    };
  }

  /**
   * Validate recipient based on delivery method
   */
  validateRecipient(deliveryMethod: MessageDeliveryMethod, recipient: string): boolean {
    switch (deliveryMethod) {
      case 'SMS':
        return this.snsProvider.validateRecipient(recipient);
      case 'EMAIL':
        return this.sesProvider.validateRecipient(recipient);
      case 'PUSH':
        // TODO: Implement device token validation
        return recipient && recipient.length > 0;
      default:
        return false;
    }
  }

  /**
   * Get provider name for a given delivery method
   */
  getProviderName(deliveryMethod: MessageDeliveryMethod): string {
    switch (deliveryMethod) {
      case 'SMS':
        return this.snsProvider.getProviderName();
      case 'EMAIL':
        return this.sesProvider.getProviderName();
      case 'PUSH':
        return 'firebase_fcm'; // Future
      default:
        return 'unknown';
    }
  }
}
