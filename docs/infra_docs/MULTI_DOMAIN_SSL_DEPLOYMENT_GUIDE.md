# Multi-Domain SSL Deployment Guide

**Version:** 1.0
**Last Updated:** 2025-10-27
**Domains:** cohuron.com, rabindrakharel.com
**Infrastructure:** AWS EC2, nginx, Let's Encrypt, Lambda

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [DNS Configuration](#dns-configuration)
5. [Deployment Steps](#deployment-steps)
6. [SSL Certificate Setup](#ssl-certificate-setup)
7. [Testing](#testing)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers the deployment of two websites on a single EC2 instance:

1. **cohuron.com** - PMO Platform (reverse proxy to API + Web apps)
2. **rabindrakharel.com** - Static documentation site

Both domains are secured with Let's Encrypt SSL certificates, automatically renewed via Lambda.

### Key Features

- **Single EC2 Server:** Hosts both domains
- **nginx Reverse Proxy:** Routes traffic based on domain
- **Let's Encrypt SSL:** Free, auto-renewing SSL certificates
- **Lambda Automation:** Monthly certificate renewal via AWS Lambda
- **Infrastructure as Code:** Fully automated with Terraform

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  DNS Resolution      │
              │  - cohuron.com       │
              │  - rabindrakharel.com│
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  EC2 Instance        │
              │  100.28.36.248       │
              │                      │
              │  ┌────────────────┐ │
              │  │  nginx         │ │
              │  │  Port 80/443   │ │
              │  └────────┬───────┘ │
              │           │          │
              │  ┌────────┴─────────┐│
              │  │                  ││
              │  ▼                  ▼│
              │  cohuron.com    rabindrakharel.com
              │  │                  ││
              │  ├─► API (4000)     └─► /var/www/rabindrakharel.com
              │  └─► Web (5173)       (static files)
              └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SSL Certificate Management                                      │
│                                                                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  EventBridge │────►│    Lambda    │────►│     SSM      │    │
│  │  (Monthly)   │     │  (Renewal)   │     │  (Run Cmd)   │    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘    │
│                                                     │             │
│                                                     ▼             │
│                                              ┌──────────────┐    │
│                                              │  EC2 Server  │    │
│                                              │  (certbot)   │    │
│                                              └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Local Development Machine

- AWS CLI configured with `cohuron` profile
- Terraform >= 1.0
- SSH key pair (`~/.ssh/id_ed25519`)
- Git repository access

### AWS Resources (Managed by Terraform)

- EC2 instance (t3.medium)
- VPC and Security Groups
- IAM roles and policies
- S3 buckets
- Lambda function
- EventBridge rule

### Domain Management

- **cohuron.com** - Managed by your DNS provider
- **rabindrakharel.com** - Managed by DreamHost

---

## DNS Configuration

### Step 1: Point Domains to EC2

Both domains need to point to the EC2 instance's public IP.

**EC2 Public IP:** Get from Terraform output:
```bash
cd /home/rabin/projects/pmo/infra-tf
terraform output ec2_public_ip
```

### Step 2: Configure DNS Records

#### For cohuron.com (Your DNS Provider)

Add the following DNS records:

```
Type    Name    Value                   TTL
A       @       <EC2_PUBLIC_IP>         300
A       www     <EC2_PUBLIC_IP>         300
```

#### For rabindrakharel.com (DreamHost)

1. Log in to DreamHost panel
2. Go to **Manage Domains** → **DNS**
3. Add/Update DNS records:

```
Type    Name    Value                   TTL
A       @       <EC2_PUBLIC_IP>         300
A       www     <EC2_PUBLIC_IP>         300
```

### Step 3: Verify DNS Propagation

```bash
# Check cohuron.com
dig cohuron.com +short
dig www.cohuron.com +short

# Check rabindrakharel.com
dig rabindrakharel.com +short
dig www.rabindrakharel.com +short
```

All should return your EC2 public IP. DNS propagation can take 5-60 minutes.

---

## Deployment Steps

### Step 1: Deploy Infrastructure with Terraform

```bash
cd /home/rabin/projects/pmo/infra-tf

# Initialize Terraform (if not already done)
terraform init

# Review changes
terraform plan

# Deploy infrastructure
terraform apply

# Note the outputs, especially:
# - ec2_public_ip
# - lambda_ssl_renewal_function
# - ssh_command
```

### Step 2: SSH into EC2 Instance

```bash
# Get SSH command from Terraform output
terraform output ssh_command

# Or manually
ssh -i ~/.ssh/id_ed25519 ubuntu@<EC2_PUBLIC_IP>
```

### Step 3: Clone Repository on EC2

```bash
# On EC2 instance
sudo mkdir -p /opt/coherent
sudo chown ubuntu:ubuntu /opt/coherent
cd /opt/coherent

# Clone repository (or copy files via rsync)
git clone <your-repo-url> pmo

# Or sync from local machine:
# rsync -avz /home/rabin/projects/pmo/ ubuntu@<EC2_PUBLIC_IP>:/opt/coherent/pmo/
```

### Step 4: Set Up Static Website for rabindrakharel.com

```bash
# On EC2 instance
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-static-site.sh
```

This creates:
- `/var/www/rabindrakharel.com` (web root)
- `/opt/coherent/rabindrakharel.com` (content repository)
- Default index.html and error pages
- Deployment script

### Step 5: Add Content to rabindrakharel.com

```bash
# On local machine, prepare content
mkdir -p /home/rabin/projects/rabindrakharel.com
cd /home/rabin/projects/rabindrakharel.com

# Add your README files and documentation
echo "# Welcome" > README.md
echo "Documentation here..." > docs.md

# Deploy content to EC2
rsync -avz ./ ubuntu@<EC2_PUBLIC_IP>:/opt/coherent/rabindrakharel.com/

# On EC2, deploy to web root
ssh ubuntu@<EC2_PUBLIC_IP>
sudo /usr/local/bin/deploy-rabindrakharel
```

---

## SSL Certificate Setup

### Step 1: Verify DNS is Propagated

**IMPORTANT:** DNS must be fully propagated before running SSL setup!

```bash
# On EC2 instance
dig cohuron.com +short
dig rabindrakharel.com +short

# Both should return the EC2 public IP
```

### Step 2: Run SSL Setup Script

```bash
# On EC2 instance
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh
```

This script will:
1. Install certbot
2. Create webroot directories
3. Deploy temporary nginx configs
4. Obtain SSL certificates for both domains
5. Deploy production nginx configs with SSL
6. Configure automatic renewal
7. Create manual renewal script

### Step 3: Verify SSL Certificates

```bash
# On EC2 instance
sudo certbot certificates

# Should show certificates for:
# - cohuron.com (with www.cohuron.com)
# - rabindrakharel.com (with www.rabindrakharel.com)
```

### Step 4: Test HTTPS Access

```bash
# From local machine
curl -I https://cohuron.com
curl -I https://rabindrakharel.com

# Both should return HTTP/2 200 with SSL
```

---

## Testing

### Test cohuron.com (PMO Platform)

```bash
# Test homepage
curl https://cohuron.com

# Test API
curl https://cohuron.com/api/health

# Test in browser
open https://cohuron.com
```

### Test rabindrakharel.com (Static Site)

```bash
# Test homepage
curl https://rabindrakharel.com

# Test README
curl https://rabindrakharel.com/README.md

# Test in browser
open https://rabindrakharel.com
```

### Test SSL Grades

```bash
# Check SSL configuration
ssllabs.com/ssltest/analyze.html?d=cohuron.com
ssllabs.com/ssltest/analyze.html?d=rabindrakharel.com
```

### Test Lambda SSL Renewal

```bash
# From local machine with AWS CLI
aws lambda invoke \
  --profile cohuron \
  --function-name cohuron-ssl-renewal \
  --payload '{}' \
  response.json

cat response.json

# Check Lambda logs
aws logs tail /aws/lambda/cohuron-ssl-renewal --follow --profile cohuron
```

---

## Maintenance

### Manual SSL Renewal

```bash
# SSH into EC2
ssh -i ~/.ssh/id_ed25519 ubuntu@<EC2_PUBLIC_IP>

# Run renewal script
sudo /usr/local/bin/renew-ssl-certificates
```

### Update rabindrakharel.com Content

```bash
# On local machine
cd /home/rabin/projects/rabindrakharel.com

# Make changes to your files
echo "Updated content" > new-file.md

# Deploy to EC2
rsync -avz ./ ubuntu@<EC2_PUBLIC_IP>:/opt/coherent/rabindrakharel.com/

# On EC2, run deployment
ssh ubuntu@<EC2_PUBLIC_IP> sudo /usr/local/bin/deploy-rabindrakharel
```

### Check Certificate Expiry

```bash
# On EC2 instance
sudo certbot certificates

# Or via SSL check
echo | openssl s_client -servername cohuron.com -connect cohuron.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Monitor Lambda Executions

```bash
# View recent Lambda invocations
aws lambda list-functions --profile cohuron | grep ssl-renewal

# Check CloudWatch logs
aws logs tail /aws/lambda/cohuron-ssl-renewal --follow --profile cohuron

# View EventBridge rule
aws events list-rules --name-prefix cohuron-ssl-renewal --profile cohuron
```

### Update nginx Configurations

```bash
# If you need to update nginx configs
# Edit on local machine:
vim /home/rabin/projects/pmo/infra-tf/nginx-configs/cohuron.com.conf

# Deploy to EC2
rsync -avz /home/rabin/projects/pmo/infra-tf/nginx-configs/ \
  ubuntu@<EC2_PUBLIC_IP>:/opt/coherent/pmo/infra-tf/nginx-configs/

# On EC2, copy to nginx
ssh ubuntu@<EC2_PUBLIC_IP>
sudo cp /opt/coherent/pmo/infra-tf/nginx-configs/*.conf /etc/nginx/sites-available/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Troubleshooting

### Issue: DNS Not Resolving

**Symptoms:** `dig` doesn't return EC2 IP

**Solution:**
1. Verify DNS records at your DNS provider
2. Wait for propagation (up to 60 minutes)
3. Clear local DNS cache: `sudo systemd-resolve --flush-caches`

### Issue: SSL Certificate Acquisition Failed

**Symptoms:** certbot fails with "Connection refused" or "Failed authorization"

**Solution:**
1. Verify DNS is fully propagated
2. Check nginx is running: `sudo systemctl status nginx`
3. Verify port 80 is open: `sudo netstat -tlnp | grep :80`
4. Check security group allows port 80 inbound
5. Review certbot logs: `sudo journalctl -u certbot`

### Issue: nginx Configuration Error

**Symptoms:** `nginx -t` fails

**Solution:**
```bash
# Check nginx config
sudo nginx -t

# Review error logs
sudo tail -f /var/log/nginx/error.log

# Validate config files
sudo nginx -T | less
```

### Issue: Lambda Cannot Connect to EC2

**Symptoms:** Lambda execution fails with SSM errors

**Solution:**
1. Verify EC2 has SSM agent running: `sudo systemctl status amazon-ssm-agent`
2. Check IAM role has SSM permissions
3. Verify Lambda has correct EC2 instance ID in environment variables
4. Check security group allows Lambda to reach EC2

### Issue: Website Shows 502 Bad Gateway

**Symptoms:** nginx returns 502 error

**Solution:**
```bash
# Check if backend services are running
sudo systemctl status nginx

# For cohuron.com, check PM2
pm2 status

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Mixed Content (HTTP/HTTPS)

**Symptoms:** Browser shows "Not Secure" despite having SSL

**Solution:**
1. Verify all resources load via HTTPS
2. Update application config to use HTTPS URLs
3. Check for hardcoded HTTP URLs in code
4. Enable HSTS headers (already in nginx config)

---

## Automated Deployment Script

For convenience, here's a complete deployment script:

```bash
#!/bin/bash
# Complete deployment script for multi-domain SSL setup

set -e

EC2_IP="<EC2_PUBLIC_IP>"  # Update this
PROJECT_DIR="/home/rabin/projects/pmo"

echo "============================================"
echo "Multi-Domain SSL Deployment"
echo "============================================"

# 1. Deploy Terraform
echo "Step 1: Deploying infrastructure..."
cd $PROJECT_DIR/infra-tf
terraform apply -auto-approve

# 2. Get EC2 IP
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "EC2 IP: $EC2_IP"

# 3. Wait for EC2 to be ready
echo "Step 2: Waiting for EC2 to be ready..."
sleep 30

# 4. Copy files to EC2
echo "Step 3: Copying files to EC2..."
rsync -avz $PROJECT_DIR/ ubuntu@$EC2_IP:/opt/coherent/pmo/

# 5. Set up static site
echo "Step 4: Setting up static site..."
ssh ubuntu@$EC2_IP "sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-static-site.sh"

# 6. Wait for DNS
echo "Step 5: Waiting for DNS propagation..."
echo "Please verify DNS before continuing..."
read -p "Press enter when DNS is propagated..."

# 7. Set up SSL
echo "Step 6: Setting up SSL certificates..."
ssh ubuntu@$EC2_IP "sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh"

# 8. Test
echo "Step 7: Testing..."
curl -I https://cohuron.com
curl -I https://rabindrakharel.com

echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo "cohuron.com: https://cohuron.com"
echo "rabindrakharel.com: https://rabindrakharel.com"
```

---

## Summary

### What Was Created

1. **nginx Configurations:**
   - `/etc/nginx/sites-available/cohuron.com` - PMO platform reverse proxy
   - `/etc/nginx/sites-available/rabindrakharel.com` - Static site server

2. **SSL Certificates:**
   - `/etc/letsencrypt/live/cohuron.com/` - SSL cert for cohuron.com
   - `/etc/letsencrypt/live/rabindrakharel.com/` - SSL cert for rabindrakharel.com

3. **Lambda Function:**
   - `cohuron-ssl-renewal` - Monthly SSL renewal automation

4. **EventBridge Rule:**
   - Triggers Lambda on 1st of each month at 2 AM UTC

5. **Scripts:**
   - `/usr/local/bin/renew-ssl-certificates` - Manual renewal
   - `/usr/local/bin/deploy-rabindrakharel` - Content deployment

### Maintenance Schedule

| Task | Frequency | Method |
|------|-----------|--------|
| SSL Renewal | Monthly | Automatic (Lambda) |
| Content Updates | As needed | `deploy-rabindrakharel` |
| Security Updates | Weekly | `apt update && apt upgrade` |
| Log Review | Weekly | Check nginx, Lambda logs |
| Backup | Daily | Automated via cron |

---

## Resources

- **Let's Encrypt Docs:** https://letsencrypt.org/docs/
- **nginx SSL Config:** https://ssl-config.mozilla.org/
- **AWS Lambda Docs:** https://docs.aws.amazon.com/lambda/
- **Terraform AWS Provider:** https://registry.terraform.io/providers/hashicorp/aws/

---

**Document Version:** 1.0
**Last Updated:** 2025-10-27
**Maintained By:** Platform Team
**Status:** ✅ Production Deployment Guide
