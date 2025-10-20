#!/bin/bash

# ============================================================================
# PMO Enterprise - Quick Database Query Tool
# ============================================================================
#
# Execute SQL queries against the PMO database with formatted output
#
# Usage:
#   ./tools/run_query.sh "SELECT * FROM app.d_project LIMIT 5;"
#   ./tools/run_query.sh "SELECT COUNT(*) FROM app.d_employee;"
#
# Environment Variables:
#   DB_HOST      - Database host (default: localhost)
#   DB_PORT      - Database port (default: 5434)
#   DB_USER      - Database user (default: app)
#   DB_PASSWORD  - Database password (default: app)
#   DB_NAME      - Database name (default: app)
#
# ============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Database configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5434}
DB_USER=${DB_USER:-app}
DB_PASSWORD=${DB_PASSWORD:-app}
DB_NAME=${DB_NAME:-app}

# Check if query provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: No query provided${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 \"SELECT * FROM app.d_project LIMIT 5;\""
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 \"SELECT * FROM app.d_employee;\""
    echo "  $0 \"SELECT COUNT(*) FROM app.d_project;\""
    echo "  $0 \"\\d app.d_project\"  # Describe table"
    echo "  $0 \"\\dt app.*\"         # List all tables"
    exit 1
fi

QUERY="$1"

# Print header
echo -e "${MAGENTA}🔍 PMO Database Query${NC}"
echo -e "${MAGENTA}=====================${NC}"
echo -e "${CYAN}Query:${NC} $QUERY"
echo ""

# Execute query
PGPASSWORD=$DB_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "$QUERY"

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Query executed successfully${NC}"
else
    echo ""
    echo -e "${RED}❌ Query execution failed${NC}"
    exit 1
fi
