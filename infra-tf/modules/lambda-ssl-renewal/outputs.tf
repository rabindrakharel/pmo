# ============================================================================
# Outputs - Lambda SSL Renewal Module
# ============================================================================

output "lambda_function_arn" {
  description = "ARN of the SSL renewal Lambda function"
  value       = aws_lambda_function.ssl_renewal.arn
}

output "lambda_function_name" {
  description = "Name of the SSL renewal Lambda function"
  value       = aws_lambda_function.ssl_renewal.function_name
}

output "lambda_role_arn" {
  description = "ARN of the Lambda IAM role"
  value       = aws_iam_role.lambda_role.arn
}

output "log_group_name" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}

output "eventbridge_rule_name" {
  description = "EventBridge rule name for monthly trigger"
  value       = aws_cloudwatch_event_rule.monthly_trigger.name
}

output "eventbridge_rule_arn" {
  description = "EventBridge rule ARN"
  value       = aws_cloudwatch_event_rule.monthly_trigger.arn
}
