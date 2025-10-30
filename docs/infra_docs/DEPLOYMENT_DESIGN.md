# Deployment Design - PMO Enterprise Platform

**Project:** PMO Enterprise Platform - Complete Deployment Strategy
**Version:** 1.0
**Last Updated:** 2025-10-23
**Status:** Production-Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Deployment Architecture](#deployment-architecture)
3. [Hosting Configuration](#hosting-configuration)
4. [DNS & Domain Management](#dns--domain-management)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Management](#environment-management)
7. [Deployment Procedures](#deployment-procedures)
8. [Rollback Strategy](#rollback-strategy)
9. [Monitoring & Health Checks](#monitoring--health-checks)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Executive Summary

The PMO Enterprise Platform uses a modern deployment strategy with containerized services, automated deployment scripts, and infrastructure as code.

### Deployment Overview

- **Hosting:** AWS EC2 (t3.medium, us-east-1)
- **Server IP:** 100.28.36.248
- **Containerization:** Docker + Docker Compose
- **Process Management:** systemd / PM2 (future)
- **Deployment Method:** SSH + S3 code bucket
- **Zero-Downtime:** Not implemented (future)

### Key Technologies

| Component | Technology | Port |
|-----------|-----------|------|
| API Server | Fastify (Node.js) | 4000 |
| Web Application | React 19 + Vite | 5173 |
| Database | PostgreSQL 14 (Docker) | 5434 |
| Cache | Redis (Docker) | 6379 |
| Object Storage | MinIO (Docker) | 9000/9001 |
| Email Testing | MailHog (Docker) | 8025 |

---

## Deployment Architecture

### Application Stack

```
┌─────────────────────────────────────────────────────────────┐
│  EC2 Instance: i-07f64b1f8de8f6b26                          │
│  Public IP: 100.28.36.248                                   │
│  OS: Ubuntu 22.04 LTS                                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Application Layer                                    │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  API Server (Fastify)                           │ │  │
│  │  │  Port: 4000                                     │ │  │
│  │  │  Process: pnpm dev (development)                │ │  │
│  │  │  Directory: /home/rabin/projects/pmo/apps/api   │ │  │
│  │  │  Logs: /tmp/pmo-api.log                        │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Web Application (React 19 + Vite)              │ │  │
│  │  │  Port: 5173                                     │ │  │
│  │  │  Process: pnpm dev --port 5173                  │ │  │
│  │  │  Directory: /home/rabin/projects/pmo/apps/web   │ │  │
│  │  │  Build Output: apps/web/dist/                   │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Docker Services (docker-compose.yml)                │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  PostgreSQL 14                                  │ │  │
│  │  │  Port: 5434                                     │ │  │
│  │  │  Volume: pmo_postgres_data                      │ │  │
│  │  │  User: app / app                                │ │  │
│  │  │  Database: app                                  │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Redis 7                                        │ │  │
│  │  │  Port: 6379                                     │ │  │
│  │  │  Volume: pmo_redis_data                         │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  MinIO (S3-compatible storage)                  │ │  │
│  │  │  API Port: 9000                                 │ │  │
│  │  │  Console Port: 9001                             │ │  │
│  │  │  Volume: pmo_minio_data                         │ │  │
│  │  │  Credentials: minio / minio123                  │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  MailHog (Email testing)                        │ │  │
│  │  │  SMTP Port: 1025                                │ │  │
│  │  │  Web Port: 8025                                 │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Flow

```
┌─────────────┐
│  Developer  │
└──────┬──────┘
       │
       │ git push
       ▼
┌─────────────┐
│  Git Repo   │
└──────┬──────┘
       │
       │ Manual deployment
       ▼
┌─────────────────────────────────────┐
│  Build Process                      │
│  1. pnpm install                    │
│  2. pnpm build (web)                │
│  3. TypeScript compilation (api)    │
└──────┬──────────────────────────────┘
       │
       │ tar + compress
       ▼
┌─────────────────────────────────────┐
│  S3 Code Bucket                     │
│  cohuron-code-prod-957207443425     │
│  - api/latest.tar.gz                │
│  - web/latest.tar.gz                │
└──────┬──────────────────────────────┘
       │
       │ SSH deployment
       ▼
┌─────────────────────────────────────┐
│  EC2 Instance                       │
│  1. Download from S3                │
│  2. Extract archives                │
│  3. Install dependencies            │
│  4. Restart services                │
└─────────────────────────────────────┘
```

---

## Hosting Configuration

### Server Specifications

```yaml
Provider: AWS EC2
Instance Type: t3.medium
  vCPUs: 2
  Memory: 4 GB RAM
  Network: Up to 5 Gbps
  EBS-Optimized: Yes

Operating System: Ubuntu 22.04 LTS
Disk:
  Root Volume: 30 GB gp3 SSD
  IOPS: 3000
  Throughput: 125 MB/s

Network:
  Public IP: 100.28.36.248
  Private IP: 172.31.x.x
  IPv6: Disabled
  VPC: Default VPC

Security Group: pmo-security-group
  Inbound:
    - SSH (22) from 0.0.0.0/0
    - HTTP (80) from 0.0.0.0/0
    - HTTPS (443) from 0.0.0.0/0
    - API (4000) from 0.0.0.0/0
    - Web (5173) from 0.0.0.0/0
  Outbound:
    - All traffic to 0.0.0.0/0
```

### Directory Structure

```
/home/rabin/projects/pmo/
├── apps/
│   ├── api/                    # API server
│   │   ├── src/
│   │   ├── dist/              # Compiled TypeScript
│   │   ├── node_modules/
│   │   ├── package.json
│   │   └── .env               # API configuration
│   │
│   └── web/                    # Web application
│       ├── src/
│       ├── dist/              # Production build
│       ├── node_modules/
│       ├── package.json
│       └── .env               # Web configuration
│
├── db/                         # Database DDL files
│   ├── 01_schema.ddl
│   ├── 02_d_project.ddl
│   └── ...
│
├── infra-tf/                   # Terraform IaC
│   ├── main.tf
│   ├── modules/
│   └── scripts/
│       └── deploy-code.sh     # Deployment script
│
├── tools/                      # Management scripts
│   ├── start-all.sh           # Start all services
│   ├── db-import.sh           # Import database
│   ├── test-api.sh            # API testing
│   └── logs-*.sh              # Log viewers
│
├── docker-compose.yml          # Docker services
└── .env                        # Root configuration
```

### Docker Services Configuration

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14
    container_name: pmo_postgres
    ports:
      - "5434:5432"
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    volumes:
      - pmo_postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: pmo_redis
    ports:
      - "6379:6379"
    volumes:
      - pmo_redis_data:/data
    restart: unless-stopped

  minio:
    image: minio/minio
    container_name: pmo_minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    volumes:
      - pmo_minio_data:/data
    command: server /data --console-address ":9001"
    restart: unless-stopped

  mailhog:
    image: mailhog/mailhog
    container_name: pmo_mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    restart: unless-stopped

volumes:
  pmo_postgres_data:
  pmo_redis_data:
  pmo_minio_data:
```

---

## DNS & Domain Management

### Current Setup (Development)

```yaml
Access Method: Direct IP
API URL: http://100.28.36.248:4000
Web URL: http://100.28.36.248:5173
Status: Development only
SSL/TLS: Not configured
```

### Production DNS Configuration (Future)

#### Domain Structure

```
cohuron.com (Root domain)
├── app.cohuron.com          → Web application
├── api.cohuron.com          → API server
├── www.cohuron.com          → Redirect to app.cohuron.com
├── docs.cohuron.com         → Documentation
└── admin.cohuron.com        → Admin portal
```

#### DNS Records (Route 53 / Cloudflare)

**A Records:**
```dns
app.cohuron.com.     300  IN  A      100.28.36.248
api.cohuron.com.     300  IN  A      100.28.36.248
www.cohuron.com.     300  IN  A      100.28.36.248
```

**CNAME Records:**
```dns
docs.cohuron.com.    300  IN  CNAME  app.cohuron.com.
admin.cohuron.com.   300  IN  CNAME  app.cohuron.com.
```

**TXT Records (for verification):**
```dns
cohuron.com.         300  IN  TXT    "v=spf1 include:_spf.google.com ~all"
_dmarc.cohuron.com.  300  IN  TXT    "v=DMARC1; p=none; rua=mailto:dmarc@cohuron.com"
```

#### SSL/TLS Certificates

**Provider:** Let's Encrypt (via AWS Certificate Manager)

**Certificate Configuration:**
```yaml
Primary Domain: cohuron.com
Subject Alternative Names (SANs):
  - app.cohuron.com
  - api.cohuron.com
  - www.cohuron.com
  - *.cohuron.com

Validation Method: DNS (CNAME)
Auto-Renewal: Yes
Certificate Authority: Let's Encrypt
Expiration: 90 days (auto-renew)
```

**Installation:**
```bash
# Using Certbot on EC2
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d app.cohuron.com -d api.cohuron.com

# Or use AWS Certificate Manager (recommended)
# 1. Request certificate in ACM
# 2. Validate via DNS
# 3. Attach to Application Load Balancer
```

#### Nginx Reverse Proxy (Production)

**Configuration:** `/etc/nginx/sites-available/pmo`

```nginx
# API Server
server {
    listen 80;
    server_name api.cohuron.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.cohuron.com;

    ssl_certificate /etc/letsencrypt/live/api.cohuron.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cohuron.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to API server
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Web Application
server {
    listen 80;
    server_name app.cohuron.com www.cohuron.com;
    return 301 https://app.cohuron.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.cohuron.com www.cohuron.com;

    ssl_certificate /etc/letsencrypt/live/app.cohuron.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.cohuron.com/privkey.pem;

    root /home/rabin/projects/pmo/apps/web/dist;
    index index.html;

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (optional - for same-origin requests)
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## CI/CD Pipeline

### Automated Deployment Pipeline (Lambda + S3 + EventBridge)

The PMO platform features a **fully automated deployment pipeline** using AWS Lambda, S3, and EventBridge. When code is uploaded to S3, it automatically triggers a Lambda function that deploys the code to EC2 via AWS Systems Manager.

#### Architecture Overview

```
┌──────────────┐
│  Developer   │
└──────┬───────┘
       │
       │ Run: ./infra-tf/deploy-code.sh
       ▼
┌────────────────────────────────────────┐
│  Deployment Script                     │
│  1. Bundle current git branch          │
│  2. Create tar.gz archive              │
│  3. Add metadata (branch, commit)      │
└──────┬─────────────────────────────────┘
       │
       │ Upload bundle
       ▼
┌────────────────────────────────────────┐
│  S3 Code Bucket                        │
│  cohuron-code-prod-957207443425        │
│  Bundle: cohuron-main-abc123.tar.gz    │
└──────┬─────────────────────────────────┘
       │
       │ Trigger: S3 Object Created Event
       ▼
┌────────────────────────────────────────┐
│  EventBridge                           │
│  Rule: s3-upload-trigger               │
│  Pattern: *.tar.gz in code bucket      │
└──────┬─────────────────────────────────┘
       │
       │ Invoke Lambda
       ▼
┌────────────────────────────────────────┐
│  Lambda Function                       │
│  Name: cohuron-code-deployer           │
│  Runtime: Python 3.11                  │
│  Timeout: 5 minutes                    │
│  ┌──────────────────────────────────┐ │
│  │  Deployment Logic:               │ │
│  │  1. Parse S3 event               │ │
│  │  2. Build deployment script      │ │
│  │  3. Send to EC2 via SSM          │ │
│  └──────────────────────────────────┘ │
└──────┬─────────────────────────────────┘
       │
       │ SSM SendCommand
       ▼
┌────────────────────────────────────────┐
│  EC2 Instance (via SSM Agent)          │
│  ┌──────────────────────────────────┐ │
│  │  Deployment Steps:               │ │
│  │  1. Stop PM2 services            │ │
│  │  2. Create backup                │ │
│  │  3. Download code from S3        │ │
│  │  4. Extract tar.gz               │ │
│  │  5. Install dependencies         │ │
│  │  6. Configure environment        │ │
│  │  7. Start Docker services        │ │
│  │  8. Import database schema       │ │
│  │  9. Start PM2 services           │ │
│  │  10. Verify deployment           │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

#### Components

**1. S3 Code Bucket**
- **Bucket:** `cohuron-code-prod-957207443425`
- **Purpose:** Store deployment bundles
- **Versioning:** Enabled (automatic rollback)
- **Encryption:** AES256
- **Event Notifications:** Configured for EventBridge

**2. Lambda Function**
- **Name:** `cohuron-code-deployer`
- **Runtime:** Python 3.11
- **Timeout:** 5 minutes (300 seconds)
- **Memory:** 256 MB
- **Role:** `cohuron-lambda-deployer-role`
- **Permissions:**
  - S3: GetObject, ListBucket
  - SSM: SendCommand, GetCommandInvocation
  - EC2: DescribeInstances
  - CloudWatch: Logs

**3. EventBridge Rule**
- **Name:** `cohuron-code-upload-trigger`
- **Event Pattern:**
  ```json
  {
    "source": ["aws.s3"],
    "detail-type": ["Object Created"],
    "detail": {
      "bucket": {
        "name": ["cohuron-code-prod-957207443425"]
      },
      "object": {
        "key": [{ "suffix": ".tar.gz" }]
      }
    }
  }
  ```
- **Target:** Lambda function `cohuron-code-deployer`

**4. AWS Systems Manager (SSM)**
- **Purpose:** Execute deployment commands on EC2
- **Document:** `AWS-RunShellScript`
- **Timeout:** 1 hour
- **Agent:** Pre-installed on EC2 instance

#### Deployment Workflow

**Step 1: Developer Initiates Deployment**

```bash
cd /home/rabin/projects/pmo/infra-tf
./deploy-code.sh
```

**What happens:**
```bash
# 1. Gets current git branch and commit
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

# 2. Creates deployment bundle
tar -czf cohuron-$BRANCH-$COMMIT-$TIMESTAMP.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    .

# 3. Uploads to S3 with metadata
aws s3 cp bundle.tar.gz s3://cohuron-code-prod-957207443425/ \
    --metadata "branch=$BRANCH,commit=$COMMIT"

# 4. Script completes - automation takes over
echo "✓ Deployment automation triggered!"
```

**Step 2: S3 Triggers EventBridge (~30 seconds)**

When the `.tar.gz` file lands in S3:
1. S3 emits "Object Created" event
2. EventBridge receives the event
3. EventBridge matches the rule pattern
4. EventBridge invokes Lambda function

**Step 3: Lambda Executes Deployment (~3-5 minutes)**

Lambda function `lambda_function.py`:

```python
def lambda_handler(event, context):
    # Parse S3 event
    bucket_name = event['detail']['bucket']['name']
    object_key = event['detail']['object']['key']

    # Build deployment script (300+ lines)
    deployment_script = """
    #!/bin/bash
    # Stop services
    pm2 stop all

    # Download from S3
    aws s3 cp s3://{bucket}/{key} /tmp/deployment.tar.gz

    # Extract code
    tar -xzf /tmp/deployment.tar.gz -C /opt/cohuron

    # Install dependencies
    cd /opt/cohuron
    pnpm install

    # Start Docker services
    docker-compose up -d

    # Import database
    ./tools/db-import.sh

    # Start applications
    pm2 start all
    pm2 save
    """

    # Execute on EC2 via SSM
    ssm.send_command(
        InstanceIds=[EC2_INSTANCE_ID],
        DocumentName='AWS-RunShellScript',
        Parameters={'commands': [deployment_script]},
        TimeoutSeconds=3600
    )
```

**Step 4: EC2 Receives and Executes Commands**

The SSM Agent on EC2:
1. Receives deployment script from Lambda
2. Executes each command sequentially
3. Logs output to CloudWatch and local file
4. Returns success/failure status

**Detailed Deployment Steps on EC2:**

```bash
# 1. Stop services
pm2 stop all
pm2 delete all

# 2. Create backup
tar -czf /opt/cohuron-backups/backup-20251023.tar.gz /opt/cohuron/

# 3. Download code
aws s3 cp s3://cohuron-code-prod-957207443425/bundle.tar.gz /tmp/

# 4. Extract
mkdir -p /tmp/cohuron-deploy
tar -xzf /tmp/bundle.tar.gz -C /tmp/cohuron-deploy

# 5. Deploy
sudo cp -r /tmp/cohuron-deploy/* /opt/cohuron/
sudo chown -R ubuntu:ubuntu /opt/cohuron

# 6. Install dependencies
cd /opt/cohuron/apps/api
pnpm install --frozen-lockfile

cd /opt/cohuron/apps/web
pnpm install --frozen-lockfile

# 7. Configure environment
cat > /opt/cohuron/apps/api/.env <<EOF
DATABASE_URL=postgresql://app:app@localhost:5434/app
NODE_ENV=production
PORT=4000
JWT_SECRET=your-secret-key
AWS_PROFILE=cohuron
AWS_REGION=us-east-1
S3_ATTACHMENTS_BUCKET=cohuron-attachments-prod-957207443425
EOF

# 8. Start Docker services
cd /opt/cohuron
docker-compose down
docker-compose up -d

# Wait for PostgreSQL
sleep 5
until docker exec pmo_db pg_isready; do sleep 2; done

# 9. Import database schema
./tools/db-import.sh

# 10. Start applications with PM2
pm2 start "pnpm dev" --name cohuron-api --cwd /opt/cohuron/apps/api
pm2 start "pnpm dev --port 5173" --name cohuron-web --cwd /opt/cohuron/apps/web
pm2 save

# 11. Verify deployment
sleep 10
curl http://localhost:4000/api/health
curl http://localhost:5173

# 12. Display summary
echo "✅ Deployment Complete!"
pm2 status
docker ps
```

#### Monitoring Deployment

**1. View Lambda Logs:**
```bash
# Follow Lambda execution logs
aws logs tail /aws/lambda/cohuron-code-deployer --follow --profile cohuron

# Sample output:
# Deployment Lambda triggered at 2025-10-23T15:30:00
# Deploying: s3://cohuron-code-prod-957207443425/cohuron-main-abc123.tar.gz
# Target EC2: i-07f64b1f8de8f6b26
# Executing deployment script on EC2 via SSM...
# SSM Command sent successfully: 1234abcd-5678-efgh-9012-ijklmnopqrst
# ✓ Deployment initiated successfully
```

**2. Check SSM Command Status:**
```bash
# Get latest SSM commands
aws ssm list-commands \
    --instance-id i-07f64b1f8de8f6b26 \
    --max-results 5 \
    --profile cohuron

# View specific command output
aws ssm get-command-invocation \
    --command-id 1234abcd-5678-efgh-9012-ijklmnopqrst \
    --instance-id i-07f64b1f8de8f6b26 \
    --profile cohuron
```

**3. SSH to EC2 and Monitor:**
```bash
# Connect to EC2
ssh -i ~/.ssh/id_ed25519 ubuntu@100.28.36.248

# Watch PM2 processes
pm2 logs --lines 50

# Check Docker services
docker ps
docker-compose logs -f postgres

# View deployment logs
tail -f /var/log/cohuron-deployment.log
```

**4. CloudWatch Dashboard (Future):**
- Lambda execution metrics
- SSM command success rate
- Deployment duration
- Service health after deployment

#### Backup and Rollback

**Automatic Backups:**

Every deployment creates a backup:
```bash
/opt/cohuron-backups/
├── cohuron-backup-20251023-103000.tar.gz
├── cohuron-backup-20251023-120000.tar.gz
├── cohuron-backup-20251023-150000.tar.gz
└── cohuron-backup-20251023-180000.tar.gz
```

**Retention:** Last 5 backups (older ones auto-deleted)

**Manual Rollback:**

```bash
# 1. List backups
ls -lh /opt/cohuron-backups/

# 2. Stop services
pm2 stop all
docker-compose down

# 3. Restore from backup
cd /opt
sudo rm -rf cohuron
sudo tar -xzf cohuron-backups/cohuron-backup-20251023-120000.tar.gz

# 4. Restart services
cd /opt/cohuron
docker-compose up -d
pm2 resurrect
```

**S3 Version Rollback:**

```bash
# List versions of deployment bundles
aws s3api list-object-versions \
    --bucket cohuron-code-prod-957207443425 \
    --prefix cohuron- \
    --profile cohuron

# Download specific version
aws s3api get-object \
    --bucket cohuron-code-prod-957207443425 \
    --key cohuron-main-abc123.tar.gz \
    --version-id xyz123 \
    deployment.tar.gz \
    --profile cohuron

# Manually deploy
ssh ubuntu@100.28.36.248
scp deployment.tar.gz ubuntu@100.28.36.248:/tmp/
# Extract and deploy manually
```

#### Advantages of Lambda-Based Deployment

✅ **Fully Automated** - No manual SSH required
✅ **Event-Driven** - Triggered by S3 upload
✅ **Scalable** - Lambda handles concurrent deployments
✅ **Auditable** - CloudWatch logs all deployments
✅ **Consistent** - Same deployment process every time
✅ **Safe** - Automatic backups before deployment
✅ **Fast** - ~3-5 minutes end-to-end
✅ **Serverless** - No deployment infrastructure to manage

#### Cost Analysis

**Lambda Costs:**
- Invocations: $0.20 per 1M requests
- Duration: $0.0000166667 per GB-second
- Typical deployment: ~30 seconds @ 256 MB
- Cost per deployment: ~$0.000125
- Monthly (30 deployments): **~$0.004**

**S3 Costs:**
- Storage: ~1 GB code bundles @ $0.023/GB
- Requests: 30 uploads/month @ $0.005 per 1,000
- Monthly: **~$0.03**

**Total Deployment Infrastructure Cost: ~$0.035/month**

---

### Current Deployment (Manual)

**Deployment Script:** `infra-tf/scripts/deploy-code.sh`

```bash
#!/bin/bash
# Deploy application code to EC2

# Configuration
EC2_HOST="100.28.36.248"
EC2_USER="ubuntu"
SSH_KEY="~/.ssh/cohuron-key.pem"
S3_BUCKET="cohuron-code-prod-957207443425"

# Build API
cd apps/api
pnpm install
pnpm build
tar -czf api.tar.gz dist/ node_modules/ package.json

# Build Web
cd ../web
pnpm install
pnpm build
tar -czf web.tar.gz dist/ package.json

# Upload to S3
aws s3 cp api.tar.gz s3://$S3_BUCKET/api/latest.tar.gz --profile cohuron
aws s3 cp web.tar.gz s3://$S3_BUCKET/web/latest.tar.gz --profile cohuron

# Deploy to EC2
ssh -i $SSH_KEY $EC2_USER@$EC2_HOST << 'EOF'
  # Download from S3
  aws s3 cp s3://cohuron-code-prod-957207443425/api/latest.tar.gz /tmp/
  aws s3 cp s3://cohuron-code-prod-957207443425/web/latest.tar.gz /tmp/

  # Extract and deploy API
  cd /home/rabin/projects/pmo/apps/api
  tar -xzf /tmp/api.tar.gz
  pm2 restart pmo-api || pm2 start dist/server.js --name pmo-api

  # Extract and deploy Web
  cd /home/rabin/projects/pmo/apps/web
  tar -xzf /tmp/web.tar.gz
  # Nginx serves static files from dist/

  # Cleanup
  rm /tmp/api.tar.gz /tmp/web.tar.gz

  echo "✓ Deployment complete"
EOF
```

**Usage:**
```bash
cd /home/rabin/projects/pmo/infra-tf
./scripts/deploy-code.sh
```

### Future CI/CD (GitHub Actions)

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Build API
        run: |
          cd apps/api
          pnpm install
          pnpm build
          tar -czf api.tar.gz dist/ node_modules/ package.json

      - name: Build Web
        run: |
          cd apps/web
          pnpm install
          pnpm build
          tar -czf web.tar.gz dist/ package.json

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Upload to S3
        run: |
          aws s3 cp apps/api/api.tar.gz s3://cohuron-code-prod-957207443425/api/latest.tar.gz
          aws s3 cp apps/web/web.tar.gz s3://cohuron-code-prod-957207443425/web/latest.tar.gz

      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/rabin/projects/pmo
            ./scripts/deploy-from-s3.sh

      - name: Health check
        run: |
          sleep 10
          curl -f http://${{ secrets.EC2_HOST }}:4000/api/health || exit 1
```

---

## Environment Management

### Environment Variables

**API Configuration:** `apps/api/.env`

```bash
# Server
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5434
DB_USER=app
DB_PASSWORD=app
DB_NAME=app

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# AWS Configuration
AWS_PROFILE=cohuron
AWS_REGION=us-east-1
S3_ATTACHMENTS_BUCKET=cohuron-attachments-prod-957207443425

# MinIO (Development)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=app-files
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123

# Email (Development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=

# Logging
LOG_LEVEL=info
LOG_FILE=logs/api.log
```

**Web Configuration:** `apps/web/.env`

```bash
# API
VITE_API_URL=http://localhost:4000
VITE_API_BASE_URL=http://localhost:4000/api/v1

# Environment
VITE_ENV=production
VITE_APP_NAME=PMO Enterprise Platform
VITE_APP_VERSION=1.0.0

# Features
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

### Environment-Specific Configuration

**Development:**
```bash
NODE_ENV=development
API_URL=http://localhost:4000
DB_HOST=localhost
ENABLE_HOT_RELOAD=true
```

**Staging:**
```bash
NODE_ENV=staging
API_URL=https://staging-api.cohuron.com
DB_HOST=staging-db.cohuron.internal
ENABLE_DEBUG=true
```

**Production:**
```bash
NODE_ENV=production
API_URL=https://api.cohuron.com
DB_HOST=prod-db.cohuron.internal
ENABLE_DEBUG=false
```

---

## Deployment Procedures

### 1. Pre-Deployment Checklist

```bash
# ✓ Code review completed
# ✓ All tests passing
# ✓ Database migrations ready
# ✓ Environment variables configured
# ✓ Backup database
# ✓ Notify team of deployment
```

### 2. Full Deployment

**Step-by-Step Process:**

```bash
# 1. Connect to EC2
ssh -i ~/.ssh/cohuron-key.pem ubuntu@100.28.36.248

# 2. Navigate to project
cd /home/rabin/projects/pmo

# 3. Pull latest code
git pull origin main

# 4. Stop services
pkill -f "pnpm dev"
docker-compose stop

# 5. Update dependencies
cd apps/api && pnpm install
cd ../web && pnpm install

# 6. Build applications
cd apps/api && pnpm build
cd ../web && pnpm build

# 7. Run database migrations
./tools/db-import.sh

# 8. Start Docker services
docker-compose up -d

# 9. Start applications
cd apps/api && pnpm dev > /tmp/pmo-api.log 2>&1 &
cd apps/web && pnpm dev --port 5173 > /tmp/pmo-web.log 2>&1 &

# 10. Verify deployment
sleep 10
curl http://localhost:4000/api/health
curl http://localhost:5173

# 11. Check logs
tail -f /tmp/pmo-api.log
```

### 3. API-Only Deployment

```bash
cd /home/rabin/projects/pmo/apps/api

# Stop API
pkill -f "tsx watch src/server.ts"

# Pull latest code
git pull origin main

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Start API
pnpm dev > /tmp/pmo-api.log 2>&1 &

# Verify
curl http://localhost:4000/api/health
```

### 4. Database Migration

```bash
# Backup database
PGPASSWORD=app pg_dump -h localhost -p 5434 -U app -d app > backup-$(date +%Y%m%d-%H%M%S).sql

# Import new schema
./tools/db-import.sh

# Verify tables
./tools/run_query.sh "\dt app.*"
```

### 5. Quick Restart

```bash
# Restart all services
./tools/start-all.sh

# Or restart individually
docker-compose restart postgres
pkill -f "pnpm dev" && cd apps/api && pnpm dev &
```

---

## Rollback Strategy

### 1. Application Rollback

```bash
# Revert to previous commit
git log --oneline -10  # Find previous commit
git reset --hard <commit-hash>

# Redeploy
./infra-tf/scripts/deploy-code.sh
```

### 2. Database Rollback

```bash
# List backups
ls -lh backup-*.sql

# Restore from backup
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app < backup-20251023-120000.sql
```

### 3. Full System Rollback

```bash
# Stop all services
docker-compose down
pkill -f "pnpm dev"

# Revert code
git reset --hard <previous-stable-commit>

# Restore database
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app < last-stable-backup.sql

# Restart services
./tools/start-all.sh
```

### 4. S3 Object Rollback

```bash
# List versions
aws s3api list-object-versions \
  --bucket cohuron-attachments-prod-957207443425 \
  --prefix tenant_id=demo/ \
  --profile cohuron

# Restore specific version
aws s3api copy-object \
  --copy-source "bucket/key?versionId=xyz" \
  --bucket bucket \
  --key key \
  --profile cohuron
```

---

## Monitoring & Health Checks

### Health Check Endpoints

**API Health:**
```bash
curl http://100.28.36.248:4000/api/health
# Expected: {"status":"ok","timestamp":"2025-10-23T..."}
```

**S3 Health:**
```bash
curl http://100.28.36.248:4000/api/v1/s3-backend/health
# Expected: {"status":"healthy","bucket":"cohuron-attachments-prod-957207443425","connected":true}
```

**Database Health:**
```bash
./tools/run_query.sh "SELECT 1"
# Expected: Query executed successfully
```

### Application Logs

**View API Logs:**
```bash
./tools/logs-api.sh 50      # Last 50 lines
./tools/logs-api.sh -f      # Follow (tail -f)
```

**View Web Logs:**
```bash
./tools/logs-web.sh 50
./tools/logs-web.sh -f
```

**Docker Logs:**
```bash
docker-compose logs postgres
docker-compose logs redis
docker-compose logs -f minio  # Follow
```

### Resource Monitoring

**CPU & Memory:**
```bash
# EC2 instance
ssh ubuntu@100.28.36.248 "top -bn1 | head -20"

# Docker containers
docker stats --no-stream
```

**Disk Usage:**
```bash
# Overall
df -h

# Docker volumes
docker system df

# Application directories
du -sh /home/rabin/projects/pmo/*
```

**Network:**
```bash
# Active connections
netstat -tuln

# Port usage
lsof -i :4000
lsof -i :5173
```

---

## Troubleshooting Guide

### Issue: API Not Starting

**Symptoms:**
- `curl http://localhost:4000/api/health` fails
- No API process running

**Diagnosis:**
```bash
# Check if process is running
ps aux | grep "tsx watch"

# Check logs
tail -100 /tmp/pmo-api.log

# Check port
lsof -i :4000
```

**Solution:**
```bash
# Kill any existing process
pkill -9 -f "tsx watch src/server.ts"

# Restart
cd /home/rabin/projects/pmo/apps/api
pnpm dev > /tmp/pmo-api.log 2>&1 &

# Wait and verify
sleep 5
curl http://localhost:4000/api/health
```

### Issue: Database Connection Failed

**Symptoms:**
- API logs show "Connection refused"
- Database queries fail

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check port
lsof -i :5434

# Test connection
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c "SELECT 1"
```

**Solution:**
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Or recreate container
docker-compose down
docker-compose up -d postgres

# Reimport schema if needed
./tools/db-import.sh
```

### Issue: S3 Upload Fails

**Symptoms:**
- "Invalid Access Key" error
- Presigned URL returns 403

**Diagnosis:**
```bash
# Verify AWS credentials
aws sts get-caller-identity --profile cohuron

# Check S3 bucket
aws s3 ls --profile cohuron | grep attachments

# Test S3 health endpoint
curl http://localhost:4000/api/v1/s3-backend/health
```

**Solution:**
```bash
# Ensure AWS_PROFILE is set in .env
echo "AWS_PROFILE=cohuron" >> apps/api/.env

# Verify credentials file
cat ~/.aws/credentials

# Restart API
pkill -f "tsx watch" && cd apps/api && pnpm dev &
```

### Issue: Out of Memory

**Symptoms:**
- Slow response times
- Services crashing
- `OOMKilled` in Docker logs

**Diagnosis:**
```bash
# Check memory usage
free -h

# Check Docker memory
docker stats --no-stream

# Check process memory
ps aux --sort=-%mem | head -10
```

**Solution:**
```bash
# Restart services to free memory
docker-compose restart

# Or increase EC2 instance size
# t3.medium → t3.large (upgrade in Terraform)
```

---

## Summary

### Deployment Checklist

✅ **Infrastructure:**
- EC2 instance running
- Docker services started
- Security groups configured
- S3 buckets accessible

✅ **Application:**
- Latest code deployed
- Dependencies installed
- Environment variables set
- Services running

✅ **Database:**
- PostgreSQL running
- Schema imported
- Backups configured
- Migrations applied

✅ **Monitoring:**
- Health checks passing
- Logs accessible
- Error alerts configured (future)

### Quick Reference

| Task | Command |
|------|---------|
| Deploy All | `./infra-tf/scripts/deploy-code.sh` |
| Start Services | `./tools/start-all.sh` |
| Stop API | `pkill -f "pnpm dev"` |
| Restart Docker | `docker-compose restart` |
| View Logs | `./tools/logs-api.sh -f` |
| Health Check | `curl localhost:4000/api/health` |
| DB Import | `./tools/db-import.sh` |
| SSH to Server | `ssh ubuntu@100.28.36.248` |

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Maintained By:** Platform Team
**Status:** ✅ Production Deployment Documented
