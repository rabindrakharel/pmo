#!/bin/bash

# PMO Web Server Management Script
# Usage: ./tools/start-web.sh

set -e

WEB_NAME="pmo-web"
WEB_PORT=5173
PID_FILE=".pids/web.pid"
LOG_FILE="logs/web.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directories if they don't exist
mkdir -p .pids logs

echo -e "${BLUE}🚀 Starting PMO Web Server...${NC}"

# Check if server is already running
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Web server is already running (PID: $OLD_PID)${NC}"
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
if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ Port $WEB_PORT is already in use by another process${NC}"
    echo "Processes using port $WEB_PORT:"
    lsof -Pi :$WEB_PORT -sTCP:LISTEN
    exit 1
fi

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Check if dependencies are installed
if [[ ! -d "node_modules" ]] || [[ ! -d "apps/web/node_modules" ]]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install
fi

echo -e "${BLUE}🔧 Starting web development server on port $WEB_PORT...${NC}"

# Start the web server in background and capture PID
cd apps/web
nohup pnpm dev > "../../$LOG_FILE" 2>&1 &
WEB_PID=$!

# Save PID to file
echo "$WEB_PID" > "../../$PID_FILE"

# Wait a moment and check if the process is still running
sleep 5
if kill -0 "$WEB_PID" 2>/dev/null; then
    echo -e "${GREEN}✅ Web server started successfully!${NC}"
    echo -e "${GREEN}   PID: $WEB_PID${NC}"
    echo -e "${GREEN}   Port: $WEB_PORT${NC}"
    echo -e "${GREEN}   Logs: $LOG_FILE${NC}"
    echo -e "${GREEN}   URL: http://localhost:$WEB_PORT${NC}"
    echo ""
    echo -e "${BLUE}💡 Use ./tools/stop-web.sh to stop the server${NC}"
    echo -e "${BLUE}💡 Use ./tools/restart-web.sh to restart the server${NC}"
    echo -e "${BLUE}💡 Use ./tools/logs-web.sh to view logs${NC}"
else
    echo -e "${RED}❌ Failed to start web server${NC}"
    echo -e "${RED}Check logs: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi