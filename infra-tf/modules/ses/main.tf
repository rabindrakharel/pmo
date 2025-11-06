# ============================================================================
# SES Module - Email Sending Service
# ============================================================================

# Domain Identity for SES
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# Domain Verification Record for Route 53
resource "aws_route53_record" "ses_verification" {
  count   = var.create_route53_records ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# DKIM Records for Domain
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = var.create_route53_records ? 3 : 0
  zone_id = var.hosted_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# Email Identity (verified email address)
resource "aws_ses_email_identity" "verified_emails" {
  for_each = toset(var.verified_email_addresses)
  email    = each.value
}

# Configuration Set for Email Tracking
resource "aws_ses_configuration_set" "main" {
  name = "${var.project_name}-email-tracking"

  reputation_metrics_enabled = true
}

# SNS Topic for Bounce and Complaint Notifications
resource "aws_sns_topic" "ses_notifications" {
  name = "${var.project_name}-ses-notifications"

  tags = var.global_tags
}

# SES Event Destination for Bounces and Complaints
resource "aws_ses_event_destination" "bounces" {
  name                   = "bounces"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["bounce", "complaint"]

  sns_destination {
    topic_arn = aws_sns_topic.ses_notifications.arn
  }
}

# IAM Policy for SES Sending
resource "aws_iam_policy" "ses_send_email" {
  name        = "${var.project_name}-ses-send-email"
  description = "Allow sending emails via SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail",
          "ses:SendBulkTemplatedEmail"
        ]
        Resource = "*"
      }
    ]
  })

  tags = var.global_tags
}

# Attach policy to EC2 instance role if provided
resource "aws_iam_role_policy_attachment" "ses_send_email" {
  count      = var.ec2_role_name != "" ? 1 : 0
  role       = var.ec2_role_name
  policy_arn = aws_iam_policy.ses_send_email.arn
}
