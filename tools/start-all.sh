#!/bin/bash

# PMO Start All Services Script
# Usage: ./tools/start-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 Starting PMO Platform - All Services${NC}"

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Start infrastructure first
echo -e "${BLUE}1️⃣ Starting infrastructure services...${NC}"
if command -v make >/dev/null 2>&1; then
    make up
else
    echo -e "${YELLOW}⚠️  Make not found, starting Docker Compose directly...${NC}"
    docker compose up -d
fi

# Wait for infrastructure to be ready
echo -e "${YELLOW}⏳ Waiting for infrastructure to be ready...${NC}"
sleep 10

# Check if database is ready
echo -e "${BLUE}2️⃣ Checking database readiness...${NC}"
for i in {1..30}; do
    if pg_isready -h localhost -p 5434 -U app -d app >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo -e "${RED}❌ Database failed to start after 30 attempts${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⏳ Waiting for database... (attempt $i/30)${NC}"
    sleep 2
done

# Always drop and recreate database schema for clean startup
echo -e "${BLUE}3️⃣ Recreating database schema...${NC}"
echo -e "${YELLOW}🗑️  Dropping all tables and recreating from DDL files...${NC}"
"$SCRIPT_DIR/db-import.sh" --verbose || {
  echo -e "${RED}❌ Database import failed via db-import.sh${NC}"
  exit 1
}

# Start API server
echo -e "${BLUE}4️⃣ Starting API server...${NC}"
"$SCRIPT_DIR/start-api.sh"

# Wait a moment for API to start
sleep 3

# Start web server
echo -e "${BLUE}5️⃣ Starting web server...${NC}"
"$SCRIPT_DIR/start-web.sh"

echo ""
echo -e "${PURPLE}🎉 PMO Platform started successfully!${NC}"
echo ""
echo -e "${GREEN}📊 Services Status:${NC}"
echo -e "${GREEN}   • Infrastructure: Running (Docker Compose)${NC}"
echo -e "${GREEN}   • API Server: http://localhost:4000${NC}"
echo -e "${GREEN}   • Web Application: http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}🔗 Quick Links:${NC}"
echo -e "${BLUE}   • Application: http://localhost:5173${NC}"
echo -e "${BLUE}   • API Documentation: http://localhost:4000/docs${NC}"
echo -e "${BLUE}   • API Health: http://localhost:4000/healthz${NC}"
echo -e "${BLUE}   • MinIO Console: http://localhost:9001 (minio/minio123)${NC}"
echo -e "${BLUE}   • MailHog: http://localhost:8025${NC}"
echo ""
echo -e "${YELLOW}💡 Management Commands:${NC}"
echo -e "${YELLOW}   • Stop all: ./tools/stop-all.sh${NC}"
echo -e "${YELLOW}   • Restart all: ./tools/restart-all.sh${NC}"
echo -e "${YELLOW}   • View logs: ./tools/logs-api.sh or ./tools/logs-web.sh${NC}"
