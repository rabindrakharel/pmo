/**
 * AWS SES Provider for Email Delivery
 * Handles email message delivery via Amazon Simple Email Service
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import type { IMessageProvider, SendEmailRequest, DeliveryResult } from '../types.js';

export class SESProvider implements IMessageProvider {
  private client: SESClient;
  private defaultFromEmail: string;
  private defaultFromName: string;
  private configurationSet: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.defaultFromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@cohuron.com';
    this.defaultFromName = process.env.AWS_SES_FROM_NAME || 'Cohuron PMO';
    this.configurationSet = process.env.AWS_SES_CONFIGURATION_SET || 'cohuron-email-tracking';

    // Initialize SES client - will use IAM role credentials from EC2 instance
    this.client = new SESClient({ region });
  }

  /**
   * Send Email message via AWS SES
   */
  async send(request: SendEmailRequest): Promise<DeliveryResult> {
    try {
      // Validate email address
      if (!this.validateRecipient(request.recipient_email)) {
        return {
          success: false,
          error: 'Invalid email address format',
          error_code: 'INVALID_EMAIL_FORMAT'
        };
      }

      // Prepare source email address
      const fromEmail = request.from_email || this.defaultFromEmail;
      const fromName = request.from_name || this.defaultFromName;
      const sourceEmail = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      // Simple email (no attachments)
      if (!request.attachments || request.attachments.length === 0) {
        const command = new SendEmailCommand({
          Source: sourceEmail,
          Destination: {
            ToAddresses: [request.recipient_email],
            CcAddresses: request.cc,
            BccAddresses: request.bcc
          },
          Message: {
            Subject: {
              Data: request.subject,
              Charset: 'UTF-8'
            },
            Body: {
              Text: {
                Data: request.message_body,
                Charset: 'UTF-8'
              }
              // TODO: Add HTML support based on content_data
              // Html: { Data: htmlBody, Charset: 'UTF-8' }
            }
          },
          ReplyToAddresses: request.reply_to ? [request.reply_to] : undefined,
          ConfigurationSetName: this.configurationSet
        });

        const sent_ts = new Date();
        const response = await this.client.send(command);

        console.log(`[SESProvider] Email sent successfully to ${request.recipient_email}`, {
          messageId: response.MessageId,
          subject: request.subject
        });

        return {
          success: true,
          provider_message_id: response.MessageId,
          provider_response: response,
          sent_ts,
          // SES doesn't provide delivery confirmation immediately
          delivered_ts: undefined
        };

      } else {
        // For attachments, use SendRawEmailCommand with MIME construction
        // This is a more complex implementation - for now, throw error
        return {
          success: false,
          error: 'Email attachments not yet implemented. Please use simple email without attachments.',
          error_code: 'ATTACHMENTS_NOT_SUPPORTED'
        };
      }

    } catch (error: any) {
      console.error('[SESProvider] Email send error:', error);

      // Handle specific SES errors
      let errorCode = error.name || 'SES_ERROR';
      let errorMessage = error.message || 'Unknown SES error';

      // Common SES errors
      if (error.name === 'MessageRejected') {
        errorCode = 'MESSAGE_REJECTED';
        errorMessage = 'Email was rejected by SES (check domain verification and sending limits)';
      } else if (error.name === 'MailFromDomainNotVerified') {
        errorCode = 'DOMAIN_NOT_VERIFIED';
        errorMessage = 'Sender email domain is not verified in SES';
      }

      return {
        success: false,
        error: errorMessage,
        error_code: errorCode,
        provider_response: error
      };
    }
  }

  /**
   * Validate email address format
   */
  validateRecipient(email: string): boolean {
    // Basic email validation regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Get provider name for logging and tracking
   */
  getProviderName(): string {
    return 'aws_ses';
  }
}
