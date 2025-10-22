# Huron PMO - AWS Deployment Checklist

Quick checklist for deploying the PMO platform to AWS EC2.

---

## 📋 Pre-Deployment Checklist

### 1. Local Setup
- [ ] Terraform installed (`terraform --version`)
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS account created
- [ ] IAM user created with proper permissions
- [ ] AWS CLI configured (`aws configure`)
- [ ] SSH key generated (`~/.ssh/pmo-key`)

### 2. Configuration Files
- [ ] `terraform.tfvars` created
- [ ] `ssh_allowed_cidr` updated with your IP
- [ ] `ec2_public_key` added (from `~/.ssh/pmo-key.pub`)
- [ ] `db_password` set to strong password
- [ ] Region selected (default: `us-east-1`)

---

## 🚀 Deployment Steps

### Phase 1: Infrastructure (30 minutes)

- [ ] `cd /home/rabin/projects/pmo/infra-tf`
- [ ] `terraform init`
- [ ] `terraform validate`
- [ ] `terraform plan` (review outputs)
- [ ] `terraform apply` (type `yes`)
- [ ] ⏳ Wait 10-15 minutes
- [ ] Save outputs: `terraform output > deployment-info.txt`
- [ ] Save EC2 IP: `terraform output -raw ec2_public_ip > ec2-ip.txt`

### Phase 2: EC2 Access (10 minutes)

- [ ] Wait for user-data script (5-10 minutes)
- [ ] Test SSH: `ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP`
- [ ] Check init log: `sudo tail -f /var/log/user-data.log`
- [ ] Wait for: "Setup completed successfully!"
- [ ] Verify installations: `node --version`, `nginx -v`, `pm2 --version`

### Phase 3: Application Deployment (45 minutes)

- [ ] Clone repository to EC2: `/opt/pmo`
- [ ] Install dependencies: `npm install` (root, API, Web)
- [ ] Create `.env` files (API and Web)
- [ ] Update DB_PASSWORD in `apps/api/.env`
- [ ] Build API: `cd apps/api && npm run build`
- [ ] Build Web: `cd apps/web && npm run build`
- [ ] Start Docker: `docker-compose up -d`
- [ ] Import database: `./tools/db-import.sh`
- [ ] Create PM2 config: `ecosystem.config.js`
- [ ] Start PM2: `pm2 start ecosystem.config.js`
- [ ] Save PM2: `pm2 save && pm2 startup systemd`
- [ ] Configure Nginx: `/etc/nginx/sites-available/pmo`
- [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/pmo /etc/nginx/sites-enabled/`
- [ ] Test Nginx: `sudo nginx -t`
- [ ] Reload Nginx: `sudo systemctl reload nginx`

### Phase 4: Testing (10 minutes)

- [ ] Test API locally: `curl http://localhost:4000/api/v1/auth/login`
- [ ] Test Web locally: `curl http://localhost:5173`
- [ ] Test through Nginx: `curl http://localhost/`
- [ ] Test from browser: `http://$EC2_IP`
- [ ] Verify landing page loads
- [ ] Test signup flow
- [ ] Test login flow

---

## 🌐 DNS Configuration (Optional, 2-48 hours)

### If Using Custom Domain:

#### Route 53
- [ ] Create hosted zone in Route 53 for `cohuron.com`
- [ ] Update nameservers at registrar (where you bought cohuron.com)
- [ ] Create A record: `app.cohuron.com` → `$EC2_IP`
- [ ] Wait 5-60 minutes for propagation
- [ ] Test DNS: `dig app.cohuron.com +short`
- [ ] Verify in browser: `http://app.cohuron.com`

#### Other DNS (Cloudflare, GoDaddy, etc.)
- [ ] Log into DNS provider
- [ ] Create A record: `app` → `$EC2_IP`
- [ ] TTL: 300 seconds
- [ ] Wait for propagation (5-60 minutes)
- [ ] Test DNS: `dig app.yourdomain.com +short`

---

## 🔒 SSL Setup (15 minutes)

### Prerequisites:
- [ ] DNS configured and propagating
- [ ] Domain resolves to EC2 IP

### Steps:
- [ ] Update Nginx `server_name` to `app.cohuron.com`
- [ ] Reload Nginx: `sudo systemctl reload nginx`
- [ ] Install Certbot: `sudo apt-get install -y certbot python3-certbot-nginx`
- [ ] Obtain certificate: `sudo certbot --nginx -d app.cohuron.com --email admin@cohuron.com`
- [ ] Test HTTPS: `curl https://app.cohuron.com`
- [ ] Update Web .env: `VITE_API_URL=https://app.cohuron.com`
- [ ] Rebuild Web: `cd apps/web && npm run build`
- [ ] Restart PM2: `pm2 restart pmo-web`
- [ ] Verify auto-renewal: `sudo certbot renew --dry-run`

---

## ✅ Final Verification

### Application Health
- [ ] Landing page loads: `https://app.cohuron.com`
- [ ] Signup works
- [ ] Login works
- [ ] Dashboard loads
- [ ] API responds: `https://app.cohuron.com/api/v1/auth/login`
- [ ] SSL certificate valid (padlock in browser)

### System Health
- [ ] PM2 status: `pm2 status` (both apps online)
- [ ] Nginx status: `sudo systemctl status nginx` (active)
- [ ] Docker status: `docker-compose ps` (all running)
- [ ] Database accessible: Test login
- [ ] Logs clean: `pm2 logs` (no errors)

### Security
- [ ] SSH key secured: `chmod 400 ~/.ssh/pmo-key`
- [ ] Database password strong
- [ ] Security groups configured (ports 22, 80, 443)
- [ ] Firewall enabled (optional): `sudo ufw status`

---

## 🔧 Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Create admin user in database
- [ ] Test all core features
- [ ] Setup monitoring (CloudWatch)
- [ ] Configure email SMTP (replace MailHog)
- [ ] Update JWT_SECRET in production
- [ ] Document credentials securely

### Soon (Week 1)
- [ ] Setup automated backups schedule
- [ ] Configure backup retention policy
- [ ] Test restore procedure
- [ ] Setup CloudWatch alarms
- [ ] Create runbooks for common issues
- [ ] Document deployment process for team

### Eventually (Month 1)
- [ ] Setup CI/CD pipeline (GitHub Actions)
- [ ] Configure auto-scaling (if needed)
- [ ] Enable AWS WAF (security)
- [ ] Setup CloudFront CDN (performance)
- [ ] Review and optimize costs
- [ ] Schedule regular maintenance windows

---

## 📊 Monitoring Checklist

### Daily
- [ ] Check PM2 status: `pm2 status`
- [ ] Review logs: `pm2 logs --lines 100`
- [ ] Monitor disk space: `df -h`
- [ ] Check memory: `free -h`

### Weekly
- [ ] Review CloudWatch metrics
- [ ] Check backup success
- [ ] Review error logs
- [ ] Update dependencies
- [ ] Review AWS costs

### Monthly
- [ ] Test disaster recovery
- [ ] Review and rotate credentials
- [ ] Update system packages: `sudo apt-get update && sudo apt-get upgrade`
- [ ] Review and optimize database
- [ ] Clean old logs and backups

---

## 🆘 Emergency Contacts

### Quick Commands
```bash
# SSH to server
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Restart everything
pm2 restart all && sudo systemctl restart nginx

# Check logs
pm2 logs --err --lines 100

# Restore from backup
aws s3 cp s3://BUCKET/backups/latest.dump /tmp/
pg_restore -h DB_HOST -U pmo_admin -d pmo /tmp/latest.dump
```

### Important Files
- SSH Key: `~/.ssh/pmo-key`
- EC2 IP: `ec2-ip.txt`
- Terraform State: `infra-tf/terraform.tfstate`
- Outputs: `deployment-info.txt`

---

## 📝 Troubleshooting Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| App won't start | `pm2 restart all` |
| Nginx error | `sudo nginx -t && sudo systemctl restart nginx` |
| Database connection | Check `apps/api/.env` DB_PASSWORD |
| SSL not working | `sudo certbot renew` |
| Out of memory | `pm2 restart all` or upgrade instance |
| Can't SSH | Check security group allows your IP on port 22 |
| DNS not working | Wait 5-60 minutes for propagation |
| High costs | Stop non-essential resources or use smaller instances |

---

## 📞 Support Resources

- **Full Guide**: `EC2_HOSTING_GUIDE.md`
- **AWS Console**: https://console.aws.amazon.com
- **Route 53**: https://console.aws.amazon.com/route53
- **EC2 Dashboard**: https://console.aws.amazon.com/ec2
- **RDS Dashboard**: https://console.aws.amazon.com/rds
- **Billing**: https://console.aws.amazon.com/billing

---

## 💰 Cost Tracking

### Expected Monthly Costs
- EC2 (t3.medium): ~$30
- RDS (db.t3.micro): ~$15 (Free tier: $0)
- EBS (30GB): ~$3
- S3: ~$1-5
- Data Transfer: ~$5-20
- Route 53: ~$0.50
- **Total**: ~$50-75/month

### Cost Optimization
- [ ] Check free tier eligibility (first 12 months)
- [ ] Stop dev/staging instances when not in use
- [ ] Consider reserved instances (save 30-40%)
- [ ] Use t3.micro for testing environments
- [ ] Review costs weekly: AWS Billing Dashboard

---

## ✨ Success Criteria

Your deployment is successful when:

✅ Landing page accessible via HTTPS
✅ User signup works end-to-end
✅ User login works
✅ Dashboard loads with configured entities
✅ API endpoints respond correctly
✅ SSL certificate valid
✅ PM2 shows both apps online
✅ Database has sample data
✅ Backups configured and tested
✅ Monitoring setup
✅ Team has access credentials

---

**🎉 Congratulations on your deployment!**

Your PMO platform is now live at:
- **Primary**: `https://app.cohuron.com`
- **Alternative**: `https://pmo.cohuron.com` (if you set up this subdomain)

---

**Version**: 1.0
**Updated**: 2025-10-21
