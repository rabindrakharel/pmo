# Coherent PMO Platform - AWS Architecture

## Overview

This document describes the AWS infrastructure architecture for the Coherent PMO Platform, detailing network design, security controls, and deployment patterns.

---

## Network Architecture

### VPC Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Region (us-east-1)                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    VPC: 10.0.0.0/16                              │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────┐  ┌────────────────────────────┐   │   │
│  │  │  Availability Zone A    │  │  Availability Zone B       │   │   │
│  │  │                         │  │                            │   │   │
│  │  │  ┌──────────────────┐  │  │  ┌──────────────────────┐ │   │   │
│  │  │  │ Public Subnet    │  │  │  │ Public Subnet        │ │   │   │
│  │  │  │ app-subnet-1     │  │  │  │ app-subnet-2         │ │   │   │
│  │  │  │ 10.0.1.0/24      │  │  │  │ 10.0.2.0/24          │ │   │   │
│  │  │  │                  │  │  │  │                      │ │   │   │
│  │  │  │ ┌──────────────┐ │  │  │  │                      │ │   │   │
│  │  │  │ │ EC2 Instance │ │  │  │  │ (Reserved for       │ │   │   │
│  │  │  │ │ Coherent App │ │  │  │  │  future scaling)    │ │   │   │
│  │  │  │ │ + Elastic IP │ │  │  │  │                      │ │   │   │
│  │  │  │ └──────────────┘ │  │  │  │                      │ │   │   │
│  │  │  └──────────────────┘  │  │  └──────────────────────┘ │   │   │
│  │  │                         │  │                            │   │   │
│  │  │  ┌──────────────────┐  │  │  ┌──────────────────────┐ │   │   │
│  │  │  │ Private Subnet   │  │  │  │ Private Subnet       │ │   │   │
│  │  │  │ data-subnet-1    │  │  │  │ data-subnet-2        │ │   │   │
│  │  │  │ 10.0.11.0/24     │  │  │  │ 10.0.12.0/24         │ │   │   │
│  │  │  │                  │  │  │  │                      │ │   │   │
│  │  │  │ ┌──────────────┐ │  │  │  │ ┌──────────────────┐ │   │   │
│  │  │  │ │ RDS Primary  │ │  │  │  │ │ RDS Standby      │ │   │   │
│  │  │  │ │ PostgreSQL   │◄┼──┼──┼──┼►│ (Multi-AZ prod)  │ │   │   │
│  │  │  │ └──────────────┘ │  │  │  │ └──────────────────┘ │   │   │
│  │  │  └──────────────────┘  │  │  └──────────────────────┘ │   │   │
│  │  │                         │  │                            │   │   │
│  │  └─────────────────────────┘  └────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌────────────────────┐                                          │   │
│  │  │ Internet Gateway   │◄─────────────────────────────────────── │   │
│  │  └────────────────────┘                                          │   │
│  │                                                                   │   │
│  │  ┌────────────────────┐                                          │   │
│  │  │ NAT Gateway        │                                          │   │
│  │  │ (in public subnet) │                                          │   │
│  │  └────────────────────┘                                          │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      S3 Bucket (Regional)                        │   │
│  │                   coherent-artifacts-{env}                       │   │
│  │                    (Accessed via IAM role)                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Subnet Strategy

**Public Subnets (app-subnet-group)**
- Purpose: Application tier (EC2 instances)
- Internet access: Direct via Internet Gateway
- Use case: Web servers, API servers, load balancers
- CIDR: 10.0.1.0/24, 10.0.2.0/24

**Private Subnets (data-subnet-group)**
- Purpose: Database tier (RDS instances)
- Internet access: Outbound only via NAT Gateway
- Use case: Databases, internal services
- CIDR: 10.0.11.0/24, 10.0.12.0/24

### High Availability

- **Multi-AZ Deployment**: Subnets span 2 availability zones
- **RDS Multi-AZ**: Automatic failover in production
- **Future Scaling**: Reserved app-subnet-2 for auto-scaling

---

## Compute Architecture

### EC2 Instance Configuration

```
┌─────────────────────────────────────────────┐
│        EC2 Instance (Ubuntu 22.04)          │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │         Nginx (Port 80/443)           │ │
│  │      (Reverse Proxy + SSL/TLS)        │ │
│  └───────────────┬───────────────────────┘ │
│                  │                           │
│         ┌────────┴─────────┐                │
│         │                  │                │
│  ┌──────▼──────┐   ┌──────▼──────┐         │
│  │  Fastify API│   │  Vite Web   │         │
│  │  (Port 4000)│   │  (Port 5173)│         │
│  │             │   │             │         │
│  │  - Auth     │   │  - React 19 │         │
│  │  - RBAC     │   │  - Tailwind │         │
│  │  - Business │   │  - Entity   │         │
│  │    Logic    │   │    System   │         │
│  └─────────────┘   └─────────────┘         │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │          PM2 Process Manager          │ │
│  │      (Auto-restart, monitoring)       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │        Supporting Services            │ │
│  │  - Docker (for Redis, MinIO)          │ │
│  │  - PostgreSQL Client                  │ │
│  │  - AWS CLI v2                         │ │
│  │  - CloudWatch Agent                   │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Instance Specifications:**
- **Type**: t3.medium (2 vCPU, 4 GB RAM)
- **Storage**: 30 GB gp3 EBS (encrypted)
- **OS**: Ubuntu 22.04 LTS
- **Networking**: Enhanced networking enabled
- **Monitoring**: CloudWatch detailed monitoring

**Software Stack:**
- Node.js 20.x LTS
- Nginx 1.18+
- PM2 5.x
- Docker 24.x + Docker Compose v2
- AWS CLI v2

---

## Database Architecture

### RDS PostgreSQL Configuration

```
┌───────────────────────────────────────────────────────┐
│              RDS PostgreSQL Instance                  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Primary Instance (AZ-A)               │ │
│  │                                                 │ │
│  │  Engine: PostgreSQL 14.10                       │ │
│  │  Instance: db.t3.micro (1 vCPU, 1 GB RAM)      │ │
│  │  Storage: 20 GB gp3 (autoscaling to 100 GB)    │ │
│  │  Encryption: AES-256                            │ │
│  │                                                 │ │
│  │  Databases:                                     │ │
│  │    └─ coherent (app database)                  │ │
│  │                                                 │ │
│  │  Schema: app                                    │ │
│  │    ├─ 13 core entity tables                    │ │
│  │    ├─ 16 settings tables                       │ │
│  │    ├─ d_entity_id_map (relationships)          │ │
│  │    └─ entity_id_rbac_map (permissions)         │ │
│  └─────────────────────────────────────────────────┘ │
│                        │                             │
│                        │ Synchronous replication     │
│                        │ (Multi-AZ prod only)        │
│                        ▼                             │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Standby Instance (AZ-B)               │ │
│  │         (Production only, auto-failover)        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │            Automated Backups                    │ │
│  │  - Retention: 7 days                            │ │
│  │  - Window: 03:00-04:00 UTC                      │ │
│  │  - Point-in-time recovery enabled               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Connection Details:**
- Port: 5432
- SSL: Required
- Max Connections: 87 (db.t3.micro)
- Access: Private subnets only

---

## Storage Architecture

### S3 Bucket Configuration

```
┌─────────────────────────────────────────────────────┐
│          S3 Bucket: coherent-artifacts              │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │              Object Storage                   │ │
│  │                                               │ │
│  │  /uploads/        - User uploads              │ │
│  │  /artifacts/      - Project artifacts         │ │
│  │  /documents/      - Documents & files         │ │
│  │  /backups/        - Database backups          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         Security & Access Control             │ │
│  │                                               │ │
│  │  - Public access: BLOCKED                     │ │
│  │  - Encryption: AES-256                        │ │
│  │  - Versioning: ENABLED                        │ │
│  │  - Access: IAM role (EC2 only)                │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │            Lifecycle Policies                 │ │
│  │                                               │ │
│  │  Current version: Standard                    │ │
│  │  30 days old: → Standard-IA                   │ │
│  │  90 days old: → Glacier                       │ │
│  │  365 days old: → Expire (delete)              │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Network Security

```
┌──────────────────────────────────────────────────────────┐
│                  Security Group: app-sg                  │
│                  (EC2 Application Server)                │
│                                                          │
│  Inbound Rules:                                          │
│  ├─ SSH (22)     ← Restricted IP (ssh_allowed_cidr)     │
│  ├─ HTTP (80)    ← 0.0.0.0/0 (public)                   │
│  ├─ HTTPS (443)  ← 0.0.0.0/0 (public)                   │
│  ├─ API (4000)   ← 0.0.0.0/0 (dev), ALB only (prod)     │
│  └─ Web (5173)   ← 0.0.0.0/0 (dev), ALB only (prod)     │
│                                                          │
│  Outbound Rules:                                         │
│  └─ All traffic  → 0.0.0.0/0                            │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  Security Group: db-sg                   │
│                    (RDS Database)                        │
│                                                          │
│  Inbound Rules:                                          │
│  └─ PostgreSQL (5432) ← app-sg ONLY                     │
│                                                          │
│  Outbound Rules:                                         │
│  └─ All traffic  → 0.0.0.0/0                            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### IAM Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 IAM Role: coherent-ec2-role              │
│                                                          │
│  Attached Policies:                                      │
│  ├─ Inline Policy: coherent-ec2-s3-policy                │
│  │  └─ Permissions:                                     │
│  │     ├─ s3:PutObject                                  │
│  │     ├─ s3:GetObject                                  │
│  │     ├─ s3:DeleteObject                               │
│  │     └─ s3:ListBucket                                 │
│  │                                                      │
│  └─ Managed Policy: AmazonSSMManagedInstanceCore        │
│     └─ Permissions:                                     │
│        ├─ Systems Manager access                        │
│        ├─ CloudWatch Logs write                         │
│        └─ Parameter Store read                          │
│                                                          │
│  Trust Relationship:                                     │
│  └─ Service: ec2.amazonaws.com                          │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           Instance Profile: coherent-ec2-profile         │
│           (Attached to EC2 instance)                     │
│                                                          │
│  └─ Role: coherent-ec2-role                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Data Encryption

**At Rest:**
- RDS storage: AES-256 encryption
- EBS volumes: AES-256 encryption
- S3 objects: AES-256 encryption
- Backups: Encrypted snapshots

**In Transit:**
- HTTPS/TLS 1.2+ for web traffic
- SSL for database connections
- Encrypted API communication

---

## Data Flow

### User Request Flow

```
1. User Request
   │
   ├─ DNS Resolution (Route 53)
   │  └─ coherent.yourdomain.com → EC2 Elastic IP
   │
   ├─ HTTPS/TLS Termination (Nginx)
   │  └─ Certificate validation (Let's Encrypt)
   │
   ├─ Route Determination (Nginx)
   │  ├─ /api/* → Fastify API (localhost:4000)
   │  └─ /* → Vite Web (localhost:5173)
   │
   ├─ API Processing (Fastify)
   │  ├─ JWT Authentication
   │  ├─ RBAC Permission Check (entity_id_rbac_map)
   │  ├─ Business Logic Execution
   │  └─ Database Query (RDS PostgreSQL)
   │
   ├─ Database Access (RDS)
   │  ├─ Connection pool validation
   │  ├─ Query execution
   │  └─ Result set return
   │
   └─ Response
      ├─ Data serialization (JSON)
      ├─ HTTPS encryption
      └─ Client delivery
```

### File Upload Flow

```
1. User Uploads File
   │
   ├─ Multipart Upload (API)
   │  ├─ File validation (size, type)
   │  └─ Temporary storage (/tmp)
   │
   ├─ S3 Upload (AWS SDK)
   │  ├─ IAM role authentication
   │  ├─ Encryption (AES-256)
   │  └─ Versioning enabled
   │
   ├─ Database Record (RDS)
   │  └─ INSERT INTO app.d_artifact (...)
   │     ├─ S3 key/path
   │     ├─ Metadata (size, type)
   │     └─ RBAC permissions
   │
   └─ Cleanup
      └─ Delete temporary file
```

---

## Backup Strategy

### Automated Backups

**RDS Database:**
- Automated daily snapshots (03:00-04:00 UTC)
- Retention: 7 days
- Point-in-time recovery enabled
- Cross-region replication (optional)

**Application Database:**
- Daily pg_dump via cron (02:00 UTC)
- Upload to S3: s3://bucket/backups/
- Local retention: 7 days
- S3 lifecycle: Glacier after 90 days

**S3 Versioning:**
- All objects versioned
- Deleted objects retained for 30 days
- Old versions transitioned to Glacier

### Disaster Recovery

**RTO (Recovery Time Objective): 1 hour**
- RDS failover: 1-2 minutes (Multi-AZ)
- EC2 rebuild: 15 minutes
- Application deployment: 10 minutes

**RPO (Recovery Point Objective): 24 hours**
- RDS automated backups: Daily
- Application backups: Daily
- Point-in-time recovery: 5-minute granularity

---

## Monitoring and Logging

### CloudWatch Metrics

**EC2 Monitoring:**
- CPU utilization
- Network in/out
- Disk read/write
- Status checks

**RDS Monitoring:**
- CPU utilization
- Database connections
- Read/write IOPS
- Free storage space
- Replication lag (Multi-AZ)

**Application Metrics:**
- PM2 process status
- API response times
- Error rates
- User sessions

### Log Aggregation

```
Application Logs → PM2 → /opt/coherent/logs/
                   ↓
              CloudWatch Logs

Nginx Logs → /var/log/nginx/
              ↓
         CloudWatch Logs

System Logs → /var/log/
               ↓
          CloudWatch Logs

Database Logs → RDS Logs
                 ↓
            CloudWatch Logs
```

---

## Scaling Strategy

### Vertical Scaling (Current)

**Development:**
- EC2: t3.micro → t3.medium
- RDS: db.t3.micro → db.t3.small

**Production:**
- EC2: t3.medium → t3.large/xlarge
- RDS: db.t3.small → db.t3.medium/large

### Horizontal Scaling (Future)

**Auto Scaling Group:**
```
┌─────────────────────────────────────────┐
│     Application Load Balancer          │
│              (Port 443)                 │
└────────────────┬────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼─────┐         ┌─────▼─────┐
│  EC2 #1   │         │  EC2 #2   │
│  AZ-A     │         │  AZ-B     │
└───────────┘         └───────────┘
      │                     │
      └──────────┬──────────┘
                 │
           ┌─────▼─────┐
           │    RDS    │
           │ (Primary) │
           └───────────┘
```

**Configuration:**
- Min instances: 2
- Max instances: 4
- Target CPU: 70%
- Health checks: /api/v1/health

---

## Cost Optimization

### Current Architecture Costs

| Environment | Monthly Cost | Annual Cost |
|------------|--------------|-------------|
| Development | $43 | $516 |
| Production | $133 | $1,596 |

### Optimization Strategies

1. **Reserved Instances** (1-year commitment)
   - Save 30-40% on EC2 and RDS
   - Dev: $30/month savings
   - Prod: $60/month savings

2. **Spot Instances** (dev/staging)
   - Save up to 90% on EC2
   - Use for non-critical environments

3. **Storage Optimization**
   - S3 lifecycle policies (automatic)
   - Delete old RDS snapshots
   - Compress application logs

4. **NAT Gateway Alternative**
   - Use NAT instance (t3.nano)
   - Save $32/month

5. **Scheduled Scaling**
   - Stop dev resources after hours
   - Save 50% on dev costs

---

## Security Best Practices

### Implemented

- ✅ VPC isolation
- ✅ Private subnet for database
- ✅ Security groups (least privilege)
- ✅ Encrypted storage (RDS, EBS, S3)
- ✅ IAM roles (no hardcoded credentials)
- ✅ Automated backups
- ✅ CloudWatch monitoring

### Recommended for Production

- ⚠️ MFA on AWS accounts
- ⚠️ AWS WAF (Web Application Firewall)
- ⚠️ GuardDuty (threat detection)
- ⚠️ CloudTrail (audit logging)
- ⚠️ Secrets Manager (credential rotation)
- ⚠️ VPC Flow Logs
- ⚠️ AWS Config (compliance)

---

## Compliance

### Data Residency
- All data stored in selected AWS region
- No cross-region data transfer (default)
- GDPR/PIPEDA compliant architecture

### Audit Trail
- CloudTrail: All API calls logged
- CloudWatch: Application logs retained
- RDS: Audit logging enabled

### Encryption
- Data at rest: AES-256
- Data in transit: TLS 1.2+
- Key management: AWS KMS (optional)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-17
**Architecture Pattern**: 3-tier web application
**Deployment Model**: Single-region, multi-AZ
