# Coherent PMO Platform - AWS Infrastructure (Terraform)

Infrastructure as Code (IaC) for deploying the Coherent PMO Platform to AWS.

---

## Overview

This directory contains Terraform configuration to deploy a complete AWS infrastructure for the Coherent PMO Platform, including:

- **VPC** with public and private subnets across 2 availability zones
- **EC2 instance** for application hosting (API + Web)
- **RDS PostgreSQL** database in private subnet
- **S3 bucket** for artifact storage
- **Security groups** with proper network isolation
- **IAM roles** and policies for secure access

---

## Architecture

```
VPC (10.0.0.0/16)
├─ Public Subnets (app-subnet-group)
│  ├─ app-subnet-1 (10.0.1.0/24) - AZ1
│  ├─ app-subnet-2 (10.0.2.0/24) - AZ2
│  └─ EC2 Instance (t3.medium)
│     ├─ Nginx reverse proxy (port 80/443)
│     ├─ Fastify API (port 4000)
│     └─ Vite Web (port 5173)
│
└─ Private Subnets (data-subnet-group)
   ├─ data-subnet-1 (10.0.11.0/24) - AZ1
   ├─ data-subnet-2 (10.0.12.0/24) - AZ2
   └─ RDS PostgreSQL (db.t3.micro)
      └─ Only accessible from EC2
```

---

## Files

| File | Purpose |
|------|---------|
| `main.tf` | Main infrastructure configuration |
| `variables.tf` | Variable definitions |
| `outputs.tf` | Output values (IPs, endpoints, etc.) |
| `terraform.tfvars.example` | Example variable values |
| `user-data.sh` | EC2 initialization script |
| `DEPLOYMENT.md` | Complete deployment guide |
| `README.md` | This file |

---

## Quick Start

### 1. Prerequisites

- Terraform 1.0+
- AWS CLI configured with credentials
- SSH key pair generated

```bash
# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Configure AWS
aws configure

# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/coherent-key
```

### 2. Configure Variables

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required changes:**
- `db_password` - Strong database password
- `ec2_public_key` - Your SSH public key
- `ssh_allowed_cidr` - Your IP address (security)

### 3. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review plan
terraform plan

# Deploy (takes ~10-15 minutes)
terraform apply
```

### 4. Get Outputs

```bash
# View all outputs
terraform output

# Get specific values
terraform output ec2_public_ip
terraform output db_endpoint
terraform output ssh_command
```

### 5. Deploy Application

```bash
# SSH into EC2 instance
ssh -i ~/.ssh/coherent-key ubuntu@<EC2_PUBLIC_IP>

# Wait for user-data script to complete
sudo tail -f /var/log/user-data.log

# Update repository URL
sudo nano /opt/coherent/deploy.sh
# Change: REPO_URL="https://github.com/YOUR_ORG/coherent.git"

# Deploy application
sudo /opt/coherent/deploy.sh

# Check status
coherent-status
```

---

## Infrastructure Components

### VPC and Networking

- **VPC**: 10.0.0.0/16 CIDR block
- **Public Subnets**: 2 subnets for high availability
  - app-subnet-1: 10.0.1.0/24 (AZ1)
  - app-subnet-2: 10.0.2.0/24 (AZ2)
- **Private Subnets**: 2 subnets for database isolation
  - data-subnet-1: 10.0.11.0/24 (AZ1)
  - data-subnet-2: 10.0.12.0/24 (AZ2)
- **Internet Gateway**: Public internet access
- **NAT Gateway**: Outbound access for private subnets

### EC2 Application Server

- **Instance Type**: t3.medium (2 vCPU, 4 GB RAM) - configurable
- **AMI**: Ubuntu 22.04 LTS (auto-selected latest)
- **Storage**: 30 GB gp3 EBS volume (encrypted)
- **Elastic IP**: Static public IP address
- **IAM Role**: S3 access + SSM management

**Installed Software:**
- Node.js 20.x LTS
- PostgreSQL client
- Docker + Docker Compose
- AWS CLI v2
- PM2 process manager
- Nginx web server

### RDS PostgreSQL Database

- **Engine**: PostgreSQL 14.10
- **Instance Class**: db.t3.micro (free tier eligible) - configurable
- **Storage**: 20 GB gp3 (auto-scaling to 100 GB)
- **Backup**: 7-day retention, automated backups
- **Encryption**: Storage encryption enabled
- **Multi-AZ**: Disabled for dev, enabled for prod
- **Access**: Private subnets only, no public access

### S3 Bucket

- **Naming**: `coherent-artifacts-{env}-{account-id}`
- **Versioning**: Enabled
- **Encryption**: AES256
- **Public Access**: Blocked
- **Lifecycle**: Auto-transition to cheaper storage

### Security Groups

**App Security Group** (EC2):
- Ingress: SSH (22), HTTP (80), HTTPS (443), API (4000), Web (5173)
- Egress: All traffic

**DB Security Group** (RDS):
- Ingress: PostgreSQL (5432) from App SG only
- Egress: All traffic

---

## Cost Estimate

### Development Environment

| Resource | Cost/Month |
|----------|------------|
| EC2 t3.micro | ~$7 |
| RDS db.t3.micro | $0 (free tier) |
| EBS 30GB gp3 | ~$3 |
| S3 storage | ~$0.50 |
| NAT Gateway | ~$32 |
| **Total** | **~$43/month** |

### Production Environment

| Resource | Cost/Month |
|----------|------------|
| EC2 t3.medium | ~$30 |
| RDS db.t3.small (Multi-AZ) | ~$50 |
| EBS 30GB gp3 | ~$3 |
| S3 storage | ~$2 |
| NAT Gateway | ~$32 |
| ALB (optional) | ~$16 |
| **Total** | **~$133/month** |

**Cost Optimization Tips:**
- Stop EC2/RDS when not in use (saves ~50%)
- Use Reserved Instances for 1-year commitment (save 30-40%)
- Remove NAT Gateway if not needed (save $32/month)

---

## Outputs Reference

After `terraform apply`, you'll get these outputs:

| Output | Description | Example |
|--------|-------------|---------|
| `vpc_id` | VPC identifier | vpc-0abc123 |
| `ec2_instance_id` | EC2 instance ID | i-0abc123 |
| `ec2_public_ip` | Public IP address | 54.123.45.67 |
| `db_endpoint` | Database connection string | coherent-db.abc.us-east-1.rds.amazonaws.com:5432 |
| `db_address` | Database hostname | coherent-db.abc.us-east-1.rds.amazonaws.com |
| `s3_bucket_name` | Artifact storage bucket | coherent-artifacts-dev-123456789012 |
| `web_url` | Web application URL | http://54.123.45.67:5173 |
| `api_url` | API server URL | http://54.123.45.67:4000 |
| `ssh_command` | SSH connection command | ssh -i ~/.ssh/coherent-key.pem ubuntu@54.123.45.67 |

---

## Management Commands

Once deployed, use these commands on the EC2 instance:

```bash
# Application Management
coherent-status    # Show application status
coherent-logs      # View application logs
coherent-update    # Pull latest code and redeploy
coherent-backup    # Manual database backup

# PM2 Process Manager
pm2 status         # Show process status
pm2 restart all    # Restart all services
pm2 logs          # View real-time logs
pm2 monit         # Monitor CPU/memory

# Database Access
psql -h <DB_ENDPOINT> -U coherent_admin -d coherent

# Nginx Management
sudo systemctl status nginx
sudo systemctl reload nginx
sudo nginx -t
```

---

## Updating Infrastructure

### Change Instance Size

```bash
# Edit terraform.tfvars
ec2_instance_type = "t3.large"  # Upgrade from t3.medium

# Apply changes
terraform apply

# Terraform will stop and resize the instance
```

### Change Database Configuration

```bash
# Edit terraform.tfvars
db_instance_class = "db.t3.small"  # Upgrade from db.t3.micro

# Apply changes
terraform apply

# RDS will be updated with minimal downtime
```

### Update User Data Script

```bash
# Edit user-data.sh
# Make your changes

# Recreate instance
terraform taint aws_instance.app_server
terraform apply

# WARNING: This will destroy and recreate the instance!
# Backup data first!
```

---

## Destroying Infrastructure

```bash
# WARNING: This will delete ALL resources!
# Backup data first!

# Review what will be destroyed
terraform plan -destroy

# Destroy infrastructure
terraform destroy

# Confirm by typing 'yes'
```

**Before destroying:**
1. Backup database: `coherent-backup`
2. Export S3 data: `aws s3 sync s3://bucket ./backup`
3. Save configuration files

---

## Troubleshooting

### Terraform Errors

**Error: Invalid credentials**
```bash
# Reconfigure AWS CLI
aws configure
aws sts get-caller-identity
```

**Error: SSH key invalid format**
```bash
# Regenerate key in correct format
ssh-keygen -t rsa -b 4096 -f ~/.ssh/coherent-key
cat ~/.ssh/coherent-key.pub  # Copy this to terraform.tfvars
```

**Error: Instance type not available**
```bash
# Check available instance types
aws ec2 describe-instance-type-offerings --region us-east-1

# Update terraform.tfvars with available type
```

### Application Issues

**Application not accessible after deployment**
```bash
# SSH into instance
ssh -i ~/.ssh/coherent-key ubuntu@<EC2_IP>

# Check user-data script progress
sudo tail -f /var/log/user-data.log

# Check security groups
aws ec2 describe-security-groups --group-ids <SG_ID>
```

**Database connection refused**
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier coherent-db

# Test connection from EC2
telnet <DB_ENDPOINT> 5432

# Check security group rules
```

---

## Security Considerations

### Production Checklist

- [ ] Change default database password
- [ ] Restrict SSH access to specific IP (`ssh_allowed_cidr`)
- [ ] Enable MFA for AWS account
- [ ] Use AWS Secrets Manager for sensitive data
- [ ] Enable CloudTrail for audit logging
- [ ] Configure CloudWatch alarms
- [ ] Enable RDS encryption at rest
- [ ] Use SSL/TLS certificates (Let's Encrypt)
- [ ] Enable RDS Multi-AZ for high availability
- [ ] Configure automated backups
- [ ] Enable VPC Flow Logs
- [ ] Use Systems Manager Session Manager instead of SSH

### Secrets Management

**Using AWS Secrets Manager:**

```hcl
# Add to main.tf
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project_name}-db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

# Reference in user-data
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id coherent-db-password --query SecretString --output text)
```

---

## Advanced Configuration

### Multi-Region Deployment

Deploy to multiple regions for disaster recovery:

```bash
# Create separate tfvars files
cp terraform.tfvars terraform-us-west-2.tfvars

# Edit region
# aws_region = "us-west-2"

# Deploy to second region
terraform apply -var-file=terraform-us-west-2.tfvars
```

### Auto Scaling (Future Enhancement)

Replace single EC2 with Auto Scaling Group:

```hcl
resource "aws_launch_template" "coherent" {
  name_prefix   = "${var.project_name}-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type
}

resource "aws_autoscaling_group" "coherent" {
  desired_capacity   = 2
  max_size          = 4
  min_size          = 1
  target_group_arns = [aws_lb_target_group.coherent_tg.arn]
  vpc_zone_identifier = [aws_subnet.app_subnet_1.id, aws_subnet.app_subnet_2.id]

  launch_template {
    id      = aws_launch_template.coherent.id
    version = "$Latest"
  }
}
```

---

## Support

For deployment issues or questions:

1. Review `DEPLOYMENT.md` for detailed guide
2. Check Terraform documentation: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
3. Review AWS Well-Architected Framework: https://aws.amazon.com/architecture/well-architected/
4. Open issue in project repository

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-17 | Initial infrastructure release |

---

**Last Updated**: 2025-01-17
**Terraform Version**: 1.0+
**AWS Provider Version**: ~> 5.0
