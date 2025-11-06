# AWS SES and SNS Setup Guide

## Overview

This guide explains how to use AWS Simple Email Service (SES) and Simple Notification Service (SNS) that have been provisioned in your Terraform infrastructure for sending emails and SMS messages.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [SES (Email Service)](#ses-email-service)
  - [Domain Verification](#domain-verification)
  - [Sandbox vs Production](#sandbox-vs-production)
  - [Sending Emails](#sending-emails)
- [SNS (SMS Service)](#sns-sms-service)
  - [SMS Configuration](#sms-configuration)
  - [Sending SMS](#sending-sms)
- [IAM Permissions](#iam-permissions)
- [Testing](#testing)
- [Monitoring and Logs](#monitoring-and-logs)
- [Cost Management](#cost-management)

---

## Architecture Overview

### What's Been Provisioned

1. **SES Module** (`modules/ses/`)
   - Domain identity for your domain
   - DKIM records for email authentication
   - Email identity verification (optional, for testing)
   - Configuration set for email tracking
   - SNS topic for bounce/complaint notifications
   - IAM policies for EC2 to send emails

2. **SNS Module** (`modules/sns/`)
   - SMS sending capabilities
   - Application notifications topic
   - SMS delivery status logging
   - CloudWatch logs for delivery tracking
   - IAM policies for EC2 to send SMS

### IAM Permissions

Both modules automatically attach necessary IAM policies to your EC2 instance role, allowing your application to:
- Send emails via SES
- Send SMS via SNS
- Access delivery logs

---

## SES (Email Service)

### Domain Verification

After running `terraform apply`, your domain is registered with SES, but needs verification:

#### Automatic (with Route 53)

If you're using Route 53 (`create_dns_records = true`), DNS records are automatically created:
- TXT record for domain verification: `_amazonses.yourdomain.com`
- 3 CNAME records for DKIM authentication

**Wait 10-30 minutes** for verification to complete.

#### Manual (without Route 53)

If not using Route 53, add these DNS records at your domain registrar:

1. Get verification token:
```bash
terraform output ses_verification_instructions
```

2. Add DNS records as shown in the output

#### Check Verification Status

```bash
aws ses get-identity-verification-attributes --identities cohuron.com
```

Expected output when verified:
```json
{
  "VerificationAttributes": {
    "cohuron.com": {
      "VerificationStatus": "Success"
    }
  }
}
```

### Sandbox vs Production

**SES Sandbox Mode** (Default):
- Can only send to verified email addresses
- Limited to 200 emails/day, 1 email/second
- Ideal for testing

**Production Access** (Request Required):
- Can send to any email address
- Higher sending limits (50,000/day default, can request increase)

To request production access:
```bash
aws sesv2 put-account-details \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url https://app.cohuron.com \
  --use-case-description "Transactional emails for PMO platform: password resets, notifications, reports" \
  --contact-language EN
```

### Sending Emails

#### Using AWS SDK (Node.js)

```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: "us-east-1" });

async function sendEmail(to: string, subject: string, body: string) {
  const command = new SendEmailCommand({
    Source: "noreply@cohuron.com", // Must be verified domain
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8"
      },
      Body: {
        Html: {
          Data: body,
          Charset: "UTF-8"
        }
      }
    },
    ConfigurationSetName: "cohuron-email-tracking" // From terraform output
  });

  try {
    const response = await sesClient.send(command);
    console.log("Email sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Example usage
await sendEmail(
  "user@example.com",
  "Welcome to Cohuron",
  "<h1>Welcome!</h1><p>Thanks for joining our platform.</p>"
);
```

#### Using SMTP (Alternative)

Get SMTP credentials:
```bash
# Get SMTP endpoint
terraform output ses_smtp_endpoint

# Create SMTP credentials in AWS Console:
# IAM → Users → Create User → Attach SES SMTP policy
# Download SMTP username and password
```

SMTP Configuration:
- **Host**: `email-smtp.us-east-1.amazonaws.com`
- **Port**: 587 (TLS) or 465 (SSL)
- **Username**: From IAM SMTP credentials
- **Password**: From IAM SMTP credentials

---

## SNS (SMS Service)

### SMS Configuration

Your SNS is configured with:
- **Monthly Spend Limit**: $10.00 (configurable in `terraform.tfvars`)
- **SMS Type**: Transactional (higher priority, better delivery)
- **Delivery Logging**: Enabled (100% sampling)
- **CloudWatch Logs**: 30-day retention

### Regional SMS Support

⚠️ **Important**: SMS features vary by region:

- **US & Canada**: Sender ID not supported, but SMS works fine
- **Other regions**: May support sender ID (alphanumeric sender name)

### Sending SMS

#### Using AWS SDK (Node.js)

```typescript
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({ region: "us-east-1" });

async function sendSMS(phoneNumber: string, message: string) {
  // Phone number must be in E.164 format: +1234567890
  const command = new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: 'Cohuron' // Only works in supported regions
      },
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional' // or 'Promotional'
      }
    }
  });

  try {
    const response = await snsClient.send(command);
    console.log("SMS sent:", response.MessageId);
    return response;
  } catch (error) {
    console.error("Error sending SMS:", error);
    throw error;
  }
}

// Example usage
await sendSMS(
  "+12345678901", // Must include country code
  "Your verification code is: 123456"
);
```

#### Phone Number Format

Always use **E.164 format**:
- US: `+12025551234`
- Canada: `+14165551234`
- UK: `+447700900123`

#### SMS Best Practices

1. **Keep messages short** (160 characters or less to avoid concatenation)
2. **Include opt-out instructions** for promotional messages
3. **Verify phone numbers** before sending
4. **Handle delivery failures** gracefully
5. **Monitor spending** to avoid unexpected charges

---

## IAM Permissions

### EC2 Instance Permissions

Your EC2 instance has these permissions automatically:

**SES Permissions**:
```json
{
  "Effect": "Allow",
  "Action": [
    "ses:SendEmail",
    "ses:SendRawEmail",
    "ses:SendTemplatedEmail",
    "ses:SendBulkTemplatedEmail"
  ],
  "Resource": "*"
}
```

**SNS Permissions**:
```json
{
  "Effect": "Allow",
  "Action": [
    "sns:Publish",
    "sns:PublishBatch",
    "sns:GetSMSAttributes",
    "sns:SetSMSAttributes"
  ],
  "Resource": "*"
}
```

### Testing Permissions

Verify EC2 role has correct permissions:
```bash
# SSH into EC2
ssh -i ~/.ssh/id_ed25519 ubuntu@YOUR_EC2_IP

# Test AWS credentials
aws sts get-caller-identity

# Test SES access
aws ses list-identities

# Test SNS access
aws sns list-topics
```

---

## Testing

### Test Email Sending

```bash
# From EC2 instance or local machine with AWS credentials
aws ses send-email \
  --from "noreply@cohuron.com" \
  --destination "ToAddresses=test@example.com" \
  --message "Subject={Data='Test Email',Charset=utf8},Body={Text={Data='This is a test',Charset=utf8}}"
```

### Test SMS Sending

```bash
aws sns publish \
  --phone-number "+12345678901" \
  --message "Test SMS from Cohuron platform"
```

### Integration Test Script

Create `test-ses-sns.js`:
```javascript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sesClient = new SESClient({ region: "us-east-1" });
const snsClient = new SNSClient({ region: "us-east-1" });

async function testEmail() {
  console.log("Testing SES email...");
  const command = new SendEmailCommand({
    Source: "noreply@cohuron.com",
    Destination: { ToAddresses: ["your-email@example.com"] },
    Message: {
      Subject: { Data: "SES Test" },
      Body: { Text: { Data: "If you receive this, SES is working!" } }
    }
  });

  const response = await sesClient.send(command);
  console.log("✓ Email sent:", response.MessageId);
}

async function testSMS() {
  console.log("Testing SNS SMS...");
  const command = new PublishCommand({
    PhoneNumber: "+12345678901", // Replace with your phone
    Message: "If you receive this, SNS SMS is working!"
  });

  const response = await snsClient.send(command);
  console.log("✓ SMS sent:", response.MessageId);
}

// Run tests
await testEmail();
await testSMS();
```

Run:
```bash
node test-ses-sns.js
```

---

## Monitoring and Logs

### SES Monitoring

#### Bounce and Complaint Notifications

An SNS topic (`cohuron-ses-notifications`) is created to receive:
- **Bounces**: Email delivery failures
- **Complaints**: Recipients marking emails as spam

Subscribe to receive notifications:
```bash
aws sns subscribe \
  --topic-arn $(terraform output -raw sns_app_notifications_topic_arn) \
  --protocol email \
  --notification-endpoint admin@cohuron.com
```

#### CloudWatch Metrics

View SES metrics in CloudWatch:
- Sends
- Bounces
- Complaints
- Delivery attempts

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SES \
  --metric-name Send \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### SNS Monitoring

#### SMS Delivery Logs

View SMS delivery logs:
```bash
aws logs tail /aws/sns/cohuron/sms/delivery --follow
```

#### CloudWatch Metrics

View SNS metrics:
- SMS Success Rate
- SMS Delivery Failures
- Spending

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name SMSSuccessRate \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

### Terraform Outputs

View service configuration:
```bash
# SES information
terraform output ses_domain_identity_arn
terraform output ses_smtp_endpoint
terraform output ses_configuration_set

# SNS information
terraform output sns_configuration
terraform output sns_sms_delivery_log_group
```

---

## Cost Management

### SES Pricing (US-East-1)

- **Emails**: $0.10 per 1,000 emails
- **Attachments**: $0.12 per GB
- **Free Tier**: 62,000 emails/month (if sent from EC2)

### SNS SMS Pricing (US)

- **Transactional SMS**: $0.00645 per message
- **Promotional SMS**: $0.00645 per message
- **Varies by country**: Some countries are more expensive

Example costs:
- 100 SMS/month: ~$0.65
- 1,000 SMS/month: ~$6.45
- Monthly limit ($10): ~1,550 SMS

### Monitoring Spending

Set up billing alerts:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name sns-sms-spending \
  --alarm-description "Alert when SMS spending exceeds threshold" \
  --metric-name SMSMonthToDateSpentUSD \
  --namespace AWS/SNS \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 8.0 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions YOUR_SNS_TOPIC_ARN
```

Check current SMS spending:
```bash
aws sns get-sms-attributes --attributes MonthlySpendLimit
```

---

## Troubleshooting

### SES Issues

**Problem**: Domain not verified
```bash
# Check status
aws ses get-identity-verification-attributes --identities cohuron.com

# Verify DNS records exist
dig TXT _amazonses.cohuron.com
dig CNAME [dkim-token]._domainkey.cohuron.com
```

**Problem**: Email bounces
- Check if recipient address is valid
- In sandbox mode, verify recipient email first
- Check bounce notifications in SNS topic

**Problem**: Rate limit errors
- Request higher limits: AWS Console → SES → Account Dashboard → Request Production Access

### SNS Issues

**Problem**: SMS not delivered
- Verify phone number format (E.164: +12345678901)
- Check monthly spending limit hasn't been reached
- Some countries require sender registration
- Check CloudWatch logs for delivery failures

**Problem**: IAM permission errors
```bash
# Verify EC2 instance has correct role
aws sts get-caller-identity

# Check if policies are attached
aws iam list-attached-role-policies --role-name cohuron-ec2-role
```

---

## Security Best Practices

1. **Use IAM roles** (not access keys) for EC2 applications
2. **Enable DKIM** for email authentication (automatically configured)
3. **Monitor bounce rates** and remove invalid addresses
4. **Implement opt-out** mechanisms for promotional content
5. **Rotate SMTP credentials** regularly if using SMTP
6. **Set spending limits** to prevent unexpected costs
7. **Use configuration sets** to track email events
8. **Log and monitor** all email/SMS activity

---

## Next Steps

1. ✅ Verify your SES domain
2. ✅ Test email sending with verified addresses
3. ✅ Request SES production access (if needed)
4. ✅ Test SMS sending to your phone
5. ✅ Integrate SES/SNS into your application
6. ✅ Set up monitoring and alerts
7. ✅ Configure bounce/complaint handling
8. ✅ Review and adjust spending limits

---

## References

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SNS Documentation](https://docs.aws.amazon.com/sns/)
- [SES Sending Limits](https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html)
- [SNS SMS Best Practices](https://docs.aws.amazon.com/sns/latest/dg/channels-sms-best-practices.html)
- [E.164 Phone Number Format](https://en.wikipedia.org/wiki/E.164)

---

**Last Updated**: 2025-11-06
**Terraform Module Version**: 1.0.0
**Maintained By**: Platform Team
