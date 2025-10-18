# DNS Configuration Guide - Coherent PMO Platform

Complete guide for configuring DNS to point your domain to the Coherent application hosted on AWS.

---

## Overview

This guide covers DNS configuration for making your Coherent platform accessible via a custom domain (e.g., `coherent.yourdomain.com` or `app.yourcompany.com`).

---

## Quick Reference

| DNS Record Type | Name | Value | TTL |
|----------------|------|-------|-----|
| A | coherent | `<EC2_ELASTIC_IP>` | 300 |
| CNAME | www.coherent | coherent.yourdomain.com | 300 |

**Get your EC2 IP:**
```bash
terraform output -raw ec2_public_ip
```

---

## Option 1: AWS Route 53 (Recommended)

### Step 1: Create Hosted Zone

**Via AWS Console:**
1. Go to AWS Console > Route 53
2. Click "Hosted zones" > "Create hosted zone"
3. Domain name: `yourdomain.com`
4. Type: Public hosted zone
5. Click "Create hosted zone"

**Via AWS CLI:**
```bash
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)

# Save the hosted zone ID
HOSTED_ZONE_ID="Z1234567890ABC"
```

### Step 2: Update Domain Registrar Nameservers

Route 53 will provide 4 nameservers (e.g., `ns-1234.awsdns-12.org`). Update these at your domain registrar:

**GoDaddy:**
1. Log in to GoDaddy
2. My Products > Domains > Manage
3. DNS > Nameservers > Change
4. Custom > Add all 4 Route 53 nameservers
5. Save

**Namecheap:**
1. Log in to Namecheap
2. Domain List > Manage
3. Nameservers > Custom DNS
4. Add all 4 Route 53 nameservers
5. Save

**Google Domains:**
1. Log in to Google Domains
2. My domains > Manage
3. DNS > Name servers > Custom name servers
4. Add all 4 Route 53 nameservers
5. Save

**Propagation time:** 24-48 hours (usually faster)

### Step 3: Create DNS Records

**Get your EC2 Elastic IP:**
```bash
cd infra-tf
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "EC2 IP: $EC2_IP"
```

**Create A Record (Console):**
1. Route 53 > Hosted zones > yourdomain.com
2. Click "Create record"
3. Record name: `coherent` (or leave blank for root domain)
4. Record type: A
5. Value: `<EC2_IP>`
6. TTL: 300
7. Routing policy: Simple routing
8. Click "Create records"

**Create A Record (CLI):**
```bash
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

**Create CNAME for www (Optional):**
```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.coherent.yourdomain.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "coherent.yourdomain.com"}]
      }
    }]
  }'
```

### Step 4: Verify DNS

```bash
# Check DNS resolution
dig coherent.yourdomain.com +short

# Should return: <EC2_IP>

# Check from different DNS servers
dig @8.8.8.8 coherent.yourdomain.com +short  # Google DNS
dig @1.1.1.1 coherent.yourdomain.com +short  # Cloudflare DNS

# Test HTTP access
curl http://coherent.yourdomain.com/api/v1/health
```

---

## Option 2: Cloudflare DNS

### Step 1: Add Site to Cloudflare

1. Log in to Cloudflare
2. Click "Add a Site"
3. Enter your domain: `yourdomain.com`
4. Select plan (Free is sufficient)
5. Cloudflare will scan existing DNS records

### Step 2: Update Nameservers

Cloudflare will provide 2 nameservers:
```
firstname.ns.cloudflare.com
secondname.ns.cloudflare.com
```

Update these at your domain registrar (same process as Route 53 above).

### Step 3: Create DNS Record

**Get your EC2 IP:**
```bash
cd infra-tf
EC2_IP=$(terraform output -raw ec2_public_ip)
```

**Add A Record:**
1. Cloudflare Dashboard > yourdomain.com > DNS
2. Click "Add record"
3. Type: A
4. Name: coherent (or @ for root)
5. IPv4 address: `<EC2_IP>`
6. Proxy status: DNS only (grey cloud) - Important!
7. TTL: Auto
8. Click "Save"

**Why "DNS only"?**
- Orange cloud (proxied): Traffic goes through Cloudflare (SSL, caching, DDoS protection)
- Grey cloud (DNS only): Direct connection to your server
- For API applications, start with "DNS only" to avoid issues

### Step 4: Verify

```bash
dig coherent.yourdomain.com +short
curl http://coherent.yourdomain.com/api/v1/health
```

---

## Option 3: GoDaddy DNS

### Step 1: Access DNS Management

1. Log in to GoDaddy
2. My Products > Domains > Manage
3. Find your domain > Click "DNS"

### Step 2: Add A Record

**Get your EC2 IP:**
```bash
EC2_IP=$(terraform output -raw ec2_public_ip)
```

**Create Record:**
1. Click "Add" under Records
2. Type: A
3. Name: coherent (or @ for root)
4. Value: `<EC2_IP>`
5. TTL: 600 seconds (10 minutes)
6. Click "Save"

### Step 3: Verify

```bash
dig coherent.yourdomain.com +short
# Wait 10 minutes for propagation
```

---

## Option 4: Namecheap DNS

### Step 1: Access DNS Management

1. Log in to Namecheap
2. Domain List > Manage
3. Advanced DNS tab

### Step 2: Add A Record

**Get your EC2 IP:**
```bash
EC2_IP=$(terraform output -raw ec2_public_ip)
```

**Create Record:**
1. Click "Add New Record"
2. Type: A Record
3. Host: coherent (or @ for root)
4. Value: `<EC2_IP>`
5. TTL: Automatic
6. Click "Save All Changes"

---

## DNS Configuration Examples

### Single Subdomain

```
coherent.yourdomain.com → EC2_IP
```

**DNS Records:**
| Type | Name | Value |
|------|------|-------|
| A | coherent | 54.123.45.67 |

**Access:**
- http://coherent.yourdomain.com
- http://coherent.yourdomain.com/api/v1/health

### Root Domain + www

```
yourdomain.com → EC2_IP
www.yourdomain.com → yourdomain.com
```

**DNS Records:**
| Type | Name | Value |
|------|------|-------|
| A | @ | 54.123.45.67 |
| CNAME | www | yourdomain.com |

### Multiple Subdomains

```
app.yourdomain.com → EC2_IP
api.yourdomain.com → EC2_IP
```

**DNS Records:**
| Type | Name | Value |
|------|------|-------|
| A | app | 54.123.45.67 |
| A | api | 54.123.45.67 |

**Nginx Configuration Required:**
```nginx
# /etc/nginx/sites-available/coherent
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
    }
}
```

---

## SSL/TLS Setup After DNS

Once DNS is configured and propagating, set up HTTPS:

### Using Let's Encrypt (Free)

**SSH into EC2:**
```bash
ssh -i ~/.ssh/coherent-key ubuntu@<EC2_IP>
```

**Install Certbot:**
```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
```

**Obtain Certificate:**
```bash
# Replace with your domain
sudo certbot --nginx -d coherent.yourdomain.com

# Follow prompts:
# 1. Enter email address
# 2. Agree to terms
# 3. Redirect HTTP to HTTPS? Yes (recommended)
```

**Verify HTTPS:**
```bash
curl https://coherent.yourdomain.com/api/v1/health
```

**Auto-Renewal:**
```bash
# Certbot installs a cron job automatically
# Test renewal:
sudo certbot renew --dry-run
```

### Using AWS Certificate Manager (ACM)

**For use with Application Load Balancer:**

1. Request certificate in ACM
2. Add DNS validation record (auto in Route 53)
3. Create Application Load Balancer
4. Add HTTPS listener with ACM certificate
5. Update DNS to point to ALB

---

## DNS Verification Checklist

After configuring DNS, verify with these steps:

### 1. DNS Resolution

```bash
# Check A record
dig coherent.yourdomain.com A +short

# Expected: <EC2_IP>
```

### 2. DNS Propagation

```bash
# Check propagation from different locations
# Use: https://www.whatsmydns.net/
# Enter: coherent.yourdomain.com
# Type: A
```

### 3. HTTP Access

```bash
# Test web application
curl -I http://coherent.yourdomain.com

# Expected: HTTP/1.1 200 OK
```

### 4. API Access

```bash
# Test API endpoint
curl http://coherent.yourdomain.com/api/v1/health

# Expected: {"status":"ok"}
```

### 5. Browser Test

```bash
# Open in browser:
http://coherent.yourdomain.com
http://coherent.yourdomain.com/api/v1/health
```

---

## Common DNS Issues

### DNS Not Resolving

**Problem:** `dig` returns no results

**Solutions:**
1. Wait 5-60 minutes for propagation
2. Verify record was created correctly
3. Check nameservers are updated at registrar
4. Flush local DNS cache:
   - Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
   - Linux: `sudo systemd-resolve --flush-caches`
   - Windows: `ipconfig /flushdns`

### Wrong IP Returned

**Problem:** DNS resolves to old/wrong IP

**Solutions:**
1. Verify A record value in DNS provider
2. Check TTL hasn't caused caching (wait for TTL expiry)
3. Update record with correct EC2 Elastic IP
4. Use `dig +trace` to debug propagation

### Connection Refused

**Problem:** DNS resolves but connection fails

**Solutions:**
1. Check EC2 security group allows HTTP/HTTPS
2. Verify Nginx is running: `sudo systemctl status nginx`
3. Check application is running: `coherent-status`
4. Verify Elastic IP is attached to correct instance

### SSL Certificate Errors

**Problem:** HTTPS shows certificate warning

**Solutions:**
1. Ensure Let's Encrypt certificate was issued for exact domain
2. Check certificate validity: `sudo certbot certificates`
3. Renew certificate: `sudo certbot renew`
4. Verify Nginx is using correct certificate

---

## DNS Best Practices

### 1. Use Short TTLs Initially

When first setting up:
- TTL: 300 seconds (5 minutes)
- Allows quick changes if needed
- Increase to 3600 (1 hour) once stable

### 2. Always Use Elastic IP

- EC2 public IPs change on stop/start
- Elastic IPs remain static
- Terraform creates Elastic IP automatically

### 3. Set Up Monitoring

**Route 53 Health Checks:**
```hcl
resource "aws_route53_health_check" "coherent" {
  fqdn              = "coherent.yourdomain.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/v1/health"
  failure_threshold = "3"
  request_interval  = "30"
}
```

### 4. Enable DNSSEC (Optional)

Protects against DNS spoofing:
- Available in Route 53
- Free for hosted zones
- Configure in Route 53 console

### 5. Use Subdomain for Application

Instead of root domain:
- ✅ `app.yourdomain.com` or `coherent.yourdomain.com`
- ❌ `yourdomain.com`

**Benefits:**
- Easier to manage
- Can use root for marketing site
- Better security segmentation

---

## Advanced DNS Configurations

### Geo-Location Routing

Route users to nearest region:

```hcl
resource "aws_route53_record" "coherent_us" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "coherent.yourdomain.com"
  type    = "A"
  ttl     = 300
  records = [aws_eip.us_eip.public_ip]

  geolocation_routing_policy {
    continent = "NA"
  }
}

resource "aws_route53_record" "coherent_eu" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "coherent.yourdomain.com"
  type    = "A"
  ttl     = 300
  records = [aws_eip.eu_eip.public_ip]

  geolocation_routing_policy {
    continent = "EU"
  }
}
```

### Failover Configuration

Automatic failover to backup:

```hcl
resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "coherent.yourdomain.com"
  type    = "A"
  ttl     = 60
  records = [aws_eip.primary.public_ip]

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "secondary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "coherent.yourdomain.com"
  type    = "A"
  ttl     = 60
  records = [aws_eip.secondary.public_ip]

  failover_routing_policy {
    type = "SECONDARY"
  }
}
```

---

## Summary Checklist

Before going live:

- [ ] DNS records created and verified
- [ ] Domain resolves to correct IP
- [ ] HTTP/HTTPS working
- [ ] SSL certificate installed
- [ ] API endpoints accessible
- [ ] Web application loads
- [ ] Monitoring configured
- [ ] Backup DNS records documented

---

## Support Resources

- **AWS Route 53 Documentation**: https://docs.aws.amazon.com/route53/
- **Let's Encrypt Documentation**: https://letsencrypt.org/docs/
- **DNS Propagation Checker**: https://www.whatsmydns.net/
- **SSL Certificate Checker**: https://www.ssllabs.com/ssltest/

---

**Last Updated**: 2025-01-17
**Platform**: Coherent PMO v11+
