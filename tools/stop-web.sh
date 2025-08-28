#!/bin/bash

# PMO Web Server Stop Script
# Usage: ./tools/stop-web.sh

set -e

WEB_NAME="pmo-web"
PID_FILE=".pids/web.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping PMO Web Server...${NC}"

# Check if PID file exists
if [[ ! -f "$PID_FILE" ]]; then
    echo -e "${YELLOW}⚠️  No PID file found. Server may not be running.${NC}"
    exit 0
fi

# Read PID from file
WEB_PID=$(cat "$PID_FILE")

# Check if process is running
if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Process $WEB_PID is not running. Cleaning up PID file.${NC}"
    rm -f "$PID_FILE"
    exit 0
fi

echo -e "${YELLOW}🔄 Stopping web server (PID: $WEB_PID)...${NC}"

# Graceful shutdown first
kill -TERM "$WEB_PID" 2>/dev/null || true

# Wait for graceful shutdown
WAIT_TIME=0
MAX_WAIT=10

while kill -0 "$WEB_PID" 2>/dev/null && [[ $WAIT_TIME -lt $MAX_WAIT ]]; do
    sleep 1
    ((WAIT_TIME++))
    echo -e "${YELLOW}⏳ Waiting for graceful shutdown... ($WAIT_TIME/${MAX_WAIT})${NC}"
done

# Force kill if still running
if kill -0 "$WEB_PID" 2>/dev/null; then
    echo -e "${RED}💀 Force killing server...${NC}"
    kill -9 "$WEB_PID" 2>/dev/null || true
    sleep 1
fi

# Verify it's stopped
if kill -0 "$WEB_PID" 2>/dev/null; then
    echo -e "${RED}❌ Failed to stop server${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Web server stopped successfully${NC}"
    rm -f "$PID_FILE"
fi