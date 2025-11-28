#!/bin/bash

# PMO Start All Services Script
# Usage: ./tools/start-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 Starting PMO Platform - All Services${NC}"

# Get the directory of this script
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Start infrastructure first
echo -e "${BLUE}1️⃣ Starting infrastructure services...${NC}"
if command -v make >/dev/null 2>&1; then
    make up
else
    echo -e "${YELLOW}⚠️  Make not found, starting Docker Compose directly...${NC}"
    docker compose up -d
fi

# Wait for infrastructure to be ready
echo -e "${YELLOW}⏳ Waiting for infrastructure to be ready...${NC}"
sleep 10

# Check if database is ready
echo -e "${BLUE}2️⃣ Checking database readiness...${NC}"
for i in {1..30}; do
    if pg_isready -h localhost -p 5434 -U app -d app >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo -e "${RED}❌ Database failed to start after 30 attempts${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⏳ Waiting for database... (attempt $i/30)${NC}"
    sleep 2
done

# Always drop and recreate database schema for clean startup
echo -e "${BLUE}3️⃣ Recreating database schema...${NC}"
echo -e "${YELLOW}🗑️  Dropping all tables and recreating from DDL files...${NC}"
"$SCRIPT_DIR/db-import.sh" --verbose || {
  echo -e "${RED}❌ Database import failed via db-import.sh${NC}"
  exit 1
}

# Start API server
echo -e "${BLUE}4️⃣ Starting API server...${NC}"

# Use the dedicated restart-api.sh script for DRY principle
if "$SCRIPT_DIR/restart-api.sh"; then
    API_STATUS="✅ Running"
    sleep 3
else
    echo -e "${YELLOW}⚠️  API server failed to start, check logs: logs/api.log${NC}"
    echo -e "${YELLOW}⚠️  Continuing with web server...${NC}"
    API_STATUS="❌ Failed"
fi

# Start PubSub WebSocket server
echo -e "${BLUE}5️⃣ Starting PubSub WebSocket server...${NC}"

PUBSUB_PORT=4001
PUBSUB_PID_FILE=".pids/pubsub.pid"
PUBSUB_LOG_FILE="logs/pubsub.log"

# Check if PubSub server is already running
if [[ -f "$PUBSUB_PID_FILE" ]]; then
    OLD_PID=$(cat "$PUBSUB_PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  PubSub server is already running (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}🔄 Stopping existing PubSub server...${NC}"
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo -e "${RED}💀 Force killing existing PubSub server...${NC}"
            kill -9 "$OLD_PID" 2>/dev/null || true
            sleep 1
        fi

        rm -f "$PUBSUB_PID_FILE"
        echo -e "${GREEN}✅ Stopped existing PubSub server${NC}"
    else
        rm -f "$PUBSUB_PID_FILE"
    fi
fi

# Check if port is in use
if lsof -Pi :$PUBSUB_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $PUBSUB_PORT is in use, clearing...${NC}"
    PIDS=$(lsof -Pi :$PUBSUB_PORT -sTCP:LISTEN -t)
    for pid in $PIDS; do
        kill "$pid" 2>/dev/null || true
    done
    sleep 2
fi

echo -e "${BLUE}🔧 Starting PubSub WebSocket server on port $PUBSUB_PORT...${NC}"

# Start the PubSub server in background
cd apps/pubsub
nohup pnpm dev > "../../$PUBSUB_LOG_FILE" 2>&1 &
PUBSUB_PID=$!

# Save PID to file
echo "$PUBSUB_PID" > "../../$PUBSUB_PID_FILE"

cd ../..

# Wait and check if PubSub is running
sleep 3
if kill -0 "$PUBSUB_PID" 2>/dev/null; then
    echo -e "${GREEN}✅ PubSub server started successfully${NC}"
    echo -e "${GREEN}   PID: $PUBSUB_PID${NC}"
    echo -e "${GREEN}   Port: $PUBSUB_PORT${NC}"
    echo -e "${GREEN}   Logs: $PUBSUB_LOG_FILE${NC}"
    PUBSUB_STATUS="✅ Running"
else
    echo -e "${YELLOW}⚠️  PubSub server failed to start, check logs: $PUBSUB_LOG_FILE${NC}"
    PUBSUB_STATUS="❌ Failed"
    rm -f "$PUBSUB_PID_FILE"
fi

# Start web server
echo -e "${BLUE}6️⃣ Starting web server...${NC}"

WEB_PORT=5173
WEB_PID_FILE=".pids/web.pid" 
WEB_LOG_FILE="logs/web.log"

# Check if web server is already running
if [[ -f "$WEB_PID_FILE" ]]; then
    OLD_PID=$(cat "$WEB_PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Web server is already running (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}🔄 Stopping existing web server...${NC}"
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo -e "${RED}💀 Force killing existing web server...${NC}"
            kill -9 "$OLD_PID" 2>/dev/null || true
            sleep 1
        fi
        
        rm -f "$WEB_PID_FILE"
        echo -e "${GREEN}✅ Stopped existing web server${NC}"
    else
        # PID file exists but process is not running, clean up
        rm -f "$WEB_PID_FILE"
    fi
fi

# Check if port is in use by another process and kill it
if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $WEB_PORT is in use by another process${NC}"
    echo "Processes using port $WEB_PORT:"
    lsof -Pi :$WEB_PORT -sTCP:LISTEN
    
    echo -e "${YELLOW}🔄 Killing processes using port $WEB_PORT...${NC}"
    PIDS=$(lsof -Pi :$WEB_PORT -sTCP:LISTEN -t)
    for pid in $PIDS; do
        echo -e "${YELLOW}   Killing PID: $pid${NC}"
        kill "$pid" 2>/dev/null || true
    done
    
    sleep 2
    
    # Force kill if still running
    if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}💀 Force killing remaining processes...${NC}"
        PIDS=$(lsof -Pi :$WEB_PORT -sTCP:LISTEN -t)
        for pid in $PIDS; do
            echo -e "${RED}   Force killing PID: $pid${NC}"
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 1
    fi
    
    echo -e "${GREEN}✅ Cleared port $WEB_PORT${NC}"
fi

echo -e "${BLUE}🔧 Starting web development server on port $WEB_PORT...${NC}"

# Start the web server in background and capture PID
cd apps/web
nohup pnpm dev --port $WEB_PORT > "../../$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!

# Save PID to file
echo "$WEB_PID" > "../../$WEB_PID_FILE"

# Go back to project root
cd ../..

# Wait a moment and check if the web process is still running
sleep 5
if kill -0 "$WEB_PID" 2>/dev/null; then
    echo -e "${GREEN}✅ Web server started successfully${NC}"
    echo -e "${GREEN}   PID: $WEB_PID${NC}"
    echo -e "${GREEN}   Port: $WEB_PORT${NC}"
    echo -e "${GREEN}   Logs: $WEB_LOG_FILE${NC}"
    echo -e "${GREEN}   URL: http://localhost:$WEB_PORT${NC}"
    WEB_STATUS="✅ Running"
else
    echo -e "${RED}❌ Web server failed to start${NC}"
    echo -e "${RED}Check logs: $WEB_LOG_FILE${NC}"
    WEB_STATUS="❌ Failed"
    rm -f "$WEB_PID_FILE"
    exit 1
fi

echo ""
echo -e "${PURPLE}🎉 PMO Platform started successfully!${NC}"
echo ""
echo -e "${GREEN}📊 Services Status:${NC}"
echo -e "${GREEN}   • Infrastructure: ✅ Running (Docker Compose)${NC}"
echo -e "${GREEN}     - PostgreSQL: localhost:5434${NC}"
echo -e "${GREEN}     - Redis: localhost:6379${NC}"
echo -e "${GREEN}     - RabbitMQ: localhost:5672 (AMQP)${NC}"
echo -e "${GREEN}     - MinIO: localhost:9000${NC}"
echo -e "${GREEN}     - MailHog: localhost:1025 (SMTP)${NC}"
echo -e "   • API Server: ${API_STATUS} http://localhost:4000${NC}"
echo -e "   • PubSub WebSocket: ${PUBSUB_STATUS} ws://localhost:4001${NC}"
echo -e "   • Web Application: ${WEB_STATUS} http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}🔗 Quick Links:${NC}"
echo -e "${BLUE}   • Application: http://localhost:5173${NC}"
echo -e "${BLUE}   • API Documentation: http://localhost:4000/docs${NC}"
echo -e "${BLUE}   • API Health: http://localhost:4000/healthz${NC}"
echo -e "${BLUE}   • RabbitMQ Management: http://localhost:15672 (admin/admin123)${NC}"
echo -e "${BLUE}   • MinIO Console: http://localhost:9001 (minio/minio123)${NC}"
echo -e "${BLUE}   • MailHog: http://localhost:8025${NC}"
echo ""
echo -e "${YELLOW}💡 Management Commands:${NC}"
echo -e "${YELLOW}   • Stop all: ./tools/stop-all.sh${NC}"
echo -e "${YELLOW}   • Restart all: ./tools/restart-all.sh${NC}"
echo -e "${YELLOW}   • View logs: ./tools/logs-api.sh or ./tools/logs-web.sh${NC}"
