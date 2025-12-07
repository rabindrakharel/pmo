# ============================================================================
# Secrets Manager Module - Outputs
# ============================================================================

# ============================================================================
# Secret ARNs (for IAM policies)
# ============================================================================

output "database_secret_arn" {
  description = "ARN of the database secrets"
  value       = aws_secretsmanager_secret.database.arn
}

output "auth_secret_arn" {
  description = "ARN of the auth secrets"
  value       = aws_secretsmanager_secret.auth.arn
}

output "oauth_secret_arn" {
  description = "ARN of the OAuth secrets"
  value       = aws_secretsmanager_secret.oauth.arn
}

output "api_keys_secret_arn" {
  description = "ARN of the API keys secrets"
  value       = aws_secretsmanager_secret.api_keys.arn
}

output "redis_secret_arn" {
  description = "ARN of the Redis secrets"
  value       = aws_secretsmanager_secret.redis.arn
}

output "rabbitmq_secret_arn" {
  description = "ARN of the RabbitMQ secrets"
  value       = aws_secretsmanager_secret.rabbitmq.arn
}

# ============================================================================
# Secret Names (for application configuration)
# ============================================================================

output "database_secret_name" {
  description = "Name of the database secret"
  value       = aws_secretsmanager_secret.database.name
}

output "auth_secret_name" {
  description = "Name of the auth secret"
  value       = aws_secretsmanager_secret.auth.name
}

output "oauth_secret_name" {
  description = "Name of the OAuth secret"
  value       = aws_secretsmanager_secret.oauth.name
}

output "api_keys_secret_name" {
  description = "Name of the API keys secret"
  value       = aws_secretsmanager_secret.api_keys.name
}

output "redis_secret_name" {
  description = "Name of the Redis secret"
  value       = aws_secretsmanager_secret.redis.name
}

output "rabbitmq_secret_name" {
  description = "Name of the RabbitMQ secret"
  value       = aws_secretsmanager_secret.rabbitmq.name
}

# ============================================================================
# All Secret ARNs (for bulk IAM policies)
# ============================================================================

output "all_secret_arns" {
  description = "List of all secret ARNs"
  value = [
    aws_secretsmanager_secret.database.arn,
    aws_secretsmanager_secret.auth.arn,
    aws_secretsmanager_secret.oauth.arn,
    aws_secretsmanager_secret.api_keys.arn,
    aws_secretsmanager_secret.redis.arn,
    aws_secretsmanager_secret.rabbitmq.arn
  ]
}

# ============================================================================
# IAM Policy ARN
# ============================================================================

output "secrets_read_policy_arn" {
  description = "ARN of the IAM policy for reading secrets"
  value       = aws_iam_policy.secrets_read_policy.arn
}

output "secrets_read_policy_name" {
  description = "Name of the IAM policy for reading secrets"
  value       = aws_iam_policy.secrets_read_policy.name
}

# ============================================================================
# Secret Prefix (for programmatic access)
# ============================================================================

output "secret_prefix" {
  description = "Prefix used for all secrets (project/environment)"
  value       = "${var.project_name}/${var.environment}"
}

# ============================================================================
# CLI Commands for Retrieval
# ============================================================================

output "retrieval_commands" {
  description = "AWS CLI commands to retrieve secrets"
  value = {
    database = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.database.name} --query SecretString --output text | jq ."
    auth     = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.auth.name} --query SecretString --output text | jq ."
    oauth    = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.oauth.name} --query SecretString --output text | jq ."
    api_keys = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.api_keys.name} --query SecretString --output text | jq ."
    redis    = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.redis.name} --query SecretString --output text | jq ."
    rabbitmq = "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.rabbitmq.name} --query SecretString --output text | jq ."
  }
}
