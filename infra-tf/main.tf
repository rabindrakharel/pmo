# ============================================================================
# Cohuron Platform - AWS Infrastructure (Fully Automated)
# Domain: cohuron.com
# ============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "local" {
    path = "./terraform.tfstate"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile # Uses AWS CLI profile "cohuron"

  default_tags {
    tags = var.global_tags
  }
}

# ============================================================================
# VPC Module
# ============================================================================

module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = var.vpc_cidr
  vpc_name             = "${var.project_name}-vpc"
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  public_subnet_name   = "${var.project_name}-app-subnet"
  private_subnet_name  = "${var.project_name}-data-subnet"
  ssh_allowed_cidr     = var.ssh_allowed_cidr
  global_tags          = var.global_tags
}

# ============================================================================
# S3 Module
# ============================================================================

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  global_tags  = var.global_tags
}

# ============================================================================
# Secrets Manager Module - Centralized Secrets Storage
# Must be created before EC2 so the policy can be attached
# ============================================================================

module "secrets_manager" {
  source = "./modules/secrets-manager"

  project_name = var.project_name
  environment  = var.environment
  global_tags  = var.global_tags

  # Database secrets
  db_host     = var.secrets_db_host
  db_port     = var.secrets_db_port
  db_name     = var.secrets_db_name
  db_user     = var.secrets_db_user
  db_password = var.secrets_db_password

  # Auth secrets
  jwt_secret     = var.secrets_jwt_secret
  jwt_expires_in = var.secrets_jwt_expires_in

  # OAuth secrets (optional)
  google_client_id        = var.secrets_google_client_id
  google_client_secret    = var.secrets_google_client_secret
  microsoft_client_id     = var.secrets_microsoft_client_id
  microsoft_client_secret = var.secrets_microsoft_client_secret
  github_client_id        = var.secrets_github_client_id
  github_client_secret    = var.secrets_github_client_secret

  # API keys (optional)
  openai_api_key      = var.secrets_openai_api_key
  deepgram_api_key    = var.secrets_deepgram_api_key
  eleven_labs_api_key = var.secrets_eleven_labs_api_key

  # Redis (optional)
  redis_host     = var.secrets_redis_host
  redis_port     = var.secrets_redis_port
  redis_password = var.secrets_redis_password

  # RabbitMQ (optional)
  rabbitmq_url = var.secrets_rabbitmq_url

  recovery_window_in_days = var.environment == "prod" ? 30 : 7
}

# ============================================================================
# EC2 Module - Using Docker PostgreSQL (localhost)
# RDS has been removed - using local Docker database
# ============================================================================

module "ec2" {
  source = "./modules/ec2"

  project_name               = var.project_name
  aws_region                 = var.aws_region
  ec2_instance_type          = var.ec2_instance_type
  ec2_root_volume_size       = var.ec2_root_volume_size
  ec2_public_key             = var.ec2_public_key
  app_subnet_id              = module.vpc.public_subnet_ids[0]
  app_security_group_id      = module.vpc.app_sg_id
  s3_bucket_arn              = module.s3.bucket_arn
  s3_bucket_name             = module.s3.bucket_name
  s3_code_bucket_arn         = module.s3_code.bucket_arn
  s3_code_bucket_name        = module.s3_code.bucket_name
  s3_attachments_bucket_arn  = module.s3_attachments.bucket_arn
  s3_attachments_bucket_name = module.s3_attachments.bucket_name
  db_host                    = "localhost"
  db_port                    = 5434
  db_name                    = "app"
  db_user                    = "app"
  db_password                = "app"
  user_data_script           = "user-data-complete.sh"
  domain_name                = var.domain_name
  app_subdomain              = var.app_subdomain
  github_repo_url            = var.github_repo_url
  global_tags                = var.global_tags
  secrets_read_policy_arn    = module.secrets_manager.secrets_read_policy_arn

  depends_on = [module.s3_code, module.s3_attachments, module.secrets_manager]
}

# ============================================================================
# Route 53 DNS Module
# ============================================================================

module "route53" {
  count  = var.create_dns_records ? 1 : 0
  source = "./modules/route53"

  project_name       = var.project_name
  domain_name        = var.domain_name
  app_subdomain      = var.app_subdomain
  ec2_public_ip      = module.ec2.instance_public_ip
  create_app_record  = true
  create_root_record = false # Only app subdomain by default
  create_www_record  = false # Can enable if needed
  dns_ttl            = 300
  force_destroy      = var.environment != "prod"
  global_tags        = var.global_tags

  # Google Workspace MX records
  additional_records = {
    "" = {
      type = "MX"
      ttl  = 3600
      records = [
        "1 ASPMX.L.GOOGLE.COM.",
        "5 ALT1.ASPMX.L.GOOGLE.COM.",
        "5 ALT2.ASPMX.L.GOOGLE.COM.",
        "10 ALT3.ASPMX.L.GOOGLE.COM.",
        "10 ALT4.ASPMX.L.GOOGLE.COM."
      ]
    }
  }

  depends_on = [module.ec2]
}

# ============================================================================
# S3 Code Bucket Module - For Automated Deployments
# ============================================================================

module "s3_code" {
  source = "./modules/s3-code"

  project_name = var.project_name
  global_tags  = var.global_tags
}

# ============================================================================
# S3 Attachments Module - Multi-tenant Attachment Storage
# ============================================================================

module "s3_attachments" {
  source = "./modules/s3-attachments"

  project_name = var.project_name
  environment  = var.environment
  global_tags  = var.global_tags

  allowed_origins = [
    "http://localhost:5173",
    "http://localhost:4000",
    "https://app.cohuron.com",
    "https://${var.app_subdomain}.${var.domain_name}"
  ]
}

# ============================================================================
# Lambda Deployer Module - Automated Code Deployment
# ============================================================================

module "lambda_deployer" {
  source = "./modules/lambda-deployer"

  project_name     = var.project_name
  ec2_instance_id  = module.ec2.instance_id
  code_bucket_name = module.s3_code.bucket_name
  code_bucket_arn  = module.s3_code.bucket_arn
  global_tags      = var.global_tags

  depends_on = [module.ec2, module.s3_code]
}

# ============================================================================
# Lambda SSL Renewal Module - Automated SSL Certificate Renewal
# ============================================================================

module "lambda_ssl_renewal" {
  source = "./modules/lambda-ssl-renewal"

  project_name    = var.project_name
  aws_region      = var.aws_region
  ec2_instance_id = module.ec2.instance_id
  global_tags     = var.global_tags

  depends_on = [module.ec2]
}

# ============================================================================
# SES Module - Email Sending Service
# ============================================================================

module "ses" {
  source = "./modules/ses"

  project_name             = var.project_name
  domain_name              = var.domain_name
  verified_email_addresses = var.ses_verified_emails
  hosted_zone_id           = var.create_dns_records ? module.route53[0].hosted_zone_id : ""
  create_route53_records   = var.create_dns_records
  ec2_role_name            = module.ec2.ec2_role_name
  global_tags              = var.global_tags

  depends_on = [module.route53, module.ec2]
}

# ============================================================================
# SNS Module - SMS Sending Service
# ============================================================================

module "sns" {
  source = "./modules/sns"

  project_name                          = var.project_name
  monthly_sms_spend_limit               = var.sns_monthly_spend_limit
  default_sender_id                     = var.sns_default_sender_id
  default_sms_type                      = var.sns_default_sms_type
  delivery_status_success_sampling_rate = var.sns_delivery_sampling_rate
  usage_report_s3_bucket                = var.sns_usage_report_bucket
  log_retention_days                    = var.sns_log_retention_days
  notification_email                    = var.sns_notification_email
  ec2_role_name                         = module.ec2.ec2_role_name
  global_tags                           = var.global_tags

  depends_on = [module.ec2]
}
