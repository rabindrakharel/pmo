# DNS Configuration Guide

**Domains:** cohuron.com, rabindrakharel.com
**Target:** AWS EC2 Instance
**Purpose:** Point both domains to the same EC2 server

---

## Table of Contents

1. [Get EC2 IP Address](#get-ec2-ip-address)
2. [DNS Records Needed](#dns-records-needed)
3. [Configure cohuron.com](#configure-cohuroncom)
4. [Configure rabindrakharel.com (DreamHost)](#configure-rabindrakharelcom-dreamhost)
5. [Verify DNS Propagation](#verify-dns-propagation)
6. [Troubleshooting](#troubleshooting)

---

## Get EC2 IP Address

### Option 1: Get from Terraform

```bash
cd /home/rabin/projects/pmo/infra-tf
terraform output ec2_public_ip
```

Example output: `100.28.36.248`

### Option 2: Get from AWS Console

1. Go to **AWS Console** → **EC2** → **Instances**
2. Find instance named `cohuron-app-server`
3. Copy the **Public IPv4 address**

### Option 3: Get from AWS CLI

```bash
aws ec2 describe-instances \
  --profile cohuron \
  --filters "Name=tag:Name,Values=cohuron-app-server" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

**Save this IP - you'll need it for DNS configuration:**
```bash
export EC2_IP="<your-ec2-ip>"
echo $EC2_IP
```

---

## DNS Records Needed

For **both domains**, you need to create these DNS records:

| Type | Name | Value | TTL | Purpose |
|------|------|-------|-----|---------|
| A | @ | `<EC2_IP>` | 300 | Root domain (cohuron.com) |
| A | www | `<EC2_IP>` | 300 | www subdomain (www.cohuron.com) |

Example with IP `100.28.36.248`:
```
A    @      100.28.36.248    300
A    www    100.28.36.248    300
```

---

## Configure cohuron.com

### Step 1: Identify Your DNS Provider

First, identify where cohuron.com DNS is currently managed:

```bash
# Check current nameservers
dig cohuron.com NS +short
whois cohuron.com | grep -i "name server"
```

Common providers:
- **AWS Route 53** (ns-*.awsdns-*.com)
- **Cloudflare** (*.ns.cloudflare.com)
- **GoDaddy** (ns*.domaincontrol.com)
- **Namecheap** (dns*.registrar-servers.com)
- **Google Domains** (ns-cloud-*.googledomains.com)

---

### Option A: AWS Route 53

#### If Using Existing Hosted Zone

1. **Go to Route 53 Console**
   - Navigate to: https://console.aws.amazon.com/route53/

2. **Select Hosted Zone**
   - Click on **Hosted zones**
   - Find and click on `cohuron.com`

3. **Delete/Update Existing A Records** (if any)
   - Find any existing A records for `@` or `www`
   - Delete or update them

4. **Create Root Domain A Record**
   - Click **Create record**
   - Record name: (leave blank for root domain)
   - Record type: **A**
   - Value: `<EC2_IP>` (e.g., `100.28.36.248`)
   - TTL: `300`
   - Click **Create records**

5. **Create WWW Subdomain A Record**
   - Click **Create record**
   - Record name: `www`
   - Record type: **A**
   - Value: `<EC2_IP>`
   - TTL: `300`
   - Click **Create records**

#### If Creating New Hosted Zone

If you're managing cohuron.com DNS elsewhere but want to move to Route 53:

```bash
# This is optional - only if you want to use Route 53
cd /home/rabin/projects/pmo/infra-tf

# Enable DNS creation in terraform
# Edit terraform.tfvars and set:
# create_dns_records = true

terraform apply
```

Then follow the nameserver update instructions from Terraform output.

---

### Option B: Cloudflare

1. **Log in to Cloudflare**
   - Go to: https://dash.cloudflare.com/

2. **Select Domain**
   - Click on `cohuron.com`

3. **Go to DNS Settings**
   - Click **DNS** in the left menu

4. **Update/Create A Records**

   **Root Domain (@):**
   - Type: **A**
   - Name: **@**
   - IPv4 address: `<EC2_IP>`
   - Proxy status: **DNS only** (grey cloud, not proxied)
   - TTL: **Auto**
   - Click **Save**

   **WWW Subdomain:**
   - Type: **A**
   - Name: **www**
   - IPv4 address: `<EC2_IP>`
   - Proxy status: **DNS only** (grey cloud, not proxied)
   - TTL: **Auto**
   - Click **Save**

5. **Important:** Make sure proxy is **OFF** (grey cloud) initially
   - You can enable Cloudflare proxy (orange cloud) later after SSL is set up

---

### Option C: GoDaddy

1. **Log in to GoDaddy**
   - Go to: https://www.godaddy.com/
   - Click **Sign In**

2. **Access DNS Management**
   - Go to **My Products**
   - Find `cohuron.com`
   - Click **DNS**

3. **Update A Records**

   **Root Domain (@):**
   - Type: **A**
   - Name: **@**
   - Value: `<EC2_IP>`
   - TTL: **1 Hour** (or **Custom: 300 seconds**)
   - Click **Save**

   **WWW Subdomain:**
   - Type: **A**
   - Name: **www**
   - Value: `<EC2_IP>`
   - TTL: **1 Hour**
   - Click **Save**

---

### Option D: Namecheap

1. **Log in to Namecheap**
   - Go to: https://www.namecheap.com/
   - Click **Sign In**

2. **Access Domain List**
   - Go to **Domain List**
   - Find `cohuron.com`
   - Click **Manage**

3. **Access Advanced DNS**
   - Click **Advanced DNS** tab

4. **Update A Records**

   **Root Domain (@):**
   - Type: **A Record**
   - Host: **@**
   - Value: `<EC2_IP>`
   - TTL: **5 min** (300 seconds)
   - Click **Save**

   **WWW Subdomain:**
   - Type: **A Record**
   - Host: **www**
   - Value: `<EC2_IP>`
   - TTL: **5 min**
   - Click **Save**

---

## Configure rabindrakharel.com (DreamHost)

### Step 1: Log in to DreamHost

1. Go to: https://panel.dreamhost.com/
2. Enter your **DreamHost credentials**
3. Click **Sign In**

### Step 2: Navigate to DNS Management

1. In the left sidebar, click **Domains**
2. Click **Manage Domains** or **DNS**
3. Find `rabindrakharel.com` in the list
4. Click **DNS** or **Edit** next to the domain

Alternative path:
- Go to **Panel** → **Domains** → **Custom DNS**

### Step 3: Update/Create A Records

#### Method 1: Via Custom DNS Records

1. **Look for Custom DNS Records section**

2. **Add/Update Root Domain A Record:**
   - Type: **A**
   - Name/Host: **@** (or leave blank for root)
   - Value: `<EC2_IP>` (e.g., `100.28.36.248`)
   - Click **Add Record** or **Update**

3. **Add/Update WWW A Record:**
   - Type: **A**
   - Name/Host: **www**
   - Value: `<EC2_IP>`
   - Click **Add Record** or **Update**

#### Method 2: If Domain is "Fully Hosted" on DreamHost

If rabindrakharel.com is currently set up as a fully hosted domain on DreamHost:

1. **Remove Hosting** (if pointing to DreamHost servers)
   - Go to **Domains** → **Manage Domains**
   - Click **Edit** next to `rabindrakharel.com`
   - Click **Remove Hosting** (this removes DreamHost's default hosting)
   - Confirm removal

2. **Set Domain as DNS Only**
   - After removing hosting, the domain becomes "DNS only"
   - This allows you to manage custom DNS records

3. **Add Custom DNS Records**
   - Go to **Domains** → **Custom DNS**
   - Select `rabindrakharel.com`
   - Add A records as described above

### Step 4: DreamHost-Specific Notes

**Important Points:**
- DreamHost DNS changes can take **4-6 hours** to propagate (longer than most providers)
- Make sure you're not using DreamHost's "Fully Hosted" feature
- If you see "This domain is set to be hosted" warning, remove hosting first
- TTL in DreamHost is usually automatic (cannot be customized in basic plans)

**Screenshot Reference:**
```
DreamHost Panel → Domains → Custom DNS
┌─────────────────────────────────────────────┐
│ Custom DNS Records                           │
├─────────────────────────────────────────────┤
│ Domain: rabindrakharel.com                   │
│                                              │
│ Type    Name    Value              TTL      │
│ ────────────────────────────────────────── │
│ A       @       100.28.36.248      Auto     │
│ A       www     100.28.36.248      Auto     │
└─────────────────────────────────────────────┘
```

---

## Verify DNS Propagation

### Step 1: Test DNS Resolution Locally

```bash
# Test cohuron.com
dig cohuron.com +short
dig www.cohuron.com +short

# Test rabindrakharel.com
dig rabindrakharel.com +short
dig www.rabindrakharel.com +short

# All should return your EC2 IP
```

Expected output:
```
100.28.36.248
```

### Step 2: Test with Different DNS Servers

```bash
# Google DNS
dig @8.8.8.8 cohuron.com +short
dig @8.8.8.8 rabindrakharel.com +short

# Cloudflare DNS
dig @1.1.1.1 cohuron.com +short
dig @1.1.1.1 rabindrakharel.com +short

# OpenDNS
dig @208.67.222.222 cohuron.com +short
dig @208.67.222.222 rabindrakharel.com +short
```

### Step 3: Check Propagation Status

Use online tools:

1. **DNS Checker** (multiple locations)
   - https://dnschecker.org/
   - Enter: `cohuron.com` and `rabindrakharel.com`
   - Select **A** record type
   - Click **Search**
   - Green checkmarks mean propagated

2. **What's My DNS**
   - https://www.whatsmydns.net/
   - Enter domain name
   - Should show your EC2 IP globally

3. **DNS Propagation Checker**
   - https://www.whatsmydns.net/
   - Check from multiple countries

### Step 4: Test HTTP Access (Before SSL)

```bash
# Test cohuron.com (should return 200 or redirect)
curl -I http://cohuron.com

# Test rabindrakharel.com
curl -I http://rabindrakharel.com

# Test with EC2 IP directly
curl -I http://<EC2_IP>
```

Expected response:
```
HTTP/1.1 200 OK
Server: nginx
...
```

### Step 5: Monitor Propagation Time

| Provider | Typical Propagation Time |
|----------|-------------------------|
| Cloudflare | 2-5 minutes |
| AWS Route 53 | 60 seconds |
| GoDaddy | 10-60 minutes |
| Namecheap | 30-60 minutes |
| DreamHost | 4-6 hours |
| Google Domains | 5-15 minutes |

**Note:** DreamHost typically takes the longest!

---

## Complete Verification Script

Save this as `verify-dns.sh`:

```bash
#!/bin/bash
# DNS Verification Script

EC2_IP="<your-ec2-ip>"  # Update this

echo "============================================"
echo "DNS Verification for cohuron.com and rabindrakharel.com"
echo "Expected IP: $EC2_IP"
echo "============================================"
echo ""

# Function to check DNS
check_dns() {
    local domain=$1
    echo "Checking $domain..."

    # Root domain
    echo -n "  $domain: "
    result=$(dig +short $domain A | head -1)
    if [ "$result" == "$EC2_IP" ]; then
        echo "✅ $result"
    else
        echo "❌ $result (expected: $EC2_IP)"
    fi

    # WWW subdomain
    echo -n "  www.$domain: "
    result=$(dig +short www.$domain A | head -1)
    if [ "$result" == "$EC2_IP" ]; then
        echo "✅ $result"
    else
        echo "❌ $result (expected: $EC2_IP)"
    fi

    echo ""
}

# Check both domains
check_dns "cohuron.com"
check_dns "rabindrakharel.com"

# Test HTTP access
echo "Testing HTTP access..."
echo -n "  http://cohuron.com: "
status=$(curl -s -o /dev/null -w "%{http_code}" http://cohuron.com)
echo "$status"

echo -n "  http://rabindrakharel.com: "
status=$(curl -s -o /dev/null -w "%{http_code}" http://rabindrakharel.com)
echo "$status"

echo ""
echo "============================================"
echo "If all checks pass (✅), you can proceed with SSL setup!"
echo "If any fail (❌), wait longer or check DNS configuration."
echo "============================================"
```

Usage:
```bash
chmod +x verify-dns.sh
./verify-dns.sh
```

---

## Troubleshooting

### Issue: DNS Not Resolving

**Symptoms:**
```bash
dig cohuron.com +short
# Returns nothing or old IP
```

**Solutions:**

1. **Wait Longer**
   - DNS propagation can take up to 24 hours (especially DreamHost)
   - Check propagation status: https://dnschecker.org/

2. **Clear Local DNS Cache**
   ```bash
   # Linux (systemd)
   sudo systemd-resolve --flush-caches

   # Linux (older)
   sudo /etc/init.d/nscd restart

   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Windows
   ipconfig /flushdns
   ```

3. **Verify DNS Records at Provider**
   - Log back into your DNS provider
   - Confirm records were saved correctly
   - Check for typos in IP address

4. **Check TTL**
   - Old records might be cached based on previous TTL
   - Wait for previous TTL to expire

### Issue: Only Root or WWW Works

**Symptoms:**
- `cohuron.com` works but `www.cohuron.com` doesn't (or vice versa)

**Solution:**
- Make sure you created **both** A records:
  - One for `@` (root)
  - One for `www`

### Issue: DreamHost Changes Not Taking Effect

**DreamHost-specific issues:**

1. **Domain is "Fully Hosted"**
   - Remove hosting: **Domains** → **Manage Domains** → **Remove Hosting**
   - Switch to DNS only mode

2. **Changes Not Saving**
   - Some DreamHost users need to use their API or contact support
   - Try clearing browser cache and re-entering records

3. **Propagation Very Slow**
   - DreamHost commonly takes 4-6 hours
   - Can occasionally take up to 24 hours
   - Check with: `dig @8.8.8.8 rabindrakharel.com +short`

### Issue: "CNAME Already Exists" Error

**Symptoms:**
- Can't create A record due to existing CNAME

**Solution:**
1. Delete the existing CNAME record first
2. Then create the A record
3. (A records and CNAME records for same name conflict)

### Issue: Wrong IP Returned

**Symptoms:**
```bash
dig cohuron.com +short
# Returns: 1.2.3.4 (not your EC2 IP)
```

**Solutions:**

1. **Check DNS Provider**
   - Log in and verify the A record value
   - Make sure it wasn't auto-corrected or has typo

2. **Old Record Cached**
   - Wait for TTL to expire
   - Use `dig @8.8.8.8` to bypass local cache

3. **Multiple Providers**
   - Check if domain has DNS managed in multiple places
   - Verify nameservers: `dig cohuron.com NS +short`

---

## DNS Configuration Checklist

Use this checklist to track progress:

### cohuron.com
- [ ] Identified DNS provider
- [ ] Logged into DNS management panel
- [ ] Created/updated A record for `@` → EC2 IP
- [ ] Created/updated A record for `www` → EC2 IP
- [ ] Verified with `dig cohuron.com +short`
- [ ] Verified with `dig www.cohuron.com +short`
- [ ] Tested HTTP access: `curl http://cohuron.com`

### rabindrakharel.com (DreamHost)
- [ ] Logged into DreamHost panel
- [ ] Removed "Fully Hosted" status (if applicable)
- [ ] Accessed Custom DNS settings
- [ ] Created/updated A record for `@` → EC2 IP
- [ ] Created/updated A record for `www` → EC2 IP
- [ ] Verified with `dig rabindrakharel.com +short`
- [ ] Verified with `dig www.rabindrakharel.com +short`
- [ ] Tested HTTP access: `curl http://rabindrakharel.com`

### Final Verification
- [ ] Both domains resolve to EC2 IP
- [ ] WWW subdomains work for both
- [ ] HTTP access works (returns 200 or content)
- [ ] Checked on dnschecker.org (green globally)
- [ ] Ready to proceed with SSL setup

---

## What's Next?

Once DNS is fully propagated (all checks pass ✅), proceed to SSL setup:

```bash
ssh ubuntu@<EC2_IP>
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh
```

**Do NOT run SSL setup until DNS is propagated!** Let's Encrypt will fail if DNS doesn't point to your server.

---

## Quick Reference

### EC2 IP
```bash
terraform output -raw ec2_public_ip
```

### Required DNS Records (Both Domains)
```
A    @      <EC2_IP>    300
A    www    <EC2_IP>    300
```

### Verify DNS
```bash
dig cohuron.com +short
dig rabindrakharel.com +short
```

### Test HTTP
```bash
curl -I http://cohuron.com
curl -I http://rabindrakharel.com
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-27
**Status:** ✅ DNS Configuration Guide Complete
