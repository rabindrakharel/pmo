# ============================================================================
# EC2 Module Variables
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
}

variable "ec2_root_volume_size" {
  description = "Root volume size in GB"
  type        = number
}

variable "ec2_public_key" {
  description = "SSH public key"
  type        = string
}

variable "app_subnet_id" {
  description = "Subnet ID for EC2 instance"
  type        = string
}

variable "app_security_group_id" {
  description = "Security group ID for EC2 instance"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN for IAM policy"
  type        = string
}

variable "s3_bucket_name" {
  description = "S3 bucket name for user data"
  type        = string
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_port" {
  description = "Database port"
  type        = number
}

variable "db_name" {
  description = "Database name"
  type        = string
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

variable "user_data_script" {
  description = "Path to user data script"
  type        = string
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
