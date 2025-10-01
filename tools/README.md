# PMO Platform Management Tools

**5 essential management tools** for the PMO platform, providing complete **platform automation**, **API testing**, and **database management**. All tools are production-ready with enhanced logging, error handling, and colored output.

## 🚀 Platform Management Tools

### start-all.sh
**Purpose**: Complete platform startup - infrastructure, database, API, and web services
**Usage**: `./tools/start-all.sh`
**When to Use**: Initial platform startup, development environment setup, after system restarts
**Features**:
- Starts Docker infrastructure services (PostgreSQL, Redis, MinIO, MailHog)
- Recreates database schema with fresh data
- Starts API server on port 4000
- Starts web application on port 5173
- Provides service status and quick links
- Automatic readiness checks and error handling

### db-import.sh
**Purpose**: **Complete database schema import** - resets and imports all 27 DDL files with production data
**Usage**: `./tools/db-import.sh [--dry-run] [--verbose] [--skip-validation]`
**When to Use**: Database initialization, schema reset, data corruption recovery, development data refresh
**Key Features**:
- **✅ Complete Schema Reset**: Drops and recreates entire app schema safely
- **✅ 28 DDL Files**: Dependency-optimized loading order (I-XXVIII) with Roman numeral sequence
- **✅ Head/Data Pattern**: Temporal entities with head/data structure for content management
- **✅ 4-Level Office Hierarchy**: Office → District → Region → Corporate
- **✅ 3-Level Business Hierarchy**: Department → Division → Corporate levels
- **✅ Entity Mapping Framework**: Parent-child relationships via entity_id_map table
- **✅ RBAC Permission System**: Comprehensive role-based access control
- **✅ Canadian Business Context**: Real postal codes, provinces, regulatory compliance
- **✅ Comprehensive Validation**: Post-import schema integrity and relationship validation
- **✅ Enhanced Logging**: Detailed progress reporting with timestamps and error handling

**Import Order**:
1. **Core Entities**: Office, Business, Project, Task (I-V)
2. **Content Entities**: Artifact, Form, Wiki, Reports (VI-XIII)
3. **Meta Configuration**: Office/Business/Project/Task metadata (XIV-XVII)
4. **Entity Mapping**: Framework and relationships (XVIII-XX)
5. **Supporting Entities**: Worksite, Client, Role, Position (XXI-XXV)
6. **Final Configuration**: Client/Position metadata (XXVI-XXVII)

## 🧪 API Testing Tools

### test-api-endpoints.sh
**Purpose**: **Complete API system validation** - tests all core API modules with authentication
**Usage**: `./tools/test-api-endpoints.sh [base_url] [email] [password]`
**When to Use**: API validation after changes, system health checks, authentication testing
**Key Features**:
- **✅ Complete API Coverage**: All endpoints from auth to project management
- **✅ JWT Authentication**: Tests login with proper token handling
- **✅ RBAC Validation**: Tests permission system integration
- **✅ Production Data Testing**: James Miller CEO account with comprehensive permissions
- **✅ Bearer Token Integration**: Proper Authorization headers for all API calls
- **✅ Detailed Results**: Color-coded output with pass/fail indicators
- **✅ Error Handling**: Comprehensive error reporting with debugging information

## 📊 Monitoring Tools

### logs-api.sh
**Purpose**: Views API server logs
**Usage**: `./tools/logs-api.sh [lines]` or `./tools/logs-api.sh -f`
**When to Use**: API debugging, monitoring API activity, troubleshooting backend issues
**Features**:
- View last N lines of API logs (default 100)
- Follow logs in real-time with `-f` flag
- Colored output for better readability

### logs-web.sh
**Purpose**: Views web application logs
**Usage**: `./tools/logs-web.sh [lines]` or `./tools/logs-web.sh -f`
**When to Use**: Frontend debugging, monitoring web server activity, troubleshooting UI issues
**Features**:
- View last N lines of web logs (default 100)
- Follow logs in real-time with `-f` flag
- Colored output for better readability

## 📋 Quick Reference Guide

### Common User Requests & Tool Mapping:
- **"Start the platform"** → `./tools/start-all.sh`
- **"Import/Reset the database"** → `./tools/db-import.sh`
- **"Test all API endpoints"** → `./tools/test-api-endpoints.sh`
- **"Check API logs"** → `./tools/logs-api.sh`
- **"Check web logs"** → `./tools/logs-web.sh`
- **"See what's running"** → Check process status or use Docker commands

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

## 🔄 Tool Usage Order & Dependencies

### Typical Development Workflow:
1. **Initial Setup**: `./tools/start-all.sh` (starts everything from scratch)
2. **Database Reset**: `./tools/db-import.sh` (when schema changes or data corruption)
3. **API Testing**: `./tools/test-api-endpoints.sh` (validate API functionality)
4. **Debugging**: `./tools/logs-api.sh` or `./tools/logs-web.sh` (monitor issues)

### Key Dependencies:
- **Docker Services**: Must be running before API/web services
- **Database Schema**: Import/reset before starting API server
- **API Server**: Must be running before web application can function
- **Process Management**: Services create PID files in `.pids/` directory

## 📁 Active Tools Directory

```
tools/
├── README.md             # This comprehensive guide
├── start-all.sh          # Complete platform startup (infrastructure + services)
├── db-import.sh          # Database schema import (28 DDL files)
├── test-api-endpoints.sh # API endpoint testing and validation
├── logs-api.sh           # API server log monitoring
└── logs-web.sh           # Web application log monitoring
```

## 💡 Best Practices & Guidelines

### For Development:
1. **Always use start-all.sh for initial setup** - ensures proper service startup order
2. **Use db-import.sh whenever schema changes** - maintains data consistency
3. **Test APIs after any backend changes** - use test-api-endpoints.sh for validation
4. **Monitor logs during development** - use logs-api.sh and logs-web.sh for debugging
5. **Check environment variables** - ensure database connectivity before running tools

### For Troubleshooting:
1. **Check service status first** - verify all containers and processes are running
2. **Review logs** - use monitoring tools to identify issues
3. **Restart services selectively** - stop individual services if needed
4. **Validate database** - run db-import.sh with --dry-run to check DDL files
5. **Test authentication** - use test-api-endpoints.sh to verify login functionality

### Production Considerations:
- All tools include comprehensive error handling and colored output
- Database tools support environment variable configuration
- API testing uses production-grade authentication workflows
- Logging tools provide real-time monitoring capabilities