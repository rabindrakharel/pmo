#!/bin/bash

# Restart API Server
# Description: Stops and restarts the API server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Restarting API server...${NC}"

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Stop existing API process
if [ -f .pids/api.pid ]; then
  PID=$(cat .pids/api.pid)
  if ps -p $PID > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping API server (PID: $PID)...${NC}"
    kill $PID 2>/dev/null || true
    sleep 2
  fi
fi

# Start API server
echo -e "${YELLOW}Starting API server...${NC}"
cd apps/api

DATABASE_URL="${DATABASE_URL:-postgresql://app:app@localhost:5434/app}" \
REDIS_URL="${REDIS_URL:-redis://localhost:6379}" \
JWT_SECRET="${JWT_SECRET:-your-super-secret-jwt-key-change-in-production}" \
pnpm dev > ../../logs/api.log 2>&1 &

API_PID=$!
echo $API_PID > ../../.pids/api.pid

echo -e "${GREEN}✓ API server restarted (PID: $API_PID)${NC}"
echo -e "${GREEN}✓ Logs: logs/api.log${NC}"
echo -e "${GREEN}✓ URL: http://localhost:4000${NC}"
