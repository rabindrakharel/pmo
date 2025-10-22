# Infrastructure Improvements & Production Readiness Guide

**Huron PMO Platform - AWS Infrastructure Enhancement Roadmap**
Domain: cohuron.com | Current Cost: ~$55-65/month | Target: Production-Ready

---

## Executive Summary

This document outlines critical gaps and recommended improvements for the Huron PMO platform infrastructure. The current setup provides a solid foundation but lacks several **production-essential components** for high availability, security, monitoring, and operational excellence.

**Current State:**
- ✅ Basic VPC with public/private subnets
- ✅ Single EC2 instance with Elastic IP
- ✅ RDS PostgreSQL in private subnet
- ✅ S3 bucket for artifacts
- ✅ Route 53 DNS management
- ⚠️ Local Terraform state (high risk)
- ⚠️ Manual SSL certificate management
- ⚠️ No monitoring or alerting
- ⚠️ No auto-scaling or load balancing
- ⚠️ Single point of failure

---

## Table of Contents

1. [Critical Missing Components](#1-critical-missing-components)
2. [Important Missing Components](#2-important-missing-components)
3. [Nice-to-Have Components](#3-nice-to-have-components)
4. [Configuration Improvements](#4-configuration-improvements)
5. [Cost Impact Summary](#5-cost-impact-summary)
6. [Implementation Phases](#6-implementation-phases)
7. [Quick Wins](#7-quick-wins)
8. [Implementation Guides](#8-implementation-guides)

---

## 1. Critical Missing Components

### 1.1 Terraform State Management ⚠️ HIGHEST PRIORITY

**Current State:** Local backend at `terraform.tfstate`
**Location:** `main.tf:16-18`

**Risk:**
- State file contains sensitive data (DB passwords, IPs)
- No team collaboration possible
- State file loss = infrastructure becomes unmanageable
- No state locking = concurrent terraform apply can corrupt state

**Solution:** Remote S3 backend with DynamoDB locking

**Implementation:**

```hcl
# main.tf - Replace local backend
terraform {
  backend "s3" {
    bucket         = "pmo-terraform-state-<account-id>"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "pmo-terraform-locks"

    # Optional: Add versioning
    versioning     = true
  }
}
```

**One-time setup commands:**

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create S3 bucket for state
aws s3 mb s3://pmo-terraform-state-${ACCOUNT_ID} --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket pmo-terraform-state-${ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket pmo-terraform-state-${ACCOUNT_ID} \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket pmo-terraform-state-${ACCOUNT_ID} \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name pmo-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Migrate existing state
terraform init -migrate-state
```

**Cost:** ~$1-2/month
**Priority:** Critical - Do immediately
**Effort:** 30 minutes

---

### 1.2 AWS Secrets Manager

**Current State:** Database password in `terraform.tfvars` (unencrypted file)
**Location:** `variables.tf:126-130`

**Risk:**
- Secrets in plain text files
- Risk of accidental git commit
- No rotation mechanism
- No audit trail

**Solution:** AWS Secrets Manager with automatic rotation

**Implementation:**

Create `modules/secrets/main.tf`:

```hcl
# ============================================================================
# Secrets Manager Module - Coherent PMO Platform
# ============================================================================

resource "aws_secretsmanager_secret" "db_master" {
  name                    = "${var.project_name}-db-master-${var.environment}"
  description             = "RDS master credentials for ${var.project_name}"
  recovery_window_in_days = 7  # Can be recovered within 7 days if deleted

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-db-master-secret"
  })
}

resource "aws_secretsmanager_secret_version" "db_master" {
  secret_id = aws_secretsmanager_secret.db_master.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    engine   = "postgres"
    host     = var.db_host
    port     = var.db_port
    dbname   = var.db_name
  })
}

# Application API keys
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${var.project_name}-app-secrets-${var.environment}"
  description             = "Application secrets (JWT, API keys, etc.)"
  recovery_window_in_days = 7

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-app-secrets"
  })
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    jwt_secret     = var.jwt_secret
    encryption_key = var.encryption_key
    api_key        = var.api_key
  })
}

# Rotation configuration (optional but recommended)
resource "aws_secretsmanager_secret_rotation" "db_master" {
  count = var.enable_secret_rotation ? 1 : 0

  secret_id           = aws_secretsmanager_secret.db_master.id
  rotation_lambda_arn = aws_lambda_function.rotate_secret[0].arn

  rotation_rules {
    automatically_after_days = 30
  }
}
```

Create `modules/secrets/variables.tf`:

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_host" {
  type = string
}

variable "db_port" {
  type    = number
  default = 5432
}

variable "db_name" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "encryption_key" {
  type      = string
  sensitive = true
}

variable "api_key" {
  type      = string
  sensitive = true
}

variable "enable_secret_rotation" {
  type    = bool
  default = false
}

variable "global_tags" {
  type = map(string)
}
```

Create `modules/secrets/outputs.tf`:

```hcl
output "db_secret_arn" {
  description = "ARN of database credentials secret"
  value       = aws_secretsmanager_secret.db_master.arn
}

output "db_secret_name" {
  description = "Name of database credentials secret"
  value       = aws_secretsmanager_secret.db_master.name
}

output "app_secret_arn" {
  description = "ARN of application secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "app_secret_name" {
  description = "Name of application secrets"
  value       = aws_secretsmanager_secret.app_secrets.name
}
```

**Update main.tf to use Secrets Manager:**

```hcl
# Add to main.tf
module "secrets" {
  source = "./modules/secrets"

  project_name    = var.project_name
  environment     = var.environment
  db_username     = var.db_username
  db_password     = var.db_password
  db_host         = module.rds.db_address
  db_port         = module.rds.db_port
  db_name         = var.db_name
  jwt_secret      = var.jwt_secret
  encryption_key  = var.encryption_key
  api_key         = var.api_key
  global_tags     = var.global_tags
}

# Update EC2 IAM policy to allow reading secrets
resource "aws_iam_role_policy" "ec2_secrets_policy" {
  name = "${var.project_name}-ec2-secrets-policy"
  role = module.ec2.ec2_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          module.secrets.db_secret_arn,
          module.secrets.app_secret_arn
        ]
      }
    ]
  })
}
```

**Update application to read from Secrets Manager:**

```javascript
// In your API startup (apps/api/src/config/database.ts)
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

async function getDatabaseCredentials() {
  if (process.env.NODE_ENV === 'development') {
    return {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };
  }

  const client = new SecretsManagerClient({ region: "us-east-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: "pmo-db-master-prod" })
  );

  return JSON.parse(response.SecretString);
}
```

**Cost:** $0.40/secret/month + $0.05 per 10,000 API calls = ~$1-2/month
**Priority:** Critical
**Effort:** 1-2 hours

---

### 1.3 ACM Certificate Management

**Current State:** Manual Let's Encrypt certificate via SSH
**Location:** Referenced in `outputs.tf:189-192`

**Risk:**
- Manual renewal required every 90 days
- SSH access needed for renewal
- Not integrated with AWS
- Certificate not validated/managed by AWS

**Solution:** AWS Certificate Manager with automated validation and renewal

**Implementation:**

Create `modules/acm/main.tf`:

```hcl
# ============================================================================
# ACM Certificate Module - Automated SSL/TLS Management
# ============================================================================

resource "aws_acm_certificate" "app" {
  domain_name       = "${var.app_subdomain}.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [
    var.domain_name,
    "*.${var.domain_name}"  # Wildcard for all subdomains
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-certificate"
  })
}

# Automatic DNS validation with Route 53
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }
}
```

Create `modules/acm/variables.tf`:

```hcl
variable "project_name" {
  type = string
}

variable "domain_name" {
  type = string
}

variable "app_subdomain" {
  type = string
}

variable "hosted_zone_id" {
  type = string
}

variable "global_tags" {
  type = map(string)
}
```

Create `modules/acm/outputs.tf`:

```hcl
output "certificate_arn" {
  description = "ARN of ACM certificate"
  value       = aws_acm_certificate.app.arn
}

output "certificate_domain" {
  description = "Domain name of certificate"
  value       = aws_acm_certificate.app.domain_name
}

output "certificate_status" {
  description = "Status of certificate validation"
  value       = aws_acm_certificate_validation.app.certificate_arn
}
```

**Add to main.tf:**

```hcl
module "acm" {
  count  = var.create_dns_records ? 1 : 0
  source = "./modules/acm"

  project_name    = var.project_name
  domain_name     = var.domain_name
  app_subdomain   = var.app_subdomain
  hosted_zone_id  = module.route53[0].hosted_zone_id
  global_tags     = var.global_tags

  depends_on = [module.route53]
}
```

**Cost:** FREE (ACM certificates are free when used with AWS services)
**Priority:** Critical
**Effort:** 30 minutes

---

### 1.4 Application Load Balancer (ALB)

**Current State:** Direct traffic to EC2 on ports 80, 443, 4000, 5173
**Location:** `modules/vpc/main.tf:146-180` and `modules/route53/main.tf:24`

**Risk:**
- Single point of failure
- No SSL termination at edge
- Application ports exposed to internet
- Cannot auto-scale
- No health checks
- No DDoS protection

**Solution:** Application Load Balancer with SSL termination

**Implementation:**

Create `modules/alb/main.tf`:

```hcl
# ============================================================================
# Application Load Balancer Module
# ============================================================================

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  # HTTP
  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-alb-sg"
  })
}

# Application Load Balancer
resource "aws_lb" "app" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection       = var.environment == "prod"
  enable_cross_zone_load_balancing = true
  enable_http2                     = true
  enable_waf_fail_open            = false

  drop_invalid_header_fields = true

  access_logs {
    bucket  = var.access_logs_bucket
    prefix  = "alb"
    enabled = var.enable_access_logs
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-alb"
  })
}

# Target Group for Web Application
resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-app-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  deregistration_delay = 30

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/v1/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400  # 24 hours
    enabled         = true
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-app-tg"
  })
}

# Register EC2 instance(s)
resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = var.ec2_instance_id
  port             = 80
}

# HTTPS Listener (443) - Primary
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-https-listener"
  })
}

# HTTP Listener (80) - Redirect to HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-http-listener"
  })
}

# Custom header rule for API
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# Custom rule for health check
resource "aws_lb_listener_rule" "health" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/health", "/api/v1/health"]
    }
  }
}
```

Create `modules/alb/variables.tf`:

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "ec2_instance_id" {
  type = string
}

variable "acm_certificate_arn" {
  type = string
}

variable "access_logs_bucket" {
  type    = string
  default = ""
}

variable "enable_access_logs" {
  type    = bool
  default = false
}

variable "global_tags" {
  type = map(string)
}
```

Create `modules/alb/outputs.tf`:

```hcl
output "alb_arn" {
  description = "ARN of Application Load Balancer"
  value       = aws_lb.app.arn
}

output "alb_dns_name" {
  description = "DNS name of Application Load Balancer"
  value       = aws_lb.app.dns_name
}

output "alb_zone_id" {
  description = "Route 53 zone ID of ALB"
  value       = aws_lb.app.zone_id
}

output "alb_security_group_id" {
  description = "Security group ID of ALB"
  value       = aws_security_group.alb.id
}

output "target_group_arn" {
  description = "ARN of target group"
  value       = aws_lb_target_group.app.arn
}
```

**Update main.tf:**

```hcl
module "alb" {
  count  = var.create_dns_records ? 1 : 0
  source = "./modules/alb"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  public_subnet_ids    = module.vpc.public_subnet_ids
  ec2_instance_id      = module.ec2.instance_id
  acm_certificate_arn  = module.acm[0].certificate_arn
  enable_access_logs   = var.environment == "prod"
  access_logs_bucket   = module.s3.bucket_name
  global_tags          = var.global_tags

  depends_on = [module.ec2, module.acm]
}
```

**Update Route 53 to use ALB:**

```hcl
# In modules/route53/main.tf - Update app record
resource "aws_route53_record" "app" {
  count = var.create_app_record ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = var.app_subdomain
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
```

**Update EC2 security group (remove public access):**

```hcl
# In modules/vpc/main.tf - Replace app_sg ingress rules
resource "aws_security_group" "app_sg" {
  # ... existing config ...

  # REMOVE these public ingress rules:
  # - Port 80 from 0.0.0.0/0
  # - Port 443 from 0.0.0.0/0
  # - Port 4000 from 0.0.0.0/0
  # - Port 5173 from 0.0.0.0/0

  # ADD: Allow traffic only from ALB
  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  # Keep SSH for emergency access (or use Session Manager)
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidr
  }

  # ... existing egress rules ...
}
```

**Cost:** ~$16-20/month (ALB pricing: $0.0225/hour + data transfer)
**Priority:** High
**Effort:** 2-3 hours

---

### 1.5 CloudWatch Monitoring & Alarms

**Current State:** No monitoring or alerting configured

**Risk:**
- No visibility into system health
- Cannot detect issues proactively
- No alerts for critical failures
- No operational metrics

**Solution:** Comprehensive CloudWatch monitoring with alarms

**Implementation:**

Create `modules/monitoring/main.tf`:

```hcl
# ============================================================================
# CloudWatch Monitoring Module
# ============================================================================

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "ec2_app" {
  name              = "/aws/ec2/${var.project_name}/application"
  retention_in_days = var.environment == "prod" ? 30 : 7
  kms_key_id        = var.enable_encryption ? aws_kms_key.logs[0].arn : null

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ec2-logs"
  })
}

resource "aws_cloudwatch_log_group" "ec2_system" {
  name              = "/aws/ec2/${var.project_name}/system"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-ec2-system-logs"
  })
}

resource "aws_cloudwatch_log_group" "rds" {
  name              = "/aws/rds/${var.project_name}"
  retention_in_days = 30

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-rds-logs"
  })
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"

  kms_master_key_id = var.enable_encryption ? aws_kms_key.sns[0].arn : null

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-alerts"
  })
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Optional: Slack notification
resource "aws_sns_topic_subscription" "slack" {
  count = var.slack_webhook_url != "" ? 1 : 0

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# ============================================================================
# EC2 Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "${var.project_name}-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EC2 CPU utilization above 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "ec2_cpu_critical" {
  alarm_name          = "${var.project_name}-ec2-cpu-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "95"
  alarm_description   = "EC2 CPU utilization above 95% - CRITICAL"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "ec2_memory_high" {
  count = var.enable_custom_metrics ? 1 : 0

  alarm_name          = "${var.project_name}-ec2-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "mem_used_percent"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EC2 memory utilization above 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "ec2_disk_high" {
  count = var.enable_custom_metrics ? 1 : 0

  alarm_name          = "${var.project_name}-ec2-disk-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "disk_used_percent"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EC2 disk utilization above 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.ec2_instance_id
    path       = "/"
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "ec2_status_check_failed" {
  alarm_name          = "${var.project_name}-ec2-status-check-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "EC2 status check failed"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  tags = var.global_tags
}

# ============================================================================
# RDS Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project_name}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "RDS CPU utilization above 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "${var.project_name}-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000000000"  # 5 GB in bytes
  alarm_description   = "RDS free storage below 5 GB"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.project_name}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "RDS database connections above 80"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_freeable_memory_low" {
  alarm_name          = "${var.project_name}-rds-memory-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "262144000"  # 250 MB in bytes
  alarm_description   = "RDS freeable memory below 250 MB"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_read_latency_high" {
  alarm_name          = "${var.project_name}-rds-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.1"  # 100ms
  alarm_description   = "RDS read latency above 100ms"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_write_latency_high" {
  alarm_name          = "${var.project_name}-rds-write-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.1"  # 100ms
  alarm_description   = "RDS write latency above 100ms"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = var.global_tags
}

# ============================================================================
# ALB Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "alb_target_response_time" {
  count = var.alb_target_group_arn != "" ? 1 : 0

  alarm_name          = "${var.project_name}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"  # 1 second
  alarm_description   = "ALB target response time above 1 second"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_targets" {
  count = var.alb_target_group_arn != "" ? 1 : 0

  alarm_name          = "${var.project_name}-alb-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "ALB has unhealthy targets"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.alb_target_group_arn_suffix
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  count = var.alb_target_group_arn != "" ? 1 : 0

  alarm_name          = "${var.project_name}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "More than 10 5XX errors in 5 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = var.global_tags
}

# ============================================================================
# Application-Level Alarms (Custom Metrics)
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "app_error_rate_high" {
  count = var.enable_custom_metrics ? 1 : 0

  alarm_name          = "${var.project_name}-app-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ErrorRate"
  namespace           = var.project_name
  period              = "300"
  statistic           = "Average"
  threshold           = "5"  # 5% error rate
  alarm_description   = "Application error rate above 5%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = var.global_tags
}

# ============================================================================
# CloudWatch Dashboard
# ============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", { stat = "Average", label = "EC2 CPU" }],
            ["AWS/RDS", "CPUUtilization", { stat = "Average", label = "RDS CPU" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "CPU Utilization"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", { stat = "Average" }],
            [".", "FreeStorageSpace", { stat = "Average", yAxis = "right" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Metrics"
        }
      },
      {
        type = "log"
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.ec2_app.name}' | fields @timestamp, @message | sort @timestamp desc | limit 20"
          region  = var.aws_region
          title   = "Recent Application Logs"
        }
      }
    ]
  })
}

# ============================================================================
# KMS Keys for Encryption (Optional)
# ============================================================================

resource "aws_kms_key" "logs" {
  count = var.enable_encryption ? 1 : 0

  description             = "KMS key for CloudWatch Logs encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-logs-key"
  })
}

resource "aws_kms_alias" "logs" {
  count = var.enable_encryption ? 1 : 0

  name          = "alias/${var.project_name}-logs"
  target_key_id = aws_kms_key.logs[0].key_id
}

resource "aws_kms_key" "sns" {
  count = var.enable_encryption ? 1 : 0

  description             = "KMS key for SNS encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-sns-key"
  })
}
```

Create `modules/monitoring/variables.tf`:

```hcl
variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "ec2_instance_id" {
  type = string
}

variable "rds_instance_id" {
  type = string
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts (optional)"
  type        = string
  default     = ""
}

variable "enable_custom_metrics" {
  description = "Enable custom application metrics"
  type        = bool
  default     = false
}

variable "enable_encryption" {
  description = "Enable KMS encryption for logs and SNS"
  type        = bool
  default     = false
}

variable "alb_target_group_arn" {
  description = "ARN of ALB target group"
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  description = "ARN suffix of ALB for CloudWatch metrics"
  type        = string
  default     = ""
}

variable "alb_target_group_arn_suffix" {
  description = "ARN suffix of target group for CloudWatch metrics"
  type        = string
  default     = ""
}

variable "global_tags" {
  type = map(string)
}
```

Create `modules/monitoring/outputs.tf`:

```hcl
output "sns_topic_arn" {
  description = "ARN of SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  description = "URL to CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "log_group_names" {
  description = "CloudWatch log group names"
  value = {
    ec2_app    = aws_cloudwatch_log_group.ec2_app.name
    ec2_system = aws_cloudwatch_log_group.ec2_system.name
    rds        = aws_cloudwatch_log_group.rds.name
  }
}
```

**Add to main.tf:**

```hcl
module "monitoring" {
  source = "./modules/monitoring"

  project_name    = var.project_name
  environment     = var.environment
  aws_region      = var.aws_region
  ec2_instance_id = module.ec2.instance_id
  rds_instance_id = module.rds.db_instance_id
  alert_email     = var.alert_email

  # Optional ALB metrics
  alb_target_group_arn         = var.create_dns_records ? module.alb[0].target_group_arn : ""
  alb_arn_suffix               = var.create_dns_records ? module.alb[0].alb_arn_suffix : ""
  alb_target_group_arn_suffix  = var.create_dns_records ? module.alb[0].target_group_arn_suffix : ""

  enable_custom_metrics = var.environment == "prod"
  enable_encryption     = var.environment == "prod"
  global_tags          = var.global_tags

  depends_on = [module.ec2, module.rds]
}
```

**Add to variables.tf:**

```hcl
variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
}
```

**Add to terraform.tfvars.example:**

```hcl
# CloudWatch Alerts
alert_email = "ops@huronhome.ca"
```

**Cost:** ~$5-10/month (10 alarms free, then $0.10/alarm/month + log storage)
**Priority:** High
**Effort:** 2-3 hours

---

## 2. Important Missing Components

### 2.1 ElastiCache Redis

**Current State:** Redis running on EC2 via Docker (not persistent, not HA)

**Risk:**
- Data loss on EC2 restart
- No high availability
- No automatic backups
- Performance bottleneck

**Solution:** AWS ElastiCache for Redis

Create `modules/elasticache/main.tf`:

```hcl
# ============================================================================
# ElastiCache Redis Module
# ============================================================================

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-redis-subnet"
  })
}

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from app server"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-redis-sg"
  })
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-redis"
  replication_group_description = "Redis cluster for ${var.project_name}"

  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = var.node_type
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.redis.name

  # High Availability
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled          = var.environment == "prod"

  # Security
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled        = true
  auth_token                = var.redis_auth_token

  # Backups
  snapshot_retention_limit   = var.environment == "prod" ? 5 : 1
  snapshot_window            = "03:00-05:00"
  maintenance_window         = "sun:05:00-sun:07:00"

  # Auto-upgrade
  auto_minor_version_upgrade = true

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-redis"
  })
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.project_name}-redis-params"
  family = "redis7"

  # Optimize for your workload
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Evict least recently used keys
  }

  parameter {
    name  = "timeout"
    value = "300"  # Close idle connections after 5 minutes
  }

  tags = var.global_tags
}

resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/aws/elasticache/${var.project_name}/redis-slow"
  retention_in_days = 7

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-redis-slow-log"
  })
}

resource "aws_cloudwatch_log_group" "redis_engine" {
  name              = "/aws/elasticache/${var.project_name}/redis-engine"
  retention_in_days = 7

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-redis-engine-log"
  })
}
```

**Cost:** ~$12-15/month (cache.t3.micro)
**Priority:** Medium-High
**Effort:** 1-2 hours

---

### 2.2 WAF (Web Application Firewall)

**Current State:** No WAF protection

**Risk:**
- No protection against common web attacks (SQL injection, XSS)
- No rate limiting
- No geographic restrictions
- No bot protection

**Solution:** AWS WAF v2

Create `modules/waf/main.tf`:

```hcl
# ============================================================================
# WAF Module - Web Application Firewall
# ============================================================================

resource "aws_wafv2_web_acl" "app" {
  name  = "${var.project_name}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting - Prevent DDoS
  rule {
    name     = "RateLimitRule"
    priority = 1

    statement {
      rate_based_statement {
        limit              = 2000  # requests per 5 minutes
        aggregate_key_type = "IP"

        scope_down_statement {
          not_statement {
            statement {
              byte_match_statement {
                positional_constraint = "STARTS_WITH"
                field_to_match {
                  uri_path {}
                }
                search_string = "/api/v1/health"
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }
        }
      }
    }

    action {
      block {
        custom_response {
          response_code = 429
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude rules if needed
        # excluded_rule {
        #   name = "SizeRestrictions_BODY"
        # }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - SQL Injection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-sqli"
      sampled_requests_enabled   = true
    }
  }

  # Geographic restriction (optional)
  rule {
    name     = "GeoBlockRule"
    priority = 5

    statement {
      geo_match_statement {
        country_codes = var.blocked_countries
      }
    }

    action {
      block {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-geo-block"
      sampled_requests_enabled   = true
    }
  }

  # IP Reputation List
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 6

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  # Bot Control (optional - additional cost)
  dynamic "rule" {
    for_each = var.enable_bot_control ? [1] : []

    content {
      name     = "AWSManagedRulesBotControlRuleSet"
      priority = 7

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesBotControlRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.project_name}-bot-control"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf"
    sampled_requests_enabled   = true
  }

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-waf"
  })
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "app" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.app.arn
}

# CloudWatch Log Group for WAF logs
resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${var.project_name}"
  retention_in_days = 30

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-waf-logs"
  })
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "app" {
  resource_arn            = aws_wafv2_web_acl.app.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}
```

**Cost:** ~$5-10/month
**Priority:** High (for production)
**Effort:** 1-2 hours

---

### 2.3 VPC Flow Logs

**Current State:** No network traffic logging

**Add to `modules/vpc/main.tf`:**

```hcl
# VPC Flow Logs
resource "aws_flow_log" "vpc" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.coherent_vpc.id

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-flow-logs"
  })
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name              = "/aws/vpc/${var.vpc_name}"
  retention_in_days = 7

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-flow-logs"
  })
}

resource "aws_iam_role" "flow_log" {
  name = "${var.vpc_name}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
    }]
  })

  tags = merge(var.global_tags, {
    Name = "${var.vpc_name}-flow-log-role"
  })
}

resource "aws_iam_role_policy" "flow_log" {
  name = "${var.vpc_name}-flow-log-policy"
  role = aws_iam_role.flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}
```

**Cost:** ~$1-5/month
**Priority:** Medium
**Effort:** 30 minutes

---

### 2.4 Auto Scaling Group

**Current State:** Single EC2 instance (single point of failure)

Create `modules/asg/main.tf`:

```hcl
# ============================================================================
# Auto Scaling Group Module
# ============================================================================

resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = var.ec2_instance_type

  key_name = var.key_name

  iam_instance_profile {
    name = var.iam_instance_profile_name
  }

  vpc_security_group_ids = [var.app_security_group_id]

  user_data = base64encode(templatefile("${path.root}/${var.user_data_script}", {
    db_host         = var.db_host
    db_port         = var.db_port
    db_name         = var.db_name
    db_user         = var.db_user
    db_password     = var.db_password
    s3_bucket       = var.s3_bucket_name
    aws_region      = var.aws_region
    domain_name     = var.domain_name
    app_subdomain   = var.app_subdomain
    github_repo_url = var.github_repo_url
    project_name    = var.project_name
    redis_endpoint  = var.redis_endpoint
  }))

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size           = var.ec2_root_volume_size
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.global_tags, {
      Name = "${var.project_name}-asg-instance"
    })
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(var.global_tags, {
      Name = "${var.project_name}-asg-volume"
    })
  }
}

resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-asg"
  vpc_zone_identifier = var.public_subnet_ids
  target_group_arns   = [var.alb_target_group_arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  min_size         = var.environment == "prod" ? 2 : 1
  max_size         = var.environment == "prod" ? 4 : 2
  desired_capacity = var.environment == "prod" ? 2 : 1

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  # Instance refresh on launch template changes
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-asg-instance"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = var.global_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

# Auto-scaling policies
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "${var.project_name}-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.app.name
}

resource "aws_autoscaling_policy" "scale_down" {
  name                   = "${var.project_name}-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.app.name
}

# CloudWatch alarms to trigger scaling
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project_name}-asg-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "Triggers scale up when CPU > 70%"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }
}

resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "${var.project_name}-asg-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "30"
  alarm_description   = "Triggers scale down when CPU < 30%"
  alarm_actions       = [aws_autoscaling_policy.scale_down.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
```

**Cost:** +~$30/month for 2 instances in production
**Priority:** Medium (for production)
**Effort:** 2-3 hours

---

## 3. Nice-to-Have Components

### 3.1 AWS Backup

Centralized backup management for EC2 and RDS

```hcl
# modules/backup/main.tf
resource "aws_backup_vault" "main" {
  name = "${var.project_name}-backup-vault"

  tags = merge(var.global_tags, {
    Name = "${var.project_name}-backup-vault"
  })
}

resource "aws_backup_plan" "main" {
  name = "${var.project_name}-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 ? * * *)"  # 5 AM UTC daily

    lifecycle {
      delete_after = 30  # Keep for 30 days
    }

    recovery_point_tags = var.global_tags
  }

  rule {
    rule_name         = "weekly_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 ? * 1 *)"  # Every Monday

    lifecycle {
      delete_after            = 90  # Keep for 90 days
      cold_storage_after      = 30  # Move to cold storage after 30 days
    }

    recovery_point_tags = var.global_tags
  }

  tags = var.global_tags
}

resource "aws_backup_selection" "main" {
  name         = "${var.project_name}-backup-selection"
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup.arn

  resources = [
    var.ec2_instance_arn,
    var.rds_instance_arn
  ]
}

resource "aws_iam_role" "backup" {
  name = "${var.project_name}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "backup.amazonaws.com"
      }
    }]
  })

  tags = var.global_tags
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}
```

**Cost:** ~$5-15/month
**Priority:** Low-Medium
**Effort:** 1 hour

---

### 3.2 CloudFront CDN

For faster global access and static asset caching

```hcl
# modules/cloudfront/main.tf
resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} CDN"
  default_root_object = "index.html"
  aliases             = ["${var.app_subdomain}.${var.domain_name}"]

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Authorization"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Cache static assets aggressively
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400   # 24 hours
    max_ttl                = 604800  # 7 days
    compress               = true
  }

  # Don't cache API responses
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb"

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = var.global_tags
}
```

**Cost:** ~$1-10/month (depends on traffic)
**Priority:** Low
**Effort:** 2 hours

---

### 3.3 GuardDuty (Threat Detection)

```hcl
# modules/guardduty/main.tf
resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = false
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = var.global_tags
}

# SNS topic for GuardDuty findings
resource "aws_sns_topic" "guardduty" {
  name = "${var.project_name}-guardduty-alerts"

  tags = var.global_tags
}

resource "aws_sns_topic_subscription" "guardduty_email" {
  topic_arn = aws_sns_topic.guardduty.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# EventBridge rule to forward findings to SNS
resource "aws_cloudwatch_event_rule" "guardduty" {
  name        = "${var.project_name}-guardduty-findings"
  description = "Capture GuardDuty findings"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
  })
}

resource "aws_cloudwatch_event_target" "guardduty_sns" {
  rule      = aws_cloudwatch_event_rule.guardduty.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.guardduty.arn
}
```

**Cost:** ~$4-10/month
**Priority:** Low
**Effort:** 30 minutes

---

## 4. Configuration Improvements

### 4.1 Security Group Hardening

**Update `modules/vpc/main.tf`:**

Remove public access to application ports:

```hcl
# ❌ REMOVE THESE from app_sg:
# ingress {
#   description = "API Server"
#   from_port   = 4000
#   to_port     = 4000
#   protocol    = "tcp"
#   cidr_blocks = ["0.0.0.0/0"]  # INSECURE
# }

# ingress {
#   description = "Web Server"
#   from_port   = 5173
#   to_port     = 5173
#   protocol    = "tcp"
#   cidr_blocks = ["0.0.0.0/0"]  # INSECURE
# }

# ✅ REPLACE WITH:
ingress {
  description     = "HTTP from ALB only"
  from_port       = 80
  to_port         = 80
  protocol        = "tcp"
  security_groups = [aws_security_group.alb.id]
}

# Optional: Remove SSH and use Session Manager instead
# ingress {
#   description = "SSH"
#   from_port   = 22
#   to_port     = 22
#   protocol    = "tcp"
#   cidr_blocks = var.ssh_allowed_cidr
# }
```

---

### 4.2 RDS Enhancements

**Update `modules/rds/main.tf`:**

```hcl
resource "aws_db_instance" "coherent_db" {
  # ... existing config ...

  # Add Performance Insights
  performance_insights_enabled          = var.environment == "prod"
  performance_insights_retention_period = var.environment == "prod" ? 7 : null

  # Enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Enable query logging
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # ... rest of config ...
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project_name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "monitoring.rds.amazonaws.com"
      }
    }]
  })

  tags = var.global_tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
```

---

### 4.3 Session Manager (Replace SSH)

**Benefits:**
- No SSH keys to manage
- No open port 22
- All access logged to CloudTrail
- No bastion host needed

Already partially configured in `modules/ec2/main.tf:73-76`. Just remove SSH security group rule.

**Connect via:**
```bash
# Install Session Manager plugin first
aws ssm start-session --target <instance-id>
```

---

### 4.4 Multi-Environment Support

Create environment-specific variable files:

```bash
mkdir -p environments

# environments/dev.tfvars
environment          = "dev"
ec2_instance_type    = "t3.small"
db_instance_class    = "db.t3.micro"
create_dns_records   = false
enable_monitoring    = false

# environments/staging.tfvars
environment          = "staging"
ec2_instance_type    = "t3.medium"
db_instance_class    = "db.t3.small"
create_dns_records   = true
enable_monitoring    = true

# environments/prod.tfvars
environment          = "prod"
ec2_instance_type    = "t3.large"
db_instance_class    = "db.t3.small"
create_dns_records   = true
enable_monitoring    = true
enable_multi_az      = true
```

**Usage:**
```bash
terraform apply -var-file=environments/prod.tfvars
```

---

### 4.5 Enhanced Tagging

**Update `variables.tf`:**

```hcl
variable "global_tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Coherent"
    ManagedBy   = "Terraform"
    Owner       = "Huron Home Services"
    Environment = "prod"  # Set dynamically
    CostCenter  = "Engineering"
    Application = "PMO"
    Backup      = "true"
    Compliance  = "required"
  }
}
```

---

## 5. Cost Impact Summary

| Phase | Components | Monthly Cost | Priority |
|-------|-----------|--------------|----------|
| **Current State** | VPC, EC2, RDS, S3, Route53 | $55-65 | - |
| **Phase 1 (Critical)** | Remote State, Secrets Manager, ACM, CloudWatch | +$7-12 | Critical |
| **Phase 2 (High Priority)** | ALB, ElastiCache, VPC Flow Logs, WAF | +$35-55 | High |
| **Phase 3 (Production)** | Auto Scaling (x2), AWS Backup, GuardDuty | +$40-60 | Medium |
| **Phase 4 (Optional)** | CloudFront, RDS replicas, Multi-region DR | +$20-50 | Low |
| **TOTAL (Recommended)** | | **$135-165** | - |
| **TOTAL (Production)** | | **$165-195** | - |

---

## 6. Implementation Phases

### Phase 1: Critical (Do Immediately) 🚨
**Time:** 4-6 hours | **Cost:** +$7-12/month

1. ✅ Remote S3 state backend with DynamoDB locking
2. ✅ AWS Secrets Manager for database credentials
3. ✅ ACM certificate (free, automated SSL)
4. ✅ CloudWatch basic alarms + SNS notifications
5. ✅ Fix security group (remove 4000/5173 exposure)

**Rationale:** These prevent infrastructure disasters and enable secure operations.

---

### Phase 2: High Priority (Before Production) ⚠️
**Time:** 8-12 hours | **Cost:** +$35-55/month

6. ✅ Application Load Balancer with SSL termination
7. ✅ ElastiCache Redis (persistent, HA)
8. ✅ VPC Flow Logs (security monitoring)
9. ✅ WAF (web application firewall)
10. ✅ Enhanced RDS monitoring

**Rationale:** Enables high availability, security, and operational visibility.

---

### Phase 3: Production Hardening (For Scale) 📈
**Time:** 6-10 hours | **Cost:** +$40-60/month

11. ✅ Auto Scaling Group (min 2 instances)
12. ✅ AWS Backup (centralized backup management)
13. ✅ GuardDuty (threat detection)
14. ✅ Session Manager (remove SSH)
15. ✅ Multi-AZ RDS (already configured for prod)

**Rationale:** Eliminates single points of failure and improves disaster recovery.

---

### Phase 4: Optimization (Nice to Have) 🎯
**Time:** 4-6 hours | **Cost:** +$20-50/month

16. ✅ CloudFront CDN (global performance)
17. ✅ RDS read replicas (read scalability)
18. ✅ Multi-region disaster recovery
19. ✅ AWS Config (compliance auditing)
20. ✅ Network ACLs (additional security layer)

**Rationale:** Optimizes performance and enables global scaling.

---

## 7. Quick Wins (Free or Minimal Cost)

These improvements have **zero or minimal cost** but provide significant value:

1. **Session Manager instead of SSH** - FREE
   - Better security
   - No SSH keys to manage
   - Full audit trail

2. **ACM Certificate** - FREE
   - Automated SSL management
   - Auto-renewal every 90 days
   - No manual intervention

3. **VPC Flow Logs** - ~$1-5/mo
   - Critical for security investigations
   - Compliance requirement
   - Network troubleshooting

4. **CloudWatch Basic Alarms** - First 10 FREE
   - Proactive issue detection
   - Email notifications
   - Better uptime

5. **Cost Allocation Tags** - FREE
   - Better billing visibility
   - Department charge-backs
   - Cost optimization insights

6. **S3 State Backend** - ~$1/mo
   - Prevents state disasters
   - Team collaboration
   - State versioning/recovery

7. **Multi-Environment tfvars** - FREE
   - Better organization
   - Environment parity
   - Reduced errors

---

## 8. Implementation Guides

### 8.1 Getting Started with Phase 1

```bash
# 1. Remote State Backend
cd infra-tf
./scripts/setup-remote-state.sh  # Create this script

# 2. Secrets Manager
terraform apply -target=module.secrets

# 3. ACM Certificate
terraform apply -target=module.acm

# 4. CloudWatch Monitoring
terraform apply -target=module.monitoring

# 5. Verify
terraform plan  # Should show no changes
```

---

### 8.2 Testing Checklist

Before moving to production:

- [ ] Remote state working (team can collaborate)
- [ ] Secrets Manager tested (application can read credentials)
- [ ] ACM certificate validated (HTTPS working)
- [ ] CloudWatch alarms tested (send test notification)
- [ ] Security groups locked down (no unnecessary public access)
- [ ] ALB health checks passing
- [ ] Auto-scaling tested (scale up/down)
- [ ] Disaster recovery tested (restore from backup)
- [ ] Monitoring dashboard created
- [ ] On-call alerts configured

---

### 8.3 Rollback Plan

If anything goes wrong:

```bash
# Rollback to previous state
terraform state pull > backup.tfstate
terraform apply -state=backup.tfstate

# Rollback specific module
terraform apply -target=module.ec2 -state=backup.tfstate

# Destroy and recreate
terraform destroy -target=module.monitoring
terraform apply -target=module.monitoring
```

---

## 9. Next Steps

1. **Review this document** with your team
2. **Prioritize improvements** based on your timeline and budget
3. **Start with Phase 1** (critical improvements)
4. **Test each phase** in a dev environment first
5. **Update documentation** as you implement changes
6. **Monitor costs** using AWS Cost Explorer
7. **Schedule regular reviews** (monthly) to assess infrastructure health

---

## 10. Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [Cost Optimization Strategies](https://aws.amazon.com/pricing/cost-optimization/)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-22
**Author:** Infrastructure Team
**Domain:** cohuron.com
