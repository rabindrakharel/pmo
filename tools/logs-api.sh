#!/bin/bash

# PMO API Server Logs Script
# Usage: ./tools/logs-api.sh [lines]

API_LOG_FILE="logs/api.log"
LINES=${1:-100}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 PMO API Server Logs (last $LINES lines)${NC}"
echo -e "${BLUE}Log file: $API_LOG_FILE${NC}"
echo ""

if [[ ! -f "$API_LOG_FILE" ]]; then
    echo -e "${YELLOW}⚠️  Log file not found: $API_LOG_FILE${NC}"
    echo -e "${YELLOW}   Make sure the API server has been started at least once${NC}"
    exit 1
fi

# Use tail with follow option if no line count specified and file exists
if [[ "$1" == "-f" ]] || [[ "$1" == "--follow" ]]; then
    echo -e "${GREEN}👀 Following log file (Ctrl+C to exit)...${NC}"
    echo ""
    tail -f "$API_LOG_FILE"
else
    tail -n "$LINES" "$API_LOG_FILE"
fi