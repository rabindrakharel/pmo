# Cohuron Platform - Complete Infrastructure Architecture & Deployment Guide

**Domain**: cohuron.com | **Version**: 2.0 | **Last Updated**: 2025-01-22

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Terraform Resources & Modules](#terraform-resources--modules)
4. [Deployment Automation](#deployment-automation)
5. [DNS Configuration](#dns-configuration)
6. [Complete Deployment Process](#complete-deployment-process)
7. [Cost Analysis](#cost-analysis)
8. [Monitoring & Operations](#monitoring--operations)
9. [Security & Best Practices](#security--best-practices)
10. [Infrastructure Improvements](#infrastructure-improvements)
11. [Troubleshooting](#troubleshooting)
12. [Quick Reference](#quick-reference)

---

## Executive Summary

### What Is This?

The Cohuron Platform is a **production-ready PMO (Project Management Office) application** deployed on AWS infrastructure using Terraform Infrastructure as Code. The platform runs on **app.cohuron.com** and provides comprehensive project, task, and resource management capabilities.

### Current Architecture Status

**✅ Fully Operational Components:**
- Single EC2 instance (t3.medium) running on Docker PostgreSQL
- Automated code deployment via Lambda + EventBridge + S3
- Route 53 DNS management
- S3 artifact storage (2 buckets: artifacts + code)
- Docker-based infrastructure services (PostgreSQL, Redis, MinIO, MailHog)

**📊 Current Costs:** ~$55/month (no RDS, using Docker database on EC2)

**🎯 Key Achievement:** One-command deployments with `./infra-tf/deploy-code.sh`

---

## Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Region (us-east-1)                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    VPC: 10.0.0.0/16                              │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────┐  ┌────────────────────────────┐   │   │
│  │  │  Availability Zone A    │  │  Availability Zone B       │   │   │
│  │  │                         │  │                            │   │   │
│  │  │  ┌──────────────────┐  │  │  ┌──────────────────────┐ │   │   │
│  │  │  │ Public Subnet    │  │  │  │ Public Subnet        │ │   │   │
│  │  │  │ app-subnet-1     │  │  │  │ app-subnet-2         │ │   │   │
│  │  │  │ 10.0.1.0/24      │  │  │  │ 10.0.2.0/24          │ │   │   │
│  │  │  │                  │  │  │  │                      │ │   │   │
│  │  │  │ ┌──────────────┐ │  │  │  │                      │ │   │   │
│  │  │  │ │ EC2 Instance │ │  │  │  │ (Reserved for       │ │   │   │
│  │  │  │ │ Cohuron App  │ │  │  │  │  future scaling)    │ │   │   │
│  │  │  │ │ + Elastic IP │ │  │  │  │                      │ │   │   │
│  │  │  │ │              │ │  │  │  │                      │ │   │   │
│  │  │  │ │ Docker:      │ │  │  │  │                      │ │   │   │
│  │  │  │ │ - PostgreSQL │ │  │  │  │                      │ │   │   │
│  │  │  │ │ - Redis      │ │  │  │  │                      │ │   │   │
│  │  │  │ │ - MinIO      │ │  │  │  │                      │ │   │   │
│  │  │  │ │ - MailHog    │ │  │  │  │                      │ │   │   │
│  │  │  │ │              │ │  │  │  │                      │ │   │   │
│  │  │  │ │ PM2:         │ │  │  │  │                      │ │   │   │
│  │  │  │ │ - API :4000  │ │  │  │  │                      │ │   │   │
│  │  │  │ │ - Web :5173  │ │  │  │  │                      │ │   │   │
│  │  │  │ └──────────────┘ │  │  │  │                      │ │   │   │
│  │  │  └──────────────────┘  │  │  └──────────────────────┘ │   │   │
│  │  └─────────────────────────┘  └────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌────────────────────┐                                          │   │
│  │  │ Internet Gateway   │◄─────────────────────────────────────── │   │
│  │  └────────────────────┘                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      S3 Buckets (Regional)                       │   │
│  │  ┌──────────────────────┐  ┌───────────────────────────────┐   │   │
│  │  │ cohuron-artifacts    │  │ cohuron-code-46en2lnm         │   │   │
│  │  │ (User uploads)       │  │ (Deployment bundles)          │   │   │
│  │  └──────────────────────┘  └───────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 Lambda + EventBridge (Automation)                │   │
│  │  ┌──────────────────────┐  ┌───────────────────────────────┐   │   │
│  │  │ cohuron-code-deployer│  │ S3 Upload → EventBridge       │   │   │
│  │  │ (Python 3.11)        │◄─┤ → Lambda → SSM → EC2 Deploy  │   │   │
│  │  └──────────────────────┘  └───────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Route 53 Hosted Zone (cohuron.com)                  │   │
│  │  app.cohuron.com → 100.28.36.248 (Elastic IP)                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Network Architecture

**VPC Design:**
- **CIDR**: 10.0.0.0/16
- **Public Subnets**: 10.0.1.0/24, 10.0.2.0/24 (Application tier)
- **Private Subnets**: 10.0.11.0/24, 10.0.12.0/24 (Reserved for RDS if needed)
- **Availability Zones**: us-east-1a, us-east-1b
- **Internet Access**: Direct via Internet Gateway

**Security Groups:**
- **app-sg**: EC2 application security group
  - Port 22: SSH (restricted to specific IP)
  - Port 80: HTTP (public, redirects to HTTPS)
  - Port 443: HTTPS (public)
  - Port 4000: API (public for development)
  - Port 5173: Web (public for development)

### Compute Architecture

**EC2 Instance Configuration:**
- **Type**: t3.medium (2 vCPU, 4 GB RAM)
- **Storage**: 30 GB gp3 EBS (encrypted)
- **OS**: Ubuntu 22.04 LTS
- **Elastic IP**: 100.28.36.248 (static public IP)
- **IAM Role**: cohuron-ec2-role (S3 access, SSM access)

**Software Stack:**
```
EC2 Instance (Ubuntu 22.04)
├── Nginx (Port 80/443) - Reverse Proxy + SSL
├── PM2 Process Manager
│   ├── Fastify API (Port 4000)
│   └── Vite Web (Port 5173)
├── Docker Compose
│   ├── PostgreSQL 14 (Port 5434)
│   ├── Redis (Port 6379)
│   ├── MinIO S3 (Port 9000)
│   └── MailHog (Port 8025)
├── Node.js 20.x LTS
├── pnpm 8.x
└── AWS CLI v2
```

### Database Architecture

**Docker PostgreSQL (Current Setup):**
- **Container**: pmo_db
- **Version**: PostgreSQL 14
- **Port**: 5434 (mapped from container port 5432)
- **Database**: app
- **User**: app / app
- **Connection**: `postgresql://app:app@localhost:5434/app`

**Schema:**
- **Schema Name**: app
- **Tables**: 29 total (13 core entities + 16 settings tables)
- **DDL Files**: 39 files in `/db/` directory
- **Backup**: Daily backups to S3

### Storage Architecture

**S3 Buckets:**

1. **cohuron-artifacts-prod-957207443425**
   - Purpose: User uploads, documents, artifacts
   - Features: Encryption, versioning, lifecycle policies
   - Lifecycle: 30 days → Standard-IA, 90 days → Glacier

2. **cohuron-code-46en2lnm**
   - Purpose: Code deployment bundles (.tar.gz)
   - Features: Encryption, versioning, EventBridge notifications
   - Lifecycle: Keep last 30 versions, delete old versions after 30 days
   - Triggers: S3 upload → EventBridge → Lambda deployment

---

## Terraform Resources & Modules

### Module Structure

```
infra-tf/
├── main.tf              # Root module - orchestrates all modules
├── variables.tf         # Root variables
├── outputs.tf           # Root outputs
├── terraform.tfvars     # Configuration values
│
└── modules/
    ├── vpc/             # VPC, subnets, security groups, routing
    ├── ec2/             # EC2 instance, IAM, Elastic IP, user data
    ├── s3/              # Artifact storage bucket
    ├── s3-code/         # Code deployment bucket
    ├── route53/         # DNS hosted zone and records
    └── lambda-deployer/ # Automated deployment Lambda function
```

### Module: VPC

**Location:** `modules/vpc/`

**Resources Created:**
```hcl
resource "aws_vpc" "cohuron_vpc"
resource "aws_subnet" "app_subnet_1"     # 10.0.1.0/24 (us-east-1a)
resource "aws_subnet" "app_subnet_2"     # 10.0.2.0/24 (us-east-1b)
resource "aws_subnet" "data_subnet_1"    # 10.0.11.0/24 (us-east-1a)
resource "aws_subnet" "data_subnet_2"    # 10.0.12.0/24 (us-east-1b)
resource "aws_internet_gateway" "igw"
resource "aws_route_table" "public_rt"
resource "aws_route_table" "private_rt"
resource "aws_security_group" "app_sg"   # EC2 application security
resource "aws_security_group" "db_sg"    # Database security (reserved)
```

**Key Outputs:**
- `vpc_id`
- `public_subnet_ids`
- `private_subnet_ids`
- `app_sg_id`
- `db_sg_id`

### Module: EC2

**Location:** `modules/ec2/`

**Resources Created:**
```hcl
resource "aws_iam_role" "ec2_role"
resource "aws_iam_instance_profile" "ec2_profile"
resource "aws_iam_role_policy" "ec2_s3_policy"
resource "aws_iam_role_policy_attachment" "ssm_policy"
resource "aws_key_pair" "deployer"
resource "aws_eip" "app_eip"
resource "aws_instance" "app_server"
```

**IAM Permissions:**
- S3 read/write to artifact bucket
- S3 read from code deployment bucket
- AWS Systems Manager (SSM) core functionality
- CloudWatch Logs write access

**User Data Script:**
- Installs: Node.js 20, Docker, Docker Compose, pnpm, Nginx, PM2
- Configures: Docker services (PostgreSQL, Redis, MinIO, MailHog)
- Deploys: Application code from GitHub
- Imports: Database schema (39 DDL files)
- Starts: PM2 services (API + Web)
- Creates: Helper scripts (cohuron-status, cohuron-logs, cohuron-restart)

### Module: S3 (Artifacts)

**Location:** `modules/s3/`

**Resources Created:**
```hcl
resource "aws_s3_bucket" "artifacts"
resource "aws_s3_bucket_public_access_block" "artifacts"
resource "aws_s3_bucket_versioning" "artifacts"
resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts"
resource "aws_s3_bucket_lifecycle_configuration" "artifacts"
```

**Features:**
- Public access: BLOCKED
- Encryption: AES-256
- Versioning: ENABLED
- Lifecycle: Automatic transitions to cheaper storage classes

### Module: S3-Code

**Location:** `modules/s3-code/`

**Resources Created:**
```hcl
resource "aws_s3_bucket" "code"
resource "aws_s3_bucket_public_access_block" "code"
resource "aws_s3_bucket_versioning" "code"
resource "aws_s3_bucket_server_side_encryption_configuration" "code"
resource "aws_s3_bucket_lifecycle_configuration" "code"
resource "aws_s3_bucket_notification" "code_upload"  # → EventBridge
```

**Purpose:** Stores deployment bundles created by `./deploy-code.sh`

**Naming Convention:** `cohuron-{branch}-{commit}-{timestamp}.tar.gz`

**EventBridge Integration:** Triggers Lambda on new file upload

### Module: Route53

**Location:** `modules/route53/`

**Resources Created:**
```hcl
resource "aws_route53_zone" "main"
resource "aws_route53_record" "app"     # app.cohuron.com → EC2 EIP
resource "aws_route53_record" "root"    # cohuron.com (optional)
resource "aws_route53_record" "www"     # www.cohuron.com (optional)
```

**DNS Records:**
- **A Record**: app.cohuron.com → 100.28.36.248
- **TTL**: 300 seconds
- **Type**: Simple routing

**Nameservers (Update at Domain Registrar):**
```
ns-123.awsdns-45.com
ns-678.awsdns-90.net
ns-1234.awsdns-56.org
ns-5678.awsdns-12.co.uk
```

### Module: Lambda Deployer

**Location:** `modules/lambda-deployer/`

**Resources Created:**
```hcl
resource "aws_lambda_function" "deployer"
resource "aws_iam_role" "lambda_role"
resource "aws_iam_role_policy" "lambda_s3_policy"
resource "aws_iam_role_policy" "lambda_ssm_policy"
resource "aws_cloudwatch_log_group" "lambda_logs"
resource "aws_cloudwatch_event_rule" "s3_upload"
resource "aws_cloudwatch_event_target" "lambda"
resource "aws_lambda_permission" "eventbridge"
```

**Function Details:**
- **Runtime**: Python 3.11
- **Memory**: 256 MB
- **Timeout**: 5 minutes
- **Trigger**: S3 upload via EventBridge

**Environment Variables:**
```
EC2_INSTANCE_ID=i-005e2f454d893942c
DEPLOY_PATH=/opt/cohuron
PROJECT_NAME=cohuron
```

**Deployment Script (Executed on EC2 via SSM):**
1. Stops PM2 services
2. Creates backup of current deployment
3. Downloads code bundle from S3
4. Extracts to `/opt/cohuron`
5. Installs dependencies (pnpm install)
6. Configures environment (.env files)
7. Starts Docker services
8. Imports database schema
9. Starts PM2 services (API + Web)
10. Verifies deployment

---

## Deployment Automation

### Automated Deployment Flow

```
Developer Local Machine
        │
        ↓
./infra-tf/deploy-code.sh
        │
        ├── Bundles current git branch
        ├── Excludes: node_modules, .git, dist, build
        ├── Filename: cohuron-main-a7b2a44-20251022-150000.tar.gz
        └── Uploads to S3: cohuron-code-46en2lnm
                │
                ↓
        S3 Object Created Event
                │
                ↓
        EventBridge Rule Triggered
        (cohuron-code-upload-trigger)
                │
                ↓
        Lambda Function Invoked
        (cohuron-code-deployer)
                │
                ├── Parses S3 event
                ├── Builds deployment script
                └── Sends SSM command to EC2
                        │
                        ↓
                EC2 Instance (100.28.36.248)
                        │
                        ├── Stops services
                        ├── Creates backup
                        ├── Downloads from S3: aws s3 cp s3://bucket/file.tar.gz
                        ├── Extracts to /opt/cohuron
                        ├── Installs dependencies
                        ├── Configures environment
                        ├── Starts Docker services
                        ├── Imports database schema
                        ├── Starts PM2 services
                        └── Deployment complete! ✅
```

### Deployment Script

**Location:** `infra-tf/deploy-code.sh`

**What it does:**
```bash
# 1. Get current git info
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 2. Create bundle
tar -czf "cohuron-${BRANCH}-${COMMIT}-${TIMESTAMP}.tar.gz" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude=build \
  .

# 3. Upload to S3
aws s3 cp "cohuron-${BRANCH}-${COMMIT}-${TIMESTAMP}.tar.gz" \
  s3://cohuron-code-46en2lnm/

# 4. Automatic deployment triggered via EventBridge
```

**Deployment Timeline:**
- 0-10 sec: Bundle creation
- 10-20 sec: S3 upload
- 20-50 sec: EventBridge → Lambda trigger
- 50 sec - 5 min: EC2 deployment (download, extract, install, restart)

**Total Time:** ~3-6 minutes for full deployment

### Lambda Deployment Function

**Location:** `modules/lambda-deployer/lambda_function.py`

**Key Steps:**
1. Parse S3 event from EventBridge
2. Extract bucket name and object key
3. Build deployment bash script (327 lines)
4. Execute via AWS Systems Manager (SSM)
5. Script includes:
   - Service management (stop/start)
   - Backup creation
   - Code download and extraction
   - Dependency installation (API + Web)
   - Environment configuration
   - Docker service startup
   - Database schema import
   - PM2 service management
   - Health verification

**Environment Configuration (Created by Lambda):**

**API .env:**
```bash
DATABASE_URL=postgresql://app:app@localhost:5434/app
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
JWT_SECRET=your-super-secret-jwt-key-change-in-production
WEB_ORIGIN=http://app.cohuron.com
API_ORIGIN=http://app.cohuron.com
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=artifacts
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@cohuron.com
```

**Web .env:**
```bash
VITE_API_BASE_URL=http://100.28.36.248:4000
```

### Monitoring Deployment

**View Lambda logs:**
```bash
aws --profile cohuron logs tail /aws/lambda/cohuron-code-deployer --since 5m --follow
```

**View SSM command execution:**
```bash
aws --profile cohuron ssm list-commands \
  --instance-id i-005e2f454d893942c \
  --max-results 5
```

**SSH to EC2 and check:**
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248

# Check deployment
cd /opt/cohuron && ls -la

# View backups
ls -la /opt/cohuron-backups/

# Check services
pm2 status
docker ps
```

---

## DNS Configuration

### Route 53 Setup

**Hosted Zone:** cohuron.com

**Zone ID:** Z0123456789ABC (from Terraform output)

**Nameservers (Update at Domain Registrar):**
```
ns-123.awsdns-45.com
ns-678.awsdns-90.net
ns-1234.awsdns-56.org
ns-5678.awsdns-12.co.uk
```

### DNS Records Created

**A Record:**
- **Name**: app.cohuron.com
- **Type**: A
- **Value**: 100.28.36.248 (Elastic IP)
- **TTL**: 300

**How to Update Nameservers:**

1. **GoDaddy:**
   - Login → My Products → Domains → cohuron.com → Manage DNS
   - DNS → Nameservers → Change → Custom
   - Enter 4 AWS nameservers → Save

2. **Namecheap:**
   - Login → Domain List → Manage
   - Nameservers → Custom DNS
   - Enter 4 AWS nameservers → Save

3. **Google Domains:**
   - Login → My domains → Manage
   - DNS → Name servers → Custom name servers
   - Enter 4 AWS nameservers → Save

**Propagation Time:** 5-60 minutes (usually < 10 minutes)

### Verify DNS

```bash
# Check DNS resolution
dig app.cohuron.com +short
# Should return: 100.28.36.248

# Check from different DNS servers
dig @8.8.8.8 app.cohuron.com +short  # Google DNS
dig @1.1.1.1 app.cohuron.com +short  # Cloudflare DNS

# Check propagation globally
# Visit: https://www.whatsmydns.net/
# Enter: app.cohuron.com
# Type: A
```

### SSL/TLS Setup (Manual - After DNS)

**Once DNS propagates, SSH to EC2:**
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
sudo /root/setup-ssl.sh
```

**What it does:**
1. Installs Certbot + Nginx plugin
2. Obtains Let's Encrypt certificate for app.cohuron.com
3. Configures Nginx for HTTPS
4. Sets up automatic renewal (cron job)
5. Redirects HTTP → HTTPS

**Certificate Files:**
```
/etc/letsencrypt/live/app.cohuron.com/fullchain.pem
/etc/letsencrypt/live/app.cohuron.com/privkey.pem
```

**Auto-Renewal:**
```bash
# Test renewal
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew --force-renewal
```

---

## Complete Deployment Process

### Prerequisites

**Required Tools:**
```bash
terraform --version  # >= 1.0
aws --version        # AWS CLI v2
ssh-keygen --help    # Available
git --version        # >= 2.0
```

**AWS Account:**
- IAM user with deployment permissions
- Access Key ID + Secret Access Key
- Domain name (cohuron.com) registered

### Step 1: Generate SSH Key (2 minutes)

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -C "cohuron@deployment"

# Or use RSA if ed25519 not supported
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_ed25519 -C "cohuron@deployment"

# Display public key (you'll need this)
cat ~/.ssh/id_ed25519.pub
```

**Copy the entire output** - you'll paste this into terraform.tfvars

### Step 2: Configure AWS Profile (3 minutes)

```bash
# Configure AWS CLI profile
aws configure --profile cohuron
```

Enter when prompted:
- **AWS Access Key ID**: [Your access key]
- **AWS Secret Access Key**: [Your secret]
- **Default region**: `us-east-1`
- **Default output**: `json`

**Verify it works:**
```bash
aws sts get-caller-identity --profile cohuron
```

### Step 3: Configure Terraform Variables (5 minutes)

```bash
# Navigate to Terraform directory
cd /home/rabin/projects/pmo/infra-tf

# Copy example to create config
cp terraform.tfvars.example terraform.tfvars

# Edit configuration
nano terraform.tfvars
```

**Update these REQUIRED values:**

```hcl
# 1. SSH Public Key (paste from Step 1)
ec2_public_key = "ssh-ed25519 AAAAC3... cohuron@deployment"

# 2. Database Password (generate strong password)
db_password = "YOUR_STRONG_PASSWORD_HERE"

# 3. SSH Access (restrict to your IP)
ssh_allowed_cidr = ["YOUR_IP/32"]

# 4. Domain Configuration
domain_name = "cohuron.com"
app_subdomain = "app"
create_dns_records = true

# 5. Optional: GitHub repo for auto-deployment
github_repo_url = ""  # Leave empty if manual deployment
```

**Quick commands:**
```bash
# Generate password
openssl rand -base64 32

# Find your public IP
curl ifconfig.me
```

**Review optional values:**
```hcl
# AWS Configuration
aws_profile = "cohuron"
aws_region = "us-east-1"
environment = "prod"
project_name = "cohuron"

# Instance Sizing (adjust based on needs)
ec2_instance_type = "t3.medium"      # ~$30/month
ec2_root_volume_size = 30            # GB

# Docker Database (using local PostgreSQL)
db_host = "localhost"
db_port = 5434
db_name = "app"
db_user = "app"
# db_password set above
```

### Step 4: Deploy Infrastructure (15 minutes)

```bash
# Initialize Terraform (downloads providers)
terraform init

# Validate configuration
terraform validate

# Preview what will be created
terraform plan

# Deploy everything!
terraform apply
```

**Type `yes` when prompted**

**Resources Created:**
```
module.vpc.aws_vpc.cohuron_vpc
module.vpc.aws_subnet.app_subnet_1
module.vpc.aws_subnet.app_subnet_2
module.vpc.aws_internet_gateway.igw
module.vpc.aws_security_group.app_sg
module.s3.aws_s3_bucket.artifacts
module.s3_code.aws_s3_bucket.code
module.ec2.aws_iam_role.ec2_role
module.ec2.aws_eip.app_eip
module.ec2.aws_instance.app_server
module.route53.aws_route53_zone.main
module.route53.aws_route53_record.app
module.lambda_deployer.aws_lambda_function.deployer
module.lambda_deployer.aws_cloudwatch_event_rule.s3_upload
```

**Timeline:**
- 0-2 min: VPC, subnets, routing, security groups
- 2-5 min: S3 buckets (artifacts + code)
- 5-10 min: Route 53 hosted zone
- 10-12 min: EC2 instance creation
- 12-15 min: User data script execution (install software, deploy app)
- 15+ min: Lambda function creation

**Terraform Output:**
```
Outputs:

vpc_id = "vpc-0890bb5a0728073b5"
ec2_instance_id = "i-005e2f454d893942c"
ec2_public_ip = "100.28.36.248"
s3_bucket_name = "cohuron-artifacts-prod-957207443425"
s3_code_bucket_name = "cohuron-code-46en2lnm"
hosted_zone_id = "Z0123456789ABC"
name_servers = [
  "ns-123.awsdns-45.com",
  "ns-678.awsdns-90.net",
  "ns-1234.awsdns-56.org",
  "ns-5678.awsdns-12.co.uk"
]
app_domain = "app.cohuron.com"
ssh_command = "ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248"
lambda_deployer_function = "cohuron-code-deployer"
```

### Step 5: Update Domain Nameservers (10 min + propagation)

**Copy nameservers from output above**

**Update at your domain registrar:**
1. Go to where you registered cohuron.com
2. Find DNS/Nameserver settings
3. Replace existing nameservers with 4 AWS nameservers
4. Save changes

**Wait 5-60 minutes for DNS propagation**

**Check DNS status:**
```bash
# Repeat until it shows EC2 IP
dig app.cohuron.com +short

# Should eventually show:
# 100.28.36.248
```

### Step 6: Setup SSL Certificate (2 minutes)

**Once DNS propagates:**

```bash
# SSH into EC2
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248

# Run SSL setup script
sudo /root/setup-ssl.sh

# Logs will show:
# Setting up SSL certificate for app.cohuron.com...
# Obtaining certificate from Let's Encrypt...
# Successfully received certificate!
# SSL setup complete!
```

### Step 7: Verify Deployment ✅

**Access your application:**
- **Application**: https://app.cohuron.com
- **API Health**: https://app.cohuron.com/api/v1/health
- **API Docs**: https://app.cohuron.com/docs

**Test Account:**
```
Email: james.miller@huronhome.ca
Password: password123
```

**Check Services (SSH):**
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248

# Check all services
cohuron-status

# View logs
cohuron-logs

# Check PM2
pm2 status

# Check Docker
docker ps
```

### Step 8: Deploy Code (Optional)

**From your local machine:**
```bash
cd /home/rabin/projects/pmo
./infra-tf/deploy-code.sh

# Automated deployment:
# 1. Bundles current git branch
# 2. Uploads to S3
# 3. EventBridge triggers Lambda
# 4. Lambda deploys to EC2
# 5. ~3-6 minutes total
```

**Monitor deployment:**
```bash
# Watch Lambda logs
aws --profile cohuron logs tail /aws/lambda/cohuron-code-deployer --since 5m --follow

# SSH and check
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
cd /opt/cohuron && ls -la
pm2 logs
```

---

## Cost Analysis

### Current Configuration (Docker Database on EC2)

**Monthly Costs:**

| Service | Type | Quantity | Monthly Cost | Annual Cost |
|---------|------|----------|--------------|-------------|
| EC2 Instance | t3.medium | 1 | $30.37 | $364.42 |
| EBS Storage | gp3 30 GB | 1 | $2.40 | $28.80 |
| Elastic IP | Static IP | 1 | $0.00 | $0.00 |
| S3 Artifacts | ~10 GB | 1 | $0.23 | $2.76 |
| S3 Code | ~5 GB | 1 | $0.12 | $1.44 |
| Route 53 Zone | Hosted Zone | 1 | $0.50 | $6.00 |
| Route 53 Queries | ~1M/month | 1 | $0.40 | $4.80 |
| Lambda Deploys | ~50/month | 1 | $0.05 | $0.60 |
| Data Transfer | ~50 GB out | 1 | $4.50 | $54.00 |
| Backups (S3) | ~5 GB | 1 | $0.12 | $1.44 |
| **TOTAL** | | | **~$38.69/mo** | **~$464.26/yr** |

**Note:** RDS removed, using Docker PostgreSQL on EC2 instead. Saves ~$15/month.

### Cost Optimization Strategies

**1. Ultra-Budget Configuration (~$25/month):**
```hcl
ec2_instance_type = "t3.small"      # $15.18/mo (instead of $30.37)
ec2_root_volume_size = 20           # $1.60/mo (instead of $2.40)
# Use scheduled shutdown (off-hours): Additional 50% savings
```

**2. Production Configuration (~$135/month):**
```hcl
ec2_instance_type = "t3.large"      # $60.74/mo
# Add RDS Multi-AZ
db_instance_class = "db.t3.small"   # $54.02/mo
# Add CloudWatch monitoring: $10/mo
# Add AWS Backup: $5/mo
```

**3. Reserved Instances (1-year commitment):**
- t3.medium reserved: $21.90/mo (save 28%)
- Annual upfront payment option available
- Break-even at ~8 months

**4. Scheduled Scaling (Dev environments):**
```bash
# Stop instances outside business hours
# Run only 40 hrs/week × 4.3 weeks = 172 hours/month
# Savings: (730 - 172) / 730 × $38.69 = ~$30/mo saved
# New cost: ~$8-10/month
```

### Hidden/Unexpected Costs to Avoid

| Item | Cost | How to Avoid |
|------|------|--------------|
| Unattached Elastic IP | $3.60/mo | Keep attached to running instance ✓ |
| NAT Gateway | $32/mo | Not using (no private subnet internet) ✓ |
| Load Balancer | $16/mo | Not using (direct EC2 access) ✓ |
| RDS | $15-50/mo | Using Docker PostgreSQL instead ✓ |
| EBS Snapshots | $0.05/GB/mo | Delete old snapshots regularly |
| CloudWatch Logs | $0.50/GB | Set 7-day retention for dev |

**Current setup avoids most hidden costs!**

---

## Monitoring & Operations

### Helper Scripts (Created on EC2)

**Location:** `/usr/local/bin/`

**Available Commands:**
```bash
cohuron-status      # Check all service status
cohuron-logs        # View application logs
cohuron-logs api    # View API logs only
cohuron-logs web    # View Web logs only
cohuron-restart     # Restart all services
cohuron-backup      # Manual database backup to S3
cohuron-update      # Pull latest code and redeploy
```

### Check Service Status

```bash
# Overall status
cohuron-status

# PM2 processes
pm2 status
pm2 logs
pm2 monit

# Docker services
docker ps
docker compose ps

# Check specific container
docker logs pmo_db
docker logs pmo_redis
```

### View Logs

**Application Logs:**
```bash
# All logs
cohuron-logs

# API logs
cohuron-logs api

# Web logs
cohuron-logs web

# PM2 logs with tail
pm2 logs --lines 100
```

**Nginx Logs:**
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**System Logs:**
```bash
# User data script log
sudo cat /var/log/cloud-init-output.log

# System messages
sudo journalctl -xe
```

### Database Management

**Connect to Database:**
```bash
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app
```

**Common Queries:**
```sql
-- Check connections
SELECT * FROM pg_stat_activity;

-- Database size
SELECT pg_size_pretty(pg_database_size('app'));

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'app'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Vacuum
VACUUM ANALYZE;
```

**Backup Database:**
```bash
# Automated daily backup (cron job)
# Runs at 02:00 UTC, uploads to S3

# Manual backup
cohuron-backup

# Verify backups in S3
aws s3 ls s3://cohuron-artifacts-prod-957207443425/backups/
```

**Restore Database:**
```bash
# Download backup from S3
aws s3 cp s3://bucket/backups/app_db_20250122_020000.sql ./backup.sql

# Restore
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app < backup.sql
```

### Restart Services

**Restart all:**
```bash
cohuron-restart
```

**Restart specific service:**
```bash
# PM2 services
pm2 restart cohuron-api
pm2 restart cohuron-web

# Docker services
docker compose restart
docker restart pmo_db
docker restart pmo_redis

# Nginx
sudo systemctl restart nginx
```

### Update Application

**Method 1: Automated Deployment (Recommended)**
```bash
# From local machine
cd /home/rabin/projects/pmo
./infra-tf/deploy-code.sh

# Automatic deployment via Lambda + SSM
# Takes 3-6 minutes
```

**Method 2: Manual Update (On EC2)**
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248

# Run update script
cohuron-update

# Or manually:
cd /opt/cohuron
git pull origin main
pnpm install
cd apps/api && pnpm build
cd ../web && pnpm build
pm2 restart all
```

### Monitor Resources

```bash
# CPU, Memory, Disk
htop

# Disk usage
df -h

# Memory usage
free -h

# Network connections
netstat -tuln

# Process tree
pstree -p
```

### CloudWatch Integration (Optional - Not Currently Enabled)

**Install CloudWatch Agent:**
```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

**Metrics to monitor:**
- CPU utilization
- Memory usage
- Disk usage
- Network I/O
- Application logs

---

## Security & Best Practices

### Current Security Measures

**✅ Implemented:**
- VPC isolation
- Security groups with least privilege
- Encrypted EBS volumes (AES-256)
- Encrypted S3 buckets (AES-256)
- IAM roles (no hardcoded credentials)
- Automated backups (daily to S3)
- SSH key-based authentication
- SSL/TLS encryption (Let's Encrypt)
- Private database (Docker local to EC2)

### Security Hardening Checklist

**Network Security:**
- [x] VPC with public/private subnets
- [x] Security groups configured
- [ ] VPC Flow Logs (optional)
- [ ] Network ACLs (additional layer)
- [x] Elastic IP for static addressing
- [ ] WAF (Web Application Firewall) for production

**Access Control:**
- [x] IAM roles for EC2 (no access keys on instance)
- [x] SSH restricted to specific IP
- [ ] Session Manager (alternative to SSH)
- [x] MFA on AWS root account (recommended)
- [ ] Secrets Manager for database credentials

**Data Protection:**
- [x] EBS encryption
- [x] S3 encryption
- [ ] RDS encryption (if using RDS)
- [x] SSL/TLS for web traffic
- [x] Daily backups to S3
- [ ] Cross-region backup replication

**Monitoring:**
- [x] PM2 process monitoring
- [ ] CloudWatch alarms
- [ ] CloudWatch Logs
- [ ] GuardDuty (threat detection)
- [ ] AWS Config (compliance)

### Recommended Security Improvements

**1. Replace SSH with Session Manager:**
```hcl
# Already has SSM policy attached
# No need to expose port 22

# Connect via:
aws ssm start-session --target i-005e2f454d893942c --profile cohuron
```

**2. Enable VPC Flow Logs:**
```hcl
resource "aws_flow_log" "vpc" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = module.vpc.vpc_id
}
```

**3. Use AWS Secrets Manager:**
```hcl
resource "aws_secretsmanager_secret" "db_master" {
  name = "cohuron-db-master-prod"
}

resource "aws_secretsmanager_secret_version" "db_master" {
  secret_id     = aws_secretsmanager_secret.db_master.id
  secret_string = jsonencode({
    username = "app"
    password = var.db_password
    engine   = "postgres"
    host     = "localhost"
    port     = 5434
    dbname   = "app"
  })
}
```

**4. Setup CloudWatch Alarms:**
```hcl
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "cohuron-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EC2 CPU above 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = module.ec2.instance_id
  }
}
```

**5. Regular Security Updates:**
```bash
# Schedule weekly
sudo apt-get update && sudo apt-get upgrade -y
```

### Compliance & Audit

**Data Residency:**
- All data stored in us-east-1 region
- No cross-region data transfer
- GDPR/PIPEDA compliant architecture

**Audit Trail:**
- CloudTrail: All API calls logged (enable recommended)
- CloudWatch: Application logs retained
- Git: All infrastructure changes versioned

**Backup & Recovery:**
- Daily automated backups to S3
- 7-day retention on EC2
- 30-day S3 lifecycle to Glacier
- Point-in-time recovery (manual via backups)

---

## Infrastructure Improvements

### Critical Missing Components (Recommended for Production)

**1. Remote Terraform State (High Priority)**

**Current:** Local state file at `terraform.tfstate`

**Risk:**
- State contains sensitive data
- No team collaboration
- State loss = infrastructure unmanageable

**Solution:**
```hcl
# main.tf - Replace local backend
terraform {
  backend "s3" {
    bucket         = "cohuron-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cohuron-terraform-locks"
  }
}
```

**Setup:**
```bash
# Create state bucket
aws s3 mb s3://cohuron-terraform-state --profile cohuron
aws s3api put-bucket-versioning \
  --bucket cohuron-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name cohuron-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Migrate existing state
terraform init -migrate-state
```

**Cost:** ~$1-2/month

**2. CloudWatch Monitoring & Alarms**

**Current:** No automated monitoring

**What's needed:**
- CPU/Memory/Disk alarms
- Application error rate monitoring
- SNS notifications for critical alerts
- CloudWatch dashboard

**Cost:** ~$5-10/month (first 10 alarms free)

**3. Auto Scaling Group (For Production)**

**Current:** Single EC2 instance (single point of failure)

**What's needed:**
- Minimum 2 instances across AZs
- Application Load Balancer with SSL
- Auto-scaling based on CPU/traffic
- Health checks

**Cost:** +$30-50/month (additional EC2 + ALB)

### Optional Enhancements

**4. ElastiCache Redis (Instead of Docker)**

**Current:** Redis in Docker on EC2

**Benefits of ElastiCache:**
- High availability
- Automatic failover
- Automated backups
- Better performance

**Cost:** ~$12-15/month (cache.t3.micro)

**5. AWS WAF (Web Application Firewall)**

**Protection against:**
- SQL injection
- XSS attacks
- DDoS
- Rate limiting

**Cost:** ~$5-10/month

**6. CloudFront CDN**

**Benefits:**
- Global content delivery
- DDoS protection
- Static asset caching
- Faster page loads

**Cost:** ~$1-10/month (traffic-based)

### Cost Impact Summary

| Phase | Components | Monthly Cost | Priority |
|-------|-----------|--------------|----------|
| **Current** | VPC, EC2, S3, Route53, Lambda | $39 | - |
| **Phase 1** | Remote State, CloudWatch, Secrets | +$7-12 | Critical |
| **Phase 2** | ALB, ElastiCache, WAF | +$40-60 | High |
| **Phase 3** | Auto Scaling (×2), Backups | +$40-60 | Medium |
| **Phase 4** | CloudFront, Multi-region | +$20-50 | Low |
| **Recommended** | | **~$85-110** | - |
| **Full Production** | | **~$165-195** | - |

---

## Troubleshooting

### Terraform Issues

**Cannot initialize Terraform:**
```bash
# Check Terraform version
terraform --version

# Reinitialize
rm -rf .terraform .terraform.lock.hcl
terraform init
```

**Apply fails with state errors:**
```bash
# Validate state
terraform state list

# Refresh state
terraform refresh

# If state is corrupted, restore from backup
cp terraform.tfstate.backup terraform.tfstate
```

**Resource already exists:**
```bash
# Import existing resource
terraform import module.vpc.aws_vpc.cohuron_vpc vpc-0890bb5a0728073b5

# Or remove from state and recreate
terraform state rm module.vpc.aws_vpc.cohuron_vpc
terraform apply
```

### AWS Connectivity Issues

**Cannot connect to AWS:**
```bash
# Check AWS CLI
aws --version

# Check credentials
aws sts get-caller-identity --profile cohuron

# Reconfigure if needed
aws configure --profile cohuron
```

**Wrong region:**
```bash
# Check current region
aws configure get region --profile cohuron

# Set correct region
aws configure set region us-east-1 --profile cohuron
```

### EC2 Access Issues

**Cannot SSH:**
```bash
# Fix key permissions
chmod 400 ~/.ssh/id_ed25519

# Check security group allows your IP
aws ec2 describe-security-groups \
  --group-ids sg-xxx \
  --profile cohuron

# Update allowed IP in terraform.tfvars
ssh_allowed_cidr = ["NEW_IP/32"]
terraform apply
```

**Wrong SSH key:**
```bash
# Check which key is configured
terraform output ssh_command

# Use correct key
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
```

### Application Not Accessible

**DNS not resolving:**
```bash
# Check DNS
dig app.cohuron.com +short

# Check nameservers at registrar
# Wait for propagation (5-60 minutes)

# Verify Route 53 record
aws route53 list-resource-record-sets \
  --hosted-zone-id Z0123456789ABC \
  --profile cohuron
```

**Services not running:**
```bash
# SSH and check
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248

# Check all services
cohuron-status

# Check PM2
pm2 status
pm2 logs

# Check Docker
docker ps
docker compose ps

# Restart services
cohuron-restart
```

**Database connection failed:**
```bash
# Check PostgreSQL container
docker ps | grep pmo_db

# Check logs
docker logs pmo_db

# Restart database
docker compose restart pmo_db

# Test connection
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app
```

### Deployment Issues

**Lambda deployment fails:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/cohuron-code-deployer --since 10m --profile cohuron

# Check SSM command status
aws ssm list-commands --instance-id i-005e2f454d893942c --profile cohuron

# SSH and check deployment log
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
tail -f /var/log/cloud-init-output.log
```

**Code not updating:**
```bash
# Check S3 upload
aws s3 ls s3://cohuron-code-46en2lnm/ --profile cohuron

# Check EventBridge rule
aws events list-rules --name-prefix cohuron --profile cohuron

# Manual deployment
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
cohuron-update
```

### SSL Certificate Issues

**Certificate expired:**
```bash
# Check expiry
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

**Certificate not found:**
```bash
# DNS must be propagated first
dig app.cohuron.com +short

# Obtain certificate
sudo /root/setup-ssl.sh

# Or manually
sudo certbot --nginx -d app.cohuron.com
```

### Performance Issues

**High CPU:**
```bash
# Check processes
htop
top

# PM2 monitoring
pm2 monit

# Restart services
pm2 restart all

# Consider scaling up
# terraform.tfvars: ec2_instance_type = "t3.large"
```

**High memory:**
```bash
# Check memory
free -h

# Check Docker containers
docker stats

# Restart if needed
docker compose restart
pm2 restart all
```

**Disk full:**
```bash
# Check disk usage
df -h

# Clean old logs
sudo journalctl --vacuum-time=7d
pm2 flush

# Clean old backups
rm /opt/cohuron-backups/cohuron-backup-*.tar.gz

# Clean Docker
docker system prune -a
```

---

## Quick Reference

### Essential Commands

**Terraform:**
```bash
cd /home/rabin/projects/pmo/infra-tf
terraform init                  # Initialize
terraform plan                  # Preview changes
terraform apply                 # Apply changes
terraform destroy               # Destroy infrastructure
terraform output                # Show outputs
terraform state list            # List resources
```

**Deployment:**
```bash
cd /home/rabin/projects/pmo
./infra-tf/deploy-code.sh      # Deploy code
```

**SSH Access:**
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
```

**On EC2:**
```bash
cohuron-status      # Check status
cohuron-logs        # View logs
cohuron-restart     # Restart services
cohuron-backup      # Backup database
pm2 status          # PM2 status
docker ps           # Docker containers
```

**AWS CLI:**
```bash
aws sts get-caller-identity --profile cohuron
aws s3 ls --profile cohuron
aws ec2 describe-instances --profile cohuron
aws logs tail /aws/lambda/cohuron-code-deployer --follow --profile cohuron
```

### Important URLs

- **Application**: https://app.cohuron.com
- **API**: http://100.28.36.248:4000
- **API Health**: http://100.28.36.248:4000/api/v1/health
- **API Docs**: http://100.28.36.248:4000/docs

### Test Account

```
Email: james.miller@huronhome.ca
Password: password123
```

### Service Ports

| Service | Port | Access |
|---------|------|--------|
| Web App | 5173 | Public |
| API | 4000 | Public |
| PostgreSQL | 5434 | Local only |
| Redis | 6379 | Local only |
| MinIO | 9000 | Local only |
| MailHog | 8025 | Local only |
| Nginx | 80, 443 | Public |
| SSH | 22 | Restricted IP |

### File Locations

**Infrastructure:**
- Terraform: `/home/rabin/projects/pmo/infra-tf/`
- State: `./terraform.tfstate` (migrate to S3 recommended)
- Variables: `./terraform.tfvars`

**Application (EC2):**
- Code: `/opt/cohuron/`
- Backups: `/opt/cohuron-backups/`
- Logs: `/var/log/` and PM2 logs
- Docker Compose: `/opt/cohuron/docker-compose.yml`
- Environment: `/opt/cohuron/apps/api/.env`

**SSL Certificates:**
- Location: `/etc/letsencrypt/live/app.cohuron.com/`
- Renewal: Automatic via cron

### Resource IDs

```
VPC:              vpc-0890bb5a0728073b5
EC2:              i-005e2f454d893942c
Elastic IP:       100.28.36.248
S3 Artifacts:     cohuron-artifacts-prod-957207443425
S3 Code:          cohuron-code-46en2lnm
Lambda:           cohuron-code-deployer
Route 53 Zone:    Z0123456789ABC
```

### Monthly Costs

**Current Configuration:** ~$39/month

| Component | Cost |
|-----------|------|
| EC2 t3.medium | $30.37 |
| Storage (EBS + S3) | $2.75 |
| Route 53 | $0.90 |
| Data Transfer | $4.50 |
| Lambda | $0.05 |
| **Total** | **$38.57** |

---

**Document Version:** 2.0
**Last Updated:** 2025-01-22
**Infrastructure:** Production
**Region:** us-east-1
**Domain:** cohuron.com

---

**This completes the comprehensive infrastructure documentation for the Cohuron Platform. All original documentation files have been merged into this single reference document.**
