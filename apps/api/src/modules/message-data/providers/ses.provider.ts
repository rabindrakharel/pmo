/**
 * AWS SES Provider for Email Delivery
 * Handles email message delivery via Amazon Simple Email Service
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import type { IMessageProvider, SendEmailRequest, DeliveryResult, EmailAttachment } from '../types.js';

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
        const rawEmail = this.buildMimeEmail({
          from: sourceEmail,
          to: request.recipient_email,
          cc: request.cc,
          bcc: request.bcc,
          replyTo: request.reply_to,
          subject: request.subject,
          body: request.message_body,
          attachments: request.attachments
        });

        const command = new SendRawEmailCommand({
          Source: fromEmail,
          Destinations: [
            request.recipient_email,
            ...(request.cc || []),
            ...(request.bcc || [])
          ],
          RawMessage: {
            Data: Buffer.from(rawEmail)
          },
          ConfigurationSetName: this.configurationSet
        });

        const sent_ts = new Date();
        const response = await this.client.send(command);

        console.log(`[SESProvider] Email with attachments sent successfully to ${request.recipient_email}`, {
          messageId: response.MessageId,
          attachmentCount: request.attachments.length
        });

        return {
          success: true,
          provider_message_id: response.MessageId,
          provider_response: response,
          sent_ts,
          delivered_ts: undefined
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
   * Build MIME email with attachments
   */
  private buildMimeEmail(params: {
    from: string;
    to: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    subject: string;
    body: string;
    attachments: EmailAttachment[];
  }): string {
    const boundary = `----=_Part${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { from, to, cc, bcc, replyTo, subject, body, attachments } = params;

    let mime = '';

    // Email headers
    mime += `From: ${from}\r\n`;
    mime += `To: ${to}\r\n`;
    if (cc && cc.length > 0) {
      mime += `Cc: ${cc.join(', ')}\r\n`;
    }
    if (bcc && bcc.length > 0) {
      mime += `Bcc: ${bcc.join(', ')}\r\n`;
    }
    if (replyTo) {
      mime += `Reply-To: ${replyTo}\r\n`;
    }
    mime += `Subject: ${subject}\r\n`;
    mime += `MIME-Version: 1.0\r\n`;
    mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
    mime += `\r\n`;

    // Text body part
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/plain; charset=UTF-8\r\n`;
    mime += `Content-Transfer-Encoding: 7bit\r\n`;
    mime += `\r\n`;
    mime += `${body}\r\n`;
    mime += `\r\n`;

    // Attachment parts
    for (const attachment of attachments) {
      mime += `--${boundary}\r\n`;
      mime += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
      mime += `Content-Transfer-Encoding: base64\r\n`;
      mime += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      mime += `\r\n`;
      mime += `${attachment.content}\r\n`;
      mime += `\r\n`;
    }

    // Final boundary
    mime += `--${boundary}--\r\n`;

    return mime;
  }

  /**
   * Get provider name for logging and tracking
   */
  getProviderName(): string {
    return 'aws_ses';
  }
}
