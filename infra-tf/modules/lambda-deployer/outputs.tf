# ============================================================================
# Lambda Deployer Module Outputs
# ============================================================================

output "lambda_function_arn" {
  description = "ARN of the deployment Lambda function"
  value       = aws_lambda_function.deployer.arn
}

output "lambda_function_name" {
  description = "Name of the deployment Lambda function"
  value       = aws_lambda_function.deployer.function_name
}

output "eventbridge_rule_arn" {
  description = "ARN of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.s3_upload.arn
}

output "log_group_name" {
  description = "CloudWatch log group name for Lambda"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}
