# Performance Testing Data Generation

> Synthetic data generation scripts for performance testing the PMO platform's data table rendering, filtering, sorting, and pagination capabilities.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Synthetic Data Generation Strategy](#synthetic-data-generation-strategy)
- [Available Scripts](#available-scripts)
- [Quick Start](#quick-start)
- [Detailed Usage](#detailed-usage)
- [Data Cleanup](#data-cleanup)
- [Performance Testing Plan](#performance-testing-plan)

---

## 🎯 Overview

This directory contains scripts to generate large volumes of realistic synthetic data for performance testing the PMO platform. Each script targets a specific entity type and creates thousands of records to validate UI/UX performance under load.

**Purpose:**
- Test data table rendering with 10,000+ rows
- Validate filtering and sorting performance
- Stress-test pagination and lazy loading
- Benchmark API response times
- Identify UI bottlenecks and optimize

---

## 📊 Synthetic Data Generation Strategy

### Design Principles

1. **Realistic Distribution**: Data follows real-world patterns (e.g., more tasks in "In Progress" than "Blocked")
2. **Unique Identifiers**: Each record has unique code, slug, and ID to prevent conflicts
3. **Relational Integrity**: Generated data maintains relationships with existing entities
4. **Controlled Randomness**: Uses weighted randomization for realistic variety
5. **Metadata Tracking**: All synthetic records tagged for easy identification and cleanup

### Data Characteristics

#### Task Data
- **Volume**: 3,000 tasks per project (15,000 total)
- **Naming**: `{PROJECT}-PERF-00001` through `{PROJECT}-PERF-03000`
- **Stage Distribution** (weighted):
  - In Progress: ~30%
  - In Review: ~20%
  - Planning: ~20%
  - Completed: ~16%
  - Blocked: ~10%
  - Backlog: ~4%
- **Priority Distribution** (weighted):
  - Medium: ~40%
  - High: ~30%
  - Low: ~20%
  - Critical: ~5%
  - Urgent: ~5%
- **Effort Tracking**: Random estimated hours (4-84), realistic actual hours based on stage
- **Story Points**: Fibonacci-like distribution (1, 2, 3, 5, 8)

#### Future Entity Types (Planned)

**Projects** (`projects.sh` - Coming Soon)
- 500-1000 projects across all business units
- Mix of stages: Initiation, Planning, Execution, Monitoring, Closure
- Budget ranges: $10K - $5M
- Timeline variations: 1 month - 24 months

**Clients** (`clients.sh` - Coming Soon)
- 2000+ client records
- Industry sector distribution matching Canadian market
- Customer tier distribution (Bronze 60%, Silver 30%, Gold 8%, Platinum 2%)
- Acquisition channel variety

**Employees** (`employees.sh` - Coming Soon)
- 200-500 employee records
- Position level hierarchy (Junior, Intermediate, Senior, Lead, Director, VP, C-Suite)
- Realistic name generation (Canadian demographics)
- Email patterns: firstname.lastname@huronhome.ca

**Artifacts** (`artifacts.sh` - Coming Soon)
- 5000+ document records
- File type variety (PDF, DOCX, XLSX, PNG, JPG)
- Linked to projects and tasks via entity_id_map

**Wiki Pages** (`wiki.sh` - Coming Soon)
- 1000+ knowledge base articles
- Publication status distribution
- Category tagging and content variety

---

## 📁 Available Scripts

| Script | Entity | Volume | Status | Description |
|--------|--------|--------|--------|-------------|
| `tasks.sh` | Tasks | 15,000 | ✅ Ready | Generates 3000 tasks per project |
| `projects.sh` | Projects | 1,000 | 🔜 Planned | Generates projects across all business units |
| `clients.sh` | Clients | 2,000 | 🔜 Planned | Generates client records with realistic data |
| `employees.sh` | Employees | 500 | 🔜 Planned | Generates employee/user accounts |
| `artifacts.sh` | Artifacts | 5,000 | 🔜 Planned | Generates document/file records |
| `wiki.sh` | Wiki | 1,000 | 🔜 Planned | Generates wiki/knowledge base entries |
| `all.sh` | All | 24,500+ | 🔜 Planned | Runs all scripts in dependency order |
| `cleanup.sh` | All | N/A | 🔜 Planned | Removes all performance test data |

---

## 🚀 Quick Start

### Prerequisites

- Database running on `localhost:5434` (or set `DB_HOST`, `DB_PORT`)
- PostgreSQL user `app` with password `app` (or set `DB_USER`, `DB_PASSWORD`)
- Database `app` initialized with schema

### Run a Single Script

```bash
# Navigate to perftest directory
cd /home/rabin/projects/pmo/perftest

# Run task data generation
./tasks.sh
```

### Environment Variables (Optional)

```bash
# Use custom database configuration
DB_HOST=staging.db.local \
DB_PORT=5432 \
DB_USER=admin \
DB_PASSWORD=secret \
./tasks.sh
```

---

## 📖 Detailed Usage

### 1. Task Performance Test (`tasks.sh`)

**What it does:**
- Deletes existing performance test tasks (code pattern `%-PERF-%`)
- Generates 3000 tasks for each of 5 projects
- Randomizes stages, priorities, and effort estimates
- Links tasks to projects via metadata
- Assigns all tasks to James Miller

**Execution:**

```bash
./tasks.sh
```

**Expected Output:**

```
========================================
Task Performance Test Data Generator
========================================

Target: 3000 tasks per project × 5 projects = 15,000 tasks

NOTICE:  Starting performance test data generation...
NOTICE:  Generating tasks for project DT (1 of 5)...
NOTICE:    - Generated 500 tasks for project DT
NOTICE:    - Generated 1000 tasks for project DT
...
NOTICE:  Performance test data generation complete!
NOTICE:  Total tasks created: 15,000

 project_code |            project_name              | task_count
--------------+--------------------------------------+------------
 DT-2024-001  | Digital Transformation Initiative    |       3000
 FLC-2024-001 | Fall 2024 Landscaping Campaign      |       3000
 HVAC-MOD-001 | HVAC Equipment Modernization        |       3000
 COE-2024-001 | Corporate Office Expansion          |       3000
 CSE-2024-001 | Customer Service Excellence         |       3000

✓ Task performance test data generation complete!
```

**Verification:**

```bash
# Check total count
psql -h localhost -p 5434 -U app -d app -c "
  SELECT COUNT(*) FROM app.d_task WHERE code LIKE '%-PERF-%';
"

# Check by project
psql -h localhost -p 5434 -U app -d app -c "
  SELECT
    LEFT(code, POSITION('-PERF' IN code) - 1) as project,
    COUNT(*) as task_count
  FROM app.d_task
  WHERE code LIKE '%-PERF-%'
  GROUP BY LEFT(code, POSITION('-PERF' IN code) - 1);
"
```

---

## 🧹 Data Cleanup

### Remove All Performance Test Data

**Tasks:**

```bash
# Delete all performance test tasks
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c "
  DELETE FROM app.d_task WHERE code LIKE '%-PERF-%';
"
```

**Future: Cleanup Script**

A `cleanup.sh` script will be added to remove all synthetic data:

```bash
./cleanup.sh          # Remove all performance test data
./cleanup.sh tasks    # Remove only task data
./cleanup.sh --dry-run # Show what would be deleted
```

---

## 🎯 Performance Testing Plan

### Phase 1: Task Data (✅ Complete)
- [x] Generate 15,000 tasks across 5 projects
- [ ] Test table rendering with 3000+ rows
- [ ] Benchmark filtering by stage, priority
- [ ] Test sorting by multiple columns
- [ ] Validate pagination performance

### Phase 2: Project Data (🔜 Next)
- [ ] Generate 1000 projects
- [ ] Test project list view with large dataset
- [ ] Benchmark Kanban board rendering
- [ ] Test grid view performance
- [ ] Validate search and filtering

### Phase 3: Client & Employee Data
- [ ] Generate 2000 clients
- [ ] Generate 500 employees
- [ ] Test relationship queries
- [ ] Benchmark autocomplete/dropdown performance
- [ ] Validate RBAC filtering at scale

### Phase 4: Artifact & Wiki Data
- [ ] Generate 5000 artifacts
- [ ] Generate 1000 wiki pages
- [ ] Test file listing performance
- [ ] Benchmark content search
- [ ] Validate entity relationship navigation

### Phase 5: Full Integration
- [ ] Run all scripts together (24,500+ records)
- [ ] Test cross-entity queries
- [ ] Benchmark dashboard aggregations
- [ ] Validate overall system performance
- [ ] Identify and optimize bottlenecks

---

## 🛠️ Customization

### Adjust Task Volume

Edit `tasks.sh` and change the loop count:

```bash
# Line 55: Generate 3000 tasks for this project
FOR task_idx IN 1..3000 LOOP  # Change to 5000 for more data
```

### Modify Stage Distribution

Edit the CASE statement in `tasks.sh`:

```sql
-- Increase "Completed" tasks
task_stage := CASE (random() * 10)::integer
    WHEN 0 THEN 'Backlog'
    WHEN 1 THEN 'Planning'
    WHEN 2 THEN 'In Progress'
    WHEN 3,4,5,6,7,8,9,10 THEN 'Completed'  -- 80% completed
    ELSE 'Planning'
END;
```

### Add More Projects

Add project IDs to the arrays in `tasks.sh`:

```sql
project_ids uuid[] := ARRAY[
    '93106ffb-402e-43a7-8b26-5287e37a1b0e'::uuid,
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'::uuid,
    '72304dab-202c-39e7-8a26-3287d26a0c2d'::uuid,
    '61203bac-101b-28d6-7a15-2176c15a0b1c'::uuid,
    '50192aab-000a-17c5-6904-1065b04a0a0b'::uuid,
    'YOUR-NEW-PROJECT-ID-HERE'::uuid  -- Add your project
];

project_codes text[] := ARRAY['DT', 'FLC', 'HVAC', 'COE', 'CSE', 'NEW'];
```

---

## 📝 Notes

- All performance test data is tagged with `code LIKE '%-PERF-%'` pattern
- Synthetic data uses metadata field `task_type: 'performance_test'`
- Scripts are idempotent but will create duplicates if run multiple times (unique constraints will fail)
- For repeat runs, delete existing perf data first or adjust code patterns
- Monitor database size - 15,000 tasks ≈ 50-100 MB depending on JSONB content

---

## 🔗 Related Documentation

- [Database Schema](../db/README.md) - DDL files and data model
- [API Testing](../tools/API_TESTING.md) - API endpoint testing
- [Main README](../README.md) - Project overview

---

## 🤝 Contributing

When adding new performance test scripts:

1. Follow the naming convention: `{entity}.sh`
2. Use the same shell script wrapper pattern
3. Include progress logging (RAISE NOTICE every 500 records)
4. Add verification queries at the end
5. Tag all data for easy cleanup (consistent code pattern)
6. Update this README with script details
7. Make scripts executable: `chmod +x {entity}.sh`

---

**Last Updated:** 2025-10-18
**Maintained By:** PMO Platform Team
