# AWS Profile Setup & Deployment Guide

Complete guide for setting up AWS credentials and deploying the Huron PMO platform to **cohuron.com** with a single `terraform apply` command.

---

## Prerequisites

- AWS Account with administrative access
- AWS CLI installed (`aws --version` should work)
- Domain registered (cohuron.com)
- SSH key pair generated
- Terraform installed (>= 1.0)

---

## Step 1: Generate SSH Key Pair

```bash
# Generate new SSH key for EC2 access
ssh-keygen -t rsa -b 4096 -f ~/.ssh/pmo-key -C "pmo@cohuron.com"

# This creates two files:
# ~/.ssh/pmo-key        (private key - keep secure)
# ~/.ssh/pmo-key.pub    (public key - will be added to EC2)

# Display public key (you'll need this for terraform.tfvars)
cat ~/.ssh/pmo-key.pub
```

---

## Step 2: Configure AWS CLI Profile

### Option A: Using AWS Access Keys (Recommended for Development)

```bash
# Configure AWS profile named "cohuron"
aws configure --profile cohuron

# You'll be prompted for:
# AWS Access Key ID:     [Enter your access key]
# AWS Secret Access Key: [Enter your secret key]
# Default region name:   us-east-1
# Default output format:  json
```

**Where to get AWS credentials:**
1. Log in to AWS Console → IAM → Users → Your User → Security Credentials
2. Click "Create access key"
3. Download credentials (you won't be able to see secret key again!)

### Option B: Using AWS SSO (Recommended for Organizations)

```bash
# Configure SSO
aws configure sso --profile cohuron

# Follow the prompts:
# SSO start URL: [Your organization's SSO URL]
# SSO Region: us-east-1
# CLI default region: us-east-1
# CLI default output format: json
```

### Verify Profile Configuration

```bash
# Test the profile works
aws sts get-caller-identity --profile cohuron

# Should output:
# {
#     "UserId": "...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-user"
# }
```

---

## Step 3: Configure Terraform Variables

```bash
# Navigate to Terraform directory
cd /home/rabin/projects/pmo/infra-tf

# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars  # or use your preferred editor
```

**Update these REQUIRED values in terraform.tfvars:**

```hcl
# 1. SSH Public Key (paste output from: cat ~/.ssh/pmo-key.pub)
ec2_public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQD... pmo@cohuron.com"

# 2. Database Password (generate with: openssl rand -base64 32)
db_password = "YOUR_STRONG_PASSWORD_HERE"

# 3. SSH Access (restrict to your IP for security)
# Find your IP: curl ifconfig.me
ssh_allowed_cidr = ["YOUR_IP/32"]  # e.g., ["203.0.113.42/32"]

# 4. GitHub Repository URL (optional - for automatic code deployment)
github_repo_url = "https://github.com/yourusername/pmo.git"  # or leave empty ""
```

**Review these OPTIONAL values:**

```hcl
# AWS Configuration (usually fine as defaults)
aws_profile = "cohuron"
aws_region = "us-east-1"
environment = "prod"

# Project Configuration
project_name = "pmo"
domain_name = "cohuron.com"
app_subdomain = "app"  # Creates app.cohuron.com
create_dns_records = true

# Cost Optimization
ec2_instance_type = "t3.medium"   # ~$30/month (change to t3.large for production)
db_instance_class = "db.t3.micro" # ~$15/month (change to db.t3.small for production)
```

---

## Step 4: Deploy Infrastructure

### Initialize Terraform

```bash
cd /home/rabin/projects/pmo/infra-tf

# Initialize Terraform (downloads providers)
terraform init

# Expected output:
# Initializing modules...
# Initializing the backend...
# Initializing provider plugins...
# Terraform has been successfully initialized!
```

### Review Deployment Plan

```bash
# See what will be created
terraform plan

# This shows:
# - VPC and networking resources
# - EC2 instance configuration
# - RDS database setup
# - S3 bucket creation
# - Route 53 DNS records
# - Security groups and IAM roles
```

### Deploy Everything

```bash
# Deploy all infrastructure (will take 10-15 minutes)
terraform apply

# Review the plan and type: yes

# Expected timeline:
# [0-2 min]  Creating VPC, subnets, security groups
# [2-5 min]  Creating S3 bucket
# [5-10 min] Creating RDS database
# [10-12 min] Creating EC2 instance
# [12-15 min] Installing software and deploying application
```

### Deployment Output

After successful deployment, Terraform will output:

```
Outputs:

vpc_id = "vpc-0123456789abcdef0"
ec2_public_ip = "54.123.456.78"
db_endpoint = "pmo-db.abc123.us-east-1.rds.amazonaws.com:5432"
s3_bucket_name = "pmo-artifacts-abc123"

hosted_zone_id = "Z1234567890ABC"
name_servers = [
  "ns-123.awsdns-45.com",
  "ns-678.awsdns-90.net",
  "ns-1234.awsdns-56.org",
  "ns-5678.awsdns-12.co.uk"
]

app_domain = "app.cohuron.com"
app_url_https = "https://app.cohuron.com"
ssh_command = "ssh -i ~/.ssh/pmo-key ubuntu@54.123.456.78"

next_steps = <<-EOT
============================================================================
🎉 Huron PMO Deployment Complete!
============================================================================

1️⃣  UPDATE NAMESERVERS at your domain registrar
2️⃣  WAIT FOR DNS PROPAGATION (5-60 minutes)
3️⃣  SETUP SSL: ssh and run /root/setup-ssl.sh
4️⃣  ACCESS: https://app.cohuron.com
============================================================================
EOT
```

---

## Step 5: Configure DNS at Your Registrar

**You MUST update nameservers at your domain registrar for cohuron.com**

1. Go to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)
2. Find DNS settings for **cohuron.com**
3. Replace existing nameservers with the 4 AWS nameservers from Terraform output
4. Save changes

**Example (GoDaddy):**
```
1. Login → My Products → Domains → cohuron.com → Manage DNS
2. Click "Change Nameservers" → "Use custom nameservers"
3. Enter the 4 AWS nameservers:
   - ns-123.awsdns-45.com
   - ns-678.awsdns-90.net
   - ns-1234.awsdns-56.org
   - ns-5678.awsdns-12.co.uk
4. Save
```

---

## Step 6: Wait for DNS Propagation

DNS changes can take 5-60 minutes to propagate globally.

### Check DNS Status

```bash
# Check if DNS has propagated
dig app.cohuron.com +short

# Should return your EC2 IP address:
# 54.123.456.78

# Alternative check
nslookup app.cohuron.com

# Or use online tool: https://dnschecker.org
```

---

## Step 7: Setup SSL Certificate

Once DNS has propagated:

```bash
# SSH into your EC2 instance
ssh -i ~/.ssh/pmo-key ubuntu@54.123.456.78

# Run the SSL setup script
sudo /root/setup-ssl.sh

# This will:
# - Obtain Let's Encrypt certificate for app.cohuron.com
# - Configure Nginx for HTTPS
# - Enable automatic certificate renewal
# - Update application to use HTTPS URLs
```

**Expected output:**
```
Setting up SSL certificate for app.cohuron.com...
Obtaining certificate from Let's Encrypt...
Successfully received certificate!
Certificate is saved at: /etc/letsencrypt/live/app.cohuron.com/fullchain.pem
Deploying certificate to Nginx...
SSL setup complete!
```

---

## Step 8: Access Your Application

### Public URLs

- **Application**: https://app.cohuron.com
- **Signup**: https://app.cohuron.com/signup
- **Login**: https://app.cohuron.com/login
- **API Docs**: https://app.cohuron.com/docs

### Test Account

Default test account (created by database seed):
```
Email: james.miller@huronhome.ca
Password: password123
```

### Admin Access

```bash
# SSH into server
ssh -i ~/.ssh/pmo-key ubuntu@54.123.456.78

# Check service status
pmo-status

# View logs
pmo-logs        # All services
pmo-logs api    # API only
pmo-logs web    # Web only

# Restart services
pmo-restart

# Manual database backup
pmo-backup
```

---

## Monitoring & Maintenance

### Useful Commands on EC2

```bash
# Check all service status
pmo-status

# View PM2 processes
pm2 status
pm2 logs

# View Docker services
docker-compose ps

# Check Nginx status
sudo systemctl status nginx

# View deployment info
cat /opt/pmo/DEPLOYMENT_INFO.txt

# Check disk usage
df -h

# Monitor system resources
htop
```

### Automated Backups

Database backups run automatically every day at 2 AM:
- Stored in S3: `s3://pmo-artifacts-abc123/backups/`
- Local copies kept for 7 days
- View backup logs: `sudo cat /var/log/pmo-backup.log`

### SSL Certificate Renewal

Let's Encrypt certificates auto-renew via cron:
```bash
# Check renewal status
sudo certbot renew --dry-run

# Force renewal (if needed)
sudo certbot renew --force-renewal
```

---

## Cost Breakdown

**Monthly Costs (us-east-1):**

| Service | Type | Cost |
|---------|------|------|
| EC2 Instance | t3.medium | ~$30 |
| RDS Database | db.t3.micro | ~$15 |
| EBS Storage | 30 GB | ~$3 |
| Data Transfer | Typical usage | ~$5-10 |
| S3 Storage | Artifacts | ~$1-5 |
| Route 53 | Hosted zone | ~$0.50 |
| **TOTAL** | | **~$55-65/month** |

**Cost Optimization Tips:**
- Use `t3.small` EC2 (~$15/month) for lighter workloads
- Enable RDS auto-pause for development environments
- Use AWS Budgets to set spending alerts

---

## Troubleshooting

### Issue: Terraform Apply Fails

```bash
# Check AWS credentials
aws sts get-caller-identity --profile cohuron

# Validate Terraform configuration
terraform validate

# See detailed error logs
terraform apply -no-color 2>&1 | tee terraform.log
```

### Issue: Can't SSH to EC2

```bash
# Check security group allows your IP
# Update terraform.tfvars:
ssh_allowed_cidr = ["YOUR_CURRENT_IP/32"]

# Apply changes
terraform apply

# Verify key permissions
chmod 400 ~/.ssh/pmo-key
```

### Issue: App Not Accessible

```bash
# Check DNS
dig app.cohuron.com +short

# SSH and check services
ssh -i ~/.ssh/pmo-key ubuntu@54.123.456.78
pmo-status
pmo-logs

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Issue: SSL Setup Fails

```bash
# DNS must be propagated first
dig app.cohuron.com +short  # Should show EC2 IP

# Check Nginx config
sudo nginx -t

# Try SSL setup again
sudo /root/setup-ssl.sh

# Manual troubleshooting
sudo certbot --nginx -d app.cohuron.com --email admin@cohuron.com
```

---

## Cleanup / Destroy Infrastructure

**WARNING: This will delete EVERYTHING including databases!**

```bash
# Backup data first!
ssh -i ~/.ssh/pmo-key ubuntu@54.123.456.78
pmo-backup

# Destroy all AWS resources
cd /home/rabin/projects/pmo/infra-tf
terraform destroy

# Review what will be deleted and type: yes

# Revert nameservers at your domain registrar back to original values
```

---

## Security Best Practices

✅ **Implemented:**
- Encrypted EBS volumes
- Database in private subnets
- SSL/TLS encryption (Let's Encrypt)
- Security groups with minimal access
- IAM roles with least privilege
- Automated backups with 7-day retention

⚠️ **Additional Hardening (Production):**
1. Enable MFA for AWS account
2. Restrict SSH to specific IP: `ssh_allowed_cidr = ["YOUR_IP/32"]`
3. Use AWS Secrets Manager for database passwords
4. Enable CloudWatch monitoring and alarms
5. Configure WAF for web application firewall
6. Enable VPC Flow Logs
7. Set up AWS Config for compliance
8. Use separate AWS accounts for dev/staging/prod

---

## Next Steps

1. ✅ Deploy infrastructure with `terraform apply`
2. ✅ Update domain nameservers
3. ✅ Wait for DNS propagation
4. ✅ Setup SSL certificate
5. ✅ Access application at https://app.cohuron.com
6. 📝 Create admin accounts for your team
7. 📝 Configure application settings
8. 📝 Import your data
9. 📝 Set up monitoring and alerts
10. 📝 Document runbooks for your team

---

## Support & Documentation

- **Main README**: `/home/rabin/projects/pmo/README.md`
- **Database Schema**: `/home/rabin/projects/pmo/db/README.md`
- **API Documentation**: `https://app.cohuron.com/docs`
- **Terraform Docs**: `/home/rabin/projects/pmo/infra-tf/README.md`

---

## Quick Reference

```bash
# Deploy
terraform apply

# Check status
pmo-status

# View logs
pmo-logs

# Restart
pmo-restart

# Backup
pmo-backup

# Destroy
terraform destroy
```

**Default Test Account:**
- Email: `james.miller@huronhome.ca`
- Password: `password123`

**URLs:**
- App: https://app.cohuron.com
- API: https://app.cohuron.com/docs
- SSH: `ssh -i ~/.ssh/pmo-key ubuntu@<ec2-ip>`
