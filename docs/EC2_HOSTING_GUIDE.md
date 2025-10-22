# Complete Step-by-Step Guide: Hosting Huron PMO on AWS EC2

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [Deploy Infrastructure with Terraform](#deploy-infrastructure-with-terraform)
4. [Access and Configure EC2 Server](#access-and-configure-ec2-server)
5. [Deploy PMO Application](#deploy-pmo-application)
6. [Configure Domain and DNS](#configure-domain-and-dns)
7. [Setup SSL Certificate (HTTPS)](#setup-ssl-certificate-https)
8. [Test Your Website](#test-your-website)
9. [Ongoing Maintenance](#ongoing-maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You'll Need

- ✅ AWS Account (create at https://aws.amazon.com)
- ✅ Domain name (optional but recommended)
- ✅ Computer with Terminal access (Linux/Mac/WSL)
- ✅ Credit card for AWS (minimal charges: ~$10-50/month)
- ✅ 2-3 hours for complete setup

### Install Required Tools

```bash
# 1. Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform --version

# 2. Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version

# 3. Verify installations
which terraform  # Should show: /usr/local/bin/terraform
which aws        # Should show: /usr/local/bin/aws
```

---

## AWS Account Setup

### Step 1: Create AWS Account

1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Fill in:
   - Email address
   - Password
   - AWS account name (e.g., "MyCompany")
4. Choose **Personal** account type
5. Enter payment information (required, but free tier available)
6. Verify phone number
7. Choose **Basic Support** (free)

### Step 2: Create IAM User for Terraform

**Why?** Don't use root account credentials - create a dedicated user for security.

#### Via AWS Console (Easiest):

1. **Sign in to AWS Console** → https://console.aws.amazon.com
2. **Search for "IAM"** → Click IAM service
3. **Users** → **Add User**
4. **User details:**
   - User name: `terraform-pmo`
   - Access type: **✓ Programmatic access**
5. **Permissions:**
   - Click **Attach existing policies directly**
   - Select these policies:
     - ✓ AmazonEC2FullAccess
     - ✓ AmazonRDSFullAccess
     - ✓ AmazonS3FullAccess
     - ✓ AmazonVPCFullAccess
     - ✓ IAMFullAccess
6. **Click "Next" → "Create user"**
7. **📝 IMPORTANT: Download credentials CSV** or copy:
   - Access Key ID: `AKIA...`
   - Secret Access Key: `wJalr...`

### Step 3: Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# Enter when prompted:
AWS Access Key ID [None]: AKIA...          # Paste your Access Key ID
AWS Secret Access Key [None]: wJalr...     # Paste your Secret Access Key
Default region name [None]: us-east-1      # Or your preferred region
Default output format [None]: json         # Press Enter

# Verify configuration
aws sts get-caller-identity

# Should show:
# {
#     "UserId": "AIDAJQL...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/terraform-pmo"
# }
```

---

## Deploy Infrastructure with Terraform

### Step 1: Prepare SSH Key

```bash
# Create SSH key for EC2 access
ssh-keygen -t rsa -b 4096 -f ~/.ssh/pmo-key -C "pmo-ec2-key"

# Press Enter twice (no passphrase for simplicity)

# Set proper permissions
chmod 400 ~/.ssh/pmo-key

# Display public key (you'll need this)
cat ~/.ssh/pmo-key.pub

# Copy the output (starts with ssh-rsa ...)
```

### Step 2: Configure Terraform Variables

```bash
# Navigate to infrastructure directory
cd /home/rabin/projects/pmo/infra-tf

# Create variables file
nano terraform.tfvars
```

**Paste this configuration** (replace placeholders):

```hcl
# terraform.tfvars

# =============================================================================
# GENERAL SETTINGS
# =============================================================================
aws_region   = "us-east-1"    # Options: us-east-1, us-west-2, ca-central-1
environment  = "prod"          # Options: dev, staging, prod
project_name = "pmo"           # Your project name

# =============================================================================
# SECURITY SETTINGS (REQUIRED)
# =============================================================================

# Your IP address (for SSH access)
# Find your IP: https://www.whatismyip.com/ or run: curl ifconfig.me
ssh_allowed_cidr = ["YOUR_IP_HERE/32"]   # Example: ["203.0.113.5/32"]

# EC2 SSH Public Key
# Paste the output from: cat ~/.ssh/pmo-key.pub
ec2_public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQ..."   # REPLACE THIS

# =============================================================================
# DATABASE SETTINGS
# =============================================================================

# Database master password (REQUIRED - make it strong!)
# Generate one: openssl rand -base64 32
db_password = "CHANGE_THIS_TO_STRONG_PASSWORD"   # Example: "Xk9mPq2L7nR4wTy8..."

# Database configuration
db_name     = "pmo"
db_username = "pmo_admin"

# =============================================================================
# INSTANCE SIZING (adjust based on needs)
# =============================================================================

# Development (smaller, cheaper)
# ec2_instance_type = "t3.micro"      # $7/month - 1 vCPU, 1GB RAM
# db_instance_class = "db.t3.micro"   # Free tier eligible

# Production (recommended)
ec2_instance_type = "t3.medium"     # $30/month - 2 vCPU, 4GB RAM
db_instance_class = "db.t3.micro"   # $15/month - 1 vCPU, 1GB RAM

# High traffic (if needed later)
# ec2_instance_type = "t3.large"      # $60/month - 2 vCPU, 8GB RAM
# db_instance_class = "db.t3.small"   # $25/month - 2 vCPU, 2GB RAM
```

**Save the file**: `Ctrl + O`, `Enter`, `Ctrl + X`

### Step 3: Initialize and Deploy

```bash
# Initialize Terraform (downloads AWS provider)
terraform init

# Expected output:
# Terraform has been successfully initialized!

# Validate configuration
terraform validate

# Expected output:
# Success! The configuration is valid.

# Preview what will be created
terraform plan

# You'll see a list of ~20 resources to be created:
# - VPC and networking
# - EC2 instance
# - RDS database
# - S3 bucket
# - Security groups
# - etc.

# Deploy infrastructure (this is the big step!)
terraform apply

# Review the plan
# Type: yes

# ⏳ Wait 10-15 minutes for AWS to create everything
```

### Step 4: Save Important Outputs

```bash
# After successful deployment, Terraform shows outputs
# Save these values:

terraform output -json > deployment-info.json

# Display outputs in readable format
terraform output

# Example outputs:
# api_url = "http://54.123.45.67:4000"
# db_endpoint = "pmo-db.abc123.us-east-1.rds.amazonaws.com:5432"
# ec2_public_ip = "54.123.45.67"
# s3_bucket_name = "pmo-artifacts-prod-123456789012"
# ssh_command = "ssh -i ~/.ssh/pmo-key.pem ubuntu@54.123.45.67"
# web_url = "http://54.123.45.67:5173"

# Save your EC2 IP address
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "Your EC2 IP: $EC2_IP"
echo $EC2_IP > ec2-ip.txt
```

---

## Access and Configure EC2 Server

### Step 1: Wait for EC2 Initialization

```bash
# The EC2 instance runs a setup script on first boot
# Wait 5-10 minutes before connecting

# Check if SSH is ready (run until it succeeds)
ssh -i ~/.ssh/pmo-key -o ConnectTimeout=5 ubuntu@$EC2_IP "echo 'SSH Ready!'"

# If you get "Permission denied" or "Connection refused", wait a few more minutes
```

### Step 2: Connect to EC2

```bash
# SSH into your EC2 instance
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# You should see:
# Welcome to Ubuntu 22.04.3 LTS
# ubuntu@ip-10-0-1-123:~$
```

### Step 3: Check Initialization Status

```bash
# Check if the initialization script finished
sudo tail -f /var/log/user-data.log

# Wait until you see:
# "Setup completed successfully!"
# Then press Ctrl+C to exit

# If the log doesn't exist yet, wait 2-3 more minutes
```

### Step 4: Verify Installed Software

```bash
# Check installations
node --version      # Should show: v20.x.x
npm --version       # Should show: 10.x.x
nginx -v            # Should show: nginx/1.18.x
pm2 --version       # Should show: 5.x.x
docker --version    # Should show: Docker version 24.x
aws --version       # Should show: aws-cli/2.x

# All commands should work - if any fail, wait a bit longer
```

---

## Deploy PMO Application

### Step 1: Clone Your Repository

```bash
# Navigate to application directory
cd /opt/pmo

# If directory doesn't exist, create it
sudo mkdir -p /opt/pmo
sudo chown -R ubuntu:ubuntu /opt/pmo
cd /opt/pmo

# Clone your repository
# Option A: If repo is public
git clone https://github.com/YOUR_USERNAME/pmo.git .

# Option B: If repo is private (need SSH key or token)
# First, add your SSH key to GitHub, then:
git clone git@github.com:YOUR_USERNAME/pmo.git .

# Option C: If you're testing, use the local copy
# From your local machine:
# rsync -avz -e "ssh -i ~/.ssh/pmo-key" /home/rabin/projects/pmo/ ubuntu@$EC2_IP:/opt/pmo/
```

### Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd apps/api
npm install
cd ../..

# Install Web dependencies
cd apps/web
npm install
cd ../..

# This may take 5-10 minutes
```

### Step 3: Configure Environment Variables

```bash
# Get database credentials from Terraform
DB_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier pmo-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

S3_BUCKET=$(aws s3 ls | grep pmo-artifacts | awk '{print $3}')

# Create .env file for API
cat > apps/api/.env <<EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=pmo
DB_USER=pmo_admin
DB_PASSWORD=YOUR_DB_PASSWORD_HERE  # From terraform.tfvars

# Application
NODE_ENV=production
PORT=4000
API_URL=http://localhost:4000

# JWT Secret (generate new one)
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=86400

# AWS S3
AWS_REGION=us-east-1
S3_BUCKET=$S3_BUCKET
S3_ACCESS_KEY_ID=  # Empty - using IAM role
S3_SECRET_ACCESS_KEY=  # Empty - using IAM role

# Redis (using Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO (using Docker)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
EOF

# Replace YOUR_DB_PASSWORD_HERE with actual password
nano apps/api/.env
# Update the DB_PASSWORD line, then save (Ctrl+O, Enter, Ctrl+X)

# Create .env file for Web
cat > apps/web/.env <<EOF
VITE_API_URL=http://$EC2_IP:4000
VITE_API_BASE_URL=http://$EC2_IP:4000
EOF
```

### Step 4: Build Applications

```bash
# Build API
cd /opt/pmo/apps/api
npm run build

# Build Web (production build)
cd /opt/pmo/apps/web
npm run build

# Check build outputs
ls -la /opt/pmo/apps/api/dist
ls -la /opt/pmo/apps/web/dist

# Both should have files
```

### Step 5: Initialize Database

```bash
# Start Docker services (PostgreSQL, Redis, MinIO)
cd /opt/pmo
docker-compose up -d

# Wait 30 seconds for PostgreSQL to start
sleep 30

# Import database schema
./tools/db-import.sh

# You should see:
# ✅ All DDL files imported successfully
# ✅ Schema validation completed successfully
```

### Step 6: Start Application with PM2

```bash
# Create PM2 ecosystem file
cat > /opt/pmo/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'pmo-api',
      cwd: '/opt/pmo/apps/api',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    },
    {
      name: 'pmo-web',
      cwd: '/opt/pmo/apps/web',
      script: 'npm',
      args: 'run preview -- --port 5173 --host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Start applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command it displays (starts with sudo)

# Check status
pm2 status

# Should show:
# ┌─────┬──────────┬─────────────┬─────────┬─────────┬──────────┐
# │ id  │ name     │ namespace   │ version │ mode    │ pid      │
# ├─────┼──────────┼─────────────┼─────────┼─────────┼──────────┤
# │ 0   │ pmo-api  │ default     │ N/A     │ fork    │ 12345    │
# │ 1   │ pmo-web  │ default     │ N/A     │ fork    │ 12346    │
# └─────┴──────────┴─────────────┴─────────┴─────────┴──────────┘
```

### Step 7: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/pmo

# Paste this configuration:
```

```nginx
# HTTP Server
server {
    listen 80;
    listen [::]:80;
    server_name _;  # Will be replaced with your domain later

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client max body size (for file uploads)
    client_max_body_size 100M;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Web application
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

```bash
# Save and exit (Ctrl+O, Enter, Ctrl+X)

# Enable the site
sudo ln -s /etc/nginx/sites-available/pmo /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Should show:
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx
sudo systemctl reload nginx

# Check Nginx status
sudo systemctl status nginx

# Should show: active (running)
```

### Step 8: Test Application

```bash
# Test API (from EC2)
curl http://localhost:4000/api/v1/auth/login

# Test Web (from EC2)
curl http://localhost:5173

# Test through Nginx (from EC2)
curl http://localhost/api/v1/auth/login
curl http://localhost/

# All should return HTML/JSON responses

# Get your EC2 IP again
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Your application is accessible at: http://$EC2_IP"
```

### Step 9: Test from Your Computer

```bash
# From your local machine:
# Replace $EC2_IP with the actual IP from ec2-ip.txt

# Test landing page
curl http://$EC2_IP/

# Test API
curl http://$EC2_IP/api/v1/auth/login

# Open in browser
# http://$EC2_IP
```

**You should now see the Huron PMO landing page! 🎉**

---

## Configure Domain and DNS

### Option 1: AWS Route 53 (Recommended)

#### Step 1: Purchase or Transfer Domain

```bash
# Your domain: cohuron.com
# You can manage this through Route 53 or keep it at your current registrar

# Option A: Transfer to Route 53 (optional)
# AWS Console → Route 53 → Registered Domains → Transfer Domain
# Follow the transfer process

# Option B: Keep at current registrar (GoDaddy/Namecheap/etc.)
# You'll just update nameservers (Step 3)
```

#### Step 2: Create Hosted Zone

```bash
# Via AWS Console:
# 1. AWS Console → Route 53 → Hosted Zones
# 2. Click "Create hosted zone"
# 3. Domain name: cohuron.com
# 4. Type: Public hosted zone
# 5. Click "Create"

# Via AWS CLI:
aws route53 create-hosted-zone \
  --name cohuron.com \
  --caller-reference $(date +%s)

# Save the Hosted Zone ID (looks like: Z0123456789ABC)
```

#### Step 3: Update Domain Nameservers (if using external registrar)

```bash
# Get Route 53 nameservers
aws route53 get-hosted-zone --id YOUR_HOSTED_ZONE_ID

# You'll see 4 nameservers like:
# ns-1234.awsdns-12.org
# ns-5678.awsdns-34.com
# ns-9012.awsdns-56.net
# ns-3456.awsdns-78.co.uk

# Go to your domain registrar (GoDaddy, Namecheap, etc.)
# Update nameservers to the 4 Route 53 nameservers
# Wait 24-48 hours for propagation (usually much faster)
```

#### Step 4: Create A Record

```bash
# Get your EC2 IP
cd /home/rabin/projects/pmo/infra-tf
EC2_IP=$(terraform output -raw ec2_public_ip)
echo $EC2_IP

# Via AWS Console:
# 1. Route 53 → Hosted Zones → cohuron.com
# 2. Click "Create record"
# 3. Record name: app (creates app.cohuron.com)
# 4. Record type: A
# 5. Value: YOUR_EC2_IP (paste the IP from above)
# 6. TTL: 300
# 7. Click "Create records"

# Via AWS CLI (replace HOSTED_ZONE_ID with your actual zone ID):
HOSTED_ZONE_ID="YOUR_ZONE_ID"  # Get from Route 53 console
EC2_IP=$(terraform output -raw ec2_public_ip)

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"CREATE\",
      \"ResourceRecordSet\": {
        \"Name\": \"app.cohuron.com\",
        \"Type\": \"A\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$EC2_IP\"}]
      }
    }]
  }"
```

#### Step 5: Verify DNS

```bash
# Wait 5-10 minutes, then test
dig app.cohuron.com +short

# Should return: YOUR_EC2_IP

# Test in browser
# http://app.cohuron.com
```

### Option 2: Cloudflare/GoDaddy/Namecheap DNS

#### For Cloudflare:
1. Add site to Cloudflare
2. Update nameservers at registrar
3. Add A record: `app` → `YOUR_EC2_IP`
4. Set proxy status to **DNS Only** (grey cloud)

#### For GoDaddy/Namecheap:
1. Log into your registrar
2. Find DNS settings
3. Add A record: `app` → `YOUR_EC2_IP`
4. Wait 5-60 minutes for propagation

---

## Setup SSL Certificate (HTTPS)

### Step 1: Update Nginx Configuration

```bash
# SSH into EC2
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Update Nginx with your domain
sudo nano /etc/nginx/sites-available/pmo

# Change this line:
# FROM: server_name _;
# TO:   server_name app.cohuron.com;

# Save and test
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2: Install Certbot

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

### Step 3: Obtain SSL Certificate

```bash
# Your domain configuration
DOMAIN="app.cohuron.com"
EMAIL="admin@cohuron.com"  # Use your actual email

# Obtain certificate (automatic Nginx configuration)
sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect

# This will:
# 1. Obtain certificate from Let's Encrypt
# 2. Update Nginx configuration
# 3. Setup auto-renewal
# 4. Redirect HTTP to HTTPS

# Expected output:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem
# Key is saved at: /etc/letsencrypt/live/app.yourdomain.com/privkey.pem
# Congratulations! You have successfully enabled HTTPS
```

### Step 4: Verify HTTPS

```bash
# Test HTTPS
curl https://app.yourdomain.com/api/v1/auth/login

# Check certificate
sudo certbot certificates

# Setup auto-renewal (already done, but verify)
sudo systemctl status certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### Step 5: Update Web Environment

```bash
# Update Web app to use HTTPS
sudo nano /opt/pmo/apps/web/.env

# Change:
# FROM: VITE_API_URL=http://...
# TO:   VITE_API_URL=https://app.cohuron.com

# Rebuild web app
cd /opt/pmo/apps/web
npm run build

# Restart PM2
pm2 restart pmo-web
```

---

## Test Your Website

### Checklist

```bash
# ✅ Landing Page
https://app.cohuron.com

# ✅ Signup Page
https://app.cohuron.com/signup

# ✅ Login Page
https://app.cohuron.com/login

# ✅ API Health
https://app.cohuron.com/api/v1/auth/login

# ✅ SSL Certificate (should show padlock in browser)
```

### Create Test Account

1. Open https://app.cohuron.com
2. Click "Get Started" or "Sign Up"
3. Fill out the signup form
4. Select modules in onboarding
5. Access your dashboard!

---

## Ongoing Maintenance

### Daily Commands

```bash
# SSH into EC2
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Check application status
pm2 status

# View logs
pm2 logs pmo-api --lines 50
pm2 logs pmo-web --lines 50

# Check system resources
htop
df -h
free -h

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
```

### Update Application

```bash
# SSH into EC2
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Pull latest code
cd /opt/pmo
git pull origin main

# Install dependencies
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..

# Rebuild
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# Restart services
pm2 restart all

# Check status
pm2 status
```

### Backup Database

```bash
# Manual backup
PGPASSWORD=YOUR_DB_PASSWORD pg_dump \
  -h YOUR_DB_ENDPOINT \
  -U pmo_admin \
  -d pmo \
  -F c \
  -f /tmp/pmo-backup-$(date +%Y%m%d).dump

# Upload to S3
aws s3 cp /tmp/pmo-backup-*.dump s3://YOUR_S3_BUCKET/backups/

# List backups
aws s3 ls s3://YOUR_S3_BUCKET/backups/
```

### Monitor Costs

```bash
# Check AWS costs (from local machine)
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost

# Or check AWS Console → Billing Dashboard
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs pmo-api --err --lines 100
pm2 logs pmo-web --err --lines 100

# Check database connection
PGPASSWORD=YOUR_DB_PASSWORD psql \
  -h YOUR_DB_ENDPOINT \
  -U pmo_admin \
  -d pmo \
  -c "SELECT 1;"

# Restart everything
pm2 restart all
sudo systemctl restart nginx
```

### Can't Access Website

```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check security group (from local machine)
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=pmo-app-sg" \
  --query 'SecurityGroups[0].IpPermissions'

# Ensure ports 80 and 443 are open to 0.0.0.0/0
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx SSL config
sudo nano /etc/nginx/sites-available/pmo

# Restart Nginx
sudo systemctl restart nginx
```

### High Memory Usage

```bash
# Check memory
free -h

# Restart services
pm2 restart all

# If persistent, upgrade instance
# Update terraform.tfvars:
# ec2_instance_type = "t3.large"
terraform apply
```

---

## Cost Estimate

### Monthly Costs

| Resource | Type | Monthly Cost |
|----------|------|--------------|
| EC2 | t3.medium | $30 |
| RDS | db.t3.micro | $15 (Free tier: $0) |
| EBS | 30GB gp3 | $3 |
| S3 | Storage + requests | $1-5 |
| Data Transfer | Outbound | $5-20 |
| Elastic IP | While attached | $0 |
| Route 53 | Hosted zone | $0.50 |
| **Total** | | **$50-75/month** |

### Ways to Reduce Costs

1. **Use free tier** (first 12 months)
2. **Stop instances** when not needed (dev/staging)
3. **Reserved instances** (save 30-40%)
4. **Smaller instances** (t3.micro for testing)

---

## Next Steps

### Recommended Actions

1. ✅ Setup monitoring (CloudWatch)
2. ✅ Configure automated backups
3. ✅ Setup email notifications (alerts)
4. ✅ Create additional admin users
5. ✅ Configure SMTP for email (replace MailHog)
6. ✅ Setup CI/CD pipeline (GitHub Actions)
7. ✅ Enable WAF (Web Application Firewall)
8. ✅ Configure CloudFront (CDN)

### Support Resources

- **AWS Documentation**: https://docs.aws.amazon.com
- **Terraform Docs**: https://registry.terraform.io/providers/hashicorp/aws
- **Let's Encrypt**: https://letsencrypt.org/docs
- **PMO Documentation**: `/home/rabin/projects/pmo/README.md`

---

## Summary

🎉 **Congratulations!** Your Huron PMO platform is now live on AWS!

**Your URLs:**
- **Landing Page**: https://app.cohuron.com
- **API**: https://app.cohuron.com/api/v1
- **Signup**: https://app.cohuron.com/signup
- **Alternative**: You can also use https://pmo.cohuron.com if you prefer

**Important Files:**
- SSH Key: `~/.ssh/pmo-key`
- Terraform State: `/home/rabin/projects/pmo/infra-tf/terraform.tfstate`
- EC2 IP: Saved in `ec2-ip.txt`

**Quick Commands:**
```bash
# SSH to server
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Check status
pm2 status

# View logs
pm2 logs

# Update code
cd /opt/pmo && git pull && pm2 restart all
```

---

**Version**: 1.0
**Last Updated**: 2025-10-21
**Tested On**: Ubuntu 22.04 LTS, Terraform 1.6.6, AWS CLI 2.x
