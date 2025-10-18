# Coherent PMO Platform - AWS Deployment Guide

Complete guide for deploying the Coherent PMO Platform to AWS using Terraform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Overview](#infrastructure-overview)
3. [Initial Setup](#initial-setup)
4. [Deploy Infrastructure](#deploy-infrastructure)
5. [Deploy Application](#deploy-application)
6. [DNS Configuration](#dns-configuration)
7. [SSL/TLS Configuration](#ssltls-configuration)
8. [Post-Deployment Tasks](#post-deployment-tasks)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# Install Terraform (v1.0+)
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installation
terraform --version

# Install AWS CLI (v2)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

### AWS Account Setup

1. **Create AWS Account** (if you don't have one)
   - Visit https://aws.amazon.com/
   - Sign up for a new account

2. **Create IAM User for Terraform**

   ```bash
   # Log into AWS Console
   # Navigate to IAM > Users > Add User
   # User name: terraform-coherent
   # Access type: Programmatic access
   # Attach policies:
   #   - AmazonEC2FullAccess
   #   - AmazonRDSFullAccess
   #   - AmazonS3FullAccess
   #   - AmazonVPCFullAccess
   #   - IAMFullAccess

   # Save Access Key ID and Secret Access Key
   ```

3. **Configure AWS CLI**

   ```bash
   aws configure
   # AWS Access Key ID: [Your Access Key]
   # AWS Secret Access Key: [Your Secret Key]
   # Default region name: us-east-1
   # Default output format: json

   # Verify configuration
   aws sts get-caller-identity
   ```

### SSH Key Generation

```bash
# Generate SSH key pair for EC2 access
ssh-keygen -t rsa -b 4096 -f ~/.ssh/coherent-key -C "coherent-aws-key"

# Set proper permissions
chmod 400 ~/.ssh/coherent-key

# Display public key (you'll need this for terraform.tfvars)
cat ~/.ssh/coherent-key.pub
```

---

## Infrastructure Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                          AWS VPC                             │
│                       (10.0.0.0/16)                          │
│                                                               │
│  ┌───────────────────────┐  ┌──────────────────────────┐   │
│  │   Public Subnets      │  │   Private Subnets        │   │
│  │  (app-subnet-group)   │  │  (data-subnet-group)     │   │
│  │                       │  │                          │   │
│  │  ┌─────────────────┐ │  │  ┌────────────────────┐ │   │
│  │  │  EC2 Instance   │ │  │  │  RDS PostgreSQL    │ │   │
│  │  │  (App Server)   │◄─┼──┼─►│  (Database)        │ │   │
│  │  │                 │ │  │  │                    │ │   │
│  │  │  - API :4000    │ │  │  │  - Port: 5432      │ │   │
│  │  │  - Web :5173    │ │  │  │  - Multi-AZ (prod) │ │   │
│  │  │  - Nginx :80    │ │  │  │  - Encrypted       │ │   │
│  │  └─────────────────┘ │  │  └────────────────────┘ │   │
│  │          │            │  │                          │   │
│  └──────────┼────────────┘  └──────────────────────────┘   │
│             │                                                │
│             │ Internet Gateway                              │
└─────────────┼────────────────────────────────────────────────┘
              │
              ▼
         Internet
              │
              ▼
     ┌────────────────┐
     │   S3 Bucket    │
     │  (Artifacts)   │
     │  - Encrypted   │
     │  - Versioned   │
     └────────────────┘
```

### Resources Created

| Resource | Purpose | Cost Estimate (Monthly) |
|----------|---------|-------------------------|
| VPC | Network isolation | $0 |
| 2x Public Subnets | Application tier | $0 |
| 2x Private Subnets | Database tier | $0 |
| Internet Gateway | Public internet access | $0 |
| NAT Gateway | Private subnet outbound | ~$32 |
| EC2 t3.medium | Application server | ~$30 |
| RDS db.t3.micro | PostgreSQL database | ~$15 (free tier: $0) |
| EBS 30GB (gp3) | EC2 storage | ~$3 |
| S3 Bucket | Artifact storage | ~$0.50 (variable) |
| Elastic IP | Static IP for EC2 | $0 (while attached) |
| **TOTAL** | | **~$80/month** (dev), **~$150+/month** (prod) |

---

## Initial Setup

### 1. Clone Repository

```bash
cd /path/to/your/projects
git clone <your-coherent-repo-url>
cd coherent/infra-tf
```

### 2. Create Terraform Variables

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required Changes:**

```hcl
# terraform.tfvars

# General
aws_region   = "us-east-1"    # Your preferred region
environment  = "dev"           # dev, staging, or prod
project_name = "coherent"

# Security
ssh_allowed_cidr = ["YOUR_IP_ADDRESS/32"]  # IMPORTANT: Replace with your IP!
# Find your IP: curl ifconfig.me

# Database
db_password = "STRONG_RANDOM_PASSWORD_HERE"  # Generate: openssl rand -base64 32

# EC2 SSH Key
ec2_public_key = "ssh-rsa AAAAB3NzaC1yc2E..."  # Paste from ~/.ssh/coherent-key.pub
```

### 3. Initialize Terraform

```bash
cd infra-tf

# Initialize Terraform (download providers)
terraform init

# Validate configuration
terraform validate

# Review planned changes
terraform plan
```

---

## Deploy Infrastructure

### 1. Deploy with Terraform

```bash
# Apply infrastructure (creates all AWS resources)
terraform apply

# Review the plan carefully
# Type 'yes' when prompted

# Wait 10-15 minutes for infrastructure creation
```

### 2. Capture Outputs

```bash
# View all outputs
terraform output

# Save important values
terraform output -json > outputs.json

# Get specific outputs
EC2_IP=$(terraform output -raw ec2_public_ip)
DB_ENDPOINT=$(terraform output -raw db_endpoint)

echo "EC2 Public IP: $EC2_IP"
echo "Database Endpoint: $DB_ENDPOINT"
```

**Example Output:**

```
Outputs:

api_url = "http://54.123.45.67:4000"
db_endpoint = "coherent-db.abc123.us-east-1.rds.amazonaws.com:5432"
ec2_public_ip = "54.123.45.67"
s3_bucket_name = "coherent-artifacts-dev-123456789012"
ssh_command = "ssh -i ~/.ssh/coherent-key.pem ubuntu@54.123.45.67"
web_url = "http://54.123.45.67:5173"
```

---

## Deploy Application

### 1. SSH into EC2 Instance

```bash
# Get SSH command from Terraform output
terraform output ssh_command

# Or manually
ssh -i ~/.ssh/coherent-key ubuntu@<EC2_PUBLIC_IP>
```

### 2. Wait for User Data Script

```bash
# The user-data script runs on first boot (5-10 minutes)
# Check progress
sudo tail -f /var/log/user-data.log

# Wait until you see "Setup completed successfully!"
```

### 3. Configure Repository

```bash
# Edit deployment script with your Git repository URL
sudo nano /opt/coherent/deploy.sh

# Update this line:
REPO_URL="https://github.com/YOUR_ORG/coherent.git"  # UPDATE THIS!
```

### 4. Deploy Application

```bash
# Run deployment script
sudo /opt/coherent/deploy.sh

# This will:
# 1. Clone your repository
# 2. Install dependencies
# 3. Build API and Web
# 4. Initialize database with all DDL files
# 5. Start PM2 services

# Check status
coherent-status

# View logs
coherent-logs
```

### 5. Verify Deployment

```bash
# Check PM2 processes
pm2 status

# Test API
curl http://localhost:4000/api/v1/health

# Test Web
curl http://localhost:5173

# Test Nginx proxy
curl http://localhost:80/api/v1/health
```

---

## DNS Configuration

### Option 1: AWS Route 53 (Recommended)

#### Step 1: Create Hosted Zone

```bash
# Via AWS Console
# 1. Go to Route 53 > Hosted Zones > Create Hosted Zone
# 2. Domain name: yourdomain.com
# 3. Type: Public Hosted Zone
# 4. Create Hosted Zone

# Via AWS CLI
aws route53 create-hosted-zone \
  --name coherent.yourdomain.com \
  --caller-reference $(date +%s)
```

#### Step 2: Update Domain Registrar

```
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS/Nameserver settings
3. Update nameservers to Route 53 nameservers:
   - ns-1234.awsdns-12.org
   - ns-5678.awsdns-34.com
   - ns-9012.awsdns-56.net
   - ns-3456.awsdns-78.co.uk
   (Get these from Route 53 Hosted Zone)
4. Save changes (propagation takes 24-48 hours)
```

#### Step 3: Create DNS Records

```bash
# Get EC2 Elastic IP
EC2_IP=$(terraform output -raw ec2_public_ip)

# Create A record via Console
# Route 53 > Hosted Zones > yourdomain.com > Create Record
# Record name: coherent (or leave blank for root)
# Type: A
# Value: <EC2_IP>
# TTL: 300

# Or via AWS CLI
HOSTED_ZONE_ID="Z1234567890ABC"  # Get from Route 53

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "coherent.yourdomain.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "'$EC2_IP'"}]
      }
    }]
  }'
```

#### Step 4: Verify DNS

```bash
# Check DNS propagation
dig coherent.yourdomain.com +short

# Should return: <EC2_IP>

# Test web access
curl http://coherent.yourdomain.com

# Test API
curl http://coherent.yourdomain.com/api/v1/health
```

### Option 2: Other DNS Providers (Cloudflare, GoDaddy, etc.)

1. **Log into your DNS provider**
2. **Create A record:**
   - Name: `coherent` (or `@` for root domain)
   - Type: `A`
   - Value: `<EC2_PUBLIC_IP>` (from Terraform output)
   - TTL: `300` (or Auto)
3. **Save record**
4. **Wait for propagation** (5 minutes to 48 hours)

---

## SSL/TLS Configuration

### Using Let's Encrypt (Free SSL Certificate)

#### Step 1: Install Certbot

```bash
# SSH into EC2 instance
ssh -i ~/.ssh/coherent-key ubuntu@<EC2_IP>

# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

#### Step 2: Obtain SSL Certificate

```bash
# Replace with your domain
DOMAIN="coherent.yourdomain.com"

# Obtain certificate (interactive)
sudo certbot --nginx -d $DOMAIN

# Follow prompts:
# 1. Enter email address
# 2. Agree to terms
# 3. Share email? (optional)
# 4. Redirect HTTP to HTTPS? Yes (recommended)
```

#### Step 3: Verify SSL Configuration

```bash
# Test HTTPS
curl https://coherent.yourdomain.com/api/v1/health

# Check certificate
openssl s_client -connect coherent.yourdomain.com:443 -servername coherent.yourdomain.com < /dev/null | openssl x509 -noout -dates

# Certbot created auto-renewal cron job
sudo systemctl status certbot.timer
```

#### Step 4: Update Nginx Configuration (if needed)

```bash
# Certbot should auto-configure, but verify
sudo nano /etc/nginx/sites-available/coherent

# Should include SSL configuration:
# listen 443 ssl;
# ssl_certificate /etc/letsencrypt/live/coherent.yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/coherent.yourdomain.com/privkey.pem;

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Using AWS Certificate Manager (ACM) + Application Load Balancer

For production deployments with multiple instances, use ALB with ACM:

#### Step 1: Request Certificate

```bash
# Via AWS Console
# 1. ACM > Request Certificate
# 2. Domain name: coherent.yourdomain.com
# 3. Validation method: DNS validation
# 4. Add DNS record to Route 53 (one-click)

# Via AWS CLI
aws acm request-certificate \
  --domain-name coherent.yourdomain.com \
  --validation-method DNS
```

#### Step 2: Create Application Load Balancer

```bash
# Add to main.tf:
resource "aws_lb" "coherent_alb" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.app_sg.id]
  subnets            = [aws_subnet.app_subnet_1.id, aws_subnet.app_subnet_2.id]
}

resource "aws_lb_target_group" "coherent_tg" {
  name     = "${var.project_name}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.coherent_vpc.id

  health_check {
    path = "/api/v1/health"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.coherent_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = "arn:aws:acm:us-east-1:123456789012:certificate/abc123..."

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.coherent_tg.arn
  }
}

# Apply changes
terraform apply
```

#### Step 3: Update Route 53

```bash
# Update A record to point to ALB instead of EC2
# Route 53 > Hosted Zones > yourdomain.com > Edit Record
# Type: A - Alias
# Alias Target: <ALB DNS name>
```

---

## Post-Deployment Tasks

### 1. Create Admin User

```bash
# SSH into EC2
ssh -i ~/.ssh/coherent-key ubuntu@<EC2_IP>

# Connect to database
DB_HOST=$(grep DB_HOST /opt/coherent/.env | cut -d'=' -f2)
DB_NAME=$(grep DB_NAME /opt/coherent/.env | cut -d'=' -f2)
DB_USER=$(grep DB_USER /opt/coherent/.env | cut -d'=' -f2)

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Create admin user (use your details)
INSERT INTO app.d_employee (
  id, email, password_hash, first_name, last_name, active_flag
) VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',
  crypt('YourStrongPassword', gen_salt('bf')),  -- Change password!
  'Admin',
  'User',
  true
);

# Grant full permissions
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, active_flag)
SELECT
  id,
  entity_type,
  'all',
  ARRAY[0,1,2,3,4]::int[],
  true
FROM app.d_employee, (
  SELECT DISTINCT entity_type FROM app.d_entity
) entities
WHERE email = 'admin@yourdomain.com';
```

### 2. Configure Environment Variables

```bash
# Update production environment variables
sudo nano /opt/coherent/.env

# Key variables to update:
# - JWT_SECRET (generate new: openssl rand -base64 32)
# - Email SMTP settings (replace MailHog with real SMTP)
# - MinIO/S3 configuration
# - Any API keys or secrets

# Restart services
pm2 restart all
```

### 3. Enable Firewall (Production)

```bash
# SSH into EC2
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

### 4. Setup Monitoring

```bash
# Install CloudWatch Agent (if not done by user-data)
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
```

### 5. Setup Automated Backups

```bash
# Database backups are configured via user-data script
# Verify cron job
crontab -l | grep coherent-backup

# Should show:
# 0 2 * * * /usr/local/bin/coherent-backup >> /var/log/coherent-backup.log 2>&1

# Test backup manually
sudo /usr/local/bin/coherent-backup

# Verify backup in S3
aws s3 ls s3://<S3_BUCKET_NAME>/backups/
```

---

## Monitoring and Maintenance

### Daily Commands

```bash
# Check system status
coherent-status

# View application logs
coherent-logs         # All logs
coherent-logs api     # API logs only
coherent-logs web     # Web logs only

# Monitor resources
htop
df -h
free -h

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Update Application

```bash
# Pull latest code and redeploy
sudo coherent-update

# Or manually
cd /opt/coherent/pmo
git pull origin main
npm install
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..
pm2 restart all
```

### Database Maintenance

```bash
# Connect to database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# View active connections
SELECT * FROM pg_stat_activity;

# View database size
SELECT pg_size_pretty(pg_database_size('coherent'));

# Vacuum database
VACUUM ANALYZE;
```

### Performance Monitoring

```bash
# PM2 monitoring
pm2 monit

# View PM2 metrics
pm2 describe coherent-api
pm2 describe coherent-web

# CloudWatch (via AWS Console)
# EC2 > Instances > Monitoring
# RDS > Databases > Monitoring
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 status
pm2 status

# View error logs
pm2 logs coherent-api --err
pm2 logs coherent-web --err

# Check environment variables
cat /opt/coherent/.env

# Test database connection
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Restart services
pm2 restart all
```

### Database Connection Issues

```bash
# Check RDS status (from local machine)
aws rds describe-db-instances --db-instance-identifier coherent-db

# Test from EC2
telnet <DB_ENDPOINT> 5432

# Check security group rules
aws ec2 describe-security-groups --group-ids <DB_SECURITY_GROUP_ID>

# Verify RDS is accessible from EC2 (check NACL, route tables)
```

### SSL Certificate Issues

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Test renewal process
sudo certbot renew --dry-run

# Check Nginx SSL configuration
sudo nginx -t
```

### DNS Not Resolving

```bash
# Check DNS propagation
dig coherent.yourdomain.com +short
nslookup coherent.yourdomain.com

# Flush local DNS cache (local machine)
# Mac: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Linux: sudo systemd-resolve --flush-caches
# Windows: ipconfig /flushdns

# Check Route 53 records
aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID>
```

### High CPU/Memory Usage

```bash
# Check processes
htop
ps aux --sort=-%mem | head -10

# PM2 memory limits
pm2 describe coherent-api | grep memory

# Restart high-memory process
pm2 restart coherent-api

# Consider upgrading instance type
# Update terraform.tfvars:
# ec2_instance_type = "t3.large"
# terraform apply
```

### S3 Access Issues

```bash
# Check IAM role attached to EC2
aws iam list-attached-role-policies --role-name coherent-ec2-role

# Test S3 access from EC2
aws s3 ls s3://<S3_BUCKET_NAME>/

# Upload test file
echo "test" > test.txt
aws s3 cp test.txt s3://<S3_BUCKET_NAME>/test.txt
```

---

## Disaster Recovery

### Restore from Backup

```bash
# List available backups
aws s3 ls s3://<S3_BUCKET_NAME>/backups/

# Download backup
aws s3 cp s3://<S3_BUCKET_NAME>/backups/coherent_db_20240115_020000.sql ./backup.sql

# Restore to database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup.sql
```

### Rebuild Infrastructure

```bash
# Backup current state
terraform show > terraform-state-backup.txt

# Destroy and recreate
terraform destroy
terraform apply

# Redeploy application (follow "Deploy Application" section)
```

---

## Cost Optimization

### Development Environment

```hcl
# terraform.tfvars
environment         = "dev"
ec2_instance_type   = "t3.micro"      # $7/month
db_instance_class   = "db.t3.micro"   # Free tier eligible
```

### Production Environment

```hcl
# terraform.tfvars
environment         = "prod"
ec2_instance_type   = "t3.medium"     # $30/month
db_instance_class   = "db.t3.small"   # $25/month
```

### Stop Resources When Not in Use

```bash
# Stop EC2 (saves compute cost, keeps EBS)
aws ec2 stop-instances --instance-ids <INSTANCE_ID>

# Stop RDS (automated backups continue)
aws rds stop-db-instance --db-instance-identifier coherent-db

# Start when needed
aws ec2 start-instances --instance-ids <INSTANCE_ID>
aws rds start-db-instance --db-instance-identifier coherent-db
```

---

## Security Best Practices

1. **Change Default Passwords**
   - Update `db_password` in terraform.tfvars
   - Update JWT secret in .env
   - Change default admin password

2. **Restrict SSH Access**
   - Update `ssh_allowed_cidr` to your IP only
   - Use AWS Systems Manager Session Manager instead of SSH

3. **Enable MFA**
   - Enable MFA for AWS root account
   - Enable MFA for IAM users

4. **Regular Updates**
   ```bash
   # Update system packages
   sudo apt-get update && sudo apt-get upgrade -y

   # Update Node.js dependencies
   npm audit fix
   ```

5. **Monitor Logs**
   - Check `/var/log/auth.log` for SSH attempts
   - Review CloudWatch logs regularly
   - Set up CloudWatch alarms for anomalies

---

## Support and Resources

- **Documentation**: `/infra-tf/README.md`
- **Terraform Docs**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **AWS Well-Architected**: https://aws.amazon.com/architecture/well-architected/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Let's Encrypt**: https://letsencrypt.org/docs/

---

## Appendix: Quick Reference Commands

```bash
# Infrastructure
terraform init              # Initialize Terraform
terraform plan              # Preview changes
terraform apply             # Apply changes
terraform destroy           # Destroy infrastructure
terraform output            # Show outputs

# Application
coherent-status             # Show status
coherent-logs               # View logs
coherent-update             # Update application
coherent-backup             # Manual backup

# PM2
pm2 status                  # Show process status
pm2 restart all             # Restart all processes
pm2 logs                    # View logs
pm2 monit                   # Monitor resources

# Database
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# AWS
aws ec2 describe-instances  # List EC2 instances
aws rds describe-db-instances  # List RDS instances
aws s3 ls                   # List S3 buckets
```

---

**Deployment Guide Version**: 1.0
**Last Updated**: 2025-01-17
**Platform**: Coherent PMO v11+
