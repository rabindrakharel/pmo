# Quick Start: Deploy Huron PMO to AWS in 1 Hour

⚡ Fastest path to get your PMO platform live on AWS EC2.

---

## Prerequisites (5 minutes)

```bash
# 1. Install tools
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip && sudo mv terraform /usr/local/bin/

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# 2. Create AWS account at https://aws.amazon.com (if needed)

# 3. Get AWS credentials from IAM Console
# IAM → Users → Add User → terraform-pmo → Programmatic access
# Attach policies: EC2Full, RDSFull, S3Full, VPCFull, IAMFull

# 4. Configure AWS CLI
aws configure
# Enter: Access Key, Secret Key, us-east-1, json

# 5. Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/pmo-key
cat ~/.ssh/pmo-key.pub  # Copy this
```

---

## Deploy Infrastructure (15 minutes)

```bash
# 1. Navigate to terraform directory
cd /home/rabin/projects/pmo/infra-tf

# 2. Create terraform.tfvars
cat > terraform.tfvars <<EOF
aws_region       = "us-east-1"
environment      = "prod"
project_name     = "pmo"
ssh_allowed_cidr = ["$(curl -s ifconfig.me)/32"]
ec2_public_key   = "PASTE_YOUR_SSH_PUBLIC_KEY_HERE"
db_password      = "$(openssl rand -base64 24)"
ec2_instance_type = "t3.medium"
db_instance_class = "db.t3.micro"
EOF

# 3. Edit and paste your SSH public key
nano terraform.tfvars  # Update ec2_public_key line

# 4. Deploy
terraform init
terraform apply -auto-approve

# 5. Save outputs
terraform output > ../deployment-info.txt
terraform output -raw ec2_public_ip > ../ec2-ip.txt
EC2_IP=$(terraform output -raw ec2_public_ip)
echo "Your EC2 IP: $EC2_IP"
```

---

## Deploy Application (30 minutes)

```bash
# 1. Wait for EC2 initialization (5 minutes)
ssh -i ~/.ssh/pmo-key -o ConnectTimeout=5 ubuntu@$EC2_IP "echo 'Ready!'"

# 2. Connect to EC2
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# 3. Wait for setup script
sudo tail -f /var/log/user-data.log
# Wait for: "Setup completed successfully!" then Ctrl+C

# 4. Setup application directory
sudo mkdir -p /opt/pmo
sudo chown -R ubuntu:ubuntu /opt/pmo
cd /opt/pmo

# 5. Copy your code (from local machine in new terminal)
rsync -avz -e "ssh -i ~/.ssh/pmo-key" /home/rabin/projects/pmo/ ubuntu@$EC2_IP:/opt/pmo/
# OR clone from GitHub:
# git clone https://github.com/YOUR_USERNAME/pmo.git .

# 6. Install dependencies (back on EC2)
npm install
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..

# 7. Get database endpoint
DB_HOST=$(aws rds describe-db-instances --db-instance-identifier pmo-db --query 'DBInstances[0].Endpoint.Address' --output text)
S3_BUCKET=$(aws s3 ls | grep pmo-artifacts | awk '{print $3}')

# 8. Configure environment
cat > apps/api/.env <<EOF
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=pmo
DB_USER=pmo_admin
DB_PASSWORD=YOUR_DB_PASSWORD_FROM_TFVARS
NODE_ENV=production
PORT=4000
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=86400
AWS_REGION=us-east-1
S3_BUCKET=$S3_BUCKET
REDIS_HOST=localhost
REDIS_PORT=6379
EOF

# Update DB_PASSWORD manually
nano apps/api/.env  # Replace YOUR_DB_PASSWORD_FROM_TFVARS

# 9. Build applications
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..

# 10. Start services
docker-compose up -d
sleep 30
./tools/db-import.sh

# 11. Create PM2 config
cat > ecosystem.config.js <<'EOF'
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
      env: { NODE_ENV: 'production', PORT: 4000 }
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
      env: { NODE_ENV: 'production' }
    }
  ]
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd  # Run the command it shows

# 12. Configure Nginx
sudo tee /etc/nginx/sites-available/pmo > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/pmo /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 13. Test
curl http://localhost/
echo "Application running at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
```

---

## Test Your Website (5 minutes)

```bash
# From your local machine
EC2_IP=$(cat /home/rabin/projects/pmo/ec2-ip.txt)

# Test in terminal
curl http://$EC2_IP/

# Test in browser
echo "Open: http://$EC2_IP"

# Test signup flow
# 1. Go to http://$EC2_IP
# 2. Click "Get Started"
# 3. Fill signup form
# 4. Select modules
# 5. Access dashboard!
```

---

## Add Custom Domain (10 minutes)

```bash
# 1. Create Route 53 Hosted Zone (AWS Console)
# Route 53 → Hosted Zones → Create → cohuron.com

# 2. Update nameservers at your registrar
# Copy 4 nameservers from Route 53
# Update at your domain registrar (where you bought cohuron.com)

# 3. Create A record
EC2_IP=$(cat /home/rabin/projects/pmo/ec2-ip.txt)

aws route53 change-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --change-batch "{
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

# 4. Wait 5-10 minutes
dig app.cohuron.com +short  # Should return EC2 IP

# 5. Setup SSL (on EC2)
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

sudo nano /etc/nginx/sites-available/pmo
# Change: server_name _; → server_name app.cohuron.com;

sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.cohuron.com --email admin@cohuron.com --agree-tos --non-interactive --redirect

# 6. Update Web app to use HTTPS
nano /opt/pmo/apps/web/.env
# Change VITE_API_URL to: https://app.cohuron.com

cd /opt/pmo/apps/web && npm run build && cd ../..
pm2 restart pmo-web

# 7. Test HTTPS
curl https://app.cohuron.com/
```

---

## Success Checklist ✅

- [ ] EC2 instance running
- [ ] Database accessible
- [ ] PM2 apps online: `pm2 status`
- [ ] Nginx running: `sudo systemctl status nginx`
- [ ] Landing page loads: `http://$EC2_IP`
- [ ] Signup works
- [ ] Login works
- [ ] Dashboard accessible
- [ ] (Optional) Custom domain working
- [ ] (Optional) HTTPS enabled

---

## Quick Commands

```bash
# SSH to server
ssh -i ~/.ssh/pmo-key ubuntu@$EC2_IP

# Check status
pm2 status
pm2 logs

# Restart apps
pm2 restart all

# Update code
cd /opt/pmo
git pull
npm install
cd apps/api && npm run build && cd ../..
cd apps/web && npm run build && cd ../..
pm2 restart all

# Check costs
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics UnblendedCost
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't SSH | Check security group allows your IP on port 22 |
| App won't start | Check logs: `pm2 logs --err` |
| Database connection | Verify DB_PASSWORD in `apps/api/.env` |
| Nginx error | `sudo nginx -t` to check config |
| Out of memory | Restart: `pm2 restart all` |
| SSL not working | `sudo certbot renew` |

---

## Cost Estimate

**Monthly**: ~$50-75
- EC2 t3.medium: $30
- RDS db.t3.micro: $15 (Free tier: $0)
- Storage & transfer: $5-20
- Route 53: $0.50

**Save money**:
- Use free tier (first 12 months)
- Stop instances when not needed
- Use smaller instances for dev/test

---

## Next Steps

1. **Read full guide**: `EC2_HOSTING_GUIDE.md`
2. **Follow checklist**: `DEPLOYMENT_CHECKLIST.md`
3. **Setup backups**: Configure automated database backups
4. **Add monitoring**: Setup CloudWatch alarms
5. **Configure email**: Replace MailHog with real SMTP
6. **Create admin users**: Add team members to platform

---

## Support

- **AWS Console**: https://console.aws.amazon.com
- **Full Documentation**: See `EC2_HOSTING_GUIDE.md`
- **Deployment Checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **Project README**: `/home/rabin/projects/pmo/README.md`

---

**🎉 Your PMO platform is live!**

Access it at:
- **Without custom domain**: `http://$EC2_IP`
- **With custom domain**: `https://app.cohuron.com`

---

**Version**: 1.0
**Deployment Time**: ~1 hour
**Updated**: 2025-10-21
