# Huron Home Services - PMO Enterprise Platform 🏡

> **Complete Canadian Home Services Management System** - Production-ready PMO platform with comprehensive data model, unified RBAC, and industry-specific business intelligence

## 📖 Documentation Index & Project Overview

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[🏠 Main README](./README.md)** | Project overview and quick start | Architecture, getting started, business context |
| **[🌐 Frontend Guide](./apps/web/README.md)** | React 19 hierarchical navigation UI/UX | 12 entity types, RBAC integration, modern components |
| **[🔧 Backend API](./apps/api/README.md)** | Enterprise Fastify API with unified RBAC | 11 modules, JWT auth, 113+ permissions |
| **[🗄️ Database Schema](./db/README.md)** | 5-layer RBAC architecture with 20+ tables | Canadian business context, DDL files, relationships |
| **[🛠️ Management Tools](./tools/README.md)** | 16 platform operation tools | Start/stop, database import, API testing, RBAC debugging |

---
AI/LLM/Agent:
For API, UIUX or App testing, Strictly use the credentials below:
James Miller Account:
  - ID: 8260b1b0-5efc-4611-ad33-ee76c0cf7f13
  - Email: james.miller@huronhome.ca
  - Password: password123

DATA MODEL:
1️⃣ Core Business Entities (13 tables):

  1. d_office - Office locations (4-level hierarchy: Office→District→Region→Corporate)
  2. d_business - Business units (3-level hierarchy: Dept→Division→Corporate)
  3. ops_project_head - Projects with budgets, timelines, stakeholders
  4. ops_task_head - Tasks linked to projects
  5. d_employee - Users with authentication & RBAC (includes James Miller)
  6. d_client - Customer entities
  7. d_worksite - Work site locations
  8. d_role - Organizational roles (22 records)
  9. d_position - Employee positions (16 records)
  10. d_artifact - Documents & file attachments
  11. d_wiki - Knowledge base
  12. ops_formlog_head - Form definitions
  13. d_reports - Report definitions

  2️⃣ Metadata/Configuration Tables (5 tables):

  1. meta_office_level - Office hierarchy (4 levels)
  2. meta_business_level - Business hierarchy (3 levels)
  3. meta_project_stage - Project lifecycle stages (7 stages)
  4. meta_task_stage - Task workflow stages (7 stages)
  5. meta_position_level - Position hierarchy (8 levels)