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

## 🏢 What This Project Is & Why It Exists

### **Project Purpose**
**Huron Home Services PMO Platform** is a comprehensive **Project Management Office (PMO) system** specifically designed for **Canadian home services companies**. Built for **Huron Home Services** - Ontario's premier home services provider operating across **landscaping**, **snow removal**, **HVAC**, **plumbing**, and **solar energy** services.

### **Why This Project Exists**
**Business Challenge**: Home services companies manage complex operations across:
- **Multiple Service Lines** (5+ service departments)
- **Diverse Client Portfolio** (12+ clients from residential to municipal)
- **Seasonal Operations** (winter snow removal, fall landscaping campaigns)
- **Regulatory Compliance** (WSIB safety, professional licensing, Canadian tax jurisdiction)
- **Multi-Location Operations** (GTA, Hamilton, London markets)
- **Complex Personnel Management** (25+ employees from executives to seasonal workers)

**Solution**: A unified PMO platform that provides:
- **Complete Business Operations Management** across all service lines
- **Advanced RBAC System** with 113+ permissions and 5-layer security
- **Canadian Regulatory Compliance** built-in from day one
- **Enterprise-Grade Architecture** supporting real business growth
- **Comprehensive Reporting & Analytics** for strategic decision-making

### **Real Business Context**
- **Huron Home Services HQ**: Mississauga, ON serving GTA + surrounding markets
- **Executive Team**: CEO James Miller, CFO Sarah Chen, CTO David Kumar, COO Maria Rodriguez
- **Service Portfolio**: $2M+ annual revenue across 5 service departments
- **Client Base**: Premium residential, major commercial contracts, municipal services
- **Strategic Projects**: Digital transformation, market expansion, safety compliance

---

## 🚀 Tech Stack Summary

### **Core Architecture**
- **Monorepo Structure**: React frontend + Fastify backend + PostgreSQL database
- **API-Driven Configuration**: Backend-generated UI schemas with frontend-safe field mapping
- **Perfect Naming Consistency**: Unified camelCase across API, routes, components, and configs
- **Two-API Architecture**: Config API (🔧 UI schemas) + Data API (📊 business data)

### **Frontend Stack**
- **Framework**: React 19.1.1 with TypeScript 5.5+
- **Build**: Vite 6.1.5 (fast development and production builds)
- **Styling**: TailwindCSS 3.4.0 with modern component patterns
- **UI Components**: Lucide React icons, shadcn/ui components
- **State**: React Context API + JWT token management
- **Architecture**: 12 entity types with hierarchical navigation

### **Backend Stack**
- **Runtime**: Node.js 20+ with TypeScript 5.0+ and ESM modules
- **Framework**: Fastify 5.0+ (high-performance HTTP server)
- **Database**: PostgreSQL 16+ with PostGIS, pgcrypto, uuid-ossp extensions
- **ORM**: Drizzle ORM (type-safe SQL operations)
- **Auth**: JWT with @fastify/jwt + unified RBAC system
- **Cache**: Redis for session and permission caching

### **Database Architecture**
- **5-Layer RBAC System**: Foundation → Rules → Permissions → Instances → Access Control
- **20+ Tables**: Meta, Scope, Domain, Operational, Permission categories
- **Canadian Business Data**: Real postal codes, provinces, regulatory compliance
- **Temporal Tracking**: Head/Records pattern with complete audit trails

### **DevOps & Tools**
- **Containers**: Docker + Docker Compose for local development
- **Management**: 16 comprehensive platform tools (start/stop/test/debug)
- **Database Tools**: Automated import, validation, reset capabilities
- **API Testing**: Complete endpoint validation with RBAC testing
- **Monitoring**: Health checks, logs, service status reporting

---

## 🎯 Key Features & Capabilities

### **Business Management**
- **Multi-Service Operations**: Landscaping, snow removal, HVAC, plumbing, solar
- **Client Portfolio Management**: 12+ clients from residential estates to municipal contracts
- **Project Lifecycle**: 10+ strategic projects with full budget/timeline tracking
- **Employee Management**: 25+ employees across all departments and roles
- **Worksite Operations**: Physical locations with geospatial data

### **Technical Excellence**
- **Enterprise RBAC**: 113+ permissions across 9 scope types with real-time validation
- **API-First Design**: 11 API modules with OpenAPI documentation
- **Modern UI/UX**: Hierarchical navigation, global search (⌘K), RBAC-integrated components
- **Performance**: Optimized queries, caching, connection pooling
- **Security**: JWT authentication, granular permissions, audit trails

### **Canadian Compliance**
- **Geographic Hierarchy**: 8-level Canadian location structure
- **Regulatory Tracking**: Professional licensing, WSIB compliance
- **Tax Jurisdiction**: Provincial tax and compliance management
- **Bilingual Support**: English/French language capabilities

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and pnpm 8+
- Docker and Docker Compose

### Start Everything (Recommended)
```bash
# 1. Clone and install
git clone <repository-url> && cd pmo && pnpm install

# 2. Start entire platform
./tools/start-all.sh

# 3. Access applications
# Web App: http://localhost:5173
# API Docs: http://localhost:4000/docs
```

### Alternative: Manual Steps
```bash
make up              # Start infrastructure
make seed            # Initialize database  
./tools/start-api.sh # Start API server
./tools/start-web.sh # Start web app
```

---

## 🔧 Platform Management

### Essential Tools
| Tool | Purpose | Usage |
|------|---------|-------|
| `start-all.sh` | Start complete platform | `./tools/start-all.sh` |
| `stop-all.sh` | Stop all services | `./tools/stop-all.sh` |
| `status.sh` | Check service status | `./tools/status.sh` |
| `db-import.sh` | Reset database | `./tools/db-import.sh` |

### Service URLs
- **Web App**: http://localhost:5173
- **API Docs**: http://localhost:4000/docs  
- **API Health**: http://localhost:4000/api/health
- **MinIO Console**: http://localhost:9001 (minio/minio123)
- **MailHog**: http://localhost:8025

---

## 🏗️ System Architecture Overview

### **5-Layer RBAC Architecture**
```
🏗️ RBAC ARCHITECTURE FLOW
meta_entity_types (12 entity types) → Foundation Layer
    ↓ 
meta_entity_hierarchy (parent→child creation rules) → Rules Layer
    ↓ 
meta_entity_hierarchy_permission_mapping (permission matrix) → Permission Layer
    ↓
entity_id_hierarchy_mapping (actual instance relationships) → Instance Layer
    ↓
rel_employee_entity_action_rbac (specific user grants) → Access Control Layer
```

### **Entity Categories & Management**
The system manages **12 entity types** across **4 categories**:

- **Organizational (4)**: hr, biz, org, client - structural/hierarchical entities
- **Operational (3)**: project, task, worksite - execution/workflow entities  
- **Personnel (2)**: employee, role - human resources entities
- **Content (3)**: wiki, form, artifact - information/knowledge entities

### **Business Data Highlights**
- **Executive Leadership**: CEO James Miller with comprehensive system access
- **25+ Employee Profiles**: From C-suite to seasonal workers
- **12+ Diverse Clients**: Residential estates to municipal contracts  
- **10+ Strategic Projects**: Market expansion, digital transformation, safety compliance
- **Complete Service Coverage**: 5 departments across 2 business divisions

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**This PMO platform represents a production-ready, enterprise-grade solution for Canadian home services operations, demonstrating sophisticated business domain modeling, advanced RBAC implementation, and comprehensive technical architecture suitable for real-world deployment.**