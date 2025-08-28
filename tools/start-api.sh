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

# Check if port is in use by another process
if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ Port $API_PORT is already in use by another process${NC}"
    echo "Processes using port $API_PORT:"
    lsof -Pi :$API_PORT -sTCP:LISTEN
    exit 1
fi

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Check if dependencies are installed
if [[ ! -d "node_modules" ]] || [[ ! -d "apps/api/node_modules" ]]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install
fi

# Build if necessary (check if dist exists and is newer than src)
if [[ ! -d "apps/api/dist" ]] || [[ "apps/api/src" -nt "apps/api/dist" ]]; then
    echo -e "${YELLOW}🔨 Building API server...${NC}"
    pnpm --filter api build
fi

echo -e "${BLUE}🔧 Starting API server on port $API_PORT...${NC}"

# Start the API server in background and capture PID
cd apps/api
# Load environment variables from project root and start server
nohup bash -c "set -a; source ../../.env; set +a; pnpm start" > "../../$LOG_FILE" 2>&1 &
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