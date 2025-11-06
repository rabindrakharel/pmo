# ============================================================================
# SES Module Variables
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "domain_name" {
  description = "Domain name to verify for SES"
  type        = string
}

variable "verified_email_addresses" {
  description = "List of email addresses to verify for sending (useful for testing)"
  type        = list(string)
  default     = []
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for DNS records"
  type        = string
  default     = ""
}

variable "create_route53_records" {
  description = "Whether to create Route 53 DNS records for verification"
  type        = bool
  default     = true
}

variable "ec2_role_name" {
  description = "EC2 IAM role name to attach SES permissions"
  type        = string
  default     = ""
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
