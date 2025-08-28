#!/bin/bash

# PMO Restart All Services Script
# Usage: ./tools/restart-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🔄 Restarting PMO Platform - All Services${NC}"

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"

# Stop all services first
echo -e "${YELLOW}1️⃣ Stopping all services...${NC}"
"$SCRIPT_DIR/stop-all.sh"

# Wait a moment
echo -e "${YELLOW}⏳ Waiting for services to fully stop...${NC}"
sleep 5

# Start all services
echo -e "${YELLOW}2️⃣ Starting all services...${NC}"
"$SCRIPT_DIR/start-all.sh"

echo -e "${GREEN}✅ All services restarted successfully!${NC}"