# PMO Platform Management Tools

Complete toolkit for platform operations, database management, API testing, and monitoring.

---

## 📁 Tools Directory

```
tools/
├── README.md          # This guide
├── start-all.sh       # Start all services (DB + API + Web)
├── restart-api.sh     # Restart API server only
├── db-import.sh       # Import database schema (28 DDL files)
├── test-api.sh        # Generic API testing tool
├── logs-api.sh        # View API server logs
└── logs-web.sh        # View web application logs
```

---

## 🚀 Quick Start

### Start the Platform

```bash
./tools/start-all.sh
```

**What it does:**
- Starts Docker services (PostgreSQL, Redis, MinIO, MailHog)
- Imports database schema with all 28 DDL files
- Starts API server on port 4000
- Starts web application on port 5173

**Access:**
- Web App: http://localhost:5173
- API: http://localhost:4000
- API Docs: http://localhost:4000/docs

### Restart API Server Only

```bash
./tools/restart-api.sh
```

**What it does:**
- Stops the running API server process
- Restarts API server on port 4000
- Preserves Docker services (DB, Redis, MinIO, MailHog)
- Keeps web application running

**When to use:**
- After making API code changes
- After modifying environment variables
- When API server becomes unresponsive
- When you don't need to restart the entire stack

---

## 🧪 Test API Endpoints

### Quick Testing

```bash
# Test any endpoint
./tools/test-api.sh <METHOD> <ENDPOINT> [JSON_DATA]

# Examples
./tools/test-api.sh GET /api/v1/form
./tools/test-api.sh POST /api/v1/form '{"name":"Test","schema":{"steps":[]}}'
./tools/test-api.sh PUT /api/v1/form/uuid '{"name":"Updated"}'
./tools/test-api.sh DELETE /api/v1/form/uuid
```

**Features:**
- Auto-authentication with James Miller account
- Colored HTTP status indicators
- JSON formatting with `jq`
- Supports GET, POST, PUT, DELETE

**More examples:** See commands below or test different endpoints

---

## 🗄️ Database Management

### Import/Reset Database

```bash
./tools/db-import.sh
```

**What it does:**
- Drops existing schema
- Imports 28 DDL files in dependency order
- Validates schema integrity
- Loads sample data (5 employees, 5 projects, 8 tasks, etc.)

**Options:**
```bash
./tools/db-import.sh --dry-run       # Validate without importing
./tools/db-import.sh --verbose       # Detailed output
./tools/db-import.sh --skip-validation  # Skip post-import checks
```

**When to use:**
- Initial setup
- After schema changes
- Data corruption recovery
- Development data refresh

---

## 📊 View Logs

### API Server Logs

```bash
./tools/logs-api.sh [lines]      # View last N lines (default: 100)
./tools/logs-api.sh -f           # Follow logs in real-time
```

### Web Application Logs

```bash
./tools/logs-web.sh [lines]      # View last N lines (default: 100)
./tools/logs-web.sh -f           # Follow logs in real-time
```

---

## 📋 Common Workflows

### Development Setup
```bash
# 1. Start everything
./tools/start-all.sh

# 2. Test API is working
./tools/test-api.sh GET /api/v1/form

# 3. Monitor API logs
./tools/logs-api.sh -f
```

### After Schema Changes
```bash
# 1. Reimport database
./tools/db-import.sh

# 2. Restart API server
./tools/restart-api.sh

# 3. Test endpoints
./tools/test-api.sh GET /api/v1/project
```

### After API Code Changes
```bash
# 1. Restart API server
./tools/restart-api.sh

# 2. Monitor logs for errors
./tools/logs-api.sh -f

# 3. Test your changes
./tools/test-api.sh GET /api/v1/your-endpoint
```

### Debugging Issues
```bash
# 1. Check API logs
./tools/logs-api.sh

# 2. Check web logs
./tools/logs-web.sh

# 3. Test specific endpoint
./tools/test-api.sh GET /api/v1/employee
```

---

## 🔧 Environment Variables

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5434` | Database port |
| `DB_USER` | `app` | Database user |
| `DB_PASSWORD` | `app` | Database password |
| `DB_NAME` | `app` | Database name |

### API Testing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:4000` | API base URL |
| `API_TEST_EMAIL` | `james.miller@huronhome.ca` | Login email |
| `API_TEST_PASSWORD` | `password123` | Login password |
| `NO_AUTH` | (unset) | Skip authentication |

**Example:**
```bash
API_URL=http://staging.api.com ./tools/test-api.sh GET /api/v1/form
```

---

## 🌐 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Web Application | 5173 | http://localhost:5173 |
| API Server | 4000 | http://localhost:4000 |
| API Documentation | 4000 | http://localhost:4000/docs |
| PostgreSQL | 5434 | localhost:5434 |
| Redis | 6379 | localhost:6379 |
| MinIO Console | 9001 | http://localhost:9001 |
| MailHog | 8025 | http://localhost:8025 |

**Default Credentials:**
- Database: `app` / `app`
- MinIO: `minio` / `minio123`
- Test Account: `james.miller@huronhome.ca` / `password123`

---

## 📚 Additional Documentation

- **[Database Schema](../db/README.md)** - DDL files and data model
- **[API Documentation](../apps/api/README.md)** - Backend architecture
- **[Frontend Guide](../apps/web/README.md)** - UI/UX documentation
- **[Main README](../README.md)** - Project overview
