# ============================================================================
# Variables - Lambda SSL Renewal Module
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "ec2_instance_id" {
  description = "EC2 instance ID for SSL renewal"
  type        = string
}

variable "global_tags" {
  description = "Global tags to apply to all resources"
  type        = map(string)
  default     = {}
}
