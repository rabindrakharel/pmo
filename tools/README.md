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

### stop-all.sh
**Purpose**: Stops all platform services (API, web, and infrastructure)
**Usage**: `./tools/stop-all.sh`
**LLM Context**: Use when user wants to completely shut down the platform

### restart-all.sh
**Purpose**: Restarts all platform services in correct order
**Usage**: `./tools/restart-all.sh`
**LLM Context**: Use when user needs to restart everything (e.g., after configuration changes)

### status.sh
**Purpose**: Shows current status of all platform services
**Usage**: `./tools/status.sh`
**LLM Context**: Use when user asks about service status or needs to check what's running
**Features**:
- API server status and PID information
- Web server status and PID information  
- Docker container status for infrastructure services
- Service URLs and management command suggestions

## 🔧 API Service Tools

### start-api.sh
**Purpose**: Starts only the API server (backend)
**Usage**: `./tools/start-api.sh`
**LLM Context**: Use when user only needs backend services or for API development

### stop-api.sh  
**Purpose**: Stops only the API server
**Usage**: `./tools/stop-api.sh`
**LLM Context**: Use when user wants to stop just the backend service

### restart-api.sh
**Purpose**: Restarts only the API server
**Usage**: `./tools/restart-api.sh`  
**LLM Context**: Use when user has made backend changes and needs to restart API only

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

### stop-web.sh
**Purpose**: Stops only the web application  
**Usage**: `./tools/stop-web.sh`
**LLM Context**: Use when user wants to stop just the frontend service

### restart-web.sh
**Purpose**: Restarts only the web application
**Usage**: `./tools/restart-web.sh`
**LLM Context**: Use when user has made frontend changes and needs to restart web only

### logs-web.sh
**Purpose**: Views web application logs
**Usage**: `./tools/logs-web.sh [lines]` or `./tools/logs-web.sh -f`  
**LLM Context**: Use when user needs to debug frontend issues or check web server activity

## 🧪 API Testing Tools

### debug-rbac.sh
**Purpose**: Deep analysis of RBAC permissions for debugging access issues
**Usage**: `./tools/debug-rbac.sh [email] [password]`
**LLM Context**: Use when user reports permission/access issues or RBAC debugging needed
**Features**:
- **JWT Token Authentication**: Obtains and uses JWT tokens for all API calls
- **Database Permission Verification**: Provides SQL queries to check user permissions in `rel_user_scope` table
- Endpoint access testing with detailed error reporting
- Permission matrix analysis for specific users
- RBAC system engagement verification
- Step-by-step debugging guidance with SQL commands for manual verification

### test-api-endpoints.sh
**Purpose**: Comprehensive API endpoint testing with JWT authentication and RBAC validation
**Usage**: `./tools/test-api-endpoints.sh [base_url] [email] [password]`
**LLM Context**: Use when user needs complete API system validation or endpoint testing
**Features**:
- **JWT Authentication**: Automatically obtains JWT token via login endpoint
- **Bearer Token Usage**: All API calls use proper Authorization headers
- 15+ endpoint coverage across all modules (emp, client, project, task, scope, etc.)
- Public, authenticated, and protected endpoint testing
- RBAC permission checking (expects 403 responses for users without permissions)
- **Note**: John Smith has full permissions, so most endpoints return 200 (not 403)
- Detailed test results with pass/fail indicators
- Color-coded output for better readability
- Test summary with next steps guidance

## 🗄️ Database Management Tools

### db-drop.sh
**Purpose**: Safely drops all database tables and schema
**Usage**: `./tools/db-drop.sh`
**LLM Context**: Use when user needs to completely clean the database
**Features**:
- Interactive confirmation prompt for safety
- Drops entire `app` schema with CASCADE
- Recreates empty `app` schema
- Environment variable support for database connection

### db-import.sh
**Purpose**: Imports schema and curated data from schema.sql file
**Usage**: `./tools/db-import.sh`
**LLM Context**: Use when user needs to restore database to default state
**Features**:
- Validates schema file exists before importing
- Imports complete schema and sample data (30 tables, 23 route pages, 8 components)
- Shows database statistics after import (15 user permissions)
- Displays sample data counts for all major entities

### db-recreate.sh
**Purpose**: Combined drop and import in one step (most commonly used)
**Usage**: `./tools/db-recreate.sh`  
**LLM Context**: Use when user wants to reset database completely (most common database operation)
**Features**:
- Combines db-drop.sh and db-import.sh functionality
- Interactive confirmation prompt for safety
- Two-step process with progress indicators
- Complete database statistics after recreation (30 tables, 23 route pages, 8 components, 15 permissions)
- Comprehensive sample data for all entities (employees, clients, projects, tasks)

## 📋 LLM Quick Reference

### Most Common User Requests & Tool Mapping:
- **"Start the platform"** → `./tools/start-all.sh`
- **"Check what's running"** → `./tools/status.sh`  
- **"Reset the database"** → `./tools/db-recreate.sh`
- **"Stop everything"** → `./tools/stop-all.sh`
- **"Restart after changes"** → `./tools/restart-all.sh`
- **"Check API logs"** → `./tools/logs-api.sh`
- **"API development only"** → `./tools/start-api.sh`
- **"Test all API endpoints"** → `./tools/test-api-endpoints.sh`
- **"Debug RBAC permissions"** → `./tools/debug-rbac.sh`
- **"API not working/permission issues"** → `./tools/debug-rbac.sh`

### Service Ports & URLs:
- API Server: `http://localhost:4000` (with `/docs` for OpenAPI)
- Web Application: `http://localhost:5173`  
- MinIO Console: `http://localhost:9001` (minio/minio123)
- MailHog: `http://localhost:8025`
- PostgreSQL: `localhost:5434` (app/app)
- Redis: `localhost:6379`

### 🚨 **Security Notice**
- **Development Mode**: `DEV_BYPASS_OIDC=true` disables ALL authentication
- **No Login Required**: Direct access to full admin functionality
- **John Smith Access**: No password needed - automatic super admin privileges

## 🔧 Environment Variables

Database tools support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5434` | Database port |
| `DB_USER` | `app` | Database user |
| `DB_PASSWORD` | `app` | Database password |
| `DB_NAME` | `app` | Database name |
| `SCHEMA_FILE` | `../db/schema.sql` | Path to schema file |

## 🔄 Tool Dependencies & Order

1. **Infrastructure First**: Docker services must be running before API/web
2. **Database Schema**: Must be imported before API server starts
3. **API Before Web**: Web application depends on API endpoints
4. **PID Files**: Located in `.pids/` directory for process management

## 🚨 Safety Features

- **Interactive Confirmation**: Destructive operations require "yes" confirmation
- **Process Management**: PID file tracking prevents duplicate processes
- **Health Checks**: Automatic readiness validation for services
- **Error Handling**: `set -e` in all scripts for fail-fast behavior
- **Colored Output**: Visual status indicators (🟢 success, 🔴 error, 🟡 warning)

## 📁 File Structure Context

```
tools/
├── readme.md           # This comprehensive index
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
├── debug-rbac.sh       # API testing & debugging
├── test-api-endpoints.sh
├── db-drop.sh          # Database management
├── db-import.sh
└── db-recreate.sh
```

## 💡 LLM Usage Guidelines

1. **Always check service status first** if user reports issues
2. **Use db-recreate.sh** for most database reset requests
3. **Prefer start-all.sh** for initial platform setup
4. **Use specific service tools** only when user specifies partial operations
5. **Check logs** when debugging service issues
6. **All tools have colored output** - mention this for user experience