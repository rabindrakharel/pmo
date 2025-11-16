# Email Service

> **AWS SES email sending with template support and delivery tracking**

**File**: `apps/api/src/modules/email/email.service.ts`
**Type**: Communication Service
**Pattern**: Transactional Email

---

## Purpose

Handles transactional email sending via AWS Simple Email Service (SES) with HTML/plain text support, attachment handling, and delivery tracking integration.

---

## Where Used

### Internal Modules

| Module | Usage Context |
|--------|---------------|
| **Person Calendar** | Event invitation emails |
| **Messaging Service** | Calendar notification delivery |
| **Message Data** | Template-based email campaigns |
| **User Authentication** | Password reset emails (future) |
| **Notifications** | System alerts and updates |

### Integration Points

- **Person Calendar Service** - Event invitations, updates, cancellations
- **Messaging Service** - Calendar event notifications
- **Delivery Service** - Message delivery orchestration
- **Message Schema** - Template-based email rendering

---

## How It Works (Building Blocks)

### Block 1: AWS SES Client Configuration

**Initialization**:
- AWS SDK v3 SES client
- Region configuration from environment (`AWS_REGION`)
- IAM role or credential provider authentication

**Email Verification**:
- Sender email must be verified in SES
- Development: Sandbox mode (verified emails only)
- Production: SES production mode (any email)

**Configuration Requirements**:
- AWS credentials configured (`~/.aws/credentials` or IAM role)
- SES sending limits configured
- Domain verification (optional, for branded emails)

### Block 2: Email Composition

**Email Structure**:
- **From**: Sender email (verified in SES)
- **To**: Recipient email(s) (array support)
- **Subject**: Email subject line
- **HTML Body**: Rich HTML content
- **Plain Text Body**: Fallback for email clients without HTML
- **Attachments**: File attachments (future support)

**Template Support**:
- Message schema templates
- Variable substitution
- Dynamic content rendering

### Block 3: Sending Flow

**Sequence**:
1. **Validate** sender and recipient emails
2. **Compose** email body (HTML + plain text)
3. **Call SES** `SendEmail` API
4. **Receive** Message ID from SES
5. **Track** delivery status (via SES SNS notifications)
6. **Return** confirmation with message ID

**Retry Logic**:
- SES retries internally (AWS-managed)
- Application-level retries for transient failures
- Dead-letter queue for permanent failures

### Block 4: Delivery Tracking

**SES Notifications**:
- **Bounce** - Email bounced (invalid address, mailbox full)
- **Complaint** - Recipient marked as spam
- **Delivery** - Email successfully delivered
- **Open** - Email opened (tracking pixel)
- **Click** - Link clicked (tracking links)

**Database Integration**:
- Message delivery status stored in `f_message` table
- Bounce/complaint handling updates message status
- Tracking data for analytics

### Block 5: Template Rendering

**Message Schema Integration**:
- Load template from `d_message_schema`
- Substitute variables (e.g., `{{name}}`, `{{event_date}}`)
- Render HTML and plain text versions
- Attach dynamic content

**Variable Sources**:
- Entity data (event, person, project)
- System data (dates, URLs)
- Custom parameters

---

## Operational Flow

### Send Transactional Email

**Sequence**:
1. **Service called** with email parameters
   - `to`: Recipient email
   - `subject`: Email subject
   - `htmlBody`: HTML content
   - `textBody`: Plain text fallback
2. **Validate** email addresses (format check)
3. **Construct** SES SendEmailCommand
4. **Call SES** API
5. **SES returns** Message ID
6. **Service returns** `{ messageId, status: 'sent' }`

**Error Handling**:
- Invalid email → Validation error (400)
- SES quota exceeded → Rate limit error (429)
- SES service error → Retry or fail (500)

### Send Calendar Event Invitation

**Sequence**:
1. **Person Calendar Service** triggers email
2. **Email Service** loads event data
3. **Render** calendar invitation template
   - Event title, date/time, location
   - Organizer and attendee details
   - RSVP links (accept/decline)
4. **Attach** iCal file (`.ics` format)
5. **Send** via SES
6. **Track** delivery status

**Template Variables**:
- `{{event_title}}`
- `{{event_start}}`
- `{{event_location}}`
- `{{organizer_name}}`
- `{{rsvp_accept_url}}`
- `{{rsvp_decline_url}}`

### Process Delivery Notification

**Sequence** (via SNS webhook):
1. **SES sends** SNS notification
   - Type: Bounce, Complaint, Delivery, Open, Click
2. **API receives** webhook POST
3. **Parse** notification payload
4. **Update** message status in database
5. **Trigger** follow-up actions (if needed)
   - Bounce: Mark email invalid
   - Complaint: Unsubscribe user
   - Delivery: Update analytics

---

## Key Design Principles

### 1. AWS SES Integration

**Why**:
- Reliable, scalable email infrastructure
- Low cost (pay-per-email)
- Delivery tracking built-in
- Production-ready (high deliverability)

**Benefits**:
- No email server maintenance
- Automatic retries
- Reputation management by AWS

### 2. HTML + Plain Text Dual Format

**Why**:
- HTML: Rich formatting, branding
- Plain Text: Fallback for simple clients
- Accessibility: Screen readers prefer plain text

**Implementation**:
- Both versions sent in single email
- Email client chooses format

### 3. Template-Based Emails

**Why**:
- Consistent branding
- Reusable content
- Centralized template management
- A/B testing support (future)

**Pattern**:
- Templates stored in `d_message_schema`
- Variables substituted at runtime
- Versioning support

### 4. Delivery Tracking

**Why**:
- Monitor email health
- Identify deliverability issues
- Analytics and reporting
- User engagement metrics

**Metrics Tracked**:
- Sent, Delivered, Bounced, Complained
- Open rate, Click-through rate

---

## Dependencies

### AWS Services

- **SES** - Email sending infrastructure
- **SNS** (optional) - Delivery notifications
- **S3** (optional) - Attachment storage

### Database Tables

- **f_message** - Message delivery tracking
- **d_message_schema** - Email templates
- **d_entity_person_calendar** - Calendar event data

### Services

- **Messaging Service** - Calendar notifications
- **Delivery Service** - Multi-channel delivery
- **Person Calendar Service** - Event data

---

## Configuration

### Environment Variables

```
AWS_REGION=us-east-1
SES_SENDER_EMAIL=noreply@huronhome.ca
SES_CONFIGURATION_SET=pmo-emails
```

### SES Verification

**Development**:
- Verify sender email in SES console
- Verify recipient emails (sandbox mode)

**Production**:
- Verify domain (DNS records)
- Request production access (lift sandbox)
- Configure DKIM, SPF, DMARC

### Sending Limits

- **Sandbox**: 200 emails/day, 1 email/second
- **Production**: 50,000 emails/day (default), higher on request
- **Rate**: 14 emails/second (default)

---

## Security Considerations

### Email Verification

- Only verified emails as senders
- Prevents spam from platform
- Domain reputation protected

### Content Sanitization

- HTML sanitization (XSS prevention)
- No external image loading (tracking pixel control)
- Link validation

### Data Privacy

- Recipient emails encrypted in transit (TLS)
- No email content stored on API server
- GDPR compliance (unsubscribe links)

### Spam Prevention

- DKIM signing (AWS-managed)
- SPF records (DNS configuration)
- DMARC policy
- Unsubscribe links required

---

## Error Scenarios

### Email Not Verified

**Scenario**: Sender email not verified in SES
**Handling**: SES rejects email with verification error
**Solution**: Verify email in SES console

### Rate Limit Exceeded

**Scenario**: Sending too many emails too fast
**Handling**: SES throttles requests, returns 429
**Solution**: Implement queue with rate limiting

### Recipient Bounce

**Scenario**: Recipient email invalid or mailbox full
**Handling**: SES sends bounce notification
**Solution**: Mark email invalid, stop sending

### Spam Complaint

**Scenario**: Recipient marks email as spam
**Handling**: SES sends complaint notification
**Solution**: Unsubscribe user, investigate content

---

## Performance Considerations

### Async Sending

- Email sending is I/O-bound (network call)
- Offload to background queue (future)
- Don't block API response on email sending

### Batch Sending

- SES supports bulk sending (50 recipients per call)
- Use `SendBulkTemplatedEmail` for campaigns
- Efficient for newsletters, announcements

### Retry Strategy

- Exponential backoff for transient failures
- Max 3 retries
- Dead-letter queue for permanent failures

---

## Monitoring & Alerts

### Metrics to Track

- **Send Rate**: Emails sent per minute
- **Delivery Rate**: % successfully delivered
- **Bounce Rate**: % bounced (target: < 5%)
- **Complaint Rate**: % marked as spam (target: < 0.1%)

### Alerts

- Bounce rate > 5% → Investigate sender reputation
- Complaint rate > 0.1% → Review email content
- SES quota approaching limit → Request increase

### Logging

- Every email send logged
- Include: recipient, subject, message ID, status
- Failed sends logged with error details

---

## Future Enhancements

### Email Queue

- Background job processing
- Rate limiting per tenant
- Priority queue (urgent emails first)

### Template Management UI

- Visual template editor
- Preview before sending
- Version control

### A/B Testing

- Test subject lines
- Test email content
- Measure open/click rates

### Attachment Support

- Attach PDFs (invoices, reports)
- Attach images (embedded)
- S3-backed attachments

---

## Version History

- **v1.0.0**: Initial AWS SES integration
- **Pattern**: Transactional email established
- **Adoption**: Calendar invitations, notifications

---

**File Location**: `apps/api/src/modules/email/email.service.ts`
**Documentation**: This file
**Related**: `docs/services/messaging-service.md`, `docs/PERSON_CALENDAR_SYSTEM.md`
