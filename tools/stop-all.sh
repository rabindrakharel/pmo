#!/bin/bash

# PMO Stop All Services Script
# Usage: ./tools/stop-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🛑 Stopping PMO Platform - All Services${NC}"

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"

# Stop web server
echo -e "${BLUE}1️⃣ Stopping web server...${NC}"
"$SCRIPT_DIR/stop-web.sh"

# Stop API server
echo -e "${BLUE}2️⃣ Stopping API server...${NC}"
"$SCRIPT_DIR/stop-api.sh"

# Stop infrastructure services
echo -e "${BLUE}3️⃣ Stopping infrastructure services...${NC}"
if command -v make >/dev/null 2>&1; then
    make down
else
    echo -e "${YELLOW}⚠️  Make not found, stopping Docker Compose directly...${NC}"
    docker compose down
fi

echo ""
echo -e "${PURPLE}✅ PMO Platform stopped successfully!${NC}"
echo ""
echo -e "${BLUE}💡 Management Commands:${NC}"
echo -e "${BLUE}   • Start all: ./tools/start-all.sh${NC}"
echo -e "${BLUE}   • Restart all: ./tools/restart-all.sh${NC}"