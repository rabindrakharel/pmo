#!/bin/bash
# Database Drop Tool - Drops all tables and schema
# Usage: ./tools/db-drop.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5434}
DB_USER=${DB_USER:-app}
DB_PASSWORD=${DB_PASSWORD:-app}
DB_NAME=${DB_NAME:-app}

echo -e "${YELLOW}🗑️  PMO Database Drop Tool${NC}"
echo "=================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

echo -e "${YELLOW}Dropping app schema and all tables...${NC}"

# Drop schema with cascade
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
    "DROP SCHEMA IF EXISTS app CASCADE; CREATE SCHEMA app;"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema dropped and recreated successfully${NC}"
    echo ""
    echo "Next steps:"
    echo "- Run ./tools/db-import.sh to import schema and data"
    echo "- Or run ./tools/db-recreate.sh to drop and recreate in one step"
else
    echo -e "${RED}❌ Failed to drop schema${NC}"
    exit 1
fi