#!/bin/bash
# Database Import Tool - Imports schema and curated data
# Usage: ./tools/db-import.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5434}
DB_USER=${DB_USER:-app}
DB_PASSWORD=${DB_PASSWORD:-app}
DB_NAME=${DB_NAME:-app}

# Schema file path
SCHEMA_FILE=${SCHEMA_FILE:-"$(dirname "$0")/../db/schema.sql"}

echo -e "${BLUE}📥 PMO Database Import Tool${NC}"
echo "===================================="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Schema file: $SCHEMA_FILE"
echo ""

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ Schema file not found: $SCHEMA_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Importing schema and curated data...${NC}"

# Import schema
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Schema and data imported successfully${NC}"
    
    # Show table count
    echo -e "${BLUE}📊 Database Statistics:${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "SELECT schemaname, count(*) as table_count FROM pg_tables WHERE schemaname = 'app' GROUP BY schemaname;"
    
    # Show sample data counts
    echo ""
    echo -e "${BLUE}📋 Sample Data Counts:${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "SELECT 
            (SELECT COUNT(*) FROM app.d_emp) as employees,
            (SELECT COUNT(*) FROM app.d_client) as clients,
            (SELECT COUNT(*) FROM app.d_worksite) as worksites,
            (SELECT COUNT(*) FROM app.app_scope_d_route_page) as pages,
            (SELECT COUNT(*) FROM app.rel_user_scope) as user_permissions;"
    
    echo ""
    echo -e "${GREEN}Database ready for use!${NC}"
else
    echo -e "${RED}❌ Failed to import schema${NC}"
    exit 1
fi