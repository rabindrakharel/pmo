# ============================================================================
# Route 53 Module - DNS Management for cohuron.com
# ============================================================================

# Create hosted zone for domain
resource "aws_route53_zone" "main" {
  name          = var.domain_name
  comment       = "Managed by Terraform for ${var.project_name}"
  force_destroy = var.force_destroy

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-hosted-zone"
  })
}

# A record for app subdomain pointing to EC2 Elastic IP
resource "aws_route53_record" "app" {
  count = var.create_app_record ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = var.app_subdomain
  type    = "A"
  ttl     = var.dns_ttl
  records = [var.ec2_public_ip]
}

# A record for root domain (optional)
resource "aws_route53_record" "root" {
  count = var.create_root_record ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = var.dns_ttl
  records = [var.ec2_public_ip]
}

# CNAME for www subdomain
resource "aws_route53_record" "www" {
  count = var.create_www_record ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = "www"
  type    = "CNAME"
  ttl     = var.dns_ttl
  records = [var.app_subdomain != "" ? "${var.app_subdomain}.${var.domain_name}" : var.domain_name]
}

# Additional subdomains (optional)
resource "aws_route53_record" "additional" {
  for_each = var.additional_records

  zone_id = aws_route53_zone.main.zone_id
  name    = each.key
  type    = each.value.type
  ttl     = each.value.ttl
  records = each.value.records
}
