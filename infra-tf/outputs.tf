# ============================================================================
# Coherent PMO Platform - Root Module Outputs
# ============================================================================

# ============================================================================
# VPC Outputs
# ============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
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
# RDS Database Outputs
# ============================================================================

output "db_endpoint" {
  description = "RDS database endpoint"
  value       = module.rds.db_endpoint
}

output "db_address" {
  description = "RDS database host address"
  value       = module.rds.db_address
}

output "db_port" {
  description = "RDS database port"
  value       = module.rds.db_port
}

output "db_name" {
  description = "Database name"
  value       = module.rds.db_name
}

output "db_username" {
  description = "Database master username"
  value       = var.db_username
  sensitive   = true
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

# ============================================================================
# Application URLs
# ============================================================================

output "web_url" {
  description = "Web application URL (development mode)"
  value       = "http://${module.ec2.instance_public_ip}:5173"
}

output "api_url" {
  description = "API server URL"
  value       = "http://${module.ec2.instance_public_ip}:4000"
}

output "api_docs_url" {
  description = "API documentation URL"
  value       = "http://${module.ec2.instance_public_ip}:4000/docs"
}

# ============================================================================
# SSH Connection
# ============================================================================

output "ssh_command" {
  description = "SSH command to connect to EC2 instance"
  value       = "ssh -i ~/.ssh/coherent-key ubuntu@${module.ec2.instance_public_ip}"
}

# ============================================================================
# Summary Output
# ============================================================================

output "deployment_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment    = var.environment
    region         = var.aws_region
    vpc_id         = module.vpc.vpc_id
    ec2_public_ip  = module.ec2.instance_public_ip
    db_endpoint    = module.rds.db_endpoint
    s3_bucket      = module.s3.bucket_name
    web_url        = "http://${module.ec2.instance_public_ip}:5173"
    api_url        = "http://${module.ec2.instance_public_ip}:4000"
  }
}
