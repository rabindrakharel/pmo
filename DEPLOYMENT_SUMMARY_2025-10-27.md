# Deployment Summary - Multi-Domain SSL Setup

**Date:** October 27, 2025
**Status:** ✅ Successfully Deployed
**EC2 IP:** 100.28.36.248

---

## ✅ What Was Deployed

### 1. Lambda SSL Renewal Function
- **Function Name:** `cohuron-ssl-renewal`
- **Runtime:** Python 3.11
- **Status:** Active
- **Trigger:** EventBridge (monthly on 1st at 2 AM UTC)
- **Purpose:** Automatically renews SSL certificates for both domains
- **Logs:** `/aws/lambda/cohuron-ssl-renewal`

### 2. EventBridge Schedule
- **Rule:** `cohuron-ssl-renewal-monthly`
- **Schedule:** `cron(0 2 1 * ? *)` (1st of each month at 2 AM UTC)
- **Target:** Lambda function for SSL renewal

### 3. Static Website Setup (rabindrakharel.com)
- **Web Root:** `/var/www/rabindrakharel.com`
- **Content Repo:** `/opt/coherent/rabindrakharel.com`
- **Default Files Created:**
  - `index.html` - Homepage
  - `README.md` - Documentation
  - `404.html` - Error page
  - `50x.html` - Server error page
- **Deployment Script:** `/usr/local/bin/deploy-rabindrakharel`

### 4. nginx Configuration Files (Ready for Deployment)
- `infra-tf/nginx-configs/cohuron.com.conf` - PMO Platform config
- `infra-tf/nginx-configs/rabindrakharel.com.conf` - Static site config

### 5. SSL Setup Scripts (Ready to Run)
- `infra-tf/scripts/setup-ssl.sh` - Complete SSL setup for both domains
- `infra-tf/scripts/verify-dns.sh` - DNS verification tool

### 6. Files Copied to EC2
✅ All project files synced to `/opt/coherent/pmo/`

---

## 📋 Current Status

### Infrastructure
- ✅ Lambda function deployed and active
- ✅ EventBridge schedule configured
- ✅ Static website directory created
- ✅ Deployment scripts in place
- ✅ nginx config files ready

### DNS Configuration
- ⚠️ **WAITING:** DNS records need to be added for both domains
  - cohuron.com → 100.28.36.248
  - rabindrakharel.com → 100.28.36.248

### SSL Certificates
- ⏸️ **WAITING:** DNS propagation required before SSL setup

---

## 🚀 Next Steps (In Order)

### Step 1: Configure DNS for Both Domains ⚠️ REQUIRED

#### For rabindrakharel.com (DreamHost)
1. Log in: https://panel.dreamhost.com/
2. Go to **Domains** → **Custom DNS**
3. Select `rabindrakharel.com`
4. If "Fully Hosted", click **Remove Hosting** first
5. Add these 2 DNS records:
   ```
   Type    Name    Value           TTL
   ────────────────────────────────────
   A       @       100.28.36.248   Auto
   A       www     100.28.36.248   Auto
   ```

#### For cohuron.com (Your DNS Provider)
Find your DNS provider and add:
```
Type    Name    Value           TTL
────────────────────────────────────
A       @       100.28.36.248   300
A       www     100.28.36.248   300
```

**Check DNS provider:**
```bash
dig cohuron.com NS +short
```

### Step 2: Verify DNS Propagation (WAIT 4-6 hours for DreamHost!)

**Automated check:**
```bash
cd /home/rabin/projects/pmo/infra-tf
./scripts/verify-dns.sh
```

**Manual check:**
```bash
dig cohuron.com +short
dig rabindrakharel.com +short
# Both should return: 100.28.36.248
```

**Online check:**
- https://dnschecker.org/
- Enter both domains and verify all locations show green ✅

### Step 3: Set Up SSL Certificates (ONLY AFTER DNS PROPAGATES!)

```bash
# SSH into EC2
ssh ubuntu@100.28.36.248

# Run SSL setup script (this will take 5-10 minutes)
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh

# The script will:
# 1. Install certbot
# 2. Obtain SSL certificates for both domains
# 3. Deploy nginx configs with SSL
# 4. Configure automatic renewal
```

### Step 4: Test Both Domains

```bash
# Test cohuron.com
curl -I https://cohuron.com
open https://cohuron.com

# Test rabindrakharel.com
curl -I https://rabindrakharel.com
open https://rabindrakharel.com
```

### Step 5: Add Content to rabindrakharel.com (Optional)

```bash
# On local machine
mkdir -p /home/rabin/projects/rabindrakharel.com
cd /home/rabin/projects/rabindrakharel.com

# Add your README files and documentation
echo "# Your content here" > README.md

# Deploy to EC2
rsync -avz ./ ubuntu@100.28.36.248:/opt/coherent/rabindrakharel.com/

# On EC2, run deployment script
ssh ubuntu@100.28.36.248 sudo /usr/local/bin/deploy-rabindrakharel
```

---

## 🎯 What Happens After SSL Setup

### Automatic SSL Renewal
- Lambda function triggers **monthly on the 1st at 2 AM UTC**
- Connects to EC2 via AWS Systems Manager (SSM)
- Runs `/usr/local/bin/renew-ssl-certificates`
- Certificates auto-renew 30 days before expiry
- nginx reloads automatically

### Manual SSL Renewal (If Needed)
```bash
ssh ubuntu@100.28.36.248
sudo /usr/local/bin/renew-ssl-certificates
```

### Test Lambda Function (Optional)
```bash
aws lambda invoke \
  --profile cohuron \
  --function-name cohuron-ssl-renewal \
  --payload '{}' \
  response.json

cat response.json
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/cohuron-ssl-renewal --follow --profile cohuron
```

---

## 📊 Deployment Details

### EC2 Instance
```
Instance ID: i-07f64b1f8de8f6b26
Public IP: 100.28.36.248
Type: t3.medium
SSH: ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248
```

### Lambda Function
```
Name: cohuron-ssl-renewal
Runtime: Python 3.11
Timeout: 300 seconds (5 minutes)
Memory: 128 MB
Trigger: EventBridge (monthly)
```

### Domains
```
cohuron.com → PMO Platform (API + Web reverse proxy)
rabindrakharel.com → Static documentation site
```

### AWS Resources Created
- Lambda function: `cohuron-ssl-renewal`
- IAM role: `cohuron-ssl-renewal-lambda-role`
- CloudWatch Log Group: `/aws/lambda/cohuron-ssl-renewal`
- EventBridge Rule: `cohuron-ssl-renewal-monthly`

---

## 📝 Important Files

### On Local Machine
```
/home/rabin/projects/pmo/
├── infra-tf/
│   ├── nginx-configs/
│   │   ├── cohuron.com.conf
│   │   └── rabindrakharel.com.conf
│   ├── scripts/
│   │   ├── setup-ssl.sh
│   │   ├── setup-static-site.sh
│   │   └── verify-dns.sh
│   └── lambda-functions/
│       └── ssl-renewal/
│           ├── index.py
│           └── requirements.txt
└── docs/
    ├── DNS_CONFIGURATION_GUIDE.md
    ├── MULTI_DOMAIN_SSL_DEPLOYMENT_GUIDE.md
    └── DEPLOYMENT_QUICKSTART.md
```

### On EC2 Instance
```
/opt/coherent/pmo/                  # All project files
/var/www/rabindrakharel.com/        # Static website files
/opt/coherent/rabindrakharel.com/   # Content repository
/usr/local/bin/deploy-rabindrakharel  # Deployment script
/usr/local/bin/renew-ssl-certificates # SSL renewal script (created by setup-ssl.sh)
/etc/nginx/sites-available/         # nginx configs (after SSL setup)
/etc/letsencrypt/live/              # SSL certificates (after SSL setup)
```

---

## 🔧 Useful Commands

### SSH Access
```bash
ssh ubuntu@100.28.36.248
```

### Verify DNS
```bash
cd /home/rabin/projects/pmo/infra-tf
./scripts/verify-dns.sh
```

### Deploy Content to rabindrakharel.com
```bash
# From local machine
rsync -avz /path/to/content/ ubuntu@100.28.36.248:/opt/coherent/rabindrakharel.com/

# On EC2
ssh ubuntu@100.28.36.248 sudo /usr/local/bin/deploy-rabindrakharel
```

### Check Lambda Function
```bash
aws lambda get-function --profile cohuron --function-name cohuron-ssl-renewal
aws lambda invoke --profile cohuron --function-name cohuron-ssl-renewal --payload '{}' response.json
```

### View nginx Logs (After SSL Setup)
```bash
ssh ubuntu@100.28.36.248
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check SSL Certificates (After SSL Setup)
```bash
ssh ubuntu@100.28.36.248
sudo certbot certificates
```

---

## ⚠️ Important Notes

1. **DNS Propagation Time:**
   - DreamHost (rabindrakharel.com): **4-6 hours** (sometimes up to 24 hours)
   - Other providers (cohuron.com): Usually 5-60 minutes

2. **Do NOT Run SSL Setup Until DNS Propagates:**
   - Let's Encrypt will fail if DNS doesn't point to your server
   - Run `./scripts/verify-dns.sh` to confirm readiness

3. **SSL Certificates:**
   - Let's Encrypt certificates are valid for 90 days
   - Lambda auto-renews 30 days before expiry
   - First renewal will happen on December 1, 2025 at 2 AM UTC

4. **Backup:**
   - SSL certificates are backed up in Let's Encrypt's system
   - nginx configs are in git repository
   - Static website content should be backed up separately

---

## 📞 Support & Documentation

### Full Guides
- **DNS Setup:** `/home/rabin/projects/pmo/docs/DNS_CONFIGURATION_GUIDE.md`
- **SSL Deployment:** `/home/rabin/projects/pmo/docs/MULTI_DOMAIN_SSL_DEPLOYMENT_GUIDE.md`
- **Quick Start:** `/home/rabin/projects/pmo/infra-tf/DEPLOYMENT_QUICKSTART.md`

### Quick Reference
- **DNS:** `/home/rabin/projects/pmo/infra-tf/DNS_QUICK_REFERENCE.md`

### Online Resources
- Let's Encrypt: https://letsencrypt.org/docs/
- nginx SSL: https://ssl-config.mozilla.org/
- DNS Checker: https://dnschecker.org/

---

## ✅ Deployment Checklist

### Infrastructure (Completed)
- [x] Lambda function deployed
- [x] EventBridge schedule configured
- [x] Static website directory created
- [x] nginx configs prepared
- [x] SSL setup scripts ready
- [x] All files copied to EC2

### DNS Configuration (Required)
- [ ] Add DNS records for cohuron.com
- [ ] Add DNS records for rabindrakharel.com
- [ ] Verify DNS propagation (both domains)

### SSL Setup (After DNS)
- [ ] Run SSL setup script
- [ ] Verify SSL certificates
- [ ] Test HTTPS access (both domains)

### Optional
- [ ] Add content to rabindrakharel.com
- [ ] Test Lambda SSL renewal function
- [ ] Set up monitoring/alerts

---

## 🎉 Summary

**Deployment Status:** ✅ Infrastructure Complete

**What's Working:**
- Lambda SSL renewal function is deployed and active
- Static website infrastructure is ready
- nginx configs are prepared
- All scripts are in place

**What's Needed:**
1. Add DNS records for both domains
2. Wait for DNS propagation
3. Run SSL setup script
4. Test both websites

**Estimated Time to Complete:**
- DNS setup: 10 minutes
- DNS propagation: 4-6 hours (DreamHost)
- SSL setup: 10 minutes
- **Total: ~5-7 hours (mostly waiting for DNS)**

---

**Deployment completed:** October 27, 2025 at 7:52 PM UTC
**Next action:** Configure DNS for both domains
**Documentation:** See `/home/rabin/projects/pmo/docs/DNS_CONFIGURATION_GUIDE.md`

🚀 **You're almost there! Just add the DNS records and wait for propagation.**
