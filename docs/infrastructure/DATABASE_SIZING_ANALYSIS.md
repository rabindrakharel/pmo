# Database Sizing Analysis for 500-Client PMO Platform

> **Analysis Date**: 2025-12-06
> **Platform Version**: 9.3.0
> **Target Scale**: 500 enterprise clients

---

## Executive Summary

This analysis calculates storage requirements and recommends database solutions for the PMO platform at enterprise scale. Based on the provided requirements, we're looking at **76.5 million+ entity instances** requiring approximately **800 GB - 1.2 TB** of raw data storage, scaling to **3-5 TB** with indexes, replication, and operational overhead.

---

## 1. Data Volume Calculation

### Input Parameters (Per Client)

| Entity Type | Per Client | 500 Clients | Notes |
|-------------|------------|-------------|-------|
| Projects | 3,000 | **1,500,000** | Work containers |
| Tasks | 20,000 | **10,000,000** | Per-client (not per-project) |
| Customers | 10,000 | **5,000,000** | CRM records |
| Products | 100,000 | **50,000,000** | Product catalog |
| Services | 20,000 | **10,000,000** | Service catalog |
| **Subtotal** | 153,000 | **76,500,000** | Primary entities only |

### Clarification on Task Count

> ⚠️ **Important**: The numbers above assume 20,000 tasks **per client**, not per project.
>
> If 20,000 tasks **per project**:
> - 1.5M projects × 20K tasks = **30 BILLION tasks**
> - This would require petabyte-scale infrastructure

---

## 2. Row Size Estimates

### Primary Entity Tables

Based on actual DDL schema analysis:

| Table | Columns | Est. Row Size | Notes |
|-------|---------|---------------|-------|
| `app.project` | 20+ | **1,000 bytes** | UUIDs, dates, JSONB metadata |
| `app.task` | 15+ | **800 bytes** | Stage/priority datalabels |
| `app.customer` | 35+ | **1,500 bytes** | Address, auth, contact fields |
| `app.product` | 18+ | **700 bytes** | SKU, UPC, product details |
| `app.service` | 12+ | **500 bytes** | Rates, hours, categories |

### Infrastructure Tables (Per Entity Instance)

Every entity instance creates records in 3 infrastructure tables:

| Table | Per Entity | Est. Row Size | Purpose |
|-------|------------|---------------|---------|
| `entity_instance` | 1 row | **200 bytes** | Central registry |
| `entity_rbac` | 1-3 rows | **100 bytes** × N | Permission grants |
| `entity_instance_link` | 1-2 rows | **100 bytes** × N | Parent-child links |

**Infrastructure Overhead**: ~1.5-2x storage multiplier per entity

---

## 3. Storage Calculation

### Primary Table Storage

| Entity | Row Count | Row Size | Raw Storage |
|--------|-----------|----------|-------------|
| Projects | 1,500,000 | 1,000 B | **1.4 GB** |
| Tasks | 10,000,000 | 800 B | **7.5 GB** |
| Customers | 5,000,000 | 1,500 B | **7.0 GB** |
| Products | 50,000,000 | 700 B | **32.7 GB** |
| Services | 10,000,000 | 500 B | **4.7 GB** |
| **Subtotal** | 76,500,000 | - | **53.3 GB** |

### Infrastructure Table Storage

| Table | Rows | Row Size | Storage |
|-------|------|----------|---------|
| entity_instance | 76,500,000 | 200 B | **14.3 GB** |
| entity_rbac | 153,000,000 | 100 B | **14.3 GB** |
| entity_instance_link | 100,000,000 | 100 B | **9.3 GB** |
| **Subtotal** | 329,500,000 | - | **37.9 GB** |

### Additional Tables

| Category | Estimated Storage |
|----------|-------------------|
| Datalabels (settings) | 500 MB |
| Entity metadata | 100 MB |
| Workflow/orchestrator | 5 GB |
| Logging/audit | 20-50 GB |
| Attachments metadata | 10 GB |
| **Subtotal** | **35-65 GB** |

### Total Raw Data

```
Primary Tables:        53.3 GB
Infrastructure:        37.9 GB
Additional Tables:     50.0 GB
─────────────────────────────
RAW TOTAL:            ~141 GB
```

### With Operational Overhead

| Factor | Multiplier | Storage |
|--------|------------|---------|
| Raw data | 1.0x | 141 GB |
| B-tree indexes | 1.5-2.0x | +211 GB |
| TOAST storage (JSONB) | 1.2x | +28 GB |
| WAL/transaction logs | 0.5x | +70 GB |
| Bloat allowance | 1.3x | +55 GB |
| Replication (1 replica) | 2.0x | +505 GB |
| **TOTAL** | - | **~1 TB** |

---

## 4. Scaling Scenarios

### Conservative Scenario (Per-Client Tasks)

```
76.5M entities → ~1 TB storage
With 3 years of growth (2x) → ~2-3 TB
```

### Aggressive Scenario (Per-Project Tasks)

```
30B+ entities → ~500 TB+ storage
Requires: Sharding, distributed database, or time-series approach
```

---

## 5. Database Recommendations

### Option 1: PostgreSQL (Recommended for < 5 TB)

**Best For**: Your current architecture with 76M entities

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16+                            │
├─────────────────────────────────────────────────────────────┤
│  Strengths:                                                  │
│  • Native JSONB support (metadata fields)                   │
│  • Excellent query optimizer for complex RBAC joins         │
│  • Mature partitioning (by client tenant_id)               │
│  • Your team already knows it                               │
│                                                              │
│  Configuration for 1TB+:                                     │
│  • shared_buffers: 64-128 GB (25% of RAM)                  │
│  • effective_cache_size: 192-384 GB                        │
│  • work_mem: 512 MB - 2 GB                                 │
│  • maintenance_work_mem: 4-8 GB                            │
│  • max_connections: 500-1000                               │
│                                                              │
│  Hardware Requirements:                                      │
│  • CPU: 32-64 cores                                         │
│  • RAM: 256-512 GB                                          │
│  • Storage: NVMe SSD (5-10 TB provisioned)                 │
│  • IOPS: 50,000-100,000 sustained                          │
│                                                              │
│  Estimated Cost (AWS RDS):                                  │
│  • db.r6g.8xlarge: ~$5,000/month                           │
│  • Storage (3TB gp3): ~$400/month                          │
│  • Total: ~$6,000-8,000/month                              │
└─────────────────────────────────────────────────────────────┘
```

**Partitioning Strategy**:
```sql
-- Partition by tenant (client_id)
CREATE TABLE app.task (
    id uuid,
    tenant_id uuid NOT NULL,
    ...
) PARTITION BY HASH (tenant_id);

-- Create 64-128 partitions for even distribution
CREATE TABLE app.task_p0 PARTITION OF app.task
    FOR VALUES WITH (MODULUS 64, REMAINDER 0);
```

### Option 2: Amazon Aurora PostgreSQL

**Best For**: Managed solution with auto-scaling

```
┌─────────────────────────────────────────────────────────────┐
│                Amazon Aurora PostgreSQL                      │
├─────────────────────────────────────────────────────────────┤
│  Strengths:                                                  │
│  • Auto-scaling storage up to 128 TB                        │
│  • Up to 15 read replicas                                   │
│  • 3x performance vs standard PostgreSQL                   │
│  • Automatic failover                                       │
│                                                              │
│  Configuration:                                              │
│  • db.r6g.8xlarge writer instance                          │
│  • 2-4 db.r6g.4xlarge reader instances                     │
│  • Aurora I/O-Optimized for high throughput                │
│                                                              │
│  Estimated Cost:                                             │
│  • Writer: ~$3,500/month                                    │
│  • Readers (3): ~$5,000/month                              │
│  • Storage + I/O: ~$1,500/month                            │
│  • Total: ~$10,000-12,000/month                            │
└─────────────────────────────────────────────────────────────┘
```

### Option 3: CockroachDB (Distributed SQL)

**Best For**: Global distribution, > 10 TB, extreme availability

```
┌─────────────────────────────────────────────────────────────┐
│                     CockroachDB                              │
├─────────────────────────────────────────────────────────────┤
│  Strengths:                                                  │
│  • Horizontal scaling (add nodes, add capacity)            │
│  • Multi-region replication with consistency               │
│  • PostgreSQL wire protocol (minimal code changes)         │
│  • Automatic sharding                                       │
│                                                              │
│  Considerations:                                             │
│  • Higher latency per query (distributed consensus)        │
│  • Some PostgreSQL features not supported                  │
│  • Higher cost at smaller scale                            │
│                                                              │
│  Configuration:                                              │
│  • 9-node cluster across 3 availability zones             │
│  • 16 vCPU, 64 GB RAM per node                            │
│                                                              │
│  Estimated Cost (CockroachDB Dedicated):                   │
│  • ~$15,000-25,000/month for 3TB cluster                  │
└─────────────────────────────────────────────────────────────┘
```

### Option 4: Citus (Distributed PostgreSQL)

**Best For**: Keep PostgreSQL, add horizontal scaling

```
┌─────────────────────────────────────────────────────────────┐
│              Citus (PostgreSQL Extension)                    │
├─────────────────────────────────────────────────────────────┤
│  Strengths:                                                  │
│  • Native PostgreSQL (all features work)                   │
│  • Automatic sharding by tenant_id                         │
│  • Real-time analytics with columnar storage               │
│  • Available on Azure as managed service                   │
│                                                              │
│  Configuration:                                              │
│  • 1 coordinator node                                       │
│  • 4-8 worker nodes                                         │
│  • Shard by tenant_id (client UUID)                        │
│                                                              │
│  Estimated Cost (Azure Cosmos DB for PostgreSQL):          │
│  • ~$8,000-15,000/month                                    │
└─────────────────────────────────────────────────────────────┘
```

### Option 5: TimescaleDB (Time-Series + Relational)

**Best For**: Heavy audit logging, metrics, time-series queries

```
┌─────────────────────────────────────────────────────────────┐
│                      TimescaleDB                             │
├─────────────────────────────────────────────────────────────┤
│  Strengths:                                                  │
│  • Automatic time-based partitioning                        │
│  • Excellent for system_logging, audit tables              │
│  • Compression (90%+ for time-series data)                 │
│  • Full PostgreSQL compatibility                            │
│                                                              │
│  Best Hybrid Approach:                                       │
│  • PostgreSQL for entity data                               │
│  • TimescaleDB for logging/audit/metrics                   │
│                                                              │
│  Estimated Cost (Timescale Cloud):                          │
│  • ~$3,000-5,000/month for 1TB compressed                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Recommended Architecture

### For 500 Clients (76M Entities)

```
┌─────────────────────────────────────────────────────────────┐
│            RECOMMENDED: Aurora PostgreSQL + Redis            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Aurora    │    │   Aurora    │    │   Aurora    │     │
│  │   Writer    │────│  Reader 1   │────│  Reader 2   │     │
│  │  r6g.8xl    │    │  r6g.4xl    │    │  r6g.4xl    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Aurora Storage (Auto-scales)            │   │
│  │                  Up to 128 TB                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────┐    ┌─────────────────────────────────┐   │
│  │   ElastiCache   │    │        Application Tier        │   │
│  │  Redis 7.x      │◄───│    Fastify API (4+ nodes)      │   │
│  │  r6g.xlarge     │    │                               │   │
│  └─────────────┘    └─────────────────────────────────┘   │
│                                                              │
│  Cache Strategy:                                             │
│  • entity:fields:{code} - 24h TTL (metadata)               │
│  • datalabel:{name} - 10min TTL (settings)                 │
│  • session:{token} - 24h TTL (auth)                        │
│                                                              │
│  Estimated Monthly Cost:                                     │
│  • Aurora: $10,000                                          │
│  • ElastiCache: $500                                        │
│  • Total: ~$10,500/month                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Performance Optimizations

```sql
-- 1. Composite indexes for RBAC queries (critical path)
CREATE INDEX idx_entity_rbac_lookup
ON app.entity_rbac (person_code, person_id, entity_code, entity_instance_id);

-- 2. Partial indexes for active records
CREATE INDEX idx_project_active
ON app.project (id) WHERE active_flag = true;

-- 3. BRIN indexes for time-series data
CREATE INDEX idx_task_created_brin
ON app.task USING BRIN (created_ts);

-- 4. GIN indexes for JSONB queries
CREATE INDEX idx_customer_metadata
ON app.customer USING GIN (metadata);

-- 5. Partitioning for largest tables
-- Partition entity_rbac, entity_instance_link by entity_code
```

---

## 7. Multi-Tenancy Considerations

### Current Architecture (Shared Schema)

Your current design uses a shared schema for all clients. For 500 clients at scale:

```
┌─────────────────────────────────────────────────────────────┐
│                Multi-Tenancy Options                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Option A: Shared Schema + Row-Level Security              │
│  ─────────────────────────────────────────────             │
│  • Add tenant_id column to all tables                       │
│  • Use PostgreSQL RLS policies                              │
│  • Minimal code changes                                     │
│  • Good for < 1000 tenants                                 │
│                                                              │
│  Option B: Schema-per-Tenant                                │
│  ───────────────────────────                                │
│  • CREATE SCHEMA tenant_001, tenant_002, ...               │
│  • Set search_path per connection                          │
│  • Better isolation                                         │
│  • Harder to manage at 500+ tenants                        │
│                                                              │
│  Option C: Database-per-Tenant (Overkill)                  │
│  ─────────────────────────────────────                     │
│  • Separate databases per client                           │
│  • Maximum isolation                                        │
│  • Operational nightmare at scale                          │
│                                                              │
│  RECOMMENDED: Option A (Shared Schema + RLS)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Adding Tenant Isolation

```sql
-- Add tenant column to all entity tables
ALTER TABLE app.project ADD COLUMN tenant_id uuid NOT NULL;
ALTER TABLE app.task ADD COLUMN tenant_id uuid NOT NULL;
-- ... all tables

-- Create tenant lookup
CREATE TABLE app.tenant (
    id uuid PRIMARY KEY,
    name varchar(255),
    subdomain varchar(100) UNIQUE,
    settings jsonb DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE app.project ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON app.project
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## 8. Cost Comparison Summary

| Solution | Monthly Cost | Best For |
|----------|-------------|----------|
| Self-managed PostgreSQL (AWS EC2) | $3,000-5,000 | Budget-conscious, have DBA |
| Amazon RDS PostgreSQL | $6,000-8,000 | Managed, moderate scale |
| **Amazon Aurora PostgreSQL** | **$10,000-12,000** | **Recommended** |
| CockroachDB Dedicated | $15,000-25,000 | Global, extreme scale |
| Citus/Azure CosmosDB | $8,000-15,000 | Need sharding now |

---

## 9. Growth Planning

### Year 1-3 Projection

| Year | Clients | Entities | Storage | Solution |
|------|---------|----------|---------|----------|
| Y1 | 100 | 15M | 200 GB | RDS PostgreSQL |
| Y2 | 250 | 38M | 500 GB | Aurora PostgreSQL |
| Y3 | 500 | 76M | 1 TB | Aurora + Read Replicas |
| Y4+ | 1000+ | 150M+ | 2+ TB | Consider Citus/sharding |

### Migration Path

```
Phase 1 (Now): PostgreSQL with partitioning
    ↓
Phase 2 (100-250 clients): Aurora PostgreSQL
    ↓
Phase 3 (500+ clients): Aurora + heavy caching
    ↓
Phase 4 (1000+ clients): Citus or CockroachDB
```

---

## 10. Quick Decision Matrix

| Requirement | Recommended Solution |
|-------------|---------------------|
| < 500 clients, < 2TB | **Aurora PostgreSQL** |
| 500-2000 clients | Citus (Azure) or Aurora |
| Global users, need < 50ms latency | CockroachDB |
| Heavy time-series/logging | Add TimescaleDB |
| Cost-sensitive startup | Self-managed PostgreSQL |
| Already on Azure | Azure Cosmos DB for PostgreSQL |
| Already on GCP | Cloud SQL + AlloyDB |

---

## Conclusion

For **500 clients with 76.5 million entities**:

1. **Storage Required**: ~1 TB (with overhead: 2-3 TB)
2. **Recommended Database**: Amazon Aurora PostgreSQL
3. **Estimated Cost**: $10,000-12,000/month
4. **Key Optimizations**:
   - Add `tenant_id` with RLS
   - Partition large tables by tenant
   - Heavy Redis caching for metadata
   - 2-3 read replicas for query scaling

This architecture will scale to 1000+ clients before requiring a move to distributed SQL solutions.
