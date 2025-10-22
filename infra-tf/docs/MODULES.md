# Terraform Modular Structure - Coherent PMO Platform

## Overview

The infrastructure has been refactored to follow a modular pattern similar to the existing project structure at `/home/rabin/projects/pmo/infra/helm/app/infra-tf/`.

## Directory Structure

```
infra-tf/
├── main.tf                      # Root module - orchestrates all modules
├── variables.tf                 # Root module variables
├── outputs.tf                   # Root module outputs
├── terraform.tfvars.example     # Example configuration
├── user-data.sh                 # EC2 bootstrap script
├── quick-deploy.sh              # Automated deployment script
│
├── modules/
│   ├── vpc/                     # VPC Module
│   │   ├── main.tf              # VPC, subnets, security groups
│   │   ├── variables.tf         # VPC module inputs
│   │   └── outputs.tf           # VPC module outputs
│   │
│   ├── rds/                     # RDS Module
│   │   ├── main.tf              # PostgreSQL database
│   │   ├── variables.tf         # RDS module inputs
│   │   └── outputs.tf           # RDS module outputs
│   │
│   ├── ec2/                     # EC2 Module
│   │   ├── main.tf              # Application server, IAM, Elastic IP
│   │   ├── variables.tf         # EC2 module inputs
│   │   └── outputs.tf           # EC2 module outputs
│   │
│   └── s3/                      # S3 Module
│       ├── main.tf              # Artifact storage bucket
│       ├── variables.tf         # S3 module inputs
│       └── outputs.tf           # S3 module outputs
│
└── docs/
    ├── README.md                # Quick start guide
    ├── DEPLOYMENT.md            # Complete deployment guide
    ├── ARCHITECTURE.md          # Architecture documentation
    └── DNS-SETUP.md             # DNS configuration guide
```

## Module Hierarchy

```
main.tf (Root Module)
├── module.vpc
│   ├── Creates VPC
│   ├── Creates public subnets (app-subnet-group)
│   ├── Creates private subnets (data-subnet-group)
│   ├── Creates Internet Gateway
│   ├── Creates NAT Gateway
│   ├── Creates Security Groups (app-sg, db-sg)
│   └── Outputs: vpc_id, subnet_ids, security_group_ids
│
├── module.s3
│   ├── Creates S3 bucket
│   ├── Enables encryption
│   ├── Enables versioning
│   ├── Configures lifecycle policies
│   └── Outputs: bucket_name, bucket_arn
│
├── module.rds
│   ├── Uses: module.vpc outputs (subnets, security group)
│   ├── Creates DB subnet group
│   ├── Creates RDS PostgreSQL instance
│   └── Outputs: db_endpoint, db_address, db_port
│
└── module.ec2
    ├── Uses: module.vpc outputs (subnet, security group)
    ├── Uses: module.s3 outputs (bucket_arn, bucket_name)
    ├── Uses: module.rds outputs (db_host, db_port)
    ├── Creates IAM role and instance profile
    ├── Creates SSH key pair
    ├── Creates EC2 instance with user data
    ├── Creates Elastic IP
    └── Outputs: instance_id, public_ip, private_ip
```

## Module Dependencies

```
┌─────────────┐
│   module.vpc│
└──────┬──────┘
       │
       ├──────────────────────────┐
       │                          │
       ▼                          ▼
┌──────────────┐          ┌──────────────┐
│  module.s3   │          │  module.rds  │
└──────┬───────┘          └──────┬───────┘
       │                          │
       └──────────┬───────────────┘
                  │
                  ▼
           ┌──────────────┐
           │  module.ec2  │
           └──────────────┘
```

## Module Usage Examples

### VPC Module

```hcl
module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = "10.0.0.0/16"
  vpc_name             = "coherent-vpc"
  availability_zones   = ["us-east-1a", "us-east-1b"]
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]
  public_subnet_name   = "coherent-app-subnet"
  private_subnet_name  = "coherent-data-subnet"
  ssh_allowed_cidr     = ["1.2.3.4/32"]
  global_tags          = { Environment = "dev" }
}

# Access outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}
```

### RDS Module

```hcl
module "rds" {
  source = "./modules/rds"

  project_name                = "coherent"
  environment                 = "dev"
  private_subnet_ids          = module.vpc.private_subnet_ids
  db_security_group_id        = module.vpc.db_sg_id
  db_name                     = "coherent"
  db_username                 = "admin"
  db_password                 = "super-secret-password"
  db_instance_class           = "db.t3.micro"
  db_engine_version           = "14.10"
  db_allocated_storage        = 20
  db_max_allocated_storage    = 100
  db_backup_retention_period  = 7
  global_tags                 = { Environment = "dev" }
}

# Access outputs
output "db_endpoint" {
  value = module.rds.db_endpoint
}
```

### EC2 Module

```hcl
module "ec2" {
  source = "./modules/ec2"

  project_name           = "coherent"
  aws_region             = "us-east-1"
  ec2_instance_type      = "t3.medium"
  ec2_root_volume_size   = 30
  ec2_public_key         = "ssh-rsa AAAA..."
  app_subnet_id          = module.vpc.public_subnet_ids[0]
  app_security_group_id  = module.vpc.app_sg_id
  s3_bucket_arn          = module.s3.bucket_arn
  s3_bucket_name         = module.s3.bucket_name
  db_host                = module.rds.db_address
  db_port                = module.rds.db_port
  db_name                = "coherent"
  db_user                = "admin"
  db_password            = "super-secret-password"
  user_data_script       = "user-data.sh"
  global_tags            = { Environment = "dev" }
}

# Access outputs
output "ec2_public_ip" {
  value = module.ec2.instance_public_ip
}
```

### S3 Module

```hcl
module "s3" {
  source = "./modules/s3"

  project_name = "coherent"
  environment  = "dev"
  global_tags  = { Environment = "dev" }
}

# Access outputs
output "s3_bucket_name" {
  value = module.s3.bucket_name
}
```

## Benefits of Modular Structure

### 1. Reusability
- Each module can be reused across different environments
- Easy to create dev, staging, prod with different configurations
- Modules can be shared across projects

### 2. Maintainability
- Changes isolated to specific modules
- Clear separation of concerns
- Easier to test individual components

### 3. Scalability
- Easy to add new modules without touching existing code
- Can version modules independently
- Support for module registry (Terraform Cloud, GitHub)

### 4. Consistency
- Enforces standard patterns across infrastructure
- Reduces code duplication
- Easier to apply organizational best practices

### 5. Collaboration
- Teams can work on different modules independently
- Clear module boundaries reduce merge conflicts
- Better code review process

## Module Input/Output Flow

### VPC Module
**Inputs:**
- VPC CIDR blocks
- Subnet configurations
- Availability zones
- SSH allowed CIDR

**Outputs:**
- VPC ID
- Subnet IDs (public, private)
- Security Group IDs (app, db)
- NAT Gateway ID
- Internet Gateway ID

### RDS Module
**Inputs:**
- VPC subnet IDs (from VPC module)
- DB security group ID (from VPC module)
- Database configuration
- Environment settings

**Outputs:**
- Database endpoint
- Database address
- Database port
- DB instance ID

### EC2 Module
**Inputs:**
- App subnet ID (from VPC module)
- App security group ID (from VPC module)
- S3 bucket ARN (from S3 module)
- Database connection details (from RDS module)
- Instance configuration

**Outputs:**
- Instance ID
- Public IP (Elastic IP)
- Private IP
- IAM role name
- SSH key pair name

### S3 Module
**Inputs:**
- Project name
- Environment
- Tags

**Outputs:**
- Bucket name
- Bucket ARN
- Bucket region

## Deployment Workflow

### 1. Development Environment

```bash
# Set environment-specific variables
cd infra-tf
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
nano terraform.tfvars

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

### 2. Production Environment

```bash
# Create production config
cp terraform.tfvars terraform.tfvars.prod

# Edit for production settings
nano terraform.tfvars.prod

# Deploy to production
terraform workspace new prod
terraform plan -var-file=terraform.tfvars.prod
terraform apply -var-file=terraform.tfvars.prod
```

### 3. Multi-Region Deployment

```bash
# Deploy to us-east-1
terraform apply -var="aws_region=us-east-1"

# Deploy to us-west-2
terraform apply -var="aws_region=us-west-2"
```

## Module Testing

### Test Individual Modules

```bash
# Test VPC module
cd modules/vpc
terraform init
terraform plan

# Test RDS module (requires VPC outputs)
cd modules/rds
terraform init
terraform plan -var-file=test-vars.tfvars

# Test full stack
cd ../..
terraform plan
```

## Module Versioning

### Using Git Tags

```bash
# Tag module versions
git tag -a vpc-v1.0.0 -m "VPC module v1.0.0"
git tag -a rds-v1.0.0 -m "RDS module v1.0.0"
git push --tags

# Reference specific versions
module "vpc" {
  source = "git::https://github.com/yourorg/coherent.git//infra-tf/modules/vpc?ref=vpc-v1.0.0"
}
```

## Troubleshooting

### Module Not Found

```bash
# Ensure module paths are correct
terraform init

# Verify module source paths in main.tf
```

### Circular Dependencies

```bash
# Check module dependency chain
# Ensure outputs are properly defined
# Use data sources when needed instead of direct module dependencies
```

### State Management

```bash
# View module resources in state
terraform state list

# Show module resource details
terraform state show module.vpc.aws_vpc.coherent_vpc

# Move resources between modules
terraform state mv module.old.resource module.new.resource
```

## Migration from Monolithic to Modular

The original monolithic `main.tf` has been refactored:

**Before:**
- Single 650+ line main.tf file
- All resources in one file
- Difficult to maintain
- Hard to reuse

**After:**
- Clean root module (main.tf: ~100 lines)
- 4 focused modules (vpc, rds, ec2, s3)
- Each module < 200 lines
- Easy to test and maintain
- Reusable across environments

**Backup Files:**
- `main.tf.backup` - Original monolithic main.tf
- `variables.tf.backup` - Original variables
- `outputs.tf.backup` - Original outputs

## Next Steps

1. **Test the modular structure:**
   ```bash
   terraform init
   terraform validate
   terraform plan
   ```

2. **Deploy to development:**
   ```bash
   terraform apply
   ```

3. **Create environment-specific configurations:**
   ```bash
   cp terraform.tfvars terraform.tfvars.dev
   cp terraform.tfvars terraform.tfvars.staging
   cp terraform.tfvars terraform.tfvars.prod
   ```

4. **Document custom changes:**
   - Add module-specific README.md files
   - Document any customizations
   - Keep CHANGELOG.md updated

## References

- **Terraform Module Documentation**: https://www.terraform.io/docs/language/modules/
- **Module Best Practices**: https://www.terraform.io/docs/language/modules/develop/
- **Existing Project Structure**: `/home/rabin/projects/pmo/infra/helm/app/infra-tf/`

---

**Last Updated**: 2025-01-17
**Structure Version**: v2.0 (Modular)
**Terraform Version**: >= 1.0
