# ============================================================================
# Route 53 Module Outputs
# ============================================================================

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "hosted_zone_name" {
  description = "Route 53 hosted zone name"
  value       = aws_route53_zone.main.name
}

output "name_servers" {
  description = "Name servers for the hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "app_domain" {
  description = "Full app domain name"
  value       = var.app_subdomain != "" ? "${var.app_subdomain}.${var.domain_name}" : var.domain_name
}

output "app_url" {
  description = "Application URL (HTTP)"
  value       = "http://${var.app_subdomain != "" ? "${var.app_subdomain}.${var.domain_name}" : var.domain_name}"
}

output "app_url_https" {
  description = "Application URL (HTTPS)"
  value       = "https://${var.app_subdomain != "" ? "${var.app_subdomain}.${var.domain_name}" : var.domain_name}"
}
