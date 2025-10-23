variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "global_tags" {
  description = "Global tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "lifecycle_transition_days" {
  description = "Days before transitioning to IA storage"
  type        = number
  default     = 90
}

variable "lifecycle_glacier_days" {
  description = "Days before transitioning to Glacier"
  type        = number
  default     = 180
}

variable "allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default = [
    "http://localhost:5173",
    "http://localhost:4000",
    "https://app.cohuron.com"
  ]
}
