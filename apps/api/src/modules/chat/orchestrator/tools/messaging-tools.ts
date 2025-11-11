/**
 * Messaging MCP Tools for AI Chat Orchestrator
 * Enables AI to send SMS and Email messages via AWS SNS/SES
 * @module orchestrator/tools/messaging-tools
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Tool: sendSMSMessage
 * Send SMS notification to a phone number via AWS SNS
 */
export const SEND_SMS_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'sendSMSMessage',
    description: `Send SMS text message to a phone number using AWS SNS.

WHEN TO USE THIS TOOL:
- To send appointment confirmations via SMS
- To send booking confirmations
- To send service updates or reminders
- When customer requests SMS communication
- To confirm calendar event bookings

PHONE NUMBER FORMAT:
- Must be in E.164 format: +[country code][number]
- US/Canada example: +14165551234
- Always include country code prefix (+1 for US/Canada)

SMS BEST PRACTICES:
- Keep messages under 160 characters for single SMS
- Be clear and concise
- Include business name (Huron Home Services)
- Include call-to-action if needed (reply, confirm, cancel)
- Use professional tone

EXAMPLES:

Example 1 - Appointment Confirmation:
sendSMSMessage({
  "phone": "+14165551234",
  "message": "Hi John, your HVAC appointment is confirmed for Nov 15 at 2:00 PM. Location: 123 Main St. Reply CANCEL to reschedule. - Huron Home Services",
  "event_id": "evt-uuid-123",
  "priority": "high"
})

Example 2 - Service Completion:
sendSMSMessage({
  "phone": "+14165559876",
  "message": "Your plumbing service is complete! Total: $250. Rate us at: huron.co/review. Questions? Call (416) 555-1000. Thank you! - Huron",
  "priority": "standard"
})

Example 3 - Reminder:
sendSMSMessage({
  "phone": "+14165551111",
  "message": "Reminder: Your consultation is tomorrow at 10 AM. See you soon! - Huron Home Services",
  "event_id": "evt-uuid-456",
  "priority": "standard"
})

IMPORTANT NOTES:
- Always use context.customer.phone if available
- Validate phone number has country code (+1 prefix)
- Only send when customer explicitly requested or expects message
- Track event_id for appointment-related messages
- High priority = transactional, standard = promotional (affects delivery cost)

RESPONSE:
Returns delivery status and provider message ID for tracking`,
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Recipient phone number in E.164 format (e.g., +14165551234). Must include country code.',
        },
        message: {
          type: 'string',
          description: 'SMS message content. Keep under 160 characters for single SMS. Be clear and professional.',
        },
        event_id: {
          type: 'string',
          description: 'Optional: UUID of calendar event if this SMS is related to an appointment/booking',
        },
        priority: {
          type: 'string',
          enum: ['standard', 'high'],
          description: 'Message priority. Use "high" for transactional (confirmations, important updates), "standard" for promotional (marketing, reminders)',
        },
      },
      required: ['phone', 'message'],
    },
  },
};

/**
 * Tool: sendEmailMessage
 * Send email notification via AWS SES
 */
export const SEND_EMAIL_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'sendEmailMessage',
    description: `Send email notification to an email address using AWS SES.

WHEN TO USE THIS TOOL:
- To send detailed appointment confirmations
- To send invoices or receipts
- To send service documentation
- When customer requests email communication
- To send follow-up information

EMAIL BEST PRACTICES:
- Use clear, descriptive subject lines
- Structure message with proper formatting
- Include all relevant details
- Professional tone and formatting
- Include contact information

EXAMPLES:

Example 1 - Appointment Confirmation:
sendEmailMessage({
  "email": "customer@example.com",
  "subject": "Appointment Confirmation - Huron Home Services",
  "message": "Dear John,\\n\\nYour HVAC consultation is confirmed for:\\n\\nDate: November 15, 2025\\nTime: 2:00 PM - 4:00 PM\\nLocation: 123 Main Street, Toronto\\n\\nOur technician Sarah will arrive with all necessary equipment.\\n\\nQuestions? Call us at (416) 555-1000\\n\\nThank you,\\nHuron Home Services",
  "event_id": "evt-uuid-123"
})

Example 2 - Service Summary:
sendEmailMessage({
  "email": "jane@example.com",
  "subject": "Service Complete - Invoice Attached",
  "message": "Dear Jane,\\n\\nYour plumbing service has been completed successfully.\\n\\nService: Kitchen sink repair\\nTechnician: Mike Johnson\\nTotal Cost: $250\\n\\nWe've fixed the leak and replaced the faulty valve. Everything is working properly now.\\n\\nPlease rate your experience: https://huron.co/feedback\\n\\nThank you for choosing Huron Home Services!",
  "priority": "standard"
})

Example 3 - Booking Confirmation:
sendEmailMessage({
  "email": "bob@example.com",
  "subject": "Booking Confirmed - HVAC Inspection",
  "message": "Hi Bob,\\n\\nThank you for booking with us!\\n\\nService: Annual HVAC Inspection\\nDate: December 1, 2025\\nTime: 9:00 AM\\nEstimated Duration: 2 hours\\n\\nWhat to expect:\\n- Complete system check\\n- Filter replacement\\n- Performance report\\n\\nNeed to reschedule? Reply to this email or call (416) 555-1000.\\n\\nBest regards,\\nHuron Home Services Team",
  "event_id": "evt-uuid-789",
  "priority": "high"
})

IMPORTANT NOTES:
- Always use context.customer.email if available
- Validate email format before sending
- Use \\n for line breaks in plain text emails
- Include business contact information
- Track event_id for appointment-related emails

RESPONSE:
Returns delivery status and provider message ID for tracking`,
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Recipient email address (e.g., customer@example.com). Must be valid email format.',
        },
        subject: {
          type: 'string',
          description: 'Email subject line. Be clear and descriptive.',
        },
        message: {
          type: 'string',
          description: 'Email message body (plain text). Use \\n for line breaks. Be professional and include all relevant details.',
        },
        event_id: {
          type: 'string',
          description: 'Optional: UUID of calendar event if this email is related to an appointment/booking',
        },
        priority: {
          type: 'string',
          enum: ['standard', 'high'],
          description: 'Message priority. Use "high" for important notifications, "standard" for regular communications',
        },
      },
      required: ['email', 'subject', 'message'],
    },
  },
};

/**
 * Export all messaging tools
 */
export const MESSAGING_TOOLS = [SEND_SMS_TOOL, SEND_EMAIL_TOOL];
