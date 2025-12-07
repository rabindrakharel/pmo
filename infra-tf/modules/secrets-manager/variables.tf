# ============================================================================
# Secrets Manager Module - Variables
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ============================================================================
# Database Secrets
# ============================================================================

variable "db_host" {
  description = "Database host"
  type        = string
  default     = "localhost"
}

variable "db_port" {
  description = "Database port"
  type        = number
  default     = 5434
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "app"
}

variable "db_user" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# ============================================================================
# JWT/Auth Secrets
# ============================================================================

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "jwt_expires_in" {
  description = "JWT expiration time"
  type        = string
  default     = "24h"
}

# ============================================================================
# OAuth Secrets (Optional)
# ============================================================================

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "microsoft_client_id" {
  description = "Microsoft OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "microsoft_client_secret" {
  description = "Microsoft OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

# ============================================================================
# AI/ML API Keys (Optional)
# ============================================================================

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "deepgram_api_key" {
  description = "Deepgram API key for voice features"
  type        = string
  default     = ""
  sensitive   = true
}

variable "eleven_labs_api_key" {
  description = "ElevenLabs API key for voice synthesis"
  type        = string
  default     = ""
  sensitive   = true
}

# ============================================================================
# Redis Secrets (Optional)
# ============================================================================

variable "redis_host" {
  description = "Redis host"
  type        = string
  default     = "localhost"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  default     = ""
  sensitive   = true
}

# ============================================================================
# RabbitMQ Secrets (Optional)
# ============================================================================

variable "rabbitmq_url" {
  description = "RabbitMQ connection URL"
  type        = string
  default     = ""
  sensitive   = true
}

# ============================================================================
# Recovery Window
# ============================================================================

variable "recovery_window_in_days" {
  description = "Number of days before permanent deletion (0 for immediate)"
  type        = number
  default     = 7
}
