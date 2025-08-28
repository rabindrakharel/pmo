#!/bin/bash

# PMO Web Server Restart Script
# Usage: ./tools/restart-web.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Restarting PMO Web Server...${NC}"

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"

# Stop the server
echo -e "${YELLOW}1️⃣ Stopping existing server...${NC}"
"$SCRIPT_DIR/stop-web.sh"

# Wait a moment
sleep 2

# Start the server
echo -e "${YELLOW}2️⃣ Starting server...${NC}"
"$SCRIPT_DIR/start-web.sh"

echo -e "${GREEN}✅ Web server restarted successfully!${NC}"