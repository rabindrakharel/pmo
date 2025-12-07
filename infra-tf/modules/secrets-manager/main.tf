# ============================================================================
# Secrets Manager Module - AWS Secrets Manager Configuration
# ============================================================================
# Organizes application secrets into logical groups:
# - database: PostgreSQL connection details
# - auth: JWT and session secrets
# - oauth: Third-party OAuth providers
# - api-keys: External service API keys
# - redis: Redis/cache connection
# - rabbitmq: Message queue connection
# ============================================================================

locals {
  secret_prefix = "${var.project_name}/${var.environment}"
}

# ============================================================================
# Database Secrets
# ============================================================================
# Contains: PostgreSQL connection details
# Used by: API server, migrations, background jobs

resource "aws_secretsmanager_secret" "database" {
  name        = "${local.secret_prefix}/database"
  description = "PostgreSQL database connection credentials"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.global_tags, {
    Name        = "${var.project_name}-database-secret"
    SecretType  = "database"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    host     = var.db_host
    port     = var.db_port
    database = var.db_name
    username = var.db_user
    password = var.db_password
    # Convenience: pre-built connection string
    url = "postgresql://${var.db_user}:${var.db_password}@${var.db_host}:${var.db_port}/${var.db_name}"
  })
}

# ============================================================================
# Auth Secrets
# ============================================================================
# Contains: JWT signing key, session secrets
# Used by: Authentication middleware, token generation

resource "aws_secretsmanager_secret" "auth" {
  name        = "${local.secret_prefix}/auth"
  description = "Authentication and JWT secrets"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.global_tags, {
    Name        = "${var.project_name}-auth-secret"
    SecretType  = "auth"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "auth" {
  secret_id = aws_secretsmanager_secret.auth.id
  secret_string = jsonencode({
    jwt_secret     = var.jwt_secret
    jwt_expires_in = var.jwt_expires_in
  })
}

# ============================================================================
# OAuth Secrets
# ============================================================================
# Contains: Google, Microsoft, GitHub OAuth credentials
# Used by: Social login, SSO integration

resource "aws_secretsmanager_secret" "oauth" {
  name        = "${local.secret_prefix}/oauth"
  description = "OAuth provider credentials (Google, Microsoft, GitHub)"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.global_tags, {
    Name        = "${var.project_name}-oauth-secret"
    SecretType  = "oauth"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "oauth" {
  secret_id = aws_secretsmanager_secret.oauth.id
  secret_string = jsonencode({
    google = {
      client_id     = var.google_client_id
      client_secret = var.google_client_secret
    }
    microsoft = {
      client_id     = var.microsoft_client_id
      client_secret = var.microsoft_client_secret
    }
    github = {
      client_id     = var.github_client_id
      client_secret = var.github_client_secret
    }
  })
}

# ============================================================================
# API Keys Secrets
# ============================================================================
# Contains: OpenAI, Deepgram, ElevenLabs API keys
# Used by: AI features, voice transcription, TTS

resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${local.secret_prefix}/api-keys"
  description = "Third-party API keys (OpenAI, Deepgram, ElevenLabs)"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.global_tags, {
    Name        = "${var.project_name}-api-keys-secret"
    SecretType  = "api-keys"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    openai = {
      api_key = var.openai_api_key
      model   = "gpt-4-turbo-preview"
    }
    deepgram = {
      api_key = var.deepgram_api_key
    }
    eleven_labs = {
      api_key = var.eleven_labs_api_key
    }
  })
}

# ============================================================================
# Redis Secrets
# ============================================================================
# Contains: Redis connection details
# Used by: Caching, session storage, pub/sub

resource "aws_secretsmanager_secret" "redis" {
  name        = "${local.secret_prefix}/redis"
  description = "Redis connection credentials"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.global_tags, {
    Name        = "${var.project_name}-redis-secret"
    SecretType  = "redis"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    host     = var.redis_host
    port     = var.redis_port
    password = var.redis_password
    # Convenience: pre-built connection URL
    url = var.redis_password != "" ? "redis://:${var.redis_password}@${var.redis_host}:${var.redis_port}" : "redis://${var.redis_host}:${var.redis_port}"
  })
}

# ============================================================================
# RabbitMQ Secrets
# ============================================================================
# Contains: RabbitMQ connection URL
# Used by: Message queue, async job processing

resource "aws_secretsmanager_secret" "rabbitmq" {
  name        = "${local.secret_prefix}/rabbitmq"
  description = "RabbitMQ connection credentials"

  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.global_tags, {
    Name        = "${var.project_name}-rabbitmq-secret"
    SecretType  = "rabbitmq"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "rabbitmq" {
  secret_id = aws_secretsmanager_secret.rabbitmq.id
  secret_string = jsonencode({
    url = var.rabbitmq_url
  })
}

# ============================================================================
# IAM Policy for Secrets Access
# ============================================================================
# Attach this policy to EC2 role, Lambda functions, etc.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_policy" "secrets_read_policy" {
  name        = "${var.project_name}-secrets-read-policy"
  description = "Policy to read application secrets from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecretValues"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.database.arn,
          aws_secretsmanager_secret.auth.arn,
          aws_secretsmanager_secret.oauth.arn,
          aws_secretsmanager_secret.api_keys.arn,
          aws_secretsmanager_secret.redis.arn,
          aws_secretsmanager_secret.rabbitmq.arn
        ]
      },
      {
        Sid    = "ListSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:ListSecrets"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "secretsmanager:ResourceTag/Environment" = var.environment
          }
        }
      }
    ]
  })

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-secrets-read-policy"
  })
}
