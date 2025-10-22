# ============================================================================
# Lambda Deployer Module Variables
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "ec2_instance_id" {
  description = "EC2 instance ID to deploy code to"
  type        = string
}

variable "code_bucket_name" {
  description = "S3 bucket name containing code"
  type        = string
}

variable "code_bucket_arn" {
  description = "S3 bucket ARN"
  type        = string
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
