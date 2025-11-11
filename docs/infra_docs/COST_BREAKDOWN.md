# AWS Infrastructure Cost Breakdown - Huron PMO Platform

**Domain**: cohuron.com | **Region**: us-east-1 | **Updated**: January 2025

---

## 💰 Demo/Development Environment Cost

### Itemized Monthly Costs (Current Configuration)

| Service | Type/Size | Quantity | Unit Price | Monthly Cost | Annual Cost |
|---------|-----------|----------|------------|--------------|-------------|
| **EC2 Instance** | t3.medium | 1 | $0.0416/hr | **$30.37** | $364.42 |
| **RDS Database** | db.t3.micro | 1 | $0.017/hr | **$12.41** | $148.92 |
| **EBS Storage** | gp3 30 GB | 1 | $0.08/GB | **$2.40** | $28.80 |
| **RDS Storage** | gp3 20 GB | 1 | $0.115/GB | **$2.30** | $27.60 |
| **Elastic IP** | Static IP | 1 | Free (attached) | **$0.00** | $0.00 |
| **Route 53 Zone** | Hosted Zone | 1 | $0.50/zone | **$0.50** | $6.00 |
| **Route 53 Queries** | DNS Queries | ~1M | $0.40/M | **$0.40** | $4.80 |
| **S3 Storage** | Standard | ~10 GB | $0.023/GB | **$0.23** | $2.76 |
| **S3 Requests** | PUT/GET | ~10K | ~$0.005/1K | **$0.05** | $0.60 |
| **Data Transfer** | Out to Internet | ~50 GB | $0.09/GB | **$4.50** | $54.00 |
| **Backups (S3)** | Daily DB backups | ~5 GB | $0.023/GB | **$0.12** | $1.44 |
| | | | | | |
| **TOTAL** | | | | **$52.88/mo** | **$639.34/yr** |

### Cost Range: **$50 - $55 per month**

---

## 🎯 Ultra-Budget Demo Environment

**Perfect for demos, testing, or low-traffic development**

### Optimized Configuration

```hcl
# Edit terraform.tfvars
ec2_instance_type = "t3.small"      # Instead of t3.medium
db_instance_class = "db.t4g.micro"  # ARM-based (cheaper)
ec2_root_volume_size = 20           # Instead of 30 GB
```

### Ultra-Budget Cost Breakdown

| Service | Type/Size | Monthly Cost | Savings |
|---------|-----------|--------------|---------|
| **EC2 Instance** | t3.small (2 GB RAM) | **$15.18** | -$15.19 |
| **RDS Database** | db.t4g.micro (ARM) | **$10.95** | -$1.46 |
| **EBS Storage** | gp3 20 GB | **$1.60** | -$0.80 |
| **RDS Storage** | gp3 20 GB | **$2.30** | $0.00 |
| **Route 53** | Hosted Zone + Queries | **$0.90** | $0.00 |
| **S3 + Backups** | ~10 GB total | **$0.40** | $0.00 |
| **Data Transfer** | ~30 GB | **$2.70** | -$1.80 |
| | | | |
| **TOTAL** | | **$34.03/mo** | **-$19.25** |

### Annual Cost: **$408/year** (save **$231/year**)

---

## 🚀 Production Environment Cost

**For production workloads with high availability**

### Production Configuration

```hcl
# Production terraform.tfvars
ec2_instance_type = "t3.large"               # 8 GB RAM
db_instance_class = "db.t3.small"            # 2 GB RAM
db_backup_retention_period = 30              # Extended backups
# Enable Multi-AZ for database high availability
```

### Production Cost Breakdown

| Service | Type/Size | Monthly Cost | vs Demo |
|---------|-----------|--------------|---------|
| **EC2 Instance** | t3.large (8 GB RAM) | **$60.74** | +$30.37 |
| **RDS Database** | db.t3.small Multi-AZ | **$54.02** | +$41.61 |
| **EBS Storage** | gp3 50 GB | **$4.00** | +$1.60 |
| **RDS Storage** | gp3 50 GB | **$5.75** | +$3.45 |
| **Route 53** | Hosted Zone + Queries | **$1.50** | +$0.60 |
| **S3 + Backups** | ~50 GB (30-day backups) | **$1.50** | +$1.15 |
| **Data Transfer** | ~200 GB | **$18.00** | +$13.50 |
| **CloudWatch** | Monitoring & Alarms | **$10.00** | +$10.00 |
| **AWS Backup** | Automated backup service | **$5.00** | +$5.00 |
| | | | |
| **TOTAL** | | **$160.51/mo** | **+$107.63** |

### Annual Cost: **$1,926/year**

---

## 💡 Cost Optimization Strategies for Demo

### 1. **Schedule-Based Shutdown** (Save 50-75%)

**Stop instances when not in use:**

```bash
# Stop instances outside business hours
# Example: Run only 8am-6pm EST, Mon-Fri
# Monthly hours: ~40 hours/week × 4.3 weeks = ~172 hours
# Savings: (730 - 172) / 730 × $52.88 = ~$40.40 saved!
# New cost: ~$12-15/month
```

**Implementation:**
```bash
# Create Lambda function to stop/start instances
# Or use AWS Instance Scheduler
# https://aws.amazon.com/solutions/implementations/instance-scheduler/

# Manual stop/start
aws ec2 stop-instances --instance-ids <INSTANCE_ID> --profile cohuron
aws rds stop-db-instance --db-instance-identifier pmo-db --profile cohuron

# Manual start
aws ec2 start-instances --instance-ids <INSTANCE_ID> --profile cohuron
aws rds start-db-instance --db-instance-identifier pmo-db --profile cohuron
```

**Savings: ~$40/month (76% reduction!)**
**New Monthly Cost: ~$12-15**

---

### 2. **Use AWS Free Tier** (First 12 Months)

**If you have a new AWS account:**

| Service | Free Tier Benefit | Monthly Savings |
|---------|-------------------|-----------------|
| EC2 t3.micro | 750 hours/month | Not applicable* |
| RDS db.t3.micro | 750 hours/month | **$12.41** |
| EBS Storage | 30 GB gp2/gp3 | **$2.40** |
| S3 Storage | 5 GB | **$0.23** |
| Data Transfer | 100 GB out | **$4.50** |
| **Total Savings** | | **~$19.54** |

*Note: Free tier is t3.micro (1 GB RAM), but we need t3.small minimum (2 GB)

**With Free Tier: ~$33/month for first year**

---

### 3. **Reserved Instances** (1-Year Commitment)

**Save 30-40% with upfront commitment:**

| Instance | On-Demand | Reserved (1-yr) | Savings |
|----------|-----------|-----------------|---------|
| t3.small | $15.18/mo | **$10.95/mo** | 28% |
| t3.medium | $30.37/mo | **$21.90/mo** | 28% |
| db.t3.micro | $12.41/mo | **$8.76/mo** | 29% |

**With Reserved Instances:**
- Demo Config: **$40/month** (save $12.88)
- Requires 1-year commitment
- Pay upfront or monthly

---

### 4. **Spot Instances for Non-Critical Demos**

**Use Spot Instances for 70-90% savings:**

```hcl
# Spot pricing (variable, example)
# t3.medium spot: ~$9/month (instead of $30)
# Risk: Can be terminated with 2-min notice
# Good for: Non-critical demos, testing
```

**Not recommended for:**
- Production environments
- Customer-facing demos
- Persistent data workloads

---

## 📊 Cost Comparison Table

| Configuration | Monthly | Annual | Use Case |
|---------------|---------|--------|----------|
| **Ultra-Budget** | $34 | $408 | Personal testing, occasional demos |
| **Budget + Scheduling** | $12-15 | $144-180 | Part-time demos (40 hrs/week) |
| **Demo (Current)** | $53 | $636 | Full-time demo environment |
| **Demo + Free Tier** | $33 | $396 | New AWS accounts (year 1) |
| **Demo + Reserved** | $40 | $480 | Long-term demo (1-yr commit) |
| **Production** | $161 | $1,932 | Live customer environment |
| **Production HA** | $250+ | $3,000+ | Enterprise with failover |

---

## 🎓 Recommended Demo Configurations

### Option A: **Bare Minimum Demo** (~$12-15/month)

```hcl
# terraform.tfvars
ec2_instance_type = "t3.small"
db_instance_class = "db.t4g.micro"
ec2_root_volume_size = 20
```

**Plus:**
- Stop instances outside demo hours (8am-6pm EST, Mon-Fri)
- Start only when showing demos

**Best for:**
- Internal testing
- Occasional customer demos (scheduled)
- Budget-conscious projects

---

### Option B: **Always-On Demo** (~$34/month)

```hcl
# terraform.tfvars
ec2_instance_type = "t3.small"
db_instance_class = "db.t4g.micro"
ec2_root_volume_size = 20
```

**Keep running 24/7**

**Best for:**
- Continuous access needed
- Multiple stakeholders
- Different time zones
- Quick demo readiness

---

### Option C: **Current Demo Config** (~$53/month)

```hcl
# terraform.tfvars (current)
ec2_instance_type = "t3.medium"
db_instance_class = "db.t3.micro"
ec2_root_volume_size = 30
```

**Best for:**
- Performance-sensitive demos
- Multiple concurrent users
- Realistic production simulation
- Load testing

---

## 📈 Hidden/Unexpected Costs to Watch

| Item | Typical Cost | How to Avoid |
|------|--------------|--------------|
| **Elastic IP (unattached)** | $3.60/mo | Keep attached to running instance |
| **EBS Snapshots** | $0.05/GB/mo | Delete old snapshots regularly |
| **NAT Gateway** | $32/mo | Use VPC endpoints instead |
| **CloudWatch Logs** | $0.50/GB | Set retention to 7 days for demo |
| **Data Transfer (Inter-AZ)** | $0.01/GB | Keep app and DB in same AZ |
| **Unused Load Balancer** | $16/mo | Not included in current setup ✓ |

**Our setup avoids most hidden costs!**

---

## 🔍 Real Cost Examples (First 3 Months)

### Scenario 1: New AWS Account + Ultra-Budget

```
Month 1 (Free Tier):  $20  (only EC2 t3.small charged)
Month 2 (Free Tier):  $20
Month 3 (Free Tier):  $20
Months 4-12:          $34/mo
Year 1 Average:       $27/mo
```

### Scenario 2: Current Config + Scheduling

```
Month 1:  $53  (learning, running 24/7)
Month 2:  $15  (scheduled 40 hrs/week)
Month 3:  $15  (scheduled)
Average:  $28/mo for first quarter
```

### Scenario 3: Current Config + Reserved Instances

```
Upfront Payment:  $263  (1-year t3.medium reserved)
Monthly:          $40
Year 1 Total:     $743  (vs $636 on-demand)
Break-even:       Not worth it for demo
```

---

## 💰 Absolute Minimum Cost

**Lowest possible monthly cost:**

```hcl
# Minimum viable configuration
ec2_instance_type = "t3.micro"      # $6.57/mo (warning: only 1 GB RAM!)
db_instance_class = "db.t4g.micro"  # $10.95/mo
ec2_root_volume_size = 8            # $0.64/mo (minimum for OS)

# Run 8 hours/day, 5 days/week
# Monthly hours: ~40 × 4.3 = 172 hours
```

**Calculation:**
- EC2: $6.57 × (172/730) = **$1.55**
- RDS: $10.95 × (172/730) = **$2.58**
- Storage: **$3.94**
- Route 53: **$0.90**
- S3: **$0.40**

**TOTAL: ~$9.37/month**

**Trade-offs:**
- ⚠️ Very slow (1 GB RAM)
- ⚠️ Limited availability (40 hrs/week)
- ⚠️ May crash under load
- ✅ Great for personal testing

---

## 🎯 Recommended: **$34/month Always-On Demo**

**Why this is the sweet spot:**

✅ **Affordable**: Only $408/year
✅ **Reliable**: t3.small handles typical demo loads
✅ **Always Available**: No scheduling needed
✅ **Professional**: Fast enough for client demos
✅ **Scalable**: Easy upgrade path to production

**Configuration:**
```hcl
ec2_instance_type = "t3.small"      # 2 GB RAM
db_instance_class = "db.t4g.micro"  # 1 GB RAM (ARM)
ec2_root_volume_size = 20           # 20 GB storage
```

---

## 📝 Cost Tracking Commands

```bash
# Check current month's bill
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --profile cohuron

# Set up billing alert (free)
aws cloudwatch put-metric-alarm \
  --alarm-name MonthlyBillingAlert \
  --alarm-description "Alert when monthly charges exceed $60" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 60 \
  --comparison-operator GreaterThanThreshold \
  --profile cohuron

# Install cost tracking tool
pip install awscli-plugin-cost-estimator
```

---

## 🎁 Additional Free AWS Services (Included)

These are **FREE** and already included in setup:

- **CloudWatch Logs**: 5 GB/month
- **AWS Systems Manager**: Free tier included
- **VPC**: No charge for VPC itself
- **Security Groups**: Free
- **IAM**: Free (unlimited users/roles)
- **Route 53 Health Checks**: First 50 free

---

## 📊 Summary & Recommendations

| Use Case | Configuration | Monthly Cost | Best For |
|----------|---------------|--------------|----------|
| 🏃 **Quick Testing** | t3.micro + schedule | **$9-12** | Personal dev |
| 💼 **Professional Demo** | t3.small + 24/7 | **$34** | ⭐ **RECOMMENDED** |
| 🚀 **Current Setup** | t3.medium + 24/7 | **$53** | Performance demos |
| 🏢 **Production** | t3.large + Multi-AZ | **$161** | Live customers |

---

## 🔗 Quick Links

- **AWS Pricing Calculator**: https://calculator.aws
- **AWS Cost Explorer**: https://console.aws.amazon.com/cost-management/
- **AWS Free Tier**: https://aws.amazon.com/free/
- **Instance Pricing**: https://aws.amazon.com/ec2/pricing/
- **RDS Pricing**: https://aws.amazon.com/rds/postgresql/pricing/

---

**Last Updated**: January 2025
**Region**: us-east-1 (US East N. Virginia)
**Currency**: USD

**Note**: Prices may vary by region and are subject to change. Use AWS Pricing Calculator for latest estimates.
