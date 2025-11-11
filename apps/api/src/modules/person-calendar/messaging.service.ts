/**
 * Person Calendar Messaging Service
 * Handles email calendar invites and SMS notifications for person-calendar bookings
 * Uses the unified messaging service (AWS SNS/SES)
 */

import { MessageDeliveryService } from '../message-data/delivery.service.js';
import type { SendSMSRequest, SendEmailRequest } from '../message-data/types.js';
import ical, { ICalCalendarMethod } from 'ical-generator';

/**
 * Calendar invite request
 */
export interface CalendarInviteRequest {
  // Recipient details
  recipientEmail: string;
  recipientName: string;
  recipientPhone?: string;

  // Event details
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventLocation: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;

  // Organizer details
  organizerName: string;
  organizerEmail: string;

  // Meeting details
  meetingUrl?: string;
  instructions?: string;

  // Additional context
  bookingNumber?: string;
  serviceCategory?: string;
}

/**
 * SMS notification request
 */
export interface SMSNotificationRequest {
  recipientPhone: string;
  recipientName: string;
  eventTitle: string;
  eventLocation: string;
  startTime: Date;
  eventId?: string;
  bookingNumber?: string;
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  emailMessageId?: string;
  smsMessageId?: string;
  error?: string;
}

export class PersonCalendarMessagingService {
  private messageService: MessageDeliveryService;

  constructor() {
    this.messageService = new MessageDeliveryService();
  }

  /**
   * Send complete person-calendar notification (email with calendar invite + SMS)
   */
  async sendPersonCalendarNotification(request: CalendarInviteRequest): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      emailSent: false,
      smsSent: false
    };

    try {
      // Send email with calendar invite
      if (request.recipientEmail) {
        const emailResult = await this.sendCalendarInvite(request);
        result.emailSent = emailResult.success;
        result.emailMessageId = emailResult.provider_message_id;

        if (!emailResult.success) {
          console.warn(`Email failed: ${emailResult.error}`);
        }
      }

      // Send SMS notification
      if (request.recipientPhone) {
        const smsResult = await this.sendSMSNotification({
          recipientPhone: request.recipientPhone,
          recipientName: request.recipientName,
          eventTitle: request.eventTitle,
          eventLocation: request.eventLocation,
          startTime: request.startTime,
          eventId: request.eventId,
          bookingNumber: request.bookingNumber
        });
        result.smsSent = smsResult.success;
        result.smsMessageId = smsResult.provider_message_id;

        if (!smsResult.success) {
          console.warn(`SMS failed: ${smsResult.error}`);
        }
      }

      result.success = result.emailSent || result.smsSent;

      return result;
    } catch (error) {
      console.error('[PersonCalendarMessagingService] Error sending notifications:', error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Send calendar invite via email
   */
  private async sendCalendarInvite(request: CalendarInviteRequest) {
    const {
      recipientEmail,
      recipientName,
      eventId,
      eventTitle,
      eventDescription,
      eventLocation,
      startTime,
      endTime,
      timezone = 'America/Toronto',
      organizerName,
      organizerEmail,
      meetingUrl,
      instructions,
      bookingNumber,
      serviceCategory
    } = request;

    // Generate .ics calendar file
    const calendar = ical({
      name: 'Huron Home Services',
      prodId: { company: 'Cohuron', product: 'PMO Platform' },
      method: ICalCalendarMethod.REQUEST,
      timezone: timezone
    });

    calendar.createEvent({
      id: eventId,
      start: startTime,
      end: endTime,
      summary: eventTitle,
      description: eventDescription || instructions || '',
      location: meetingUrl || eventLocation,
      url: meetingUrl,
      organizer: {
        name: organizerName,
        email: organizerEmail
      },
      attendees: [
        {
          name: recipientName,
          email: recipientEmail,
          rsvp: true,
          status: 'NEEDS-ACTION' as any
        }
      ]
    });

    // Generate .ics content (base64 encoded)
    const icsContent = calendar.toString();
    const icsBase64 = Buffer.from(icsContent).toString('base64');

    // Build email body
    const emailBody = this.buildEmailBody({
      recipientName,
      eventTitle,
      eventDescription,
      startTime,
      endTime,
      timezone,
      eventLocation,
      meetingUrl,
      instructions,
      bookingNumber,
      serviceCategory
    });

    // Send email with .ics attachment
    const emailRequest: SendEmailRequest = {
      recipient_email: recipientEmail,
      subject: `Calendar Invite: ${eventTitle}`,
      message_body: emailBody,
      from_name: organizerName,
      from_email: organizerEmail,
      attachments: [
        {
          filename: 'invite.ics',
          content: icsBase64,
          contentType: 'text/calendar; method=REQUEST; charset=UTF-8'
        }
      ],
      metadata: {
        event_id: eventId,
        booking_number: bookingNumber,
        priority: 'high'
      }
    };

    return await this.messageService.sendEmail(emailRequest);
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(request: SMSNotificationRequest) {
    const { recipientPhone, recipientName, eventTitle, eventLocation, startTime, eventId, bookingNumber } = request;

    // Format date/time for SMS
    const dateStr = startTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Build SMS message (keep under 160 characters)
    const message = `Hi ${recipientName}, your appointment is confirmed!\n\n${eventTitle}\n${dateStr} at ${timeStr}\nLocation: ${eventLocation}\n${bookingNumber ? `Ref: ${bookingNumber}\n` : ''}- Huron Home Services`;

    // Send SMS
    const smsRequest: SendSMSRequest = {
      recipient_phone: recipientPhone,
      message: message,
      sender_id: 'Cohuron',
      metadata: {
        event_id: eventId,
        booking_id: bookingNumber,
        priority: 'high'
      }
    };

    return await this.messageService.sendSMS(smsRequest);
  }

  /**
   * Build email body text
   */
  private buildEmailBody(params: {
    recipientName: string;
    eventTitle: string;
    eventDescription?: string;
    startTime: Date;
    endTime: Date;
    timezone: string;
    eventLocation: string;
    meetingUrl?: string;
    instructions?: string;
    bookingNumber?: string;
    serviceCategory?: string;
  }): string {
    const {
      recipientName,
      eventTitle,
      eventDescription,
      startTime,
      endTime,
      timezone,
      eventLocation,
      meetingUrl,
      instructions,
      bookingNumber,
      serviceCategory
    } = params;

    const dateStr = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const startTimeStr = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const endTimeStr = endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let body = `Dear ${recipientName},\n\n`;
    body += `Your appointment has been confirmed!\n\n`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    body += `${eventTitle}\n\n`;

    if (eventDescription) {
      body += `${eventDescription}\n\n`;
    }

    body += `📅 Date: ${dateStr}\n`;
    body += `⏰ Time: ${startTimeStr} - ${endTimeStr} (${timezone})\n`;

    if (meetingUrl) {
      body += `🔗 Join Meeting: ${meetingUrl}\n`;
    } else {
      body += `📍 Location: ${eventLocation}\n`;
    }

    if (bookingNumber) {
      body += `🔖 Booking Reference: ${bookingNumber}\n`;
    }

    if (serviceCategory) {
      body += `🛠️  Service: ${serviceCategory}\n`;
    }

    if (instructions) {
      body += `\n📝 Instructions:\n${instructions}\n`;
    }

    body += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    body += `This appointment has been added to your calendar.\n`;
    body += `Please accept the calendar invite to confirm your attendance.\n\n`;
    body += `Need to reschedule or have questions?\n`;
    body += `Reply to this email or call us at (416) 555-1000\n\n`;
    body += `Thank you for choosing Huron Home Services!\n\n`;
    body += `Best regards,\n`;
    body += `Huron Home Services Team\n`;
    body += `solutions@cohuron.com\n`;
    body += `https://huronhome.ca\n`;

    return body;
  }

  /**
   * Send cancellation notification (email + SMS)
   */
  async sendCancellationNotification(params: {
    recipientEmail?: string;
    recipientPhone?: string;
    recipientName: string;
    eventTitle: string;
    originalStartTime: Date;
    cancellationReason?: string;
    bookingNumber?: string;
  }): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      emailSent: false,
      smsSent: false
    };

    try {
      // Send cancellation email
      if (params.recipientEmail) {
        const emailBody = `Dear ${params.recipientName},\n\nYour appointment has been cancelled.\n\nEvent: ${params.eventTitle}\nOriginal Date: ${params.originalStartTime.toLocaleString()}\n${params.cancellationReason ? `Reason: ${params.cancellationReason}\n` : ''}\n${params.bookingNumber ? `Booking Reference: ${params.bookingNumber}\n` : ''}\nTo reschedule, please contact us at (416) 555-1000 or reply to this email.\n\nThank you,\nHuron Home Services`;

        const emailResult = await this.messageService.sendEmail({
          recipient_email: params.recipientEmail,
          subject: `Appointment Cancelled: ${params.eventTitle}`,
          message_body: emailBody,
          metadata: { booking_number: params.bookingNumber, priority: 'high' }
        });

        result.emailSent = emailResult.success;
        result.emailMessageId = emailResult.provider_message_id;
      }

      // Send cancellation SMS
      if (params.recipientPhone) {
        const smsMessage = `Hi ${params.recipientName}, your appointment "${params.eventTitle}" on ${params.originalStartTime.toLocaleDateString()} has been cancelled. ${params.bookingNumber ? `Ref: ${params.bookingNumber}. ` : ''}Call (416) 555-1000 to reschedule. - Huron`;

        const smsResult = await this.messageService.sendSMS({
          recipient_phone: params.recipientPhone,
          message: smsMessage,
          metadata: { booking_number: params.bookingNumber, priority: 'high' }
        });

        result.smsSent = smsResult.success;
        result.smsMessageId = smsResult.provider_message_id;
      }

      result.success = result.emailSent || result.smsSent;
      return result;
    } catch (error) {
      console.error('[PersonCalendarMessagingService] Error sending cancellation:', error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }
}
