# ============================================================================
# Cohuron Platform - Root Module Outputs
# ============================================================================

# ============================================================================
# VPC Outputs
# ============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

# ============================================================================
# Deployment Automation Outputs
# ============================================================================

output "lambda_deployer_function" {
  description = "Lambda function name for code deployment"
  value       = module.lambda_deployer.lambda_function_name
}

output "lambda_deployer_logs" {
  description = "CloudWatch log group for deployment Lambda"
  value       = module.lambda_deployer.log_group_name
}

output "app_subnet_ids" {
  description = "IDs of public app subnets"
  value       = module.vpc.public_subnet_ids
}

output "data_subnet_ids" {
  description = "IDs of private data subnets"
  value       = module.vpc.private_subnet_ids
}

output "app_security_group_id" {
  description = "ID of application security group"
  value       = module.vpc.app_sg_id
}

output "db_security_group_id" {
  description = "ID of database security group"
  value       = module.vpc.db_sg_id
}

# ============================================================================
# EC2 Instance Outputs
# ============================================================================

output "ec2_instance_id" {
  description = "ID of EC2 instance"
  value       = module.ec2.instance_id
}

output "ec2_public_ip" {
  description = "Public IP address of EC2 instance"
  value       = module.ec2.instance_public_ip
}

output "ec2_private_ip" {
  description = "Private IP address of EC2 instance"
  value       = module.ec2.instance_private_ip
}

output "ec2_role_name" {
  description = "IAM role name for EC2"
  value       = module.ec2.ec2_role_name
}

# ============================================================================
# Docker PostgreSQL Database Info (Running on EC2)
# ============================================================================

output "db_endpoint" {
  description = "Docker PostgreSQL endpoint (local on EC2)"
  value       = "localhost:5434"
}

output "db_name" {
  description = "Database name"
  value       = "app"
}

output "db_info" {
  description = "Database connection info"
  value = {
    host     = "localhost"
    port     = 5434
    database = "app"
    user     = "app"
    note     = "PostgreSQL running in Docker container on EC2"
  }
}

# ============================================================================
# S3 Bucket Outputs
# ============================================================================

output "s3_bucket_name" {
  description = "Name of S3 artifacts bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of S3 artifacts bucket"
  value       = module.s3.bucket_arn
}

output "s3_code_bucket_name" {
  description = "Name of S3 code deployment bucket"
  value       = module.s3_code.bucket_name
}

output "s3_code_bucket_arn" {
  description = "ARN of S3 code deployment bucket"
  value       = module.s3_code.bucket_arn
}

# S3 Attachments Bucket Outputs
output "s3_attachments_bucket_name" {
  description = "Name of the S3 attachments bucket"
  value       = module.s3_attachments.bucket_name
}

output "s3_attachments_bucket_arn" {
  description = "ARN of the S3 attachments bucket"
  value       = module.s3_attachments.bucket_arn
}

# ============================================================================
# Route 53 DNS Outputs
# ============================================================================

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = var.create_dns_records ? module.route53[0].hosted_zone_id : "N/A"
}

output "name_servers" {
  description = "Route 53 name servers (update these at your domain registrar)"
  value       = var.create_dns_records ? module.route53[0].name_servers : []
}

output "app_domain" {
  description = "Application domain name"
  value       = var.create_dns_records ? module.route53[0].app_domain : "${var.app_subdomain}.${var.domain_name}"
}

# ============================================================================
# Application URLs
# ============================================================================

output "app_url_http" {
  description = "Application URL (HTTP - before SSL setup)"
  value       = var.create_dns_records ? module.route53[0].app_url : "http://${module.ec2.instance_public_ip}"
}

output "app_url_https" {
  description = "Application URL (HTTPS - after SSL setup)"
  value       = var.create_dns_records ? module.route53[0].app_url_https : "https://${var.app_subdomain}.${var.domain_name}"
}

output "direct_ip_url" {
  description = "Direct IP URL (for testing before DNS)"
  value       = "http://${module.ec2.instance_public_ip}"
}

# ============================================================================
# SSH Connection
# ============================================================================

output "ssh_command" {
  description = "SSH command to connect to EC2 instance"
  value       = "ssh -i ~/.ssh/id_ed25519 ubuntu@${module.ec2.instance_public_ip}"
}

# ============================================================================
# Summary Output
# ============================================================================

output "deployment_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment     = var.environment
    region          = var.aws_region
    domain          = var.domain_name
    app_url         = var.create_dns_records ? "https://${var.app_subdomain}.${var.domain_name}" : "http://${module.ec2.instance_public_ip}"
    vpc_id          = module.vpc.vpc_id
    ec2_public_ip   = module.ec2.instance_public_ip
    db_endpoint     = "localhost:5434 (Docker PostgreSQL on EC2)"
    s3_bucket       = module.s3.bucket_name
    name_servers    = var.create_dns_records ? module.route53[0].name_servers : []
  }
}

output "next_steps" {
  description = "Next steps after deployment"
  value = <<-EOT

  ============================================================================
  🎉 Cohuron Platform Deployment Complete!
  ============================================================================

  Your application is deploying at: https://${var.app_subdomain}.${var.domain_name}

  NEXT STEPS:

  1️⃣  UPDATE NAMESERVERS (Required)
     Go to your domain registrar where you bought ${var.domain_name}
     Update nameservers to:
     ${var.create_dns_records ? join("\n     ", module.route53[0].name_servers) : "N/A"}

  2️⃣  WAIT FOR DNS PROPAGATION (5-60 minutes)
     Test: dig ${var.app_subdomain}.${var.domain_name} +short
     Should return: ${module.ec2.instance_public_ip}

  3️⃣  SETUP SSL CERTIFICATE
     SSH: ssh -i ~/.ssh/id_ed25519 ubuntu@${module.ec2.instance_public_ip}
     Run: sudo /root/setup-ssl.sh

  4️⃣  ACCESS YOUR APPLICATION
     Landing Page: https://${var.app_subdomain}.${var.domain_name}
     Signup: https://${var.app_subdomain}.${var.domain_name}/signup
     Login: https://${var.app_subdomain}.${var.domain_name}/login

  TEMPORARY ACCESS (Before DNS):
     Direct IP: http://${module.ec2.instance_public_ip}

  USEFUL COMMANDS ON EC2:
     ${var.project_name}-status   - Check service status
     ${var.project_name}-logs     - View application logs
     ${var.project_name}-restart  - Restart all services

  ============================================================================
  EOT
}
