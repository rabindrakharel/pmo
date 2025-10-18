# ============================================================================
# Coherent PMO Platform - AWS Infrastructure (Modular)
# ============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "local" {
    path = "./terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.global_tags
  }
}

# ============================================================================
# VPC Module
# ============================================================================

module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = var.vpc_cidr
  vpc_name             = "${var.project_name}-vpc"
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  public_subnet_name   = "${var.project_name}-app-subnet"
  private_subnet_name  = "${var.project_name}-data-subnet"
  ssh_allowed_cidr     = var.ssh_allowed_cidr
  global_tags          = var.global_tags
}

# ============================================================================
# S3 Module
# ============================================================================

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
  global_tags  = var.global_tags
}

# ============================================================================
# RDS Module
# ============================================================================

module "rds" {
  source = "./modules/rds"

  project_name                = var.project_name
  environment                 = var.environment
  private_subnet_ids          = module.vpc.private_subnet_ids
  db_security_group_id        = module.vpc.db_sg_id
  db_name                     = var.db_name
  db_username                 = var.db_username
  db_password                 = var.db_password
  db_instance_class           = var.db_instance_class
  db_engine_version           = var.db_engine_version
  db_allocated_storage        = var.db_allocated_storage
  db_max_allocated_storage    = var.db_max_allocated_storage
  db_backup_retention_period  = var.db_backup_retention_period
  global_tags                 = var.global_tags
}

# ============================================================================
# EC2 Module
# ============================================================================

module "ec2" {
  source = "./modules/ec2"

  project_name           = var.project_name
  aws_region             = var.aws_region
  ec2_instance_type      = var.ec2_instance_type
  ec2_root_volume_size   = var.ec2_root_volume_size
  ec2_public_key         = var.ec2_public_key
  app_subnet_id          = module.vpc.public_subnet_ids[0]
  app_security_group_id  = module.vpc.app_sg_id
  s3_bucket_arn          = module.s3.bucket_arn
  s3_bucket_name         = module.s3.bucket_name
  db_host                = module.rds.db_address
  db_port                = module.rds.db_port
  db_name                = var.db_name
  db_user                = var.db_username
  db_password            = var.db_password
  user_data_script       = "user-data.sh"
  global_tags            = var.global_tags
}
