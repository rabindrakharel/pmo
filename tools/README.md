# PMO Platform Management Tools

**16 comprehensive management tools** for the PMO platform, providing complete **platform automation**, **API testing**, **RBAC debugging**, and **database management**. All tools are production-ready with enhanced logging, error handling, and colored output.

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
**Purpose**: **Complete API system validation** - tests all 11 API modules with enhanced authentication and unified RBAC
**Usage**: `./tools/test-api-endpoints.sh [base_url] [email] [password]`
**LLM Context**: Use when user needs comprehensive API testing or system validation after changes
**Key Features**:
- **✅ 11 API Modules Coverage**: All endpoints from auth to forms with complete CRUD testing
- **✅ Enhanced JWT Authentication**: Tests login with permission bundling and token validation
- **✅ Unified RBAC Validation**: Tests `rel_employee_scope_unified` with 9 scope types
- **✅ Real Production Data**: James Miller with 113+ active permissions across all scopes
- **✅ New Auth Endpoints**: `/permissions`, `/scopes/:scopeType`, `/debug` validation
- **✅ Bearer Token Integration**: Proper Authorization headers for all API calls
- **✅ Permission Matrix Testing**: Validates app:page, app:api, app:component scopes
- **✅ Detailed Results**: Color-coded output with pass/fail indicators and permission analysis
- **✅ Error Handling**: Comprehensive error reporting with debugging information

## 🗄️ Database Management Tools

### db-import.sh
**Purpose**: **Complete database schema import** - resets and imports all 24 tables with production data
**Usage**: `./tools/db-import.sh [--dry-run] [--verbose] [--skip-validation]`
**LLM Context**: **Primary tool** for database initialization, reset, or re-import operations
**Key Features**:
- **✅ Complete Schema Reset**: Drops and recreates entire app schema safely
- **✅ 13 DDL Files**: Dependency-optimized loading order (00-13) with foreign key validation
- **✅ Production Data**: Huron Home Services with 15 employees, 7 projects, 20+ tasks
- **✅ Permission System**: 113+ RBAC permissions across 9 scope types
- **✅ Canadian Business Data**: Real postal codes, provinces, regulatory compliance
- **✅ Comprehensive Validation**: Post-import schema integrity and relationship validation
- **✅ Enhanced Logging**: Detailed progress reporting with timestamps and error handling
- **✅ Environment Support**: Full database connection configuration via environment variables

*Database validation tools have been removed from the system*



## 📋 LLM Quick Reference

### Most Common User Requests & Tool Mapping:
- **"Start the platform"** → `./tools/start-all.sh`
- **"Check what's running"** → `./tools/status.sh`  
- **"Import/Reset the database"** → `./tools/db-import.sh`
- **"Stop everything"** → `./tools/stop-all.sh`
- **"Restart after changes"** → `./tools/restart-all.sh`
- **"Check API logs"** → `./tools/logs-api.sh`
- **"API development only"** → `./tools/start-api.sh`
- **"Test all API endpoints"** → `./tools/test-api-endpoints.sh`

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
└── db-import.sh        # Database import/reset
```

## 💡 LLM Usage Guidelines

1. **Always check service status first** if user reports issues
2. **Use db-import.sh** for any database reset or import
3. **Prefer start-all.sh** for initial platform setup
4. **Use specific service tools** only when user specifies partial operations
5. **Check logs** when debugging service issues
6. **All tools have colored output** for better user experience
