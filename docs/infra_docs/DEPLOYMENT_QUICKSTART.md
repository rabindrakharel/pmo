# Multi-Domain SSL Deployment - Quick Start

**TL;DR:** Host cohuron.com + rabindrakharel.com on same EC2 with automated SSL renewal

---

## 📋 Prerequisites Checklist

- [ ] AWS CLI configured with `cohuron` profile
- [ ] Terraform installed
- [ ] SSH key at `~/.ssh/id_ed25519`
- [ ] DNS access for both domains

---

## 🚀 Quick Deployment (5 Steps)

### 1. Deploy Infrastructure

```bash
cd /home/rabin/projects/pmo/infra-tf
terraform init
terraform apply

# Note the EC2 IP
export EC2_IP=$(terraform output -raw ec2_public_ip)
echo $EC2_IP
```

### 2. Configure DNS

Point both domains to EC2 IP:

**cohuron.com** (Your DNS Provider):
```
A  @     <EC2_IP>
A  www   <EC2_IP>
```

**rabindrakharel.com** (DreamHost):
```
A  @     <EC2_IP>
A  www   <EC2_IP>
```

Wait for DNS propagation (5-60 min):
```bash
dig cohuron.com +short
dig rabindrakharel.com +short
# Both should return EC2_IP
```

### 3. Copy Files to EC2

```bash
rsync -avz /home/rabin/projects/pmo/ ubuntu@$EC2_IP:/opt/coherent/pmo/
```

### 4. Set Up Static Site

```bash
ssh ubuntu@$EC2_IP
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-static-site.sh
exit
```

### 5. Set Up SSL (After DNS Propagated!)

```bash
ssh ubuntu@$EC2_IP
sudo bash /opt/coherent/pmo/infra-tf/scripts/setup-ssl.sh
exit
```

---

## ✅ Test

```bash
# Test both domains
curl -I https://cohuron.com
curl -I https://rabindrakharel.com

# Open in browser
open https://cohuron.com
open https://rabindrakharel.com
```

---

## 📝 What Was Created

### Files Created

```
Local Machine:
├── infra-tf/
│   ├── nginx-configs/
│   │   ├── cohuron.com.conf
│   │   └── rabindrakharel.com.conf
│   ├── scripts/
│   │   ├── setup-ssl.sh
│   │   └── setup-static-site.sh
│   ├── lambda-functions/
│   │   └── ssl-renewal/
│   │       ├── index.py
│   │       └── requirements.txt
│   └── modules/
│       └── lambda-ssl-renewal/
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf

EC2 Instance:
├── /etc/nginx/sites-available/
│   ├── cohuron.com
│   └── rabindrakharel.com
├── /var/www/rabindrakharel.com/
│   ├── index.html
│   ├── README.md
│   └── 404.html
├── /etc/letsencrypt/live/
│   ├── cohuron.com/
│   └── rabindrakharel.com/
└── /usr/local/bin/
    ├── renew-ssl-certificates
    └── deploy-rabindrakharel
```

### AWS Resources

- **Lambda:** `cohuron-ssl-renewal` (monthly trigger)
- **EventBridge:** Monthly schedule (1st at 2 AM UTC)
- **IAM Role:** Lambda execution role with SSM permissions
- **CloudWatch Logs:** `/aws/lambda/cohuron-ssl-renewal`

---

## 🔧 Common Tasks

### Update rabindrakharel.com Content

```bash
# Local machine
cd /home/rabin/projects/rabindrakharel.com
# Add/edit files

# Deploy
rsync -avz ./ ubuntu@$EC2_IP:/opt/coherent/rabindrakharel.com/
ssh ubuntu@$EC2_IP sudo /usr/local/bin/deploy-rabindrakharel
```

### Manual SSL Renewal

```bash
ssh ubuntu@$EC2_IP
sudo /usr/local/bin/renew-ssl-certificates
```

### Test Lambda SSL Renewal

```bash
aws lambda invoke \
  --profile cohuron \
  --function-name cohuron-ssl-renewal \
  --payload '{}' \
  response.json
```

### View nginx Logs

```bash
ssh ubuntu@$EC2_IP
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check SSL Certificate Status

```bash
ssh ubuntu@$EC2_IP
sudo certbot certificates
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| DNS not resolving | Wait 60 min, verify DNS records |
| SSL cert fails | Ensure DNS propagated first |
| 502 Bad Gateway | Check PM2 services: `pm2 status` |
| Lambda fails | Check IAM role has SSM permissions |

---

## 📚 Full Documentation

See comprehensive guide: `/home/rabin/projects/pmo/docs/MULTI_DOMAIN_SSL_DEPLOYMENT_GUIDE.md`

---

## 🎯 Architecture Summary

```
Internet
   │
   ├─► cohuron.com ──────┐
   │                      │
   └─► rabindrakharel.com ┴──► EC2 (nginx)
                                  │
                                  ├─► cohuron.com → localhost:4000 (API) + localhost:5173 (Web)
                                  └─► rabindrakharel.com → /var/www/rabindrakharel.com (static)

SSL: Let's Encrypt (auto-renewal via Lambda monthly)
```

---

**Status:** ✅ Ready for Production
**Last Updated:** 2025-10-27
