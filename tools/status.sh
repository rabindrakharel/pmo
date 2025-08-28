#!/bin/bash

# PMO Platform Status Script
# Usage: ./tools/status.sh

API_PID_FILE=".pids/api.pid"
WEB_PID_FILE=".pids/web.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}📊 PMO Platform Status${NC}"
echo ""

# Check API server
echo -e "${BLUE}🔧 API Server:${NC}"
if [[ -f "$API_PID_FILE" ]]; then
    API_PID=$(cat "$API_PID_FILE")
    if kill -0 "$API_PID" 2>/dev/null; then
        echo -e "${GREEN}   ✅ Running (PID: $API_PID)${NC}"
        echo -e "${GREEN}   📍 http://localhost:4000${NC}"
    else
        echo -e "${RED}   ❌ Not running (stale PID file)${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  Not running${NC}"
fi

echo ""

# Check Web server
echo -e "${BLUE}🌐 Web Server:${NC}"
if [[ -f "$WEB_PID_FILE" ]]; then
    WEB_PID=$(cat "$WEB_PID_FILE")
    if kill -0 "$WEB_PID" 2>/dev/null; then
        echo -e "${GREEN}   ✅ Running (PID: $WEB_PID)${NC}"
        echo -e "${GREEN}   📍 http://localhost:5173${NC}"
    else
        echo -e "${RED}   ❌ Not running (stale PID file)${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  Not running${NC}"
fi

echo ""

# Check Docker services
echo -e "${BLUE}🐳 Infrastructure Services:${NC}"
if command -v docker >/dev/null 2>&1; then
    RUNNING_CONTAINERS=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l)
    TOTAL_CONTAINERS=$(docker compose ps --services 2>/dev/null | wc -l)
    
    if [[ $RUNNING_CONTAINERS -gt 0 ]]; then
        echo -e "${GREEN}   ✅ $RUNNING_CONTAINERS/$TOTAL_CONTAINERS containers running${NC}"
        docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | tail -n +2 | while read line; do
            echo -e "${GREEN}   • $line${NC}"
        done
    else
        echo -e "${YELLOW}   ⚠️  No containers running${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠️  Docker not available${NC}"
fi

echo ""
echo -e "${BLUE}💡 Management Commands:${NC}"
echo -e "${BLUE}   • Start all: ./tools/start-all.sh${NC}"
echo -e "${BLUE}   • Stop all: ./tools/stop-all.sh${NC}"
echo -e "${BLUE}   • Restart all: ./tools/restart-all.sh${NC}"
echo -e "${BLUE}   • View logs: ./tools/logs-api.sh or ./tools/logs-web.sh${NC}"