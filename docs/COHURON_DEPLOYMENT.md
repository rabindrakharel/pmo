# Huron PMO Deployment - cohuron.com

Quick reference for your specific deployment.

---

## 🌐 Your URLs

### Production URLs (After DNS Setup)
- **Landing Page**: https://app.cohuron.com
- **Signup**: https://app.cohuron.com/signup
- **Login**: https://app.cohuron.com/login
- **Dashboard**: https://app.cohuron.com/project
- **API**: https://app.cohuron.com/api/v1
- **Health Check**: https://app.cohuron.com/api/v1/auth/login

### Alternative Subdomain (Optional)
- **PMO Portal**: https://pmo.cohuron.com (if you prefer this subdomain)

### Temporary URL (Before DNS)
- **Direct IP**: http://YOUR_EC2_IP (get from `terraform output`)

---

## 🚀 Quick Deployment Commands

### 1. Deploy Infrastructure (15 min)
```bash
cd /home/rabin/projects/pmo/infra-tf

# One-time setup
terraform init

# Deploy
terraform apply -auto-approve

# Get EC2 IP
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "Your EC2 IP: $EC2_IP"
echo $EC2_IP > ../ec2-ip.txt
```

### 2. Setup DNS in Route 53
```bash
# Get your EC2 IP
EC2_IP=$(cat /home/rabin/projects/pmo/ec2-ip.txt)

# Via AWS Console:
# 1. Route 53 → Hosted Zones → Create hosted zone
# 2. Domain: cohuron.com
# 3. Type: Public hosted zone
# 4. Create record:
#    - Name: app
#    - Type: A
#    - Value: YOUR_EC2_IP
#    - TTL: 300

# Via AWS CLI (after creating hosted zone):
HOSTED_ZONE_ID="Z_YOUR_ZONE_ID"  # Get from Route 53 console

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

# Verify DNS (wait 5-10 minutes)
dig app.cohuron.com +short
```

### 3. Update Nameservers at Registrar
```bash
# 1. Get Route 53 nameservers from hosted zone
# 2. Go to your domain registrar (where you bought cohuron.com)
# 3. Update nameservers to Route 53 nameservers:
#    Example:
#    ns-1234.awsdns-12.org
#    ns-5678.awsdns-34.com
#    ns-9012.awsdns-56.net
#    ns-3456.awsdns-78.co.uk
# 4. Wait 2-48 hours for propagation (usually 5-60 minutes)
```

### 4. Deploy Application (30 min)
```bash
# SSH to EC2
EC2_IP=$(cat /home/rabin/projects/pmo/ec2-ip.txt)
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Wait for setup script
sudo tail -f /var/log/user-data.log
# Wait for: "Setup completed successfully!"

# Copy code to server (from local machine in new terminal)
rsync -avz -e "ssh -i ~/.ssh/pmo-key" \
  /home/rabin/projects/pmo/ \
  ubuntu@$EC2_IP:/opt/pmo/

# Back on EC2, install and build
cd /opt/pmo
npm install
cd apps/api && npm install && npm run build && cd ../..
cd apps/web && npm install && npm run build && cd ../..

# Start services
docker-compose up -d
sleep 30
./tools/db-import.sh
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd  # Run the command it displays

# Configure Nginx (already done by user-data)
sudo systemctl status nginx
```

### 5. Setup HTTPS (15 min)
```bash
# SSH to EC2
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Update Nginx with your domain
sudo nano /etc/nginx/sites-available/pmo
# Change: server_name _; → server_name app.cohuron.com;

sudo nginx -t
sudo systemctl reload nginx

# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx \
  -d app.cohuron.com \
  --email admin@cohuron.com \
  --agree-tos \
  --non-interactive \
  --redirect

# Update web app to use HTTPS
nano /opt/pmo/apps/web/.env
# Change: VITE_API_URL=https://app.cohuron.com

cd /opt/pmo/apps/web
npm run build
pm2 restart pmo-web

# Test
curl https://app.cohuron.com
```

---

## 📝 Environment Configuration

### Database Settings (apps/api/.env)
```bash
DB_HOST=YOUR_RDS_ENDPOINT  # From terraform output
DB_PORT=5432
DB_NAME=pmo
DB_USER=pmo_admin
DB_PASSWORD=YOUR_DB_PASSWORD  # From terraform.tfvars
```

### Web Settings (apps/web/.env)
```bash
# Before SSL
VITE_API_URL=http://YOUR_EC2_IP:4000
VITE_API_BASE_URL=http://YOUR_EC2_IP:4000

# After SSL
VITE_API_URL=https://app.cohuron.com
VITE_API_BASE_URL=https://app.cohuron.com
```

---

## ✅ Testing Checklist

### Test Without Domain (Direct IP)
```bash
EC2_IP=$(cat /home/rabin/projects/pmo/ec2-ip.txt)

# Landing page
curl http://$EC2_IP/

# API
curl http://$EC2_IP/api/v1/auth/login

# Browser
echo "Open: http://$EC2_IP"
```

### Test With Domain (After DNS)
```bash
# Check DNS resolution
dig app.cohuron.com +short
# Should return: YOUR_EC2_IP

# Test HTTP
curl http://app.cohuron.com/

# Test HTTPS (after SSL setup)
curl https://app.cohuron.com/

# Browser tests
# https://app.cohuron.com - Landing page
# https://app.cohuron.com/signup - Signup flow
# https://app.cohuron.com/login - Login page
```

### Create Test Account
1. Go to https://app.cohuron.com
2. Click "Get Started"
3. Fill signup form:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
   - Customer Type: Commercial
4. Select modules (recommended: project, task, employee, biz)
5. Click "Continue to Dashboard"
6. You're in!

---

## 🔧 Common Commands

### SSH to Server
```bash
ssh -i ~/.ssh/pmo-key ubuntu@$(cat /home/rabin/projects/pmo/ec2-ip.txt)
```

### Check Application Status
```bash
pm2 status
pm2 logs
pm2 monit
```

### Restart Application
```bash
pm2 restart all
sudo systemctl restart nginx
```

### Update Application
```bash
cd /opt/pmo
git pull origin main
npm install
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..
pm2 restart all
```

### View Logs
```bash
# Application logs
pm2 logs pmo-api
pm2 logs pmo-web

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

### Database Access
```bash
# Get DB credentials
grep DB_ /opt/pmo/apps/api/.env

# Connect to database
PGPASSWORD=YOUR_DB_PASSWORD psql \
  -h YOUR_RDS_ENDPOINT \
  -U pmo_admin \
  -d pmo

# List tables
\dt app.*

# View data
SELECT * FROM app.d_employee;
SELECT * FROM app.d_cust;
```

---

## 🆘 Troubleshooting

### DNS Not Resolving
```bash
# Check DNS
dig app.cohuron.com +short

# If empty, wait more time (can take up to 48 hours)
# Or check nameservers at registrar

# Flush local DNS cache
# Mac: sudo dscacheutil -flushcache
# Linux: sudo systemd-resolve --flush-caches
```

### SSL Certificate Issues
```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# Check Nginx config
sudo nginx -t
sudo nano /etc/nginx/sites-available/pmo
```

### Application Won't Start
```bash
# Check PM2
pm2 status
pm2 logs --err

# Check environment
cat /opt/pmo/apps/api/.env

# Restart everything
pm2 delete all
pm2 start /opt/pmo/ecosystem.config.js
```

### Database Connection Error
```bash
# Test database connection
PGPASSWORD=YOUR_PASSWORD psql -h RDS_ENDPOINT -U pmo_admin -d pmo -c "SELECT 1;"

# Check security group allows EC2 → RDS on port 5432
aws ec2 describe-security-groups --group-ids YOUR_DB_SG_ID

# Verify credentials in .env file
grep DB_ /opt/pmo/apps/api/.env
```

---

## 💰 Cost Estimate

### Monthly Costs (Production)
- **EC2** (t3.medium): $30/month
- **RDS** (db.t3.micro): $15/month (Free tier: $0 first year)
- **EBS** (30GB): $3/month
- **S3**: $1-5/month
- **Data Transfer**: $5-20/month
- **Route 53** hosted zone: $0.50/month
- **Total**: ~$50-75/month (or ~$40/month with free tier)

### Save Money
- Use free tier (12 months)
- Stop instances when not needed
- Use smaller instances for dev/test
- Setup billing alerts

---

## 📞 Quick Reference

### Important Files
```
~/.ssh/pmo-key                      # SSH key for EC2
/home/rabin/projects/pmo/ec2-ip.txt # EC2 IP address
/home/rabin/projects/pmo/infra-tf   # Terraform infrastructure
/opt/pmo                            # Application on EC2
```

### Important URLs
```
AWS Console:     https://console.aws.amazon.com
Route 53:        https://console.aws.amazon.com/route53
EC2 Dashboard:   https://console.aws.amazon.com/ec2
RDS Dashboard:   https://console.aws.amazon.com/rds
Billing:         https://console.aws.amazon.com/billing
```

### Support Documentation
```
EC2_HOSTING_GUIDE.md       # Complete deployment guide
DEPLOYMENT_CHECKLIST.md    # Step-by-step checklist
QUICK_START_AWS.md         # Fast track guide
infra-tf/DNS-SETUP.md      # DNS configuration details
```

---

## 🎯 Next Steps After Deployment

### Immediate (Day 1)
- [ ] Test all core features
- [ ] Create admin users
- [ ] Configure email SMTP (replace MailHog)
- [ ] Setup CloudWatch monitoring
- [ ] Configure automated backups

### Soon (Week 1)
- [ ] Add team members
- [ ] Import/create projects
- [ ] Setup CI/CD pipeline
- [ ] Configure backup retention
- [ ] Review security settings

### Eventually (Month 1)
- [ ] Setup auto-scaling (if needed)
- [ ] Enable WAF (security)
- [ ] Add CloudFront CDN
- [ ] Optimize costs
- [ ] Schedule maintenance windows

---

## ✨ Success Criteria

Your deployment is successful when:

✅ **app.cohuron.com** loads the landing page
✅ SSL certificate shows green padlock
✅ Signup flow works end-to-end
✅ Users can login and access dashboard
✅ All configured modules work
✅ PM2 shows apps online
✅ Backups are running
✅ Monitoring is setup

---

**Your Huron PMO platform is live at: https://app.cohuron.com** 🎉

For detailed instructions, see: `EC2_HOSTING_GUIDE.md`

---

**Domain**: cohuron.com
**Primary URL**: https://app.cohuron.com
**Version**: 1.0
**Last Updated**: 2025-10-21
