# ============================================================================
# SNS Module Outputs
# ============================================================================

output "app_notifications_topic_arn" {
  description = "ARN of the application notifications SNS topic"
  value       = aws_sns_topic.app_notifications.arn
}

output "app_notifications_topic_name" {
  description = "Name of the application notifications SNS topic"
  value       = aws_sns_topic.app_notifications.name
}

output "sms_delivery_status_topic_arn" {
  description = "ARN of the SMS delivery status SNS topic"
  value       = aws_sns_topic.sms_delivery_status.arn
}

output "delivery_status_role_arn" {
  description = "ARN of IAM role for SNS delivery status logging"
  value       = aws_iam_role.sns_delivery_status.arn
}

output "iam_policy_arn" {
  description = "ARN of IAM policy for SNS publishing"
  value       = aws_iam_policy.sns_publish.arn
}

output "log_group_name" {
  description = "Name of CloudWatch log group for SMS delivery"
  value       = aws_cloudwatch_log_group.sns_sms_delivery.name
}

output "monthly_sms_spend_limit" {
  description = "Monthly SMS spend limit in USD"
  value       = var.monthly_sms_spend_limit
}

output "default_sms_type" {
  description = "Default SMS type (Promotional or Transactional)"
  value       = var.default_sms_type
}
