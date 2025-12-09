#!/bin/bash

# Restart API Server
# Description: Stops and restarts the API server with robust cleanup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Restarting API server...${NC}"

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Source environment variables from .env file
if [[ -f "apps/api/.env" ]]; then
    echo -e "${BLUE}🔧 Loading environment variables from apps/api/.env${NC}"
    set -a  # automatically export all variables
    source apps/api/.env
    set +a  # stop auto-exporting
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found at apps/api/.env${NC}"
fi

API_PORT=4000
API_PID_FILE=".pids/api.pid"
API_LOG_FILE="logs/api.log"

# Create directories if they don't exist
mkdir -p .pids logs

# Check if API server is already running via PID file
if [[ -f "$API_PID_FILE" ]]; then
    OLD_PID=$(cat "$API_PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  API server is running (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}🔄 Stopping API server...${NC}"
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo -e "${RED}💀 Force killing API server...${NC}"
            kill -9 "$OLD_PID" 2>/dev/null || true
            sleep 1
        fi

        rm -f "$API_PID_FILE"
        echo -e "${GREEN}✅ Stopped existing API server${NC}"
    else
        # PID file exists but process is not running, clean up
        rm -f "$API_PID_FILE"
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

# Check if dependencies are installed
if [[ ! -d "node_modules" ]] || [[ ! -d "apps/api/node_modules" ]]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

echo -e "${BLUE}🔧 Starting API development server on port $API_PORT...${NC}"

# Load nvm to ensure correct Node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Start the API server in background and capture PID
cd apps/api
nohup npm run dev > "../../$API_LOG_FILE" 2>&1 &
API_PID=$!

# Save PID to file
echo "$API_PID" > "../../$API_PID_FILE"

# Go back to project root
cd ../..

# Wait a moment and check if the API process is still running
sleep 5
if kill -0 "$API_PID" 2>/dev/null; then
    echo -e "${GREEN}✅ API server restarted successfully${NC}"
    echo -e "${GREEN}   PID: $API_PID${NC}"
    echo -e "${GREEN}   Port: $API_PORT${NC}"
    echo -e "${GREEN}   Logs: $API_LOG_FILE${NC}"
    echo -e "${GREEN}   URL: http://localhost:$API_PORT${NC}"
else
    echo -e "${RED}❌ API server failed to start${NC}"
    echo -e "${RED}Check logs: $API_LOG_FILE${NC}"
    rm -f "$API_PID_FILE"
    exit 1
fi
