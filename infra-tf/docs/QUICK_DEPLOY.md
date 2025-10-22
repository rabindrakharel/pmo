# 🚀 Quick Deploy - Huron PMO on cohuron.com

Single `terraform apply` deployment guide. Complete AWS infrastructure in ~15 minutes.

---

## Prerequisites Checklist

```bash
# Check required tools are installed
terraform --version  # Should show >= 1.0
aws --version        # Should show AWS CLI v2
ssh-keygen --help    # Should be available
```

---

## Step 1: Generate SSH Key (2 minutes)

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/pmo-key -C "pmo@cohuron.com"

# Press Enter for default location
# Press Enter twice for no passphrase (or set one if you prefer)

# View public key (you'll need this next)
cat ~/.ssh/pmo-key.pub
```

**Copy the entire output** - you'll paste this into terraform.tfvars

---

## Step 2: Configure AWS Profile (3 minutes)

```bash
# Configure AWS CLI profile named "cohuron"
aws configure --profile cohuron
```

Enter when prompted:
- **AWS Access Key ID**: [Your AWS access key]
- **AWS Secret Access Key**: [Your AWS secret]
- **Default region**: `us-east-1`
- **Default output**: `json`

**Get credentials from:** AWS Console → IAM → Users → [Your User] → Security Credentials → Create Access Key

```bash
# Verify it works
aws sts get-caller-identity --profile cohuron
```

---

## Step 3: Configure Terraform Variables (5 minutes)

```bash
# Navigate to Terraform directory
cd /home/rabin/projects/pmo/infra-tf

# Copy example to create your config
cp terraform.tfvars.example terraform.tfvars

# Edit the file
nano terraform.tfvars
```

**Update these 3 REQUIRED values:**

```hcl
# 1. Paste your SSH public key from Step 1
ec2_public_key = "ssh-rsa AAAAB3NzaC1yc2EA... pmo@cohuron.com"

# 2. Generate and set strong database password
db_password = "YOUR_STRONG_PASSWORD_HERE"

# 3. Restrict SSH to your IP (find with: curl ifconfig.me)
ssh_allowed_cidr = ["YOUR_IP/32"]
```

**Quick password generation:**
```bash
# Generate random password
openssl rand -base64 32

# Find your public IP
curl ifconfig.me
```

**Optional - Enable automatic code deployment:**
```hcl
# Set your GitHub repo URL for auto-deployment
github_repo_url = "https://github.com/yourusername/pmo.git"
```

Save and exit (Ctrl+X, Y, Enter in nano)

---

## Step 4: Deploy Infrastructure (15 minutes)

```bash
# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy everything!
terraform apply
```

**Type `yes` when prompted**

**What gets created:**
- VPC with public/private subnets
- EC2 instance (t3.medium) with application
- RDS PostgreSQL database (db.t3.micro)
- S3 bucket for artifacts
- Route 53 hosted zone for cohuron.com
- Security groups, IAM roles, EIP

**Timeline:**
- 0-2 min: VPC and networking
- 2-5 min: S3 bucket
- 5-10 min: RDS database
- 10-15 min: EC2 instance + app deployment

---

## Step 5: Update Domain Nameservers (10 minutes + propagation)

**Copy nameservers from Terraform output:**

```
name_servers = [
  "ns-123.awsdns-45.com",
  "ns-678.awsdns-90.net",
  "ns-1234.awsdns-56.org",
  "ns-5678.awsdns-12.co.uk"
]
```

**Update at your domain registrar:**

1. Go to where you registered **cohuron.com** (GoDaddy, Namecheap, etc.)
2. Find DNS/Nameserver settings
3. Replace with the 4 AWS nameservers above
4. Save changes

**Wait 5-60 minutes for DNS propagation**

```bash
# Check DNS status (repeat until it shows EC2 IP)
dig app.cohuron.com +short

# Should eventually show:
# 54.123.456.78
```

---

## Step 6: Setup SSL Certificate (2 minutes)

**Once DNS propagates:**

```bash
# SSH into EC2 (IP from terraform output)
ssh -i ~/.ssh/pmo-key ubuntu@54.123.456.78

# Run SSL setup script
sudo /root/setup-ssl.sh

# Takes ~30 seconds
# Obtains Let's Encrypt certificate
# Configures Nginx for HTTPS
# Enables auto-renewal
```

---

## Step 7: Access Your Application ✅

**Your app is live!**

- **Application**: https://app.cohuron.com
- **Signup**: https://app.cohuron.com/signup
- **Login**: https://app.cohuron.com/login
- **API Docs**: https://app.cohuron.com/docs

**Test Account:**
```
Email: james.miller@huronhome.ca
Password: password123
```

---

## Management Commands

**SSH Access:**
```bash
ssh -i ~/.ssh/pmo-key ubuntu@<ec2-ip>
```

**On the server:**
```bash
pmo-status    # Check all services
pmo-logs      # View application logs
pmo-restart   # Restart all services
pmo-backup    # Manual database backup
```

**View logs for specific service:**
```bash
pmo-logs api  # API logs only
pmo-logs web  # Web logs only
```

---

## Complete Command Sequence (Copy-Paste)

```bash
# 1. Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/pmo-key -C "pmo@cohuron.com"
cat ~/.ssh/pmo-key.pub  # Copy this output

# 2. Configure AWS
aws configure --profile cohuron
aws sts get-caller-identity --profile cohuron  # Verify

# 3. Setup Terraform
cd /home/rabin/projects/pmo/infra-tf
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Edit: ec2_public_key, db_password, ssh_allowed_cidr

# 4. Deploy
terraform init
terraform plan
terraform apply  # Type: yes

# 5. Update nameservers at domain registrar with output values

# 6. Wait for DNS, then setup SSL
dig app.cohuron.com +short  # Check DNS
ssh -i ~/.ssh/pmo-key ubuntu@<EC2_IP>
sudo /root/setup-ssl.sh

# 7. Access app
# https://app.cohuron.com
```

---

## Cost Estimate

**~$55-65/month** for this configuration:
- EC2 t3.medium: ~$30/mo
- RDS db.t3.micro: ~$15/mo
- Storage + Data: ~$10/mo
- Route 53: ~$0.50/mo

**Optimize costs:**
- Change to `t3.small` EC2 (~$15/mo) for dev
- Use `db.t4g.micro` RDS (~$12/mo) for lighter loads

---

## Troubleshooting

**Can't connect to AWS:**
```bash
aws sts get-caller-identity --profile cohuron
# If fails: check access keys in ~/.aws/credentials
```

**Terraform errors:**
```bash
terraform validate  # Check syntax
terraform plan      # See what's wrong
```

**Can't SSH:**
```bash
chmod 400 ~/.ssh/pmo-key  # Fix permissions
# Check ssh_allowed_cidr includes your IP
```

**App not accessible:**
```bash
# Check DNS first
dig app.cohuron.com +short

# SSH and check services
ssh -i ~/.ssh/pmo-key ubuntu@<IP>
pmo-status
pmo-logs
```

**SSL fails:**
```bash
# DNS must propagate first!
dig app.cohuron.com +short  # Must show EC2 IP

# Try again
sudo /root/setup-ssl.sh
```

---

## What Just Happened?

1. ✅ Created complete AWS infrastructure
2. ✅ Deployed Huron PMO application
3. ✅ Configured Route 53 DNS for app.cohuron.com
4. ✅ Installed and configured:
   - Node.js 20 + pnpm
   - Docker + Docker Compose
   - PostgreSQL 14 (via RDS)
   - Redis, MinIO, MailHog (via Docker)
   - Nginx reverse proxy
   - PM2 process manager
   - Let's Encrypt SSL
   - Automated backups
5. ✅ Set up helper scripts (pmo-status, pmo-logs, etc.)

---

## Next Steps

- [ ] Create additional admin accounts
- [ ] Configure application settings
- [ ] Import your data
- [ ] Set up monitoring (CloudWatch)
- [ ] Configure backups schedule
- [ ] Review security settings
- [ ] Set spending alerts (AWS Budgets)

---

## Destroy Everything

**⚠️ WARNING: Deletes ALL data!**

```bash
# Backup first!
ssh -i ~/.ssh/pmo-key ubuntu@<IP>
pmo-backup

# Destroy infrastructure
cd /home/rabin/projects/pmo/infra-tf
terraform destroy  # Type: yes

# Revert nameservers at domain registrar
```

---

## Support

- **Full Setup Guide**: [AWS_SETUP.md](./AWS_SETUP.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Deployment Details**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Main README**: [../README.md](../README.md)

---

**You now have a production-ready PMO platform running at https://app.cohuron.com! 🎉**
