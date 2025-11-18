/**
 * Email Service
 * Handles email sending with calendar invite support
 * Supports Outlook, Gmail, and iCloud calendar formats
 * @module email/email.service
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import ical from 'ical-generator';
import { client } from '../../db/index.js';

/**
 * Email configuration from environment variables
 */
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  },
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'solutions@cohuron.com'
};

/**
 * Calendar event details
 */
export interface CalendarEventDetails {
  uid?: string; // Unique identifier for the event
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  organizer: {
    name: string;
    email: string;
  };
  attendees: Array<{
    name: string;
    email: string;
  }>;
  url?: string; // Meeting URL for virtual events
  method?: 'PUBLISH' | 'REQUEST' | 'CANCEL'; // iCalendar method
}

/**
 * Email options
 */
export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  calendarEvent?: CalendarEventDetails;
}

/**
 * Create email transporter
 */
function createTransporter(): Transporter {
  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: EMAIL_CONFIG.auth
  });
}

/**
 * Generate iCalendar (.ics) content
 * Compatible with Outlook, Gmail, and iCloud
 */
function generateCalendarInvite(event: CalendarEventDetails): string {
  const calendar = ical({
    prodId: { company: 'Huron Home Services', product: 'PMO Platform' },
    name: event.title,
    method: event.method || 'REQUEST'
  });

  const calendarEvent = calendar.createEvent({
    uid: event.uid || `${Date.now()}@huronhome.ca`,
    start: event.startTime,
    end: event.endTime,
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    url: event.url || '',
    organizer: {
      name: event.organizer.name,
      email: event.organizer.email
    },
    attendees: event.attendees.map(attendee => ({
      name: attendee.name,
      email: attendee.email,
      rsvp: true,
      status: 'NEEDS-ACTION',
      role: 'REQ-PARTICIPANT'
    }))
  });

  return calendar.toString();
}

/**
 * Send email with optional calendar invite
 */
export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    // Validate SMTP configuration
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('SMTP credentials not configured. Email not sent.');
      return {
        success: false,
        error: 'SMTP credentials not configured'
      };
    }

    const transporter = createTransporter();

    // Build email message
    const mailOptions: any = {
      from: EMAIL_CONFIG.from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    // Add calendar invite if provided
    if (options.calendarEvent) {
      const icsContent = generateCalendarInvite(options.calendarEvent);

      // Attach as both alternative and attachment for maximum compatibility
      mailOptions.alternatives = [
        {
          contentType: 'text/calendar; charset=utf-8; method=' + (options.calendarEvent.method || 'REQUEST'),
          content: Buffer.from(icsContent),
        }
      ];

      mailOptions.attachments = [
        {
          filename: 'invite.ics',
          content: icsContent,
          contentType: 'text/calendar; charset=utf-8; method=' + (options.calendarEvent.method || 'REQUEST')
        }
      ];
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', info.messageId);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send calendar event invite to employee
 */
export async function sendEventInviteToEmployee(args: {
  employeeId: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventLocation?: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  meetingUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Get employee email
    const empResult = await client`
      SELECT email, first_name, last_name
      FROM app.employee
      WHERE id = ${args.employeeId}::uuid AND active_flag = true
    `;

    if (empResult.length === 0) {
      return { success: false, error: 'Employee not found' };
    }

    const employee = empResult[0];

    if (!employee.email) {
      console.warn(`Employee ${employee.first_name} ${employee.last_name} has no email. Skipping invite.`);
      return { success: false, error: 'Employee has no email' };
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`;

    // Send calendar invite
    return await sendEmail({
      to: employee.email,
      subject: `Calendar Invite: ${args.eventTitle}`,
      text: `You have been invited to: ${args.eventTitle}\n\nWhen: ${args.startTime.toLocaleString()}\nLocation: ${args.eventLocation || 'TBD'}\n\n${args.eventDescription || ''}`,
      html: `
        <h2>You have been invited to:</h2>
        <h3>${args.eventTitle}</h3>
        <p><strong>When:</strong> ${args.startTime.toLocaleString()} - ${args.endTime.toLocaleString()}</p>
        <p><strong>Location:</strong> ${args.eventLocation || 'TBD'}</p>
        ${args.meetingUrl ? `<p><strong>Meeting URL:</strong> <a href="${args.meetingUrl}">${args.meetingUrl}</a></p>` : ''}
        ${args.eventDescription ? `<p><strong>Description:</strong><br/>${args.eventDescription}</p>` : ''}
      `,
      calendarEvent: {
        uid: args.eventId,
        title: args.eventTitle,
        description: args.eventDescription,
        location: args.eventLocation,
        startTime: args.startTime,
        endTime: args.endTime,
        url: args.meetingUrl,
        organizer: {
          name: args.organizerName,
          email: args.organizerEmail
        },
        attendees: [
          {
            name: employeeName,
            email: employee.email
          }
        ],
        method: 'REQUEST'
      }
    });
  } catch (error) {
    console.error('Failed to send event invite to employee:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send calendar event invite to customer
 */
export async function sendEventInviteToCustomer(args: {
  customerId: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventLocation?: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  meetingUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Get customer email
    const custResult = await client`
      SELECT primary_email, secondary_email, primary_contact_name, name
      FROM app.d_cust
      WHERE id = ${args.customerId}::uuid AND active_flag = true
    `;

    if (custResult.length === 0) {
      return { success: false, error: 'Customer not found' };
    }

    const customer = custResult[0];
    const customerEmail = customer.primary_email || customer.secondary_email;

    if (!customerEmail) {
      console.warn(`Customer ${customer.name} has no email. Skipping invite.`);
      return { success: false, error: 'Customer has no email' };
    }

    const customerName = customer.primary_contact_name || customer.name;

    // Send calendar invite
    return await sendEmail({
      to: customerEmail,
      subject: `Calendar Invite: ${args.eventTitle}`,
      text: `You have been invited to: ${args.eventTitle}\n\nWhen: ${args.startTime.toLocaleString()}\nLocation: ${args.eventLocation || 'TBD'}\n\n${args.eventDescription || ''}`,
      html: `
        <h2>You have been invited to:</h2>
        <h3>${args.eventTitle}</h3>
        <p><strong>When:</strong> ${args.startTime.toLocaleString()} - ${args.endTime.toLocaleString()}</p>
        <p><strong>Location:</strong> ${args.eventLocation || 'TBD'}</p>
        ${args.meetingUrl ? `<p><strong>Meeting URL:</strong> <a href="${args.meetingUrl}">${args.meetingUrl}</a></p>` : ''}
        ${args.eventDescription ? `<p><strong>Description:</strong><br/>${args.eventDescription}</p>` : ''}
      `,
      calendarEvent: {
        uid: args.eventId,
        title: args.eventTitle,
        description: args.eventDescription,
        location: args.eventLocation,
        startTime: args.startTime,
        endTime: args.endTime,
        url: args.meetingUrl,
        organizer: {
          name: args.organizerName,
          email: args.organizerEmail
        },
        attendees: [
          {
            name: customerName,
            email: customerEmail
          }
        ],
        method: 'REQUEST'
      }
    });
  } catch (error) {
    console.error('Failed to send event invite to customer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send event invites to multiple attendees from event metadata
 */
export async function sendEventInvitesToAttendees(args: {
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventLocation?: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  meetingUrl?: string;
  attendeeIds?: string[]; // Array of employee or client IDs
  customerId?: string;
}): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  // Send to customer if provided
  if (args.customerId) {
    const result = await sendEventInviteToCustomer({
      customerId: args.customerId,
      eventId: args.eventId,
      eventTitle: args.eventTitle,
      eventDescription: args.eventDescription,
      eventLocation: args.eventLocation,
      startTime: args.startTime,
      endTime: args.endTime,
      organizerName: args.organizerName,
      organizerEmail: args.organizerEmail,
      meetingUrl: args.meetingUrl
    });

    results.push({
      id: args.customerId,
      success: result.success,
      error: result.error
    });
  }

  // Send to all attendees (employees)
  if (args.attendeeIds && args.attendeeIds.length > 0) {
    for (const attendeeId of args.attendeeIds) {
      const result = await sendEventInviteToEmployee({
        employeeId: attendeeId,
        eventId: args.eventId,
        eventTitle: args.eventTitle,
        eventDescription: args.eventDescription,
        eventLocation: args.eventLocation,
        startTime: args.startTime,
        endTime: args.endTime,
        organizerName: args.organizerName,
        organizerEmail: args.organizerEmail,
        meetingUrl: args.meetingUrl
      });

      results.push({
        id: attendeeId,
        success: result.success,
        error: result.error
      });
    }
  }

  const totalSent = results.filter(r => r.success).length;
  const totalFailed = results.filter(r => !r.success).length;

  return {
    totalSent,
    totalFailed,
    results
  };
}
