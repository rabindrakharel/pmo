#!/bin/bash

# PMO API Server Management Script
# Usage: ./tools/start-api.sh

set -e

API_NAME="pmo-api"
API_PORT=4000
PID_FILE=".pids/api.pid"
LOG_FILE="logs/api.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p .pids logs

echo -e "${BLUE}🚀 Starting PMO API Server...${NC}"

# Check if server is already running
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  API server is already running (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}🔄 Stopping existing server...${NC}"
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo -e "${RED}💀 Force killing existing server...${NC}"
            kill -9 "$OLD_PID" 2>/dev/null || true
            sleep 1
        fi
        
        rm -f "$PID_FILE"
        echo -e "${GREEN}✅ Stopped existing server${NC}"
    else
        # PID file exists but process is not running, clean up
        rm -f "$PID_FILE"
    fi
fi

# Check if port is in use by another process and kill it
if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $API_PORT is in use by another process${NC}"
    echo "Processes using port $API_PORT:"
    lsof -Pi :$API_PORT -sTCP:LISTEN
    
    echo -e "${YELLOW}🔄 Killing processes using port $API_PORT...${NC}"
    PIDS=$(lsof -Pi :$API_PORT -sTCP:LISTEN -t)
    for pid in $PIDS; do
        echo -e "${YELLOW}   Killing PID: $pid${NC}"
        kill "$pid" 2>/dev/null || true
    done
    
    sleep 2
    
    # Force kill if still running
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}💀 Force killing remaining processes...${NC}"
        PIDS=$(lsof -Pi :$API_PORT -sTCP:LISTEN -t)
        for pid in $PIDS; do
            echo -e "${RED}   Force killing PID: $pid${NC}"
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 1
    fi
    
    echo -e "${GREEN}✅ Cleared port $API_PORT${NC}"
fi

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Check if dependencies are installed
if [[ ! -d "node_modules" ]] || [[ ! -d "apps/api/node_modules" ]]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install
fi

echo -e "${BLUE}🔧 Starting API server on port $API_PORT (dev mode)...${NC}"

# Start the API server in background and capture PID using tsx for development
cd apps/api
# Load environment variables from project root and start server with tsx
nohup bash -c "set -a; source ../../.env; set +a; DEV_BYPASS_OIDC=false DATABASE_URL='postgresql://app:app@localhost:5434/app' REDIS_URL='redis://localhost:6379' JWT_SECRET='your-super-secret-jwt-key-change-in-production' npx tsx src/server.ts" > "../../$LOG_FILE" 2>&1 &
API_PID=$!

# Save PID to file
echo "$API_PID" > "../../$PID_FILE"

# Wait a moment and check if the process is still running
sleep 3
if kill -0 "$API_PID" 2>/dev/null; then
    echo -e "${GREEN}✅ API server started successfully!${NC}"
    echo -e "${GREEN}   PID: $API_PID${NC}"
    echo -e "${GREEN}   Port: $API_PORT${NC}"
    echo -e "${GREEN}   Logs: $LOG_FILE${NC}"
    echo -e "${GREEN}   Health: http://localhost:$API_PORT/healthz${NC}"
    echo -e "${GREEN}   API Docs: http://localhost:$API_PORT/docs${NC}"
    echo ""
    echo -e "${BLUE}💡 Use ./tools/stop-api.sh to stop the server${NC}"
    echo -e "${BLUE}💡 Use ./tools/restart-api.sh to restart the server${NC}"
    echo -e "${BLUE}💡 Use ./tools/logs-api.sh to view logs${NC}"
else
    echo -e "${RED}❌ Failed to start API server${NC}"
    echo -e "${RED}Check logs: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi