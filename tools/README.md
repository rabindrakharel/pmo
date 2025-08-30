# PMO Platform Tools Index

This directory contains all management tools for the PMO platform. This document serves as a comprehensive index for LLM reference, cataloging all available tools with their purposes, usage, and key features.

## 🚀 Platform Management Tools

### start-all.sh
**Purpose**: Complete platform startup - infrastructure, database, API, and web services
**Usage**: `./tools/start-all.sh`
**LLM Context**: Use when user wants to start the entire platform from scratch
**Features**:
- Starts Docker infrastructure services (PostgreSQL, Redis, MinIO, MailHog)
- Recreates database schema with fresh data
- Starts API server on port 4000
- Starts web application on port 5173
- Provides service status and quick links
- Automatic readiness checks and error handling

### status.sh
**Purpose**: Shows current status of all platform services
**Usage**: `./tools/status.sh`
**LLM Context**: Use when user asks about service status or needs to check what's running
**Features**:
- API server status and PID information
- Web server status and PID information  
- Docker container status for infrastructure services
- Service URLs and management command suggestions

### restart-all.sh
**Purpose**: Restarts all platform services in correct order
**Usage**: `./tools/restart-all.sh`
**LLM Context**: Use when user needs to restart everything (e.g., after configuration changes)

### stop-all.sh
**Purpose**: Stops all platform services (API, web, and infrastructure)
**Usage**: `./tools/stop-all.sh`
**LLM Context**: Use when user wants to completely shut down the platform

## 🔧 API Service Tools

### start-api.sh
**Purpose**: Starts only the API server (backend)
**Usage**: `./tools/start-api.sh`
**LLM Context**: Use when user only needs backend services or for API development

### restart-api.sh
**Purpose**: Restarts only the API server
**Usage**: `./tools/restart-api.sh`  
**LLM Context**: Use when user has made backend changes and needs to restart API only

### stop-api.sh  
**Purpose**: Stops only the API server
**Usage**: `./tools/stop-api.sh`
**LLM Context**: Use when user wants to stop just the backend service

### logs-api.sh
**Purpose**: Views API server logs
**Usage**: `./tools/logs-api.sh [lines]` or `./tools/logs-api.sh -f`
**LLM Context**: Use when user needs to debug API issues or check API activity
**Features**:
- View last N lines of API logs (default 100)
- Follow logs in real-time with `-f` flag
- Colored output for better readability

## 🌐 Web Service Tools

### start-web.sh
**Purpose**: Starts only the web application (frontend)
**Usage**: `./tools/start-web.sh`
**LLM Context**: Use when user only needs frontend services or for UI development

### restart-web.sh
**Purpose**: Restarts only the web application
**Usage**: `./tools/restart-web.sh`
**LLM Context**: Use when user has made frontend changes and needs to restart web only

### stop-web.sh
**Purpose**: Stops only the web application  
**Usage**: `./tools/stop-web.sh`
**LLM Context**: Use when user wants to stop just the frontend service

### logs-web.sh
**Purpose**: Views web application logs
**Usage**: `./tools/logs-web.sh [lines]` or `./tools/logs-web.sh -f`  
**LLM Context**: Use when user needs to debug frontend issues or check web server activity

## 🧪 API Testing Tools

### test-api-endpoints.sh
**Purpose**: Comprehensive API endpoint testing with enhanced authentication and unified RBAC validation
**Usage**: `./tools/test-api-endpoints.sh [base_url] [email] [password]`
**LLM Context**: Use when user needs complete API system validation or endpoint testing
**Features**:
- **Enhanced JWT Authentication**: Tests new auth endpoints with permission bundling
- **Bearer Token Usage**: All API calls use proper Authorization headers
- **Extended Endpoint Coverage**: 20+ endpoints including new auth endpoints (`/permissions`, `/scopes/:scopeType`, `/debug`)
- **Unified RBAC Testing**: Tests permission system using `rel_employee_scope_unified` table
- **Granular Permission Validation**: Validates app:page, app:api, app:component scopes
- **Permission Bundling Testing**: Validates login response includes complete permission structure
- **Enhanced Test Coverage**: James Miller with 113+ permissions across multiple scope types
- **Real-time Permission Checks**: Tests new permission validation endpoints
- **Detailed Test Results**: Pass/fail indicators with permission analysis
- **Color-coded Output**: Enhanced readability with detailed permission debugging information

### debug-rbac.sh
**Purpose**: Enhanced RBAC permissions analysis with unified permission system support
**Usage**: `./tools/debug-rbac.sh [email] [password]`  
**LLM Context**: Use when user reports permission/access issues or RBAC debugging needed
**Features**:
- **Enhanced JWT Token Authentication**: Supports new auth endpoints with permission bundling
- **Unified Permission Analysis**: Analyzes `rel_employee_scope_unified` table with direct table references
- **Advanced Permission Endpoints**: Tests `/permissions`, `/scopes/:scopeType`, `/permissions/debug` endpoints
- **Granular Scope Testing**: Validates app:page, app:api, app:component permissions
- **Permission Matrix Analysis**: 113+ permission records across 8+ scope types
- **Real-time Permission Validation**: Uses new auth API for comprehensive permission checking
- **Step-by-step Debugging**: Enhanced SQL commands for unified permission model verification

## 🗄️ Database Management Tools

### db-import.sh
**Purpose**: Complete database import with correct DDL dependency order
**Usage**: `./tools/db-import.sh [--dry-run] [--verbose] [--skip-validation]`
**LLM Context**: Use for any database initialization, reset, or re-import
**Features**:
- **Complete Schema Reset**: Drops and recreates app schema
- **Dependency-Optimized Loading**: Processes 13 DDL files in correct order (00-13)
- **Data Validation**: Validates schema structure and relationships post-import
- **Enhanced Logging**: Comprehensive logging with timestamps
- **Environment Variable Support**: Honors all database connection variables
- **Dry-run Mode**: Test import process without making changes

### validate-schema.sh
**Purpose**: Database schema validation and integrity checking
**Usage**: `./tools/validate-schema.sh [--fix-permissions] [--verbose]`
**LLM Context**: Use when user reports database issues or wants to verify schema integrity
**Features**:
- **Schema Structure Validation**: Checks all expected tables and relationships
- **Foreign Key Integrity**: Validates referential integrity
- **Permission System Validation**: Checks RBAC permission structure
- **Auto-fix Capabilities**: Can repair common permission issues
- **Comprehensive Coverage**: Tests core tables across all functional categories



## 📋 LLM Quick Reference

### Most Common User Requests & Tool Mapping:
- **"Start the platform"** → `./tools/start-all.sh`
- **"Check what's running"** → `./tools/status.sh`  
- **"Import/Reset the database"** → `./tools/db-import.sh`
- **"Validate database schema"** → `./tools/validate-schema.sh`
- **"Stop everything"** → `./tools/stop-all.sh`
- **"Restart after changes"** → `./tools/restart-all.sh`
- **"Check API logs"** → `./tools/logs-api.sh`
- **"API development only"** → `./tools/start-api.sh`
- **"Test all API endpoints"** → `./tools/test-api-endpoints.sh`
- **"Debug RBAC permissions"** → `./tools/debug-rbac.sh`
- **"Database issues/corruption"** → `./tools/validate-schema.sh`

### Service Ports & URLs:
- API Server: `http://localhost:4000` (with `/docs` for OpenAPI)
- Web Application: `http://localhost:5173`  
- MinIO Console: `http://localhost:9001` (minio/minio123)
- MailHog: `http://localhost:8025`
- PostgreSQL: `localhost:5434` (app/app)
- Redis: `localhost:6379`

## 🔧 Environment Variables

Database tools support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5434` | Database port |
| `DB_USER` | `app` | Database user |
| `DB_PASSWORD` | `app` | Database password |
| `DB_NAME` | `app` | Database name |

## 🔄 Tool Dependencies & Order

1. **Infrastructure First**: Docker services must be running before API/web
2. **Database Schema**: Import/reset with `./tools/db-import.sh` before starting API
3. **API Before Web**: Web application depends on API endpoints
4. **PID Files**: Located in `.pids/` directory for process management

## 📁 Active Tools

```
tools/
├── README.md           # This tool index
├── start-all.sh        # Complete platform startup
├── stop-all.sh         # Complete platform shutdown  
├── restart-all.sh      # Complete platform restart
├── status.sh           # Service status checker
├── start-api.sh        # API server management
├── stop-api.sh
├── restart-api.sh
├── logs-api.sh
├── start-web.sh        # Web server management
├── stop-web.sh
├── restart-web.sh
├── logs-web.sh
├── test-api-endpoints.sh # API endpoint testing
├── debug-rbac.sh       # RBAC debugging
├── db-import.sh        # Database import/reset
└── validate-schema.sh  # Database validation
```

## 💡 LLM Usage Guidelines

1. **Always check service status first** if user reports issues
2. **Use db-import.sh** for any database reset or import
3. **Prefer start-all.sh** for initial platform setup
4. **Use specific service tools** only when user specifies partial operations
5. **Check logs** when debugging service issues
6. **All tools have colored output** for better user experience
