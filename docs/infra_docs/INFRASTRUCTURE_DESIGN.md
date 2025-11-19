# Infrastructure Design - PMO Enterprise Platform

**Project:** PMO Enterprise Platform - Complete Infrastructure Architecture
**Version:** 1.0
**Last Updated:** 2025-10-23
**Status:** Production-Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Infrastructure Overview](#infrastructure-overview)
3. [AWS Architecture](#aws-architecture)
4. [Terraform Infrastructure as Code](#terraform-infrastructure-as-code)
5. [Storage Systems](#storage-systems)
6. [Database Architecture](#database-architecture)
7. [Network & Security](#network--security)
8. [Monitoring & Logging](#monitoring--logging)
9. [Disaster Recovery](#disaster-recovery)
10. [Cost Optimization](#cost-optimization)

---

## Executive Summary

The PMO Enterprise Platform is built on a modern, cloud-native infrastructure using AWS services, managed entirely through Terraform Infrastructure as Code (IaC).

### Architecture Highlights

- **Cloud Provider:** AWS (Account: 957207443425)
- **Region:** us-east-1 (US East - N. Virginia)
- **Infrastructure as Code:** Terraform
- **Compute:** EC2 t3.medium instances
- **Database:** PostgreSQL 14+ (Dockerized)
- **Storage:** S3 for attachments, MinIO for development
- **Caching:** Redis
- **Email:** MailHog (development)

### Key Services

| Service | Purpose | Technology |
|---------|---------|------------|
| Compute | API & Application Server | EC2 t3.medium |
| Database | Relational data store | PostgreSQL 14+ |
| Object Storage | File attachments | AWS S3 |
| Cache | Session & data caching | Redis |
| Code Storage | Deployment artifacts | S3 |
| Email | Development testing | MailHog |

---

## Infrastructure Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud (us-east-1)                    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  VPC (Default)                                             │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  EC2 Instance (t3.medium)                            │ │ │
│  │  │  - Public IP: 100.28.36.248                          │ │ │
│  │  │  - Instance ID: i-07f64b1f8de8f6b26                  │ │ │
│  │  │                                                       │ │ │
│  │  │  Services:                                           │ │ │
│  │  │  ├─ API Server (Port 4000) - Fastify                │ │ │
│  │  │  ├─ Web App (Port 5173) - React 19 + Vite          │ │ │
│  │  │  ├─ PostgreSQL (Port 5434) - Docker                 │ │ │
│  │  │  ├─ Redis (Port 6379) - Docker                      │ │ │
│  │  │  ├─ MinIO (Port 9000/9001) - Docker                 │ │ │
│  │  │  └─ MailHog (Port 8025) - Docker                    │ │ │
│  │  │                                                       │ │ │
│  │  │  IAM Role: cohuron-ec2-role                         │ │ │
│  │  │  - S3 Access Policy                                  │ │ │
│  │  │  - Systems Manager Access                            │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  S3 Buckets                                                │ │
│  │                                                             │ │
│  │  ├─ cohuron-artifacts-prod-957207443425                   │ │
│  │  │  Purpose: Legacy artifacts bucket                      │ │
│  │  │  Encryption: AES256                                    │ │
│  │  │  Versioning: Enabled                                   │ │
│  │  │                                                         │ │
│  │  ├─ cohuron-attachments-prod-957207443425                 │ │
│  │  │  Purpose: Multi-tenant file attachments               │ │
│  │  │  Structure: tenant_id/entity/entity_id/file.ext       │ │
│  │  │  Encryption: AES256                                    │ │
│  │  │  Versioning: Enabled                                   │ │
│  │  │  Lifecycle: IA (90d), Glacier (180d)                  │ │
│  │  │  CORS: Enabled for presigned URLs                     │ │
│  │  │                                                         │ │
│  │  └─ cohuron-code-prod-957207443425                        │ │
│  │     Purpose: Application code deployment                  │ │
│  │     Encryption: AES256                                    │ │
│  │     Versioning: Enabled                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  IAM                                                        │ │
│  │                                                             │ │
│  │  ├─ User: deployment-user                                  │ │
│  │  │  ARN: arn:aws:iam::957207443425:user/deployment-user  │ │
│  │  │  Profile: cohuron                                      │ │
│  │  │  Purpose: Deployment and management operations        │ │
│  │  │                                                         │ │
│  │  └─ Role: cohuron-ec2-role                                │ │
│  │     Policies:                                              │ │
│  │     - EC2 Systems Manager (ssm:*)                         │ │
│  │     - S3 Full Access (s3:*)                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## AWS Architecture

### Account Information

- **Account ID:** 957207443425
- **Account Name:** Cohuron
- **Primary Region:** us-east-1
- **IAM User:** deployment-user
- **AWS Profile:** cohuron

### EC2 Compute

**Instance Details:**
```yaml
Instance ID: i-07f64b1f8de8f6b26
Instance Type: t3.medium
  - vCPUs: 2
  - Memory: 4 GB
  - Network: Up to 5 Gbps
Public IP: 100.28.36.248
Private IP: 172.31.x.x
AMI: Ubuntu 22.04 LTS
Root Volume: 30 GB gp3
State: Running
```

**IAM Instance Profile:**
```yaml
Role: cohuron-ec2-role
Policies:
  - EC2 Systems Manager Access
  - S3 Full Access (artifacts, attachments, code buckets)
  - CloudWatch Logs (future)
```

**Security Groups:**
```yaml
Inbound Rules:
  - SSH (22) from 0.0.0.0/0
  - HTTP (80) from 0.0.0.0/0
  - HTTPS (443) from 0.0.0.0/0
  - API (4000) from 0.0.0.0/0
  - Web (5173) from 0.0.0.0/0

Outbound Rules:
  - All traffic to 0.0.0.0/0
```

### Elastic IP (Optional)

Currently using ephemeral public IP. For production:
- Allocate Elastic IP
- Associate with EC2 instance
- Update DNS records
- Cost: ~$3.60/month if unattached

---

## Terraform Infrastructure as Code

### Directory Structure

```
infra-tf/
├── main.tf                 # Root module configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── terraform.tfvars        # Variable values (gitignored)
├── tfplan                  # Execution plan
│
├── modules/
│   ├── ec2/
│   │   ├── main.tf         # EC2 instance, IAM role, security group
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── s3/
│   │   ├── main.tf         # Legacy artifacts bucket
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── s3-attachments/
│   │   ├── main.tf         # Multi-tenant attachments bucket
│   │   ├── variables.tf    # CORS, lifecycle, encryption config
│   │   └── outputs.tf
│   │
│   └── s3-code/
│       ├── main.tf         # Code deployment bucket
│       ├── variables.tf
│       └── outputs.tf
│
└── scripts/
    ├── deploy-code.sh      # Deploy application code to S3 and EC2
    └── user-data.sh        # EC2 initialization script
```

### Module: EC2 Instance

**Location:** `modules/ec2/main.tf`

**Resources Created:**
```hcl
resource "aws_instance" "pmo_server"
  - Instance type: t3.medium
  - AMI: Ubuntu 22.04 LTS (latest)
  - Root volume: 30 GB gp3
  - User data: Install Docker, Node.js, pnpm
  - IAM instance profile: cohuron-ec2-role
  - Tags: Name, Project, Environment

resource "aws_iam_role" "ec2_role"
  - Service: ec2.amazonaws.com
  - Assume role policy

resource "aws_iam_instance_profile" "ec2_profile"
  - Links IAM role to EC2 instance

resource "aws_iam_role_policy" "ec2_ssm_policy"
  - Systems Manager permissions

resource "aws_iam_role_policy" "ec2_s3_policy"
  - S3 bucket access (artifacts, attachments, code)
  - Permissions: PutObject, GetObject, DeleteObject, ListBucket

resource "aws_security_group" "pmo_sg"
  - Inbound: SSH, HTTP, HTTPS, API, Web
  - Outbound: All traffic
```

### Module: S3 Attachments

**Location:** `modules/s3-attachments/main.tf`

**Features:**
```hcl
resource "aws_s3_bucket" "cohuron_attachments"
  - Bucket: cohuron-attachments-{env}-{account_id}
  - Region: us-east-1
  - Tags: Project, Purpose, Type

resource "aws_s3_bucket_versioning"
  - Status: Enabled
  - Protects against accidental deletion

resource "aws_s3_bucket_server_side_encryption_configuration"
  - Algorithm: AES256
  - Encrypts all objects at rest

resource "aws_s3_bucket_public_access_block"
  - Block all public access
  - Security best practice

resource "aws_s3_bucket_cors_configuration"
  - Allowed methods: GET, PUT, POST, DELETE, HEAD
  - Allowed origins: localhost:5173, localhost:4000, production domain
  - Required for presigned URL uploads

resource "aws_s3_bucket_lifecycle_configuration"
  - Rule 1: Transition old attachments
    - STANDARD → STANDARD_IA after 90 days
    - STANDARD_IA → GLACIER after 180 days
  - Rule 2: Cleanup incomplete multipart uploads after 7 days
  - Rule 3: Delete old versions after 365 days
```

### Terraform Commands

```bash
# Initialize Terraform
cd /home/rabin/projects/pmo/infra-tf
terraform init

# Validate configuration
terraform validate

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# View outputs
terraform output

# Destroy infrastructure (caution!)
terraform destroy
```

---

## Storage Systems

### S3 Buckets

#### 1. Attachments Bucket

**Name:** `cohuron-attachments-prod-957207443425`

**Purpose:** Multi-tenant file attachment storage

**Storage Structure:**
```
tenant_id=demo/
├── entity=project/
│   └── entity_id={project-uuid}/
│       ├── abc123def456.pdf
│       ├── xyz789ghi012.jpg
│       └── def456abc789.xlsx
├── entity=task/
│   └── entity_id={task-uuid}/
│       ├── attachment1.docx
│       └── attachment2.png
├── entity=employee/
│   └── entity_id={employee-uuid}/
│       └── resume.pdf
└── entity=client/
    └── entity_id={client-uuid}/
        ├── contract.pdf
        └── photo-id.jpg
```

**Configuration:**
- **Versioning:** Enabled
- **Encryption:** AES256 (server-side)
- **Public Access:** Blocked
- **CORS:** Enabled for presigned URLs
- **Lifecycle:**
  - Transition to STANDARD_IA after 90 days
  - Transition to GLACIER after 180 days
  - Delete old versions after 365 days

**Cost Optimization:**
```
STANDARD (0-90 days): $0.023/GB
STANDARD_IA (90-180 days): $0.0125/GB (45% savings)
GLACIER (180+ days): $0.004/GB (83% savings)
```

#### 2. Code Deployment Bucket

**Name:** `cohuron-code-prod-957207443425`

**Purpose:** Application code deployment

**Contents:**
```
api/
├── latest.tar.gz
└── v1.0.0.tar.gz

web/
├── latest.tar.gz
└── v1.0.0.tar.gz
```

**Deployment Workflow:**
```bash
# Build and deploy
pnpm build
tar -czf api.tar.gz dist/
aws s3 cp api.tar.gz s3://cohuron-code-prod-957207443425/api/latest.tar.gz
ssh ec2-user@100.28.36.248 "cd /app && ./deploy.sh"
```

#### 3. Legacy Artifacts Bucket

**Name:** `cohuron-artifacts-prod-957207443425`

**Purpose:** Legacy document storage (pre-attachments system)

**Status:** Deprecated, kept for backward compatibility

### MinIO (Development)

**Purpose:** S3-compatible object storage for local development

**Configuration:**
```yaml
Port: 9000 (API), 9001 (Console)
Access Key: minio
Secret Key: minio123
Bucket: app-files
Console: http://localhost:9001
```

**Usage:**
```bash
# Start MinIO
docker-compose up -d minio

# Access console
open http://localhost:9001
```

---

## Database Architecture

### PostgreSQL Configuration

**Version:** 14+
**Host:** localhost (Dockerized)
**Port:** 5434
**Database:** app
**Schema:** app
**User:** app
**Password:** app

### Database Structure

```
app (schema)
├── Core Entities (13 tables)
│   ├── project          # Projects
│   ├── task            # Tasks
│   ├── employee        # Employees
│   ├── d_client          # Clients
│   ├── business        # Business units
│   ├── office          # Office locations
│   ├── d_role            # Organizational roles
│   ├── d_position        # Employee positions
│   ├── d_worksite        # Work sites
│   ├── d_artifact        # Document attachments
│   ├── d_wiki            # Knowledge base
│   ├── d_form_head       # Form definitions
│   └── d_reports         # Report definitions
│
├── Settings (16 tables)
│   ├── setting_datalabel_office_level
│   ├── setting_datalabel_business_level
│   ├── setting_datalabel_project_stage
│   ├── setting_datalabel_task_stage
│   ├── setting_datalabel_position_level
│   ├── setting_datalabel_opportunity_funnel_stage
│   ├── setting_datalabel_industry_sector
│   ├── setting_datalabel_acquisition_channel
│   ├── setting_datalabel_customer_tier
│   ├── setting_datalabel_client_level
│   ├── setting_datalabel_client_status
│   ├── setting_datalabel_task_priority
│   ├── setting_datalabel_task_update_type
│   ├── setting_datalabel_wiki_publication_status
│   ├── setting_datalabel_form_approval_status
│   └── setting_datalabel_form_submission_status
│
├── Relationships (3 tables)
│   ├── entity_instance_link           # Parent-child entity relationships
│   ├── d_entity_instance_registry      # Entity instance registry
│   └── d_entity_rbac      # RBAC permissions
│
└── Operations (5 tables)
    ├── d_product
    ├── d_inventory
    ├── d_order
    ├── d_shipment
    └── d_invoice
```

### Database Management

**Import Schema:**
```bash
./tools/db-import.sh
```

**Query Database:**
```bash
./tools/run_query.sh "SELECT * FROM app.project LIMIT 10"
```

**Backup Database:**
```bash
PGPASSWORD=app pg_dump -h localhost -p 5434 -U app -d app > backup.sql
```

**Restore Database:**
```bash
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app < backup.sql
```

### Connection Pooling

**Library:** `@neondatabase/serverless`
**Max Connections:** 20
**Idle Timeout:** 30 seconds
**Connection String:** `postgresql://app:app@localhost:5434/app`

---

## Network & Security

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Internet                                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Security Group      │
              │  - SSH (22)          │
              │  - HTTP (80)         │
              │  - HTTPS (443)       │
              │  - API (4000)        │
              │  - Web (5173)        │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  EC2 Instance        │
              │  100.28.36.248       │
              └──────────┬───────────┘
                         │
                         ├─────► API Server (4000)
                         │       - JWT Authentication
                         │       - RBAC Authorization
                         │
                         ├─────► Web App (5173)
                         │       - CORS Enabled
                         │       - React 19
                         │
                         ├─────► PostgreSQL (5434)
                         │       - Local Docker
                         │       - Password Auth
                         │
                         └─────► S3 Buckets
                                 - IAM Role Auth
                                 - Presigned URLs
```

### Authentication & Authorization

**API Authentication:**
- **Method:** JWT (JSON Web Tokens)
- **Token Expiry:** 24 hours
- **Refresh Tokens:** Not implemented (future)
- **Storage:** Bearer token in Authorization header

**RBAC System:**
```sql
-- Permission levels (0-4)
0 = View
1 = Edit
2 = Share
3 = Delete
4 = Create

-- Entity-level permissions
entity='project', entity_id='all' → Full project access
entity='project', entity_id={uuid} → Specific project access
```

**AWS IAM:**
- **Profile:** cohuron
- **User:** deployment-user
- **Role:** cohuron-ec2-role
- **Policies:** S3 access, Systems Manager

### SSL/TLS (Future)

**Current:** HTTP only (development)

**Production Plan:**
```yaml
Certificate: AWS Certificate Manager (ACM)
Provider: Let's Encrypt
Domain: app.cohuron.com
Load Balancer: Application Load Balancer (ALB)
Redirect: HTTP → HTTPS (301)
HSTS: Enabled
TLS Version: 1.2+
```

---

## Monitoring & Logging

### Application Logs

**API Logs:**
```bash
./tools/logs-api.sh [lines]
./tools/logs-api.sh -f  # Follow
```

**Web Logs:**
```bash
./tools/logs-web.sh [lines]
./tools/logs-web.sh -f  # Follow
```

**Log Location:**
- API: `apps/api/logs/api.log`
- Web: `apps/web/logs/web.log`

### Health Checks

**API Health:**
```bash
curl http://localhost:4000/api/health
# Response: {"status":"ok","timestamp":"2025-10-23T..."}
```

**S3 Health:**
```bash
curl http://localhost:4000/api/v1/s3-backend/health
# Response: {"status":"healthy","bucket":"cohuron-attachments-prod-957207443425","connected":true}
```

**Database Health:**
```bash
./tools/run_query.sh "SELECT 1"
```

### Monitoring (Future)

**AWS CloudWatch:**
- EC2 metrics (CPU, memory, disk, network)
- S3 metrics (requests, data transfer)
- Custom application metrics

**Prometheus + Grafana:**
- API response times
- Database query performance
- Error rates
- User activity

---

## Disaster Recovery

### Backup Strategy

**Database Backups:**
```yaml
Frequency: Daily (automated)
Retention: 30 days
Location: S3 bucket (cohuron-backups)
Method: pg_dump
Encryption: AES256
```

**S3 Versioning:**
- All buckets have versioning enabled
- Deleted objects recoverable for 365 days
- Lifecycle rules for old versions

**Code Backups:**
- Git repository (primary)
- S3 code bucket (deployment artifacts)
- Local development copies

### Recovery Procedures

**Database Recovery:**
```bash
# Download latest backup
aws s3 cp s3://cohuron-backups/db/latest.sql.gz backup.sql.gz

# Restore
gunzip backup.sql.gz
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app < backup.sql
```

**S3 Object Recovery:**
```bash
# List versions
aws s3api list-object-versions \
  --bucket cohuron-attachments-prod-957207443425 \
  --prefix tenant_id=demo/entity=project/

# Restore specific version
aws s3api copy-object \
  --copy-source "bucket/key?versionId=xyz" \
  --bucket bucket --key key
```

**EC2 Recovery:**
1. Create AMI snapshot (monthly)
2. Launch new instance from AMI
3. Attach Elastic IP
4. Restore latest code from S3
5. Restore database from backup
6. Update DNS (if needed)

### RTO & RPO

- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours (daily backups)

---

## Cost Optimization

### Monthly Cost Breakdown (Estimated)

```yaml
EC2 t3.medium (us-east-1):
  - On-Demand: $0.0416/hour
  - Monthly: ~$30.37
  - Reserved (1-year): ~$20/month (34% savings)

S3 Storage:
  - Attachments (10 GB): $0.23/month
  - Code (1 GB): $0.023/month
  - Lifecycle savings: ~45% after 90 days

Data Transfer:
  - First 1 GB: Free
  - Next 9.999 TB: $0.09/GB
  - Estimated: ~$5/month

Total Monthly Cost: ~$35-40/month
```

### Optimization Strategies

**1. EC2 Savings:**
- Use Reserved Instances (34% savings)
- Auto-scaling (future)
- Spot instances for dev/test

**2. S3 Savings:**
- Lifecycle policies (implemented)
- Intelligent-Tiering (future)
- Compress files before upload

**3. Data Transfer Savings:**
- CloudFront CDN (future)
- Optimize API responses
- Enable compression

**4. Database Savings:**
- Use Amazon RDS (future)
- Enable automated backups
- Read replicas for scaling

---

## Summary

### Infrastructure Status

✅ **Production-Ready Components:**
- EC2 compute instance
- S3 storage (3 buckets)
- IAM roles and policies
- Security groups
- Terraform IaC

🚧 **Future Enhancements:**
- Elastic IP
- Application Load Balancer
- SSL/TLS certificates
- CloudWatch monitoring
- Auto-scaling groups
- RDS database migration
- CDN (CloudFront)
- WAF protection

### Terraform Modules

| Module | Status | Purpose |
|--------|--------|---------|
| `modules/ec2` | ✅ Complete | EC2 instance, IAM, security group |
| `modules/s3-attachments` | ✅ Complete | Multi-tenant attachments bucket |
| `modules/s3-code` | ✅ Complete | Code deployment bucket |
| `modules/s3` | ✅ Complete | Legacy artifacts bucket |

### Next Steps

1. **Enable CloudWatch Monitoring**
2. **Set up automated backups**
3. **Configure Elastic IP**
4. **Implement SSL/TLS**
5. **Add WAF rules**
6. **Set up CloudFront CDN**
7. **Migrate to RDS**
8. **Implement auto-scaling**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Maintained By:** Platform Team
**Status:** ✅ Production Infrastructure Documented
