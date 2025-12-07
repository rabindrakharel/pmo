# ============================================================================
# Coherent PMO Platform - Root Module Variables
# ============================================================================

# ============================================================================
# General Variables
# ============================================================================

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "cohuron"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "cohuron"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "cohuron.com"
}

variable "app_subdomain" {
  description = "Subdomain for application (creates app.cohuron.com)"
  type        = string
  default     = "app"
}

variable "github_repo_url" {
  description = "GitHub repository URL for application code"
  type        = string
  default     = ""
}

variable "create_dns_records" {
  description = "Create DNS records in Route 53"
  type        = bool
  default     = true
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "Cohuron"
    ManagedBy = "Terraform"
  }
}

# ============================================================================
# VPC and Network Variables
# ============================================================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# ============================================================================
# Security Variables
# ============================================================================

variable "ssh_allowed_cidr" {
  description = "CIDR blocks allowed to SSH into EC2 instance"
  type        = list(string)
  default     = ["0.0.0.0/0"] # CHANGE THIS IN PRODUCTION!
}

# ============================================================================
# RDS Database Variables
# ============================================================================

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "cohuron"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "cohuron_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "14"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

# ============================================================================
# EC2 Instance Variables
# ============================================================================

variable "ec2_instance_type" {
  description = "EC2 instance type for application server"
  type        = string
  default     = "t3.medium"
}

variable "ec2_root_volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 30
}

variable "ec2_public_key" {
  description = "SSH public key for EC2 instance access"
  type        = string
}

# ============================================================================
# SES (Email) Variables
# ============================================================================

variable "ses_verified_emails" {
  description = "List of email addresses to verify for SES (for testing)"
  type        = list(string)
  default     = []
}

# ============================================================================
# SNS (SMS) Variables
# ============================================================================

variable "sns_monthly_spend_limit" {
  description = "Maximum monthly spend for SMS in USD"
  type        = string
  default     = "10.00"
}

variable "sns_default_sender_id" {
  description = "Default sender ID for SMS (not supported in US)"
  type        = string
  default     = ""
}

variable "sns_default_sms_type" {
  description = "Default SMS type: Promotional or Transactional"
  type        = string
  default     = "Transactional"
}

variable "sns_delivery_sampling_rate" {
  description = "Percentage of successful SMS deliveries to log (0-100)"
  type        = string
  default     = "100"
}

variable "sns_usage_report_bucket" {
  description = "S3 bucket name for SMS usage reports (optional)"
  type        = string
  default     = ""
}

variable "sns_log_retention_days" {
  description = "Number of days to retain CloudWatch logs for SMS"
  type        = number
  default     = 30
}

variable "sns_notification_email" {
  description = "Email address for SNS delivery notifications (optional)"
  type        = string
  default     = ""
}

# ============================================================================
# Secrets Manager Variables
# ============================================================================

variable "secrets_db_host" {
  description = "Database host for Secrets Manager"
  type        = string
  default     = "localhost"
}

variable "secrets_db_port" {
  description = "Database port for Secrets Manager"
  type        = number
  default     = 5434
}

variable "secrets_db_name" {
  description = "Database name for Secrets Manager"
  type        = string
  default     = "app"
}

variable "secrets_db_user" {
  description = "Database username for Secrets Manager"
  type        = string
  default     = "app"
  sensitive   = true
}

variable "secrets_db_password" {
  description = "Database password for Secrets Manager"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_jwt_secret" {
  description = "JWT signing secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_jwt_expires_in" {
  description = "JWT expiration time"
  type        = string
  default     = "24h"
}

variable "secrets_google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_microsoft_client_id" {
  description = "Microsoft OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_microsoft_client_secret" {
  description = "Microsoft OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_github_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_github_client_secret" {
  description = "GitHub OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_openai_api_key" {
  description = "OpenAI API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_deepgram_api_key" {
  description = "Deepgram API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_eleven_labs_api_key" {
  description = "ElevenLabs API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_redis_host" {
  description = "Redis host"
  type        = string
  default     = "localhost"
}

variable "secrets_redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "secrets_redis_password" {
  description = "Redis password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "secrets_rabbitmq_url" {
  description = "RabbitMQ connection URL"
  type        = string
  default     = ""
  sensitive   = true
}
