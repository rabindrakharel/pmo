# ============================================================================
# Route 53 Module Variables
# ============================================================================

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the hosted zone (e.g., cohuron.com)"
  type        = string
}

variable "app_subdomain" {
  description = "Subdomain for application (e.g., 'app' creates app.cohuron.com)"
  type        = string
  default     = "app"
}

variable "ec2_public_ip" {
  description = "EC2 Elastic IP address for DNS records"
  type        = string
}

variable "create_app_record" {
  description = "Create A record for app subdomain"
  type        = bool
  default     = true
}

variable "create_root_record" {
  description = "Create A record for root domain"
  type        = bool
  default     = false
}

variable "create_www_record" {
  description = "Create CNAME for www subdomain"
  type        = bool
  default     = false
}

variable "dns_ttl" {
  description = "TTL for DNS records in seconds"
  type        = number
  default     = 300
}

variable "force_destroy" {
  description = "Allow destruction of hosted zone even if it contains records"
  type        = bool
  default     = false
}

variable "additional_records" {
  description = "Additional DNS records to create"
  type = map(object({
    type    = string
    ttl     = number
    records = list(string)
  }))
  default = {}
}

variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
