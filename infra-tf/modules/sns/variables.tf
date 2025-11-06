# ============================================================================
# SNS Module Variables
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "monthly_sms_spend_limit" {
  description = "Maximum monthly spend for SMS in USD"
  type        = string
  default     = "10.00"
}

variable "default_sender_id" {
  description = "Default sender ID for SMS (not supported in all regions, e.g., US)"
  type        = string
  default     = ""
}

variable "default_sms_type" {
  description = "Default SMS type: Promotional or Transactional"
  type        = string
  default     = "Transactional"

  validation {
    condition     = contains(["Promotional", "Transactional"], var.default_sms_type)
    error_message = "SMS type must be either Promotional or Transactional."
  }
}

variable "delivery_status_success_sampling_rate" {
  description = "Percentage of successful SMS deliveries to log (0-100)"
  type        = string
  default     = "100"
}

variable "usage_report_s3_bucket" {
  description = "S3 bucket name for SMS usage reports (optional)"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
}

variable "notification_email" {
  description = "Email address for SNS delivery notifications (optional)"
  type        = string
  default     = ""
}

variable "ec2_role_name" {
  description = "EC2 IAM role name to attach SNS permissions"
  type        = string
  default     = ""
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
