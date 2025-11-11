# DNS Configuration - Quick Reference

**Target:** Point both domains to EC2 instance for multi-domain hosting

---

## Step 1: Get EC2 IP

```bash
cd /home/rabin/projects/pmo/infra-tf
terraform output -raw ec2_public_ip
```

Example: `100.28.36.248`

---

## Step 2: Configure DNS Records

### For Both Domains (cohuron.com AND rabindrakharel.com)

Create these **2 DNS records**:

```
Type    Name    Value           TTL
────    ────    ─────           ───
A       @       <EC2_IP>        300
A       www     <EC2_IP>        300
```

Replace `<EC2_IP>` with your actual EC2 IP address.

---

## Step 3: Where to Configure

### cohuron.com

**Find your DNS provider first:**
```bash
dig cohuron.com NS +short
```

Then log in to one of:
- **AWS Route 53** → console.aws.amazon.com/route53
- **Cloudflare** → dash.cloudflare.com
- **GoDaddy** → godaddy.com/products → DNS
- **Namecheap** → namecheap.com → Domain List → Advanced DNS

### rabindrakharel.com (DreamHost)

1. **Log in:** panel.dreamhost.com
2. **Navigate:** Domains → Custom DNS
3. **Select:** rabindrakharel.com
4. **Add Records:**
   - A record: `@` → `<EC2_IP>`
   - A record: `www` → `<EC2_IP>`

**Important:** If domain is "Fully Hosted", remove hosting first!

---

## Step 4: Verify DNS

### Quick Check
```bash
dig cohuron.com +short
dig rabindrakharel.com +short
# Both should return: <EC2_IP>
```

### Automated Check
```bash
cd /home/rabin/projects/pmo/infra-tf
chmod +x scripts/verify-dns.sh
./scripts/verify-dns.sh
```

### Online Check
- https://dnschecker.org/
- Enter domain name
- All locations should show your EC2 IP

---

## Step 5: Wait for Propagation

| Provider | Time |
|----------|------|
| Cloudflare | 2-5 min |
| AWS Route 53 | 1 min |
| GoDaddy | 10-60 min |
| Namecheap | 30-60 min |
| **DreamHost** | **4-6 hours** ⚠️ |

**Do NOT proceed to SSL setup until DNS is fully propagated!**

---

## Troubleshooting

### DNS not resolving?
```bash
# Clear local cache
sudo systemd-resolve --flush-caches

# Check with Google DNS
dig @8.8.8.8 cohuron.com +short

# Wait longer (especially for DreamHost)
```

### Wrong IP returned?
1. Log back into DNS provider
2. Verify records are correct
3. Check for typos in IP address
4. Make sure both `@` and `www` records exist

---

## Visual Example

**What your DNS should look like:**

```
DNS Management Panel
┌─────────────────────────────────────────────┐
│ Domain: cohuron.com                          │
├─────────────────────────────────────────────┤
│ Type    Host    Value           TTL         │
│ ──────────────────────────────────────────  │
│ A       @       100.28.36.248   300         │
│ A       www     100.28.36.248   300         │
└─────────────────────────────────────────────┘
```

Same setup for rabindrakharel.com!

---

## After DNS is Configured

✅ **When all checks pass**, proceed with SSL setup:

```bash
# Get EC2 IP
export EC2_IP=$(cd /home/rabin/projects/pmo/infra-tf && terraform output -raw ec2_public_ip)

# SSH to EC2
ssh ubuntu@$EC2_IP

# Run SSL setup (only after DNS is propagated!)
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh
```

---

## Need More Details?

See full guide: `/home/rabin/projects/pmo/docs/DNS_CONFIGURATION_GUIDE.md`

---

**Quick Checklist:**
- [ ] Get EC2 IP from Terraform
- [ ] Add A record for `@` → EC2 IP (both domains)
- [ ] Add A record for `www` → EC2 IP (both domains)
- [ ] Wait for propagation
- [ ] Verify with `dig` or verify-dns.sh
- [ ] Proceed to SSL setup
