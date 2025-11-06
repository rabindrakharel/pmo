# ============================================================================
# SES Module Outputs
# ============================================================================

output "domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "domain_identity_verification_token" {
  description = "Verification token for domain (add to DNS as TXT record)"
  value       = aws_ses_domain_identity.main.verification_token
}

output "dkim_tokens" {
  description = "DKIM tokens for domain verification"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = aws_ses_configuration_set.main.name
}

output "configuration_set_arn" {
  description = "ARN of the SES configuration set"
  value       = aws_ses_configuration_set.main.arn
}

output "verified_email_identities" {
  description = "Map of verified email identities"
  value       = { for k, v in aws_ses_email_identity.verified_emails : k => v.arn }
}

output "ses_smtp_endpoint" {
  description = "SMTP endpoint for sending emails"
  value       = "email-smtp.${data.aws_region.current.name}.amazonaws.com"
}

output "ses_notifications_topic_arn" {
  description = "ARN of SNS topic for SES notifications (bounces, complaints)"
  value       = aws_sns_topic.ses_notifications.arn
}

output "iam_policy_arn" {
  description = "ARN of IAM policy for SES sending"
  value       = aws_iam_policy.ses_send_email.arn
}

# Data source to get current region
data "aws_region" "current" {}
