# Huron PMO Platform - AWS Infrastructure (Terraform)

**Single-command deployment** of complete Huron PMO Platform to AWS with **cohuron.com** domain.

---

## 🚀 Quick Start

**Deploy everything with one command:**

```bash
# 1. Setup (5 minutes)
cd /home/rabin/projects/pmo/infra-tf
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update: ec2_public_key, db_password, ssh_allowed_cidr

# 2. Deploy (15 minutes)
terraform init
terraform apply  # Type: yes

# 3. Update DNS nameservers at domain registrar (output from apply)

# 4. Setup SSL (after DNS propagates)
ssh -i ~/.ssh/pmo-key ubuntu@<EC2_IP>
sudo /root/setup-ssl.sh

# ✅ Access: https://app.cohuron.com
```

**📖 Detailed Guide**: See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for step-by-step instructions

---

## Overview

This Terraform configuration deploys a **complete production-ready PMO platform** to AWS with:

✅ **Full Application Stack**: API + Web + Database + Supporting Services
✅ **DNS Management**: Route 53 hosted zone for cohuron.com
✅ **SSL Certificates**: Let's Encrypt auto-renewal
✅ **Automated Backups**: Daily database backups to S3
✅ **Helper Scripts**: Easy management commands
✅ **Complete Isolation**: VPC with public/private subnets
✅ **Security Hardening**: Encrypted storage, security groups, IAM roles

**Access your deployed app:**
- **URL**: https://app.cohuron.com
- **Cost**: ~$55-65/month
- **Deploy Time**: ~15 minutes

---

## Infrastructure Components

### What Gets Created

| Component | Service | Configuration | Monthly Cost |
|-----------|---------|---------------|--------------|
| **Compute** | EC2 | t3.medium (2 vCPU, 4 GB RAM) | ~$30 |
| **Database** | RDS | PostgreSQL 14, db.t3.micro | ~$15 |
| **Storage** | S3 | Versioned, encrypted | ~$1-5 |
| **Storage** | EBS | 30 GB gp3, encrypted | ~$3 |
| **Network** | VPC | 2 AZs, public + private subnets | Free |
| **DNS** | Route 53 | Hosted zone + records | ~$0.50 |
| **IP** | Elastic IP | Static public IP | Free |
| **Security** | Security Groups | App + DB isolation | Free |
| **IAM** | Roles & Policies | EC2 → S3 access | Free |
| **TOTAL** | | | **~$55-65** |

### Architecture Diagram

```
Internet
   │
   ├── Route 53 (app.cohuron.com → EC2 IP)
   │
   └── VPC (10.0.0.0/16)
       │
       ├─ Public Subnets (10.0.1.0/24, 10.0.2.0/24)
       │  │
       │  └── EC2 Instance (t3.medium) + Elastic IP
       │      ├─ Nginx (ports 80, 443) → Reverse Proxy
       │      ├─ PM2 → Fastify API (port 4000)
       │      ├─ PM2 → Vite Web (port 5173)
       │      └─ Docker Compose:
       │         ├─ Redis (cache)
       │         ├─ MinIO (object storage)
       │         └─ MailHog (email testing)
       │
       └─ Private Subnets (10.0.11.0/24, 10.0.12.0/24)
          │
          └── RDS PostgreSQL 14 (db.t3.micro)
              └─ Only accessible from EC2
```

### Software Stack (Auto-Installed)

**On EC2 Instance:**
- Ubuntu 22.04 LTS
- Node.js 20 LTS + pnpm
- Docker + Docker Compose
- PostgreSQL 14 client
- Nginx web server
- PM2 process manager
- AWS CLI v2
- Certbot (Let's Encrypt)

**Docker Services:**
- PostgreSQL 14 (local development)
- Redis 7 (caching)
- MinIO (S3-compatible storage)
- MailHog (email testing)

---

## Documentation

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** | Fast deployment guide | First-time deployment |
| **[AWS_SETUP.md](./AWS_SETUP.md)** | Complete setup instructions | Detailed reference |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Infrastructure deep-dive | Understanding design |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Deployment procedures | Advanced scenarios |
| **README.md** | This file | Overview & quick reference |

---

## File Structure

```
infra-tf/
├── README.md                    # This file (overview)
├── QUICK_DEPLOY.md             # 🚀 Start here for deployment
├── AWS_SETUP.md                # Complete setup guide
├── ARCHITECTURE.md             # Infrastructure architecture
├── DEPLOYMENT.md               # Deployment details
│
├── main.tf                     # Main configuration
├── variables.tf                # Variable definitions
├── outputs.tf                  # Output values
├── terraform.tfvars.example    # Example configuration
├── user-data-complete.sh       # EC2 initialization script
│
└── modules/                    # Terraform modules
    ├── vpc/                    # VPC + subnets + security groups
    ├── ec2/                    # EC2 instance + IAM roles
    ├── rds/                    # PostgreSQL database
    ├── s3/                     # S3 artifact bucket
    └── route53/                # DNS management
```

---

## Prerequisites

Before deploying:

```bash
# Required tools
terraform --version   # >= 1.0
aws --version        # AWS CLI v2
ssh-keygen --help    # SSH key generation

# AWS credentials
aws configure --profile cohuron
aws sts get-caller-identity --profile cohuron

# SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/pmo-key -C "pmo@cohuron.com"
```

**What you need:**
- AWS account with admin access
- Domain name (cohuron.com) - can be registered anywhere
- SSH key pair for EC2 access
- Database password (generate with: `openssl rand -base64 32`)

---

## Configuration

### Essential Variables (terraform.tfvars)

These **MUST** be configured before deployment:

```hcl
# 1. SSH Access
ec2_public_key = "ssh-rsa AAAAB3NzaC1yc2EA... pmo@cohuron.com"
ssh_allowed_cidr = ["YOUR_IP/32"]  # Your public IP

# 2. Database Security
db_password = "YOUR_STRONG_PASSWORD"  # Generate with: openssl rand -base64 32

# 3. Application Deployment (Optional)
github_repo_url = "https://github.com/yourusername/pmo.git"  # Or leave empty ""
```

### Optional Variables (with good defaults)

```hcl
# AWS Configuration
aws_profile = "cohuron"           # AWS CLI profile name
aws_region = "us-east-1"          # Deployment region
environment = "prod"              # Environment name

# Domain Configuration
domain_name = "cohuron.com"       # Your domain
app_subdomain = "app"             # Creates app.cohuron.com
create_dns_records = true         # Use Route 53 for DNS

# Instance Sizing
ec2_instance_type = "t3.medium"   # App server (2 vCPU, 4 GB RAM)
db_instance_class = "db.t3.micro" # Database (1 vCPU, 1 GB RAM)
```

**See [terraform.tfvars.example](./terraform.tfvars.example) for all options**

---

## Deployment

### Standard Deployment

```bash
# 1. Configure
cd /home/rabin/projects/pmo/infra-tf
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update required values

# 2. Initialize
terraform init

# 3. Review plan
terraform plan

# 4. Deploy
terraform apply
```

### First-Time Deployment Checklist

- [ ] AWS CLI profile "cohuron" configured
- [ ] SSH key pair generated (~/.ssh/pmo-key)
- [ ] terraform.tfvars updated (ec2_public_key, db_password, ssh_allowed_cidr)
- [ ] Run `terraform init`
- [ ] Run `terraform apply` (takes ~15 minutes)
- [ ] Copy nameservers from output
- [ ] Update nameservers at domain registrar
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] SSH to EC2 and run `/root/setup-ssl.sh`
- [ ] Access https://app.cohuron.com

**Detailed guide**: [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)

---

## After Deployment

### DNS Configuration

**Copy nameservers** from Terraform output:

```
name_servers = [
  "ns-123.awsdns-45.com",
  "ns-678.awsdns-90.net",
  "ns-1234.awsdns-56.org",
  "ns-5678.awsdns-12.co.uk"
]
```

**Update at your domain registrar** (GoDaddy, Namecheap, etc.):
1. Login → Domain Settings for cohuron.com
2. Find DNS/Nameserver settings
3. Replace with AWS nameservers above
4. Save changes

**Wait for propagation** (5-60 minutes):
```bash
dig app.cohuron.com +short  # Should show EC2 IP
```

### SSL Setup

**After DNS propagates:**

```bash
# SSH into EC2
ssh -i ~/.ssh/pmo-key ubuntu@<EC2_PUBLIC_IP>

# Run SSL setup
sudo /root/setup-ssl.sh

# Takes ~30 seconds
# - Obtains Let's Encrypt certificate
# - Configures Nginx for HTTPS
# - Enables auto-renewal
```

### Access Application

**Your app is live:**
- **Main App**: https://app.cohuron.com
- **Signup**: https://app.cohuron.com/signup
- **Login**: https://app.cohuron.com/login
- **API Docs**: https://app.cohuron.com/docs

**Test Account:**
```
Email: james.miller@huronhome.ca
Password: password123
```

---

## Management

### SSH Access

```bash
# Connect to server
ssh -i ~/.ssh/pmo-key ubuntu@<EC2_PUBLIC_IP>

# Get IP from Terraform
terraform output ec2_public_ip
```

### Helper Commands (on EC2)

```bash
pmo-status     # Check all services
pmo-logs       # View application logs (all)
pmo-logs api   # View API logs only
pmo-logs web   # View web logs only
pmo-restart    # Restart all services
pmo-backup     # Manual database backup

# PM2 process manager
pm2 status     # Process status
pm2 logs       # Live logs
pm2 restart all
pm2 monit      # Resource monitor
```

### Terraform Commands

```bash
# View outputs
terraform output
terraform output ec2_public_ip
terraform output db_endpoint

# Update infrastructure
terraform plan   # See changes
terraform apply  # Apply changes

# Destroy everything (WARNING: deletes all data!)
terraform destroy
```

---

## Outputs Reference

After `terraform apply`, these outputs are available:

```hcl
# Network
vpc_id              # VPC identifier
app_subnet_ids      # Public subnet IDs
data_subnet_ids     # Private subnet IDs

# Compute
ec2_instance_id     # EC2 instance ID
ec2_public_ip       # Public IP address
ec2_private_ip      # Private IP address
ssh_command         # ssh -i ~/.ssh/pmo-key ubuntu@<IP>

# Database
db_endpoint         # pmo-db.abc.us-east-1.rds.amazonaws.com:5432
db_address          # Hostname only
db_port             # 5432
db_name             # Database name

# Storage
s3_bucket_name      # pmo-artifacts-abc123
s3_bucket_arn       # ARN for IAM policies

# DNS
hosted_zone_id      # Route 53 zone ID
name_servers        # [ns-123..., ns-678..., ns-1234..., ns-5678...]
app_domain          # app.cohuron.com

# URLs
app_url_http        # http://app.cohuron.com (before SSL)
app_url_https       # https://app.cohuron.com (after SSL)
direct_ip_url       # http://54.123.456.78 (before DNS)

# Summary
deployment_summary  # Overview of all resources
next_steps          # Post-deployment instructions
```

---

## Cost Optimization

### Current Configuration (~$55-65/month)

- EC2 t3.medium: ~$30/mo
- RDS db.t3.micro: ~$15/mo
- Storage + Data: ~$10/mo
- Route 53: ~$0.50/mo

### Budget Options

**Ultra-Low Budget (~$25-30/month):**
```hcl
ec2_instance_type = "t3.small"    # ~$15/mo (1/2 the RAM)
db_instance_class = "db.t4g.micro" # ~$12/mo (ARM-based)
```

**Production Grade (~$90-110/month):**
```hcl
ec2_instance_type = "t3.large"     # ~$60/mo (8 GB RAM)
db_instance_class = "db.t3.small"  # ~$30/mo (2 GB RAM)
db_backup_retention_period = 30    # Extended backups
```

### Additional Savings

- **Stop non-production environments** when not in use (save ~50%)
- **Use Reserved Instances** (1-year commit, save 30-40%)
- **Right-size instances** based on actual usage
- **Enable RDS auto-pause** for dev environments

---

## Security

### Implemented Security Features

✅ **Network Isolation**: Database in private subnets
✅ **Encryption**: EBS volumes encrypted at rest
✅ **SSL/TLS**: HTTPS with Let's Encrypt certificates
✅ **Least Privilege**: IAM roles with minimal permissions
✅ **Security Groups**: Restrictive firewall rules
✅ **Automated Backups**: Daily database backups to S3

### Production Hardening Checklist

- [ ] Restrict SSH: Set `ssh_allowed_cidr = ["YOUR_IP/32"]`
- [ ] Enable MFA for AWS account
- [ ] Use AWS Secrets Manager for db_password
- [ ] Enable CloudWatch monitoring and alarms
- [ ] Configure AWS Config for compliance
- [ ] Enable VPC Flow Logs
- [ ] Set up AWS Budgets for cost alerts
- [ ] Review IAM permissions regularly
- [ ] Enable RDS Multi-AZ for high availability
- [ ] Configure WAF for application protection

---

## Troubleshooting

### Common Issues

**Terraform apply fails:**
```bash
# Check AWS credentials
aws sts get-caller-identity --profile cohuron

# Validate configuration
terraform validate

# See detailed errors
terraform apply -no-color 2>&1 | tee terraform.log
```

**Can't SSH to EC2:**
```bash
# Fix key permissions
chmod 400 ~/.ssh/pmo-key

# Verify security group allows your IP
# Update ssh_allowed_cidr in terraform.tfvars
```

**Application not accessible:**
```bash
# Check DNS
dig app.cohuron.com +short

# SSH and check services
ssh -i ~/.ssh/pmo-key ubuntu@<IP>
pmo-status
pmo-logs
```

**SSL setup fails:**
```bash
# DNS must propagate first
dig app.cohuron.com +short  # Must show EC2 IP

# Try SSL setup again
sudo /root/setup-ssl.sh
```

**For detailed troubleshooting**: See [AWS_SETUP.md](./AWS_SETUP.md#troubleshooting)

---

## Updating Infrastructure

### Resize Instances

```bash
# Edit terraform.tfvars
ec2_instance_type = "t3.large"  # Upgrade from t3.medium

# Apply changes
terraform apply  # Instance will restart
```

### Change Configuration

```bash
# Edit terraform.tfvars (any variable)
nano terraform.tfvars

# Preview changes
terraform plan

# Apply changes
terraform apply
```

### Destroy Everything

**⚠️ WARNING: Deletes ALL resources and data!**

```bash
# Backup first!
ssh -i ~/.ssh/pmo-key ubuntu@<IP>
pmo-backup

# Download S3 data
aws s3 sync s3://pmo-artifacts-abc123 ./backup/

# Destroy
terraform destroy  # Type: yes
```

---

## Advanced Topics

### Module Structure

```
modules/
├── vpc/          # Network infrastructure
│   ├── main.tf       - VPC, subnets, routing, NAT
│   ├── variables.tf  - Network configuration
│   └── outputs.tf    - Subnet IDs, security groups
│
├── ec2/          # Application server
│   ├── main.tf       - EC2 instance, IAM, EIP
│   ├── variables.tf  - Instance configuration
│   └── outputs.tf    - IPs, instance ID
│
├── rds/          # Database
│   ├── main.tf       - RDS instance, subnet group
│   ├── variables.tf  - DB configuration
│   └── outputs.tf    - Endpoint, connection info
│
├── s3/           # Object storage
│   ├── main.tf       - S3 bucket, policies
│   ├── variables.tf  - Bucket configuration
│   └── outputs.tf    - Bucket name, ARN
│
└── route53/      # DNS management
    ├── main.tf       - Hosted zone, A records
    ├── variables.tf  - Domain configuration
    └── outputs.tf    - Nameservers, zone ID
```

### Multi-Environment Deployment

```bash
# Create separate variable files
cp terraform.tfvars terraform-dev.tfvars
cp terraform.tfvars terraform-staging.tfvars

# Deploy to different environments
terraform apply -var-file=terraform-dev.tfvars
terraform apply -var-file=terraform-staging.tfvars
terraform apply -var-file=terraform.tfvars  # production
```

---

## Support

**Documentation:**
- 🚀 [Quick Deploy Guide](./QUICK_DEPLOY.md) - Start here
- 📖 [Complete Setup Guide](./AWS_SETUP.md) - Detailed instructions
- 🏗️ [Architecture Guide](./ARCHITECTURE.md) - Infrastructure design
- 🚢 [Deployment Guide](./DEPLOYMENT.md) - Advanced deployment

**External Resources:**
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/14/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-01-21 | Single-command deployment, Route 53, cohuron.com domain |
| 1.0 | 2025-01-17 | Initial infrastructure release |

---

**Quick Deploy**: See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)
**Last Updated**: 2025-01-21
**Terraform Version**: >= 1.0
**AWS Provider**: ~> 5.0
**Domain**: cohuron.com
**Default Cost**: ~$55-65/month
